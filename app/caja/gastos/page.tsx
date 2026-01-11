'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Home, ArrowLeft, Edit2, Trash2, X } from 'lucide-react'
import { obtenerGastosCaja, eliminarMovimientoCaja, actualizarMovimientoCaja, obtenerUltimoSaldo, MovimientoCaja } from '@/lib/caja'

export default function GastosCajaPage() {
  const [gastos, setGastos] = useState<MovimientoCaja[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | string | null>(null)
  const [editForm, setEditForm] = useState({
    fecha: '',
    concepto: '',
    monto: ''
  })

  useEffect(() => {
    loadGastos()
  }, [])

  const loadGastos = async () => {
    try {
      setLoading(true)
      const gastosData = await obtenerGastosCaja()
      setGastos(Array.isArray(gastosData) ? gastosData : [])
    } catch (error: any) {
      console.error('Error loading gastos:', error)
      alert('Error al cargar los gastos de caja')
      setGastos([])
    } finally {
      setLoading(false)
    }
  }

  const handleEditar = (gasto: MovimientoCaja) => {
    // Mantener el ID tal como viene (puede ser UUID string o número)
    if (!gasto.id) {
      alert('Error: El gasto no tiene ID válido')
      return
    }
    setEditingId(gasto.id)
    // Formatear el monto al cargar para edición
    const montoFormateado = (gasto.monto || 0).toLocaleString('es-CO')
    setEditForm({
      fecha: gasto.fecha || '',
      concepto: gasto.concepto || '',
      monto: montoFormateado
    })
  }

  const handleCancelarEdicion = () => {
    setEditingId(null)
    setEditForm({ fecha: '', concepto: '', monto: '' })
  }

  // Función para obtener el valor numérico limpio
  const obtenerValorNumerico = (valorFormateado: string): number => {
    const valorLimpio = valorFormateado.replace(/\D/g, '')
    return parseFloat(valorLimpio) || 0
  }

  // Función para formatear número con puntos de miles
  const formatearMonto = (valor: string): string => {
    const soloNumeros = valor.replace(/\D/g, '')
    if (!soloNumeros) return ''
    return parseInt(soloNumeros, 10).toLocaleString('es-CO')
  }

  const handleMontoEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    if (inputValue === '') {
      setEditForm({ ...editForm, monto: '' })
      return
    }
    const formateado = formatearMonto(inputValue)
    setEditForm({ ...editForm, monto: formateado })
  }

  const handleGuardarEdicion = async () => {
    if (!editingId) return

    try {
      if (!editForm.fecha || !editForm.concepto.trim() || !editForm.monto) {
        alert('Por favor completa todos los campos')
        return
      }

      const montoNum = obtenerValorNumerico(editForm.monto)
      if (montoNum <= 0) {
        alert('El monto debe ser un número mayor a 0')
        return
      }

      // Obtener el gasto actual para calcular saldos
      // Comparar IDs de forma segura (pueden ser UUID string o número)
      const gastoActual = gastos.find(g => String(g.id) === String(editingId))
      if (!gastoActual) {
        alert('Error: No se encontró el gasto a editar')
        return
      }

      // Recalcular saldo anterior y nuevo saldo
      // Buscar el movimiento anterior para obtener saldo_anterior
      const movimientos = await obtenerGastosCaja()
      const movimientosOrdenados = [...movimientos].sort((a, b) => {
        const fechaA = new Date(a.fecha || 0).getTime()
        const fechaB = new Date(b.fecha || 0).getTime()
        return fechaA - fechaB
      })

      // Comparar IDs como strings para evitar problemas con UUID vs número
      const indiceActual = movimientosOrdenados.findIndex(m => String(m.id) === String(editingId))
      let saldoAnterior = 0

      if (indiceActual > 0) {
        // Tomar el nuevo_saldo del movimiento anterior
        saldoAnterior = movimientosOrdenados[indiceActual - 1].nuevo_saldo || 0
      } else {
        // Si es el primer movimiento, usar el saldo anterior original o 0
        saldoAnterior = gastoActual.saldo_anterior || 0
      }

      const nuevoSaldo = saldoAnterior - montoNum // Restar porque es EGRESO

      await actualizarMovimientoCaja(editingId, {
        fecha: editForm.fecha,
        concepto: editForm.concepto.trim(),
        monto: montoNum,
        saldo_anterior: saldoAnterior,
        nuevo_saldo: nuevoSaldo,
        tipo: 'EGRESO'
      })

      alert('Gasto actualizado correctamente')
      handleCancelarEdicion()
      await loadGastos()
    } catch (error: any) {
      console.error('Error actualizando gasto:', error)
      alert(error?.message || 'Error al actualizar el gasto')
    }
  }

  const handleEliminar = async (gastoId: number | string) => {
    if (!confirm('¿Estás seguro de eliminar este gasto? Esta acción afectará los saldos de caja.')) {
      return
    }

    try {
      await eliminarMovimientoCaja(gastoId)
      alert('Gasto eliminado correctamente')
      await loadGastos()
    } catch (error: any) {
      console.error('Error eliminando gasto:', error)
      alert(error?.message || 'Error al eliminar el gasto')
    }
  }

  const totalGastos = gastos.reduce((sum, g) => sum + (parseFloat(String(g?.monto || 0)) || 0), 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8 flex items-center justify-center">
        <p className="text-xl text-gray-400">Cargando gastos de caja...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold text-white">Base de Datos de Gastos de Caja</h1>
          </div>
          <div className="flex gap-3">
            <Link
              href="/caja"
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Regresar a Caja</span>
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

        {/* Total */}
        <div className="bg-yellow-700 rounded-lg shadow-lg p-6 mb-6 border border-yellow-600">
          <p className="text-sm text-yellow-200 mb-2">TOTAL DE GASTOS DE CAJA</p>
          <p className="text-4xl font-bold text-white">
            ${totalGastos.toLocaleString()}
          </p>
        </div>

        {/* Tabla de Gastos */}
        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-2xl font-bold text-white">Historial de Gastos de Caja</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-auto text-sm">
              <thead>
                <tr className="bg-gray-700 border-b border-gray-600">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">FECHA</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">CONCEPTO</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase">MONTO</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {gastos.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      No hay gastos de caja registrados
                    </td>
                  </tr>
                ) : (
                  gastos.map((gasto) => (
                    <tr key={gasto.id || Math.random()} className="hover:bg-gray-700">
                      {editingId === gasto.id ? (
                        <>
                          <td className="px-4 py-3">
                            <input
                              type="date"
                              value={editForm.fecha}
                              onChange={(e) => setEditForm({ ...editForm, fecha: e.target.value })}
                              className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={editForm.concepto}
                              onChange={(e) => setEditForm({ ...editForm, concepto: e.target.value })}
                              className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={editForm.monto}
                              onChange={handleMontoEditChange}
                              className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs text-right"
                              inputMode="numeric"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={handleGuardarEdicion}
                                className="text-green-400 hover:text-green-300 transition-colors"
                                title="Guardar"
                              >
                                ✓
                              </button>
                              <button
                                onClick={handleCancelarEdicion}
                                className="text-red-400 hover:text-red-300 transition-colors"
                                title="Cancelar"
                              >
                                <X className="w-4 h-4 inline" />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-gray-300">
                            {gasto.fecha ? new Date(gasto.fecha).toLocaleDateString('es-ES') : 'Sin fecha'}
                          </td>
                          <td className="px-4 py-3 text-gray-300">{gasto.concepto || 'Sin concepto'}</td>
                          <td className="px-4 py-3 text-right font-semibold text-red-400">
                            ${(gasto.monto || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex gap-3 justify-center">
                              {gasto.id && (
                                <>
                                  <button
                                    onClick={() => handleEditar(gasto)}
                                    className="text-blue-400 hover:text-blue-300 transition-colors"
                                    title="Editar"
                                  >
                                    <Edit2 className="w-4 h-4 inline" />
                                  </button>
                                  <button
                                    onClick={() => handleEliminar(gasto.id!)}
                                    className="text-red-400 hover:text-red-300 transition-colors"
                                    title="Eliminar"
                                  >
                                    <Trash2 className="w-4 h-4 inline" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

