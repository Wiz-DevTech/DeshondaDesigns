#!/usr/bin/env node
/**
 * CI seed for the DeShonda worker.
 * Applies worker/schema.sql to the remote D1 database (idempotent) and seeds
 * the meta table with:
 *   - JWT_SECRET          (random, generated once)
 *   - ADMIN_PASSWORD_HASH (random admin password, generated once, printed once)
 *   - STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET (upserted only when provided
 *     via env, so Stripe keys can be updated by re-running with new values)
 * Uses the D1 Query API directly (no wrangler needed).
 */
import { readFile } from "node:fs/promises";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
let ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!ACCOUNT) {
  // fall back to .cf-env written by ci-bootstrap.mjs (non-Actions runs)
  try {
    const envFile = await readFile(new URL("../.cf-env", import.meta.url), "utf8");
    const m = envFile.match(/CLOUDFLARE_ACCOUNT_ID=(\S+)/);
    if (m) ACCOUNT = m[1];
  } catch {
    /* no .cf-env */
  }
}
if (!TOKEN || !ACCOUNT) {
  console.error("CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required (run ci-bootstrap.mjs first)");
  process.exit(1);
}

const raw = (await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"))
  .replace(/^\s*\/\/.*$/gm, "") // strip // line comments (JSONC)
  .replace(/\/\*[\s\S]*?\*\//g, ""); // strip /* */ block comments
const cfg = JSON.parse(raw);
const dbId = cfg.d1_databases?.[0]?.database_id;
if (!dbId) {
  console.error("no d1 database_id found in wrangler.jsonc — run ci-bootstrap.mjs first");
  process.exit(1);
}

async function query(sql, params = []) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${dbId}/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }),
    }
  );
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(`D1 query failed: ${JSON.stringify(data.errors || data)}`);
  }
  return data.result?.[0]?.results || [];
}

// 1. apply schema (idempotent)
const schema = await readFile(new URL("../worker/schema.sql", import.meta.url), "utf8");
const statements = schema
  .split(";")
  .map((s) => s.replace(/^\s*--.*$/gm, "").trim()) // strip comment lines, keep the SQL
  .filter((s) => s.length > 0);
for (const sql of statements) {
  await query(sql);
  console.log(`schema: ${sql.slice(0, 70)}...`);
}

// 2. JWT_SECRET
const jwtRow = await query("SELECT value FROM meta WHERE key = ?", ["JWT_SECRET"]);
if (jwtRow.length === 0) {
  const secret = crypto.randomBytes(24).toString("hex");
  await query("INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)", ["JWT_SECRET", secret]);
  console.log("seeded JWT_SECRET (new)");
} else {
  console.log("JWT_SECRET already seeded");
}

// 3. ADMIN_PASSWORD_HASH
const pwRow = await query("SELECT value FROM meta WHERE key = ?", ["ADMIN_PASSWORD_HASH"]);
let adminPassword = null;
if (pwRow.length === 0) {
  adminPassword = crypto.randomBytes(9).toString("base64url"); // ~12 chars
  const hash = bcrypt.hashSync(adminPassword, 10);
  await query("INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)", ["ADMIN_PASSWORD_HASH", hash]);
  console.log("seeded ADMIN_PASSWORD_HASH (new)");
} else {
  console.log("ADMIN_PASSWORD_HASH already seeded");
}

// 4. Stripe keys (upsert only if provided as env vars)
for (const key of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]) {
  const value = process.env[key];
  if (value) {
    await query("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [
      key,
      value,
    ]);
    console.log(`seeded ${key} (from env)`);
  } else {
    console.log(`${key} not provided — checkout stays in "payments not configured" mode`);
  }
}

if (adminPassword) {
  console.log("");
  console.log("==============================================================");
  console.log("NEW ADMIN LOGIN PASSWORD (generated once — save it):");
  console.log("");
  console.log(`  ${adminPassword}`);
  console.log("");
  console.log("Hand this to DeShonda. To reset later: delete the");
  console.log("ADMIN_PASSWORD_HASH row from the D1 meta table, then re-run.");
  console.log("==============================================================");
}
