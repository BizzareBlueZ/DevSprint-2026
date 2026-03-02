import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import styles from './LoginPage.module.css' // reuse login styles

const DEPARTMENTS = ['CSE', 'EEE', 'ME', 'CEE', 'MPE', 'TVE']

export default function RegisterPage() {
    const navigate = useNavigate()
    const [form, setForm] = useState({
        studentId:  '',
        name:       '',
        department: 'CSE',
        year:       '1',
        password:   '',
        confirm:    '',
    })
    const [error,   setError]   = useState('')
    const [loading, setLoading] = useState(false)

    const set = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }))

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')

        if (form.password !== form.confirm) {
            return setError('Passwords do not match.')
        }
        if (form.password.length < 6) {
            return setError('Password must be at least 6 characters.')
        }
        if (!/^\d{9}$/.test(form.studentId)) {
            return setError('Student ID must be exactly 9 digits (e.g. 230042135).')
        }

        setLoading(true)
        try {
            await axios.post('/api/auth/register', {
                studentId:  form.studentId,
                email:      `${form.studentId}@iut-dhaka.edu`,
                password:   form.password,
                name:       form.name,
                department: form.department,
                year:       parseInt(form.year),
            })
            navigate('/login', { state: { registered: true, email: `${form.studentId}@iut-dhaka.edu` } })
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className={styles.page}>
            <div className={styles.bgLeft} />
            <div className={styles.bgRight} />
            <div className={styles.card} style={{ maxWidth: 420 }}>
                <div className={styles.logoWrap}>
                    <div className={styles.logo}>IUT</div>
                </div>
                <h1 className={styles.title}>Create Account</h1>
                <p className={styles.subtitle}>Register with your IUT student details</p>

                <form onSubmit={handleSubmit} className={styles.form}>
                    {/* Student ID */}
                    <div className={styles.field}>
                        <label className={styles.label}>Student ID</label>
                        <div className={styles.inputWrap}>
                            <svg className={styles.inputIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3l-4 4-4-4"/>
                            </svg>
                            <input
                                type="text" className={styles.input}
                                placeholder="230042135"
                                value={form.studentId}
                                onChange={set('studentId')}
                                maxLength={9} required
                            />
                        </div>
                        <span className={styles.fieldHint}>Your email will be: {form.studentId || 'XXXXXXXXX'}@iut-dhaka.edu</span>
                    </div>

                    {/* Full name */}
                    <div className={styles.field}>
                        <label className={styles.label}>Full Name</label>
                        <div className={styles.inputWrap}>
                            <svg className={styles.inputIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                            </svg>
                            <input
                                type="text" className={styles.input}
                                placeholder="Khadiza Sultana"
                                value={form.name}
                                onChange={set('name')}
                                required
                            />
                        </div>
                    </div>

                    {/* Department + Year row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className={styles.field}>
                            <label className={styles.label}>Department</label>
                            <select className={styles.input} value={form.department} onChange={set('department')}>
                                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                            </select>
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Year</label>
                            <select className={styles.input} value={form.year} onChange={set('year')}>
                                <option value="1">Year 1</option>
                                <option value="2">Year 2</option>
                                <option value="3">Year 3</option>
                                <option value="4">Year 4</option>
                            </select>
                        </div>
                    </div>

                    {/* Password */}
                    <div className={styles.field}>
                        <label className={styles.label}>Password</label>
                        <div className={styles.inputWrap}>
                            <svg className={styles.inputIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                            <input
                                type="password" className={styles.input}
                                placeholder="Min 6 characters"
                                value={form.password}
                                onChange={set('password')}
                                required
                            />
                        </div>
                    </div>

                    {/* Confirm password */}
                    <div className={styles.field}>
                        <label className={styles.label}>Confirm Password</label>
                        <div className={styles.inputWrap}>
                            <svg className={styles.inputIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                            <input
                                type="password" className={styles.input}
                                placeholder="Re-enter password"
                                value={form.confirm}
                                onChange={set('confirm')}
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <div className={styles.errorBox}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
                                <line x1="12" y1="16" x2="12.01" y2="16"/>
                            </svg>
                            {error}
                        </div>
                    )}

                    <button type="submit" className={styles.signInBtn} disabled={loading}>
                        {loading ? <span className={styles.spinner} /> : 'Create Account'}
                    </button>
                </form>

                <p className={styles.footer}>
                    Already have an account?{' '}
                    <button className={styles.footerLink} onClick={() => navigate('/login')}>Sign In</button>
                </p>
            </div>
        </div>
    )
}