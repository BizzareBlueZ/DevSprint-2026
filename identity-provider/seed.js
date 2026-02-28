const bcrypt = require('bcryptjs')
const { Pool } = require('pg')
require('dotenv').config()

const pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME     || 'cafeteria',
    user:     process.env.DB_USER     || 'admin',
    password: process.env.DB_PASSWORD || 'secret123',
})

async function seed() {
    console.log('Hashing password...')
    const hash = await bcrypt.hash('password123', 10)
    console.log('Hash generated:', hash)

    const result = await pool.query(
        'UPDATE students SET password_hash = $1',
        [hash]
    )
    console.log(`✅ Updated ${result.rowCount} students with password: password123`)

    // Verify it works
    const verify = await bcrypt.compare('password123', hash)
    console.log('✅ Verification test:', verify ? 'PASSED' : 'FAILED')

    await pool.end()
}

seed().catch(err => {
    console.error('❌ Error:', err.message)
    process.exit(1)
})