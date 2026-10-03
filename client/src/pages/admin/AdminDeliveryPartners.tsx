
import { useEffect, useState, type SubmitEvent } from 'react'
import { PlusIcon, TrashIcon, XIcon, LoaderCircleIcon, PhoneIcon, BikeIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/useAuth'
import { apiRequest } from '../../lib/api'

type Partner = {
  id: string
  name: string
  email: string
  phone: string
  vehicleType: string | null
  isActive: boolean
  createdAt: string
}

const VEHICLE_OPTIONS = ['bike', 'car', 'van', 'bicycle']

const EMPTY_FORM = { name: '', email: '', phone: '', vehicleType: VEHICLE_OPTIONS[0] }

export default function AdminDeliveryPartners() {
  const { token } = useAuth()
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    apiRequest('/delivery-partners', { token: token ?? undefined })
      .then(setPartners)
      .catch(() => toast.error('Failed to load delivery partners'))
      .finally(() => setLoading(false))
  }, [token])

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault()

    if (!form.name || !form.email || !form.phone) {
      toast.error('Name, email, and phone are required')
      return
    }

    setSaving(true)
    try {
      const created = await apiRequest('/delivery-partners', {
        method: 'POST',
        token: token ?? undefined,
        body: form,
      })
      setPartners(prev => [created, ...prev])
      toast.success('Delivery partner added')
      setModalOpen(false)
      setForm(EMPTY_FORM)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add delivery partner'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await apiRequest(`/delivery-partners/${id}`, { method: 'DELETE', token: token ?? undefined })
      setPartners(prev => prev.filter(p => p.id !== id))
      toast.success('Delivery partner removed')
    } catch {
      toast.error('Failed to remove delivery partner')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return <div className="p-10 text-center font-bold">Loading delivery partners…</div>
  }

  return (
    <div className="p-4 md:p-8 bg-neutral-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">Delivery Partners</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <PlusIcon className="size-4" /> Add Partner
        </button>
      </div>

      {partners.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-10 text-center text-zinc-500">
          No delivery partners yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {partners.map(p => (
            <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-full bg-indigo-500 flex items-center justify-center">
                    <span className="text-white text-sm font-semibold">{p.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-900">{p.name}</p>
                    <p className="text-xs text-zinc-500 capitalize flex items-center gap-1">
                      <BikeIcon className="size-3" /> {p.vehicleType || 'Rider'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(p.id)}
                  disabled={deletingId === p.id}
                  className="p-1.5 hover:bg-red-50 rounded-lg text-red-600 disabled:opacity-50"
                  title="Remove"
                >
                  <TrashIcon className="size-4" />
                </button>
              </div>
              <div className="mt-4 pt-4 border-t border-zinc-100 space-y-1.5">
                <p className="text-xs text-zinc-600 flex items-center gap-1.5">
                  <PhoneIcon className="size-3.5" /> {p.phone}
                </p>
                <p className="text-xs text-zinc-400">{p.email}</p>
              </div>
              <span
                className={`inline-block mt-3 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                  p.isActive ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'
                }`}
              >
                {p.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={() => setModalOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-zinc-900">Add Delivery Partner</h3>
                <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-zinc-100 rounded-lg">
                  <XIcon className="size-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="text"
                  placeholder="Full name"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
                />
                <input
                  type="text"
                  placeholder="Phone number"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
                />
                <select
                  value={form.vehicleType}
                  onChange={e => setForm({ ...form, vehicleType: e.target.value })}
                  className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500 capitalize"
                >
                  {VEHICLE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <LoaderCircleIcon className="size-4 animate-spin" /> Adding…
                    </>
                  ) : (
                    'Add Partner'
                  )}
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  )
}





