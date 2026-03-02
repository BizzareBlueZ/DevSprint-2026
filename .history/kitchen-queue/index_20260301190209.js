const express = require('express')
const axios   = require('axios')
const cors    = require('cors')
require('dotenv').config()

const { Pool } = require('pg')
const app = express()

app.use(cors())
app.use(express.json())

const { chaosMiddleware, chaosRoute } = require('./chaos')
app.use(chaosMiddleware)
chaosRoute(app)

const RABBITMQ_URL         = process.env.RABBITMQ_URL         || 'amqp://guest:guest@localhost:5672'
const NOTIFICATION_HUB_URL = process.env.NOTIFICATION_HUB_URL || 'http://localhost:3004'
const KITCHEN_MIN_MS       = parseInt(process.env.KITCHEN_MIN_MS) || 3000
const KITCHEN_MAX_MS       = parseInt(process.env.KITCHEN_MAX_MS) || 7000

const pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME     || 'cafeteria',
    user:     process.env.DB_USER     || 'admin',
    password: process.env.DB_PASSWORD || 'secret123',
})

const metrics = { processed: 0, failed: 0, inProgress: 0 }
let rabbitConnected = false

async function notify(orderId, status, orderInfo = {}) {
    try {
        await pool.query("UPDATE orders SET status = $1, updated_at = NOW() WHERE order_id = $2", [status, orderId])
    } catch (err) { console.error('DB update error:', err.message) }
    try {
        await axios.post(`${NOTIFICATION_HUB_URL}/notify`, { orderId, status, orderInfo }, { timeout: 2000 })
    } catch { /* notification hub down - fault tolerant */ }
}

async function processOrder(order) {
    const { orderId, itemName } = order
    const prepTime = KITCHEN_MIN_MS + Math.random() * (KITCHEN_MAX_MS - KITCHEN_MIN_MS)
    console.log(`Cooking order ${orderId} (${itemName}) - ${Math.round(prepTime/1000)}s`)
    metrics.inProgress++
    await notify(orderId, 'IN_KITCHEN', { itemName })
    await new Promise(resolve => setTimeout(resolve, prepTime))
    await notify(orderId, 'READY', { itemName })
    metrics.inProgress--
    metrics.processed++
    console.log(`Order ${orderId} READY`)
}

async function startConsumer() {
    try {
        const amqp = require('amqplib')
        const conn = await amqp.connect(RABBITMQ_URL)
        const channel = await conn.createChannel()
        await channel.assertQueue('orders', { durable: true })
        channel.prefetch(5)
        console.log('Connected to RabbitMQ')
        channel.consume('orders', async (msg) => {
            if (!msg) return
            try {
                const order = JSON.parse(msg.content.toString())
                await processOrder(order)
                channel.ack(msg)
            } catch (err) {
                console.error('Processing error:', err.message)
                metrics.failed++
                channel.nack(msg, false, false)
            }
        })
        conn.on('close', () => setTimeout(startConsumer, 5000))
    } catch {
        console.warn('RabbitMQ not available - retrying in 5s...')
        setTimeout(startConsumer, 5000)
    }
}

app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'kitchen-queue', timestamp: new Date().toISOString() }))
app.get('/metrics', (req, res) => res.json({ totalOrders: metrics.processed, failureCount: metrics.failed, inProgress: metrics.inProgress, uptime: process.uptime() }))

const PORT = process.env.PORT || 3003
app.listen(PORT, () => { console.log(`Kitchen Queue on http://localhost:${PORT}`); startConsumer() })