import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './AdminLoginPage.module.css'

// Hardcoded admin credentials — in production use a proper admin table
const ADMIN_CREDENTIALS = {
    'admin': 'devsprint2026',
    'iutcs': 'cafeteria@2026',
}

export default function AdminLoginPage() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError]       = useState('')
    const [loading, setLoading]   = useState(false)
    const navigate = useNavigate()

    function handleSubmit(e) {
        e.preventDefault()
        setError('')
        setLoading(true)
        setTimeout(() => {
            if (ADMIN_CREDENTIALS[username] === password) {
                sessionStorage.setItem('admin_auth', JSON.stringify({ username, role: 'admin' }))
                navigate('/admin/dashboard')
            } else {
                setError('Invalid admin credentials.')
            }
            setLoading(false)
        }, 400)
    }

    return (
        <div className={styles.page}>
            <div className={styles.bgPattern} />
            <div className={styles.card}>
                <div className={styles.header}>
                    <div className={styles.iconWrap}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                    </div>
                    <h1 className={styles.title}>Admin Portal</h1>
                    <p className={styles.subtitle}>IUT Cafeteria — System Monitoring</p>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.field}>
                        <label className={styles.label}>Username</label>
                        <input
                            type="text"
                            className={styles.input}
                            placeholder="admin"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            required autoFocus
                        />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Password</label>
                        <input
                            type="password"
                            className={styles.input}
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
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
                        {loading ? <span className="spinner" /> : 'Sign In'}
                    </button>
                </form>

                <button className={styles.backLink} onClick={() => navigate('/login')}>
                    ← Back to Student Login
                </button>
            </div>
        </div>
    )
}