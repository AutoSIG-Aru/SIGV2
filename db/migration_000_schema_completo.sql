-- =============================================================================
-- SIG Validação de Disciplinas — Schema Completo
-- Inclui: todas as tabelas, sistema de perfis (SIG / Coordenação), RLS e RPC
--
-- Execute inteiro em um único run no Supabase SQL Editor (ou via MCP).
-- =============================================================================

-- Habilitar extensão para hash de senhas (bcrypt) — usada pela Auth
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. USUARIOS
--    Perfis vinculados ao auth.users.
--    perfil: 'sig'         → acessa tudo
--            'coordenacao' → acessa só requerimentos do seu curso
--    curso: obrigatório para coordenadores; NULL para SIG
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.usuarios (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome       TEXT        NOT NULL,
  email      TEXT,
  perfil     TEXT        NOT NULL CHECK (perfil IN ('sig', 'coordenacao')),
  curso      TEXT,
  ativo      BOOLEAN     NOT NULL DEFAULT true,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Garante no máximo um coordenador por curso
CREATE UNIQUE INDEX IF NOT EXISTS unico_coordenador_por_curso
  ON public.usuarios (curso)
  WHERE perfil = 'coordenacao';

-- =============================================================================
-- 2. REQUERIMENTOS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.requerimentos (
  id                BIGSERIAL   PRIMARY KEY,
  numero_processo   TEXT,
  status            TEXT        NOT NULL DEFAULT 'novo'
                    CHECK (status IN (
                      'novo', 'em_revisao_ia', 'triagem_sig',
                      'em_analise_coord', 'parecer_coord',
                      'revisao_solicitada', 'concluido'
                    )),
  tipo_requerimento TEXT        NOT NULL DEFAULT 'validacao'
                    CHECK (tipo_requerimento IN ('validacao', 'equivalencia')),
  nome_aluno        TEXT        NOT NULL,
  matricula         TEXT,
  cpf               TEXT,
  curso             TEXT,
  email             TEXT,
  telefone          TEXT,
  sumario_ia        JSONB,
  sumario_ia_modelo TEXT,
  sumario_ia_em     TIMESTAMPTZ,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 3. VALIDAÇÕES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.validacoes (
  id                 BIGSERIAL   PRIMARY KEY,
  requerimento_id    BIGINT      NOT NULL REFERENCES public.requerimentos(id) ON DELETE CASCADE,
  indice             INTEGER     NOT NULL DEFAULT 1,
  tipo               TEXT        NOT NULL DEFAULT 'interna' CHECK (tipo IN ('interna', 'externa')),
  ufsc_codigo        TEXT,
  ufsc_nome          TEXT,
  justificativa      TEXT,
  decisao            TEXT        CHECK (decisao IN ('aprovado', 'rejeitado', 'pendente') OR decisao IS NULL),
  decisao_observacao JSONB,
  sumario_ia         JSONB,
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 4. DISCIPLINAS CURSADAS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.disciplinas_cursadas (
  id            BIGSERIAL   PRIMARY KEY,
  validacao_id  BIGINT      NOT NULL REFERENCES public.validacoes(id) ON DELETE CASCADE,
  codigo        TEXT,
  nome          TEXT        NOT NULL,
  instituicao   TEXT,
  carga_horaria INTEGER,
  creditos      NUMERIC(5,1),
  ementa        TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 5. ANEXOS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.anexos (
  id              BIGSERIAL   PRIMARY KEY,
  requerimento_id BIGINT      NOT NULL REFERENCES public.requerimentos(id) ON DELETE CASCADE,
  categoria       TEXT        NOT NULL,
  mime_type       TEXT,
  storage_path    TEXT        NOT NULL,
  nome_original   TEXT,
  tamanho_bytes   BIGINT,
  enviado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 6. EVENTOS DE AUDITORIA
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.eventos_auditoria (
  id              BIGSERIAL   PRIMARY KEY,
  requerimento_id BIGINT      NOT NULL REFERENCES public.requerimentos(id) ON DELETE CASCADE,
  usuario_id      UUID        REFERENCES public.usuarios(id),
  tipo_evento     TEXT        NOT NULL,
  descricao       TEXT,
  status_anterior TEXT,
  status_novo     TEXT,
  meta            JSONB,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 7. CURRÍCULOS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.curriculos (
  id                       BIGSERIAL   PRIMARY KEY,
  codigo                   TEXT,
  curriculo_codigo         TEXT,
  nome                     TEXT        NOT NULL,
  campus                   TEXT,
  ativo                    BOOLEAN     NOT NULL DEFAULT true,
  habilitacao              TEXT,
  titulacao                TEXT,
  diplomado_em             TEXT,
  objetivo                 TEXT,
  periodo_min_semestres    INTEGER,
  periodo_max_semestres    INTEGER,
  carga_horaria_ufsc_ha    INTEGER,
  carga_horaria_cne_h      INTEGER,
  carga_horaria_estagio_ha INTEGER,
  aulas_semanais_min       INTEGER,
  aulas_semanais_max       INTEGER,
  coordenador              TEXT,
  telefone                 TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by               TEXT
);

-- =============================================================================
-- 8. DISCIPLINAS DO CURRÍCULO
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.curriculo_disciplinas (
  id               BIGSERIAL   PRIMARY KEY,
  curriculo_id     BIGINT      NOT NULL REFERENCES public.curriculos(id) ON DELETE CASCADE,
  curriculo_codigo TEXT,
  curso_codigo     TEXT,
  codigo           TEXT        NOT NULL,
  nome             TEXT        NOT NULL,
  tipo             TEXT        NOT NULL DEFAULT 'Obrigatória',
  tipo_raw         TEXT        NOT NULL DEFAULT 'Ob',
  carga_horaria_ha INTEGER,
  aulas_semanais   INTEGER,
  fase             INTEGER,
  ementa           TEXT,
  equivalentes     JSONB       NOT NULL DEFAULT '[]',
  pre_requisitos   JSONB       NOT NULL DEFAULT '[]',
  pre_ch           INTEGER,
  ativo            BOOLEAN     NOT NULL DEFAULT true
);

-- =============================================================================
-- 9. RPC: atualizar_status_requerimento
--    SECURITY DEFINER para contornar RLS na atualização de status.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.atualizar_status_requerimento(
  p_id     BIGINT,
  p_status TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.requerimentos
  SET    status        = p_status,
         atualizado_em = now()
  WHERE  id = p_id;
END;
$$;

-- =============================================================================
-- 10. ROW LEVEL SECURITY
-- =============================================================================

-- ── usuarios ──────────────────────────────────────────────────────────────────
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- Cada usuário lê o próprio perfil
CREATE POLICY "usuarios: lê próprio perfil"
  ON public.usuarios FOR SELECT
  USING (id = auth.uid());

-- SIG lê todos os perfis (para buscar nome/curso de outros usuários)
CREATE POLICY "usuarios: sig lê todos"
  ON public.usuarios FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.perfil = 'sig')
  );

-- ── requerimentos ─────────────────────────────────────────────────────────────
ALTER TABLE public.requerimentos ENABLE ROW LEVEL SECURITY;

-- SIG: acesso total
CREATE POLICY "requerimentos: sig acessa tudo"
  ON public.requerimentos FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND perfil = 'sig')
  );

-- Coordenador: lê apenas os do seu curso
CREATE POLICY "requerimentos: coord lê seu curso"
  ON public.requerimentos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid() AND perfil = 'coordenacao' AND curso = requerimentos.curso
    )
  );

-- Coordenador: atualiza apenas os do seu curso (para mover status)
CREATE POLICY "requerimentos: coord atualiza seu curso"
  ON public.requerimentos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid() AND perfil = 'coordenacao' AND curso = requerimentos.curso
    )
  );

-- ── validacoes ────────────────────────────────────────────────────────────────
ALTER TABLE public.validacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "validacoes: acesso via requerimento"
  ON public.validacoes FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.requerimentos WHERE id = requerimento_id)
  );

-- ── disciplinas_cursadas ──────────────────────────────────────────────────────
ALTER TABLE public.disciplinas_cursadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "disciplinas_cursadas: acesso via validacao"
  ON public.disciplinas_cursadas FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.validacoes v
      JOIN  public.requerimentos r ON r.id = v.requerimento_id
      WHERE v.id = validacao_id
    )
  );

-- ── anexos ────────────────────────────────────────────────────────────────────
ALTER TABLE public.anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anexos: acesso via requerimento"
  ON public.anexos FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.requerimentos WHERE id = requerimento_id)
  );

-- ── eventos_auditoria ─────────────────────────────────────────────────────────
ALTER TABLE public.eventos_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eventos: acesso via requerimento"
  ON public.eventos_auditoria FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.requerimentos WHERE id = requerimento_id)
  );

-- ── curriculos ────────────────────────────────────────────────────────────────
ALTER TABLE public.curriculos ENABLE ROW LEVEL SECURITY;

-- Leitura: todos os autenticados (coordenadores consultam para buscar CH)
CREATE POLICY "curriculos: leitura autenticados"
  ON public.curriculos FOR SELECT
  TO authenticated
  USING (true);

-- Escrita: apenas SIG
CREATE POLICY "curriculos: escrita apenas SIG"
  ON public.curriculos FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND perfil = 'sig')
  );

-- ── curriculo_disciplinas ─────────────────────────────────────────────────────
ALTER TABLE public.curriculo_disciplinas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "curriculo_disciplinas: leitura autenticados"
  ON public.curriculo_disciplinas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "curriculo_disciplinas: escrita apenas SIG"
  ON public.curriculo_disciplinas FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND perfil = 'sig')
  );

-- =============================================================================
-- FIM DO SCHEMA
-- =============================================================================
-- Após aplicar, crie o usuário de teste no Supabase Dashboard:
--   Authentication → Users → Add user
--   E-mail: moniquedemoraes@hotmail.com  |  Senha: 1234
--
-- Depois insira o perfil:
--   INSERT INTO public.usuarios (id, nome, email, perfil, curso)
--   VALUES (
--     '<uuid gerado pelo Supabase>',
--     'Monique',
--     'moniquedemoraes@hotmail.com',
--     'coordenacao',
--     'Engenharia de Computação'
--   );
-- =============================================================================
