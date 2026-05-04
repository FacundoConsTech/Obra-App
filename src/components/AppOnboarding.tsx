import { useEffect, useMemo, useState, type CSSProperties } from 'react';

type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  page: 'planned' | 'daily' | 'payroll' | 'stats';
  targetSelector?: string;
};

type AppOnboardingProps = {
  steps: OnboardingStep[];
  stepIndex: number;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
};

export default function AppOnboarding({ steps, stepIndex, onNext, onBack, onClose }: AppOnboardingProps) {
  const step = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const [anchoredStyle, setAnchoredStyle] = useState<CSSProperties | null>(null);

  const defaultStyle = useMemo<CSSProperties>(() => ({ right: '1rem', top: '5rem' }), []);

  useEffect(() => {
    if (!step.targetSelector) {
      setAnchoredStyle(null);
      return;
    }

    const updatePosition = () => {
      const target = document.querySelector(step.targetSelector);
      if (!(target instanceof HTMLElement)) {
        setAnchoredStyle(null);
        return;
      }

      const rect = target.getBoundingClientRect();
      const panelWidth = Math.min(window.innerWidth * 0.92, 360);
      const gap = 12;
      const maxLeft = window.innerWidth - panelWidth - 12;
      const preferredLeft = rect.right + gap;
      const left = Math.max(12, Math.min(preferredLeft, maxLeft));
      const preferredTop = rect.top;
      const top = Math.max(80, Math.min(preferredTop, window.innerHeight - 260));

      setAnchoredStyle({ left: `${left}px`, top: `${top}px`, right: 'auto' });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [step.targetSelector]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/45" />
      <div
        className="pointer-events-auto absolute w-[min(92vw,360px)] rounded-xl border border-cyan-300/35 bg-[#0b1321] p-5 shadow-2xl"
        style={anchoredStyle ?? defaultStyle}
      >
        <p className="text-xs uppercase tracking-[0.16em] text-cyan-200">Onboarding</p>
        <h3 className="mt-2 text-lg font-semibold text-white">{step.title}</h3>
        <p className="mt-2 text-sm text-gray-300">{step.description}</p>

        <div className="mt-4 text-xs text-gray-400">
          Paso {stepIndex + 1} de {steps.length}
        </div>

        <div className="mt-5 flex items-center gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-gray-200 transition hover:border-white/50"
          >
            Cerrar
          </button>
          <button
            onClick={onBack}
            disabled={isFirst}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              isFirst
                ? 'cursor-not-allowed border border-gray-700 text-gray-500'
                : 'border border-white/20 text-gray-200 hover:border-white/50'
            }`}
          >
            Atrás
          </button>
          <button
            onClick={onNext}
            className="ml-auto rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-gray-100"
          >
            {isLast ? 'Finalizar' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  );
}

