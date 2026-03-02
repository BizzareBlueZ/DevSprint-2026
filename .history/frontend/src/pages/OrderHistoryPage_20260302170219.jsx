import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useLanguage } from '../context/LanguageContext'
import styles from './OrderHistoryPage.module.css'

export default function OrderHistoryPage() {
    const navigate = useNavigate()
    const { t } = useLanguage()
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [filters, setFilters] = useState({ status: '', search: '', from: '', to: '' })
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(0)
    const limit = 10
    
    // Review modal state
    const [reviewModal, setReviewModal] = useState(null)
    const [reviewData, setReviewData] = useState({ rating: 5, comment: '' })
    const [submitting, setSubmitting] = useState(false)

    const fetchOrders = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                limit: limit.toString(),
                offset: (page * limit).toString(),
                ...(filters.status && { status: filters.status }),
                ...(filters.search && { search: filters.search }),
                ...(filters.from && { from: filters.from }),
                ...(filters.to && { to: filters.to }),
            })
            const res = await axios.get(`/api/orders?${params}`)
            setOrders(res.data.orders)
            setTotal(res.data.total)
        } catch (err) {
            console.error('Failed to fetch orders:', err)
        } finally {
            setLoading(false)
        }
    }, [page, filters])

    useEffect(() => { fetchOrders() }, [fetchOrders])

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }))
        setPage(0)
    }

    const openReviewModal = (order) => {
        setReviewModal(order)
        setReviewData({ 
            rating: order.rating || 5, 
            comment: order.review_comment || '' 
        })
    }

    const submitReview = async () => {
        if (!reviewModal) return
        setSubmitting(true)
        try {
            await axios.post('/api/reviews', {
                orderId: reviewModal.order_id,
                rating: reviewData.rating,
                comment: reviewData.comment
            })
            setReviewModal(null)
            fetchOrders()
        } catch (err) {
            alert('Failed to submit review')
        } finally {
            setSubmitting(false)
        }
    }

    const getStatusBadge = (status) => {
        const badges = {
            'PENDING': { class: styles.badgeWarning, label: t('pending') },
            'STOCK_VERIFIED': { class: styles.badgeInfo, label: t('verified') },
            'IN_KITCHEN': { class: styles.badgeInfo, label: t('preparing') },
            'READY': { class: styles.badgeSuccess, label: t('ready') },
            'PICKED_UP': { class: styles.badgeSuccess, label: t('pickedUp') },
            'COMPLETED': { class: styles.badgeSuccess, label: t('completed') },
            'FAILED': { class: styles.badgeDanger, label: t('failed') },
        }
        const badge = badges[status] || { class: styles.badge, label: status }
        return <span className={`${styles.badge} ${badge.class}`}>{badge.label}</span>
    }

    const totalPages = Math.ceil(total / limit)

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <button className={styles.backBtn} onClick={() => navigate(-1)}>←</button>
                <h1>{t('orderHistory')}</h1>
            </header>

            {/* Filters */}
            <div className={styles.filters}>
                <input
                    type="text"
                    placeholder={t('searchItems')}
                    value={filters.search}
                    onChange={e => handleFilterChange('search', e.target.value)}
                    className={styles.searchInput}
                />
                <select
                    value={filters.status}
                    onChange={e => handleFilterChange('status', e.target.value)}
                    className={styles.select}
                >
                    <option value="">{t('allStatuses')}</option>
                    <option value="PENDING">{t('pending')}</option>
                    <option value="IN_KITCHEN">{t('preparing')}</option>
                    <option value="READY">{t('ready')}</option>
                    <option value="PICKED_UP">{t('pickedUp')}</option>
                    <option value="COMPLETED">{t('completed')}</option>
                    <option value="FAILED">{t('failed')}</option>
                </select>
                <input
                    type="date"
                    value={filters.from}
                    onChange={e => handleFilterChange('from', e.target.value)}
                    className={styles.dateInput}
                />
                <input
                    type="date"
                    value={filters.to}
                    onChange={e => handleFilterChange('to', e.target.value)}
                    className={styles.dateInput}
                />
            </div>

            {/* Orders List */}
            {loading ? (
                <div className={styles.loading}>{t('loading')}</div>
            ) : orders.length === 0 ? (
                <div className={styles.empty}>{t('noOrders')}</div>
            ) : (
                <div className={styles.ordersList}>
                    {orders.map(order => (
                        <div key={order.order_id} className={styles.orderCard}>
                            <div className={styles.orderHeader}>
                                <div className={styles.orderInfo}>
                                    <h3>{order.item_name}</h3>
                                    <span className={styles.category}>{order.category}</span>
                                </div>
                                {getStatusBadge(order.status)}
                            </div>
                            
                            <div className={styles.orderDetails}>
                                <div className={styles.detail}>
                                    <span className={styles.label}>{t('amount')}:</span>
                                    <span className={styles.value}>৳{parseFloat(order.amount).toFixed(2)}</span>
                                </div>
                                <div className={styles.detail}>
                                    <span className={styles.label}>{t('date')}:</span>
                                    <span className={styles.value}>{new Date(order.created_at).toLocaleDateString()}</span>
                                </div>
                                {order.scheduled_pickup_time && (
                                    <div className={styles.detail}>
                                        <span className={styles.label}>{t('scheduledPickup')}:</span>
                                        <span className={styles.value}>
                                            {new Date(order.scheduled_pickup_time).toLocaleTimeString()}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Rating display or Review button */}
                            <div className={styles.orderActions}>
                                {order.rating ? (
                                    <div className={styles.rating}>
                                        {'★'.repeat(order.rating)}{'☆'.repeat(5 - order.rating)}
                                        <span className={styles.ratingText}>{order.rating}/5</span>
                                    </div>
                                ) : (order.status === 'READY' || order.status === 'PICKED_UP' || order.status === 'COMPLETED') && (
                                    <button 
                                        className={styles.reviewBtn}
                                        onClick={() => openReviewModal(order)}
                                    >
                                        {t('writeReview')}
                                    </button>
                                )}
                                
                                {order.qr_code && order.status === 'READY' && (
                                    <button 
                                        className={styles.qrBtn}
                                        onClick={() => navigate(`/order/${order.order_id}`)}
                                    >
                                        {t('showQR')}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className={styles.pagination}>
                    <button 
                        disabled={page === 0}
                        onClick={() => setPage(p => p - 1)}
                    >{t('previous')}</button>
                    <span>{t('page')} {page + 1} / {totalPages}</span>
                    <button 
                        disabled={page >= totalPages - 1}
                        onClick={() => setPage(p => p + 1)}
                    >{t('next')}</button>
                </div>
            )}

            {/* Review Modal */}
            {reviewModal && (
                <div className={styles.modalBackdrop} onClick={() => setReviewModal(null)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <h2>{t('reviewOrder')}</h2>
                        <p className={styles.itemName}>{reviewModal.item_name}</p>
                        
                        <div className={styles.ratingInput}>
                            <label>{t('rating')}:</label>
                            <div className={styles.stars}>
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button
                                        key={star}
                                        className={`${styles.star} ${star <= reviewData.rating ? styles.starActive : ''}`}
                                        onClick={() => setReviewData(d => ({ ...d, rating: star }))}
                                    >
                                        ★
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <div className={styles.commentInput}>
                            <label>{t('comment')}:</label>
                            <textarea
                                value={reviewData.comment}
                                onChange={e => setReviewData(d => ({ ...d, comment: e.target.value }))}
                                placeholder={t('shareExperience')}
                                rows={3}
                            />
                        </div>
                        
                        <div className={styles.modalActions}>
                            <button className={styles.cancelBtn} onClick={() => setReviewModal(null)}>
                                {t('cancel')}
                            </button>
                            <button 
                                className={styles.submitBtn} 
                                onClick={submitReview}
                                disabled={submitting}
                            >
                                {submitting ? t('submitting') : t('submitReview')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
