// Versión actualizada: Corrección de nombres de columnas para historial_moras
// Columnas correctas: fecha_pago, valor_pagado, nombre_asociado
// Última actualización: 2024-01-XX - Forzar refresco de caché
import { supabase } from './supabase'
import { Socio, PagoCuota } from './supabase'
import { generarFechasVencimiento, calcularEstadoCuota, getPagosSocio } from './pagos'
import { obtenerUltimoSaldo, crearMovimientoCaja } from './caja'
import { obtenerConfiguracionNacional } from './configuracion'

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
  // Obtener estado real de pago de las cuotas
const { data: cuotasPagos } = await supabase
.from('cuotas_pagos')
.select('cedula, numero_cuota, pagado, fecha_pago')
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
    
    const cuotaPago = cuotasPagos?.find(
      c =>
        c.cedula === socio?.cedula &&
        c.numero_cuota === mora.cuota
    )
    
    return {
      id: moraId,
      cedula: socio?.cedula || '',
      nombre: socio?.nombre || 'Desconocido',
    
      // 👇 CLAVE: solo mostrar fecha si la CUOTA está pagada
      fecha_pago: cuotaPago?.pagado ? cuotaPago.fecha_pago : null,
    
      numero_cuota: mora.cuota,
      dias_mora: mora.dias_mora,
      valor_mora: parseFloat(mora.valor_mora) || VALOR_MORA_DIARIA,
      total_sancion: parseFloat(mora.total_sancion) || 0,
      valor_pagado: parseFloat(mora.valor_pagado) || 0,
      resta: parseFloat(mora.resta) || 0,
      fecha_vencimiento: mora.fecha_pago
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
      console.log('✅ [PASO 1.6] Mora completamente pagada. Se mantiene para historial (resta = 0)')
    
      const { error: errorUpdateMora } = await supabase
        .from('moras')
        .update({
          valor_pagado: nuevoValorPagado,
          resta: 0,
          fecha_pago: fechaFormateadaMora
        })
        .eq('id', moraIdParaUpdate)
    
      if (errorUpdateMora) {
        throw new Error(`Error actualizando mora pagada: ${errorUpdateMora.message}`)
      }
    }
    else {
    
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
// ======================================================
// ACTUALIZAR MORAS EXISTENTES (RECALCULAR DÍAS Y VALORES)
// ======================================================
export async function actualizarMorasExistentes(): Promise<void> {
  console.log('🔁 Actualizando moras existentes...')

  const fechaActual = new Date()
  //const fechaActual = new Date('2026-01-21')
  fechaActual.setHours(0, 0, 0, 0)

  const config = await obtenerConfiguracionNacional()
  const valorDiaMora = config?.valor_dia_mora ?? VALOR_MORA_DIARIA

  const { data: moras, error } = await supabase
    .from('moras')
    .select('*')
    .gt('resta', 0)

  if (!moras) return
  
  const fechasVencimiento = generarFechasVencimiento()

  const pagosPorCedula = new Map<string, Set<number>>()

  const { data: pagos } = await supabase
    .from('cuotas_pagos')
    .select('cedula, numero_cuota')
  
  pagos?.forEach(p => {
    if (!pagosPorCedula.has(p.cedula)) {
      pagosPorCedula.set(p.cedula, new Set())
    }
    pagosPorCedula.get(p.cedula)!.add(p.numero_cuota)
  })

  for (const mora of moras) {
    const { data: asociado } = await supabase
    .from('asociados')
    .select('cedula')
    .eq('id', mora.asociado_id)
    .maybeSingle()
  
  if (!asociado?.cedula) {
    console.warn('⚠️ No se pudo obtener cédula del asociado', mora.asociado_id)
    continue
  }
  
  // 🔒 2. Verificar si la CUOTA está pagada
  const { data: cuotaPagada } = await supabase
    .from('cuotas_pagos')
    .select('id')
    .eq('cedula', asociado.cedula)
    .eq('numero_cuota', mora.cuota)
    .eq('pagado', true)
    .maybeSingle()
  
  if (cuotaPagada) {
    console.log(
      `🧊 Mora congelada (cuota pagada) → cédula ${asociado.cedula}, cuota ${mora.cuota}`
    )
    continue
  }
    const fechaVenc = fechasVencimiento[mora.cuota - 1]
    if (!fechaVenc) continue
    const fechaVencNorm = new Date(
      fechaVenc.getFullYear(),
      fechaVenc.getMonth(),
      fechaVenc.getDate(),
      0, 0, 0, 0
    )

    const fechaInicioMora = new Date(fechaVenc)
    fechaInicioMora.setDate(fechaInicioMora.getDate() + 1)

    const diffMs = fechaActual.getTime() - fechaInicioMora.getTime()
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDias <= 0) continue

    const diasMora = Math.min(MAX_DIAS_MORA, diffDias)
    const totalSancion = Math.min(
      MAX_TOTAL_SANCION,
      diasMora * valorDiaMora
    )
// ⛔️ ESTA ES LA CLAVE QUE FALTABA


// ⬇️ Si NO está pagada, permitir que la mora aumente
if (diasMora <= mora.dias_mora) {
  continue
}
    const nuevaResta = Math.max(
      0,
      totalSancion - (mora.valor_pagado || 0)
    )

    await supabase
      .from('moras')
      .update({
        dias_mora: diasMora,
        total_sancion: totalSancion,
        resta: nuevaResta,
        valor_mora: valorDiaMora
      })
      .eq('id', mora.id)
  }

  console.log('✅ Moras existentes actualizadas')
}

// ======================================================
// GENERACIÓN AUTOMÁTICA DE MORAS POR FECHA
// ======================================================
/**
 * Genera automáticamente las moras para todas las cuotas vencidas sin pago
 * REGLA: Se ejecuta al cargar el módulo "Control de Moras"
 * REGLA: Proceso IDEMPOTENTE - puede ejecutarse muchas veces sin duplicar datos
 * REGLA: Solo crea moras si NO existe pago y NO existe mora previa
 */
export async function generarMorasAutomaticas(): Promise<number> {
  try {
    await actualizarMorasExistentes()
    console.log('🔄 Iniciando generación automática de moras...')
    
    // 1. Obtener fecha actual del sistema
    const fechaActual = new Date()
    //const fechaActual = new Date('2026-01-21')
    fechaActual.setHours(0, 0, 0, 0) // Normalizar a medianoche
    
    // 2. Obtener configuración para valor_dia_mora
    const config = await obtenerConfiguracionNacional()
    const valorDiaMora = config?.valor_dia_mora ?? VALOR_MORA_DIARIA
    const maxDiasMora = MAX_DIAS_MORA
    const maxMontoMora = MAX_TOTAL_SANCION
    
    console.log('📋 Configuración:', { valorDiaMora, maxDiasMora, maxMontoMora })
    
    // 3. Obtener todos los asociados activos
    const { data: asociados, error: errorAsociados } = await supabase
      .from('asociados')
      .select('id, cedula, nombre, activo')
      .eq('activo', true)
    
    if (errorAsociados) {
      console.error('❌ Error obteniendo asociados:', errorAsociados)
      throw errorAsociados
    }
    
    if (!asociados || asociados.length === 0) {
      console.log('ℹ️ No hay asociados activos')
      return 0
    }
    
    console.log(`📊 Procesando ${asociados.length} asociados activos...`)
    
    // 4. Obtener todas las fechas de vencimiento
    const fechasVencimiento = generarFechasVencimiento()
    
    // 5. Obtener todas las moras existentes para verificación rápida
    const { data: morasExistentes } = await supabase
      .from('moras')
      .select('asociado_id, cuota')
    
    // Crear un Set para búsqueda rápida: "asociado_id-cuota"
    const morasExistentesSet = new Set<string>()
    morasExistentes?.forEach(mora => {
      const key = `${mora.asociado_id}-${mora.cuota}`
      morasExistentesSet.add(key)
    })
    
    let morasCreadas = 0
    
    // 6. Para cada asociado, verificar sus cuotas
    for (const asociado of asociados) {
      const asociadoId = asociado.id
      const cedula = asociado.cedula
      
      console.log(`\n👤 Evaluando asociado: ${asociado.nombre} (${cedula})`)
      
      // Obtener pagos del asociado
      const pagos = await getPagosSocio(cedula)
      
      // Crear un Set de cuotas con pago registrado (NO solo pagadas, sino cualquier registro)
      const cuotasConPagoSet = new Set<number>()
      pagos.forEach(pago => {
        if (pago.numero_cuota) {
          cuotasConPagoSet.add(pago.numero_cuota)
          console.log(`  📝 Cuota ${pago.numero_cuota} tiene registro de pago (pagado: ${pago.pagado})`)
        }
      })
      
      // 7. Para cada cuota (1-24), verificar si necesita mora
      for (let numeroCuota = 1; numeroCuota <= 24; numeroCuota++) {
        // Verificar si ya existe mora para este asociado y cuota
        const keyMora = `${asociadoId}-${numeroCuota}`
        if (morasExistentesSet.has(keyMora)) {
          console.log(`  ⏭️ Cuota ${numeroCuota}: Ya existe mora registrada`)
          continue // Ya existe mora, saltar
        }
        
        // REGLA: Verificar si existe CUALQUIER registro de pago para esta cuota (no solo si está pagado)
        if (cuotasConPagoSet.has(numeroCuota)) {
          console.log(`  ⏭️ Cuota ${numeroCuota}: Existe registro de pago (aunque no esté pagado)`)
          continue // Existe registro de pago, saltar
        }
        
        // Obtener fecha de vencimiento de la cuota
        const fechaVencimiento = fechasVencimiento[numeroCuota - 1]
        if (!fechaVencimiento) {
          console.log(`  ⏭️ Cuota ${numeroCuota}: Fecha de vencimiento no encontrada`)
          continue // Fecha de vencimiento no encontrada, saltar
        }
        
        // Normalizar fecha de vencimiento (local, sin UTC)
        const fechaVencNorm = new Date(
          fechaVencimiento.getFullYear(),
          fechaVencimiento.getMonth(),
          fechaVencimiento.getDate(),
          0, 0, 0, 0
        )
        
        // Formatear fechas para logs
        const fechaActualStr = fechaActual.toISOString().split('T')[0]
        const fechaVencStr = fechaVencNorm.toISOString().split('T')[0]
        
        console.log(`  📅 Cuota ${numeroCuota}:`)
        console.log(`     Fecha vencimiento: ${fechaVencStr}`)
        console.log(`     Fecha actual: ${fechaActualStr}`)
        console.log(`     Comparación: ${fechaActual.getTime()} > ${fechaVencNorm.getTime()} = ${fechaActual.getTime() > fechaVencNorm.getTime()}`)
        
        // REGLA: Solo crear mora si fecha actual > fecha de vencimiento (estrictamente mayor)
        if (fechaActual.getTime() <= fechaVencNorm.getTime()) {
          console.log(`  ⏭️ Cuota ${numeroCuota}: Aún no vence (fecha actual <= fecha vencimiento)`)
          continue // Aún no vence, saltar
        }
        
        // 8. Calcular días de mora
        // dias_mora = diferencia directa entre hoy y fecha de vencimiento
const diffMs = fechaActual.getTime() - fechaVencNorm.getTime()
const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))

// REGLA DE NEGOCIO: el primer día vencido cuenta como 1 día de mora
const diasMoraBase = Math.max(1, diffDias)

        
        console.log(`     Días desde inicio mora: ${diffDias}`)
        
               
        // Aplicar tope de días de mora
// Aplicar tope de días de mora
const diasMora = Math.min(maxDiasMora, diasMoraBase)

        
        // Calcular total_sancion = dias_mora * valor_dia_mora (con tope)
        const totalSancion = Math.min(maxMontoMora, diasMora * valorDiaMora)
        
        console.log(`     ✅ CUOTA VENCIDA - Generando mora:`)
        console.log(`        Días de mora: ${diasMora}`)
        console.log(`        Total sanción: $${totalSancion.toLocaleString()}`)
        
        // 9. Crear registro de mora
        // REGLA: Verificar SIEMPRE que no exista mora previa antes de insertar (doble verificación)
        const { data: moraExistente } = await supabase
          .from('moras')
          .select('id')
          .eq('asociado_id', asociadoId)
          .eq('cuota', numeroCuota)
          .maybeSingle()
        
        if (moraExistente) {
          console.log(`  ⏭️ Cuota ${numeroCuota}: Mora ya existe en BD (doble verificación)`)
          continue // Ya existe, saltar (idempotencia)
        }
        
        // Formatear fecha_pago (usar fecha actual como referencia)
        const fechaPagoTexto = fechaActual.toISOString().split('T')[0]
        
        // Ajustar fecha sumando +1 día para evitar desfase UTC (igual que en registrarPago)
        const [y, m, d] = fechaPagoTexto.split('-').map(Number)
        const fechaAjustada = new Date(y, m - 1, d + 1, 12, 0, 0)
        const fechaAjustadaTexto = `${fechaAjustada.getFullYear()}-${String(fechaAjustada.getMonth() + 1).padStart(2, '0')}-${String(fechaAjustada.getDate()).padStart(2, '0')}`
        
        const moraData = {
          asociado_id: asociadoId,
          cuota: numeroCuota,
          dias_mora: diasMora,
          valor_mora: valorDiaMora,
          total_sancion: totalSancion,
          valor_pagado: 0, // Aún no se ha pagado
          resta: totalSancion, // Total pendiente
          fecha_pago: fechaAjustadaTexto
        }
        
        const { error: errorInsert } = await supabase
          .from('moras')
          .insert([moraData])
        
        if (errorInsert) {
          console.error(`❌ Error creando mora para asociado ${asociadoId}, cuota ${numeroCuota}:`, errorInsert)
          continue // Continuar con siguiente cuota
        }
        // 🔒 REGISTRO EN MEMORIA PARA EVITAR DUPLICADOS EN EL MISMO CICLO
        morasExistentesSet.add(`${asociadoId}-${numeroCuota}`)

        console.log(`✅ Mora creada: ${asociado.nombre} - Cuota ${numeroCuota} - ${diasMora} días - $${totalSancion.toLocaleString()}`)
        morasCreadas++
      }
    }
    
    console.log(`✅ Generación automática completada. Moras creadas: ${morasCreadas}`)
    return morasCreadas
    
  } catch (error: any) {
    console.error('❌ Error en generación automática de moras:', error)
    throw error
  }
}
// ======================================================
// RECALCULAR MORA CUANDO SE CAMBIA FECHA DE PAGO DE CUOTA
// ======================================================
export async function recalcularMoraPorPagoCuota(
  cedula: string,
  numeroCuota: number,
  fechaPagoTexto: string
): Promise<void> {
  console.log(
    `🔁 Recalculando mora por cambio de fecha → ${cedula}, cuota ${numeroCuota}, fecha ${fechaPagoTexto}`
  )

  // 1. Obtener asociado
  const { data: asociado } = await supabase
    .from('asociados')
    .select('id')
    .eq('cedula', cedula)
    .maybeSingle()

  if (!asociado) {
    console.warn('⚠️ Asociado no encontrado para recalcular mora')
    return
  }

  const asociadoId = asociado.id

  // 2. Obtener mora existente
  const { data: moraExistente } = await supabase
    .from('moras')
    .select('*')
    .eq('asociado_id', asociadoId)
    .eq('cuota', numeroCuota)
    .maybeSingle()

  if (!moraExistente) {
    console.log('ℹ️ No existe mora para esta cuota, nada que recalcular')
    return
  }

  // 3. Obtener fecha de vencimiento
  const fechasVencimiento = generarFechasVencimiento()
  const fechaVenc = fechasVencimiento[numeroCuota - 1]

  if (!fechaVenc) {
    console.warn('⚠️ No se pudo obtener fecha de vencimiento')
    return
  }

  const fechaVencNorm = new Date(
    fechaVenc.getFullYear(),
    fechaVenc.getMonth(),
    fechaVenc.getDate(),
    0, 0, 0, 0
  )

  const [y, m, d] = fechaPagoTexto.split('-').map(Number)
  const fechaPago = new Date(y, m - 1, d, 0, 0, 0, 0)

  // 4. Calcular días de mora
  if (fechaPago.getTime() <= fechaVencNorm.getTime()) {
    // ❄️ Si ya no hay mora, eliminar registro
    await supabase
      .from('moras')
      .delete()
      .eq('id', moraExistente.id)

    console.log('❄️ Mora eliminada (fecha corregida, ya no hay mora)')
    return
  }

  const diffMs = fechaPago.getTime() - fechaVencNorm.getTime()
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diasMora = Math.min(MAX_DIAS_MORA, Math.max(1, diffDias))

  const config = await obtenerConfiguracionNacional()
  const valorDiaMora = config?.valor_dia_mora ?? VALOR_MORA_DIARIA
  const totalSancion = Math.min(MAX_TOTAL_SANCION, diasMora * valorDiaMora)

  // 5. Actualizar mora
  await supabase
    .from('moras')
    .update({
      dias_mora: diasMora,
      valor_mora: valorDiaMora,
      total_sancion: totalSancion,
      resta: totalSancion - (moraExistente.valor_pagado || 0)
    })
    .eq('id', moraExistente.id)

  console.log(
    `✅ Mora recalculada → ${diasMora} días, $${totalSancion.toLocaleString()}`
  )
}
// ======================================================
// ACTUALIZAR MORAS EXISTENTES (RECALCULAR DÍAS)
// ======================================================
/**
 * Recalcula días de mora y total_sancion para moras activas
 * REGLAS:
 * - SOLO moras con resta > 0
 * - NO crea moras nuevas
 * - NO toca caja
 * - NO toca historial
 * - IDEMPOTENTE
 */
