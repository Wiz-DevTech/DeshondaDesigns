const express = require('express');
const pool = require('../db');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

// Public: capture a signup (this is what unlocks the gallery)
router.post('/', async (req, res) => {
  const { name, email, phone = '' } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });

  const { rows } = await pool.query(
    'INSERT INTO signups (name, email, phone) VALUES ($1,$2,$3) RETURNING id, name, email, phone, created_at',
    [name, email, phone]
  );
  res.status(201).json(rows[0]);
});

// Admin: full customer list
router.get('/', requireAdmin, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM signups ORDER BY created_at DESC');
  res.json(rows);
});

// Admin: CSV export for mailing lists / holiday campaigns
router.get('/export.csv', requireAdmin, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM signups ORDER BY created_at DESC');
  const header = 'name,email,phone,signed_up_at\n';
  const body = rows
    .map(r => [r.name, r.email, r.phone, r.created_at.toISOString()]
      .map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="deshonda-customer-list.csv"');
  res.send(header + body);
});

module.exports = router;
