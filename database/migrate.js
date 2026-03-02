#!/usr/bin/env node
/**
 * Node.js Database Migration Runner
 * Replaces psql-based manage-migrations.sh with a cross-platform solution.
 *
 * Tracks applied migrations in a `public.schema_migrations` table.
 * Runs .sql files from ./migrations/ in sorted order, skipping already-applied ones.
 *
 * Usage:
 *   node database/migrate.js status   — show applied/pending migrations
 *   node database/migrate.js up       — apply all pending migrations
 *   node database/migrate.js up 003   — apply up to migration 003 (inclusive)
 *   node database/migrate.js redo     — re-apply the last migration (for development)
 */

const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'cafeteria',
  user:     process.env.DB_USER     || 'admin',
  password: process.env.DB_PASSWORD || 'secret123',
})

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      id          SERIAL PRIMARY KEY,
      filename    VARCHAR(255) UNIQUE NOT NULL,
      applied_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`[ERROR] Migrations directory not found: ${MIGRATIONS_DIR}`)
    process.exit(1)
  }
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()
}

async function getAppliedMigrations(client) {
  const result = await client.query(
    'SELECT filename, applied_at FROM public.schema_migrations ORDER BY filename'
  )
  return new Map(result.rows.map(r => [r.filename, r.applied_at]))
}

async function applyMigration(client, filename) {
  const filePath = path.join(MIGRATIONS_DIR, filename)
  const sql = fs.readFileSync(filePath, 'utf8')

  console.log(`[MIGRATE] Applying: ${filename}`)
  await client.query(sql)
  await client.query(
    'INSERT INTO public.schema_migrations (filename) VALUES ($1)',
    [filename]
  )
  console.log(`[MIGRATE] Applied:  ${filename}`)
}

async function cmdStatus() {
  const client = await pool.connect()
  try {
    await ensureMigrationsTable(client)
    const applied = await getAppliedMigrations(client)
    const files = getMigrationFiles()

    console.log('\nMigration Status')
    console.log('─'.repeat(60))

    for (const f of files) {
      const appliedAt = applied.get(f)
      const status = appliedAt
        ? `[applied] ${appliedAt.toISOString()}`
        : '[pending]'
      console.log(`  ${status}  ${f}`)
    }

    const pendingCount = files.filter(f => !applied.has(f)).length
    console.log('─'.repeat(60))
    console.log(`  ${files.length} total, ${files.length - pendingCount} applied, ${pendingCount} pending\n`)
  } finally {
    client.release()
  }
}

async function cmdUp(upTo) {
  const client = await pool.connect()
  try {
    await ensureMigrationsTable(client)
    const applied = await getAppliedMigrations(client)
    const files = getMigrationFiles()

    const pending = files.filter(f => {
      if (applied.has(f)) return false
      if (upTo && f.localeCompare(upTo) > 0) return false
      return true
    })

    if (pending.length === 0) {
      console.log('[MIGRATE] All migrations are up to date.')
      return
    }

    console.log(`[MIGRATE] Applying ${pending.length} migration(s)...\n`)

    for (const f of pending) {
      await applyMigration(client, f)
    }

    console.log(`\n[MIGRATE] Done. ${pending.length} migration(s) applied.`)
  } finally {
    client.release()
  }
}

async function cmdRedo() {
  const client = await pool.connect()
  try {
    await ensureMigrationsTable(client)
    const applied = await getAppliedMigrations(client)
    const appliedFiles = [...applied.keys()].sort()

    if (appliedFiles.length === 0) {
      console.log('[MIGRATE] No migrations to redo.')
      return
    }

    const last = appliedFiles[appliedFiles.length - 1]
    console.log(`[MIGRATE] Re-applying last migration: ${last}`)

    await client.query(
      'DELETE FROM public.schema_migrations WHERE filename = $1',
      [last]
    )
    await applyMigration(client, last)
    console.log(`[MIGRATE] Redo complete.`)
  } finally {
    client.release()
  }
}

async function cmdReset() {
  const initPath = path.join(__dirname, 'init.sql')
  if (!fs.existsSync(initPath)) {
    console.error('[RESET] init.sql not found at:', initPath)
    process.exit(1)
  }

  const client = await pool.connect()
  try {
    console.log('[RESET] Dropping all schemas and recreating from init.sql...')
    const sql = fs.readFileSync(initPath, 'utf8')
    await client.query(sql)
    console.log('[RESET] Database reinitialized successfully.')

    // Mark all existing migrations as applied (init.sql covers them all)
    await ensureMigrationsTable(client)
    await client.query('DELETE FROM public.schema_migrations')
    const files = getMigrationFiles()
    for (const f of files) {
      await client.query(
        'INSERT INTO public.schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
        [f]
      )
    }
    console.log(`[RESET] Marked ${files.length} migration(s) as applied.`)
    console.log('[RESET] Done. You can now start the services.')
  } finally {
    client.release()
  }
}

async function main() {
  const [command, arg] = process.argv.slice(2)

  try {
    switch (command) {
      case 'status':
        await cmdStatus()
        break
      case 'up':
        await cmdUp(arg)
        break
      case 'redo':
        await cmdRedo()
        break
      case 'reset':
        await cmdReset()
        break
      default:
        console.log(`
Database Migration Runner

Usage:
  node database/migrate.js status       Show migration status
  node database/migrate.js up           Apply all pending migrations
  node database/migrate.js up <prefix>  Apply migrations up to prefix (e.g. "003")
  node database/migrate.js redo         Re-apply the last migration
  node database/migrate.js reset        Drop and recreate all tables from init.sql

Environment Variables:
  DB_HOST      (default: localhost)
  DB_PORT      (default: 5432)
  DB_NAME      (default: cafeteria)
  DB_USER      (default: admin)
  DB_PASSWORD  (default: secret123)
`)
    }
  } catch (err) {
    console.error('[MIGRATE] Error:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
