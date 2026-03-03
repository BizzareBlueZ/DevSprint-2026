/**
 * Prometheus-compatible Metrics - kitchen-queue
 */
const counters = new Map()
const histograms = new Map()
const HISTOGRAM_BUCKETS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]

function incCounter(name, labels = {}, value = 1) {
  const key = `${name}${JSON.stringify(labels)}`
  counters.set(key, (counters.get(key) || 0) + value)
}

function setGauge(name, value, labels = {}) {
  const key = `${name}${JSON.stringify(labels)}`
  counters.set(key, value) // Using counters map for simplicity
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
      labels.service = 'kitchen-queue'
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
  ORDERS_PROCESSED: 'orders_processed_total',
  ORDERS_FAILED: 'orders_failed_total',
  ORDERS_IN_PROGRESS: 'orders_in_progress',
  COOKING_DURATION_MS: 'cooking_duration_ms',
}

module.exports = { incCounter, setGauge, observeHistogram, toPrometheusFormat, toJSON, METRICS }
