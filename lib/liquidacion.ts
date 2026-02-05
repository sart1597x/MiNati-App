import { supabase } from './supabase'
import { obtenerPrestamos, obtenerMovimientosPrestamo, redondear, getFechaLocalHoy } from './prestamos'
import { getAllPagos, generarFechasVencimiento } from './pagos'
import { obtenerTotalRecaudadoMoras, obtenerMorasActivas } from './moras'
import { obtenerTotalUtilidadInversiones } from './inversiones'
import { obtenerConfiguracionNacional } from './configuracion'

// Helper para parsear fechas sin problemas de zona horaria (igual que en extracto)
function dateFromInput(fecha: string): Date {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

const VALOR_MORA_DIARIA = 3000
const MAX_DIAS_MORA = 15
const MAX_TOTAL_SANCION = 45000 // 15 días * $3,000

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
  neto_entregar_final: number
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
    const { data: actividades } = await supabase.from('actividades').select('valor')
    if (actividades) {
      totalActividades = actividades.reduce((sum, a) => sum + (parseFloat(String(a.valor || 0)) || 0), 0)
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
  // Crear payload limpio SOLO con las columnas que la tabla asociados_liquidados acepta
  // Campos permitidos (10 campos exactos):
  // nombres_asociados, total_cuotas, total_inscripciones, total_utilidad, 
  // total_comision, subtotal, descuento_4xmil, total_deducciones, neto_entregar, fecha_liquidacion
  // 
  // EXCLUIR explícitamente (causan errores de nulidad):
  // - asociado_ids
  // - detalle_financiero
  // - monto_neto_pagado (usar neto_entregar en su lugar)
  // - utilidad_bruta_repartible
  // - impuesto_4xmil_operativo
  // - impuesto_4xmil_egreso
  // - cualquier otro campo adicional
  const payload = {
    nombres_asociados: liquidacion.nombres_asociados || [],
    total_cuotas: Number((liquidacion.total_cuotas || 0).toFixed(2)),
    total_inscripciones: Number((liquidacion.total_inscripciones || 0).toFixed(2)),
    total_utilidad: Number((liquidacion.total_utilidad || 0).toFixed(2)),
    total_comision: Number((liquidacion.total_comision || 0).toFixed(2)),
    subtotal: Number((liquidacion.subtotal || 0).toFixed(2)),
    descuento_4xmil: Number((liquidacion.descuento_4xmil || 0).toFixed(2)),
    total_deducciones: Number((liquidacion.total_deducciones || 0).toFixed(2)),
    neto_entregar: Number(((liquidacion as any).neto_entregar || (liquidacion as any).neto_entregar_final || 0).toFixed(2)), // Usar neto_entregar directamente
    fecha_liquidacion: liquidacion.fecha_liquidacion || new Date().toISOString().split('T')[0]
  }
  
  // Debug: mostrar columnas enviadas (verificar que solo sean las permitidas)
  console.log("Columnas enviadas:", Object.keys(payload))
  console.log("Payload completo:", payload)
  
  const { data, error } = await supabase
    .from('asociados_liquidados')
    .insert([payload])
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
  
  // Obtener la liquidación para obtener su fecha_liquidacion (identificador de grupo)
  const liquidacion = await obtenerLiquidacionPorId(idNum)
  if (!liquidacion || !liquidacion.fecha_liquidacion) {
    throw new Error('Liquidación no encontrada')
  }
  
  // Eliminar todas las liquidaciones con la misma fecha_liquidacion (grupo)
  const { error } = await supabase
    .from('asociados_liquidados')
    .delete()
    .eq('fecha_liquidacion', liquidacion.fecha_liquidacion)
  
  if (error) throw error
}

// Interface para control de liquidaciones
export interface ControlLiquidacion {
  id: number | string
  nombre: string
  cedula: string
  activo: boolean
  estado: 'LIQUIDADO' | 'Pendiente'
}

// Obtener control de liquidaciones (estado de asociados)
export async function obtenerControlLiquidaciones(): Promise<ControlLiquidacion[]> {
  const { data: asociados, error } = await supabase
    .from('asociados')
    .select('*')
    .order('cedula', { ascending: true })
  
  if (error) throw error
  
  // Verificar si hay liquidaciones asociadas a cada asociado
  const liquidaciones = await obtenerLiquidaciones()
  const asociadosConEstado: ControlLiquidacion[] = (asociados || []).map(asociado => {
    // Buscar si el asociado está en alguna liquidación
    const estaLiquidado = liquidaciones.some(liq => 
      liq.nombres_asociados?.includes(asociado.nombre)
    )
    
    return {
      id: asociado.id,
      nombre: asociado.nombre,
      cedula: asociado.cedula,
      activo: asociado.activo ?? true,
      estado: (estaLiquidado ? 'LIQUIDADO' : 'Pendiente') as 'LIQUIDADO' | 'Pendiente'
    }
  })
  
  return asociadosConEstado
}

// ======================================================
// NUEVAS FUNCIONES PARA LIQUIDACIÓN DINÁMICA
// ======================================================

// Interface para ingresos discriminados
export interface InversionIngreso {
  nombre: string
  utilidad: number
}

export interface IngresosNatillera {
  natitombolaEnero: number
  natitombolaFebrero: number
  natitombolaMarzo: number
  natitombolaAbril: number
  natitombolaMayo: number
  natitombolaJunio: number
  natitombolaJulio: number
  natitombolaAgosto: number
  natitombolaSeptiembre: number
  natitombolaOctubre: number
  natitombolaNoviembre: number
  natitombolaDiciembre: number
  morasEnCuotas: number
  interesesPorNaticreditos: number
  inversiones: InversionIngreso[]
  totalInscripciones: number
  totalCuotasDeAsociados: number
  actividades: { nombre: string; valor: number }[]
  totalIngresosNatillera: number
  gastos: number
  impuesto4xMilOperativo: number
  totalRecaudado: number
}

// Obtener ingresos de la natillera discriminados
export async function obtenerIngresosNatillera(): Promise<IngresosNatillera> {
  // Obtener 4xMil Operativo
  const { obtenerTotal4xMilOperativo } = await import('./gastos')
  const impuesto4xMilOperativo = await obtenerTotal4xMilOperativo()
  
  // Obtener intereses de préstamos
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
  
  // Obtener moras recaudadas
  const totalMoras = await obtenerTotalRecaudadoMoras()
  
  // Obtener actividades con nombre y valor para discriminar
  let actividadesDiscriminadas: { nombre: string; valor: number }[] = []
  let totalActividades = 0
  try {
    const { data: actividades } = await supabase.from('actividades').select('nombre, valor')
    if (actividades) {
      actividadesDiscriminadas = actividades.map(a => ({
        nombre: a.nombre || 'Actividad sin nombre',
        valor: parseFloat(String(a.valor || 0)) || 0
      }))
      totalActividades = actividadesDiscriminadas.reduce((sum, a) => sum + a.valor, 0)
    }
  } catch (e) {
    // Si no existe, queda en 0
  }
  
  // Obtener total de cuotas de socios
  const pagos = await getAllPagos()
  const totalCuotasSocios = pagos.reduce((sum, p) => sum + (parseFloat(String(p.monto_cuota || 0)) || 0), 0)
  
  // Obtener inscripciones desde la tabla inscripciones (pagos registrados)
  const { obtenerResumenInscripciones } = await import('./inscripciones')
  const resumenInscripciones = await obtenerResumenInscripciones()
  const totalInscripciones = resumenInscripciones.valorTotal
  
  // Obtener todas las inversiones para mostrar individualmente
  const { obtenerInversiones } = await import('./inversiones')
  const inversiones = await obtenerInversiones()
  
  // Crear array de inversiones con nombre y utilidad
  const inversionesDiscriminadas: InversionIngreso[] = inversiones.map(inv => ({
    nombre: inv.nombre,
    utilidad: parseFloat(String(inv.utilidad_reportada || 0)) || 0
  }))
  
  // Calcular utilidad total de inversiones para el cálculo
  const totalUtilidadInversiones = inversionesDiscriminadas.reduce((sum, inv) => sum + inv.utilidad, 0)
  
  // Separar utilidades de inversiones para compatibilidad con natitombolas (si aplica)
  let utilidadInversionNatitombolas = 0
  inversionesDiscriminadas.forEach(inv => {
    const nombreLower = inv.nombre.toLowerCase()
    if (nombreLower.includes('natitombola') || nombreLower.includes('tombola')) {
      utilidadInversionNatitombolas += inv.utilidad
    }
  })
  
  // Obtener natitombolas por mes (buscar en actividades o crear tabla si existe)
  // Por ahora, asumimos que las natitombolas están en actividades con nombre específico
  let natitombolaEnero = 0
  let natitombolaFebrero = 0
  let natitombolaMarzo = 0
  let natitombolaAbril = 0
  let natitombolaMayo = 0
  let natitombolaJunio = 0
  let natitombolaJulio = 0
  let natitombolaAgosto = 0
  let natitombolaSeptiembre = 0
  let natitombolaOctubre = 0
  let natitombolaNoviembre = 0
  let natitombolaDiciembre = 0
  
  try {
    const { data: actividades } = await supabase.from('actividades').select('nombre, fecha, valor')
    if (actividades) {
      actividades.forEach(act => {
        const nombreLower = act.nombre?.toLowerCase() || ''
        if (nombreLower.includes('natitombola') || nombreLower.includes('tombola')) {
          if (act.fecha) {
            const fecha = new Date(act.fecha)
            const mes = fecha.getMonth() + 1
            const valor = parseFloat(String(act.valor || 0)) || 0
            if (mes === 1) natitombolaEnero += valor
            else if (mes === 2) natitombolaFebrero += valor
            else if (mes === 3) natitombolaMarzo += valor
            else if (mes === 4) natitombolaAbril += valor
            else if (mes === 5) natitombolaMayo += valor
            else if (mes === 6) natitombolaJunio += valor
            else if (mes === 7) natitombolaJulio += valor
            else if (mes === 8) natitombolaAgosto += valor
            else if (mes === 9) natitombolaSeptiembre += valor
            else if (mes === 10) natitombolaOctubre += valor
            else if (mes === 11) natitombolaNoviembre += valor
            else if (mes === 12) natitombolaDiciembre += valor
          }
        }
      })
    }
  } catch (e) {
    // Si no existe, queda en 0
  }
  
  // Fórmula: Moras + Intereses + Inscripciones + Utilidades de Inversiones + Cuotas de Asociados + Utilidades de Actividades
  const totalIngresosNatillera = 
    natitombolaEnero + natitombolaFebrero + natitombolaMarzo + natitombolaAbril +
    natitombolaMayo + natitombolaJunio + natitombolaJulio + natitombolaAgosto +
    natitombolaSeptiembre + natitombolaOctubre + natitombolaNoviembre + natitombolaDiciembre +
    totalMoras + totalIntereses + totalInscripciones + totalUtilidadInversiones + 
    totalCuotasSocios + totalActividades
  
  // Obtener gastos operativos desde calcularEstadosCaja (misma lógica que Caja Central)
  let gastosOperativos = 0
  try {
    const { calcularEstadosCaja } = await import('./caja')
    const estados = await calcularEstadosCaja()
    gastosOperativos = estados.gastosOperativos || 0
    
    // Validación: asegurar que gastosOperativos sea 0 si es nulo, undefined o NaN
    if (!gastosOperativos || isNaN(gastosOperativos)) {
      gastosOperativos = 0
    }
  } catch (e) {
    // Si hay cualquier error, gastosOperativos = 0
    console.warn('Error obteniendo gastos operativos desde calcularEstadosCaja:', e)
    gastosOperativos = 0
  }
  
  // Fórmula actualizada: Total Ingresos Natillera - GASTOS OPERATIVOS - Impuestos Gobierno 4x1000 Anual
  const totalRecaudado = totalIngresosNatillera - gastosOperativos - impuesto4xMilOperativo
  
  return {
    natitombolaEnero,
    natitombolaFebrero,
    natitombolaMarzo,
    natitombolaAbril,
    natitombolaMayo,
    natitombolaJunio,
    natitombolaJulio,
    natitombolaAgosto,
    natitombolaSeptiembre,
    natitombolaOctubre,
    natitombolaNoviembre,
    natitombolaDiciembre,
    morasEnCuotas: totalMoras,
    interesesPorNaticreditos: totalIntereses,
    inversiones: inversionesDiscriminadas,
    totalInscripciones,
    totalCuotasDeAsociados: totalCuotasSocios,
    actividades: actividadesDiscriminadas,
    totalIngresosNatillera,
    gastos: gastosOperativos,
    impuesto4xMilOperativo,
    totalRecaudado
  }
}

// Obtener deducciones completas de un asociado (moras + actividades + préstamos)
export async function obtenerDeduccionesAsociado(cedula: string): Promise<number> {
  // 1. Obtener moras pendientes del asociado (recalculando en tiempo real para coincidir con control de moras)
  let totalMoras = 0
  try {
    // Obtener asociado por cédula
    const { data: asociado } = await supabase
      .from('asociados')
      .select('id')
      .eq('cedula', cedula)
      .maybeSingle()
    
    if (asociado) {
      const asociadoId = typeof asociado.id === 'string' ? parseInt(asociado.id) : asociado.id
      
      // Obtener todas las moras del asociado con resta > 0
      const { data: morasData } = await supabase
        .from('moras')
        .select('*')
        .eq('asociado_id', asociadoId)
        .gt('resta', 0)
      
      if (morasData && morasData.length > 0) {
        const hoy = new Date()
        hoy.setHours(0, 0, 0, 0)
        const config = await obtenerConfiguracionNacional()
        const valorDiaMora = config?.valor_dia_mora ?? VALOR_MORA_DIARIA
        
        // Recalcular cada mora en tiempo real (igual que actualizarMorasExistentes)
        for (const mora of morasData) {
          // Obtener estado real de la cuota
          const { data: cuota } = await supabase
            .from('cuotas_pagos')
            .select('fecha_vencimiento, pagado, fecha_pago')
            .eq('cedula', cedula)
            .eq('numero_cuota', mora.cuota)
            .maybeSingle()
          
          // Fecha de vencimiento
          let fechaVenc: Date
          if (cuota?.fecha_vencimiento) {
            const [vy, vm, vd] = cuota.fecha_vencimiento.split('-').map(Number)
            fechaVenc = new Date(vy, vm - 1, vd, 0, 0, 0, 0)
          } else {
            const fechas = generarFechasVencimiento()
            const base = fechas[mora.cuota - 1]
            if (!base) continue
            fechaVenc = new Date(
              base.getFullYear(),
              base.getMonth(),
              base.getDate(),
              0, 0, 0, 0
            )
          }
          
          // Fecha final (congelamiento si la cuota está pagada)
          let fechaFinal = hoy
          if (cuota?.pagado === true && cuota.fecha_pago) {
            const [py, pm, pd] = cuota.fecha_pago.split('-').map(Number)
            fechaFinal = new Date(py, pm - 1, pd, 0, 0, 0, 0)
          }
          
          // Cálculo de días (igual que en actualizarMorasExistentes)
          const diffMs = fechaFinal.getTime() - fechaVenc.getTime()
          const diasTranscurridos = Math.floor(diffMs / (1000 * 60 * 60 * 24))
          
          if (diasTranscurridos < 1) continue
          
          const diasMora = Math.min(MAX_DIAS_MORA, diasTranscurridos)
          const totalSancion = Math.min(
            MAX_TOTAL_SANCION,
            diasMora * (mora.valor_mora || valorDiaMora)
          )
          
          const resta = totalSancion - (mora.valor_pagado || 0)
          
          // Sumar la resta recalculada (coincide exactamente con control de moras)
          totalMoras += Math.max(0, resta)
        }
      }
    }
  } catch (e) {
    console.warn('Error obteniendo moras:', e)
  }
  
  // 2. Obtener actividades pendientes del asociado
  let totalActividades = 0
  try {
    // Obtener asociado por cédula
    const { data: asociado } = await supabase
      .from('asociados')
      .select('id')
      .eq('cedula', cedula)
      .maybeSingle()
    
    if (asociado) {
      const asociadoId = typeof asociado.id === 'string' ? parseInt(asociado.id) : asociado.id
      
      // Obtener caritas pendientes de actividades
      const { data: caritas } = await supabase
        .from('actividades_caritas')
        .select('actividad_id, carita_numero, estado')
        .eq('socio_id', asociadoId)
        .eq('estado', 'PENDIENTE')
      
      if (caritas) {
        for (const carita of caritas) {
          // Obtener valor de la carita desde la actividad
          const { data: actividad } = await supabase
            .from('actividades')
            .select('valor')
            .eq('id', carita.actividad_id)
            .maybeSingle()
          
          if (actividad) {
            // Obtener valor de la carita desde participaciones_actividades
            const { data: participacion } = await supabase
              .from('participaciones_actividades')
              .select('valor_carita')
              .eq('actividad_id', carita.actividad_id)
              .eq('asociado_id', asociadoId)
              .maybeSingle()
            
            if (participacion) {
              totalActividades += parseFloat(String(participacion.valor_carita || 0)) || 0
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('Error obteniendo actividades pendientes:', e)
  }
  
  // 3. Obtener préstamos pendientes (Saldo a la Fecha = Capital + Intereses Causados hasta hoy)
  // IMPORTANTE: Usar exactamente la misma lógica que el extracto para que coincida día a día
  let totalPrestamos = 0
  try {
    const { data: asociado } = await supabase
      .from('asociados')
      .select('id')
      .eq('cedula', cedula)
      .maybeSingle()
    
    if (asociado) {
      const asociadoId = typeof asociado.id === 'string' ? parseInt(asociado.id) : asociado.id
      
      // Obtener préstamos activos del asociado
      const prestamos = await obtenerPrestamos()
      const prestamosAsociado = prestamos.filter(p => {
        const pAsociadoId = typeof p.asociado_id === 'string' ? parseInt(p.asociado_id) : p.asociado_id
        return pAsociadoId === asociadoId && p.estado === 'activo'
      })
      
      // Calcular saldo a la fecha para cada préstamo (igual que en el extracto)
      for (const prestamo of prestamosAsociado) {
        if (prestamo.id) {
          const movimientos = await obtenerMovimientosPrestamo(prestamo.id)
          
          // Si no hay movimientos, el saldo es el monto inicial
          if (movimientos.length === 0) {
            totalPrestamos += redondear(prestamo.monto || 0)
            continue
          }
          
          // Obtener el último movimiento real (no proyecciones "sin_pago")
          // Buscar desde el final hacia atrás para encontrar el último movimiento con ID
          let ultimoMovimientoReal = null
          for (let i = movimientos.length - 1; i >= 0; i--) {
            const mov = movimientos[i]
            if (mov.tipo_movimiento !== 'sin_pago' && mov.id !== undefined) {
              ultimoMovimientoReal = mov
              break
            }
          }
          
          // Si no hay movimiento real, usar el monto inicial
          if (!ultimoMovimientoReal) {
            totalPrestamos += redondear(prestamo.monto || 0)
            continue
          }
          
          const capitalPendienteActual = ultimoMovimientoReal.capital_pendiente || prestamo.monto
          const interesPendienteAnterior = ultimoMovimientoReal.interes_pendiente || 0
          
          // Calcular días desde el último movimiento hasta hoy (EXACTAMENTE como en extracto)
          const fechaUltimoMovimiento = dateFromInput(ultimoMovimientoReal.fecha)
          const fechaHoy = new Date()
          fechaHoy.setHours(0, 0, 0, 0) // Normalizar a medianoche para cálculo preciso
          const diasDesdeUltimoMovimiento = Math.max(0, Math.floor((fechaHoy.getTime() - fechaUltimoMovimiento.getTime()) / (1000 * 60 * 60 * 24)))
          
          // FÓRMULA ÚNICA: Interés_Causado = (Capital × Tasa/30 × Días) + Interés_Pendiente_Anterior
          const tasaInteres = (prestamo as any).tasa_interes || (prestamo as any).tasa || 0
          const interesDiario = (capitalPendienteActual * tasaInteres) / 100 / 30
          const interesCausadoPorDias = interesDiario * diasDesdeUltimoMovimiento
          const interesCausadoHastaHoy = redondear(interesCausadoPorDias + interesPendienteAnterior)
          
          // Saldo a la fecha = Capital pendiente + Intereses causados no pagados
          const saldoALaFecha = redondear(capitalPendienteActual + interesCausadoHastaHoy)
          totalPrestamos += saldoALaFecha
        }
      }
    }
  } catch (e) {
    console.warn('Error obteniendo préstamos pendientes:', e)
  }
  
  // Prioridad de Suma: Saldo Crédito Total + Moras Pendientes + Actividades Pendientes
  return totalPrestamos + totalMoras + totalActividades
}

// Obtener cuotas pagadas por asociado
export async function obtenerCuotasPagadasAsociado(cedula: string): Promise<number> {
  const pagos = await getAllPagos()
  const pagosAsociado = pagos.filter(p => p.cedula === cedula && p.pagado)
  return pagosAsociado.length
}

// Obtener inscripción del asociado
export async function obtenerInscripcionAsociado(cedula: string): Promise<number> {
  const { data: asociado } = await supabase
    .from('asociados')
    .select('cantidad_cupos')
    .eq('cedula', cedula)
    .maybeSingle()
  
  if (!asociado) return 0
  return (asociado.cantidad_cupos || 0) * 10000
}

// Calcular valores de liquidación para uno o varios asociados
export interface CalculoLiquidacion {
  totalRecaudado: number
  cuotasPorAsociados: number
  utilidadesPorAsociados: number
  deducciones: number
  comisionAdministracion: number
  aPagar: number
  impuesto4xMilDesembolso: number
  totalAPagar: number
  ingresosDiscriminados: IngresosNatillera
}

export async function calcularLiquidacionAsociados(
  cedulas: string[],
  porcentajeAdministracion: number
): Promise<CalculoLiquidacion> {
  // 1. Obtener ingresos discriminados
  const ingresosDiscriminados = await obtenerIngresosNatillera()
  
  // 2. Obtener total de asociados activos
  const totalAsociadosActivos = await obtenerTotalAsociados()
  
  // 3. Calcular cuotas por asociados seleccionados
  let totalCuotas = 0
  for (const cedula of cedulas) {
    const cuotas = await obtenerCuotasPagadasAsociado(cedula)
    totalCuotas += cuotas
  }
  
  // 4. Obtener valor de cuota desde configuración
  const { obtenerConfiguracionNacional } = await import('./configuracion')
  const config = await obtenerConfiguracionNacional()
  const valorCuota = config?.valor_cuota || 30000
  
  // 5. Calcular utilidades por asociados seleccionados
  // Formula: [(TOTAL RECAUDADO - TOTAL CUOTAS DE ASOCIADOS - TOTAL INSCRIPCIONES) / NUMERO DE ASOCIADOS ACTIVOS] * CANTIDAD DE ASOCIADOS SELECCIONADOS
  // Usar totalInscripciones desde ingresosDiscriminados (ya calculado desde tabla inscripciones)
  const totalInscripciones = ingresosDiscriminados.totalInscripciones
  
  const baseUtilidad = ingresosDiscriminados.totalRecaudado - ingresosDiscriminados.totalCuotasDeAsociados - totalInscripciones
  const utilidadPorAsociado = totalAsociadosActivos > 0 ? baseUtilidad / totalAsociadosActivos : 0
  const utilidadesPorAsociados = utilidadPorAsociado * cedulas.length
  
  // 6. Calcular deducciones
  let totalDeducciones = 0
  for (const cedula of cedulas) {
    const deducciones = await obtenerDeduccionesAsociado(cedula)
    totalDeducciones += deducciones
  }
  
  // 7. Calcular comisión de administración
  // Formula: [UTILIDADES POR ASOCIADO * Porcentaje de Administración (%)] * CANTIDAD DE ASOCIADOS SELECCIONADOS
  const comisionAdministracion = (utilidadPorAsociado * (porcentajeAdministracion / 100)) * cedulas.length
  
  // 8. Calcular "A PAGAR"
  // Formula: CUOTAS POR ASOCIADO(S) + UTILIDADES POR ASOCIADO(S) - DEDUCCIONES - COMISION POR ADMINISTRACIÓN
  const cuotasPorAsociados = totalCuotas * valorCuota
  const aPagar = cuotasPorAsociados + utilidadesPorAsociados - totalDeducciones - comisionAdministracion
  
  // 9. Calcular impuesto 4xMil desembolso
  // Formula: A PAGAR * 0.004
  const impuesto4xMilDesembolso = aPagar * 0.004
  
  // 10. Calcular total a pagar
  // Formula: A PAGAR - IMPUESTO 4XMIL DESEMBOLSO
  const totalAPagar = aPagar - impuesto4xMilDesembolso
  
  return {
    totalRecaudado: Number(ingresosDiscriminados.totalRecaudado.toFixed(2)),
    cuotasPorAsociados: Number(cuotasPorAsociados.toFixed(2)),
    utilidadesPorAsociados: Number(utilidadesPorAsociados.toFixed(2)),
    deducciones: Number(totalDeducciones.toFixed(2)),
    comisionAdministracion: Number(comisionAdministracion.toFixed(2)),
    aPagar: Number(aPagar.toFixed(2)),
    impuesto4xMilDesembolso: Number(impuesto4xMilDesembolso.toFixed(2)),
    totalAPagar: Number(totalAPagar.toFixed(2)),
    ingresosDiscriminados
  }
}

