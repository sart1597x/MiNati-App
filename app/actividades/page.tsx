'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Home, Plus, Edit2, Trash2, DollarSign } from 'lucide-react'
import { Socio } from '@/lib/supabase'
import { getSocios } from '@/lib/socios'
import {
  obtenerActividades,
  crearActividad,
  actualizarActividad,
  eliminarParticipacion,
  guardarParticipacion,
  obtenerParticipacionesActividad,
  Actividad,
  ParticipacionActividad
} from '@/lib/actividades'

export default function ActividadesPage() {
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [socios, setSocios] = useState<Socio[]>([])
  const [loading, setLoading] = useState(true)
  const [showModalActividad, setShowModalActividad] = useState(false)
  const [showModalParticipacion, setShowModalParticipacion] = useState(false)
  const [actividadSeleccionada, setActividadSeleccionada] = useState<Actividad | null>(null)
  const [participaciones, setParticipaciones] = useState<ParticipacionActividad[]>([])
  const [submitting, setSubmitting] = useState(false)
  
  // Formulario de actividad
  const [nombreActividad, setNombreActividad] = useState('')
  const [fechaActividad, setFechaActividad] = useState(new Date().toISOString().split('T')[0])
  const [costoInversion, setCostoInversion] = useState('')
  const [gananciaTotal, setGananciaTotal] = useState('')
  
  // Formulario de participación
  const [socioSeleccionado, setSocioSeleccionado] = useState<Socio | null>(null)
  const [cantidadCaritas, setCantidadCaritas] = useState('1')
  const [valorCarita, setValorCarita] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [actividadesData, sociosData] = await Promise.all([
        obtenerActividades(),
        getSocios()
      ])
      setActividades(Array.isArray(actividadesData) ? actividadesData : [])
      setSocios(Array.isArray(sociosData) ? sociosData : [])
    } catch (error: any) {
      console.error('Error loading data:', error)
      const errorMessage = error?.message || 'Error desconocido'
      if (errorMessage.includes('does not exist') || error?.code === '42P01') {
        alert('Error: Una o más tablas no existen en Supabase. Verifica que las tablas actividades y asociados estén creadas.')
      } else {
        alert('Error al cargar los datos: ' + errorMessage)
      }
      setActividades([]) // Asegurar que siempre sea un array
      setSocios([])
    } finally {
      setLoading(false)
    }
  }

  const loadParticipaciones = async (actividadId: number | string) => {
    try {
      const participacionesData = await obtenerParticipacionesActividad(actividadId)
      setParticipaciones(Array.isArray(participacionesData) ? participacionesData : [])
    } catch (error) {
      console.error('Error loading participaciones:', error)
      setParticipaciones([]) // Asegurar que siempre sea un array
    }
  }

  const handleCrearActividad = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!nombreActividad || !costoInversion || !gananciaTotal) {
      alert('Por favor completa todos los campos obligatorios')
      return
    }

    try {
      setSubmitting(true)
      // Preparar datos con las columnas correctas de la tabla
      const datosActividad: any = {
        nombre: nombreActividad,
        valor: parseFloat(costoInversion), // valor es el costo de inversión
        ganancia_total: parseFloat(gananciaTotal),
        fecha: fechaActividad
      }
      
      await crearActividad(datosActividad)
      
      await loadData()
      setShowModalActividad(false)
      setNombreActividad('')
      setFechaActividad(new Date().toISOString().split('T')[0])
      setCostoInversion('')
      setGananciaTotal('')
      alert('Actividad creada exitosamente')
    } catch (error) {
      console.error('Error creating actividad:', error)
      alert('Error al crear la actividad')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAbrirParticipaciones = async (actividad: Actividad) => {
    if (!actividad || !actividad.id) {
      alert('Error: La actividad no tiene un ID válido')
      return
    }
    setActividadSeleccionada(actividad)
    await loadParticipaciones(actividad.id)
    setShowModalParticipacion(true)
  }

  const handleAgregarParticipacion = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!socioSeleccionado || !actividadSeleccionada || !cantidadCaritas || !valorCarita) {
      alert('Por favor completa todos los campos')
      return
    }

    try {
      setSubmitting(true)
      const valorTotal = parseFloat(cantidadCaritas) * parseFloat(valorCarita)
      const asociadoId = typeof socioSeleccionado.id === 'string' ? parseInt(socioSeleccionado.id) : socioSeleccionado.id
      
      await guardarParticipacion({
        actividad_id: typeof actividadSeleccionada.id === 'string' ? parseInt(actividadSeleccionada.id) : actividadSeleccionada.id!,
        asociado_id: asociadoId!,
        nombre_asociado: socioSeleccionado.nombre,
        cantidad_caritas: parseInt(cantidadCaritas),
        valor_carita: parseFloat(valorCarita),
        valor_total: valorTotal
      })
      
      await loadParticipaciones(actividadSeleccionada.id!)
      
      // Recalcular ganancia total de la actividad si es necesario
      const totalRecaudado = (participaciones || []).reduce((sum, p) => sum + (p?.valor_total || 0), 0) + valorTotal
      if (totalRecaudado > parseFloat(String(actividadSeleccionada.ganancia_total || 0))) {
        await actualizarActividad(actividadSeleccionada.id!, {
          ganancia_total: totalRecaudado
        })
        await loadData()
      }
      
      setSocioSeleccionado(null)
      setCantidadCaritas('1')
      setValorCarita('')
      alert('Participación agregada exitosamente')
    } catch (error) {
      console.error('Error adding participacion:', error)
      alert('Error al agregar la participación')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEliminarParticipacion = async (participacionId: number | string) => {
    if (!confirm('¿Estás seguro de eliminar esta participación?')) {
      return
    }

    try {
      await eliminarParticipacion(participacionId)
      if (actividadSeleccionada) {
        await loadParticipaciones(actividadSeleccionada.id!)
        await loadData()
      }
      alert('Participación eliminada exitosamente')
    } catch (error) {
      console.error('Error deleting participacion:', error)
      alert('Error al eliminar la participación')
    }
  }

  const handleIncrementarCaritas = async (participacion: ParticipacionActividad) => {
    if (!actividadSeleccionada) return
    
    try {
      const nuevaCantidad = (participacion.cantidad_caritas || 1) + 1
      const nuevoValorTotal = nuevaCantidad * (participacion.valor_carita || 0)
      
      await guardarParticipacion({
        actividad_id: participacion?.actividad_id || 0,
        asociado_id: participacion?.asociado_id || 0,
        nombre_asociado: participacion?.nombre_asociado || 'Sin nombre',
        cantidad_caritas: nuevaCantidad,
        valor_carita: participacion?.valor_carita || 0,
        valor_total: nuevoValorTotal
      })
      
      await loadParticipaciones(actividadSeleccionada.id!)
      
      // Recalcular ganancia total
      const todasLasParticipaciones = await obtenerParticipacionesActividad(actividadSeleccionada.id!)
      const totalRecaudado = (Array.isArray(todasLasParticipaciones) ? todasLasParticipaciones : []).reduce((sum, p) => sum + (p?.valor_total || 0), 0)
      await actualizarActividad(actividadSeleccionada.id!, {
        ganancia_total: totalRecaudado
      })
      await loadData()
    } catch (error) {
      console.error('Error incrementing caritas:', error)
      alert('Error al incrementar las caritas')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8 flex items-center justify-center">
        <p className="text-xl text-gray-600 dark:text-gray-400">Cargando actividades...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white">
            Módulo de Actividades
          </h1>
          <div className="flex gap-3">
            <button
              onClick={() => setShowModalActividad(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Actividad</span>
            </button>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Volver al Home</span>
            </Link>
          </div>
        </div>

        {/* Resumen de Utilidades */}
        <div className="bg-green-700 rounded-lg shadow-lg p-6 mb-6 border border-green-600">
          <p className="text-sm text-green-200 mb-2">TOTAL UTILIDAD NETA DE ACTIVIDADES</p>
          <p className="text-3xl font-bold text-white">
            ${(() => {
              try {
                return (Array.isArray(actividades) ? actividades : []).reduce((sum, a) => {
                  const utilidad = parseFloat(String(a?.utilidad_neta || 0)) || 0
                  return sum + (isNaN(utilidad) ? 0 : utilidad)
                }, 0).toLocaleString()
              } catch {
                return '0'
              }
            })()}
          </p>
          <p className="text-xs text-green-300 mt-2">
            Este valor se suma automáticamente al recaudo de la Caja Central y a la liquidación
          </p>
        </div>

        {/* Lista de Actividades */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(actividades || []).map((actividad) => (
            <div
              key={actividad?.id || Math.random()}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700"
            >
              <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                {actividad?.nombre || 'Sin nombre'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {actividad?.fecha 
                  ? (() => {
                      try {
                        const fecha = new Date(actividad.fecha)
                        return isNaN(fecha.getTime()) ? 'Fecha inválida' : fecha.toLocaleDateString('es-ES')
                      } catch {
                        return 'Fecha inválida'
                      }
                    })()
                  : actividad?.created_at 
                    ? (() => {
                        try {
                          const fecha = new Date(actividad.created_at)
                          return isNaN(fecha.getTime()) ? 'Sin fecha' : fecha.toLocaleDateString('es-ES')
                        } catch {
                          return 'Sin fecha'
                        }
                      })()
                    : 'Sin fecha'}
              </p>
              
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Inversión:</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    ${(actividad?.valor || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Ganancia:</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    ${(actividad?.ganancia_total || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400 font-semibold">Utilidad Neta:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    ${(actividad?.utilidad_neta || 0).toLocaleString()}
                  </span>
                </div>
              </div>
              
              <button
                onClick={() => actividad && actividad.id && handleAbrirParticipaciones(actividad)}
                disabled={!actividad || !actividad.id}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Ver Participaciones
              </button>
            </div>
          ))}
        </div>

        {(!actividades || actividades.length === 0) && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            <p className="text-gray-600 dark:text-gray-400">No hay actividades registradas</p>
            <button
              onClick={() => setShowModalActividad(true)}
              className="mt-4 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              Crear Primera Actividad
            </button>
          </div>
        )}

        {/* Modal para Crear Actividad */}
        {showModalActividad && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
                Nueva Actividad
              </h2>
              
              <form onSubmit={handleCrearActividad} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nombre de la Actividad *
                  </label>
                  <input
                    type="text"
                    value={nombreActividad}
                    onChange={(e) => setNombreActividad(e.target.value)}
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
                    value={fechaActividad}
                    onChange={(e) => setFechaActividad(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Costo de Inversión *
                  </label>
                  <input
                    type="number"
                    value={costoInversion}
                    onChange={(e) => setCostoInversion(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    min="0"
                    step="1000"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ganancia Total *
                  </label>
                  <input
                    type="number"
                    value={gananciaTotal}
                    onChange={(e) => setGananciaTotal(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    min="0"
                    step="1000"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {submitting ? 'Creando...' : 'Crear Actividad'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModalActividad(false)}
                    className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Participaciones */}
        {showModalParticipacion && actividadSeleccionada && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                  Participaciones: {actividadSeleccionada?.nombre || 'Sin nombre'}
                </h2>
                <button
                  onClick={() => {
                    setShowModalParticipacion(false)
                    setActividadSeleccionada(null)
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              {/* Formulario para agregar participación */}
              <form onSubmit={handleAgregarParticipacion} className="mb-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Asociado *
                    </label>
                    <select
                      value={socioSeleccionado?.id || ''}
                      onChange={(e) => {
                        const socio = socios.find(s => String(s.id) === e.target.value)
                        setSocioSeleccionado(socio || null)
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                      required
                    >
                      <option value="">Seleccionar...</option>
                      {(socios || []).map((socio) => (
                        <option key={socio?.id || Math.random()} value={socio?.id}>
                          {socio?.nombre || 'Sin nombre'}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Cantidad Caritas *
                    </label>
                    <input
                      type="number"
                      value={cantidadCaritas}
                      onChange={(e) => setCantidadCaritas(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                      min="1"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Valor por Carita *
                    </label>
                    <input
                      type="number"
                      value={valorCarita}
                      onChange={(e) => setValorCarita(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                      min="0"
                      step="1000"
                      required
                    />
                  </div>
                  
                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {submitting ? 'Agregando...' : 'Agregar'}
                    </button>
                  </div>
                </div>
              </form>

              {/* Lista de participaciones */}
              <div className="overflow-x-auto">
                <table className="w-full table-auto text-sm">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">ASOCIADO</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">CARITAS</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">VALOR UNITARIO</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">TOTAL</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {(!participaciones || participaciones.length === 0) ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                          No hay participaciones registradas
                        </td>
                      </tr>
                    ) : (
                      (participaciones || []).map((part) => (
                        <tr key={part?.id || Math.random()} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                            {part?.nombre_asociado || 'Sin nombre'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-2xl">{'😊'.repeat(Math.min(part?.cantidad_caritas || 1, 10))}</span>
                              <span className="text-gray-700 dark:text-gray-300 font-semibold">
                                {part?.cantidad_caritas || 1}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                            ${(part?.valor_carita || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                            ${(part?.valor_total || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => part && handleIncrementarCaritas(part)}
                                disabled={!part}
                                className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-50"
                                title="Agregar carita"
                              >
                                <Plus className="w-4 h-4 inline" />
                              </button>
                              <button
                                onClick={() => part?.id && handleEliminarParticipacion(part.id)}
                                disabled={!part?.id}
                                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4 inline" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Resumen */}
              {participaciones && participaciones.length > 0 && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      Total Recaudado:
                    </span>
                    <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                      ${(participaciones || []).reduce((sum, p) => sum + (p?.valor_total || 0), 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      Utilidad Neta:
                    </span>
                    <span className="text-xl font-bold text-green-600 dark:text-green-400">
                      ${(actividadSeleccionada?.utilidad_neta || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

