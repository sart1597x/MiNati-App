import { supabase } from './supabase'
import { getSocios } from './socios'
import { crearMovimientoCaja, obtenerUltimoSaldo } from './caja'

export interface Actividad {
  id?: number
  nombre: string
  valor?: number  // Valor que pagará cada asociado por carita
  cantidad?: number  // Número de caritas por defecto para cada asociado
  descripcion?: string
  ganancia_total: number  // Premio (valor que la actividad entregará como premio)
  utilidad_neta: number  // Utilidad = (total_pagado de todas las caritas) − premio
  fecha?: string
  created_at?: string
  updated_at?: string
}

// Interface para caritas de actividades (tabla actividades_caritas)
export interface CaritaActividad {
  id?: number
  actividad_id: number
  socio_id: number
  carita_numero: number
  estado: 'PENDIENTE' | 'PAGADO'
  created_at?: string
}

// Interface para pagos de actividades (tabla actividades_pagos)
export interface PagoActividad {
  id?: number
  actividad_id: number
  socio_id: number
  carita_numero: number
  monto: number
  fecha_pago: string
  created_at?: string
}

// ============================================
// VALIDACIÓN DE EXISTENCIA DE TABLAS
// ============================================
async function verificarTablasExisten(): Promise<{ caritas: boolean, pagos: boolean }> {
  try {
    // Verificar actividades_caritas
    const { error: errorCaritas } = await supabase
      .from('actividades_caritas')
      .select('id')
      .limit(1)
    
    const caritasExiste = !errorCaritas || (errorCaritas.code !== '42P01' && !errorCaritas.message?.includes('does not exist'))
    
    // Verificar actividades_pagos
    const { error: errorPagos } = await supabase
      .from('actividades_pagos')
      .select('id')
      .limit(1)
    
    const pagosExiste = !errorPagos || (errorPagos.code !== '42P01' && !errorPagos.message?.includes('does not exist'))
    
    return { caritas: caritasExiste, pagos: pagosExiste }
  } catch {
    return { caritas: false, pagos: false }
  }
}

function lanzarErrorTablasNoExisten(): never {
  throw new Error('Las tablas de actividades no existen en la base de datos. Por favor, ejecuta el script SQL: supabase-actividades-tablas.sql')
}

// ============================================
// FUNCIONES DE OBTENCIÓN
// ============================================

// Obtener todas las actividades
export async function obtenerActividades(): Promise<Actividad[]> {
  try {
    const { data, error } = await supabase
      .from('actividades')
      .select('id, nombre, valor, cantidad, descripcion, ganancia_total, utilidad_neta, fecha, created_at, updated_at')
      .order('fecha', { ascending: false })
    
    if (error) {
      if (error.message?.includes('fecha') || error.message?.includes('cantidad') || error.code === '42703') {
        const { data: dataRetry, error: errorRetry } = await supabase
          .from('actividades')
          .select('id, nombre, valor, descripcion, ganancia_total, utilidad_neta, created_at, updated_at')
          .order('created_at', { ascending: false })
        
        if (errorRetry) {
          console.error('Error obteniendo actividades:', errorRetry)
          return []
        }
        return dataRetry || []
      }
      throw error
    }
    return data || []
  } catch (error: any) {
    console.error('Error obteniendo actividades:', error)
    if (error?.code === '42703' || error?.message?.includes('does not exist')) {
      try {
        const { data, error: errorFinal } = await supabase
          .from('actividades')
          .select('id, nombre, valor, descripcion, ganancia_total, utilidad_neta, created_at, updated_at')
          .order('created_at', { ascending: false })
        
        if (errorFinal) {
          console.error('Error final obteniendo actividades:', errorFinal)
          return []
        }
        return data || []
      } catch (finalError) {
        console.error('Error final en catch:', finalError)
        return []
      }
    }
    throw error
  }
}

// Obtener una actividad por ID
export async function obtenerActividadPorId(actividadId: number): Promise<Actividad | null> {
  const { data, error } = await supabase
    .from('actividades')
    .select('*')
    .eq('id', actividadId)
    .single()
  
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  
  return data
}

// Obtener todas las caritas de una actividad (desde actividades_caritas)
export async function obtenerCaritasActividad(actividadId: number): Promise<CaritaActividad[]> {
  const tablas = await verificarTablasExisten()
  if (!tablas.caritas) {
    lanzarErrorTablasNoExisten()
  }

  try {
    const { data, error } = await supabase
      .from('actividades_caritas')
      .select('*')
      .eq('actividad_id', actividadId)
      .order('socio_id', { ascending: true })
      .order('carita_numero', { ascending: true })

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        lanzarErrorTablasNoExisten()
      }
      throw error
    }
    return data || []
  } catch (error: any) {
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      lanzarErrorTablasNoExisten()
    }
    throw error
  }
}

// Obtener caritas de un socio específico en una actividad
export async function obtenerCaritasSocioActividad(actividadId: number, socioId: number): Promise<CaritaActividad[]> {
  const tablas = await verificarTablasExisten()
  if (!tablas.caritas) {
    lanzarErrorTablasNoExisten()
  }

  try {
    const { data, error } = await supabase
      .from('actividades_caritas')
      .select('*')
      .eq('actividad_id', actividadId)
      .eq('socio_id', socioId)
      .order('carita_numero', { ascending: true })

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        lanzarErrorTablasNoExisten()
      }
      throw error
    }
    return data || []
  } catch (error: any) {
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      lanzarErrorTablasNoExisten()
    }
    throw error
  }
}

// Obtener todos los pagos de una actividad (desde actividades_pagos)
export async function obtenerPagosActividad(actividadId: number): Promise<PagoActividad[]> {
  const tablas = await verificarTablasExisten()
  if (!tablas.pagos) {
    lanzarErrorTablasNoExisten()
  }

  try {
    const { data, error } = await supabase
      .from('actividades_pagos')
      .select('*')
      .eq('actividad_id', actividadId)
      .order('socio_id', { ascending: true })
      .order('carita_numero', { ascending: true })

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        lanzarErrorTablasNoExisten()
      }
      throw error
    }
    return data || []
  } catch (error: any) {
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      lanzarErrorTablasNoExisten()
    }
    throw error
  }
}

// Obtener un pago específico (una carita)
export async function obtenerPagoActividad(
  actividadId: number,
  socioId: number,
  caritaNumero: number
): Promise<PagoActividad | null> {
  const tablas = await verificarTablasExisten()
  if (!tablas.pagos) {
    lanzarErrorTablasNoExisten()
  }

  try {
    const { data, error } = await supabase
      .from('actividades_pagos')
      .select('*')
      .eq('actividad_id', actividadId)
      .eq('socio_id', socioId)
      .eq('carita_numero', caritaNumero)
      .maybeSingle()

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        lanzarErrorTablasNoExisten()
      }
      throw error
    }
    return data || null
  } catch (error: any) {
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      lanzarErrorTablasNoExisten()
    }
    throw error
  }
}

// ============================================
// FUNCIONES DE CREACIÓN
// ============================================

// Generar caritas automáticamente al crear una actividad (en actividades_caritas)
export async function generarCaritasActividad(actividadId: number, cantidadPorSocio: number): Promise<void> {
  const tablas = await verificarTablasExisten()
  if (!tablas.caritas) {
    lanzarErrorTablasNoExisten()
  }

  try {
    // Obtener todos los socios activos
    const socios = await getSocios()
    const sociosActivos = socios.filter(s => s.activo !== false)

    // Generar caritas para cada socio activo
    const caritasParaInsertar: any[] = []
    
    for (const socio of sociosActivos) {
      const socioId = typeof socio.id === 'string' ? parseInt(socio.id) : socio.id
      if (!socioId) continue

      // Crear una carita por cada número desde 1 hasta cantidadPorSocio
      for (let caritaNumero = 1; caritaNumero <= cantidadPorSocio; caritaNumero++) {
        caritasParaInsertar.push({
          actividad_id: actividadId,
          socio_id: socioId,
          carita_numero: caritaNumero,
          estado: 'PENDIENTE'
        })
      }
    }

    // Insertar todas las caritas en lote en actividades_caritas
    if (caritasParaInsertar.length > 0) {
      const { error } = await supabase
        .from('actividades_caritas')
        .insert(caritasParaInsertar)

      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          lanzarErrorTablasNoExisten()
        }
        throw error
      }
    }
  } catch (error: any) {
    console.error('Error generando caritas:', error)
    throw error
  }
}

// Crear una actividad y generar caritas automáticamente
export async function crearActividad(actividad: Omit<Actividad, 'id' | 'created_at' | 'updated_at' | 'utilidad_neta'>): Promise<Actividad> {
  const cantidadPorSocio = actividad.cantidad || 1
  const utilidadNeta = 0 // Se calculará después con el recaudo real
  
  // Preparar datos para insertar
  const datosInsertar: any = {
    nombre: actividad.nombre,
    valor: actividad.valor || 0,
    ganancia_total: actividad.ganancia_total, // Premio
    utilidad_neta: utilidadNeta
  }
  
  if (actividad.cantidad !== undefined) {
    datosInsertar.cantidad = actividad.cantidad
  }
  
  if (actividad.descripcion) {
    datosInsertar.descripcion = actividad.descripcion
  }
  
  if (actividad.fecha) {
    datosInsertar.fecha = actividad.fecha
  }
  
  const { data, error } = await supabase
    .from('actividades')
    .insert([datosInsertar])
    .select()
    .single()
  
  if (error) {
    throw new Error(`Error al crear actividad: ${error.message}`)
  }

  // Generar caritas automáticamente para todos los socios activos
  if (data && data.id) {
    await generarCaritasActividad(data.id, cantidadPorSocio)
  }
  
  return data
}

// ============================================
// FUNCIONES DE PAGOS
// ============================================

// Registrar pago de una carita (insertar en actividades_pagos y actualizar estado en actividades_caritas)
export async function registrarPagoActividad(
  actividadId: number,
  socioId: number,
  caritaNumero: number,
  fechaPago: Date,
  fechaPagoString?: string
): Promise<PagoActividad> {
  const tablas = await verificarTablasExisten()
  if (!tablas.caritas || !tablas.pagos) {
    lanzarErrorTablasNoExisten()
  }

  // Obtener información del asociado y verificar que esté activo
  const { data: asociado } = await supabase
    .from('asociados')
    .select('id, nombre, activo')
    .eq('id', socioId)
    .single()

  if (!asociado) {
    throw new Error('Asociado no encontrado')
  }

  if (asociado.activo === false) {
    throw new Error('No se puede registrar el pago: el socio está inactivo')
  }

  // Obtener la actividad
  const actividad = await obtenerActividadPorId(actividadId)
  if (!actividad) {
    throw new Error('Actividad no encontrada')
  }

  // Preparar fecha en formato YYYY-MM-DD
  let fechaTexto: string
  if (fechaPagoString) {
    fechaTexto = fechaPagoString
  } else {
    const año = fechaPago.getFullYear()
    const mes = String(fechaPago.getMonth() + 1).padStart(2, '0')
    const dia = String(fechaPago.getDate()).padStart(2, '0')
    fechaTexto = `${año}-${mes}-${dia}`
  }

  const valorCarita = actividad.valor || 0

  // Verificar si ya existe el pago
  const pagoExistente = await obtenerPagoActividad(actividadId, socioId, caritaNumero)

  if (pagoExistente) {
    // Si ya existe, actualizar fecha
    const { data, error } = await supabase
      .from('actividades_pagos')
      .update({
        fecha_pago: fechaTexto
      })
      .eq('id', pagoExistente.id)
      .select()
      .single()
    
    if (error) throw error

    // Asegurar que la carita esté marcada como PAGADO
    await supabase
      .from('actividades_caritas')
      .update({ estado: 'PAGADO' })
      .eq('actividad_id', actividadId)
      .eq('socio_id', socioId)
      .eq('carita_numero', caritaNumero)

    // Recalcular utilidad
    await recalcularUtilidadActividad(actividadId)

    return data
  }

  // Si no existe, crear el registro de pago en actividades_pagos
  const { data, error } = await supabase
    .from('actividades_pagos')
    .insert([{
      actividad_id: actividadId,
      socio_id: socioId,
      carita_numero: caritaNumero,
      monto: valorCarita,
      fecha_pago: fechaTexto
    }])
    .select()
    .single()
  
  if (error) throw error

  // Actualizar estado de la carita a PAGADO en actividades_caritas
  await supabase
    .from('actividades_caritas')
    .update({ estado: 'PAGADO' })
    .eq('actividad_id', actividadId)
    .eq('socio_id', socioId)
    .eq('carita_numero', caritaNumero)

  // Registrar ingreso en caja_central
  if (valorCarita > 0) {
    try {
      const saldoAnterior = await obtenerUltimoSaldo()
      const nuevoSaldo = saldoAnterior + valorCarita

      await crearMovimientoCaja({
        tipo: 'INGRESO',
        concepto: `Pago Actividad - ${actividad.nombre} - ${asociado.nombre} (Carita ${caritaNumero})`,
        monto: valorCarita,
        fecha: fechaTexto,
        saldo_anterior: saldoAnterior,
        nuevo_saldo: nuevoSaldo
      })
    } catch (errorCaja: any) {
      console.error('Error registrando pago en caja:', errorCaja)
    }
  }

  // Recalcular utilidad de la actividad
  await recalcularUtilidadActividad(actividadId)

  return data
}

// Actualizar fecha de pago de una carita
export async function actualizarPagoActividad(
  actividadId: number,
  socioId: number,
  caritaNumero: number,
  fechaPago: Date,
  fechaPagoString?: string
): Promise<PagoActividad> {
  const tablas = await verificarTablasExisten()
  if (!tablas.pagos) {
    lanzarErrorTablasNoExisten()
  }

  // Preparar fecha en formato YYYY-MM-DD
  let fechaTexto: string
  if (fechaPagoString) {
    fechaTexto = fechaPagoString
  } else {
    const año = fechaPago.getFullYear()
    const mes = String(fechaPago.getMonth() + 1).padStart(2, '0')
    const dia = String(fechaPago.getDate()).padStart(2, '0')
    fechaTexto = `${año}-${mes}-${dia}`
  }

  const pagoExistente = await obtenerPagoActividad(actividadId, socioId, caritaNumero)
  if (!pagoExistente) {
    throw new Error('Pago no encontrado')
  }

  const { data, error } = await supabase
    .from('actividades_pagos')
    .update({
      fecha_pago: fechaTexto
    })
    .eq('id', pagoExistente.id)
    .select()
    .single()

  if (error) throw error

  return data
}

// Eliminar pago de una carita (eliminar de actividades_pagos y marcar como PENDIENTE en actividades_caritas)
export async function eliminarPagoActividad(
  actividadId: number,
  socioId: number,
  caritaNumero: number
): Promise<void> {
  const tablas = await verificarTablasExisten()
  if (!tablas.caritas || !tablas.pagos) {
    lanzarErrorTablasNoExisten()
  }

  // Obtener información antes de eliminar
  const pagoExistente = await obtenerPagoActividad(actividadId, socioId, caritaNumero)
  if (!pagoExistente) {
    throw new Error('Pago no encontrado')
  }

  const actividad = await obtenerActividadPorId(actividadId)
  const { data: asociado } = await supabase
    .from('asociados')
    .select('nombre')
    .eq('id', socioId)
    .single()

  const nombreAsociado = asociado?.nombre || 'Sin nombre'
  const montoARevertir = pagoExistente.monto

  // Eliminar el pago de actividades_pagos
  const { error: errorEliminar } = await supabase
    .from('actividades_pagos')
    .delete()
    .eq('id', pagoExistente.id)

  if (errorEliminar) throw errorEliminar

  // Marcar carita como PENDIENTE en actividades_caritas
  await supabase
    .from('actividades_caritas')
    .update({ estado: 'PENDIENTE' })
    .eq('actividad_id', actividadId)
    .eq('socio_id', socioId)
    .eq('carita_numero', caritaNumero)

  // Revertir en caja
  if (montoARevertir > 0) {
    try {
      const saldoAnterior = await obtenerUltimoSaldo()
      const nuevoSaldo = saldoAnterior - montoARevertir

      await crearMovimientoCaja({
        tipo: 'EGRESO',
        concepto: `REVERSO - Eliminación Pago Actividad - ${actividad?.nombre || 'Sin nombre'} - ${nombreAsociado} (Carita ${caritaNumero})`,
        monto: montoARevertir,
        fecha: new Date().toISOString().split('T')[0],
        saldo_anterior: saldoAnterior,
        nuevo_saldo: nuevoSaldo
      })
    } catch (errorCaja: any) {
      console.error('Error revirtiendo pago en caja:', errorCaja)
    }
  }

  // Recalcular utilidad
  await recalcularUtilidadActividad(actividadId)
}

// Agregar una nueva carita a un socio (en actividades_caritas)
export async function agregarCaritaActividad(actividadId: number, socioId: number): Promise<CaritaActividad> {
  const tablas = await verificarTablasExisten()
  if (!tablas.caritas) {
    lanzarErrorTablasNoExisten()
  }

  // Obtener el número de carita más alto para este socio en esta actividad
  const caritasExistentes = await obtenerCaritasSocioActividad(actividadId, socioId)
  const siguienteNumero = caritasExistentes.length > 0 
    ? Math.max(...caritasExistentes.map(c => c.carita_numero)) + 1
    : 1

  // Crear nueva carita en actividades_caritas
  const { data, error } = await supabase
    .from('actividades_caritas')
    .insert([{
      actividad_id: actividadId,
      socio_id: socioId,
      carita_numero: siguienteNumero,
      estado: 'PENDIENTE'
    }])
    .select()
    .single()
  
  if (error) throw error

  return data
}

// ============================================
// FUNCIONES DE CÁLCULO
// ============================================

// Recalcular utilidad de una actividad
export async function recalcularUtilidadActividad(actividadId: number): Promise<void> {
  const actividad = await obtenerActividadPorId(actividadId)
  if (!actividad) return

  // Obtener todos los pagos de esta actividad (desde actividades_pagos)
  const pagos = await obtenerPagosActividad(actividadId)
  
  // Calcular total recaudado (suma de monto de todos los pagos)
  const totalRecaudado = pagos.reduce((sum, p) => sum + (p.monto || 0), 0)

  const premio = actividad.ganancia_total || 0
  const utilidadNeta = totalRecaudado - premio

  // Actualizar utilidad
  await actualizarActividad(actividadId, { utilidad_neta: utilidadNeta })
}

// ============================================
// FUNCIONES DE ACTUALIZACIÓN Y ELIMINACIÓN
// ============================================

// Actualizar una actividad
export async function actualizarActividad(
  actividadId: number,
  cambios: Partial<Actividad>
): Promise<Actividad> {
  const { data, error } = await supabase
    .from('actividades')
    .update({ ...cambios, updated_at: new Date().toISOString() })
    .eq('id', actividadId)
    .select()
    .single()
  
  if (error) {
    throw new Error(`Error al actualizar actividad: ${error.message}`)
  }
  return data
}

// Eliminar una actividad y todas sus caritas
export async function eliminarActividad(actividadId: number): Promise<void> {
  // Las caritas y pagos se eliminan automáticamente por CASCADE
  // Eliminar la actividad
  const { error } = await supabase
    .from('actividades')
    .delete()
    .eq('id', actividadId)
  
  if (error) throw error
}

// Obtener total recaudado de actividades (utilidad neta)
export async function obtenerTotalUtilidadActividades(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('actividades')
      .select('utilidad_neta')
    
    if (error) {
      if (error.code === '42P01' || error.code === '42703' || error.message?.includes('does not exist')) {
        console.warn('Tabla actividades o columna utilidad_neta no existe')
        return 0
      }
      throw error
    }
    
    return (data || []).reduce((sum, a) => {
      const utilidad = parseFloat(String(a?.utilidad_neta || 0)) || 0
      return sum + (isNaN(utilidad) ? 0 : utilidad)
    }, 0)
  } catch (error: any) {
    console.error('Error obteniendo total utilidad actividades:', error)
    if (error?.code === '42P01' || error?.code === '42703' || error?.message?.includes('does not exist')) {
      return 0
    }
    throw error
  }
}
