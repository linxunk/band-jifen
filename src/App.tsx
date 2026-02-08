import { BrowserRouter, Routes, Route } from 'react-router-dom'
import UserPage from './pages/UserPage'
import AdminPage from './pages/AdminPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UserPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
