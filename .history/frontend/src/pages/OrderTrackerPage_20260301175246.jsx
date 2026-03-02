import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import axios from 'axios'
import styles from './OrderTrackerPage.module.css'

const STATUS_STEPS = [
  { key: 'PENDING',        label: 'Order Received',  desc: 'Your order has been placed',    icon: <ClockIcon /> },
  { key: 'STOCK_VERIFIED', label: 'Stock Verified',  desc: 'Ingredients confirmed',          icon: <CheckCircleIcon /> },
  { key: 'IN_KITCHEN',     label: 'In Kitchen',      desc: 'Being prepared for you',         icon: <FireIcon /> },
  { key: 'READY',          label: 'Ready!',           desc: 'Your meal is ready for pickup',  icon: <StarIcon /> },
]

const STATUS_ORDER = ['PENDING', 'STOCK_VERIFIED', 'IN_KITCHEN', 'READY']

export default function OrderTrackerPage() {
  const { orderId } = useParams()
  const navigate    = useNavigate()
  const [status,    setStatus]    = useState('PENDING')
  const [orderInfo, setOrderInfo] = useState(null)
  const [failReason, setFailReason] = useState('')
  const [connected, setConnected] = useState(false)
  const [source,    setSource]    = useState('polling')
  const socketRef = useRef(null)
  const pollRef   = useRef(null)
  const token = sessionStorage.getItem('iut_token')

  function advanceStatus(newStatus) {
    setStatus(prev => {
      const prevIdx = STATUS_ORDER.indexOf(prev)
      const newIdx  = STATUS_ORDER.indexOf(newStatus)
      return newIdx > prevIdx ? newStatus : prev
    })
  }

  function startPolling() {
    if (pollRef.current) return
    pollRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`/api/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = res.data
        advanceStatus(data.status)
        setOrderInfo({ itemName: data.item_name, amount: data.amount })
        if (data.status === 'READY' || data.status === 'FAILED') {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
      } catch {}
    }, 3000)
  }

  useEffect(() => {
    // Fetch initial status
    axios.get(`/api/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      advanceStatus(res.data.status)
      setOrderInfo({ itemName: res.data.item_name, amount: res.data.amount })
      if (res.data.status === 'FAILED') {
        setFailReason(res.data.fail_reason || 'Out of stock or payment issue.')
      }
    }).catch(() => {})

    startPolling()

    // Socket.IO — connect through nginx proxy (no hardcoded port)
    const socketUrl = window.location.hostname === 'localhost' && window.location.port !== '80' && window.location.port !== ''
        ? `http://localhost:3004`   // dev mode (npm run dev on :5173)
        : window.location.origin    // Docker mode (nginx proxies /socket.io/)

    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      timeout: 5000,
      path: '/socket.io',
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      setSource('socket')
      socket.emit('join-order', { orderId })
    })

    socket.on('disconnect', () => {
      setConnected(false)
      setSource('polling')
    })

    socket.on('connect_error', () => {
      setConnected(false)
      setSource('polling')
    })

    socket.on('order-status', (data) => {
      if (data.orderId === orderId || !data.orderId) {
        advanceStatus(data.status)
        if (data.orderInfo) setOrderInfo(prev => ({ ...prev, ...data.orderInfo }))
        if (data.status === 'FAILED') {
          setFailReason(data.reason || 'Out of stock. Your wallet has been refunded.')
          clearInterval(pollRef.current)
          pollRef.current = null
        }
        if (data.status === 'READY') {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
      }
    })

    return () => {
      socket.disconnect()
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [orderId])

  const currentStepIndex = STATUS_ORDER.indexOf(status)
  const isComplete = status === 'READY'
  const isFailed   = status === 'FAILED'
  const progress   = isFailed ? 0 : Math.max(0, (currentStepIndex / (STATUS_STEPS.length - 1)) * 100)

  return (
      <div className={styles.page}>

        {/* Live badge */}
        <div className={styles.connectionBadge}>
          <span className={`${styles.dot} ${connected ? styles.dotGreen : styles.dotAmber}`} />
          <span>{connected ? 'Live Updates' : 'Polling every 3s'}</span>
        </div>

        {/* Order header */}
        <div className={styles.orderHeader}>
          <div className={styles.orderIdBadge}>
            Order #{orderId.slice(0, 8)}…
          </div>
          {orderInfo?.itemName && (
              <div className={styles.orderMeta}>
                🍽 {orderInfo.itemName}
                {orderInfo?.amount && <span className={styles.orderAmount}> · ৳{parseFloat(orderInfo.amount).toFixed(2)}</span>}
              </div>
          )}
        </div>

        {isFailed ? (
            <div className={styles.failedCard}>
              <div className={styles.failedIcon}>❌</div>
              <div className={styles.failedTitle}>Order Failed</div>
              <p className={styles.failedDesc}>
                {failReason || 'Something went wrong with your order.'}
              </p>
              <div className={styles.refundNotice}>
                💳 Your wallet balance has been automatically refunded.
              </div>
              <div className={styles.failedActions}>
                <button className={styles.retryBtn} onClick={() => navigate('/apps/cafeteria')}>
                  Try Again
                </button>
                <button className={styles.walletBtn} onClick={() => navigate('/apps/wallet')}>
                  Check Wallet
                </button>
              </div>
            </div>
        ) : (
            <div className={`${styles.trackerCard} ${isComplete ? styles.trackerComplete : ''}`}>

              {/* Progress bar */}
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
              </div>

              {/* Steps */}
              <div className={styles.steps}>
                {STATUS_STEPS.map((step, i) => {
                  const stepIdx   = STATUS_ORDER.indexOf(step.key)
                  const isDone    = stepIdx < currentStepIndex
                  const isCurrent = stepIdx === currentStepIndex
                  const isFuture  = stepIdx > currentStepIndex
                  return (
                      <div key={step.key} className={`
                  ${styles.step}
                  ${isDone    ? styles.stepDone    : ''}
                  ${isCurrent ? styles.stepCurrent : ''}
                  ${isFuture  ? styles.stepFuture  : ''}
                `}>
                        <div className={styles.stepIconWrap}>
                          {isDone ? <DoneIcon /> : step.icon}
                          {isCurrent && <div className={styles.pingRing} />}
                        </div>
                        <div className={styles.stepText}>
                          <span className={styles.stepLabel}>{step.label}</span>
                          <span className={styles.stepDesc}>{step.desc}</span>
                        </div>
                      </div>
                  )
                })}
              </div>

              {/* Status message */}
              <div className={styles.statusMessage}>
                {isComplete ? (
                    <div className={styles.readyMessage}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                      </svg>
                      Your meal is ready! Head to the counter 🎉
                    </div>
                ) : (
                    <div className={styles.waitingMessage}>
                      <span className={styles.spinnerSmall} />
                      {STATUS_STEPS.find(s => s.key === status)?.desc ?? 'Processing…'}
                    </div>
                )}
              </div>
            </div>
        )}

        {!isFailed && (
            <div className={styles.actions}>
              <button className={styles.backBtn} onClick={() => navigate('/apps/cafeteria')}>
                ← Back to Cafeteria
              </button>
            </div>
        )}
      </div>
  )
}

function DoneIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
}
function ClockIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
}
function CheckCircleIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
}
function FireIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22c5 0 9-4 9-9C21 7 12 2 12 2S3 7 3 13c0 5 4 9 9 9z"/></svg>
}
function StarIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
}