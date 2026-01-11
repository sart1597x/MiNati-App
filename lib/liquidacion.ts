import { supabase } from './supabase'
import { obtenerPrestamos } from './prestamos'
import { obtenerMovimientosPrestamo } from './prestamos'
import { getAllPagos } from './pagos'
import { obtenerTotalRecaudadoMoras } from './moras'

export interface AsociadoLiquidacion {
  id: number | string
  nombre: string
  cedula: string
  cuotas: number
  inscripcion: number
  utilidad: number
  comisionAdmin: number
  subtotal: number
  descuento4xMil: number
  capitalPendiente: number
  netoEntregar: number
}

export interface Liquidacion {
  id?: number
  nombres_asociados: string[]
  total_cuotas: number
  total_inscripciones: number
  total_utilidad: number
  total_comision: number
  subtotal: number
  descuento_4xmil: number
  total_deducciones: number
  neto_entregar: number
  impuesto_4xmil_operativo: number
  impuesto_4xmil_egreso: number
  utilidad_bruta_repartible: number
  fecha_liquidacion: string
  created_at?: string
  updated_at?: string
}

// Obtener total de asociados
export async function obtenerTotalAsociados(): Promise<number> {
  const { count, error } = await supabase
    .from('asociados')
    .select('*', { count: 'exact', head: true })
  
  if (error) throw error
  return count || 0
}

// Obtener capital pendiente de préstamos de un asociado
export async function obtenerCapitalPendienteAsociado(asociadoId: number | string): Promise<number> {
  const asociadoIdNum = typeof asociadoId === 'string' ? parseInt(asociadoId) : asociadoId
  
  const prestamos = await obtenerPrestamos()
  const prestamosAsociado = prestamos.filter(p => {
    const pAsociadoId = typeof p.asociado_id === 'string' ? parseInt(p.asociado_id) : p.asociado_id
    return pAsociadoId === asociadoIdNum && p.estado === 'activo'
  })
  
  let capitalTotal = 0
  
  for (const prestamo of prestamosAsociado) {
    if (prestamo.id) {
      const movimientos = await obtenerMovimientosPrestamo(prestamo.id)
      if (movimientos.length > 0) {
        const ultimoMov = movimientos[movimientos.length - 1]
        capitalTotal += ultimoMov.capital_pendiente || 0
      } else {
        capitalTotal += prestamo.monto
      }
    }
  }
  
  return capitalTotal
}

// Calcular utilidad bruta repartible (usa total de gastos bancarios)
export async function calcularUtilidadBrutaRepartible(): Promise<number> {
  // Obtener 4xMil Operativo desde gastos bancarios
  const { obtenerTotal4xMilOperativo } = await import('./gastos')
  const impuesto4xMilOperativo = await obtenerTotal4xMilOperativo()
  
  // Intereses + Moras + Actividades + Inscripciones - 4xMil Operativo - Total Capital Socios (cuotas)
  
  // Obtener intereses
  const prestamos = await obtenerPrestamos()
  let totalIntereses = 0
  for (const prestamo of prestamos) {
    if (prestamo.id) {
      const movimientos = await obtenerMovimientosPrestamo(prestamo.id)
      for (const mov of movimientos) {
        if (mov.tipo_movimiento !== 'desembolso') {
          totalIntereses += mov.interes_causado || 0
        }
      }
    }
  }
  
  // Obtener moras
  const totalMoras = await obtenerTotalRecaudadoMoras()
  
  // Obtener actividades
  let totalActividades = 0
  try {
    const { data: actividades } = await supabase.from('actividades').select('valor_recaudado')
    if (actividades) {
      totalActividades = actividades.reduce((sum, a) => sum + (parseFloat(String(a.valor_recaudado || 0)) || 0), 0)
    }
  } catch (e) {
    // Si no existe, queda en 0
  }
  
  // Obtener inscripciones
  const { data: asociados } = await supabase.from('asociados').select('cantidad_cupos')
  const totalInscripciones = (asociados || []).reduce((sum, a) => sum + ((a.cantidad_cupos || 0) * 10000), 0)
  
  // Obtener total de cuotas de socios (no incluir en utilidad, es capital de socios)
  const pagos = await getAllPagos()
  const totalCuotasSocios = pagos.reduce((sum, p) => sum + (parseFloat(String(p.monto_cuota || 0)) || 0), 0)
  
  // Utilidad Bruta = Intereses + Moras + Actividades + Inscripciones - 4xMil Operativo - Capital de Socios
  return totalIntereses + totalMoras + totalActividades + totalInscripciones - impuesto4xMilOperativo - totalCuotasSocios
}

// Crear una liquidación
export async function crearLiquidacion(liquidacion: Omit<Liquidacion, 'id' | 'created_at' | 'updated_at'>): Promise<Liquidacion> {
  const liquidacionData = {
    ...liquidacion,
    fecha_liquidacion: liquidacion.fecha_liquidacion || new Date().toISOString().split('T')[0]
  }
  
  const { data, error } = await supabase
    .from('asociados_liquidados')
    .insert([liquidacionData])
    .select()
    .single()
  
  if (error) {
    console.error('Error creating liquidacion:', error)
    throw error
  }
  
  return data
}

// Obtener todas las liquidaciones
export async function obtenerLiquidaciones(): Promise<Liquidacion[]> {
  const { data, error } = await supabase
    .from('asociados_liquidados')
    .select('*')
    .order('fecha_liquidacion', { ascending: false })
  
  if (error) throw error
  return data || []
}

// Obtener una liquidación por ID
export async function obtenerLiquidacionPorId(liquidacionId: number | string): Promise<Liquidacion | null> {
  const idNum = typeof liquidacionId === 'string' ? parseInt(liquidacionId) : liquidacionId
  
  const { data, error } = await supabase
    .from('asociados_liquidados')
    .select('*')
    .eq('id', idNum)
    .single()
  
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  
  return data
}

// Actualizar una liquidación
export async function actualizarLiquidacion(
  liquidacionId: number | string,
  cambios: Partial<Liquidacion>
): Promise<Liquidacion> {
  const idNum = typeof liquidacionId === 'string' ? parseInt(liquidacionId) : liquidacionId
  
  const { data, error } = await supabase
    .from('asociados_liquidados')
    .update({ ...cambios, updated_at: new Date().toISOString() })
    .eq('id', idNum)
    .select()
    .single()
  
  if (error) throw error
  return data
}

// Eliminar una liquidación (revertir)
export async function eliminarLiquidacion(liquidacionId: number | string): Promise<void> {
  const idNum = typeof liquidacionId === 'string' ? parseInt(liquidacionId) : liquidacionId
  
  const { error } = await supabase
    .from('asociados_liquidados')
    .delete()
    .eq('id', idNum)
  
  if (error) throw error
}

// Obtener control de liquidaciones (estado de asociados)
export async function obtenerControlLiquidaciones() {
  const { data: asociados, error } = await supabase
    .from('asociados')
    .select('*')
    .order('nombre', { ascending: true })
  
  if (error) throw error
  
  // Verificar si hay liquidaciones asociadas a cada asociado
  const liquidaciones = await obtenerLiquidaciones()
  const asociadosConEstado = (asociados || []).map(asociado => {
    // Buscar si el asociado está en alguna liquidación
    const estaLiquidado = liquidaciones.some(liq => 
      liq.nombres_asociados?.includes(asociado.nombre)
    )
    
    return {
      id: asociado.id,
      nombre: asociado.nombre,
      cedula: asociado.cedula,
      estado: estaLiquidado ? 'LIQUIDADO' : 'Pendiente'
    }
  })
  
  return asociadosConEstado
}

