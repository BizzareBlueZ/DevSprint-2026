import React from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import styles from './AdminLayout.module.css'

export default function AdminLayout() {
    const navigate = useNavigate()

    function handleLogout() {
        sessionStorage.removeItem('admin_auth')
        navigate('/admin/login')
    }

    return (
        <div className={styles.layout}>
            <aside className={styles.sidebar}>
                <div className={styles.brand}>
                    <span className={styles.brandIcon}>⬡</span>
                    <span className={styles.brandText}>Mission Control</span>
                </div>

                <nav className={styles.nav}>
                    <button
                        className={`${styles.navItem} ${styles.navActive}`}
                        onClick={() => navigate('/admin/dashboard')}
                    >
                        <span>◈</span> Dashboard
                    </button>
                </nav>

                <button className={styles.logoutBtn} onClick={handleLogout}>
                    ← Exit Admin
                </button>
            </aside>

            <main className={styles.main}>
                <Outlet />
            </main>
        </div>
    )
}