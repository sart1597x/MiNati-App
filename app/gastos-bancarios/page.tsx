'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Home, ArrowLeft, Plus, Trash2, DollarSign, Edit2, X } from 'lucide-react'
import { obtenerGastosBancarios, crearGastoBancario, eliminarGastoBancario, actualizarGastoBancario, GastoBancario } from '@/lib/gastos'

export default function GastosBancariosPage() {
  const [gastos, setGastos] = useState<GastoBancario[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingGasto, setEditingGasto] = useState<GastoBancario | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [descripcion, setDescripcion] = useState('4xMil Operativo')
  const [valor, setValor] = useState('') // Guarda el valor formateado (ej: "10.000")
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  
  // Estados para el formulario de edición
  const [editDescripcion, setEditDescripcion] = useState('')
  const [editValor, setEditValor] = useState('')
  const [editFecha, setEditFecha] = useState('')

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

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    // Si está vacío, permitir borrar
    if (inputValue === '') {
      setValor('')
      return
    }
    // Formatear mientras escribe
    const formateado = formatearMonto(inputValue)
    setValor(formateado)
  }

  const handleEditValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    if (inputValue === '') {
      setEditValor('')
      return
    }
    const formateado = formatearMonto(inputValue)
    setEditValor(formateado)
  }

  const handleEditar = (gasto: GastoBancario) => {
    if (!gasto.id) {
      alert('Error: El gasto no tiene ID válido')
      return
    }
    setEditingGasto(gasto)
    setEditDescripcion(gasto.descripcion || '')
    setEditValor((gasto.valor || 0).toLocaleString('es-CO'))
    setEditFecha(gasto.fecha || new Date().toISOString().split('T')[0])
    setShowEditModal(true)
  }

  const handleCerrarEditModal = () => {
    setShowEditModal(false)
    setEditingGasto(null)
    setEditDescripcion('')
    setEditValor('')
    setEditFecha('')
  }

  const handleGuardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!editingGasto || !editingGasto.id) {
      alert('Error: No hay gasto seleccionado para editar')
      return
    }

    const valorNumerico = obtenerValorNumerico(editValor)
    if (!editDescripcion.trim() || !editFecha || valorNumerico <= 0) {
      alert('Por favor completa todos los campos con valores válidos')
      return
    }

    try {
      setSubmitting(true)
      await actualizarGastoBancario(editingGasto.id, {
        descripcion: editDescripcion.trim(),
        valor: valorNumerico,
        fecha: editFecha
      })
      
      await loadGastos()
      handleCerrarEditModal()
      alert('Gasto bancario actualizado exitosamente')
    } catch (error: any) {
      console.error('Error updating gasto:', error)
      alert(error?.message || 'Error al actualizar el gasto bancario')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    loadGastos()
  }, [])

  const loadGastos = async () => {
    try {
      setLoading(true)
      const gastosData = await obtenerGastosBancarios()
      setGastos(Array.isArray(gastosData) ? gastosData : [])
    } catch (error: any) {
      console.error('Error loading gastos:', error)
      // Si la tabla no existe, mostrar mensaje más claro
      if (error?.message?.includes('no existe') || error?.code === '42P01') {
        alert('La tabla gastos_bancarios no existe. Por favor ejecuta el SQL para crearla en Supabase.')
      } else {
        alert('Error al cargar los gastos bancarios: ' + (error?.message || 'Error desconocido'))
      }
      setGastos([]) // Asegurar que siempre sea un array
    } finally {
      setLoading(false)
    }
  }

  const handleCrearGasto = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const valorNumerico = obtenerValorNumerico(valor)
    if (!valor || valorNumerico <= 0) {
      alert('Por favor ingresa un valor válido mayor a 0')
      return
    }

    try {
      setSubmitting(true)
      await crearGastoBancario({
        descripcion,
        valor: valorNumerico,
        fecha
      })
      
      await loadGastos()
      setShowModal(false)
      setDescripcion('4xMil Operativo')
      setValor('')
      setFecha(new Date().toISOString().split('T')[0])
      alert('Gasto bancario registrado exitosamente')
    } catch (error) {
      console.error('Error creating gasto:', error)
      alert('Error al registrar el gasto bancario')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEliminarGasto = async (gastoId: number | string) => {
    if (!confirm('¿Estás seguro de eliminar este gasto bancario?')) {
      return
    }

    try {
      await eliminarGastoBancario(gastoId)
      await loadGastos()
      alert('Gasto eliminado exitosamente')
    } catch (error) {
      console.error('Error deleting gasto:', error)
      alert('Error al eliminar el gasto')
    }
  }

  const totalAcumulado = gastos.reduce((sum, g) => sum + (parseFloat(String(g.valor || 0)) || 0), 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8 flex items-center justify-center">
        <p className="text-xl text-gray-400">Cargando gastos bancarios...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-white" />
            <h1 className="text-4xl font-bold text-white">Gastos Bancarios (4xMil)</h1>
          </div>
          <div className="flex gap-3">
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

        {/* Total Acumulado */}
        <div className="bg-yellow-700 rounded-lg shadow-lg p-6 mb-6 border border-yellow-600">
          <p className="text-sm text-yellow-200 mb-2">TOTAL ACUMULADO 4xMil OPERATIVO</p>
          <p className="text-4xl font-bold text-white">
            ${totalAcumulado.toLocaleString()}
          </p>
          <p className="text-xs text-yellow-300 mt-2">
            Este valor se usa automáticamente en la liquidación anual
          </p>
        </div>

        {/* Botón Agregar */}
        <div className="mb-6">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-green-700 hover:bg-green-600 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Registrar Gasto Bancario</span>
          </button>
        </div>

        {/* Tabla de Gastos */}
        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-2xl font-bold text-white">Historial de Gastos</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-auto text-sm">
              <thead>
                <tr className="bg-gray-700 border-b border-gray-600">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">FECHA</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">DESCRIPCIÓN</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase">VALOR</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {gastos.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      No hay gastos bancarios registrados
                    </td>
                  </tr>
                ) : (
                  gastos.map((gasto) => (
                    <tr key={gasto.id || Math.random()} className="hover:bg-gray-700">
                      <td className="px-4 py-3 text-gray-300">
                        {gasto.fecha ? new Date(gasto.fecha).toLocaleDateString('es-ES') : 'Sin fecha'}
                      </td>
                      <td className="px-4 py-3 text-gray-300">{gasto.descripcion || 'Sin descripción'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-white">
                        ${(gasto.valor || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {gasto.id && (
                          <div className="flex gap-3 justify-center">
                            <button
                              onClick={() => handleEditar(gasto)}
                              className="text-blue-400 hover:text-blue-300 transition-colors"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4 inline" />
                            </button>
                            <button
                              onClick={() => handleEliminarGasto(gasto.id!)}
                              className="text-red-400 hover:text-red-300 transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4 inline" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal para Agregar Gasto */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4 border border-gray-700">
              <h2 className="text-2xl font-bold mb-4 text-white">Registrar Gasto Bancario</h2>
              
              <form onSubmit={handleCrearGasto} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Descripción
                  </label>
                  <input
                    type="text"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Valor *
                  </label>
                  <input
                    type="text"
                    value={valor}
                    onChange={handleValorChange}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Ej: 10000 o 10.000"
                    inputMode="numeric"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Puedes escribir el número directamente. Se formateará automáticamente.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                  >
                    {submitting ? 'Registrando...' : 'Registrar Gasto'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal para Editar Gasto */}
        {showEditModal && editingGasto && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-white">Editar Gasto Bancario</h2>
                <button
                  onClick={handleCerrarEditModal}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleGuardarEdicion} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Descripción <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editDescripcion}
                    onChange={(e) => setEditDescripcion(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Valor <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editValor}
                    onChange={handleEditValorChange}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: 10000 o 10.000"
                    inputMode="numeric"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Puedes escribir el número directamente. Se formateará automáticamente.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Fecha <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={editFecha}
                    onChange={(e) => setEditFecha(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                  >
                    {submitting ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCerrarEditModal}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

