/**
 * Validation module exports
 */
const schemas = require('./schemas')
const middleware = require('./middleware')

module.exports = {
  ...schemas,
  ...middleware,
}
