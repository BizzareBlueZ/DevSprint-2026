import React from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './AppsPage.module.css'

const apps = [
  {
    id: 'cafeteria',
    path: '/apps/cafeteria',
    label: 'Cafeteria',
    description: 'Buy meal and check history',
    color: '#3ea99f',
    icon: <CafeteriaIcon />,
  },
  {
    id: 'cafeteria-ramadan',
    path: '/apps/cafeteria-ramadan',
    label: 'Cafeteria (Ramadan)',
    description: 'Buy dinner and iftar token in advance',
    color: '#1a3a5c',
    icon: <RamadanIcon />,
  },
  {
    id: 'wallet',
    path: '/apps/wallet',
    label: 'Wallet',
    description: 'Access SmartCard balance and transactions.',
    color: '#e6a817',
    icon: <WalletIcon />,
  },
]

export default function AppsPage() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Apps</h1>
      <div className={styles.list}>
        {apps.map((app, i) => (
          <button
            key={app.id}
            className={styles.appCard}
            onClick={() => navigate(app.path)}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className={styles.iconWrap} style={{ background: app.color }}>
              {app.icon}
            </div>
            <div className={styles.info}>
              <span className={styles.appName}>{app.label}</span>
              <span className={styles.appDesc}>{app.description}</span>
            </div>
            <svg className={styles.chevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}

function CafeteriaIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  )
}

function RamadanIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
      <path d="M19 3v4" />
      <path d="M21 5h-4" />
    </svg>
  )
}

function WalletIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
      <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
      <path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z" />
    </svg>
  )
}
