'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Home, ArrowLeft, Trash2, Eye } from 'lucide-react'
import { obtenerPrestamos, calcularSaldoActual, eliminarPrestamo, Prestamo } from '@/lib/prestamos'

export default function ListaPrestamosPage() {
  const [prestamos, setPrestamos] = useState<Prestamo[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [saldos, setSaldos] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [loadingSaldos, setLoadingSaldos] = useState(false)

  useEffect(() => {
    loadPrestamos()
  }, [])

  useEffect(() => {
    if (prestamos.length > 0) {
      loadSaldos()
    }
  }, [prestamos])

  const loadPrestamos = async () => {
    try {
      setLoading(true)
      const prestamosData = await obtenerPrestamos()
      setPrestamos(prestamosData)
    } catch (error) {
      console.error('Error loading prestamos:', error)
      alert('Error al cargar los préstamos. Verifica tu conexión a Supabase.')
    } finally {
      setLoading(false)
    }
  }

  const loadSaldos = async () => {
    try {
      setLoadingSaldos(true)
      const saldosData: Record<string, number> = {}
      for (const prestamo of prestamos) {
        if (prestamo.id) {
          try {
            const saldo = await calcularSaldoActual(prestamo.id)
            saldosData[prestamo.id] = saldo
          } catch (error) {
            saldosData[prestamo.id] = prestamo.monto
          }
        }
      }
      setSaldos(saldosData)
    } catch (error) {
      console.error('Error loading saldos:', error)
    } finally {
      setLoadingSaldos(false)
    }
  }

  const prestamosFiltrados = prestamos.filter(p =>
    p.nombre_prestamista.toLowerCase().includes(busqueda.toLowerCase())
  )

  const handleEliminar = async (prestamo: Prestamo) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar el préstamo de ${prestamo.nombre_prestamista}? Esta acción no se puede deshacer.`)) {
      return
    }

    try {
      if (prestamo.id) {
        await eliminarPrestamo(prestamo.id)
        await loadPrestamos()
        alert('Préstamo eliminado exitosamente')
      }
    } catch (error) {
      console.error('Error deleting prestamo:', error)
      alert('Error al eliminar el préstamo')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8 flex items-center justify-center">
        <p className="text-xl text-gray-600 dark:text-gray-400">Cargando préstamos...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white">
            Base de Datos de Préstamos
          </h1>
          <div className="flex gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>🏠 Volver al Home</span>
            </Link>
            <Link
              href="/prestamos"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>🔙 Volver al Menú</span>
            </Link>
          </div>
        </div>

        {/* Buscador */}
        <div className="mb-6">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="Buscar por nombre o ID..."
          />
        </div>

        {/* Tabla */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Monto</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Tasa</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Fecha Inicio</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Saldo Actual</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {prestamosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No hay préstamos registrados
                    </td>
                  </tr>
                ) : (
                  prestamosFiltrados.map((prestamo) => (
                    <tr key={prestamo.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-4 text-sm text-gray-900 dark:text-white">{prestamo.id}</td>
                      <td className="px-4 py-4 text-sm text-gray-900 dark:text-white">{prestamo.nombre_prestamista}</td>
                      <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">${prestamo.monto.toLocaleString()}</td>
                      <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{((prestamo as any).tasa_interes || (prestamo as any).tasa || 0)}%</td>
                      <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {(() => {
                          // Parsear fecha YYYY-MM-DD como local sin UTC
                          const [y, m, d] = prestamo.fecha_inicio.split('-').map(Number)
                          return new Date(y, m - 1, d).toLocaleDateString('es-ES')
                        })()}
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-gray-900 dark:text-white">
                        {loadingSaldos ? (
                          <span className="text-gray-400">Calculando...</span>
                        ) : (
                          `$${(saldos[prestamo.id || ''] || prestamo.monto).toLocaleString()}`
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          prestamo.estado === 'activo' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`}>
                          {prestamo.estado}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <div className="flex gap-2">
                          <Link
                            href={`/prestamos/extracto/${prestamo.id}`}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            <Eye className="w-4 h-4" />
                            <span>🔍 Ver extracto</span>
                          </Link>
                          <button
                            onClick={() => handleEliminar(prestamo)}
                            className="flex items-center gap-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>🗑️ Eliminar</span>
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
      </div>
    </div>
  )
}

