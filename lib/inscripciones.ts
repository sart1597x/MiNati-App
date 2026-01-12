import { supabase } from './supabase'
import { obtenerConfiguracionNacional } from './configuracion'
import { crearMovimientoCaja, obtenerUltimoSaldo, actualizarMovimientoCaja, eliminarMovimientoCaja } from './caja'

export type EstadoInscripcion = 'PENDIENTE' | 'PAGADA' | 'RETIRADA'

export interface Inscripcion {
  id: string
  socio_id: number
  valor: number
  estado: EstadoInscripcion
  fecha_inscripcion: string
  fecha_pago: string | null
  created_at?: string
}

/**
 * Crear inscripción de un socio
 * - Si pagaAhora = true → queda PAGADA y entra a caja
 * - Si pagaAhora = false → queda PENDIENTE
 */
export async function crearInscripcion(
  socioId: number,
  pagaAhora: boolean,
  nombreSocio?: string
): Promise<Inscripcion> {
  // REGLA: Verificar que el socio esté activo antes de crear inscripción
  const { data: socio } = await supabase
    .from('asociados')
    .select('activo')
    .eq('id', socioId)
    .single()

  if (!socio) {
    throw new Error('Socio no encontrado')
  }

  if (socio.activo === false) {
    throw new Error('No se puede crear la inscripción: el socio está inactivo')
  }

  const config = await obtenerConfiguracionNacional()
  const valorInscripcion = config?.valor_inscripcion ?? 0

  const hoy = new Date().toISOString().split('T')[0]

  const nuevaInscripcion = {
    socio_id: socioId,
    valor: valorInscripcion,
    estado: pagaAhora ? 'PAGADA' : 'PENDIENTE',
    fecha_inscripcion: hoy,
    fecha_pago: pagaAhora ? hoy : null
  }

  const { data, error } = await supabase
    .from('inscripciones')
    .insert(nuevaInscripcion)
    .select()
    .single()

  if (error) throw error

  // Si se paga de una vez → registrar en caja
  if (pagaAhora) {
    const concepto = nombreSocio
      ? `Inscripción - ${nombreSocio} (${socioId})`
      : `Inscripción socio ID ${socioId}`

      const saldoAnterior = await obtenerUltimoSaldo()
      const nuevoSaldo = saldoAnterior + valorInscripcion
      
      await crearMovimientoCaja({
        tipo: 'INGRESO',
        concepto,
        monto: valorInscripcion,
        fecha: hoy,
        saldo_anterior: saldoAnterior,
        nuevo_saldo: nuevoSaldo,
        referencia_id: data.id
      })
      
  }

  return data as Inscripcion
}

/**
 * Obtener todas las inscripciones
 */
export async function obtenerInscripciones(): Promise<Inscripcion[]> {
  const { data, error } = await supabase
    .from('inscripciones')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Inscripcion[]
}

/**
 * Obtener resumen de inscripciones pagadas
 * Retorna cantidad y valor total de inscripciones con estado = 'PAGADA'
 */
export async function obtenerResumenInscripciones(): Promise<{ cantidad: number; valorTotal: number }> {
  try {
    const { data, error } = await supabase
      .from('inscripciones')
      .select('valor')
      .eq('estado', 'PAGADA')

    if (error) throw error

    const cantidad = Array.isArray(data) ? data.length : 0
    const valorTotal = Array.isArray(data)
      ? data.reduce((sum, inscripcion) => sum + (Number(inscripcion.valor) || 0), 0)
      : 0

    return { cantidad, valorTotal }
  } catch (error: any) {
    console.warn('Error obteniendo resumen de inscripciones:', error?.message)
    return { cantidad: 0, valorTotal: 0 }
  }
}

/**
 * Marcar inscripción como PAGADA
 * - Actualiza estado
 * - Registra ingreso en caja
 */
export async function pagarInscripcion(inscripcionId: string): Promise<void> {
  const hoy = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('inscripciones')
    .update({
      estado: 'PAGADA',
      fecha_pago: hoy
    })
    .eq('id', inscripcionId)
    .select()
    .single()

  if (error) throw error

  // REGLA: Verificar que el socio esté activo antes de registrar pago
  const { data: socio } = await supabase
    .from('asociados')
    .select('activo')
    .eq('id', data.socio_id)
    .single()

  if (!socio) {
    throw new Error('Socio no encontrado')
  }

  if (socio.activo === false) {
    throw new Error('No se puede registrar el pago: el socio está inactivo')
  }

  const saldoAnterior = await obtenerUltimoSaldo()
const nuevoSaldo = saldoAnterior + data.valor

await crearMovimientoCaja({
  tipo: 'INGRESO',
  concepto: `Pago inscripción socio ID ${data.socio_id}`,
  monto: data.valor,
  fecha: hoy,
  saldo_anterior: saldoAnterior,
  nuevo_saldo: nuevoSaldo,
  referencia_id: data.id
})

}

/**
 * Actualizar fecha de pago de inscripción (sin tocar caja)
 * - Solo actualiza fecha_pago
 * - NO cambia estado
 * - NO toca caja
 */
export async function actualizarFechaPagoInscripcion(inscripcionId: string, fechaPago: string): Promise<void> {
  const { error } = await supabase
    .from('inscripciones')
    .update({ fecha_pago: fechaPago })
    .eq('id', inscripcionId)

  if (error) throw error
}

/**
 * Actualizar inscripción completa (valor, estado, fecha_pago) y manejar caja
 * - Actualiza la inscripción en la tabla inscripciones
 * - Si cambia el valor, actualiza el movimiento de caja usando referencia_id
 * - Si el valor es 0 o estado pasa a PENDIENTE, elimina el movimiento de caja
 * - NO crea nuevos movimientos, solo actualiza o elimina el existente
 */
export async function actualizarInscripcionCompleta(
  inscripcionId: string,
  valor: number,
  estado: EstadoInscripcion,
  fechaPago: string | null,
  nombreSocio?: string
): Promise<void> {
  // 1. Obtener la inscripción actual
  const { data: inscripcionActual, error: errorInscripcion } = await supabase
    .from('inscripciones')
    .select('valor, estado, socio_id')
    .eq('id', inscripcionId)
    .single()

  if (errorInscripcion) throw errorInscripcion
  if (!inscripcionActual) throw new Error('Inscripción no encontrada')

  const valorAnterior = inscripcionActual.valor || 0
  const estadoAnterior = inscripcionActual.estado
  const socioId = inscripcionActual.socio_id

  // 2. Buscar el movimiento de caja existente usando referencia_id (UUID puro)
  const { data: movimientoCaja, error: errorMovimiento } = await supabase
    .from('caja_central')
    .select('id, monto')
    .eq('referencia_id', inscripcionId)
    .maybeSingle()

  // Si referencia_id no existe, ignorar el error (puede que la columna no exista)
  const movimientoExiste = movimientoCaja && !errorMovimiento

  // 3. Determinar si debemos eliminar, actualizar o crear movimiento
  const debeEliminarMovimiento = valor === 0 || estado === 'PENDIENTE'
  const valorCambio = valor !== valorAnterior
  const estadoCambio = estado !== estadoAnterior

  // 4. Si debe eliminarse el movimiento (valor 0 o estado PENDIENTE)
  if (debeEliminarMovimiento && movimientoExiste && movimientoCaja?.id) {
    try {
      await eliminarMovimientoCaja(movimientoCaja.id)
      console.log('✅ Movimiento de caja eliminado (inscripción pasó a PENDIENTE o valor 0)')
    } catch (error: any) {
      console.warn('Advertencia: No se pudo eliminar movimiento de caja:', error?.message)
    }
  }
  // 5. Si el valor cambió y NO debe eliminarse, actualizar el movimiento
  else if (valorCambio && movimientoExiste && movimientoCaja?.id && !debeEliminarMovimiento) {
    try {
      // Obtener el saldo anterior del movimiento
      const { data: movCompleto } = await supabase
        .from('caja_central')
        .select('saldo_anterior, monto')
        .eq('id', movimientoCaja.id)
        .single()

      if (movCompleto) {
        const diferenciaValor = valor - (movCompleto.monto || 0)
        const saldoAnteriorMov = movCompleto.saldo_anterior || 0
        const nuevoSaldoMov = saldoAnteriorMov + diferenciaValor

        await actualizarMovimientoCaja(movimientoCaja.id, {
          monto: valor,
          nuevo_saldo: nuevoSaldoMov,
          concepto: nombreSocio 
            ? `Inscripción - ${nombreSocio} (${socioId})`
            : `Inscripción socio ID ${socioId}`
        })
        console.log('✅ Movimiento de caja actualizado')
      }
    } catch (error: any) {
      console.warn('Advertencia: No se pudo actualizar movimiento de caja:', error?.message)
    }
  }

  // 6. Actualizar la inscripción
  const { error: errorUpdate } = await supabase
    .from('inscripciones')
    .update({
      valor,
      estado,
      fecha_pago: fechaPago
    })
    .eq('id', inscripcionId)

  if (errorUpdate) throw errorUpdate
}

/**
 * Eliminar inscripción
 * - Elimina movimiento de caja si estaba pagada (usando referencia)
 * - Elimina el registro de inscripción
 */
export async function eliminarInscripcion(inscripcionId: string): Promise<void> {
  // Obtener la inscripción para verificar si estaba pagada
  const { data: inscripcion, error: errorInscripcion } = await supabase
    .from('inscripciones')
    .select('estado')
    .eq('id', inscripcionId)
    .single()

  if (errorInscripcion) throw errorInscripcion

  // Si estaba pagada, eliminar movimiento de caja usando referencia
  if (inscripcion?.estado === 'PAGADA') {
    try {
      // Eliminar movimientos de caja con referencia a esta inscripción (UUID puro)
      const { error: errorCaja } = await supabase
        .from('caja_central')
        .delete()
        .eq('referencia_id', inscripcionId)
      
      // Si referencia_id no existe en la tabla, ignorar el error
      if (errorCaja && !errorCaja.message?.includes('column') && !errorCaja.code?.includes('42703')) {
        console.warn('Advertencia: No se pudo eliminar movimiento de caja:', errorCaja.message)
      }
    } catch (error: any) {
      // Si la columna referencia_id no existe, continuar sin error
      console.warn('Advertencia: Error eliminando movimiento de caja (continuando):', error?.message)
    }
  }

  // Eliminar la inscripción
  const { error } = await supabase
    .from('inscripciones')
    .delete()
    .eq('id', inscripcionId)

  if (error) throw error
}
