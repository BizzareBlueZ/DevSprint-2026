/**
 * Secure Token Management - httpOnly Cookies
 *
 * This utility handles JWT tokens using httpOnly cookies, which are:
 * - Not accessible via JavaScript (protection against XSS)
 * - Automatically sent with requests (reduces manual header management)
 * - Cleared on logout
 *
 * NOTE: httpOnly cookies are automatically handled by axios when configured with credentialsincluded:true
 */

export const tokenConfig = {
  tokenKey: 'iut_token',
  userKey: 'iut_user',
  avatarKey: 'iut_avatar',

  // Cookie options - should match backend cookie settings
  cookieOptions: {
    path: '/',
    // In production, set these to secure values:
    // secure: true,  // Only HTTPS
    // sameSite: 'Strict', // CSRF protection
    // maxAge: 86400000, // 24 hours in milliseconds
  },
}

let _interceptorRegistered = false

/**
 * Set axios interceptor to include credentials (httpOnly cookies) in requests
 * @param {AxiosInstance} axiosInstance
 */
export function enableHttpOnlyCookies(axiosInstance) {
  // Enable sending cookies with requests
  axiosInstance.defaults.withCredentials = true

  // Guard against duplicate interceptor registration
  if (_interceptorRegistered) return
  _interceptorRegistered = true

  // Response interceptor to handle 401 (token expired)
  axiosInstance.interceptors.response.use(
    response => response,
    error => {
      if (error.response?.status === 401) {
        const url = error.config?.url || ''

        // Skip redirect for login/register endpoints (let the page handle the error)
        if (url.includes('/login') || url.includes('/register')) {
          return Promise.reject(error)
        }

        // Skip redirect for admin proxy routes (admin dashboard handles its own auth)
        if (url.startsWith('/admin/')) {
          return Promise.reject(error)
        }

        // Token expired or invalid - clear stored data and redirect
        try {
          sessionStorage.removeItem(tokenConfig.userKey)
          sessionStorage.removeItem(tokenConfig.avatarKey)
        } catch (e) {
          // Storage may not be available
        }

        // Redirect to login
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
      }
      return Promise.reject(error)
    }
  )
}

/**
 * Store non-sensitive user data in sessionStorage
 * Sensitive tokens are in httpOnly cookies
 */
export function storeUserData(userData, avatarUrl = null) {
  try {
    if (userData) {
      sessionStorage.setItem(tokenConfig.userKey, JSON.stringify(userData))
    }
    if (avatarUrl) {
      sessionStorage.setItem(tokenConfig.avatarKey, avatarUrl)
    }
  } catch (e) {
    // Storage access may fail in some environments
    console.warn('Failed to store user data in sessionStorage:', e)
  }
}

/**
 * Retrieve user data from sessionStorage
 */
export function getUserData() {
  try {
    const data = sessionStorage.getItem(tokenConfig.userKey)
    return data ? JSON.parse(data) : null
  } catch (e) {
    console.warn('Failed to retrieve user data:', e)
    return null
  }
}

/**
 * Get avatar from sessionStorage
 */
export function getAvatarData() {
  try {
    return sessionStorage.getItem(tokenConfig.avatarKey) || null
  } catch (e) {
    console.warn('Failed to retrieve avatar:', e)
    return null
  }
}

/**
 * Clear all stored user data
 * Backend should clear httpOnly cookie on logout
 */
export function clearAllUserData() {
  try {
    sessionStorage.removeItem(tokenConfig.userKey)
    sessionStorage.removeItem(tokenConfig.avatarKey)
  } catch (e) {
    console.warn('Failed to clear user data:', e)
  }
}

/**
 * Check if user is authenticated
 * Note: Token existence check requires server-side validation for httpOnly cookies
 */
export function isAuthenticated() {
  const userData = getUserData()
  return userData !== null
}
