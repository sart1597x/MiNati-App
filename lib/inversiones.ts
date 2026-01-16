import { supabase } from './supabase'
import { crearMovimientoCaja, obtenerUltimoSaldo } from './caja'

export interface Inversion {
  id?: number
  nombre: string
  valor_invertido: number
  fecha: string
  utilidad_reportada?: number | null
  created_at?: string
}

// Obtener todas las inversiones
export async function obtenerInversiones(): Promise<Inversion[]> {
  try {
    const { data, error } = await supabase
      .from('inversiones')
      .select('*')
      .order('fecha', { ascending: false })
    
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Tabla inversiones no existe')
        return []
      }
      throw error
    }
    return data || []
  } catch (error: any) {
    console.error('Error obteniendo inversiones:', error)
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return []
    }
    throw error
  }
}

// Obtener una inversión por ID
export async function obtenerInversionPorId(inversionId: number): Promise<Inversion | null> {
  const { data, error } = await supabase
    .from('inversiones')
    .select('*')
    .eq('id', inversionId)
    .single()
  
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  
  return data
}

// Crear una inversión
export async function crearInversion(inversion: Omit<Inversion, 'id' | 'created_at' | 'utilidad_reportada'>): Promise<Inversion> {
  // Preparar datos para insertar
  const datosInsertar: any = {
    nombre: inversion.nombre,
    valor_invertido: inversion.valor_invertido,
    fecha: inversion.fecha,
    utilidad_reportada: null
  }
  
  const { data, error } = await supabase
    .from('inversiones')
    .insert([datosInsertar])
    .select()
    .single()
  
  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      throw new Error('La tabla inversiones no existe en la base de datos. Por favor, ejecuta el script SQL: supabase-inversiones-tablas.sql')
    }
    throw new Error(`Error al crear inversión: ${error.message}`)
  }

  // Registrar EGRESO en caja_central (NO es un gasto, es una inversión)
  if (inversion.valor_invertido > 0 && data) {
    try {
      const saldoAnterior = await obtenerUltimoSaldo()
      const nuevoSaldo = saldoAnterior - inversion.valor_invertido

      console.log('💰 [INVERSIÓN] Creando inversión:', {
        nombre: inversion.nombre,
        valor: inversion.valor_invertido,
        fecha: inversion.fecha,
        saldoAnterior,
        nuevoSaldo
      })

      await crearMovimientoCaja({
        tipo: 'EGRESO',
        concepto: `Inversión – ${inversion.nombre}`,
        monto: inversion.valor_invertido,
        fecha: inversion.fecha,
        saldo_anterior: saldoAnterior,
        nuevo_saldo: nuevoSaldo
      })

      console.log('✅ [INVERSIÓN] Inversión registrada en caja correctamente')
    } catch (errorCaja: any) {
      console.error('❌ [INVERSIÓN] Error registrando inversión en caja:', errorCaja)
      // No lanzar error para no bloquear la creación de la inversión
    }
  }
  
  return data
}

// Reportar utilidad de una inversión
export async function reportarUtilidadInversion(
  inversionId: number,
  utilidad: number
): Promise<Inversion> {
  // Obtener la inversión
  const inversion = await obtenerInversionPorId(inversionId)
  if (!inversion) {
    throw new Error('Inversión no encontrada')
  }

  // Actualizar utilidad en la inversión y poner valor_invertido a 0 (cierre contable)
  const { data, error } = await supabase
    .from('inversiones')
    .update({ 
      utilidad_reportada: utilidad,
      valor_invertido: 0  // REGLA: Al registrar utilidad, el valor invertido pasa a 0 (cierre contable)
    })
    .eq('id', inversionId)
    .select()
    .single()
  
  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      throw new Error('La tabla inversiones no existe en la base de datos. Por favor, ejecuta el script SQL: supabase-inversiones-tablas.sql')
    }
    throw new Error(`Error al reportar utilidad: ${error.message}`)
  }

  // Registrar movimiento en caja_central (utilidad de inversión, NO es gasto)
  // Si la utilidad es positiva: INGRESO, si es negativa: EGRESO
  const tipoMovimiento = utilidad >= 0 ? 'INGRESO' : 'EGRESO'
  const montoAbsoluto = Math.abs(utilidad)
  
  if (montoAbsoluto > 0) {
    try {
      const saldoAnterior = await obtenerUltimoSaldo()
      const nuevoSaldo = utilidad >= 0 
        ? saldoAnterior + montoAbsoluto 
        : saldoAnterior - montoAbsoluto

      console.log('💰 [UTILIDAD INVERSIÓN] Reportando utilidad:', {
        inversion: inversion.nombre,
        utilidad,
        tipo: tipoMovimiento,
        monto: montoAbsoluto,
        saldoAnterior,
        nuevoSaldo
      })

      await crearMovimientoCaja({
        tipo: tipoMovimiento,
        concepto: `Utilidad Inversión – ${inversion.nombre}`,
        monto: montoAbsoluto,
        fecha: new Date().toISOString().split('T')[0],
        saldo_anterior: saldoAnterior,
        nuevo_saldo: nuevoSaldo
      })

      console.log('✅ [UTILIDAD INVERSIÓN] Utilidad registrada en caja correctamente')
    } catch (errorCaja: any) {
      console.error('❌ [UTILIDAD INVERSIÓN] Error registrando utilidad en caja:', errorCaja)
      // No lanzar error para no bloquear el reporte de utilidad
    }
  }

  return data
}

// Actualizar una inversión
export async function actualizarInversion(
  inversionId: number,
  cambios: Partial<Omit<Inversion, 'id' | 'created_at' | 'utilidad_reportada'>>
): Promise<Inversion> {
  // Mapear valor a valor_invertido si viene en cambios
  const datosActualizar: any = { ...cambios }
  if ('valor' in datosActualizar) {
    datosActualizar.valor_invertido = datosActualizar.valor
    delete datosActualizar.valor
  }
  
  const { data, error } = await supabase
    .from('inversiones')
    .update(datosActualizar)
    .eq('id', inversionId)
    .select()
    .single()
  
  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      throw new Error('La tabla inversiones no existe en la base de datos. Por favor, ejecuta el script SQL: supabase-inversiones-tablas.sql')
    }
    throw new Error(`Error al actualizar inversión: ${error.message}`)
  }
  return data
}

// Eliminar una inversión
export async function eliminarInversion(inversionId: number): Promise<void> {
  // Obtener la inversión antes de eliminar para revertir en caja si es necesario
  const inversion = await obtenerInversionPorId(inversionId)
  
  // Eliminar la inversión
  const { error } = await supabase
    .from('inversiones')
    .delete()
    .eq('id', inversionId)
  
  if (error) throw error

  // Si había una inversión registrada, revertir el egreso en caja
  if (inversion && inversion.valor_invertido > 0) {
    try {
      const saldoAnterior = await obtenerUltimoSaldo()
      const nuevoSaldo = saldoAnterior + inversion.valor_invertido

      await crearMovimientoCaja({
        tipo: 'INGRESO',
        concepto: `REVERSO - Eliminación Inversión – ${inversion.nombre}`,
        monto: inversion.valor_invertido,
        fecha: new Date().toISOString().split('T')[0],
        saldo_anterior: saldoAnterior,
        nuevo_saldo: nuevoSaldo
      })
    } catch (errorCaja: any) {
      console.error('Error revirtiendo inversión en caja:', errorCaja)
    }
  }

  // Si había utilidad reportada, revertirla también
  if (inversion && inversion.utilidad_reportada !== null && inversion.utilidad_reportada !== undefined) {
    try {
      const saldoAnterior = await obtenerUltimoSaldo()
      const utilidad = inversion.utilidad_reportada
      const tipoMovimiento = utilidad >= 0 ? 'EGRESO' : 'INGRESO'
      const montoAbsoluto = Math.abs(utilidad)
      const nuevoSaldo = utilidad >= 0 
        ? saldoAnterior - montoAbsoluto 
        : saldoAnterior + montoAbsoluto

      await crearMovimientoCaja({
        tipo: tipoMovimiento,
        concepto: `REVERSO - Eliminación Utilidad Inversión – ${inversion.nombre}`,
        monto: montoAbsoluto,
        fecha: new Date().toISOString().split('T')[0],
        saldo_anterior: saldoAnterior,
        nuevo_saldo: nuevoSaldo
      })
    } catch (errorCaja: any) {
      console.error('Error revirtiendo utilidad en caja:', errorCaja)
    }
  }
}

// Obtener total de inversiones
export async function obtenerTotalInversiones(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('inversiones')
      .select('valor_invertido')
    
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return 0
      }
      throw error
    }
    
    return (data || []).reduce((sum, inv) => {
      const valor = parseFloat(String(inv?.valor_invertido || 0)) || 0
      return sum + (isNaN(valor) ? 0 : valor)
    }, 0)
  } catch (error: any) {
    console.error('Error obteniendo total inversiones:', error)
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return 0
    }
    throw error
  }
}

// Obtener total de utilidades de inversiones
export async function obtenerTotalUtilidadInversiones(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('inversiones')
      .select('utilidad_reportada')
    
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return 0
      }
      throw error
    }
    
    return (data || []).reduce((sum, inv) => {
      const utilidad = parseFloat(String(inv?.utilidad_reportada || 0)) || 0
      return sum + (isNaN(utilidad) ? 0 : utilidad)
    }, 0)
  } catch (error: any) {
    console.error('Error obteniendo total utilidad inversiones:', error)
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return 0
    }
    throw error
  }
}

