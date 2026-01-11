'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Home, MessageCircle, FolderOpen, Calendar, Trash2 } from 'lucide-react'
import { Mora, obtenerMorasActivas, registrarPagoMora } from '@/lib/moras'
import { supabase } from '@/lib/supabase'
import { crearMovimientoCaja, obtenerUltimoSaldo } from '@/lib/caja'

export default function MorasPage() {
  const [moras, setMoras] = useState<Mora[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [moraSeleccionada, setMoraSeleccionada] = useState<Mora | null>(null)
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0])
  const [valorRecibido, setValorRecibido] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // Cargar moras al montar el componente
    loadMoras()
    
    // Recargar moras cuando la ventana recibe foco (cuando el usuario vuelve a esta pestaña)
    const handleFocus = () => {
      loadMoras()
    }
    
    window.addEventListener('focus', handleFocus)
    
    // Cleanup
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  // REGLA: Log cuando se selecciona una mora y se abre el modal
  useEffect(() => {
    if (showModal && moraSeleccionada) {
      console.log('Mora cargada en modal:', {
        id: moraSeleccionada.id,
        idType: typeof moraSeleccionada.id,
        cedula: moraSeleccionada.cedula,
        nombre: moraSeleccionada.nombre,
        numero_cuota: moraSeleccionada.numero_cuota,
        resta: moraSeleccionada.resta,
        total_sancion: moraSeleccionada.total_sancion,
        valor_pagado: moraSeleccionada.valor_pagado
      })
    }
  }, [showModal, moraSeleccionada])

  const loadMoras = async () => {
    try {
      setLoading(true)
      const morasData = await obtenerMorasActivas()
      setMoras(morasData)
    } catch (error: any) {
      console.error('Error loading moras:', error)
      // Mostrar error más descriptivo
      const errorMessage = error?.message || 'Error desconocido'
      if (errorMessage.includes('404') || errorMessage.includes('relation') || errorMessage.includes('does not exist')) {
        alert('Error: La tabla "moras" no existe en Supabase. Por favor, ejecuta el script SQL para crear las tablas.')
      } else {
        alert(`Error al cargar las moras: ${errorMessage}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const handlePagarMora = (mora: Mora) => {
    // REGLA: Log de selección - verificar que los datos están completos
    console.log('Mora cargada en modal:', {
      id: mora.id,
      idType: typeof mora.id,
      cedula: mora.cedula,
      nombre: mora.nombre,
      numero_cuota: mora.numero_cuota,
      resta: mora.resta
    })
    
    // Verificar que la mora tiene ID y cédula válidos antes de abrir el modal
    if (!mora.id) {
      console.error('❌ Error: La mora no tiene ID válido:', mora)
      alert('Error: La mora seleccionada no tiene un ID válido. Por favor, recarga la página.')
      return
    }
    
    if (!mora.cedula || mora.cedula.trim() === '') {
      console.error('❌ Error: La mora no tiene cédula válida:', mora)
      alert('Error: La mora seleccionada no tiene cédula asociada. Por favor, verifica los datos del asociado.')
      return
    }
    
    // Establecer la mora seleccionada y abrir el modal
    setMoraSeleccionada(mora)
    setFechaPago(new Date().toISOString().split('T')[0])
    setValorRecibido('')
    setShowModal(true)
    
    console.log('✅ Modal abierto con mora:', mora.id, mora.cedula)
  }

  const handleRegistrarPago = async () => {
    // REGLA: Validaciones iniciales con verificación detallada
    console.log('🔍 [handleRegistrarPago] Validando mora seleccionada:', {
      moraSeleccionada: moraSeleccionada,
      tieneId: !!moraSeleccionada?.id,
      id: moraSeleccionada?.id,
      idType: typeof moraSeleccionada?.id,
      tieneCedula: !!moraSeleccionada?.cedula,
      cedula: moraSeleccionada?.cedula
    })
    
    if (!moraSeleccionada) {
      console.error('❌ Error: moraSeleccionada es null o undefined')
      alert('Error: No hay mora seleccionada. Por favor, selecciona una mora de la lista.')
      return
    }
    
    // REGLA: Verificar ID (puede ser UUID string o número)
    // Validar que el ID existe y no está vacío (para strings) o no es NaN (para números)
    const idValido = moraSeleccionada.id !== null && 
                     moraSeleccionada.id !== undefined && 
                     moraSeleccionada.id !== '' && 
                     !(typeof moraSeleccionada.id === 'number' && isNaN(moraSeleccionada.id))
    
    if (!idValido) {
      console.error('❌ Error: ID de mora inválido:', {
        id: moraSeleccionada.id,
        tipo: typeof moraSeleccionada.id,
        esNull: moraSeleccionada.id === null,
        esUndefined: moraSeleccionada.id === undefined,
        esStringVacio: moraSeleccionada.id === '',
        esNaN: typeof moraSeleccionada.id === 'number' && isNaN(moraSeleccionada.id)
      })
      alert(`Error: La mora seleccionada no tiene ID válido (ID recibido: ${moraSeleccionada.id}). Por favor, recarga la página.`)
      return
    }

    // REGLA: Obtener cedula directamente de la fila de la mora (NO usar socio_id)
    if (!moraSeleccionada.cedula || moraSeleccionada.cedula.trim() === '') {
      console.error('❌ Error: Cédula inválida:', moraSeleccionada.cedula)
      alert('Error: La mora no tiene cédula asociada. No se puede procesar el pago. Por favor, verifica los datos del asociado.')
      return
    }

    // Validar y convertir el valor a número
    if (!valorRecibido || valorRecibido.trim() === '') {
      alert('Por favor ingresa un valor válido')
      return
    }

    // Limpiar el valor (remover puntos de miles si hay)
    const valorLimpio = valorRecibido.replace(/\D/g, '')
    const valor = parseFloat(valorLimpio)

    if (isNaN(valor) || valor <= 0) {
      alert('Por favor ingresa un valor numérico válido mayor a 0')
      return
    }

    try {
      console.log('🚀 [FRONTEND] Iniciando registro de pago de mora...', {
        moraId: moraSeleccionada.id,
        cedula: moraSeleccionada.cedula,
        fechaPago,
        valor
      })
      
      setSubmitting(true)
      
      // REGLA: Simplificar - pasar mora_id (puede ser UUID o número), valor (Number), y cedula (String)
      // No convertir a número porque moras.id puede ser UUID
      const moraId = moraSeleccionada.id // Mantener como viene (UUID o número)
      const cedula = moraSeleccionada.cedula.trim() // String - RELACIÓN PRINCIPAL
      
      console.log('📞 [FRONTEND] Llamando a registrarPagoMora...', { 
        moraId, 
        cedula, 
        fechaPago, 
        valor 
      })
      
      await registrarPagoMora(
        moraId,     // UUID o número según la BD
        cedula,     // String - RELACIÓN PRINCIPAL (NO usar socio_id)
        valor,      // Number, no string
        fechaPago   // String YYYY-MM-DD
      )

      console.log('✅ [FRONTEND] Pago registrado exitosamente')

      // Cerrar modal y limpiar estado primero (antes de recargar para evitar race conditions)
      setShowModal(false)
      setMoraSeleccionada(null)
      setValorRecibido('')
      
      // Mostrar éxito inmediatamente
      alert('Pago registrado exitosamente')
      
      // Recargar moras en segundo plano sin bloquear (usar setTimeout para evitar race conditions)
      setTimeout(async () => {
        try {
          await loadMoras()
        } catch (loadError: any) {
          // Error al recargar no es crítico - el pago ya se registró correctamente
          console.warn('⚠️ [FRONTEND] Error al recargar moras después del pago (no crítico):', loadError?.message)
        }
      }, 500)
    } catch (error: any) {
      console.error('❌ [FRONTEND] ERROR CRÍTICO EN PAGO MORA:', {
        error: error,
        message: error?.message || 'Error desconocido',
        stack: error?.stack,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        moraSeleccionada: moraSeleccionada?.id,
        cedula: moraSeleccionada?.cedula,
        fechaPago,
        valorRecibido
      })
      
      // Mostrar error detallado al usuario
      const errorMessage = error?.message || 'Error desconocido al registrar el pago'
      alert(`Error al registrar el pago: ${errorMessage}\n\nRevisa la consola del navegador para más detalles.`)
    } finally {
      setSubmitting(false)
      console.log('🏁 [FRONTEND] Finalizando handleRegistrarPago')
    }
  }

  const handleWhatsAppGeneral = async () => {
    // Obtener todas las moras activas (resta > 0)
    const morasActivas = moras.filter(m => m.resta > 0)
    
    if (morasActivas.length === 0) {
      alert('No hay moras pendientes para enviar')
      return
    }
    
    // Crear mensaje general con todos los deudores
    let mensaje = `📋 REPORTE DE COBRO DE MORAS - MiNati2026\n\n`
    mensaje += `Total de deudores: ${morasActivas.length}\n\n`
    
    morasActivas.forEach((mora, index) => {
      mensaje += `${index + 1}. ${mora.nombre}\n`
      mensaje += `   Cuota: ${mora.numero_cuota}\n`
      mensaje += `   Días de mora: ${mora.dias_mora}\n`
      mensaje += `   Total sanción: $${mora.total_sancion.toLocaleString()}\n`
      mensaje += `   Valor pagado: $${mora.valor_pagado.toLocaleString()}\n`
      mensaje += `   Resta: $${mora.resta.toLocaleString()}\n\n`
    })
    
    mensaje += `⚠️ Recuerda que el pago extemporáneo trae una multa de $3.000 por día!\n\n`
    mensaje += `Por favor, realiza tu pago lo antes posible para evitar mayores cargos.`
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(mensaje)}`
    window.open(whatsappUrl, '_blank')
  }

  const handleEliminarMora = async (mora: Mora) => {
    const confirmacion = window.confirm(
      `¿Estás seguro de eliminar esta mora?\n\n` +
      `Asociado: ${mora.nombre}\n` +
      `Cuota: ${mora.numero_cuota}\n` +
      `Total sanción: $${mora.total_sancion.toLocaleString()}\n\n` +
      `Esto eliminará el registro de la mora de la base de datos.`
    )
    
    if (!confirmacion) {
      return
    }
    
    try {
      // Obtener el asociado por cédula para obtener su ID
      const { data: socio } = await supabase
        .from('asociados')
        .select('id, cedula')
        .eq('cedula', mora.cedula)
        .single()
      
      if (!socio) {
        alert('Asociado no encontrado')
        return
      }
      
      const asociadoId = typeof socio.id === 'string' ? parseInt(socio.id) : socio.id
      
      // Obtener el ID real de la mora desde la BD
      const { data: moraBD } = await supabase
        .from('moras')
        .select('id')
        .eq('asociado_id', asociadoId)
        .eq('cuota', mora.numero_cuota)
        .maybeSingle()
      
      if (moraBD) {
        // REGLA: Si la mora tenía valor_pagado > 0, registrar REVERSO en caja_central
        const valorPagado = parseFloat(String(mora.valor_pagado || 0)) || 0
        const tienePago = valorPagado > 0
        
        // Eliminar de la tabla moras
        await supabase
          .from('moras')
          .delete()
          .eq('id', moraBD.id)
        
        // También eliminar del historial_moras
        await supabase
          .from('historial_moras')
          .delete()
          .eq('mora_id', moraBD.id)
        
        // Actualizar monto_mora en cuotas_pagos a 0
        await supabase
          .from('cuotas_pagos')
          .update({ monto_mora: 0 })
          .eq('cedula', socio.cedula)
          .eq('numero_cuota', mora.numero_cuota)
        
        // REGLA: Si había pago registrado, insertar REVERSO en caja_central
        if (tienePago) {
          try {
            const saldoAnterior = await obtenerUltimoSaldo()
            const nuevoSaldo = saldoAnterior - valorPagado // Restar porque es un REVERSO
            
            await crearMovimientoCaja({
              tipo: 'EGRESO',
              concepto: `REVERSO - Eliminación Mora Cuota ${mora.numero_cuota} - ${mora.nombre}`,
              monto: valorPagado,
              saldo_anterior: saldoAnterior,
              nuevo_saldo: nuevoSaldo,
              fecha: new Date().toISOString().split('T')[0]
            })
            
            console.log('✅ REVERSO de mora eliminada registrado en caja_central')
          } catch (errorCaja: any) {
            console.error('❌ ERROR registrando REVERSO de mora eliminada en caja_central:', errorCaja)
            alert(`Mora eliminada, pero hubo un error al registrar el reverso en caja: ${errorCaja?.message || 'Error desconocido'}. Por favor, verifica manualmente la caja.`)
          }
        }
        
        alert('Mora eliminada correctamente')
        await loadMoras()
      } else {
        alert('Mora no encontrada en la base de datos')
      }
    } catch (error: any) {
      console.error('Error eliminando mora:', error)
      alert(`Error al eliminar la mora: ${error.message}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8 flex items-center justify-center">
        <p className="text-xl text-gray-600 dark:text-gray-400">Cargando moras...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white">
            Control de Moras
          </h1>
          <div className="flex gap-3">
            <button
              onClick={handleWhatsAppGeneral}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>📲 WhatsApp General</span>
            </button>
            <Link
              href="/pagos"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Calendar className="w-4 h-4" />
              <span>📅 Registrar Cuotas</span>
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>🏠 Home</span>
            </Link>
            <Link
              href="/moras/historial"
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              <span>📂 Historial de Moras</span>
            </Link>
          </div>
        </div>

        {/* Tabla de Moras */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Asociado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Fecha de Pago</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Cuota</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Días de Mora</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Valor Mora</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Total Sanción</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Valor Pagado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Resta</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {moras.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No hay moras activas en este momento
                    </td>
                  </tr>
                ) : (
                  moras.map((mora, index) => (
                    <tr key={`mora-${mora.id}-${mora.numero_cuota}-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-4 text-sm text-gray-900 dark:text-white">{index + 1}</td>
                      <td className="px-4 py-4 text-sm text-gray-900 dark:text-white">{mora.nombre}</td>
                      <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {mora.fecha_pago ? new Date(mora.fecha_pago).toLocaleDateString('es-ES') : '-'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{mora.numero_cuota}</td>
                      <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{mora.dias_mora}</td>
                      <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">${mora.valor_mora.toLocaleString()}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-gray-900 dark:text-white">${mora.total_sancion.toLocaleString()}</td>
                      <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">${mora.valor_pagado.toLocaleString()}</td>
                      <td className="px-4 py-4 text-sm font-bold text-red-600 dark:text-red-400">${mora.resta.toLocaleString()}</td>
                      <td className="px-4 py-4 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handlePagarMora(mora)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors"
                          >
                            Pagar Mora
                          </button>
                          <button
                            onClick={() => handleEliminarMora(mora)}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition-colors flex items-center gap-1"
                            title="Eliminar mora"
                          >
                            <Trash2 className="w-3 h-3" />
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal para pagar mora */}
        {showModal && moraSeleccionada && moraSeleccionada.id && moraSeleccionada.cedula && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
                Pagar Mora
              </h2>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Asociado:</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {moraSeleccionada.nombre}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Cuota:</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    #{moraSeleccionada.numero_cuota}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Resta pendiente:</p>
                  <p className="font-semibold text-red-600 dark:text-red-400">
                    ${moraSeleccionada.resta.toLocaleString()}
                  </p>
                </div>

                <div>
                  <label htmlFor="fechaPago" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Fecha del Pago *
                  </label>
                  <input
                    type="date"
                    id="fechaPago"
                    value={fechaPago}
                    onChange={(e) => setFechaPago(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="valorRecibido" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Valor Recibido *
                  </label>
                  <input
                    type="text"
                    id="valorRecibido"
                    value={valorRecibido}
                    onChange={(e) => {
                      const inputValue = e.target.value
                      // Permitir borrar
                      if (inputValue === '') {
                        setValorRecibido('')
                        return
                      }
                      // Formatear con puntos de miles mientras escribe
                      const soloNumeros = inputValue.replace(/\D/g, '')
                      if (soloNumeros) {
                        const formateado = parseInt(soloNumeros, 10).toLocaleString('es-CO')
                        setValorRecibido(formateado)
                      } else {
                        setValorRecibido('')
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Ej: 3000 o 3.000"
                    inputMode="numeric"
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Puede ser un abono parcial. El valor se formateará automáticamente.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleRegistrarPago}
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? 'Registrando...' : 'Registrar Pago'}
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowModal(false)
                      setMoraSeleccionada(null)
                    }}
                    className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
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

