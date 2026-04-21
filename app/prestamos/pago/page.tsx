'use client'



import { useState, useEffect } from 'react'

import Link from 'next/link'

import { Home, ArrowLeft, Database } from 'lucide-react'

import { obtenerPrestamosActivos, registrarPagoPrestamo, calcularSaldoActual, Prestamo } from '@/lib/prestamos'

// Helper functions (local versions)

function dateFromInput(fecha: string): Date {

  const [y, m, d] = fecha.split('-').map(Number)

  return new Date(y, m - 1, d, 0, 0, 0, 0)

}

function redondear(valor: number): number {

  return Math.round(valor)

}

// Función para calcular saldo a una fecha específica

async function calcularSaldoAFecha(prestamoId: number, fecha: string): Promise<number> {

  try {

    // Obtener préstamo y movimientos

    const response = await fetch(`/api/prestamos/${prestamoId}/movimientos`)

    if (!response.ok) {

      console.error('Error obteniendo movimientos para cálculo de saldo')

      return 0

    }

    

    const { prestamo, movimientos } = await response.json()

    

    if (!prestamo || movimientos.length === 0) {

      return redondear(prestamo?.monto || 0)

    }

    

    // Encontrar el último movimiento real antes de la fecha especificada

    let capitalPendiente = prestamo.monto

    let interesPendiente = 0

    let fechaUltimoMovimiento = dateFromInput(prestamo.fecha_inicio)

    

    // Calcular estado hasta la fecha especificada

    for (const mov of movimientos) {

      if (mov.fecha > fecha) break // Detenerse si el movimiento es posterior a la fecha

      

      if (mov.tipo_movimiento === 'desembolso') {

        capitalPendiente = prestamo.monto

        interesPendiente = 0

        fechaUltimoMovimiento = dateFromInput(mov.fecha)

      } else {

        // Calcular días causados

        const fechaActual = dateFromInput(mov.fecha)

        const diasCausados = Math.max(0, Math.floor((fechaActual.getTime() - fechaUltimoMovimiento.getTime()) / (1000 * 60 * 60 * 24)))

        

        // Calcular interés causado

        const tasaInteres = prestamo.tasa_interes || 0

        const interesDiario = (capitalPendiente * tasaInteres) / 100 / 30

        const interesCausadoPorDias = interesDiario * diasCausados

        const interesCausado = redondear(interesCausadoPorDias + interesPendiente)

        

        // Distribuir pago

        const interesPagado = Math.min(redondear(mov.valor_pagado || 0), interesCausado)

        const abonoCapital = Math.max(0, redondear(mov.valor_pagado || 0) - interesCausado)

        interesPendiente = interesCausado - interesPagado

        capitalPendiente = Math.max(0, redondear(capitalPendiente - abonoCapital))

        fechaUltimoMovimiento = fechaActual

      }

    }

    

    // Calcular intereses desde el último movimiento hasta la fecha especificada

    const fechaObjetivo = dateFromInput(fecha)

    const diasAdicionales = Math.max(0, Math.floor((fechaObjetivo.getTime() - fechaUltimoMovimiento.getTime()) / (1000 * 60 * 60 * 24)))

    

    if (diasAdicionales > 0 && capitalPendiente > 0) {

      const tasaInteres = prestamo.tasa_interes || 0

      const interesDiario = (capitalPendiente * tasaInteres) / 100 / 30

      const interesAdicional = redondear(interesDiario * diasAdicionales)

      interesPendiente = redondear(interesPendiente + interesAdicional)

    }

    

    return redondear(capitalPendiente + interesPendiente)

    

  } catch (error) {

    console.error('Error calculando saldo a fecha:', error)

    return 0

  }

}

export default function PagoPrestamoPage() {

  const [prestamos, setPrestamos] = useState<Prestamo[]>([])

  const [busqueda, setBusqueda] = useState('')

  const [prestamoSeleccionado, setPrestamoSeleccionado] = useState<Prestamo | null>(null)

  const [saldoPendiente, setSaldoPendiente] = useState(0)

  // Helper para obtener fecha local sin UTC

  const getFechaLocalHoy = () => {

    const hoy = new Date()

    const year = hoy.getFullYear()

    const month = String(hoy.getMonth() + 1).padStart(2, '0')

    const day = String(hoy.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`

  }



  const [fechaPago, setFechaPago] = useState(getFechaLocalHoy())

  const [montoPago, setMontoPago] = useState('')

  const [tipoMovimiento, setTipoMovimiento] = useState<'pago_interes' | 'abono_capital'>('pago_interes')

  const [loading, setLoading] = useState(true)

  const [loadingSaldo, setLoadingSaldo] = useState(false)

  const [submitting, setSubmitting] = useState(false)

  const [errorValidacion, setErrorValidacion] = useState('')



  useEffect(() => {

    loadPrestamos()

  }, [])



  const loadPrestamos = async () => {

    try {

      setLoading(true)

      const prestamosData = await obtenerPrestamosActivos()

      setPrestamos(prestamosData)

    } catch (error) {

      console.error('Error loading prestamos:', error)

      alert('Error al cargar los préstamos. Verifica tu conexión a Supabase.')

    } finally {

      setLoading(false)

    }

  }



  const prestamosFiltrados = prestamos.filter(p =>

    p.nombre_prestamista.toLowerCase().includes(busqueda.toLowerCase())

  )



  const handleSeleccionarPrestamo = async (prestamo: Prestamo) => {

    setPrestamoSeleccionado(prestamo)

    setBusqueda(`${prestamo.nombre_prestamista}`)

    setErrorValidacion('')

   

    try {

      setLoadingSaldo(true)

      const saldo = await calcularSaldoActual(prestamo.id!)

      setSaldoPendiente(saldo)

    } catch (error) {

      console.error('Error calculating saldo:', error)

      setSaldoPendiente(0)

    } finally {

      setLoadingSaldo(false)

    }

  }



  const handleMontoChange = (value: string) => {

    setMontoPago(value)

    setErrorValidacion('')

  }



  const handleFechaChange = async (nuevaFecha: string) => {

    setFechaPago(nuevaFecha)

    setErrorValidacion('')

    

    if (prestamoSeleccionado) {

      try {

        setLoadingSaldo(true)

        const saldo = await calcularSaldoAFecha(prestamoSeleccionado.id!, nuevaFecha)

        setSaldoPendiente(saldo)

      } catch (error) {

        console.error('Error calculando saldo a fecha:', error)

        setSaldoPendiente(0)

      } finally {

        setLoadingSaldo(false)

      }

    }

  }



  const handleRegistrarPago = async (e: React.FormEvent) => {

    e.preventDefault()

   

    if (!prestamoSeleccionado) {

      alert('Por favor selecciona un deudor')

      return

    }



    if (!montoPago || parseFloat(montoPago) <= 0) {

      alert('Por favor ingresa un monto válido')

      return

    }



    const monto = parseFloat(montoPago)

    try {

      setSubmitting(true)

      await registrarPagoPrestamo(

        prestamoSeleccionado.id!,

        fechaPago,

        monto,

        tipoMovimiento

      )



      // Recargar saldo

      const nuevoSaldo = await calcularSaldoActual(prestamoSeleccionado.id!)

      setSaldoPendiente(nuevoSaldo)

     

      // Limpiar formulario

      setMontoPago('')

      setFechaPago(getFechaLocalHoy())

     

      alert('Pago registrado exitosamente')

    } catch (error) {

      console.error('Error registering pago:', error)

      alert('Error al registrar el pago')

    } finally {

      setSubmitting(false)

    }

  }



  if (loading) {

    return (

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8 flex items-center justify-center">

        <p className="text-xl text-gray-600 dark:text-gray-400">Cargando préstamos...</p>

      </div>

    )

  }



  return (

    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">

      <div className="max-w-4xl mx-auto">

        {/* Header */}

        <div className="flex items-center justify-between mb-6">

          <h1 className="text-4xl font-bold text-gray-800 dark:text-white">

            Pago de Préstamo

          </h1>

          <div className="flex gap-3">

            <Link

              href="/dashboard"

              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"

            >

              <Home className="w-4 h-4" />

              <span>🏠 Volver al Home</span>

            </Link>

            <Link

              href="/prestamos"

              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"

            >

              <ArrowLeft className="w-4 h-4" />

              <span>🔙 Volver al Menú</span>

            </Link>

            <Link

              href="/prestamos/lista"

              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"

            >

              <Database className="w-4 h-4" />

              <span>📊 Base de Datos de Préstamos</span>

            </Link>

          </div>

        </div>



        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">

          <form onSubmit={handleRegistrarPago} className="space-y-6">

            {/* Buscador de Deudores */}

            <div className="relative">

              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">

                Buscar Deudor (Nombre o ID) *

              </label>

              <input

                type="text"

                value={busqueda}

                onChange={(e) => {

                  setBusqueda(e.target.value)

                  if (!e.target.value) {

                    setPrestamoSeleccionado(null)

                    setSaldoPendiente(0)

                  }

                }}

                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"

                placeholder="Escribe el nombre o ID del deudor..."

              />

              {busqueda && prestamosFiltrados.length > 0 && !prestamoSeleccionado && (

                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">

                  {prestamosFiltrados.map((prestamo) => (

                    <button

                      key={prestamo.id}

                      type="button"

                      onClick={() => handleSeleccionarPrestamo(prestamo)}

                      className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white"

                    >

                      <div className="font-medium">{prestamo.nombre_prestamista}</div>

                      <div className="text-sm text-gray-500 dark:text-gray-400">ID: {prestamo.id}</div>

                    </button>

                  ))}

                </div>

              )}

            </div>



            {/* Saldo Total Pendiente */}

            {prestamoSeleccionado && (

              <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-4 border-2 border-blue-200 dark:border-blue-700">

                <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">

                  SALDO TOTAL PENDIENTE

                </p>

                {loadingSaldo ? (

                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">Calculando...</p>

                ) : (

                  <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">

                    ${saldoPendiente.toLocaleString()}

                  </p>

                )}

                <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">

                  Capital + Intereses acumulados a la fecha

                </p>

              </div>

            )}



            {/* Campos de Pago */}

            {prestamoSeleccionado && (

              <>

                <div>

                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">

                    Tipo de Movimiento *

                  </label>

                  <div className="flex gap-4">

                    <label className="flex items-center gap-2 cursor-pointer">

                      <input

                        type="radio"

                        name="tipoMovimiento"

                        value="pago_interes"

                        checked={tipoMovimiento === 'pago_interes'}

                        onChange={(e) => setTipoMovimiento('pago_interes')}

                        className="w-4 h-4 text-blue-600"

                      />

                      <span className="text-gray-700 dark:text-gray-300">PAGO INTERÉS</span>

                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">

                      <input

                        type="radio"

                        name="tipoMovimiento"

                        value="abono_capital"

                        checked={tipoMovimiento === 'abono_capital'}

                        onChange={(e) => setTipoMovimiento('abono_capital')}

                        className="w-4 h-4 text-blue-600"

                      />

                      <span className="text-gray-700 dark:text-gray-300">ABONO A CAPITAL</span>

                    </label>

                  </div>

                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">

                    {tipoMovimiento === 'pago_interes'

                      ? 'El pago cubrirá solo los intereses causados'

                      : 'El pago cubrirá intereses y el excedente abonará al capital pendiente'}

                  </p>

                </div>



                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  <div>

                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">

                      Fecha de Pago *

                    </label>

                    <input

                      type="date"

                      value={fechaPago}

                      onChange={(e) => handleFechaChange(e.target.value)}

                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"

                      required

                    />

                  </div>

                  <div>

                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">

                      Monto del Pago *

                    </label>

                    <input

                      type="number"

                      value={montoPago}

                      onChange={(e) => handleMontoChange(e.target.value)}

                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"

                      placeholder="0"

                      min="0"

                      step="1000"

                      
                      required

                    />

                    {errorValidacion && (

                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errorValidacion}</p>

                    )}

                  </div>

                </div>



                <button

                  type="submit"

                  disabled={submitting || !!errorValidacion}

                  className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"

                >

                  {submitting ? 'Registrando...' : 'Registrar Pago'}

                </button>

              </>

            )}

          </form>

        </div>

      </div>

    </div>

  )

}