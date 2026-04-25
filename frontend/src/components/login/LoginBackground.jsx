const LoginBackground = () => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      zIndex: 0,
      backgroundImage: "url('/bg.jpg')",
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }}
  >
    {/* Soft overlay (important) */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(255, 255, 255, 0.25)', // 🔥 reduced
        backdropFilter: 'blur(1.5px)', // 🔥 softer blur
      }}
    />
  </div>
)

export default LoginBackground