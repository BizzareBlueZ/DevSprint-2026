/**
 * Zod Validation Middleware
 * Express middleware for request validation using Zod schemas
 */
const { ZodError } = require('zod')

/**
 * Validate request body against a Zod schema
 * @param {z.ZodSchema} schema - Zod schema to validate against
 */
function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body)
      next()
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }))
        return res.status(400).json({
          message: 'Validation failed',
          errors,
        })
      }
      next(error)
    }
  }
}

/**
 * Validate query parameters against a Zod schema
 * @param {z.ZodSchema} schema - Zod schema to validate against
 */
function validateQuery(schema) {
  return (req, res, next) => {
    try {
      req.query = schema.parse(req.query)
      next()
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }))
        return res.status(400).json({
          message: 'Invalid query parameters',
          errors,
        })
      }
      next(error)
    }
  }
}

/**
 * Validate URL parameters against a Zod schema
 * @param {z.ZodSchema} schema - Zod schema to validate against
 */
function validateParams(schema) {
  return (req, res, next) => {
    try {
      req.params = schema.parse(req.params)
      next()
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }))
        return res.status(400).json({
          message: 'Invalid URL parameters',
          errors,
        })
      }
      next(error)
    }
  }
}

/**
 * Combine multiple validators
 * @param {object} validators - Object with body, query, params validators
 */
function validate(validators) {
  const middlewares = []
  if (validators.body) middlewares.push(validateBody(validators.body))
  if (validators.query) middlewares.push(validateQuery(validators.query))
  if (validators.params) middlewares.push(validateParams(validators.params))
  
  return (req, res, next) => {
    const runMiddleware = (index) => {
      if (index >= middlewares.length) return next()
      middlewares[index](req, res, (err) => {
        if (err) return next(err)
        runMiddleware(index + 1)
      })
    }
    runMiddleware(0)
  }
}

module.exports = {
  validateBody,
  validateQuery,
  validateParams,
  validate,
}
