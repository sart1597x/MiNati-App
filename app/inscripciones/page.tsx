'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Share2 } from 'lucide-react'
import { getSocios, retirarSocio, updateSocio, deleteSocio } from '@/lib/socios'
import { Socio } from '@/lib/supabase'
import { obtenerInscripciones, pagarInscripcion, eliminarInscripcion, actualizarFechaPagoInscripcion, actualizarInscripcionCompleta, Inscripcion } from '@/lib/inscripciones'

export default function InscripcionesPage() {
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([])
  const [socios, setSocios] = useState<Socio[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedInscripcion, setSelectedInscripcion] = useState<{ inscripcionId: string, socioId: number } | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0])
  const [nombreSocio, setNombreSocio] = useState('')
  const [whatsappSocio, setWhatsappSocio] = useState('')
  const [valorInscripcion, setValorInscripcion] = useState<number>(0)

  const NUM_COLUMNAS = 6

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      // Cargar socios (todos los socios existentes)
      const sociosData = await getSocios()
      
      // Obtener IDs de socios existentes
      const idsSocios = new Set(
        sociosData.map(s => typeof s.id === 'string' ? parseInt(s.id) : (s.id || 0))
      )
      
      // Cargar todas las inscripciones y filtrar solo las de socios existentes
      const todasInscripciones = await obtenerInscripciones()
      const inscripcionesValidas = todasInscripciones.filter(i => 
        idsSocios.has(i.socio_id)
      )
      
      setInscripciones(inscripcionesValidas)
      setSocios(sociosData)
    } catch (error) {
      console.error('Error loading data:', error)
      alert('Error al cargar los datos. Verifica tu conexión a Supabase.')
    } finally {
      setLoading(false)
    }
  }

  const getInscripcionSocio = (socioId: number): Inscripcion | undefined => {
    return inscripciones.find(i => i.socio_id === socioId)
  }

  const getCaritaColor = (estado: 'PAGADA' | 'PENDIENTE', estaRetirado: boolean) => {
    if (estaRetirado) {
      return 'bg-gray-400 cursor-not-allowed opacity-60'
    }
  
    switch (estado) {
      case 'PAGADA':
        return 'bg-green-500 hover:bg-green-600'
      case 'PENDIENTE':
        return 'bg-yellow-500 hover:bg-yellow-600'
      default:
        return 'bg-gray-300'
    }
  }
  

  const getCaritaEmoji = (estado: 'PAGADA' | 'PENDIENTE', estaRetirado: boolean) => {
    if (estaRetirado) {
      return '😶'
    }
  
    switch (estado) {
      case 'PAGADA':
        return '😊'
      case 'PENDIENTE':
        return '😐'
      default:
        return '⚪'
    }
  }
  

  // Expandir socios por cupos y crear lista plana con índice
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

  // Distribuir socios en 6 columnas de forma balanceada
  const distribuirEnColumnas = () => {
    const listaExpandida = expandirSociosConIndice()
    const totalSocios = listaExpandida.length
    const sociosPorColumna = Math.floor(totalSocios / NUM_COLUMNAS)
    const columnasExtra = totalSocios % NUM_COLUMNAS

    const columnas: Array<Array<{ socio: Socio, cupoIndex: number, numeroFila: number }>> = []
    let indiceActual = 0

    for (let col = 0; col < NUM_COLUMNAS; col++) {
      // Las primeras 'columnasExtra' columnas tendrán un socio más
      const cantidadEnColumna = sociosPorColumna + (col < columnasExtra ? 1 : 0)
      const columna = listaExpandida.slice(indiceActual, indiceActual + cantidadEnColumna)
      columnas.push(columna)
      indiceActual += cantidadEnColumna
    }

    return columnas
  }

  const handleCaritaClick = (socioId: number) => {
    const inscripcion = getInscripcionSocio(socioId)
    if (!inscripcion) return

    // Encontrar el socio para cargar sus datos
    const socio = socios.find(s => {
      const id = typeof s.id === 'string' ? parseInt(s.id) : s.id
      return id === socioId
    })

    setSelectedInscripcion({ inscripcionId: inscripcion.id, socioId })
    setShowModal(true)
    
    // Precargar todos los datos del socio
    if (socio) {
      setNombreSocio(socio.nombre || '')
      setWhatsappSocio(socio.whatsapp || '')
    }
    
    // Precargar valor de inscripción
    setValorInscripcion(inscripcion.valor || 0)
    
    // Precargar fecha de pago
    if (inscripcion.fecha_pago) {
      setFechaPago(inscripcion.fecha_pago)
    } else {
      const hoy = new Date()
      const fechaHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
      setFechaPago(fechaHoy)
    }
  }

  const handleRegistrarPago = async () => {
    if (!selectedInscripcion) return

    try {
      setSubmitting(true)
      await pagarInscripcion(selectedInscripcion.inscripcionId)
      await loadData()
      setShowModal(false)
      setSelectedInscripcion(null)
      setNombreSocio('')
      setWhatsappSocio('')
      setValorInscripcion(0)
      alert('Pago de inscripción registrado exitosamente')
    } catch (error: any) {
      console.error('Error registrando pago:', error)
      alert('Error al registrar el pago: ' + (error?.message || 'Error desconocido'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleActualizarPago = async () => {
    if (!selectedInscripcion) return

    try {
      setSubmitting(true)
      
      // Validar campos requeridos
      if (!nombreSocio.trim() || !whatsappSocio.trim()) {
        alert('Por favor complete todos los campos obligatorios')
        return
      }

      const valorNum = parseFloat(String(valorInscripcion)) || 0
      const estado = valorNum > 0 ? 'PAGADA' : 'PENDIENTE'
      const fechaPagoFinal = valorNum > 0 ? fechaPago : null
      
      // 1. Actualizar inscripción completa (valor, estado, fecha_pago y manejar caja)
      await actualizarInscripcionCompleta(
        selectedInscripcion.inscripcionId,
        valorNum,
        estado as 'PAGADA' | 'PENDIENTE',
        fechaPagoFinal,
        nombreSocio.trim()
      )
      
      // 2. Actualizar datos del socio
      const socio = socios.find(s => {
        const id = typeof s.id === 'string' ? parseInt(s.id) : s.id
        return id === selectedInscripcion.socioId
      })
      
      if (socio && socio.id) {
        const socioId = typeof socio.id === 'string' ? parseInt(socio.id) : socio.id
        await updateSocio(socioId, {
          nombre: nombreSocio.trim(),
          whatsapp: whatsappSocio.trim()
        })
      }
      
      await loadData()
      setShowModal(false)
      setSelectedInscripcion(null)
      setNombreSocio('')
      setWhatsappSocio('')
      setValorInscripcion(0)
      alert('Inscripción actualizada exitosamente')
    } catch (error: any) {
      console.error('Error actualizando:', error)
      alert('Error al actualizar: ' + (error?.message || 'Error desconocido'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleEliminarInscripcion = async () => {
    if (!selectedInscripcion) return

    if (!confirm('¿Estás seguro de que deseas ELIMINAR COMPLETAMENTE este socio y TODOS sus registros? Esta acción eliminará: inscripciones, cuotas, moras, movimientos de caja y el socio. Esta acción NO puede deshacerse.')) {
      return
    }

    try {
      setSubmitting(true)
      // Eliminar el socio completo (incluye inscripciones, cuotas, moras, caja, etc.)
      await deleteSocio(selectedInscripcion.socioId)
      await loadData()
      setShowModal(false)
      setSelectedInscripcion(null)
      setNombreSocio('')
      setWhatsappSocio('')
      setValorInscripcion(0)
      alert('Socio eliminado completamente del sistema')
    } catch (error: any) {
      console.error('Error eliminando socio:', error)
      alert('Error al eliminar: ' + (error?.message || 'Error desconocido'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleRetirarSocio = async () => {
    if (!selectedInscripcion) return

    if (!confirm('¿Estás seguro de que deseas retirar este socio? Se calculará el total de cuotas e inscripción y se registrará un EGRESO en caja. Esta acción no puede deshacerse.')) {
      return
    }

    try {
      setSubmitting(true)
      const socioId = typeof selectedInscripcion.socioId === 'string' ? parseInt(selectedInscripcion.socioId) : selectedInscripcion.socioId
      await retirarSocio(socioId)
      await loadData()
      setShowModal(false)
      setSelectedInscripcion(null)
      setNombreSocio('')
      setWhatsappSocio('')
      setValorInscripcion(0)
      alert('Socio retirado exitosamente. Se registró el EGRESO correspondiente en caja.')
    } catch (error: any) {
      console.error('Error retirando socio:', error)
      alert('Error al retirar el socio: ' + (error?.message || 'Error desconocido'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleShareWhatsApp = () => {
    let mensaje = `CONTROL DE INSCRIPCIONES - MiNati2026\n\n`
    
    // Resumen general
    const cantidadPagadas = inscripciones.filter(i => i.estado === 'PAGADA').length
    const cantidadPendientes = inscripciones.filter(i => i.estado === 'PENDIENTE').length
    const totalRecaudado = inscripciones
      .filter(i => i.estado === 'PAGADA')
      .reduce((sum, i) => sum + (i.valor || 0), 0)
    
    mensaje += `RESUMEN:\n`
    mensaje += `Inscripciones Pagadas: ${cantidadPagadas}\n`
    mensaje += `Inscripciones Pendientes: ${cantidadPendientes}\n`
    mensaje += `Total Recaudado: $${totalRecaudado.toLocaleString()}\n\n`
    
    mensaje += `DETALLE POR SOCIO:\n\n`
    
    // Detalle por socio
    socios.forEach((socio, index) => {
      const inscripcion = getInscripcionSocio(typeof socio.id === 'string' ? parseInt(socio.id) : (socio.id || 0))
      const estado = inscripcion?.estado === 'PAGADA' ? '✅ Pagada' : '⏳ Pendiente'
      const fecha = inscripcion?.fecha_pago 
        ? new Date(inscripcion.fecha_pago).toLocaleDateString('es-ES')
        : 'Sin fecha'
      
      mensaje += `${index + 1}. ${socio.nombre} (${socio.cedula})\n`
      mensaje += `   Estado: ${estado}\n`
      if (inscripcion) {
        if (inscripcion.estado === 'PAGADA') {
          mensaje += `   Fecha Pago: ${fecha}\n`
          mensaje += `   Monto: $${inscripcion.valor.toLocaleString()}\n`
        } else {
          mensaje += `   Monto Pendiente: $${inscripcion.valor.toLocaleString()}\n`
        }
      }
      mensaje += `\n`
    })

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(mensaje)}`
    window.open(whatsappUrl, '_blank')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8 flex items-center justify-center">
        <p className="text-xl text-gray-600 dark:text-gray-400">Cargando inscripciones...</p>
      </div>
    )
  }

  // Calcular distribución de columnas
  const columnasDistribuidas = distribuirEnColumnas()
  const maxFilas = Math.max(...columnasDistribuidas.map(col => col.length), 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-[95vw] mx-auto">
        {/* Navegación */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white">
            Control de Inscripciones
          </h1>
          <div className="flex gap-3 items-center">
            <Link
              href="/socios"
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              <span>⬅ Volver</span>
            </Link>
            <button
              onClick={handleShareWhatsApp}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <Share2 className="w-4 h-4" />
              <span>Compartir en WhatsApp</span>
            </button>
          </div>
        </div>

        {/* Leyenda */}
        <div className="mb-4 p-4 bg-blue-100 dark:bg-blue-900 rounded-lg text-sm text-blue-800 dark:text-blue-200">
          <p className="font-semibold mb-2">Leyenda:</p>
          <div className="flex flex-wrap gap-4">
            <span className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">😊</span>
              <span>Pagada</span>
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
                    <div className="w-6 text-center">INS</div>
                  </div>
                </div>

                {/* Filas de la columna */}
                <div className="space-y-0.5">
                  {columna.map((item) => {
                    const cantidadCupos = item.socio.cantidad_cupos || 1
                    const nombreDisplay = cantidadCupos > 1 
                      ? `${item.socio.nombre} ${item.cupoIndex + 1}`
                      : item.socio.nombre
                    
                    const socioId = typeof item.socio.id === 'string' ? parseInt(item.socio.id) : (item.socio.id || 0)
                    const inscripcion = getInscripcionSocio(socioId)
                    const estado = inscripcion?.estado || 'PENDIENTE'
                    const estaRetirado = item.socio.activo === false
                    
                    return (
                      <div
                        key={`${item.socio.id}-${item.cupoIndex}`}
                        className="border-b border-gray-200 dark:border-gray-700 pb-1 text-[11px]"
                      >
                        <div className="font-medium text-gray-900 dark:text-white mb-0.5 truncate">
                          {nombreDisplay}
                        </div>
                        <div className="flex gap-1 items-center">
                          <div className="w-6 text-center text-gray-600 dark:text-gray-400 font-semibold text-[10px]">
                            {item.numeroFila}
                          </div>
                          <button
  disabled={estaRetirado}
  onClick={() => {
    if (estaRetirado) return
    handleCaritaClick(socioId)
  }}
  className={`w-6 h-6 rounded-full ${getCaritaColor(estado as 'PAGADA' | 'PENDIENTE', estaRetirado)} text-white flex items-center justify-center transition-colors flex-shrink-0 ${
    estaRetirado ? 'cursor-not-allowed' : 'cursor-pointer'
  }`}
  title={estaRetirado ? 'Socio retirado' : `Inscripción - ${estado === 'PAGADA' ? 'Pagada' : 'Pendiente'}`}
>
  <span className="text-[10px]">{getCaritaEmoji(estado as 'PAGADA' | 'PENDIENTE', estaRetirado)}</span>
</button>

                        </div>
                      </div>
                    )
                  })}
                  
                  {/* Espaciador para mantener alineación si la columna tiene menos filas */}
                  {Array.from({ length: maxFilas - columna.length }).map((_, index) => (
                    <div key={`spacer-${index}`} className="h-10" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal para registrar/actualizar/eliminar inscripción */}
        {showModal && selectedInscripcion && (() => {
          const inscripcion = inscripciones.find(i => i.id === selectedInscripcion.inscripcionId)
          const socio = socios.find(s => {
            const id = typeof s.id === 'string' ? parseInt(s.id) : s.id
            return id === selectedInscripcion.socioId
          })
          const estaPagada = inscripcion?.estado === 'PAGADA'
          const estaRetirado = socio?.activo === false

          
          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
                  {estaPagada ? 'Actualizar Inscripción' : 'Registrar Pago de Inscripción'}
                </h2>
                
                <div className="space-y-4">
                  {estaPagada ? (
                    <>
                      <div>
                        <label htmlFor="nombreSocio" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Nombre del Socio *
                        </label>
                        <input
                          type="text"
                          id="nombreSocio"
                          value={nombreSocio}
                          onChange={(e) => setNombreSocio(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          required
                        />
                      </div>

                      <div>
                        <label htmlFor="whatsappSocio" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          WhatsApp *
                        </label>
                        <input
                          type="text"
                          id="whatsappSocio"
                          value={whatsappSocio}
                          onChange={(e) => setWhatsappSocio(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          required
                        />
                      </div>
                    </>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Socio:</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {socio?.nombre || 'N/A'}
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Estado:</p>
                    <p className={`font-semibold capitalize ${estaPagada ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                      {estaPagada ? 'Pagada' : 'Pendiente'}
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

                  {estaPagada && (
                    <div className="relative">
                      <label htmlFor="valorInscripcion" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Valor de Inscripción *
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          id="valorInscripcion"
                          value={valorInscripcion || ''}
                          onChange={(e) => setValorInscripcion(parseFloat(e.target.value) || 0)}
                          className="w-full px-4 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          min="0"
                          step="1"
                          required
                        />
                        {valorInscripcion > 0 && (
                          <button
                            type="button"
                            onClick={() => setValorInscripcion(0)}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-bold text-xl leading-none w-6 h-6 flex items-center justify-center"
                            title="Limpiar valor"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4 flex-wrap">
                    {!estaPagada ? (
                      <button
                        onClick={handleRegistrarPago}
                        disabled={submitting}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {submitting ? 'Registrando...' : 'Registrar Pago'}
                      </button>
                    ) : (
                      <button
                        onClick={handleActualizarPago}
                        disabled={submitting}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {submitting ? 'Actualizando...' : 'Actualizar Inscripción'}
                      </button>
                    )}
                    
                    <button
                      onClick={() => {
                        setShowModal(false)
                        setSelectedInscripcion(null)
                        setNombreSocio('')
                        setWhatsappSocio('')
                        setValorInscripcion(0)
                      }}
                      className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>

                  {/* Botones de acciones destructivas - Separados para evitar errores */}
                  {!estaRetirado && (
                    <div className="flex gap-3 pt-6 mt-6 border-t border-gray-300 dark:border-gray-600 flex-wrap">
                      <button
                        onClick={handleEliminarInscripcion}
                        disabled={submitting}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Eliminar
                      </button>
                      
                      <button
                        onClick={handleRetirarSocio}
                        disabled={submitting}
                        className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Retirar socio
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
