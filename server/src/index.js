require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const authRoutes = require('./routes/auth');
const galleryRoutes = require('./routes/gallery');
const signupRoutes = require('./routes/signups');
const ledgerRoutes = require('./routes/ledger');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false })); // allow images to be embedded cross-origin
app.use(cors({ origin: (process.env.ALLOWED_ORIGIN || '*').split(',') }));
app.use(express.json());

// Serve uploaded photos directly (nginx will normally front this in prod, see README)
app.use('/uploads', express.static(process.env.UPLOAD_DIR || '/app/uploads', { maxAge: '30d' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/admin', authRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/signups', signupRoutes);
app.use('/api/ledger', ledgerRoutes);

// Generic error handler so a thrown error never leaks a stack trace to the public
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`DeShonda API listening on :${PORT}`));
