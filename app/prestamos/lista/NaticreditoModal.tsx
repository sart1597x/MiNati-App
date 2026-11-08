'use client'

import { X, Download, Share2 } from 'lucide-react'
import { descargarNaticreditoPDF, compartirNaticreditoPDF } from '@/lib/generar-pdf'

interface NaticreditoModalProps {
  isOpen: boolean
  onClose: () => void
  nombreAsociado: string
  fechaDesembolso: string
  montoDesembolsado: number
  urlExtracto: string
}

export default function NaticreditoModal({
  isOpen,
  onClose,
  nombreAsociado,
  fechaDesembolso,
  montoDesembolsado,
  urlExtracto
}: NaticreditoModalProps) {
  const handleDescargarPDF = () => {
    descargarNaticreditoPDF({
      nombreAsociado,
      fechaDesembolso,
      montoDesembolsado,
      urlExtracto
    })
  }

  const handleCompartirPDF = async () => {
    const exito = await compartirNaticreditoPDF({
      nombreAsociado,
      fechaDesembolso,
      montoDesembolsado,
      urlExtracto
    })

    if (!exito) {
      alert('Tu navegador no permite compartir archivos. El PDF se ha descargado automáticamente. Puedes adjuntarlo manualmente.')
    }
  }

  if (!isOpen) return null

  // Formatear fecha
  const [y, m, d] = fechaDesembolso.split('-').map(Number)
  const fechaFormateada = new Date(y, m - 1, d).toLocaleDateString('es-ES')

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-[#0a1e3c] to-[#1a3a5c] rounded-2xl shadow-2xl max-w-md w-full border border-[#283c5a]">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-[#283c5a]">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏦</span>
            <h2 className="text-2xl font-bold text-white">NATICRÉDITO</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <h3 className="text-xl font-bold text-white text-center mb-2">
            ¡Tu Naticrédito en línea!
          </h3>
          <p className="text-gray-300 text-center mb-6">
            Hola, {nombreAsociado}
          </p>

          {/* Card */}
          <div className="bg-[#283c5a] rounded-xl p-6 mb-6">
            <div className="mb-4">
              <p className="text-gray-400 text-sm mb-1">Fecha de desembolso</p>
              <p className="text-white text-lg font-semibold">{fechaFormateada}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Monto desembolsado</p>
              <p className="text-[#00c8ff] text-lg font-semibold">
                ${montoDesembolsado.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Button */}
          <a
            href={urlExtracto}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-gradient-to-r from-[#0064c8] to-[#00c8ff] text-white text-center py-3 rounded-xl font-semibold hover:from-[#0050a0] hover:to-[#00a8d4] transition-all mb-6"
          >
            INGRESAR A MI NATIEXTRACTO
          </a>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleDescargarPDF}
              className="flex-1 flex items-center justify-center gap-2 bg-[#283c5a] hover:bg-[#3a4e6a] text-white py-3 rounded-xl font-semibold transition-colors"
            >
              <Download className="w-5 h-5" />
              <span>Descargar PDF</span>
            </button>
            <button
              onClick={handleCompartirPDF}
              className="flex-1 flex items-center justify-center gap-2 bg-[#283c5a] hover:bg-[#3a4e6a] text-white py-3 rounded-xl font-semibold transition-colors"
            >
              <Share2 className="w-5 h-5" />
              <span>Compartir PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
