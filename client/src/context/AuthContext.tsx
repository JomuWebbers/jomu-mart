import { useEffect, useRef, useState, type ReactNode } from 'react'
import toast from 'react-hot-toast'

import { AuthContext, type User } from './auth-context'



export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const invalidatedTokenRef = useRef<string | null>(null)

  useEffect(() => {
    const handleUnauthorized = (event: Event) => {
      const failedToken = (event as CustomEvent<{ token?: string }>).detail?.token
      if (
        !token ||
        failedToken !== token ||
        invalidatedTokenRef.current === token
      ) {
        return
      }

      invalidatedTokenRef.current = token
      setUser(null)
      setToken(null)
      localStorage.removeItem('user')
      localStorage.removeItem('token')
      toast.error('Your session is no longer valid. Please sign in again.')
    }

    window.addEventListener('auth:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized)
  }, [token])

  const login = (user: User, token: string) => {
    invalidatedTokenRef.current = null
    setUser(user)
    setToken(token)
    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('token', token)
  }

  const logout = () => {
    invalidatedTokenRef.current = token
    setUser(null)
    setToken(null)
    localStorage.removeItem('user')
    localStorage.removeItem('token')
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// export function useAuth() {
//   const ctx = useContext(AuthContext)
//   if (!ctx) throw new Error('useAuth must be used within AuthProvider')
//   return ctx
// }
