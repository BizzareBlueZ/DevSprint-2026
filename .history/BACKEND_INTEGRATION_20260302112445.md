# Backend Integration Guide: Security Updates

## Overview
The frontend has been updated to use httpOnly cookies for token storage instead of sessionStorage. This requires backend changes to support the new architecture.

---

## 1. JWT Token in httpOnly Cookies

### Backend Changes Required

#### 1.1 After Successful Login
Instead of returning token in response body, set it in httpOnly cookie:

**Old Approach (❌ Insecure)**:
```javascript
// Old: Token in response body
res.json({
  token: jwt,
  user: userData
})
// ❌ Frontend stores in sessionStorage (XSS vulnerable)
```

**New Approach (✅ Secure)**:
```javascript
// New: Token in httpOnly cookie
res.cookie('iut_token', jwt, {
  httpOnly: true,        // Inaccessible to JavaScript
  secure: true,          // HTTPS only (set in production)
  sameSite: 'strict',    // CSRF protection
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  path: '/'
})

res.json({
  // IMPORTANT: Don't include token in body anymore!
  user: userData
})
```

#### 1.2 Admin Login
Set separate admin token cookie:

```javascript
res.cookie('admin_token', adminJwt, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000,
  path: '/'
})

res.json({
  admin: adminData
  // Token NOT in body
})
```

### 1.3 Logout Endpoints
**Required**: `/api/auth/logout` and `/api/auth/admin/logout`

```javascript
// Student logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('iut_token', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/'
  })
  res.json({ success: true })
})

// Admin logout
app.post('/api/auth/admin/logout', (req, res) => {
  res.clearCookie('admin_token', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/'
  })
  res.json({ success: true })
})
```

---

## 2. Frontend Axios Configuration

### On Backend Setup
Ensure axios is configured with `withCredentials: true` in frontend:

```javascript
// Frontend: src/main.jsx or axios config
import axios from 'axios'

axios.defaults.withCredentials = true

// This sends cookies with every request and receives Set-Cookie headers
```

### What This Means
- Browser automatically sends `iut_token` cookie with every request
- Backend receives it in `req.cookies.iut_token` (with cookie-parser)
- No need for Authorization header in requests

---

## 3. Middleware for Token Verification

### Node.js/Express Example

#### 3.1 Parse Cookies
```javascript
const cookieParser = require('cookie-parser')

app.use(cookieParser())
```

#### 3.2 Auth Middleware
```javascript
// Extract token from cookie instead of header
function authenticate(req, res, next) {
  const token = req.cookies.iut_token
  
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' })
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    next()
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}

// Usage
app.get('/api/protected', authenticate, (req, res) => {
  // req.user is available
  res.json({ message: 'Protected data', user: req.user })
})
```

#### 3.3 Admin Middleware
```javascript
function adminOnly(req, res, next) {
  const token = req.cookies.admin_token
  
  if (!token) {
    return res.status(401).json({ message: 'Admin access required' })
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded.isAdmin) {
      return res.status(403).json({ message: 'Admin privileges required' })
    }
    req.admin = decoded
    next()
  } catch (err) {
    return res.status(401).json({ message: 'Invalid admin token' })
  }
}

// Usage
app.get('/api/admin/dashboard', adminOnly, (req, res) => {
  // admin-only logic
})
```

---

## 4. CORS Configuration

### Production CORS Setup
For httpOnly cookies to work across domains, CORS must be configured:

```javascript
const cors = require('cors')

app.use(cors({
  origin: ['https://yourdomain.com', 'https://admin.yourdomain.com'],
  credentials: true, // CRITICAL: Enable for cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  maxAge: 86400
}))
```

### Important
⚠️ Must have `credentials: true`
⚠️ Must specify explicit `origin` (not '*' with credentials)

---

## 5. Response Format Changes

### Before (Old - sessionStorage)
```json
{
  "token": "eyJhbGc...",     // ❌ Token in body
  "user": {
    "id": "123",
    "email": "user@example.com"
  }
}
```

### After (New - httpOnly cookie)
```json
{
  "user": {                   // ✅ Only user data
    "id": "123",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
// Plus Set-Cookie header with iut_token
```

---

## 6. Testing the New Flow

### Manual Testing
```bash
# 1. Login and check cookies
curl -X POST https://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass"}' \
  -v

# Should see: Set-Cookie: iut_token=eyJ...; HttpOnly; Secure; ...

# 2. Subsequent request with cookies
curl https://localhost/api/protected \
  -b "iut_token=eyJ..." \
  -v

# Should work without Authorization header
```

### Automated Testing
```javascript
// Jest/Supertest example
const request = require('supertest')
const app = require('../app')

test('login sets httpOnly cookie', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'user@test.com', password: 'password' })
  
  expect(res.headers['set-cookie']).toBeDefined()
  expect(res.headers['set-cookie'][0]).toContain('HttpOnly')
  expect(res.headers['set-cookie'][0]).toContain('Secure')
})

test('authenticated request works with cookie', async () => {
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'user@test.com', password: 'password' })
  
  const protectedRes = await request(app)
    .get('/api/protected')
    .set('Cookie', loginRes.headers['set-cookie'])
  
  expect(protectedRes.status).toBe(200)
})
```

---

## 7. Environment Variables

### Add to Backend .env
```env
# JWT Configuration
JWT_SECRET=<your-secure-jwt-secret>
JWT_EXPIRES_IN=24h

# CORS Configuration
CORS_ORIGIN=https://yourdomain.com

# Cookie Settings
COOKIE_SECURE=true        # Only HTTPS in production
COOKIE_SAMESITE=strict    # CSRF protection
```

---

## 8. Migration Checklist

- [ ] Update login endpoints to set httpOnly cookies
- [ ] Remove token from response bodies
- [ ] Add logout endpoints to clear cookies
- [ ] Update authentication middleware to read from cookies
- [ ] Configure CORS with `credentials: true`
- [ ] Add cookie-parser middleware
- [ ] Set environment variable `JWT_SECRET` from `.env`
- [ ] Test login/logout flow
- [ ] Test authenticated requests
- [ ] Verify HTTPS in production
- [ ] Test 401 handling (redirect to login)
- [ ] Test admin routes and permissions

---

## 9. Frontend Changes Summary

The frontend now:
1. ✅ Uses utility functions in `src/utils/tokenManager.js`
2. ✅ Enables `withCredentials` on axios
3. ✅ Does NOT store tokens in sessionStorage
4. ✅ Stores only non-sensitive user data in sessionStorage
5. ✅ Handles 401 responses with automatic redirect
6. ✅ All forms use input sanitization from `src/utils/sanitization.js`
7. ✅ nginx configured with security headers

---

## 10. Security Benefits

| Aspect | Before | After |
|--------|--------|-------|
| Token Storage | sessionStorage (XSS vulnerable) | httpOnly cookie (XSS safe) |
| Token Access | JavaScript readable | Not accessible to JS |
| CSRF Protection | None | sameSite=strict |
| HTTPS Enforcement | No | Yes |
| Headers | None | CSP, X-Frame-Options, etc. |
| Input Validation | Backend only | Frontend + Backend |

---

## 11. References

- [httpOnly Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#restricting_access_to_cookies)
- [OWASP: DOM Based XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html)
- [Express cookie-parser](https://expressjs.com/en/resources/middleware/cookie-parser.html)
- [Axios Configuration](https://axios-http.com/docs/req_config)

---

**Last Updated**: March 2, 2026
**Status**: Ready for Production Implementation
