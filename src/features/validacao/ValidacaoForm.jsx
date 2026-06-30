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

import { enviarRequerimento } from '../../services/submissionService'

/**
 * ValidacaoForm — wizard de 4 etapas para o aluno solicitar validação ou
 * equivalência de disciplinas.
 *
 * Estrutura:
 *   Step 0 → dados do aluno + disciplinas
 *   Step 1 → preview do requerimento + download/assinatura
 *   Step 2 → upload de documentos comprobatórios
 *   Step 3 → revisão e envio
 *
 * Recebe `navigate` e `tipo` ('validacao' | 'equivalencia') pelo roteador.
 * Se tipo for inválido ou ausente, redireciona para a seleção.
 */
export default function ValidacaoForm({ navigate, tipo }) {
  // Garante que tipo é válido
  const tipoValido = tipo === 'validacao' || tipo === 'equivalencia' ? tipo : null

  // Wizard
  const [step, setStep]       = useState(0)
  const [enviado, setEnviado] = useState(false)

  // Dados do formulário
  const [aluno, setAluno]           = useState(initialAluno)
  const [validacoes, setValidacoes] = useState([newValidacao(tipoValido)])

  // Documentos (por categoria)
  const [docReqAssinado, setDocReqAssinado]             = useState([])
  const [docHistorico, setDocHistorico]                 = useState([])
  const [docPrograma, setDocPrograma]                   = useState([])
  const [docControleCurricular, setDocControleCurricular] = useState([])
  const [docCertif, setDocCertif]                       = useState([])

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
    const { erros: e, validacaoErros: ve } = validateStep0(aluno, validacoes, tipoValido)
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
    const e = validateStep2(docReqAssinado, docHistorico, docPrograma, docControleCurricular, tipoValido)
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
      const allDocumentos = [
        ...docReqAssinado.map(f       => ({ file: f, categoria: 'req_assinado' })),
        ...docHistorico.map(f         => ({ file: f, categoria: 'historico' })),
        ...docPrograma.map(f          => ({ file: f, categoria: 'programa' })),
        ...docControleCurricular.map(f => ({ file: f, categoria: 'controle' })),
        ...docCertif.map(f            => ({ file: f, categoria: 'certif' })),
      ]

      const result = await enviarRequerimento({
        aluno,
        validacoes,
        documentos: allDocumentos,
        tipo: tipoValido,
      })

      if (result.success) {
        if (result.aviso) setEnvAviso(result.aviso)
        setEnviado(true)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        setEnvErro(true)
        setEnvErroDetalhe(result.mensagemErro || 'Falha desconhecida.')
      }
    } catch (err) {
      console.error('[ValidacaoForm] Erro inesperado no envio:', err)
      setEnvErro(true)
      setEnvErroDetalhe(err?.message || String(err) || 'Erro inesperado durante o envio.')
    } finally {
      setEnviando(false)
    }
  }

  function handleNovo() {
    setAluno(initialAluno)
    setValidacoes([newValidacao(tipoValido)])
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
    goToStep(0)
  }

  // Tipo inválido → redireciona para a seleção
  if (!tipoValido) {
    navigate('/')
    return null
  }

  return (
    <PublicLayout navigate={navigate}>
      <div className="page-container">
        {enviado ? (
          <SuccessScreen aluno={aluno} onNovo={handleNovo} aviso={envAviso} />
        ) : (
          <>
            <StepBar step={step} tipo={tipoValido} />

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
                tipo={tipoValido}
              />
            )}

            {step === 1 && (
              <StepRequerimento
                aluno={aluno}
                validacoes={validacoes}
                tipo={tipoValido}
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
                tipo={tipoValido}
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
