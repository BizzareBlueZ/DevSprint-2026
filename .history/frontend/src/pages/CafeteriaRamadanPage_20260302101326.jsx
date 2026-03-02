import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import { format, addDays, isSameDay, parseISO, startOfWeek } from 'date-fns'
import styles from './CafeteriaRamadanPage.module.css'

const MEAL_TYPES = [
  { key: 'dinner', label: 'Dinner', color: '#2ecc71' },
  { key: 'iftar', label: 'Iftar', color: '#f0a500' },
]

const IFTAR_MENU = [
  { id: 1, name: 'Iftar Platter', emoji: '🍱', desc: 'Dates, samosa, jilapi & juice', price: 80, stock: 24 },
  { id: 2, name: 'Beef Biryani', emoji: '🍛', desc: 'Aromatic basmati with beef', price: 120, stock: 8 },
  { id: 3, name: 'Chicken Roast', emoji: '🍗', desc: 'Half roast with naan bread', price: 110, stock: 15 },
  { id: 4, name: 'Special Haleem', emoji: '🥘', desc: 'Slow-cooked lentil & meat', price: 90, stock: 0 },
  { id: 5, name: 'Fruit Chaat', emoji: '🥗', desc: 'Seasonal fruit mix', price: 45, stock: 40 },
  { id: 6, name: 'Mango Lassi', emoji: '🥤', desc: 'Chilled mango smoothie', price: 55, stock: 32 },
]

const DINNER_MENU = [
  { id: 7, name: 'Rice & Curry', emoji: '🍚', desc: 'Spiced rice with chicken curry', price: 70, stock: 30 },
  { id: 8, name: 'Noodle Stir Fry', emoji: '🍝', desc: 'Egg noodles with vegetables', price: 65, stock: 25 },
  { id: 9, name: 'Fish Fillet', emoji: '🐟', desc: 'Crispy fried fish with rice', price: 85, stock: 18 },
  { id: 10, name: 'Veggie Platter', emoji: '🥦', desc: 'Mixed vegetables & paneer', price: 60, stock: 35 },
]

const IFTAR_TOKEN_PRICE = 100
const DINNER_TOKEN_PRICE = 75

export default function CafeteriaRamadanPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [selectedItem, setSelectedItem] = useState(null)
  const [ordering, setOrdering] = useState(false)
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 47, seconds: 12 })
  const [ordersOpen, setOrdersOpen] = useState(true)
  const [systemStatus, setSystemStatus] = useState({ cache: 'WARM', auth: 'OK' })

  // Advance booking state
  const [activeMealType, setActiveMealType] = useState('iftar') // 'dinner' | 'iftar'
  const [selectedDates, setSelectedDates] = useState([]) // dates selected for current meal type
  const [bookedTokens, setBookedTokens] = useState([]) // all booked tokens (dinner & iftar mixed)
  const [balance, setBalance] = useState(0)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingMessage, setBookingMessage] = useState(null)

  const studentName = user?.name || user?.email?.split('@')[0] || 'Student'
  const IFTAR_TIME_MINUTES = 47 * 60 + 12 // Total seconds until Iftar (47:12)
  const CLOSE_ORDERS_MINUTES = 10 * 60 // Close 10 minutes before Iftar

  // Fetch tokens and balance on mount
  useEffect(() => {
    fetchBookingData()
  }, [])

  async function fetchBookingData() {
    try {
      const [tokensRes, balanceRes] = await Promise.allSettled([
        axios.get('/api/cafeteria/tokens'),
        axios.get('/api/wallet/balance'),
      ])
      if (tokensRes.status === 'fulfilled') setBookedTokens(tokensRes.value.data.tokens ?? [])
      if (balanceRes.status === 'fulfilled') setBalance(balanceRes.value.data.balance ?? 0)
    } catch {}
  }

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

        // Calculate total remaining seconds
        const totalSeconds = hours * 3600 + minutes * 60 + seconds
        // Close orders when <= 10 minutes remain
        if (totalSeconds <= CLOSE_ORDERS_MINUTES) {
          setOrdersOpen(false)
        }

        return { hours, minutes, seconds }
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  function selectItem(item) {
    if (item.stock === 0 || !ordersOpen) return
    setSelectedItem(item)
  }

  async function placeOrder() {
    if (!selectedItem || ordering || !ordersOpen) return
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

  // Build 2-week advance booking calendar (tomorrow through 14 days out)
  const today = new Date()
  const calendarDays = []
  for (let i = 1; i <= 14; i++) {
    calendarDays.push(addDays(today, i))
  }

  // Build week rows for calendar grid
  const calendarWeeks = []
  const firstDay = calendarDays[0]
  const weekStart = startOfWeek(firstDay, { weekStartsOn: 0 })
  // Build rows from the Sunday of the first day's week
  let current = weekStart
  const lastDay = calendarDays[calendarDays.length - 1]
  while (current <= lastDay || current.getDay() !== 0) {
    const week = []
    for (let d = 0; d < 7; d++) {
      week.push(new Date(current))
      current = addDays(current, 1)
    }
    calendarWeeks.push(week)
  }

  function isDateInRange(date) {
    return calendarDays.some(d => isSameDay(d, date))
  }

  function isDateBookedForMeal(date, mealType) {
    return bookedTokens.some(t => t.type === mealType && isSameDay(parseISO(t.date), date))
  }

  function isDateSelected(date) {
    return selectedDates.some(d => isSameDay(d, date))
  }

  function toggleDate(date) {
    if (!isDateInRange(date) || isDateBookedForMeal(date, activeMealType)) return
    setSelectedDates(prev => {
      const exists = prev.some(d => isSameDay(d, date))
      if (exists) return prev.filter(d => !isSameDay(d, date))
      return [...prev, date]
    })
    setBookingMessage(null)
  }

  async function bookAdvance() {
    if (selectedDates.length === 0 || bookingLoading) return
    setBookingLoading(true)
    setBookingMessage(null)
    try {
      const tokens = selectedDates.map(d => ({
        type: activeMealType,
        date: format(d, 'yyyy-MM-dd'),
      }))
      const res = await axios.post('/api/cafeteria/tokens/bulk', { tokens })
      setBookingMessage({ type: 'success', text: res.data.message })
      setSelectedDates([])
      await fetchBookingData()
    } catch (err) {
      const msg = err.response?.data?.message || 'Booking failed. Please try again.'
      setBookingMessage({ type: 'error', text: msg })
    } finally {
      setBookingLoading(false)
    }
  }

  const tokenPrice = activeMealType === 'dinner' ? DINNER_TOKEN_PRICE : IFTAR_TOKEN_PRICE
  const totalBookingCost = selectedDates.length * tokenPrice

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

      {/* Orders Closed Alert */}
      {!ordersOpen && (
        <div className={styles.alertBanner}>
          <div className={styles.alertIcon}>🚫</div>
          <div>
            <strong>Iftar Orders Closed</strong>
            <p>Orders are no longer being accepted. Check back next time!</p>
          </div>
        </div>
      )}

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
          disabled={!selectedItem || ordering || !ordersOpen}
        >
          {!ordersOpen ? 'Orders Closed' : ordering ? 'Placing Order...' : 'Place Order'}
        </button>
      </div>

      {/* Advance Booking Section */}
      <div className={styles.advanceSection}>
        <div className={styles.advanceTitleRow}>
          <div>
            <div className={styles.advanceTitle}>Book Meals in Advance</div>
            <div className={styles.advanceSubtitle}>
              Select upcoming dates to pre-book your meals
            </div>
          </div>
          <div className={styles.walletBadge}>
            Balance: ৳{Number(balance).toFixed(0)}
          </div>
        </div>

        {/* Meal Type Tabs */}
        <div className={styles.mealTypeTabs}>
          {MEAL_TYPES.map(mt => (
            <button
              key={mt.key}
              className={`${styles.mealTab} ${activeMealType === mt.key ? styles.mealTabActive : ''}`}
              onClick={() => {
                setActiveMealType(mt.key)
                setSelectedDates([])
                setBookingMessage(null)
              }}
              style={activeMealType === mt.key ? { borderBottomColor: mt.color } : {}}
            >
              {mt.label} · ৳{mt.key === 'dinner' ? DINNER_TOKEN_PRICE : IFTAR_TOKEN_PRICE}/day
            </button>
          ))}
        </div>

        {/* Booked tokens display */}
        {bookedTokens.length > 0 && (
          <div className={styles.bookedTokensContainer}>
            {MEAL_TYPES.map(mt => {
              const booked = bookedTokens.filter(t => t.type === mt.key)
              return booked.length > 0 ? (
                <div key={mt.key} className={styles.bookedTokensRow}>
                  <span className={styles.bookedLabel}>{mt.label} booked:</span>
                  {booked.map((t, i) => (
                    <span key={i} className={styles.bookedChip}>
                      {format(parseISO(t.date), 'MMM d')}
                    </span>
                  ))}
                </div>
              ) : null
            })}
          </div>
        )}

        {/* Calendar Grid */}
        <div className={styles.calendarGrid}>
          <div className={styles.calendarHeader}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className={styles.calDayLabel}>{d}</div>
            ))}
          </div>
          {calendarWeeks.map((week, wi) => (
            <div key={wi} className={styles.calendarRow}>
              {week.map((day, di) => {
                const inRange = isDateInRange(day)
                const bookedDinner = isDateBookedForMeal(day, 'dinner')
                const bookedIftar = isDateBookedForMeal(day, 'iftar')
                const selected = isDateSelected(day)
                const isToday = isSameDay(day, today)
                const isBookedForActiveMeal = activeMealType === 'dinner' ? bookedDinner : bookedIftar

                return (
                  <div
                    key={di}
                    className={[
                      styles.calDay,
                      !inRange && !isToday ? styles.calDayDisabled : '',
                      isToday ? styles.calDayToday : '',
                      bookedDinner || bookedIftar ? styles.calDayHasBooking : '',
                      selected ? styles.calDaySelected : '',
                      inRange && !isBookedForActiveMeal ? styles.calDaySelectable : '',
                    ].join(' ')}
                    onClick={() => toggleDate(day)}
                  >
                    <span className={styles.calDayNum}>{day.getDate()}</span>
                    <span className={styles.calDayMonth}>{format(day, 'MMM')}</span>
                    {(bookedDinner || bookedIftar) && (
                      <span className={styles.calDayBookingBadge}>
                        {bookedDinner && bookedIftar ? 'D·I' : bookedDinner ? 'D' : 'I'}
                      </span>
                    )}
                    {selected && <span className={styles.calDayCheck}>✓</span>}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Booking Summary & Action */}
        {selectedDates.length > 0 && (
          <div className={styles.bookingSummary}>
            <div className={styles.bookingDetails}>
              <span>{selectedDates.length} day{selectedDates.length > 1 ? 's' : ''} selected for {activeMealType === 'dinner' ? 'Dinner' : 'Iftar'}</span>
              <span className={styles.bookingCost}>Total: ৳{totalBookingCost}</span>
            </div>
            <button
              className={styles.bookBtn}
              onClick={bookAdvance}
              disabled={bookingLoading || totalBookingCost > balance}
            >
              {bookingLoading ? 'Booking...' : totalBookingCost > balance ? 'Insufficient Balance' : 'Confirm Booking'}
            </button>
          </div>
        )}

        {/* Booking message */}
        {bookingMessage && (
          <div className={bookingMessage.type === 'success' ? styles.bookingSuccess : styles.bookingError}>
            {bookingMessage.text}
          </div>
        )}
      </div>
    </div>
  )
}
