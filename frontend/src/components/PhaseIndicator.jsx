import { motion } from 'framer-motion'
import { Check, Camera, Eye, Sparkles, CheckCircle2, Globe } from 'lucide-react'

/**
 * PhaseIndicator — shows progress through AddItem's phase state machine.
 *
 * Steps:         shoot  →  preview  →  tagging  →  done
 * Phase values:  idle/camera  previewing  uploading  manual_form/done
 */

const STEPS = [
  { id: 'shoot',         label: 'Photo',   phases: ['idle', 'camera'],              Icon: Camera },
  { id: 'preview',       label: 'Preview', phases: ['previewing'],                  Icon: Eye },
  { id: 'tagging',       label: 'AI Tag',  phases: ['uploading', 'manual_form'],    Icon: Sparkles },
  { id: 'online_lookup', label: 'Online',  phases: ['online_lookup'],               Icon: Globe },
  { id: 'done',          label: 'Done',    phases: ['done'],                        Icon: CheckCircle2 },
]

function stepState(step, currentPhase) {
  const idx = STEPS.findIndex((s) => s.phases.includes(currentPhase))
  const stepIdx = STEPS.findIndex((s) => s.id === step.id)
  if (stepIdx < idx) return 'done'
  if (stepIdx === idx) return 'active'
  return 'pending'
}

export default function PhaseIndicator({ phase }) {
  // Don't render during camera (full-screen black) or barcode phases
  if (phase === 'camera' || phase === 'barcode') return null

  return (
    <div
      className="flex items-center justify-center px-5 pt-5 pb-2"
      aria-label="Progress"
    >
      {STEPS.map((step, i) => {
        const state = stepState(step, phase)
        const isLast = i === STEPS.length - 1

        return (
          <div key={step.id} className="flex items-center">
            {/* Step node */}
            <div className="flex flex-col items-center gap-1.5">
              <motion.div
                animate={
                  state === 'active'
                    ? { scale: [1, 1.08, 1], transition: { repeat: Infinity, duration: 2.4, ease: 'easeInOut' } }
                    : { scale: 1 }
                }
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 28,
                  height: 28,
                  backgroundColor:
                    state === 'active'
                      ? 'var(--accent)'
                      : state === 'done'
                      ? 'rgba(200,169,126,0.15)'
                      : 'rgba(255,255,255,0.05)',
                  border:
                    state === 'active'
                      ? 'none'
                      : state === 'done'
                      ? '1px solid rgba(200,169,126,0.3)'
                      : '1px solid rgba(255,255,255,0.08)',
                  boxShadow: state === 'active' ? '0 0 14px rgba(200,169,126,0.35)' : 'none',
                  transition: 'background-color 0.3s, border-color 0.3s, box-shadow 0.3s',
                }}
              >
                {state === 'done' ? (
                  <Check size={12} strokeWidth={2.5} style={{ color: 'var(--accent)' }} />
                ) : (
                  <step.Icon
                    size={12}
                    strokeWidth={1.75}
                    style={{
                      color:
                        state === 'active'
                          ? '#0C0C0C'
                          : 'rgba(107,101,96,0.6)',
                    }}
                  />
                )}
              </motion.div>

              {/* Label */}
              <span
                className="text-[9px] uppercase tracking-[0.12em] font-medium"
                style={{
                  color:
                    state === 'active'
                      ? 'var(--accent)'
                      : state === 'done'
                      ? 'rgba(200,169,126,0.5)'
                      : 'rgba(107,101,96,0.4)',
                  transition: 'color 0.3s',
                }}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className="mx-2 h-px flex-shrink-0"
                style={{
                  width: 28,
                  backgroundColor:
                    stepState(STEPS[i + 1], phase) === 'pending'
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(200,169,126,0.25)',
                  transition: 'background-color 0.4s',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
