// ── curriculoService.js — CRUD de currículos via Supabase ─────────────────────
//
// Tabelas necessárias (schema public do Supabase):
//   public.curriculos             — metadados de cada currículo de curso
//   public.curriculo_disciplinas  — disciplinas vinculadas a um currículo
//
// Execute o arquivo curriculo_schema_supabase.sql no SQL Editor do Supabase
// antes de usar este serviço.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'

// ── Lista nomes únicos de cursos ativos (para selects) ────────────────────────
export async function listarCursos() {
  const { data, error } = await supabase
    .from('curriculos')
    .select('nome')
    .eq('ativo', true)
    .order('nome')

  if (error) throw new Error(error.message)
  const vistos = new Set()
  return (data ?? [])
    .filter(({ nome }) => { if (vistos.has(nome)) return false; vistos.add(nome); return true })
    .map(({ nome }) => nome)
}

// ── Lista todos os currículos ativos ─────────────────────────────────────────
export async function listarCurriculos() {
  const { data, error } = await supabase
    .from('curriculos')
    .select('id, codigo, curriculo_codigo, nome, campus, ativo')
    .eq('ativo', true)
    .order('nome')

  if (error) throw new Error(error.message)
  return data ?? []
}

// ── Busca um currículo completo (metadados + disciplinas) ─────────────────────
export async function buscarCurriculo(curriculoId) {
  const [
    { data: curso, error: e1 },
    { data: disciplinas, error: e2 },
  ] = await Promise.all([
    supabase
      .from('curriculos')
      .select('*')
      .eq('id', curriculoId)
      .single(),
    supabase
      .from('curriculo_disciplinas')
      .select('*')
      .eq('curriculo_id', curriculoId)
      .eq('ativo', true)
      .order('fase', { ascending: true, nullsFirst: false })
      .order('nome'),
  ])

  if (e1) throw new Error(e1.message)
  if (e2) throw new Error(e2.message)

  return {
    curso,
    disciplinas: (disciplinas ?? []).map(d => ({
      ...d,
      _id: String(d.id),                          // chave estável para o React
      equivalentes:   d.equivalentes   ?? [],
      pre_requisitos: d.pre_requisitos ?? [],
    })),
  }
}

// ── Salva um currículo (metadados + disciplinas) ──────────────────────────────
// Estratégia: atualiza a linha do curso, apaga as disciplinas antigas do
// currículo e insere o conjunto atual. A versão histórica é registrada pelo
// n8n via webhook separado.
export async function salvarCurriculo({ curriculoId, dadosCurso, disciplinas, responsavel }) {
  // 1. Atualiza metadados
  const { error: e1 } = await supabase
    .from('curriculos')
    .update({
      nome:                     dadosCurso.nome,
      campus:                   dadosCurso.campus,
      habilitacao:              dadosCurso.habilitacao,
      titulacao:                dadosCurso.titulacao,
      diplomado_em:             dadosCurso.diplomado_em,
      objetivo:                 dadosCurso.objetivo,
      periodo_min_semestres:    dadosCurso.periodo_min_semestres   ?? null,
      periodo_max_semestres:    dadosCurso.periodo_max_semestres   ?? null,
      carga_horaria_ufsc_ha:    dadosCurso.carga_horaria_ufsc_ha   ?? null,
      carga_horaria_cne_h:      dadosCurso.carga_horaria_cne_h     ?? null,
      carga_horaria_estagio_ha: dadosCurso.carga_horaria_estagio_ha ?? null,
      aulas_semanais_min:       dadosCurso.aulas_semanais_min      ?? null,
      aulas_semanais_max:       dadosCurso.aulas_semanais_max      ?? null,
      coordenador:              dadosCurso.coordenador,
      telefone:                 dadosCurso.telefone,
      updated_at:               new Date().toISOString(),
      updated_by:               responsavel,
    })
    .eq('id', curriculoId)

  if (e1) throw new Error(e1.message)

  // 2. Remove disciplinas antigas deste currículo
  const { error: e2 } = await supabase
    .from('curriculo_disciplinas')
    .delete()
    .eq('curriculo_id', curriculoId)

  if (e2) throw new Error(e2.message)

  // 3. Insere disciplinas atualizadas (ignora linhas sem código ou nome)
  const validas = disciplinas.filter(d => d.codigo?.trim() && d.nome?.trim())

  if (validas.length > 0) {
    const rows = validas.map(d => ({
      curriculo_id:      curriculoId,
      curriculo_codigo:  dadosCurso.curriculo_codigo,
      curso_codigo:      dadosCurso.codigo,
      codigo:            d.codigo.trim().toUpperCase(),
      nome:              d.nome.trim(),
      tipo:              d.tipo              ?? 'Obrigatória',
      tipo_raw:          d.tipo_raw          ?? tipoParaRaw(d.tipo),
      carga_horaria_ha:  toInt(d.carga_horaria_ha),
      aulas_semanais:    toInt(d.aulas_semanais),
      fase:              toInt(d.fase),
      ementa:            d.ementa            ?? null,
      equivalentes:      d.equivalentes      ?? [],
      pre_requisitos:    d.pre_requisitos     ?? [],
      pre_ch:            toInt(d.pre_ch),
      ativo:             true,
    }))

    const { error: e3 } = await supabase
      .from('curriculo_disciplinas')
      .insert(rows)

    if (e3) throw new Error(e3.message)
  }

  return { ok: true, totalDisciplinas: validas.length }
}

// ── Busca carga horária de disciplinas a partir do currículo do curso ──────────
/**
 * Retorna um map { [codigo]: carga_horaria_ha } para os códigos fornecidos.
 * Localiza o currículo pelo nome do curso (match parcial, case-insensitive).
 * Quando o currículo ou a disciplina não é encontrado, omite a chave.
 */
export async function buscarCargaHorariasDisciplinas(cursoNome, codigos) {
  if (!codigos?.length) return {}

  const codigosUpper = codigos.map(c => c.toUpperCase())

  // Tentativa 1: busca pelo currículo do curso (quando cursoNome disponível)
  if (cursoNome?.trim()) {
    const { data: curr } = await supabase
      .from('curriculos')
      .select('id')
      .ilike('nome', `%${cursoNome.trim()}%`)
      .limit(1)
      .maybeSingle()

    if (curr) {
      const { data: discs } = await supabase
        .from('curriculo_disciplinas')
        .select('codigo, carga_horaria_ha')
        .eq('curriculo_id', curr.id)
        .in('codigo', codigosUpper)

      const mapa = {}
      for (const d of (discs || [])) {
        if (d.carga_horaria_ha != null) mapa[d.codigo] = d.carga_horaria_ha
      }
      if (Object.keys(mapa).length > 0) return mapa
    }
  }

  // Fallback: busca só pelo código da disciplina (sem filtro de curso)
  const { data: discs } = await supabase
    .from('curriculo_disciplinas')
    .select('codigo, carga_horaria_ha')
    .in('codigo', codigosUpper)
    .limit(codigos.length * 3)

  const mapa = {}
  for (const d of (discs || [])) {
    // Usa o primeiro resultado encontrado por código
    if (d.carga_horaria_ha != null && !mapa[d.codigo]) {
      mapa[d.codigo] = d.carga_horaria_ha
    }
  }
  return mapa
}

// ── Helpers internos ──────────────────────────────────────────────────────────
function toInt(val) {
  if (val === '' || val == null) return null
  const n = parseInt(val)
  return isNaN(n) ? null : n
}

function tipoParaRaw(tipo) {
  const m = { Obrigatória: 'Ob', Optativa: 'Op', Eletiva: 'Es', Específica: 'Ex' }
  return m[tipo] ?? 'Op'
}
