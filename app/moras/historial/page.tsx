'use client'

// Versión actualizada: Historial de Moras con columnas correctas
// Usa: fecha_pago, valor_pagado, nombre_asociado
// Última actualización: 2024-01-XX - Forzar refresco de caché
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Home, ArrowLeft, Trash2 } from 'lucide-react'
import { obtenerHistorialMoras, obtenerTotalRecaudadoMoras, eliminarRegistroMora, PagoMora } from '@/lib/moras'

export default function HistorialMorasPage() {
  const [historial, setHistorial] = useState<PagoMora[]>([])
  const [totalRecaudado, setTotalRecaudado] = useState(0)
  const [loading, setLoading] = useState(true)
  const [eliminando, setEliminando] = useState<number | null>(null)
  const [notificacion, setNotificacion] = useState<{ mensaje: string; tipo: 'success' | 'error' } | null>(null)

  useEffect(() => {
    loadHistorial()
  }, [])

  const loadHistorial = async () => {
    try {
      setLoading(true)
      const [historialData, totalData] = await Promise.all([
        obtenerHistorialMoras(),
        obtenerTotalRecaudadoMoras()
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

  const handleEliminarMora = async (historialId: number | string, nombreAsociado: string) => {
    // Confirmación
    const confirmacion = window.confirm(
      `¿Estás seguro de eliminar esta mora?\n\n` +
      `Asociado: ${nombreAsociado}\n` +
      `Esto eliminará el registro del historial de moras.\n\n` +
      `⚠️ Esto NO afectará el registro del pago de la cuota de $30.000.`
    )
    
    if (!confirmacion) {
      return
    }
    
    try {
      // CORRECCIÓN: El ID puede ser UUID (string) o número
      const idValue = historialId
      setEliminando(typeof idValue === 'number' ? idValue : 0) // Usar 0 como fallback para string IDs
      
      // Eliminar el registro
      await eliminarRegistroMora(idValue)
      
      // Actualización optimista: remover el registro del estado inmediatamente
      setHistorial(prev => prev.filter(item => {
        // Comparar IDs correctamente (pueden ser string o number)
        return String(item.id) !== String(historialId)
      }))
      
      // Recalcular el total recaudado
      const nuevoTotal = await obtenerTotalRecaudadoMoras()
      setTotalRecaudado(nuevoTotal)
      
      // Mostrar notificación de éxito
      setNotificacion({ mensaje: 'Mora eliminada correctamente', tipo: 'success' })
      
      // Ocultar notificación después de 3 segundos
      setTimeout(() => {
        setNotificacion(null)
      }, 3000)
      
    } catch (error: any) {
      console.error('Error eliminando mora:', error)
      setNotificacion({ 
        mensaje: `Error al eliminar la mora: ${error.message || 'Error desconocido'}`, 
        tipo: 'error' 
      })
      
      // Ocultar notificación después de 5 segundos
      setTimeout(() => {
        setNotificacion(null)
      }, 5000)
      
      // Recargar datos para mantener sincronización
      await loadHistorial()
    } finally {
      setEliminando(null)
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
        {/* Notificación Toast */}
        {notificacion && (
          <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg transition-all ${
            notificacion.tipo === 'success' 
              ? 'bg-green-500 text-white' 
              : 'bg-red-500 text-white'
          }`}>
            <div className="flex items-center gap-2">
              <span>{notificacion.tipo === 'success' ? '✅' : '❌'}</span>
              <span className="font-medium">{notificacion.mensaje}</span>
            </div>
          </div>
        )}
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white">
            Historial de Moras
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
              href="/moras"
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
            <p className="text-white text-sm font-medium mb-2">TOTAL RECAUDADO POR MORAS</p>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Asociado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Valor Pagado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Cuota</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {historial.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No hay registros de pagos de moras
                    </td>
                  </tr>
                ) : (
                  historial.map((pago, index) => {
                    // REGLA: Manejar valores nulos - usar fecha actual si fecha_pago es nulo, 0 si valor_pagado es nulo
                    const fechaDisplay = pago.fecha_pago || pago.fecha || new Date().toISOString().split('T')[0]
                    const valorDisplay = pago.valor_pagado || pago.valor || 0
                    const pagoId = pago.id || index
                    const isEliminando = pagoId && eliminando !== null && String(pagoId) === String(eliminando)
                    
                    return (
                      <tr key={pagoId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-4 text-sm text-gray-900 dark:text-white">{index + 1}</td>
                        <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                          {fechaDisplay ? new Date(fechaDisplay).toLocaleDateString('es-ES') : '-'}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900 dark:text-white">
                          {pago.nombre_asociado || 'Desconocido'}
                        </td>
                        <td className="px-4 py-4 text-sm font-semibold text-green-600 dark:text-green-400">
                          ${valorDisplay.toLocaleString()}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{pago.cuota_referencia || '-'}</td>
                        <td className="px-4 py-4 text-sm">
                          <button
                            onClick={() => pagoId && handleEliminarMora(pagoId, pago.nombre_asociado || 'Asociado')}
                            disabled={isEliminando || !pagoId}
                            className="flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded text-xs transition-colors"
                            title="Eliminar registro de mora"
                          >
                            <Trash2 className="w-3 h-3" />
                            {isEliminando ? 'Eliminando...' : 'Eliminar'}
                          </button>
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

