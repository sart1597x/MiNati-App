import { supabase } from './supabase'
import { getSocios } from './socios'
import { Socio } from './supabase'

export interface Actividad {
  id?: number
  nombre: string
  valor?: number  // Costo de inversión (antes costo_inversion)
  descripcion?: string
  ganancia_total: number
  utilidad_neta: number
  fecha?: string
  created_at?: string
  updated_at?: string
}

export interface ParticipacionActividad {
  id?: number
  actividad_id: number
  asociado_id: number
  nombre_asociado: string
  cantidad_caritas: number
  valor_carita: number
  valor_total: number
  created_at?: string
}

// Obtener todas las actividades
export async function obtenerActividades(): Promise<Actividad[]> {
  try {
    // Seleccionar solo las columnas que existen en la tabla
    const { data, error } = await supabase
      .from('actividades')
      .select('id, nombre, valor, descripcion, ganancia_total, utilidad_neta, fecha, created_at, updated_at')
      .order('fecha', { ascending: false })
    
    if (error) {
      // Si fecha no existe, intentar ordenar por created_at
      if (error.message?.includes('fecha') || error.code === '42703') {
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
    // Si hay error, intentar con columnas mínimas
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
export async function obtenerActividadPorId(actividadId: number | string): Promise<Actividad | null> {
  const idNum = typeof actividadId === 'string' ? parseInt(actividadId) : actividadId
  
  const { data, error } = await supabase
    .from('actividades')
    .select('*')
    .eq('id', idNum)
    .single()
  
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  
  return data
}

// Crear una actividad
export async function crearActividad(actividad: Omit<Actividad, 'id' | 'created_at' | 'updated_at' | 'utilidad_neta'>): Promise<Actividad> {
  // Calcular utilidad neta: ganancia_total - valor (costo de inversión)
  const valorInversion = actividad.valor || 0
  const utilidadNeta = actividad.ganancia_total - valorInversion
  
  // Preparar datos para insertar con las columnas correctas
  const datosInsertar: any = {
    nombre: actividad.nombre,
    valor: valorInversion,
    ganancia_total: actividad.ganancia_total,
    utilidad_neta: utilidadNeta
  }
  
  // Incluir descripcion si existe
  if (actividad.descripcion) {
    datosInsertar.descripcion = actividad.descripcion
  }
  
  // Incluir fecha si existe
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
  
  return data
}

// Actualizar una actividad
export async function actualizarActividad(
  actividadId: number | string,
  cambios: Partial<Actividad>
): Promise<Actividad> {
  const idNum = typeof actividadId === 'string' ? parseInt(actividadId) : actividadId
  
  // Recalcular utilidad neta si cambian ganancia o valor (costo de inversión)
  if (cambios.ganancia_total !== undefined || cambios.valor !== undefined) {
    const actividadActual = await obtenerActividadPorId(idNum)
    if (actividadActual) {
      const ganancia = cambios.ganancia_total !== undefined ? cambios.ganancia_total : actividadActual.ganancia_total
      const valor = cambios.valor !== undefined ? cambios.valor : (actividadActual.valor || 0)
      cambios.utilidad_neta = ganancia - valor
    }
  }
  
  const { data, error } = await supabase
    .from('actividades')
    .update({ ...cambios, updated_at: new Date().toISOString() })
    .eq('id', idNum)
    .select()
    .single()
  
  if (error) {
    throw new Error(`Error al actualizar actividad: ${error.message}`)
  }
  return data
}

// Obtener participaciones de una actividad
export async function obtenerParticipacionesActividad(actividadId: number | string): Promise<ParticipacionActividad[]> {
  const idNum = typeof actividadId === 'string' ? parseInt(actividadId) : actividadId
  
  const { data, error } = await supabase
    .from('participaciones_actividades')
    .select('*')
    .eq('actividad_id', idNum)
    .order('nombre_asociado', { ascending: true })
  
  if (error) throw error
  return data || []
}

// Crear o actualizar participación
export async function guardarParticipacion(participacion: Omit<ParticipacionActividad, 'id' | 'created_at'>): Promise<ParticipacionActividad> {
  // Verificar si ya existe
  const { data: existente } = await supabase
    .from('participaciones_actividades')
    .select('*')
    .eq('actividad_id', participacion.actividad_id)
    .eq('asociado_id', participacion.asociado_id)
    .maybeSingle()
  
  if (existente) {
    // Actualizar
    const { data, error } = await supabase
      .from('participaciones_actividades')
      .update(participacion)
      .eq('id', existente.id)
      .select()
      .single()
    
    if (error) throw error
    return data
  } else {
    // Crear
    const { data, error } = await supabase
      .from('participaciones_actividades')
      .insert([participacion])
      .select()
      .single()
    
    if (error) throw error
    return data
  }
}

// Eliminar participación
export async function eliminarParticipacion(participacionId: number | string): Promise<void> {
  const idNum = typeof participacionId === 'string' ? parseInt(participacionId) : participacionId
  
  const { error } = await supabase
    .from('participaciones_actividades')
    .delete()
    .eq('id', idNum)
  
  if (error) throw error
}

// Eliminar una actividad
export async function eliminarActividad(actividadId: number | string): Promise<void> {
  const idNum = typeof actividadId === 'string' ? parseInt(actividadId) : actividadId
  
  // Las participaciones se eliminan automáticamente por CASCADE
  const { error } = await supabase
    .from('actividades')
    .delete()
    .eq('id', idNum)
  
  if (error) throw error
}

// Obtener total recaudado de actividades (utilidad neta)
export async function obtenerTotalUtilidadActividades(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('actividades')
      .select('utilidad_neta')
    
    if (error) {
      // Si la tabla no existe o la columna no existe, retornar 0
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

