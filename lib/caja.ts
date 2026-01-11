import { supabase } from './supabase'

export interface MovimientoCaja {
  id?: number | string  // Puede ser UUID (string) o número
  tipo: string  // 'INGRESO' o 'EGRESO'
  concepto: string
  monto: number
  saldo_anterior: number
  nuevo_saldo: number
  fecha: string  // Formato YYYY-MM-DD
  referencia_id?: string  // UUID de referencia (inscripción, etc.) - opcional
  created_at?: string
}

// Obtener todos los movimientos de caja
// IMPORTANTE: SELECT solo pide estas columnas exactas: id, tipo, concepto, monto, fecha, saldo_anterior, nuevo_saldo
export async function obtenerMovimientosCaja(): Promise<MovimientoCaja[]> {
  try {
    // Usar SOLO las columnas requeridas: id, tipo, concepto, monto, fecha, saldo_anterior, nuevo_saldo
    const { data, error } = await supabase
      .from('caja_central')
      .select('id, tipo, concepto, monto, fecha, saldo_anterior, nuevo_saldo')
      .order('fecha', { ascending: false })
    
    if (error) {
      // Si la tabla no existe, retornar array vacío (evitar crash)
      if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation') || error.message?.includes('table')) {
        console.warn('Tabla caja_central no existe, retornando array vacío')
        return []
      }
      // Si hay error con columna fecha, intentar ordenar por created_at (fallback)
      if (error.code === '42703' || error.message?.includes('fecha') || error.message?.includes('column')) {
        try {
          const { data: dataRetry, error: errorRetry } = await supabase
            .from('caja_central')
            .select('id, tipo, concepto, monto, fecha, saldo_anterior, nuevo_saldo')
            .order('created_at', { ascending: false })
          
          if (errorRetry) {
            if (errorRetry.code === '42P01' || errorRetry.message?.includes('does not exist')) {
              return []
            }
            // Si falla el retry, retornar vacío en lugar de lanzar error
            console.warn('Error en retry obtenerMovimientosCaja, retornando array vacío:', errorRetry.message)
            return []
          }
          // Si no hay datos, retornar array vacío (evitar null/undefined)
          return Array.isArray(dataRetry) ? dataRetry : []
        } catch (retryError: any) {
          console.warn('Excepción en retry obtenerMovimientosCaja, retornando array vacío:', retryError?.message)
          return []
        }
      }
      // Para cualquier otro error, retornar array vacío en lugar de lanzar (evitar crash)
      console.warn('Error obteniendo movimientos de caja, retornando array vacío:', error.message)
      return []
    }
    
    // Si la tabla está vacía o data es null/undefined, retornar array vacío (evitar crash por saldo nulo)
    if (!data || !Array.isArray(data) || data.length === 0) {
      return []
    }
    
    // Asegurar que todos los valores numéricos estén correctamente parseados
    return data.map((mov: any) => ({
      ...mov,
      monto: parseFloat(String(mov.monto || 0)) || 0,
      saldo_anterior: parseFloat(String(mov.saldo_anterior || 0)) || 0,
      nuevo_saldo: parseFloat(String(mov.nuevo_saldo || 0)) || 0
    }))
  } catch (error: any) {
    // Cualquier excepción debe retornar array vacío (evitar crash)
    console.warn('Excepción obteniendo movimientos de caja, retornando array vacío:', error?.message)
    return []
  }
}

// Obtener el último saldo de caja
// IMPORTANTE: Si la tabla está vacía, retornar 0 (evitar crash por saldo nulo)
export async function obtenerUltimoSaldo(): Promise<number> {
  try {
    // Usar SOLO la columna nuevo_saldo que existe
    const { data, error } = await supabase
      .from('caja_central')
      .select('nuevo_saldo')
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    if (error) {
      // Si el error es por columna fecha inexistente, intentar ordenar por created_at
      if (error.code === '42703' || error.message?.includes('fecha') || error.message?.includes('column')) {
        try {
          const { data: dataRetry, error: errorRetry } = await supabase
            .from('caja_central')
            .select('nuevo_saldo')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          
          if (errorRetry) {
            // Si no hay registros (PGRST116) o tabla no existe, retornar 0
            if (errorRetry.code === 'PGRST116' || errorRetry.code === '42P01' || errorRetry.code === '42703') {
              return 0
            }
            // Para otros errores, también retornar 0 en lugar de lanzar (evitar crash)
            console.warn('Error en retry obtenerUltimoSaldo, retornando 0:', errorRetry.message)
            return 0
          }
          // Si no hay datos, retornar 0
          if (!dataRetry || dataRetry.nuevo_saldo === null || dataRetry.nuevo_saldo === undefined) {
            return 0
          }
          return parseFloat(String(dataRetry.nuevo_saldo || 0)) || 0
        } catch (retryError: any) {
          console.warn('Excepción en retry obtenerUltimoSaldo, retornando 0:', retryError?.message)
          return 0
        }
      }
      
      // Si no hay registros (PGRST116) o la tabla no existe, retornar 0 (evitar crash)
      if (error.code === 'PGRST116' || error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation')) {
        return 0
      }
      // Para cualquier otro error, retornar 0 en lugar de lanzar (evitar crash)
      console.warn('Error obteniendo último saldo, retornando 0:', error.message)
      return 0
    }
    
    // Si no hay datos o el saldo es null/undefined, retornar 0 (evitar crash por saldo nulo)
    if (!data || data.nuevo_saldo === null || data.nuevo_saldo === undefined) {
      return 0
    }
    
    const saldo = parseFloat(String(data.nuevo_saldo || 0)) || 0
    return isNaN(saldo) ? 0 : saldo
  } catch (error: any) {
    // Cualquier excepción debe retornar 0 (evitar crash)
    console.warn('Excepción obteniendo último saldo, retornando 0:', error?.message)
    return 0
  }
}

// Obtener saldo total
// REGLA OBLIGATORIA: La única fuente de verdad es el último nuevo_saldo de caja_central
// NO recalcular sumando/restando movimientos - usar ÚNICAMENTE el último nuevo_saldo registrado
// Si la tabla está vacía, retornar 0 (evitar crash)
export async function obtenerSaldoTotal(): Promise<number> {
  try {
    // REGLA: Obtener ÚNICAMENTE el nuevo_saldo del último registro
    // NO calcular sumando ingresos - restando egresos
    // La tabla caja_central (caja_movimientos) es la única fuente de verdad
    const ultimoSaldo = await obtenerUltimoSaldo()
    
    // Retornar el último nuevo_saldo (puede ser 0 si no hay registros)
    return ultimoSaldo
  } catch (error: any) {
    // Cualquier error debe retornar 0 (evitar crash)
    console.warn('Error calculando saldo total, retornando 0:', error?.message)
    return 0
  }
}

// ======================================================
// FUNCIÓN CENTRALIZADA: CALCULAR ESTADOS DE CAJA
// ======================================================
// REGLA OBLIGATORIA: Todo se calcula ÚNICAMENTE desde caja_central
// No usar acumulados guardados ni cálculos manuales
export interface EstadosCaja {
  disponible: number        // SUM(INGRESOS) - SUM(EGRESOS)
  gastosOperativos: number  // SUM(EGRESOS) donde concepto NO empiece por "REVERSO"
  totalIngresos: number     // SUM(INGRESOS)
  totalEgresos: number      // SUM(EGRESOS)
  recaudoTotal: number      // SUM(INGRESOS de "Pago Cuota%") - SUM(EGRESOS de "REVERSO - Eliminación Cuota%")
}

/**
 * Calcula todos los estados de caja desde caja_central
 * ÚNICA FUNCIÓN PERMITIDA para calcular valores contables
 * 
 * REGLA: Recaudo Total = SUM(INGRESOS de "Pago Cuota%") - SUM(EGRESOS de "REVERSO - Eliminación Cuota%")
 * 
 * @returns EstadosCaja con disponible, gastosOperativos, totalIngresos, totalEgresos, recaudoTotal
 */
export async function calcularEstadosCaja(): Promise<EstadosCaja> {
  try {
    // Obtener todos los movimientos de caja_central
    const movimientos = await obtenerMovimientosCaja()
    
    // Si no hay movimientos, retornar ceros
    if (!movimientos || movimientos.length === 0) {
      return {
        disponible: 0,
        gastosOperativos: 0,
        totalIngresos: 0,
        totalEgresos: 0,
        recaudoTotal: 0
      }
    }
    
    // REGLA: Disponible = SUM(INGRESOS) - SUM(EGRESOS)
    let totalIngresos = 0
    let totalEgresos = 0
    let gastosOperativos = 0
    let ingresosCuotas = 0
    let egresosReversosCuotas = 0
    
    for (const mov of movimientos) {
      const monto = parseFloat(String(mov.monto || 0)) || 0
      const concepto = String(mov.concepto || '').trim()
      const tipo = String(mov.tipo || '').toUpperCase()
      
      if (tipo === 'INGRESO') {
        totalIngresos += monto
        
        // REGLA: Recaudo Total incluye solo ingresos de "Pago Cuota%"
        const conceptoUpper = concepto.toUpperCase()

if (
  conceptoUpper.includes('PAGO CUOTA') ||
  conceptoUpper.includes('MORA') ||
  conceptoUpper.includes('INSCRIP')
) {
  ingresosCuotas += monto
}

      } 
      else if (tipo === 'EGRESO') {
        totalEgresos += monto
        
        // REGLA: Gastos operativos excluyen REVERSOS
        // Los movimientos con concepto que empiece por "REVERSO" NO son gastos operativos
        if (!concepto.toUpperCase().startsWith('REVERSO')) {
          gastosOperativos += monto
        }
        
        // REGLA: Recaudo Total resta egresos de "REVERSO - Eliminación Cuota%"
        if (
          concepto.toUpperCase().includes('REVERSO') &&
          (
            concepto.toUpperCase().includes('CUOTA') ||
            concepto.toUpperCase().includes('MORA') ||
            concepto.toUpperCase().includes('INSCRIP')
          )
        ) {
          egresosReversosCuotas += monto
        }
        
      }
    }
    
    // Calcular disponible
    const disponible = totalIngresos - totalEgresos
    
    // REGLA: Recaudo Total = SUM(INGRESOS de "Pago Cuota%") - SUM(EGRESOS de "REVERSO - Eliminación Cuota%")
    const recaudoTotal = ingresosCuotas - egresosReversosCuotas
    
    return {
      disponible: isNaN(disponible) ? 0 : disponible,
      gastosOperativos: isNaN(gastosOperativos) ? 0 : gastosOperativos,
      totalIngresos: isNaN(totalIngresos) ? 0 : totalIngresos,
      totalEgresos: isNaN(totalEgresos) ? 0 : totalEgresos,
      recaudoTotal: isNaN(recaudoTotal) ? 0 : recaudoTotal
    }
  } catch (error: any) {
    console.warn('Error calculando estados de caja, retornando ceros:', error?.message)
    return {
      disponible: 0,
      gastosOperativos: 0,
      totalIngresos: 0,
      totalEgresos: 0,
      recaudoTotal: 0
    }
  }
}

// Crear un movimiento de caja
export async function crearMovimientoCaja(movimiento: Omit<MovimientoCaja, 'id' | 'created_at'>): Promise<MovimientoCaja> {
  // Asegurar formato de fecha YYYY-MM-DD
  let fechaFormateada = movimiento.fecha
  if (fechaFormateada) {
    // Si viene como Date o timestamp, convertir a YYYY-MM-DD
    if (fechaFormateada.includes('T')) {
      fechaFormateada = fechaFormateada.split('T')[0]
    }
    // Validar formato
    const fechaRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!fechaRegex.test(fechaFormateada)) {
      // Intentar parsear y reformatear
      const fecha = new Date(fechaFormateada)
      if (!isNaN(fecha.getTime())) {
        const year = fecha.getFullYear()
        const month = String(fecha.getMonth() + 1).padStart(2, '0')
        const day = String(fecha.getDate()).padStart(2, '0')
        fechaFormateada = `${year}-${month}-${day}`
      } else {
        // Si no se puede parsear, usar fecha actual
        const hoy = new Date()
        const year = hoy.getFullYear()
        const month = String(hoy.getMonth() + 1).padStart(2, '0')
        const day = String(hoy.getDate()).padStart(2, '0')
        fechaFormateada = `${year}-${month}-${day}`
      }
    }
  } else {
    // Si no hay fecha, usar fecha actual
    const hoy = new Date()
    const year = hoy.getFullYear()
    const month = String(hoy.getMonth() + 1).padStart(2, '0')
    const day = String(hoy.getDate()).padStart(2, '0')
    fechaFormateada = `${year}-${month}-${day}`
  }
  
  // Insertar solo las columnas que existen
  const datosInsertar: any = {
    tipo: movimiento.tipo,
    concepto: movimiento.concepto,
    monto: movimiento.monto,
    saldo_anterior: movimiento.saldo_anterior,
    nuevo_saldo: movimiento.nuevo_saldo,
    fecha: fechaFormateada
  }
  
  // Agregar referencia_id si existe (debe ser UUID puro, no string con prefijo)
  if (movimiento.referencia_id) {
    datosInsertar.referencia_id = movimiento.referencia_id
  }
  
  const { data, error } = await supabase
    .from('caja_central')
    .insert([datosInsertar])
    .select('id, tipo, concepto, monto, saldo_anterior, nuevo_saldo, fecha, created_at')
    .single()
  
  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      throw new Error('La tabla caja_central no existe. Por favor créala en Supabase.')
    }
    throw error
  }
  
  return data
}

// Actualizar un movimiento de caja
export async function actualizarMovimientoCaja(
  movimientoId: number | string,
  cambios: Partial<Omit<MovimientoCaja, 'id' | 'created_at'>>
): Promise<MovimientoCaja> {
  // Mantener el ID como viene (puede ser UUID string o número)
  // NO convertir a número porque la tabla puede usar UUID
  const idValue = movimientoId
  
  // Si se actualiza el monto o tipo, recalcular saldos de todos los movimientos posteriores
  // Por simplicidad, vamos a actualizar solo los campos permitidos sin recalcular saldos automáticamente
  const datosActualizar: any = {}
  
  if (cambios.tipo !== undefined) datosActualizar.tipo = cambios.tipo
  if (cambios.concepto !== undefined) datosActualizar.concepto = cambios.concepto
  if (cambios.monto !== undefined) datosActualizar.monto = cambios.monto
  if (cambios.saldo_anterior !== undefined) datosActualizar.saldo_anterior = cambios.saldo_anterior
  if (cambios.nuevo_saldo !== undefined) datosActualizar.nuevo_saldo = cambios.nuevo_saldo
  if (cambios.fecha !== undefined) {
    // Formatear fecha
    let fechaFormateada = cambios.fecha
    if (fechaFormateada.includes('T')) {
      fechaFormateada = fechaFormateada.split('T')[0]
    }
    const fechaRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!fechaRegex.test(fechaFormateada)) {
      const fecha = new Date(fechaFormateada)
      if (!isNaN(fecha.getTime())) {
        const year = fecha.getFullYear()
        const month = String(fecha.getMonth() + 1).padStart(2, '0')
        const day = String(fecha.getDate()).padStart(2, '0')
        fechaFormateada = `${year}-${month}-${day}`
      }
    }
    datosActualizar.fecha = fechaFormateada
  }
  
  const { data, error } = await supabase
    .from('caja_central')
    .update(datosActualizar)
    .eq('id', idValue)
    .select('id, tipo, concepto, monto, saldo_anterior, nuevo_saldo, fecha, created_at')
    .single()
  
  if (error) {
    throw error
  }
  
  return data
}

// Eliminar un movimiento de caja
export async function eliminarMovimientoCaja(movimientoId: number | string): Promise<void> {
  // Mantener el ID como viene (puede ser UUID string o número)
  // NO convertir a número porque la tabla puede usar UUID
  const idValue = movimientoId
  
  const { error } = await supabase
    .from('caja_central')
    .delete()
    .eq('id', idValue)
  
  if (error) throw error
}

// Obtener solo los egresos (gastos)
// IMPORTANTE: SELECT solo pide estas columnas exactas: id, tipo, concepto, monto, fecha, saldo_anterior, nuevo_saldo
export async function obtenerGastosCaja(): Promise<MovimientoCaja[]> {
  try {
    const { data, error } = await supabase
      .from('caja_central')
      .select('id, tipo, concepto, monto, fecha, saldo_anterior, nuevo_saldo')
      .eq('tipo', 'EGRESO')
      .order('fecha', { ascending: false })
    
    if (error) {
      // Si la tabla no existe o está vacía, retornar array vacío (evitar crash)
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return []
      }
      // Para otros errores, también retornar vacío en lugar de lanzar
      console.warn('Error obteniendo gastos de caja, retornando array vacío:', error.message)
      return []
    }
    
    // Si no hay datos, retornar array vacío
    if (!data || !Array.isArray(data) || data.length === 0) {
      return []
    }
    
    // Asegurar que todos los valores numéricos estén correctamente parseados
    return data.map((mov: any) => ({
      ...mov,
      monto: parseFloat(String(mov.monto || 0)) || 0,
      saldo_anterior: parseFloat(String(mov.saldo_anterior || 0)) || 0,
      nuevo_saldo: parseFloat(String(mov.nuevo_saldo || 0)) || 0
    }))
  } catch (error: any) {
    // Cualquier excepción debe retornar array vacío (evitar crash)
    console.warn('Excepción obteniendo gastos de caja, retornando array vacío:', error?.message)
    return []
  }
}

