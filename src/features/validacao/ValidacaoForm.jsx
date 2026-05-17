import { useState } from 'react'

import PublicLayout from '../../layouts/PublicLayout'

import StepBar from './StepBar'
import StepDados from './steps/StepDados'
import StepRequerimento from './steps/StepRequerimento'
import StepDocumentos from './steps/StepDocumentos'
import StepRevisao from './steps/StepRevisao'
import SuccessScreen from './SuccessScreen'

import { initialAluno, newCursada, newValidacao } from './constants'
import { validateStep0, validateStep2 } from './validation'

// pdfGenerator e emailService estão em services/
// Etapa 4 desta refatoração.
import { enviarRequerimento, gerarProtocolo } from '../../services/emailService'

/**
 * ValidacaoForm — wizard de 4 etapas para o aluno solicitar validação de
 * disciplinas. É a página renderizada na rota "/" (formulário público).
 *
 * Estrutura:
 *   Step 0 → dados do aluno + disciplinas a validar
 *   Step 1 → preview do requerimento + download/assinatura
 *   Step 2 → upload de documentos comprobatórios
 *   Step 3 → revisão e envio
 *
 * Recebe `navigate` pelo roteador (usado pelo PublicLayout/header).
 */
export default function ValidacaoForm({ navigate }) {
  // Wizard
  const [step, setStep]       = useState(0)
  const [enviado, setEnviado] = useState(false)
  const [protocolo, setProtocolo] = useState('')

  // Dados do formulário
  const [aluno, setAluno]         = useState(initialAluno)
  const [validacoes, setValidacoes] = useState([newValidacao()])

  // Documentos (por categoria)
  const [docReqAssinado, setDocReqAssinado]           = useState([])
  const [docHistorico, setDocHistorico]               = useState([])
  const [docPrograma, setDocPrograma]                 = useState([])
  const [docControleCurricular, setDocControleCurricular] = useState([])
  const [docCertif, setDocCertif]                     = useState([])

  // Erros de validação
  const [erros, setErros]               = useState({})
  const [validacaoErros, setValidacaoErros] = useState([])
  const [docErros, setDocErros]         = useState({})

  // Estado de envio
  const [declarou, setDeclarou]         = useState(false)
  const [enviando, setEnviando]         = useState(false)
  const [envErro, setEnvErro]           = useState(false)
  const [envErroDetalhe, setEnvErroDetalhe] = useState('')
  const [envAviso, setEnvAviso]         = useState('')

  // ── Navegação interna do wizard ──
  function goToStep(n) {
    setStep(n)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleStep0Next() {
    const { erros: e, validacaoErros: ve } = validateStep0(aluno, validacoes)
    const hasAlunoError     = Object.keys(e).length > 0
    const hasValidacaoError = ve.some(v => {
      if (v.ufscCodigo || v.ufscNome) return true
      return (v.cursadas || []).some(c => Object.keys(c).length > 0)
    })
    if (hasAlunoError || hasValidacaoError) {
      setErros(e)
      setValidacaoErros(ve)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setErros({})
    setValidacaoErros([])
    goToStep(1)
  }

  function handleStep2Next() {
    const e = validateStep2(docReqAssinado, docHistorico, docPrograma, docControleCurricular)
    if (Object.keys(e).length > 0) {
      setDocErros(e)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setDocErros({})
    goToStep(3)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!declarou) return

    setEnviando(true)
    setEnvErro(false)
    setEnvErroDetalhe('')
    setEnvAviso('')

    try {
      const prot = gerarProtocolo()
      // Cada doc recebe sua categoria — o n8n usa isso para gravar na tabela `anexos`
      const allDocumentos = [
        ...docReqAssinado.map(f      => ({ file: f, categoria: 'req_assinado' })),
        ...docHistorico.map(f        => ({ file: f, categoria: 'historico' })),
        ...docPrograma.map(f         => ({ file: f, categoria: 'programa' })),
        ...docControleCurricular.map(f => ({ file: f, categoria: 'controle' })),
        ...docCertif.map(f           => ({ file: f, categoria: 'certif' })),
      ]

      const result = await enviarRequerimento({
        aluno,
        validacoes,
        protocolo: prot,
        documentos: allDocumentos,
      })

      if (result.success) {
        setProtocolo(prot)
        if (result.aviso) setEnvAviso(result.aviso)
        setEnviado(true)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        setEnvErro(true)
        setEnvErroDetalhe(result.mensagemErro || 'Falha desconhecida.')
      }
    } catch (err) {
      // Qualquer exceção não tratada (rede, ReferenceError, etc.) cai aqui
      // e é exibida na UI — evita que o botão fique travado em "Enviando…".
      console.error('[ValidacaoForm] Erro inesperado no envio:', err)
      setEnvErro(true)
      setEnvErroDetalhe(err?.message || String(err) || 'Erro inesperado durante o envio.')
    } finally {
      // Roda mesmo em caso de exceção — garante que o spinner sempre para.
      setEnviando(false)
    }
  }

  function handleNovo() {
    setAluno(initialAluno)
    setValidacoes([newValidacao()])
    setDocReqAssinado([])
    setDocHistorico([])
    setDocPrograma([])
    setDocControleCurricular([])
    setDocCertif([])
    setErros({})
    setValidacaoErros([])
    setDocErros({})
    setDeclarou(false)
    setEnvErro(false)
    setEnvErroDetalhe('')
    setEnvAviso('')
    setEnviado(false)
    setProtocolo('')
    goToStep(0)
  }

  return (
    <PublicLayout navigate={navigate}>
      <div className="page-container">
        {enviado ? (
          <SuccessScreen protocolo={protocolo} aluno={aluno} onNovo={handleNovo} />
        ) : (
          <>
            <StepBar step={step} />

            {step === 0 && (
              <StepDados
                aluno={aluno}
                setAluno={setAluno}
                validacoes={validacoes}
                setValidacoes={setValidacoes}
                erros={erros}
                validacaoErros={validacaoErros}
                onNext={handleStep0Next}
                newCursada={newCursada}
                newValidacao={newValidacao}
              />
            )}

            {step === 1 && (
              <StepRequerimento
                aluno={aluno}
                validacoes={validacoes}
                onNext={() => goToStep(2)}
                onBack={() => goToStep(0)}
              />
            )}

            {step === 2 && (
              <StepDocumentos
                docReqAssinado={docReqAssinado} setDocReqAssinado={setDocReqAssinado}
                docHistorico={docHistorico}     setDocHistorico={setDocHistorico}
                docPrograma={docPrograma}       setDocPrograma={setDocPrograma}
                docControleCurricular={docControleCurricular}
                setDocControleCurricular={setDocControleCurricular}
                docCertif={docCertif}           setDocCertif={setDocCertif}
                docErros={docErros}
                onNext={handleStep2Next}
                onBack={() => goToStep(1)}
              />
            )}

            {step === 3 && (
              <StepRevisao
                aluno={aluno}
                validacoes={validacoes}
                docReqAssinado={docReqAssinado}
                docHistorico={docHistorico}
                docPrograma={docPrograma}
                docControleCurricular={docControleCurricular}
                docCertif={docCertif}
                declarou={declarou}
                setDeclarou={setDeclarou}
                onSubmit={handleSubmit}
                onBack={() => goToStep(2)}
                enviando={enviando}
                envErro={envErro}
                envErroDetalhe={envErroDetalhe}
              />
            )}
          </>
        )}
      </div>
    </PublicLayout>
  )
}