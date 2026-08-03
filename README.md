# Designs by Deshonda — Production Backend

Real Postgres-backed API replacing the artifact's `window.storage` demo:
JWT admin auth, server-side image resizing, and CSV export for the customer
list. Built to slot into your existing `ignited-ciphernex` Docker Compose
stack (Plane / Mattermost / Keycloak / Backstage) behind the same nginx +
Cloudflare setup.

## What's here

```
deshonda-backend/
  docker-compose.yml     # deshonda-db (Postgres) + deshonda-api (Node)
  .env.example           # copy to .env, fill in real secrets
  db/schema.sql           # auto-run on first Postgres boot
  server/                 # Express API source
  nginx/deshonda.conf     # host nginx server block
  frontend/index.html     # the static site, wired to call the real API
```

## 1. DNS + Cloudflare

Add an A record for `designsbydeshonda.store` (or whatever
subdomain/domain you want) pointing at `95.217.151.38`, proxied through
Cloudflare the same way your other subdomains are.

## 2. Generate secrets

On the server (or locally):

```bash
# DB password + JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Admin password hash — pick the real password Deshonda will type in
node -e "console.log(require('bcryptjs').hashSync('herRealPassword', 10))"
```

Copy `.env.example` to `.env` and fill in `DB_PASSWORD`, `JWT_SECRET`,
`ADMIN_PASSWORD_HASH`, and `ALLOWED_ORIGIN`.

## 3. Ship the code to the server

Same pattern you already use for the other HTML deliverables — SCP the
`deshonda-backend` folder up:

```bash
scp -r deshonda-backend youruser@95.217.151.38:/opt/
```

## 4. Bring up the containers

Either run this as its own stack, or merge the two services
(`deshonda-db`, `deshonda-api`) into your existing compose file so it
shares the network with Plane/Mattermost/etc.

```bash
cd /opt/deshonda-backend
docker compose up -d --build
docker compose logs -f deshonda-api   # confirm "listening on :4000"
```

The API binds to `127.0.0.1:4010` only — it's never exposed to the
internet directly, only through nginx.

## 5. nginx + TLS

```bash
sudo cp nginx/deshonda.conf /etc/nginx/sites-available/designsbydeshonda.conf
sudo ln -s /etc/nginx/sites-available/designsbydeshonda.conf /etc/nginx/sites-enabled/
sudo mkdir -p /var/www/designsbydeshonda
sudo cp frontend/index.html /var/www/designsbydeshonda/
sudo nginx -t && sudo systemctl reload nginx
```

Issue a cert the same way you did for the other subdomains (Certbot, or a
Cloudflare origin cert if you're terminating TLS at Cloudflare).

## 6. Confirm it's alive

```bash
curl https://designsbydeshonda.deshondadesigns.store/api/health
# {"ok":true}
```

Then open the site, sign up through the gallery gate, log into
`/` → "Deshonda's Admin Login" with the real password, and upload a
real product photo to confirm the full round trip.

## Updating the site later

Frontend is a single static file — just SCP a new `index.html` over the
old one and reload nginx. Backend changes: SCP the updated `server/`
folder and run `docker compose up -d --build deshonda-api`.

## What changed vs. the artifact version

- **Auth**: hardcoded client-side passcode → bcrypt hash + JWT, verified
  server-side. The passcode is never shipped in the page source anymore.
- **Storage**: `window.storage` (chat-session-scoped) → Postgres, durable
  and backed up like the rest of your infra.
- **Photos**: base64 blobs in a JSON blob → real files on disk, resized
  and re-encoded server-side with `sharp`, served by nginx with proper
  cache headers.
- **Customer list**: in-memory array → a real table, with a one-click
  CSV export for holiday email/SMS campaigns.

## Adding Deshonda's real product photos now

You don't have to wait on deployment to start loading them in — once
step 4–5 are live, log into the admin dashboard's **Gallery Photos**
tab and upload directly from there; each photo gets resized and served
immediately. If you'd rather bulk-load a batch from the command line
before handing it off to her, you can `curl` them in:

```bash
curl -X POST https://designsbydeshonda.wisdodesignsbydeshonda.deshondadesigns.store/api/gallery \
  -H "Authorization: Bearer $TOKEN" \
  -F "photo=@basket1.jpg" \
  -F "caption=Christmas Gift Basket" \
  -F "category=basket"
```

(Get `$TOKEN` from `POST /api/admin/login` with the real password.)
