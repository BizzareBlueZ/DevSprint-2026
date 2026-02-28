import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './DashboardLayout.module.css'

const navItems = [
  {
    path: '/apps',
    label: 'Home',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    )
  },
  {
    path: '/apps',
    label: 'Apps',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    )
  },
  {
    path: '/account',
    label: 'Account',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    )
  },
]

export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  // Get page title from path
  const getTitle = () => {
    const p = location.pathname
    if (p.includes('cafeteria-ramadan')) return 'Cafeteria (Ramadan)'
    if (p.includes('cafeteria')) return 'Cafeteria'
    if (p.includes('wallet')) return 'Wallet'
    if (p.includes('account')) return 'Account'
    if (p.includes('order')) return 'Order Tracker'
    return 'My IUT'
  }

  const isSubPage = location.pathname !== '/apps'

  return (
    <div className={styles.layout}>
      {/* Top header bar - salmon colored like in screenshots */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.menuBtn} aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className={styles.brandName}>My IUT</span>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.userAvatar}>
            {user?.name ? user.name.charAt(0).toUpperCase() : 'S'}
          </div>
        </div>
      </header>

      <div className={styles.body}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <nav className={styles.nav}>
            {navItems.map((item) => (
              <NavLink
                key={item.label}
                to={item.path}
                end={item.path === '/apps'}
                className={({ isActive }) =>
                  `${styles.navItem} ${(isActive || (item.label === 'Apps' && location.pathname.startsWith('/apps'))) ? styles.navActive : ''}`
                }
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
              </NavLink>
            ))}

            <div className={styles.navDivider} />

            <button onClick={handleLogout} className={`${styles.navItem} ${styles.logoutBtn}`}>
              <span className={styles.navIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </span>
              <span className={styles.navLabel}>Logout</span>
            </button>
          </nav>
        </aside>

        {/* Main content */}
        <main className={styles.main}>
          {/* Breadcrumb back button for sub-pages */}
          {isSubPage && !location.pathname.includes('/order/') && (
            <div className={styles.pageHeader}>
              <button onClick={() => navigate('/apps')} className={styles.backBtn}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                <span>{getTitle()}</span>
              </button>
              {user && (
                <span className={styles.userName}>{user.name || user.email}</span>
              )}
            </div>
          )}
          <div className={styles.content}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
