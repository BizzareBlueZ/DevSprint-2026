/**
 * Prometheus-compatible Metrics - stock-service
 */
const counters = new Map()
const histograms = new Map()
const HISTOGRAM_BUCKETS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]

function incCounter(name, labels = {}, value = 1) {
  const key = `${name}${JSON.stringify(labels)}`
  counters.set(key, (counters.get(key) || 0) + value)
}

function observeHistogram(name, value, labels = {}) {
  const key = `${name}${JSON.stringify(labels)}`
  if (!histograms.has(key)) {
    histograms.set(key, { sum: 0, count: 0, buckets: new Array(HISTOGRAM_BUCKETS.length + 1).fill(0) })
  }
  const h = histograms.get(key)
  h.sum += value
  h.count++
  for (let i = 0; i < HISTOGRAM_BUCKETS.length; i++) {
    if (value <= HISTOGRAM_BUCKETS[i]) { h.buckets[i]++; break }
  }
  if (value > HISTOGRAM_BUCKETS[HISTOGRAM_BUCKETS.length - 1]) h.buckets[HISTOGRAM_BUCKETS.length]++
}

function toPrometheusFormat() {
  const lines = []
  for (const [key, value] of counters) {
    const match = key.match(/^([^{]+)(.*)$/)
    if (match) {
      const [, name, labelsJson] = match
      const labels = labelsJson ? JSON.parse(labelsJson) : {}
      labels.service = 'stock-service'
      const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')
      lines.push(`# TYPE ${name} counter`)
      lines.push(`${name}{${labelStr}} ${value}`)
    }
  }
  return lines.join('\n')
}

function toJSON() {
  const result = { counters: {}, histograms: {} }
  for (const [key, value] of counters) result.counters[key] = value
  for (const [key, h] of histograms) result.histograms[key] = { sum: h.sum, count: h.count, avg: h.count > 0 ? h.sum / h.count : 0 }
  return result
}

const METRICS = {
  HTTP_REQUESTS_TOTAL: 'http_requests_total',
  HTTP_REQUEST_DURATION_MS: 'http_request_duration_ms',
  STOCK_DECREMENT_TOTAL: 'stock_decrement_total',
  STOCK_DECREMENT_FAILED: 'stock_decrement_failed',
}

module.exports = { incCounter, observeHistogram, toPrometheusFormat, toJSON, METRICS }
