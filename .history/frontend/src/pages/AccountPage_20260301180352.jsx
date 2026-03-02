import React from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import styles from './AccountPage.module.css'

export default function AccountPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const studentId = user?.studentId || user?.email?.split('@')[0] || '—'

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const details = [
    { label: 'Full Name',   value: user?.name || '—',       icon: '👤' },
    { label: 'Email',       value: user?.email || '—',      icon: '📧' },
    { label: 'Student ID',  value: studentId,               icon: '🪪' },
    { label: 'Department',  value: user?.department || 'CSE', icon: '🏛️' },
    { label: 'Year',        value: user?.year ? `Year ${user.year}` : '—', icon: '📅' },
  ]

  return (
    <div className={styles.page}>
      {/* Profile hero */}
      <div className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.avatarWrap}>
          <div className={styles.avatar}>
            {user?.name ? user.name.charAt(0).toUpperCase() : 'S'}
          </div>
          <div className={styles.avatarRing} />
        </div>
        <div className={styles.heroText}>
          <h1 className={styles.heroName}>{user?.name || 'Student'}</h1>
          <p className={styles.heroEmail}>{user?.email || '—'}</p>
          <div className={styles.heroBadge}>
            <span>{user?.department || 'CSE'}</span>
            <span className={styles.heroDot} />
            <span>Year {user?.year || '—'}</span>
            <span className={styles.heroDot} />
            <span>{studentId}</span>
          </div>
        </div>
      </div>

      {/* Details card */}
      <div className={styles.detailsCard}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Account Details</h2>
        </div>
        {details.map((d, i) => (
          <div key={i} className={styles.row}>
            <div className={styles.rowLeft}>
              <span className={styles.rowIcon}>{d.icon}</span>
              <span className={styles.rowLabel}>{d.label}</span>
            </div>
            <span className={styles.rowValue}>{d.value}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <button className={styles.logoutBtn} onClick={handleLogout}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  )
}