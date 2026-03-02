import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import axios from 'axios'
import styles from './CafeteriaPage.module.css'
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns'

export default function CafeteriaPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [balance, setBalance] = useState(0.00)
  const [tokens, setTokens] = useState([])
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [orderModal, setOrderModal] = useState(null) // 'dinner' | 'emergency'
  const [orderLoading, setOrderLoading] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(null)
  const [menu, setMenu] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [timeSlots, setTimeSlots] = useState([])
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null)
  const [showSchedule, setShowSchedule] = useState(false)

  const studentId = user?.studentId || user?.email?.split('@')[0] || '—'

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [balanceRes, tokensRes, purchasesRes, menuRes, slotsRes] = await Promise.allSettled([
        axios.get('/api/wallet/balance'),
        axios.get('/api/cafeteria/tokens'),
        axios.get('/api/cafeteria/purchases'),
        axios.get('/api/menu'),
        axios.get('/api/time-slots'),
      ])
      if (balanceRes.status === 'fulfilled') setBalance(balanceRes.value.data.balance ?? 0)
      if (tokensRes.status === 'fulfilled') setTokens(tokensRes.value.data.tokens ?? [])
      if (purchasesRes.status === 'fulfilled') setPurchases(purchasesRes.value.data.purchases ?? [])
      if (menuRes.status === 'fulfilled') setMenu(menuRes.value.data.items ?? [])
      if (slotsRes.status === 'fulfilled') setTimeSlots(slotsRes.value.data.slots ?? [])
    } catch {}
  }

  async function handleRefresh() {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  async function handleOrder(type) {
    if (!selectedItem) return
    setOrderLoading(true)
    try {
      const payload = { 
        itemId: selectedItem.id, 
        type,
        ...(selectedTimeSlot && { scheduledPickupTime: selectedTimeSlot.datetime })
      }
      const res = await axios.post('/api/orders', payload)
      const orderId = res.data.orderId
      setOrderModal(null)
      setSelectedItem(null)
      setSelectedTimeSlot(null)
      setShowSchedule(false)
      navigate(`/order/${orderId}`)
    } catch (err) {
      const msg = err.response?.data?.message || 'Order failed. Please try again.'
      alert(msg)
    } finally {
      setOrderLoading(false)
    }
  }

  // Build weekly calendar
  const today = new Date()
  const weeks = buildCalendarWeeks(today)

  return (
    <div className={styles.page}>
      {/* Balance card */}
      <div className={styles.balanceCard}>
        <div className={styles.balanceLeft}>
          <span className={styles.balanceAmount}>{balance.toFixed(2)}</span>
          <span className={styles.studentId}>{studentId}</span>
        </div>
        <button className={styles.refreshBtn} onClick={handleRefresh} disabled={refreshing}>
          <span>REFRESH</span>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ transform: refreshing ? 'rotate(360deg)' : 'none', transition: refreshing ? 'transform 0.6s linear' : 'none' }}
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>

      {/* Available tokens */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Available Tokens</h2>
        <div className={styles.tokensBox}>
          {tokens.length === 0 ? (
            <span className={styles.noTokens}>No tokens available</span>
          ) : (
            <div className={styles.tokenList}>
              {tokens.map((t, i) => (
                <div key={i} className={styles.tokenChip}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  <span>{t.type}</span>
                  <span className={styles.tokenDate}>{format(parseISO(t.date), 'MMM d')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Calendar */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Meals Purchased to Date ({purchases.length})</h2>
        <div className={styles.calendar}>
          <div className={styles.calHead}>
            <div className={styles.calWeekCol} />
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className={styles.calDayHeader}>{d}</div>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className={styles.calRow}>
              <div className={styles.calWeekCol}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3ea99f" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              {week.map((day, di) => {
                const isToday = isSameDay(day.date, today)
                const hasPurchase = purchases.some(p => isSameDay(parseISO(p.date), day.date))
                const isFuture = day.date > today

                return (
                  <div
                    key={di}
                    className={`${styles.calCell} ${isToday ? styles.calToday : ''} ${hasPurchase ? styles.calPurchased : ''}`}
                  >
                    <span className={styles.calDate}>{day.date.getDate()}</span>
                    <span className={styles.calMonth}>{day.isSameMonth ? '' : format(day.date, 'MMM').toUpperCase()}</span>

                    {/* Buy buttons for today/near future */}
                    {isToday && (
                      <div className={styles.calBtns}>
                        <button
                          className={`${styles.calBtn} ${styles.calBtnDinner}`}
                          onClick={() => setOrderModal('dinner')}
                        >
                          BUY DINNER
                        </button>
                        <button
                          className={`${styles.calBtn} ${styles.calBtnEmergency}`}
                          onClick={() => setOrderModal('emergency')}
                        >
                          BUY EMERGENCY COUPON
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </section>

      {/* Order modal */}
      {orderModal && (
        <div className={styles.modalOverlay} onClick={() => { setOrderModal(null); setSelectedItem(null) }}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>
              {orderModal === 'dinner' ? 'Buy Dinner' : 'Buy Emergency Coupon'}
            </h3>
            <p className={styles.modalDesc}>Select a menu item:</p>
            <div className={styles.menuList}>
              {menu.map(item => (
                <button
                  key={item.id}
                  className={`${styles.menuItem} ${selectedItem?.id === item.id ? styles.menuItemSelected : ''}`}
                  onClick={() => setSelectedItem(item)}
                >
                  <span className={styles.menuItemName}>{item.name}</span>
                  <span className={styles.menuItemPrice}>৳{parseFloat(item.price).toFixed(2)}</span>
                </button>
              ))}
            </div>
            <p className={styles.modalBalance}>
              Current Balance: <strong>৳{balance.toFixed(2)}</strong>
            </p>
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => { setOrderModal(null); setSelectedItem(null) }}>
                CANCEL
              </button>
              <button
                className={`${styles.modalConfirm} ${orderModal === 'emergency' ? styles.modalEmergency : ''}`}
                onClick={() => handleOrder(orderModal)}
                disabled={orderLoading || !selectedItem}
              >
                {orderLoading ? <span className="spinner" /> : 'CONFIRM'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function buildCalendarWeeks(today) {
  // Build 5 weeks of calendar showing current month
  const weeks = []
  // Start from the week containing 2 weeks before today
  let start = startOfWeek(addDays(today, -14), { weekStartsOn: 0 })

  for (let w = 0; w < 5; w++) {
    const week = []
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d)
      week.push({
        date,
        isSameMonth: date.getMonth() === today.getMonth(),
      })
    }
    weeks.push(week)
  }
  return weeks
}
