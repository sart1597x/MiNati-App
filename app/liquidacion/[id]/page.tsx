'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Home, ArrowLeft, Edit2, Trash2, Share2, MessageCircle } from 'lucide-react'
import { obtenerLiquidacionPorId, actualizarLiquidacion, eliminarLiquidacion, Liquidacion } from '@/lib/liquidacion'
import { getSocios } from '@/lib/socios'
import { Socio } from '@/lib/supabase'

export default function LiquidacionExtractoPage() {
  const params = useParams()
  const router = useRouter()
  const liquidacionId = params.id as string

  const [liquidacion, setLiquidacion] = useState<Liquidacion | null>(null)
  const [socios, setSocios] = useState<Socio[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingData, setEditingData] = useState({
    cuotas: 0,
    inscripciones: 0,
    utilidad: 0,
    comision: 0,
    deducciones: 0
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadData()
  }, [liquidacionId])

  const loadData = async () => {
    try {
      setLoading(true)
      const [liqData, sociosData] = await Promise.all([
        obtenerLiquidacionPorId(liquidacionId),
        getSocios()
      ])
      setLiquidacion(liqData)
      setSocios(sociosData)
      
      if (liqData) {
        setEditingData({
          cuotas: liqData.total_cuotas || 0,
          inscripciones: liqData.total_inscripciones || 0,
          utilidad: liqData.total_utilidad || 0,
          comision: liqData.total_comision || 0,
          deducciones: liqData.total_deducciones || 0
        })
      }
    } catch (error) {
      console.error('Error loading liquidacion:', error)
      alert('Error al cargar la liquidación')
    } finally {
      setLoading(false)
    }
  }

  const handleGuardarEdicion = async () => {
    if (!liquidacion) return

    try {
      setSubmitting(true)
      
      // Recalcular valores
      const subtotalCalc = (editingData.cuotas * 30000) + editingData.inscripciones + editingData.utilidad - editingData.comision
      const descuento4xMilCalc = subtotalCalc * ((liquidacion.impuesto_4xmil_egreso || 0.4) / 1000)
      const netoCalc = subtotalCalc - descuento4xMilCalc - editingData.deducciones
      
      await actualizarLiquidacion(liquidacionId, {
        total_cuotas: editingData.cuotas,
        total_inscripciones: editingData.inscripciones,
        total_utilidad: editingData.utilidad,
        total_comision: editingData.comision,
        total_deducciones: editingData.deducciones,
        subtotal: subtotalCalc,
        descuento_4xmil: descuento4xMilCalc,
        neto_entregar: netoCalc
      })
      
      await loadData()
      setShowEditModal(false)
      alert('Liquidación actualizada exitosamente')
    } catch (error) {
      console.error('Error updating liquidacion:', error)
      alert('Error al actualizar la liquidación')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEliminarLiquidacion = async () => {
    if (!confirm('¿Estás seguro de revertir esta liquidación? Esta acción devolverá los asociados al estado "Por Liquidar".')) {
      return
    }

    try {
      await eliminarLiquidacion(liquidacionId)
      alert('Liquidación revertida exitosamente')
      router.push('/liquidacion')
    } catch (error) {
      console.error('Error deleting liquidacion:', error)
      alert('Error al revertir la liquidación')
    }
  }

  const handleCompartirWhatsApp = () => {
    if (!liquidacion) return

    const nombres = liquidacion.nombres_asociados?.join(', ') || 'Asociados'
    const ahorroUtilidad = (liquidacion.total_cuotas || 0) * 30000 + (liquidacion.total_inscripciones || 0) + (liquidacion.total_utilidad || 0) - (liquidacion.total_comision || 0)
    const deducciones = liquidacion.total_deducciones || 0
    const neto = liquidacion.neto_entregar || 0

    const mensaje = `Liquidación de ${nombres}\n\n` +
      `Ahorro+Utilidad: $${ahorroUtilidad.toLocaleString()}\n` +
      `Deducciones: $${deducciones.toLocaleString()}\n` +
      `Recibes: $${neto.toLocaleString()}`

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(mensaje)}`
    window.open(whatsappUrl, '_blank')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8 flex items-center justify-center">
        <p className="text-xl text-gray-400">Cargando liquidación...</p>
      </div>
    )
  }

  if (!liquidacion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-400 mb-4">Liquidación no encontrada</p>
          <Link href="/liquidacion" className="text-blue-400 hover:text-blue-300">
            Volver a Liquidaciones
          </Link>
        </div>
      </div>
    )
  }

  const subtotal = liquidacion.subtotal || 0
  const descuento4xMil = liquidacion.descuento_4xmil || 0
  const deducciones = liquidacion.total_deducciones || 0
  const neto = liquidacion.neto_entregar || 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold text-white">Extracto de Liquidación</h1>
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
              href="/liquidacion"
              className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Regresar</span>
            </Link>
          </div>
        </div>

        {/* Información de la Liquidación */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6 border border-gray-700">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-4">Asociados Liquidados</h2>
            <div className="flex flex-wrap gap-2">
              {(liquidacion.nombres_asociados || []).map((nombre, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-blue-700 text-white rounded-lg text-sm"
                >
                  {nombre}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-gray-700 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">Fecha de Liquidación</p>
              <p className="text-lg font-semibold text-white">
                {new Date(liquidacion.fecha_liquidacion).toLocaleDateString('es-ES')}
              </p>
            </div>
            <div className="p-4 bg-gray-700 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">Total Cuotas</p>
              <p className="text-lg font-semibold text-white">{liquidacion.total_cuotas || 0}</p>
            </div>
          </div>

          {/* Resumen Financiero */}
          <div className="space-y-4">
            <div className="p-4 bg-gray-700 rounded-lg">
              <div className="flex justify-between items-center">
                <p className="text-gray-300">Cuotas ({liquidacion.total_cuotas || 0} x $30.000)</p>
                <p className="text-white font-semibold">
                  ${((liquidacion.total_cuotas || 0) * 30000).toLocaleString()}
                </p>
              </div>
            </div>
            
            <div className="p-4 bg-gray-700 rounded-lg">
              <div className="flex justify-between items-center">
                <p className="text-gray-300">Inscripciones</p>
                <p className="text-white font-semibold">
                  ${(liquidacion.total_inscripciones || 0).toLocaleString()}
                </p>
              </div>
            </div>
            
            <div className="p-4 bg-gray-700 rounded-lg">
              <div className="flex justify-between items-center">
                <p className="text-gray-300">Utilidad</p>
                <p className="text-white font-semibold">
                  ${(liquidacion.total_utilidad || 0).toLocaleString()}
                </p>
              </div>
            </div>
            
            <div className="p-4 bg-gray-700 rounded-lg">
              <div className="flex justify-between items-center">
                <p className="text-gray-300">Comisión Admin (8%)</p>
                <p className="text-red-400 font-semibold">
                  -${(liquidacion.total_comision || 0).toLocaleString()}
                </p>
              </div>
            </div>
            
            <div className="p-4 bg-gray-700 rounded-lg border-t-2 border-gray-600">
              <div className="flex justify-between items-center">
                <p className="text-gray-300 font-semibold">Subtotal</p>
                <p className="text-white font-bold text-lg">
                  ${subtotal.toLocaleString()}
                </p>
              </div>
            </div>
            
            <div className="p-4 bg-red-900 bg-opacity-50 rounded-lg border border-red-700">
              <div className="flex justify-between items-center">
                <p className="text-red-200">Descuento 4xMil Egreso</p>
                <p className="text-red-400 font-semibold">
                  -${descuento4xMil.toLocaleString()}
                </p>
              </div>
            </div>
            
            <div className="p-4 bg-red-900 bg-opacity-50 rounded-lg border border-red-700">
              <div className="flex justify-between items-center">
                <p className="text-red-200">Deducciones (Capital Pendiente)</p>
                <p className="text-red-400 font-semibold">
                  -${deducciones.toLocaleString()}
                </p>
              </div>
            </div>
            
            <div className="p-4 bg-blue-900 bg-opacity-50 rounded-lg border-2 border-blue-700">
              <div className="flex justify-between items-center">
                <p className="text-blue-200 font-bold text-lg">NETO A ENTREGAR</p>
                <p className="text-white font-bold text-3xl">
                  ${neto.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              <span>Editar</span>
            </button>
            <button
              onClick={handleCompartirWhatsApp}
              className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp</span>
            </button>
            <button
              onClick={handleEliminarLiquidacion}
              className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Eliminar</span>
            </button>
          </div>
        </div>

        {/* Modal de Edición */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4 border border-gray-700">
              <h2 className="text-2xl font-bold mb-4 text-white">Editar Liquidación</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Cuotas
                  </label>
                  <input
                    type="number"
                    value={editingData.cuotas}
                    onChange={(e) => setEditingData({ ...editingData, cuotas: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Inscripciones
                  </label>
                  <input
                    type="number"
                    value={editingData.inscripciones}
                    onChange={(e) => setEditingData({ ...editingData, inscripciones: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    min="0"
                    step="1000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Utilidad
                  </label>
                  <input
                    type="number"
                    value={editingData.utilidad}
                    onChange={(e) => setEditingData({ ...editingData, utilidad: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    min="0"
                    step="1000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Comisión Admin
                  </label>
                  <input
                    type="number"
                    value={editingData.comision}
                    onChange={(e) => setEditingData({ ...editingData, comision: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    min="0"
                    step="1000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Deducciones
                  </label>
                  <input
                    type="number"
                    value={editingData.deducciones}
                    onChange={(e) => setEditingData({ ...editingData, deducciones: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    min="0"
                    step="1000"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleGuardarEdicion}
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                  >
                    {submitting ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

