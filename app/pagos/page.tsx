'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Home, Share2, AlertCircle } from 'lucide-react'
import { Socio, PagoCuota } from '@/lib/supabase'
import { getSocios } from '@/lib/socios'
import { 
  generarFechasVencimiento, 
  calcularEstadoCuota, 
  getAllPagos, 
  registrarPago,
  actualizarPagoCuota,
  eliminarPago,
  dateFromInput
} from '@/lib/pagos'
import { obtenerConfiguracionNacional } from '@/lib/configuracion'

export default function PagosPage() {
  const [socios, setSocios] = useState<Socio[]>([])
  const [pagos, setPagos] = useState<PagoCuota[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCuota, setSelectedCuota] = useState<{ cedula: string, numeroCuota: number } | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0])
  const [submitting, setSubmitting] = useState(false)
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().getMonth())
  const [montoMoraCalculado, setMontoMoraCalculado] = useState(0)
  const [morasDB, setMorasDB] = useState<any[]>([]) // Para almacenar moras de la BD
  const [configuracion, setConfiguracion] = useState<{ valor_cuota: number; valor_dia_mora: number } | null>(null)

  const fechasVencimiento = generarFechasVencimiento()
  const NUM_COLUMNAS = 6
  
  // Valores por defecto si no hay configuración
  const VALOR_CUOTA_DEFAULT = 30000
  const VALOR_MORA_DIARIA_DEFAULT = 3000
  const MAX_MONTO_MORA_DEFAULT = 45000

  // Obtener las cuotas del mes seleccionado (2 cuotas por mes)
  const obtenerCuotasDelMes = (mes: number) => {
    // Mes 0 = Enero, cada mes tiene 2 cuotas
    const primeraCuota = mes * 2 + 1
    const segundaCuota = mes * 2 + 2
    return [primeraCuota, segundaCuota]
  }

  const nombresMeses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const { supabase } = await import('@/lib/supabase')
      
      // Cargar configuración nacional primero
      try {
        const config = await obtenerConfiguracionNacional()
        if (config) {
          setConfiguracion({
            valor_cuota: config.valor_cuota || VALOR_CUOTA_DEFAULT,
            valor_dia_mora: config.valor_dia_mora || VALOR_MORA_DIARIA_DEFAULT
          })
        } else {
          // Si no hay configuración, usar valores por defecto
          setConfiguracion({
            valor_cuota: VALOR_CUOTA_DEFAULT,
            valor_dia_mora: VALOR_MORA_DIARIA_DEFAULT
          })
        }
      } catch (error) {
        console.warn('Error cargando configuración, usando valores por defecto:', error)
        setConfiguracion({
          valor_cuota: VALOR_CUOTA_DEFAULT,
          valor_dia_mora: VALOR_MORA_DIARIA_DEFAULT
        })
      }
      
      const [sociosData, pagosData] = await Promise.all([
        getSocios(),
        getAllPagos()
      ])
      setSocios(sociosData)
      setPagos(pagosData)
      
      // Cargar moras de la tabla moras
      // REGLA: Si existe un registro en moras con resta > 0, la mora está PENDIENTE
      // La existencia del registro es la única fuente de verdad (no hay columna estado)
      try {
        const { data: morasData, error: errorMoras } = await supabase
          .from('moras')
          .select('*')
          .gt('resta', 0) // Solo traer moras pendientes (resta > 0)
        
        if (errorMoras) {
          console.error('Error cargando moras:', errorMoras)
          setMorasDB([])
        } else {
          setMorasDB(morasData || [])
        }
      } catch (error) {
        console.error('Error cargando moras:', error)
        setMorasDB([])
      }
    } catch (error) {
      console.error('Error loading data:', error)
      alert('Error al cargar los datos. Verifica tu conexión a Supabase.')
    } finally {
      setLoading(false)
    }
  }

  const getPagoSocio = (cedula: string, numeroCuota: number): PagoCuota | undefined => {
    return pagos.find(p => p.cedula === cedula && p.numero_cuota === numeroCuota)
  }

  /**
   * Calcula el estado de una cuota
   * REGLA: Usa la MISMA lógica de mora que pagos.ts
   * REGLA: Define fechaInicioMora según la cuota
   * REGLA: Si fechaPago >= fechaInicioMora, hay mora (carita ROJA)
   * REGLA: El día 17 de enero DEBE mostrar carita roja
   */
  const getEstadoCuota = (
    cedula: string,
    numeroCuota: number,
    fechaPagoSeleccionada: Date // OBLIGATORIO: fecha explícita, NO fechaActual
  ) => {
    const fechaVencimiento = fechasVencimiento[numeroCuota - 1]
    const pago = getPagoSocio(cedula, numeroCuota)

    // 1. Verificar si existe mora PENDIENTE en la tabla moras (fuente de verdad prioritaria)
    // REGLA: Si existe un registro en moras con resta > 0, la mora está PENDIENTE
    const socio = socios.find(s => s.cedula === cedula)
    if (socio) {
      const socioId = typeof socio.id === 'string' ? parseInt(socio.id) : socio.id
      const moraPendiente = morasDB.find((mora: any) => {
        const moraAsociadoId = typeof mora.asociado_id === 'string' ? parseInt(mora.asociado_id) : mora.asociado_id
        return moraAsociadoId === socioId && mora.cuota === numeroCuota && parseFloat(mora.resta || 0) > 0
      })
      
      if (moraPendiente) {
        // Existe mora pendiente en BD → carita ROJA
        return {
          estado: 'mora' as const,
          montoMora: parseFloat(moraPendiente.total_sancion) || parseFloat(moraPendiente.resta) || 0
        }
      }
    }

    // 2. Calcular estado usando la MISMA lógica que pagos.ts
    // Normalizar TODAS las fechas con setHours(0,0,0,0)
    const fechaPagoNorm = new Date(
      fechaPagoSeleccionada.getFullYear(),
      fechaPagoSeleccionada.getMonth(),
      fechaPagoSeleccionada.getDate(),
      0, 0, 0, 0
    )

    const fechaVencNorm = new Date(
      fechaVencimiento.getFullYear(),
      fechaVencimiento.getMonth(),
      fechaVencimiento.getDate(),
      0, 0, 0, 0
    )

    // SOLO es pagado cuando el pago es ANTES del vencimiento (no igual ni después)
    if (fechaPagoNorm.getTime() < fechaVencNorm.getTime()) {
      return {
        estado: pago?.pagado ? 'pagado' as const : 'pendiente' as const,
        montoMora: 0
      }
    }

    // Si se paga el mismo día del vencimiento o después, puede haber mora
    // (el mismo día del vencimiento NO genera mora, pero tampoco es "pagado" si hay mora pendiente)

    // REGLA: La mora existe si fechaPago > fechaVencimiento
    // Verificar que sean del mismo mes y año (cada cuota es independiente)
    const mismoMesYAno = (
      fechaPagoNorm.getMonth() === fechaVencNorm.getMonth() &&
      fechaPagoNorm.getFullYear() === fechaVencNorm.getFullYear()
    )
    
    if (!mismoMesYAno) {
      // Si son de meses diferentes, no hay mora (cada cuota es independiente)
      return {
        estado: pago?.pagado ? 'pagado' as const : 'pendiente' as const,
        montoMora: 0
      }
    }

    // REGLA: Calcular días de mora usando floor((fechaPago - fechaVencimiento) / día)
const diffMs = fechaPagoNorm.getTime() - fechaVencNorm.getTime()
const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))

// ✅ SI ES EL MISMO DÍA O ANTES → NO HAY MORA
if (diffDias <= 0) {
  if (pago?.pagado) {
    return {
      estado: 'pagado' as const,
      montoMora: 0
    }
  }

  return {
    estado: 'pendiente' as const,
    montoMora: 0
  }
}

// Usar valores desde configuración (solo para visualización en UI)
const valorDiaMora = configuracion?.valor_dia_mora ?? VALOR_MORA_DIARIA_DEFAULT
const maxDiasMora = 15
const maxMontoMora = maxDiasMora * valorDiaMora

// Solo aquí hay mora real
const diasMora = Math.min(maxDiasMora, diffDias)
const montoMora = Math.min(maxMontoMora, diasMora * valorDiaMora)

return {
  estado: 'mora' as const,
  montoMora
}

    // Sin mora
    if (pago?.pagado) {
      return {
        estado: 'pagado' as const,
        montoMora: 0
      }
    }

    // PENDIENTE (amarillo)
    return {
      estado: 'pendiente' as const,
      montoMora: 0
    }
  }
  

  const cuotasDelMes = obtenerCuotasDelMes(mesSeleccionado)

  const handleCaritaClick = (cedula: string, numeroCuota: number) => {
    setSelectedCuota({ cedula, numeroCuota })
    setShowModal(true)
    
    const pago = getPagoSocio(cedula, numeroCuota)
    if (pago?.fecha_pago) {
      // Usar la fecha del pago existente
      setFechaPago(pago.fecha_pago)
      // Recalcular mora usando la función centralizada
      const fechaVencimiento = fechasVencimiento[numeroCuota - 1]
      const fechaPagoDate = dateFromInput(pago.fecha_pago)
      const estado = getEstadoCuota(cedula, numeroCuota, fechaPagoDate)
      setMontoMoraCalculado(estado.montoMora)
    } else {
      // Si no hay pago, usar fecha de hoy (formato YYYY-MM-DD)
      const hoy = new Date()
      const fechaHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
      setFechaPago(fechaHoy)
      
      // Recalcular mora usando la función centralizada
      const fechaVencimiento = fechasVencimiento[numeroCuota - 1]
      const estado = getEstadoCuota(cedula, numeroCuota, hoy)
      setMontoMoraCalculado(estado.montoMora)
    }
  }

  const handleRegistrarPago = async () => {
    if (!selectedCuota) return

    try {
      setSubmitting(true)
      const fechaVencimiento = fechasVencimiento[selectedCuota.numeroCuota - 1]
      // Normalizar fecha usando helper para evitar desfase UTC
      const fechaPagoDate = dateFromInput(fechaPago)

      // Verificar si el pago ya existe
      const cuotaSeleccionada = pagos.find(
        p => p.cedula === selectedCuota.cedula && p.numero_cuota === selectedCuota.numeroCuota
      )

      if (cuotaSeleccionada?.pagado) {
        // Si el pago ya existe, usar actualizarPagoCuota (NO toca caja)
        await actualizarPagoCuota(
          selectedCuota.cedula,
          selectedCuota.numeroCuota,
          fechaPagoDate,
          fechaPago
        )
        alert('Pago actualizado exitosamente')
      } else {
        // Si no existe, usar registrarPago (crea movimiento en caja)
        await registrarPago(
          selectedCuota.cedula,
          selectedCuota.numeroCuota,
          fechaVencimiento,
          fechaPagoDate,
          fechaPago
        )
        alert('Pago registrado exitosamente')
      }

      // Recargar datos para actualizar estado y caritas (incluye moras)
      await loadData()
      
      setShowModal(false)
      setSelectedCuota(null)
      setMontoMoraCalculado(0)
    } catch (error: any) {
      console.error('Error registering/updating pago:', error)
      alert('Error: ' + (error?.message || 'Error desconocido'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleEliminarPago = async () => {
    if (!selectedCuota) return

    if (!confirm('¿Estás seguro de que deseas eliminar este pago?')) {
      return
    }

    try {
      await eliminarPago(selectedCuota.cedula, selectedCuota.numeroCuota)
      await loadData()
      setShowModal(false)
      setSelectedCuota(null)
      alert('Pago eliminado exitosamente')
    } catch (error) {
      console.error('Error deleting pago:', error)
      alert('Error al eliminar el pago')
    }
  }

  const getCaritaColor = (
    estado: 'pagado' | 'pendiente' | 'mora',
    estaRetirado: boolean
  ) => {
    if (estaRetirado) {
      return 'bg-gray-400 cursor-not-allowed opacity-60'
    }
  
    switch (estado) {
      case 'pagado':
        return 'bg-green-500 hover:bg-green-600'
      case 'pendiente':
        return 'bg-yellow-500 hover:bg-yellow-600'
      case 'mora':
        return 'bg-red-500 hover:bg-red-600'
      default:
        return 'bg-gray-300'
    }
  }
  

  const getCaritaEmoji = (
    estado: 'pagado' | 'pendiente' | 'mora',
    estaRetirado: boolean
  ) => {
    if (estaRetirado) {
      return '😶'
    }
  
    switch (estado) {
      case 'pagado':
        return '😊'
      case 'pendiente':
        return '😐'
      case 'mora':
        return '😞'
      default:
        return '⚪'
    }
  }
  

  // Expandir socios por cupos y crear lista plana con índice
  const expandirSociosConIndice = () => {
    const listaExpandida: Array<{ socio: Socio, cupoIndex: number, numeroFila: number }> = []
    let numeroFila = 1

    socios.forEach((socio) => {
      const cantidadCupos = socio.cantidad_cupos || 1
      for (let cupoIndex = 0; cupoIndex < cantidadCupos; cupoIndex++) {
        listaExpandida.push({ socio, cupoIndex, numeroFila })
        numeroFila++
      }
    })

    return listaExpandida
  }

  // Distribuir socios en 6 columnas de forma balanceada
  const distribuirEnColumnas = () => {
    const listaExpandida = expandirSociosConIndice()
    const totalSocios = listaExpandida.length
    const sociosPorColumna = Math.floor(totalSocios / NUM_COLUMNAS)
    const columnasExtra = totalSocios % NUM_COLUMNAS

    const columnas: Array<Array<{ socio: Socio, cupoIndex: number, numeroFila: number }>> = []
    let indiceActual = 0

    for (let col = 0; col < NUM_COLUMNAS; col++) {
      // Las primeras 'columnasExtra' columnas tendrán un socio más
      const cantidadEnColumna = sociosPorColumna + (col < columnasExtra ? 1 : 0)
      const columna = listaExpandida.slice(indiceActual, indiceActual + cantidadEnColumna)
      columnas.push(columna)
      indiceActual += cantidadEnColumna
    }

    return columnas
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8 flex items-center justify-center">
        <p className="text-xl text-gray-600 dark:text-gray-400">Cargando datos...</p>
      </div>
    )
  }

  // Esta variable se calcula dentro del modal, no es necesaria aquí
  // const cuotaSeleccionada = selectedCuota ? getPagoSocio(selectedCuota.cedula, selectedCuota.numeroCuota) : null
  
  // Calcular distribución de columnas una sola vez
  const columnasDistribuidas = distribuirEnColumnas()
  const maxFilas = Math.max(...columnasDistribuidas.map(col => col.length), 0)

  const handleShareWhatsApp = () => {
    const url = window.location.href
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`Registro de Cuotas - MiNati2026\n${url}`)}`
    window.open(whatsappUrl, '_blank')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-[95vw] mx-auto">
        {/* Navegación */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white">
            Registro de Cuotas
          </h1>
          <div className="flex gap-3 items-center">
            <div className="flex items-center gap-2">
              <label htmlFor="mesSelector" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Mes:
              </label>
              <select
                id="mesSelector"
                value={mesSeleccionado}
                onChange={(e) => setMesSeleccionado(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                {nombresMeses.map((mes, index) => (
                  <option key={index} value={index}>
                    {mes}
                  </option>
                ))}
              </select>
            </div>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Volver al Home</span>
            </Link>
            <button
              onClick={handleShareWhatsApp}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <Share2 className="w-4 h-4" />
              <span>Compartir en WhatsApp</span>
            </button>
            <Link
              href="/moras"
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              <AlertCircle className="w-4 h-4" />
              <span>Ver Moras</span>
            </Link>
          </div>
        </div>

        {/* Título Central del Mes */}
        <div className="text-center mb-6">
          <h2 className="text-5xl font-bold text-gray-800 dark:text-white">
            {nombresMeses[mesSeleccionado].toUpperCase()}
          </h2>
        </div>
        
        <div className="mb-4 p-4 bg-blue-100 dark:bg-blue-900 rounded-lg text-sm text-blue-800 dark:text-blue-200">
          <p className="font-semibold mb-2">Leyenda:</p>
          <div className="flex flex-wrap gap-4">
            <span className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">😊</span>
              <span>Pagado</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center">😐</span>
              <span>Pendiente</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">😞</span>
              <span>Mora</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center">😶</span>
              <span>Retirado</span>
            </span>
          </div>
        </div>

        {/* Tablero de Socios en 6 Columnas */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 overflow-x-auto">
          <div className="grid grid-cols-6 gap-3 min-w-max">
            {columnasDistribuidas.map((columna, colIndex) => (
              <div key={colIndex} className="flex flex-col min-w-[160px]">
                {/* Header de columna */}
                <div className="border-b-2 border-gray-300 dark:border-gray-600 pb-1 mb-2 sticky top-0 bg-white dark:bg-gray-800 z-10">
                  <div className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase">
                    ASOCIADO
                  </div>
                  <div className="flex gap-1 items-center text-[10px] font-semibold text-gray-600 dark:text-gray-400">
                    <div className="w-6 text-center">ID</div>
                    <div className="w-6 text-center">C1</div>
                    <div className="w-6 text-center">C2</div>
                  </div>
                </div>

                {/* Filas de la columna */}
                <div className="space-y-0.5">
                  {columna.map((item) => {
                    const cantidadCupos = item.socio.cantidad_cupos || 1
                    const nombreDisplay = cantidadCupos > 1 
                      ? `${item.socio.nombre} ${item.cupoIndex + 1}`
                      : item.socio.nombre
                    
                    // Usar fecha de hoy para calcular estado (si no hay pago, usa hoy; si hay pago, usa fecha del pago)
                    const pago1 = getPagoSocio(item.socio.cedula, cuotasDelMes[0])
                    const pago2 = getPagoSocio(item.socio.cedula, cuotasDelMes[1])
                    const fechaReferencia1 = pago1?.fecha_pago 
                      ? new Date(pago1.fecha_pago) 
                      : new Date()
                    const fechaReferencia2 = pago2?.fecha_pago 
                      ? new Date(pago2.fecha_pago) 
                      : new Date()
                    
                    const estadoCuota1 = getEstadoCuota(item.socio.cedula, cuotasDelMes[0], fechaReferencia1)
                    const estadoCuota2 = getEstadoCuota(item.socio.cedula, cuotasDelMes[1], fechaReferencia2)
                    const estaRetirado = item.socio.activo === false
                    
                    return (
                      <div
                        key={`${item.socio.id}-${item.cupoIndex}`}
                        className="border-b border-gray-200 dark:border-gray-700 pb-1 text-[11px]"
                      >
                        <div className={`font-medium mb-0.5 truncate ${estaRetirado ? 'text-gray-500 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                          {nombreDisplay}
                        </div>
                        <div className="flex gap-1 items-center">
                          <div className="w-6 text-center text-gray-600 dark:text-gray-400 font-semibold text-[10px]">
                            {item.numeroFila}
                          </div>
                          <button
                            onClick={() => !estaRetirado && handleCaritaClick(item.socio.cedula, cuotasDelMes[0])}
                            disabled={estaRetirado}
                            className={`w-6 h-6 rounded-full ${getCaritaColor(estadoCuota1.estado, estaRetirado)} text-white flex items-center justify-center transition-colors flex-shrink-0 ${estaRetirado ? '' : 'cursor-pointer'}`}
                            title={estaRetirado ? 'Socio retirado' : `Cuota ${cuotasDelMes[0]} - ${fechasVencimiento[cuotasDelMes[0] - 1].toLocaleDateString('es-ES')} - ${estadoCuota1.estado}`}
                          >
                            <span className="text-[10px]">{getCaritaEmoji(estadoCuota1.estado, estaRetirado)}</span>
                          </button>
                          <button
                            onClick={() => !estaRetirado && handleCaritaClick(item.socio.cedula, cuotasDelMes[1])}
                            disabled={estaRetirado}
                            className={`w-6 h-6 rounded-full ${getCaritaColor(estadoCuota2.estado, estaRetirado)} text-white flex items-center justify-center transition-colors flex-shrink-0 ${estaRetirado ? '' : 'cursor-pointer'}`}
                            title={estaRetirado ? 'Socio retirado' : `Cuota ${cuotasDelMes[1]} - ${fechasVencimiento[cuotasDelMes[1] - 1].toLocaleDateString('es-ES')} - ${estadoCuota2.estado}`}
                          >
                            <span className="text-[10px]">{getCaritaEmoji(estadoCuota2.estado, estaRetirado)}</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  
                  {/* Espaciador para mantener alineación si la columna tiene menos filas */}
                  {Array.from({ length: maxFilas - columna.length }).map((_, index) => (
                    <div key={`spacer-${index}`} className="h-10" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal para registrar pago */}
        {showModal && selectedCuota && (() => {
          // Calcular estado en tiempo real basado en la fecha seleccionada
          const fechaVencimiento = fechasVencimiento[selectedCuota.numeroCuota - 1]
          const fechaPagoDate = dateFromInput(fechaPago)
          const estadoSeleccionado = getEstadoCuota(selectedCuota.cedula, selectedCuota.numeroCuota, fechaPagoDate)
          const cuotaSeleccionada = getPagoSocio(selectedCuota.cedula, selectedCuota.numeroCuota)
          
          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
                  Registrar Pago
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Socio:</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {socios.find(s => s.cedula === selectedCuota.cedula)?.nombre}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Cuota:</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      #{selectedCuota.numeroCuota} - Vence: {fechaVencimiento.toLocaleDateString('es-ES')}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Estado calculado:</p>
                    <p className={`font-semibold capitalize ${estadoSeleccionado.estado === 'mora' ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                      {estadoSeleccionado.estado}
                      {estadoSeleccionado.montoMora > 0 && ` (Mora: $${estadoSeleccionado.montoMora.toLocaleString()})`}
                    </p>
                  </div>

                  <div>
                    <label htmlFor="fechaPago" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Fecha de Pago *
                    </label>
                    <input
                      type="date"
                      id="fechaPago"
                      value={fechaPago}
                      onChange={(e) => {
                        setFechaPago(e.target.value)
                        
                        // RECALCULAR EN TIEMPO REAL usando la función centralizada
                        // PROHIBIDO calcular mora en el frontend
                        if (selectedCuota) {
                          const fechaVencimiento = fechasVencimiento[selectedCuota.numeroCuota - 1]
                          // Normalizar fecha usando helper para evitar desfase UTC
                          const fechaPagoDate = dateFromInput(e.target.value)
                          
                          // Usar getEstadoCuota para recalcular (única fuente de verdad)
                          const estado = getEstadoCuota(selectedCuota.cedula, selectedCuota.numeroCuota, fechaPagoDate)
                          setMontoMoraCalculado(estado.montoMora)
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      required
                    />
                  </div>

                  <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Monto a pagar:</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      ${(configuracion?.valor_cuota ?? VALOR_CUOTA_DEFAULT).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Cuota: ${(configuracion?.valor_cuota ?? VALOR_CUOTA_DEFAULT).toLocaleString()}
                    </p>
                    {montoMoraCalculado > 0 && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-semibold">
                        ⚠️ Este pago generará una deuda de ${montoMoraCalculado.toLocaleString()} en el Control de Moras (no se cobra ahora)
                      </p>
                    )}
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleRegistrarPago}
                      disabled={submitting}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {cuotaSeleccionada?.pagado ? 'Actualizar Pago' : 'Registrar Pago'}
                    </button>
                    
                    {cuotaSeleccionada?.pagado && (
                      <button
                        onClick={handleEliminarPago}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                      >
                        Eliminar
                      </button>
                    )}
                    
                    <button
                      onClick={() => {
                        setShowModal(false)
                        setSelectedCuota(null)
                        setMontoMoraCalculado(0)
                      }}
                      className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
