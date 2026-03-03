/**
 * Prometheus-compatible Metrics - notification-hub
 */
const counters = new Map()
const gauges = new Map()

function incCounter(name, labels = {}, value = 1) {
  const key = `${name}${JSON.stringify(labels)}`
  counters.set(key, (counters.get(key) || 0) + value)
}

function setGauge(name, value, labels = {}) {
  const key = `${name}${JSON.stringify(labels)}`
  gauges.set(key, value)
}

function toPrometheusFormat() {
  const lines = []
  for (const [key, value] of counters) {
    const match = key.match(/^([^{]+)(.*)$/)
    if (match) {
      const [, name, labelsJson] = match
      const labels = labelsJson ? JSON.parse(labelsJson) : {}
      labels.service = 'notification-hub'
      const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')
      lines.push(`# TYPE ${name} counter`)
      lines.push(`${name}{${labelStr}} ${value}`)
    }
  }
  for (const [key, value] of gauges) {
    const match = key.match(/^([^{]+)(.*)$/)
    if (match) {
      const [, name, labelsJson] = match
      const labels = labelsJson ? JSON.parse(labelsJson) : {}
      labels.service = 'notification-hub'
      const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')
      lines.push(`# TYPE ${name} gauge`)
      lines.push(`${name}{${labelStr}} ${value}`)
    }
  }
  return lines.join('\n')
}

function toJSON() {
  const result = { counters: {}, gauges: {} }
  for (const [key, value] of counters) result.counters[key] = value
  for (const [key, value] of gauges) result.gauges[key] = value
  return result
}

const METRICS = {
  NOTIFICATIONS_SENT: 'notifications_sent_total',
  PUSH_SENT: 'push_notifications_sent_total',
  ACTIVE_CONNECTIONS: 'websocket_connections_active',
}

module.exports = { incCounter, setGauge, toPrometheusFormat, toJSON, METRICS }
