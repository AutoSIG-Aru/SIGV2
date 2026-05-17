/**
 * UfscFooter — rodapé institucional.
 *
 * Props:
 *   variant: 'publico' (padrão) — exibido no formulário do aluno
 *            'staff'             — exibido nas telas do painel interno
 */
export default function UfscFooter({ variant = 'publico' }) {
  return (
    <footer className="ufsc-footer">
      {variant === 'staff' ? (
        <>
          <strong>Universidade Federal de Santa Catarina</strong> · Campus Araranguá · Painel SIG
        </>
      ) : (
        <>
          <strong>Universidade Federal de Santa Catarina</strong> · Campus Araranguá ·
          Coordenação Acadêmica Integrada · Sistema em conformidade com o Decreto Federal nº 8.539/2015
        </>
      )}
    </footer>
  )
}
