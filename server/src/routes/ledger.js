const express = require('express');
const pool = require('../db');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();
router.use(requireAdmin); // every ledger route requires admin auth

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM ledger ORDER BY created_at DESC');
  res.json(rows);
});

router.get('/summary', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT
      COALESCE(SUM(amount),0) AS total,
      COALESCE(SUM(amount) FILTER (WHERE status='accrued'),0) AS outstanding,
      COALESCE(SUM(amount) FILTER (WHERE status='received'),0) AS received
    FROM ledger
  `);
  res.json(rows[0]);
});

router.post('/', async (req, res) => {
  const { description, category = 'Other', amount, status } = req.body;
  if (!description || amount === undefined || !['accrued', 'received'].includes(status)) {
    return res.status(400).json({ error: 'description, amount, and a valid status are required' });
  }
  const { rows } = await pool.query(
    'INSERT INTO ledger (description, category, amount, status) VALUES ($1,$2,$3,$4) RETURNING *',
    [description, category, amount, status]
  );
  res.status(201).json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM ledger WHERE id=$1', [req.params.id]);
  res.status(204).end();
});

module.exports = router;
