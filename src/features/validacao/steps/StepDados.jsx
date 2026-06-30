import { CURSOS, FIELD_LABELS } from '../constants'
import { formatCPF, formatTelefone } from '../validation'

// ── Ícone de erro inline ──────────────────────────────────────────────────────
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

function FieldErr({ msg }) {
  if (!msg) return null
  return <div className="field-err"><IconErr />{msg}</div>
}

export default function StepDados({ aluno, setAluno, validacoes, setValidacoes, erros, validacaoErros, onNext, newCursada, newValidacao, tipo = 'validacao' }) {
  const isEquivalencia = tipo === 'equivalencia'
  function updateAluno(field, value) {
    setAluno(prev => ({ ...prev, [field]: value }))
  }

  function updateValidacao(vi, field, value) {
    setValidacoes(prev => {
      const next = [...prev]
      next[vi] = { ...next[vi], [field]: value }
      return next
    })
  }

  function updateUfsc(vi, field, value) {
    setValidacoes(prev => {
      const next = [...prev]
      next[vi] = { ...next[vi], ufsc: { ...next[vi].ufsc, [field]: value } }
      return next
    })
  }

  function updateCursada(vi, ci, field, value) {
    setValidacoes(prev => {
      const next = [...prev]
      const cursadas = [...next[vi].cursadas]
      cursadas[ci] = { ...cursadas[ci], [field]: value }
      // Se interna, replica instituição para todas cursadas
      if (field === 'instituicao' && next[vi].mesmaInstituicao) {
        cursadas.forEach((_, idx) => { cursadas[idx] = { ...cursadas[idx], instituicao: value } })
      }
      next[vi] = { ...next[vi], cursadas }
      return next
    })
  }

  function addCursada(vi) {
    setValidacoes(prev => {
      const next = [...prev]
      const nova = newCursada()
      if (next[vi].mesmaInstituicao && next[vi].cursadas.length > 0) {
        nova.instituicao = next[vi].cursadas[0].instituicao
      }
      next[vi] = { ...next[vi], cursadas: [...next[vi].cursadas, nova] }
      return next
    })
  }

  function removeCursada(vi, ci) {
    setValidacoes(prev => {
      const next = [...prev]
      next[vi] = { ...next[vi], cursadas: next[vi].cursadas.filter((_, i) => i !== ci) }
      return next
    })
  }

  function removeValidacao(vi) {
    setValidacoes(prev => prev.filter((_, i) => i !== vi))
  }

  function setTipo(vi, interna) {
    setValidacoes(prev => {
      const next = [...prev]
      next[vi] = { ...next[vi], mesmaInstituicao: interna }
      return next
    })
  }

  function handleSubmit(e) {
    e.preventDefault()
    onNext()
  }

  const ve = validacaoErros || []

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* ---- INSTRUÇÕES ---- */}
      <div className="form-card">
        <div className="instructions-box">
          <b>Instruções Importantes</b>
          {isEquivalencia ? (
            <ul>
              <li>Preencha todos os campos obrigatórios antes de avançar.</li>
              <li>Informe a disciplina da UFSC que deseja usar como equivalente.</li>
              <li>A disciplina cursada deve ter sido realizada em outro curso da própria UFSC.</li>
              <li>Inclua uma justificativa explicando a equivalência solicitada.</li>
            </ul>
          ) : (
            <ul>
              <li>Preencha todos os campos obrigatórios antes de avançar.</li>
              <li>Para cada disciplina da UFSC, informe a(s) disciplina(s) equivalente(s) cursada(s).</li>
              <li>Validação <b>Interna</b>: disciplinas cursadas na própria UFSC. <b>Externa</b>: outra instituição.</li>
              <li>Anexe a documentação comprobatória na etapa seguinte.</li>
            </ul>
          )}
          <div className="decree">Este formulário está em conformidade com o Decreto Federal nº 8.539/2015.</div>
        </div>
      </div>

      {/* ---- DADOS DO ALUNO ---- */}
      <div className="form-card">
        <div className="section-header">
          <span className="step-num">1</span>Dados do Requerente
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="field-label">Nome Completo *</label>

          <input
            className={`field-input ${erros.nome ? 'error' : ''}`}
            placeholder="Seu nome completo"
            value={aluno.nome}
            onChange={e => updateAluno('nome', e.target.value)}
          />
          <FieldErr msg={erros.nome} />
        </div>

        <div className="grid-2" style={{ marginBottom: 16 }}>
          <div>
            <label className="field-label">Matrícula *</label>
            <input
              className={`field-input ${erros.matricula ? 'error' : ''}`}
              placeholder="Ex: 21100000"
              value={aluno.matricula}
              onChange={e => updateAluno('matricula', e.target.value.replace(/\D/g, ''))}
            />
            <FieldErr msg={erros.matricula} />
          </div>
          <div>
            <label className="field-label">CPF *</label>
            <input
              className={`field-input ${erros.cpf ? 'error' : ''}`}
              placeholder="000.000.000-00"
              value={aluno.cpf}
              onChange={e => updateAluno('cpf', formatCPF(e.target.value))}
            />
            <FieldErr msg={erros.cpf} />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="field-label">Curso *</label>
          <select
            className={`field-input ${erros.curso ? 'error' : ''}`}
            value={aluno.curso}
            onChange={e => updateAluno('curso', e.target.value)}
          >
            <option value="">Selecione seu curso...</option>
            {CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <FieldErr msg={erros.curso} />
        </div>

        <div className="grid-2">
          <div>
            <label className="field-label">E-mail *</label>
            <input
              className={`field-input ${erros.email ? 'error' : ''}`}
              type="email"
              placeholder="seu@email.com"
              value={aluno.email}
              onChange={e => updateAluno('email', e.target.value)}
            />
            <FieldErr msg={erros.email} />
          </div>
          <div>
            <label className="field-label">Telefone / WhatsApp *</label>
            <input
              className={`field-input ${erros.telefone ? 'error' : ''}`}
              placeholder="(48) 99999-9999"
              value={aluno.telefone}
              onChange={e => updateAluno('telefone', formatTelefone(e.target.value))}
            />
            <FieldErr msg={erros.telefone} />
          </div>
        </div>
      </div>

      {/* ---- DISCIPLINAS ---- */}
      <div className="form-card">
        <div className="section-header">
          <span className="step-num">2</span>
          {isEquivalencia ? 'Disciplinas para Equivalência' : 'Disciplinas para Validação'}
        </div>

        {validacoes.map((v, vi) => {
          const vErr = ve[vi] || {}
          return (
            <div key={vi} className="validation-item">
              {validacoes.length > 1 && (
                <button type="button" className="btn-remove" onClick={() => removeValidacao(vi)} title="Remover esta validação">✕</button>
              )}

              {/* Disciplina UFSC */}
              <div className="sub-card">
                <div className="sub-label">Disciplina UFSC (que deseja validar)</div>
                <div className="grid-2">
                  <div>
                    <label className="field-label">Código *</label>
                    <input
                      className={`field-input ${vErr.ufscCodigo ? 'error' : ''}`}
                      placeholder="Ex: EES7513"
                      value={v.ufsc.codigo}
                      onChange={e => updateUfsc(vi, 'codigo', e.target.value.toUpperCase())}
                    />
                    <FieldErr msg={vErr.ufscCodigo} />
                  </div>
                  <div>
                    <label className="field-label">Nome da Disciplina *</label>
                    <input
                      className={`field-input ${vErr.ufscNome ? 'error' : ''}`}
                      placeholder="Ex: Algoritmos e Programação"
                      value={v.ufsc.nome}
                      onChange={e => updateUfsc(vi, 'nome', e.target.value)}
                    />
                    <FieldErr msg={vErr.ufscNome} />
                  </div>
                </div>
              </div>

              {/* Tipo de Validação — oculto para Equivalência (sempre interna) */}
              {!isEquivalencia && (
                <div style={{ marginBottom: 14 }}>
                  <label className="field-label">Tipo de Validação</label>
                  <div className="toggle-row">
                    <button type="button" className={`toggle-opt ${!v.mesmaInstituicao ? 'on' : ''}`} onClick={() => setTipo(vi, false)}>
                      Externa (outra instituição)
                    </button>
                    <button type="button" className={`toggle-opt ${v.mesmaInstituicao ? 'on' : ''}`} onClick={() => setTipo(vi, true)}>
                      Interna (própria UFSC)
                    </button>
                  </div>
                </div>
              )}

              {/* Disciplinas Cursadas */}
              <div className="sub-label">
                {isEquivalencia ? 'Disciplina Cursada na UFSC (outro curso)' : 'Disciplina(s) Cursada(s) Equivalente(s)'}
              </div>
              {v.cursadas.map((c, ci) => {
                const cErr = (vErr.cursadas || [])[ci] || {}
                return (
                  <div key={ci} className="cursada-item">
                    {v.cursadas.length > 1 && (
                      <button type="button" className="btn-remove" onClick={() => removeCursada(vi, ci)} title="Remover">✕</button>
                    )}

                    {/* Externa: campo livre de instituição */}
                    {!isEquivalencia && !v.mesmaInstituicao && ci === 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <label className="field-label">Instituição de Origem *</label>
                        <input
                          className={`field-input ${cErr.instituicao ? 'error' : ''}`}
                          placeholder="Nome da Instituição"
                          value={c.instituicao}
                          onChange={e => updateCursada(vi, ci, 'instituicao', e.target.value)}
                        />
                        <FieldErr msg={cErr.instituicao} />
                      </div>
                    )}

                    {/* Interna: select do curso de origem na UFSC */}
                    {!isEquivalencia && v.mesmaInstituicao && ci === 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <label className="field-label">Curso de Origem (UFSC) *</label>
                        <select
                          className={`field-input ${cErr.cursoOrigem ? 'error' : ''}`}
                          value={c.cursoOrigem || ''}
                          onChange={e => {
                            updateCursada(vi, ci, 'cursoOrigem', e.target.value)
                            if (e.target.value !== 'Outro') updateCursada(vi, ci, 'cursoOrigemOutro', '')
                          }}
                        >
                          <option value="">Selecione o curso...</option>
                          {CURSOS.map(cr => <option key={cr} value={cr}>{cr}</option>)}
                          <option value="Outro">Outro campus da UFSC</option>
                        </select>
                        {c.cursoOrigem === 'Outro' && (
                          <input
                            className={`field-input ${cErr.cursoOrigemOutro ? 'error' : ''}`}
                            style={{ marginTop: 8 }}
                            placeholder="Ex: Engenharia Civil — UFSC Joinville"
                            value={c.cursoOrigemOutro || ''}
                            onChange={e => updateCursada(vi, ci, 'cursoOrigemOutro', e.target.value)}
                          />
                        )}
                        <FieldErr msg={cErr.cursoOrigem} />
                      </div>
                    )}

                    {/* Equivalência: só código e nome */}
                    {isEquivalencia ? (
                      <div className="grid-2">
                        {['codigo', 'nome'].map(field => (
                          <div key={field}>
                            <label className="field-label">{FIELD_LABELS[field]} *</label>
                            <input
                              className={`field-input ${cErr[field] ? 'error' : ''}`}
                              value={c[field]}
                              onChange={e => updateCursada(vi, ci, field, e.target.value)}
                            />
                            <FieldErr msg={cErr[field]} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid-4">
                        {['codigo', 'nome', 'carga', 'creditos'].map(field => (
                          <div key={field}>
                            <label className="field-label">{FIELD_LABELS[field]} *</label>
                            <input
                              className={`field-input ${cErr[field] ? 'error' : ''}`}
                              value={c[field]}
                              onChange={e => updateCursada(vi, ci, field, e.target.value)}
                            />
                            <FieldErr msg={cErr[field]} />
                          </div>
                        ))}
                        <div className="col-span-full">
                          <label className="field-label">Ementa / Conteúdo Programático</label>
                          <textarea
                            className="field-input"
                            placeholder="Cole aqui a ementa completa da disciplina..."
                            value={c.ementa}
                            onChange={e => updateCursada(vi, ci, 'ementa', e.target.value)}
                            rows={2}
                            style={{ resize: 'vertical' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Adicionar cursada — só para Validação */}
              {!isEquivalencia && v.cursadas.length < 3 && (
                <button type="button" className="btn-add-cursada" onClick={() => addCursada(vi)}>
                  <span style={{ fontSize: 16 }}>+</span> Adicionar Disciplina Equivalente
                </button>
              )}

              {/* Justificativa */}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #e8edf8' }}>
                <label className="field-label">
                  {isEquivalencia ? 'Justificativa *' : 'Justificativa Acadêmica'}
                </label>
                <textarea
                  className={`field-input ${vErr.justificativa ? 'error' : ''}`}
                  placeholder={isEquivalencia
                    ? 'Explique por que as disciplinas são equivalentes...'
                    : 'Descreva o motivo desta solicitação...'}
                  value={v.justificativa}
                  onChange={e => updateValidacao(vi, 'justificativa', e.target.value)}
                  rows={isEquivalencia ? 3 : 2}
                  style={{ resize: 'vertical' }}
                />
                <FieldErr msg={vErr.justificativa} />
              </div>
            </div>
          )
        })}

        <button type="button" className="btn-add-validation" onClick={() => setValidacoes(prev => [...prev, newValidacao(tipo)])}>
          <span style={{ fontSize: 30 }}>+</span>
          <span>{isEquivalencia ? 'Adicionar Nova Equivalência' : 'Adicionar Nova Solicitação de Validação'}</span>
        </button>
      </div>

      <div className="wizard-nav">
        <button type="button" className="btn-back" onClick={() => window.history.back()}>← Voltar</button>
        <button type="submit" className="submit-btn">Gerar Requerimento →</button>
      </div>
    </form>
  )
}
