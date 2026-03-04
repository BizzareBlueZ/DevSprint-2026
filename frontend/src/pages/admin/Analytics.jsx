import React, { useState, useEffect } from 'react'
import axios from 'axios'
import styles from './AdminPages.module.css'

export default function Analytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  async function fetchAnalytics() {
    try {
      const res = await axios.get('/admin/gateway/admin/analytics')
      setData(res.data)
    } catch (err) {
      console.error('Failed to fetch analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className={styles.loading}>Loading analytics...</div>
  if (!data) return <div className={styles.error}>Failed to load analytics</div>

  const { popularItems, peakTimes, dailyRevenue, totals } = data

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>📊 Analytics Dashboard</h1>
          <p className={styles.subtitle}>Popular items, peak times, and revenue reports</p>
        </div>
        <button className={styles.refreshBtn} onClick={fetchAnalytics}>
          ↻ Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>📋</div>
          <div className={styles.statValue}>{totals?.total_orders || 0}</div>
          <div className={styles.statLabel}>Total Orders</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>💰</div>
          <div className={styles.statValue}>
            ৳{parseFloat(totals?.total_revenue || 0).toFixed(0)}
          </div>
          <div className={styles.statLabel}>Total Revenue</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>✅</div>
          <div className={styles.statValue}>{totals?.completed_orders || 0}</div>
          <div className={styles.statLabel}>Completed</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>❌</div>
          <div className={styles.statValue}>{totals?.failed_orders || 0}</div>
          <div className={styles.statLabel}>Failed</div>
        </div>
      </div>

      <div className={styles.analyticsGrid}>
        {/* Popular Items */}
        <div className={styles.analyticsCard}>
          <h3>🏆 Top 10 Popular Items</h3>
          <div className={styles.listContainer}>
            {popularItems?.map((item, i) => (
              <div key={item.id} className={styles.listItem}>
                <span className={styles.rank}>#{i + 1}</span>
                <div className={styles.listItemInfo}>
                  <span className={styles.listItemName}>{item.name}</span>
                  <span className={styles.listItemMeta}>{item.category}</span>
                </div>
                <div className={styles.listItemStats}>
                  <span>{item.order_count} orders</span>
                  <span className={styles.revenue}>
                    ৳{parseFloat(item.total_revenue || 0).toFixed(0)}
                  </span>
                </div>
              </div>
            ))}
            {(!popularItems || popularItems.length === 0) && (
              <div className={styles.empty}>No order data yet</div>
            )}
          </div>
        </div>

        {/* Peak Times */}
        <div className={styles.analyticsCard}>
          <h3>⏰ Peak Order Times (Last 7 Days)</h3>
          <div className={styles.peakTimesChart}>
            {Array.from({ length: 24 }, (_, hour) => {
              const timeData = peakTimes?.find(t => parseInt(t.hour) === hour)
              const count = timeData ? parseInt(timeData.order_count) : 0
              const maxCount = Math.max(...(peakTimes?.map(t => parseInt(t.order_count)) || [1]))
              const height = maxCount > 0 ? (count / maxCount) * 100 : 0
              return (
                <div key={hour} className={styles.timeBar}>
                  <div
                    className={styles.bar}
                    style={{ height: `${Math.max(height, 2)}%` }}
                    title={`${hour}:00 - ${count} orders`}
                  />
                  <span className={styles.timeLabel}>{hour}</span>
                </div>
              )
            })}
          </div>
          <div className={styles.chartLegend}>Hours (0-23)</div>
        </div>

        {/* Daily Revenue */}
        <div className={styles.analyticsCard + ' ' + styles.fullWidth}>
          <h3>📈 Daily Revenue (Last 30 Days)</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Orders</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {dailyRevenue?.slice(0, 14).map(day => (
                  <tr key={day.date}>
                    <td>{new Date(day.date).toLocaleDateString()}</td>
                    <td>{day.order_count}</td>
                    <td className={styles.revenue}>৳{parseFloat(day.revenue).toFixed(2)}</td>
                  </tr>
                ))}
                {(!dailyRevenue || dailyRevenue.length === 0) && (
                  <tr>
                    <td colSpan="3" className={styles.empty}>
                      No revenue data yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
