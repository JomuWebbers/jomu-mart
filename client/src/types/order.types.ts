export type OrderItem = {
  productId?: string
  name?: string
  qty?: number
  price?: number
  image?: string
}

export type Order = {
  id: string
  total: number
  status: string
  createdAt: string
  items: OrderItem[]
  statusHistory?: { status: string; at: string }[]
  returnRequests?: any[]
}