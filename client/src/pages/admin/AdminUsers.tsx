import { useEffect, useState, useCallback } from 'react'
import { ShieldCheckIcon, ClockIcon, CheckIcon, XIcon, WalletIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/useAuth'
import { apiRequest } from '../../lib/api'

type UserRow = {
  id: string
  name: string
  email: string
  phone: string
  accountBalance: number
  isTrustedVendor: boolean
  trustedVendorRequestStatus: string
  trustedVendorBusinessName: string | null
  trustedVendorCategories: string[]
  trustedVendorLocation: string | null
  trustedVendorDescription: string | null
  trustedVendorWebsite: string | null
  trustedVendorRequestedAt: string | null
  trustedVendorRejectionReason: string | null
  accountDeletionRequestedAt: string | null
  createdAt: string
}

type FilterMode = 'all' | 'pending' | 'trusted' | 'deletion'

export default function AdminUsers() {
  const { token } = useAuth()
  const [users, setUsers] = useState<UserRow[] | null>(null)
  const [filter, setFilter] = useState<FilterMode>('all')
  const [actingId, setActingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  const fetchUsers = useCallback((mode: FilterMode) => {
    const query = mode === 'pending'
      ? '?pendingOnly=true'
      : mode === 'trusted'
        ? '?trustedOnly=true'
        : mode === 'deletion'
          ? '?deletionRequestedOnly=true'
          : ''
    apiRequest(`/users${query}`, { token: token ?? undefined })
      .then(setUsers)
      .catch(() => toast.error('Failed to load users'))
  }, [token])

  useEffect(() => {
    fetchUsers(filter)
  }, [filter, fetchUsers])

  const handleReview = async (
    id: string,
    approve: boolean,
    reason?: string,
  ) => {
    setActingId(id)
    try {
      await apiRequest(`/users/${id}/trusted-vendor-request`, {
        method: 'PATCH',
        token: token ?? undefined,
        body: {
          approve,
          ...(reason?.trim() ? { rejectionReason: reason.trim() } : {}),
        },
      })
      toast.success(approve ? 'Vendor approved' : 'Request rejected')
      setRejectingId(null)
      setRejectionReason('')
      fetchUsers(filter)
    } catch {
      toast.error('Failed to update request')
    } finally {
      setActingId(null)
    }
  }

  const handleDeletionReview = async (id: string, approve: boolean) => {
    if (
      approve &&
      !window.confirm(
        'Anonymize this account? Profile and seller-location details will be removed, listings will be archived, and orders and financial records will be retained. This cannot be undone.',
      )
    ) {
      return
    }

    setActingId(id)
    try {
      await apiRequest(`/users/${id}/deletion-request`, {
        method: 'PATCH',
        token: token ?? undefined,
        body: { approve },
      })
      toast.success(approve ? 'Account anonymized' : 'Deletion request rejected')
      fetchUsers(filter)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to review deletion request')
    } finally {
      setActingId(null)
    }
  }

  const FILTERS: { key: FilterMode; label: string }[] = [
    { key: 'all', label: 'All Customers' },
    { key: 'pending', label: 'Pending Requests' },
    { key: 'trusted', label: 'Trusted Vendors' },
    { key: 'deletion', label: 'Deletion Requests' },
  ]

  return (
    <div className="p-4 md:p-8 bg-neutral-50 min-h-screen">
      <h1 className="text-xl font-semibold text-zinc-900 mb-6">Users</h1>

      <div className="flex gap-2 mb-6">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === f.key ? 'bg-indigo-600 text-white' : 'bg-white text-zinc-600 border border-zinc-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {users === null ? (
        <div className="p-10 text-center font-bold">Loading users…</div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-10 text-center text-zinc-500">
          No users match this filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map(u => (
            <div key={u.id} className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-full bg-indigo-500 flex items-center justify-center">
                    <span className="text-white text-sm font-semibold">{u.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-900">{u.name}</p>
                    <p className="text-xs text-zinc-500">{u.email}</p>
                  </div>
                </div>
                {u.isTrustedVendor && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-100 text-green-700 text-[10px] font-semibold">
                    <ShieldCheckIcon className="size-3" /> Trusted
                  </span>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-100 space-y-1.5">
                <p className="text-xs text-zinc-600">{u.phone || 'No phone on file'}</p>
                <p className="text-xs text-zinc-600 flex items-center gap-1.5">
                  <WalletIcon className="size-3.5" /> ₦{u.accountBalance.toLocaleString()} balance
                </p>
              </div>

              {u.accountDeletionRequestedAt && (
                <div className="mt-4 space-y-3 border-t border-red-100 pt-4">
                  <p className="text-xs font-medium text-red-800">
                    Account deletion requested{' '}
                    {new Date(u.accountDeletionRequestedAt).toLocaleDateString()}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleDeletionReview(u.id, true)}
                      disabled={actingId === u.id}
                      className="flex-1 rounded-lg bg-red-600 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {actingId === u.id ? 'Processing…' : 'Approve deletion'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletionReview(u.id, false)}
                      disabled={actingId === u.id}
                      className="flex-1 rounded-lg border border-zinc-200 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                    >
                      Reject request
                    </button>
                  </div>
                </div>
              )}

              {u.trustedVendorBusinessName && (
                <div className="mt-4 space-y-2 border-t border-zinc-100 pt-4 text-xs text-zinc-700">
                  <p>
                    <span className="font-semibold">Business:</span>{' '}
                    {u.trustedVendorBusinessName}
                  </p>
                  <p>
                    <span className="font-semibold">Location:</span>{' '}
                    {u.trustedVendorLocation || 'Not provided'}
                  </p>
                  <p>
                    <span className="font-semibold">Categories:</span>{' '}
                    {u.trustedVendorCategories?.join(', ') || 'Not provided'}
                  </p>
                  {u.trustedVendorDescription && (
                    <p className="whitespace-pre-wrap">
                      <span className="font-semibold">About:</span>{' '}
                      {u.trustedVendorDescription}
                    </p>
                  )}
                  {u.trustedVendorWebsite && (
                    <p className="break-all">
                      <span className="font-semibold">Website:</span>{' '}
                      {u.trustedVendorWebsite}
                    </p>
                  )}
                  {u.trustedVendorRequestedAt && (
                    <p className="text-zinc-500">
                      Submitted {new Date(u.trustedVendorRequestedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}

              {u.trustedVendorRequestStatus === 'rejected' &&
                u.trustedVendorRejectionReason && (
                  <p className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-800">
                    Rejection note: {u.trustedVendorRejectionReason}
                  </p>
                )}

              {u.trustedVendorRequestStatus === 'pending' && (
                <div className="mt-4 pt-4 border-t border-zinc-100">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700 mb-3">
                    <ClockIcon className="size-3.5" /> Requesting Trusted Vendor status
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReview(u.id, true)}
                      disabled={actingId === u.id}
                      className="flex-1 flex items-center justify-center gap-1 py-2 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                    >
                      <CheckIcon className="size-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => {
                        setRejectingId(u.id)
                        setRejectionReason('')
                      }}
                      disabled={actingId === u.id}
                      className="flex-1 flex items-center justify-center gap-1 py-2 bg-red-50 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100 disabled:opacity-50"
                    >
                      <XIcon className="size-3.5" /> Reject
                    </button>
                  </div>
                  {rejectingId === u.id && (
                    <div className="mt-3 space-y-2">
                      <label
                        htmlFor={`rejection-reason-${u.id}`}
                        className="block text-xs font-medium text-zinc-700"
                      >
                        Optional note for the applicant
                      </label>
                      <textarea
                        id={`rejection-reason-${u.id}`}
                        value={rejectionReason}
                        onChange={(event) => setRejectionReason(event.target.value)}
                        maxLength={500}
                        rows={3}
                        className="w-full rounded-lg border border-zinc-200 p-2 text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleReview(u.id, false, rejectionReason)}
                          disabled={actingId === u.id}
                          className="flex-1 rounded-lg bg-red-600 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {actingId === u.id ? 'Submitting…' : 'Confirm rejection'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingId(null)
                            setRejectionReason('')
                          }}
                          disabled={actingId === u.id}
                          className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
