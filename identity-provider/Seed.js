// seed.js — run this once after `init.sql` to populate students and admins
// Usage: node seed.js
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

const STUDENTS = [
    { studentId: '230042135', name: 'Khadiza Sultana', department: 'CSE', year: 3, password: 'password123', balance: 500 },
    { studentId: '220041001', name: 'Ahmed Hassan',    department: 'CSE', year: 4, password: 'password123', balance: 300 },
    { studentId: '230041002', name: 'Fatima Rahman',   department: 'EEE', year: 3, password: 'password123', balance: 250 },
    { studentId: '240041003', name: 'Omar Abdullah',   department: 'ME',  year: 2, password: 'password123', balance: 400 },
    { studentId: '210041004', name: 'Nadia Islam',     department: 'CSE', year: 4, password: 'password123', balance: 350 },
]

const ADMINS = [
    { username: 'admin',  email: 'admin@iut-dhaka.edu',    fullName: 'System Administrator', password: 'admin123',       role: 'superadmin' },
    { username: 'iutcs',  email: 'cs@iut-dhaka.edu',       fullName: 'CS Department Admin',  password: 'devsprint2026',  role: 'admin' },
]

async function seed() {
    console.log('🌱 Seeding database...\n')

    // ── Students ──────────────────────────────────────────────────
    console.log('👤 Seeding students...')
    for (const s of STUDENTS) {
        const email = `${s.studentId}@iut-dhaka.edu`
        const hash  = await bcrypt.hash(s.password, 10)

        await pool.query(
            `INSERT INTO students (student_id, email, password_hash, name, department, year)
             VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (student_id) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
            [s.studentId, email, hash, s.name, s.department, s.year]
        )

        // Wallet credit + today token are auto-inserted by DB triggers

        console.log(`  ✅ ${s.name} (${email}) — password: ${s.password}`)
    }

    // ── Admins ────────────────────────────────────────────────────
    console.log('\n🔐 Seeding admins...')
    for (const a of ADMINS) {
        const hash = await bcrypt.hash(a.password, 10)

        await pool.query(
            `INSERT INTO admins (username, email, password_hash, full_name, role)
             VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
            [a.username, a.email, hash, a.fullName, a.role]
        )

        console.log(`  ✅ ${a.username} — password: ${a.password} (${a.role})`)
    }

    console.log('\n🎉 Seeding complete!')
    console.log('\n📋 Student login format:  <studentId>@iut-dhaka.edu / password123')
    console.log('📋 Admin login:           admin / admin123  OR  iutcs / devsprint2026')
    await pool.end()
}

seed().catch(err => {
    console.error('❌ Seed failed:', err.message)
    process.exit(1)
})