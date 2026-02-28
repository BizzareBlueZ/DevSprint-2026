import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import styles from './OrderTrackerPage.module.css'

const STATUS_STEPS = [
  { key: 'PENDING', label: 'Order Received', desc: 'Your order has been placed', icon: <ClockIcon /> },
  { key: 'STOCK_VERIFIED', label: 'Stock Verified', desc: 'Ingredients confirmed', icon: <CheckCircleIcon /> },
  { key: 'IN_KITCHEN', label: 'In Kitchen', desc: 'Being prepared for you', icon: <FireIcon /> },
  { key: 'READY', label: 'Ready!', desc: 'Your meal is ready for pickup', icon: <StarIcon /> },
]

export default function OrderTrackerPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('PENDING')
  const [orderInfo, setOrderInfo] = useState(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Connect to Notification Hub
    const socket = io('http://localhost:3004', {
      transports: ['websocket', 'polling'],
    })

    socket.on('connect', () => {
      setConnected(true)
      socket.emit('join-order', { orderId })
    })

    socket.on('disconnect', () => {
      setConnected(false)
    })

    socket.on('order-status', (data) => {
      if (data.orderId === orderId || !data.orderId) {
        setStatus(data.status)
        if (data.orderInfo) setOrderInfo(data.orderInfo)
      }
    })

    socket.on('connect_error', () => {
      setError('Connection to notification service failed. Status updates may be delayed.')
    })

    return () => {
      socket.disconnect()
    }
  }, [orderId])

  const currentStepIndex = STATUS_STEPS.findIndex(s => s.key === status)
  const isComplete = status === 'READY'

  return (
    <div className={styles.page}>
      {/* Connection indicator */}
      <div className={styles.connectionBadge} style={{ '--dot-color': connected ? '#10b981' : '#f59e0b' }}>
        <span className={styles.dot} />
        <span>{connected ? 'Live Updates' : 'Connecting...'}</span>
      </div>

      {/* Order header */}
      <div className={styles.orderHeader}>
        <div className={styles.orderIdBadge}>Order #{orderId}</div>
        {orderInfo && (
          <div className={styles.orderMeta}>
            <span className={styles.orderItem}>{orderInfo.itemName}</span>
            <span className={styles.orderTime}>{orderInfo.time}</span>
          </div>
        )}
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {/* Status tracker */}
      <div className={`${styles.trackerCard} ${isComplete ? styles.trackerComplete : ''}`}>
        {/* Progress bar */}
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${(currentStepIndex / (STATUS_STEPS.length - 1)) * 100}%` }}
          />
        </div>

        {/* Steps */}
        <div className={styles.steps}>
          {STATUS_STEPS.map((step, i) => {
            const isDone = i < currentStepIndex
            const isCurrent = i === currentStepIndex
            const isFuture = i > currentStepIndex

            return (
              <div
                key={step.key}
                className={`${styles.step} ${isDone ? styles.stepDone : ''} ${isCurrent ? styles.stepCurrent : ''} ${isFuture ? styles.stepFuture : ''}`}
              >
                <div className={styles.stepIconWrap}>
                  {isDone ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    step.icon
                  )}
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

        {/* Current status message */}
        <div className={styles.statusMessage}>
          {isComplete ? (
            <div className={styles.readyMessage}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>Your meal is ready! Head to the counter.</span>
            </div>
          ) : (
            <div className={styles.waitingMessage}>
              <span className={styles.spinnerSmall} />
              <span>{STATUS_STEPS[currentStepIndex]?.desc ?? 'Processing...'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <button className={styles.backBtn} onClick={() => navigate('/apps/cafeteria')}>
          ← Back to Cafeteria
        </button>
      </div>
    </div>
  )
}

// Icons
function ClockIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
}
function CheckCircleIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
}
function FireIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22c5 0 9-4 9-9C21 7 12 2 12 2S3 7 3 13c0 5 4 9 9 9z" /></svg>
}
function StarIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
}
