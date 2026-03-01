// chaos.js — add this to every service
// Exposes POST /chaos to simulate service failure for the Admin Dashboard

let isKilled = false

function chaosMiddleware(req, res, next) {
    // Allow /health, /chaos, and /metrics even when killed
    const allowed = ['/health', '/chaos', '/metrics']
    if (isKilled && !allowed.includes(req.path)) {
        return res.status(503).json({ message: 'Service is currently disabled (chaos mode).' })
    }
    next()
}

function chaosRoute(app) {
    // POST /chaos — called by Admin Dashboard
    app.post('/chaos', (req, res) => {
        isKilled = req.body.killed === true
        console.log(`⚡ Chaos mode: ${isKilled ? 'KILLED' : 'RESTORED'}`)
        res.json({ killed: isKilled, message: isKilled ? 'Service killed.' : 'Service restored.' })
    })

    // Update /health to reflect chaos state
    app.get('/chaos/status', (req, res) => {
        res.json({ killed: isKilled })
    })
}

module.exports = { chaosMiddleware, chaosRoute }