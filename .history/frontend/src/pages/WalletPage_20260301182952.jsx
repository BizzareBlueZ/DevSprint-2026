import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import { format, parseISO } from 'date-fns'
import styles from './WalletPage.module.css'
import WalletTopUp from '../components/WalletTopUp'

export default function WalletPage() {
  const { user } = useAuth()
  const [balance, setBalance]           = useState(0)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading]           = useState(true)
  const [showTopUp, setShowTopUp]       = useState(false)

  useEffect(() => { fetchWallet() }, [])

  async function fetchWallet() {
    try {
      const [balRes, txRes] = await Promise.allSettled([
        axios.get('/api/wallet/balance'),
        axios.get('/api/wallet/transactions'),
      ])
      if (balRes.status === 'fulfilled') setBalance(balRes.value.data.balance ?? 0)
      if (txRes.status  === 'fulfilled') setTransactions(txRes.value.data.transactions ?? [])
    } catch {}
    setLoading(false)
  }

  function handleTopUpSuccess(amount) {
    setShowTopUp(false)
    fetchWallet() // Refresh balance and transactions
  }

  const studentId   = user?.studentId || user?.email?.split('@')[0] || '—'
  const totalCredit = transactions.filter(t => t.type === 'credit').reduce((s, t) => s + parseFloat(t.amount), 0)
  const totalDebit  = transactions.filter(t => t.type === 'debit').reduce((s, t)  => s + parseFloat(t.amount), 0)

  return (
    <div className={styles.page}>
      {/* SmartCard */}
      <div className={styles.cardWrap}>
        <div className={styles.smartCard}>
          <div className={styles.cardShine} />
          <div className={styles.cardTop}>
            <div className={styles.chip}>
              <div className={styles.chipLines}><div /><div /><div /></div>
            </div>
            <span className={styles.cardBrand}>IUT SmartCard</span>
          </div>
          <div className={styles.cardMid}>
            <span className={styles.balanceLabel}>Available Balance</span>
            <div className={styles.balanceRow}>
              <span className={styles.currency}>৳</span>
              <span className={styles.amount}>{balance.toFixed(2)}</span>
            </div>
          </div>
          <div className={styles.cardBot}>
            <div>
              <div className={styles.cardMeta}>STUDENT ID</div>
              <div className={styles.cardMetaVal}>{studentId}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className={styles.cardMeta}>CARDHOLDER</div>
              <div className={styles.cardMetaVal}>{user?.name || 'Student'}</div>
            </div>
          </div>
          <div className={styles.circle1} />
          <div className={styles.circle2} />
        </div>

        {/* Add Money button below card */}
        <button className={styles.topUpBtn} onClick={() => setShowTopUp(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Money
        </button>
      </div>

      {/* Summary pills */}
      <div className={styles.summaryRow}>
        <div className={`${styles.summaryPill} ${styles.summaryCredit}`}>
          <div className={styles.summaryIcon}>↓</div>
          <div>
            <div className={styles.summaryLabel}>Total Credited</div>
            <div className={styles.summaryAmount}>৳{totalCredit.toFixed(2)}</div>
          </div>
        </div>
        <div className={`${styles.summaryPill} ${styles.summaryDebit}`}>
          <div className={styles.summaryIcon}>↑</div>
          <div>
            <div className={styles.summaryLabel}>Total Spent</div>
            <div className={styles.summaryAmount}>৳{totalDebit.toFixed(2)}</div>
          </div>
        </div>
        <div className={`${styles.summaryPill} ${styles.summaryCount}`}>
          <div className={styles.summaryIcon}>#</div>
          <div>
            <div className={styles.summaryLabel}>Transactions</div>
            <div className={styles.summaryAmount}>{transactions.length}</div>
          </div>
        </div>
      </div>

      {/* Transaction list */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Transaction History</h2>
        {loading ? (
          <div className={styles.loader}>
            <span className="spinner spinner-teal" />
            <span>Loading transactions…</span>
          </div>
        ) : transactions.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="5" width="20" height="14" rx="2"/>
                <line x1="2" y1="10" x2="22" y2="10"/>
              </svg>
            </div>
            <p>No transactions yet</p>
          </div>
        ) : (
          <div className={styles.txList}>
            {transactions.map((tx, i) => (
              <div key={i} className={styles.txRow} style={{ animationDelay: `${i * 30}ms` }}>
                <div className={`${styles.txBadge} ${tx.type === 'credit' ? styles.txBadgeCredit : styles.txBadgeDebit}`}>
                  {tx.type === 'credit'
                    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                  }
                </div>
                <div className={styles.txMeta}>
                  <span className={styles.txDesc}>{tx.description || 'Transaction'}</span>
                  <span className={styles.txDate}>
                    {tx.created_at ? format(parseISO(tx.created_at), 'MMM d, yyyy · h:mm a') : '—'}
                  </span>
                </div>
                <div className={styles.txRight}>
                  <span className={`${styles.txAmount} ${tx.type === 'credit' ? styles.txAmtCredit : styles.txAmtDebit}`}>
                    {tx.type === 'credit' ? '+' : '-'}৳{Math.abs(tx.amount).toFixed(2)}
                  </span>
                  {tx.balance_after != null && (
                    <span className={styles.txBal}>৳{parseFloat(tx.balance_after).toFixed(2)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Top-up modal */}
      {showTopUp && (
        <WalletTopUp
          onClose={() => setShowTopUp(false)}
          onSuccess={handleTopUpSuccess}
        />
      )}
    </div>
  )
}