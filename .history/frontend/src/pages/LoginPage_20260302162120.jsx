import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const [userType, setUserType] = useState('student') // 'student' or 'teacher'
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const { login } = useAuth()
  const navigate  = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (userType === 'student') {
        await login(email, password)
        navigate('/apps')
      } else {
        // Teacher/Admin login
        const res = await axios.post('/api/auth/admin/login', 
          { username: email, password },
          { withCredentials: true }
        )
        const { admin } = res.data
        sessionStorage.setItem('admin_user', JSON.stringify(admin))
        navigate('/admin/dashboard')
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrapper}>
        {/* Left panel - decorative */}
        <div className={styles.left}>
          <img 
            src="https://cdn-icons-png.flaticon.com/512/3976/3976625.png" 
            alt="Books and backpack" 
            className={styles.leftImage}
          />
        </div>

        {/* Right panel — login card */}
        <div className={styles.right}>
          {/* User type toggle */}
          <div className={styles.toggleWrap}>
            <button 
              className={`${styles.toggleBtn} ${userType === 'student' ? styles.toggleActive : ''}`}
              onClick={() => { setUserType('student'); setError(''); setEmail(''); setPassword('') }}
              type="button"
            >
              Student
            </button>
            <button 
              className={`${styles.toggleBtn} ${userType === 'teacher' ? styles.toggleActive : ''}`}
              onClick={() => { setUserType('teacher'); setError(''); setEmail(''); setPassword('') }}
              type="button"
            >
              Teacher
            </button>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>LOG IN</h2>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Email Address</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder={userType === 'student' ? 'jondoe32@gmail.com' : 'admin username'}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required autoFocus autoComplete="username"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Password</label>
                <div className={styles.inputWrap}>
                  <input
                    className={styles.input}
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required autoComplete="current-password"
                  />
                  <button type="button" className={styles.showPass} onClick={() => setShowPass(s => !s)}>
                    {showPass ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <a href="#" className={styles.forgotLink}>Forgot Password?</a>

              {error && (
                <div className={styles.errorBox}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </div>
              )}

              <button className={styles.btn} type="submit" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Log in'}
              </button>
            </form>

            {userType === 'student' && (
              <p className={styles.registerLink}>
                New student? <Link to="/register">Create an account</Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}