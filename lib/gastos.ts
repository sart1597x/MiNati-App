import { supabase } from './supabase'

export interface GastoBancario {
  id?: number | string  // Puede ser UUID (string) o número
  descripcion: string
  valor: number
  fecha: string
  created_at?: string
}

// Obtener todos los gastos bancarios
export async function obtenerGastosBancarios(): Promise<GastoBancario[]> {
  try {
    const { data, error } = await supabase
      .from('gastos_bancarios')
      .select('*')
      .order('fecha', { ascending: false })
    
    if (error) {
      // Si la tabla no existe, retornar array vacío en lugar de lanzar error
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Tabla gastos_bancarios no existe. Ejecuta el SQL para crearla.')
        return []
      }
      throw error
    }
    return data || []
  } catch (error: any) {
    // Manejar cualquier otro error de forma segura
    console.error('Error obteniendo gastos bancarios:', error)
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return []
    }
    throw error
  }
}

// Obtener total acumulado de gastos bancarios (4xMil Operativo)
export async function obtenerTotal4xMilOperativo(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('gastos_bancarios')
      .select('valor')
    
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return 0
      }
      throw error
    }
    return (data || []).reduce((sum, g) => sum + (parseFloat(String(g.valor || 0)) || 0), 0)
  } catch (error: any) {
    console.error('Error obteniendo total 4xMil:', error)
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return 0
    }
    throw error
  }
}

// Crear un gasto bancario
export async function crearGastoBancario(gasto: Omit<GastoBancario, 'id' | 'created_at'>): Promise<GastoBancario> {
  const { data, error } = await supabase
    .from('gastos_bancarios')
    .insert([{
      ...gasto,
      descripcion: gasto.descripcion || '4xMil Operativo'
    }])
    .select()
    .single()
  
  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      throw new Error('La tabla gastos_bancarios no existe. Por favor ejecuta el SQL para crearla en Supabase.')
    }
    throw error
  }
  return data
}

// Actualizar un gasto bancario
export async function actualizarGastoBancario(
  gastoId: number | string,
  cambios: Partial<Omit<GastoBancario, 'id' | 'created_at'>>
): Promise<GastoBancario> {
  // Mantener el ID como viene (puede ser UUID string o número)
  // NO convertir a número porque la tabla puede usar UUID
  const idValue = gastoId
  
  const datosActualizar: any = {}
  
  if (cambios.descripcion !== undefined) datosActualizar.descripcion = cambios.descripcion
  if (cambios.valor !== undefined) datosActualizar.valor = cambios.valor
  if (cambios.fecha !== undefined) datosActualizar.fecha = cambios.fecha
  
  const { data, error } = await supabase
    .from('gastos_bancarios')
    .update(datosActualizar)
    .eq('id', idValue)
    .select()
    .single()
  
  if (error) {
    throw error
  }
  
  return data
}

// Eliminar un gasto bancario
export async function eliminarGastoBancario(gastoId: number | string): Promise<void> {
  // Mantener el ID como viene (puede ser UUID string o número)
  // NO convertir a número porque la tabla puede usar UUID
  const idValue = gastoId
  
  const { error } = await supabase
    .from('gastos_bancarios')
    .delete()
    .eq('id', idValue)
  
  if (error) throw error
}

