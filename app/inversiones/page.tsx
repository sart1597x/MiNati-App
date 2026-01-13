'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Home, Plus, ArrowLeft, Edit, Trash2, TrendingUp } from 'lucide-react'
import {
  obtenerInversiones,
  crearInversion,
  eliminarInversion,
  actualizarInversion,
  reportarUtilidadInversion,
  Inversion
} from '@/lib/inversiones'

export default function InversionesPage() {
  const [inversiones, setInversiones] = useState<Inversion[]>([])
  const [loading, setLoading] = useState(true)
  const [showModalInversion, setShowModalInversion] = useState(false)
  const [showModalUtilidad, setShowModalUtilidad] = useState(false)
  const [showModalEditar, setShowModalEditar] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // Formulario de inversión
  const [nombreInversion, setNombreInversion] = useState('')
  const [fechaInversion, setFechaInversion] = useState(new Date().toISOString().split('T')[0])
  const [valorInversion, setValorInversion] = useState('')
  
  // Modal de utilidad
  const [inversionSeleccionada, setInversionSeleccionada] = useState<Inversion | null>(null)
  const [utilidad, setUtilidad] = useState('')
  
  // Modal de editar
  const [inversionEditando, setInversionEditando] = useState<Inversion | null>(null)
  const [nombreEditando, setNombreEditando] = useState('')
  const [fechaEditando, setFechaEditando] = useState('')
  const [valorEditando, setValorEditando] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const inversionesData = await obtenerInversiones()
      setInversiones(Array.isArray(inversionesData) ? inversionesData : [])
    } catch (error: any) {
      console.error('Error loading inversiones:', error)
      const errorMessage = error?.message || 'Error desconocido'
      if (errorMessage.includes('no existe en la base de datos') || error?.code === '42P01') {
        alert('Error: La tabla inversiones no existe en Supabase. Por favor, ejecuta el script SQL: supabase-inversiones-tablas.sql')
      } else {
        alert('Error al cargar las inversiones: ' + errorMessage)
      }
      setInversiones([])
    } finally {
      setLoading(false)
    }
  }

  const handleCrearInversion = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!nombreInversion || !valorInversion || !fechaInversion) {
      alert('Por favor completa todos los campos obligatorios')
      return
    }

    const valor = parseFloat(valorInversion)
    if (isNaN(valor) || valor <= 0) {
      alert('El valor debe ser un número mayor a 0')
      return
    }

    try {
      setSubmitting(true)
      await crearInversion({
        nombre: nombreInversion,
        valor_invertido: valor,
        fecha: fechaInversion
      })
      
      await loadData()
      setShowModalInversion(false)
      setNombreInversion('')
      setFechaInversion(new Date().toISOString().split('T')[0])
      setValorInversion('')
      alert('Inversión creada exitosamente')
    } catch (error: any) {
      console.error('Error creating inversion:', error)
      alert('Error al crear la inversión: ' + (error?.message || 'Error desconocido'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleReportarUtilidad = async () => {
    if (!inversionSeleccionada || !inversionSeleccionada.id) return

    const utilidadValue = parseFloat(utilidad)
    if (isNaN(utilidadValue)) {
      alert('Por favor ingresa un valor numérico válido')
      return
    }

    try {
      setSubmitting(true)
      await reportarUtilidadInversion(inversionSeleccionada.id, utilidadValue)
      await loadData()
      setShowModalUtilidad(false)
      setInversionSeleccionada(null)
      setUtilidad('')
      alert('Utilidad reportada exitosamente')
    } catch (error: any) {
      console.error('Error reporting utilidad:', error)
      alert('Error al reportar utilidad: ' + (error?.message || 'Error desconocido'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditarInversion = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!inversionEditando || !inversionEditando.id) return

    if (!nombreEditando || !valorEditando || !fechaEditando) {
      alert('Por favor completa todos los campos obligatorios')
      return
    }

    const valor = parseFloat(valorEditando)
    if (isNaN(valor) || valor <= 0) {
      alert('El valor debe ser un número mayor a 0')
      return
    }

    try {
      setSubmitting(true)
      await actualizarInversion(inversionEditando.id, {
        nombre: nombreEditando,
        valor_invertido: valor,
        fecha: fechaEditando
      })
      await loadData()
      setShowModalEditar(false)
      setInversionEditando(null)
      setNombreEditando('')
      setFechaEditando('')
      setValorEditando('')
      alert('Inversión actualizada exitosamente')
    } catch (error: any) {
      console.error('Error updating inversion:', error)
      alert('Error al actualizar la inversión: ' + (error?.message || 'Error desconocido'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleEliminarInversion = async (inversion: Inversion) => {
    if (!inversion.id) return

    if (!confirm(`¿Estás seguro de eliminar la inversión "${inversion.nombre}"? Esta acción no se puede deshacer.`)) {
      return
    }

    try {
      await eliminarInversion(inversion.id)
      await loadData()
      alert('Inversión eliminada exitosamente')
    } catch (error: any) {
      console.error('Error deleting inversion:', error)
      alert('Error al eliminar la inversión: ' + (error?.message || 'Error desconocido'))
    }
  }

  const abrirModalUtilidad = (inversion: Inversion) => {
    setInversionSeleccionada(inversion)
    setUtilidad(inversion.utilidad_reportada?.toString() || '')
    setShowModalUtilidad(true)
  }

  const abrirModalEditar = (inversion: Inversion) => {
    setInversionEditando(inversion)
    setNombreEditando(inversion.nombre)
    setFechaEditando(inversion.fecha)
    setValorEditando(inversion.valor_invertido.toString())
    setShowModalEditar(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8 flex items-center justify-center">
        <p className="text-xl text-gray-600 dark:text-gray-400">Cargando inversiones...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white">
            Módulo de Inversiones
          </h1>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Volver al Home</span>
          </Link>
        </div>

        {/* Botón Nueva Inversión - Centrado y más grande */}
        <div className="flex justify-center mb-6">
          <button
            onClick={() => setShowModalInversion(true)}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-lg font-semibold"
          >
            <Plus className="w-5 h-5" />
            <span>Nueva Inversión</span>
          </button>
        </div>

        {/* Lista de Inversiones - Tabla */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Inversiones</h2>
          {(!inversiones || inversiones.length === 0) ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No hay inversiones registradas
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Nombre</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Fecha</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Valor</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Utilidad</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {(inversiones || []).map((inversion, index) => {
                    // Formatear fecha en DD/MM/YYYY
                    const fechaFormateada = inversion?.fecha ? (() => {
                      try {
                        const fecha = new Date(inversion.fecha)
                        if (isNaN(fecha.getTime())) return ''
                        const dia = String(fecha.getDate()).padStart(2, '0')
                        const mes = String(fecha.getMonth() + 1).padStart(2, '0')
                        const año = fecha.getFullYear()
                        return `${dia}/${mes}/${año}`
                      } catch {
                        return ''
                      }
                    })() : ''

                    const utilidadValue = inversion.utilidad_reportada !== null && inversion.utilidad_reportada !== undefined ? inversion.utilidad_reportada : null

                    return (
                      <tr key={inversion?.id ? `inversion-${inversion.id}` : `inversion-index-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3">
                          <div className="text-gray-900 dark:text-white font-bold">
                            {inversion?.nombre || 'Sin nombre'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-900 dark:text-white">
                          {fechaFormateada}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-900 dark:text-white">
                          ${(inversion?.valor_invertido || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {utilidadValue !== null ? (
                            <span className={`font-semibold ${utilidadValue >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              ${utilidadValue.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => abrirModalUtilidad(inversion)}
                              disabled={!inversion?.id}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-1"
                              title="Reportar Utilidad"
                            >
                              <TrendingUp className="w-3 h-3" />
                              Utilidad
                            </button>
                            <button
                              onClick={() => abrirModalEditar(inversion)}
                              disabled={!inversion?.id}
                              className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-1"
                              title="Editar"
                            >
                              <Edit className="w-3 h-3" />
                              Editar
                            </button>
                            <button
                              onClick={() => handleEliminarInversion(inversion)}
                              disabled={!inversion?.id}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-1"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3 h-3" />
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal para Crear Inversión */}
        {showModalInversion && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
                Nueva Inversión
              </h2>
              
              <form onSubmit={handleCrearInversion} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nombre de la Inversión *
                  </label>
                  <input
                    type="text"
                    value={nombreInversion}
                    onChange={(e) => setNombreInversion(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    value={fechaInversion}
                    onChange={(e) => setFechaInversion(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Valor Invertido *
                  </label>
                  <input
                    type="number"
                    value={valorInversion}
                    onChange={(e) => setValorInversion(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    min="0"
                    step="1"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {submitting ? 'Creando...' : 'Crear Inversión'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModalInversion(false)}
                    className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal para Reportar Utilidad */}
        {showModalUtilidad && inversionSeleccionada && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
                Reportar Utilidad
              </h2>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Inversión:</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {inversionSeleccionada.nombre}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Valor de Utilidad *
                  </label>
                  <input
                    type="number"
                    value={utilidad}
                    onChange={(e) => setUtilidad(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    step="1000"
                    required
                    placeholder="Puede ser positivo o negativo"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Ingresa un valor positivo para ganancia o negativo para pérdida
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleReportarUtilidad}
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? 'Guardando...' : 'Aceptar'}
                  </button>
                  <button
                    onClick={() => {
                      setShowModalUtilidad(false)
                      setInversionSeleccionada(null)
                      setUtilidad('')
                    }}
                    className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal para Editar Inversión */}
        {showModalEditar && inversionEditando && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
                Editar Inversión
              </h2>
              
              <form onSubmit={handleEditarInversion} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nombre de la Inversión *
                  </label>
                  <input
                    type="text"
                    value={nombreEditando}
                    onChange={(e) => setNombreEditando(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    value={fechaEditando}
                    onChange={(e) => setFechaEditando(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Valor Invertido *
                  </label>
                  <input
                    type="number"
                    value={valorEditando}
                    onChange={(e) => setValorEditando(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    min="0"
                    step="1"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModalEditar(false)
                      setInversionEditando(null)
                      setNombreEditando('')
                      setFechaEditando('')
                      setValorEditando('')
                    }}
                    className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

