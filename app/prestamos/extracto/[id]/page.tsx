'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Home, ArrowLeft, Printer, Edit2, CreditCard, X, Trash2 } from 'lucide-react'
import { 
  obtenerPrestamos, 
  obtenerMovimientosPrestamo, 
  actualizarMovimientoPrestamo,
  registrarPagoPrestamo,
  calcularSaldoActual,
  eliminarPagoPrestamo,
  redondear,
  Prestamo,
  PagoPrestamo 
} from '@/lib/prestamos'

// Helper para parsear fechas sin problemas de zona horaria
function dateFromInput(fecha: string): Date {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

// Helper para obtener fecha local sin UTC
function getFechaLocalHoy(): string {
  const hoy = new Date()
  const year = hoy.getFullYear()
  const month = String(hoy.getMonth() + 1).padStart(2, '0')
  const day = String(hoy.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

interface MovimientoCalculado extends PagoPrestamo {
  capital_pendiente: number
  dias_causados: number
  tipo_display: string
  interes_pendiente: number
  interes_pagado: number
}

export default function ExtractoPrestamoPage() {
  const params = useParams()
  const prestamoId = params.id as string

  const [anioVigente, setAnioVigente] = useState<number>(new Date().getFullYear())
  const [prestamo, setPrestamo] = useState<Prestamo | null>(null)
  const [movimientos, setMovimientos] = useState<MovimientoCalculado[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [movimientoEditando, setMovimientoEditando] = useState<MovimientoCalculado | null>(null)
  const [editValorPagado, setEditValorPagado] = useState('')
  const [editInteresCausado, setEditInteresCausado] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [eliminando, setEliminando] = useState<number | string | null>(null)
  
  // Estados para modal de pago
  const [showPagoModal, setShowPagoModal] = useState(false)
  const [fechaPago, setFechaPago] = useState(getFechaLocalHoy())
  const [valorPagado, setValorPagado] = useState('')
  const [observacion, setObservacion] = useState('')
  const [saldoPendiente, setSaldoPendiente] = useState(0)
  const [registrandoPago, setRegistrandoPago] = useState(false)

  useEffect(() => {
    const fetchAnio = async () => {
      try {
        const response = await fetch('/api/configuracion/anio')
        const data = await response.json()
        if (data.anio) {
          setAnioVigente(data.anio)
        }
      } catch (error) {
        console.error('Error obteniendo año vigente:', error)
      }
    }
    fetchAnio()
    loadData()
  }, [prestamoId])

  const calcularMovimientos = (prestamo: Prestamo, movimientosBD: PagoPrestamo[]): MovimientoCalculado[] => {
    if (!prestamo || movimientosBD.length === 0) return []
    
    const tasaInteres = (prestamo as any).tasa_interes || 0
    const movimientosCalculados: MovimientoCalculado[] = []
    let capitalPendiente = redondear(prestamo.monto)
    let interesPendiente = 0
    
    for (let i = 0; i < movimientosBD.length; i++) {
      const mov = movimientosBD[i]
      const esDesembolso = mov.tipo_movimiento === 'desembolso'
      
      let diasCausados = 0
      let interesCausado = 0
      let interesPagado = 0
      let abonoCapital = 0
      let valorPagado = redondear(mov.valor_pagado || 0)
      
      if (i === 0) {
        // Desembolso inicial
        diasCausados = 0
        interesCausado = 0
        interesPagado = 0
        abonoCapital = 0
        interesPendiente = 0
        capitalPendiente = redondear(prestamo.monto)
        valorPagado = 0
      } else {
        // Calcular días desde el movimiento anterior
        const fechaAnterior = dateFromInput(movimientosBD[i - 1].fecha)
        const fechaActual = dateFromInput(mov.fecha)
        diasCausados = Math.max(0, Math.floor((fechaActual.getTime() - fechaAnterior.getTime()) / (1000 * 60 * 60 * 24)))
        
        // FÓRMULA ÚNICA: Interés_Causado = (Capital × Tasa/30 × Días) + Interés_Pendiente_Anterior
        const capitalAnterior = movimientosCalculados[i - 1].capital_pendiente
        const interesDiario = (capitalAnterior * tasaInteres) / 100 / 30
        const interesCausadoPorDias = interesDiario * diasCausados
        interesCausado = redondear(interesCausadoPorDias + interesPendiente)
        
        // DISTRIBUCIÓN ÚNICA DEL PAGO (sin excepciones)
        interesPagado = Math.min(redondear(valorPagado), interesCausado)
        abonoCapital = Math.max(0, redondear(valorPagado) - interesCausado)
        interesPendiente = interesCausado - interesPagado
        
        // Actualizar capital pendiente
        capitalPendiente = Math.max(0, redondear(capitalAnterior - abonoCapital))
      }
      
      // Calcular saldo total pendiente
      const saldoTotalPendiente = redondear(capitalPendiente + interesPendiente)
      
      // DETERMINAR TIPO DISPLAY según los valores calculados (no solo tipo_movimiento)
      // REGLA ÚNICA: Evaluar en orden exacto según los valores finales
      let tipoDisplay = 'DESEMBOLSO'
      
      if (esDesembolso) {
        tipoDisplay = 'DESEMBOLSO'
      } else if (mov.tipo_movimiento === 'sin_pago') {
        tipoDisplay = 'SIN PAGO'
      } else if (mov.tipo_movimiento === 'pago_total' || (capitalPendiente === 0 && interesPendiente === 0)) {
        tipoDisplay = 'PAGO TOTAL'
      } else if (interesPagado > 0 && abonoCapital > 0) {
        // PAGO INTERÉS + ABONO A CAPITAL (prioridad)
        tipoDisplay = 'PAGO INTERÉS + ABONO A CAPITAL'
      } else if (interesPagado > 0 && abonoCapital === 0 && interesPendiente > 0) {
        tipoDisplay = 'PAGO INTERÉS (SE GENERÓ INTERÉS PENDIENTE)'
      } else if (interesPagado === 0 && abonoCapital > 0) {
        tipoDisplay = 'ABONO A CAPITAL'
      } else if (interesPagado > 0) {
        tipoDisplay = 'PAGO INTERESES'
      } else {
        tipoDisplay = 'PAGO INTERESES' // Default
      }
      
      movimientosCalculados.push({
        ...mov,
        capital_pendiente: capitalPendiente,
        dias_causados: diasCausados,
        interes_causado: interesCausado,
        interes_pagado: interesPagado,
        interes_pendiente: interesPendiente,
        abono_capital: abonoCapital,
        valor_pagado: valorPagado,
        saldo_pendiente: saldoTotalPendiente,
        tipo_display: tipoDisplay
      })
    }
    
    // Agregar fila proyectada hasta hoy (si el préstamo está activo)
    if (prestamo.estado === 'activo' && movimientosCalculados.length > 0) {
      const ultimoMov = movimientosCalculados[movimientosCalculados.length - 1]
      const fechaUltimo = dateFromInput(ultimoMov.fecha)
      const fechaHoy = new Date()
      fechaHoy.setHours(0, 0, 0, 0) // Normalizar a medianoche
      const diasProyectados = Math.max(0, Math.floor((fechaHoy.getTime() - fechaUltimo.getTime()) / (1000 * 60 * 60 * 24)))
      
      if (diasProyectados > 0) {
        const capitalAnterior = ultimoMov.capital_pendiente
        const interesPendienteAnterior = ultimoMov.interes_pendiente || 0
        const interesDiario = (capitalAnterior * tasaInteres) / 100 / 30
        const interesCausadoPorDias = interesDiario * diasProyectados
        const interesProyectado = redondear(interesCausadoPorDias + interesPendienteAnterior)
        const saldoProyectado = redondear(capitalAnterior + interesProyectado)
        
        movimientosCalculados.push({
          id: undefined,
          prestamo_id: prestamo.id!,
          fecha: getFechaLocalHoy(),
          tipo_movimiento: 'sin_pago',
          valor_pagado: 0,
          interes_causado: interesProyectado,
          interes_pagado: 0,
          interes_pendiente: interesProyectado,
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
        
        // Calcular saldo pendiente para el modal de pago
        try {
          const saldo = await calcularSaldoActual(prestamoId)
          setSaldoPendiente(saldo)
        } catch (error) {
          console.error('Error calculando saldo:', error)
          setSaldoPendiente(0)
        }
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
    setShowEditModal(true)
  }

  const handleGuardarEdicion = async () => {
    if (!movimientoEditando || !prestamo) return

    const nuevoValorPagado = redondear(parseFloat(editValorPagado) || 0)
    const nuevoInteresCausado = redondear(parseFloat(editInteresCausado) || 0)

    // Validar
    if (nuevoValorPagado < 0) {
      alert('El valor pagado no puede ser negativo.')
      return
    }

    if (nuevoInteresCausado < 0) {
      alert('El interés causado no puede ser negativo.')
      return
    }

    try {
      setSubmitting(true)
      
      // El sistema calculará automáticamente: interés pagado, abono a capital, interés pendiente
      // Usar la lógica única de distribución
      const interesPagado = Math.min(nuevoValorPagado, nuevoInteresCausado)
      const abonoCapital = Math.max(0, nuevoValorPagado - nuevoInteresCausado)
      const interesPendiente = nuevoInteresCausado - interesPagado
      
      // Obtener capital pendiente anterior
      const movIndex = movimientos.findIndex(m => m.id === movimientoEditando.id)
      const capitalAnterior = movIndex > 0 ? movimientos[movIndex - 1].capital_pendiente : prestamo.monto
      const capitalPendienteNuevo = Math.max(0, redondear(capitalAnterior - abonoCapital))
      const nuevoSaldo = redondear(capitalPendienteNuevo + interesPendiente)
      
      // DETERMINAR TIPO DE MOVIMIENTO AUTOMÁTICAMENTE (regla única en orden exacto)
      let tipoMov: 'pago_interes' | 'abono_capital' | 'pago_total' = 'pago_interes'
      
      // 1. PAGO TOTAL
      if (capitalPendienteNuevo === 0 && interesPendiente === 0) {
        tipoMov = 'pago_total'
      }
      // 2. PAGO INTERÉS + ABONO A CAPITAL (prioridad)
      else if (interesPagado > 0 && abonoCapital > 0) {
        tipoMov = 'abono_capital' // Se guarda como 'abono_capital' pero el display mostrará "PAGO INTERÉS + ABONO A CAPITAL"
      }
      // 3. PAGO INTERÉS (SE GENERÓ INTERÉS PENDIENTE)
      else if (interesPagado > 0 && abonoCapital === 0 && interesPendiente > 0) {
        tipoMov = 'pago_interes'
      }
      // 4. ABONO A CAPITAL
      else if (interesPagado === 0 && abonoCapital > 0) {
        tipoMov = 'abono_capital'
      }
      // Default
      else {
        tipoMov = 'pago_interes'
      }
      
      await actualizarMovimientoPrestamo(movimientoEditando.id!, {
        valor_pagado: nuevoValorPagado,
        interes_causado: nuevoInteresCausado,
        interes_pagado: interesPagado,
        interes_pendiente: interesPendiente,
        abono_capital: abonoCapital,
        capital_pendiente: capitalPendienteNuevo,
        saldo_pendiente: nuevoSaldo,
        tipo_movimiento: tipoMov
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

  const handleEliminar = async (movimiento: MovimientoCalculado) => {
    if (movimiento.tipo_movimiento === 'desembolso') {
      alert('El desembolso inicial no se puede eliminar.')
      return
    }
    
    if (!movimiento.id) {
      alert('No se puede eliminar este movimiento.')
      return
    }
    
    const confirmacion = window.confirm(
      `¿Estás seguro de eliminar este pago?\n\n` +
      `Fecha: ${dateFromInput(movimiento.fecha).toLocaleDateString('es-ES')}\n` +
      `Valor: $${movimiento.valor_pagado.toLocaleString()}\n\n` +
      `Se recalcularán automáticamente todas las filas siguientes.`
    )
    
    if (!confirmacion) return
    
    try {
      setEliminando(movimiento.id)
      await eliminarPagoPrestamo(movimiento.id)
      await loadData()
      alert('Pago eliminado exitosamente. Los movimientos siguientes han sido recalculados.')
    } catch (error) {
      console.error('Error eliminando pago:', error)
      alert('Error al eliminar el pago')
    } finally {
      setEliminando(null)
    }
  }

  const handleImprimir = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    window.print()
  }

  const handleAbrirModalPago = () => {
    setFechaPago(getFechaLocalHoy())
    setValorPagado('')
    setObservacion('')
    setShowPagoModal(true)
  }

  const handleRegistrarPago = async () => {
    if (!prestamo) return

    if (!valorPagado || parseFloat(valorPagado) <= 0) {
      alert('Por favor ingresa un valor válido')
      return
    }

    const monto = parseFloat(valorPagado)
    if (monto > saldoPendiente) {
      alert(`El pago supera la deuda actual. El saldo máximo es $${saldoPendiente.toLocaleString()}`)
      return
    }

    try {
      setRegistrandoPago(true)
      
      // La función registrarPagoPrestamo calcula automáticamente interés y abono a capital
      await registrarPagoPrestamo(
        prestamo.id!,
        fechaPago,
        monto
        // No pasamos tipoMovimiento, la función lo determina automáticamente
      )

      // Recargar datos para actualizar el extracto
      await loadData()
      
      // Cerrar modal y limpiar campos
      setShowPagoModal(false)
      setValorPagado('')
      setObservacion('')
      
      alert('Pago registrado exitosamente')
    } catch (error) {
      console.error('Error registrando pago:', error)
      alert('Error al registrar el pago. Verifica tu conexión a Supabase.')
    } finally {
      setRegistrandoPago(false)
    }
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

  // Calcular "Saldo a la Fecha" (capital pendiente + intereses causados hasta hoy)
  const calcularSaldoALaFecha = (): number => {
    if (movimientos.length === 0) return redondear(prestamo.monto)
    
    // Obtener el último movimiento real (no la proyección "sin_pago")
    // Buscar desde el final hacia atrás para encontrar el último movimiento con ID
    let ultimoMovimientoReal: MovimientoCalculado | null = null
    for (let i = movimientos.length - 1; i >= 0; i--) {
      const mov = movimientos[i]
      if (mov.tipo_movimiento !== 'sin_pago' && mov.id !== undefined) {
        ultimoMovimientoReal = mov
        break
      }
    }
    
    if (!ultimoMovimientoReal) {
      // Si no hay movimientos reales, usar el monto inicial
      return redondear(prestamo.monto)
    }
    
    const capitalPendienteActual = ultimoMovimientoReal.capital_pendiente || prestamo.monto
    const interesPendienteAnterior = ultimoMovimientoReal.interes_pendiente || 0
    const fechaUltimoMovimiento = dateFromInput(ultimoMovimientoReal.fecha)
    const fechaHoy = new Date()
    fechaHoy.setHours(0, 0, 0, 0) // Normalizar a medianoche para cálculo preciso
    
    const diasDesdeUltimoMovimiento = Math.max(0, Math.floor((fechaHoy.getTime() - fechaUltimoMovimiento.getTime()) / (1000 * 60 * 60 * 24)))
    
    // FÓRMULA ÚNICA: Interés_Causado = (Capital × Tasa/30 × Días) + Interés_Pendiente_Anterior
    const interesDiario = (capitalPendienteActual * tasaInteres) / 100 / 30
    const interesCausadoPorDias = interesDiario * diasDesdeUltimoMovimiento
    const interesCausadoHastaHoy = redondear(interesCausadoPorDias + interesPendienteAnterior)
    
    // Saldo a la fecha = Capital pendiente + Intereses causados no pagados
    return redondear(capitalPendienteActual + interesCausadoHastaHoy)
  }

  const saldoALaFecha = calcularSaldoALaFecha()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl sm:text-4xl">🐷</span>
            <h1 className="text-2xl sm:text-4xl font-bold text-white">MiNati</h1>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
            <Link
              href="/dashboard"
              className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors w-full sm:w-auto"
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </Link>
            <Link
              href="/prestamos/lista"
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition-colors w-full sm:w-auto"
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
              <p className="text-lg font-semibold text-white">{dateFromInput(prestamo.fecha_inicio).toLocaleDateString('es-ES')}</p>
            </div>
          </div>

          {/* Visor Saldo a la Fecha */}
          <div className="flex justify-end mb-6">
            <div className="p-6 bg-gradient-to-r from-blue-700 to-blue-600 rounded-lg shadow-lg border border-blue-500 min-w-[250px]">
              <p className="text-sm font-medium text-blue-200 mb-2">SALDO A LA FECHA</p>
              <p className="text-3xl font-bold text-white">
                ${saldoALaFecha.toLocaleString()}
              </p>
              <p className="text-xs text-blue-200 mt-2">
                Actualizado: {new Date().toLocaleDateString('es-ES')}
              </p>
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
            {prestamo && prestamo.estado === 'activo' && (
              <button
                onClick={handleAbrirModalPago}
                className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                <span>Registrar Pago</span>
              </button>
            )}
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
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase">INTERÉS PENDIENTE</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase">ABONO A CAPITAL</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase">CAPITAL PENDIENTE</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase">SALDO TOTAL PENDIENTE</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-300 uppercase">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {movimientos.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
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
                          {dateFromInput(mov.fecha).toLocaleDateString('es-ES')}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            mov.tipo_display === 'DESEMBOLSO' ? 'bg-blue-700 text-white' :
                            mov.tipo_display === 'PAGO INTERESES' ? 'bg-green-700 text-white' :
                            mov.tipo_display === 'PAGO INTERÉS + ABONO A CAPITAL' ? 'bg-indigo-700 text-white' :
                            mov.tipo_display === 'PAGO INTERÉS (SE GENERÓ INTERÉS PENDIENTE)' ? 'bg-orange-700 text-white' :
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
  {mov?.interes_causado && mov.interes_causado > 0 
    ? `$${mov.interes_causado.toLocaleString()}` 
    : '$ -'}
</td>
<td className="px-3 py-3 text-right text-orange-300 font-semibold">
  {mov?.interes_pendiente && mov.interes_pendiente > 0 
    ? `$${mov.interes_pendiente.toLocaleString()}` 
    : '$ -'}
</td>
                        <td className="px-3 py-3 text-right text-gray-300">
                          {(mov as any).abono_capital > 0 ? `$${(mov as any).abono_capital.toLocaleString()}` : '$ -'}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-gray-200">
                          ${mov.capital_pendiente.toLocaleString()}
                        </td>
                        <td className={`px-3 py-3 text-right font-bold ${esProyeccion ? 'text-blue-400' : 'text-gray-200'}`}>
                          ${mov.saldo_pendiente.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {mov.tipo_movimiento !== 'desembolso' && !esProyeccion && mov.id && (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEditar(mov)}
                                className="text-blue-400 hover:text-blue-300 transition-colors"
                                title="Editar movimiento"
                              >
                                <Edit2 className="w-4 h-4 inline" />
                              </button>
                              <button
                                onClick={() => handleEliminar(mov)}
                                disabled={eliminando === mov.id}
                                className="text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                title="Eliminar pago"
                              >
                                <Trash2 className="w-4 h-4 inline" />
                              </button>
                            </div>
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

                <div className="bg-blue-900 bg-opacity-50 border border-blue-700 p-3 rounded-lg">
                  <p className="text-sm text-blue-200 mb-2">
                    ℹ️ El sistema calculará automáticamente:
                  </p>
                  <ul className="text-xs text-blue-200 list-disc list-inside space-y-1">
                    <li>Interés pagado</li>
                    <li>Interés pendiente</li>
                    <li>Abono a capital</li>
                    <li>Capital pendiente</li>
                    <li>Saldo total pendiente</li>
                  </ul>
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

        {/* Modal de Registrar Pago */}
        {showPagoModal && prestamo && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Registrar Pago</h3>
                <button
                  onClick={() => setShowPagoModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4 p-3 bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">Préstamo</p>
                <p className="text-white font-semibold">{prestamo.nombre_prestamista}</p>
                <p className="text-xs text-gray-400 mt-1">Saldo pendiente: ${saldoPendiente.toLocaleString()}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Fecha de Pago *
                  </label>
                  <input
                    type="date"
                    value={fechaPago}
                    onChange={(e) => setFechaPago(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Valor Pagado *
                  </label>
                  <input
                    type="number"
                    value={valorPagado}
                    onChange={(e) => setValorPagado(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                    min="0"
                    step="1000"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    El sistema calculará automáticamente el interés causado y el abono a capital
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Observación (opcional)
                  </label>
                  <textarea
                    value={observacion}
                    onChange={(e) => setObservacion(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Notas adicionales sobre el pago..."
                  />
                </div>

                <div className="bg-blue-900 bg-opacity-50 border border-blue-700 p-3 rounded-lg">
                  <p className="text-sm text-blue-200">
                    ℹ️ El interés y abono a capital se calcularán automáticamente según los días transcurridos desde el último pago.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleRegistrarPago}
                    disabled={registrandoPago || !valorPagado || parseFloat(valorPagado) <= 0}
                    className="flex-1 px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {registrandoPago ? 'Registrando...' : 'Registrar'}
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowPagoModal(false)
                      setValorPagado('')
                      setObservacion('')
                    }}
                    disabled={registrandoPago}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
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
          
          /* OCULTAR SOLO INTERFAZ INNECESARIA */
          .no-print,
          button,
          nav,
          a:not([href="#"]),
          select,
          input {
            display: none !important;
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
          
          .bg-gray-600 {
            box-shadow: inset 0 0 0 1000px #4b5563 !important;
            background-color: #4b5563 !important;
            color: white !important;
          }
          
          /* TEXTOS VISIBLES - FORZAR COLORES */
          .text-white,
          .dark\\:text-white,
          .text-gray-100,
          .text-gray-200,
          .text-gray-300,
          .text-gray-400 {
            color: white !important;
          }
          
          /* Textos en fondos oscuros - blanco */
          .bg-gray-900 *,
          .bg-gray-800 *,
          .bg-gray-700 *,
          .bg-gray-600 *,
          .dark\\:bg-gray-900 *,
          .dark\\:bg-gray-800 * {
            color: white !important;
          }
          
          /* CUADRO SALDO A LA FECHA - Forzar gradiente azul */
          .bg-gradient-to-r.from-blue-700.to-blue-600,
          .bg-gradient-to-r.from-blue-700,
          .bg-gradient-to-r.from-blue-600,
          .from-blue-700.to-blue-600 {
            box-shadow: inset 0 0 0 1000px #1d4ed8 !important;
            background: linear-gradient(to right, #1d4ed8, #2563eb) !important;
            background-color: #1d4ed8 !important;
            border: 1px solid #1e40af !important;
          }
          
          /* Texto dentro del cuadro de saldo - mantener blanco y azul claro */
          .bg-gradient-to-r .text-white,
          .from-blue-700 .text-white,
          .to-blue-600 .text-white {
            color: white !important;
          }
          
          .bg-gradient-to-r .text-blue-200,
          .from-blue-700 .text-blue-200,
          .to-blue-600 .text-blue-200 {
            color: #bfdbfe !important;
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
          
          /* Texto en tablas - mantener colores originales */
          /* Los textos blancos se mantienen blancos, los grises se mantienen grises */
          
          /* FORZAR BADGES Y ESTADOS CON BOX-SHADOW - INYECCIÓN DIRECTA */
          /* Verde - Estado Activo */
          .bg-green-500,
          .bg-green-600,
          .bg-green-700 {
            box-shadow: inset 0 0 0 1000px #10b981 !important;
            background-color: #10b981 !important;
            color: white !important;
          }
          
          /* Amarillo - Pago Total */
          .bg-yellow-500,
          .bg-yellow-600,
          .bg-yellow-700,
          .bg-yellow-900 {
            box-shadow: inset 0 0 0 1000px #eab308 !important;
            background-color: #eab308 !important;
            color: white !important;
          }
          
          /* Rojo - Sin Pago */
          .bg-red-500,
          .bg-red-600,
          .bg-red-700 {
            box-shadow: inset 0 0 0 1000px #ef4444 !important;
            background-color: #ef4444 !important;
            color: white !important;
          }
          
          /* Azul - Desembolso, Saldo a la fecha */
          .bg-blue-500,
          .bg-blue-600,
          .bg-blue-700 {
            box-shadow: inset 0 0 0 1000px #1d4ed8 !important;
            background-color: #1d4ed8 !important;
            color: white !important;
          }
          
          /* Índigo - Pago Interés + Abono */
          .bg-indigo-700 {
            box-shadow: inset 0 0 0 1000px #4338ca !important;
            background-color: #4338ca !important;
            color: white !important;
          }
          
          /* Púrpura - Abono a Capital */
          .bg-purple-700 {
            box-shadow: inset 0 0 0 1000px #7e22ce !important;
            background-color: #7e22ce !important;
            color: white !important;
          }
          
          /* Naranja - Interés Pendiente */
          .bg-orange-700 {
            box-shadow: inset 0 0 0 1000px #c2410c !important;
            background-color: #c2410c !important;
            color: white !important;
          }
          
          /* Gris - Estado Pagado */
          .bg-gray-600 {
            box-shadow: inset 0 0 0 1000px #4b5563 !important;
            background-color: #4b5563 !important;
            color: white !important;
          }
          
          /* GRADIENTE SALDO A LA FECHA - Forzar azul */
          .bg-gradient-to-r.from-blue-700,
          .bg-gradient-to-r.from-blue-600,
          .from-blue-700,
          .from-blue-600,
          .to-blue-600 {
            box-shadow: inset 0 0 0 1000px #1d4ed8 !important;
            background: linear-gradient(to right, #1d4ed8, #2563eb) !important;
            background-color: #1d4ed8 !important;
          }
          
          /* Texto en badges - siempre blanco */
          .bg-green-600 .text-white,
          .bg-green-700 .text-white,
          .bg-yellow-700 .text-white,
          .bg-red-700 .text-white,
          .bg-blue-700 .text-white,
          .bg-indigo-700 .text-white,
          .bg-purple-700 .text-white,
          .bg-orange-700 .text-white,
          .bg-gray-600 .text-white,
          span.bg-green-600,
          span.bg-green-700,
          span.bg-yellow-700,
          span.bg-red-700,
          span.bg-blue-700,
          span.bg-indigo-700,
          span.bg-purple-700,
          span.bg-orange-700,
          span.bg-gray-600 {
            color: white !important;
          }
          
          /* Texto azul claro en cuadro de saldo */
          .text-blue-200 {
            color: #bfdbfe !important;
          }
          
          /* TABLAS - Mantener fondo oscuro pero con bordes visibles */
          table {
            background-color: transparent !important;
          }
          
          thead {
            background-color: transparent !important;
          }
          
          tbody tr {
            background-color: transparent !important;
          }
          
          tbody tr td {
            background-color: transparent !important;
            color: white !important;
          }
          
          /* Bordes visibles para tablas */
          table,
          th,
          td {
            border: 1px solid #4b5563 !important;
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
          
          /* Mantener todos los textos visibles */
          .text-gray-300,
          .text-gray-400 {
            color: #d1d5db !important;
          }
          
          /* Títulos y textos grandes - mantener blancos */
          .text-lg,
          .text-xl,
          .text-2xl,
          .text-3xl,
          .text-4xl,
          .font-semibold,
          .font-bold {
            color: white !important;
          }
        }
      `}</style>
    </div>
  )
}
