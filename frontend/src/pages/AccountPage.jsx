import React from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import styles from './AccountPage.module.css'

export default function AccountPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const studentId = user?.studentId || user?.email?.split('@')[0] || '—'

  return (
    <div className={styles.page}>
      {/* Profile card */}
      <div className={styles.profileCard}>
        <div className={styles.avatar}>
          {user?.name ? user.name.charAt(0).toUpperCase() : 'S'}
        </div>
        <div className={styles.profileInfo}>
          <h2 className={styles.profileName}>{user?.name || 'Student'}</h2>
          <span className={styles.profileEmail}>{user?.email || '—'}</span>
          <span className={styles.profileId}>Student ID: {studentId}</span>
        </div>
      </div>

      {/* Details */}
      <div className={styles.detailsCard}>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Full Name</span>
          <span className={styles.detailValue}>{user?.name || '—'}</span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Email</span>
          <span className={styles.detailValue}>{user?.email || '—'}</span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Student ID</span>
          <span className={styles.detailValue}>{studentId}</span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Department</span>
          <span className={styles.detailValue}>{user?.department || 'CSE'}</span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Year</span>
          <span className={styles.detailValue}>{user?.year || '—'}</span>
        </div>
      </div>

      <button className={styles.logoutBtn} onClick={handleLogout}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Sign Out
      </button>
    </div>
  )
}
