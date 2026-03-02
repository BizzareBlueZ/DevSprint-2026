// Student ID Parser
// Format: 2Y 00 DC xxx
// Y = Year (2 = Year 2, 1 = Year 1, etc.)
// DC = Department Code (digits 4-5)
// Example: 210042100 = Year 2, Dept 42 (SWE)

const DEPARTMENTS = {
  41: { code: '41', name: 'CSE', full: 'Computer Science & Engineering' },
  42: { code: '42', name: 'SWE', full: 'Software Engineering' },
  21: { code: '21', name: 'EEE', full: 'Electrical & Electronic Engineering' },
  11: { code: '11', name: 'ME', full: 'Mechanical Engineering' },
  12: { code: '12', name: 'IPE', full: 'Industrial & Production Engineering' },
  61: { code: '61', name: 'BTM', full: 'Business & Technology Management' },
  51: { code: '51', name: 'CEE', full: 'Civil & Environmental Engineering' },
}

const YEAR_NAMES = {
  1: 'Year 1 (Final)',
  2: 'Year 2 (3rd)',
  3: 'Year 3 (2nd)',
  4: 'Year 4 (1st)',
}

export function parseStudentId(studentId) {
  if (!studentId || typeof studentId !== 'string' || studentId.length < 5) {
    return { valid: false, studentId, error: 'Invalid student ID format' }
  }

  const yearDigit = parseInt(studentId.charAt(0), 10)
  const deptCode = studentId.substring(4, 6)

  const year = YEAR_NAMES[yearDigit] || null
  const department = DEPARTMENTS[deptCode] || null

  if (!year || !department) {
    return {
      valid: false,
      studentId,
      yearDigit,
      deptCode,
      error: `Invalid year (${yearDigit}) or department code (${deptCode})`,
    }
  }

  return {
    valid: true,
    studentId,
    yearDigit,
    year,
    yearLabel: `Year ${yearDigit}`,
    deptCode,
    department: department.name,
    departmentFull: department.full,
  }
}

export function getDepartmentInfo(deptCode) {
  return DEPARTMENTS[deptCode] || null
}

export function getYearInfo(yearDigit) {
  return YEAR_NAMES[yearDigit] || null
}

export function formatStudentInfo(studentId) {
  const info = parseStudentId(studentId)
  if (!info.valid) return null
  return {
    year: info.year,
    department: info.department,
    badge: `${info.yearLabel} · ${info.department}`,
  }
}
