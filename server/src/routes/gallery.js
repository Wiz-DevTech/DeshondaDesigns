const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const pool = require('../db');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// Public: list all gallery photos
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, filename, caption, category, created_at FROM gallery ORDER BY created_at DESC'
  );
  res.json(rows.map(r => ({ ...r, url: `/uploads/${r.filename}` })));
});

// Admin: upload a photo (resized + re-encoded server-side)
router.post('/', requireAdmin, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });
  const { caption = '', category = 'basket' } = req.body;

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const outPath = path.join(UPLOAD_DIR, filename);

  await sharp(req.file.buffer)
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toFile(outPath);

  const { rows } = await pool.query(
    'INSERT INTO gallery (filename, caption, category) VALUES ($1,$2,$3) RETURNING id, filename, caption, category, created_at',
    [filename, caption, category]
  );
  res.status(201).json({ ...rows[0], url: `/uploads/${filename}` });
});

// Admin: delete a photo
router.delete('/:id', requireAdmin, async (req, res) => {
  const { rows } = await pool.query('SELECT filename FROM gallery WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });

  const filePath = path.join(UPLOAD_DIR, rows[0].filename);
  fs.unlink(filePath, () => {}); // ignore missing-file errors

  await pool.query('DELETE FROM gallery WHERE id=$1', [req.params.id]);
  res.status(204).end();
});

module.exports = router;
