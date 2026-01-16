import { supabase } from './supabase'
import { Socio } from './supabase'
import { crearMovimientoCaja, obtenerUltimoSaldo } from './caja'

// ======================================================
// HELPERS: MANEJO DE FECHAS SIN DESFASE UTC
// ======================================================
/**
 * Convierte una fecha string "YYYY-MM-DD" a objeto Date en hora local
 * Evita desfase UTC usando 0:00:00 como hora base
 * @param fecha - String en formato "YYYY-MM-DD"
 * @returns Date normalizado a las 0:00:00 hora local
 */
function dateFromInput(fecha: string): Date {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD (hora local, sin UTC)
 * @returns String en formato "YYYY-MM-DD"
 */
export function getFechaLocalHoy(): string {
  const hoy = new Date()
  const year = hoy.getFullYear()
  const month = String(hoy.getMonth() + 1).padStart(2, '0')
  const day = String(hoy.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Normaliza una fecha string para guardar (sin transformación)
 * @param dateString - String en formato "YYYY-MM-DD"
 * @returns El mismo string sin transformación
 */
export function normalizeDateInput(dateString: string): string {
  return dateString // YYYY-MM-DD sin transformación
}

export interface Prestamo {
  id?: number
  asociado_id?: number | null
  nombre_prestamista: string
  monto: number
  tasa_interes: number
  fecha_inicio: string
  estado: 'activo' | 'pagado'
  created_at?: string
  updated_at?: string
}

export interface PagoPrestamo {
  id?: number
  prestamo_id: number
  fecha: string
  tipo_movimiento: 'pago_interes' | 'abono_capital' | 'desembolso' | 'sin_pago' | 'pago_total'
  valor_pagado: number
  interes_causado?: number
  interes_pagado?: number
  interes_pendiente?: number
  abono_capital?: number
  saldo_pendiente: number
  capital_pendiente?: number
  dias_causados?: number
  created_at?: string
  updated_at?: string
}

// Función de redondeo estándar (sin decimales)
// ≥ 5 → redondear hacia arriba, < 5 → mantener
export function redondear(valor: number): number {
  return Math.round(valor)
}

// Obtener todos los préstamos
export async function obtenerPrestamos(): Promise<Prestamo[]> {
  try {
    const { data, error } = await supabase
      .from('prestamos')
      .select('*')
      .order('fecha_inicio', { ascending: false })
    
    if (error) {
      // Si la tabla no existe, retornar array vacío
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Tabla prestamos no existe')
        return []
      }
      throw error
    }
    return data || []
  } catch (error: any) {
    console.error('Error obteniendo préstamos:', error)
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return []
    }
    throw error
  }
}

// Obtener préstamos activos
export async function obtenerPrestamosActivos(): Promise<Prestamo[]> {
  const { data, error } = await supabase
    .from('prestamos')
    .select('*')
    .eq('estado', 'activo')
    .order('fecha_inicio', { ascending: false })
  
  if (error) throw error
  return data || []
}

// Buscar socios por nombre o cédula
export async function buscarSocios(termino: string): Promise<Socio[]> {
  const { data, error } = await supabase
    .from('asociados')
    .select('*')
    .or(`nombre.ilike.%${termino}%,cedula.ilike.%${termino}%`)
    .limit(10)
  
  if (error) throw error
  return data || []
}

// Crear un nuevo préstamo
export async function crearPrestamo(prestamo: Omit<Prestamo, 'id' | 'created_at' | 'updated_at'>): Promise<Prestamo> {
  // Construir objeto limpio con solo las columnas que existen en Supabase
  // Columnas permitidas: asociado_id, nombre_prestamista, monto, tasa_interes, fecha_inicio, estado
  const prestamoData: any = {
    nombre_prestamista: prestamo.nombre_prestamista,
    monto: prestamo.monto,
    tasa_interes: prestamo.tasa_interes,
    fecha_inicio: prestamo.fecha_inicio,
    estado: prestamo.estado || 'activo'
  }
  
  // Solo agregar asociado_id si existe y como número
  if (prestamo.asociado_id !== null && prestamo.asociado_id !== undefined) {
    prestamoData.asociado_id = typeof prestamo.asociado_id === 'string' 
      ? parseInt(prestamo.asociado_id) 
      : prestamo.asociado_id
  }
  
  console.log('Enviando préstamo a Supabase:', prestamoData)
  
  const { data, error } = await supabase
    .from('prestamos')
    .insert([prestamoData])
    .select()
    .single()
  
  if (error) {
    console.error('Error creating prestamo:', error)
    console.error('Datos enviados:', prestamoData)
    throw error
  }
  
  // Convertir ID a número para el siguiente paso
  const prestamoId = typeof data.id === 'string' ? parseInt(data.id) : data.id
  
  // REGLA: Un préstamo NO es un gasto
  // NO se registra ningún movimiento en caja_central como EGRESO
  // El impacto en caja es solo lógico, calculado en los visores (capitalPrestado y disponible)
  
  // Crear movimiento inicial de DESEMBOLSO en pagos_prestamos
  // Este movimiento inicializa el extracto y permite calcular correctamente los saldos
  try {
    await crearMovimientoPrestamo({
      prestamo_id: prestamoId,
      fecha: prestamo.fecha_inicio,
      tipo_movimiento: 'desembolso',
      valor_pagado: 0,
      interes_causado: 0,
      interes_pagado: 0,
      interes_pendiente: 0,
      abono_capital: 0,
      saldo_pendiente: redondear(prestamo.monto),
      capital_pendiente: redondear(prestamo.monto),
      dias_causados: 0
    })
    
    console.log('✅ Movimiento inicial de desembolso creado:', {
      prestamo_id: prestamoId,
      monto: prestamo.monto,
      fecha: prestamo.fecha_inicio
    })
  } catch (error: any) {
    // Si falla la creación del movimiento inicial, loguear pero no fallar el préstamo
    console.error('⚠️ Error creando movimiento inicial de desembolso (préstamo creado igualmente):', error)
    // No lanzar el error para que el préstamo se cree aunque falle el movimiento inicial
  }
  
  return data
}

// Obtener movimientos de un préstamo
export async function obtenerMovimientosPrestamo(prestamoId: number | string): Promise<PagoPrestamo[]> {
  try {
    // Convertir a número si es necesario
    const prestamoIdNum = typeof prestamoId === 'string' ? parseInt(prestamoId) : prestamoId
    
    const { data, error } = await supabase
      .from('pagos_prestamos')
      .select('*')
      .eq('prestamo_id', prestamoIdNum)
      .order('fecha', { ascending: true })
    
    if (error) {
      // Si la tabla no existe, retornar array vacío
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Tabla pagos_prestamos no existe')
        return []
      }
      throw error
    }
    return data || []
  } catch (error: any) {
    console.error('Error obteniendo movimientos de préstamo:', error)
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return []
    }
    throw error
  }
}

// Crear un movimiento de préstamo
export async function crearMovimientoPrestamo(movimiento: Omit<PagoPrestamo, 'id' | 'created_at' | 'updated_at'>): Promise<PagoPrestamo> {
  const { data, error } = await supabase
    .from('pagos_prestamos')
    .insert([movimiento])
    .select()
    .single()
  
  if (error) throw error
  return data
}

// Calcular saldo actual de un préstamo
export async function calcularSaldoActual(prestamoId: number | string): Promise<number> {
  // Convertir a número si es necesario
  const prestamoIdNum = typeof prestamoId === 'string' ? parseInt(prestamoId) : prestamoId
  const movimientos = await obtenerMovimientosPrestamo(prestamoIdNum)
  
  if (movimientos.length === 0) return 0
  
  // El último movimiento tiene el saldo pendiente
  const ultimoMovimiento = movimientos[movimientos.length - 1]
  return ultimoMovimiento.saldo_pendiente || 0
}

// Registrar un pago de préstamo
// LÓGICA ÚNICA: El tipo de movimiento se deriva automáticamente del resultado del cálculo
export async function registrarPagoPrestamo(
  prestamoId: number | string,
  fechaPago: string,
  valorPagado: number,
  tipoMovimiento?: 'pago_interes' | 'abono_capital' // Ignorado - se deriva automáticamente
): Promise<PagoPrestamo> {
  // Convertir a número si es necesario
  const prestamoIdNum = typeof prestamoId === 'string' ? parseInt(prestamoId) : prestamoId
  
  // Obtener el préstamo
  const { data: prestamo, error: errorPrestamo } = await supabase
    .from('prestamos')
    .select('*')
    .eq('id', prestamoIdNum)
    .single()
  
  if (errorPrestamo) throw errorPrestamo
  
  // Obtener movimientos anteriores
  const movimientos = await obtenerMovimientosPrestamo(prestamoId)
  
  // Calcular capital pendiente anterior e interés pendiente anterior
  let capitalPendienteAnterior = prestamo.monto
  let interesPendienteAnterior = 0
  
  if (movimientos.length > 0) {
    const ultimoMovimiento = movimientos[movimientos.length - 1]
    capitalPendienteAnterior = ultimoMovimiento.capital_pendiente || prestamo.monto
    interesPendienteAnterior = ultimoMovimiento.interes_pendiente || 0
  }
  
  // Calcular días causados desde el último movimiento
  let diasCausados = 0
  if (movimientos.length > 0) {
    const ultimoMovimiento = movimientos[movimientos.length - 1]
    const fechaUltimo = dateFromInput(ultimoMovimiento.fecha)
    const fechaActual = dateFromInput(fechaPago)
    diasCausados = Math.max(0, Math.floor((fechaActual.getTime() - fechaUltimo.getTime()) / (1000 * 60 * 60 * 24)))
  }
  
  // FÓRMULA ÚNICA: Interés_Causado = (Capital_Pendiente × (Tasa_Mensual / 30) × Días) + Interés_Pendiente_Anterior
  const tasaInteres = (prestamo as any).tasa_interes || (prestamo as any).tasa || 0
  const interesDiario = (capitalPendienteAnterior * tasaInteres) / 100 / 30
  const interesCausadoPorDias = interesDiario * diasCausados
  const interesCausado = redondear(interesCausadoPorDias + interesPendienteAnterior)
  
  // DISTRIBUCIÓN ÚNICA DEL PAGO (sin excepciones)
  const interesPagado = Math.min(redondear(valorPagado), interesCausado)
  const abonoCapital = Math.max(0, redondear(valorPagado) - interesCausado)
  const interesPendiente = interesCausado - interesPagado
  
  // Calcular nuevo capital pendiente
  const capitalPendienteNuevo = Math.max(0, redondear(capitalPendienteAnterior - abonoCapital))
  
  // Calcular nuevo saldo total pendiente
  const nuevoSaldo = redondear(capitalPendienteNuevo + interesPendiente)
  
  // DETERMINAR TIPO DE MOVIMIENTO AUTOMÁTICAMENTE (derivado del resultado)
  // REGLA ÚNICA: Evaluar en orden exacto según los valores calculados
  let tipoMov: 'pago_interes' | 'abono_capital' | 'pago_total' = 'pago_interes'
  
  // 1. PAGO TOTAL: capital_pendiente_nuevo == 0 AND interes_pendiente == 0
  if (capitalPendienteNuevo === 0 && interesPendiente === 0) {
    tipoMov = 'pago_total'
  }
  // 2. PAGO INTERÉS + ABONO A CAPITAL: interes_pagado > 0 AND abono_capital > 0
  // (Prioridad sobre "Abono a Capital" solo)
  else if (interesPagado > 0 && abonoCapital > 0) {
    tipoMov = 'abono_capital' // Se guarda como 'abono_capital' pero el display mostrará "PAGO INTERÉS + ABONO A CAPITAL"
  }
  // 3. PAGO INTERÉS (SE GENERÓ INTERÉS PENDIENTE): interes_pagado > 0 AND abono_capital == 0 AND interes_pendiente > 0
  else if (interesPagado > 0 && abonoCapital === 0 && interesPendiente > 0) {
    tipoMov = 'pago_interes'
  }
  // 4. ABONO A CAPITAL: interes_pagado == 0 AND abono_capital > 0
  else if (interesPagado === 0 && abonoCapital > 0) {
    tipoMov = 'abono_capital'
  }
  // Default: pago_interes
  else {
    tipoMov = 'pago_interes'
  }
  
  // Crear el movimiento
  const movimiento = await crearMovimientoPrestamo({
    prestamo_id: prestamoIdNum,
    fecha: fechaPago,
    valor_pagado: redondear(valorPagado),
    tipo_movimiento: tipoMov,
    interes_causado: interesCausado,
    interes_pagado: interesPagado,
    interes_pendiente: interesPendiente,
    abono_capital: abonoCapital,
    saldo_pendiente: nuevoSaldo,
    capital_pendiente: capitalPendienteNuevo,
    dias_causados: diasCausados
  })
  
  // REGISTRAR MOVIMIENTO EN CAJA CENTRAL (solo si hay pago efectivo)
  if (interesPagado > 0 || abonoCapital > 0) {
    try {
      const montoTotalCaja = redondear(interesPagado + abonoCapital)
      const saldoAnterior = await obtenerUltimoSaldo()
      const nuevoSaldoCaja = redondear(saldoAnterior + montoTotalCaja)
      
      // Concepto: "Pago préstamo – {nombre_prestamista}"
      const concepto = `Pago préstamo – ${prestamo.nombre_prestamista}`
      
      await crearMovimientoCaja({
        tipo: 'INGRESO',
        concepto: concepto,
        monto: montoTotalCaja,
        saldo_anterior: saldoAnterior,
        nuevo_saldo: nuevoSaldoCaja,
        fecha: fechaPago
      })
      
      console.log('💰 Movimiento en Caja Central registrado:', {
        concepto,
        montoTotal: montoTotalCaja.toLocaleString(),
        interesPagado: interesPagado.toLocaleString(),
        abonoCapital: abonoCapital.toLocaleString(),
        saldoAnterior: saldoAnterior.toLocaleString(),
        nuevoSaldo: nuevoSaldoCaja.toLocaleString()
      })
    } catch (error: any) {
      // Si falla el registro en caja, loguear pero no fallar el pago
      console.error('⚠️ Error registrando movimiento en caja central (pago registrado igualmente):', error)
    }
  }
  
  // Si el capital y los intereses están pagados, marcar préstamo como pagado
  if (capitalPendienteNuevo === 0 && interesPendiente === 0) {
    await supabase
      .from('prestamos')
      .update({ estado: 'pagado' })
      .eq('id', prestamoIdNum)
  }
  
  return movimiento
}

// Recalcular movimientos después de una edición
export async function recalcularMovimientos(prestamoId: number | string, desdeMovimientoId: number | string): Promise<void> {
  // Convertir a números si es necesario
  const prestamoIdNum = typeof prestamoId === 'string' ? parseInt(prestamoId) : prestamoId
  const desdeMovimientoIdNum = typeof desdeMovimientoId === 'string' ? parseInt(desdeMovimientoId) : desdeMovimientoId
  
  // Obtener el préstamo
  const { data: prestamo, error: errorPrestamo } = await supabase
    .from('prestamos')
    .select('*')
    .eq('id', prestamoIdNum)
    .single()
  
  if (errorPrestamo) throw errorPrestamo
  
  // Obtener todos los movimientos ordenados
  const movimientos = await obtenerMovimientosPrestamo(prestamoIdNum)
  
  // Encontrar el índice del movimiento desde el cual recalcular
  const indiceInicio = movimientos.findIndex(m => {
    const mId = typeof m.id === 'string' ? parseInt(m.id) : m.id
    return mId === desdeMovimientoIdNum
  })
  if (indiceInicio === -1) return
  
  // Recalcular desde el movimiento editado hacia adelante
  for (let i = indiceInicio; i < movimientos.length; i++) {
    const movimiento = movimientos[i]
    let saldoAnterior = 0
    
    if (i === 0) {
      // Primer movimiento: saldo anterior es el monto del préstamo
      saldoAnterior = prestamo.monto
    } else {
      // Saldo anterior es el saldo del movimiento anterior
      saldoAnterior = movimientos[i - 1].saldo_pendiente || 0
    }
    
    // Calcular días causados e interés
    let interesCausado = 0
    
    if (i > 0) {
      const movimientoAnterior = movimientos[i - 1]
      const fechaAnterior = dateFromInput(movimientoAnterior.fecha)
      const fechaActual = dateFromInput(movimiento.fecha)
      const diasCausados = Math.max(0, Math.floor((fechaActual.getTime() - fechaAnterior.getTime()) / (1000 * 60 * 60 * 24)))
      
      // Calcular interés diario: (Saldo Anterior * Tasa / 100 / 30)
      const tasaInteres = (prestamo as any).tasa_interes || (prestamo as any).tasa || 0
      const interesDiario = (saldoAnterior * tasaInteres) / 100 / 30
      interesCausado = interesDiario * diasCausados
    }
    
    // Determinar tipo y calcular abono a capital
    let abonoCapital = 0
    if (movimiento.tipo_movimiento === 'abono_capital' && movimiento.valor_pagado > interesCausado) {
      abonoCapital = movimiento.valor_pagado - interesCausado
    }
    
    // Calcular nuevo saldo
    const nuevoSaldo = saldoAnterior + interesCausado - movimiento.valor_pagado
    
    // Actualizar el movimiento
    await supabase
      .from('pagos_prestamos')
      .update({
        interes_causado: interesCausado,
        abono_capital: abonoCapital,
        saldo_pendiente: nuevoSaldo,
        updated_at: new Date().toISOString()
      })
      .eq('id', movimiento.id)
    
    // Actualizar el movimiento en el array para el siguiente cálculo
    movimiento.interes_causado = interesCausado
    movimiento.abono_capital = abonoCapital
    movimiento.saldo_pendiente = nuevoSaldo
  }
  
  // Si el último saldo llega a 0, marcar préstamo como pagado
  if (movimientos.length > 0) {
    const ultimoMovimiento = movimientos[movimientos.length - 1]
    if (ultimoMovimiento.saldo_pendiente && ultimoMovimiento.saldo_pendiente <= 0) {
      await supabase
        .from('prestamos')
        .update({ estado: 'pagado' })
        .eq('id', prestamoIdNum)
    }
  }
}

// Actualizar un movimiento de préstamo
export async function actualizarMovimientoPrestamo(
  movimientoId: number | string,
  cambios: Partial<PagoPrestamo>
): Promise<PagoPrestamo> {
  // Convertir a número si es necesario
  const movimientoIdNum = typeof movimientoId === 'string' ? parseInt(movimientoId) : movimientoId
  
  // Obtener el movimiento actual para obtener el prestamo_id
  const { data: movimientoActual, error: errorActual } = await supabase
    .from('pagos_prestamos')
    .select('prestamo_id')
    .eq('id', movimientoIdNum)
    .single()
  
  if (errorActual) throw errorActual
  
  // Actualizar el movimiento
  const { data, error } = await supabase
    .from('pagos_prestamos')
    .update({ ...cambios, updated_at: new Date().toISOString() })
    .eq('id', movimientoIdNum)
    .select()
    .single()
  
  if (error) throw error
  
  // Recalcular movimientos siguientes
  if (movimientoActual.prestamo_id) {
    const prestamoIdNum = typeof movimientoActual.prestamo_id === 'string' ? parseInt(movimientoActual.prestamo_id) : movimientoActual.prestamo_id
    await recalcularMovimientos(prestamoIdNum, movimientoIdNum)
  }
  
  return data
}

// Eliminar un préstamo
export async function eliminarPrestamo(prestamoId: number | string): Promise<void> {
  // Convertir a número si es necesario
  const prestamoIdNum = typeof prestamoId === 'string' ? parseInt(prestamoId) : prestamoId
  
  // Primero eliminar movimientos
  await supabase
    .from('pagos_prestamos')
    .delete()
    .eq('prestamo_id', prestamoIdNum)
  
  // Luego eliminar el préstamo
  const { error } = await supabase
    .from('prestamos')
    .delete()
    .eq('id', prestamoIdNum)
  
  if (error) throw error
}

// ======================================================
// HISTORIAL DE INTERESES
// ======================================================

export interface PagoInteres {
  id?: number | string
  prestamo_id?: number | string
  fecha?: string
  interes_causado?: number
  nombre_prestamista?: string
  prestamo_referencia?: number | string
  valor_interes?: number
  fecha_pago?: string
}

// Obtener historial de pagos de intereses
// REGLA CRÍTICA: Solo mostrar intereses EFECTIVAMENTE PAGADOS (interes_pagado > 0)
// NO mostrar: interés pendiente, interés causado no cubierto, recálculos internos
export async function obtenerHistorialIntereses(): Promise<PagoInteres[]> {
  try {
    // Obtener todos los movimientos de préstamos que tienen interés PAGADO
    const { data: movimientosData, error: errorMovimientos } = await supabase
      .from('pagos_prestamos')
      .select('id, prestamo_id, fecha, interes_pagado, tipo_movimiento')
      .gt('interes_pagado', 0) // Solo movimientos con interés PAGADO > 0
      .neq('tipo_movimiento', 'desembolso') // Excluir desembolsos
      .order('fecha', { ascending: false })
    
    if (errorMovimientos) {
      if (errorMovimientos.code === '42P01' || errorMovimientos.message?.includes('does not exist')) {
        console.warn('Tabla pagos_prestamos no existe')
        return []
      }
      throw errorMovimientos
    }
    
    if (!movimientosData || movimientosData.length === 0) {
      return []
    }
    
    // Obtener información de los préstamos relacionados
    const prestamoIds = movimientosData.map(m => m.prestamo_id).filter(Boolean)
    if (prestamoIds.length === 0) {
      return []
    }
    
    const { data: prestamosData } = await supabase
      .from('prestamos')
      .select('id, nombre_prestamista')
      .in('id', prestamoIds)
    
    // Crear mapa de préstamos para búsqueda rápida
    const prestamosMap = new Map()
    prestamosData?.forEach(prestamo => {
      prestamosMap.set(prestamo.id, prestamo)
    })
    
    // Mapear movimientos con información del préstamo
    // IMPORTANTE: Usar interes_pagado (dinero real recaudado), NO interes_causado
    return movimientosData.map((mov: any) => {
      const prestamoInfo = prestamosMap.get(mov.prestamo_id)
      const interesPagadoValue = parseFloat(String(mov.interes_pagado || 0)) || 0
      const fechaValue = mov.fecha || new Date().toISOString().split('T')[0]
      
      return {
        id: mov.id || '',
        prestamo_id: mov.prestamo_id || '',
        fecha: fechaValue,
        interes_causado: interesPagadoValue, // Para compatibilidad con UI
        nombre_prestamista: prestamoInfo?.nombre_prestamista || 'Desconocido',
        prestamo_referencia: mov.prestamo_id || '',
        valor_interes: interesPagadoValue, // Interés PAGADO (dinero real)
        fecha_pago: fechaValue
      }
    })
  } catch (error: any) {
    console.error('Error obteniendo historial de intereses:', error)
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return []
    }
    throw error
  }
}

// Obtener total recaudado por intereses
// REGLA: Sumar solo intereses PAGADOS (dinero real recaudado)
export async function obtenerTotalRecaudadoIntereses(): Promise<number> {
  try {
    const historial = await obtenerHistorialIntereses()
    return historial.reduce((sum, pago) => {
      const interes = parseFloat(String(pago.valor_interes || 0)) || 0
      return sum + interes
    }, 0)
  } catch (error: any) {
    console.error('Error obteniendo total recaudado por intereses:', error)
    return 0
  }
}

// Eliminar un pago de préstamo y recalcular movimientos siguientes
export async function eliminarPagoPrestamo(movimientoId: number | string): Promise<void> {
  const movimientoIdNum = typeof movimientoId === 'string' ? parseInt(movimientoId) : movimientoId
  
  // Obtener el movimiento para saber el préstamo
  const { data: movimiento, error: errorMov } = await supabase
    .from('pagos_prestamos')
    .select('prestamo_id, fecha')
    .eq('id', movimientoIdNum)
    .single()
  
  if (errorMov) throw errorMov
  
  const prestamoId = movimiento.prestamo_id
  
  // Eliminar el movimiento
  const { error: errorDelete } = await supabase
    .from('pagos_prestamos')
    .delete()
    .eq('id', movimientoIdNum)
  
  if (errorDelete) throw errorDelete
  
  // Recalcular todos los movimientos siguientes desde el anterior al eliminado
  const movimientos = await obtenerMovimientosPrestamo(prestamoId)
  const { data: prestamo } = await supabase
    .from('prestamos')
    .select('*')
    .eq('id', prestamoId)
    .single()
  
  if (!prestamo) throw new Error('Préstamo no encontrado')
  
  // Recalcular desde el movimiento anterior al eliminado
  const fechaMovimientoEliminado = dateFromInput(movimiento.fecha)
  let indiceRecalculo = -1
  
  for (let i = 0; i < movimientos.length; i++) {
    const mov = movimientos[i]
    const fechaMov = dateFromInput(mov.fecha)
    if (fechaMov > fechaMovimientoEliminado) {
      indiceRecalculo = i
      break
    }
  }
  
  if (indiceRecalculo >= 0) {
    // Recalcular desde este índice hacia adelante
    let capitalPendiente = prestamo.monto
    let interesPendiente = 0
    
    // Calcular estado hasta el movimiento anterior al eliminado
    for (let i = 0; i < indiceRecalculo; i++) {
      const mov = movimientos[i]
      if (mov.tipo_movimiento === 'desembolso') continue
      
      const fechaAnterior = i > 0 ? dateFromInput(movimientos[i - 1].fecha) : dateFromInput(prestamo.fecha_inicio)
      const fechaActual = dateFromInput(mov.fecha)
      const diasCausados = Math.max(0, Math.floor((fechaActual.getTime() - fechaAnterior.getTime()) / (1000 * 60 * 60 * 24)))
      
      const tasaInteres = (prestamo as any).tasa_interes || 0
      const interesDiario = (capitalPendiente * tasaInteres) / 100 / 30
      const interesCausadoPorDias = interesDiario * diasCausados
      const interesCausado = redondear(interesCausadoPorDias + interesPendiente)
      
      const interesPagado = Math.min(redondear(mov.valor_pagado || 0), interesCausado)
      const abonoCapital = Math.max(0, redondear(mov.valor_pagado || 0) - interesCausado)
      
      interesPendiente = interesCausado - interesPagado
      capitalPendiente = Math.max(0, redondear(capitalPendiente - abonoCapital))
    }
    
    // Recalcular desde indiceRecalculo hacia adelante
    for (let i = indiceRecalculo; i < movimientos.length; i++) {
      const mov = movimientos[i]
      if (mov.tipo_movimiento === 'desembolso') continue
      
      const fechaAnterior = i > 0 ? dateFromInput(movimientos[i - 1].fecha) : dateFromInput(prestamo.fecha_inicio)
      const fechaActual = dateFromInput(mov.fecha)
      const diasCausados = Math.max(0, Math.floor((fechaActual.getTime() - fechaAnterior.getTime()) / (1000 * 60 * 60 * 24)))
      
      const tasaInteres = (prestamo as any).tasa_interes || 0
      const interesDiario = (capitalPendiente * tasaInteres) / 100 / 30
      const interesCausadoPorDias = interesDiario * diasCausados
      const interesCausado = redondear(interesCausadoPorDias + interesPendiente)
      
      const interesPagado = Math.min(redondear(mov.valor_pagado || 0), interesCausado)
      const abonoCapital = Math.max(0, redondear(mov.valor_pagado || 0) - interesCausado)
      const interesPendienteNuevo = interesCausado - interesPagado
      const capitalPendienteNuevo = Math.max(0, redondear(capitalPendiente - abonoCapital))
      const nuevoSaldo = redondear(capitalPendienteNuevo + interesPendienteNuevo)
      
      // DETERMINAR TIPO DE MOVIMIENTO AUTOMÁTICAMENTE (regla única en orden exacto)
      let tipoMov: 'pago_interes' | 'abono_capital' | 'pago_total' = 'pago_interes'
      
      // 1. PAGO TOTAL
      if (capitalPendienteNuevo === 0 && interesPendienteNuevo === 0) {
        tipoMov = 'pago_total'
      }
      // 2. PAGO INTERÉS + ABONO A CAPITAL (prioridad)
      else if (interesPagado > 0 && abonoCapital > 0) {
        tipoMov = 'abono_capital' // Se guarda como 'abono_capital' pero el display mostrará "PAGO INTERÉS + ABONO A CAPITAL"
      }
      // 3. PAGO INTERÉS (SE GENERÓ INTERÉS PENDIENTE)
      else if (interesPagado > 0 && abonoCapital === 0 && interesPendienteNuevo > 0) {
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
      
      // Actualizar el movimiento
      await supabase
        .from('pagos_prestamos')
        .update({
          interes_causado: interesCausado,
          interes_pagado: interesPagado,
          interes_pendiente: interesPendienteNuevo,
          abono_capital: abonoCapital,
          capital_pendiente: capitalPendienteNuevo,
          saldo_pendiente: nuevoSaldo,
          tipo_movimiento: tipoMov,
          dias_causados: diasCausados,
          updated_at: new Date().toISOString()
        })
        .eq('id', mov.id)
      
      interesPendiente = interesPendienteNuevo
      capitalPendiente = capitalPendienteNuevo
    }
    
    // Verificar si el préstamo debe marcarse como pagado
    const ultimoMov = movimientos[movimientos.length - 1]
    if (ultimoMov && ultimoMov.capital_pendiente === 0 && (ultimoMov.interes_pendiente || 0) === 0) {
      await supabase
        .from('prestamos')
        .update({ estado: 'pagado' })
        .eq('id', prestamoId)
    } else {
      await supabase
        .from('prestamos')
        .update({ estado: 'activo' })
        .eq('id', prestamoId)
    }
  }
}

export async function obtenerTotalCapitalPrestado(): Promise<number> {
  const { data, error } = await supabase
    .from('prestamos')
    .select('monto')

  if (error) {
    console.error('Error obteniendo total capital prestado:', error)
    throw error
  }

  const total = data?.reduce((acc, p) => {
    return acc + (Number(p.monto) || 0)
  }, 0) || 0

  return total
}
export async function obtenerTotalAbonosCapital(): Promise<number> {
  const { data, error } = await supabase
    .from('pagos_prestamos')
    .select('abono_capital')
    .eq('tipo_movimiento', 'abono_capital')

  if (error) {
    console.error('Error obteniendo total abonos a capital:', error)
    throw error
  }

  return data?.reduce((acc, p) => acc + (Number(p.abono_capital) || 0), 0) || 0
}
