'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Home, Search, X, Calculator, Printer, Edit, Trash2, History, ArrowLeft } from 'lucide-react'
import { Socio } from '@/lib/supabase'
import { getSocios } from '@/lib/socios'
import {
  crearLiquidacion,
  obtenerLiquidaciones,
  obtenerControlLiquidaciones,
  eliminarLiquidacion,
  calcularLiquidacionAsociados,
  obtenerCuotasPagadasAsociado,
  obtenerInscripcionAsociado,
  Liquidacion,
  CalculoLiquidacion,
  ControlLiquidacion
} from '@/lib/liquidacion'
import { obtenerConfiguracionNacional } from '@/lib/configuracion'

// Usar el tipo exportado desde liquidacion.ts
type AsociadoControl = ControlLiquidacion

interface AsociadoSeleccionado {
  id: number | string
  nombre: string
  cedula: string
}

export default function LiquidacionPage() {
  const [socios, setSocios] = useState<Socio[]>([])
  const [controlLiquidaciones, setControlLiquidaciones] = useState<AsociadoControl[]>([])
  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [sociosFiltrados, setSociosFiltrados] = useState<Socio[]>([])
  const [asociadosSeleccionados, setAsociadosSeleccionados] = useState<AsociadoSeleccionado[]>([])
  const [loading, setLoading] = useState(true)
  const [calculando, setCalculando] = useState(false)
  const [porcentajeAdministracion, setPorcentajeAdministracion] = useState(8)
  const [calculoLiquidacion, setCalculoLiquidacion] = useState<CalculoLiquidacion | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [showModalDetalle, setShowModalDetalle] = useState(false)
  const [showModalLiquidacionIndividual, setShowModalLiquidacionIndividual] = useState(false)
  const [asociadoDetalle, setAsociadoDetalle] = useState<AsociadoControl | null>(null)
  const [asociadoLiquidacionIndividual, setAsociadoLiquidacionIndividual] = useState<AsociadoControl | null>(null)
  const [calculoIndividual, setCalculoIndividual] = useState<CalculoLiquidacion | null>(null)
  const [calculandoIndividual, setCalculandoIndividual] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [ingresosDetalle, setIngresosDetalle] = useState<CalculoLiquidacion | null>(null)

  // Ordenar asociados por cédula (numérico)
  const asociadosOrdenados = useMemo(() => {
    return [...controlLiquidaciones].sort((a, b) => {
      const cedulaA = parseInt(a.cedula) || 0
      const cedulaB = parseInt(b.cedula) || 0
      return cedulaA - cedulaB
    })
  }, [controlLiquidaciones])

  // Dividir en 6 columnas (similar a inscripciones)
  const dividirEnColumnas = (lista: AsociadoControl[]) => {
    const columnas: Array<Array<AsociadoControl>> = []
    const TAMANO_BLOQUE = 41
    
    for (let i = 0; i < 6; i++) {
      const inicio = i * TAMANO_BLOQUE
      const fin = inicio + TAMANO_BLOQUE
      columnas.push(lista.slice(inicio, fin))
    }
    
    return columnas
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (busqueda) {
      const filtrados = socios.filter(s =>
        s.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        s.cedula.toLowerCase().includes(busqueda.toLowerCase())
      )
      setSociosFiltrados(filtrados.slice(0, 5))
    } else {
      setSociosFiltrados([])
    }
  }, [busqueda, socios])

  useEffect(() => {
    if (asociadosSeleccionados.length > 0 && !showHistory) {
      calcularLiquidacionDinamica()
    } else {
      setCalculoLiquidacion(null)
    }
  }, [asociadosSeleccionados, porcentajeAdministracion, showHistory])

  const loadData = async () => {
    try {
      setLoading(true)
      const [sociosData, controlData, liquidacionesData, config] = await Promise.all([
        getSocios(),
        obtenerControlLiquidaciones(),
        obtenerLiquidaciones(),
        obtenerConfiguracionNacional()
      ])
      setSocios(sociosData)
      setControlLiquidaciones(controlData as any)
      setLiquidaciones(liquidacionesData)
      if (config?.porcentaje_administracion) {
        setPorcentajeAdministracion(config.porcentaje_administracion)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      alert('Error al cargar los datos')
    } finally {
      setLoading(false)
    }
  }

  const calcularLiquidacionDinamica = async () => {
    if (asociadosSeleccionados.length === 0) return
    
    try {
      setCalculando(true)
      const cedulas = asociadosSeleccionados.map(a => a.cedula)
      const calculo = await calcularLiquidacionAsociados(cedulas, porcentajeAdministracion)
      setCalculoLiquidacion(calculo)
    } catch (error) {
      console.error('Error calculando liquidación:', error)
      alert('Error al calcular la liquidación')
    } finally {
      setCalculando(false)
    }
  }

  const agregarAsociado = (socio: Socio) => {
    if (asociadosSeleccionados.some(s => s.id === socio.id)) {
      alert('Este asociado ya está seleccionado')
      return
    }
    
    setAsociadosSeleccionados([...asociadosSeleccionados, {
      id: socio.id!,
      nombre: socio.nombre,
      cedula: socio.cedula
    }])
    setBusqueda('')
    setSociosFiltrados([])
  }

  const removerAsociado = (id: number | string) => {
    setAsociadosSeleccionados(asociadosSeleccionados.filter(s => s.id !== id))
  }

  const handleLiquidar = async () => {
    if (asociadosSeleccionados.length === 0) {
      alert('Selecciona al menos un asociado')
      return
    }
    
    if (!calculoLiquidacion) {
      alert('Error: No se pudo calcular la liquidación')
      return
    }
    
    try {
      setSubmitting(true)
      
      // Obtener 4xMil Operativo
      const { obtenerTotal4xMilOperativo } = await import('@/lib/gastos')
      const total4xMilOperativo = await obtenerTotal4xMilOperativo()
      
      // Calcular totales correctamente
      let totalCuotas = 0
      let totalInscripciones = 0
      for (const asociado of asociadosSeleccionados) {
        totalCuotas += await obtenerCuotasPagadasAsociado(asociado.cedula)
        totalInscripciones += await obtenerInscripcionAsociado(asociado.cedula)
      }
      
      const liquidacionFinal = {
        nombres_asociados: asociadosSeleccionados.map(a => a.nombre),
        total_cuotas: totalCuotas,
        total_inscripciones: Number(totalInscripciones.toFixed(2)),
        total_utilidad: calculoLiquidacion.utilidadesPorAsociados,
        total_comision: calculoLiquidacion.comisionAdministracion,
        subtotal: calculoLiquidacion.aPagar,
        descuento_4xmil: calculoLiquidacion.impuesto4xMilDesembolso,
        total_deducciones: calculoLiquidacion.deducciones,
        neto_entregar: calculoLiquidacion.totalAPagar,
        fecha_liquidacion: new Date().toISOString().split('T')[0]
      }
      
      await crearLiquidacion(liquidacionFinal as any)
      
      alert('Liquidación creada exitosamente')
      setAsociadosSeleccionados([])
      setCalculoLiquidacion(null)
      await loadData()
    } catch (error) {
      console.error('Error finalizing liquidacion:', error)
      alert('Error al finalizar la liquidación')
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerDetalle = async (asociado: AsociadoControl) => {
    setAsociadoDetalle(asociado)
    setShowModalDetalle(true)
    // Calcular ingresos para mostrar en el modal
    try {
      const calculo = await calcularLiquidacionAsociados([asociado.cedula], porcentajeAdministracion)
      setIngresosDetalle(calculo)
    } catch (error) {
      console.error('Error calculando ingresos para detalle:', error)
    }
  }

  const handleSeleccionarDesdeCarita = (asociado: AsociadoControl) => {
    // Buscar el socio completo
    const socio = socios.find(s => s.cedula === asociado.cedula)
    if (socio) {
      agregarAsociado(socio)
      setShowHistory(false) // Volver a la vista de simulador
    }
  }

  const handleCaritaClick = async (asociado: AsociadoControl) => {
    const liquidacion = getLiquidacionAsociado(asociado)
    const estado = getEstadoCarita(asociado)
    
    // Si está liquidado (verde), mostrar modal de detalle
    if (estado === 'liquidado' && liquidacion) {
      handleVerDetalle(asociado)
    } 
    // Si es amarillo (pendiente) o gris (retirado), abrir modal de liquidación individual
    else if (estado === 'pendiente' || estado === 'retirado') {
      setAsociadoLiquidacionIndividual(asociado)
      setShowModalLiquidacionIndividual(true)
      await calcularLiquidacionIndividual(asociado)
    }
  }

  const calcularLiquidacionIndividual = async (asociado: AsociadoControl) => {
    try {
      setCalculandoIndividual(true)
      const calculo = await calcularLiquidacionAsociados([asociado.cedula], porcentajeAdministracion)
      setCalculoIndividual(calculo)
    } catch (error) {
      console.error('Error calculando liquidación individual:', error)
      alert('Error al calcular la liquidación')
    } finally {
      setCalculandoIndividual(false)
    }
  }

  const handleConfirmarLiquidacionIndividual = async () => {
    if (!asociadoLiquidacionIndividual || !calculoIndividual) {
      alert('Error: No se pudo calcular la liquidación')
      return
    }
    
    try {
      setSubmitting(true)
      
      // Obtener 4xMil Operativo
      const { obtenerTotal4xMilOperativo } = await import('@/lib/gastos')
      const total4xMilOperativo = await obtenerTotal4xMilOperativo()
      
      // Calcular totales para este asociado
      const totalCuotas = await obtenerCuotasPagadasAsociado(asociadoLiquidacionIndividual.cedula)
      const totalInscripciones = await obtenerInscripcionAsociado(asociadoLiquidacionIndividual.cedula)
      
      const liquidacionFinal = {
        nombres_asociados: [asociadoLiquidacionIndividual.nombre],
        total_cuotas: totalCuotas,
        total_inscripciones: Number(totalInscripciones.toFixed(2)),
        total_utilidad: calculoIndividual.utilidadesPorAsociados,
        total_comision: calculoIndividual.comisionAdministracion,
        subtotal: calculoIndividual.aPagar,
        descuento_4xmil: calculoIndividual.impuesto4xMilDesembolso,
        total_deducciones: calculoIndividual.deducciones,
        neto_entregar: calculoIndividual.totalAPagar,
        fecha_liquidacion: new Date().toISOString().split('T')[0]
      }
      
      await crearLiquidacion(liquidacionFinal as any)
      
      alert('Liquidación creada exitosamente')
      setShowModalLiquidacionIndividual(false)
      setAsociadoLiquidacionIndividual(null)
      setCalculoIndividual(null)
      await loadData()
    } catch (error) {
      console.error('Error finalizing liquidacion individual:', error)
      alert('Error al finalizar la liquidación')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEliminarLiquidacion = async (liquidacionId: number | string) => {
    try {
      // Obtener la liquidación para saber qué asociados están involucrados
      const liquidacion = liquidaciones.find(liq => liq.id === liquidacionId)
      if (!liquidacion) {
        alert('Liquidación no encontrada')
        return
      }
      
      // Eliminar todas las liquidaciones del grupo (misma fecha_liquidacion)
      await eliminarLiquidacion(liquidacionId)
      
      // Obtener todos los nombres del grupo (puede ser array o string)
      const nombresAsociados = liquidacion.nombres_asociados as string[] | string | undefined
      const nombresGrupo = nombresAsociados
        ? (Array.isArray(nombresAsociados)
            ? nombresAsociados
            : (typeof nombresAsociados === 'string' 
                ? nombresAsociados.split(',').map((n: string) => n.trim())
                : []))
        : []
      
      // Actualizar estado local inmediatamente para cambiar todas las caritas a amarillo
      if (nombresGrupo.length > 0) {
        setControlLiquidaciones(prev => prev.map(control => 
          nombresGrupo.includes(control.nombre)
            ? { ...control, estado: 'Pendiente' as const }
            : control
        ))
      }
      
      // Actualizar lista de liquidaciones
      const nuevasLiquidaciones = await obtenerLiquidaciones()
      setLiquidaciones(nuevasLiquidaciones)
      
      const mensaje = nombresGrupo.length > 1
        ? `Liquidación revertida exitosamente. ${nombresGrupo.length} asociados volvieron a estado pendiente.`
        : 'Liquidación revertida exitosamente. El asociado volvió a estado pendiente.'
      alert(mensaje)
      setShowModalDetalle(false)
      setIngresosDetalle(null)
    } catch (error) {
      console.error('Error deleting liquidacion:', error)
      alert('Error al revertir la liquidación')
    }
  }

  const getEstadoCarita = (asociado: AsociadoControl): 'liquidado' | 'pendiente' | 'retirado' => {
    if (!asociado.activo) return 'retirado'
    if (asociado.estado === 'LIQUIDADO') return 'liquidado'
    return 'pendiente'
  }

  const getLiquidacionAsociado = (asociado: AsociadoControl): Liquidacion | null => {
    return liquidaciones.find(liq => 
      liq.nombres_asociados?.includes(asociado.nombre)
    ) || null
  }

  const getCaritaColor = (estado: 'liquidado' | 'pendiente' | 'retirado', estaRetirado: boolean) => {
    if (estaRetirado) {
      return 'bg-gray-400 cursor-not-allowed opacity-60'
    }
    
    switch (estado) {
      case 'liquidado':
        return 'bg-green-500 hover:bg-green-600'
      case 'pendiente':
        return 'bg-yellow-500 hover:bg-yellow-600'
      case 'retirado':
        return 'bg-gray-400 cursor-not-allowed opacity-60'
      default:
        return 'bg-gray-300'
    }
  }

  const getCaritaEmoji = (estado: 'liquidado' | 'pendiente' | 'retirado', estaRetirado: boolean) => {
    if (estaRetirado) {
      return '😶'
    }
    
    switch (estado) {
      case 'liquidado':
        return '😊'
      case 'pendiente':
        return '😐'
      case 'retirado':
        return '😶'
      default:
        return '😐'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8 flex items-center justify-center">
        <p className="text-xl text-gray-400">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
      <div className={showHistory ? "max-w-[95vw] mx-auto" : "max-w-7xl mx-auto"}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Calculator className="w-8 h-8 text-white" />
            <h1 className="text-4xl font-bold text-white">Liquidación Anual</h1>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            {showHistory && (
              <button
                onClick={() => setShowHistory(false)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver</span>
              </button>
            )}
            {!showHistory && (
              <button
                onClick={() => setShowHistory(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                <History className="w-4 h-4" />
                <span>Historial de Liquidaciones</span>
              </button>
            )}
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </Link>
          </div>
        </div>

        {/* Vista: Simulador de Liquidación */}
        {!showHistory && (
          <>
            {/* Buscador de Asociados */}
            <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700 mb-6">
              <h2 className="text-2xl font-bold text-white mb-4">Buscar Asociado</h2>
              <div className="relative">
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  placeholder="Buscar por nombre o cédula..."
                />
                <Search className="absolute right-3 top-2.5 w-5 h-5 text-gray-400" />
                
                {sociosFiltrados.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {sociosFiltrados.map((socio) => (
                      <button
                        key={socio.id}
                        type="button"
                        onClick={() => agregarAsociado(socio)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-600 text-white"
                      >
                        <div className="font-medium">{socio.nombre}</div>
                        <div className="text-sm text-gray-400">Cédula: {socio.cedula}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Asociados Seleccionados */}
            {asociadosSeleccionados.length > 0 && (
              <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700 mb-6">
                <h2 className="text-2xl font-bold text-white mb-4">
                  Asociados Seleccionados ({asociadosSeleccionados.length})
                </h2>
                <div className="flex flex-wrap gap-2 mb-4">
                  {asociadosSeleccionados.map((asociado) => (
                    <div
                      key={asociado.id}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-700 rounded-lg text-white"
                    >
                      <span>{asociado.nombre}</span>
                      <button
                        onClick={() => removerAsociado(asociado.id)}
                        className="text-red-300 hover:text-red-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reporte de Liquidación (se muestra automáticamente al seleccionar) */}
            {calculando && (
              <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700 mb-6">
                <p className="text-white text-center">Calculando liquidación...</p>
              </div>
            )}

            {calculoLiquidacion && asociadosSeleccionados.length > 0 && !calculando && (
              <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700 mb-6">
                <h2 className="text-2xl font-bold text-white mb-4">Reporte de Liquidación</h2>
                
                {/* Ingresos Discriminados */}
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-white mb-3">Ingresos de la Natillera</h3>
                  <div className="bg-gray-700 rounded-lg p-4 space-y-2">
                    {calculoLiquidacion.ingresosDiscriminados.natitombolaEnero > 0 && (
                      <div className="flex justify-between text-white">
                        <span>NATITOMBOLA ENERO</span>
                        <span>${calculoLiquidacion.ingresosDiscriminados.natitombolaEnero.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {calculoLiquidacion.ingresosDiscriminados.natitombolaFebrero > 0 && (
                      <div className="flex justify-between text-white">
                        <span>NATITOMBOLA FEBRERO</span>
                        <span>${calculoLiquidacion.ingresosDiscriminados.natitombolaFebrero.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {calculoLiquidacion.ingresosDiscriminados.natitombolaMarzo > 0 && (
                      <div className="flex justify-between text-white">
                        <span>NATITOMBOLA MARZO</span>
                        <span>${calculoLiquidacion.ingresosDiscriminados.natitombolaMarzo.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {calculoLiquidacion.ingresosDiscriminados.natitombolaJunio > 0 && (
                      <div className="flex justify-between text-white">
                        <span>NATITOMBOLA JUNIO</span>
                        <span>${calculoLiquidacion.ingresosDiscriminados.natitombolaJunio.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-white font-semibold">
                      <span>MORAS EN CUOTAS</span>
                      <span>${calculoLiquidacion.ingresosDiscriminados.morasEnCuotas.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-white font-semibold">
                      <span>INTERESES POR NATICREDITOS</span>
                      <span>${calculoLiquidacion.ingresosDiscriminados.interesesPorNaticreditos.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    
                    {/* Inversiones individuales */}
                    {calculoLiquidacion.ingresosDiscriminados.inversiones && calculoLiquidacion.ingresosDiscriminados.inversiones.length > 0 && (
                      <>
                        {calculoLiquidacion.ingresosDiscriminados.inversiones.map((inversion, index) => (
                          <div key={index} className="flex justify-between text-white">
                            <span>Utilidad Inversión: {inversion.nombre}</span>
                            <span>${inversion.utilidad.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        ))}
                      </>
                    )}
                    
                    {/* Total Inscripciones */}
                    <div className="flex justify-between text-white font-semibold">
                      <span>TOTAL INSCRIPCIONES</span>
                      <span>${calculoLiquidacion.ingresosDiscriminados.totalInscripciones.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    
                    {/* Actividades individuales */}
                    {calculoLiquidacion.ingresosDiscriminados.actividades && calculoLiquidacion.ingresosDiscriminados.actividades.length > 0 && (
                      <>
                        {calculoLiquidacion.ingresosDiscriminados.actividades.map((actividad, index) => (
                          <div key={index} className="flex justify-between text-white">
                            <span>{actividad.nombre}</span>
                            <span>${actividad.valor.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        ))}
                      </>
                    )}
                    
                    <div className="flex justify-between text-white font-bold text-lg border-t border-gray-600 pt-2 mt-2">
                      <span>TOTAL CUOTAS DE ASOCIADOS</span>
                      <span>${calculoLiquidacion.ingresosDiscriminados.totalCuotasDeAsociados.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-green-400 font-bold text-xl border-t border-gray-600 pt-2 mt-2">
                      <span>TOTAL INGRESOS NATILLERA</span>
                      <span>${calculoLiquidacion.ingresosDiscriminados.totalIngresosNatillera.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-red-400 font-bold">
                      <span>GASTOS</span>
                      <span>${calculoLiquidacion.ingresosDiscriminados.gastos.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-red-400 font-bold">
                      <span>IMPUESTOS GOBIERNO 4X1000 ANUAL</span>
                      <span>${calculoLiquidacion.ingresosDiscriminados.impuesto4xMilOperativo.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-white font-bold text-xl border-t border-gray-600 pt-2 mt-2">
                      <span>TOTAL RECAUDADO</span>
                      <span>${calculoLiquidacion.ingresosDiscriminados.totalRecaudado.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                {/* Resumen por Asociado */}
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-white mb-3">Resumen por Asociado(s)</h3>
                  <div className="bg-gray-700 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-white font-semibold">
                      <span>CUOTAS POR ASOCIADO(S) A LIQUIDAR</span>
                      <span>${calculoLiquidacion.cuotasPorAsociados.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-red-400 font-semibold">
                      <span>IMPUESTO 4XMIL DESEMBOLSO CUOTA</span>
                      <span>${calculoLiquidacion.impuesto4xMilDesembolso.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-white">
                      <span>UTILIDADES POR ASOCIADO(S) A LIQUIDAR</span>
                      <span>${calculoLiquidacion.utilidadesPorAsociados.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-red-400">
                      <span>DEDUCCIONES</span>
                      <span>${calculoLiquidacion.deducciones.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-white">
                      <span>COMISION POR ADMINISTRACION {porcentajeAdministracion}%</span>
                      <span>${calculoLiquidacion.comisionAdministracion.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-white font-bold text-xl border-t-2 border-gray-600 pt-2 mt-2">
                      <span>TOTAL</span>
                      <span>${calculoLiquidacion.totalAPagar.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleLiquidar}
                  disabled={submitting || calculando}
                  className="w-full px-6 py-3 bg-green-700 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Liquidando...' : 'Liquidar'}
                </button>
              </div>
            )}
          </>
        )}

        {/* Vista: Historial de Liquidaciones (Grid de Caritas) */}
        {showHistory && (
          <div className="space-y-6">
            {/* Leyenda */}
            <div className="mb-4 p-4 bg-blue-100 dark:bg-blue-900 rounded-lg text-sm text-blue-800 dark:text-blue-200">
              <p className="font-semibold mb-2">Leyenda:</p>
              <div className="flex flex-wrap gap-4">
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">😊</span>
                  <span>Liquidado</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center">😐</span>
                  <span>Pendiente</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center">😶</span>
                  <span>Retirado</span>
                </span>
              </div>
            </div>

            {/* Tablero de Asociados - 6 Columnas ocupando 100% del ancho */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 sm:p-4">
              <div 
                className="w-full overflow-x-auto liquidacion-scrollbar"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#4B5563 #1F2937'
                }}
              >
                <div className="grid gap-4 min-w-[1200px]" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
                  {dividirEnColumnas(asociadosOrdenados).map((columna, colIndex) => (
                    <div key={colIndex}>
                      {/* Encabezado de columna */}
                      <div className="border-b-2 border-gray-300 dark:border-gray-600 pb-1 mb-1 sticky top-0 bg-white dark:bg-gray-800 z-10">
                        <div className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase">
                          ASOCIADO
                        </div>
                        <div className="flex gap-1 items-center text-[10px] font-semibold text-gray-600 dark:text-gray-400">
                          <div className="w-6 text-center shrink-0">ID</div>
                          <div className="flex-1 text-center">NOMBRE</div>
                          <div className="w-6 text-center shrink-0">LIQ</div>
                        </div>
                      </div>
                      
                      {/* Lista de asociados - máximo 41 filas */}
                      <div className="space-y-0">
                        {columna.map((asociado) => {
                          const estado = getEstadoCarita(asociado)
                          const estaRetirado = !asociado.activo
                          
                          return (
                            <div
                              key={asociado.id}
                              className="border-b border-gray-200 dark:border-gray-700 py-0.5 text-[10px] flex gap-1 items-center"
                            >
                              <div className="w-6 text-center text-gray-600 dark:text-gray-400 font-semibold text-[9px] shrink-0">
                                {asociado.cedula}
                              </div>
                              <div className={`flex-1 truncate ${estaRetirado ? 'text-gray-500 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                                {asociado.nombre}
                              </div>
                              <button
                                disabled={estaRetirado}
                                onClick={() => {
                                  if (estaRetirado) return
                                  handleCaritaClick(asociado)
                                }}
                                className={`w-5 h-5 rounded-full ${getCaritaColor(estado, estaRetirado)} text-white flex items-center justify-center transition-colors flex-shrink-0 ${
                                  estaRetirado ? 'cursor-not-allowed' : 'cursor-pointer'
                                }`}
                                title={estaRetirado ? 'Asociado retirado' : `Liquidación - ${estado === 'liquidado' ? 'Liquidado' : 'Pendiente'}`}
                              >
                                <span className="text-[9px]">{getCaritaEmoji(estado, estaRetirado)}</span>
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Liquidación Individual (Pendiente/Retirado) */}
        {showModalLiquidacionIndividual && asociadoLiquidacionIndividual && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col print-content">
              <h2 className="text-2xl font-bold mb-3 text-gray-800 dark:text-white flex-shrink-0 no-print">
                Liquidación Individual
              </h2>
              
              {calculandoIndividual ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 dark:text-gray-400">Calculando liquidación...</p>
                </div>
              ) : calculoIndividual ? (
                <>
                  <div className="flex-1 overflow-y-auto pr-2">
                    <div className="space-y-3">
                      {/* Título y Nombre del Socio */}
                      <div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2 print-title">
                          Reporte de Liquidación
                        </h2>
                        <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-1 print-nombres">
                          {asociadoLiquidacionIndividual.nombre}
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Cédula: {asociadoLiquidacionIndividual.cedula}
                        </p>
                      </div>

                      {/* Ingresos de la Natillera */}
                      <div className="bg-gray-800 dark:bg-gray-900 rounded-lg p-3 space-y-1.5 border border-gray-700">
                        <h3 className="text-lg font-semibold text-white mb-2">Ingresos de la Natillera</h3>
                        <div className="bg-gray-700 rounded-lg p-3 space-y-1.5">
                          <div className="flex justify-between text-white font-semibold text-sm">
                            <span>MORAS EN CUOTAS</span>
                            <span>${calculoIndividual.ingresosDiscriminados.morasEnCuotas.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between text-white font-semibold text-sm">
                            <span>INTERESES POR NATICREDITOS</span>
                            <span>${calculoIndividual.ingresosDiscriminados.interesesPorNaticreditos.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          
                          {/* Inversiones individuales */}
                          {calculoIndividual.ingresosDiscriminados.inversiones && calculoIndividual.ingresosDiscriminados.inversiones.length > 0 && (
                            <>
                              {calculoIndividual.ingresosDiscriminados.inversiones.map((inversion, index) => (
                                <div key={index} className="flex justify-between text-white text-xs">
                                  <span>Utilidad Inversión: {inversion.nombre}</span>
                                  <span>${inversion.utilidad.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                              ))}
                            </>
                          )}
                          
                          <div className="flex justify-between text-green-400 font-bold text-base border-t border-gray-600 pt-1.5 mt-1.5">
                            <span>TOTAL INGRESOS NATILLERA</span>
                            <span>${calculoIndividual.ingresosDiscriminados.totalIngresosNatillera.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between text-red-400 font-bold text-sm">
                            <span>GASTOS</span>
                            <span>${calculoIndividual.ingresosDiscriminados.gastos.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between text-red-400 font-bold text-sm">
                            <span>IMPUESTOS GOBIERNO 4X1000 ANUAL</span>
                            <span>${calculoIndividual.ingresosDiscriminados.impuesto4xMilOperativo.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between text-white font-bold text-base border-t border-gray-600 pt-1.5 mt-1.5">
                            <span>TOTAL RECAUDADO</span>
                            <span>${calculoIndividual.ingresosDiscriminados.totalRecaudado.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </div>

                      {/* Separador */}
                      <div className="border-t border-gray-300 dark:border-gray-600 my-2"></div>

                      {/* Resumen por Asociado */}
                      <div>
                        <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-2">Resumen por Asociado</h3>
                      </div>

                      {/* Desglose Financiero */}
                      <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 space-y-2">
                        <div className="flex justify-between text-gray-900 dark:text-white text-sm">
                          <span>Cuotas del Asociado:</span>
                          <span className="font-semibold">${calculoIndividual.cuotasPorAsociados.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        
                        <div className="flex justify-between text-gray-900 dark:text-white text-sm">
                          <span>Utilidades:</span>
                          <span className="font-semibold">${calculoIndividual.utilidadesPorAsociados.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        
                        <div className="flex justify-between text-red-400 dark:text-red-400 font-semibold text-sm">
                          <span>Impuesto 4xMil Desembolso Cuota:</span>
                          <span>${calculoIndividual.impuesto4xMilDesembolso.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        
                        <div className="flex justify-between text-red-600 dark:text-red-400 text-sm">
                          <span>Deducciones:</span>
                          <span className="font-semibold">${calculoIndividual.deducciones.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        
                        <div className="flex justify-between text-gray-900 dark:text-white text-sm">
                          <span>Comisión {porcentajeAdministracion}%:</span>
                          <span className="font-semibold">${calculoIndividual.comisionAdministracion.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        
                        <div className="border-t-2 border-gray-300 dark:border-gray-600 pt-2 mt-2">
                          <div className="flex justify-between text-gray-900 dark:text-white">
                            <span className="font-bold text-base">TOTAL NETO A ENTREGAR:</span>
                            <span className="font-bold text-lg text-green-600 dark:text-green-400">
                              ${calculoIndividual.totalAPagar.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Botones de Acción */}
                  <div className="flex gap-3 pt-3 flex-shrink-0 border-t border-gray-300 dark:border-gray-600 mt-3 no-print">
                    <button
                      onClick={() => window.print()}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                    >
                      <Printer className="w-4 h-4" />
                      Imprimir
                    </button>
                    <button
                      onClick={handleConfirmarLiquidacionIndividual}
                      disabled={submitting}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors no-print"
                    >
                      {submitting ? 'Liquidando...' : 'Confirmar Liquidación'}
                    </button>
                    <button
                      onClick={() => {
                        setShowModalLiquidacionIndividual(false)
                        setAsociadoLiquidacionIndividual(null)
                        setCalculoIndividual(null)
                      }}
                      className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors no-print"
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600 dark:text-gray-400">Error al calcular la liquidación</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal de Detalle (Liquidado) */}
        {showModalDetalle && asociadoDetalle && (
          <>
            <style jsx global>{`
              @media print {
                * {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                body * {
                  visibility: hidden;
                }
                .print-content, .print-content * {
                  visibility: visible;
                }
                .print-content {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  background: #1f2937 !important;
                  color: white !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .no-print {
                  display: none !important;
                }
                .print-content .bg-gray-800,
                .print-content .bg-gray-700,
                .print-content .bg-gray-900 {
                  background: #1f2937 !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .print-content .text-green-400,
                .print-content .text-green-600 {
                  color: #4ade80 !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .print-content .text-red-400,
                .print-content .text-red-600 {
                  color: #f87171 !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .print-content .print-title {
                  font-size: 24px !important;
                  font-weight: bold !important;
                  margin-bottom: 8px !important;
                  color: white !important;
                }
                .print-content .print-nombres {
                  font-size: 18px !important;
                  font-weight: 600 !important;
                  margin-bottom: 16px !important;
                  color: white !important;
                }
                @page {
                  size: A4;
                  margin: 1cm;
                }
              }
            `}</style>
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col print-content">
                <div className="flex justify-between items-center mb-3 flex-shrink-0 no-print">
                  <button
                    onClick={() => {
                      setShowModalDetalle(false)
                      setIngresosDetalle(null)
                    }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              
              <div className="flex-1 overflow-y-auto pr-2">
              {(() => {
                const liquidacion = getLiquidacionAsociado(asociadoDetalle)
                if (!liquidacion) {
                  return (
                    <div className="text-gray-800 dark:text-white">
                      <p className="mb-4">Este asociado aún no ha sido liquidado.</p>
                      {!asociadoDetalle.activo && (
                        <p className="text-yellow-600 dark:text-yellow-400">
                          Asociado retirado. Solo se le devuelven Cuotas + Inscripción menos el 4xMil de desembolso.
                        </p>
                      )}
                    </div>
                  )
                }
                
                return (
                  <div className="space-y-3">
                    {/* Título y Nombres de Asociados */}
                    <div>
                      <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2 print-title">
                        Reporte de Liquidación
                      </h2>
                      <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-1 print-nombres">
                        {(() => {
                          if (!liquidacion.nombres_asociados) return asociadoDetalle.nombre
                          const nombresAsociados = liquidacion.nombres_asociados as string[] | string | undefined
                          let nombres: string
                          if (Array.isArray(nombresAsociados)) {
                            nombres = nombresAsociados.join(', ')
                          } else if (typeof nombresAsociados === 'string') {
                            nombres = nombresAsociados.replace(/[\[\]"]/g, '')
                          } else {
                            return asociadoDetalle.nombre
                          }
                          // Limpiar formato JSON: quitar corchetes, comillas y espacios extra
                          nombres = nombres.replace(/[\[\]"]/g, '').replace(/\s*,\s*/g, ', ').trim()
                          const esGrupo = Array.isArray(liquidacion.nombres_asociados)
                            ? liquidacion.nombres_asociados.length > 1
                            : nombres.includes(',')
                          return esGrupo ? `Asociados: ${nombres}` : asociadoDetalle.nombre
                        })()}
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Cédula: {asociadoDetalle.cedula}
                      </p>
                    </div>

                    {/* Ingresos de la Natillera */}
                    {ingresosDetalle && (
                      <>
                        <div className="bg-gray-800 dark:bg-gray-900 rounded-lg p-3 space-y-1.5 border border-gray-700">
                          <h3 className="text-lg font-semibold text-white mb-2">Ingresos de la Natillera</h3>
                          <div className="bg-gray-700 rounded-lg p-3 space-y-1.5">
                            <div className="flex justify-between text-white font-semibold text-sm">
                              <span>MORAS EN CUOTAS</span>
                              <span>${ingresosDetalle.ingresosDiscriminados.morasEnCuotas.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-white font-semibold text-sm">
                              <span>INTERESES POR NATICREDITOS</span>
                              <span>${ingresosDetalle.ingresosDiscriminados.interesesPorNaticreditos.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            
                            {/* Inversiones individuales */}
                            {ingresosDetalle.ingresosDiscriminados.inversiones && ingresosDetalle.ingresosDiscriminados.inversiones.length > 0 && (
                              <>
                                {ingresosDetalle.ingresosDiscriminados.inversiones.map((inversion, index) => (
                                  <div key={index} className="flex justify-between text-white text-xs">
                                    <span>Utilidad Inversión: {inversion.nombre}</span>
                                    <span>${inversion.utilidad.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  </div>
                                ))}
                              </>
                            )}
                            
                            <div className="flex justify-between text-green-400 font-bold text-base border-t border-gray-600 pt-1.5 mt-1.5">
                              <span>TOTAL INGRESOS NATILLERA</span>
                              <span>${ingresosDetalle.ingresosDiscriminados.totalIngresosNatillera.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-red-400 font-bold text-sm">
                              <span>GASTOS</span>
                              <span>${ingresosDetalle.ingresosDiscriminados.gastos.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-red-400 font-bold text-sm">
                              <span>IMPUESTOS GOBIERNO 4X1000 ANUAL</span>
                              <span>${ingresosDetalle.ingresosDiscriminados.impuesto4xMilOperativo.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-white font-bold text-base border-t border-gray-600 pt-1.5 mt-1.5">
                              <span>TOTAL RECAUDADO</span>
                              <span>${ingresosDetalle.ingresosDiscriminados.totalRecaudado.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        </div>

                        {/* Separador */}
                        <div className="border-t border-gray-300 dark:border-gray-600 my-2"></div>

                        {/* Resumen por Asociado */}
                        <div>
                          <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-2">Resumen por Asociado</h3>
                        </div>
                      </>
                    )}

                    {/* Desglose Financiero (Solo Lectura) */}
                    <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 space-y-2">
                      <div className="flex justify-between text-gray-900 dark:text-white text-sm">
                        <span>Cuotas del Asociado:</span>
                        <span className="font-semibold">${((liquidacion.total_cuotas || 0) * 30000).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      
                      <div className="flex justify-between text-gray-900 dark:text-white text-sm">
                        <span>Utilidades:</span>
                        <span className="font-semibold">${(liquidacion.total_utilidad || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      
                      <div className="flex justify-between text-red-400 dark:text-red-400 font-semibold text-sm">
                        <span>Impuesto 4xMil Desembolso Cuota:</span>
                        <span>${(liquidacion.descuento_4xmil || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      
                      <div className="flex justify-between text-red-600 dark:text-red-400 text-sm">
                        <span>Deducciones:</span>
                        <span className="font-semibold">${(liquidacion.total_deducciones || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      
                      <div className="flex justify-between text-gray-900 dark:text-white text-sm">
                        <span>Comisión {porcentajeAdministracion}%:</span>
                        <span className="font-semibold">${(liquidacion.total_comision || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      
                      <div className="border-t-2 border-gray-300 dark:border-gray-600 pt-2 mt-2">
                        <div className="flex justify-between text-gray-900 dark:text-white">
                          <span className="font-bold text-base">TOTAL NETO A ENTREGAR:</span>
                          <span className="font-bold text-lg text-green-600 dark:text-green-400">
                            ${(((liquidacion as any).neto_entregar || liquidacion.neto_entregar_final) || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Botones de Acción */}
                    {(() => {
                      const liquidacion = getLiquidacionAsociado(asociadoDetalle)
                      if (!liquidacion) return null
                      
                      return (
                        <div className="flex gap-3 pt-3 flex-shrink-0 border-t border-gray-300 dark:border-gray-600 mt-3 no-print">
                          <button
                            onClick={() => {
                              window.print()
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                          >
                            <Printer className="w-4 h-4" />
                            Imprimir Comprobante
                          </button>
                          <button
                            onClick={() => {
                              const nombresAsociados = liquidacion.nombres_asociados as string[] | string | undefined
                              const nombres = nombresAsociados
                                ? (Array.isArray(nombresAsociados)
                                    ? nombresAsociados.join(', ')
                                    : (typeof nombresAsociados === 'string'
                                        ? nombresAsociados.replace(/[\[\]"]/g, '').replace(/\s*,\s*/g, ', ').trim()
                                        : asociadoDetalle.nombre))
                                : asociadoDetalle.nombre
                              const esGrupo = nombresAsociados
                                ? (Array.isArray(nombresAsociados)
                                    ? nombresAsociados.length > 1
                                    : nombres.includes(','))
                                : false
                              const mensaje = esGrupo
                                ? `¿Estás seguro de eliminar esta liquidación? Se eliminarán las liquidaciones de: ${nombres}. Todos los asociados volverán a estado pendiente.`
                                : '¿Estás seguro de eliminar esta liquidación? El asociado volverá a estado pendiente.'
                              if (confirm(mensaje)) {
                                handleEliminarLiquidacion(liquidacion.id!)
                              }
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            Eliminar
                          </button>
                        </div>
                      )
                    })()}
                  </div>
                )
              })()}
              </div>
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  )
}
