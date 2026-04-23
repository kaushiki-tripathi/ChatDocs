const express = require('express')
const router = express.Router()
const passport = require('passport')
const jwt = require('jsonwebtoken')

router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
)

router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.CLIENT_URL}/login?error=failed`,
    session: false
  }),
  (req, res) => {
    const token = jwt.sign(
      { userId: req.user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.redirect(
      `${process.env.CLIENT_URL}/auth/success?token=${token}&name=${req.user.name}&email=${req.user.email}&picture=${req.user.profilePicture}`
    )
  }
)

const { protect } = require('../middleware/authMiddleware')

router.get('/me', protect, async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      profilePicture: req.user.profilePicture
    }
  })
})

module.exports = router