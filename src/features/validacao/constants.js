// Constantes específicas do formulário de Validação de Disciplinas.
// Constantes genéricas (limites de upload, tipos aceitos) ficam em
// src/components/uploadConstants.js.

// Cursos disponíveis no Campus Araranguá
export const CURSOS = [
  'Engenharia de Computação',
  'Engenharia de Energia',
  'Fisioterapia',
  'Medicina',
  'Tecnologias da Informação e Comunicação',
]

export const FIELD_LABELS = {
  codigo: 'Código',
  nome: 'Nome da Disciplina',
  carga: 'Carga Horária (h)',
  creditos: 'Créditos',
}

export const STEP_LABELS = ['Dados & Disciplinas', 'Requerimento', 'Documentos', 'Revisão & Envio']

export const newCursada = () => ({
  instituicao: '',
  cursoOrigem: '',
  cursoOrigemOutro: '',
  codigo: '',
  nome: '',
  carga: '',
  creditos: '',
  ementa: '',
})

export const newValidacao = (tipo = 'validacao') => ({
  // Equivalência é sempre interna (UFSC)
  mesmaInstituicao: tipo === 'equivalencia',
  ufsc: { codigo: '', nome: '' },
  cursadas: [newCursada()],
  justificativa: '',
})

export const initialAluno = {
  nome: '',
  matricula: '',
  cpf: '',
  curso: '',
  email: '',
  telefone: '',
}
