import { jsPDF } from 'jspdf'

interface DatosNaticredito {
  nombreAsociado: string
  fechaDesembolso: string
  montoDesembolsado: number
  urlExtracto: string
}

// ---------- Utilidades de datos ----------
const formatoMonto = (m: number): string =>
  "$" + Math.round(m).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")

const formatoFecha = (fecha: string): string => {
  const [y, m, d] = fecha.split('-').map(Number)
  return `${d}/${m}/${y}`
}

/**
 * Genera el PDF "Naticrédito en línea" (media carta, UNA sola página)
 * con el botón "INGRESAR A MI NATIEXTRACTO" como enlace clicable.
 */
function generarPdfNaticredito(datos: DatosNaticredito): jsPDF {
  // Media carta: 5.5 x 8.5 in = 396 x 612 pt. UNA página.
  const doc = new jsPDF({
    unit: "pt",
    format: [396, 612],
    orientation: "portrait",
    compress: true,
  })
  doc.setProperties({ title: "Naticrédito en línea" })

  // ---------- Diseño fijo ----------
  const S = 1.093 // escala del diseño base para llenar toda la hoja
  const X = (x: number) => 10 + (x - 26) * S
  const Y = (y: number) => (y - 26) * S
  const K = (n: number) => n * S

  const NAVY = "#13294B", BOX = "#2B4263", LINE = "#2C4262"
  const BTN = "#00A3EC", CYAN = "#00CFFF", LABEL = "#C9D2E0", ICON = "#DCE6F5"
  const WHITE = "#FFFFFF"

  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    doc.setFillColor(color)
    doc.rect(X(x), Y(y), K(w), K(h), "F")
  }
  const rrect = (x: number, y: number, w: number, h: number, r: number, color: string) => {
    doc.setFillColor(color)
    doc.roundedRect(X(x), Y(y), K(w), K(h), K(r), K(r), "F")
  }
  const text = (str: string, x: number, y: number, size: number, color: string, bold = false, align: "left" | "center" = "left") => {
    doc.setFont("helvetica", bold ? "bold" : "normal")
    doc.setFontSize(K(size))
    doc.setTextColor(color)
    doc.text(String(str), X(x), Y(y), { align })
  }

  // Fondo completo
  doc.setFillColor(NAVY)
  doc.rect(0, 0, 396, 612, "F")

  // Icono institución (banco)
  doc.setFillColor(ICON)
  doc.triangle(X(52), Y(68), X(65), Y(57), X(78), Y(68), "F")
  rect(53, 69, 24, 1.6, ICON)
  const columnas = [55, 61.2, 67.4, 73.6]
  columnas.forEach((cx) => rect(cx, 70, 2.6, 11, ICON))
  rect(52, 81.8, 26, 2.2, ICON)
  rect(50, 85.3, 30, 2.2, ICON)

  // Encabezado
  text("NATICRÉDITO", 90, 78, 19, WHITE, true)
  doc.setDrawColor(LINE)
  doc.setLineWidth(1)
  doc.line(X(52), Y(106), X(344), Y(106))

  // Títulos
  text("¡Tu Naticrédito en línea!", 198, 151, 18, WHITE, true, "center")

  // "Hola, NOMBRE": se reduce solo si el nombre es muy largo
  let hs = 11.5
  const saludo = `Hola, ${datos.nombreAsociado.toUpperCase()}`
  doc.setFont("helvetica", "normal")
  doc.setFontSize(K(hs))
  while (doc.getTextWidth(saludo) > K(290) && hs > 7) {
    hs -= 0.5
    doc.setFontSize(K(hs))
  }
  text(saludo, 198, 186, hs, WHITE, false, "center")
  text("Tu información siempre a la mano.", 198, 214, 11, WHITE, false, "center")

  // Recuadro de datos
  rrect(48, 236, 300, 150, 10, BOX)
  text("FECHA DE DESEMBOLSO", 62, 264, 11, LABEL)
  text(formatoFecha(datos.fechaDesembolso), 62, 294, 19, WHITE, true)
  text("MONTO DESEMBOLSADO", 62, 328, 11, LABEL)
  text(formatoMonto(datos.montoDesembolsado), 62, 360, 20, CYAN, true)

  // Botón + ENLACE embebido (toda el área del botón es clicable)
  rrect(48, 406, 300, 56, 8, BTN)
  // Intentar poner el texto en una sola línea si cabe
  doc.setFont("helvetica", "bold")
  doc.setFontSize(K(12.5))
  const textoBoton = "INGRESAR A MI NATIEXTRACTO"
  const anchoTexto = doc.getTextWidth(textoBoton)
  if (anchoTexto <= K(280)) {
    // Cabe en una línea, centrado verticalmente
    text(textoBoton, 198, 438.5, 12.5, WHITE, true, "center")
  } else {
    // No cabe, usar dos líneas como en el original
    text("INGRESAR A MI", 198, 430, 12.5, WHITE, true, "center")
    text("NATIEXTRACTO", 198, 447, 12.5, WHITE, true, "center")
  }

  if (datos.urlExtracto) {
    doc.link(X(48), Y(406), K(300), K(56), { url: datos.urlExtracto })
  }

  // Pie
  text("Consulta tu extracto cuando lo", 198, 490, 11, WHITE, false, "center")
  text("necesites.", 198, 506, 11, WHITE, false, "center")

  return doc
}

export async function generarNaticreditoPDF(datos: DatosNaticredito): Promise<Blob> {
  const doc = generarPdfNaticredito(datos)
  return doc.output('blob') as Blob
}

export async function descargarNaticreditoPDF(datos: DatosNaticredito) {
  const doc = generarPdfNaticredito(datos)
  doc.save(`Naticredito_${datos.nombreAsociado.replace(/\s+/g, '_')}.pdf`)
}

export async function compartirNaticreditoPDF(datos: DatosNaticredito): Promise<boolean> {
  try {
    const doc = generarPdfNaticredito(datos)
    const pdfBlob = doc.output('blob') as Blob
    const pdfFile = new File([pdfBlob], `Naticredito_${datos.nombreAsociado.replace(/\s+/g, '_')}.pdf`, {
      type: 'application/pdf'
    })

    // Verificar si el navegador soporta compartir archivos
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      await navigator.share({
        files: [pdfFile],
        title: 'Naticrédito',
        text: `Naticrédito de ${datos.nombreAsociado}`
      })
      return true
    } else {
      // Si no soporta compartir, descargar automáticamente
      doc.save(`Naticredito_${datos.nombreAsociado.replace(/\s+/g, '_')}.pdf`)
      return false
    }
  } catch (error) {
    console.error('Error al compartir PDF:', error)
    // Si hay error, descargar automáticamente
    const doc = generarPdfNaticredito(datos)
    doc.save(`Naticredito_${datos.nombreAsociado.replace(/\s+/g, '_')}.pdf`)
    return false
  }
}