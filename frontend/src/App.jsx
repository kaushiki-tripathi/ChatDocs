import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import {Toaster} from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import AuthSuccess from './pages/AuthSuccess'
import ChatPage from './pages/ChatPage'

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            success: {
              duration: 3000,
              style: {
                background: '#1a1a1a',
                color: '#ffffff',
                border: '1px solid rgba(74, 222, 128, 0.3)',
                borderRadius: '12px',
                fontSize: '14px',
                fontFamily: 'Outfit, sans-serif',
              },
              iconTheme: {
                primary: '#4ade80',
                secondary: '#1a1a1a',
              },
            },
            error: {
              duration: 4000,
              style: {
                background: '#1a1a1a',
                color: '#ffffff',
                border: '1px solid rgba(248, 113, 113, 0.3)',
                borderRadius: '12px',
                fontSize: '14px',
                fontFamily: 'Outfit, sans-serif',
              },
              iconTheme: {
                primary: '#f87171',
                secondary: '#1a1a1a',
              },
            },
            loading: {
              style: {
                background: '#1a1a1a',
                color: '#ffffff',
                border: '1px solid rgba(167, 139, 250, 0.3)',
                borderRadius: '12px',
                fontSize: '14px',
                fontFamily: 'Outfit, sans-serif',
              },
            },
          }}
        />
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/auth/success" element={<AuthSuccess />} />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App