'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Home, ArrowLeft } from 'lucide-react'
import { obtenerHistorialIntereses, obtenerTotalRecaudadoIntereses, PagoInteres } from '@/lib/prestamos'

export default function HistorialInteresesPage() {
  const [historial, setHistorial] = useState<PagoInteres[]>([])
  const [totalRecaudado, setTotalRecaudado] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistorial()
  }, [])

  const loadHistorial = async () => {
    try {
      setLoading(true)
      const [historialData, totalData] = await Promise.all([
        obtenerHistorialIntereses(),
        obtenerTotalRecaudadoIntereses()
      ])
      setHistorial(historialData)
      setTotalRecaudado(totalData)
    } catch (error) {
      console.error('Error loading historial:', error)
      alert('Error al cargar el historial. Verifica tu conexión a Supabase.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8 flex items-center justify-center">
        <p className="text-xl text-gray-600 dark:text-gray-400">Cargando historial...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white">
            Historial de Intereses
          </h1>
          <div className="flex gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>🏠 Home</span>
            </Link>
            <Link
              href="/prestamos"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>🔙 Atrás</span>
            </Link>
          </div>
        </div>

        {/* Totalizador */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-lg p-6 mb-6">
          <div className="text-center">
            <p className="text-white text-sm font-medium mb-2">TOTAL RECAUDADO POR INTERESES</p>
            <p className="text-white text-4xl font-bold">
              ${totalRecaudado.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Tabla de Historial */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Fecha de Pago</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Asociado / Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Préstamo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Valor Interés</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {historial.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No hay registros de pagos de intereses
                    </td>
                  </tr>
                ) : (
                  historial.map((pago, index) => {
                    // Usar fecha directamente de BD sin conversión
                    const fechaDisplay = pago.fecha_pago || pago.fecha || ''
                    const valorDisplay = pago.valor_interes || pago.interes_causado || 0
                    const pagoId = pago.id || index
                    
                    return (
                      <tr key={pagoId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-4 text-sm text-gray-900 dark:text-white">{index + 1}</td>
                        <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                          {fechaDisplay ? (() => {
                            // Parsear fecha YYYY-MM-DD como local sin UTC
                            const [y, m, d] = fechaDisplay.split('-').map(Number)
                            return new Date(y, m - 1, d).toLocaleDateString('es-ES')
                          })() : '-'}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900 dark:text-white">
                          {pago.nombre_prestamista || 'Desconocido'}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                          {pago.prestamo_referencia || pago.prestamo_id || '-'}
                        </td>
                        <td className="px-4 py-4 text-sm font-semibold text-green-600 dark:text-green-400">
                          ${valorDisplay.toLocaleString()}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

