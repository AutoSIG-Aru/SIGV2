// Utilitários genéricos para manipulação visual de arquivos enviados via upload.
// Usados pelo UploadZone e por componentes que listam anexos.

/**
 * Retorna um emoji representando o tipo do arquivo, baseado na extensão.
 */
export function fileIcon(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext === 'pdf') return '📄'
  if (['jpg', 'jpeg', 'png'].includes(ext)) return '🖼️'
  if (['doc', 'docx'].includes(ext)) return '📝'
  return '📎'
}

/**
 * Formata um tamanho em bytes em uma string legível (B, KB ou MB).
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
