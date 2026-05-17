import { STEP_LABELS } from './constants'

export default function StepBar({ step }) {
  return (
    <div className="step-bar">
      {STEP_LABELS.map((label, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
          <div className={`step-item ${i === step ? 'active' : i < step ? 'done' : ''}`}>
            <div className="step-circle">
              {i < step ? '✓' : i + 1}
            </div>
            <div className="step-label">{label}</div>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div className={`step-line ${i < step ? 'done' : ''}`} />
          )}
        </div>
      ))}
    </div>
  )
}
