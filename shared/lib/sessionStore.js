/**
 * Redis Session Store
 * For horizontal scaling of the identity provider
 */

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const SESSION_TTL = parseInt(process.env.SESSION_TTL) || 86400 // 24 hours

/**
 * Create a Redis-backed session manager
 * @param {object} redisClient - ioredis client instance
 */
function createSessionStore(redisClient) {
  const PREFIX = 'session:'
  
  return {
    /**
     * Store a session
     * @param {string} sessionId - Session ID (usually from JWT jti)
     * @param {object} data - Session data
     * @param {number} ttl - TTL in seconds (optional)
     */
    async set(sessionId, data, ttl = SESSION_TTL) {
      const key = PREFIX + sessionId
      await redisClient.set(key, JSON.stringify(data), 'EX', ttl)
    },

    /**
     * Get a session
     * @param {string} sessionId - Session ID
     * @returns {object|null} Session data or null
     */
    async get(sessionId) {
      const key = PREFIX + sessionId
      const data = await redisClient.get(key)
      return data ? JSON.parse(data) : null
    },

    /**
     * Delete a session (logout)
     * @param {string} sessionId - Session ID
     */
    async destroy(sessionId) {
      const key = PREFIX + sessionId
      await redisClient.del(key)
    },

    /**
     * Refresh session TTL
     * @param {string} sessionId - Session ID
     * @param {number} ttl - New TTL in seconds
     */
    async touch(sessionId, ttl = SESSION_TTL) {
      const key = PREFIX + sessionId
      await redisClient.expire(key, ttl)
    },

    /**
     * Invalidate all sessions for a user
     * @param {string} studentId - Student ID
     */
    async invalidateUser(studentId) {
      const pattern = `${PREFIX}*:${studentId}`
      const keys = await redisClient.keys(pattern)
      if (keys.length > 0) {
        await redisClient.del(...keys)
      }
    },

    /**
     * Check if session exists
     * @param {string} sessionId - Session ID
     * @returns {boolean}
     */
    async exists(sessionId) {
      const key = PREFIX + sessionId
      return (await redisClient.exists(key)) === 1
    },
  }
}

/**
 * Blacklist tokens (for logout before expiry)
 */
function createTokenBlacklist(redisClient) {
  const PREFIX = 'blacklist:'
  
  return {
    /**
     * Add token to blacklist
     * @param {string} jti - JWT ID
     * @param {number} exp - Token expiry timestamp
     */
    async add(jti, exp) {
      const key = PREFIX + jti
      const ttl = Math.max(0, exp - Math.floor(Date.now() / 1000))
      if (ttl > 0) {
        await redisClient.set(key, '1', 'EX', ttl)
      }
    },

    /**
     * Check if token is blacklisted
     * @param {string} jti - JWT ID
     * @returns {boolean}
     */
    async isBlacklisted(jti) {
      const key = PREFIX + jti
      return (await redisClient.exists(key)) === 1
    },
  }
}

module.exports = { createSessionStore, createTokenBlacklist, SESSION_TTL }
