'use client'

import { getBrowserClient } from '@/lib/supabase'
import { useState, useEffect } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [supabase, setSupabase] = useState<ReturnType<typeof getBrowserClient> | null>(null)

  // Asegurar que el cliente solo se obtenga en el lado del cliente
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const client = getBrowserClient()
      setSupabase(client)
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!supabase) return // Esperar a que el cliente esté listo
    
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError('Correo o contraseña incorrectos. Verifica tus datos.')
      } else {
        // Forzar la entrada al sistema
        window.location.href = '/'
      }
    } catch (err) {
      setError('Error de conexión con el servidor.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f172a] text-white">
      <form onSubmit={handleLogin} className="bg-[#1e293b] p-8 rounded-xl shadow-2xl w-96 border border-slate-700">
        <h1 className="text-3xl font-bold mb-6 text-center">MiNati</h1>
        
        {error && <div className="bg-red-500/20 border border-red-500 text-red-200 p-3 rounded mb-4 text-sm">{error}</div>}

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Email</label>
          <input 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2.5 rounded bg-[#0f172a] border border-slate-600 outline-none focus:border-blue-500" 
            required 
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">Contraseña</label>
          <input 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2.5 rounded bg-[#0f172a] border border-slate-600 outline-none focus:border-blue-500" 
            required 
          />
        </div>

        <button 
          type="submit" 
          disabled={loading || !supabase}
          className="w-full bg-blue-600 hover:bg-blue-700 p-3 rounded-lg font-bold transition-all disabled:opacity-50"
        >
          {loading ? 'Entrando...' : 'Iniciar Sesión'}
        </button>
      </form>
    </div>
  )
}