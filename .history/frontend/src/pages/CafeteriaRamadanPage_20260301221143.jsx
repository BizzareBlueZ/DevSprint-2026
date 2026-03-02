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

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className={styles.subheading}>Select dates and meal type for advance booking</p>
        </div>
      </div>

      {/* Meal type selector */}
      <div className={styles.mealTypeTabs}>
        {MEAL_TYPES.map(mt => (
          <button
            key={mt.key}
            className={`${styles.mealTab} ${activeMealType === mt.key ? styles.mealTabActive : ''}`}
            style={activeMealType === mt.key ? { background: mt.color, borderColor: mt.color } : {}}
            onClick={() => setActiveMealType(mt.key)}
          >
            {mt.label}
          </button>
        ))}
        {selectedCount > 0 && (
          <span className={styles.selectedCount}>{selectedCount} date{selectedCount !== 1 ? 's' : ''} selected</span>
        )}
      </div>

      {/* Calendar */}
      <div className={styles.calendar}>
        <div className={styles.calHead}>
          <div className={styles.weekCheck} />
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className={styles.dayHeader}>{d}</div>
          ))}
        </div>

        {weeks.map((week, wi) => (
          <div key={wi} className={styles.calRow}>
            <div className={styles.weekCheck}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3ea99f" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            {week.map((day, di) => {
              const dateKey = format(day.date, 'yyyy-MM-dd')
              const isPast = isBefore(day.date, today) && !isSameDay(day.date, today)
              const selected = selectedDates[dateKey]
              const isToday = isSameDay(day.date, today)
              const selectedColor = selected
                ? MEAL_TYPES.find(m => m.key === selected)?.color
                : null

              return (
                <div
                  key={di}
                  className={`${styles.calCell} ${isToday ? styles.calToday : ''} ${isPast ? styles.calPast : ''} ${selected ? styles.calSelected : ''}`}
                  style={selected ? { background: selectedColor + '22', borderColor: selectedColor + '44' } : {}}
                  onClick={() => !isPast && toggleDate(day.date)}
                >
                  <span className={styles.calDate}>{day.date.getDate()}</span>
                  <span className={styles.calMonth}>
                    {day.date.getDate() === 1 ? format(day.date, 'MMM').toUpperCase() : ''}
                  </span>
                  {selected && (
                    <span
                      className={styles.selectedBadge}
                      style={{ background: selectedColor }}
                    >
                      {selected === 'dinner' ? 'D' : 'I'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Bottom action bar */}
      <div className={styles.actionBar}>
        <button className={styles.cancelBtn} onClick={() => setSelectedDates({})}>
          CANCEL
        </button>
        <button
          className={styles.confirmBtn}
          onClick={handleConfirm}
          disabled={selectedCount === 0 || confirming}
        >
          {confirming ? <span className="spinner" /> : `CONFIRM${selectedCount > 0 ? ` (${selectedCount})` : ''}`}
        </button>
      </div>
    </div>
  )
}

function buildWeeks(today) {
  const weeks = []
  let start = startOfWeek(addDays(today, -7), { weekStartsOn: 0 })
  for (let w = 0; w < 5; w++) {
    const week = []
    for (let d = 0; d < 7; d++) {
      week.push({ date: addDays(start, w * 7 + d) })
    }
    weeks.push(week)
  }
  return weeks
}
