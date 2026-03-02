import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Mock the AuthContext
const mockLogin = vi.fn()
const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    user: null,
    token: null,
    isAuthenticated: false,
  }),
}))

import LoginPage from '../pages/LoginPage'

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the login form', () => {
    renderLoginPage()
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('230042135@iut-dhaka.edu')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument()
  })

  it('renders the sign in button', () => {
    renderLoginPage()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('renders the register link', () => {
    renderLoginPage()
    expect(screen.getByText('Create an account')).toBeInTheDocument()
  })

  it('renders the footer with IUT Computer Society', () => {
    renderLoginPage()
    expect(screen.getByText('IUT Computer Society · 2026')).toBeInTheDocument()
  })

  it('allows typing email and password', () => {
    renderLoginPage()
    const emailInput = screen.getByPlaceholderText('230042135@iut-dhaka.edu')
    const passwordInput = screen.getByPlaceholderText('Enter your password')

    fireEvent.change(emailInput, { target: { value: 'test@iut-dhaka.edu' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })

    expect(emailInput.value).toBe('test@iut-dhaka.edu')
    expect(passwordInput.value).toBe('password123')
  })

  it('calls login and navigates on successful submit', async () => {
    mockLogin.mockResolvedValueOnce({ name: 'Test User' })
    renderLoginPage()

    fireEvent.change(screen.getByPlaceholderText('230042135@iut-dhaka.edu'), {
      target: { value: '230042135@iut-dhaka.edu' },
    })
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('230042135@iut-dhaka.edu', 'password123')
      expect(mockNavigate).toHaveBeenCalledWith('/apps')
    })
  })

  it('displays error message on login failure', async () => {
    mockLogin.mockRejectedValueOnce({
      response: { data: { message: 'Invalid credentials.' } },
    })
    renderLoginPage()

    fireEvent.change(screen.getByPlaceholderText('230042135@iut-dhaka.edu'), {
      target: { value: 'bad@iut-dhaka.edu' },
    })
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
      target: { value: 'wrong' },
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials.')).toBeInTheDocument()
    })
  })

  it('displays fallback error when response has no message', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Network Error'))
    renderLoginPage()

    fireEvent.change(screen.getByPlaceholderText('230042135@iut-dhaka.edu'), {
      target: { value: 'a@iut-dhaka.edu' },
    })
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
      target: { value: 'x' },
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument()
    })
  })

  it('toggles password visibility', () => {
    renderLoginPage()
    const passwordInput = screen.getByPlaceholderText('Enter your password')
    expect(passwordInput.type).toBe('password')

    // Click the eye button to show password
    const toggleBtn = screen.getByRole('button', { name: '👁' })
    fireEvent.click(toggleBtn)
    expect(passwordInput.type).toBe('text')

    // Click again to hide
    fireEvent.click(toggleBtn)
    expect(passwordInput.type).toBe('password')
  })

  it('renders three feature highlights', () => {
    renderLoginPage()
    expect(screen.getByText('Real-time order tracking')).toBeInTheDocument()
    expect(screen.getByText('Secure SmartCard wallet')).toBeInTheDocument()
    expect(screen.getByText('Ramadan advance booking')).toBeInTheDocument()
  })
})
