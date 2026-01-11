'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Home, ArrowLeft, FileText } from 'lucide-react'
import { obtenerMovimientosCaja, obtenerSaldoTotal, MovimientoCaja } from '@/lib/caja'

export default function MovimientosCajaPage() {
  const [movimientosCaja, setMovimientosCaja] = useState<MovimientoCaja[]>([])
  const [saldoCaja, setSaldoCaja] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Obtener saldo de caja_central con manejo robusto de errores
      let saldoCajaCentral = 0
      let movimientos: MovimientoCaja[] = []
      
      try {
        // Obtener saldo total (usa nuevo_saldo del último registro o suma matemática)
        saldoCajaCentral = await obtenerSaldoTotal()
        // Asegurar que sea un número válido (no null/undefined/NaN)
        saldoCajaCentral = isNaN(saldoCajaCentral) ? 0 : saldoCajaCentral
        setSaldoCaja(saldoCajaCentral)
        
        // Obtener movimientos de caja
        movimientos = await obtenerMovimientosCaja()
        // Asegurar que sea un array válido
        setMovimientosCaja(Array.isArray(movimientos) ? movimientos : [])
        
        console.log('✅ Datos de movimientos cargados:', {
          saldoCajaCentral,
          cantidadMovimientos: movimientos.length
        })
      } catch (e: any) {
        // Si falla la base de datos, mostrar 'Sin movimientos' en lugar de romperse
        console.warn('⚠️ Error obteniendo datos de caja_central (continuando con valores por defecto):', e?.message)
        setSaldoCaja(0)
        setMovimientosCaja([])
        // NO lanzar el error, continuar con el resto de la carga
      }
      
    } catch (error: any) {
      // Manejo robusto de errores en UI: mostrar mensaje amigable en lugar de romperse
      console.error('❌ Error crítico cargando datos de movimientos:', {
        error: error,
        message: error?.message,
        code: error?.code
      })
      
      // Establecer valores por defecto para evitar que la página se rompa
      setSaldoCaja(0)
      setMovimientosCaja([])
      
      // Mostrar mensaje al usuario solo si es un error crítico (no errores de tablas vacías)
      if (error?.code !== 'PGRST116' && error?.code !== '42P01' && !error?.message?.includes('does not exist')) {
        alert('Advertencia: Algunos datos no pudieron cargarse. La página mostrará "Sin movimientos" si las tablas están vacías.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8 flex items-center justify-center">
        <p className="text-xl text-gray-400">Cargando movimientos de caja...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-white" />
            <h1 className="text-4xl font-bold text-white">Movimientos de Caja</h1>
          </div>
          <div className="flex gap-3">
            <Link
              href="/caja"
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a Caja Central</span>
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </Link>
          </div>
        </div>

        {/* Tabla de Movimientos de Caja */}
        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-2xl font-bold text-white">Historial Completo de Movimientos</h2>
            <p className="text-sm text-gray-400 mt-1">
              Saldo actual: <span className="font-semibold text-white">${saldoCaja.toLocaleString()}</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Incluye ingresos, egresos y reversos registrados en caja_central
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
      </div>
    </div>
  )
}

