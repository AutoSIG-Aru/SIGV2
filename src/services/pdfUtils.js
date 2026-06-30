/**
 * Utilitários compartilhados pelos geradores de PDF do SIG.
 */

export const ASSINA_UFSC_URL = 'https://assina.ufsc.br'

/**
 * Carrega o brasão UFSC como base64 para uso no jsPDF.
 * Usa a versão local em public/logo-ufsc.png
 */
export async function carregarLogoBase64() {
  try {
    const resp = await fetch('/logo-ufsc.png')
    if (!resp.ok) return null
    const blob = await resp.blob()
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    return base64
  } catch {
    return null
  }
}
