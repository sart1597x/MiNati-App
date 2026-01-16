import { supabase, PagoCuota } from './supabase'
import { crearMovimientoCaja, obtenerUltimoSaldo } from './caja'
import { obtenerConfiguracionNacional } from './configuracion'

// ======================================================
// CONSTANTES DE NEGOCIO
// ======================================================
const VALOR_CUOTA = 30000
const VALOR_MORA_DIARIA = 3000
const MAX_DIAS_MORA = 15
const MAX_MONTO_MORA = 45000 // 15 días * $3,000

// ======================================================
// HELPER: NORMALIZAR FECHA DESDE INPUT DATE
// ======================================================
/**
 * Convierte una fecha string "YYYY-MM-DD" a objeto Date en hora local
 * Evita desfase UTC usando 12:00:00 como hora base
 * @param fecha - String en formato "YYYY-MM-DD"
 * @returns Date normalizado a las 12:00:00 hora local
 */
export function dateFromInput(fecha: string): Date {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0)
}

// ======================================================
// GENERAR FECHAS DE VENCIMIENTO
// ======================================================
// ENERO: Cuota 1 y 2 vencen el día 16
// FEBRERO-DICIEMBRE: Cuota 1 vence día 2, Cuota 2 vence día 16
export function generarFechasVencimiento(): Date[] {
  const fechas: Date[] = []
  
  // ENERO: Ambas cuotas vencen el 16
  const fecha1Enero = new Date(2026, 0, 16, 0, 0, 0)  // Cuota 1
  const fecha2Enero = new Date(2026, 0, 16, 0, 0, 0)  // Cuota 2
  fechas.push(fecha1Enero)
  fechas.push(fecha2Enero)
  
  // FEBRERO A DICIEMBRE: Cuota 1 día 2, Cuota 2 día 16
  for (let mes = 1; mes < 12; mes++) {
    const fecha1 = new Date(2026, mes, 2, 0, 0, 0)   // Cuota 1
    const fecha2 = new Date(2026, mes, 16, 0, 0, 0)  // Cuota 2
    fechas.push(fecha1)
    fechas.push(fecha2)
  }

  return fechas
}

// ======================================================
// CALCULAR ESTADO DE CUOTA (ÚNICA FUENTE DE VERDAD)
// ======================================================
/**
 * Calcula el estado de una cuota basado en la fecha de pago seleccionada
 * REGLA: diasMora = min(15, max(0, ceil((fechaPago - fechaVencimiento) / día)))
 * 
 * @param numeroCuota - Número de cuota (1-24)
 * @param fechaVencimiento - Fecha de vencimiento de la cuota
 * @param fechaPago - Fecha de pago seleccionada (NO usar fechaActual ni new Date())
 * @param pago - Pago existente (opcional)
 * @param valorMoraDiaria - Valor de mora diaria desde configuración (opcional, usa constante por defecto)
 * @param maxDiasMora - Máximo de días de mora (opcional, usa constante por defecto)
 * @param maxMontoMora - Máximo monto de mora (opcional, calcula desde valorMoraDiaria y maxDiasMora)
 * @returns Estado de la cuota con días y monto de mora
 */
export function calcularEstadoCuota(
  numeroCuota: number,
  fechaVencimiento: Date,
  fechaPago: Date,
  pago?: PagoCuota,
  valorMoraDiaria?: number,
  maxDiasMora?: number,
  maxMontoMora?: number
): {
  estado: 'pagado' | 'pendiente' | 'mora'
  diasMora: number
  montoMora: number
} {
  // Usar valores desde configuración si se proporcionan, sino usar constantes por defecto
  const valorMora = valorMoraDiaria ?? VALOR_MORA_DIARIA
  const maxDias = maxDiasMora ?? MAX_DIAS_MORA
  const maxMonto = maxMontoMora ?? (maxDias * valorMora)
  // Normalizar TODAS las fechas con setHours(0,0,0,0)
  const fechaVenc = new Date(
    fechaVencimiento.getFullYear(),
    fechaVencimiento.getMonth(),
    fechaVencimiento.getDate(),
    0, 0, 0, 0
  )
  
  const fechaPagoNorm = new Date(
    fechaPago.getFullYear(),
    fechaPago.getMonth(),
    fechaPago.getDate(),
    0, 0, 0, 0
  )

  // Día de gracia: Si se paga el mismo día del vencimiento, NO hay mora
  if (fechaPagoNorm.getTime() === fechaVenc.getTime()) {
    return {
      estado: pago?.pagado ? 'pagado' : 'pendiente',
      diasMora: 0,
      montoMora: 0
    }
  }

  // Si se paga antes del vencimiento, no hay mora
  if (fechaPagoNorm.getTime() < fechaVenc.getTime()) {
    return {
      estado: pago?.pagado ? 'pagado' : 'pendiente',
      diasMora: 0,
      montoMora: 0
    }
  }

  // REGLA: La mora existe si fechaPago > fechaVencimiento
  // Verificar que sean del mismo mes y año (cada cuota es independiente)
  const mismoMesYAno = (
    fechaPagoNorm.getMonth() === fechaVenc.getMonth() &&
    fechaPagoNorm.getFullYear() === fechaVenc.getFullYear()
  )
  
  if (!mismoMesYAno) {
    // Si son de meses diferentes, no hay mora (cada cuota es independiente)
    return {
      estado: pago?.pagado ? 'pagado' : 'pendiente',
      diasMora: 0,
      montoMora: 0
    }
  }
  
  // REGLA: Calcular días de mora usando floor((fechaPago - fechaVencimiento) / día)
  const diffMs = fechaPagoNorm.getTime() - fechaVenc.getTime()
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  // Aplicar fórmula: min(maxDias, max(1, diffDias)) - Mínimo 1 día si hay mora
  const diasMora = Math.min(maxDias, Math.max(1, diffDias))
  const montoMora = diasMora > 0 ? Math.min(maxMonto, diasMora * valorMora) : 0

  // Si hay mora (fechaPago > fechaVencimiento), el estado es 'mora'
  if (diasMora > 0) {
    return {
      estado: 'mora',
      diasMora,
      montoMora
    }
  }

  // Sin mora
  return {
    estado: pago?.pagado ? 'pagado' : 'pendiente',
    diasMora: 0,
    montoMora: 0
  }
}

// ======================================================
// CONSULTAS
// ======================================================
// Obtener pagos de un socio específico usando cedula (String)
// IMPORTANTE: Relación principal es por cedula, NO por id numérico
export async function getPagosSocio(cedula: string): Promise<PagoCuota[]> {
  const { data, error } = await supabase
    .from('cuotas_pagos')
    .select('*')
    .eq('cedula', cedula)  // Usar cedula (String), NO socio_id ni asociado_id

  if (error) throw error
  return data || []
}

export async function getAllPagos(): Promise<PagoCuota[]> {
  try {
    const { data, error } = await supabase
      .from('cuotas_pagos')
      .select('*')

    if (error) {
      // Si la tabla no existe, retornar array vacío
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Tabla cuotas_pagos no existe')
        return []
      }
      throw error
    }
    return data || []
  } catch (error: any) {
    console.error('Error obteniendo pagos:', error)
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return []
    }
    throw error
  }
}

// ======================================================
// REGISTRAR PAGO DE CUOTA
// ======================================================
/**
 * Registra el pago de una cuota
 * IMPORTANTE: El valor de la cuota se obtiene de configuracion_natillera (id = 1).
 * La mora se registra por separado en tabla moras usando valor_dia_mora desde configuración.
 * Solo se aplica a nuevos registros; registros antiguos conservan sus valores históricos.
 */
export async function registrarPago(
  cedula: string,
  numeroCuota: number,
  fechaVencimiento: Date,
  fechaPago: Date,
  fechaPagoString?: string // Fecha string original "YYYY-MM-DD" para guardar exactamente
): Promise<PagoCuota> {
  // 1. Obtener configuración nacional (id = 1) para nuevos registros
  const config = await obtenerConfiguracionNacional()
  const valorCuota = config?.valor_cuota ?? VALOR_CUOTA
  const valorDiaMora = config?.valor_dia_mora ?? VALOR_MORA_DIARIA
  const maxDiasMora = MAX_DIAS_MORA // Mantener constante por ahora
  const maxMontoMora = maxDiasMora * valorDiaMora // Calcular desde configuración

  // 2. Obtener información del asociado y verificar que esté activo
  const { data: asociado } = await supabase
    .from('asociados')
    .select('id, nombre, activo')
    .eq('cedula', cedula)
    .single()

  if (!asociado) {
    throw new Error('Asociado no encontrado')
  }

  // REGLA: Bloquear operaciones si el socio está inactivo
  if (asociado.activo === false) {
    throw new Error('No se puede registrar el pago: el socio está inactivo')
  }

  const asociadoId = typeof asociado.id === 'string' ? parseInt(asociado.id) : asociado.id

  // 3. Calcular mora usando la función centralizada con valores de configuración
  const estadoCalculado = calcularEstadoCuota(numeroCuota, fechaVencimiento, fechaPago, undefined, valorDiaMora, maxDiasMora, maxMontoMora)

  // 3. Preparar fecha en formato YYYY-MM-DD
  // REGLA: La fecha guardada debe ser EXACTAMENTE la fecha seleccionada, sin UTC ni desfase
  // Usar la fecha string original si está disponible, sino construir desde el Date normalizado
  let fechaTexto: string
  if (fechaPagoString) {
    fechaTexto = fechaPagoString // Usar la fecha string original exactamente
  } else {
    // Fallback: construir desde el Date (ya normalizado a 0,0,0,0)
    const año = fechaPago.getFullYear()
    const mes = String(fechaPago.getMonth() + 1).padStart(2, '0')
    const dia = String(fechaPago.getDate()).padStart(2, '0')
    fechaTexto = `${año}-${mes}-${dia}`
  }

  // 4. Verificar si ya existe el pago usando CEDULA (String) como relación principal
  // IMPORTANTE: NO usar socio_id ni asociado_id numérico, solo cedula (String)
  const { data: existente } = await supabase
    .from('cuotas_pagos')
    .select('*')
    .eq('cedula', cedula)  // Relación por cedula (String), NO por id numérico
    .eq('numero_cuota', numeroCuota)
    .maybeSingle()

  // REGLA: registrarPago SOLO crea nuevos pagos. Si ya existe, lanzar error.
  if (existente) {
    throw new Error(`El pago de la cuota ${numeroCuota} ya existe. Use actualizarPagoCuota() para actualizar la fecha u observaciones.`)
  }

  // 4. Registrar el pago de la CUOTA usando valor desde configuración
  // IMPORTANTE: pagoData solo contiene cedula (String), NO incluye socio_id ni asociado_id
  const pagoData = {
    cedula: cedula,  // String - Relación principal, NO usar IDs numéricos
    numero_cuota: numeroCuota,
    fecha_vencimiento: fechaVencimiento.toISOString().split('T')[0],
    fecha_pago: fechaTexto,
    monto_cuota: valorCuota, // Usar valor desde configuración
    monto_mora: 0, // NUNCA incluir la mora aquí
    monto_total: valorCuota, // Usar valor desde configuración
    pagado: true
  }

  const { data, error } = await supabase
    .from('cuotas_pagos')
    .insert([pagoData])
    .select()
    .single()

  if (error) throw error
  const pagoResult = data

  // 6. Si hay mora, registrar en tabla moras
  // REGLA: La existencia del registro en moras indica que la mora está PENDIENTE
  // Si resta > 0, la mora aún está pendiente de pago
  // NOTA: Cada cuota se calcula de forma INDEPENDIENTE
  if (estadoCalculado.diasMora > 0) {
    // Eliminar mora previa de esta cuota (si existía)
    await supabase
      .from('moras')
      .delete()
      .eq('asociado_id', asociadoId)
      .eq('cuota', numeroCuota)

    // Crear nueva mora (la existencia del registro indica que está PENDIENTE)
    // REGLA: La tabla moras NO tiene columna estado. Si existe el registro, la mora está PENDIENTE
    // Ajustar fecha sumando +1 día para evitar desfase UTC al guardar en Supabase
    const [y, m, d] = fechaTexto.split('-').map(Number)
    const fechaAjustada = new Date(y, m - 1, d + 1, 12, 0, 0) // Sumar +1 día y usar 12:00 hora local
    const fechaAjustadaTexto = `${fechaAjustada.getFullYear()}-${String(fechaAjustada.getMonth() + 1).padStart(2, '0')}-${String(fechaAjustada.getDate()).padStart(2, '0')}`
    
    const moraData = {
      asociado_id: asociadoId,
      cuota: numeroCuota,
      dias_mora: estadoCalculado.diasMora,
      valor_mora: valorDiaMora, // Usar valor desde configuración
      total_sancion: estadoCalculado.montoMora,
      valor_pagado: 0, // Aún no se ha pagado
      resta: estadoCalculado.montoMora, // Total pendiente (si resta > 0, la mora está pendiente)
      fecha_pago: fechaAjustadaTexto // Fecha ajustada +1 día para evitar desfase UTC
    }

    const { error: errorMora } = await supabase
      .from('moras')
      .insert([moraData])

    if (errorMora) {
      console.error('Error insertando mora:', errorMora)
      throw errorMora
    }

    console.log('✅ Mora registrada en tabla moras (pendiente de pago):', moraData)
  } else {
    // Si no hay mora, eliminar cualquier registro previo de esta cuota
    await supabase
      .from('moras')
      .delete()
      .eq('asociado_id', asociadoId)
      .eq('cuota', numeroCuota)
  }

  // REGLA: Registrar el ingreso en caja_central (pago de cuota) usando referencia_id = pago.id
  try {
    const saldoAnterior = await obtenerUltimoSaldo()
    const nuevoSaldo = saldoAnterior + valorCuota // Sumar el pago de cuota usando valor desde configuración
    
    await crearMovimientoCaja({
      tipo: 'INGRESO',
      concepto: `Pago Cuota ${numeroCuota} - ${asociado.nombre}`,
      monto: valorCuota, // Usar valor desde configuración
      saldo_anterior: saldoAnterior,
      nuevo_saldo: nuevoSaldo,
      fecha: fechaTexto,
      referencia_id: pagoResult.id // Usar UUID del pago como referencia
    })
    
    console.log('✅ Pago de cuota registrado en caja_central con referencia_id:', pagoResult.id)
  } catch (errorCaja: any) {
    // Si falla el registro en caja, informar al usuario pero NO revertir el pago
    console.error('❌ ERROR CRÍTICO registrando pago de cuota en caja_central:', errorCaja)
    throw new Error(`El pago de cuota se registró, pero hubo un error al actualizar la caja: ${errorCaja?.message || 'Error desconocido'}. Por favor, verifica manualmente la caja.`)
  }

  return pagoResult
}

// ======================================================
// ACTUALIZAR PAGO DE CUOTA (SOLO FECHA/OBSERVACIONES)
// ======================================================
/**
 * Actualiza solo la fecha y observaciones de un pago existente
 * REGLA: NO modifica caja_central. NO crea movimientos.
 * Para cambiar el valor del pago, usar eliminarPago + registrarPago
 */
export async function actualizarPagoCuota(
  cedula: string,
  numeroCuota: number,
  fechaPago: Date,
  fechaPagoString?: string // Fecha string original "YYYY-MM-DD" para guardar exactamente
): Promise<PagoCuota> {
  // 1. Obtener el pago existente
  const { data: pagoExistente, error: errorPago } = await supabase
    .from('cuotas_pagos')
    .select('*')
    .eq('cedula', cedula)
    .eq('numero_cuota', numeroCuota)
    .maybeSingle()

  if (errorPago) throw errorPago
  if (!pagoExistente) {
    throw new Error(`No existe un pago para la cuota ${numeroCuota}. Use registrarPago() para crear uno nuevo.`)
  }

  // 2. Preparar fecha en formato YYYY-MM-DD
  let fechaTexto: string
  if (fechaPagoString) {
    fechaTexto = fechaPagoString
  } else {
    const año = fechaPago.getFullYear()
    const mes = String(fechaPago.getMonth() + 1).padStart(2, '0')
    const dia = String(fechaPago.getDate()).padStart(2, '0')
    fechaTexto = `${año}-${mes}-${dia}`
  }

  // 3. Actualizar SOLO fecha_pago (NO tocar monto, NO tocar caja)
  const { data, error } = await supabase
    .from('cuotas_pagos')
    .update({
      fecha_pago: fechaTexto
    })
    .eq('id', pagoExistente.id)
    .select()
    .single()

  if (error) throw error

  console.log('✅ Pago actualizado (fecha cambiada, caja NO modificada)')

  return data
}

// ======================================================
// ELIMINAR PAGO (BORRADO EN CASCADA)
// ======================================================
export async function eliminarPago(
  cedula: string,
  numeroCuota: number
): Promise<void> {
  const { data: asociado } = await supabase
    .from('asociados')
    .select('id')
    .eq('cedula', cedula)
    .single()

  if (!asociado) {
    throw new Error('Asociado no encontrado')
  }

  const asociadoId = typeof asociado.id === 'string' ? parseInt(asociado.id) : asociado.id

  // REGLA: Antes de eliminar, verificar si el pago estaba pagado para registrar REVERSO en caja
  const { data: pagoAEliminar } = await supabase
    .from('cuotas_pagos')
    .select('*')
    .eq('cedula', cedula)
    .eq('numero_cuota', numeroCuota)
    .maybeSingle()

  const pagoEstabaPagado = pagoAEliminar?.pagado === true
  // Usar el monto guardado en el registro (no recalcular, preserva valores históricos)
  const montoCuota = parseFloat(String(pagoAEliminar?.monto_cuota || VALOR_CUOTA)) || VALOR_CUOTA

  // Obtener nombre del asociado para los conceptos de reverso
  const { data: asociadoInfo } = await supabase
    .from('asociados')
    .select('nombre')
    .eq('id', asociadoId)
    .maybeSingle()
  
  const nombreAsociado = asociadoInfo?.nombre || cedula

  // REGLA CRÍTICA: Revertir TODOS los pagos de mora asociados a esta cuota
  // Buscar la mora asociada primero
  try {
    const { data: moraExistente } = await supabase
      .from('moras')
      .select('id')
      .eq('asociado_id', asociadoId)
      .eq('cuota', numeroCuota)
      .maybeSingle()
    
    if (moraExistente?.id) {
      // Obtener TODOS los pagos de mora registrados en historial_moras
      const { data: pagosMoras, error: errorPagosMoras } = await supabase
        .from('historial_moras')
        .select('id, valor, fecha')
        .eq('mora_id', moraExistente.id)
      
      if (!errorPagosMoras && pagosMoras && pagosMoras.length > 0) {
        // Por cada pago de mora, crear un EGRESO en caja_central
        for (const pagoMora of pagosMoras) {
          const valorPagoMora = parseFloat(String(pagoMora.valor || 0)) || 0
          
          if (valorPagoMora > 0) {
            try {
              const saldoAnterior = await obtenerUltimoSaldo()
              const nuevoSaldo = saldoAnterior - valorPagoMora // Restar porque es un REVERSO
              
              await crearMovimientoCaja({
                tipo: 'EGRESO',
                concepto: `REVERSO - Eliminación Mora Cuota ${numeroCuota} - ${nombreAsociado}`,
                monto: valorPagoMora,
                saldo_anterior: saldoAnterior,
                nuevo_saldo: nuevoSaldo,
                fecha: pagoMora.fecha || new Date().toISOString().split('T')[0]
              })
              
              console.log(`✅ REVERSO de pago de mora registrado en caja_central: $${valorPagoMora.toLocaleString()}`)
            } catch (errorReversoMora: any) {
              // Si falla un reverso, loguear pero continuar con los demás
              console.error(`❌ ERROR registrando REVERSO de pago de mora en caja_central:`, errorReversoMora)
            }
          }
        }
      }
    }
  } catch (e: any) {
    // Si no existe la mora o hay error, continuar (no es crítico)
    console.warn('Advertencia: No se pudieron revertir pagos de mora (puede que no existan):', e?.message)
  }

  // Eliminar moras asociadas (si existen)
  try {
    await supabase
      .from('moras')
      .delete()
      .eq('asociado_id', asociadoId)
      .eq('cuota', numeroCuota)
  } catch (e: any) {
    // Si no existe la mora o hay error, continuar (no es crítico)
    console.warn('Advertencia: No se pudo eliminar mora asociada (puede que no exista):', e?.message)
  }

  // REGLA: Eliminar de historial_moras SOLO si existe registro asociado
  // NO debe lanzar error ni bloquear el reverso si no existe
  try {
    // Primero verificar si existe un registro de mora asociado
    const { data: moraExistenteParaEliminar } = await supabase
      .from('moras')
      .select('id')
      .eq('asociado_id', asociadoId)
      .eq('cuota', numeroCuota)
      .maybeSingle()
    
    // Solo eliminar de historial_moras si existe una mora asociada
    if (moraExistenteParaEliminar?.id) {
      await supabase
        .from('historial_moras')
        .delete()
        .eq('mora_id', moraExistenteParaEliminar.id)
    } else {
      console.log('⚠️ No existe mora asociada a esta cuota, omitiendo eliminación de historial_moras')
    }
  } catch (e: any) {
    // Si no existe el registro o hay error, continuar (no es crítico)
    console.warn('Advertencia: No se pudo eliminar historial_moras (puede que no exista):', e?.message)
  }

  // REGLA: Si el pago estaba pagado, eliminar movimiento en caja usando referencia_id
  if (pagoEstabaPagado && pagoAEliminar?.id) {
    try {
      // Buscar y eliminar el movimiento de caja usando referencia_id = pago.id
      const { data: movimientosCaja, error: errorMovimientos } = await supabase
        .from('caja_central')
        .select('id')
        .eq('referencia_id', pagoAEliminar.id)

      if (!errorMovimientos && movimientosCaja && movimientosCaja.length > 0) {
        // Eliminar todos los movimientos encontrados (debería ser solo uno)
        for (const movimiento of movimientosCaja) {
          await supabase
            .from('caja_central')
            .delete()
            .eq('id', movimiento.id)
        }
        console.log('✅ Movimiento de caja eliminado usando referencia_id:', pagoAEliminar.id)
      } else {
        // Si no se encuentra por referencia_id, intentar eliminar por concepto (fallback)
        console.warn('⚠️ No se encontró movimiento de caja por referencia_id, intentando por concepto...')
        const concepto = `Pago Cuota ${numeroCuota} - ${nombreAsociado}`
        const { data: movimientosPorConcepto } = await supabase
          .from('caja_central')
          .select('id')
          .eq('concepto', concepto)
          .eq('tipo', 'INGRESO')
          .order('created_at', { ascending: false })
          .limit(1)

        if (movimientosPorConcepto && movimientosPorConcepto.length > 0) {
          await supabase
            .from('caja_central')
            .delete()
            .eq('id', movimientosPorConcepto[0].id)
          console.log('✅ Movimiento de caja eliminado usando concepto (fallback)')
        }
      }
    } catch (errorCaja: any) {
      // Si falla la eliminación del movimiento, loguear pero no fallar la eliminación del pago
      console.error('❌ ERROR eliminando movimiento de caja:', errorCaja)
      console.warn('⚠️ El pago se eliminará, pero el movimiento de caja podría quedar huérfano')
    }
  }

  // Eliminar el pago usando cedula (String) como relación principal
  // IMPORTANTE: NO usar socio_id ni asociado_id numérico, solo cedula (String)
  const { error } = await supabase
    .from('cuotas_pagos')
    .delete()
    .eq('cedula', cedula)  // Relación por cedula (String), NO por id numérico
    .eq('numero_cuota', numeroCuota)

  if (error) throw error
}
// =====================================================
// TOTAL RECAUDO DE CUOTAS (PARA CAJA CENTRAL)
// NO modifica lógica existente
// =====================================================
export async function obtenerTotalRecaudoCuotas(): Promise<{
  totalCuotas: number
  valorTotal: number
}> {
  // 1. Obtener todas las cuotas pagadas
  const { data, error } = await supabase
    .from('cuotas_pagos')
    .select('id')
    .eq('pagado', true)

  if (error) {
    console.error('Error obteniendo cuotas pagadas:', error)
    throw error
  }

  const totalCuotas = data?.length || 0

  // 2. Obtener valor de la cuota desde configuración
  const configuracion = await obtenerConfiguracionNacional()
  const valorCuota = Number(configuracion?.valor_cuota || 0)


  // 3. Calcular total recaudado
  const valorTotal = totalCuotas * valorCuota

  return {
    totalCuotas,
    valorTotal
  }
}
