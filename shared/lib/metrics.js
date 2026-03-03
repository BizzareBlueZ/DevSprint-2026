/**
 * Prometheus-compatible Metrics
 * Copy this to each service's lib/ folder
 * Provides counters, histograms, and gauges for monitoring
 */

const counters = new Map()
const histograms = new Map()
const gauges = new Map()

const HISTOGRAM_BUCKETS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]

function incCounter(name, labels = {}, value = 1) {
  const key = `${name}${JSON.stringify(labels)}`
  counters.set(key, (counters.get(key) || 0) + value)
}

function setGauge(name, value, labels = {}) {
  const key = `${name}${JSON.stringify(labels)}`
  gauges.set(key, value)
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
    if (value <= HISTOGRAM_BUCKETS[i]) {
      h.buckets[i]++
      break
    }
  }
  if (value > HISTOGRAM_BUCKETS[HISTOGRAM_BUCKETS.length - 1]) {
    h.buckets[HISTOGRAM_BUCKETS.length]++
  }
}

function toPrometheusFormat(serviceName) {
  const lines = []

  for (const [key, value] of counters) {
    const match = key.match(/^([^{]+)(.*)$/)
    if (match) {
      const [, name, labelsJson] = match
      const labels = labelsJson ? JSON.parse(labelsJson) : {}
      labels.service = serviceName
      const labelStr = Object.entries(labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',')
      lines.push(`# TYPE ${name} counter`)
      lines.push(`${name}{${labelStr}} ${value}`)
    }
  }

  for (const [key, value] of gauges) {
    const match = key.match(/^([^{]+)(.*)$/)
    if (match) {
      const [, name, labelsJson] = match
      const labels = labelsJson ? JSON.parse(labelsJson) : {}
      labels.service = serviceName
      const labelStr = Object.entries(labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',')
      lines.push(`# TYPE ${name} gauge`)
      lines.push(`${name}{${labelStr}} ${value}`)
    }
  }

  return lines.join('\n')
}

function toJSON() {
  const result = { counters: {}, gauges: {}, histograms: {} }
  for (const [key, value] of counters) result.counters[key] = value
  for (const [key, value] of gauges) result.gauges[key] = value
  for (const [key, h] of histograms) {
    result.histograms[key] = { sum: h.sum, count: h.count, avg: h.count > 0 ? h.sum / h.count : 0 }
  }
  return result
}

const METRICS = {
  HTTP_REQUESTS_TOTAL: 'http_requests_total',
  HTTP_REQUEST_DURATION_MS: 'http_request_duration_ms',
}

module.exports = { incCounter, setGauge, observeHistogram, toPrometheusFormat, toJSON, METRICS }
