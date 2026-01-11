'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Home, ArrowLeft, Share2, Edit2 } from 'lucide-react'
import { 
  obtenerPrestamos, 
  obtenerMovimientosPrestamo, 
  actualizarMovimientoPrestamo,
  Prestamo,
  PagoPrestamo 
} from '@/lib/prestamos'

interface MovimientoCalculado extends PagoPrestamo {
  capital_pendiente: number
  dias_causados: number
  tipo_display: string
}

export default function ExtractoPrestamoPage() {
  const params = useParams()
  const prestamoId = params.id as string

  const [prestamo, setPrestamo] = useState<Prestamo | null>(null)
  const [movimientos, setMovimientos] = useState<MovimientoCalculado[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [movimientoEditando, setMovimientoEditando] = useState<MovimientoCalculado | null>(null)
  const [editValorPagado, setEditValorPagado] = useState('')
  const [editInteresCausado, setEditInteresCausado] = useState('')
  const [editAbonoCapital, setEditAbonoCapital] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadData()
  }, [prestamoId])

  const calcularMovimientos = (prestamo: Prestamo, movimientosBD: PagoPrestamo[]): MovimientoCalculado[] => {
    if (!prestamo || movimientosBD.length === 0) return []
    
    const tasaInteres = (prestamo as any).tasa_interes || 0
    const movimientosCalculados: MovimientoCalculado[] = []
    let capitalPendiente = prestamo.monto
    
    for (let i = 0; i < movimientosBD.length; i++) {
      const mov = movimientosBD[i]
      const esDesembolso = mov.tipo_movimiento === 'desembolso'
      
      let diasCausados = 0
      let interesCausado = 0
      let abonoCapital = 0
      let valorPagado = mov.valor_pagado || 0
      
      if (i === 0) {
        // Desembolso inicial
        diasCausados = 0
        interesCausado = 0
        abonoCapital = 0 // CORRECCIÓN: Desembolso tiene abono a capital = $0
        capitalPendiente = prestamo.monto
        valorPagado = 0
      } else {
        // Calcular días desde el movimiento anterior
        const fechaAnterior = new Date(movimientosBD[i - 1].fecha)
        const fechaActual = new Date(mov.fecha)
        diasCausados = Math.max(0, Math.floor((fechaActual.getTime() - fechaAnterior.getTime()) / (1000 * 60 * 60 * 24)))
        
        // Calcular interés: Capital Pendiente Anterior * Tasa / 100 / 30 * Días
        const capitalAnterior = movimientosCalculados[i - 1].capital_pendiente
        const interesDiario = (capitalAnterior * tasaInteres) / 100 / 30
        interesCausado = interesDiario * diasCausados
        
        // Determinar abono a capital
        if (mov.tipo_movimiento === 'abono_capital') {
          abonoCapital = Math.max(0, valorPagado - interesCausado)
          capitalPendiente = Math.max(0, capitalAnterior - abonoCapital)
        } else if (mov.tipo_movimiento === 'pago_interes') {
          abonoCapital = 0
          capitalPendiente = capitalAnterior
        } else {
          abonoCapital = mov.abono_capital || 0
          capitalPendiente = Math.max(0, capitalAnterior - abonoCapital)
        }
      }
      
      let tipoDisplay = 'DESEMBOLSO'
      if (mov.tipo_movimiento === 'pago_interes') tipoDisplay = 'PAGO INTERESES'
      else if (mov.tipo_movimiento === 'abono_capital') tipoDisplay = 'ABONO A CAPITAL'
      else if (mov.tipo_movimiento === 'sin_pago') tipoDisplay = 'SIN PAGO'
      else if (mov.tipo_movimiento === 'pago_total') tipoDisplay = 'PAGO TOTAL'
      
      movimientosCalculados.push({
        ...mov,
        capital_pendiente: capitalPendiente,
        dias_causados: diasCausados,
        interes_causado: interesCausado,
        abono_capital: abonoCapital,
        valor_pagado: valorPagado,
        tipo_display: tipoDisplay
      })
    }
    
    // Agregar fila proyectada hasta hoy (si el préstamo está activo)
    if (prestamo.estado === 'activo' && movimientosCalculados.length > 0) {
      const ultimoMov = movimientosCalculados[movimientosCalculados.length - 1]
      const fechaUltimo = new Date(ultimoMov.fecha)
      const fechaHoy = new Date()
      const diasProyectados = Math.max(0, Math.floor((fechaHoy.getTime() - fechaUltimo.getTime()) / (1000 * 60 * 60 * 24)))
      
      if (diasProyectados > 0) {
        const capitalAnterior = ultimoMov.capital_pendiente
        const interesDiario = (capitalAnterior * tasaInteres) / 100 / 30
        const interesProyectado = interesDiario * diasProyectados
        const saldoProyectado = capitalAnterior + interesProyectado
        
        movimientosCalculados.push({
          id: undefined,
          prestamo_id: prestamo.id!,
          fecha: fechaHoy.toISOString().split('T')[0],
          tipo_movimiento: 'sin_pago',
          valor_pagado: 0,
          interes_causado: interesProyectado,
          abono_capital: 0,
          saldo_pendiente: saldoProyectado,
          capital_pendiente: capitalAnterior,
          dias_causados: diasProyectados,
          tipo_display: 'PROYECCIÓN A HOY'
        })
      }
    }
    
    return movimientosCalculados
  }

  const loadData = async () => {
    try {
      setLoading(true)
      const [prestamosData, movimientosData] = await Promise.all([
        obtenerPrestamos(),
        obtenerMovimientosPrestamo(prestamoId)
      ])
      
      const prestamoIdNum = typeof prestamoId === 'string' ? parseInt(prestamoId) : prestamoId
      const prestamoEncontrado = prestamosData.find(p => {
        const pId = typeof p.id === 'string' ? parseInt(p.id) : p.id
        return pId === prestamoIdNum
      })
      
      if (prestamoEncontrado) {
        setPrestamo(prestamoEncontrado)
        const movimientosCalc = calcularMovimientos(prestamoEncontrado, movimientosData)
        setMovimientos(movimientosCalc)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      alert('Error al cargar los datos. Verifica tu conexión a Supabase.')
    } finally {
      setLoading(false)
    }
  }

  const handleEditar = (movimiento: MovimientoCalculado) => {
    if (movimiento.tipo_movimiento === 'desembolso') {
      alert('El desembolso inicial no se puede editar.')
      return
    }
    
    setMovimientoEditando(movimiento)
    setEditValorPagado(movimiento.valor_pagado.toString())
    setEditInteresCausado(movimiento.interes_causado?.toString() || '0')
    setEditAbonoCapital(movimiento.abono_capital?.toString() || '0')
    setShowEditModal(true)
  }

  const handleGuardarEdicion = async () => {
    if (!movimientoEditando || !prestamo) return

    const nuevoValorPagado = parseFloat(editValorPagado) || 0
    const nuevoInteresCausado = parseFloat(editInteresCausado) || 0
    const nuevoAbonoCapital = parseFloat(editAbonoCapital) || 0

    // Validar coherencia
    if (nuevoAbonoCapital > movimientoEditando.capital_pendiente) {
      alert(`El abono a capital no puede ser mayor al capital pendiente ($${movimientoEditando.capital_pendiente.toLocaleString()})`)
      return
    }

    if (nuevoValorPagado < nuevoInteresCausado) {
      alert('El valor pagado no puede ser menor al interés causado.')
      return
    }

    try {
      setSubmitting(true)
      
      await actualizarMovimientoPrestamo(movimientoEditando.id!, {
        valor_pagado: nuevoValorPagado,
        interes_causado: nuevoInteresCausado,
        abono_capital: nuevoAbonoCapital
      })

      await loadData()
      
      setShowEditModal(false)
      setMovimientoEditando(null)
      alert('Movimiento actualizado exitosamente. Los saldos han sido recalculados.')
    } catch (error) {
      console.error('Error updating movimiento:', error)
      alert('Error al actualizar el movimiento')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCompartirWhatsApp = () => {
    if (!prestamo) return

    let mensaje = `EXTRACTO DE CRÉDITO\n\n`
    mensaje += `Cliente: ${prestamo.nombre_prestamista}\n`
    mensaje += `Monto: $${prestamo.monto.toLocaleString()}\n`
    const tasaInteres = (prestamo as any).tasa_interes || 0
    mensaje += `Tasa: ${tasaInteres}% mensual\n\n`
    mensaje += `MOVIMIENTOS:\n\n`

    movimientos.forEach((mov, index) => {
      if (mov.tipo_movimiento !== 'desembolso' || index === 0) {
        mensaje += `${index}. ${new Date(mov.fecha).toLocaleDateString('es-ES')} - ${mov.tipo_display}\n`
        if (mov.valor_pagado > 0) {
          mensaje += `   Valor Pagado: $${mov.valor_pagado.toLocaleString()}\n`
        }
        if (mov.dias_causados > 0) {
          mensaje += `   Días: ${mov.dias_causados}\n`
        }
        if (mov.interes_causado > 0) {
          mensaje += `   Interés: $${mov.interes_causado.toLocaleString()}\n`
        }
        if (mov.abono_capital > 0) {
          mensaje += `   Abono Capital: $${mov.abono_capital.toLocaleString()}\n`
        }
        mensaje += `   Capital Pendiente: $${mov.capital_pendiente.toLocaleString()}\n`
        mensaje += `   Saldo Total: $${mov.saldo_pendiente.toLocaleString()}\n\n`
      }
    })

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(mensaje)}`
    window.open(whatsappUrl, '_blank')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8 flex items-center justify-center">
        <p className="text-xl text-gray-400">Cargando extracto...</p>
      </div>
    )
  }

  if (!prestamo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-400 mb-4">Préstamo no encontrado</p>
          <Link href="/prestamos/lista" className="text-blue-400 hover:text-blue-300">
            Volver a la lista
          </Link>
        </div>
      </div>
    )
  }

  const tasaInteres = (prestamo as any).tasa_interes || 0
  const numeroCredito = `NAT${String(prestamo.id).padStart(4, '0')}`

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🐷</span>
            <h1 className="text-4xl font-bold text-white">Minati2026</h1>
          </div>
          <div className="flex gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </Link>
            <Link
              href="/prestamos/lista"
              className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Regresar</span>
            </Link>
          </div>
        </div>

        {/* Encabezado del Extracto */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6 border border-gray-700">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-white mb-2">EXTRACTO DE CRÉDITO</h2>
            <p className="text-gray-400">CREDITO NO. {numeroCredito}</p>
            <p className="text-sm text-gray-500 mt-1">Fecha extracto: {new Date().toLocaleDateString('es-ES')}</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-gray-700 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">Deudor</p>
              <p className="text-lg font-semibold text-white">{prestamo.nombre_prestamista}</p>
            </div>
            <div className="p-4 bg-gray-700 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">Monto del crédito</p>
              <p className="text-lg font-semibold text-white">${prestamo.monto.toLocaleString()}</p>
            </div>
            <div className="p-4 bg-gray-700 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">Tasa de interés</p>
              <p className="text-lg font-semibold text-white">{tasaInteres}% mensual</p>
            </div>
            <div className="p-4 bg-gray-700 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">Fecha de desembolso</p>
              <p className="text-lg font-semibold text-white">{new Date(prestamo.fecha_inicio).toLocaleDateString('es-ES')}</p>
            </div>
          </div>

          <div className="flex justify-center gap-3">
            {movimientos.length > 0 && (
              <div className={`px-4 py-2 rounded-lg font-semibold ${
                movimientos[movimientos.length - 1].capital_pendiente <= 0 
                  ? 'bg-gray-600 text-white' 
                  : 'bg-green-600 text-white'
              }`}>
                {movimientos[movimientos.length - 1].capital_pendiente <= 0 
                  ? 'Estado: Pagado' 
                  : 'Estado: Activo'}
              </div>
            )}
            <button
              onClick={handleCompartirWhatsApp}
              className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg transition-colors"
            >
              <Share2 className="w-4 h-4" />
              <span>Compartir</span>
            </button>
          </div>
        </div>

        {/* Tabla de Movimientos */}
        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full table-auto text-sm">
              <thead>
                <tr className="bg-gray-700 border-b border-gray-600">
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase">#</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase">FECHA</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase">TIPO DE MOVIMIENTO</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase">VALOR PAGADO</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase">DÍAS CAUSADOS</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase">INTERÉS CAUSADO</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase">ABONO A CAPITAL</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase">CAPITAL PENDIENTE</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase">SALDO TOTAL PENDIENTE</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-300 uppercase">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {movimientos.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                      No hay movimientos registrados
                    </td>
                  </tr>
                ) : (
                  movimientos.map((mov, index) => {
                    const esProyeccion = mov.tipo_display === 'PROYECCIÓN A HOY'
                    return (
                      <tr 
                        key={mov.id || `proj-${index}`} 
                        className={`hover:bg-gray-700 ${esProyeccion ? 'bg-gray-750 border-t-2 border-blue-500' : ''}`}
                      >
                        <td className="px-3 py-3 text-gray-300">{index}</td>
                        <td className="px-3 py-3 text-gray-300">
                          {new Date(mov.fecha).toLocaleDateString('es-ES')}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            mov.tipo_display === 'DESEMBOLSO' ? 'bg-blue-700 text-white' :
                            mov.tipo_display === 'PAGO INTERESES' ? 'bg-green-700 text-white' :
                            mov.tipo_display === 'ABONO A CAPITAL' ? 'bg-purple-700 text-white' :
                            mov.tipo_display === 'SIN PAGO' ? 'bg-red-700 text-white' :
                            mov.tipo_display === 'PAGO TOTAL' ? 'bg-yellow-700 text-white' :
                            'bg-gray-600 text-white'
                          }`}>
                            {mov.tipo_display}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right text-gray-300">
                          {mov.valor_pagado > 0 ? `$${mov.valor_pagado.toLocaleString()}` : '$ -'}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-300">
                          {mov.dias_causados > 0 ? mov.dias_causados : '-'}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-300">
                          {mov.interes_causado > 0 ? `$${mov.interes_causado.toFixed(2)}` : '$ -'}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-300">
                          {mov.abono_capital > 0 ? `$${mov.abono_capital.toLocaleString()}` : '$ -'}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-gray-200">
                          ${mov.capital_pendiente.toLocaleString()}
                        </td>
                        <td className={`px-3 py-3 text-right font-bold ${esProyeccion ? 'text-blue-400' : 'text-gray-200'}`}>
                          ${mov.saldo_pendiente.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {mov.tipo_movimiento !== 'desembolso' && !esProyeccion && (
                            <button
                              onClick={() => handleEditar(mov)}
                              className="text-blue-400 hover:text-blue-300 transition-colors"
                              title="Editar movimiento"
                            >
                              <Edit2 className="w-4 h-4 inline" />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          
          {movimientos.length > 0 && (
            <div className="px-4 py-3 bg-gray-700 border-t border-gray-600">
              <p className="text-xs text-gray-400">
                Nota: El saldo total pendiente corresponde a la suma del capital pendiente de pago más los intereses causados a la fecha y no cancelados.
              </p>
            </div>
          )}
        </div>

        {/* Modal de Edición */}
        {showEditModal && movimientoEditando && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4 border border-gray-700">
              <h2 className="text-2xl font-bold mb-4 text-white">Editar Movimiento</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Valor Pagado *
                  </label>
                  <input
                    type="number"
                    value={editValorPagado}
                    onChange={(e) => setEditValorPagado(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="1000"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Interés Causado *
                  </label>
                  <input
                    type="number"
                    value={editInteresCausado}
                    onChange={(e) => setEditInteresCausado(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Abono a Capital *
                  </label>
                  <input
                    type="number"
                    value={editAbonoCapital}
                    onChange={(e) => setEditAbonoCapital(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="1000"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Capital pendiente actual: ${movimientoEditando.capital_pendiente.toLocaleString()}
                  </p>
                </div>

                <div className="bg-yellow-900 bg-opacity-50 border border-yellow-700 p-3 rounded-lg">
                  <p className="text-sm text-yellow-200">
                    ⚠️ Al guardar, se recalcularán automáticamente todas las filas siguientes del extracto.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleGuardarEdicion}
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowEditModal(false)
                      setMovimientoEditando(null)
                    }}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
