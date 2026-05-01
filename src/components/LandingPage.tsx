import { useMemo, useState } from 'react';
import siteTeamImage from '../assets/landing/site-team.png';
import siteSupervisorImage from '../assets/landing/site-supervisor.png';

type LandingPageProps = {
  onTryApp: () => void;
  onLogin: () => void;
};

const workflow = [
  {
    title: '1. Planned / Tareas',
    description:
      'Definí rubros, tareas, unidades y objetivos por obra. Todo el equipo trabaja sobre el mismo plan.',
  },
  {
    title: '2. Daily Entries',
    description:
      'Cargá avances diarios por tarea y cuadrilla. La información deja de perderse en chats y planillas sueltas.',
  },
  {
    title: '3. Payroll',
    description:
      'Con los daily entries al día, calculás liquidaciones por período con trazabilidad real de lo ejecutado.',
  },
  {
    title: '4. Comprobantes',
    description:
      'Emití y guardá comprobantes de pago listos para consultar, auditar e imprimir cuando lo necesites.',
  },
];

const workflowPreview = [
  {
    tag: 'Planned',
    headline: 'Plan de tareas por rubro',
    summary: 'Definición inicial de objetivos, cantidades y unidades antes de ejecutar en obra.',
    kpiLabel: 'Tareas activas',
    kpiValue: '24',
    items: [
      { left: 'Hormigón H-21', right: '1.200 m3' },
      { left: 'Muros interiores', right: '860 m2' },
      { left: 'Cañería principal', right: '450 ml' },
    ],
  },
  {
    tag: 'Daily Entries',
    headline: 'Avance diario consolidado',
    summary: 'Carga por crew y tarea para reflejar el progreso real todos los días.',
    kpiLabel: 'Entradas hoy',
    kpiValue: '18',
    items: [
      { left: 'Crew Silleteros · Hormigón', right: '42 m3' },
      { left: 'Crew Albañilería · Muros', right: '88 m2' },
      { left: 'Crew Plomería · Caños', right: '36 ml' },
    ],
  },
  {
    tag: 'Payroll',
    headline: 'Liquidación del período',
    summary: 'Cálculo automático de montos en base a lo realmente ejecutado por cuadrilla.',
    kpiLabel: 'Total calculado',
    kpiValue: '$ 8.420.000',
    items: [
      { left: 'Crew Silleteros', right: '$ 3.180.000' },
      { left: 'Crew Albañilería', right: '$ 2.740.000' },
      { left: 'Crew Plomería', right: '$ 2.500.000' },
    ],
  },
  {
    tag: 'Comprobantes',
    headline: 'Comprobantes emitidos y trazables',
    summary: 'Archivo ordenado para consultar, auditar e imprimir pagos sin reprocesar datos.',
    kpiLabel: 'Comprobantes mes',
    kpiValue: '12',
    items: [
      { left: 'REC-2026-0048', right: 'Emitido' },
      { left: 'REC-2026-0047', right: 'Emitido' },
      { left: 'REC-2026-0046', right: 'Emitido' },
    ],
  },
];

export default function LandingPage({ onTryApp, onLogin }: LandingPageProps) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const [activeStep, setActiveStep] = useState(0);

  const subscribeWebhookUrl = useMemo(() => import.meta.env.VITE_PUBLIC_SUBSCRIBE_WEBHOOK_URL as string | undefined, []);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setMessageType('error');
      setMessage('Ingresá un email válido para recibir acceso.');
      return;
    }

    setSending(true);
    setMessage('');

    try {
      if (subscribeWebhookUrl) {
        const response = await fetch(subscribeWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail, source: 'landing_obra_app' }),
        });

        if (!response.ok) {
          throw new Error(`Subscription request failed (${response.status})`);
        }
      }

      setEmail('');
      setMessageType('success');
      setMessage('Gracias. Te vamos a contactar para coordinar tu prueba de ObrApp.');
    } catch (error) {
      console.error('Subscription request failed:', error);
      setMessageType('error');
      setMessage('No pudimos enviar tu solicitud ahora. Probá de nuevo en unos minutos.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05070c] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#05070c]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-lg font-semibold tracking-wide">ObrApp</p>
            <p className="text-xs text-gray-400">Gestión de avance y liquidación de cuadrillas</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onLogin}
              className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:border-white/50 hover:text-white"
            >
              Iniciar sesión
            </button>
            <button
              onClick={onTryApp}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-gray-100"
            >
              Probar ObrApp
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-white/10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(56,189,248,0.18),transparent_36%),radial-gradient(circle_at_85%_25%,rgba(168,85,247,0.14),transparent_32%),radial-gradient(circle_at_45%_95%,rgba(34,197,94,0.12),transparent_34%)]" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-6 py-20 md:grid-cols-[1.2fr_1fr] md:py-28">
            <div className="space-y-7">
              <p className="inline-flex rounded-full border border-cyan-300/40 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-200">
                Construcción y remodelación con control real
              </p>
              <h1 className="text-4xl font-semibold leading-tight md:text-6xl">
                Liquidá cuadrillas y medí avance de obra sin depender de planillas manuales.
              </h1>
              <p className="max-w-2xl text-lg text-gray-300 md:text-xl">
                ObrApp centraliza tareas, daily entries, cálculo de liquidación y comprobantes para que el cierre de
                quincena sea claro, auditable y rápido.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={onTryApp}
                  className="rounded-xl bg-white px-6 py-3 text-base font-semibold text-black transition hover:bg-gray-100"
                >
                  Probar ObrApp
                </button>
                <button
                  onClick={onLogin}
                  className="rounded-xl border border-white/20 px-6 py-3 text-base font-semibold text-gray-100 transition hover:border-white/60"
                >
                  Iniciar sesión
                </button>
              </div>
            </div>
            <div className="relative">
              <div className="landing-card landing-float">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Flujo operativo</p>
                <div className="mt-4 space-y-3 text-sm text-gray-200">
                  <p>Relevamiento diario en obra</p>
                  <p className="text-gray-400">→ Carga en Daily Entries</p>
                  <p className="text-gray-400">→ Liquidación automática por período</p>
                  <p className="text-gray-400">→ Emisión y archivo de comprobantes</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-white/10 bg-[#070b14]">
          <div className="mx-auto max-w-7xl px-6 py-20">
            <div className="mb-10 max-w-3xl">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-400">El problema hoy</p>
              <h2 className="mt-3 text-3xl font-semibold md:text-4xl">El cierre de obra sigue atado a procesos manuales</h2>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  title: 'Relevamiento disperso',
                  text: 'La información se levanta en obra, pero llega tarde o incompleta al cierre operativo.',
                },
                {
                  title: 'Excel como puente',
                  text: 'Los datos se vuelcan a planillas con retrabajo y múltiples versiones sin trazabilidad.',
                },
                {
                  title: 'Cálculo manual',
                  text: 'Las liquidaciones por rubro y cuadrilla se resuelven al final, con alta fricción administrativa.',
                },
                {
                  title: 'Cierre poco claro',
                  text: 'El resultado final tarda más, es difícil de auditar y genera dudas entre campo y oficina.',
                },
              ].map((item, index) => (
                <article key={item.title} className="landing-card landing-reveal" style={{ animationDelay: `${index * 80}ms` }}>
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-300">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-white/10">
          <div className="mx-auto grid max-w-7xl gap-8 px-6 py-16 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div className="landing-image-wrap landing-reveal">
              <img
                src={siteTeamImage}
                alt="Equipo de obra revisando avances en campo"
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <div className="landing-image-overlay" />
            </div>
            <div className="space-y-5">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-400">De la obra al control</p>
              <h2 className="text-3xl font-semibold md:text-4xl">Visibilidad operativa sin fricción de planillas.</h2>
              <p className="text-gray-300">Cargás una vez en campo y el avance queda listo para seguimiento y cierre.</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <article className="landing-card">
                  <p className="text-sm font-medium text-white">Relevás</p>
                  <p className="mt-1 text-xs text-gray-400">Avance diario por tarea</p>
                </article>
                <article className="landing-card">
                  <p className="text-sm font-medium text-white">Consolidás</p>
                  <p className="mt-1 text-xs text-gray-400">Datos por cuadrilla y rubro</p>
                </article>
                <article className="landing-card">
                  <p className="text-sm font-medium text-white">Liquidás</p>
                  <p className="mt-1 text-xs text-gray-400">Con respaldo auditable</p>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-white/10">
          <div className="mx-auto max-w-7xl px-6 py-20">
            <div className="mb-10 max-w-3xl">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-400">Cómo funciona</p>
              <h2 className="mt-3 text-3xl font-semibold md:text-4xl">Un flujo continuo, desde la tarea hasta el comprobante</h2>
            </div>
            <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
              <div className="space-y-3">
                {workflow.map((step, index) => {
                  const isActive = activeStep === index;
                  return (
                    <button
                      key={step.title}
                      onMouseEnter={() => setActiveStep(index)}
                      onFocus={() => setActiveStep(index)}
                      onClick={() => setActiveStep(index)}
                      aria-pressed={isActive}
                      className={`w-full rounded-xl border px-5 py-4 text-left transition ${
                        isActive
                          ? 'border-cyan-300/50 bg-cyan-300/10'
                          : 'border-white/10 bg-white/5 hover:border-white/30'
                      }`}
                    >
                      <p className="text-base font-semibold">{step.title}</p>
                      <p className="mt-2 text-sm text-gray-300">{step.description}</p>
                    </button>
                  );
                })}
              </div>
              <div className="relative min-h-[360px] overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220] p-6">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(56,189,248,0.2),transparent_36%),radial-gradient(circle_at_10%_80%,rgba(59,130,246,0.18),transparent_40%)]" />
                <div key={activeStep} className="relative landing-reveal">
                  <p className="text-xs uppercase tracking-[0.16em] text-cyan-100">Vista del módulo</p>
                  <h3 className="mt-2 text-2xl font-semibold">{workflowPreview[activeStep].headline}</h3>
                  <p className="mt-3 max-w-xl text-sm text-gray-300">{workflowPreview[activeStep].summary}</p>

                  <div className="mt-5 rounded-xl border border-white/15 bg-white/5 p-4">
                    <p className="text-xs text-gray-400">{workflowPreview[activeStep].kpiLabel}</p>
                    <p className="mt-1 text-xl font-semibold text-white">{workflowPreview[activeStep].kpiValue}</p>
                  </div>

                  <div className="mt-5 rounded-xl border border-white/15 bg-black/20 p-3">
                    <p className="px-2 pb-2 text-xs uppercase tracking-[0.12em] text-cyan-100">
                      {workflowPreview[activeStep].tag}
                    </p>
                    <div className="space-y-2">
                      {workflowPreview[activeStep].items.map((item) => (
                        <div key={item.left} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                          <span className="text-sm text-gray-200">{item.left}</span>
                          <span className="text-sm font-semibold text-white">{item.right}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-white/10 bg-[#070b14]">
          <div className="mx-auto grid max-w-7xl gap-8 px-6 py-16 lg:grid-cols-[1fr_1.08fr] lg:items-center">
            <div className="order-2 space-y-5 lg:order-1">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-400">Seguimiento operativo</p>
              <h2 className="text-3xl font-semibold md:text-4xl">El estado diario queda alineado para todo el equipo.</h2>
              <p className="text-gray-300">Mismo dato para producción, administración y liquidación del período.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <article className="landing-card">
                  <p className="text-sm font-medium text-white">Visión por obra</p>
                  <p className="mt-1 text-xs text-gray-400">Seguimiento simultáneo sin duplicar tareas.</p>
                </article>
                <article className="landing-card">
                  <p className="text-sm font-medium text-white">Cierre más simple</p>
                  <p className="mt-1 text-xs text-gray-400">Menos fricción para emitir informes y comprobantes.</p>
                </article>
              </div>
            </div>
            <div className="order-1 landing-image-wrap landing-reveal lg:order-2">
              <img
                src={siteSupervisorImage}
                alt="Supervisor de obra controlando tareas desde tablet"
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <div className="landing-image-overlay" />
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.2),transparent_44%)]" />
          <div className="relative mx-auto max-w-4xl px-6 py-20">
            <div className="rounded-2xl border border-white/15 bg-[#0a1220]/90 p-8 md:p-10">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-400">Acceso anticipado</p>
              <h2 className="mt-3 text-3xl font-semibold">Suscribite para probar ObrApp</h2>
              <p className="mt-4 text-gray-300">
                Dejanos tu email y te contactamos para activar tu prueba en obra real.
              </p>

              <form onSubmit={handleSubscribe} className="mt-6 flex flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tuemail@empresa.com"
                  className="w-full rounded-lg border border-white/20 bg-black/40 px-4 py-3 text-white placeholder:text-gray-500 focus:border-cyan-300/60 focus:outline-none"
                  required
                />
                <button
                  type="submit"
                  disabled={sending}
                  className={`rounded-lg px-5 py-3 font-semibold transition ${
                    sending ? 'bg-gray-700 text-gray-300' : 'bg-white text-black hover:bg-gray-100'
                  }`}
                >
                  {sending ? 'Enviando...' : 'Quiero probar ObrApp'}
                </button>
              </form>

              {message && (
                <p className={`mt-4 text-sm ${messageType === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>
                  {message}
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  onClick={onTryApp}
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-gray-100 transition hover:border-white/60"
                >
                  Ir a la app
                </button>
                <button
                  onClick={onLogin}
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-gray-100 transition hover:border-white/60"
                >
                  Ya tengo acceso
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
