import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import styles from './CafeteriaRamadanPage.module.css'

const IFTAR_MENU = [
  { id: 1, name: 'Iftar Platter', emoji: '🍱', desc: 'Dates, samosa, jilapi & juice', price: 80, stock: 24 },
  { id: 2, name: 'Beef Biryani', emoji: '🍛', desc: 'Aromatic basmati with beef', price: 120, stock: 8 },
  { id: 3, name: 'Chicken Roast', emoji: '🍗', desc: 'Half roast with naan bread', price: 110, stock: 15 },
  { id: 4, name: 'Special Haleem', emoji: '🥘', desc: 'Slow-cooked lentil & meat', price: 90, stock: 0 },
  { id: 5, name: 'Fruit Chaat', emoji: '🥗', desc: 'Seasonal fruit mix', price: 45, stock: 40 },
  { id: 6, name: 'Mango Lassi', emoji: '🥤', desc: 'Chilled mango smoothie', price: 55, stock: 32 },
]

export default function CafeteriaRamadanPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [selectedItem, setSelectedItem] = useState(null)
  const [ordering, setOrdering] = useState(false)
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 47, seconds: 12 })
  const [systemStatus, setSystemStatus] = useState({ cache: 'WARM', auth: 'OK' })

  const studentName = user?.name || user?.email?.split('@')[0] || 'Student'

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        let { hours, minutes, seconds } = prev
        if (seconds > 0) {
          seconds--
        } else if (minutes > 0) {
          minutes--
          seconds = 59
        } else if (hours > 0) {
          hours--
          minutes = 59
          seconds = 59
        } else {
          clearInterval(timer)
          return prev
        }
        return { hours, minutes, seconds }
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  function selectItem(item) {
    if (item.stock === 0) return
    setSelectedItem(item)
  }

  async function placeOrder() {
    if (!selectedItem || ordering) return
    setOrdering(true)
    try {
      const idempotencyKey = `iftar-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const res = await axios.post(
        '/api/orders',
        { itemId: selectedItem.id, type: 'iftar' },
        { headers: { 'X-Idempotency-Key': idempotencyKey } }
      )
      const orderId = res.data.orderId
      navigate(`/order/${orderId}`)
    } catch (err) {
      const msg = err.response?.data?.message || 'Order failed. Please try again.'
      alert(msg)
    } finally {
      setOrdering(false)
    }
  }

  const formatTime = (num) => String(num).padStart(2, '0')

  return (
    <div className={styles.page}>
      {/* Greeting */}
      <div className={styles.greeting}>
        <h2>Good Evening, {studentName} 👋</h2>
        <p>Iftar opens at 6:18 PM — order now to secure your meal.</p>
      </div>

      {/* Iftar Banner with Countdown */}
      <div className={styles.iftarBanner}>
        <div className={styles.bannerLeft}>
          <div className={styles.countdownLabel}>Iftar begins in</div>
          <div className={styles.countdownTime}>
            {formatTime(countdown.hours)}:{formatTime(countdown.minutes)}:{formatTime(countdown.seconds)}
          </div>
          <div className={styles.pickupLabel}>Pick-up at counter B</div>
        </div>
        <div className={styles.bannerRight}>
          <div className={styles.statusPill}>🟢 System Operational</div>
          <div className={styles.statusDetails}>
            Cache: {systemStatus.cache} · Auth: {systemStatus.auth}
          </div>
        </div>
      </div>

      {/* Menu Title */}
      <div className={styles.menuTitle}>Today's Iftar Menu</div>

      {/* Menu Grid */}
      <div className={styles.menuGrid}>
        {IFTAR_MENU.map(item => {
          const isSelected = selectedItem?.id === item.id
          const isOutOfStock = item.stock === 0
          const isLowStock = item.stock > 0 && item.stock <= 10

          return (
            <div
              key={item.id}
              className={`${styles.menuCard} ${isSelected ? styles.menuCardSelected : ''} ${isOutOfStock ? styles.menuCardOutOfStock : ''}`}
              onClick={() => selectItem(item)}
            >
              {isSelected && <div className={styles.selectedCheck}>✓</div>}
              <div className={styles.foodEmoji}>{item.emoji}</div>
              <div className={styles.foodName}>{item.name}</div>
              <div className={styles.foodDesc}>{item.desc}</div>
              <div className={styles.foodPrice}>৳{item.price}</div>
              <div className={`${styles.foodStock} ${isOutOfStock ? styles.stockZero : isLowStock ? styles.stockLow : styles.stockOk}`}>
                {isOutOfStock ? 'Out of stock' : isLowStock ? `⚠ Only ${item.stock} left` : `${item.stock} available`}
              </div>
            </div>
          )
        })}
      </div>

      {/* Order Bar */}
      <div className={styles.orderBar}>
        <div className={styles.orderInfo}>
          Selected: <span>{selectedItem ? `${selectedItem.name} — ৳${selectedItem.price}` : 'Nothing yet'}</span>
        </div>
        <button
          className={styles.orderBtn}
          onClick={placeOrder}
          disabled={!selectedItem || ordering}
        >
          {ordering ? 'Placing Order...' : 'Place Order'}
        </button>
      </div>
    </div>
  )
}
