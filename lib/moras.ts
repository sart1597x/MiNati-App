// Versión actualizada: Corrección de nombres de columnas para historial_moras
// Columnas correctas: fecha_pago, valor_pagado, nombre_asociado
// Última actualización: 2024-01-XX - Forzar refresco de caché
import { supabase } from './supabase'
import { Socio, PagoCuota } from './supabase'
import { generarFechasVencimiento, calcularEstadoCuota } from './pagos'
import { obtenerUltimoSaldo, crearMovimientoCaja } from './caja'

export interface Mora {
  id: number | string // Puede ser UUID (string) o número según la BD
  cedula: string
  nombre: string
  fecha_pago?: string
  numero_cuota: number
  dias_mora: number
  valor_mora: number
  total_sancion: number
  valor_pagado: number
  resta: number
  fecha_vencimiento: string
}

export interface PagoMora {
  id?: number | string // Puede ser UUID (string) o número
  mora_id?: string // UUID de la mora
  fecha?: string // Fecha del pago (columna real: fecha)
  valor?: number // Valor del pago (columna real: valor)
  tipo_pago?: string // Tipo de pago: 'abono' o 'pago_total'
  // Campos adicionales para compatibilidad con el componente
  asociado_id?: number
  nombre_asociado?: string
  fecha_pago?: string // Alias de fecha para compatibilidad
  valor_pagado?: number // Alias de valor para compatibilidad
  cuota_referencia?: number
}

const VALOR_MORA_DIARIA = 3000
const MAX_DIAS_MORA = 15
const MAX_TOTAL_SANCION = 45000 // 15 días * $3,000

// Obtener todas las moras activas desde la tabla moras
export async function obtenerMorasActivas(): Promise<Mora[]> {
  // Obtener todas las moras de la tabla con resta > 0
  const { data: morasData, error } = await supabase
    .from('moras')
    .select('*')
    .gt('resta', 0)
    .order('cuota', { ascending: true })
  
  if (error) throw error
  
  if (!morasData || morasData.length === 0) {
    return []
  }
  
  // Obtener información de asociados para completar datos
  const { data: socios } = await supabase
    .from('asociados')
    .select('*')
  
  // Mapear a la estructura esperada
  const moras: Mora[] = morasData.map((mora: any) => {
    // IMPORTANTE: moras.id es UUID (string), NO convertir a número
    // asociado_id puede ser UUID o INTEGER según la BD
    const asociadoId = mora.asociado_id // Mantener como viene (UUID o INTEGER)
    const moraId = mora.id // Mantener como UUID (string), NO convertir a número
    
    // Buscar el socio por asociado_id (puede ser UUID o INTEGER)
    const socio = socios?.find(s => {
      // Comparar directamente sin conversión forzada
      return String(s.id) === String(asociadoId) || s.id === asociadoId
    })
    
    return {
      id: moraId, // UUID (string) - NO convertir a número
      cedula: socio?.cedula || '',
      nombre: socio?.nombre || 'Desconocido',
      fecha_pago: mora.fecha_pago,
      numero_cuota: mora.cuota,
      dias_mora: mora.dias_mora,
      valor_mora: parseFloat(mora.valor_mora) || VALOR_MORA_DIARIA,
      total_sancion: parseFloat(mora.total_sancion) || 0,
      valor_pagado: parseFloat(mora.valor_pagado) || 0,
      resta: parseFloat(mora.resta) || 0,
      fecha_vencimiento: mora.fecha_pago || new Date().toISOString().split('T')[0]
    }
  })
  
  return moras
}

// Registrar un pago de mora
// REGLA ESTRICTA: Usar cedula (String) como relación principal, NO usar socio_id
// Parámetros: mora_id (UUID o número), cedula (String), valor (Number), fechaPago (String)
export async function registrarPagoMora(
  moraId: number | string,
  cedula: string,
  valorRecibido: number,
  fechaPago: string
): Promise<PagoMora> {
  console.log('🚀 [PASO 1] Iniciando registro de pago de mora:', { moraId, cedula, valorRecibido, fechaPago })
  
  try {
    // PASO 1: Validar parámetros
    if (!cedula || cedula.trim() === '') {
      throw new Error('La cédula es requerida para procesar el pago')
    }
    
    if (!moraId) {
      throw new Error('El ID de mora es requerido')
    }
    
    const montoRecibido = typeof valorRecibido === 'number' ? valorRecibido : parseFloat(String(valorRecibido)) || 0
    if (isNaN(montoRecibido) || montoRecibido <= 0) {
      throw new Error(`El valor recibido debe ser un número mayor a 0. Valor recibido: ${valorRecibido}`)
    }
    
    console.log('✅ [PASO 1.1] Parámetros validados:', { moraId, cedula, montoRecibido, fechaPago })
    
    // PASO 2: Obtener la mora actual usando el ID (puede ser UUID o número)
    console.log('🔍 [PASO 1.2] Obteniendo mora de la BD por ID...')
    let moraActual: any = null
    
    // Intentar primero como UUID (string)
    const { data: dataUuid, error: errorUuid } = await supabase
      .from('moras')
      .select('*')
      .eq('id', String(moraId))
      .maybeSingle()
    
    if (errorUuid || !dataUuid) {
      // Si falla como string, intentar como número
      const moraIdNum = typeof moraId === 'string' ? parseInt(moraId) : moraId
      if (!isNaN(moraIdNum)) {
        const { data: dataNum, error: errorNum } = await supabase
          .from('moras')
          .select('*')
          .eq('id', moraIdNum)
          .maybeSingle()
        
        if (errorNum || !dataNum) {
          console.error('❌ [PASO 1.2] ERROR obteniendo mora:', {
            errorUuid: errorUuid,
            errorNum: errorNum
          })
          throw new Error(`Error al obtener la mora: ${errorNum?.message || errorUuid?.message || 'Mora no encontrada'}`)
        }
        moraActual = dataNum
      } else {
        throw new Error(`Error al obtener la mora: ${errorUuid?.message || 'Mora no encontrada'}`)
      }
    } else {
      moraActual = dataUuid
    }
    
    if (!moraActual) {
      throw new Error(`Mora con ID ${moraId} no encontrada en la base de datos`)
    }
    
    console.log('✅ [PASO 1.2] Mora obtenida:', {
      id: moraActual.id,
      cuota: moraActual.cuota,
      total_sancion: moraActual.total_sancion,
      valor_pagado: moraActual.valor_pagado,
      resta: moraActual.resta
    })
  
    // PASO 3: Obtener información del asociado por CEDULA (NO usar asociado_id)
    console.log('🔍 [PASO 1.3] Obteniendo información del asociado por CEDULA...')
    let nombreAsociado = 'Desconocido'
    
    try {
      const { data: socio, error: errorSocio } = await supabase
        .from('asociados')
        .select('nombre')
        .eq('cedula', cedula) // Buscar por CEDULA (String), NO por id
        .maybeSingle()
      
      if (errorSocio) {
        console.warn('⚠️ [PASO 1.3] Error obteniendo asociado por cédula (continuando):', errorSocio.message)
      } else if (socio) {
        nombreAsociado = socio.nombre
        console.log('✅ [PASO 1.3] Asociado obtenido por cédula:', nombreAsociado)
      } else {
        console.warn('⚠️ [PASO 1.3] No se encontró asociado con cédula:', cedula)
      }
    } catch (errorSocio: any) {
      console.warn('⚠️ [PASO 1.3] Excepción obteniendo asociado (continuando):', errorSocio?.message)
    }
    
    const cuotaReferencia = moraActual.cuota || 0
    
    // PASO 4: Calcular nuevos valores
    console.log('🔍 [PASO 1.4] Calculando nuevos valores...')
    const valorPagadoAnterior = parseFloat(String(moraActual.valor_pagado || 0)) || 0
    const totalSancion = parseFloat(String(moraActual.total_sancion || 0)) || 0
    
    const nuevoValorPagado = valorPagadoAnterior + montoRecibido // Number
    const nuevaResta = Math.max(0, totalSancion - nuevoValorPagado) // Number
    const estaCompletamentePagada = nuevaResta <= 0 // REGLA: Si resta <= 0, marcar como pagado: true
    
    console.log('✅ [PASO 1.4] Valores calculados:', {
      valorPagadoAnterior,
      montoRecibido,
      nuevoValorPagado,
      totalSancion,
      nuevaResta,
      estaCompletamentePagada
    })
  
    // PASO 5: Registrar en historial_moras ANTES de actualizar moras
    // REGLA: historial_moras debe actualizarse primero como fuente de verdad del pago
    // IMPORTANTE: historial_moras tiene: id (UUID), mora_id (UUID), fecha (DATE), valor (NUMERIC), tipo_pago (TEXT)
    console.log('🔍 [PASO 1.5] Registrando en historial_moras...')
    let registroActualizado: any = null
    
    try {
      const moraIdReal = moraActual.id // UUID o INTEGER según la BD
      const tipoPago = nuevaResta <= 0 ? 'pago_total' : 'abono'
      
      // Formatear fecha en formato YYYY-MM-DD
      let fechaFormateada = fechaPago
      if (fechaFormateada.includes('T')) {
        fechaFormateada = fechaFormateada.split('T')[0]
      }
      const fechaRegex = /^\d{4}-\d{2}-\d{2}$/
      if (!fechaRegex.test(fechaFormateada)) {
        const fechaDate = new Date(fechaPago)
        if (!isNaN(fechaDate.getTime())) {
          const año = fechaDate.getFullYear()
          const mes = String(fechaDate.getMonth() + 1).padStart(2, '0')
          const dia = String(fechaDate.getDate()).padStart(2, '0')
          fechaFormateada = `${año}-${mes}-${dia}`
        }
      }
      
      const pagoHistorialData: any = {
        mora_id: moraIdReal,
        fecha: fechaFormateada,
        valor: montoRecibido,
        tipo_pago: tipoPago
      }
      
      console.log('📝 [PASO 1.5] Datos para historial_moras:', pagoHistorialData)
      
      // REGLA: Usar columnas correctas en el SELECT: id, mora_id, fecha, valor, tipo_pago
      const { data: pagoHistorial, error: errorHistorial } = await supabase
        .from('historial_moras')
        .insert([pagoHistorialData])
        .select('id, mora_id, fecha, valor, tipo_pago')
        .maybeSingle()
      
      if (errorHistorial) {
        console.error('❌ [PASO 1.5] Error insertando en historial_moras:', errorHistorial)
        throw new Error(`Error al registrar el pago en historial_moras: ${errorHistorial.message || 'Error desconocido'}`)
      }
      
      if (!pagoHistorial) {
        throw new Error('No se pudo crear el registro en historial_moras')
      }
      
      registroActualizado = pagoHistorial
      console.log('✅ [PASO 1.5] Registro en historial_moras creado exitosamente')
    } catch (errorHistorialGeneral: any) {
      console.error('❌ [PASO 1.5] ERROR CRÍTICO en historial_moras:', errorHistorialGeneral)
      // REGLA: Si falla historial_moras, NO continuar - lanzar error
      throw new Error(`Error al registrar el pago en historial_moras: ${errorHistorialGeneral?.message || 'Error desconocido'}`)
    }
  
    // PASO 6: Actualizar tabla moras con valor_pagado y fecha_pago
    // REGLA CRÍTICA: Actualizar moras DESPUÉS de historial_moras
    // Si falla la actualización, NO mostrar éxito - ya se registró en historial_moras
    console.log('🔍 [PASO 1.6] Actualizando tabla moras (valor_pagado, fecha_pago)...')
    
    const moraIdParaUpdate = moraActual.id
    
    // Formatear fecha para moras
    let fechaFormateadaMora = fechaPago
    if (fechaFormateadaMora.includes('T')) {
      fechaFormateadaMora = fechaFormateadaMora.split('T')[0]
    }
    const fechaRegexMora = /^\d{4}-\d{2}-\d{2}$/
    if (!fechaRegexMora.test(fechaFormateadaMora)) {
      const fechaDate = new Date(fechaPago)
      if (!isNaN(fechaDate.getTime())) {
        const año = fechaDate.getFullYear()
        const mes = String(fechaDate.getMonth() + 1).padStart(2, '0')
        const dia = String(fechaDate.getDate()).padStart(2, '0')
        fechaFormateadaMora = `${año}-${mes}-${dia}`
      }
    }
    
    if (estaCompletamentePagada) {
      // REGLA: Si la mora está completamente pagada (resta <= 0), actualizar estado = 'pagada' y luego eliminar
      console.log('✅ [PASO 1.6] Mora completamente pagada. Actualizando estado y eliminando de la tabla...')
      
      // Primero intentar actualizar con estado = 'pagada' si la columna existe
      const datosUpdatePagada: any = {
        valor_pagado: nuevoValorPagado,
        resta: 0,
        fecha_pago: fechaFormateadaMora,
        estado: 'pagada' // REGLA: Actualizar estado = 'pagada' cuando resta = 0
      }
      
      const { error: errorUpdateEstado } = await supabase
        .from('moras')
        .update(datosUpdatePagada)
        .eq('id', moraIdParaUpdate)
      
      // Si la columna estado no existe, intentar sin ella
      if (errorUpdateEstado && (errorUpdateEstado.code === '42703' || errorUpdateEstado.message?.includes('column'))) {
        console.log('⚠️ [PASO 1.6] Columna estado no existe, actualizando sin estado...')
        const { error: errorUpdateSinEstado } = await supabase
          .from('moras')
          .update({
            valor_pagado: nuevoValorPagado,
            resta: 0,
            fecha_pago: fechaFormateadaMora
          })
          .eq('id', moraIdParaUpdate)
        
        if (errorUpdateSinEstado) {
          throw new Error(`Error actualizando mora pagada: ${errorUpdateSinEstado.message}`)
        }
      } else if (errorUpdateEstado) {
        throw new Error(`Error actualizando mora pagada: ${errorUpdateEstado.message}`)
      }
      
      // Luego eliminar la mora para que desaparezca de la lista
      const { error: errorDeleteMora } = await supabase
        .from('moras')
        .delete()
        .eq('id', moraIdParaUpdate)
      
      if (errorDeleteMora) {
        console.warn('⚠️ [PASO 1.6] No se pudo eliminar mora pagada (ya está actualizada con resta = 0):', errorDeleteMora.message)
        // No es crítico si no se puede eliminar - la mora ya tiene resta = 0 y no aparecerá en la lista
      } else {
        console.log('✅ [PASO 1.6] Mora completamente pagada actualizada y eliminada exitosamente')
      }
    } else {
      // Si aún queda saldo pendiente, actualizar los valores (valor_pagado, fecha_pago, resta)
      console.log('📝 [PASO 1.6] Actualizando mora con nuevo saldo pendiente...')
      
      const datosUpdate: any = {
        valor_pagado: nuevoValorPagado, // Number - ACTUALIZAR
        fecha_pago: fechaFormateadaMora, // String YYYY-MM-DD - ACTUALIZAR
        resta: nuevaResta // Number - ACTUALIZAR
      }
      
      console.log('📝 [PASO 1.6] Datos para actualizar mora:', datosUpdate)
      
      const { error: errorUpdateMora } = await supabase
        .from('moras')
        .update(datosUpdate)
        .eq('id', moraIdParaUpdate)
      
      if (errorUpdateMora) {
        console.error('❌ [PASO 1.6] ERROR actualizando mora:', {
          error: errorUpdateMora,
          code: errorUpdateMora.code,
          message: errorUpdateMora.message
        })
        
        // REGLA: Si falla la actualización de moras, lanzar error - NO mostrar éxito
        throw new Error(`Error actualizando mora: ${errorUpdateMora.message} (Código: ${errorUpdateMora.code || 'N/A'})`)
      } else {
        console.log('✅ [PASO 1.6] Mora actualizada correctamente. Resta pendiente:', nuevaResta)
      }
    }
  
    // PASO 7: Registrar el ingreso en caja_central
    // REGLA ESTRICTA: Hacer SELECT a caja_central para obtener el último nuevo_saldo ANTES de insertar
    // NO usar 0 por defecto si ya hay registros
    // REGLA: Manejo de Errores - Si caja falla, NO mostrar éxito - lanzar error
    console.log('🔍 [PASO 1.7] Registrando ingreso en caja_central...')
    
    try {
      if (montoRecibido <= 0) {
        console.warn('⚠️ [PASO 1.7] Monto recibido es 0 o negativo, omitiendo registro en caja')
      } else {
        // REGLA: Obtener el último nuevo_saldo de caja_central ANTES de insertar
        // IMPORTANTE: NO usar 0 por defecto - hacer SELECT real a la BD
        console.log('🔍 [PASO 1.7.1] Obteniendo último nuevo_saldo de caja_central (SELECT real)...')
        const saldoAnterior = await obtenerUltimoSaldo()
        console.log('✅ [PASO 1.7.1] Saldo anterior obtenido de BD (SELECT):', saldoAnterior)
        
        // Calcular nuevo saldo (INGRESO = suma)
        const nuevoSaldo = Number(saldoAnterior) + Number(montoRecibido)
        console.log('✅ [PASO 1.7.2] Nuevo saldo calculado:', nuevoSaldo)
        
        // Formatear fecha
        let fechaFormateadaParaCaja = fechaPago
        if (fechaFormateadaParaCaja.includes('T')) {
          fechaFormateadaParaCaja = fechaFormateadaParaCaja.split('T')[0]
        }
        const fechaRegexCaja = /^\d{4}-\d{2}-\d{2}$/
        if (!fechaRegexCaja.test(fechaFormateadaParaCaja)) {
          const fechaDate = new Date(fechaPago)
          if (!isNaN(fechaDate.getTime())) {
            const año = fechaDate.getFullYear()
            const mes = String(fechaDate.getMonth() + 1).padStart(2, '0')
            const dia = String(fechaDate.getDate()).padStart(2, '0')
            fechaFormateadaParaCaja = `${año}-${mes}-${dia}`
          }
        }
        
        // Preparar datos para insertar en caja_central
        const datosCaja = {
          tipo: 'INGRESO',
          concepto: `Pago de Mora - ${nombreAsociado} - Cuota ${cuotaReferencia}`,
          monto: Number(montoRecibido),
          saldo_anterior: Number(saldoAnterior), // OBLIGATORIO - obtenido de BD con SELECT
          nuevo_saldo: Number(nuevoSaldo), // OBLIGATORIO - calculado
          fecha: fechaFormateadaParaCaja
        }
        
        console.log('📝 [PASO 1.7.3] Creando movimiento en caja_central:', datosCaja)
        
        await crearMovimientoCaja(datosCaja)
        
        console.log('✅ [PASO 1.7] Ingreso de mora registrado en caja_central exitosamente')
      }
    } catch (errorCaja: any) {
      console.error('❌ [PASO 1.7] ERROR CRÍTICO registrando ingreso en caja_central:', {
        error: errorCaja,
        message: errorCaja?.message,
        code: errorCaja?.code,
        details: errorCaja?.details,
        hint: errorCaja?.hint
      })
      
      // REGLA: Si falla la caja, NO mostrar éxito. Revertir cambios en moras/historial si es posible
      // Por ahora, lanzar error para que el frontend NO muestre "pago exitoso"
      throw new Error(`Error al registrar el pago en la caja central: ${errorCaja?.message || 'Error desconocido'}. El pago NO se completó correctamente. Por favor, intenta nuevamente.`)
    }
    
    // PASO 8: Retornar resultado
    console.log('✅ [PASO 1.8] Pago de mora completado exitosamente')
    const idRegistro = registroActualizado?.id 
      ? (typeof registroActualizado.id === 'string' ? parseInt(registroActualizado.id) : registroActualizado.id)
      : 0
    
    return {
      id: idRegistro || 0,
      asociado_id: 0, // No usado, pero mantenido para compatibilidad
      nombre_asociado: nombreAsociado || 'Desconocido',
      fecha_pago: fechaPago,
      valor_pagado: Number(montoRecibido),
      cuota_referencia: cuotaReferencia || 0
    }
    
  } catch (error: any) {
    console.error('❌ ERROR CRÍTICO EN PAGO MORA:', {
      error: error,
      message: error?.message || 'Error desconocido',
      stack: error?.stack,
      code: error?.code,
      details: error?.details,
      hint: error?.hint
    })
    throw error
  }
}

// Obtener historial de pagos de moras
// CORRECCIÓN: Usar columnas correctas de historial_moras: id, mora_id, fecha, valor, tipo_pago
// Obtener información del asociado y cuota a través de mora_id -> moras -> asociados
export async function obtenerHistorialMoras(): Promise<PagoMora[]> {
  try {
    // PASO 1: Obtener datos de historial_moras con columnas correctas
    const { data: historialData, error: errorHistorial } = await supabase
      .from('historial_moras')
      .select('id, mora_id, fecha, valor, tipo_pago')
      .order('fecha', { ascending: false })
    
    if (errorHistorial) {
      if (errorHistorial.code === '42P01' || errorHistorial.code === '42703') {
        console.warn('Tabla historial_moras no existe o no es accesible:', errorHistorial.message)
        return []
      }
      console.error('Error obteniendo historial_moras:', errorHistorial.message)
      return []
    }
    
    if (!historialData || historialData.length === 0) {
      return []
    }
    
    // PASO 2: Obtener todas las moras relacionadas para obtener información del asociado y cuota
    const moraIds = historialData.map(h => h.mora_id).filter(Boolean)
    if (moraIds.length === 0) {
      // Si no hay mora_ids, retornar datos básicos
      return historialData.map((item: any) => {
        const fechaValue = item.fecha || new Date().toISOString().split('T')[0] // REGLA: usar fecha actual si es nulo
        const valorValue = parseFloat(String(item.valor || 0)) || 0 // REGLA: usar 0 si es nulo
        
        return {
          id: item.id || '',
          mora_id: item.mora_id || '',
          fecha: fechaValue,
          valor: valorValue,
          tipo_pago: item.tipo_pago || 'abono',
          // Campos adicionales para compatibilidad con PagoMora
          asociado_id: 0,
          nombre_asociado: 'Desconocido',
          fecha_pago: fechaValue,
          valor_pagado: valorValue,
          cuota_referencia: 0
        }
      })
    }
    
    const { data: morasData } = await supabase
      .from('moras')
      .select('id, asociado_id, cuota')
      .in('id', moraIds)
    
    // PASO 3: Obtener información de asociados
    const asociadoIds = morasData?.map(m => m.asociado_id).filter(Boolean) || []
    const { data: asociadosData } = await supabase
      .from('asociados')
      .select('id, nombre, cedula')
      .in('id', asociadoIds)
    
    // PASO 4: Crear mapas para búsqueda rápida
    const morasMap = new Map()
    morasData?.forEach(mora => {
      morasMap.set(mora.id, mora)
    })
    
    const asociadosMap = new Map()
    asociadosData?.forEach(asociado => {
      asociadosMap.set(asociado.id, asociado)
    })
    
    // PASO 5: Mapear historial con información completa y manejar valores nulos
    return historialData.map((item: any) => {
      // REGLA: Manejar valores nulos - usar 0 para valor, fecha actual para fecha
      const fechaValue = item.fecha || new Date().toISOString().split('T')[0]
      const valorValue = parseFloat(String(item.valor || 0)) || 0
      const moraInfo = morasMap.get(item.mora_id)
      const asociadoId = moraInfo?.asociado_id
      const asociadoInfo = asociadoId ? asociadosMap.get(asociadoId) : null
      
      return {
        id: item.id || '',
        mora_id: item.mora_id || '',
        fecha: fechaValue,
        valor: valorValue,
        tipo_pago: item.tipo_pago || 'abono',
        // Campos adicionales para compatibilidad con PagoMora
        asociado_id: asociadoId || 0,
        nombre_asociado: asociadoInfo?.nombre || 'Desconocido',
        fecha_pago: fechaValue, // Usar fecha (no fecha_pago)
        valor_pagado: valorValue, // Usar valor (no valor_pagado)
        cuota_referencia: moraInfo?.cuota || 0
      }
    })
  } catch (err: any) {
    console.error('Excepción obteniendo historial_moras:', err?.message)
    return []
  }
}

// Obtener total recaudado por moras
// CORRECCIÓN: Usar columna correcta "valor" (no valor_pagado) y manejar valores nulos
export async function obtenerTotalRecaudadoMoras(): Promise<number> {
  try {
    // Usar nombre correcto de columna: valor (no valor_pagado)
    const { data, error } = await supabase
      .from('historial_moras')
      .select('valor') // CORRECCIÓN: usar "valor", no "valor_pagado"
    
    if (error) {
      // Si la tabla o columna no existe, retornar 0
      if (error.code === '42P01' || error.code === '42703' || error.message?.includes('does not exist')) {
        console.warn('Tabla historial_moras o columna valor no existe:', error.message)
        return 0
      }
      // No lanzar error, solo retornar 0 para no bloquear el flujo
      console.warn('Error obteniendo total recaudado moras (retornando 0):', error?.message)
      return 0
    }
    
    // REGLA: Manejar valores nulos - usar 0 si es nulo
    return (data || []).reduce((sum, pago) => {
      const valor = parseFloat(String(pago?.valor || 0)) || 0
      return sum + (isNaN(valor) ? 0 : valor)
    }, 0)
  } catch (error: any) {
    console.error('Error obteniendo total recaudado moras:', error)
    if (error?.code === '42P01' || error?.code === '42703' || error?.message?.includes('does not exist')) {
      return 0
    }
    return 0 // Retornar 0 en lugar de lanzar error
  }
}

// Eliminar un registro del historial de moras
// IMPORTANTE: Esto solo elimina el registro del historial, NO afecta el pago de la cuota
// CORRECCIÓN: Usar columnas correctas y manejar UUIDs (id puede ser UUID string)
export async function eliminarRegistroMora(historialId: number | string): Promise<void> {
  // El ID puede ser UUID (string) o número, manejar ambos casos
  const historialIdValue = typeof historialId === 'string' ? historialId : String(historialId)
  
  // Obtener el registro usando columnas correctas: id, mora_id, fecha, valor, tipo_pago
  const { data: registro, error: errorSelect } = await supabase
    .from('historial_moras')
    .select('id, mora_id, fecha, valor, tipo_pago')
    .eq('id', historialIdValue) // Usar el valor tal cual (UUID string o número convertido a string)
    .maybeSingle()
  
  if (errorSelect) {
    throw new Error(`Error al obtener el registro: ${errorSelect.message}`)
  }
  
  if (!registro) {
    throw new Error('Registro no encontrado en historial_moras')
  }
  
  console.log('🗑️ Eliminando registro de historial_moras:', registro)
  
  // Eliminar el registro del historial usando el ID correcto
  const { error: errorDelete } = await supabase
    .from('historial_moras')
    .delete()
    .eq('id', historialIdValue) // Usar el mismo valor (UUID string o número convertido)
  
  if (errorDelete) {
    console.error('❌ Error eliminando historial_moras:', errorDelete)
    throw new Error(`Error al eliminar el registro: ${errorDelete.message}`)
  }
  
  // Actualizar la tabla moras: reducir el valor_pagado y aumentar la resta (si mora_id existe)
  // CORRECCIÓN: Usar columnas correctas del registro (mora_id y valor)
  if (registro.mora_id && registro.valor) {
    const moraId = registro.mora_id
    const valorEliminado = parseFloat(String(registro.valor || 0)) || 0
    
    if (valorEliminado > 0) {
      // Buscar la mora activa correspondiente
      const { data: moraActual, error: errorMora } = await supabase
        .from('moras')
        .select('*')
        .eq('id', moraId) // Usar mora_id directamente
        .maybeSingle()
      
      if (!errorMora && moraActual) {
        const valorPagadoAnterior = parseFloat(String(moraActual.valor_pagado || 0)) || 0
        const totalSancion = parseFloat(String(moraActual.total_sancion || 0)) || 0
        const nuevoValorPagado = Math.max(0, valorPagadoAnterior - valorEliminado)
        const nuevaResta = Math.max(0, totalSancion - nuevoValorPagado)
        
        console.log('🔄 Actualizando tabla moras después de eliminar historial:', {
          moraId: moraActual.id,
          valorPagadoAnterior,
          valorEliminado,
          valorPagadoNuevo: nuevoValorPagado,
          restaNueva: nuevaResta
        })
        
        await supabase
          .from('moras')
          .update({
            valor_pagado: nuevoValorPagado,
            resta: nuevaResta
          })
          .eq('id', moraId)
      }
    }
  }
  
  // REGLA: Si el historial tenía un valor pagado > 0, insertar REVERSO en caja_central
  const valorEliminado = parseFloat(String(registro.valor || 0)) || 0
  if (valorEliminado > 0) {
    try {
      const saldoAnterior = await obtenerUltimoSaldo()
      const nuevoSaldo = saldoAnterior - valorEliminado // Restar porque es un REVERSO
      
      // Obtener información del asociado para el concepto
      let nombreAsociado = 'Asociado'
      if (registro.mora_id) {
        const { data: moraInfo } = await supabase
          .from('moras')
          .select('asociado_id, cuota')
          .eq('id', registro.mora_id)
          .maybeSingle()
        
        if (moraInfo?.asociado_id) {
          const { data: asociadoInfo } = await supabase
            .from('asociados')
            .select('nombre')
            .eq('id', moraInfo.asociado_id)
            .maybeSingle()
          
          if (asociadoInfo) {
            nombreAsociado = asociadoInfo.nombre
          }
        }
      }
      
      await crearMovimientoCaja({
        tipo: 'EGRESO',
        concepto: `REVERSO - Eliminación Pago Mora - ${nombreAsociado}`,
        monto: valorEliminado,
        saldo_anterior: saldoAnterior,
        nuevo_saldo: nuevoSaldo,
        fecha: registro.fecha || new Date().toISOString().split('T')[0]
      })
      
      console.log('✅ REVERSO de pago de mora eliminado registrado en caja_central')
    } catch (errorCaja: any) {
      // Si falla el reverso, loguear pero no fallar la eliminación
      console.error('❌ ERROR registrando REVERSO de mora eliminada en caja_central:', errorCaja)
      // No lanzar error para no bloquear la eliminación
    }
  }
  
  console.log('✅ Registro de historial_moras eliminado correctamente')
}

