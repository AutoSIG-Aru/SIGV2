# Workflows n8n — SIG Validação de Disciplinas

Pasta com os workflows prontos para importação no n8n.

---

## Arquivos

| Arquivo | Webhook path | Trigger |
|---|---|---|
| `sig-novo-requerimento.json` | `POST /webhook/sig-requerimento` | Nova submissão de requerimento |
| `sig-mudanca-status.json` | `POST /webhook/sig-status` | Mudança de status no painel SIG |

---

## Como importar

1. Abra o n8n no navegador
2. Menu superior → **Workflows** → **Import from file**
3. Selecione o arquivo `.json` desejado
4. O workflow será importado como **inativo** — configure as credenciais antes de ativar

---

## Configuração após a importação

### 1. Credencial SMTP

Crie uma credencial SMTP em **Settings → Credentials → Add Credential → SMTP**:

| Campo | Valor (Gmail) | Valor (Resend) |
|---|---|---|
| Host | `smtp.gmail.com` | `smtp.resend.com` |
| Port | `587` | `587` |
| User | conta Gmail dedicada | `resend` (literal) |
| Password | Senha de app Google | API Key do Resend |
| SSL | TLS | TLS |

Após criar, **edite cada nó de e-mail** nos workflows e selecione a credencial criada no campo "Credential to connect with". Substitua o valor `SUBSTITUIR_PELO_ID_DA_CREDENCIAL_SMTP` pelo ID real.

> **Recomendação:** Use o **Resend** (`resend.com`) — entrega mais confiável, 3.000 e-mails/mês grátis, sem risco de bloqueio por SMTP.

---

### 2. Variáveis de ambiente do n8n

Em **Settings → Variables**, crie as seguintes variáveis:

| Nome | Valor |
|---|---|
| `EMAIL_SIG` | E-mail da equipe SIG (ex: `sig.araranguá@contato.ufsc.br`) |
| `EMAIL_COORDENACAO` | E-mail da coordenação (ex: `coord.computacao@contato.ufsc.br`) |

Os workflows referenciam essas variáveis com `$vars.EMAIL_SIG` e `$vars.EMAIL_COORDENACAO`.

---

### 3. Variáveis de ambiente do front-end

No arquivo `.env` do projeto, confirme que as URLs batem com os paths configurados no n8n:

```env
VITE_N8N_WEBHOOK_URL=http://localhost:5678/webhook/sig-requerimento
VITE_N8N_WEBHOOK_STATUS=http://localhost:5678/webhook/sig-status
```

> Em produção, troque `localhost:5678` pelo domínio real do n8n.

---

## Lógica dos workflows

### sig-novo-requerimento

```
Webhook (POST /sig-requerimento)
  └─► Preparar Dados          (Set node — formata datas e listas de disciplinas)
        ├─► Email Confirmação  → Aluno (e-mail de confirmação de recebimento)
        └─► Email Aviso SIG   → Equipe SIG (aviso interno com todos os dados)
              └─► Responder Webhook (HTTP 200)
```

### sig-mudanca-status

```
Webhook (POST /sig-status)
  └─► Preparar Dados          (Set node — formata status e dados do aluno)
        └─► Switch (novo_status)
              ├─ concluido        → Email Resultado  → Aluno
              ├─ parecer_coord    → Email Parecer    → Coordenação
              ├─ triagem_sig      → Email Interno    → SIG
              └─ em_analise_coord → Email Interno    → SIG
                                         └─► Responder Webhook (HTTP 200)
```

---

## Testando localmente

Para testar sem ativar o workflow (modo "Test"):

1. Abra o workflow no n8n
2. Clique no nó **Webhook** → **Listen for test event**
3. Dispare a requisição manualmente via curl ou Postman:

```bash
# Teste do workflow de submissão
curl -X POST http://localhost:5678/webhook-test/sig-requerimento \
  -H "Content-Type: application/json" \
  -d '{
    "requerimento_id": 999,
    "tipo_requerimento": "validacao",
    "data_envio": "2026-05-31T14:00:00.000Z",
    "aluno": {
      "nome": "Teste Silva",
      "matricula": "21100001",
      "email": "teste@grad.ufsc.br",
      "curso": "Engenharia de Computação"
    },
    "total_validacoes": 1,
    "total_documentos": 2,
    "validacoes": [{
      "indice": 1,
      "tipo": "externa",
      "disciplina_ufsc": { "codigo": "EES7513", "nome": "Algoritmos" },
      "justificativa": "Disciplina equivalente cursada no IFSC",
      "disciplinas_cursadas": [{
        "codigo": "INF001", "nome": "Intro à Programação",
        "instituicao": "IFSC", "carga_horaria": "72", "creditos": "4"
      }]
    }],
    "documentos": []
  }'

# Teste do workflow de status
curl -X POST http://localhost:5678/webhook-test/sig-status \
  -H "Content-Type: application/json" \
  -d '{
    "requerimento_id": 999,
    "tipo_requerimento": "validacao",
    "status_anterior": "triagem_sig",
    "novo_status": "concluido",
    "timestamp": "2026-05-31T15:00:00.000Z",
    "aluno": {
      "nome": "Teste Silva",
      "email": "teste@grad.ufsc.br",
      "matricula": "21100001",
      "curso": "Engenharia de Computação"
    }
  }'
```

> Note: em modo teste, use `/webhook-test/` no path. Em produção (workflow ativo), use `/webhook/`.

---

## Atualizar o CHANGELOG

Ao adicionar novos workflows, registre em `docs/CHANGELOG.md` na fase correspondente.
