import { useState, useRef } from 'react'
import { fileIcon, formatFileSize } from './fileUtils'
import { MAX_FILE_SIZE, ACCEPTED_TYPES } from './uploadConstants'

function IconErr() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
      aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
      <circle cx="6" cy="6" r="5.3" stroke="currentColor" strokeWidth="1.4"/>
      <line x1="6" y1="3.5" x2="6" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="6" cy="9" r="0.75" fill="currentColor"/>
    </svg>
  )
}

export default function UploadZone({ label, hint, required = false, multiple = false, files, onChange, error }) {
  const [dragOver, setDragOver] = useState(false)
  const [sizeError, setSizeError] = useState('')
  const inputRef = useRef()

  function addFiles(newFiles) {
    setSizeError('')
    const valid = []
    const oversized = []
    Array.from(newFiles).forEach(f => {
      if (f.size > MAX_FILE_SIZE) oversized.push(f.name)
      else valid.push(f)
    })
    if (oversized.length) setSizeError(`Arquivo(s) muito grande(s) (máx 15MB): ${oversized.join(', ')}`)
    if (valid.length === 0) return
    onChange(multiple ? [...files, ...valid] : [valid[0]])
  }

  function removeFile(index) {
    onChange(files.filter((_, i) => i !== index))
  }

  return (
    <div>
      <div
        className={`upload-zone ${dragOver ? 'drag-over' : ''} ${error ? 'has-error' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          multiple={multiple}
          style={{ display: 'none' }}
          onChange={e => addFiles(e.target.files)}
        />
        <span className="upload-icon">📁</span>
        <div className="upload-title">
          {label}
          <span className={`upload-badge ${required ? '' : 'optional'}`}>
            {required ? 'OBRIGATÓRIO' : 'OPCIONAL'}
          </span>
        </div>
        {hint && <div className="upload-hint">{hint}</div>}
        <div className="upload-hint" style={{ marginTop: 8 }}>
          Clique ou arraste arquivos (PDF, imagem, Word — máx. 15MB)
        </div>
      </div>

      {sizeError && <div className="file-err-msg"><IconErr /> {sizeError}</div>}
      {error && <div className="file-err-msg"><IconErr /> {error}</div>}

      {files.length > 0 && (
        <div className="file-list">
          {files.map((f, i) => (
            <div key={i} className="file-item">
              <span className="file-icon">{fileIcon(f)}</span>
              <span className="file-name">{f.name}</span>
              <span className="file-size">{formatFileSize(f.size)}</span>
              <button
                type="button"
                className="file-remove"
                onClick={e => { e.stopPropagation(); removeFile(i) }}
                title="Remover arquivo"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
