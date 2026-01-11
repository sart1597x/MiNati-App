'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Home, ArrowLeft, Search, Plus, X, Eye, Trash2, Calculator } from 'lucide-react'
import { Socio } from '@/lib/supabase'
import { getSocios } from '@/lib/socios'
import {
  calcularUtilidadBrutaRepartible,
  obtenerTotalAsociados,
  obtenerCapitalPendienteAsociado,
  crearLiquidacion,
  obtenerLiquidaciones,
  obtenerControlLiquidaciones,
  eliminarLiquidacion,
  Liquidacion
} from '@/lib/liquidacion'
import { obtenerConfiguracionNacional } from '@/lib/configuracion'

interface AsociadoSeleccionado {
  id: number | string
  nombre: string
  cedula: string
  capitalPendiente: number
}

export default function LiquidacionPage() {
  const [view, setView] = useState<'nueva' | 'historial'>('nueva')
  const [socios, setSocios] = useState<Socio[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [sociosFiltrados, setSociosFiltrados] = useState<Socio[]>([])
  const [listaEspera, setListaEspera] = useState<AsociadoSeleccionado[]>([])
  const [loading, setLoading] = useState(true)
  const [calculando, setCalculando] = useState(false)
  
  // Inputs globales (solo 4xMil Egreso, el Operativo se obtiene automáticamente)
  const [impuesto4xMilEgreso, setImpuesto4xMilEgreso] = useState('0.4')
  const [totalAsociados, setTotalAsociados] = useState(0)
  const [utilidadBrutaRepartible, setUtilidadBrutaRepartible] = useState(0)
  
  // Cálculos por cuota
  const [utilidadPorCuota, setUtilidadPorCuota] = useState(0)
  const [comisionAdminPorCuota, setComisionAdminPorCuota] = useState(0)
  const [porcentajeAdministracion, setPorcentajeAdministracion] = useState(8) // Porcentaje desde configuración
  
  // Cálculos de liquidación
  const [subtotal, setSubtotal] = useState(0)
  const [descuento4xMil, setDescuento4xMil] = useState(0)
  const [totalDeducciones, setTotalDeducciones] = useState(0)
  const [netoEntregar, setNetoEntregar] = useState(0)
  const [showPreLiquidacion, setShowPreLiquidacion] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // Historial
  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>([])
  const [controlLiquidaciones, setControlLiquidaciones] = useState<any[]>([])

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
    if (view === 'nueva' && totalAsociados > 0 && utilidadBrutaRepartible > 0) {
      calcularPorCuota().catch(error => {
        console.error('Error en calcularPorCuota:', error)
      })
    }
  }, [totalAsociados, utilidadBrutaRepartible])

  useEffect(() => {
    if (listaEspera.length > 0) {
      calcularLiquidacion()
    }
  }, [listaEspera, utilidadPorCuota, comisionAdminPorCuota, impuesto4xMilEgreso])

  const loadData = async () => {
    try {
      setLoading(true)
      const [sociosData, totalAsoc] = await Promise.all([
        getSocios(),
        obtenerTotalAsociados()
      ])
      setSocios(sociosData)
      setTotalAsociados(totalAsoc)
      
      if (view === 'historial') {
        await loadHistorial()
      }
    } catch (error) {
      console.error('Error loading data:', error)
      alert('Error al cargar los datos')
    } finally {
      setLoading(false)
    }
  }

  const loadHistorial = async () => {
    try {
      const liqData = await obtenerLiquidaciones()
      setLiquidaciones(liqData)
      
      // Cargar control de liquidaciones por separado
      try {
        const controlData = await obtenerControlLiquidaciones()
        setControlLiquidaciones(controlData)
      } catch (error) {
        console.error('Error loading control:', error)
        setControlLiquidaciones([])
      }
    } catch (error) {
      console.error('Error loading historial:', error)
    }
  }

  const calcularUtilidadBruta = async () => {
    try {
      setCalculando(true)
      // Ya no necesita el parámetro, obtiene automáticamente de gastos bancarios
      const utilidad = await calcularUtilidadBrutaRepartible()
      setUtilidadBrutaRepartible(utilidad)
    } catch (error) {
      console.error('Error calculating utilidad bruta:', error)
      alert('Error al calcular utilidad bruta')
    } finally {
      setCalculando(false)
    }
  }

  const calcularPorCuota = async () => {
    if (totalAsociados === 0) return
    
    // Obtener porcentaje de administración desde configuración nacional (id = 1)
    let porcentajeAdmin = 8 // Fallback por defecto: 8%
    try {
      const config = await obtenerConfiguracionNacional()
      if (config && config.porcentaje_administracion != null) {
        porcentajeAdmin = config.porcentaje_administracion
      }
    } catch (error) {
      console.warn('Error obteniendo porcentaje de administración, usando fallback 8%:', error)
    }
    
    // Guardar el porcentaje en estado para mostrar en UI
    setPorcentajeAdministracion(porcentajeAdmin)
    
    // Convertir porcentaje a decimal (ej: 8 -> 0.08)
    const porcentajeDecimal = porcentajeAdmin / 100
    
    const utilidadPorCuotaCalc = utilidadBrutaRepartible / totalAsociados
    const comisionPorCuotaCalc = (utilidadBrutaRepartible * porcentajeDecimal) / totalAsociados
    
    setUtilidadPorCuota(utilidadPorCuotaCalc)
    setComisionAdminPorCuota(comisionPorCuotaCalc)
  }

  const agregarAListaEspera = async (socio: Socio) => {
    // Verificar si ya está en la lista
    if (listaEspera.some(s => s.id === socio.id)) {
      alert('Este asociado ya está en la lista de espera')
      return
    }
    
    try {
      const socioId = typeof socio.id === 'string' ? parseInt(socio.id) : socio.id
      const capitalPendiente = await obtenerCapitalPendienteAsociado(socioId || 0)
      
      setListaEspera([...listaEspera, {
        id: socio.id!,
        nombre: socio.nombre,
        cedula: socio.cedula,
        capitalPendiente
      }])
      setBusqueda('')
      setSociosFiltrados([])
    } catch (error) {
      console.error('Error getting capital pendiente:', error)
      setListaEspera([...listaEspera, {
        id: socio.id!,
        nombre: socio.nombre,
        cedula: socio.cedula,
        capitalPendiente: 0
      }])
      setBusqueda('')
      setSociosFiltrados([])
    }
  }

  const removerDeListaEspera = (id: number | string) => {
    setListaEspera(listaEspera.filter(s => s.id !== id))
  }

  const calcularLiquidacion = async () => {
    if (listaEspera.length === 0) return
    
    const numCuotas = listaEspera.length
    const numInscripciones = listaEspera.length * 1 // Una inscripción por asociado
    
    const subtotalCalc = (numCuotas * 30000) + (numInscripciones * 10000) + (numCuotas * utilidadPorCuota) - (numCuotas * comisionAdminPorCuota)
    const descuento4xMilCalc = subtotalCalc * (parseFloat(impuesto4xMilEgreso) / 1000)
    const totalDeduccionesCalc = listaEspera.reduce((sum, s) => sum + s.capitalPendiente, 0)
    const netoCalc = subtotalCalc - descuento4xMilCalc - totalDeduccionesCalc
    
    setSubtotal(subtotalCalc)
    setDescuento4xMil(descuento4xMilCalc)
    setTotalDeducciones(totalDeduccionesCalc)
    setNetoEntregar(netoCalc)
  }

  const handleGenerarPreLiquidacion = async () => {
    if (listaEspera.length === 0) {
      alert('Agrega al menos un asociado a la lista de espera')
      return
    }
    
    // Calcular automáticamente la utilidad bruta si no está calculada
    if (utilidadBrutaRepartible === 0) {
      await calcularUtilidadBruta()
    }
    
    await calcularLiquidacion()
    setShowPreLiquidacion(true)
  }

  const handleFinalizarLiquidacion = async () => {
    if (listaEspera.length === 0) {
      alert('No hay asociados en la lista de espera')
      return
    }
    
    try {
      setSubmitting(true)
      
      // Obtener el 4xMil Operativo de gastos bancarios
      const { obtenerTotal4xMilOperativo } = await import('@/lib/gastos')
      const total4xMilOperativo = await obtenerTotal4xMilOperativo()
      
      const liquidacionData = {
        nombres_asociados: listaEspera.map(s => s.nombre),
        total_cuotas: listaEspera.length,
        total_inscripciones: listaEspera.length * 10000,
        total_utilidad: listaEspera.length * utilidadPorCuota,
        total_comision: listaEspera.length * comisionAdminPorCuota,
        subtotal: subtotal,
        descuento_4xmil: descuento4xMil,
        total_deducciones: totalDeducciones,
        neto_entregar: netoEntregar,
        impuesto_4xmil_operativo: total4xMilOperativo,
        impuesto_4xmil_egreso: parseFloat(impuesto4xMilEgreso) || 0.4,
        utilidad_bruta_repartible: utilidadBrutaRepartible,
        fecha_liquidacion: new Date().toISOString().split('T')[0]
      }
      
      await crearLiquidacion(liquidacionData)
      
      alert('Liquidación finalizada exitosamente')
      setListaEspera([])
      setShowPreLiquidacion(false)
      setBusqueda('')
      await loadHistorial()
    } catch (error) {
      console.error('Error finalizing liquidacion:', error)
      alert('Error al finalizar la liquidación')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEliminarLiquidacion = async (liquidacionId: number | string) => {
    if (!confirm('¿Estás seguro de revertir esta liquidación? Esta acción devolverá los asociados al estado "Por Liquidar".')) {
      return
    }
    
    try {
      await eliminarLiquidacion(liquidacionId)
      alert('Liquidación revertida exitosamente')
      await loadHistorial()
    } catch (error) {
      console.error('Error deleting liquidacion:', error)
      alert('Error al revertir la liquidación')
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
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Calculator className="w-8 h-8 text-white" />
            <h1 className="text-4xl font-bold text-white">Liquidación Anual</h1>
          </div>
          <div className="flex gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </Link>
            <button
              onClick={() => {
                setView(view === 'nueva' ? 'historial' : 'nueva')
                if (view === 'historial') {
                  loadHistorial()
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              {view === 'nueva' ? 'Ver Historial' : 'Nueva Liquidación'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setView('nueva')}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              view === 'nueva'
                ? 'bg-blue-700 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Nueva Liquidación
          </button>
          <button
            onClick={() => {
              setView('historial')
              loadHistorial()
            }}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              view === 'historial'
                ? 'bg-blue-700 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Historial de Asociados Liquidados
          </button>
        </div>

        {/* Nueva Liquidación */}
        {view === 'nueva' && (
          <div className="space-y-6">
            {/* Información y Botón de Calcular */}
            <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-4">Cálculos de Liquidación</h2>
              <p className="text-sm text-gray-400 mb-4">
                El 4xMil Operativo se obtiene automáticamente desde los Gastos Bancarios registrados. 
                Para agregar gastos, ve al Home y selecciona "Registrar Gasto Bancario (4xMil)".
              </p>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  4xMil de Egreso (%)
                </label>
                <input
                  type="number"
                  value={impuesto4xMilEgreso}
                  onChange={(e) => setImpuesto4xMilEgreso(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white max-w-xs"
                  step="0.1"
                />
              </div>
              
              <button
                onClick={calcularUtilidadBruta}
                disabled={calculando}
                className="px-6 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {calculando ? 'Calculando...' : 'Calcular Utilidad Bruta Repartible'}
              </button>
              
              {utilidadBrutaRepartible > 0 && (
                <div className="mt-4 p-4 bg-green-900 bg-opacity-50 border border-green-700 rounded-lg">
                  <p className="text-sm text-green-200">Utilidad Bruta Repartible:</p>
                  <p className="text-2xl font-bold text-white">${utilidadBrutaRepartible.toLocaleString()}</p>
                  <p className="text-xs text-green-300 mt-1">
                    Utilidad x Cuota: ${utilidadPorCuota.toLocaleString()}
                  </p>
                  <p className="text-xs text-green-300">
                    Comisión Admin x Cuota ({porcentajeAdministracion}%): ${comisionAdminPorCuota.toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            {/* Buscador */}
            <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
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
                        onClick={() => agregarAListaEspera(socio)}
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

            {/* Lista de Espera */}
            {listaEspera.length > 0 && (
              <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
                <h2 className="text-2xl font-bold text-white mb-4">
                  Lista de Espera ({listaEspera.length} asociado{listaEspera.length !== 1 ? 's' : ''})
                </h2>
                <div className="space-y-2">
                  {listaEspera.map((socio) => (
                    <div
                      key={socio.id}
                      className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-white">{socio.nombre}</p>
                        <p className="text-sm text-gray-400">
                          Capital Pendiente: ${socio.capitalPendiente.toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => removerDeListaEspera(socio.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={handleGenerarPreLiquidacion}
                    className="px-6 py-3 bg-green-700 text-white rounded-lg hover:bg-green-600 transition-colors"
                  >
                    Generar Pre-Liquidación
                  </button>
                </div>
              </div>
            )}

            {/* Pre-Liquidación Modal */}
            {showPreLiquidacion && (
              <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                <div className="bg-gray-800 rounded-lg shadow-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
                  <h2 className="text-2xl font-bold mb-4 text-white">Pre-Liquidación</h2>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-700 rounded-lg">
                        <p className="text-sm text-gray-400">Cuotas</p>
                        <p className="text-xl font-bold text-white">{listaEspera.length}</p>
                      </div>
                      <div className="p-4 bg-gray-700 rounded-lg">
                        <p className="text-sm text-gray-400">Inscripciones</p>
                        <p className="text-xl font-bold text-white">{listaEspera.length}</p>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-gray-700 rounded-lg">
                      <p className="text-sm text-gray-400">Subtotal</p>
                      <p className="text-2xl font-bold text-white">${subtotal.toLocaleString()}</p>
                    </div>
                    
                    <div className="p-4 bg-gray-700 rounded-lg">
                      <p className="text-sm text-gray-400">Descuento 4xMil Egreso</p>
                      <p className="text-2xl font-bold text-red-400">${descuento4xMil.toLocaleString()}</p>
                    </div>
                    
                    <div className="p-4 bg-gray-700 rounded-lg">
                      <p className="text-sm text-gray-400">Deducciones (Capital Pendiente)</p>
                      <p className="text-2xl font-bold text-red-400">${totalDeducciones.toLocaleString()}</p>
                    </div>
                    
                    <div className="p-4 bg-blue-900 bg-opacity-50 border-2 border-blue-700 rounded-lg">
                      <p className="text-sm text-blue-200">NETO A ENTREGAR</p>
                      <p className="text-3xl font-bold text-white">${netoEntregar.toLocaleString()}</p>
                    </div>
                    
                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleFinalizarLiquidacion}
                        disabled={submitting}
                        className="flex-1 px-6 py-3 bg-green-700 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                      >
                        {submitting ? 'Finalizando...' : 'Finalizar Liquidación'}
                      </button>
                      <button
                        onClick={() => setShowPreLiquidacion(false)}
                        className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                      >
                        Volver
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Historial */}
        {view === 'historial' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
              <div className="p-6 border-b border-gray-700">
                <h2 className="text-2xl font-bold text-white">Control de Liquidaciones</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full table-auto text-sm">
                  <thead>
                    <tr className="bg-gray-700 border-b border-gray-600">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">NOMBRE</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase">ESTADO</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase">ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {controlLiquidaciones.map((control) => (
                      <tr key={control.id} className="hover:bg-gray-700">
                        <td className="px-4 py-3 text-gray-300">{control.id}</td>
                        <td className="px-4 py-3 text-gray-300">{control.nombre}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            control.estado === 'LIQUIDADO'
                              ? 'bg-gray-600 text-gray-300'
                              : 'bg-green-600 text-white'
                          }`}>
                            {control.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex gap-2 justify-center">
                            {control.estado === 'LIQUIDADO' && (
                              <span className="text-xs text-gray-500">Ver liquidación en historial</span>
                            )}
                            {control.estado === 'Pendiente' && (
                              <span className="text-xs text-gray-500">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
              <div className="p-6 border-b border-gray-700">
                <h2 className="text-2xl font-bold text-white">Historial de Liquidaciones</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full table-auto text-sm">
                  <thead>
                    <tr className="bg-gray-700 border-b border-gray-600">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">ASOCIADOS</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase">NETO ENTREGAR</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">FECHA</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase">ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {liquidaciones.map((liq) => (
                      <tr key={liq.id} className="hover:bg-gray-700">
                        <td className="px-4 py-3 text-gray-300">{liq.id}</td>
                        <td className="px-4 py-3 text-gray-300">
                          {(liq.nombres_asociados || []).join(', ')}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-white">
                          ${(liq.neto_entregar || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {new Date(liq.fecha_liquidacion).toLocaleDateString('es-ES')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex gap-2 justify-center">
                            <Link
                              href={`/liquidacion/${liq.id}`}
                              className="text-blue-400 hover:text-blue-300"
                              title="Ver Liquidación"
                            >
                              <Eye className="w-4 h-4 inline" />
                            </Link>
                            <button
                              onClick={() => handleEliminarLiquidacion(liq.id!)}
                              className="text-red-400 hover:text-red-300"
                              title="Revertir Liquidación"
                            >
                              <Trash2 className="w-4 h-4 inline" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

