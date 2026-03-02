import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useLanguage } from '../context/LanguageContext'
import styles from './RegisterPage.module.css'

export default function RegisterPage() {
  const [form, setForm]       = useState({ studentId: '', name: '', department: 'CSE', year: '1', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const navigate              = useNavigate()
  const { t } = useLanguage()

  const set = (k) => (e) => { setForm(f => ({ ...f, [k]: e.target.value })); setError('') }

  // Password validation rules
  const pwRules = [
    { test: form.password.length >= 6, label: t('passwordMinimum') },
    { test: /[a-zA-Z]/.test(form.password), label: t('passwordLetter') },
    { test: /[0-9]/.test(form.password), label: t('passwordDigit') },
    { test: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(form.password), label: t('passwordSpecial') },
  ]
  const pwValid = pwRules.every(r => r.test)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!pwValid) {
      setError('Password does not meet requirements.')
      return
    }
    setLoading(true)
    try {
      const email = `${form.studentId}@iut-dhaka.edu`
      await axios.post('/api/auth/register', { ...form, email, year: parseInt(form.year) })
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.blob1} />
      <div className={styles.blob2} />
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.logo}>IUT</div>
          <div>
            <h1 className={styles.title}>Create Account</h1>
            <p className={styles.sub}>Register with your IUT student ID</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Student ID</label>
            <input className={styles.input} placeholder="e.g. 230042135"
              value={form.studentId} onChange={set('studentId')} required autoFocus />
            <span className={styles.hint}>{form.studentId && `→ ${form.studentId}@iut-dhaka.edu`}</span>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Full Name</label>
            <input className={styles.input} placeholder="Your full name"
              value={form.name} onChange={set('name')} required />
          </div>
          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>Department</label>
              <select className={styles.input} value={form.department} onChange={set('department')}>
                {['CSE','EEE','ME','CE','MPE'].map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Year</label>
              <select className={styles.input} value={form.year} onChange={set('year')}>
                {[1,2,3,4].map(y => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <input className={styles.input} type="password" placeholder="Create a secure password"
              value={form.password} onChange={set('password')} required minLength={6} />
            {form.password && (
              <div className={styles.pwRules}>
                {pwRules.map((r, i) => (
                  <span key={i} className={r.test ? styles.pwRulePass : styles.pwRuleFail}>
                    {r.test ? '✓' : '✗'} {r.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          {error && (
            <div className={styles.errorBox}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}
          <button type="submit" className={styles.btn} disabled={loading}>
            {loading ? <span className="spinner" /> : <>Create Account <span className={styles.arrow}>→</span></>}
          </button>
        </form>
        <p className={styles.loginLink}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}