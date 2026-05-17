import { CURSOS, FIELD_LABELS } from '../constants'
import { formatCPF, formatTelefone } from '../validation'

export default function StepDados({ aluno, setAluno, validacoes, setValidacoes, erros, validacaoErros, onNext, newCursada, newValidacao }) {
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
          <ul>
            <li>Preencha todos os campos obrigatórios antes de avançar.</li>
            <li>Para cada disciplina da UFSC, informe a(s) disciplina(s) equivalente(s) cursada(s).</li>
            <li>Validação <b>Interna</b>: disciplinas cursadas na própria UFSC. <b>Externa</b>: outra instituição.</li>
            <li>Anexe a documentação comprobatória na etapa seguinte.</li>
          </ul>
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
          {erros.nome && <div className="field-err">⚠️ {erros.nome}</div>}
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
            {erros.matricula && <div className="field-err">⚠️ {erros.matricula}</div>}
          </div>
          <div>
            <label className="field-label">CPF (opcional)</label>
            <input
              className={`field-input ${erros.cpf ? 'error' : ''}`}
              placeholder="000.000.000-00"
              value={aluno.cpf}
              onChange={e => updateAluno('cpf', formatCPF(e.target.value))}
            />
            {erros.cpf && <div className="field-err">⚠️ {erros.cpf}</div>}
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
          {erros.curso && <div className="field-err">⚠️ {erros.curso}</div>}
        </div>

        <div className="grid-2">
          <div>
            <label className="field-label">E-mail Institucional *</label>
            <input
              className={`field-input ${erros.email ? 'error' : ''}`}
              type="email"
              placeholder="nome@grad.ufsc.br"
              value={aluno.email}
              onChange={e => updateAluno('email', e.target.value)}
            />
            {erros.email && <div className="field-err">⚠️ {erros.email}</div>}
          </div>
          <div>
            <label className="field-label">Telefone / WhatsApp *</label>
            <input
              className={`field-input ${erros.telefone ? 'error' : ''}`}
              placeholder="(48) 99999-9999"
              value={aluno.telefone}
              onChange={e => updateAluno('telefone', formatTelefone(e.target.value))}
            />
            {erros.telefone && <div className="field-err">⚠️ {erros.telefone}</div>}
          </div>
        </div>
      </div>

      {/* ---- DISCIPLINAS ---- */}
      <div className="form-card">
        <div className="section-header">
          <span className="step-num">2</span>Disciplinas para Validação
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
                <div className="sub-label">🎓 Disciplina UFSC (que deseja validar)</div>
                <div className="grid-2">
                  <div>
                    <label className="field-label">Código *</label>
                    <input
                      className={`field-input ${vErr.ufscCodigo ? 'error' : ''}`}
                      placeholder="Ex: EES7513"
                      value={v.ufsc.codigo}
                      onChange={e => updateUfsc(vi, 'codigo', e.target.value.toUpperCase())}
                    />
                    {vErr.ufscCodigo && <div className="field-err">⚠️ {vErr.ufscCodigo}</div>}
                  </div>
                  <div>
                    <label className="field-label">Nome da Disciplina *</label>
                    <input
                      className={`field-input ${vErr.ufscNome ? 'error' : ''}`}
                      placeholder="Ex: Algoritmos e Programação"
                      value={v.ufsc.nome}
                      onChange={e => updateUfsc(vi, 'nome', e.target.value)}
                    />
                    {vErr.ufscNome && <div className="field-err">⚠️ {vErr.ufscNome}</div>}
                  </div>
                </div>
              </div>

              {/* Tipo de Validação */}
              <div style={{ marginBottom: 14 }}>
                <label className="field-label">Tipo de Validação</label>
                <div className="toggle-row">
                  <button type="button" className={`toggle-opt ${!v.mesmaInstituicao ? 'on' : ''}`} onClick={() => setTipo(vi, false)}>
                    🏛️ Externa (outra instituição)
                  </button>
                  <button type="button" className={`toggle-opt ${v.mesmaInstituicao ? 'on' : ''}`} onClick={() => setTipo(vi, true)}>
                    🎓 Interna (própria UFSC)
                  </button>
                </div>
              </div>

              {/* Disciplinas Cursadas */}
              <div className="sub-label">📚 Disciplina(s) Cursada(s) Equivalente(s)</div>
              {v.cursadas.map((c, ci) => {
                const cErr = (vErr.cursadas || [])[ci] || {}
                return (
                  <div key={ci} className="cursada-item">
                    {v.cursadas.length > 1 && (
                      <button type="button" className="btn-remove" onClick={() => removeCursada(vi, ci)} title="Remover">✕</button>
                    )}

                    {(!v.mesmaInstituicao || ci === 0) && (
                      <div style={{ marginBottom: 12 }}>
                        <label className="field-label">Instituição de Origem *</label>
                        <input
                          className={`field-input ${cErr.instituicao ? 'error' : ''}`}
                          placeholder={v.mesmaInstituicao ? 'UFSC' : 'Nome da Instituição'}
                          value={c.instituicao}
                          onChange={e => updateCursada(vi, ci, 'instituicao', e.target.value)}
                        />
                        {cErr.instituicao && <div className="field-err">⚠️ {cErr.instituicao}</div>}
                      </div>
                    )}

                    <div className="grid-4">
                      {['codigo', 'nome', 'carga', 'creditos'].map(field => (
                        <div key={field}>
                          <label className="field-label">{FIELD_LABELS[field]} *</label>
                          <input
                            className={`field-input ${cErr[field] ? 'error' : ''}`}
                            value={c[field]}
                            onChange={e => updateCursada(vi, ci, field, e.target.value)}
                          />
                          {cErr[field] && <div className="field-err">⚠️ {cErr[field]}</div>}
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
                  </div>
                )
              })}

              {v.cursadas.length < 3 && (
                <button type="button" className="btn-add-cursada" onClick={() => addCursada(vi)}>
                  <span style={{ fontSize: 16 }}>+</span> Adicionar Disciplina Equivalente
                </button>
              )}

              {/* Justificativa */}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #e8edf8' }}>
                <label className="field-label">Justificativa Acadêmica</label>
                <textarea
                  className="field-input"
                  placeholder="Descreva o motivo desta solicitação..."
                  value={v.justificativa}
                  onChange={e => updateValidacao(vi, 'justificativa', e.target.value)}
                  rows={2}
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>
          )
        })}

        <button type="button" className="btn-add-validation" onClick={() => setValidacoes(prev => [...prev, newValidacao()])}>
          <span style={{ fontSize: 30 }}>+</span>
          <span>Adicionar Nova Solicitação de Validação</span>
        </button>
      </div>

      <div className="wizard-nav">
        <span />
        <button type="submit" className="submit-btn">Gerar Requerimento →</button>
      </div>
    </form>
  )
}
