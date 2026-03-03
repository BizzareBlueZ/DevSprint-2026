import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import styles from './AdminLoginPage.module.css'
import { storeUserData, enableHttpOnlyCookies } from '../../utils/tokenManager'
import { sanitizeText, escapeHtml } from '../../utils/sanitization'

// Enable httpOnly cookie support
enableHttpOnlyCookies(axios)

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
            // Sanitize input before sending
            const sanitizedUsername = sanitizeText(username, 100)
            
            const res = await axios.post('/api/auth/admin/login', 
                { username: sanitizedUsername, password },
                { withCredentials: true } // Enable httpOnly cookie with request
            )
            const { admin } = res.data
            // Token is in httpOnly cookie, store only admin user data
            try {
                sessionStorage.setItem('admin_user', JSON.stringify(admin))
            } catch (storageErr) {
                console.warn('Failed to store admin user data:', storageErr)
            }
            navigate('/admin/dashboard')
        } catch (err) {
            const msg = err.response?.data?.message || 'Login failed. Please try again.'
            setError(escapeHtml(msg))
            setPassword('')
            setUsername('')
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
                    Contact your system administrator for access credentials.
                </p>
            </div>
        </div>
    )
}
