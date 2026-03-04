import React, { useState, useEffect } from 'react'
import axios from 'axios'
import styles from './AdminPages.module.css'

export default function MenuManagement() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [editItem, setEditItem] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: 'main',
    is_available: true,
    initial_stock: 50,
  })

  useEffect(() => {
    fetchMenu()
  }, [])

  async function fetchMenu() {
    try {
      const res = await axios.get('/admin/gateway/admin/menu')
      setItems(res.data.items || [])
    } catch (err) {
      console.error('Failed to fetch menu:', err)
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setEditItem(null)
    setFormData({
      name: '',
      description: '',
      price: '',
      category: 'main',
      is_available: true,
      initial_stock: 50,
    })
    setShowModal(true)
  }

  function openEdit(item) {
    setEditItem(item)
    setFormData({
      name: item.name,
      description: item.description || '',
      price: item.price,
      category: item.category,
      is_available: item.is_available,
      initial_stock: item.stock || 50,
    })
    setShowModal(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      if (editItem) {
        await axios.put(`/admin/gateway/admin/menu/${editItem.id}`, formData)
      } else {
        await axios.post('/admin/gateway/admin/menu', formData)
      }
      setShowModal(false)
      fetchMenu()
    } catch (err) {
      alert(err.response?.data?.message || 'Operation failed')
    }
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this item?')) return
    try {
      await axios.delete(`/admin/gateway/admin/menu/${id}`)
      fetchMenu()
    } catch (err) {
      alert('Delete failed')
    }
  }

  async function toggleAvailability(item) {
    try {
      await axios.put(`/admin/gateway/admin/menu/${item.id}`, { is_available: !item.is_available })
      fetchMenu()
    } catch (err) {
      alert('Update failed')
    }
  }

  async function updateStock(item, newQuantity) {
    try {
      await axios.put(`/admin/stock/admin/stock/${item.id}`, { quantity: parseInt(newQuantity) })
      fetchMenu()
    } catch (err) {
      alert('Stock update failed')
    }
  }

  if (loading) return <div className={styles.loading}>Loading menu...</div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>🍽️ Menu Management</h1>
          <p className={styles.subtitle}>Manage menu items, prices, and availability</p>
        </div>
        <button className={styles.addBtn} onClick={openNew}>
          + Add Item
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Item</th>
              <th>Category</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Available</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className={!item.is_available ? styles.unavailable : ''}>
                <td>
                  <div className={styles.itemName}>{item.name}</div>
                  <div className={styles.itemDesc}>{item.description}</div>
                </td>
                <td>
                  <span className={styles.categoryBadge}>{item.category}</span>
                </td>
                <td className={styles.price}>৳{parseFloat(item.price).toFixed(2)}</td>
                <td>
                  <input
                    type="number"
                    className={`${styles.stockInput} ${item.stock <= 10 ? styles.lowStock : ''}`}
                    value={item.stock}
                    min="0"
                    onChange={e => updateStock(item, e.target.value)}
                  />
                </td>
                <td>
                  <button
                    className={`${styles.toggleBtn} ${item.is_available ? styles.active : styles.inactive}`}
                    onClick={() => toggleAvailability(item)}
                  >
                    {item.is_available ? '✓ Yes' : '✗ No'}
                  </button>
                </td>
                <td>
                  <button className={styles.editBtn} onClick={() => openEdit(item)}>
                    Edit
                  </button>
                  <button className={styles.deleteBtn} onClick={() => handleDelete(item.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2>{editItem ? 'Edit Item' : 'Add New Item'}</h2>
            <form onSubmit={handleSubmit}>
              <label>Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
              <label>Price (৳) *</label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={e => setFormData({ ...formData, price: e.target.value })}
                required
              />
              <label>Category *</label>
              <select
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="main">Main Course</option>
                <option value="snack">Snack</option>
                <option value="beverage">Beverage</option>
                <option value="dessert">Dessert</option>
              </select>
              {!editItem && (
                <>
                  <label>Initial Stock</label>
                  <input
                    type="number"
                    value={formData.initial_stock}
                    onChange={e => setFormData({ ...formData, initial_stock: e.target.value })}
                  />
                </>
              )}
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.submitBtn}>
                  {editItem ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
