export default function SuccessScreen({ aluno, onNovo, aviso }) {
  return (
    <div className="form-card">
      <div className="success-screen">
        <div className="success-icon">✅</div>
        <div className="success-title">Requerimento Enviado!</div>
        <div className="success-sub">
          Seu requerimento foi recebido com sucesso. Você receberá uma confirmação no e-mail informado em breve.
        </div>
        <div className="success-info">
          <ul>
            <li><strong>Requerente:</strong> {aluno.nome}</li>
            <li><strong>E-mail:</strong> {aluno.email}</li>
            <li><strong>Prazo de resposta:</strong> até 30 dias úteis</li>
          </ul>
        </div>

        {aviso && (
          <div className="alert-warning" style={{ marginBottom: 16, textAlign: 'left' }}>
            ⚠️ {aviso}
          </div>
        )}

        <button className="btn-novo" onClick={onNovo}>
          Novo Requerimento
        </button>
      </div>
    </div>
  )
}
