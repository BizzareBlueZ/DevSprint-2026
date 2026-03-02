import React from 'react'
import { Outlet, useNavigate, NavLink } from 'react-router-dom'
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
                    <div className={styles.brandIcon}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                    </div>
                    <div>
                        <div className={styles.brandName}>Admin</div>
                        <div className={styles.brandSub}>IUT Cafeteria</div>
                    </div>
                </div>

                <nav className={styles.nav}>
                    <NavLink to="/admin/dashboard" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                        Dashboard
                    </NavLink>
                </nav>

                <button className={styles.logoutBtn} onClick={handleLogout}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Logout
                </button>
            </aside>

            <main className={styles.main}>
                <Outlet />
            </main>
        </div>
    )
}