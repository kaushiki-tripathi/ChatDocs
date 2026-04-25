import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";
import LoginBackground from "../components/login/LoginBackground";
import LoginCard from "../components/login/LoginCard";
import "../styles/login.css";

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, delay } },
});

const stats = ["Free forever", "AI powered", "100% private"];

const LoginPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user) navigate("/chat");
  }, [user, navigate]);

  const handleGoogleLogin = () => {
    window.location.href = "http://localhost:5000/api/auth/google";
  };

  if (loading) {
    return (
      <div className="login-loading">
        <div className="login-spinner" />
      </div>
    );
  }

  return (
    <div className="login-page">
      <LoginBackground />
      {/* ── Top Left Logo ── */}
<motion.div
  {...fade(0)}
  style={{
    position: 'absolute',
    top: '28px',
    left: '32px',
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  }}
>
  {/* Logo Image */}
  <img
    src="/logo.png"
    alt="ChatDocs"
    style={{
      width: '48px',
      height: '48px',
      borderRadius: '12px',
      objectFit: 'contain',
    }}
  />

  {/* Name + Tagline */}
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    <span
      style={{
        fontFamily: "'Fraunces', serif",
        fontSize: '22px',
        fontWeight: 400,
        fontStyle: 'italic',
        color: '#6a23e6',
        letterSpacing: '0.02em',
        lineHeight: 1.2,
      }}
    >
      ChatDocs
    </span>
    <span
      style={{
        fontFamily: "'Outfit', sans-serif",
        fontSize: '12px',
        fontWeight: 400,
        color: '#474f58',
        letterSpacing: '0.03em',
      }}
    >
      Chat with Your Documents
    </span>
  </div>
</motion.div>

      <div className="login-content">
        {/* Heading */}
        <motion.div {...fade(0.1)} style={{ marginBottom: 12 }}>
          <h1 className="login-heading">Chat with your</h1>
          <h1 className="login-heading login-heading--gradient">documents.</h1>
        </motion.div>

        {/* Subtext */}
        <motion.p {...fade(0.2)} className="login-subtext">
          Upload any PDF and get instant answers.<br></br>
          No searching, just asking.
        </motion.p>

        {/* Card */}
        <LoginCard onGoogleLogin={handleGoogleLogin} />

        {/* Stats */}
        <motion.div {...fade(0.7)} className="login-stats">
          {stats.map((item) => (
            <div key={item} className="login-stat">
              <span className="login-stat__dot">✦</span>
              <span className="login-stat__text">{item}</span>
            </div>
          ))}
        </motion.div>

        {/* Terms */}
        <motion.p {...fade(0.8)} className="login-terms">
          By continuing, you agree to our <a href="#">Terms</a> and{" "}
          <a href="#">Privacy Policy</a>
        </motion.p>
      </div>
    </div>
  );
};

export default LoginPage;
