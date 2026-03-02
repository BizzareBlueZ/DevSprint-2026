import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import axios from 'axios'
import { format, parseISO } from 'date-fns'
import styles from './WalletPage.module.css'
import WalletTopUp from '../components/WalletTopUp'

export default function WalletPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [balance, setBalance]           = useState(0)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading]           = useState(true)
  const [showTopUp, setShowTopUp]       = useState(false)

  // Emergency balance state
  const [emergencyStatus, setEmergencyStatus] = useState({ outstanding: 0, available: 1000, limit: 1000 })
  const [showEmergency, setShowEmergency]     = useState(false)
  const [emergencyAmount, setEmergencyAmount] = useState('')
  const [emergencyReason, setEmergencyReason] = useState('')
  const [emergencyLoading, setEmergencyLoading] = useState(false)
  const [emergencyError, setEmergencyError]     = useState('')
  const [emergencySuccess, setEmergencySuccess] = useState('')

  useEffect(() => { fetchWallet() }, [])

  async function fetchWallet() {
    try {
      const [balRes, txRes, emRes] = await Promise.allSettled([
        axios.get('/api/wallet/balance'),
        axios.get('/api/wallet/transactions'),
        axios.get('/api/wallet/emergency/status'),
      ])
      if (balRes.status === 'fulfilled') setBalance(balRes.value.data.balance ?? 0)
      if (txRes.status  === 'fulfilled') setTransactions(txRes.value.data.transactions ?? [])
      if (emRes.status  === 'fulfilled') setEmergencyStatus(emRes.value.data)
    } catch {}
    setLoading(false)
  }

  function handleTopUpSuccess(amount) {
    setShowTopUp(false)
    fetchWallet() // Refresh balance and transactions
  }

  async function handleEmergencyRequest(e) {
    e.preventDefault()
    setEmergencyError('')
    setEmergencySuccess('')
    const amt = parseFloat(emergencyAmount)
    if (!amt || amt < 10) { setEmergencyError(t('minEmergency') || 'Minimum ৳10'); return }
    if (amt > emergencyStatus.available) {
      setEmergencyError(`${t('maxEmergency') || 'Maximum available'}: ৳${emergencyStatus.available.toFixed(2)}`)
      return
    }
    setEmergencyLoading(true)
    try {
      const res = await axios.post('/api/wallet/emergency/request', {
        amount: amt,
        reason: emergencyReason || undefined,
      })
      setEmergencySuccess(res.data.message || t('emergencySuccess') || 'Emergency balance added!')
      setEmergencyAmount('')
      setEmergencyReason('')
      setTimeout(() => {
        setShowEmergency(false)
        setEmergencySuccess('')
        fetchWallet()
      }, 1500)
    } catch (err) {
      setEmergencyError(err.response?.data?.message || t('error'))
    } finally {
      setEmergencyLoading(false)
    }
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
        <div className={styles.walletActions}>
          <button className={styles.topUpBtn} onClick={() => setShowTopUp(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {t('addFunds') || 'Add Money'}
          </button>
          <button className={styles.emergencyBtn} onClick={() => setShowEmergency(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 9v4"/>
              <path d="M12 17h.01"/>
              <path d="M3.6 9h16.8L12 2.1 3.6 9z"/>
              <path d="M4 9v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/>
            </svg>
            {t('emergencyBalance') || 'Emergency Balance'}
          </button>
        </div>
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

      {/* Emergency Balance Modal */}
      {showEmergency && (
        <div className={styles.emergencyOverlay} onClick={(e) => e.target === e.currentTarget && setShowEmergency(false)}>
          <div className={styles.emergencyModal}>
            <div className={styles.emergencyHeader}>
              <h3>{t('emergencyBalance') || 'Emergency Balance'}</h3>
              <button className={styles.emergencyClose} onClick={() => setShowEmergency(false)}>✕</button>
            </div>

            <div className={styles.emergencyInfo}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p>{t('emergencyDesc') || 'Take an advance from your IUT monthly allowance. This amount will be automatically deducted from your next bank allowance.'}</p>
            </div>

            <div className={styles.emergencyStats}>
              <div className={styles.emergencyStat}>
                <span className={styles.emergencyStatLabel}>{t('emergencyLimit') || 'Limit'}</span>
                <span className={styles.emergencyStatVal}>৳{emergencyStatus.limit?.toFixed(2)}</span>
              </div>
              <div className={styles.emergencyStat}>
                <span className={styles.emergencyStatLabel}>{t('emergencyOutstanding') || 'Outstanding'}</span>
                <span className={styles.emergencyStatValRed}>৳{emergencyStatus.outstanding?.toFixed(2)}</span>
              </div>
              <div className={styles.emergencyStat}>
                <span className={styles.emergencyStatLabel}>{t('emergencyAvailable') || 'Available'}</span>
                <span className={styles.emergencyStatValGreen}>৳{emergencyStatus.available?.toFixed(2)}</span>
              </div>
            </div>

            <form onSubmit={handleEmergencyRequest} className={styles.emergencyForm}>
              <div className={styles.emergencyField}>
                <label>{t('amount') || 'Amount'} (BDT)</label>
                <div className={styles.emergencyInputWrap}>
                  <span>৳</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    min="10"
                    max={emergencyStatus.available}
                    value={emergencyAmount}
                    onChange={e => setEmergencyAmount(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className={styles.emergencyQuickAmounts}>
                  {[100, 200, 500, 1000].filter(a => a <= emergencyStatus.available).map(a => (
                    <button key={a} type="button" className={styles.emergencyQuickBtn}
                      onClick={() => setEmergencyAmount(String(a))}>৳{a}</button>
                  ))}
                </div>
              </div>

              <div className={styles.emergencyField}>
                <label>{t('emergencyReason') || 'Reason (optional)'}</label>
                <input
                  type="text"
                  placeholder={t('emergencyReasonPlaceholder') || 'e.g. Need lunch money urgently'}
                  value={emergencyReason}
                  onChange={e => setEmergencyReason(e.target.value)}
                />
              </div>

              {emergencyError && <p className={styles.emergencyError}>{emergencyError}</p>}
              {emergencySuccess && <p className={styles.emergencySuccessMsg}>{emergencySuccess}</p>}

              <button type="submit" className={styles.emergencySubmitBtn}
                disabled={emergencyLoading || !emergencyAmount || parseFloat(emergencyAmount) < 10}>
                {emergencyLoading ? <span className="spinner" /> : `${t('emergencyTake') || 'Take'} ৳${emergencyAmount || '0'}`}
              </button>

              <p className={styles.emergencyNote}>
                {t('emergencyNote') || '⚠️ This amount will be deducted from your next IUT monthly allowance.'}
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}