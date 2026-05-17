export default function SuccessScreen({ protocolo, aluno, onNovo }) {
  return (
    <div className="form-card">
      <div className="success-screen">
        <div className="success-icon">✅</div>
        <div className="success-title">Requerimento Enviado!</div>
        <div className="success-sub">
          Seu requerimento foi recebido com sucesso. Você receberá uma confirmação no e-mail informado.
        </div>
        <div className="success-info">
          <ul>
            <li><strong>Protocolo:</strong> {protocolo}</li>
            <li><strong>Requerente:</strong> {aluno.nome}</li>
            <li><strong>E-mail de confirmação:</strong> {aluno.email}</li>
            <li><strong>Prazo de resposta:</strong> até 30 dias úteis</li>
          </ul>
        </div>
        <div style={{ marginBottom: 20, fontSize: 13, color: '#6b7ea8' }}>
          📌 Guarde o número de protocolo para acompanhar sua solicitação junto à Coordenação Acadêmica.
        </div>
        <button className="btn-novo" onClick={onNovo}>
          📋 Novo Requerimento
        </button>
      </div>
    </div>
  )
}
