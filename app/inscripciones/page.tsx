'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Printer } from 'lucide-react'
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

  const handleImprimir = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    window.print()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8 flex items-center justify-center">
        <p className="text-xl text-gray-600 dark:text-gray-400">Cargando inscripciones...</p>
      </div>
    )
  }

  const listaExpandida = expandirSociosConIndice()

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
              type="button"
              onClick={handleImprimir}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors no-print"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / PDF</span>
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

        {/* Tablero de Socios - Layout Vertical con CSS Grid */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Header */}
            <div className="border-b-2 border-gray-300 dark:border-gray-600 pb-1 mb-2 sticky top-0 bg-white dark:bg-gray-800 z-10" style={{ display: 'grid', gridTemplateRows: 'repeat(1, min-content)', gridAutoFlow: 'column', gridAutoColumns: 'minmax(160px, 1fr)' }}>
              <div className="min-w-[160px]">
                <div className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase">
                  ASOCIADO
                </div>
                <div className="flex gap-1 items-center text-[10px] font-semibold text-gray-600 dark:text-gray-400">
                  <div className="w-6 text-center">ID</div>
                  <div className="w-6 text-center">INS</div>
                </div>
              </div>
            </div>
            
            {/* Lista de socios con CSS Grid - máximo 40 filas por columna */}
            <div style={{ display: 'grid', gridTemplateRows: 'repeat(40, min-content)', gridAutoFlow: 'column', gridAutoColumns: 'minmax(160px, 1fr)', gap: '0.125rem' }}>
              {listaExpandida.map((item) => {
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
                    className="border-b border-gray-200 dark:border-gray-700 pb-1 text-[11px] min-w-[160px]"
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
            </div>
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
      <style jsx global>{`
        @media print {
          /* ELIMINAR EL 'RESET' DEL NAVEGADOR - PRIMERO */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          /* FIJAR FONDO OSCURO CON BOX-SHADOW - INYECCIÓN DIRECTA */
          html,
          body {
            box-shadow: inset 0 0 0 1000px #111827 !important;
            background-color: #111827 !important;
            background: #111827 !important;
            color: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* CONTENEDORES PRINCIPALES - BOX-SHADOW PARA FONDO OSCURO */
          .min-h-screen,
          body > div,
          .bg-gray-900,
          .dark\\:bg-gray-900,
          .bg-gradient-to-br {
            box-shadow: inset 0 0 0 1000px #111827 !important;
            background-color: #111827 !important;
            color: white !important;
          }
          
          .bg-gray-800,
          .dark\\:bg-gray-800 {
            box-shadow: inset 0 0 0 1000px #1f2937 !important;
            background-color: #1f2937 !important;
            color: white !important;
          }
          
          .bg-gray-700 {
            box-shadow: inset 0 0 0 1000px #374151 !important;
            background-color: #374151 !important;
            color: white !important;
          }
          
          /* CONTENEDORES CLAROS - MANTENER COLORES ORIGINALES */
          .bg-blue-50 {
            box-shadow: inset 0 0 0 1000px #eff6ff !important;
            background-color: #eff6ff !important;
            color: black !important;
          }
          
          .bg-indigo-100 {
            box-shadow: inset 0 0 0 1000px #e0e7ff !important;
            background-color: #e0e7ff !important;
            color: black !important;
          }
          
          .bg-white {
            box-shadow: inset 0 0 0 1000px #ffffff !important;
            background-color: #ffffff !important;
            color: black !important;
          }
          
          /* TEXTOS VISIBLES - FORZAR COLORES */
          .text-white,
          .dark\\:text-white,
          .text-gray-100,
          .text-gray-200,
          .text-gray-300 {
            color: white !important;
          }
          
          /* Textos en fondos oscuros - blanco */
          .bg-gray-900 *,
          .bg-gray-800 *,
          .bg-gray-700 *,
          .dark\\:bg-gray-900 *,
          .dark\\:bg-gray-800 * {
            color: white !important;
          }
          
          /* Textos en fondos claros - negro */
          .bg-white *,
          .bg-blue-50 *,
          .bg-indigo-100 * {
            color: black !important;
          }
          
          /* Ocultar SOLO elementos de navegación y controles */
          .no-print,
          button:not(.rounded-full):not([class*="rounded-full"]),
          nav,
          a,
          select,
          input {
            display: none !important;
          }
          
          /* EXCEPCIÓN: NO ocultar caritas y círculos de indicadores */
          .rounded-full,
          .w-6.h-6.rounded-full,
          span.rounded-full,
          div.rounded-full,
          button.rounded-full,
          button[class*="rounded-full"],
          span:has(😊),
          span:has(😐) {
            display: inline-flex !important;
            visibility: visible !important;
          }
          
          /* MANTENER ESTÉTICA DARK - Fondos oscuros originales */
          .bg-gradient-to-br,
          .bg-blue-50,
          .bg-indigo-100,
          .bg-gray-900,
          .bg-gray-800,
          .bg-gray-700,
          .dark\\:bg-gray-900,
          .dark\\:bg-gray-800 {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          /* AJUSTAR CONTENEDOR AL PAPEL */
          main,
          .container,
          .min-h-screen,
          body > div,
          [class*="max-w"] {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 10px !important;
          }
          
          /* Tablas al 100% de ancho sin cortes */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto !important;
          }
          
          tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }
          
          thead {
            display: table-header-group !important;
          }
          
          /* MANTENER TEXTOS ORIGINALES - NO cambiar a negro */
          /* Los textos blancos se mantienen blancos, los grises se mantienen grises */
          /* Solo forzar colores, no cambiar colores de texto */
          
          /* PRESERVAR COLORES DE INDICADORES DE ESTADO */
          /* Verde - Pagada */
          .bg-green-500,
          .bg-green-600,
          .bg-green-700 {
            background-color: #10b981 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          /* Amarillo - Pendiente */
          .bg-yellow-500,
          .bg-yellow-600,
          .bg-yellow-700 {
            background-color: #eab308 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          /* CÍRCULOS DE INDICADORES - FORZAR COLORES CON BORDES GRUESOS */
          .rounded-full.bg-green-500,
          .rounded-full.bg-yellow-500,
          span.rounded-full,
          div.rounded-full,
          .w-6.h-6.rounded-full {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            opacity: 1 !important;
            display: inline-flex !important;
            visibility: visible !important;
          }
          
          /* CÍRCULOS CON BOX-SHADOW COMO RESPALDO */
          /* Círculos verdes */
          .rounded-full.bg-green-500,
          button.rounded-full.bg-green-500,
          button[class*="bg-green"] {
            background-color: #10b981 !important;
            background: #10b981 !important;
            border: 2px solid #10b981 !important;
            box-shadow: inset 0 0 0 1000px #10b981 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          /* Círculos amarillos */
          .rounded-full.bg-yellow-500,
          button.rounded-full.bg-yellow-500,
          button[class*="bg-yellow"] {
            background-color: #eab308 !important;
            background: #eab308 !important;
            border: 2px solid #eab308 !important;
            box-shadow: inset 0 0 0 1000px #eab308 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          /* Círculos grises */
          .rounded-full.bg-gray-400,
          button.rounded-full.bg-gray-400,
          button[class*="bg-gray"]:not([class*="bg-gray-200"]):not([class*="bg-gray-100"]) {
            background-color: #9ca3af !important;
            background: #9ca3af !important;
            border: 2px solid #9ca3af !important;
            box-shadow: inset 0 0 0 1000px #9ca3af !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          /* Mantener colores de texto en indicadores */
          .text-white {
            color: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          /* Asegurar que las caritas (emojis) sean visibles */
          span:has(😊),
          span:has(😐),
          .flex.items-center.justify-center {
            opacity: 1 !important;
            visibility: visible !important;
            display: inline-flex !important;
          }
          
          /* MANTENER FONDOS ORIGINALES DE TABLAS */
          tbody tr,
          tbody tr td {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          /* Fondos de tablas - mantener colores originales */
          .bg-white {
            background-color: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .dark\\:bg-gray-800 {
            background-color: #1f2937 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .bg-gray-100,
          .bg-gray-200 {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          .dark\\:bg-gray-700 {
            background-color: #374151 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          /* Excepción: mantener colores en indicadores dentro de celdas */
          tbody tr td .rounded-full,
          tbody tr td .bg-green-500,
          tbody tr td .bg-yellow-500 {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          /* Bordes visibles para tablas */
          table,
          th,
          td {
            border: 1px solid #d1d5db !important;
          }
        }
      `}</style>
    </div>
  )
}
