import { supabase, Socio } from './supabase'
import { crearMovimientoCaja, obtenerUltimoSaldo } from './caja'
import { getPagosSocio } from './pagos'

// Obtener todos los socios
// REGLA: Mostrar todos los socios (los eliminados físicamente ya no existen)
export async function getSocios(): Promise<Socio[]> {
  const { data, error } = await supabase
    .from('asociados')
    .select('*')
    .order('nombre', { ascending: true })

  if (error) {
    console.error('Error fetching socios:', error)
    throw error
  }

  return data || []
}

// Crear un nuevo socio
export async function createSocio(socio: Omit<Socio, 'id' | 'created_at' | 'updated_at'>): Promise<Socio> {
  const { data, error } = await supabase
    .from('asociados')
    .insert([socio])
    .select()
    .single()

  if (error) {
    console.error('Error creating socio:', error)
    throw error
  }

  return data
}

// Actualizar un socio
// NOTA: asociados.id es SERIAL (INTEGER), pero Supabase acepta number o string en queries
export async function updateSocio(id: number | string, socio: Partial<Socio>): Promise<Socio> {
  const { data, error } = await supabase
    .from('asociados')
    .update({ ...socio, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating socio:', error)
    throw error
  }

  return data
}

// Eliminar un socio (ELIMINACIÓN FÍSICA COMPLETA EN CASCADA)
// REGLA: Elimina TODOS los registros relacionados antes de eliminar el socio
// Orden de eliminación:
// 1. Movimientos de caja relacionados (caja_central)
// 2. Pagos de cuotas (cuotas_pagos)
// 3. Moras e historial_moras
// 4. Inscripciones
// 5. Finalmente el registro en asociados
// NOTA: asociados.id es SERIAL (INTEGER), pero Supabase acepta number o string en queries
export async function deleteSocio(id: number | string): Promise<void> {
  const socioId = typeof id === 'string' ? parseInt(id) : id

  // 1. Obtener información del socio (cedula, nombre e id)
  const { data: socio, error: errorSocio } = await supabase
    .from('asociados')
    .select('id, cedula, nombre')
    .eq('id', socioId)
    .single()

  if (errorSocio || !socio) {
    throw new Error('Socio no encontrado')
  }

  const cedula = socio.cedula
  const nombre = socio.nombre

  // 1. Eliminar TODOS los movimientos de caja relacionados (caja_central)
  try {
    // Primero obtener las inscripciones para eliminar sus movimientos de caja por referencia_id
    const { data: inscripciones } = await supabase
      .from('inscripciones')
      .select('id')
      .eq('socio_id', socioId)

    if (inscripciones && inscripciones.length > 0) {
      // Eliminar movimientos de caja relacionados con estas inscripciones (usando UUID puro)
      for (const inscripcion of inscripciones) {
        try {
          await supabase
            .from('caja_central')
            .delete()
            .eq('referencia_id', inscripcion.id)
        } catch (error: any) {
          console.warn('Advertencia: No se pudo eliminar movimiento de caja de inscripción:', error?.message)
        }
      }
    }

    // Eliminar movimientos de caja que contengan el nombre, cédula o ID en el concepto
    const { data: todosMovimientos } = await supabase
      .from('caja_central')
      .select('id, concepto')
      .or(`concepto.ilike.%${nombre}%,concepto.ilike.%${cedula}%,concepto.ilike.%ID ${socioId}%,concepto.ilike.%(${socioId})%`)

    if (todosMovimientos && todosMovimientos.length > 0) {
      // Eliminar todos los movimientos encontrados
      const movimientosIds = todosMovimientos.map(m => m.id)
      for (const movId of movimientosIds) {
        try {
          await supabase
            .from('caja_central')
            .delete()
            .eq('id', movId)
        } catch (error: any) {
          console.warn('Advertencia: No se pudo eliminar movimiento de caja:', error?.message)
        }
      }
    }
  } catch (error: any) {
    console.warn('Advertencia: Error eliminando movimientos de caja:', error?.message)
  }

  // 2. Eliminar pagos de cuotas (cuotas_pagos)
  try {
    await supabase
      .from('cuotas_pagos')
      .delete()
      .eq('cedula', cedula)
  } catch (error: any) {
    console.warn('Advertencia: Error eliminando cuotas_pagos:', error?.message)
  }

  // 3. Eliminar moras e historial_moras
  try {
    // Obtener todas las moras del socio
    const { data: moras } = await supabase
      .from('moras')
      .select('id')
      .eq('asociado_id', socioId)

    if (moras && moras.length > 0) {
      const moraIds = moras.map(m => m.id)

      // Eliminar historial_moras relacionado
      await supabase
        .from('historial_moras')
        .delete()
        .in('mora_id', moraIds)

      // Eliminar moras
      await supabase
        .from('moras')
        .delete()
        .eq('asociado_id', socioId)
    }
  } catch (error: any) {
    console.warn('Advertencia: Error eliminando moras:', error?.message)
  }

  // 4. Eliminar inscripciones
  try {
    await supabase
      .from('inscripciones')
      .delete()
      .eq('socio_id', socioId)
  } catch (error: any) {
    console.warn('Advertencia: Error eliminando inscripciones:', error?.message)
  }

  // 5. Finalmente eliminar el socio (asociados)
  const { error: errorDelete } = await supabase
    .from('asociados')
    .delete()
    .eq('id', socioId)

  if (errorDelete) {
    console.error('Error eliminando socio:', errorDelete)
    throw errorDelete
  }
}

// Retirar un socio (calcula total y crea EGRESO en caja)
// REGLA: NO eliminar registros, solo marcar como estado='RETIRADO' y activo=false
// Calcula: cuotas pagadas + inscripción (si pagada) = EGRESO en caja
export async function retirarSocio(id: number | string): Promise<void> {
  // Normalizar y validar el ID
  const socioId = typeof id === 'string' ? parseInt(id, 10) : id
  if (isNaN(socioId) || socioId <= 0) {
    throw new Error('ID de socio inválido')
  }

  // 1. Obtener información del socio
  const { data: socio, error: errorSocio } = await supabase
    .from('asociados')
    .select('id, nombre, cedula, estado')
    .eq('id', socioId)
    .single()

  if (errorSocio || !socio) {
    throw new Error('Socio no encontrado')
  }

  // Verificar que no esté ya retirado
  if (socio.estado === 'RETIRADO') {
    throw new Error('El socio ya está retirado')
  }

  // 2. Calcular total de cuotas pagadas
  let totalCuotas = 0
  try {
    const pagos = await getPagosSocio(socio.cedula)
    totalCuotas = pagos
      .filter(p => p.pagado === true)
      .reduce((sum, p) => sum + (parseFloat(String(p.monto_cuota || 0)) || 0), 0)
  } catch (error) {
    console.warn('Error obteniendo pagos del socio (continuando):', error)
  }

  // 3. Calcular valor de inscripción (si fue pagada)
  // Consulta directa en lugar de obtenerInscripciones()
  let valorInscripcion = 0
  try {
    const { data: inscripcionesPagadas, error: errorInscripciones } = await supabase
      .from('inscripciones')
      .select('valor')
      .eq('socio_id', socioId)
      .eq('estado', 'PAGADA')

    if (!errorInscripciones && inscripcionesPagadas && inscripcionesPagadas.length > 0) {
      // Si hay múltiples inscripciones pagadas, tomar la primera
      valorInscripcion = inscripcionesPagadas[0].valor || 0
    }
  } catch (error) {
    console.warn('Error obteniendo inscripción del socio (continuando):', error)
  }

  // 4. Calcular total a devolver
  const totalDevolver = totalCuotas + valorInscripcion

  // 5. Crear EGRESO en caja_central
  if (totalDevolver > 0) {
    try {
      const saldoAnterior = await obtenerUltimoSaldo()
      const nuevoSaldo = saldoAnterior - totalDevolver
      const hoy = new Date().toISOString().split('T')[0]

      await crearMovimientoCaja({
        tipo: 'EGRESO',
        concepto: `Retiro socio - ${socio.nombre} (ID ${socioId})`,
        monto: totalDevolver,
        fecha: hoy,
        saldo_anterior: saldoAnterior,
        nuevo_saldo: nuevoSaldo
      })

      console.log(`✅ EGRESO de retiro registrado en caja_central: $${totalDevolver.toLocaleString()}`)
    } catch (error: any) {
      console.error('Error registrando EGRESO en caja_central:', error)
      throw new Error('Error al registrar el retiro en caja: ' + (error?.message || 'Error desconocido'))
    }
  }

  // 6. Marcar inscripciones como RETIRADA
  try {
    const { error: errorInscripciones } = await supabase
      .from('inscripciones')
      .update({ estado: 'RETIRADA' })
      .eq('socio_id', socioId)

    if (errorInscripciones) {
      console.warn('Advertencia: Error marcando inscripciones como RETIRADA:', errorInscripciones)
    }
  } catch (error: any) {
    console.warn('Advertencia: Error marcando inscripciones como RETIRADA (continuando):', error?.message)
  }

  // 7. Marcar socio como RETIRADO
  const { error: errorUpdate } = await supabase
    .from('asociados')
    .update({ 
      estado: 'RETIRADO', 
      activo: false, 
      updated_at: new Date().toISOString() 
    })
    .eq('id', socioId)

  if (errorUpdate) {
    console.error('Error actualizando estado del socio:', errorUpdate)
    throw new Error('Error al marcar el socio como retirado: ' + (errorUpdate.message || 'Error desconocido'))
  }

  console.log(`✅ Socio ${socio.nombre} (ID ${socioId}) marcado como RETIRADO`)
}

