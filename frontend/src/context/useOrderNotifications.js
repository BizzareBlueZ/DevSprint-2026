import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'

/**
 * Hook that maintains a global Socket.IO connection for the authenticated student.
 * Joins a student-level room so order-status broadcasts (especially READY)
 * trigger toast notifications regardless of which page the student is on.
 *
 * Mount this once inside a component that is rendered for all authenticated routes
 * (e.g. DashboardLayout).
 */
export function useOrderNotifications() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const socketRef = useRef(null)

  const socketUrl = (import.meta.env.VITE_SOCKET_URL || window.location.origin).replace(/\/$/, '')
  const socketPath = import.meta.env.VITE_SOCKET_PATH || '/socket.io'

  useEffect(() => {
    const studentId = user?.studentId
    if (!studentId) return

    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      path: socketPath,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join-student', { studentId })
    })

    socket.on('order-status', (data) => {
      if (data.status === 'READY') {
        const itemName = data.orderInfo?.itemName || 'Your meal'
        const shortId = data.orderId?.slice(0, 8).toUpperCase() || ''
        addToast(
          `${itemName} is ready for pickup! Order #${shortId}`,
          {
            type: 'success',
            title: 'Meal Ready!',
            onClick: () => navigate(`/order/${data.orderId}`),
          }
        )
      }
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [user?.studentId, addToast, navigate])
}
