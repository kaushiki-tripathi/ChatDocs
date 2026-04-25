import { motion } from 'framer-motion'
import GoogleIcon from '../icons/GoogleIcon'

const features = [
  ['📄', 'Upload any PDF', 'Textbooks, manuals, contracts — anything'],
  ['💬', 'Ask in English', 'No keywords needed, just natural questions'],
  ['📍', 'Answers with page numbers', 'Every answer cites the exact source page'],
]

const LoginCard = ({ onGoogleLogin }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.3 }}
    className="login-card"
  >
    {/* Google Button */}
    <motion.button
      onClick={onGoogleLogin}
      whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(167,139,250,0.15)' }}
      whileTap={{ y: 0 }}
      className="login-google-btn"
    >
      <GoogleIcon />
      Continue with Google
    </motion.button>

    {/* Divider */}
    <div className="login-divider">
      <div className="login-divider__line" />
      <span className="login-divider__text">Why Chatdocs?</span>
      <div className="login-divider__line" />
    </div>

    {/* Features */}
    <div className="login-features">
      {features.map(([icon, title, desc], i) => (
        <motion.div
          key={title}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.5 + i * 0.1 }}
          className="login-feature"
        >
          <span className="login-feature__icon">{icon}</span>
          <div>
            <p className="login-feature__title">{title}</p>
            <p className="login-feature__desc">{desc}</p>
          </div>
        </motion.div>
      ))}
    </div>
  </motion.div>
)

export default LoginCard