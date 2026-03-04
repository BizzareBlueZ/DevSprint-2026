import React, { createContext, useContext, useState, useCallback, useRef } from 'react'

const ToastContext = createContext(null)

const TOAST_DURATION = 6000

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const addToast = useCallback((message, { type = 'info', title, onClick } = {}) => {
    const id = ++idRef.current
    setToasts(prev => [...prev, { id, message, type, title, onClick }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, TOAST_DURATION)
    return id
  }, [])

  const removeToast = useCallback(id => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {/* Toast container - fixed bottom-right */}
      {toasts.length > 0 && (
        <div style={containerStyle}>
          {toasts.map(toast => (
            <div
              key={toast.id}
              style={{ ...toastStyle, ...typeStyles[toast.type] }}
              onClick={() => {
                if (toast.onClick) toast.onClick()
                removeToast(toast.id)
              }}
              className="toast-slide-in"
            >
              <div style={toastIconStyle}>
                {toast.type === 'success'
                  ? '\uD83C\uDF7D\uFE0F'
                  : toast.type === 'error'
                    ? '\u26A0\uFE0F'
                    : '\uD83D\uDD14'}
              </div>
              <div style={toastBodyStyle}>
                {toast.title && <div style={toastTitleStyle}>{toast.title}</div>}
                <div style={toastMsgStyle}>{toast.message}</div>
              </div>
              <button
                style={closeBtnStyle}
                onClick={e => {
                  e.stopPropagation()
                  removeToast(toast.id)
                }}
              >
                \u00D7
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

// Inline styles for the toast UI (avoids needing a separate CSS module since this is global)
const containerStyle = {
  position: 'fixed',
  bottom: '24px',
  right: '24px',
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  maxWidth: '380px',
  width: '100%',
  pointerEvents: 'none',
}

const toastStyle = {
  pointerEvents: 'auto',
  display: 'flex',
  alignItems: 'flex-start',
  gap: '12px',
  padding: '14px 16px',
  borderRadius: '12px',
  cursor: 'pointer',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)',
  animation: 'toastSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
  transition: 'opacity 0.2s, transform 0.2s',
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
}

const typeStyles = {
  success: {
    background: 'linear-gradient(135deg, #13162a 0%, #162a1e 100%)',
    border: '1px solid rgba(34, 201, 122, 0.3)',
  },
  error: {
    background: 'linear-gradient(135deg, #13162a 0%, #2a1620 100%)',
    border: '1px solid rgba(255, 77, 109, 0.3)',
  },
  info: {
    background: 'linear-gradient(135deg, #13162a 0%, #16202a 100%)',
    border: '1px solid rgba(78, 168, 222, 0.3)',
  },
}

const toastIconStyle = {
  fontSize: '1.4rem',
  flexShrink: 0,
  marginTop: '1px',
}

const toastBodyStyle = {
  flex: 1,
  minWidth: 0,
}

const toastTitleStyle = {
  fontWeight: 600,
  fontSize: '0.88rem',
  color: '#e8e6f0',
  marginBottom: '2px',
}

const toastMsgStyle = {
  fontSize: '0.8rem',
  color: '#b0adc8',
  lineHeight: 1.4,
}

const closeBtnStyle = {
  background: 'none',
  border: 'none',
  color: '#7a789a',
  fontSize: '1.1rem',
  cursor: 'pointer',
  padding: '0 2px',
  lineHeight: 1,
  flexShrink: 0,
}
