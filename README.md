# 📋 Requerimento para Validação de Disciplinas — UFSC Araranguá

Formulário web estruturado para solicitação de validação de disciplinas, desenvolvido em **React + Vite**.

---

## 🚀 Como rodar localmente

### Pré-requisitos
- Node.js 18+ instalado ([nodejs.org](https://nodejs.org))
- npm (já vem com o Node)

### Passos

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas credenciais do EmailJS

# 3. Rodar em modo desenvolvimento
npm run dev
```

Acesse em: **http://localhost:5173**

---

## 📧 Configurar o EmailJS (envio de e-mails gratuito)

O formulário usa o [EmailJS](https://www.emailjs.com/) para enviar as solicitações sem precisar de backend.

### Passo a passo:

1. **Crie uma conta gratuita** em https://www.emailjs.com/
   - Plano gratuito: **200 e-mails/mês**

2. **Adicione um serviço de e-mail** (Email Services → Add New Service)
   - Gmail, Outlook, ou SMTP próprio
   - Copie o **Service ID**

3. **Crie um template de e-mail** (Email Templates → Create New Template)
   - Use as variáveis abaixo no template:

   ```
   Protocolo: {{protocolo}}
   Requerente: {{aluno_nome}}
   Matrícula: {{aluno_matricula}}
   CPF: {{aluno_cpf}}
   Curso: {{aluno_curso}}
   E-mail: {{aluno_email}}
   Telefone: {{aluno_telefone}}
   Disciplinas: {{disciplinas}}
   Data: {{data_envio}}
   ```

   - Copie o **Template ID**

4. **Copie sua Public Key** em Account → API Keys

5. **Preencha o arquivo `.env`**:
   ```env
   VITE_EMAILJS_SERVICE_ID=service_xxxxxxx
   VITE_EMAILJS_TEMPLATE_ID=template_xxxxxxx
   VITE_EMAILJS_PUBLIC_KEY=xxxxxxxxxxxxxxx
   ```

---



---

