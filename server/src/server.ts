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


dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000
app.use(cors({ origin: ['https://naija-mart-five.vercel.app', 'http://localhost:5173'] }))
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
// app.use(cors({ origin: ['https://naija-mart-five.vercel.app', 'http://localhost:5173'] }))


if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}


export default app

