const express = require('express')
const http    = require('http')
const cors    = require('cors')
const { Server } = require('socket.io')
require('dotenv').config()

const app    = express()
const server = http.createServer(app)

const io = new Server(server, {
    cors: {
        origin: ['http://localhost:5173', 'http://localhost:80', 'http://localhost'],
        methods: ['GET', 'POST'],
        credentials: true,
    }
})

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:80', 'http://localhost'] }))
app.use(express.json())

const { chaosMiddleware, chaosRoute } = require('./chaos')
app.use(chaosMiddleware)
chaosRoute(app)

// ─── Metrics ───────────────────────────────────────────────────
const metrics = { notificationsSent: 0, activeConnections: 0 }

// ─── Socket.IO — student connects and joins their order room ───
io.on('connection', (socket) => {
    metrics.activeConnections++
    console.log(`🔌 Client connected: ${socket.id} (total: ${metrics.activeConnections})`)

    // Student joins a room named by their orderId (for order tracker page)
    socket.on('join-order', ({ orderId }) => {
        socket.join(orderId)
        console.log(`📦 Socket ${socket.id} joined order room: ${orderId}`)

        // Immediately confirm connection
        socket.emit('order-status', {
            orderId,
            status: 'PENDING',
            message: 'Connected to live updates',
        })
    })

    // Student joins a global room for all their orders (for toast notifications)
    socket.on('join-student', ({ studentId }) => {
        if (studentId) {
            socket.join(`student-${studentId}`)
            console.log(`👤 Socket ${socket.id} joined student room: student-${studentId}`)
        }
    })

    socket.on('disconnect', () => {
        metrics.activeConnections--
        console.log(`🔌 Client disconnected: ${socket.id} (total: ${metrics.activeConnections})`)
    })
})

// ─── POST /notify — called internally by Kitchen Queue ─────────
// Kitchen Queue → POST /notify → Socket.IO → Student browser
app.post('/notify', (req, res) => {
    const { orderId, status, orderInfo = {}, studentId } = req.body

    if (!orderId || !status) {
        return res.status(400).json({ message: 'orderId and status are required.' })
    }

    const payload = {
        orderId,
        status,
        orderInfo,
        timestamp: new Date().toISOString(),
    }

    // Push to all sockets in this order's room (order tracker page)
    io.to(orderId).emit('order-status', payload)

    // Also push to the student's global room (toast notifications on any page)
    if (studentId) {
        io.to(`student-${studentId}`).emit('order-status', payload)
    }

    metrics.notificationsSent++
    console.log(`📣 Notified order ${orderId}: ${status}`)

    res.status(200).json({ message: 'Notification sent.', orderId, status })
})

// ─── GET /health ───────────────────────────────────────────────
app.get('/health', (req, res) => {
    const socketReady = io.engine && io.engine.clientsCount !== undefined
    const healthy = socketReady
    res.status(healthy ? 200 : 503).json({
        status:            healthy ? 'healthy' : 'unhealthy',
        service:           'notification-hub',
        dependencies:      { socketio: socketReady ? 'ready' : 'not_ready' },
        activeConnections: metrics.activeConnections,
        timestamp:         new Date().toISOString(),
    })
})

// ─── GET /metrics ──────────────────────────────────────────────
app.get('/metrics', (req, res) => {
    res.json({
        totalOrders:       metrics.notificationsSent,
        failureCount:      0,
        activeConnections: metrics.activeConnections,
        uptime:            process.uptime(),
    })
})

// ─── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3004
server.listen(PORT, () => {
    console.log(`🔔 Notification Hub running on http://localhost:${PORT}`)
    console.log(`   POST /notify  — push status update to student`)
    console.log(`   Socket.IO     — students connect for live updates`)
})