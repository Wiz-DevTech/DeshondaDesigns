const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();

// ADMIN_PASSWORD_HASH is a bcrypt hash — generate with:
//   node -e "console.log(require('bcryptjs').hashSync('yourPassword', 10))"
router.post('/login', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });

  const ok = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH || '');
  if (!ok) return res.status(401).json({ error: 'Incorrect passcode' });

  const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.json({ token });
});

module.exports = router;
