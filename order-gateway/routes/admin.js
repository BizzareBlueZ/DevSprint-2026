/**
 * Admin Routes
 * Handles menu management, stock, and analytics
 */
const express = require('express')
const router = express.Router()
const { logger } = require('../lib/logger')

module.exports = function createAdminRoutes(pool, { redisClient }) {
  // GET /admin/menu
  router.get('/menu', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT m.id, m.name, m.description, m.price, m.category, m.is_available, m.image_url, m.created_at,
               COALESCE(s.quantity, 0) as stock
        FROM public.menu_items m
        LEFT JOIN inventory.stock s ON s.item_id = m.id
        ORDER BY m.category, m.name
      `)
      res.json({ items: result.rows })
    } catch (err) {
      logger.error(
        { correlationId: req.correlationId, error: err.message },
        'Admin menu fetch error'
      )
      res.status(500).json({ message: 'Failed to fetch menu items.' })
    }
  })

  // POST /admin/menu
  router.post('/menu', async (req, res) => {
    const {
      name,
      description,
      price,
      category,
      is_available = true,
      image_url,
      initial_stock = 50,
    } = req.body
    if (!name || !price || !category) {
      return res.status(400).json({ message: 'name, price and category are required.' })
    }
    try {
      const result = await pool.query(
        `INSERT INTO public.menu_items (name, description, price, category, is_available, image_url)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [name, description, parseFloat(price), category, is_available, image_url]
      )
      const item = result.rows[0]

      await pool.query(
        `INSERT INTO inventory.stock (item_id, quantity, version) VALUES ($1, $2, 1)
         ON CONFLICT (item_id) DO NOTHING`,
        [item.id, initial_stock]
      )

      logger.info({ correlationId: req.correlationId, itemId: item.id, name }, 'Menu item created')
      res.status(201).json({ message: 'Menu item created.', item })
    } catch (err) {
      logger.error(
        { correlationId: req.correlationId, error: err.message },
        'Create menu item error'
      )
      res.status(500).json({ message: 'Failed to create menu item.' })
    }
  })

  // PUT /admin/menu/:id
  router.put('/menu/:id', async (req, res) => {
    const { id } = req.params
    const { name, description, price, category, is_available, image_url } = req.body
    try {
      const result = await pool.query(
        `UPDATE public.menu_items 
         SET name = COALESCE($1, name),
             description = COALESCE($2, description),
             price = COALESCE($3, price),
             category = COALESCE($4, category),
             is_available = COALESCE($5, is_available),
             image_url = COALESCE($6, image_url)
         WHERE id = $7 RETURNING *`,
        [name, description, price ? parseFloat(price) : null, category, is_available, image_url, id]
      )
      if (result.rows.length === 0) return res.status(404).json({ message: 'Menu item not found.' })

      logger.info({ correlationId: req.correlationId, itemId: id }, 'Menu item updated')
      res.json({ message: 'Menu item updated.', item: result.rows[0] })
    } catch (err) {
      logger.error(
        { correlationId: req.correlationId, error: err.message },
        'Update menu item error'
      )
      res.status(500).json({ message: 'Failed to update menu item.' })
    }
  })

  // DELETE /admin/menu/:id
  router.delete('/menu/:id', async (req, res) => {
    const { id } = req.params
    try {
      const result = await pool.query('DELETE FROM public.menu_items WHERE id = $1 RETURNING *', [
        id,
      ])
      if (result.rows.length === 0) return res.status(404).json({ message: 'Menu item not found.' })

      await pool.query('DELETE FROM inventory.stock WHERE item_id = $1', [id])

      logger.info({ correlationId: req.correlationId, itemId: id }, 'Menu item deleted')
      res.json({ message: 'Menu item deleted.' })
    } catch (err) {
      logger.error(
        { correlationId: req.correlationId, error: err.message },
        'Delete menu item error'
      )
      res.status(500).json({ message: 'Failed to delete menu item.' })
    }
  })

  // PUT /admin/stock/:itemId
  router.put('/stock/:itemId', async (req, res) => {
    const { itemId } = req.params
    const { quantity } = req.body
    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({ message: 'Valid quantity is required.' })
    }
    try {
      const result = await pool.query(
        `INSERT INTO inventory.stock (item_id, quantity, version) VALUES ($1, $2, 1)
         ON CONFLICT (item_id) DO UPDATE SET quantity = $2, updated_at = NOW()
         RETURNING *`,
        [itemId, parseInt(quantity)]
      )

      if (redisClient) await redisClient.del(`stock:${itemId}`).catch(() => {})

      logger.info({ correlationId: req.correlationId, itemId, quantity }, 'Stock updated')
      res.json({ message: 'Stock updated.', stock: result.rows[0] })
    } catch (err) {
      logger.error({ correlationId: req.correlationId, error: err.message }, 'Update stock error')
      res.status(500).json({ message: 'Failed to update stock.' })
    }
  })

  // GET /admin/analytics
  router.get('/analytics', async (req, res) => {
    try {
      const popularItems = await pool.query(`
        SELECT m.id, m.name, m.category, COUNT(o.order_id) as order_count, 
               SUM(o.amount) as total_revenue
        FROM orders.orders o
        JOIN public.menu_items m ON m.id = o.item_id
        WHERE o.status NOT IN ('FAILED', 'CANCELLED')
        GROUP BY m.id, m.name, m.category
        ORDER BY order_count DESC
        LIMIT 10
      `)

      const peakTimes = await pool.query(`
        SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as order_count
        FROM orders.orders
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY hour
        ORDER BY hour
      `)

      const dailyRevenue = await pool.query(`
        SELECT DATE(created_at) as date, SUM(amount) as revenue, COUNT(*) as order_count
        FROM orders.orders
        WHERE status NOT IN ('FAILED', 'CANCELLED') AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `)

      const totalStats = await pool.query(`
        SELECT 
          COUNT(*) as total_orders,
          SUM(amount) as total_revenue,
          COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END) as completed_orders,
          COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_orders
        FROM orders.orders
      `)

      res.json({
        popularItems: popularItems.rows,
        peakTimes: peakTimes.rows,
        dailyRevenue: dailyRevenue.rows,
        totals: totalStats.rows[0],
      })
    } catch (err) {
      logger.error({ correlationId: req.correlationId, error: err.message }, 'Analytics error')
      res.status(500).json({ message: 'Failed to fetch analytics.' })
    }
  })

  return router
}
