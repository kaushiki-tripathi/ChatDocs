import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const AuthSuccess = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login } = useAuth()
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    const token = searchParams.get('token')
    const name = searchParams.get('name')
    const email = searchParams.get('email')
    const picture = searchParams.get('picture')

    if (token) {
      login(token, { name, email, profilePicture: picture })
      navigate('/chat', { replace: true })
    } else {
      navigate('/', { replace: true })
    }
  }, [])

  return (
    <>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0c',
          fontFamily: "'Outfit', sans-serif",
          gap: '24px',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: '2px solid rgba(167,139,250,0.15)',
            borderTopColor: '#a78bfa',
            animation: 'spin 0.8s linear infinite',
          }}
        />

        <div style={{ textAlign: 'center' }}>
          <p
            style={{
              fontSize: '16px',
              fontWeight: 400,
              color: '#e4e4e7',
              marginBottom: '6px',
            }}
          >
            Signing you in...
          </p>
          <p
            style={{
              fontSize: '13px',
              fontWeight: 300,
              color: 'rgba(255,255,255,0.35)',
            }}
          >
            Setting up your workspace
          </p>
        </div>
      </div>
    </>
  )
}

export default AuthSuccess