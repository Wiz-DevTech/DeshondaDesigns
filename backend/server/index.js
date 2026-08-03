require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

if (!JWT_SECRET || !ADMIN_PASSWORD_HASH) {
  console.error('FATAL: JWT_SECRET and ADMIN_PASSWORD_HASH must be set in .env');
  process.exit(1);
}

// Stripe is optional at boot — the site works without it, checkout just
// returns a clear error until STRIPE_SECRET_KEY is configured.
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

app.use(cors({ origin: ALLOWED_ORIGIN }));

// Stripe webhook needs the RAW body for signature verification, so it must
// be registered BEFORE express.json().
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    try {
      await pool.query(
        `UPDATE orders SET status = 'paid', updated_at = now() WHERE stripe_session_id = $1`,
        [session.id]
      );
      // clear the cart for that customer once payment is confirmed
      const orderRes = await pool.query(
        `SELECT customer_id FROM orders WHERE stripe_session_id = $1`,
        [session.id]
      );
      if (orderRes.rows[0]) {
        await pool.query(`DELETE FROM cart_items WHERE customer_id = $1`, [orderRes.rows[0].customer_id]);
      }
    } catch (err) {
      console.error('Failed to mark order paid', err);
    }
  }

  res.json({ received: true });
});

app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d' }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ---------- auth middleware ----------
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') throw new Error('not admin');
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireCustomer(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'customer') throw new Error('not customer');
    req.customerId = payload.sub;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ---------- health ----------
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---------- admin auth ----------
app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });
  const ok = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  if (!ok) return res.status(401).json({ error: 'Incorrect passcode' });
  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
});

// ---------- gallery ----------
app.get('/api/gallery', async (req, res) => {
  const r = await pool.query('SELECT id, url, caption, category FROM gallery_images ORDER BY created_at DESC');
  res.json(r.rows);
});

app.post('/api/gallery', requireAdmin, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const outPath = path.join(UPLOAD_DIR, filename);
  await sharp(req.file.buffer)
    .resize({ width: 1200, withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toFile(outPath);
  const url = `/uploads/${filename}`;
  const r = await pool.query(
    `INSERT INTO gallery_images (filename, url, caption, category) VALUES ($1,$2,$3,$4) RETURNING id, url, caption, category`,
    [filename, url, req.body.caption || '', req.body.category || '']
  );
  res.status(201).json(r.rows[0]);
});

app.delete('/api/gallery/:id', requireAdmin, async (req, res) => {
  const r = await pool.query('DELETE FROM gallery_images WHERE id=$1 RETURNING filename', [req.params.id]);
  if (r.rows[0]) {
    const p = path.join(UPLOAD_DIR, r.rows[0].filename);
    fs.unlink(p, () => {});
  }
  res.status(204).end();
});

// ---------- signups (mailing list gate) ----------
app.post('/api/signups', async (req, res) => {
  const { name, email, phone } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email required' });
  const r = await pool.query(
    `INSERT INTO signups (name, email, phone) VALUES ($1,$2,$3) RETURNING id, name, email, phone, created_at`,
    [name, email, phone || null]
  );
  res.status(201).json(r.rows[0]);
});

app.get('/api/signups', requireAdmin, async (req, res) => {
  const r = await pool.query('SELECT * FROM signups ORDER BY created_at DESC');
  res.json(r.rows);
});

app.get('/api/signups/export.csv', requireAdmin, async (req, res) => {
  const r = await pool.query('SELECT name, email, phone, created_at FROM signups ORDER BY created_at DESC');
  const header = 'Name,Email,Phone,Date\n';
  const rows = r.rows
    .map(s => [s.name, s.email, s.phone || '', new Date(s.created_at).toISOString()]
      .map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="deshonda-customer-list.csv"');
  res.send(header + rows);
});

// ---------- accounting ledger ----------
app.get('/api/ledger', requireAdmin, async (req, res) => {
  const r = await pool.query('SELECT * FROM ledger_entries ORDER BY created_at DESC');
  res.json(r.rows);
});

app.post('/api/ledger', requireAdmin, async (req, res) => {
  const { description, category, amount, status } = req.body;
  const r = await pool.query(
    `INSERT INTO ledger_entries (description, category, amount, status) VALUES ($1,$2,$3,$4) RETURNING *`,
    [description, category, amount, status]
  );
  res.status(201).json(r.rows[0]);
});

app.delete('/api/ledger/:id', requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM ledger_entries WHERE id=$1', [req.params.id]);
  res.status(204).end();
});

// ---------- products (catalog) ----------
app.get('/api/products', async (req, res) => {
  const r = await pool.query('SELECT * FROM products WHERE active = true ORDER BY created_at DESC');
  res.json(r.rows);
});

app.get('/api/admin/products', requireAdmin, async (req, res) => {
  const r = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
  res.json(r.rows);
});

app.post('/api/admin/products', requireAdmin, upload.single('image'), async (req, res) => {
  const { name, description, price_cents, category } = req.body;
  if (!name || !price_cents) return res.status(400).json({ error: 'Name and price required' });
  let imageUrl = null;
  if (req.file) {
    const filename = `product-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    await sharp(req.file.buffer).resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 82 })
      .toFile(path.join(UPLOAD_DIR, filename));
    imageUrl = `/uploads/${filename}`;
  }
  const r = await pool.query(
    `INSERT INTO products (name, description, price_cents, image_url, category) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, description || '', parseInt(price_cents, 10), imageUrl, category || '']
  );
  res.status(201).json(r.rows[0]);
});

app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const { name, description, price_cents, category, active } = req.body;
  const r = await pool.query(
    `UPDATE products SET name=$1, description=$2, price_cents=$3, category=$4, active=$5 WHERE id=$6 RETURNING *`,
    [name, description, price_cents, category, active, req.params.id]
  );
  res.json(r.rows[0]);
});

app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM products WHERE id=$1', [req.params.id]);
  res.status(204).end();
});

// ---------- customer accounts ----------
app.post('/api/customers/register', async (req, res) => {
  const { name, email, password, phone, marketing_opt_in } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  const existing = await pool.query('SELECT id FROM customers WHERE email=$1', [email.toLowerCase()]);
  if (existing.rows[0]) return res.status(409).json({ error: 'An account with that email already exists' });

  const password_hash = await bcrypt.hash(password, 10);
  const r = await pool.query(
    `INSERT INTO customers (name, email, phone, password_hash, marketing_opt_in)
     VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, phone`,
    [name, email.toLowerCase(), phone || null, password_hash, marketing_opt_in !== false]
  );
  const customer = r.rows[0];
  const token = jwt.sign({ sub: customer.id, role: 'customer' }, JWT_SECRET, { expiresIn: '30d' });
  res.status(201).json({ token, customer });
});

app.post('/api/customers/login', async (req, res) => {
  const { email, password } = req.body;
  const r = await pool.query('SELECT * FROM customers WHERE email=$1', [(email || '').toLowerCase()]);
  const customer = r.rows[0];
  if (!customer) return res.status(401).json({ error: 'Incorrect email or password' });
  const ok = await bcrypt.compare(password, customer.password_hash);
  if (!ok) return res.status(401).json({ error: 'Incorrect email or password' });
  const token = jwt.sign({ sub: customer.id, role: 'customer' }, JWT_SECRET, { expiresIn: '30d' });
  res.json({
    token,
    customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone },
  });
});

app.get('/api/customers/me', requireCustomer, async (req, res) => {
  const r = await pool.query('SELECT id, name, email, phone FROM customers WHERE id=$1', [req.customerId]);
  res.json(r.rows[0]);
});

// ---------- cart ----------
app.get('/api/cart', requireCustomer, async (req, res) => {
  const r = await pool.query(
    `SELECT c.product_id, c.quantity, p.name, p.price_cents, p.image_url
     FROM cart_items c JOIN products p ON p.id = c.product_id
     WHERE c.customer_id = $1 ORDER BY c.created_at`,
    [req.customerId]
  );
  res.json(r.rows);
});

app.post('/api/cart', requireCustomer, async (req, res) => {
  const { product_id, quantity } = req.body;
  const qty = Math.max(1, parseInt(quantity, 10) || 1);
  const r = await pool.query(
    `INSERT INTO cart_items (customer_id, product_id, quantity)
     VALUES ($1,$2,$3)
     ON CONFLICT (customer_id, product_id) DO UPDATE SET quantity = $3
     RETURNING *`,
    [req.customerId, product_id, qty]
  );
  res.status(201).json(r.rows[0]);
});

app.delete('/api/cart/:productId', requireCustomer, async (req, res) => {
  await pool.query('DELETE FROM cart_items WHERE customer_id=$1 AND product_id=$2', [
    req.customerId,
    req.params.productId,
  ]);
  res.status(204).end();
});

// ---------- checkout (Stripe) ----------
app.post('/api/checkout', requireCustomer, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Payments are not configured yet — add STRIPE_SECRET_KEY to .env' });
  }
  const cartRes = await pool.query(
    `SELECT c.product_id, c.quantity, p.name, p.price_cents, p.image_url
     FROM cart_items c JOIN products p ON p.id = c.product_id
     WHERE c.customer_id = $1`,
    [req.customerId]
  );
  if (cartRes.rows.length === 0) return res.status(400).json({ error: 'Your cart is empty' });

  const totalCents = cartRes.rows.reduce((sum, i) => sum + i.price_cents * i.quantity, 0);

  const orderRes = await pool.query(
    `INSERT INTO orders (customer_id, total_cents) VALUES ($1,$2) RETURNING id`,
    [req.customerId, totalCents]
  );
  const orderId = orderRes.rows[0].id;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: cartRes.rows.map(i => ({
      quantity: i.quantity,
      price_data: {
        currency: 'usd',
        unit_amount: i.price_cents,
        product_data: { name: i.name },
      },
    })),
    success_url: `${process.env.FRONTEND_URL}/?order=success`,
    cancel_url: `${process.env.FRONTEND_URL}/?order=canceled`,
    metadata: { order_id: String(orderId), customer_id: String(req.customerId) },
  });

  await pool.query('UPDATE orders SET stripe_session_id=$1 WHERE id=$2', [session.id, orderId]);
  await pool.query(
    `INSERT INTO order_items (order_id, product_id, quantity, price_cents)
     SELECT $1, product_id, quantity, price_cents FROM cart_items c JOIN products p ON p.id=c.product_id WHERE c.customer_id=$2`,
    [orderId, req.customerId]
  );

  res.json({ checkout_url: session.url });
});

// ---------- admin: view orders ----------
app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  const r = await pool.query(
    `SELECT o.id, o.status, o.total_cents, o.created_at, c.name, c.email
     FROM orders o JOIN customers c ON c.id = o.customer_id
     ORDER BY o.created_at DESC`
  );
  res.json(r.rows);
});

app.listen(PORT, () => console.log(`Deshonda API listening on :${PORT}`));
