#!/usr/bin/env node
/**
 * CI bootstrap for the Deshonda worker.
 * Uses the Cloudflare API token (from GitHub secrets) to:
 *   1. Resolve the account id
 *   2. Ensure the D1 database "deshonda-db" exists
 *   3. Ensure the R2 bucket "deshonda-uploads" exists
 *   4. Generate wrangler.jsonc from wrangler.template.jsonc with the real D1 id
 * Exports CLOUDFLARE_ACCOUNT_ID into $GITHUB_ENV when running in Actions.
 */
import { readFile, writeFile, appendFile } from "node:fs/promises";

const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
if (!TOKEN) {
  console.error("CLOUDFLARE_API_TOKEN is required");
  process.exit(1);
}

const CF = "https://api.cloudflare.com/client/v4";

async function cf(path, opts = {}) {
  const res = await fetch(CF + path, {
    ...opts,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const msg = data.errors?.[0]?.message || JSON.stringify(data.errors) || res.statusText;
    throw new Error(`CF API ${opts.method || "GET"} ${path} failed: ${msg}`);
  }
  return data;
}

// 1. account
const accts = await cf("/accounts?per_page=1");
const accountId = accts.result?.[0]?.id;
if (!accountId) {
  console.error("No Cloudflare account found for this token");
  process.exit(1);
}
console.log(`account_id=${accountId}`);
// persist for later steps in this run: GitHub Actions (GITHUB_ENV) or any
// local/other CI shell (.cf-env) — ci-seed.mjs reads both.
if (process.env.GITHUB_ENV) {
  await appendFile(process.env.GITHUB_ENV, `CLOUDFLARE_ACCOUNT_ID=${accountId}\n`);
  console.log("appended CLOUDFLARE_ACCOUNT_ID to GITHUB_ENV");
}
await writeFile(new URL("../.cf-env", import.meta.url), `CLOUDFLARE_ACCOUNT_ID=${accountId}\n`);
console.log("wrote .cf-env");

// 2. workers.dev subdomain (informational)
try {
  const sub = await cf(`/accounts/${accountId}/workers/subdomain`);
  console.log(`workers.dev subdomain: ${sub.result?.subdomain}`);
} catch {
  console.warn("WARNING: could not read workers.dev subdomain (token needs Account:Workers Scripts:Edit)");
}

// 3. D1 database
const D1_NAME = "deshonda-db";
let dbId = null;
try {
  const list = await cf(`/accounts/${accountId}/d1/database?name=${D1_NAME}`);
  dbId = list.result?.[0]?.uuid || null;
} catch (e) {
  console.warn("D1 list failed (token may lack d1:read):", e.message);
}
if (!dbId) {
  const created = await cf(`/accounts/${accountId}/d1/database`, {
    method: "POST",
    body: JSON.stringify({ name: D1_NAME, primary_location_hint: "weur" }),
  });
  dbId = created.result?.uuid;
  console.log(`created D1 database ${D1_NAME} (${dbId})`);
} else {
  console.log(`D1 database ${D1_NAME} already exists (${dbId})`);
}
if (!dbId) {
  console.error("Could not obtain D1 database id");
  process.exit(1);
}

// 4. R2 bucket
const R2_NAME = "deshonda-uploads";
try {
  await cf(`/accounts/${accountId}/r2/buckets/${R2_NAME}`);
  console.log(`R2 bucket ${R2_NAME} already exists`);
} catch {
  await cf(`/accounts/${accountId}/r2/buckets`, {
    method: "POST",
    body: JSON.stringify({ name: R2_NAME }),
  });
  console.log(`created R2 bucket ${R2_NAME}`);
}

// 5. generate wrangler.jsonc
const template = await readFile(new URL("../wrangler.template.jsonc", import.meta.url), "utf8");
const config = template.replaceAll("__D1_DATABASE_ID__", dbId);
await writeFile(new URL("../wrangler.jsonc", import.meta.url), config);
console.log("wrote wrangler.jsonc with database_id", dbId);
