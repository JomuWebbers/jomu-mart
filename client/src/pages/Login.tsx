
import { useState, type SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { apiRequest } from '../lib/api'
import { useAuth } from '../context/useAuth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
      navigate(data.user.role === "admin" ? "/admin" : "/")
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-[#F3F4F6] px-4 py-8 text-[#111111] sm:py-12">
      <Link
        to="/"
        aria-label="Jomu Mart home"
        className="mb-8 text-2xl font-black tracking-tight focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F4C86A] sm:mb-10 sm:text-3xl"
      >
        Jomu <span className="text-[#14532D]">Mart</span>
      </Link>

      <section className="w-full max-w-md overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-[0_12px_35px_rgba(17,24,39,0.08)]">
        <header className="border-b border-[#E5E7EB] px-6 py-5 text-center sm:px-8">
          <h1 className="text-2xl font-bold tracking-tight">Login</h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Sign in to your Jomu Mart account
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6 sm:px-8 sm:py-8">
          <div>
            <label
              htmlFor="login-email"
              className="mb-2 block text-sm font-semibold text-[#111111]"
            >
              Email address
            </label>
            <input
              id="login-email"
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="w-full rounded-md border border-[#D1D5DB] bg-white px-3.5 py-3 text-sm text-[#111111] outline-none transition placeholder:text-[#94A3B8] focus:border-[#14532D] focus:ring-2 focus:ring-[#F4C86A]/70"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label
                htmlFor="login-password"
                className="block text-sm font-semibold text-[#111111]"
              >
                Password
              </label>
            </div>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full rounded-md border border-[#D1D5DB] bg-white py-3 pl-3.5 pr-12 text-sm text-[#111111] outline-none transition placeholder:text-[#94A3B8] focus:border-[#14532D] focus:ring-2 focus:ring-[#F4C86A]/70"
              />
              <button
                type="button"
                onClick={() => setShowPassword(current => !current)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex items-center rounded-r-md px-3 text-[#64748B] transition hover:text-[#14532D] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#F4C86A]"
              >
                {showPassword ? (
                  <EyeOff aria-hidden="true" className="size-5" />
                ) : (
                  <Eye aria-hidden="true" className="size-5" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[#14532D] px-4 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#166534] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F4C86A] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Login'}
          </button>
        </form>

        <footer className="border-t border-[#E5E7EB] bg-[#F8FAFC] px-6 py-5 text-center sm:px-8">
          <p className="text-sm text-[#64748B]">Don’t have an account?</p>
          <Link
            to="/register"
            className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-[#14532D] bg-white px-4 py-3 text-sm font-bold text-[#14532D] transition-colors hover:bg-[#F0FDF4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F4C86A]"
          >
            Create an account
          </Link>
        </footer>
      </section>

      <Link
        to="/"
        className="mt-6 text-sm font-medium text-[#64748B] underline decoration-[#F4C86A] underline-offset-4 transition-colors hover:text-[#14532D] focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F4C86A]"
      >
        Back to shopping
      </Link>
    </main>
  )
}

