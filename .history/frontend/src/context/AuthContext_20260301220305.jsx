import React, { createContext, useContext, useState, useCallback } from 'react'
import axios from 'axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem('iut_user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [token, setToken] = useState(() => sessionStorage.getItem('iut_token') || null)
  const [avatar, setAvatar] = useState(() => sessionStorage.getItem('iut_avatar') || null)

  const login = useCallback(async (email, password) => {
    const res = await axios.post('/api/auth/login', { email, password })
    const { token: jwt, user: userData } = res.data
    setToken(jwt)
    setUser(userData)
    sessionStorage.setItem('iut_token', jwt)
    sessionStorage.setItem('iut_user', JSON.stringify(userData))
    // Set default auth header
    axios.defaults.headers.common['Authorization'] = `Bearer ${jwt}`
    return userData
  }, [])

  const updateAvatar = useCallback((dataUrl) => {
    setAvatar(dataUrl)
    if (dataUrl) {
      sessionStorage.setItem('iut_avatar', dataUrl)
    } else {
      sessionStorage.removeItem('iut_avatar')
    }
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    setAvatar(null)
    sessionStorage.removeItem('iut_token')
    sessionStorage.removeItem('iut_user')
    sessionStorage.removeItem('iut_avatar')
    delete axios.defaults.headers.common['Authorization']
  }, [])

  // Restore auth header on mount
  React.useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }
  }, [token])

  return (
    <AuthContext.Provider value={{ user, token, avatar, login, logout, updateAvatar, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
