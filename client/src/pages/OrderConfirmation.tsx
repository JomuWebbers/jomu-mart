
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { MicroLabel, Divider } from '../components/wireframe-primitives'
import { fmt } from '../components/wireframe-helpers'
import { useAuth } from '../context/useAuth'
import { apiRequest } from '../lib/api'

type OrderItem = { productId: string; name: string; price: number; qty: number }
type ShippingAddress = { name: string; phone: string; address: string; city: string; state: string }

type Order = {
  id: string
  items: OrderItem[]
  shippingAddress: ShippingAddress
  paymentMethod: string
  subtotal: number
  deliveryFee: number
  total: number
  status: string
  isPaid: boolean
  createdAt: string
}

export default function OrderConfirmation() {
  const { id } = useParams()
  const { token } = useAuth()
  const [order, setOrder] = useState<Order | null>(null)
  const [notFound, setNotFound] = useState(false)
    const [copiedId, setCopiedId] = useState(false);

  async function copyOrderId() {
    try {
      await navigator.clipboard.writeText(order?.id || id || "");
      setCopiedId(true);
      window.setTimeout(() => setCopiedId(false), 2000);
    } catch {
      setCopiedId(false);
    }
  }

  useEffect(() => {
    if (!id) return
    apiRequest(`/orders/${id}`, { token: token ?? undefined })
      .then(data => setOrder(data))
      .catch(() => setNotFound(true))
  }, [id, token])

  if (notFound) {
    return (
      <div className="p-10 text-center">
        <p className="font-bold mb-4">Order not found.</p>
        <Link to="/" className="underline font-bold">Back to Home</Link>
      </div>
    )
  }

  if (!order) {
    return <div className="p-10 text-center font-bold">Loading order…</div>
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <div className="w-16 h-16 rounded-full bg-black text-white flex items-center justify-center mx-auto mb-4 text-2xl font-black">
          ✓
        </div>
        <h1 className="font-black uppercase text-2xl mb-2">Order Placed!</h1>
              <p className="text-neutral-500 text-sm">
          Order #{order.id.slice(-8).toUpperCase()}
        </p>
        <p className="mx-auto mt-3 max-w-md break-all font-mono text-xs text-neutral-600">
          Full order ID: {order.id}
        </p>
        <button
          type="button"
          onClick={() => void copyOrderId()}
          className="mt-3 border-2 border-black px-4 py-2 text-xs font-bold uppercase"
        >
          {copiedId ? "Copied" : "Copy full order ID"}
        </button>
      </div>

      <div className="border-2 border-black p-5 mb-6">
        <MicroLabel>Delivery Address</MicroLabel>
        <p className="text-[14px] font-semibold mt-2">{order.shippingAddress.name}</p>
        <p className="text-[13px] text-neutral-600">{order.shippingAddress.phone}</p>
        <p className="text-[13px] text-neutral-600">
          {order.shippingAddress.address}, {order.shippingAddress.city}, {order.shippingAddress.state}
        </p>
      </div>

      <div className="border-2 border-black p-5 mb-6">
        <MicroLabel>Items</MicroLabel>
        <div className="mt-3 space-y-2">
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between text-[13px]">
              <span>{item.name} × {item.qty}</span>
              <span className="font-bold">{fmt(item.price * item.qty)}</span>
            </div>
          ))}
        </div>
        <Divider />
        <div className="mt-3 space-y-1 text-[13px]">
          <div className="flex justify-between text-neutral-500">
            <span>Subtotal</span><span>{fmt(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-neutral-500">
            <span>Delivery Fee</span><span>{fmt(order.deliveryFee)}</span>
          </div>
          <div className="flex justify-between font-black text-[15px] mt-2">
            <span>Total</span><span>{fmt(order.total)}</span>
          </div>
        </div>
      </div>

      <div className="border-2 border-black p-5 mb-8 flex justify-between items-center">
        <div>
          <MicroLabel>Payment Method</MicroLabel>
          <p className="text-[13px] font-bold mt-1">{order.paymentMethod}</p>
        </div>
        <span className={`text-[10px] font-black uppercase px-2 py-1 ${order.isPaid ? 'bg-black text-white' : 'bg-neutral-200'}`}>
          {order.isPaid ? 'Paid' : 'Unpaid'}
        </span>
      </div>

      {/* <Link to="/" className="block w-full py-4 text-center bg-black text-white text-[11px] tracking-[0.2em] uppercase font-black">
        Continue Shopping
      </Link> */}
            <div className="grid gap-3 sm:grid-cols-2">
        <Link
          to={`/track/${encodeURIComponent(order.id)}`}
          className="block bg-black py-4 text-center text-xs font-bold uppercase tracking-widest text-white"
        >
          Track This Order
        </Link>
        <Link
          to="/my-orders"
          className="block border-2 border-black py-4 text-center text-xs font-bold uppercase tracking-widest"
        >
          View My Orders
        </Link>
      </div>
    </div>
  )
}



