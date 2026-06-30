# n8n Workflows — SIG Validação de Disciplinas

Especificação dos workflows n8n usados pelo sistema. Cada seção descreve
o trigger, o payload recebido e a lógica de roteamento de e-mails.

---

## Workflow 1 — Novo Requerimento

**Webhook:** `POST /webhook/sig-requerimento`  
**Env var:** `VITE_N8N_WEBHOOK_URL`  
**Trigger:** Disparado pelo `submissionService` logo após salvar o requerimento no Supabase.

### Payload recebido

```json
{
  "requerimento_id": 42,
  "tipo_requerimento": "validacao",
  "data_envio": "2026-05-31T14:00:00.000Z",

  "aluno": {
    "nome": "João da Silva",
    "matricula": "21100001",
    "cpf": "123.456.789-00",
    "curso": "Engenharia de Computação",
    "email": "joao@grad.ufsc.br",
    "telefone": "(48) 99999-9999"
  },

  "total_validacoes": 2,
  "total_documentos": 4,

  "validacoes": [
    {
      "indice": 1,
      "tipo": "externa",
      "disciplina_ufsc": { "codigo": "EES7513", "nome": "Algoritmos" },
      "justificativa": "...",
      "disciplinas_cursadas": [
        {
          "codigo": "INF001",
          "nome": "Introdução à Programação",
          "instituicao": "IFSC",
          "carga_horaria": "72",
          "creditos": "4",
          "ementa": "..."
        }
      ]
    }
  ],

  "documentos": [
    { "categoria": "req_assinado", "storage_path": "42/req_assinado/req.pdf", "nome_original": "req.pdf" },
    { "categoria": "historico",    "storage_path": "42/historico/hist.pdf",   "nome_original": "hist.pdf" }
  ]
}
```

### Lógica do workflow

```
Trigger (Webhook)
  │
  ├─► Enviar e-mail para ALUNO (confirmação de recebimento)
  │     Para: aluno.email
  │     Assunto: "Requerimento #{{requerimento_id}} recebido — UFSC Araranguá"
  │     Corpo: nome do aluno, id, tipo, disciplinas solicitadas, próximos passos
  │
  └─► Enviar e-mail para SIG (aviso de novo requerimento)
        Para: [email fixo da SIG configurado no n8n]
        Assunto: "Novo requerimento #{{requerimento_id}} — {{aluno.curso}}"
        Corpo: todos os dados do aluno, lista de disciplinas, link para /requerimento/{{id}}
```

### Acesso aos documentos no n8n

O n8n acessa os PDFs diretamente do Supabase Storage usando a `service_role key`
(configurada como credencial no n8n, nunca exposta ao front):

```
GET https://<projeto>.supabase.co/storage/v1/object/anexos/{{storage_path}}
Authorization: Bearer <SERVICE_ROLE_KEY>
```

---

## Workflow 2 — Mudança de Status

**Webhook:** `POST /webhook/sig-status`  
**Env var:** `VITE_N8N_WEBHOOK_STATUS`  
**Trigger:** Disparado pelo `statusService` após atualizar o status no banco.

### Payload recebido

```json
{
  "requerimento_id": 42,
  "tipo_requerimento": "validacao",
  "status_anterior": "triagem_sig",
  "novo_status": "parecer_coord",
  "timestamp": "2026-05-31T15:00:00.000Z",

  "aluno": {
    "nome": "João da Silva",
    "email": "joao@grad.ufsc.br",
    "matricula": "21100001",
    "curso": "Engenharia de Computação"
  }
}
```

### Mapeamento de status → e-mail

| `novo_status` | Destinatário | Assunto sugerido |
|---|---|---|
| `triagem_sig` | SIG (interno) | "Requerimento #ID em triagem" |
| `em_analise_coord` | SIG (interno) | "Requerimento #ID em análise" |
| `parecer_coord` | Coordenação (e-mail fixo no n8n) | "Novo requerimento aguardando parecer — #ID" |
| `concluido` | Aluno (`aluno.email`) | "Resultado do seu requerimento #ID — UFSC Araranguá" |

### Lógica do workflow

```
Trigger (Webhook)
  │
  └─► Switch (novo_status)
        │
        ├─ triagem_sig / em_analise_coord
        │    └─► Aviso interno SIG (e-mail da equipe)
        │
        ├─ parecer_coord
        │    └─► E-mail para Coordenação
        │          Para: [e-mail do coordenador — configurar no n8n]
        │          Assunto: "Requerimento #{{id}} aguarda seu parecer"
        │          Corpo: dados do aluno, curso, disciplinas, link para o detalhe
        │
        └─ concluido
             └─► E-mail para Aluno
                   Para: aluno.email
                   Assunto: "Resultado do requerimento #{{id}} — UFSC Araranguá"
                   Corpo: informar que o resultado está disponível + link/instrução
```

---

## Variáveis de ambiente no n8n

Configure as seguintes credenciais/variáveis no painel do n8n:

| Variável | Valor |
|---|---|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_KEY` | service_role key (para leitura de Storage e escrita no banco) |
| `EMAIL_SIG` | E-mail da equipe SIG (destinatário de avisos internos) |
| `EMAIL_COORDENACAO` | E-mail da coordenação (destinatário de parecer_coord) |

---

## Provedor de e-mail recomendado

**Resend** (`resend.com`) — integração nativa no n8n, 3.000 e-mails/mês grátis,
domínio personalizado `@ufsc.br` requer verificação DNS (MX/SPF/DKIM).

Alternativa: **Gmail SMTP** com conta dedicada `sig.ufsc.araranguá@gmail.com`
(limite: 500 e-mails/dia, sem verificação de domínio necessária).
