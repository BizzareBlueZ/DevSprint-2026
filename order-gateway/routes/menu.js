/**
 * Menu Routes
 * Handles menu item listing and retrieval
 */
const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const { logger } = require('../lib/logger')

module.exports = function createMenuRoutes(pool) {
  // GET /menu - List available menu items
  router.get('/', requireAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT m.id, m.name, m.description, m.price, m.category, m.is_available,
               COALESCE(s.quantity, 0) as stock
        FROM public.menu_items m
        LEFT JOIN inventory.stock s ON s.item_id = m.id
        WHERE m.is_available = true
        ORDER BY m.category, m.name
      `)
      res.json({ items: result.rows })
    } catch (err) {
      logger.error({ correlationId: req.correlationId, error: err.message }, 'Menu fetch error')
      res.status(500).json({ message: 'Failed to fetch menu.' })
    }
  })

  // GET /menu/:itemId/reviews - Get reviews for a menu item
  router.get('/:itemId/reviews', async (req, res) => {
    const { itemId } = req.params
    const { limit = 20, offset = 0 } = req.query

    try {
      const result = await pool.query(
        `SELECT r.id, r.rating, r.comment, r.created_at,
                s.name as student_name, s.department
         FROM public.reviews r
         JOIN identity.students s ON s.student_id = r.student_id
         WHERE r.item_id = $1
         ORDER BY r.created_at DESC
         LIMIT $2 OFFSET $3`,
        [itemId, parseInt(limit), parseInt(offset)]
      )

      const statsResult = await pool.query(
        `SELECT AVG(rating) as avg_rating, COUNT(*) as total_reviews
         FROM public.reviews WHERE item_id = $1`,
        [itemId]
      )

      res.json({
        reviews: result.rows,
        stats: {
          avgRating: parseFloat(statsResult.rows[0].avg_rating) || 0,
          totalReviews: parseInt(statsResult.rows[0].total_reviews),
        },
      })
    } catch (err) {
      logger.error({ correlationId: req.correlationId, error: err.message }, 'Get reviews error')
      res.status(500).json({ message: 'Failed to fetch reviews.' })
    }
  })

  return router
}
