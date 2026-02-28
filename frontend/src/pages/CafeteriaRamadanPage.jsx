import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { format, addDays, startOfWeek, isSameDay, isAfter, isBefore } from 'date-fns'
import styles from './CafeteriaRamadanPage.module.css'

const MEAL_TYPES = [
  { key: 'dinner', label: 'Dinner', color: '#2ecc71', desc: 'Regular dinner token' },
  { key: 'iftar', label: 'Iftar', color: '#27ae60', desc: 'Special Iftar meal token' },
]

export default function CafeteriaRamadanPage() {
  const navigate = useNavigate()
  const [selectedDates, setSelectedDates] = useState({}) // date -> meal type
  const [viewWeek, setViewWeek] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [activeMealType, setActiveMealType] = useState('dinner')
  const [step, setStep] = useState('select') // 'select' | 'confirm'

  const today = new Date()

  // Build 5 weeks
  const weeks = buildWeeks(today)

  function toggleDate(date) {
    if (isBefore(date, today) && !isSameDay(date, today)) return
    const key = format(date, 'yyyy-MM-dd')
    setSelectedDates(prev => {
      const next = { ...prev }
      if (next[key] === activeMealType) {
        delete next[key]
      } else {
        next[key] = activeMealType
      }
      return next
    })
  }

  const selectedCount = Object.keys(selectedDates).length

  async function handleConfirm() {
    if (selectedCount === 0) return
    setConfirming(true)
    try {
      const tokens = Object.entries(selectedDates).map(([date, type]) => ({ date, type }))
      const res = await axios.post('/api/cafeteria/tokens/bulk', { tokens })
      const orderId = res.data.orderId
      navigate(`/order/${orderId}`)
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to place order. Please try again.')
    } finally {
      setConfirming(false)
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
