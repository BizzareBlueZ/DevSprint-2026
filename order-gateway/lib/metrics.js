/**
 * Prometheus-compatible Metrics
 * Provides counters, histograms, and gauges for monitoring
 */
// eslint-disable-next-line no-unused-vars
const { logger } = require('./logger')

// ─── In-Memory Metrics Storage ─────────────────────────────────
const counters = new Map()
const histograms = new Map()
const gauges = new Map()

// ─── Latency Sliding Window (30 seconds) ───────────────────────
const LATENCY_WINDOW_MS = 30000
const latencyWindow = []

function recordLatency(latencyMs, labels = {}) {
  const now = Date.now()
  latencyWindow.push({ timestamp: now, latencyMs, labels })
  // Prune entries older than window
  while (latencyWindow.length > 0 && now - latencyWindow[0].timestamp > LATENCY_WINDOW_MS) {
    latencyWindow.shift()
  }
}

function getWindowedLatency() {
  const now = Date.now()
  const recent = latencyWindow.filter(e => now - e.timestamp <= LATENCY_WINDOW_MS)
  if (recent.length === 0) return 0
  return Math.round(recent.reduce((sum, e) => sum + e.latencyMs, 0) / recent.length)
}

// ─── Counter Operations ────────────────────────────────────────
function incCounter(name, labels = {}, value = 1) {
  const key = `${name}${JSON.stringify(labels)}`
  counters.set(key, (counters.get(key) || 0) + value)
}

function getCounter(name, labels = {}) {
  const key = `${name}${JSON.stringify(labels)}`
  return counters.get(key) || 0
}

// ─── Gauge Operations ──────────────────────────────────────────
function setGauge(name, value, labels = {}) {
  const key = `${name}${JSON.stringify(labels)}`
  gauges.set(key, value)
}

function getGauge(name, labels = {}) {
  const key = `${name}${JSON.stringify(labels)}`
  return gauges.get(key) || 0
}

// ─── Histogram Operations ──────────────────────────────────────
const HISTOGRAM_BUCKETS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]

function observeHistogram(name, value, labels = {}) {
  const key = `${name}${JSON.stringify(labels)}`
  if (!histograms.has(key)) {
    histograms.set(key, {
      sum: 0,
      count: 0,
      buckets: new Array(HISTOGRAM_BUCKETS.length + 1).fill(0),
    })
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

// ─── Prometheus Format Export ──────────────────────────────────
function toPrometheusFormat() {
  const lines = []

  // Counters
  for (const [key, value] of counters) {
    const match = key.match(/^([^{]+)(.*)$/)
    if (match) {
      const [, name, labelsJson] = match
      const labels = labelsJson ? JSON.parse(labelsJson) : {}
      const labelStr = Object.entries(labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',')
      lines.push(`# TYPE ${name} counter`)
      lines.push(`${name}${labelStr ? `{${labelStr}}` : ''} ${value}`)
    }
  }

  // Gauges
  for (const [key, value] of gauges) {
    const match = key.match(/^([^{]+)(.*)$/)
    if (match) {
      const [, name, labelsJson] = match
      const labels = labelsJson ? JSON.parse(labelsJson) : {}
      const labelStr = Object.entries(labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',')
      lines.push(`# TYPE ${name} gauge`)
      lines.push(`${name}${labelStr ? `{${labelStr}}` : ''} ${value}`)
    }
  }

  // Histograms
  for (const [key, h] of histograms) {
    const match = key.match(/^([^{]+)(.*)$/)
    if (match) {
      const [, name, labelsJson] = match
      const labels = labelsJson ? JSON.parse(labelsJson) : {}
      const labelStr = Object.entries(labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',')
      const baseLabels = labelStr ? `{${labelStr}}` : ''

      lines.push(`# TYPE ${name} histogram`)
      let cumulative = 0
      for (let i = 0; i < HISTOGRAM_BUCKETS.length; i++) {
        cumulative += h.buckets[i]
        const bucketLabels = labelStr
          ? `${labelStr},le="${HISTOGRAM_BUCKETS[i]}"`
          : `le="${HISTOGRAM_BUCKETS[i]}"`
        lines.push(`${name}_bucket{${bucketLabels}} ${cumulative}`)
      }
      cumulative += h.buckets[HISTOGRAM_BUCKETS.length]
      const infLabels = labelStr ? `${labelStr},le="+Inf"` : `le="+Inf"`
      lines.push(`${name}_bucket{${infLabels}} ${cumulative}`)
      lines.push(`${name}_sum${baseLabels} ${h.sum}`)
      lines.push(`${name}_count${baseLabels} ${h.count}`)
    }
  }

  return lines.join('\n')
}

// ─── JSON Format Export (for internal /metrics endpoint) ───────
function toJSON() {
  const result = {
    counters: {},
    gauges: {},
    histograms: {},
    latency: {
      windowedAvgMs: getWindowedLatency(),
      windowSampleCount: latencyWindow.length,
      alert: getWindowedLatency() > 1000,
    },
  }

  for (const [key, value] of counters) {
    result.counters[key] = value
  }
  for (const [key, value] of gauges) {
    result.gauges[key] = value
  }
  for (const [key, h] of histograms) {
    result.histograms[key] = {
      sum: h.sum,
      count: h.count,
      avg: h.count > 0 ? h.sum / h.count : 0,
    }
  }

  return result
}

// ─── Pre-defined Metric Names ──────────────────────────────────
const METRICS = {
  HTTP_REQUESTS_TOTAL: 'http_requests_total',
  HTTP_REQUEST_DURATION_MS: 'http_request_duration_ms',
  ORDERS_TOTAL: 'orders_total',
  ORDERS_FAILED: 'orders_failed',
  WALLET_TOPUPS_TOTAL: 'wallet_topups_total',
  DB_QUERY_DURATION_MS: 'db_query_duration_ms',
  ACTIVE_CONNECTIONS: 'active_connections',
}

module.exports = {
  incCounter,
  getCounter,
  setGauge,
  getGauge,
  observeHistogram,
  recordLatency,
  getWindowedLatency,
  toPrometheusFormat,
  toJSON,
  METRICS,
}
