'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Home, AlertCircle, Printer } from 'lucide-react'

interface MovimientoCalculado {
  id: number | string | undefined
  prestamo_id: number | string
  fecha: string
  tipo_movimiento: string
  valor_pagado: number
  interes_causado: number
  interes_pagado: number
  interes_pendiente: number
  abono_capital: number
  saldo_pendiente: number
  capital_pendiente: number
  dias_causados: number
  tipo_display: string
}

interface PrestamoPublico {
  id?: number | string
  nombre_prestamista: string
  monto: number
  tasa_interes: number
  fecha_inicio: string
  estado: string
}

interface ExtractoPublico {
  prestamo: PrestamoPublico
  movimientos: MovimientoCalculado[]
}

function dateFromInput(fecha: string): Date {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100
}

export default function ExtractoPublicoPage() {
  const params = useParams()
  const token = params.token as string

  const [data, setData] = useState<ExtractoPublico | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (token) {
      loadExtracto()
    }
  }, [token])

  const loadExtracto = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/prestamos/public/${token}`)
      if (!response.ok) {
        if (response.status === 404) {
          setError('Enlace inválido o expirado')
        } else {
          setError('Error al cargar el extracto')
        }
        return
      }

      const extractoData: ExtractoPublico = await response.json()
      setData(extractoData)
    } catch (err) {
      console.error('Error cargando extracto público:', err)
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const handleImprimir = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    window.print()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8 flex items-center justify-center">
        <p className="text-xl text-gray-400">Cargando extracto...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8 flex items-center justify-center">
        <div className="bg-gray-800 rounded-lg shadow-lg p-8 max-w-md">
          <div className="flex items-center gap-3 text-red-400 mb-4">
            <AlertCircle className="w-6 h-6" />
            <h2 className="text-xl font-semibold">Error</h2>
          </div>
          <p className="text-gray-400 mb-6">
            {error || 'No se pudo cargar el extracto'}
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Volver al inicio</span>
          </a>
        </div>
      </div>
    )
  }

  const { prestamo, movimientos } = data
  const tasaInteres = prestamo.tasa_interes || 0
  const numeroCredito = `NAT${String(prestamo.id || '').padStart(4, '0')}`

  // Calcular "Saldo a la Fecha"
  const calcularSaldoALaFecha = (): number => {
    if (movimientos.length === 0) return redondear(prestamo.monto)
    if (movimientos.length > 0 && movimientos[movimientos.length - 1].capital_pendiente <= 0) return 0

    let ultimoMovimientoReal: MovimientoCalculado | null = null
    for (let i = movimientos.length - 1; i >= 0; i--) {
      const mov = movimientos[i]
      if (mov.tipo_movimiento !== 'sin_pago' && mov.id !== undefined) {
        ultimoMovimientoReal = mov
        break
      }
    }

    if (!ultimoMovimientoReal) {
      return redondear(prestamo.monto)
    }

    const capitalPendienteActual = ultimoMovimientoReal.capital_pendiente || prestamo.monto
    const interesPendienteAnterior = ultimoMovimientoReal.interes_pendiente || 0
    const fechaUltimoMovimiento = dateFromInput(ultimoMovimientoReal.fecha)
    const fechaHoy = new Date()
    fechaHoy.setHours(0, 0, 0, 0)
    const diasDesdeUltimoMovimiento = Math.max(0, Math.floor((fechaHoy.getTime() - fechaUltimoMovimiento.getTime()) / (1000 * 60 * 60 * 24)))

    const interesDiario = (capitalPendienteActual * tasaInteres) / 100 / 30
    const interesCausadoPorDias = interesDiario * diasDesdeUltimoMovimiento
    const interesCausadoHastaHoy = redondear(interesCausadoPorDias + interesPendienteAnterior)

    return redondear(capitalPendienteActual + interesCausadoHastaHoy)
  }

  const saldoALaFecha = calcularSaldoALaFecha()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Encabezado del Extracto */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6 border border-gray-700">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-white mb-2">EXTRACTO DE CRÉDITO</h2>
            <p className="text-gray-400">CREDITO NO. {numeroCredito}</p>
            <p className="text-sm text-gray-500 mt-1">Fecha extracto: {new Date().toLocaleDateString('es-ES')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-gray-700 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">Deudor</p>
              <p className="text-lg font-semibold text-white">{prestamo.nombre_prestamista}</p>
            </div>

            <div className="p-4 bg-gray-700 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">Monto del crédito</p>
              <p className="text-lg font-semibold text-white">${prestamo.monto.toLocaleString()}</p>
            </div>

            <div className="p-4 bg-gray-700 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">Tasa de interés</p>
              <p className="text-lg font-semibold text-white">{tasaInteres}% mensual</p>
            </div>

            <div className="p-4 bg-gray-700 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">Fecha de desembolso</p>
              <p className="text-lg font-semibold text-white">{dateFromInput(prestamo.fecha_inicio).toLocaleDateString('es-ES')}</p>
            </div>
          </div>

          {/* Visor Saldo a la Fecha */}
          <div className="flex justify-end mb-6">
            <div className="p-6 bg-gradient-to-r from-blue-700 to-blue-600 rounded-lg shadow-lg border border-blue-500 min-w-[250px]">
              <p className="text-sm font-medium text-blue-200 mb-2">SALDO A LA FECHA</p>
              <p className="text-3xl font-bold text-white">
                ${saldoALaFecha.toLocaleString()}
              </p>
              <p className="text-xs text-blue-200 mt-2">
                Actualizado: {new Date().toLocaleDateString('es-ES')}
              </p>
            </div>
          </div>

          <div className="flex justify-center gap-3">
            {movimientos.length > 0 && (
              <div className={`px-4 py-2 rounded-lg font-semibold ${
                movimientos[movimientos.length - 1].capital_pendiente <= 0
                  ? 'bg-gray-600 text-white'
                  : 'bg-green-600 text-white'
              }`}>
                {movimientos[movimientos.length - 1].capital_pendiente <= 0
                  ? 'Estado: Pagado'
                  : 'Estado: Activo'}
              </div>
            )}

            <button
              type="button"
              onClick={handleImprimir}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors no-print"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / PDF</span>
            </button>
          </div>
        </div>

        {/* Tabla de Movimientos */}
        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full table-auto text-sm">
              <thead>
                <tr className="bg-gray-700 border-b border-gray-600">
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase">#</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase">FECHA</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase">TIPO DE MOVIMIENTO</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase">VALOR PAGADO</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase">DÍAS CAUSADOS</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase">INTERÉS CAUSADO</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase">INTERÉS PENDIENTE</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase">ABONO A CAPITAL</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase">CAPITAL PENDIENTE</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase">SALDO TOTAL PENDIENTE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {movimientos.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                      No hay movimientos registrados
                    </td>
                  </tr>
                ) : (
                  movimientos.map((mov, index) => {
                    const esProyeccion = mov.tipo_display === 'PROYECCIÓN A HOY'
                    return (
                      <tr
                        key={mov.id || `proj-${index}`}
                        className={`hover:bg-gray-700 ${esProyeccion ? 'bg-gray-750 border-t-2 border-blue-500' : ''}`}
                      >
                        <td className="px-3 py-3 text-gray-300">{index}</td>
                        <td className="px-3 py-3 text-gray-300">
                          {dateFromInput(mov.fecha).toLocaleDateString('es-ES')}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            mov.tipo_display === 'DESEMBOLSO' ? 'bg-blue-700 text-white' :
                            mov.tipo_display === 'PAGO INTERESES' ? 'bg-green-700 text-white' :
                            mov.tipo_display === 'PAGO INTERÉS + ABONO A CAPITAL' ? 'bg-indigo-700 text-white' :
                            mov.tipo_display === 'PAGO INTERÉS (SE GENERÓ INTERÉS PENDIENTE)' ? 'bg-orange-700 text-white' :
                            mov.tipo_display === 'ABONO A CAPITAL' ? 'bg-purple-700 text-white' :
                            mov.tipo_display === 'SIN PAGO' ? 'bg-red-700 text-white' :
                            mov.tipo_display === 'PAGO TOTAL' ? 'bg-yellow-700 text-white' :
                            'bg-gray-600 text-white'
                          }`}>
                            {mov.tipo_display}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right text-gray-300">
                          {mov.valor_pagado > 0 ? `$${mov.valor_pagado.toLocaleString()}` : '$ -'}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-300">
                          {mov.dias_causados > 0 ? mov.dias_causados : '-'}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-300">
                          {mov.interes_causado > 0 ? `$${mov.interes_causado.toLocaleString()}` : '$ -'}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-300">
                          {mov.interes_pendiente > 0 ? `$${mov.interes_pendiente.toLocaleString()}` : '$ -'}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-300">
                          {mov.abono_capital > 0 ? `$${mov.abono_capital.toLocaleString()}` : '$ -'}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-300">
                          {mov.capital_pendiente > 0 ? `$${mov.capital_pendiente.toLocaleString()}` : '$ -'}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-gray-200">
                          ${mov.saldo_pendiente.toLocaleString()}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Nota */}
        <div className="mt-6 text-center text-sm text-gray-400">
          <p>Nota: El saldo total pendiente corresponde a la suma del capital pendiente de pago más los intereses causados a la fecha y no cancelados.</p>
        </div>
      </div>
    </div>
  )
}