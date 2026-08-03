# Designs by DeShonda — Production Backend (v2: accounts + cart + checkout)

Everything from the original backend (Postgres, JWT admin auth, resized
photo uploads, CSV customer export) **plus**:

- Customer accounts (name, email, phone, password) — required to add
  items to a cart or buy anything
- A product catalog DeShonda manages from the **Products** admin tab
- A real shopping cart, checkout via **Stripe Checkout**, and an
  **Orders** admin tab
- Every account created is stored in Postgres, so it doubles as the
  list you use for future discounts/marketing (separate from the
  gallery-gate mailing list, which stays as-is)

## What's here

```
deshonda-backend/
  docker-compose.yml     # deshonda-db (Postgres) + deshonda-api (Node)
  .env.example           # copy to .env, fill in real secrets
  db/schema.sql           # customers, products, cart_items, orders, order_items
                           # + existing signups, ledger_entries, gallery_images
  server/                 # Express API source
  nginx/deshonda.conf     # host nginx server block (now also proxies /api/webhooks/)
  frontend/index.html     # static site: shop grid, cart drawer, account modal
```

## 1. DNS + Cloudflare

Same as before — A record for your domain pointing at your server,
proxied through Cloudflare.

## 2. Generate secrets

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # DB_PASSWORD
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # JWT_SECRET (different value)
node -e "console.log(require('bcryptjs').hashSync('herRealPassword', 10))" # ADMIN_PASSWORD_HASH
```

Copy `.env.example` to `.env` and fill in `DB_PASSWORD`, `JWT_SECRET`,
`ADMIN_PASSWORD_HASH`, `ALLOWED_ORIGIN`, `FRONTEND_URL`.

## 3. Set up Stripe (new)

Real money changes hands here, so this step is deliberately manual —
nobody should paste live payment keys into a chat.

1. Create a Stripe account at stripe.com if DeShonda doesn't have one.
2. In the Stripe Dashboard, grab the **secret key** (starts `sk_test_`
   while testing, `sk_live_` when ready for real orders) → put it in
   `STRIPE_SECRET_KEY`.
3. Add a webhook endpoint pointing at
   `https://yourdomain.com/api/webhooks/stripe`, listening for
   `checkout.session.completed`. Stripe gives you a signing secret
   (`whsec_...`) → put it in `STRIPE_WEBHOOK_SECRET`.
4. Test with a full purchase using Stripe's test card `4242 4242 4242
   4242` (any future date, any CVC) before switching to live keys.

Until these are filled in, the site works fully except the Checkout
button, which returns a friendly "payments not configured yet" message
instead of crashing.

## 4. Ship the code to the server

```bash
scp -r deshonda-backend youruser@your-server-ip:/opt/
```

## 5. Bring up the containers

```bash
cd /opt/deshonda-backend
docker compose up -d --build
docker compose logs -f deshonda-api   # confirm "listening on :4000"
```

The API binds to `127.0.0.1:4010` only — never exposed directly to the
internet, only through nginx.

## 6. nginx + TLS

```bash
sudo cp nginx/deshonda.conf /etc/nginx/sites-available/designsbydeshonda.conf
sudo ln -s /etc/nginx/sites-available/designsbydeshonda.conf /etc/nginx/sites-enabled/
sudo mkdir -p /var/www/designsbydeshonda
sudo cp frontend/index.html /var/www/designsbydeshonda/
sudo nginx -t && sudo systemctl reload nginx
```

Issue a cert the same way as your other subdomains.

## 7. Confirm it's alive

```bash
curl https://yourdomain.com/api/health
# {"ok":true}
```

Then:
1. Open the site, create a real customer account through **Account →
   Create Account**.
2. Log into `/` → "DeShonda's Admin Login", go to **Products**, and
   add a real product with a price and photo.
3. Back on the public site, add it to your cart and click
   **Checkout** — with Stripe test keys in place, use `4242 4242 4242
   4242` to confirm the full round trip, then check the **Orders**
   admin tab shows it as `paid`.

## Updating the site later

Frontend: SCP a new `frontend/index.html` over the old one, reload
nginx. Backend: SCP the updated `server/` folder, run
`docker compose up -d --build deshonda-api`.

## What changed vs. the artifact version

- **Auth**: hardcoded client-side passcode → bcrypt hash + JWT.
- **Storage**: `window.storage` → Postgres.
- **Photos**: base64 blobs → real files on disk, resized with `sharp`.
- **Customer list (mailing list)**: in-memory array → real table, CSV export.
- **NEW — accounts & commerce**: customers now register with name,
  email, phone, and a password (hashed with bcrypt, never stored in
  plain text); logged-in customers get a persistent server-side cart;
  checkout hands off to Stripe Checkout so card numbers never touch
  this server directly; a webhook marks the order paid and clears the
  cart once Stripe confirms payment.

## A note on the data you're now collecting

You're storing real customer PII (name, email, phone, hashed
password) and order history for marketing/discount purposes. Two
things worth doing before launch, not required by the code but good
practice: add a plain-language line to the signup form or footer about
how the data will be used (e.g. "we'll use this to offer you discounts
and updates — never sold to third parties"), and make sure whatever
email/SMS tool you use later for the discount campaigns is one your
recipients actually opted into (the `marketing_opt_in` field is
already captured per customer for this).
