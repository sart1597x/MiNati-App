'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Home, Plus, Share2, ArrowLeft } from 'lucide-react'
import { Socio } from '@/lib/supabase'
import { getSocios } from '@/lib/socios'
import {
  obtenerActividades,
  crearActividad,
  eliminarActividad,
  obtenerCaritasActividad,
  obtenerCaritasSocioActividad,
  obtenerPagosActividad,
  obtenerPagoActividad,
  registrarPagoActividad,
  actualizarPagoActividad,
  eliminarPagoActividad,
  agregarCaritaActividad,
  Actividad,
  CaritaActividad,
  PagoActividad
} from '@/lib/actividades'

// Helper para normalizar fecha sin desfase UTC
function dateFromInput(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day, 0, 0, 0, 0)
}

type View = 'lista' | 'tablero'

export default function ActividadesPage() {
  const [view, setView] = useState<View>('lista')
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [socios, setSocios] = useState<Socio[]>([])
  const [loading, setLoading] = useState(true)
  const [showModalActividad, setShowModalActividad] = useState(false)
  const [actividadSeleccionada, setActividadSeleccionada] = useState<Actividad | null>(null)
  const [caritas, setCaritas] = useState<CaritaActividad[]>([])
  const [pagos, setPagos] = useState<PagoActividad[]>([])
  const [pagosPorActividad, setPagosPorActividad] = useState<Map<number, PagoActividad[]>>(new Map())
  const [submitting, setSubmitting] = useState(false)
  const [errorTablas, setErrorTablas] = useState<string | null>(null)
  
  // Formulario de actividad (NO MODIFICAR según instrucciones)
  const [nombreActividad, setNombreActividad] = useState('')
  const [fechaActividad, setFechaActividad] = useState(new Date().toISOString().split('T')[0])
  const [valor, setValor] = useState('')
  const [cantidad, setCantidad] = useState('1')
  const [premio, setPremio] = useState('')
  
  // Modal de pago de caritas
  const [showModalPago, setShowModalPago] = useState(false)
  const [selectedCarita, setSelectedCarita] = useState<{ socioId: number, numeroCarita: number } | null>(null)
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0])

  const NUM_COLUMNAS = 6

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
      
      // Cargar pagos de todas las actividades para calcular cantidades pagadas
      if (Array.isArray(actividadesData) && actividadesData.length > 0) {
        const pagosMap = new Map<number, PagoActividad[]>()
        await Promise.all(
          actividadesData
            .filter(a => a.id)
            .map(async (actividad) => {
              try {
                const pagosActividad = await obtenerPagosActividad(actividad.id!)
                pagosMap.set(actividad.id!, pagosActividad)
              } catch (error) {
                console.error(`Error cargando pagos de actividad ${actividad.id}:`, error)
                pagosMap.set(actividad.id!, [])
              }
            })
        )
        setPagosPorActividad(pagosMap)
      }
    } catch (error: any) {
      console.error('Error loading data:', error)
      const errorMessage = error?.message || 'Error desconocido'
      if (errorMessage.includes('does not exist') || error?.code === '42P01') {
        alert('Error: Una o más tablas no existen en Supabase. Verifica que las tablas actividades y asociados estén creadas.')
      } else {
        alert('Error al cargar los datos: ' + errorMessage)
      }
      setActividades([])
      setSocios([])
      setPagosPorActividad(new Map())
    } finally {
      setLoading(false)
    }
  }

  const loadCaritasYPagos = async (actividadId: number) => {
    try {
      setErrorTablas(null)
      const [caritasData, pagosData] = await Promise.all([
        obtenerCaritasActividad(actividadId),
        obtenerPagosActividad(actividadId)
      ])
      setCaritas(Array.isArray(caritasData) ? caritasData : [])
      setPagos(Array.isArray(pagosData) ? pagosData : [])
    } catch (error: any) {
      console.error('Error loading caritas/pagos:', error)
      const errorMessage = error?.message || 'Error desconocido'
      if (errorMessage.includes('no existen en la base de datos')) {
        setErrorTablas(errorMessage)
      } else {
        setErrorTablas('Error al cargar los datos de la actividad')
      }
      setCaritas([])
      setPagos([])
    }
  }

  const handleCrearActividad = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!nombreActividad || !valor || !premio || !cantidad) {
      alert('Por favor completa todos los campos obligatorios')
      return
    }

    const cantidadNum = parseInt(cantidad)
    if (isNaN(cantidadNum) || cantidadNum < 1) {
      alert('La cantidad debe ser un número entero mayor o igual a 1')
      return
    }

    try {
      setSubmitting(true)
      const datosActividad: any = {
        nombre: nombreActividad,
        valor: parseFloat(valor),
        ganancia_total: parseFloat(premio),
        fecha: fechaActividad,
        cantidad: cantidadNum
      }
      
      await crearActividad(datosActividad)
      
      await loadData()
      setShowModalActividad(false)
      setNombreActividad('')
      setFechaActividad(new Date().toISOString().split('T')[0])
      setValor('')
      setCantidad('1')
      setPremio('')
      alert('Actividad creada exitosamente')
    } catch (error) {
      console.error('Error creating actividad:', error)
      alert('Error al crear la actividad')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAbrirTablero = async (actividad: Actividad) => {
    if (!actividad || !actividad.id) {
      alert('Error: La actividad no tiene un ID válido')
      return
    }
    
    setActividadSeleccionada(actividad)
    setErrorTablas(null)
    await loadCaritasYPagos(actividad.id)
    setView('tablero')
  }

  const handleVolver = () => {
    setView('lista')
    setActividadSeleccionada(null)
    setCaritas([])
    setPagos([])
    setErrorTablas(null)
  }

  // Obtener caritas de un socio específico
  const getCaritasSocio = (socioId: number): CaritaActividad[] => {
    if (!actividadSeleccionada) return []
    return caritas.filter(c => c.socio_id === socioId)
  }

  // Obtener una carita específica
  const getCaritaSocio = (socioId: number, numeroCarita: number): CaritaActividad | undefined => {
    return caritas.find(c => c.socio_id === socioId && c.carita_numero === numeroCarita)
  }

  // Obtener un pago específico (si existe)
  const getPagoSocio = (socioId: number, numeroCarita: number): PagoActividad | undefined => {
    return pagos.find(p => p.socio_id === socioId && p.carita_numero === numeroCarita)
  }

  // Obtener estado de una carita específica (desde actividades_caritas o verificando si tiene pago)
  const getEstadoCarita = (socioId: number, numeroCarita: number): 'pagado' | 'pendiente' => {
    const carita = getCaritaSocio(socioId, numeroCarita)
    if (!carita) return 'pendiente'
    // Si la carita tiene estado PAGADO o existe un pago, está pagada
    if (carita.estado === 'PAGADO') return 'pagado'
    const pago = getPagoSocio(socioId, numeroCarita)
    return pago ? 'pagado' : 'pendiente'
  }

  const handleCaritaClick = (socioId: number, numeroCarita: number) => {
    if (!actividadSeleccionada) return

    setSelectedCarita({ socioId, numeroCarita })
    setShowModalPago(true)
    
    const pago = getPagoSocio(socioId, numeroCarita)
    if (pago?.fecha_pago) {
      setFechaPago(pago.fecha_pago)
    } else {
      // Usar fecha de hoy por defecto
      const hoy = new Date()
      const fechaHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
      setFechaPago(fechaHoy)
    }
  }

  const handleRegistrarPago = async () => {
    if (!selectedCarita || !actividadSeleccionada || !actividadSeleccionada.id) return

    try {
      setSubmitting(true)
      const fechaPagoDate = dateFromInput(fechaPago)

      const pago = getPagoSocio(selectedCarita.socioId, selectedCarita.numeroCarita)

      if (pago) {
        await actualizarPagoActividad(
          actividadSeleccionada.id,
          selectedCarita.socioId,
          selectedCarita.numeroCarita,
          fechaPagoDate,
          fechaPago
        )
        alert('Pago actualizado exitosamente')
      } else {
        await registrarPagoActividad(
          actividadSeleccionada.id,
          selectedCarita.socioId,
          selectedCarita.numeroCarita,
          fechaPagoDate,
          fechaPago
        )
        alert('Pago registrado exitosamente')
      }

      await loadCaritasYPagos(actividadSeleccionada.id)
      await loadData()
      
      setShowModalPago(false)
      setSelectedCarita(null)
    } catch (error: any) {
      console.error('Error registering/updating pago:', error)
      alert('Error: ' + (error?.message || 'Error desconocido'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleEliminarPago = async () => {
    if (!selectedCarita || !actividadSeleccionada?.id) return

    if (!confirm('¿Estás seguro de que deseas eliminar este pago?')) {
      return
    }

    try {
      await eliminarPagoActividad(
        actividadSeleccionada.id,
        selectedCarita.socioId,
        selectedCarita.numeroCarita
      )
      await loadCaritasYPagos(actividadSeleccionada.id)
      await loadData()
      setShowModalPago(false)
      setSelectedCarita(null)
      alert('Pago eliminado exitosamente')
    } catch (error) {
      console.error('Error deleting pago:', error)
      alert('Error al eliminar el pago')
    }
  }

  const handleAgregarCarita = async (socioId: number) => {
    if (!actividadSeleccionada?.id) return

    try {
      await agregarCaritaActividad(actividadSeleccionada.id, socioId)
      await loadCaritasYPagos(actividadSeleccionada.id)
      alert('Carita agregada exitosamente')
    } catch (error: any) {
      console.error('Error agregando carita:', error)
      alert('Error: ' + (error?.message || 'Error desconocido'))
    }
  }

  const getCaritaColor = (estado: 'pagado' | 'pendiente', estaRetirado: boolean) => {
    if (estaRetirado) {
      return 'bg-gray-400 cursor-not-allowed opacity-60'
    }
  
    switch (estado) {
      case 'pagado':
        return 'bg-green-500 hover:bg-green-600'
      case 'pendiente':
        return 'bg-yellow-500 hover:bg-yellow-600'
      default:
        return 'bg-gray-300'
    }
  }

  const getCaritaEmoji = (estado: 'pagado' | 'pendiente', estaRetirado: boolean) => {
    if (estaRetirado) {
      return '😶'
    }
  
    switch (estado) {
      case 'pagado':
        return '😊'
      case 'pendiente':
        return '😐'
      default:
        return '⚪'
    }
  }

  // Expandir socios por cupos
  const expandirSociosConIndice = () => {
    const listaExpandida: Array<{ socio: Socio, cupoIndex: number, numeroFila: number }> = []
    let numeroFila = 1

    socios.forEach((socio) => {
      const cantidadCupos = socio.cantidad_cupos || 1
      for (let cupoIndex = 0; cupoIndex < cantidadCupos; cupoIndex++) {
        listaExpandida.push({ socio, cupoIndex, numeroFila })
        numeroFila++
      }
    })

    return listaExpandida
  }

  // Distribuir socios en columnas
  const distribuirEnColumnas = () => {
    const listaExpandida = expandirSociosConIndice()
    const totalSocios = listaExpandida.length
    const sociosPorColumna = Math.floor(totalSocios / NUM_COLUMNAS)
    const columnasExtra = totalSocios % NUM_COLUMNAS

    const columnas: Array<Array<{ socio: Socio, cupoIndex: number, numeroFila: number }>> = []
    let indiceActual = 0

    for (let col = 0; col < NUM_COLUMNAS; col++) {
      const cantidadEnColumna = sociosPorColumna + (col < columnasExtra ? 1 : 0)
      const columna = listaExpandida.slice(indiceActual, indiceActual + cantidadEnColumna)
      columnas.push(columna)
      indiceActual += cantidadEnColumna
    }

    return columnas
  }

  const handleShareWhatsApp = () => {
    if (!actividadSeleccionada) return

    let mensaje = `ACTIVIDAD: ${actividadSeleccionada.nombre}\n\n`
    mensaje += `Fecha: ${actividadSeleccionada.fecha ? new Date(actividadSeleccionada.fecha).toLocaleDateString('es-ES') : 'Sin fecha'}\n`
    mensaje += `Valor por carita: $${(actividadSeleccionada.valor || 0).toLocaleString()}\n`
    mensaje += `Premio: $${(actividadSeleccionada.ganancia_total || 0).toLocaleString()}\n\n`
    mensaje += `ESTADO DE CARITAS:\n\n`

    // Agrupar pagos por socio
    const pagosPorSocio = new Map<number, PagoActividad[]>()
    pagos.forEach(pago => {
      const socioId = pago.socio_id
      if (!socioId) return
      if (!pagosPorSocio.has(socioId)) {
        pagosPorSocio.set(socioId, [])
      }
      pagosPorSocio.get(socioId)!.push(pago)
    })

    pagosPorSocio.forEach((pagosSocio, socioId) => {
      const socio = socios.find(s => {
        const id = typeof s.id === 'string' ? parseInt(s.id) : s.id
        return id === socioId
      })
      const nombreSocio = socio?.nombre || `Socio ID ${socioId}`
      // Si existe pago, está pagado
      const pagadas = pagosSocio.length
      const caritasSocio = caritas.filter(c => c.socio_id === socioId)
      const total = Math.max(caritasSocio.length, pagadas)
      const totalPagado = pagosSocio.reduce((sum, p) => sum + (p.monto || 0), 0)
      mensaje += `${nombreSocio}:\n`
      mensaje += `  Caritas: ${total} (${pagadas} pagadas, ${total - pagadas} pendientes)\n`
      mensaje += `  Total pagado: $${totalPagado.toLocaleString()}\n\n`
    })

    const totalRecaudado = pagos.reduce((sum, p) => sum + (p.monto || 0), 0)
    mensaje += `\nTotal Recaudado: $${totalRecaudado.toLocaleString()}\n`
    mensaje += `Utilidad Neta: $${(actividadSeleccionada.utilidad_neta || 0).toLocaleString()}\n`

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(mensaje)}`
    window.open(whatsappUrl, '_blank')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8 flex items-center justify-center">
        <p className="text-xl text-gray-600 dark:text-gray-400">Cargando actividades...</p>
      </div>
    )
  }

  // VISTA DE LISTA DE ACTIVIDADES
  if (view === 'lista') {
    const columnasDistribuidas = distribuirEnColumnas()
    const maxFilas = Math.max(...columnasDistribuidas.map(col => col.length), 0)

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-4xl font-bold text-gray-800 dark:text-white">
              Módulo de Actividades
            </h1>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Volver al Home</span>
            </Link>
          </div>

          {/* Botón Nueva Actividad - Centrado y más grande */}
          <div className="flex justify-center mb-6">
            <button
              onClick={() => setShowModalActividad(true)}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-lg font-semibold"
            >
              <Plus className="w-5 h-5" />
              <span>Nueva Actividad</span>
            </button>
          </div>

          {/* Lista de Actividades - Tabla reorganizada */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Actividades</h2>
            {(!actividades || actividades.length === 0) ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No hay actividades registradas
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Actividad</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Cantidad Pagadas</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Total</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Premio</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Utilidad</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Ingresar</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Eliminar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {(actividades || []).map((actividad, index) => {
                      // Obtener pagos de esta actividad (solo caritas pagadas)
                      const pagosActividad = actividad?.id ? (pagosPorActividad.get(actividad.id) || []) : []
                      const cantidadPagadas = pagosActividad.length
                      
                      // Calcular total recaudado solo de caritas pagadas
                      const totalRecaudado = pagosActividad.reduce((sum, pago) => sum + (pago.monto || 0), 0)
                      
                      // Formatear fecha en DD/MM/YYYY
                      const fechaFormateada = actividad?.fecha ? (() => {
                        try {
                          const fecha = new Date(actividad.fecha)
                          if (isNaN(fecha.getTime())) return ''
                          const dia = String(fecha.getDate()).padStart(2, '0')
                          const mes = String(fecha.getMonth() + 1).padStart(2, '0')
                          const año = fecha.getFullYear()
                          return `${dia}/${mes}/${año}`
                        } catch {
                          return ''
                        }
                      })() : ''

                      return (
                        <tr key={actividad?.id ? `actividad-${actividad.id}` : `actividad-index-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-3">
                            <div className="text-gray-900 dark:text-white font-bold">
                              {actividad?.nombre || 'Sin nombre'}
                            </div>
                            {fechaFormateada && (
                              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {fechaFormateada}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-900 dark:text-white">
                            {cantidadPagadas}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-900 dark:text-white">
                            ${totalRecaudado.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-900 dark:text-white">
                            ${(actividad?.ganancia_total || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-900 dark:text-white">
                            ${(actividad?.utilidad_neta || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleAbrirTablero(actividad)}
                              disabled={!actividad || !actividad.id}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Ingresar
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={async () => {
                                if (!actividad?.id) return
                                if (!confirm(`¿Estás seguro de eliminar la actividad "${actividad.nombre}"? Esta acción eliminará todas las caritas asociadas y no se puede deshacer.`)) {
                                  return
                                }
                                try {
                                  await eliminarActividad(actividad.id)
                                  await loadData()
                                  alert('Actividad eliminada exitosamente')
                                } catch (error) {
                                  console.error('Error deleting actividad:', error)
                                  alert('Error al eliminar la actividad')
                                }
                              }}
                              disabled={!actividad?.id}
                              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

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
                      Valor *
                    </label>
                    <input
                      type="number"
                      value={valor}
                      onChange={(e) => setValor(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      min="0"
                      step="1000"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Valor que pagará cada asociado por concepto de boleta, bingo, rifa, etc.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Cantidad *
                    </label>
                    <input
                      type="number"
                      value={cantidad}
                      onChange={(e) => setCantidad(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      min="1"
                      step="1"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Número de caritas (boletas/tablas) que se crearán por defecto para cada asociado.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Premio *
                    </label>
                    <input
                      type="number"
                      value={premio}
                      onChange={(e) => setPremio(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      min="0"
                      step="1000"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Valor que la actividad entregará como premio.
                    </p>
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
        </div>
      </div>
    )
  }

  // VISTA DE TABLERO DE CARITAS (idéntico a cuotas)
  if (view === 'tablero' && actividadSeleccionada) {
    const columnasDistribuidas = distribuirEnColumnas()
    const maxFilas = Math.max(...columnasDistribuidas.map(col => col.length), 0)
    // Calcular el máximo de caritas por socio
    const maxCaritas = Math.max(...socios.map(s => {
      const socioId = typeof s.id === 'string' ? parseInt(s.id) : s.id
      if (!socioId) return actividadSeleccionada.cantidad || 1
      const caritasSocio = getCaritasSocio(socioId)
      return Math.max(caritasSocio.length, actividadSeleccionada.cantidad || 1)
    }), actividadSeleccionada.cantidad || 1)

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="max-w-[95vw] mx-auto">
          {/* Navegación */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-4xl font-bold text-gray-800 dark:text-white">
              {actividadSeleccionada.nombre}
            </h1>
            <div className="flex gap-3 items-center">
              <button
                onClick={handleVolver}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver</span>
              </button>
              <button
                onClick={handleShareWhatsApp}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span>Compartir</span>
              </button>
            </div>
          </div>

          {/* Error de tablas */}
          {errorTablas && (
            <div className="mb-6 p-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 rounded-lg">
              <p className="text-red-800 dark:text-red-200 font-semibold mb-2">⚠️ Error: Tablas no encontradas</p>
              <p className="text-red-700 dark:text-red-300 text-sm">{errorTablas}</p>
              <p className="text-red-600 dark:text-red-400 text-xs mt-2">
                Por favor, ejecuta el script SQL: <code className="bg-red-200 dark:bg-red-800 px-2 py-1 rounded">supabase-actividades-tablas.sql</code>
              </p>
            </div>
          )}

          {/* Título Central */}
          <div className="text-center mb-6">
            <h2 className="text-5xl font-bold text-gray-800 dark:text-white">
              {actividadSeleccionada.nombre}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Valor: ${(actividadSeleccionada.valor || 0).toLocaleString()} | Premio: ${(actividadSeleccionada.ganancia_total || 0).toLocaleString()}
            </p>
          </div>
          
          <div className="mb-4 p-4 bg-blue-100 dark:bg-blue-900 rounded-lg text-sm text-blue-800 dark:text-blue-200">
            <p className="font-semibold mb-2">Leyenda:</p>
            <div className="flex flex-wrap gap-4">
              <span className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">😊</span>
                <span>Pagado</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center">😐</span>
                <span>Pendiente</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center">😶</span>
                <span>Retirado</span>
              </span>
            </div>
          </div>

          {/* Tablero de Socios en 6 Columnas */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 overflow-x-auto">
            <div className="grid grid-cols-6 gap-3 min-w-max">
              {columnasDistribuidas.map((columna, colIndex) => (
                <div key={colIndex} className="flex flex-col min-w-[160px]">
                  {/* Header de columna */}
                  <div className="border-b-2 border-gray-300 dark:border-gray-600 pb-1 mb-2 sticky top-0 bg-white dark:bg-gray-800 z-10">
                    <div className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase">
                      ASOCIADO
                    </div>
                    <div className="flex gap-1 items-center text-[10px] font-semibold text-gray-600 dark:text-gray-400">
                      <div className="w-6 text-center">ID</div>
                      {Array.from({ length: Math.min(maxCaritas, 5) }).map((_, i) => (
                        <div key={i} className="w-6 text-center">C{i + 1}</div>
                      ))}
                      {maxCaritas > 5 && <div className="w-6 text-center">+</div>}
                    </div>
                  </div>

                  {/* Filas de la columna */}
                  <div className="space-y-0.5">
                    {columna.map((item) => {
                      const cantidadCupos = item.socio.cantidad_cupos || 1
                      const nombreDisplay = cantidadCupos > 1 
                        ? `${item.socio.nombre} ${item.cupoIndex + 1}`
                        : item.socio.nombre
                      
                      const socioId = typeof item.socio.id === 'string' ? parseInt(item.socio.id) : item.socio.id
                      const estaRetirado = item.socio.activo === false
                      
                      // Obtener todas las caritas de este socio
                      const caritasSocio = socioId ? getCaritasSocio(socioId) : []
                      const cantidadCaritasSocio = Math.max(caritasSocio.length, actividadSeleccionada.cantidad || 1)
                      
                      return (
                        <div
                          key={`${item.socio.id}-${item.cupoIndex}`}
                          className="border-b border-gray-200 dark:border-gray-700 pb-1 text-[11px]"
                        >
                          <div className={`font-medium mb-0.5 truncate ${estaRetirado ? 'text-gray-500 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                            {nombreDisplay}
                          </div>
                          <div className="flex gap-1 items-center">
                            <div className="w-6 text-center text-gray-600 dark:text-gray-400 font-semibold text-[10px]">
                              {item.numeroFila}
                            </div>
                            {Array.from({ length: Math.min(cantidadCaritasSocio, 5) }).map((_, i) => {
                              const numeroCarita = i + 1
                              const estado = socioId ? getEstadoCarita(socioId, numeroCarita) : 'pendiente'
                              return (
                                <button
                                  key={i}
                                  onClick={() => !estaRetirado && socioId && handleCaritaClick(socioId, numeroCarita)}
                                  disabled={estaRetirado}
                                  className={`w-6 h-6 rounded-full ${getCaritaColor(estado, estaRetirado)} text-white flex items-center justify-center transition-colors flex-shrink-0 ${estaRetirado ? '' : 'cursor-pointer'}`}
                                  title={estaRetirado ? 'Socio retirado' : `Carita ${numeroCarita} - ${estado}`}
                                >
                                  <span className="text-[10px]">{getCaritaEmoji(estado, estaRetirado)}</span>
                                </button>
                              )
                            })}
                            {cantidadCaritasSocio > 5 && (
                              <div className="w-6 text-center text-[10px] text-gray-600 dark:text-gray-400">
                                +{cantidadCaritasSocio - 5}
                              </div>
                            )}
                            {cantidadCaritasSocio === 0 && (
                              <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] text-gray-400">
                                ⚪
                              </div>
                            )}
                            {!estaRetirado && socioId && (
                              <button
                                onClick={() => handleAgregarCarita(socioId)}
                                className="w-6 h-6 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-colors flex-shrink-0 text-[10px]"
                                title="Agregar carita"
                              >
                                +
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    
                    {/* Espaciador */}
                    {Array.from({ length: maxFilas - columna.length }).map((_, index) => (
                      <div key={`spacer-${index}`} className="h-10" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Modal para registrar pago (idéntico al de cuotas) */}
          {showModalPago && selectedCarita && actividadSeleccionada && (() => {
            const pago = getPagoSocio(selectedCarita.socioId, selectedCarita.numeroCarita)
            const estado = getEstadoCarita(selectedCarita.socioId, selectedCarita.numeroCarita)
            const socio = socios.find(s => {
              const socioId = typeof s.id === 'string' ? parseInt(s.id) : s.id
              return socioId === selectedCarita.socioId
            })
            
            return (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                  <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
                    {pago ? 'Editar Pago' : 'Registrar Pago'}
                  </h2>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Socio:</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {socio?.nombre || 'Sin nombre'}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Carita:</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        Carita #{selectedCarita.numeroCarita}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Estado:</p>
                      <p className={`font-semibold capitalize ${estado === 'pagado' ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                        {estado}
                      </p>
                    </div>

                    <div>
                      <label htmlFor="fechaPago" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Fecha de Pago *
                      </label>
                      <input
                        type="date"
                        id="fechaPago"
                        value={fechaPago}
                        onChange={(e) => setFechaPago(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        required
                      />
                    </div>

                    <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Monto a pagar:</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">
                        ${(actividadSeleccionada.valor || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        1 carita × ${(actividadSeleccionada.valor || 0).toLocaleString()} = ${(actividadSeleccionada.valor || 0).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleRegistrarPago}
                        disabled={submitting}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {pago ? 'Actualizar Pago' : 'Registrar Pago'}
                      </button>
                      
                      {pago && (
                        <button
                          onClick={handleEliminarPago}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                        >
                          Eliminar
                        </button>
                      )}
                      
                      <button
                        onClick={() => {
                          setShowModalPago(false)
                          setSelectedCarita(null)
                        }}
                        className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    )
  }

  return null
}
