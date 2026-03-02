import React, { useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { parseStudentId } from '../utils/studentIdParser'
import styles from './AccountPage.module.css'

export default function AccountPage() {
  const { user, logout, avatar, updateAvatar } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef(null)
  const studentId = user?.studentId || user?.email?.split('@')[0] || '—'
  
  // Parse student ID to extract year and department
  const studentInfo = parseStudentId(studentId)
  const department = studentInfo.valid ? studentInfo.department : user?.department || 'CSE'
  const year = studentInfo.valid ? studentInfo.yearLabel : user?.year ? `Year ${user.year}` : '—'

  function handleLogout() {
    logout()
    navigate('/login')
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => updateAvatar(reader.result)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function handleRemovePhoto() {
    updateAvatar(null)
  }

  const details = [
    { label: 'Full Name',   value: user?.name || '—',       icon: '👤' },
    { label: 'Email',       value: user?.email || '—',      icon: '📧' },
    { label: 'Student ID',  value: studentId,               icon: '🪪' },
    { label: 'Department',  value: department,              icon: '🏛️' },
    { label: 'Year',        value: year,                    icon: '📅' },
  ]

  return (
    <div className={styles.page}>
      {/* Profile hero */}
      <div className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.avatarWrap}>
          <div className={styles.avatar}>
            {avatar
              ? <img src={avatar} alt="Profile" className={styles.avatarImg} />
              : (user?.name ? user.name.charAt(0).toUpperCase() : 'S')
            }
          </div>
          <div className={styles.avatarRing} />
          <button className={styles.avatarEditBtn} onClick={() => fileRef.current?.click()} title="Change photo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className={styles.hiddenInput} onChange={handlePhotoChange} />
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
        {avatar && (
          <button className={styles.removePhotoBtn} onClick={handleRemovePhoto}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            Remove Photo
          </button>
        )}
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