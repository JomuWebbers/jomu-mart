
import { useState, type SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { apiRequest } from '../lib/api'
import { useAuth } from '../context/useAuth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email, password },
      })
      login(data.user, data.token)
      toast.success('Welcome back!')
      navigate('/')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-white text-black">
      <div className="w-full sm:max-w-md border-2 border-black p-6 sm:p-8">
        <span className="font-black uppercase leading-none block text-center mb-2 text-3xl tracking-tight">
          Naija Mart
        </span>
        <p className="text-[10px] tracking-[0.2em] uppercase font-semibold text-neutral-400 text-center mb-8">
          Nigeria's Market
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full border-2 border-black/20 p-3 text-[13px] outline-none focus:border-black"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full border-2 border-black/20 p-3 text-[13px] outline-none focus:border-black"
          />

          <button
            type="submit"
            disabled={loading}
            style={{ backgroundColor: 'var(--vermilion, #E63312)' }}
            className="w-full py-4 text-white text-[11px] tracking-[0.2em] uppercase font-black mt-2 disabled:opacity-60"
          >
            {loading ? 'Signing In…' : 'Sign In'}
          </button>
        </form>

        <p className="text-[11px] text-center text-neutral-400 font-medium mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="underline font-bold text-black">
            Register
          </Link>
        </p>
      </div>
    </div>
  )
}


