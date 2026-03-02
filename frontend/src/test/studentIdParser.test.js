import { describe, it, expect } from 'vitest'
import { parseStudentId, getDepartmentInfo, getYearInfo, formatStudentInfo } from '../utils/studentIdParser'

// ─── parseStudentId ────────────────────────────────────────────

describe('parseStudentId()', () => {
  it('parses a valid CSE Year 3 student ID', () => {
    const result = parseStudentId('230042135')
    expect(result.valid).toBe(true)
    expect(result.yearDigit).toBe(2)
    expect(result.year).toBe('Year 2 (3rd)')
    expect(result.department).toBe('SWE')
    expect(result.departmentFull).toBe('Software Engineering')
  })

  it('parses a year-1 student ID (final year)', () => {
    const result = parseStudentId('110041001')
    expect(result.valid).toBe(true)
    expect(result.yearDigit).toBe(1)
    expect(result.year).toBe('Year 1 (Final)')
  })

  it('parses an EEE student ID', () => {
    const result = parseStudentId('230021100')
    expect(result.valid).toBe(true)
    expect(result.department).toBe('EEE')
    expect(result.departmentFull).toBe('Electrical & Electronic Engineering')
  })

  it('parses a ME student ID', () => {
    const result = parseStudentId('240011050')
    expect(result.valid).toBe(true)
    expect(result.department).toBe('ME')
  })

  it('parses a CSE student ID (dept code 41)', () => {
    const result = parseStudentId('220041001')
    expect(result.valid).toBe(true)
    expect(result.department).toBe('CSE')
  })

  it('rejects null input', () => {
    const result = parseStudentId(null)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/invalid/i)
  })

  it('rejects undefined input', () => {
    const result = parseStudentId(undefined)
    expect(result.valid).toBe(false)
  })

  it('rejects empty string', () => {
    const result = parseStudentId('')
    expect(result.valid).toBe(false)
  })

  it('rejects a string shorter than 5 chars', () => {
    const result = parseStudentId('1234')
    expect(result.valid).toBe(false)
  })

  it('rejects non-string input', () => {
    const result = parseStudentId(230042135)
    expect(result.valid).toBe(false)
  })

  it('rejects unknown department code', () => {
    const result = parseStudentId('230099999')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/department code/)
  })

  it('rejects unknown year digit (0)', () => {
    const result = parseStudentId('030041001')
    expect(result.valid).toBe(false)
  })

  it('includes yearLabel in valid result', () => {
    const result = parseStudentId('230042135')
    expect(result.yearLabel).toBe('Year 2')
  })
})

// ─── getDepartmentInfo ─────────────────────────────────────────

describe('getDepartmentInfo()', () => {
  it('returns CSE info for code 41', () => {
    const info = getDepartmentInfo('41')
    expect(info).not.toBeNull()
    expect(info.name).toBe('CSE')
  })

  it('returns SWE info for code 42', () => {
    expect(getDepartmentInfo('42').name).toBe('SWE')
  })

  it('returns EEE info for code 21', () => {
    expect(getDepartmentInfo('21').name).toBe('EEE')
  })

  it('returns null for unknown code', () => {
    expect(getDepartmentInfo('99')).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(getDepartmentInfo(undefined)).toBeNull()
  })
})

// ─── getYearInfo ───────────────────────────────────────────────

describe('getYearInfo()', () => {
  it('returns correct string for year 1', () => {
    expect(getYearInfo(1)).toBe('Year 1 (Final)')
  })

  it('returns correct string for year 4', () => {
    expect(getYearInfo(4)).toBe('Year 4 (1st)')
  })

  it('returns null for year 0', () => {
    expect(getYearInfo(0)).toBeNull()
  })

  it('returns null for year 5', () => {
    expect(getYearInfo(5)).toBeNull()
  })
})

// ─── formatStudentInfo ─────────────────────────────────────────

describe('formatStudentInfo()', () => {
  it('formats a valid student ID into badge info', () => {
    const info = formatStudentInfo('230042135')
    expect(info).not.toBeNull()
    expect(info.badge).toContain('Year 2')
    expect(info.badge).toContain('SWE')
    expect(info.department).toBe('SWE')
  })

  it('returns null for invalid student ID', () => {
    expect(formatStudentInfo(null)).toBeNull()
    expect(formatStudentInfo('')).toBeNull()
    expect(formatStudentInfo('bad')).toBeNull()
  })

  it('includes year info in formatted result', () => {
    const info = formatStudentInfo('110041001')
    expect(info.year).toBe('Year 1 (Final)')
  })
})
