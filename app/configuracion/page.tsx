'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Home, Save, AlertCircle } from 'lucide-react'
import { 
  ConfiguracionNacional, 
  obtenerConfiguracionNacional, 
  actualizarConfiguracionNacional
} from '@/lib/configuracion'

export default function ConfiguracionPage() {
  const [configuracion, setConfiguracion] = useState<ConfiguracionNacional | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    anio_vigente: new Date().getFullYear(),
    valor_inscripcion: 10000,
    valor_cuota: 30000,
    valor_dia_mora: 3000,
    porcentaje_administracion: 8
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const config = await obtenerConfiguracionNacional()
      
      if (config) {
        setConfiguracion(config)
        setFormData({
          anio_vigente: config.anio_vigente,
          valor_inscripcion: config.valor_inscripcion,
          valor_cuota: config.valor_cuota,
          valor_dia_mora: config.valor_dia_mora,
          porcentaje_administracion: config.porcentaje_administracion
        })
      } else {
        // Si no existe, usar valores por defecto
        setFormData({
          anio_vigente: new Date().getFullYear(),
          valor_inscripcion: 10000,
          valor_cuota: 30000,
          valor_dia_mora: 3000,
          porcentaje_administracion: 8
        })
      }
    } catch (error: any) {
      console.error('Error loading configuracion:', error)
      const errorMessage = error?.message || 'Error desconocido'
      if (error?.code === '42P01' || errorMessage.includes('does not exist')) {
        setError('Error: La tabla configuracion_nacional no existe. Por favor, créala en Supabase.')
      } else {
        setError(`Error al cargar la configuración: ${errorMessage}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    
    // Conversión estricta de todos los valores a números
    const anioVigente = Number(formData.anio_vigente) || new Date().getFullYear()
    const valorInscripcion = Number(formData.valor_inscripcion) || 0
    const valorCuota = Number(formData.valor_cuota) || 0
    const valorDiaMora = Number(formData.valor_dia_mora) || 0
    const porcentajeAdmin = Number(formData.porcentaje_administracion) || 0
    
    // Validaciones
    if (isNaN(anioVigente) || isNaN(valorInscripcion) || isNaN(valorCuota) || isNaN(valorDiaMora) || isNaN(porcentajeAdmin)) {
      setError('Todos los valores deben ser números válidos')
      return
    }
    
    if (valorInscripcion <= 0 || valorCuota <= 0 || valorDiaMora <= 0) {
      setError('Todos los valores deben ser mayores a 0')
      return
    }

    if (porcentajeAdmin < 0 || porcentajeAdmin > 100) {
      setError('El porcentaje de administración debe estar entre 0 y 100')
      return
    }
    
    if (anioVigente < 2020 || anioVigente > 2100) {
      setError('El año vigente debe estar entre 2020 y 2100')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      
      // Preparar datos con valores numéricos explícitos
      const datosConfiguracion = {
        anio_vigente: Number(anioVigente),
        valor_inscripcion: Number(valorInscripcion),
        valor_cuota: Number(valorCuota),
        valor_dia_mora: Number(valorDiaMora),
        porcentaje_administracion: Number(porcentajeAdmin)
      }
      
      await actualizarConfiguracionNacional(datosConfiguracion)
      
      // Recargar datos
      await loadData()
      
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      
    } catch (error: any) {
      console.error('Error saving configuracion:', error)
      const errorMessage = error?.message || 'Error desconocido'
      setError(`Error al guardar: ${errorMessage}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8 flex items-center justify-center">
        <p className="text-xl text-gray-600 dark:text-gray-400">Cargando configuración...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Navegación */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white">
            Configuración Nacional
          </h1>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Volver al Home</span>
          </Link>
        </div>

        {/* Mensaje de advertencia */}
        <div className="bg-yellow-100 dark:bg-yellow-900 border-2 border-yellow-500 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
                ⚠️ Importante
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Los cambios en esta configuración aplican <strong>solo a nuevos registros</strong>. 
                Los registros existentes (cuotas, moras, inscripciones) no se verán afectados.
              </p>
            </div>
          </div>
        </div>

        {/* Mensaje de éxito */}
        {success && (
          <div className="bg-green-100 dark:bg-green-900 border-2 border-green-500 rounded-lg p-4 mb-6">
            <p className="text-green-800 dark:text-green-200 font-semibold">
              ✅ Configuración guardada exitosamente
            </p>
          </div>
        )}

        {/* Formulario */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-200">
            Editar Configuración
          </h2>
          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 rounded-lg">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="anio_vigente" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Año Vigente *
                </label>
                <input
                  type="number"
                  id="anio_vigente"
                  value={formData.anio_vigente}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || new Date().getFullYear()
                    setFormData({ ...formData, anio_vigente: value })
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                  min="2020"
                  max="2100"
                />
              </div>

              <div>
                <label htmlFor="valor_inscripcion" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Valor de Inscripción por Cupo *
                </label>
                <input
                  type="number"
                  id="valor_inscripcion"
                  value={formData.valor_inscripcion}
                  onChange={(e) => setFormData({ ...formData, valor_inscripcion: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                  min="0"
                  step="1000"
                />
              </div>

              <div>
                <label htmlFor="valor_cuota" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Valor de Cuota Quincenal *
                </label>
                <input
                  type="number"
                  id="valor_cuota"
                  value={formData.valor_cuota}
                  onChange={(e) => setFormData({ ...formData, valor_cuota: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                  min="0"
                  step="1000"
                />
              </div>

              <div>
                <label htmlFor="valor_dia_mora" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Valor de Mora Diaria *
                </label>
                <input
                  type="number"
                  id="valor_dia_mora"
                  value={formData.valor_dia_mora}
                  onChange={(e) => setFormData({ ...formData, valor_dia_mora: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                  min="0"
                  step="1000"
                />
              </div>

              <div>
                <label htmlFor="porcentaje_administracion" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Porcentaje de Administración (%) *
                </label>
                <input
                  type="number"
                  id="porcentaje_administracion"
                  value={formData.porcentaje_administracion}
                  onChange={(e) => setFormData({ ...formData, porcentaje_administracion: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4" />
                {submitting ? 'Guardando...' : 'Guardar Configuración'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
