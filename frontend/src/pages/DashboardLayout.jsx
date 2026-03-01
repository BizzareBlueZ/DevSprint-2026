import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './DashboardLayout.module.css'

const navItems = [
  {
    path: '/apps',
    label: 'Apps',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    )
  },
  {
    path: '/account',
    label: 'Account',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    )
  },
]

const pageTitle = (path) => {
  if (path.includes('cafeteria-ramadan')) return 'Cafeteria · Ramadan'
  if (path.includes('cafeteria'))         return 'Cafeteria'
  if (path.includes('wallet'))            return 'Wallet'
  if (path.includes('account'))           return 'Account'
  if (path.includes('order'))             return 'Order Tracker'
  if (path.includes('apps'))              return 'Apps'
  return 'My IUT'
}

export default function DashboardLayout() {
  const { user, logout, avatar } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const isSubPage = !location.pathname.match(/^\/apps$/)
  const title     = pageTitle(location.pathname)

  return (
    <div className={styles.layout}>
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}>
        {/* Brand */}
        <div className={styles.brand}>
          <div className={styles.brandLogo}>IUT</div>
          <div>
            <div className={styles.brandName}>My IUT</div>
            <div className={styles.brandTag}>Campus Portal</div>
          </div>
        </div>

        {/* User pill */}
        <div className={styles.userPill}>
          <div className={styles.userAvatar}>
            {avatar
              ? <img src={avatar} alt="" className={styles.userAvatarImg} />
              : (user?.name ? user.name.charAt(0).toUpperCase() : 'S')
            }
          </div>
          <div className={styles.userInfo}>
            <div className={styles.userName}>{user?.name?.split(' ')[0] || 'Student'}</div>
            <div className={styles.userId}>{user?.studentId || '—'}</div>
          </div>
        </div>

        {/* Nav */}
        <nav className={styles.nav}>
          <div className={styles.navGroup}>
            <span className={styles.navGroupLabel}>Menu</span>
            {navItems.map((item) => (
              <NavLink
                key={item.label}
                to={item.path}
                end={item.path === '/apps'}
                className={({ isActive }) =>
                  `${styles.navItem} ${
                    isActive || (item.path === '/apps' && location.pathname.startsWith('/apps'))
                      ? styles.navActive
                      : ''
                  }`
                }
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>

          <div className={styles.navGroup}>
            <span className={styles.navGroupLabel}>System</span>
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navActive : ''}`
              }
            >
              <span className={styles.navIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
              </span>
              <span>Admin</span>
            </NavLink>
          </div>
        </nav>

        {/* Logout */}
        <button className={styles.logoutBtn} onClick={handleLogout}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign out
        </button>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && <div className={styles.overlay} onClick={() => setMobileOpen(false)} />}

      {/* ── Main ────────────────────────────────────────────── */}
      <div className={styles.main}>
        {/* Top bar */}
        <header className={styles.topbar}>
          <div className={styles.topLeft}>
            <button className={styles.menuBtn} onClick={() => setMobileOpen(s => !s)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            {isSubPage && (
              <div className={styles.breadcrumb}>
                <button className={styles.backBtn} onClick={() => navigate('/apps')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </button>
                <span className={styles.pageTitle}>{title}</span>
              </div>
            )}
            {!isSubPage && <span className={styles.pageTitle}>{title}</span>}
          </div>

          <div className={styles.topRight}>
            <div className={styles.topAvatar} onClick={() => navigate('/account')}>
              {avatar
                ? <img src={avatar} alt="" className={styles.topAvatarImg} />
                : (user?.name ? user.name.charAt(0).toUpperCase() : 'S')
              }
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}