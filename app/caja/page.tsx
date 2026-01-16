'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Home, ArrowLeft, Wallet, X, Plus, Database, FileText } from 'lucide-react'
import { getAllPagos, obtenerTotalRecaudoCuotas } from '@/lib/pagos'
import { obtenerTotalRecaudadoMoras } from '@/lib/moras'
import { obtenerPrestamos, obtenerMovimientosPrestamo, obtenerTotalRecaudadoIntereses, obtenerTotalCapitalPrestado, obtenerTotalAbonosCapital } from '@/lib/prestamos'
import { supabase } from '@/lib/supabase'
import { obtenerMovimientosCaja, obtenerSaldoTotal, crearMovimientoCaja, obtenerUltimoSaldo, MovimientoCaja, calcularEstadosCaja } from '@/lib/caja'
import { obtenerConfiguracionNacional } from '@/lib/configuracion'
import { obtenerResumenInscripciones } from '@/lib/inscripciones'
import { obtenerTotalRecaudoActividades } from '@/lib/actividades'
import { obtenerTotalInversiones, obtenerTotalUtilidadInversiones } from '@/lib/inversiones'

interface IndicadoresCaja {
  recaudoTotal: number
  capitalPrestado: number
  abonosCapital: number
  gastos: number
  disponible: number
}

interface CuotaMes {
  mes: string
  cuotasPagadas: number
  valor: number
}

export default function CajaPage() {
  const [indicadores, setIndicadores] = useState<IndicadoresCaja>({
    recaudoTotal: 0,
    capitalPrestado: 0,
    abonosCapital: 0,
    gastos: 0,
    disponible: 0
  })
  const [cuotasPorMes, setCuotasPorMes] = useState<CuotaMes[]>([])
  const [movimientosCaja, setMovimientosCaja] = useState<MovimientoCaja[]>([])
  const [saldoCaja, setSaldoCaja] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [loadingDatosSecundarios, setLoadingDatosSecundarios] = useState(false)
  const [modalGastoAbierto, setModalGastoAbierto] = useState(false)
  const [formGasto, setFormGasto] = useState({
    fecha: new Date().toISOString().split('T')[0],
    concepto: '',
    monto: ''
  })
  const [valorCuotaConfig, setValorCuotaConfig] = useState<number>(30000) // Valor por defecto
  const [resumenInscripciones, setResumenInscripciones] = useState<{ cantidad: number; valorTotal: number }>({ cantidad: 0, valorTotal: 0 })

  const nombresMeses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  useEffect(() => {
    loadData()
  }, [])

  // FASE 1: Carga rápida - Solo datos esenciales para renderizar UI
  const loadDataFase1 = async () => {
    try {
      setLoading(true)
      let valorCuotaUsar = 30000
      
      // Cargar configuración nacional para obtener valor_cuota
      try {
        const config = await obtenerConfiguracionNacional()
        if (config && config.valor_cuota) {
          valorCuotaUsar = config.valor_cuota
          setValorCuotaConfig(config.valor_cuota)
        } else {
          setValorCuotaConfig(30000)
        }
      } catch (error) {
        console.warn('Error cargando configuración, usando valor por defecto:', error)
        setValorCuotaConfig(30000)
      }
      
      // Obtener saldo de caja_central (rápido)
      let saldoCajaCentral = 0
      try {
        saldoCajaCentral = await obtenerSaldoTotal()
        saldoCajaCentral = isNaN(saldoCajaCentral) ? 0 : saldoCajaCentral
        setSaldoCaja(saldoCajaCentral)
      } catch (e: any) {
        console.warn('⚠️ Error obteniendo saldo de caja:', e?.message)
        setSaldoCaja(0)
      }
      
      // Inicializar indicadores en 0 (se actualizarán en Fase 2)
      setIndicadores({
        recaudoTotal: 0,
        capitalPrestado: 0,
        abonosCapital: 0,
        gastos: 0,
        disponible: 0
      })
      
      // Inicializar arrays vacíos (se llenarán en Fase 2)
      setMovimientosCaja([])
      setCuotasPorMes([])
      setResumenInscripciones({ cantidad: 0, valorTotal: 0 })
      
    } catch (error: any) {
      console.error('❌ Error crítico en Fase 1:', error)
      setSaldoCaja(0)
      setMovimientosCaja([])
      setIndicadores({
        recaudoTotal: 0,
        capitalPrestado: 0,
        abonosCapital: 0,
        gastos: 0,
        disponible: 0
      })
      setCuotasPorMes([])
      setResumenInscripciones({ cantidad: 0, valorTotal: 0 })
    } finally {
      // IMPORTANTE: Renderizar UI lo antes posible
      setLoading(false)
    }
  }

  // FASE 2: Carga pesada - Datos secundarios y cálculos complejos
  const loadDataFase2 = async () => {
    try {
      setLoadingDatosSecundarios(true)
      
      // Obtener movimientos de caja (pesado)
      let movimientos: MovimientoCaja[] = []
      try {
        movimientos = await obtenerMovimientosCaja()
        setMovimientosCaja(Array.isArray(movimientos) ? movimientos : [])
      } catch (e: any) {
        console.warn('⚠️ Error obteniendo movimientos de caja:', e?.message)
        setMovimientosCaja([])
      }
      
      // Obtener pagos y préstamos en paralelo (pesados)
      let pagos: any[] = []
      let prestamos: any[] = []
      try {
        [pagos, prestamos] = await Promise.all([
          getAllPagos().catch(() => []),
          obtenerPrestamos().catch(() => [])
        ])
      } catch (e: any) {
        console.error('Error obteniendo pagos/préstamos:', e)
      }
      
      // Obtener valor de cuota desde estado (ya cargado en Fase 1)
      const valorCuotaUsar = valorCuotaConfig
      
      // REGLA OBLIGATORIA: Calcular TODO usando variables locales
      // NO usar valores de useState para cálculos
      
      // 1️⃣ Declarar variables locales para totales
      let totalCuotas = 0
      let totalMoras = 0
      let totalActividades = 0
      let totalInscripciones = 0
      let totalUtilidadInversiones = 0
      let totalInteresesPrestamos = 0
      let totalCapitalPrestado = 0
      let totalAbonosCapital = 0
      let totalInversiones = 0
      
      // 2️⃣ Asignar valores reales usando funciones existentes (en paralelo)
      let resumenInscripcionesResult: { cantidad: number; valorTotal: number } | null = null
      try {
        const [
          recaudoCuotas,
          totalInversionesResult,
          totalMorasResult,
          totalActividadesResult,
          resumenInscripcionesTemp,
          totalUtilidadInversionesResult,
          totalInteresesPrestamosResult,
          totalCapitalPrestadoResult,
          totalAbonosCapitalResult
        ] = await Promise.all([
          obtenerTotalRecaudoCuotas(),
          obtenerTotalInversiones(),
          obtenerTotalRecaudadoMoras(),
          obtenerTotalRecaudoActividades(),
          obtenerResumenInscripciones(),
          obtenerTotalUtilidadInversiones(),
          obtenerTotalRecaudadoIntereses(),
          obtenerTotalCapitalPrestado(),
          obtenerTotalAbonosCapital()
        ])

        totalCuotas = recaudoCuotas?.valorTotal || 0
        totalInversiones = totalInversionesResult || 0
        totalMoras = totalMorasResult || 0
        totalActividades = totalActividadesResult || 0
        resumenInscripcionesResult = resumenInscripcionesTemp
        totalInscripciones = resumenInscripcionesResult?.valorTotal || 0
        totalUtilidadInversiones = totalUtilidadInversionesResult || 0
        totalInteresesPrestamos = totalInteresesPrestamosResult || 0
        totalCapitalPrestado = totalCapitalPrestadoResult || 0
        totalAbonosCapital = totalAbonosCapitalResult || 0
      } catch (e: any) {
        console.error('Error obteniendo totales de caja:', e)
      }
      
      // Obtener gastos operativos desde calcularEstadosCaja (pesado)
      let estadosCaja: { disponible: number; gastosOperativos: number; totalIngresos: number; totalEgresos: number; recaudoTotal: number }
      try {
        estadosCaja = await calcularEstadosCaja()
      } catch (e: any) {
        console.error('Error calculando estados de caja:', e)
        estadosCaja = { disponible: 0, gastosOperativos: 0, totalIngresos: 0, totalEgresos: 0, recaudoTotal: 0 }
      }
      
      // IMPORTANTE: gastos YA vienen de estadosCaja.gastosOperativos
      // NO recalcular gastos
      const gastosOperativos = estadosCaja.gastosOperativos
      
      // 3️⃣ Calcular ÚNICAMENTE los 3 visores
      
      // 🔹 RECAUDO TOTAL
      const recaudoTotal = totalCuotas + totalMoras + totalActividades + totalInscripciones + totalUtilidadInversiones + totalInteresesPrestamos
      
      // 🔹 CAPITAL PRESTADO
      const capitalPrestado = totalCapitalPrestado + totalInversiones - totalAbonosCapital
      
      // 🔹 DISPONIBLE EN CAJA
      const disponible = recaudoTotal-totalCapitalPrestado+totalAbonosCapital -totalInversiones -gastosOperativos
      
      // 4️⃣ Al FINAL, hacer UN SOLO setIndicadores
      setIndicadores({
        recaudoTotal,
        capitalPrestado,
        abonosCapital: totalAbonosCapital,
        gastos: gastosOperativos,
        disponible
      })
      
      // Calcular cuotas por mes usando valor_cuota desde configuración
      const cuotasMes: CuotaMes[] = []
      for (let mes = 0; mes < 12; mes++) {
        const cuota1 = mes * 2 + 1
        const cuota2 = mes * 2 + 2
        const pagosMes = (Array.isArray(pagos) ? pagos : []).filter(p => {
          const numCuota = typeof p?.numero_cuota === 'string' ? parseInt(p.numero_cuota) : (p?.numero_cuota || 0)
          return (numCuota === cuota1 || numCuota === cuota2) && p?.pagado
        })
        cuotasMes.push({
          mes: nombresMeses[mes] || `Mes ${mes + 1}`,
          cuotasPagadas: pagosMes.length,
          valor: pagosMes.length * valorCuotaUsar // Usar valor desde configuración
        })
      }
      setCuotasPorMes(cuotasMes)

      // Establecer resumen de inscripciones (ya obtenido arriba, reutilizar)
      if (resumenInscripcionesResult) {
        setResumenInscripciones(resumenInscripcionesResult)
      } else {
        setResumenInscripciones({ cantidad: 0, valorTotal: 0 })
      }
      
    } catch (error: any) {
      console.error('❌ Error en Fase 2:', error)
      // No mostrar alertas en Fase 2 para no interrumpir la UX
    } finally {
      setLoadingDatosSecundarios(false)
    }
  }

  // Función principal que coordina ambas fases
  const loadData = async () => {
    // Fase 1: Carga rápida y renderiza UI
    await loadDataFase1()
    
    // Fase 2: Carga pesada en segundo plano (sin bloquear UI)
    loadDataFase2().catch(error => {
      console.error('Error en carga de datos secundarios:', error)
    })
  }

  const handleAbrirModalGasto = () => {
    setFormGasto({
      fecha: new Date().toISOString().split('T')[0],
      concepto: '',
      monto: ''
    })
    setModalGastoAbierto(true)
  }

  const handleCerrarModalGasto = () => {
    setModalGastoAbierto(false)
    setFormGasto({
      fecha: new Date().toISOString().split('T')[0],
      concepto: '',
      monto: ''
    })
  }

  // Función para formatear número con puntos de miles
  const formatearMonto = (valor: string): string => {
    // Remover todo excepto dígitos
    const soloNumeros = valor.replace(/\D/g, '')
    if (!soloNumeros) return ''
    // Formatear con puntos de miles
    return parseInt(soloNumeros, 10).toLocaleString('es-CO')
  }

  // Función para obtener el valor numérico limpio
  const obtenerValorNumerico = (valorFormateado: string): number => {
    const valorLimpio = valorFormateado.replace(/\D/g, '')
    return parseFloat(valorLimpio) || 0
  }

  const handleMontoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    // Si está vacío, permitir borrar
    if (inputValue === '') {
      setFormGasto({ ...formGasto, monto: '' })
      return
    }
    // Formatear mientras escribe
    const formateado = formatearMonto(inputValue)
    setFormGasto({ ...formGasto, monto: formateado })
  }

  const handleGuardarGasto = async () => {
    try {
      // Validar campos
      if (!formGasto.fecha || !formGasto.concepto.trim() || !formGasto.monto) {
        alert('Por favor completa todos los campos')
        return
      }

      const montoNum = obtenerValorNumerico(formGasto.monto)
      if (montoNum <= 0) {
        alert('El monto debe ser un número mayor a 0')
        return
      }

      // Obtener el saldo anterior (último saldo registrado)
      const saldoAnterior = await obtenerUltimoSaldo()
      const nuevoSaldo = saldoAnterior - montoNum // Restar porque es un EGRESO

      // Guardar como EGRESO en caja_central
      await crearMovimientoCaja({
        tipo: 'EGRESO',
        concepto: formGasto.concepto.trim(),
        monto: montoNum,
        saldo_anterior: saldoAnterior,
        nuevo_saldo: nuevoSaldo,
        fecha: formGasto.fecha
      })

      alert('Gasto de caja registrado correctamente')
      handleCerrarModalGasto()
      
      // Recargar datos para actualizar el visor (ambas fases)
      await loadData()
    } catch (error: any) {
      console.error('Error guardando gasto:', error)
      alert(error?.message || 'Error al guardar el gasto')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8 flex items-center justify-center">
        <p className="text-xl text-gray-400">Cargando información de caja...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Wallet className="w-8 h-8 text-white" />
            <div className="flex flex-col">
              <h1 className="text-4xl font-bold text-white">Caja Central</h1>
              {loadingDatosSecundarios && (
                <p className="text-xs text-gray-400 mt-1">Actualizando datos detallados...</p>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <Link
              href="/caja/movimientos"
              className="flex items-center gap-2 px-4 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded-lg transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>📜 Ver movimientos de caja</span>
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Regresar</span>
            </Link>
          </div>
        </div>

        {/* Indicadores */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-green-700 rounded-lg shadow-lg p-6 border border-green-600">
            <p className="text-sm text-green-200 mb-2">RECAUDO TOTAL</p>
            <p className="text-3xl font-bold text-white">
              ${(indicadores?.recaudoTotal || 0).toLocaleString()}
            </p>
          </div>
          
          <div className="bg-red-700 rounded-lg shadow-lg p-6 border border-red-600">
            <p className="text-sm text-red-200 mb-2">CAPITAL PRESTADO / INVERTIDO</p>
            <p className="text-3xl font-bold text-white">
              ${(indicadores?.capitalPrestado || 0).toLocaleString()}
            </p>
          </div>
          
          <div className="bg-yellow-700 rounded-lg shadow-lg p-6 border border-yellow-600 relative">
            <div className="mb-2">
              <p className="text-sm text-yellow-200 mb-3">GASTOS DE CAJA</p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleAbrirModalGasto}
                  className="flex items-center justify-center gap-1 px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-white text-xs rounded transition-colors w-full"
                  title="Registrar Gasto"
                >
                  <Plus className="w-3 h-3" />
                  Registrar Gasto
                </button>
                <Link
                  href="/caja/gastos"
                  className="flex items-center justify-center gap-1 px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-white text-xs rounded transition-colors w-full"
                  title="Ver Base de Datos de Gastos"
                >
                  <Database className="w-3 h-3" />
                  Ver Gastos
                </Link>
              </div>
            </div>
            <p className="text-3xl font-bold text-white mt-4">
              ${(indicadores?.gastos || 0).toLocaleString()}
            </p>
          </div>
          
          <div className={`rounded-lg shadow-lg p-6 border ${
            (indicadores?.disponible || 0) >= 0 
              ? 'bg-blue-700 border-blue-600' 
              : 'bg-orange-700 border-orange-600'
          }`}>
            <p className={`text-sm mb-2 ${
              (indicadores?.disponible || 0) >= 0 ? 'text-blue-200' : 'text-orange-200'
            }`}>
              DISPONIBLE EN CAJA
            </p>
            <p className={`text-3xl font-bold ${
              (indicadores?.disponible || 0) >= 0 ? 'text-white' : 'text-white'
            }`}>
              ${(indicadores?.disponible || 0).toLocaleString()}
            </p>
            <p className="text-xs mt-2 text-gray-300">
              Recaudo + Actividades - Prestado + Abonos - Gastos
            </p>
          </div>
        </div>

        {/* Tabla de Movimientos de Caja - OCULTA: movida a /caja/movimientos */}
        {/* Código comentado pero NO eliminado - ver app/caja/movimientos/page.tsx */}
        {/* 
        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700 mb-8">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-2xl font-bold text-white">Movimientos de Caja</h2>
            <p className="text-sm text-gray-400 mt-1">
              Saldo actual: <span className="font-semibold text-white">${saldoCaja.toLocaleString()}</span>
            </p>
          </div>
          <div className="overflow-x-auto">
            {movimientosCaja && movimientosCaja.length > 0 ? (
              <table className="w-full table-auto text-sm">
                <thead>
                  <tr className="bg-gray-700 border-b border-gray-600">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">FECHA</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">TIPO</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">CONCEPTO</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase">MONTO</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase">SALDO ANTERIOR</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase">NUEVO SALDO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {movimientosCaja.map((movimiento, index) => (
                    <tr key={movimiento.id || index} className="hover:bg-gray-700">
                      <td className="px-4 py-3 text-gray-300">{movimiento.fecha || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          movimiento.tipo === 'INGRESO' 
                            ? 'bg-green-600 text-white' 
                            : 'bg-red-600 text-white'
                        }`}>
                          {movimiento.tipo || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{movimiento.concepto || '-'}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${
                        movimiento.tipo === 'INGRESO' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        ${(parseFloat(String(movimiento.monto || 0)) || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        ${(parseFloat(String(movimiento.saldo_anterior || 0)) || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-200">
                        ${(parseFloat(String(movimiento.nuevo_saldo || 0)) || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center">
                <p className="text-gray-400 text-lg">Sin movimientos</p>
                <p className="text-gray-500 text-sm mt-2">
                  {saldoCaja === 0 
                    ? 'La tabla caja_central está vacía o no hay registros' 
                    : 'No se encontraron movimientos en la base de datos'}
                </p>
              </div>
            )}
          </div>
        </div>
        */}

        {/* Tabla de Cuotas */}
        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-2xl font-bold text-white">Cuotas por Mes</h2>
            <p className="text-sm text-gray-400 mt-1">Conteo de cuotas pagadas y valor total (${valorCuotaConfig.toLocaleString()} c/u)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-auto text-sm">
              <thead>
                <tr className="bg-gray-700 border-b border-gray-600">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">MES</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase">CUOTAS PAGADAS</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase">VALOR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {(cuotasPorMes || []).map((cuota, index) => (
                  <tr key={index} className="hover:bg-gray-700">
                    <td className="px-4 py-3 text-gray-300 font-medium">{cuota?.mes || `Mes ${index + 1}`}</td>
                    <td className="px-4 py-3 text-right text-gray-300 font-semibold">
                      {(cuota?.cuotasPagadas || 0) > 0 ? cuota.cuotasPagadas : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-200">
                      ${(cuota?.valor || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-700 border-t-2 border-gray-600">
                  <td className="px-4 py-3 text-gray-300 font-bold">TOTAL</td>
                  <td className="px-4 py-3 text-right text-gray-300 font-bold">
                    {(cuotasPorMes || []).reduce((sum, c) => sum + (c?.cuotasPagadas || 0), 0)} cuotas
                  </td>
                  <td className="px-4 py-3 text-right text-white font-bold text-lg">
                    ${(cuotasPorMes || []).reduce((sum, c) => sum + (c?.valor || 0), 0).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Resumen de Inscripciones */}
        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-2xl font-bold text-white">Inscripciones</h2>
            <p className="text-sm text-gray-400 mt-1">Resumen de inscripciones pagadas</p>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-gray-300 font-medium">
                  {resumenInscripciones.cantidad} {resumenInscripciones.cantidad === 1 ? 'inscripción' : 'inscripciones'}
                </span>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">
                  ${resumenInscripciones.valorTotal.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Registro de Gasto */}
      {modalGastoAbierto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-2xl font-bold text-white">Registrar Gasto</h2>
              <button
                onClick={handleCerrarModalGasto}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Fecha <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formGasto.fecha}
                  onChange={(e) => setFormGasto({ ...formGasto, fecha: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Concepto <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formGasto.concepto}
                  onChange={(e) => setFormGasto({ ...formGasto, concepto: e.target.value })}
                  placeholder="Ej: 4xMil Operativo, Gastos bancarios, etc."
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Monto <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formGasto.monto}
                  onChange={handleMontoChange}
                  placeholder="Ej: 10000 o 10.000"
                  inputMode="numeric"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  Puedes escribir el número directamente. Se formateará automáticamente.
                </p>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-700">
              <button
                onClick={handleCerrarModalGasto}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarGasto}
                className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg transition-colors font-semibold"
              >
                Guardar Gasto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
