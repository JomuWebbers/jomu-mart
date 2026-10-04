import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/authRoutes'
import productRoutes from './routes/productRoutes'
import orderRoutes from './routes/orderRoutes'
import deliveryPartnerRoutes from './routes/deliveryPartnerRoutes'
import uploadRoutes from './routes/uploadRoutes'
import streamRoutes from './routes/streamRoutes'
import userRoutes from './routes/userRoutes'
import returnRoutes from './routes/returnRoutes'
import { warmDatabaseConnection } from './lib/prisma'


dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000
// Allowed frontend origins. FRONTEND_URL is the deployed client origin and is
// already required for Paystack listing-fee callbacks, so reuse it here instead
// of hardcoding a second copy that can silently drift out of date.
const allowedOrigins = [
  'http://localhost:5173',
  // Deployed client origin after the brand rename to Jomu Mart. The old
  // naija-mart-five.vercel.app domain 301-redirects here, so it is deliberately
  // absent: the browser's Origin header follows the redirect to this host.
  'https://jomu-mart-five.vercel.app',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL.trim()] : []),
].filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    // Same-origin/curl requests arrive without an Origin header.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true)
    }
    // Deny without throwing: omitting the CORS headers makes the browser block the
    // response, and a 500 here would misreport a policy decision as a server fault.
    console.warn(`Blocked CORS request from disallowed origin: ${origin}`)
    return callback(null, false)
  },
}))
app.use(express.json())



app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' })
})

app.use('/api/auth', authRoutes)



app.use('/api/products', productRoutes)

app.use('/api/orders', orderRoutes)
app.use('/api/returns', returnRoutes) 
app.use('/api/delivery-partners', deliveryPartnerRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/chat', streamRoutes)
app.use('/api/users', userRoutes)


if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
    console.log(`CORS allowed origins: ${allowedOrigins.join(', ')}`)
    // Open the pooled connection at boot so the first customer request does
    // not pay Neon's cold-start cost and return a 500.
    void warmDatabaseConnection()
  })
}


export default app

