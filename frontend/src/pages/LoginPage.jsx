import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { sanitizeText } from '../utils/sanitization'
import { storeUserData, enableHttpOnlyCookies } from '../utils/tokenManager'
import styles from './LoginPage.module.css'

// Enable httpOnly cookie support
enableHttpOnlyCookies(axios)

export default function LoginPage() {
  const [userType, setUserType] = useState('student') // 'student' or 'admin'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const { t } = useLanguage()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (userType === 'student') {
        await login(sanitizeText(email, 254), password)
        navigate('/apps')
      } else {
        // Admin login
        const res = await axios.post(
          '/api/auth/admin/login',
          { username: sanitizeText(email, 100), password },
          { withCredentials: true }
        )
        const { admin } = res.data
        // Token is in httpOnly cookie; only store non-sensitive profile data
        storeUserData(admin, null)
        sessionStorage.setItem('admin_user', JSON.stringify(admin))
        navigate('/admin/dashboard')
      }
    } catch (err) {
      setError(err.response?.data?.message || t('invalidCredentials'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      {/* Decorative blobs */}
      <div className={styles.blob1} />
      <div className={styles.blob2} />
      <div className={styles.blob3} />

      <div className={styles.wrapper}>
        {/* Left panel */}
        <div className={styles.left}>
          <div className={styles.leftInner}>
            <div className={styles.moon}>🌙</div>
            <h1 className={styles.headline}>
              Campus
              <br />
              <em>Cafeteria</em>
            </h1>
            <p className={styles.tagline}>
              Order meals, track your wallet, and never wait in line again.
            </p>
            <div className={styles.features}>
              {[
                'Real-time order tracking',
                'Secure SmartCard wallet',
                'Ramadan advance booking',
              ].map((f, i) => (
                <div
                  key={i}
                  className={styles.feature}
                  style={{ animationDelay: `${0.3 + i * 0.1}s` }}
                >
                  <span className={styles.featureDot} />
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel — login card */}
        <div className={styles.right}>
          {/* User type toggle */}
          <div className={styles.toggleWrap}>
            <button
              className={`${styles.toggleBtn} ${userType === 'student' ? styles.toggleActive : ''}`}
              onClick={() => {
                setUserType('student')
                setError('')
                setEmail('')
                setPassword('')
              }}
              type="button"
            >
              Student
            </button>
            <button
              className={`${styles.toggleBtn} ${userType === 'admin' ? styles.toggleActive : ''}`}
              onClick={() => {
                setUserType('admin')
                setError('')
                setEmail('')
                setPassword('')
              }}
              type="button"
            >
              Admin
            </button>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.logo}>
                <span>IUT</span>
              </div>
              <div>
                <h2 className={styles.cardTitle}>
                  {userType === 'student' ? t('welcomeBack') : 'Admin Portal'}
                </h2>
                <p className={styles.cardSub}>
                  {userType === 'student' ? t('signIn') : 'Mission Control Access'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>
                  {userType === 'student' ? t('email') : 'Username'}
                </label>
                <div className={styles.inputWrap}>
                  <svg
                    className={styles.inputIcon}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder={
                      userType === 'student' ? '230042135@iut-dhaka.edu' : 'admin username'
                    }
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>{t('password')}</label>
                <div className={styles.inputWrap}>
                  <svg
                    className={styles.inputIcon}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input
                    className={styles.input}
                    type={showPass ? 'text' : 'password'}
                    placeholder={t('enterPassword')}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className={styles.showPass}
                    onClick={() => setShowPass(s => !s)}
                  >
                    {showPass ? '🙈' : '👁'}
                  </button>
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

              <button className={styles.btn} type="submit" disabled={loading}>
                {loading ? (
                  <span className="spinner" />
                ) : (
                  <>
                    {t('signIn')} <span className={styles.btnArrow}>→</span>
                  </>
                )}
              </button>
            </form>

            {userType === 'student' && (
              <p className={styles.registerLink}>
                New student? <Link to="/register">Create an account</Link>
              </p>
            )}
            {userType === 'admin' && (
              <p className={styles.registerLink}>
                <small>Contact your system administrator for access credentials.</small>
              </p>
            )}
          </div>

          <p className={styles.footer}>IUT Computer Society · 2026</p>
        </div>
      </div>
    </div>
  )
}
