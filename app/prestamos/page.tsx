'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Home, Plus, CreditCard, Database, ArrowLeft, Share2 } from 'lucide-react'
import { Socio } from '@/lib/supabase'
import { buscarSocios, crearPrestamo } from '@/lib/prestamos'

type View = 'menu' | 'nuevo'

export default function PrestamosPage() {
  const [view, setView] = useState<View>('menu')
  
  // Estados para Nuevo Préstamo
  const [tipoPrestamista, setTipoPrestamista] = useState<'socio' | 'externo'>('socio')
  const [busquedaSocio, setBusquedaSocio] = useState('')
  const [sociosEncontrados, setSociosEncontrados] = useState<Socio[]>([])
  const [socioSeleccionado, setSocioSeleccionado] = useState<Socio | null>(null)
  const [nombreExterno, setNombreExterno] = useState('')
  const [cedulaExterno, setCedulaExterno] = useState('')
  const [whatsappExterno, setWhatsappExterno] = useState('')
  const [monto, setMonto] = useState('')
  const [tasaInteres, setTasaInteres] = useState('')
  // Helper para obtener fecha local sin UTC
  const getFechaLocalHoy = () => {
    const hoy = new Date()
    const year = hoy.getFullYear()
    const month = String(hoy.getMonth() + 1).padStart(2, '0')
    const day = String(hoy.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const [fechaInicio, setFechaInicio] = useState(getFechaLocalHoy())
  const [submitting, setSubmitting] = useState(false)

  // Buscar socios cuando se escribe en el buscador
  useEffect(() => {
    if (tipoPrestamista === 'socio' && busquedaSocio.length >= 2) {
      buscarSocios(busquedaSocio).then(setSociosEncontrados).catch(console.error)
    } else {
      setSociosEncontrados([])
    }
  }, [busquedaSocio, tipoPrestamista])

  const handleSeleccionarSocio = (socio: Socio) => {
    setSocioSeleccionado(socio)
    setBusquedaSocio(`${socio.nombre} (${socio.cedula})`)
    setSociosEncontrados([])
  }

  const handleRegistrarPrestamo = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!monto || !tasaInteres || !fechaInicio) {
      alert('Por favor completa todos los campos requeridos')
      return
    }

    if (tipoPrestamista === 'socio' && !socioSeleccionado) {
      alert('Por favor selecciona un socio')
      return
    }

    if (tipoPrestamista === 'externo' && (!nombreExterno || !cedulaExterno)) {
      alert('Por favor completa el nombre y cédula del cliente externo')
      return
    }

    try {
      setSubmitting(true)
      
      // Convertir ID del socio a número si es necesario
      const asociadoId = tipoPrestamista === 'socio' && socioSeleccionado 
        ? (typeof socioSeleccionado.id === 'string' ? parseInt(socioSeleccionado.id) : socioSeleccionado.id)
        : null
      
      // Construir objeto con solo las columnas que existen en Supabase
      const prestamoData: any = {
        nombre_prestamista: tipoPrestamista === 'socio' ? socioSeleccionado!.nombre : nombreExterno,
        monto: parseFloat(monto),
        tasa_interes: parseFloat(tasaInteres),
        fecha_inicio: fechaInicio,
        estado: 'activo'
      }
      
      // Solo agregar asociado_id si es un socio (como número)
      if (asociadoId !== null) {
        prestamoData.asociado_id = asociadoId
      }

      await crearPrestamo(prestamoData)
      
      // Limpiar formulario
      setBusquedaSocio('')
      setSocioSeleccionado(null)
      setNombreExterno('')
      setCedulaExterno('')
      setWhatsappExterno('')
      setMonto('')
      setTasaInteres('')
      setFechaInicio(getFechaLocalHoy())
      
      alert('Préstamo registrado exitosamente')
      setView('menu')
    } catch (error) {
      console.error('Error creating prestamo:', error)
      alert('Error al registrar el préstamo')
    } finally {
      setSubmitting(false)
    }
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header con navegación */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white">
            {view === 'menu' && 'Préstamos'}
            {view === 'nuevo' && 'Nuevo Préstamo'}
            {(view as any) === 'pago' && 'Pago de Préstamo'}
            {(view as any) === 'base-datos' && 'Base de Datos de Préstamos'}
            {(view as any) === 'extracto' && 'Extracto Individual'}
          </h1>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Volver al Home</span>
          </Link>
        </div>

        {/* Menú Principal */}
        {view === 'menu' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <button
              onClick={() => setView('nuevo')}
              className="flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
              <Plus className="w-16 h-16 text-blue-600 mb-4" />
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Nuevo Préstamo</h2>
              <p className="text-gray-600 dark:text-gray-400 text-center">Registrar un nuevo crédito</p>
            </button>

            <Link
              href="/prestamos/lista"
              className="flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
              <Database className="w-16 h-16 text-purple-600 mb-4" />
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Base de Datos</h2>
              <p className="text-gray-600 dark:text-gray-400 text-center">Ver todos los préstamos</p>
            </Link>

            <Link
              href="/prestamos/intereses"
              className="flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
              <Share2 className="w-16 h-16 text-yellow-600 mb-4" />
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Historial de Intereses</h2>
              <p className="text-gray-600 dark:text-gray-400 text-center">Ver pagos de intereses</p>
            </Link>
          </div>
        )}

        {/* Vista: Nuevo Préstamo */}
        {view === 'nuevo' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setView('menu')}
                  className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>🔙 Volver al Menú</span>
                </button>
                <Link
                  href="/prestamos/lista"
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                  <Database className="w-4 h-4" />
                  <span>Ver Base de Datos de Préstamos</span>
                </Link>
              </div>
            </div>
            <form onSubmit={handleRegistrarPrestamo} className="space-y-4">
              {/* Selector de Tipo de Prestamista */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Tipo de Prestamista *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tipoPrestamista"
                      value="socio"
                      checked={tipoPrestamista === 'socio'}
                      onChange={(e) => {
                        setTipoPrestamista('socio')
                        setSocioSeleccionado(null)
                        setBusquedaSocio('')
                        setNombreExterno('')
                        setCedulaExterno('')
                        setWhatsappExterno('')
                      }}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Socio de la Natillera</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tipoPrestamista"
                      value="externo"
                      checked={tipoPrestamista === 'externo'}
                      onChange={(e) => {
                        setTipoPrestamista('externo')
                        setSocioSeleccionado(null)
                        setBusquedaSocio('')
                      }}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Cliente Externo</span>
                  </label>
                </div>
              </div>

              {/* Campos según el tipo */}
              {tipoPrestamista === 'socio' ? (
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Buscar Socio (Nombre o ID) *
                  </label>
                  <input
                    type="text"
                    value={busquedaSocio}
                    onChange={(e) => setBusquedaSocio(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Escribe el nombre o ID del socio..."
                  />
                  {sociosEncontrados.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {sociosEncontrados.map((socio) => (
                        <button
                          key={socio.id}
                          type="button"
                          onClick={() => handleSeleccionarSocio(socio)}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
                        >
                          <div className="font-medium">{socio.nombre}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">ID: {socio.cedula}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {socioSeleccionado && (
                    <div className="mt-2 p-3 bg-green-50 dark:bg-green-900 rounded-lg">
                      <p className="text-sm text-green-800 dark:text-green-200">
                        ✓ Socio seleccionado: <strong>{socioSeleccionado.nombre}</strong> (ID: {socioSeleccionado.cedula})
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      value={nombreExterno}
                      onChange={(e) => setNombreExterno(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="Nombre completo"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      ID/Cédula *
                    </label>
                    <input
                      type="text"
                      value={cedulaExterno}
                      onChange={(e) => setCedulaExterno(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="Número de identificación"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      WhatsApp
                    </label>
                    <input
                      type="text"
                      value={whatsappExterno}
                      onChange={(e) => setWhatsappExterno(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="Número de WhatsApp"
                    />
                  </div>
                </>
              )}

              {/* Campos comunes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Monto *
                  </label>
                  <input
                    type="number"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="0"
                    min="0"
                    step="1000"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tasa de Interés Mensual (%) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={tasaInteres}
                    onChange={(e) => setTasaInteres(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="0.0"
                    min="0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Fecha de Inicio *
                  </label>
                  <input
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Registrando...' : 'Registrar Préstamo'}
                </button>
                <button
                  type="button"
                  onClick={() => setView('menu')}
                  className="px-6 py-3 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Vista: Pago de Préstamo */}
        {(view as any) === 'pago' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="mb-6">
              <button
                onClick={() => setView('menu')}
                className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver al Menú</span>
              </button>
            </div>
            <form className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    ID del Socio *
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Ingrese el ID"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Monto del Pago *
                  </label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Fecha de Pago *
                  </label>
                  <input
                    type="date"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full md:w-auto px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Registrar Pago
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  )
}

