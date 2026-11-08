// ======================================================
// CÁLCULO DE MOVIMIENTOS FINANCIEROS PARA NATICRÉDITO
// Este módulo es exclusivo para el extracto público
// NO modifica la lógica financiera de lib/prestamos.ts
// ======================================================

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

// Helper para redondear valores
export function redondear(valor: number): number {
  return Math.round(valor)
}

// Interfaces (re-exportadas para consistencia)
export interface Prestamo {
  id?: number
  asociado_id?: number | null
  nombre_prestamista: string
  monto: number
  tasa_interes: number
  fecha_inicio: string
  estado: 'activo' | 'pagado'
  public_token?: string
  created_at?: string
  updated_at?: string
}

export interface PagoPrestamo {
  id?: number
  prestamo_id: number
  fecha: string
  tipo_movimiento: 'pago_interes' | 'abono_capital' | 'desembolso' | 'sin_pago' | 'pago_total'
  valor_pagado?: number
  interes_causado?: number
  interes_pagado?: number
  abono_capital?: number
  created_at?: string
  updated_at?: string
}

export interface MovimientoCalculado extends PagoPrestamo {
  capital_pendiente: number
  dias_causados: number
  tipo_display: string
  interes_pendiente: number
  interes_pagado: number
  abono_capital: number
  saldo_pendiente: number
}

export function calcularMovimientos(prestamo: Prestamo, movimientosBD: PagoPrestamo[]): MovimientoCalculado[] {
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

    // DETERMINAR TIPO DISPLAY según los valores calculados
    let tipoDisplay = 'DESEMBOLSO'

    if (esDesembolso) {
      tipoDisplay = 'DESEMBOLSO'
    } else if (mov.tipo_movimiento === 'sin_pago') {
      tipoDisplay = 'SIN PAGO'
    } else if (mov.tipo_movimiento === 'pago_total' || (capitalPendiente === 0 && interesPendiente === 0)) {
      tipoDisplay = 'PAGO TOTAL'
    } else if (interesPagado > 0 && abonoCapital > 0) {
      tipoDisplay = 'PAGO INTERÉS + ABONO A CAPITAL'
    } else if (interesPagado > 0 && abonoCapital === 0 && interesPendiente > 0) {
      tipoDisplay = 'PAGO INTERÉS (SE GENERÓ INTERÉS PENDIENTE)'
    } else if (interesPagado === 0 && abonoCapital > 0) {
      tipoDisplay = 'ABONO A CAPITAL'
    } else if (interesPagado > 0) {
      tipoDisplay = 'PAGO INTERESES'
    } else {
      tipoDisplay = 'PAGO INTERESES'
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
    fechaHoy.setHours(0, 0, 0, 0)
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
