'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Home, Receipt } from 'lucide-react'
import { Socio } from '@/lib/supabase'
import { getSocios, createSocio, deleteSocio } from '@/lib/socios'
import { crearInscripcion } from '@/lib/inscripciones'

export default function SociosPage() {
  const [socios, setSocios] = useState<Socio[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    nombre: '',
    cedula: '',
    whatsapp: '',
    cantidad_cupos: 1
  })
  const [pagaInscripcion, setPagaInscripcion] = useState(false)

  useEffect(() => {
    loadSocios()
  }, [])

  const loadSocios = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getSocios()
      setSocios(data)
    } catch (error) {
      console.error('Error loading socios:', error)
      setError('Error al cargar los socios. Verifica tu conexión a Supabase.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    if (!formData.nombre.trim() || !formData.cedula.trim() || !formData.whatsapp.trim()) {
      setError('Por favor completa todos los campos obligatorios')
      return
    }

    if (formData.cantidad_cupos < 1) {
      setError('La cantidad de cupos debe ser mayor a 0')
      return
    }

    try {
      setSubmitting(true)
      const nuevoSocio = await createSocio({
        nombre: formData.nombre.trim(),
        cedula: formData.cedula.trim(),
        whatsapp: formData.whatsapp.trim(),
        cantidad_cupos: formData.cantidad_cupos
      })
      
      // Crear inscripción (PAGADA si checkbox marcado, PENDIENTE si no)
      if (nuevoSocio.id) {
        try {
          const socioId = typeof nuevoSocio.id === 'string' ? parseInt(nuevoSocio.id) : nuevoSocio.id
          const nombreSocio = formData.nombre.trim()
          await crearInscripcion(socioId, pagaInscripcion, nombreSocio)
        } catch (errorInscripcion: any) {
          console.error('Error creando inscripción:', errorInscripcion)
          alert('El socio se creó correctamente, pero hubo un error al registrar la inscripción: ' + (errorInscripcion?.message || 'Error desconocido'))
        }
      }
      
      setFormData({ nombre: '', cedula: '', whatsapp: '', cantidad_cupos: 1 })
      setPagaInscripcion(false)
      await loadSocios()
    } catch (error: any) {
      console.error('Error creating socio:', error)
      setError(error.message || 'Error al agregar el socio. Verifica tu conexión a Supabase.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number | string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este socio?')) {
      return
    }

    try {
      setError(null)
      await deleteSocio(id)
      await loadSocios()
    } catch (error: any) {
      console.error('Error deleting socio:', error)
      setError(error.message || 'Error al eliminar el socio')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Navegación */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white">
            Inscripción de Socios
          </h1>
          <div className="flex gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Volver al Home</span>
            </Link>
            <Link
              href="/pagos"
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <Receipt className="w-4 h-4" />
              <span>Ir a Registro de Cuotas</span>
            </Link>
            <Link
              href="/inscripciones"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <span>📋 Control de Inscripciones</span>
            </Link>
          </div>
        </div>

        {/* Formulario */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-200">
            Agregar Nuevo Socio
          </h2>
          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 rounded-lg">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nombre del Socio *
                </label>
                <input
                  type="text"
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="cedula" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  ID *
                </label>
                <input
                  type="text"
                  id="cedula"
                  value={formData.cedula}
                  onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Identificación del socio"
                  required
                />
              </div>

              <div>
                <label htmlFor="whatsapp" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  WhatsApp *
                </label>
                <input
                  type="text"
                  id="whatsapp"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Ej: +57 300 123 4567"
                  required
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pagaInscripcion}
                  onChange={(e) => setPagaInscripcion(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Pago inscripción
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Agregando...' : 'Agregar Socio'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

