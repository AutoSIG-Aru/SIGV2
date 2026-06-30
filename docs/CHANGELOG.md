# CHANGELOG — SIG Validação de Disciplinas

Registro cronológico de todas as fases de desenvolvimento, com os arquivos
criados ou modificados em cada etapa.

---

## [Fase 0] Estrutura inicial

Formulário público de solicitação de validação, camada Supabase, geração de PDF e envio via n8n.

---

## [Fase 1] Remoção do protocolo e EmailJS

**Objetivo:** Eliminar geração de protocolo no front e dependência do EmailJS.

| Arquivo | Ação |
|---|---|
| `db/migration_001_remove_protocolo.sql` | Criado — remove coluna protocolo, atualiza RPC |
| `src/services/emailService.js` | Modificado → re-export de submissionService (shim) |
| `src/services/supabaseService.js` | Modificado — remove protocolo do payload |
| `src/services/n8nService.js` | Modificado — remove protocolo do payload |
| `src/features/validacao/ValidacaoForm.jsx` | Modificado — remove protocolo da UI |
| `src/features/validacao/SuccessScreen.jsx` | Modificado — remove protocolo da UI |
| `package.json` | Modificado — remove @emailjs/browser |

---

## [Fase 2] submissionService — orquestrador de envio

**Objetivo:** Centralizar a lógica de envio (Supabase + n8n) fora dos componentes.

| Arquivo | Ação |
|---|---|
| `src/services/submissionService.js` | **Criado** — orquestra supabaseService + n8nService |
| `src/features/validacao/ValidacaoForm.jsx` | Modificado — importa de submissionService |

---

## [Fase 3] n8n recebe storagePaths em vez de base64

**Objetivo:** Eliminar duplo tráfego de arquivos — n8n busca diretamente no Storage.

| Arquivo | Ação |
|---|---|
| `src/services/supabaseService.js` | Modificado — retorna storagePaths |
| `src/services/n8nService.js` | Modificado — envia storagePaths, não base64 |
| `src/services/submissionService.js` | Modificado — repassa storagePaths ao n8n |

---

## [Fase 4] Separação do pdfGenerator em módulos

**Objetivo:** Dividir o gerador de PDF monolítico em arquivos focados.

| Arquivo | Ação |
|---|---|
| `src/services/pdfAluno.js` | **Criado** — PDF do requerimento do aluno |
| `src/services/pdfCoordenacao.js` | **Criado** — formulário da coordenação |
| `src/services/pdfCurriculo.js` | **Criado** — PDF do currículo |
| `src/services/pdfUtils.js` | **Criado** — utilitários compartilhados |
| `src/services/pdfGenerator.js` | Modificado → shim de re-exports (compatibilidade) |

---

## [Fase R4] Camada de serviços — remover imports diretos do Supabase da UI

**Objetivo:** Nenhum componente importa `supabase` diretamente. Toda query passa por um service.

| Arquivo | Ação |
|---|---|
| `src/services/requerimentosService.js` | **Criado** — centraliza todas as queries do dashboard/detalhe |
| `src/services/authService.js` | Modificado — adiciona signInWithPassword e onAuthChange |
| `src/features/staff/Dashboard.jsx` | Modificado — importa de requerimentosService e authService |
| `src/features/staff/RequerimentoDetalhe.jsx` | Modificado — importa de requerimentosService e authService |
| `src/features/staff/LoginPage.jsx` | Modificado — importa signInWithPassword de authService |
| `src/features/staff/AtualizarCurriculo.jsx` | Modificado — importa de authService e requerimentosService |
| `.env.example` | Modificado — adiciona VITE_N8N_WEBHOOK_HISTORICO |

---

## [Fase 5] Segundo tipo de requerimento — Equivalência de Disciplinas

**Objetivo:** Adicionar tipo "equivalência" com fluxo e regras distintas do tipo "validação".

| Arquivo | Ação |
|---|---|
| `db/migration_007_tipo_requerimento.sql` | **Criado** — coluna tipo_requerimento + CHECK + RPC atualizada |
| `src/features/validacao/TipoSelector.jsx` | **Criado** — tela inicial de seleção do tipo |
| `src/router/routes.jsx` | Modificado — `/` → TipoSelector; `/solicitar/:tipo` → ValidacaoForm |
| `src/features/validacao/constants.js` | Modificado — newValidacao(tipo) |
| `src/features/validacao/validation.js` | Modificado — validateStep0 e validateStep2 recebem tipo |
| `src/features/validacao/ValidacaoForm.jsx` | Modificado — recebe tipo da rota, repassa a todos os steps |
| `src/features/validacao/steps/StepDados.jsx` | Modificado — renderização condicional por tipo |
| `src/features/validacao/steps/StepRequerimento.jsx` | Modificado — título e PDF por tipo |
| `src/features/validacao/steps/StepDocumentos.jsx` | Modificado — documentos obrigatórios por tipo |
| `src/services/supabaseService.js` | Modificado — payload inclui tipo_requerimento |
| `src/services/submissionService.js` | Modificado — repassa tipo ao supabaseService e n8nService |
| `src/services/pdfAluno.js` | Modificado — título e nome do arquivo por tipo |

---

## [Fase 6] Melhorias de UX

**Objetivo:** Homepage mais profissional, ícones de erro SVG, limite de upload aumentado.

| Arquivo | Ação |
|---|---|
| `src/features/validacao/TipoSelector.jsx` | Modificado — redesign com SVG icons, sem emojis |
| `src/features/validacao/steps/StepDados.jsx` | Modificado — IconErr SVG + FieldErr; remove ⚠️ emoji |
| `src/components/UploadZone.jsx` | Modificado — IconErr SVG; remove ⚠️; texto "15MB" |
| `src/components/uploadConstants.js` | Modificado — MAX_FILE_SIZE 5MB → 15MB |
| `src/styles/global.css` | Modificado — .field-err e .file-err-msg com flexbox |

---

## [Fase 7] Etapa 1 — Comunicação por e-mail via n8n

**Objetivo:** Disparar e-mails automáticos em três momentos: submissão, mudança de status e conclusão.

| Arquivo | Ação |
|---|---|
| `src/services/n8nService.js` | Modificado — adiciona tipo_requerimento ao payload; nova função notificarMudancaStatus; helper postWebhook interno |
| `src/services/statusService.js` | **Criado** — orquestra atualizarStatus (DB) + notificarMudancaStatus (n8n) |
| `src/services/submissionService.js` | Modificado — repassa `tipo` ao enviarParaN8n |
| `src/features/staff/Dashboard.jsx` | Modificado — usa alterarStatus de statusService em moverCard |
| `src/features/staff/RequerimentoDetalhe.jsx` | Modificado — usa alterarStatus de statusService em alterarFase |
| `.env.example` | Modificado — adiciona VITE_N8N_WEBHOOK_STATUS |
| `docs/CHANGELOG.md` | **Criado** — este arquivo |
| `docs/n8n-workflows.md` | **Criado** — spec dos workflows n8n |
| `workflows/sig-novo-requerimento.json` | **Criado** — workflow n8n: submissão → e-mail aluno + e-mail SIG |
| `workflows/sig-mudanca-status.json` | **Criado** — workflow n8n: status change → Switch → e-mail aluno/coord/SIG |
| `workflows/README.md` | **Criado** — instruções de importação, configuração SMTP e testes curl |

---

## [Fase 8] Deploy em produção — Vercel

**Objetivo:** Publicar a aplicação em produção e consolidar a configuração de plataforma.

| Arquivo | Ação |
|---|---|
| `vercel.json` | Configuração de deploy: `npm run build`, output `dist`, rewrite SPA (`/* → /index.html`) |
| `netlify.toml` | Mantido no repositório como alternativa de plataforma, mas **o deploy ativo é na Vercel** |

### Variáveis configuradas na Vercel (Settings → Environment Variables)

```env
VITE_SUPABASE_URL=https://sygcnmuyhfacujmsaeus.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key do projeto>

VITE_N8N_BASE_URL=https://n8n.pide.ufsc.br
VITE_N8N_WEBHOOK_URL=https://n8n.pide.ufsc.br/webhook/sig-requerimento
VITE_N8N_WEBHOOK_STATUS=https://n8n.pide.ufsc.br/webhook/sig-status
VITE_N8N_WEBHOOK_AI=https://n8n.pide.ufsc.br/webhook/sig-analise-ia
VITE_N8N_WEBHOOK_HISTORICO=https://n8n.pide.ufsc.br/webhook/sig/curriculo/historico
```

### Redirect URL adicionada no Supabase Auth (produção)

Em **Authentication → URL Configuration → Redirect URLs**:
```
https://<projeto>.vercel.app/auth
```

---

## [Fase 9] Workflows completos do n8n — pasta n8n/

**Objetivo:** Adicionar o conjunto completo de workflows de automação organizados por categoria.

| Pasta / Arquivo | O que faz |
|---|---|
| `n8n/db/workflow_0_limpar_banco.json` | Limpa dados do banco (uso em reset/testes) |
| `n8n/db/workflow_1_criar_banco.json` | Cria a estrutura de banco via n8n |
| `n8n/db/workflow_2_sync_diario.json` | Sincronização diária de dados |
| `n8n/db/workflow_3_purga_semestral.json` | Purga de dados antigos ao fim do semestre |
| `n8n/notificações/workflow-A-novo-pedido.json` | E-mail ao aluno + aviso SIG a cada novo requerimento |
| `n8n/notificações/workflow-B-mudanca-status.json` | E-mail por mudança de status (switch por destino) |
| `n8n/notificações/workflow-C-relatorio-quinzenal.json` | Relatório quinzenal de requerimentos em aberto |
| `n8n/notificações/workflow-E-erro-handler.json` | Captura e notifica erros nos demais workflows |
| `n8n/workflow-D-analise-ia.json` | Análise de requerimentos com IA após submissão |
