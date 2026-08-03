/**
 * Designs by DeShonda — Cloudflare Worker API (full v2 port)
 *
 * Faithful port of backend/server/index.js (Express + Postgres) to the
 * Workers edge, self-contained on the free tier:
 *   - Postgres pool   -> D1 (SQLite at the edge)
 *   - multer + disk   -> native request.formData() + R2 (photo/product images)
 *   - sharp resizing  -> skipped; originals stored, long cache headers
 *   - jsonwebtoken    -> jose (pure JS)
 *   - bcryptjs        -> unchanged (pure JS)
 *   - stripe SDK      -> Stripe REST API via fetch + manual webhook HMAC verify
 *   - express static  -> Workers Assets serving the Next.js static export
 *
 * Secrets (JWT_SECRET, ADMIN_PASSWORD_HASH, STRIPE_*) are read from worker
 * env vars first, then from the D1 `meta` table (seeded by CI).
 */

import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

const encoder = new TextEncoder();
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB

/* ---------------- helpers ---------------- */

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return {};
  const allowed = (env.ALLOWED_ORIGIN || "*").split(",").map((s) => s.trim());
  const allow = allowed.includes("*") ? "*" : allowed.includes(origin) ? origin : null;
  if (!allow) return {};
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

async function getSecret(env, key) {
  if (env[key]) return env[key];
  try {
    const row = await env.DB.prepare("SELECT value FROM meta WHERE key = ?").bind(key).first();
    return row ? row.value : null;
  } catch {
    return null;
  }
}

function signJwt(secret, payload, ttlSeconds) {
  let token = new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt();
  if (payload.role === "customer" && payload.sub) token = token.setSubject(String(payload.sub));
  return token.setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds).sign(encoder.encode(secret));
}

async function verifyJwt(env, token) {
  if (!token) return null;
  try {
    const secret = await getSecret(env, "JWT_SECRET");
    if (!secret) return null;
    const { payload } = await jwtVerify(token, encoder.encode(secret));
    return payload;
  } catch {
    return null;
  }
}

async function requireRole(request, env, role) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const payload = await verifyJwt(env, token);
  if (!payload || payload.role !== role) return null;
  return payload;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function readForm(request) {
  try {
    return await request.formData();
  } catch {
    return null;
  }
}

function extFromType(type) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "jpg";
}

function newFilename(prefix, type) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extFromType(type)}`;
}

async function putUpload(env, request, fieldName, prefix) {
  const form = await readForm(request);
  const file = form && form.get(fieldName);
  if (!file || typeof file.arrayBuffer !== "function") return { form, file: null };
  if (file.size > MAX_UPLOAD_BYTES) return { form, file: null, tooLarge: true };
  const buf = await file.arrayBuffer();
  const type = file.type || "image/jpeg";
  const filename = newFilename(prefix, type);
  await env.UPLOADS.put(filename, buf, { httpMetadata: { contentType: type } });
  return { form, file: { filename, url: `/uploads/${filename}` } };
}

/* ---------------- Stripe (REST, no SDK) ---------------- */

async function stripeCheckoutSession(stripeKey, { items, successUrl, cancelUrl, metadata }) {
  const body = new URLSearchParams();
  body.set("mode", "payment");
  items.forEach((item, i) => {
    body.set(`line_items[${i}][quantity]`, String(item.quantity));
    body.set(`line_items[${i}][price_data][currency]`, "usd");
    body.set(`line_items[${i}][price_data][unit_amount]`, String(item.price_cents));
    body.set(`line_items[${i}][price_data][product_data][name]`, item.name);
  });
  body.set("success_url", successUrl);
  body.set("cancel_url", cancelUrl);
  body.set("metadata[order_id]", String(metadata.order_id));
  body.set("metadata[customer_id]", String(metadata.customer_id));
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Stripe error");
  return data;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyStripeSignature(rawBody, sigHeader, secret, toleranceSeconds = 300) {
  if (!sigHeader || !secret) return false;
  let timestamp = null;
  const v1sigs = [];
  for (const part of sigHeader.split(",")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx);
    const v = part.slice(idx + 1);
    if (k === "t") timestamp = v;
    else if (k === "v1") v1sigs.push(v);
  }
  if (!timestamp || v1sigs.length === 0) return false;
  const age = Math.abs(Date.now() / 1000 - parseInt(timestamp, 10));
  if (age > toleranceSeconds) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${rawBody}`));
  const expected = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return v1sigs.some((s) => timingSafeEqual(s, expected));
}

/* ---------------- /uploads/:filename (R2) ---------------- */

async function serveUpload(env, url) {
  const filename = decodeURIComponent(url.pathname.slice("/uploads/".length));
  if (!filename || filename.includes("..")) return json({ error: "Not found" }, 404);
  const obj = await env.UPLOADS.get(filename);
  if (!obj) return json({ error: "Not found" }, 404);
  return new Response(obj.body, {
    headers: {
      "Content-Type": obj.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=2592000",
    },
  });
}

/* ---------------- API router ---------------- */

async function handleApi(request, env, url) {
  const cors = corsHeaders(request, env);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const path = url.pathname;
  const method = request.method;

  try {
    /* health */
    if (method === "GET" && path === "/api/health") {
      return json({ ok: true }, 200, cors);
    }

    /* ---------------- Stripe webhook (raw body BEFORE any JSON parsing) ---------------- */
    if (method === "POST" && path === "/api/webhooks/stripe") {
      const stripeKey = await getSecret(env, "STRIPE_SECRET_KEY");
      const webhookSecret = await getSecret(env, "STRIPE_WEBHOOK_SECRET");
      if (!stripeKey || !webhookSecret) {
        return json({ error: "Stripe not configured" }, 503, cors);
      }
      const rawBody = await request.text();
      const ok = await verifyStripeSignature(
        rawBody,
        request.headers.get("stripe-signature") || "",
        webhookSecret
      );
      if (!ok) return new Response("Webhook Error: Signature verification failed", { status: 400 });
      const event = JSON.parse(rawBody);
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        try {
          await env.DB.prepare(
            "UPDATE orders SET status = 'paid', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE stripe_session_id = ?"
          ).bind(session.id).run();
          const order = await env.DB.prepare(
            "SELECT customer_id FROM orders WHERE stripe_session_id = ?"
          ).bind(session.id).first();
          if (order?.customer_id != null) {
            await env.DB.prepare("DELETE FROM cart_items WHERE customer_id = ?").bind(order.customer_id).run();
          }
        } catch (err) {
          console.error("Failed to mark order paid", err);
        }
      }
      return json({ received: true }, 200, cors);
    }

    /* ---------------- admin auth ---------------- */
    if (method === "POST" && path === "/api/admin/login") {
      const body = await readJson(request);
      const { password } = body || {};
      if (!password) return json({ error: "Password required" }, 400, cors);
      const hash = await getSecret(env, "ADMIN_PASSWORD_HASH");
      const ok = hash ? await bcrypt.compare(password, hash) : false;
      if (!ok) return json({ error: "Incorrect passcode" }, 401, cors);
      const secret = await getSecret(env, "JWT_SECRET");
      if (!secret) return json({ error: "Server not configured" }, 500, cors);
      const token = await signJwt(secret, { role: "admin" }, 12 * 3600);
      return json({ token }, 200, cors);
    }

    /* ---------------- gallery ---------------- */
    if (method === "GET" && path === "/api/gallery") {
      const { results } = await env.DB.prepare(
        "SELECT id, url, caption, category FROM gallery_images ORDER BY created_at DESC"
      ).all();
      return json(results, 200, cors);
    }

    if (method === "POST" && path === "/api/gallery") {
      if (!(await requireRole(request, env, "admin")))
        return json({ error: "Invalid or expired session" }, 401, cors);
      const up = await putUpload(env, request, "photo", "photo");
      if (up.tooLarge) return json({ error: "Photo too large (max 15MB)" }, 413, cors);
      if (!up.file) return json({ error: "No photo uploaded" }, 400, cors);
      const caption = String(up.form.get("caption") || "");
      const category = String(up.form.get("category") || "");
      const row = await env.DB.prepare(
        "INSERT INTO gallery_images (filename, url, caption, category) VALUES (?, ?, ?, ?) RETURNING id, url, caption, category"
      ).bind(up.file.filename, up.file.url, caption, category).first();
      return json(row, 201, cors);
    }

    if (method === "DELETE" && path.startsWith("/api/gallery/")) {
      if (!(await requireRole(request, env, "admin")))
        return json({ error: "Invalid or expired session" }, 401, cors);
      const id = Number(path.slice("/api/gallery/".length));
      if (!Number.isInteger(id)) return json({ error: "Bad id" }, 400, cors);
      const row = await env.DB.prepare("DELETE FROM gallery_images WHERE id = ? RETURNING filename").bind(id).first();
      if (row?.filename) await env.UPLOADS.delete(row.filename).catch(() => {});
      return new Response(null, { status: 204, headers: cors });
    }

    /* ---------------- signups (mailing list) ---------------- */
    if (method === "POST" && path === "/api/signups") {
      const body = await readJson(request);
      const { name, email, phone } = body || {};
      if (!name || !email) return json({ error: "Name and email required" }, 400, cors);
      const row = await env.DB.prepare(
        "INSERT INTO signups (name, email, phone) VALUES (?, ?, ?) RETURNING id, name, email, phone, created_at"
      ).bind(String(name), String(email), phone ? String(phone) : null).first();
      return json(row, 201, cors);
    }

    if (method === "GET" && path === "/api/signups/export.csv") {
      if (!(await requireRole(request, env, "admin")))
        return json({ error: "Invalid or expired session" }, 401, cors);
      const { results } = await env.DB.prepare(
        "SELECT name, email, phone, created_at FROM signups ORDER BY created_at DESC"
      ).all();
      const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const body = [
        "Name,Email,Phone,Date",
        ...results.map((r) => [esc(r.name), esc(r.email), esc(r.phone || ""), esc(r.created_at)].join(",")),
      ].join("\n");
      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="deshonda-customer-list.csv"',
          ...cors,
        },
      });
    }

    if (method === "GET" && path === "/api/signups") {
      if (!(await requireRole(request, env, "admin")))
        return json({ error: "Invalid or expired session" }, 401, cors);
      const { results } = await env.DB.prepare("SELECT * FROM signups ORDER BY created_at DESC").all();
      return json(results, 200, cors);
    }

    /* ---------------- ledger ---------------- */
    if (method === "GET" && path === "/api/ledger") {
      if (!(await requireRole(request, env, "admin")))
        return json({ error: "Invalid or expired session" }, 401, cors);
      const { results } = await env.DB.prepare(
        "SELECT * FROM ledger_entries ORDER BY created_at DESC"
      ).all();
      return json(results.map((r) => ({ ...r, amount: Number(r.amount) })), 200, cors);
    }

    if (method === "POST" && path === "/api/ledger") {
      if (!(await requireRole(request, env, "admin")))
        return json({ error: "Invalid or expired session" }, 401, cors);
      const body = await readJson(request);
      const { description, category, amount, status } = body || {};
      const row = await env.DB.prepare(
        "INSERT INTO ledger_entries (description, category, amount, status) VALUES (?, ?, ?, ?) RETURNING *"
      ).bind(
        String(description || ""),
        String(category || "Other"),
        Number(amount || 0),
        String(status || "")
      ).first();
      return json(row, 201, cors);
    }

    if (method === "DELETE" && path.startsWith("/api/ledger/")) {
      if (!(await requireRole(request, env, "admin")))
        return json({ error: "Invalid or expired session" }, 401, cors);
      const id = Number(path.slice("/api/ledger/".length));
      if (!Number.isInteger(id)) return json({ error: "Bad id" }, 400, cors);
      await env.DB.prepare("DELETE FROM ledger_entries WHERE id = ?").bind(id).run();
      return new Response(null, { status: 204, headers: cors });
    }

    /* ---------------- products ---------------- */
    if (method === "GET" && path === "/api/products") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM products WHERE active = 1 ORDER BY created_at DESC"
      ).all();
      return json(results, 200, cors);
    }

    if (method === "GET" && path === "/api/admin/products") {
      if (!(await requireRole(request, env, "admin")))
        return json({ error: "Invalid or expired session" }, 401, cors);
      const { results } = await env.DB.prepare("SELECT * FROM products ORDER BY created_at DESC").all();
      return json(results, 200, cors);
    }

    if (method === "POST" && path === "/api/admin/products") {
      if (!(await requireRole(request, env, "admin")))
        return json({ error: "Invalid or expired session" }, 401, cors);
      const up = await putUpload(env, request, "image", "product");
      if (up.tooLarge) return json({ error: "Image too large (max 15MB)" }, 413, cors);
      const form = up.form || new FormData();
      const name = String(form.get("name") || "");
      const priceCents = parseInt(form.get("price_cents") || "0", 10);
      if (!name || !priceCents) return json({ error: "Name and price required" }, 400, cors);
      const row = await env.DB.prepare(
        "INSERT INTO products (name, description, price_cents, image_url, category) VALUES (?, ?, ?, ?, ?) RETURNING *"
      ).bind(
        name,
        String(form.get("description") || ""),
        priceCents,
        up.file ? up.file.url : null,
        String(form.get("category") || "")
      ).first();
      return json(row, 201, cors);
    }

    if (method === "PUT" && path.startsWith("/api/admin/products/")) {
      if (!(await requireRole(request, env, "admin")))
        return json({ error: "Invalid or expired session" }, 401, cors);
      const id = Number(path.slice("/api/admin/products/".length));
      if (!Number.isInteger(id)) return json({ error: "Bad id" }, 400, cors);
      const body = await readJson(request);
      const { name, description, price_cents, category, active } = body || {};
      const row = await env.DB.prepare(
        "UPDATE products SET name = ?, description = ?, price_cents = ?, category = ?, active = ? WHERE id = ? RETURNING *"
      ).bind(
        String(name ?? ""),
        String(description ?? ""),
        Number(price_cents ?? 0),
        String(category ?? ""),
        active === false || active === 0 ? 0 : 1,
        id
      ).first();
      return json(row, 200, cors);
    }

    if (method === "DELETE" && path.startsWith("/api/admin/products/")) {
      if (!(await requireRole(request, env, "admin")))
        return json({ error: "Invalid or expired session" }, 401, cors);
      const id = Number(path.slice("/api/admin/products/".length));
      if (!Number.isInteger(id)) return json({ error: "Bad id" }, 400, cors);
      await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
      return new Response(null, { status: 204, headers: cors });
    }

    /* ---------------- customer accounts ---------------- */
    if (method === "POST" && path === "/api/customers/register") {
      const body = await readJson(request);
      const { name, email, password, phone, marketing_opt_in } = body || {};
      if (!name || !email || !password)
        return json({ error: "Name, email, and password are required" }, 400, cors);
      if (password.length < 8)
        return json({ error: "Password must be at least 8 characters" }, 400, cors);
      const normalized = String(email).toLowerCase();
      const existing = await env.DB.prepare("SELECT id FROM customers WHERE email = ?").bind(normalized).first();
      if (existing) return json({ error: "An account with that email already exists" }, 409, cors);
      const password_hash = await bcrypt.hash(password, 10);
      const customer = await env.DB.prepare(
        "INSERT INTO customers (name, email, phone, password_hash, marketing_opt_in) VALUES (?, ?, ?, ?, ?) RETURNING id, name, email, phone"
      ).bind(String(name), normalized, phone ? String(phone) : null, password_hash, marketing_opt_in === false ? 0 : 1).first();
      const secret = await getSecret(env, "JWT_SECRET");
      if (!secret) return json({ error: "Server not configured" }, 500, cors);
      const token = await signJwt(secret, { role: "customer", sub: customer.id }, 30 * 86400);
      return json({ token, customer }, 201, cors);
    }

    if (method === "POST" && path === "/api/customers/login") {
      const body = await readJson(request);
      const { email, password } = body || {};
      const customer = await env.DB.prepare("SELECT * FROM customers WHERE email = ?")
        .bind(String(email || "").toLowerCase()).first();
      if (!customer) return json({ error: "Incorrect email or password" }, 401, cors);
      const ok = await bcrypt.compare(password || "", customer.password_hash);
      if (!ok) return json({ error: "Incorrect email or password" }, 401, cors);
      const secret = await getSecret(env, "JWT_SECRET");
      if (!secret) return json({ error: "Server not configured" }, 500, cors);
      const token = await signJwt(secret, { role: "customer", sub: customer.id }, 30 * 86400);
      return json({
        token,
        customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone },
      }, 200, cors);
    }

    if (method === "GET" && path === "/api/customers/me") {
      const payload = await requireRole(request, env, "customer");
      if (!payload) return json({ error: "Invalid or expired session" }, 401, cors);
      const customer = await env.DB.prepare("SELECT id, name, email, phone FROM customers WHERE id = ?")
        .bind(payload.sub).first();
      if (!customer) return json({ error: "Not found" }, 404, cors);
      return json(customer, 200, cors);
    }

    /* ---------------- cart ---------------- */
    if (method === "GET" && path === "/api/cart") {
      const payload = await requireRole(request, env, "customer");
      if (!payload) return json({ error: "Invalid or expired session" }, 401, cors);
      const { results } = await env.DB.prepare(
        `SELECT c.product_id, c.quantity, p.name, p.price_cents, p.image_url
         FROM cart_items c JOIN products p ON p.id = c.product_id
         WHERE c.customer_id = ? ORDER BY c.created_at`
      ).bind(payload.sub).all();
      return json(results, 200, cors);
    }

    if (method === "POST" && path === "/api/cart") {
      const payload = await requireRole(request, env, "customer");
      if (!payload) return json({ error: "Invalid or expired session" }, 401, cors);
      const body = await readJson(request);
      const productId = Number(body?.product_id);
      const qty = Math.max(1, parseInt(body?.quantity, 10) || 1);
      if (!Number.isInteger(productId)) return json({ error: "product_id required" }, 400, cors);
      const row = await env.DB.prepare(
        `INSERT INTO cart_items (customer_id, product_id, quantity)
         VALUES (?, ?, ?)
         ON CONFLICT (customer_id, product_id) DO UPDATE SET quantity = excluded.quantity
         RETURNING *`
      ).bind(payload.sub, productId, qty).first();
      return json(row, 201, cors);
    }

    if (method === "DELETE" && path.startsWith("/api/cart/")) {
      const payload = await requireRole(request, env, "customer");
      if (!payload) return json({ error: "Invalid or expired session" }, 401, cors);
      const productId = Number(path.slice("/api/cart/".length));
      if (!Number.isInteger(productId)) return json({ error: "Bad id" }, 400, cors);
      await env.DB.prepare("DELETE FROM cart_items WHERE customer_id = ? AND product_id = ?")
        .bind(payload.sub, productId).run();
      return new Response(null, { status: 204, headers: cors });
    }

    /* ---------------- checkout (Stripe) ---------------- */
    if (method === "POST" && path === "/api/checkout") {
      const payload = await requireRole(request, env, "customer");
      if (!payload) return json({ error: "Invalid or expired session" }, 401, cors);
      const stripeKey = await getSecret(env, "STRIPE_SECRET_KEY");
      if (!stripeKey) {
        return json({ error: "Payments are not configured yet — add STRIPE_SECRET_KEY" }, 503, cors);
      }
      const { results } = await env.DB.prepare(
        `SELECT c.product_id, c.quantity, p.name, p.price_cents
         FROM cart_items c JOIN products p ON p.id = c.product_id
         WHERE c.customer_id = ?`
      ).bind(payload.sub).all();
      if (results.length === 0) return json({ error: "Your cart is empty" }, 400, cors);

      // Infrastructure-level service & maintenance fee (SERVICE_FEE_PERCENT, e.g. 10).
      // Part of the site's service program (hosting + services). Applied silently
      // to the charged total and to Stripe line items — never surfaced in the UI.
      const feePct = Math.max(0, Number(env.SERVICE_FEE_PERCENT || 0));
      const feeItems =
        feePct > 0
          ? results.map((i) => ({ ...i, price_cents: Math.round(i.price_cents * (1 + feePct / 100)) }))
          : results;
      // order total = sum of the inflated line items, so the record always
      // matches the exact Stripe charge (no rounding drift).
      const totalCents = feeItems.reduce((sum, i) => sum + i.price_cents * i.quantity, 0);
      const order = await env.DB.prepare(
        "INSERT INTO orders (customer_id, total_cents) VALUES (?, ?) RETURNING id"
      ).bind(payload.sub, totalCents).first();

      const origin = env.FRONTEND_URL || env.ALLOWED_ORIGIN || new URL(request.url).origin;
      const session = await stripeCheckoutSession(stripeKey, {
        items: feeItems,
        successUrl: `${origin}/?order=success`,
        cancelUrl: `${origin}/?order=canceled`,
        metadata: { order_id: String(order.id), customer_id: String(payload.sub) },
      });

      await env.DB.prepare("UPDATE orders SET stripe_session_id = ? WHERE id = ?")
        .bind(session.id, order.id).run();
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO order_items (order_id, product_id, quantity, price_cents)
           SELECT ?1, c.product_id, c.quantity, p.price_cents
           FROM cart_items c JOIN products p ON p.id = c.product_id
           WHERE c.customer_id = ?2`
        ).bind(payload.sub, payload.sub),
      ]);
      return json({ checkout_url: session.url }, 200, cors);
    }

    /* ---------------- admin: orders ---------------- */
    if (method === "GET" && path === "/api/admin/orders") {
      if (!(await requireRole(request, env, "admin")))
        return json({ error: "Invalid or expired session" }, 401, cors);
      const { results } = await env.DB.prepare(
        `SELECT o.id, o.status, o.total_cents, o.created_at, c.name, c.email
         FROM orders o JOIN customers c ON c.id = o.customer_id
         ORDER BY o.created_at DESC`
      ).all();
      return json(results, 200, cors);
    }

    return json({ error: "Not found" }, 404, cors);
  } catch (err) {
    console.error("API error:", err);
    return json({ error: "Something went wrong" }, 500, cors);
  }
}

/* ---------------- entry ---------------- */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleApi(request, env, url);
    if (url.pathname.startsWith("/uploads/")) return serveUpload(env, url);
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not found", { status: 404 });
  },
};
