/**
 * Database Utilities for Microservices
 * Handles schema-specific queries, wallet operations, and materialized view refresh
 */

const { Pool } = require('pg')

class DatabaseUtils {
  constructor(pool) {
    this.pool = pool
  }

  /**
   * Refresh materialized wallet balances
   * Call this periodically or after wallet transactions are created
   */
  async refreshWalletBalances() {
    try {
      const result = await this.pool.query('SELECT refresh_wallet_balances();')
      console.log('[DB] Wallet balances materialized view refreshed')
      return result
    } catch (error) {
      console.error('[DB] Error refreshing wallet balances:', error.message)
      throw error
    }
  }

  /**
   * Get wallet balance from materialized view (fast)
   * @param {string} studentId
   * @returns {Promise<object>} { student_id, name, balance }
   */
  async getWalletBalanceFast(studentId) {
    try {
      const result = await this.pool.query(
        'SELECT student_id, name, balance FROM public.wallet_balances_materialized WHERE student_id = $1',
        [studentId]
      )
      return result.rows[0] || { student_id: studentId, balance: 0 }
    } catch (error) {
      console.error('[DB] Error getting wallet balance:', error.message)
      throw error
    }
  }

  /**
   * Get wallet balance by calculating from transactions (accurate but slower)
   * Use for verification or critical operations
   * @param {string} studentId
   * @returns {Promise<number>} balance
   */
  async getWalletBalanceAccurate(studentId) {
    try {
      const result = await this.pool.query(
        `SELECT COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE -amount END), 0) AS balance
                 FROM public.transactions WHERE student_id = $1`,
        [studentId]
      )
      return parseFloat(result.rows[0].balance) || 0
    } catch (error) {
      console.error('[DB] Error getting accurate wallet balance:', error.message)
      throw error
    }
  }

  /**
   * Get all student info including wallet balance (from materialized view)
   * @returns {Promise<array>}
   */
  async getAllStudentsWithBalance() {
    try {
      const result = await this.pool.query(
        `SELECT s.id, s.student_id, s.name, s.email, s.department, s.year, s.is_active, 
                        COALESCE(w.balance, 0) as balance
                 FROM identity.students s
                 LEFT JOIN public.wallet_balances_materialized w ON w.student_id = s.student_id
                 ORDER BY s.created_at DESC`
      )
      return result.rows
    } catch (error) {
      console.error('[DB] Error getting students with balance:', error.message)
      throw error
    }
  }

  /**
   * Create transaction and update materialized wallet view
   * @param {string} studentId
   * @param {string} type 'credit' or 'debit'
   * @param {number} amount
   * @param {string} description
   * @param {string} orderId (optional)
   */
  async createTransaction(studentId, type, amount, description, orderId = null) {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')

      // Get current balance
      const balanceResult = await client.query(
        `SELECT COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE -amount END), 0) AS balance
                 FROM public.transactions WHERE student_id = $1`,
        [studentId]
      )
      const currentBalance = parseFloat(balanceResult.rows[0].balance) || 0

      // Calculate new balance
      const newBalance = type === 'credit' ? currentBalance + amount : currentBalance - amount

      // Insert transaction
      const txResult = await client.query(
        `INSERT INTO public.transactions (student_id, type, amount, balance_after, description, order_id)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING *`,
        [studentId, type, amount, newBalance, description, orderId]
      )

      // Update materialized view entry
      await client.query(
        `INSERT INTO public.wallet_balances_materialized (student_id, name, balance, last_updated)
                 SELECT $1, s.name, $2, CURRENT_TIMESTAMP FROM identity.students s WHERE s.student_id = $1
                 ON CONFLICT (student_id) DO UPDATE SET 
                    balance = EXCLUDED.balance,
                    last_updated = CURRENT_TIMESTAMP`,
        [studentId, newBalance]
      )

      await client.query('COMMIT')
      console.log(`[DB] Transaction created: ${studentId} ${type} ${amount}`)
      return txResult.rows[0]
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('[DB] Error creating transaction:', error.message)
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Get transaction history for a student
   * @param {string} studentId
   * @param {number} limit default 50
   */
  async getTransactionHistory(studentId, limit = 50) {
    try {
      const result = await this.pool.query(
        `SELECT id, student_id, type, amount, balance_after, description, order_id, created_at
                 FROM public.transactions
                 WHERE student_id = $1
                 ORDER BY created_at DESC
                 LIMIT $2`,
        [studentId, limit]
      )
      return result.rows
    } catch (error) {
      console.error('[DB] Error getting transaction history:', error.message)
      throw error
    }
  }

  /**
   * Query helper for identity schema
   */
  async queryIdentity(sql, values = []) {
    try {
      return await this.pool.query(sql, values)
    } catch (error) {
      console.error('[DB] Identity query error:', error.message)
      throw error
    }
  }

  /**
   * Query helper for orders schema
   */
  async queryOrders(sql, values = []) {
    try {
      return await this.pool.query(sql, values)
    } catch (error) {
      console.error('[DB] Orders query error:', error.message)
      throw error
    }
  }

  /**
   * Query helper for inventory schema
   */
  async queryInventory(sql, values = []) {
    try {
      return await this.pool.query(sql, values)
    } catch (error) {
      console.error('[DB] Inventory query error:', error.message)
      throw error
    }
  }

  /**
   * Get database schema information
   */
  async getSchemaInfo() {
    try {
      const schemas = await this.pool.query(
        `SELECT schema_name FROM information_schema.schemata 
                 WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pgagent')
                 ORDER BY schema_name`
      )

      const schemaInfo = {}
      for (const schema of schemas.rows) {
        const tables = await this.pool.query(
          `SELECT table_name FROM information_schema.tables 
                     WHERE table_schema = $1 AND table_type = 'BASE TABLE'
                     ORDER BY table_name`,
          [schema.schema_name]
        )
        schemaInfo[schema.schema_name] = tables.rows.map(r => r.table_name)
      }

      return schemaInfo
    } catch (error) {
      console.error('[DB] Error getting schema info:', error.message)
      throw error
    }
  }
}

module.exports = DatabaseUtils
