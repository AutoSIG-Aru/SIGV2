import UploadZone from '../../../components/UploadZone'

export default function StepDocumentos({
  docReqAssinado, setDocReqAssinado,
  docHistorico, setDocHistorico,
  docPrograma, setDocPrograma,
  docControleCurricular, setDocControleCurricular,
  docCertif, setDocCertif,
  docErros,
  onNext, onBack,
}) {
  return (
    <div>
      <div className="form-card">
        <div className="section-header">
          <span className="step-num">3</span>Documentação Comprobatória
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <UploadZone
            label="Requerimento Assinado"
            hint="Criado na etapa anterior — faça upload do documento assinado e digitalizado"
            required
            files={docReqAssinado}
            onChange={setDocReqAssinado}
            error={docErros.reqAssinado}
          />
          <UploadZone
            label="Histórico Escolar"
            hint="Documento contendo as disciplinas cursadas e notas obtidas"
            required
            multiple
            files={docHistorico}
            onChange={setDocHistorico}
            error={docErros.historico}
          />
          <UploadZone
            label="Programa / Plano de Ensino"
            hint="Documento oficial da instituição de origem com o conteúdo programático"
            required
            multiple
            files={docPrograma}
            onChange={setDocPrograma}
            error={docErros.planoEnsino}
          />
          <UploadZone
            label="Controle Curricular UFSC"
            hint="Documento de controle curricular emitido pelo sistema da UFSC"
            required
            files={docControleCurricular}
            onChange={setDocControleCurricular}
            error={docErros.controleCurricular}
          />
          <UploadZone
            label="Certificados e Outros Documentos"
            hint="Seminários, cursos de extensão ou outros comprovantes relevantes"
            multiple
            files={docCertif}
            onChange={setDocCertif}
          />
        </div>
      </div>

      <div className="wizard-nav">
        <button type="button" className="btn-back" onClick={onBack}>← Voltar</button>
        <button type="button" className="submit-btn" onClick={onNext}>Revisar e Enviar →</button>
      </div>
    </div>
  )
}
