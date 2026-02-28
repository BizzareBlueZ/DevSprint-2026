import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import DashboardLayout from './pages/DashboardLayout'
import AppsPage from './pages/AppsPage'
import CafeteriaPage from './pages/CafeteriaPage'
import CafeteriaRamadanPage from './pages/CafeteriaRamadanPage'
import WalletPage from './pages/WalletPage'
import OrderTrackerPage from './pages/OrderTrackerPage'
import AccountPage from './pages/AccountPage'

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/apps" replace />} />
            <Route path="apps" element={<AppsPage />} />
            <Route path="apps/cafeteria" element={<CafeteriaPage />} />
            <Route path="apps/cafeteria-ramadan" element={<CafeteriaRamadanPage />} />
            <Route path="apps/wallet" element={<WalletPage />} />
            <Route path="account" element={<AccountPage />} />
            <Route path="order/:orderId" element={<OrderTrackerPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
