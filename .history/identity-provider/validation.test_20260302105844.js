const {
  validateLoginRequest,
  normalizeEmail,
  validateRegisterRequest,
  validateAdminLoginRequest,
  extractBearerToken,
} = require('./validation')

// ─── Login Validation ──────────────────────────────────────────

describe('Login Validation — validateLoginRequest()', () => {
  it('accepts a valid login with email and password', () => {
    expect(validateLoginRequest({ email: '230042135@iut-dhaka.edu', password: 'password123' }).valid).toBe(true)
  })

  it('accepts login with bare student ID as email', () => {
    expect(validateLoginRequest({ email: '230042135', password: 'password123' }).valid).toBe(true)
  })

  it('rejects when email is missing', () => {
    const result = validateLoginRequest({ password: 'password123' })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/email/i)
  })

  it('rejects when password is missing', () => {
    const result = validateLoginRequest({ email: '230042135@iut-dhaka.edu' })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/password/i)
  })

  it('rejects when email is empty string', () => {
    expect(validateLoginRequest({ email: '', password: 'pass' }).valid).toBe(false)
  })

  it('rejects when password is empty string', () => {
    expect(validateLoginRequest({ email: 'a@b.com', password: '' }).valid).toBe(false)
  })

  it('rejects when email is whitespace only', () => {
    expect(validateLoginRequest({ email: '   ', password: 'pass' }).valid).toBe(false)
  })

  it('rejects when body is empty', () => {
    expect(validateLoginRequest({}).valid).toBe(false)
  })

  it('rejects when no body is provided', () => {
    expect(validateLoginRequest().valid).toBe(false)
  })

  it('rejects non-string email', () => {
    expect(validateLoginRequest({ email: 123, password: 'pass' }).valid).toBe(false)
  })

  it('rejects non-string password', () => {
    expect(validateLoginRequest({ email: 'a@b.com', password: 123 }).valid).toBe(false)
  })

  it('rejects null email', () => {
    expect(validateLoginRequest({ email: null, password: 'pass' }).valid).toBe(false)
  })
})

// ─── Email Normalization ───────────────────────────────────────

describe('Email — normalizeEmail()', () => {
  it('appends @iut-dhaka.edu to bare student ID', () => {
    expect(normalizeEmail('230042135')).toBe('230042135@iut-dhaka.edu')
  })

  it('lowercases and trims full email addresses', () => {
    expect(normalizeEmail('  230042135@IUT-DHAKA.EDU  ')).toBe('230042135@iut-dhaka.edu')
  })

  it('passes through well-formed emails unchanged', () => {
    expect(normalizeEmail('230042135@iut-dhaka.edu')).toBe('230042135@iut-dhaka.edu')
  })

  it('handles empty string by appending domain', () => {
    expect(normalizeEmail('')).toBe('@iut-dhaka.edu')
  })

  it('returns empty string for non-string input', () => {
    expect(normalizeEmail(null)).toBe('')
    expect(normalizeEmail(undefined)).toBe('')
    expect(normalizeEmail(123)).toBe('')
  })

  it('trims whitespace from bare IDs', () => {
    expect(normalizeEmail('  230042135  ')).toBe('230042135@iut-dhaka.edu')
  })
})

// ─── Registration Validation ───────────────────────────────────

describe('Registration — validateRegisterRequest()', () => {
  const validBody = {
    studentId: '230042135',
    email: '230042135@iut-dhaka.edu',
    password: 'password123',
    name: 'Khadiza Sultana',
  }

  it('accepts a valid registration request', () => {
    expect(validateRegisterRequest(validBody).valid).toBe(true)
  })

  it('rejects when studentId is missing', () => {
    const { studentId, ...body } = validBody
    const result = validateRegisterRequest(body)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/studentId/i)
  })

  it('rejects when email is missing', () => {
    const { email, ...body } = validBody
    const result = validateRegisterRequest(body)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/email/i)
  })

  it('rejects when password is missing', () => {
    const { password, ...body } = validBody
    const result = validateRegisterRequest(body)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/password/i)
  })

  it('rejects when name is missing', () => {
    const { name, ...body } = validBody
    const result = validateRegisterRequest(body)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/name/i)
  })

  it('rejects non-IUT email addresses', () => {
    const result = validateRegisterRequest({ ...validBody, email: 'user@gmail.com' })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/iut-dhaka\.edu/)
  })

  it('rejects passwords shorter than 6 characters', () => {
    const result = validateRegisterRequest({ ...validBody, password: '12345' })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/6 characters/)
  })

  it('accepts passwords exactly 6 characters', () => {
    expect(validateRegisterRequest({ ...validBody, password: '123456' }).valid).toBe(true)
  })

  it('rejects empty body', () => {
    expect(validateRegisterRequest({}).valid).toBe(false)
  })

  it('rejects no arguments', () => {
    expect(validateRegisterRequest().valid).toBe(false)
  })

  it('rejects when studentId is just whitespace', () => {
    expect(validateRegisterRequest({ ...validBody, studentId: '   ' }).valid).toBe(false)
  })

  it('rejects non-string name', () => {
    expect(validateRegisterRequest({ ...validBody, name: 42 }).valid).toBe(false)
  })
})

// ─── Admin Login Validation ────────────────────────────────────

describe('Admin Login — validateAdminLoginRequest()', () => {
  it('accepts valid admin credentials', () => {
    expect(validateAdminLoginRequest({ username: 'admin', password: 'admin123' }).valid).toBe(true)
  })

  it('rejects when username is missing', () => {
    const result = validateAdminLoginRequest({ password: 'admin123' })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/username/i)
  })

  it('rejects when password is missing', () => {
    const result = validateAdminLoginRequest({ username: 'admin' })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/password/i)
  })

  it('rejects empty body', () => {
    expect(validateAdminLoginRequest({}).valid).toBe(false)
  })

  it('rejects non-string username', () => {
    expect(validateAdminLoginRequest({ username: 123, password: 'pass' }).valid).toBe(false)
  })

  it('rejects whitespace-only username', () => {
    expect(validateAdminLoginRequest({ username: '   ', password: 'pass' }).valid).toBe(false)
  })
})

// ─── Bearer Token Extraction ───────────────────────────────────

describe('Token — extractBearerToken()', () => {
  it('extracts token from valid Bearer header', () => {
    const result = extractBearerToken('Bearer eyJhbGciOiJIUzI1NiJ9.test.sig')
    expect(result.valid).toBe(true)
    expect(result.token).toBe('eyJhbGciOiJIUzI1NiJ9.test.sig')
  })

  it('rejects missing authorization header', () => {
    expect(extractBearerToken(null).valid).toBe(false)
    expect(extractBearerToken(undefined).valid).toBe(false)
  })

  it('rejects empty string', () => {
    expect(extractBearerToken('').valid).toBe(false)
  })

  it('rejects header without Bearer prefix', () => {
    const result = extractBearerToken('Basic abc123')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/Bearer/)
  })

  it('rejects header with only Bearer keyword', () => {
    expect(extractBearerToken('Bearer').valid).toBe(false)
  })

  it('rejects non-string input', () => {
    expect(extractBearerToken(123).valid).toBe(false)
    expect(extractBearerToken({}).valid).toBe(false)
  })

  it('rejects header with Bearer and empty token', () => {
    expect(extractBearerToken('Bearer ').valid).toBe(false)
  })
})
