import { useState } from 'react'
import { gerarRequerimentoPDF, ASSINA_UFSC_URL } from '../../../services/pdfGenerator'

export default function StepRequerimento({ aluno, validacoes, onNext, onBack }) {
  const [baixado, setBaixado] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [erroGeracao, setErroGeracao] = useState('')

  async function handleDownload() {
    setErroGeracao('')
    setGerando(true)
    try {
      // Gera e baixa o PDF (async — carrega o brasão antes de gerar)
      await gerarRequerimentoPDF(aluno, validacoes)
      // Abre o Assina UFSC em uma nova guia
      window.open(ASSINA_UFSC_URL, '_blank', 'noopener,noreferrer')
      setBaixado(true)
    } catch (err) {
      console.error('Erro ao gerar PDF:', err)
      setErroGeracao('Não foi possível gerar o PDF. Tente novamente.')
    } finally {
      setGerando(false)
    }
  }

  function handleNext() {
    if (!baixado) return
    onNext()
  }

  return (
    <div>
      <div className="form-card">
        <div className="section-header">
          <span className="step-num">2</span>Requerimento Gerado
        </div>

        {/* Documento formal */}
        <div style={{ border: '1px solid #d0dff0', borderRadius: 10, padding: '28px 32px', background: '#fff' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#555' }}>SERVIÇO PÚBLICO FEDERAL</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#00296b' }}>UNIVERSIDADE FEDERAL DE SANTA CATARINA</div>
            <div style={{ fontSize: 13, color: '#444' }}>CAMPUS ARARANGUÁ</div>
            <div style={{ fontSize: 13, color: '#444' }}>COORDENAÇÃO ACADÊMICA INTEGRADA</div>
            <div style={{ fontSize: 16, fontWeight: 900, marginTop: 8, color: '#00296b' }}>
              REQUERIMENTO PARA VALIDAÇÃO DE DISCIPLINAS
            </div>
          </div>

          {/* Dados do requerente */}
          <div className="review-block">
            <div className="review-label">DADOS DO REQUERENTE</div>
            <div className="review-grid" style={{ marginTop: 8 }}>
              {[['Nome', aluno.nome], ['Matrícula', aluno.matricula], ['CPF', aluno.cpf],
                ['Curso', aluno.curso], ['Telefone', aluno.telefone], ['E-mail', aluno.email]
              ].map(([lbl, val]) => (
                <div key={lbl}>
                  <div className="review-label">{lbl}</div>
                  <div className="review-value">{val || '—'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Disciplinas */}
          <div className="review-block">
            <div className="review-label">DISCIPLINAS QUE DESEJA VALIDAR</div>
            {validacoes.map((v, vi) => (
              <div key={vi} style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>
                  {v.mesmaInstituicao ? '🎓 Validação Interna' : '🏛️ Validação Externa'}
                </div>
                <div style={{ marginBottom: 8, fontSize: 13 }}>
                  <b>UFSC:</b> {v.ufsc.codigo} – {v.ufsc.nome}
                </div>
                {v.cursadas.map((c, ci) => (
                  <div key={ci} style={{ background: '#f6f9ff', border: '1px solid #dce8f8', borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 13 }}>
                    <div><b>Disciplina cursada:</b> {c.codigo} – {c.nome}</div>
                    <div><b>Instituição:</b> {c.instituicao || '—'}</div>
                    <div><b>Carga horária:</b> {c.carga}h | <b>Créditos:</b> {c.creditos}</div>
                    {c.ementa && (
                      <div style={{ marginTop: 6 }}>
                        <b>Ementa:</b>
                        <div style={{ fontSize: 12, marginTop: 2 }}>{c.ementa}</div>
                      </div>
                    )}
                  </div>
                ))}
                {v.justificativa && (
                  <div style={{ marginTop: 6, fontSize: 13 }}>
                    <b>Justificativa:</b>
                    <div style={{ fontSize: 12 }}>{v.justificativa}</div>
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>

        {/* Bloco de download + assinatura */}
        <div className="download-box">
          <div className="download-info">
            <div className="download-title">
              <span className="download-icon" aria-hidden="true">📄</span>
              Baixe o requerimento e assine digitalmente
            </div>
            <div className="download-desc">
              Ao clicar no botão abaixo, o PDF do requerimento será baixado e o
              <strong> Assina UFSC </strong>
              será aberto em uma nova guia para a assinatura digital.
            </div>
          </div>

          <button
            type="button"
            className={`btn-download ${baixado ? 'done' : ''}`}
            onClick={handleDownload}
            disabled={gerando}
          >
            {gerando
              ? 'Gerando PDF…'
              : baixado
                ? '✓ PDF baixado · Baixar novamente'
                : '⬇ Baixar Requerimento e abrir Assina UFSC'}
          </button>

          {erroGeracao && (
            <div className="alert-error" style={{ marginTop: 10 }}>{erroGeracao}</div>
          )}

          {baixado && (
            <div className="download-success">
              <span aria-hidden="true">✅</span>
              <span>
                PDF baixado com sucesso. Assine o documento em{' '}
                <a href={ASSINA_UFSC_URL} target="_blank" rel="noopener noreferrer">
                  assina.ufsc.br
                </a>{' '}
                e siga para a próxima etapa para anexar o documento assinado.
              </span>
            </div>
          )}
        </div>

        {/* Instrução de impressão */}
        <div className="instructions-box" style={{ marginTop: 20 }}>
          <b>📌 Próximos passos:</b>
          <ul>
            <li>Baixe o requerimento clicando no botão acima.</li>
            <li>Assine digitalmente no <strong>Assina UFSC</strong> (abre em nova guia).</li>
            <li>Na próxima etapa, anexe o requerimento já assinado junto com os demais documentos.</li>
          </ul>
        </div>
      </div>

      <div className="wizard-nav">
        <button type="button" className="btn-back" onClick={onBack}>← Voltar</button>
        <button
          type="button"
          className="submit-btn"
          onClick={handleNext}
          disabled={!baixado}
          title={!baixado ? 'Baixe o requerimento antes de continuar' : ''}
        >
          Anexar Documentos →
        </button>
      </div>

      {!baixado && (
        <div className="next-locked-hint">
          Baixe o requerimento acima para liberar a próxima etapa.
        </div>
      )}
    </div>
  )
}
