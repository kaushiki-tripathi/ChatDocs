const dotenv = require('dotenv')
dotenv.config()

const express = require('express')
const cors = require('cors')
const session = require('express-session')
const connectDB = require('./config/db')
const passport = require('./config/passport')
const authRoutes = require('./routes/authRoutes')
const documentRoutes = require('./routes/documentRoutes')

connectDB()

const app = express()

app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}))

app.use(express.json())

app.use(session({
  secret: process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false
}))

app.use(passport.initialize())
app.use(passport.session())

app.use('/api/auth', authRoutes)
app.use('/api/documents', documentRoutes)

app.get('/', (req, res) => {
  res.json({ message: 'ChatDocs Backend is Running!' })
})

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})