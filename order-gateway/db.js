const { Pool } = require('pg')
require('dotenv').config()

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'cafeteria',
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'secret123',
})

pool.connect((err, client, release) => {
  if (err) console.error('❌ DB connection failed:', err.message)
  else {
    console.log('✅ Connected to PostgreSQL')
    release()
  }
})

module.exports = pool
