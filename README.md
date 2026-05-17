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

## ☁️ Deploy gratuito na Vercel

### Opção A — Via interface web (mais fácil)

1. Suba o código para o GitHub
2. Acesse [vercel.com](https://vercel.com) e conecte sua conta GitHub
3. Importe o repositório
4. Configure as **Environment Variables** na Vercel (mesmas do `.env`)
5. Clique em **Deploy** ✅

### Opção B — Via CLI

```bash
npm install -g vercel
vercel login
vercel --prod
```

### Deploy na Netlify (alternativa)

1. Acesse [netlify.com](https://netlify.com) → "Add new site" → "Import from Git"
2. Configure as variáveis de ambiente em Site Settings → Environment Variables
3. Build command: `npm run build`
4. Publish directory: `dist`

---

## 🏛️ Migrar para servidor próprio da UFSC (futuro)

Quando a UFSC disponibilizar servidor, o processo é simples:

```bash
# Gerar build de produção
npm run build

# A pasta /dist contém os arquivos estáticos — copie para o servidor
# Configure o servidor para servir o index.html em todas as rotas
```

Para servidores Apache, crie um `.htaccess` na raiz:
```apache
Options -MultiViews
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ index.html [QL]
```

Para Nginx:
```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

---

## 📁 Estrutura do projeto

```
src/
├── components/
│   ├── UfscHeader.jsx       # Cabeçalho oficial UFSC
│   ├── StepBar.jsx          # Barra de progresso do wizard
│   ├── StepDados.jsx        # Etapa 1: Dados do aluno + disciplinas
│   ├── StepRequerimento.jsx # Etapa 2: Preview do documento
│   ├── StepDocumentos.jsx   # Etapa 3: Upload de arquivos
│   ├── StepRevisao.jsx      # Etapa 4: Revisão e envio
│   ├── SuccessScreen.jsx    # Tela de sucesso
│   └── UploadZone.jsx       # Componente de upload com drag-and-drop
├── utils/
│   ├── constants.js         # Cursos, valores iniciais, constantes
│   ├── validation.js        # Funções de validação e formatação
│   └── emailService.js      # Integração com EmailJS
├── styles/
│   └── global.css           # Todos os estilos UFSC
├── App.jsx                  # Orquestrador principal do wizard
└── main.jsx                 # Ponto de entrada React
```

---

## 🔧 Personalização rápida

**Adicionar/remover cursos:** edite `src/utils/constants.js` → array `CURSOS`

**Alterar e-mail de destino:** configure no template do EmailJS

**Alterar cores:** edite `src/styles/global.css` → variáveis de cor (azul UFSC: `#003f8a`, `#00296b`)

---

## 📜 Conformidade Legal

Este sistema está em conformidade com o **Decreto Federal nº 8.539/2015**, que dispõe sobre o uso do meio eletrônico para a realização do processo administrativo no âmbito dos órgãos e das entidades da administração pública federal direta, autárquica e fundacional.
