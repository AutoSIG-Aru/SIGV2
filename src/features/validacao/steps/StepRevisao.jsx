import { fileIcon } from '../../../components/fileUtils'

export default function StepRevisao({
  aluno, validacoes,
  docReqAssinado, docHistorico, docPrograma, docControleCurricular, docCertif,
  declarou, setDeclarou,
  onSubmit, onBack,
  enviando, envErro, envErroDetalhe,
}) {
  const todosDocumentos = [...docReqAssinado, ...docHistorico, ...docPrograma, ...docControleCurricular, ...docCertif]

  return (
    <form onSubmit={onSubmit}>
      <div className="form-card">
        <div className="section-header">
          <span className="step-num">4</span>Revisão e Envio
        </div>

        {/* Requerente */}
        <div className="review-block">
          <div className="review-label">Requerente</div>
          <div className="review-value">{aluno.nome || <span style={{ color: '#c0cce0', fontStyle: 'italic' }}>Não informado</span>}</div>
        </div>

        {/* Dados resumidos */}
        <div className="review-grid" style={{ marginBottom: 12 }}>
          {[
            ['Matrícula', aluno.matricula],
            ['CPF', aluno.cpf],
            ['Curso', aluno.curso],
            ['E-mail', aluno.email],
            ['Telefone', aluno.telefone],
            ['Solicitações', `${validacoes.length} disciplina${validacoes.length !== 1 ? 's' : ''}`],
          ].map(([lbl, val]) => (
            <div key={lbl} className="review-block" style={{ marginBottom: 0 }}>
              <div className="review-label">{lbl}</div>
              <div className="review-value">{val || '—'}</div>
            </div>
          ))}
        </div>

        {/* Documentos */}
        <div className="review-block" style={{ marginBottom: 0 }}>
          <div className="review-label">Documentos Anexados ({todosDocumentos.length})</div>
          <div className="review-value" style={{ fontSize: 13, marginTop: 6 }}>
            {todosDocumentos.length === 0
              ? <span style={{ color: '#c0cce0', fontStyle: 'italic' }}>Nenhum documento</span>
              : todosDocumentos.map((f, i) => (
                <span key={i} style={{ display: 'inline-block', background: '#eef4ff', border: '1px solid #d0e0f8', borderRadius: 6, padding: '2px 10px', marginRight: 6, marginBottom: 4, fontSize: 12 }}>
                  {fileIcon(f)} {f.name}
                </span>
              ))
            }
          </div>
        </div>

        {/* Declaração */}
        <label className="declare-box">
          <input
            type="checkbox"
            checked={declarou}
            onChange={e => setDeclarou(e.target.checked)}
          />
          <span>
            <strong>Declaração de Veracidade:</strong> Declaro que os documentos são cópias fiéis dos originais
            e que as informações são verídicas, conforme o <strong>Decreto Federal nº 8.539/2015</strong>.
          </span>
        </label>

        {envErro && (
          <div className="alert-error">
            ❌ Não foi possível enviar o requerimento.
            <br />
            <small>Verifique sua conexão e tente novamente. Se o problema persistir, entre em contato com a coordenação acadêmica.</small>
            {envErroDetalhe && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
                  Detalhes técnicos
                </summary>
                <pre style={{
                  marginTop: 6,
                  padding: '8px 10px',
                  background: '#fff',
                  border: '1px solid #ffcccc',
                  borderRadius: 6,
                  fontSize: 11,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: '#7a1a1a',
                }}>
                  {envErroDetalhe}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>

      <div className="wizard-nav">
        <button type="button" className="btn-back" onClick={onBack} disabled={enviando}>← Voltar</button>
        <button
          type="submit"
          className="submit-btn"
          disabled={enviando || !declarou}
          style={{ opacity: (enviando || !declarou) ? 0.7 : 1 }}
        >
          {enviando ? '⏳ Enviando...' : '✅ Finalizar e Enviar Requerimento'}
        </button>
      </div>
      <p className="submit-decree">Documento em conformidade com o Decreto nº 8.539/2015</p>
    </form>
  )
}
