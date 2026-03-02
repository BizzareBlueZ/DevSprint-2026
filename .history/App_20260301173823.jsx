import AdminDashboard from './pages/AdminDashboard'  // ← add this import at the top

// Then inside <Routes>, add this one line:
<Route path="admin" element={<AdminDashboard />} />