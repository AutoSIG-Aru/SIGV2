// Validações específicas do formulário de Validação de Disciplinas.
// Utilitários genéricos de arquivo (fileIcon, formatFileSize) ficam em
// src/components/fileUtils.js.

// CPF formatting
export function formatCPF(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

// Phone formatting
export function formatTelefone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
  }
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
}

// Basic CPF validation
export function isValidCPF(cpf) {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i)
  let r = (sum * 10) % 11
  if (r === 10 || r === 11) r = 0
  if (r !== parseInt(digits[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i)
  r = (sum * 10) % 11
  if (r === 10 || r === 11) r = 0
  return r === parseInt(digits[10])
}

// Validate step 0 (aluno + validacoes)
export function validateStep0(aluno, validacoes) {
  const erros = {}

  if (!aluno.nome.trim()) erros.nome = 'Nome obrigatório'
  if (!aluno.matricula.trim()) erros.matricula = 'Matrícula obrigatória'
  // CPF é opcional (alunos estrangeiros podem não ter CPF)
  // Mas, se preenchido, deve ser válido.
  if (aluno.cpf.trim() && !isValidCPF(aluno.cpf)) {
    erros.cpf = 'CPF inválido'
  }
  if (!aluno.curso) erros.curso = 'Selecione o curso'
  if (!aluno.email.trim()) {
    erros.email = 'E-mail obrigatório'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(aluno.email)) {
    erros.email = 'E-mail inválido'
  }
  if (!aluno.telefone.trim()) erros.telefone = 'Telefone obrigatório'

  const validacaoErros = validacoes.map(v => {
    const ve = {}
    if (!v.ufsc.codigo.trim()) ve.ufscCodigo = 'Código obrigatório'
    if (!v.ufsc.nome.trim()) ve.ufscNome = 'Nome obrigatório'
    ve.cursadas = v.cursadas.map(c => {
      const ce = {}
      if (!c.codigo.trim()) ce.codigo = 'Obrigatório'
      if (!c.nome.trim()) ce.nome = 'Obrigatório'
      if (!c.carga.trim()) ce.carga = 'Obrigatório'
      if (!c.creditos.trim()) ce.creditos = 'Obrigatório'
      if (!c.instituicao.trim()) ce.instituicao = 'Obrigatório'
      return ce
    })
    return ve
  })

  return { erros, validacaoErros }
}

// Validate step 2 (documents)
export function validateStep2(docReqAssinado, docHistorico, docPrograma, docControleCurricular) {
  const erros = {}
  if (docReqAssinado.length === 0) erros.reqAssinado = 'Requerimento assinado obrigatório'
  if (docHistorico.length === 0) erros.historico = 'Histórico escolar obrigatório'
  if (docPrograma.length === 0) erros.planoEnsino = 'Programa/Plano de ensino obrigatório'
  if (docControleCurricular.length === 0) erros.controleCurricular = 'Controle curricular obrigatório'
  return erros
}
