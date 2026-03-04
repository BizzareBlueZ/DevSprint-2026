/**
 * Kitchen Simulation Service
 * Simulates kitchen workflow when RabbitMQ is not available
 */
const axios = require('axios')
const { logger } = require('../lib/logger')

function createKitchenSimulator(pool, NOTIFICATION_HUB_URL) {
  async function simulateKitchen(order) {
    const notify = async status => {
      try {
        await pool.query(
          'UPDATE orders.orders SET status = $1, updated_at = NOW() WHERE order_id = $2',
          [status, order.orderId]
        )
        await axios
          .post(`${NOTIFICATION_HUB_URL}/notify`, {
            orderId: order.orderId,
            status,
            orderInfo: { itemName: order.itemName },
            studentId: order.studentId,
          })
          .catch(() => {})

        logger.info({ orderId: order.orderId, status }, 'Kitchen simulation: status updated')
      } catch (err) {
        logger.error({ orderId: order.orderId, error: err.message }, 'Kitchen simulation error')
      }
    }

    setTimeout(() => notify('IN_KITCHEN'), 1000)
    setTimeout(() => notify('READY'), 5000 + Math.random() * 2000)
  }

  return { simulateKitchen }
}

module.exports = { createKitchenSimulator }
