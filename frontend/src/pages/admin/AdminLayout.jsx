import React from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import styles from './AdminLayout.module.css'

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  function handleLogout() {
    sessionStorage.removeItem('admin_token')
    sessionStorage.removeItem('admin_user')
    navigate('/admin/login')
  }

  const isActive = path => location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>⬡</span>
          <span className={styles.brandText}>Mission Control</span>
        </div>

        <nav className={styles.nav}>
          <button
            className={`${styles.navItem} ${isActive('/admin/dashboard') ? styles.navActive : ''}`}
            onClick={() => navigate('/admin/dashboard')}
          >
            <span>◈</span> Dashboard
          </button>
          <button
            className={`${styles.navItem} ${isActive('/admin/menu') ? styles.navActive : ''}`}
            onClick={() => navigate('/admin/menu')}
          >
            <span>🍽️</span> Menu
          </button>
          <button
            className={`${styles.navItem} ${isActive('/admin/analytics') ? styles.navActive : ''}`}
            onClick={() => navigate('/admin/analytics')}
          >
            <span>📊</span> Analytics
          </button>
          <button
            className={`${styles.navItem} ${isActive('/admin/users') ? styles.navActive : ''}`}
            onClick={() => navigate('/admin/users')}
          >
            <span>👥</span> Users
          </button>
          <button
            className={`${styles.navItem} ${isActive('/admin/stock') ? styles.navActive : ''}`}
            onClick={() => navigate('/admin/stock')}
          >
            <span>📦</span> Stock
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
