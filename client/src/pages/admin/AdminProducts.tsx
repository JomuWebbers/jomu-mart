
import { useEffect, useState } from 'react'
import { PlusIcon, PencilIcon, TrashIcon, EyeIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/useAuth'
import { apiRequest } from '../../lib/api'
import ProductFormModal, { type Product } from '../../components/admin/ProductFormModal'

export default function AdminProducts() {
  const { token } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ mode: 'create' | 'edit' | 'view'; product: Product | null } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    apiRequest('/products/admin', { token: token ?? undefined })
      .then(setProducts)
      .catch(() => toast.error('Failed to load products'))
      .finally(() => setLoading(false))
  }, [token])

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await apiRequest(`/products/${id}`, { method: 'DELETE', token: token ?? undefined })
      setProducts(prev => prev.filter(p => p.id !== id))
      toast.success('Product deleted')
    } catch {
      toast.error('Failed to delete product')
    } finally {
      setDeletingId(null)
    }
  }

  const handleSaved = (saved: Product) => {
    setProducts(prev => {
      const exists = prev.some(p => p.id === saved.id)
      return exists ? prev.map(p => (p.id === saved.id ? saved : p)) : [saved, ...prev]
    })
  }

  if (loading) {
    return <div className="p-10 text-center font-bold">Loading products…</div>
  }

  return (
    <div className="p-4 md:p-8 bg-neutral-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">Products</h1>
        <button
          onClick={() => setModal({ mode: 'create', product: null })}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <PlusIcon className="size-4" /> Add Product
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-zinc-50 text-zinc-500 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Stock</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                    No products yet.
                  </td>
                </tr>
              ) : (
                products.map(p => (
                  <tr key={p.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={p.image}
                          alt={p.name}
                          className="size-10 rounded-lg object-cover bg-zinc-100"
                          onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden' }}
                        />
                        <p className="font-medium text-zinc-900">{p.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-zinc-600">{p.category}</td>
                    <td className="px-6 py-4 font-medium">₦{p.price.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={p.stock === 0 ? 'text-red-600 font-medium' : 'text-zinc-600'}>
                        {p.stock ?? 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 capitalize text-zinc-600">{p.status || 'unknown'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setModal({ mode: 'view', product: p })}
                          className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-500"
                          title="View"
                        >
                          <EyeIcon className="size-4" />
                        </button>
                        <button
                          onClick={() => setModal({ mode: 'edit', product: p })}
                          className="p-1.5 hover:bg-zinc-100 rounded-lg text-indigo-600"
                          title="Edit"
                        >
                          <PencilIcon className="size-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          disabled={deletingId === p.id}
                          className="p-1.5 hover:bg-zinc-100 rounded-lg text-red-600 disabled:opacity-50"
                          title="Delete"
                        >
                          <TrashIcon className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && modal.mode !== 'view' && (
        <ProductFormModal
          mode={modal.mode}
          product={modal.product}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {modal && modal.mode === 'view' && modal.product && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={() => setModal(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
              <img
                src={modal.product.image}
                alt={modal.product.name}
                className="w-full h-48 object-cover rounded-xl bg-zinc-100 mb-4"
              />
              <h3 className="text-lg font-semibold text-zinc-900">{modal.product.name}</h3>
              <p className="text-sm text-zinc-500 mt-1">{modal.product.category}</p>
              <p className="text-sm text-zinc-600 mt-3">{modal.product.description || 'No description.'}</p>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-100">
                <span className="font-semibold">₦{modal.product.price.toLocaleString()}</span>
                <span className="text-sm text-zinc-500">Stock: {modal.product.stock ?? 0}</span>
              </div>
              <button
                onClick={() => setModal(null)}
                className="w-full mt-5 py-2.5 bg-zinc-100 rounded-xl text-sm font-medium hover:bg-zinc-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}




