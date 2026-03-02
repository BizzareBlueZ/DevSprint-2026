import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './AdminLoginPage.module.css'

// Simple hardcoded admin password — change this or move to env
const ADMIN_PASSWORD = 'devsprint2026'

export default function AdminLoginPage() {
    const [password, setPassword] = useState('')
    const [error, setError]       = useState('')
    const navigate                = useNavigate()

    function handleSubmit(e) {
        e.preventDefault()
        if (password === ADMIN_PASSWORD) {
            sessionStorage.setItem('admin_auth', 'true')
            navigate('/admin/dashboard')
        } else {
            setError('Incorrect admin password.')
            setPassword('')
        }
    }

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <div className={styles.icon}>⬡</div>
                <h1 className={styles.title}>Mission Control</h1>
                <p className={styles.subtitle}>Admin access only</p>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <input
                        type="password"
                        className={styles.input}
                        placeholder="Admin password"
                        value={password}
                        onChange={e => { setPassword(e.target.value); setError('') }}
                        autoFocus
                        required
                    />
                    {error && <p className={styles.error}>{error}</p>}
                    <button type="submit" className={styles.btn}>
                        Enter Dashboard →
                    </button>
                </form>

                <p className={styles.hint}>
                    Default: <code>devsprint2026</code>
                </p>
            </div>
        </div>
    )
}