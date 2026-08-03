const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'deshonda-db',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'deshonda',
  user: process.env.DB_USER || 'deshonda',
  password: process.env.DB_PASSWORD,
});

module.exports = pool;
