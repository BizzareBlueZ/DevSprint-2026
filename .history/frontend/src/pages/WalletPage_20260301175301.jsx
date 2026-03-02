import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import { format, parseISO } from 'date-fns'
import styles from './WalletPage.module.css'

export default function WalletPage() {
  const { user } = useAuth()
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchWallet() {
      try {
        const [balRes, txRes] = await Promise.allSettled([
          axios.get('/api/wallet/balance'),
          axios.get('/api/wallet/transactions'),
        ])
        if (balRes.status === 'fulfilled') setBalance(balRes.value.data.balance ?? 0)
        if (txRes.status === 'fulfilled') setTransactions(txRes.value.data.transactions ?? [])
      } catch {}
      setLoading(false)
    }
    fetchWallet()
  }, [])

  const studentId = user?.studentId || user?.email?.split('@')[0] || '—'

  return (
    <div className={styles.page}>
      {/* SmartCard display */}
      <div className={styles.smartCard}>
        <div className={styles.cardTop}>
          <div className={styles.cardChip}>
            <div className={styles.chipInner} />
          </div>
          <span className={styles.cardLabel}>IUT SmartCard</span>
        </div>
        <div className={styles.cardBalance}>
          <span className={styles.currency}>৳</span>
          <span className={styles.amount}>{balance.toFixed(2)}</span>
        </div>
        <div className={styles.cardBottom}>
          <span className={styles.cardStudentId}>{studentId}</span>
          <span className={styles.cardName}>{user?.name || 'Student'}</span>
        </div>
      </div>

      {/* Transactions */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Transaction History</h2>
        {loading ? (
          <div className={styles.loadingBox}>
            <span className="spinner spinner-teal" />
          </div>
        ) : transactions.length === 0 ? (
          <div className={styles.emptyBox}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="1.5">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            <span>No transactions yet</span>
          </div>
        ) : (
          <div className={styles.txList}>
            {transactions.map((tx, i) => (
              <div key={i} className={styles.txItem}>
                <div className={`${styles.txIcon} ${tx.type === 'credit' ? styles.txCredit : styles.txDebit}`}>
                  {tx.type === 'credit' ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
                  )}
                </div>
                <div className={styles.txInfo}>
                  <span className={styles.txDesc}>{tx.description || 'Transaction'}</span>
                  <span className={styles.txDate}>
                    {tx.created_at ? format(parseISO(tx.created_at), 'MMM d, yyyy · h:mm a') : '—'}
                  </span>
                </div>
                <span className={`${styles.txAmount} ${tx.type === 'credit' ? styles.txAmountCredit : styles.txAmountDebit}`}>
                  {tx.type === 'credit' ? '+' : '-'}৳{Math.abs(tx.amount).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
