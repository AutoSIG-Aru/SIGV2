import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * Carrega o brasão UFSC como base64 para uso no jsPDF.
 * Usa a versão local em public/logo-ufsc.png
 */
async function carregarLogoBase64() {
  try {
    const resp = await fetch('/logo-ufsc.png')
    if (!resp.ok) return null
    const blob = await resp.blob()
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    return base64
  } catch {
    return null
  }
}

/**
 * Gera o PDF do Requerimento para Validação de Disciplinas
 * Layout inspirado no documento oficial da UFSC Araranguá, modernizado.
 *
 * @param {Object} aluno      Dados do aluno
 * @param {Array}  validacoes Array de validações solicitadas
 */
export async function gerarRequerimentoPDF(aluno, validacoes) {
  const logoBase64 = await carregarLogoBase64()
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait',
  })

  const PAGE_W = doc.internal.pageSize.getWidth()
  const PAGE_H = doc.internal.pageSize.getHeight()
  const MARGIN = 15
  const CONTENT_W = PAGE_W - MARGIN * 2

  // Cores institucionais
  const COR_UFSC = [0, 41, 107]            // #00296b
  const COR_UFSC_CLARO = [0, 63, 138]       // #003f8a
  const COR_DOURADO = [201, 168, 76]        // #c9a84c
  const COR_CINZA = [85, 85, 85]
  const COR_FUNDO = [246, 249, 255]         // #f6f9ff
  const COR_BORDA = [220, 232, 248]         // #dce8f8

  // ── Cabeçalho ─────────────────────────────────────────────
  let y = MARGIN

  // Brasão UFSC
  if (logoBase64) {
    const logoW = 22
    const logoH = 22
    doc.addImage(logoBase64, 'PNG', (PAGE_W - logoW) / 2, y, logoW, logoH)
    y += logoH + 3
  } else {
    // Fallback: círculo estilizado
    doc.setFillColor(...COR_UFSC)
    doc.circle(PAGE_W / 2, y + 7, 5, 'F')
    doc.setFontSize(7)
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.text('UFSC', PAGE_W / 2, y + 8, { align: 'center' })
    y += 16
  }

  doc.setFontSize(8)
  doc.setTextColor(...COR_CINZA)
  doc.setFont('helvetica', 'normal')
  doc.text('SERVIÇO PÚBLICO FEDERAL', PAGE_W / 2, y, { align: 'center' })

  y += 5
  doc.setFontSize(13)
  doc.setTextColor(...COR_UFSC)
  doc.setFont('helvetica', 'bold')
  doc.text('UNIVERSIDADE FEDERAL DE SANTA CATARINA', PAGE_W / 2, y, { align: 'center' })

  y += 5
  doc.setFontSize(10)
  doc.text('CAMPUS ARARANGUÁ', PAGE_W / 2, y, { align: 'center' })

  y += 4.5
  doc.text('COORDENAÇÃO ACADÊMICA INTEGRADA', PAGE_W / 2, y, { align: 'center' })

  y += 7

  // Faixa dourada
  doc.setFillColor(...COR_DOURADO)
  doc.rect(MARGIN, y, CONTENT_W, 1.2, 'F')

  y += 7

  // Título do documento
  doc.setFillColor(...COR_UFSC)
  doc.rect(MARGIN, y, CONTENT_W, 8, 'F')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text('REQUERIMENTO PARA VALIDAÇÃO DE DISCIPLINAS', PAGE_W / 2, y + 5.5, { align: 'center' })

  y += 12

  // ── Instruções e Documentos ─────────────────────────────

  // Dados estruturados
  const instrucoesList = [
    'Valide atentamente o documento e assine digitalmente em: https://assina.ufsc.br',
    'Anexe este e os demais documentos comprobatórios na próxima etapa do formulário de solicitação',
  ]

  const documentosList = [
    'Requerimento Assinado',
    'Históricos escolares',
    'Programa/Plano de ensino das disciplinas',
    'Controle Curricular UFSC',
    'Certificados de seminários e Outros Documentos (se aplicável)',
  ]

  // Calcular altura total da caixa
  const itemHeight = 4
  const alturaInstrucoes = instrucoesList.length * itemHeight + 8
  const alturaDocumentos = documentosList.length * itemHeight + 8
  const alturaTotal = alturaInstrucoes + alturaDocumentos + 2

  // Desenhar caixa única amarela
  doc.setFillColor(255, 251, 230)
  doc.setDrawColor(232, 208, 112)
  doc.setLineWidth(0.3)
  doc.roundedRect(MARGIN, y, CONTENT_W, alturaTotal, 2, 2, 'FD')

  // ─ Seção de Instruções

  doc.setFontSize(8.5)
  doc.setTextColor(60, 60, 60)
  doc.setFont('helvetica', 'bold')
  doc.text('Instruções:', MARGIN + 3, y + 8)

  doc.setFont('helvetica', 'normal')
  let itemY = y + 12
  instrucoesList.forEach((item, idx) => {
    const text = `${idx + 1} - ${item}`
    const lines = doc.splitTextToSize(text, CONTENT_W - 8)
    doc.text(lines, MARGIN + 5, itemY)
    
    // Adicionar link clicável no item de assinatura
    if (idx === 1) {
      const linkWidth = 90
      const linkHeight = lines.length * itemHeight
      doc.link(MARGIN + 5, itemY - 3, linkWidth, linkHeight, { url: ASSINA_UFSC_URL })
    }
    
    itemY += lines.length * itemHeight
  })

  // ─ Seção de Documentos
  itemY += 2
  doc.setFont('helvetica', 'bold')
  doc.text('Documentos a anexar:', MARGIN + 3, itemY)

  doc.setFont('helvetica', 'normal')
  itemY += 4
  documentosList.forEach((item) => {
    const text = `• ${item}`
    const lines = doc.splitTextToSize(text, CONTENT_W - 8)
    doc.text(lines, MARGIN + 5, itemY)
    itemY += lines.length * itemHeight
  })

  y += alturaTotal + 4

  // Declaração legal
  doc.setFontSize(8)
  doc.setTextColor(60, 60, 60)
  doc.setFont('helvetica', 'italic')
  const decl =
    '* Declaro que os documentos anexados são cópias fiéis dos originais, conforme termos e responsabilizações ' +
    'cabíveis do Decreto Federal nº 8.539/2015.'
  const linhasDecl = doc.splitTextToSize(decl, CONTENT_W)
  doc.text(linhasDecl, MARGIN, y)

  y += linhasDecl.length * 3.8 + 4

  // ── Dados do requerente ──────────────────────────────────
  autoTable(doc, {
    startY: y,
    head: [['DADOS DO REQUERENTE']],
    body: [],
    theme: 'plain',
    headStyles: {
      fillColor: COR_UFSC_CLARO,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 1.6,
    },
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: CONTENT_W,
  })

  y = doc.lastAutoTable.finalY

  autoTable(doc, {
    startY: y,
    body: [
      [
        { content: 'NOME', styles: { fontStyle: 'bold', fillColor: COR_FUNDO, halign: 'left' } },
        { content: aluno.nome || '—', colSpan: 3 },
      ],
      [
        { content: 'MATRÍCULA', styles: { fontStyle: 'bold', fillColor: COR_FUNDO, halign: 'left' } },
        aluno.matricula || '—',
        { content: 'CPF', styles: { fontStyle: 'bold', fillColor: COR_FUNDO, halign: 'left' } },
        aluno.cpf || '—',
      ],
      [
        { content: 'CURSO', styles: { fontStyle: 'bold', fillColor: COR_FUNDO, halign: 'left' } },
        aluno.curso || '—',
        { content: 'TELEFONE', styles: { fontStyle: 'bold', fillColor: COR_FUNDO, halign: 'left' } },
        aluno.telefone || '—',
      ],
      [
        { content: 'E-MAIL', styles: { fontStyle: 'bold', fillColor: COR_FUNDO, halign: 'left' } },
        { content: aluno.email || '—', colSpan: 3 },
      ],
    ],
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 2,
      lineColor: COR_BORDA,
      lineWidth: 0.2,
      textColor: [30, 30, 30],
    },
    columnStyles: {
      0: { cellWidth: 26 },
      2: { cellWidth: 26 },
    },
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: CONTENT_W,
  })

  y = doc.lastAutoTable.finalY + 4

  // ── Disciplinas que deseja validar ───────────────────────
  autoTable(doc, {
    startY: y,
    head: [['DISCIPLINAS QUE DESEJA VALIDAR']],
    body: [],
    theme: 'plain',
    headStyles: {
      fillColor: COR_UFSC_CLARO,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 1.6,
    },
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: CONTENT_W,
  })
  y = doc.lastAutoTable.finalY

  // Monta as linhas: para cada validação, mostra todas as disciplinas cursadas
  const linhas = []
  validacoes.forEach((v) => {
    const ufsc = `${v.ufsc?.codigo || ''} ${v.ufsc?.nome || ''}`.trim() || '—'
    ;(v.cursadas || []).forEach((c) => {
      const cursada = [
        `${c.codigo || ''} ${c.nome || ''}`.trim() || '—',
        c.instituicao ? `Instituição: ${c.instituicao}` : null,
        (c.carga || c.creditos)
          ? `Carga: ${c.carga || '—'}h · Créditos: ${c.creditos || '—'}`
          : null,
      ].filter(Boolean).join('\n')
      linhas.push([cursada, ufsc])
    })
  })

  if (linhas.length === 0) {
    linhas.push(['—', '—'])
  }

  autoTable(doc, {
    startY: y,
    head: [['DISCIPLINA CURSADA', 'DISCIPLINA EQUIVALENTE UFSC']],
    body: linhas,
    theme: 'grid',
    headStyles: {
      fillColor: COR_FUNDO,
      textColor: COR_UFSC,
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 2,
      lineColor: COR_BORDA,
      lineWidth: 0.2,
    },
    styles: {
      fontSize: 9,
      cellPadding: 2.2,
      lineColor: COR_BORDA,
      lineWidth: 0.2,
      textColor: [30, 30, 30],
      valign: 'top',
    },
    columnStyles: {
      0: { cellWidth: CONTENT_W / 2 },
      1: { cellWidth: CONTENT_W / 2 },
    },
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: CONTENT_W,
  })

  y = doc.lastAutoTable.finalY + 6

  // Quebra de página se necessário
  if (y > PAGE_H - 55) {
    doc.addPage()
    y = MARGIN
  }


  // ── Bloco de assinatura ──────────────────────────────────
  // Espaço extra para acomodar o carimbo da assinatura digital (≈ 3 linhas)
  const SIG_GAP = 18 // espaçamento vertical antes da linha de assinatura
  y += SIG_GAP

  // Quebra de página se não couber o bloco de assinatura completo
  if (y > PAGE_H - 25) {
    doc.addPage()
    y = MARGIN + SIG_GAP
  }

  const sigW = 80
  const dataW = 40
  const sigX = MARGIN
  const dataX = PAGE_W - MARGIN - dataW

  // Linhas para assinatura e data
  doc.setDrawColor(40, 40, 40)
  doc.setLineWidth(0.4)
  doc.line(sigX, y, sigX + sigW, y)
  doc.line(dataX, y, dataX + dataW, y)

  // Data de hoje preenchida automaticamente (formato dd/mm/aaaa)
  const hoje = new Date()
  const dataHoje =
    String(hoje.getDate()).padStart(2, '0') + '/' +
    String(hoje.getMonth() + 1).padStart(2, '0') + '/' +
    hoje.getFullYear()

  doc.setFontSize(10)
  doc.setTextColor(30, 30, 30)
  doc.setFont('helvetica', 'normal')
  doc.text(dataHoje, dataX + dataW / 2, y - 1.5, { align: 'center' })

  y += 4
  doc.setFontSize(8.5)
  doc.setTextColor(70, 70, 70)
  doc.text('Assinatura do(a) aluno(a) requerente', sigX + sigW / 2, y, { align: 'center' })
  doc.text('Data', dataX + dataW / 2, y, { align: 'center' })

  // ── Rodapé em todas as páginas ───────────────────────────
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(7.5)
    doc.setTextColor(140, 140, 140)
    doc.text(
      'UFSC · Campus Araranguá · Coordenação Acadêmica Integrada · Decreto Federal nº 8.539/2015',
      PAGE_W / 2,
      PAGE_H - 8,
      { align: 'center' },
    )
    doc.text(`Página ${i} de ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 8, { align: 'right' })
  }

  const nomeArquivo = `requerimento-validacao-${(aluno.matricula || 'ufsc').replace(/\s/g, '-')}.pdf`
  doc.save(nomeArquivo)
}

export const ASSINA_UFSC_URL = 'https://assina.ufsc.br'
