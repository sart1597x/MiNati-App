import { supabase } from './supabase'
import { Socio } from './supabase'

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
  abono_capital?: number
  saldo_pendiente: number
  capital_pendiente?: number
  dias_causados?: number
  created_at?: string
  updated_at?: string
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
  
  // Crear el primer movimiento (desembolso)
  await crearMovimientoPrestamo({
    prestamo_id: prestamoId,
    fecha: prestamo.fecha_inicio,
    valor_pagado: 0,
    tipo_movimiento: 'desembolso',
    abono_capital: -prestamo.monto,
    interes_causado: 0,
    saldo_pendiente: prestamo.monto
  })
  
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
export async function registrarPagoPrestamo(
  prestamoId: number | string,
  fechaPago: string,
  valorPagado: number,
  tipoMovimiento?: 'pago_interes' | 'abono_capital'
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
  const saldoAnterior = movimientos.length > 0 
    ? (movimientos[movimientos.length - 1].saldo_pendiente || 0)
    : prestamo.monto
  
  // Calcular días causados desde el último movimiento
  let interesCausado = 0
  
  if (movimientos.length > 0) {
    const ultimoMovimiento = movimientos[movimientos.length - 1]
    const fechaUltimo = new Date(ultimoMovimiento.fecha)
    const fechaActual = new Date(fechaPago)
    const diasCausados = Math.floor((fechaActual.getTime() - fechaUltimo.getTime()) / (1000 * 60 * 60 * 24))
    
    // Calcular interés diario: (Saldo Anterior * Tasa / 100 / 30)
    const tasaInteres = (prestamo as any).tasa_interes || (prestamo as any).tasa || 0
    const interesDiario = (saldoAnterior * tasaInteres) / 100 / 30
    interesCausado = interesDiario * diasCausados
  }
  
  // Determinar tipo de movimiento
  let tipoMov: 'pago_interes' | 'abono_capital' = tipoMovimiento || 'pago_interes'
  let abonoCapital = 0
  
  if (tipoMov === 'abono_capital') {
    // Si es abono a capital, el valor pagado debe ser mayor al interés
    // El abono a capital es el excedente después de pagar intereses
    if (valorPagado > interesCausado) {
      abonoCapital = valorPagado - interesCausado
    } else {
      // Si el pago es menor al interés, convertir a pago de interés
      tipoMov = 'pago_interes'
      abonoCapital = 0
    }
  } else {
    // Pago de interés: solo se cubre el interés, no hay abono a capital
    abonoCapital = 0
  }
  
  const nuevoSaldo = saldoAnterior + interesCausado - valorPagado
  
  // Crear el movimiento
  const movimiento = await crearMovimientoPrestamo({
    prestamo_id: prestamoIdNum,
    fecha: fechaPago,
    valor_pagado: valorPagado,
    tipo_movimiento: tipoMov,
    interes_causado: interesCausado,
    abono_capital: abonoCapital,
    saldo_pendiente: nuevoSaldo
  })
  
  // Si el saldo llega a 0, marcar préstamo como pagado
  if (nuevoSaldo <= 0) {
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
      const fechaAnterior = new Date(movimientoAnterior.fecha)
      const fechaActual = new Date(movimiento.fecha)
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

