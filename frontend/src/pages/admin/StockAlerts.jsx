import React, { useState, useEffect } from 'react'
import axios from 'axios'
import styles from './AdminPages.module.css'

export default function StockAlerts() {
  const [stock, setStock] = useState([])
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('alerts') // 'alerts' or 'all'
  const [editingItem, setEditingItem] = useState(null)
  const [editValues, setEditValues] = useState({ quantity: 0, threshold: 10 })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const [stockRes, alertsRes] = await Promise.all([
        axios.get('/admin/stock/admin/stock'),
        axios.get('/admin/stock/admin/stock/alerts'),
      ])
      setStock(stockRes.data.items || [])
      setAlerts(alertsRes.data.alerts || [])
    } catch (err) {
      console.error('Failed to fetch stock data:', err)
    } finally {
      setLoading(false)
    }
  }

  function startEdit(item) {
    setEditingItem(item.item_id)
    setEditValues({ quantity: item.quantity, threshold: item.threshold || 10 })
  }

  async function saveEdit(itemId) {
    try {
      await axios.put(`/admin/gateway/admin/stock/${itemId}`, editValues)
      // Refresh data
      await fetchData()
      setEditingItem(null)
    } catch (err) {
      alert('Failed to update stock')
    }
  }

  function cancelEdit() {
    setEditingItem(null)
    setEditValues({ quantity: 0, threshold: 10 })
  }

  const displayItems = viewMode === 'alerts' ? alerts : stock

  if (loading) return <div className={styles.loading}>Loading stock data...</div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>📦 Stock Alerts</h1>
          <p className={styles.subtitle}>Monitor inventory levels and manage stock</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className={styles.refreshBtn} onClick={fetchData}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Alert Summary */}
      <div className={styles.alertSummary}>
        <div
          className={`${styles.alertCard} ${alerts.length > 0 ? styles.alertDanger : styles.alertSuccess}`}
        >
          <span className={styles.alertIcon}>{alerts.length > 0 ? '⚠️' : '✅'}</span>
          <div>
            <strong>{alerts.length}</strong> items below threshold
          </div>
        </div>
        <div className={styles.alertCard}>
          <span className={styles.alertIcon}>📊</span>
          <div>
            <strong>{stock.length}</strong> total items in inventory
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className={styles.viewToggle}>
        <button
          className={`${styles.toggleBtn} ${viewMode === 'alerts' ? styles.active : ''}`}
          onClick={() => setViewMode('alerts')}
        >
          🚨 Low Stock Alerts ({alerts.length})
        </button>
        <button
          className={`${styles.toggleBtn} ${viewMode === 'all' ? styles.active : ''}`}
          onClick={() => setViewMode('all')}
        >
          📋 All Stock
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Item</th>
              <th>Category</th>
              <th>Current Stock</th>
              <th>Threshold</th>
              <th>Status</th>
              <th>Last Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayItems.map(item => (
              <tr key={item.item_id} className={item.low_stock ? styles.lowStockRow : ''}>
                <td>
                  <strong>{item.name}</strong>
                </td>
                <td>{item.category}</td>
                <td>
                  {editingItem === item.item_id ? (
                    <input
                      type="number"
                      min="0"
                      value={editValues.quantity}
                      onChange={e =>
                        setEditValues({ ...editValues, quantity: parseInt(e.target.value) || 0 })
                      }
                      className={styles.inlineInput}
                    />
                  ) : (
                    <span className={item.low_stock ? styles.textDanger : ''}>{item.quantity}</span>
                  )}
                </td>
                <td>
                  {editingItem === item.item_id ? (
                    <input
                      type="number"
                      min="1"
                      value={editValues.threshold}
                      onChange={e =>
                        setEditValues({ ...editValues, threshold: parseInt(e.target.value) || 10 })
                      }
                      className={styles.inlineInput}
                    />
                  ) : (
                    item.threshold || 10
                  )}
                </td>
                <td>
                  {item.low_stock ? (
                    <span className={`${styles.badge} ${styles.badgeDanger}`}>⚠️ Low Stock</span>
                  ) : (
                    <span className={`${styles.badge} ${styles.badgeSuccess}`}>✓ OK</span>
                  )}
                </td>
                <td>{item.last_updated ? new Date(item.last_updated).toLocaleString() : '-'}</td>
                <td className={styles.actions}>
                  {editingItem === item.item_id ? (
                    <>
                      <button className={styles.btnSuccess} onClick={() => saveEdit(item.item_id)}>
                        Save
                      </button>
                      <button className={styles.btnSecondary} onClick={cancelEdit}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button className={styles.btnEdit} onClick={() => startEdit(item)}>
                      ✏️ Update
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {displayItems.length === 0 && (
              <tr>
                <td colSpan="7" className={styles.empty}>
                  {viewMode === 'alerts' ? '✅ No low stock alerts!' : 'No inventory items found'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Info Panel */}
      <div className={styles.infoPanel}>
        <h4>ℹ️ About Stock Alerts</h4>
        <p>
          Items are flagged as "Low Stock" when their quantity drops below the threshold (default:
          10).
        </p>
        <p>Click "Update" to modify stock quantity and threshold for any item.</p>
      </div>
    </div>
  )
}
