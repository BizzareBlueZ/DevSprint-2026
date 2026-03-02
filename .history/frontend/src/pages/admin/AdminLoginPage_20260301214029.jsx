import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import styles from './AdminLoginPage.module.css'

export default function AdminLoginPage() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError]       = useState('')
    const [loading, setLoading]   = useState(false)
    const navigate                = useNavigate()

    async function handleSubmit(e) {
        e.preventDefault()
        setLoading(true)
        setError('')
        try {
            const res = await axios.post('/api/auth/admin/login', { username, password })
            const { token, admin } = res.data
            sessionStorage.setItem('admin_token', token)
            sessionStorage.setItem('admin_user', JSON.stringify(admin))
            navigate('/admin/dashboard')
        } catch (err) {
            const msg = err.response?.data?.message || 'Login failed. Please try again.'
            setError(msg)
            setPassword('')
        } finally {
            setLoading(false)
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
                        type="text"
                        className={styles.input}
                        placeholder="Username"
                        value={username}
                        onChange={e => { setUsername(e.target.value); setError('') }}
                        autoFocus
                        required
                    />
                    <input
                        type="password"
                        className={styles.input}
                        placeholder="Password"
                        value={password}
                        onChange={e => { setPassword(e.target.value); setError('') }}
                        required
                    />
                    {error && <p className={styles.error}>{error}</p>}
                    <button type="submit" className={styles.btn} disabled={loading}>
                        {loading ? 'Authenticating...' : 'Enter Dashboard →'}
                    </button>
                </form>

                <p className={styles.hint}>
                    Default: <code>iutcs</code> / <code>devsprint2026</code>
                </p>
            </div>
        </div>
    )
}
