import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import axios from 'axios'
import { QRCodeSVG } from 'qrcode.react'
import styles from './OrderTrackerPage.module.css'

const STEPS = [
  { key: 'PENDING', label: 'Order Received', desc: 'Your order has been placed', icon: '📋' },
  {
    key: 'STOCK_VERIFIED',
    label: 'Stock Verified',
    desc: 'Ingredients confirmed in stock',
    icon: '✅',
  },
  { key: 'IN_KITCHEN', label: 'In Kitchen', desc: 'Being freshly prepared for you', icon: '👨‍🍳' },
  { key: 'READY', label: 'Ready for Pickup', desc: 'Head to the counter now!', icon: '🎉' },
]

export default function OrderTrackerPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('PENDING')
  const [orderInfo, setOrderInfo] = useState(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const [qrCode, setQrCode] = useState(null)

  const socketUrl = (import.meta.env.VITE_SOCKET_URL || window.location.origin).replace(/\/$/, '')
  const socketPath = import.meta.env.VITE_SOCKET_PATH || '/socket.io'

  useEffect(() => {
    // Fetch QR code
    axios
      .get(`/api/orders/${orderId}/qr`)
      .then(res => setQrCode(res.data.qrCode))
      .catch(() => {})

    const socket = io(socketUrl, { transports: ['websocket', 'polling'], path: socketPath })
    socket.on('connect', () => {
      setConnected(true)
      socket.emit('join-order', { orderId })
    })
    socket.on('disconnect', () => setConnected(false))
    socket.on('connect_error', () =>
      setError('Live updates unavailable — refresh to check status.')
    )
    socket.on('order-status', data => {
      if (data.orderId === orderId || !data.orderId) {
        setStatus(data.status)
        if (data.orderInfo) setOrderInfo(data.orderInfo)
      }
    })
    return () => socket.disconnect()
  }, [orderId])

  const currentIdx = STEPS.findIndex(s => s.key === status)
  const isReady = status === 'READY'
  const progress = Math.round((currentIdx / (STEPS.length - 1)) * 100)

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.orderBadge}>
          <span className={styles.orderHash}>#</span>
          <span className={styles.orderId}>{orderId?.slice(0, 8).toUpperCase()}</span>
        </div>
        {orderInfo?.itemName && <p className={styles.itemName}>{orderInfo.itemName}</p>}
        <div
          className={`${styles.liveBadge} ${connected ? styles.liveBadgeOn : styles.liveBadgeOff}`}
        >
          <span className={styles.liveDot} />
          {connected ? 'Live Updates' : 'Connecting…'}
        </div>
      </div>

      {error && (
        <div className={styles.errorBox}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {/* Tracker card */}
      <div className={`${styles.tracker} ${isReady ? styles.trackerReady : ''}`}>
        {/* Progress bar */}
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
        <div className={styles.progressLabel}>{progress}% complete</div>

        {/* Steps */}
        <div className={styles.steps}>
          {STEPS.map((step, i) => {
            const done = i < currentIdx
            const current = i === currentIdx
            const future = i > currentIdx

            return (
              <div
                key={step.key}
                className={`${styles.step} ${done ? styles.stepDone : ''} ${current ? styles.stepCurrent : ''} ${future ? styles.stepFuture : ''}`}
              >
                {/* Connector line */}
                {i > 0 && (
                  <div
                    className={`${styles.connector} ${i <= currentIdx ? styles.connectorFilled : ''}`}
                  />
                )}

                <div className={styles.stepRow}>
                  <div className={styles.stepIcon}>
                    {done ? (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <span>{step.icon}</span>
                    )}
                    {current && <div className={styles.pingRing} />}
                  </div>

                  <div className={styles.stepText}>
                    <span className={styles.stepLabel}>{step.label}</span>
                    <span className={styles.stepDesc}>{step.desc}</span>
                  </div>

                  {current && !isReady && <span className={styles.currentTag}>Now</span>}
                  {done && <span className={styles.doneTag}>Done</span>}
                </div>
              </div>
            )
          })}
        </div>

        {/* Status message */}
        {isReady ? (
          <div className={styles.readyBanner}>
            <span className={styles.readyEmoji}>🍽️</span>
            <div>
              <div className={styles.readyTitle}>Your meal is ready!</div>
              <div className={styles.readyDesc}>Please collect at the cafeteria counter</div>
            </div>
          </div>
        ) : (
          <div className={styles.waitingRow}>
            <span className="spinner spinner-teal" />
            <span className={styles.waitingText}>
              {STEPS[currentIdx]?.desc ?? 'Processing your order…'}
            </span>
          </div>
        )}

        {/* QR Code for Pickup */}
        {qrCode && (isReady || status === 'PICKED_UP') && (
          <div className={styles.qrSection}>
            <div className={styles.qrCode}>
              <div className={styles.qrCodeInner}>
                <QRCodeSVG
                  value={qrCode}
                  size={180}
                  level="H"
                  includeMargin={true}
                  bgColor="#ffffff"
                  fgColor="#1a1a2e"
                />
              </div>
            </div>
            <p className={styles.qrInstruction}>Show this QR code at the counter</p>
            <p className={styles.qrCodeText}>{qrCode}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <button className={styles.backBtn} onClick={() => navigate('/apps/cafeteria')}>
          ← Back to Cafeteria
        </button>
        {isReady && (
          <button className={styles.doneBtn} onClick={() => navigate('/apps')}>
            Done ✓
          </button>
        )}
      </div>
    </div>
  )
}
