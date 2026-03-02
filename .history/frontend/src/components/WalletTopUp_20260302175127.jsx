import React, { useState } from 'react'
import axios from 'axios'
import styles from './WalletTopUp.module.css'
import { sanitizePhoneNumber, sanitizeAmount, validateOTP, escapeHtml } from '../utils/sanitization'

const METHODS = [
  { id: 'bkash',   label: 'bKash',   color: '#E2136E', bg: '#fdf0f6', icon: '📱' },
  { id: 'nagad',   label: 'Nagad',   color: '#F15A22', bg: '#fff4f0', icon: '💳' },
  { id: 'rocket',  label: 'Rocket',  color: '#8B2FC9', bg: '#f5f0fd', icon: '🚀' },
  { id: 'bank',    label: 'Bank',    color: '#1d4ed8', bg: '#eff6ff', icon: '🏦' },
]

const QUICK_AMOUNTS = [50, 100, 200, 500]

export default function WalletTopUp({ onClose, onSuccess }) {
  const [step, setStep]         = useState('form')   // 'form' | 'otp' | 'success'
  const [method, setMethod]     = useState(null)
  const [amount, setAmount]     = useState('')
  const [phone, setPhone]       = useState('')
  const [otp, setOtp]           = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const selectedMethod = METHODS.find(m => m.id === method)

  async function handleProceed(e) {
    e.preventDefault()
    setError('')
    if (!method) { setError('Please select a payment method.'); return }
    
    // Sanitize amount
    const sanitizedAmount = sanitizeAmount(amount)
    if (!sanitizedAmount || sanitizedAmount < 10) { 
      setError('Minimum top-up is ৳10.'); 
      return 
    }
    
    if (method !== 'bank' && !phone) { 
      setError('Please enter your mobile number.'); 
      return 
    }
    
    // Validate phone if provided
    if (phone && method !== 'bank') {
      const sanitizedPhone = sanitizePhoneNumber(phone)
      if (sanitizedPhone.length < 10) {
        setError('Please enter a valid phone number.')
        return
      }
      setPhone(sanitizedPhone)
    }
    
    // Simulate OTP step
    setStep('otp')
  }

  async function handleConfirm(e) {
    e.preventDefault()
    setError('')
    
    // Validate OTP format
    if (!validateOTP(otp)) { 
      setError('Enter the 4-6 digit OTP sent to your number.'); 
      return 
    }
    
    setLoading(true)
    try {
      const sanitizedAmount = sanitizeAmount(amount)
      if (!sanitizedAmount) throw new Error('Invalid amount')
      
      // Token is automatically sent via httpOnly cookie with withCredentials: true
      const response = await axios.post('/api/wallet/topup', {
        amount: sanitizedAmount,
        method,
        reference: `${String(method).toUpperCase()}-${Date.now()}`,
        phone: method !== 'bank' ? sanitizePhoneNumber(phone) : undefined,
        otp: String(otp).replace(/\D/g, ''),
      })
      
      setStep('success')
      setTimeout(() => {
        onSuccess && onSuccess(sanitizedAmount)
      }, 1800)
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Top-up failed. Please try again.'
      setError(escapeHtml(errorMessage))
      console.error('Wallet top-up error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.modalHeader}>
          {step !== 'form' && step !== 'success' && (
            <button className={styles.backBtn} onClick={() => { setStep('form'); setOtp(''); setError('') }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
          )}
          <div className={styles.modalTitle}>
            {step === 'form'    && 'Add Money'}
            {step === 'otp'     && 'Verify Payment'}
            {step === 'success' && 'Payment Successful'}
          </div>
          {step !== 'success' && (
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          )}
        </div>

        {/* ── Step 1: Form ── */}
        {step === 'form' && (
          <form onSubmit={handleProceed} className={styles.body}>
            {/* Amount */}
            <div className={styles.section}>
              <label className={styles.sectionLabel}>Amount (BDT)</label>
              <div className={styles.amountWrap}>
                <span className={styles.currencySymbol}>৳</span>
                <input
                  className={styles.amountInput}
                  type="number"
                  placeholder="0.00"
                  min="10"
                  max="5000"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  autoFocus
                />
              </div>
              <div className={styles.quickAmounts}>
                {QUICK_AMOUNTS.map(q => (
                  <button
                    key={q}
                    type="button"
                    className={`${styles.quickBtn} ${parseFloat(amount) === q ? styles.quickBtnActive : ''}`}
                    onClick={() => setAmount(String(q))}
                  >
                    ৳{q}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment method */}
            <div className={styles.section}>
              <label className={styles.sectionLabel}>Payment Method</label>
              <div className={styles.methodGrid}>
                {METHODS.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    className={`${styles.methodCard} ${method === m.id ? styles.methodCardActive : ''}`}
                    style={method === m.id ? { borderColor: m.color, background: m.bg } : {}}
                    onClick={() => { setMethod(m.id); setError('') }}
                  >
                    <span className={styles.methodIcon}>{m.icon}</span>
                    <span className={styles.methodLabel}>{m.label}</span>
                    {method === m.id && (
                      <div className={styles.methodCheck} style={{ background: m.color }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Phone (for mobile banking) */}
            {method && method !== 'bank' && (
              <div className={styles.section}>
                <label className={styles.sectionLabel}>{selectedMethod?.label} Number</label>
                <div className={styles.phoneWrap}>
                  <span className={styles.phoneFlag}>🇧🇩 +880</span>
                  <input
                    className={styles.phoneInput}
                    type="tel"
                    placeholder="1XXXXXXXXX"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    maxLength={10}
                  />
                </div>
              </div>
            )}

            {method === 'bank' && (
              <div className={styles.bankNote}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                Transfer to IUT Cafeteria A/C: <strong>1234-5678-90</strong> (Dutch Bangla Bank)
              </div>
            )}

            {error && <p className={styles.error}>{error}</p>}

            <button
              type="submit"
              className={styles.proceedBtn}
              disabled={!amount || !method}
              style={selectedMethod ? { background: selectedMethod.color } : {}}
            >
              Proceed to Pay ৳{amount || '0'}
            </button>
          </form>
        )}

        {/* ── Step 2: OTP ── */}
        {step === 'otp' && (
          <form onSubmit={handleConfirm} className={styles.body}>
            <div className={styles.otpInfo}>
              <div className={styles.otpIcon}>{selectedMethod?.icon}</div>
              <div>
                <div className={styles.otpTitle}>OTP sent to {phone ? `+880${phone}` : 'your number'}</div>
                <div className={styles.otpSub}>via {selectedMethod?.label} • expires in 3:00</div>
              </div>
            </div>

            <div className={styles.section}>
              <label className={styles.sectionLabel}>Enter OTP</label>
              <input
                className={`${styles.amountInput} ${styles.otpInput}`}
                type="text"
                placeholder="• • • • • •"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                autoFocus
              />
              <p className={styles.otpHint}>For demo: enter any 6 digits</p>
            </div>

            <div className={styles.summaryBox}>
              <div className={styles.summaryRow}>
                <span>Amount</span>
                <span className={styles.summaryVal}>৳{parseFloat(amount).toFixed(2)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Method</span>
                <span className={styles.summaryVal}>{selectedMethod?.label}</span>
              </div>
              <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                <span>You receive</span>
                <span className={styles.summaryVal}>৳{parseFloat(amount).toFixed(2)}</span>
              </div>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button
              type="submit"
              className={styles.proceedBtn}
              disabled={otp.length < 6 || loading}
              style={selectedMethod ? { background: selectedMethod.color } : {}}
            >
              {loading ? <span className="spinner" /> : `Confirm ৳${parseFloat(amount).toFixed(2)}`}
            </button>
          </form>
        )}

        {/* ── Step 3: Success ── */}
        {step === 'success' && (
          <div className={styles.successBody}>
            <div className={styles.successRing}>
              <div className={styles.successCheck}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
            </div>
            <div className={styles.successAmount}>৳{parseFloat(amount).toFixed(2)}</div>
            <div className={styles.successTitle}>Added to your wallet!</div>
            <div className={styles.successSub}>
              via {selectedMethod?.label} · Your balance has been updated
            </div>
          </div>
        )}
      </div>
    </div>
  )
}