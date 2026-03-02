import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

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

// ── Guards ────────────────────────────────────────────────────
function ProtectedRoute({ children }) {
    const { isAuthenticated } = useAuth()
    return isAuthenticated ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
    const admin = sessionStorage.getItem('admin_auth')
    return admin ? children : <Navigate to="/admin/login" replace />
}

export default function App() {
    return (
        <AuthProvider>
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
                    </Route>

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    )
}