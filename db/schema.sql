-- Designs by Deshonda — production schema

CREATE TABLE IF NOT EXISTS gallery (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL,
  caption TEXT DEFAULT '',
  category TEXT DEFAULT 'basket',   -- 'basket' | 'crochet'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS signups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_signups_email ON signups (email);

CREATE TABLE IF NOT EXISTS ledger (
  id SERIAL PRIMARY KEY,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other',
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('accrued','received')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
