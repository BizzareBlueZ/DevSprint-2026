import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './AppsPage.module.css'

const apps = [
  {
    id: 'cafeteria',
    path: '/apps/cafeteria',
    label: 'Cafeteria',
    description: 'Order meals & track history',
    gradient: 'linear-gradient(135deg, #2a9d8f 0%, #1a6b61 100%)',
    icon: (
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
        <line x1="6" y1="1" x2="6" y2="4" />
        <line x1="10" y1="1" x2="10" y2="4" />
        <line x1="14" y1="1" x2="14" y2="4" />
      </svg>
    ),
  },
  {
    id: 'cafeteria-ramadan',
    path: '/apps/cafeteria-ramadan',
    label: 'Cafeteria (Ramadan)',
    description: 'Book dinner & iftar in advance',
    gradient: 'linear-gradient(135deg, #1a3a5c 0%, #0f2340 100%)',
    icon: (
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
        <path d="M19 3v4" />
        <path d="M21 5h-4" />
      </svg>
    ),
  },
  {
    id: 'wallet',
    path: '/apps/wallet',
    label: 'SmartCard Wallet',
    description: 'Balance, top-up & transactions',
    gradient: 'linear-gradient(135deg, #b45309 0%, #78350f 100%)',
    icon: (
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
        <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
        <path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z" />
      </svg>
    ),
  },
]

export default function AppsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <p className={styles.greeting}>{greeting}</p>
          <h1 className={styles.heading}>
            {user?.name?.split(' ')[0] || 'Student'} <span className={styles.wave}>👋</span>
          </h1>
          <p className={styles.sub}>What would you like to do today?</p>
        </div>
      </div>

      {/* App grid */}
      <div className={styles.grid}>
        {apps.map((app, i) => (
          <button
            key={app.id}
            className={styles.card}
            onClick={() => navigate(app.path)}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className={styles.cardBg} style={{ background: app.gradient }} />
            <div className={styles.cardContent}>
              <div className={styles.iconWrap}>{app.icon}</div>
              <div className={styles.cardText}>
                <span className={styles.cardLabel}>{app.label}</span>
                <span className={styles.cardDesc}>{app.description}</span>
              </div>
              <div className={styles.arrow}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Quick stats strip */}
      <div className={styles.statsStrip}>
        <div className={styles.statItem}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 12 19.79 19.79 0 0 1 1.97 3.35 2 2 0 0 1 3.95 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          <span>Need help? Contact IT support</span>
        </div>
        <div className={styles.statDot} />
        <div className={styles.statItem}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>Cafeteria opens at 7:00 AM</span>
        </div>
      </div>
    </div>
  )
}
