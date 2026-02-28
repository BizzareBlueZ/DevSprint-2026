import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email.includes('@iut-dhaka.edu') && !email.includes('@')) {
      setError('Please enter a valid IUT email address')
      return
    }
    setLoading(true)
    try {
      await login(email, password)
      navigate('/apps')
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid credentials. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      {/* Background grid pattern */}
      <div className={styles.bgPattern} />

      <div className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.logoWrap}>
            <IUTLogo />
          </div>
          <h1 className={styles.title}>My IUT</h1>
          <p className={styles.subtitle}>Sign in with your IUT account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Student Email</label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <input
                type="text"
                className={styles.input}
                placeholder="230042135@iut-dhaka.edu"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="username"
                autoFocus
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                type="password"
                className={styles.input}
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && (
            <div className={styles.errorBox}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Sign In'}
          </button>
        </form>

        {/* Footer note */}
        <p className={styles.footerNote}>
          Use your IUT student credentials to sign in.
          <br />
          Contact IT support if you're unable to login.
        </p>
      </div>

      {/* Bottom branding */}
      <div className={styles.bottomBrand}>
        <span>IUT Computer Society</span>
        <span className={styles.dot}>·</span>
        <span>DevSprint 2026</span>
      </div>
    </div>
  )
}

function IUTLogo() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
      <rect width="52" height="52" rx="12" fill="#3ea99f" />
      <text x="26" y="35" textAnchor="middle" fill="white" fontSize="20" fontWeight="700" fontFamily="DM Sans, sans-serif">IUT</text>
    </svg>
  )
}
