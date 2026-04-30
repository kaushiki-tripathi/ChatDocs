const dotenv = require('dotenv')
dotenv.config()


const fs = require('fs')
const path = require('path')
const express = require('express')
const cors = require('cors')
const session = require('express-session')
const connectDB = require('./config/db')
const passport = require('./config/passport')
const authRoutes = require('./routes/authRoutes')
const documentRoutes = require('./routes/documentRoutes')
const chatRoutes = require('./routes/chatRoutes')


const uploadsDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
  console.log('Uploads folder created')
}

connectDB()

const app = express()

app.use(cors({
  origin: [
    process.env.CLIENT_URL,
    'http://localhost:5173',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
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
app.use('/api/chat', chatRoutes)

app.get('/', (req, res) => {
  res.json({ message: 'ChatDocs Backend is Running!' })
})

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})