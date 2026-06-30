import PublicLayout from '../layouts/PublicLayout'

/**
 * NotFound — página 404.
 *
 * Exibida pelo App quando nenhuma rota da tabela casa com o path atual.
 * Usa o PublicLayout (header + footer institucionais).
 *
 * Props:
 *   navigate(path) — função de roteamento do App.
 */
export default function NotFound({ navigate }) {
  return (
    <PublicLayout navigate={navigate}>
      <div style={{
        minHeight: 'calc(100vh - 160px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '48px 24px',
      }}>
        <div style={{
          maxWidth: 520, width: '100%', textAlign: 'center',
        }}>
          {/* Ícone */}
          <div style={{ marginBottom: 24 }}>
            <IconPagina />
          </div>

          {/* Código */}
          <div style={{
            fontSize: 72, fontWeight: 800, letterSpacing: '-2px',
            color: '#e2e8f0', lineHeight: 1, marginBottom: 8,
            fontFamily: 'monospace',
          }}>
            404
          </div>

          {/* Título */}
          <h1 style={{
            fontSize: 22, fontWeight: 700, color: '#1e293b',
            margin: '0 0 12px',
          }}>
            Página não encontrada
          </h1>

          {/* Descrição */}
          <p style={{
            fontSize: 14, color: '#64748b', lineHeight: 1.7,
            margin: '0 0 32px', maxWidth: 380, marginLeft: 'auto', marginRight: 'auto',
          }}>
            O endereço que você acessou não existe ou foi movido.
            Verifique o link ou volte à página inicial para fazer sua solicitação.
          </p>

          {/* Ações */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate ? navigate('/') : (window.location.href = '/')}
              style={{
                padding: '10px 24px', borderRadius: 8, border: 'none',
                background: '#00499f', color: '#fff',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#1d4ed8' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#00499f' }}
            >
              Página inicial
            </button>

            <button
              onClick={() => window.history.back()}
              style={{
                padding: '10px 24px', borderRadius: 8,
                border: '1.5px solid #e2e8f0', background: '#fff',
                color: '#475569', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#94a3b8' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0' }}
            >
              Voltar
            </button>
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}

// ── Ícone de documento com interrogação ───────────────────────────────────────
function IconPagina() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect x="10" y="6" width="36" height="46" rx="4"
        stroke="#cbd5e1" strokeWidth="2.5" fill="none"/>
      <path d="M18 20h20M18 28h20M18 36h12"
        stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="48" cy="46" r="12" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="2"/>
      <text x="48" y="51" textAnchor="middle"
        fontSize="14" fontWeight="800" fill="#94a3b8" fontFamily="monospace">
        ?
      </text>
    </svg>
  )
}
