import React, { useState, useEffect } from 'react'
import axios from 'axios'
import styles from './AdminPages.module.css'

export default function UserManagement() {
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedUser, setSelectedUser] = useState(null)
    const [userActivity, setUserActivity] = useState(null)
    const [activityLoading, setActivityLoading] = useState(false)

    useEffect(() => { fetchUsers() }, [])

    async function fetchUsers() {
        try {
            const res = await axios.get('/admin/identity/admin/users')
            setUsers(res.data.users || [])
        } catch (err) {
            console.error('Failed to fetch users:', err)
        } finally {
            setLoading(false)
        }
    }

    async function viewActivity(user) {
        setSelectedUser(user)
        setActivityLoading(true)
        try {
            const res = await axios.get(`/admin/identity/admin/users/${user.student_id}`)
            setUserActivity(res.data)
        } catch (err) {
            console.error('Failed to fetch user activity:', err)
        } finally {
            setActivityLoading(false)
        }
    }

    async function toggleUserStatus(user) {
        const newIsActive = !user.is_active
        try {
            await axios.put(`/admin/identity/admin/users/${user.student_id}/status`, { is_active: newIsActive })
            setUsers(users.map(u => u.student_id === user.student_id ? { ...u, is_active: newIsActive } : u))
            if (selectedUser?.student_id === user.student_id) {
                setUserActivity(prev => prev ? { ...prev, user: { ...prev.user, is_active: newIsActive } } : null)
            }
        } catch (err) {
            alert('Failed to update user status')
        }
    }

    function closeModal() {
        setSelectedUser(null)
        setUserActivity(null)
    }

    if (loading) return <div className={styles.loading}>Loading users...</div>

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>👥 User Management</h1>
                    <p className={styles.subtitle}>Manage student accounts and view activity</p>
                </div>
                <button className={styles.refreshBtn} onClick={fetchUsers}>↻ Refresh</button>
            </div>

            <div className={styles.tableWrap}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Student ID</th>
                            <th>Name</th>
                            <th>Department</th>
                            <th>Orders</th>
                            <th>Total Spent</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.student_id}>
                                <td><strong>{user.student_id}</strong></td>
                                <td>{user.name}</td>
                                <td>{user.department}</td>
                                <td>{user.order_count}</td>
                                <td className={styles.revenue}>৳{parseFloat(user.total_spent || 0).toFixed(0)}</td>
                                <td>
                                    <span className={`${styles.badge} ${user.is_active ? styles.badgeSuccess : styles.badgeDanger}`}>
                                        {user.is_active ? 'Active' : 'Suspended'}
                                    </span>
                                </td>
                                <td className={styles.actions}>
                                    <button className={styles.btnView} onClick={() => viewActivity(user)}>
                                        View Activity
                                    </button>
                                    <button 
                                        className={user.is_active ? styles.btnDanger : styles.btnSuccess}
                                        onClick={() => toggleUserStatus(user)}
                                    >
                                        {user.is_active ? 'Suspend' : 'Reactivate'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr><td colSpan="7" className={styles.empty}>No users found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* User Activity Modal */}
            {selectedUser && (
                <div className={styles.modalBackdrop} onClick={closeModal}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>User Activity: {selectedUser.name}</h2>
                            <button className={styles.closeBtn} onClick={closeModal}>×</button>
                        </div>
                        <div className={styles.modalBody}>
                            {activityLoading ? (
                                <div className={styles.loading}>Loading activity...</div>
                            ) : userActivity ? (
                                <div className={styles.activityContent}>
                                    <div className={styles.userInfo}>
                                        <p><strong>Student ID:</strong> {userActivity.user?.student_id}</p>
                                        <p><strong>Name:</strong> {userActivity.user?.name}</p>
                                        <p><strong>Department:</strong> {userActivity.user?.department}</p>
                                        <p><strong>Status:</strong> 
                                            <span className={`${styles.badge} ${userActivity.user?.is_active ? styles.badgeSuccess : styles.badgeDanger}`} style={{ marginLeft: '8px' }}>
                                                {userActivity.user?.is_active ? 'Active' : 'Suspended'}
                                            </span>
                                        </p>
                                        <p><strong>Registered:</strong> {userActivity.user?.created_at ? new Date(userActivity.user.created_at).toLocaleDateString() : '—'}</p>
                                    </div>
                                    
                                    <h3 style={{ marginTop: '1rem' }}>Recent Orders</h3>
                                    <div className={styles.tableWrap}>
                                        <table className={styles.table}>
                                            <thead>
                                                <tr>
                                                    <th>Order ID</th>
                                                    <th>Amount</th>
                                                    <th>Status</th>
                                                    <th>Date</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {userActivity.orders?.map(order => (
                                                    <tr key={order.id}>
                                                        <td>#{order.order_id || order.id}</td>
                                                        <td className={styles.revenue}>৳{parseFloat(order.amount || order.total_amount || 0).toFixed(2)}</td>
                                                        <td>
                                                            <span className={`${styles.badge} ${
                                                                order.status === 'completed' ? styles.badgeSuccess :
                                                                order.status === 'failed' ? styles.badgeDanger : styles.badgeWarning
                                                            }`}>
                                                                {order.status}
                                                            </span>
                                                        </td>
                                                        <td>{new Date(order.created_at).toLocaleDateString()}</td>
                                                    </tr>
                                                ))}
                                                {(!userActivity.orders || userActivity.orders.length === 0) && (
                                                    <tr><td colSpan="4" className={styles.empty}>No orders yet</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className={styles.modalActions}>
                                        <button 
                                            className={userActivity.user?.is_active ? styles.btnDanger : styles.btnSuccess}
                                            onClick={() => toggleUserStatus(userActivity.user)}
                                        >
                                            {userActivity.user?.is_active ? '🚫 Suspend Account' : '✅ Reactivate Account'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className={styles.error}>Failed to load activity</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
