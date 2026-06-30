import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { carregarLogoBase64 } from './pdfUtils'

/**
 * Gera o formulário oficial de Validação de Disciplinas para a Coordenação.
 * Reproduz o layout "Formulário-de-Validação-de-Disciplinas-COORDENADORIA-versão-05"
 * com tabela de decisões (DEF/INDEF/Notas) e página de observações.
 *
 * @param {Object} req             Dados do requerimento (nome_aluno, matricula, …)
 * @param {Array}  validacoes      Array de validações com decisao e decisao_observacao
 * @param {string} observacoesTexto Texto livre para a página de observações
 */
export async function gerarFormularioCoordPDF(req, validacoes, observacoesTexto = '') {
  const logoBase64 = await carregarLogoBase64()
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  const PW = 210, PH = 297, M = 14
  const CW = PW - 2 * M

  // ── Colunas da tabela ─────────────────────────────────────────────────────────
  const W_COD   = 29
  const W_CH    = 13
  const W_INDEF = 11
  const W_DEF   = 11
  const W_MEN   = 13
  const W_NOTAS = CW - W_COD - W_CH - W_INDEF - W_DEF - W_MEN
  const W_NOTA  = W_NOTAS / 9
  const NOTAS   = [6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0]

  const X_COD   = M
  const X_CH    = X_COD   + W_COD
  const X_INDEF = X_CH    + W_CH
  const X_DEF   = X_INDEF + W_INDEF
  const X_MEN   = X_DEF   + W_DEF
  const X_NOTAS = X_MEN   + W_MEN

  function cx(colX, colW) { return colX + colW / 2 }
  function textC(t, colX, colW, rowY, rowH) {
    doc.text(String(t), cx(colX, colW), rowY + rowH / 2 + 1.3, { align: 'center' })
  }

  let y = M

  // ── Brasão ───────────────────────────────────────────────────────────────────
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', cx(M, CW) - 7, y, 14, 14)
    y += 16
  } else {
    y += 3
  }

  // ── Cabeçalho institucional ───────────────────────────────────────────────────
  doc.setTextColor(0, 0, 0)
  const cabecalho = [
    { t: 'SERVIÇO PÚBLICO FEDERAL',                          bold: false, s: 7   },
    { t: 'MINISTÉRIO DA EDUCAÇÃO',                           bold: false, s: 7   },
    { t: 'UNIVERSIDADE FEDERAL DE SANTA CATARINA',           bold: true,  s: 8.5 },
    { t: 'PRÓ-REITORIA DE GRADUAÇÃO E EDUCAÇÃO BÁSICA',      bold: true,  s: 7.5 },
    { t: 'DEPARTAMENTO DE ADMINISTRAÇÃO ESCOLAR',            bold: true,  s: 7.5 },
  ]
  for (const { t, bold, s } of cabecalho) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(s)
    doc.text(t, PW / 2, y, { align: 'center' })
    y += s * 0.43
  }
  y += 4

  // ── Título ────────────────────────────────────────────────────────────────────
  const TH = 11
  doc.setDrawColor(0); doc.setLineWidth(0.5)
  doc.rect(M, y, CW, TH)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16)
  doc.text('VALIDAÇÃO DE DISCIPLINAS', PW / 2, y + TH / 2 + 2.8, { align: 'center' })
  y += TH

  // ── Nome / Matrícula ──────────────────────────────────────────────────────────
  const NH = 7
  const W_NOME_BOX = Math.round(CW * 0.63)
  const W_MAT_BOX  = CW - W_NOME_BOX

  doc.setLineWidth(0.3)
  doc.rect(M, y, W_NOME_BOX, NH)
  doc.rect(M + W_NOME_BOX, y, W_MAT_BOX, NH)

  doc.setFontSize(8); doc.setFont('helvetica', 'bold')
  doc.text('NOME:', M + 1.5, y + NH / 2 + 1.3)
  doc.setFont('helvetica', 'normal')
  const nomeStr = doc.splitTextToSize(req.nome_aluno || '', W_NOME_BOX - 15)[0] || ''
  doc.text(nomeStr, M + 14, y + NH / 2 + 1.3)

  doc.setFont('helvetica', 'bold')
  doc.text('MATRÍCULA:', M + W_NOME_BOX + 1.5, y + NH / 2 + 1.3)
  doc.setFont('helvetica', 'normal')
  doc.text(req.matricula || '', M + W_NOME_BOX + 21, y + NH / 2 + 1.3)
  y += NH

  // ── Cabeçalho da tabela ───────────────────────────────────────────────────────
  const H1 = 9, H2 = 5, HR = 6

  doc.setLineWidth(0.3)
  doc.rect(M, y, CW, H1)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5)
  doc.text('CÓDIGO DAS\nDISCIPLINAS', cx(X_COD, W_COD), y + 2.5, { align: 'center' })
  doc.text('CARGA\nHORÁRIA',          cx(X_CH,  W_CH),  y + 2.5, { align: 'center' })
  doc.text('INDEF.',  cx(X_INDEF, W_INDEF), y + H1/2 + 1.3, { align: 'center' })
  doc.text('DEF.',    cx(X_DEF,   W_DEF),   y + H1/2 + 1.3, { align: 'center' })
  doc.text('MENÇÃO',  cx(X_MEN,   W_MEN),   y + H1/2 + 1.3, { align: 'center' })
  doc.text('NOTAS ATRIBUÍDAS', cx(X_NOTAS, W_NOTAS), y + H1/2 + 1.3, { align: 'center' })

  const yH = y
  y += H1

  doc.rect(M, y, CW, H2)
  doc.setFontSize(6.5)
  for (let i = 0; i < NOTAS.length; i++) {
    const xN = X_NOTAS + i * W_NOTA
    if (i > 0) doc.line(xN, y, xN, y + H2)
    doc.text(NOTAS[i].toFixed(1), xN + W_NOTA / 2, y + H2 / 2 + 1.3, { align: 'center' })
  }
  for (const x of [X_CH, X_INDEF, X_DEF, X_MEN, X_NOTAS]) {
    doc.line(x, yH, x, y + H2)
  }
  y += H2

  // ── Linhas de dados ───────────────────────────────────────────────────────────
  const dataRows = validacoes.map(v => {
    let ex = {}
    try { ex = JSON.parse(v.decisao_observacao || '{}') } catch {}
    return {
      codigo:  v.ufsc_codigo || '',
      ch:      ex.carga_horaria || '',
      isIndef: v.decisao === 'rejeitado',
      isDef:   v.decisao === 'aprovado',
      mencao:  ex.mencao || '',
      nota:    ex.nota ?? null,
    }
  })
  while (dataRows.length < 28) {
    dataRows.push({ codigo: '', ch: '', isIndef: false, isDef: false, mencao: '', nota: null })
  }

  doc.setLineWidth(0.2)
  for (const row of dataRows) {
    if (y + HR > PH - 44) break

    doc.rect(M, y, CW, HR)
    doc.line(X_CH,    y, X_CH,    y + HR)
    doc.line(X_INDEF, y, X_INDEF, y + HR)
    doc.line(X_DEF,   y, X_DEF,   y + HR)
    doc.line(X_MEN,   y, X_MEN,   y + HR)
    doc.line(X_NOTAS, y, X_NOTAS, y + HR)
    for (let i = 1; i < NOTAS.length; i++) {
      doc.line(X_NOTAS + i * W_NOTA, y, X_NOTAS + i * W_NOTA, y + HR)
    }

    doc.setFontSize(7); doc.setFont('helvetica', 'normal')
    if (row.codigo) doc.text(row.codigo, X_COD + 1.5, y + HR / 2 + 1.3)
    if (row.ch)     textC(row.ch, X_CH, W_CH, y, HR)
    if (row.isIndef || row.isDef) {
      doc.setFont('helvetica', 'bold')
      if (row.isIndef) textC('X', X_INDEF, W_INDEF, y, HR)
      if (row.isDef)   textC('X', X_DEF,   W_DEF,   y, HR)
      doc.setFont('helvetica', 'normal')
    }
    if (row.mencao) {
      // Trunca o texto para caber dentro da célula sem vazar para colunas vizinhas
      const mencaoTrunc = doc.splitTextToSize(String(row.mencao), W_MEN - 1.5)[0] || ''
      textC(mencaoTrunc, X_MEN, W_MEN, y, HR)
    }
    if (row.nota !== null) {
      const idx = NOTAS.indexOf(Number(row.nota))
      if (idx >= 0) {
        doc.setFont('helvetica', 'bold')
        textC('X', X_NOTAS + idx * W_NOTA, W_NOTA, y, HR)
        doc.setFont('helvetica', 'normal')
      }
    }
    y += HR
  }

  // ── Assinatura ────────────────────────────────────────────────────────────────
  y += 14
  const DLW = 28, SLX = M + 58, SLW = 65

  doc.setLineWidth(0.4)
  doc.line(M, y, M + DLW, y)
  doc.line(SLX, y, SLX + SLW, y)

  const hoje     = new Date()
  const dataHoje = `${String(hoje.getDate()).padStart(2,'0')}/${String(hoje.getMonth()+1).padStart(2,'0')}/${hoje.getFullYear()}`

  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)
  doc.text(dataHoje, M + DLW / 2, y - 1.5, { align: 'center' })
  doc.text('DATA',                    M + DLW / 2,   y + 3.5, { align: 'center' })
  doc.text('COORDENADOR / PROFESSOR', SLX + SLW / 2, y + 3.5, { align: 'center' })

  y += 10
  doc.setFontSize(8); doc.setFont('helvetica', 'bold')
  doc.text('*  VALIDAÇÃO NOS TERMOS DA RESOLUÇÃO Nº 017/CUn/97.', M, y)

  // ── Página 2: observações ─────────────────────────────────────────────────────
  doc.addPage()
  y = M
  const OBS_H = PH - 2 * M - 52

  doc.setLineWidth(0.4)
  doc.rect(M, y, CW, OBS_H)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5)
  const obsTitle =
    'ESPAÇO RESERVADO PARA VALIDAÇÃO PARCIAL DE DISCIPLINAS, BEM COMO, ' +
    'JUSTIFICATIVA DAS VALIDAÇÕES INDEFERIDAS.'
  doc.text(obsTitle, M + 2, y + 5)
  doc.setLineWidth(0.25)
  doc.line(M + 2, y + 5.8, M + CW - 2, y + 5.8)

  const textoObs = (observacoesTexto || '').trim()
  if (textoObs) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    const linhas = doc.splitTextToSize(textoObs, CW - 6)
    doc.text(linhas, M + 3, y + 14)
  }

  const sigY = M + OBS_H + 20
  doc.setLineWidth(0.4)
  doc.line(M, sigY, M + DLW, sigY)
  doc.line(SLX, sigY, SLX + SLW, sigY)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)
  doc.text('DATA',                    M + DLW / 2,   sigY + 3.5, { align: 'center' })
  doc.text('COORDENADOR / PROFESSOR', SLX + SLW / 2, sigY + 3.5, { align: 'center' })

  const fname = `formulario-validacao-coord-${(req.matricula || 'ufsc').replace(/\D/g, '')}.pdf`
  doc.save(fname)
}
