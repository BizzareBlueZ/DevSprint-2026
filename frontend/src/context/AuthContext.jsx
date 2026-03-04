import React, { createContext, useContext, useState, useCallback } from 'react'
import axios from 'axios'
import {
  enableHttpOnlyCookies,
  storeUserData,
  getUserData,
  getAvatarData,
  clearAllUserData,
} from '../utils/tokenManager'

const AuthContext = createContext(null)

// Enable httpOnly cookie support on axios
enableHttpOnlyCookies(axios)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return getUserData()
    } catch {
      return null
    }
  })
  // Token is in httpOnly cookie, not stored in state
  const [avatar, setAvatar] = useState(() => {
    try {
      return getAvatarData()
    } catch {
      return null
    }
  })

  const login = useCallback(async (email, password) => {
    const res = await axios.post('/api/auth/login', { email, password })
    const { user: userData } = res.data
    // Token is automatically set in httpOnly cookie by backend
    // Store only non-sensitive user data in sessionStorage
    setUser(userData)
    storeUserData(userData)
    return userData
  }, [])

  const updateAvatar = useCallback(dataUrl => {
    setAvatar(dataUrl)
    if (dataUrl) {
      try {
        sessionStorage.setItem('iut_avatar', dataUrl)
      } catch (e) {
        console.warn('Failed to store avatar:', e)
      }
    } else {
      try {
        sessionStorage.removeItem('iut_avatar')
      } catch (e) {
        console.warn('Failed to remove avatar:', e)
      }
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      // Notify backend to clear httpOnly cookie
      await axios.post('/api/auth/logout')
    } catch (e) {
      console.warn('Logout API call failed:', e)
    } finally {
      setUser(null)
      setAvatar(null)
      clearAllUserData()
      delete axios.defaults.headers.common['Authorization']
    }
  }, [])

  // Check authentication status on mount
  React.useEffect(() => {
    // Note: With httpOnly cookies, we can't verify token existence on client
    // Backend will handle 401 responses for expired/invalid tokens
    // See tokenManager.js for automatic redirect on 401
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, avatar, login, logout, updateAvatar, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
