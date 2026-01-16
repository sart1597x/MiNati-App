import { supabase } from './supabase'

export interface ConfiguracionNatillera {
  id?: number | string
  valor_inscripcion: number
  valor_cuota: number
  valor_dia_mora: number
  porcentaje_administracion: number
  anio_vigente: number
  es_activa: boolean
  created_at?: string
  updated_at?: string
}

// ======================================================
// CONFIGURACIÓN NACIONAL (configuracion_nacional)
// ======================================================
// REGLA: Usar siempre el registro con id = 1
export interface ConfiguracionNacional {
  id?: number | string
  anio_vigente: number
  valor_inscripcion: number
  valor_cuota: number
  valor_dia_mora: number
  porcentaje_administracion: number
  created_at?: string
  updated_at?: string
}

/**
 * Obtiene la configuración nacional (siempre id = 1)
 */
export async function obtenerConfiguracionNacional(): Promise<ConfiguracionNacional | null> {
  try {
    const { data, error } = await supabase
      .from('configuracion_natillera')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Error obteniendo configuración nacional:', error)
      return null
    }

    if (!data) return null

    return {
      id: data.id,
      anio_vigente: Number(data.anio_vigente),
      valor_inscripcion: Number(data.valor_inscripcion),
      valor_cuota: Number(data.valor_cuota),
      valor_dia_mora: Number(data.valor_dia_mora),
      porcentaje_administracion: Number(data.porcentaje_administracion),
      created_at: data.created_at,
      updated_at: data.updated_at
    }
  } catch (error) {
    console.error('Error crítico obteniendo configuración nacional:', error)
    return null
  }
}


/**
 * Actualiza la configuración nacional (siempre id = 1)
 * Si no existe, la crea con id = 1
 */
export async function actualizarConfiguracionNacional(
  config: Omit<ConfiguracionNacional, 'id' | 'created_at' | 'updated_at'>
): Promise<ConfiguracionNacional> {

  const datos = {
    anio_vigente: Number(config.anio_vigente),
    valor_inscripcion: Number(config.valor_inscripcion),
    valor_cuota: Number(config.valor_cuota),
    valor_dia_mora: Number(config.valor_dia_mora),
    porcentaje_administracion: Number(config.porcentaje_administracion)
  }

  // Validaciones básicas
  if (
    isNaN(datos.anio_vigente) ||
    isNaN(datos.valor_inscripcion) ||
    isNaN(datos.valor_cuota) ||
    isNaN(datos.valor_dia_mora) ||
    isNaN(datos.porcentaje_administracion)
  ) {
    throw new Error('Valores inválidos en configuración nacional')
  }

  const { data, error } = await supabase
    .from('configuracion_natillera')
    .insert([datos])
    .select()
    .single()

  if (error) {
    console.error('Error insertando configuración nacional:', error)
    throw error
  }

  return {
    id: data.id,
    anio_vigente: Number(data.anio_vigente),
    valor_inscripcion: Number(data.valor_inscripcion),
    valor_cuota: Number(data.valor_cuota),
    valor_dia_mora: Number(data.valor_dia_mora),
    porcentaje_administracion: Number(data.porcentaje_administracion),
    created_at: data.created_at,
    updated_at: data.updated_at
  }
}


/**
 * Obtiene la configuración activa de la natillera
 * Prioridad: 1) es_activa = true, 2) año actual
 */
export async function obtenerConfiguracionActiva(): Promise<ConfiguracionNatillera> {
  const añoActual = new Date().getFullYear()
  
  try {
    // Primero intentar obtener la configuración activa
    const { data: configActiva, error: errorActiva } = await supabase
      .from('configuracion_natillera')
      .select('*')
      .eq('es_activa', true)
      .maybeSingle()
    
    if (!errorActiva && configActiva) {
      return {
        ...configActiva,
        valor_inscripcion: Number(configActiva.valor_inscripcion || 10000),
        valor_cuota: Number(configActiva.valor_cuota || 30000),
        valor_dia_mora: Number(configActiva.valor_dia_mora || 3000),
        porcentaje_administracion: Number(configActiva.porcentaje_administracion || 8),
        anio_vigente: Number(configActiva.anio_vigente || añoActual),
        es_activa: Boolean(configActiva.es_activa || false)
      } as ConfiguracionNatillera
    }
    
    // Si no hay activa, buscar por año actual
    const { data: configAno, error: errorAno } = await supabase
      .from('configuracion_natillera')
      .select('*')
      .eq('anio_vigente', añoActual)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    if (!errorAno && configAno) {
      return {
        ...configAno,
        valor_inscripcion: Number(configAno.valor_inscripcion || 10000),
        valor_cuota: Number(configAno.valor_cuota || 30000),
        valor_dia_mora: Number(configAno.valor_dia_mora || 3000),
        porcentaje_administracion: Number(configAno.porcentaje_administracion || 8),
        anio_vigente: Number(configAno.anio_vigente || añoActual),
        es_activa: Boolean(configAno.es_activa || false)
      } as ConfiguracionNatillera
    }
  } catch (error) {
    console.warn('Error obteniendo configuración activa:', error)
  }
  
  // Si no hay configuración, retornar valores por defecto
  return {
    valor_inscripcion: 10000,
    valor_cuota: 30000,
    valor_dia_mora: 3000,
    porcentaje_administracion: 8,
    anio_vigente: añoActual,
    es_activa: true
  }
}

/**
 * Obtiene todas las configuraciones
 */
export async function obtenerTodasConfiguraciones(): Promise<ConfiguracionNatillera[]> {
  try {
    const { data, error } = await supabase
      .from('configuracion_natillera')
      .select('*')
      .order('anio_vigente', { ascending: false })
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error obteniendo configuraciones:', error)
      throw error
    }
    
    // Asegurar conversión numérica de todos los valores y preservar el ID
    return (data || []).map((config: any) => ({
      id: config.id, // Preservar el ID tal como viene (puede ser UUID string o número)
      valor_inscripcion: Number(config.valor_inscripcion || 0),
      valor_cuota: Number(config.valor_cuota || 0),
      valor_dia_mora: Number(config.valor_dia_mora || 0),
      porcentaje_administracion: Number(config.porcentaje_administracion || 0),
      anio_vigente: Number(config.anio_vigente || config.año || new Date().getFullYear()), // Soporte para ambos nombres
      es_activa: Boolean(config.es_activa || false),
      created_at: config.created_at,
      updated_at: config.updated_at
    })) as ConfiguracionNatillera[]
  } catch (error) {
    console.error('Error en obtenerTodasConfiguraciones:', error)
    return []
  }
}

/**
 * Crea una nueva configuración
 */
export async function crearConfiguracion(
  config: Omit<ConfiguracionNatillera, 'id' | 'created_at' | 'updated_at'>
): Promise<ConfiguracionNatillera> {
  // Conversión estricta de todos los valores
  const configNumerica = {
    anio_vigente: Number(config.anio_vigente || new Date().getFullYear()),
    valor_inscripcion: Number(config.valor_inscripcion),
    valor_cuota: Number(config.valor_cuota),
    valor_dia_mora: Number(config.valor_dia_mora),
    porcentaje_administracion: Number(config.porcentaje_administracion),
    es_activa: Boolean(config.es_activa)
  }
  
  // Si la nueva configuración es activa, desactivar todas las demás
  if (configNumerica.es_activa) {
    await supabase
      .from('configuracion_natillera')
      .update({ es_activa: false })
      .neq('anio_vigente', configNumerica.anio_vigente)
  }
  
  const { data, error } = await supabase
    .from('configuracion_natillera')
    .insert([configNumerica])
    .select()
    .single()
  
  if (error) {
    console.error('Error creando configuración:', error)
    throw error
  }
  
  return {
    ...data,
    valor_inscripcion: Number(data.valor_inscripcion),
    valor_cuota: Number(data.valor_cuota),
    valor_dia_mora: Number(data.valor_dia_mora),
    porcentaje_administracion: Number(data.porcentaje_administracion),
    anio_vigente: Number(data.anio_vigente),
    es_activa: Boolean(data.es_activa)
  } as ConfiguracionNatillera
}

/**
 * Upsert: Crea o actualiza una configuración según el año_vigente usando .upsert() de Supabase
 * Si ya existe una configuración para ese anio_vigente, la actualiza. Si no, crea una nueva.
 */
export async function upsertConfiguracionPorAno(
  config: Omit<ConfiguracionNatillera, 'id' | 'created_at' | 'updated_at'>
): Promise<ConfiguracionNatillera> {
  // Conversión estricta de todos los valores numéricos
  const anioVigente = Number(config.anio_vigente || new Date().getFullYear())
  
  if (isNaN(anioVigente) || anioVigente < 2020 || anioVigente > 2100) {
    throw new Error('El año vigente debe ser un número válido entre 2020 y 2100')
  }
  
  // IMPORTANTE: No incluir updated_at, created_at, o id en el objeto
  // Supabase maneja estos campos automáticamente
  const configNumerica = {
    anio_vigente: anioVigente,
    valor_inscripcion: Number(config.valor_inscripcion),
    valor_cuota: Number(config.valor_cuota),
    valor_dia_mora: Number(config.valor_dia_mora),
    porcentaje_administracion: Number(config.porcentaje_administracion),
    es_activa: Boolean(config.es_activa)
  }
  
  // Validar que todos los valores numéricos sean válidos
  if (isNaN(configNumerica.valor_inscripcion) || 
      isNaN(configNumerica.valor_cuota) || 
      isNaN(configNumerica.valor_dia_mora) || 
      isNaN(configNumerica.porcentaje_administracion)) {
    throw new Error('Todos los valores numéricos deben ser válidos')
  }
  
  // Si la configuración es activa, desactivar todas las demás primero
  if (configNumerica.es_activa) {
    const { error: errorDesactivar } = await supabase
      .from('configuracion_natillera')
      .update({ es_activa: false })
      .neq('anio_vigente', anioVigente)
    
    if (errorDesactivar) {
      console.warn('Advertencia al desactivar otras configuraciones:', errorDesactivar)
      // No lanzar error, continuar con el upsert
    }
  }
  
  // Usar upsert de Supabase con anio_vigente como clave única
  // Nota: Para que upsert funcione, anio_vigente debe ser una columna única en la BD
  const { data, error } = await supabase
    .from('configuracion_natillera')
    .upsert([configNumerica], {
      onConflict: 'anio_vigente', // Esto requiere que anio_vigente tenga una constraint UNIQUE
      ignoreDuplicates: false
    })
    .select()
    .single()
  
  if (error) {
    // Si el error es porque no existe la constraint, hacer insert/update manual
    if (error.code === '42704' || error.message?.includes('conflict')) {
      // Intentar buscar si existe
      const { data: existente } = await supabase
        .from('configuracion_natillera')
        .select('id')
        .eq('anio_vigente', anioVigente)
        .maybeSingle()
      
      if (existente) {
        // Actualizar
        const { data: updated, error: updateError } = await supabase
          .from('configuracion_natillera')
          .update(configNumerica)
          .eq('id', existente.id)
          .select()
          .single()
        
        if (updateError) {
          console.error('Error actualizando configuración:', updateError)
          throw updateError
        }
        
        return {
          ...updated,
          valor_inscripcion: Number(updated.valor_inscripcion),
          valor_cuota: Number(updated.valor_cuota),
          valor_dia_mora: Number(updated.valor_dia_mora),
          porcentaje_administracion: Number(updated.porcentaje_administracion),
          anio_vigente: Number(updated.anio_vigente),
          es_activa: Boolean(updated.es_activa)
        } as ConfiguracionNatillera
      } else {
        // Insertar
        const { data: inserted, error: insertError } = await supabase
          .from('configuracion_natillera')
          .insert([configNumerica])
          .select()
          .single()
        
        if (insertError) {
          console.error('Error insertando configuración:', insertError)
          throw insertError
        }
        
        return {
          ...inserted,
          valor_inscripcion: Number(inserted.valor_inscripcion),
          valor_cuota: Number(inserted.valor_cuota),
          valor_dia_mora: Number(inserted.valor_dia_mora),
          porcentaje_administracion: Number(inserted.porcentaje_administracion),
          anio_vigente: Number(inserted.anio_vigente),
          es_activa: Boolean(inserted.es_activa)
        } as ConfiguracionNatillera
      }
    }
    
    console.error('Error en upsert configuración:', error)
    throw error
  }
  
  // Asegurar conversión numérica en la respuesta
  return {
    ...data,
    valor_inscripcion: Number(data.valor_inscripcion),
    valor_cuota: Number(data.valor_cuota),
    valor_dia_mora: Number(data.valor_dia_mora),
    porcentaje_administracion: Number(data.porcentaje_administracion),
    anio_vigente: Number(data.anio_vigente),
    es_activa: Boolean(data.es_activa)
  } as ConfiguracionNatillera
}

/**
 * Actualiza una configuración existente usando upsert con el ID
 * Esta función es más robusta porque usa upsert en lugar de update directo
 */
export async function actualizarConfiguracion(
  id: number | string,
  config: Omit<ConfiguracionNatillera, 'id' | 'created_at' | 'updated_at'>
): Promise<ConfiguracionNatillera> {
  // Convertir ID a string si es necesario (para UUID)
  const idString = String(id)
  
  // Conversión estricta de todos los valores numéricos
  // IMPORTANTE: NO incluir id, created_at, updated_at en el objeto de actualización
  const configActualizada: any = {
    id: idString, // Incluir el ID solo para el upsert
    valor_inscripcion: Number(config.valor_inscripcion),
    valor_cuota: Number(config.valor_cuota),
    valor_dia_mora: Number(config.valor_dia_mora),
    porcentaje_administracion: Number(config.porcentaje_administracion),
    anio_vigente: Number(config.anio_vigente),
    es_activa: Boolean(config.es_activa)
  }
  
  // Validar que todos los valores numéricos sean válidos
  if (isNaN(configActualizada.valor_inscripcion) || 
      isNaN(configActualizada.valor_cuota) || 
      isNaN(configActualizada.valor_dia_mora) || 
      isNaN(configActualizada.porcentaje_administracion) ||
      isNaN(configActualizada.anio_vigente)) {
    throw new Error('Todos los valores numéricos deben ser válidos')
  }
  
  // Si se está activando esta configuración, desactivar todas las demás
  if (configActualizada.es_activa === true) {
    const { error: errorDesactivar } = await supabase
      .from('configuracion_natillera')
      .update({ es_activa: false })
      .neq('id', idString)
    
    if (errorDesactivar) {
      console.warn('Advertencia al desactivar otras configuraciones:', errorDesactivar)
      // Continuar de todas formas
    }
  }
  
  // Remover id del objeto para el update (no se debe incluir en el body del update)
  // Solo incluir las columnas permitidas: valor_cuota, valor_inscripcion, valor_dia_mora, porcentaje_administracion, anio_vigente, es_activa
  const configParaUpdate: any = {
    valor_inscripcion: configActualizada.valor_inscripcion,
    valor_cuota: configActualizada.valor_cuota,
    valor_dia_mora: configActualizada.valor_dia_mora,
    porcentaje_administracion: configActualizada.porcentaje_administracion,
    anio_vigente: configActualizada.anio_vigente,
    es_activa: configActualizada.es_activa
  }
  
  console.log('🔄 [actualizarConfiguracion] Intentando actualizar configuración')
  console.log('🔄 [actualizarConfiguracion] ID (tipo:', typeof idString, '):', idString)
  console.log('🔄 [actualizarConfiguracion] Datos a actualizar (sin id, created_at, updated_at):', configParaUpdate)
  
  // Intentar primero con update directo (más común y suele funcionar mejor con RLS)
  const { data: updateData, error: updateError } = await supabase
    .from('configuracion_natillera')
    .update(configParaUpdate)
    .eq('id', idString)
    .select()
    .single()
  
  if (updateError) {
    console.warn('⚠️ [actualizarConfiguracion] Update directo falló (código:', updateError.code, '):', updateError.message)
    console.warn('⚠️ [actualizarConfiguracion] Intentando upsert como fallback...')
    
    // Si update falla (posible problema de RLS), intentar upsert como fallback
    // Upsert es más robusto para formularios de configuración
    const { data: upsertData, error: upsertError } = await supabase
      .from('configuracion_natillera')
      .upsert([configActualizada], {
        onConflict: 'id', // Usar id como clave de conflicto
        ignoreDuplicates: false
      })
      .select()
      .single()
    
    if (upsertError) {
      console.error('❌ [actualizarConfiguracion] Upsert también falló (código:', upsertError.code, '):', upsertError.message)
      console.error('❌ [actualizarConfiguracion] Detalles completos del error:', upsertError)
      throw new Error(`Error al actualizar configuración: ${upsertError.message || 'Error desconocido'} (Código: ${upsertError.code || 'N/A'})`)
    }
    
    console.log('✅ [actualizarConfiguracion] Upsert exitoso como fallback')
    return {
      ...upsertData,
      valor_inscripcion: Number(upsertData.valor_inscripcion || 0),
      valor_cuota: Number(upsertData.valor_cuota || 0),
      valor_dia_mora: Number(upsertData.valor_dia_mora || 0),
      porcentaje_administracion: Number(upsertData.porcentaje_administracion || 0),
      anio_vigente: Number(upsertData.anio_vigente || new Date().getFullYear()),
      es_activa: Boolean(upsertData.es_activa || false)
    } as ConfiguracionNatillera
  }
  
  console.log('✅ [actualizarConfiguracion] Update directo exitoso')
  return {
    ...updateData,
    valor_inscripcion: Number(updateData.valor_inscripcion || 0),
    valor_cuota: Number(updateData.valor_cuota || 0),
    valor_dia_mora: Number(updateData.valor_dia_mora || 0),
    porcentaje_administracion: Number(updateData.porcentaje_administracion || 0),
    anio_vigente: Number(updateData.anio_vigente || new Date().getFullYear()),
    es_activa: Boolean(updateData.es_activa || false)
  } as ConfiguracionNatillera
}

/**
 * Elimina una configuración
 */
export async function eliminarConfiguracion(id: number | string): Promise<void> {
  const { error } = await supabase
    .from('configuracion_natillera')
    .delete()
    .eq('id', id)
  
  if (error) {
    console.error('Error eliminando configuración:', error)
    throw error
  }
}

/**
 * Obtiene el año vigente desde la configuración activa
 * Función server-side para usar en Server Components
 */
export async function obtenerAnioVigente(): Promise<number> {
  try {
    const configActiva = await obtenerConfiguracionActiva()
    return configActiva?.anio_vigente || new Date().getFullYear()
  } catch (error) {
    console.warn('Error obteniendo año vigente, usando año actual:', error)
    return new Date().getFullYear()
  }
}

