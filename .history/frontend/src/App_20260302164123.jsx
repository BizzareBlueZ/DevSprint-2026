import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'

// Student pages
import LoginPage           from './pages/LoginPage'
import DashboardLayout     from './pages/DashboardLayout'
import AppsPage            from './pages/AppsPage'
import CafeteriaPage       from './pages/CafeteriaPage'
import CafeteriaRamadanPage from './pages/CafeteriaRamadanPage'
import WalletPage          from './pages/WalletPage'
import OrderTrackerPage    from './pages/OrderTrackerPage'
import AccountPage         from './pages/AccountPage'
import RegisterPage        from './pages/RegisterPage'

// Admin pages
import AdminLoginPage      from './pages/admin/AdminLoginPage'
import AdminLayout         from './pages/admin/AdminLayout'
import AdminDashboard      from './pages/admin/AdminDashboard'
import MenuManagement      from './pages/admin/MenuManagement'
import Analytics           from './pages/admin/Analytics'
import UserManagement      from './pages/admin/UserManagement'
import StockAlerts         from './pages/admin/StockAlerts'

// ── Guards ────────────────────────────────────────────────────
function ProtectedRoute({ children }) {
    const { isAuthenticated } = useAuth()
    return isAuthenticated ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
    const adminUser = sessionStorage.getItem('admin_user')
    if (!adminUser) return <Navigate to="/admin/login" replace />
    try {
        const payload = JSON.parse(adminUser)
        if (!payload.isAdmin) return <Navigate to="/admin/login" replace />
    } catch {
        sessionStorage.removeItem('admin_user')
        return <Navigate to="/admin/login" replace />
    }
    return children
}

export default function App() {
    return (
        <AuthProvider>
            <ToastProvider>
            <BrowserRouter>
                <Routes>

                    {/* ── Student routes ── */}
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route
                        path="/"
                        element={
                            <ProtectedRoute>
                                <DashboardLayout />
                            </ProtectedRoute>
                        }
                    >
                        <Route index element={<Navigate to="/apps" replace />} />
                        <Route path="apps"                   element={<AppsPage />} />
                        <Route path="apps/cafeteria"         element={<CafeteriaPage />} />
                        <Route path="apps/cafeteria-ramadan" element={<CafeteriaRamadanPage />} />
                        <Route path="apps/wallet"            element={<WalletPage />} />
                        <Route path="account"                element={<AccountPage />} />
                        <Route path="order/:orderId"         element={<OrderTrackerPage />} />
                    </Route>

                    {/* ── Admin routes ── */}
                    <Route path="/admin/login" element={<AdminLoginPage />} />
                    <Route
                        path="/admin"
                        element={
                            <AdminRoute>
                                <AdminLayout />
                            </AdminRoute>
                        }
                    >
                        <Route index element={<Navigate to="/admin/dashboard" replace />} />
                        <Route path="dashboard" element={<AdminDashboard />} />
                        <Route path="menu" element={<MenuManagement />} />
                        <Route path="analytics" element={<Analytics />} />
                        <Route path="users" element={<UserManagement />} />
                        <Route path="stock" element={<StockAlerts />} />
                    </Route>

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
            </ToastProvider>
        </AuthProvider>
    )
}