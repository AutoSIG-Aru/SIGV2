import PublicLayout from '../../layouts/PublicLayout'

// ── SVG Icons ─────────────────────────────────────────────────────────────────
function IconValidacao({ size = 40, color = '#1e40af' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="7" y="4" width="22" height="28" rx="3" stroke={color} strokeWidth="2" fill="none"/>
      <path d="M12 13h12M12 18h12M12 23h7" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="29" cy="29" r="7" fill={color}/>
      <path d="M25.5 29l2.5 2.5 4.5-4.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconEquivalencia({ size = 40, color = '#065f46' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="3" y="10" width="14" height="16" rx="3" stroke={color} strokeWidth="2" fill="none"/>
      <rect x="23" y="14" width="14" height="16" rx="3" stroke={color} strokeWidth="2" fill="none"/>
      <path d="M17 16l6-3M17 24l6 3" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M22 13l2.5 3-2.5 3" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18 21l-2.5 3 2.5 3" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconInfo({ size = 14, color = '#92400e' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
      <circle cx="7" cy="7" r="6" stroke={color} strokeWidth="1.4"/>
      <path d="M7 6v5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="7" cy="4" r="0.8" fill={color}/>
    </svg>
  )
}

// ── Dados dos tipos ───────────────────────────────────────────────────────────
const TIPOS = [
  {
    id: 'validacao',
    Icon: IconValidacao,
    titulo: 'Validação de Disciplinas',
    descricao:
      'Solicite o aproveitamento de disciplina cursada em outra instituição de ensino ' +
      'superior ou na própria UFSC.',
    tags: ['Interna (UFSC) ou Externa', 'Carga horária e créditos exigidos'],
    cor: '#1e40af',
    corClara: '#dbeafe',
    corBorda: '#93c5fd',
    corHover: '#1d3a9e',
    bg: '#f8faff',
  },
  {
    id: 'equivalencia',
    Icon: IconEquivalencia,
    titulo: 'Equivalência de Disciplinas',
    descricao:
      'Reconhecimento de equivalência entre disciplinas cursadas na própria UFSC, ' +
      'em cursos distintos do mesmo campus.',
    tags: ['Somente interna (UFSC)', 'Código e nome da disciplina'],
    cor: '#065f46',
    corClara: '#d1fae5',
    corBorda: '#6ee7b7',
    corHover: '#054d38',
    bg: '#f0fdf9',
  },
]

// ── Card ──────────────────────────────────────────────────────────────────────
function TipoCard({ tipo, navigate }) {
  const { id, Icon, titulo, descricao, tags, cor, corClara, corBorda, corHover, bg } = tipo
  return (
    <button
      type="button"
      onClick={() => navigate(`/solicitar/${id}`)}
      style={{
        flex: '1 1 300px',
        textAlign: 'left',
        background: '#fff',
        border: `1.5px solid ${corBorda}`,
        borderTop: `4px solid ${cor}`,
        borderRadius: 14,
        padding: 0,
        cursor: 'pointer',
        transition: 'box-shadow 0.18s, transform 0.14s',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = `0 8px 30px rgba(0,0,0,0.10)`
        e.currentTarget.style.transform = 'translateY(-3px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Corpo do card */}
      <div style={{ padding: '28px 28px 20px', flex: 1 }}>
        {/* Ícone */}
        <div style={{
          width: 60, height: 60,
          borderRadius: 14,
          background: corClara,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 18,
        }}>
          <Icon size={36} color={cor} />
        </div>

        {/* Título */}
        <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', marginBottom: 10, lineHeight: 1.3 }}>
          {titulo}
        </div>

        {/* Descrição */}
        <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.7, margin: '0 0 18px' }}>
          {descricao}
        </p>

        {/* Tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tags.map(tag => (
            <span key={tag} style={{
              fontSize: 11, fontWeight: 600,
              color: cor,
              background: corClara,
              borderRadius: 20,
              padding: '3px 11px',
              whiteSpace: 'nowrap',
            }}>
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{
        padding: '16px 28px',
        borderTop: `1px solid ${corBorda}`,
        background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: cor }}>
          Iniciar solicitação
        </span>
        <span style={{
          width: 28, height: 28,
          borderRadius: 8,
          background: cor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 15, lineHeight: 1,
        }}>→</span>
      </div>
    </button>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function TipoSelector({ navigate }) {
  return (
    <PublicLayout navigate={navigate}>
      <div className="page-container" style={{ maxWidth: 820 }}>

        {/* Cabeçalho */}
        <div style={{ textAlign: 'center', marginBottom: 40, paddingTop: 8 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 11, fontWeight: 700, color: '#1e40af',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            background: '#dbeafe', borderRadius: 20, padding: '4px 14px',
            marginBottom: 16,
          }}>
            UFSC · Campus Araranguá
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 12px', lineHeight: 1.25 }}>
            Aproveitamento de Disciplinas
          </h1>
          <p style={{ fontSize: 14.5, color: '#64748b', maxWidth: 500, margin: '0 auto', lineHeight: 1.7 }}>
            Selecione abaixo o tipo de solicitação que deseja realizar.
            Todas as etapas são realizadas digitalmente.
          </p>
        </div>

        {/* Cards */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 28 }}>
          {TIPOS.map(t => <TipoCard key={t.id} tipo={t} navigate={navigate} />)}
        </div>

        {/* Aviso */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 10,
          padding: '13px 18px',
          fontSize: 12.5, color: '#92400e', lineHeight: 1.65,
        }}>
          <IconInfo />
          <span>
            <b>Dúvida sobre qual modalidade usar?</b> Entre em contato com a Coordenação Acadêmica
            Integrada da UFSC Araranguá antes de iniciar o preenchimento.
          </span>
        </div>

      </div>
    </PublicLayout>
  )
}
