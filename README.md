# AutoSIG — Validação e Equivalência de Disciplinas · UFSC Araranguá

Sistema web para solicitação e gestão de requerimentos de validação e equivalência de disciplinas, com painel interno de acompanhamento por kanban.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Vite (SPA sem hash, roteador próprio) |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage + RLS) |
| Edge Functions | Supabase Edge Functions (Deno) |
| Automação / IA | n8n (`https://n8n.pide.ufsc.br`) |
| PDF | jsPDF + jsPDF-autotable |

---

## Rodar localmente

```bash
# 1. Instalar dependências
npm install

# 2. Criar arquivo de variáveis de ambiente
cp .env.example .env
# Preencha as variáveis (veja seção abaixo)

# 3. Subir em desenvolvimento
npm run dev
```

Acesse em: **http://localhost:5173**

### Variáveis de ambiente (`.env`)

```env
VITE_SUPABASE_URL=https://sygcnmuyhfacujmsaeus.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key do projeto>

VITE_N8N_BASE_URL=https://n8n.pide.ufsc.br
VITE_N8N_WEBHOOK_URL=https://n8n.pide.ufsc.br/webhook/sig-requerimento
VITE_N8N_WEBHOOK_STATUS=https://n8n.pide.ufsc.br/webhook/sig-status
VITE_N8N_WEBHOOK_AI=https://n8n.pide.ufsc.br/webhook/sig-analise-ia
VITE_N8N_WEBHOOK_HISTORICO=https://n8n.pide.ufsc.br/webhook/sig/curriculo/historico
```

---

## Estrutura do projeto

```
src/
├── components/
│   ├── UfscHeader.jsx         # Cabeçalho institucional UFSC
│   └── UfscFooter.jsx         # Rodapé institucional UFSC
├── layouts/
│   ├── StaffLayout.jsx        # Moldura das páginas do painel interno
│   └── PublicLayout.jsx       # Moldura das páginas públicas
├── features/
│   ├── validacao/
│   │   ├── TipoSelector.jsx   # Tela inicial: escolha tipo de requerimento
│   │   └── ValidacaoForm.jsx  # Formulário do aluno (wizard multi-etapas)
│   ├── staff/
│   │   ├── LoginPage.jsx      # Login por magic link
│   │   ├── AuthVerify.jsx     # Callback após magic link do Supabase
│   │   ├── Dashboard.jsx      # Painel kanban + lista de requerimentos
│   │   ├── RequerimentoDetalhe.jsx  # Detalhes, documentos, tarefas, histórico
│   │   ├── AtualizarCurriculo.jsx   # Upload e edição do currículo do curso
│   │   └── UsuariosPage.jsx   # Listagem e convite de usuários (só SIG)
│   └── NotFound.jsx           # Página 404
├── services/
│   ├── supabase.js            # Cliente Supabase
│   ├── authService.js         # Auth: magic link, sessão, logout
│   ├── requerimentosService.js # CRUD de requerimentos e validações
│   ├── curriculoService.js    # Currículos e disciplinas
│   ├── usuariosService.js     # Listagem, convite e toggle de usuários
│   ├── statusService.js       # Alteração de status via n8n
│   ├── pdfAluno.js            # PDF do formulário do aluno
│   ├── pdfCoordenacao.js      # PDF do parecer da coordenação
│   ├── pdfCurriculo.js        # PDF do currículo do curso
│   └── pdfUtils.js            # Helpers compartilhados de PDF
├── router/
│   ├── routes.jsx             # Tabela declarativa de rotas
│   └── useRouter.js           # Hook do roteador (history API)
└── styles/
    └── global.css             # Estilos globais (variáveis UFSC, utilitários)
```

---

## Rotas

| Path | Componente | Acesso |
|---|---|---|
| `/` | TipoSelector | Público |
| `/solicitar/:tipo` | ValidacaoForm | Público |
| `/login` | LoginPage | Público |
| `/auth` | AuthVerify | Callback Supabase |
| `/dashboard` | Dashboard | Staff autenticado |
| `/requerimento/:id` | RequerimentoDetalhe | Staff autenticado |
| `/curriculo/atualizar` | AtualizarCurriculo | Só SIG |
| `/usuarios` | UsuariosPage | Só SIG |

---

## Perfis de acesso

### `sig`
- Vê todos os requerimentos de todos os cursos
- Pode mover cards em qualquer coluna do kanban
- Pode editar o currículo do curso
- Pode convidar e gerenciar usuários (`/usuarios`)

### `coordenacao`
- Vê apenas os requerimentos do seu curso
- No kanban: pode mover somente cards em `parecer_coord` → `concluido`
- Pode abrir e visualizar qualquer requerimento, mas só edita na etapa de coordenação
- Não acessa currículo nem usuários

---

## Banco de dados (Supabase)

### Tabelas principais

| Tabela | Descrição |
|---|---|
| `usuarios` | Perfis de staff vinculados ao `auth.users` |
| `requerimentos` | Solicitações de validação/equivalência |
| `validacoes` | Itens de validação de cada requerimento |
| `disciplinas_cursadas` | Disciplinas externas vinculadas a cada validação |
| `anexos` | Documentos no Storage |
| `eventos_auditoria` | Histórico de ações por requerimento |
| `curriculos` | Metadados dos currículos de curso |
| `curriculo_disciplinas` | Disciplinas de cada currículo |

### RPC

- `atualizar_status_requerimento(p_id, p_status)` — SECURITY DEFINER, contorna RLS na atualização de status

### Trigger

- `on_auth_user_sync` → `handle_auth_user_sync()` — cria/atualiza row em `public.usuarios` a cada login ou novo usuário em `auth.users`

---

## Edge Functions

### `convidar-usuario`

Convida um novo usuário via `admin.inviteUserByEmail()`. Requer JWT de usuário `sig`.

**Endpoint:** `POST https://sygcnmuyhfacujmsaeus.supabase.co/functions/v1/convidar-usuario`

**Body:**
```json
{
  "email": "pessoa@exemplo.com",
  "nome": "Nome Completo",
  "perfil": "coordenacao",
  "curso": "Engenharia de Computação"
}
```

Para re-deployar:
```bash
supabase functions deploy convidar-usuario --project-ref sygcnmuyhfacujmsaeus
```

---

## Configuração do Supabase Auth

### ⚠️ Redirect URLs (obrigatório)

**Authentication → URL Configuration → Redirect URLs** — adicione:

```
http://localhost:5173/auth        ← desenvolvimento
https://seu-dominio.ufsc.br/auth  ← produção
```

Sem isso, magic links não redirecionam corretamente após o clique.

### Fluxo de autenticação (Magic Link)

1. Staff informa e-mail autorizado em `/login`
2. App verifica whitelist e chama `solicitarMagicLink(email)` via Supabase OTP
3. Supabase envia e-mail com link → `/auth#access_token=...`
4. Usuário clica → `AuthVerify.jsx` detecta a sessão via SDK e redireciona para `/dashboard`

---

## n8n (automação)

Webhooks configurados em `https://n8n.pide.ufsc.br`:

| Webhook | Finalidade |
|---|---|
| `/webhook/sig-requerimento` | Recebe novo requerimento do aluno |
| `/webhook/sig-status` | Notifica mudança de status |
| `/webhook/sig-analise-ia` | Dispara análise de IA após submissão |
| `/webhook/sig/curriculo/historico` | Registra histórico de atualizações do currículo |

Os JSONs dos workflows ficam em `workflows/` e devem ser importados manualmente no painel do n8n.

---

## Deploy (Vercel)

O projeto está configurado para deploy na Vercel via `vercel.json` (rewrite para SPA).

```bash
# Gerar build
npm run build
# Pasta /dist contém os arquivos estáticos
```

Configure as variáveis de ambiente do `.env` no painel da Vercel (Settings → Environment Variables).

---

## Conformidade legal

Sistema em conformidade com o **Decreto Federal nº 8.539/2015** (uso do meio eletrônico para processos administrativos na administração pública federal).
