import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { carregarLogoBase64 } from './pdfUtils'

/**
 * Gera o PDF do Currículo de Curso no formato SeTIC/UFSC.
 * Orientação landscape, cabeçalho hierárquico, objetivo no topo,
 * tabela por fase com ementa de cada disciplina.
 *
 * @param {Object} curso       Metadados do curso (public.curriculos)
 * @param {Array}  disciplinas Array de disciplinas (public.curriculo_disciplinas)
 */
export async function gerarCurriculoPDF(curso, disciplinas = []) {
  const logoBase64 = await carregarLogoBase64()

  const doc    = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  const PAGE_W = doc.internal.pageSize.getWidth()
  const PAGE_H = doc.internal.pageSize.getHeight()
  const MARGIN = 16
  const CW     = PAGE_W - MARGIN * 2

  const AZUL       = [0,  41, 107]
  const AZUL_MED   = [0,  63, 138]
  const AZUL_CLARO = [220, 232, 248]
  const AZUL_FUNDO = [240, 247, 255]
  const CINZA_TXT  = [60,  60,  60]
  const CINZA_LEVE = [130, 130, 130]

  let y = MARGIN

  // ── Cabeçalho institucional ───────────────────────────────────────────────────
  const LOGO_H = 18
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', MARGIN, y, LOGO_H, LOGO_H)
  }

  const TX = MARGIN + LOGO_H + 5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...AZUL)
  doc.text('UNIVERSIDADE FEDERAL DE SANTA CATARINA', TX, y + 5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...CINZA_LEVE)
  doc.text('Pró-Reitoria de Graduação e Educação Básica', TX, y + 10.5)
  doc.text('SeTIC — Superintendência de Governança Eletrônica e Tecnologia da Informação e Comunicação', TX, y + 15)

  y += LOGO_H + 4
  doc.setDrawColor(...AZUL)
  doc.setLineWidth(0.8)
  doc.line(MARGIN, y, MARGIN + CW, y)
  y += 4

  // ── Bloco do curso ────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...CINZA_LEVE)
  doc.text('CURRÍCULO DO CURSO', MARGIN, y)

  y += 4.5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...AZUL)
  doc.text((curso.nome || 'CURSO').toUpperCase(), MARGIN, y)

  if (curso.campus) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...CINZA_TXT)
    doc.text(`Campus ${curso.campus}`, MARGIN + CW, y, { align: 'right' })
  }

  y += 2.5
  doc.setDrawColor(...AZUL_CLARO)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, y, MARGIN + CW, y)
  y += 4

  // ── Metadados do curso ────────────────────────────────────────────────────────
  const labelStyle = { fontStyle: 'bold', textColor: AZUL, fillColor: AZUL_FUNDO }
  const valorStyle = { textColor: CINZA_TXT, fillColor: [255, 255, 255] }

  autoTable(doc, {
    startY: y,
    body: [
      [
        { content: 'Código',      styles: labelStyle },
        { content: curso.codigo || '—',             styles: valorStyle },
        { content: 'Currículo',   styles: labelStyle },
        { content: curso.curriculo_codigo || '—',   styles: valorStyle },
        { content: 'Habilitação', styles: labelStyle },
        { content: curso.habilitacao || '—',        styles: valorStyle },
      ],
      [
        { content: 'Titulação',    styles: labelStyle },
        { content: curso.titulacao || '—',          styles: { ...valorStyle, colSpan: 2 }, colSpan: 2 },
        { content: 'Diplomado em', styles: labelStyle },
        { content: curso.diplomado_em || '—',       styles: { ...valorStyle, colSpan: 2 }, colSpan: 2 },
      ],
      [
        { content: 'Período',   styles: labelStyle },
        { content: `Mín. ${curso.periodo_min_semestres || '?'} / Máx. ${curso.periodo_max_semestres || '?'} semestres`, styles: valorStyle },
        { content: 'C.H. UFSC', styles: labelStyle },
        { content: `${curso.carga_horaria_ufsc_ha || '—'} H/A`, styles: valorStyle },
        { content: 'C.H. CNE',  styles: labelStyle },
        { content: `${curso.carga_horaria_cne_h || '—'} H`,     styles: valorStyle },
      ],
      [
        { content: 'Aulas/sem',    styles: labelStyle },
        { content: `Mín. ${curso.aulas_semanais_min || '?'} / Máx. ${curso.aulas_semanais_max || '?'}`, styles: valorStyle },
        { content: 'Estágio',      styles: labelStyle },
        { content: `${curso.carga_horaria_estagio_ha || '—'} H/A`, styles: valorStyle },
        { content: 'Coordenador(a)', styles: labelStyle },
        { content: `${curso.coordenador || '—'}   Tel. ${curso.telefone || '—'}`, styles: valorStyle },
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.2, lineColor: AZUL_CLARO, lineWidth: 0.2 },
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: CW,
  })
  y = doc.lastAutoTable.finalY + 4

  // ── Objetivo do curso ─────────────────────────────────────────────────────────
  if (curso.objetivo) {
    autoTable(doc, {
      startY: y,
      head: [[{ content: 'OBJETIVO DO CURSO', colSpan: 1 }]],
      body: [[{ content: curso.objetivo }]],
      theme: 'plain',
      headStyles: { fillColor: AZUL_MED, textColor: [255,255,255], fontSize: 8, fontStyle: 'bold', cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 } },
      bodyStyles: { fontSize: 8, fontStyle: 'normal', textColor: CINZA_TXT, fillColor: AZUL_FUNDO, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 }, lineColor: AZUL_CLARO, lineWidth: 0.2 },
      margin: { left: MARGIN, right: MARGIN },
      tableWidth: CW,
    })
    y = doc.lastAutoTable.finalY + 5
  }

  // ── Disciplinas por fase ──────────────────────────────────────────────────────
  const faseMap = {}
  disciplinas.forEach(d => {
    const key = d.fase ?? 'optativas'
    if (!faseMap[key]) faseMap[key] = []
    faseMap[key].push(d)
  })

  const fasesOrdenadas = Object.keys(faseMap).sort((a, b) => {
    if (a === 'optativas') return 1
    if (b === 'optativas') return -1
    return Number(a) - Number(b)
  })

  for (const fase of fasesOrdenadas) {
    const discs = faseMap[fase]
    const label = fase === 'optativas' ? 'DISCIPLINAS OPTATIVAS' : `${fase}ª FASE`

    if (y > PAGE_H - 45) { doc.addPage(); y = MARGIN }

    autoTable(doc, {
      startY: y,
      head: [[{ content: label, colSpan: 6 }]],
      body: [],
      theme: 'plain',
      headStyles: { fillColor: AZUL_MED, textColor: [255,255,255], fontSize: 8.5, fontStyle: 'bold', halign: 'left', cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 3 } },
      margin: { left: MARGIN, right: MARGIN },
      tableWidth: CW,
    })
    y = doc.lastAutoTable.finalY

    const rows = []
    discs.forEach(d => {
      const prereqs  = [...(d.pre_requisitos || [])]
      if (d.pre_ch)  prereqs.push(`CH: ${d.pre_ch}h`)
      const tipoRaw  = d.tipo_raw || (d.tipo === 'Obrigatória' ? 'Ob' : 'Op')

      rows.push([
        { content: d.codigo || '', styles: { fontStyle: 'bold', textColor: AZUL } },
        d.nome || '',
        tipoRaw,
        d.carga_horaria_ha ?? '',
        d.aulas_semanais ?? '',
        prereqs.join(', ') || '—',
      ])

      if (d.ementa) {
        rows.push([{
          content: d.ementa,
          colSpan: 6,
          styles: {
            fontSize: 7.5, fontStyle: 'italic', textColor: [90, 90, 90],
            fillColor: [245, 249, 255],
            cellPadding: { top: 2, bottom: 3, left: 12, right: 5 },
            lineColor: AZUL_CLARO,
          },
        }])
      }
    })

    autoTable(doc, {
      startY: y,
      head: [['Código', 'Nome da Disciplina', 'Tipo', 'H/A', 'Aulas/sem', 'Pré-Requisito']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: AZUL_CLARO, textColor: AZUL, fontSize: 7.5, fontStyle: 'bold', cellPadding: 2, lineColor: AZUL_CLARO, lineWidth: 0.2 },
      bodyStyles: { fontSize: 8, cellPadding: 2, textColor: CINZA_TXT, lineColor: AZUL_CLARO, lineWidth: 0.15 },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 13, halign: 'center' },
        3: { cellWidth: 14, halign: 'center' },
        4: { cellWidth: 19, halign: 'center' },
        5: { cellWidth: 40 },
      },
      margin: { left: MARGIN, right: MARGIN },
      tableWidth: CW,
    })
    y = doc.lastAutoTable.finalY + 4
  }

  // ── Rodapé ────────────────────────────────────────────────────────────────────
  const totalPgs = doc.internal.getNumberOfPages()
  const hoje     = new Date()
  const dataHoje =
    String(hoje.getDate()).padStart(2, '0') + '/' +
    String(hoje.getMonth() + 1).padStart(2, '0') + '/' +
    hoje.getFullYear()

  for (let i = 1; i <= totalPgs; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(160, 160, 160)
    doc.text(
      `UFSC${curso.campus ? ' · Campus ' + curso.campus : ''} · Gerado em ${dataHoje}`,
      MARGIN, PAGE_H - 6,
    )
    doc.text(`Página ${i} de ${totalPgs}`, PAGE_W - MARGIN, PAGE_H - 6, { align: 'right' })
  }

  const nomeArq = `curriculo-${curso.codigo || 'ufsc'}-${curso.curriculo_codigo || ''}.pdf`
  doc.save(nomeArq)
}
