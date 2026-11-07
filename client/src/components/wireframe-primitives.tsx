

// ─── Shared primitives used across every wireframe screen ────────────────────

export function Wire({ h = 'h-44', label = '' }: { h?: string; label?: string }) {
  return (
    <div className={`${h} bg-brand-cream border border-brand-border flex items-end p-2 shrink-0`}>
      {label && (
        <span className="text-[8px] tracking-[0.2em] uppercase font-semibold text-brand-muted">
          {label}
        </span>
      )}
    </div>
  )
}

export function MicroLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[9px] tracking-[0.2em] uppercase font-semibold text-brand-evergreen">
      {children}
    </span>
  )
}

export function Divider({ thick = false }: { thick?: boolean }) {
  return <div className={`w-full ${thick ? 'border-t-2 border-brand-border' : 'border-t border-brand-border'}`} />
}

export function PageShell({
  title,
  breadcrumb,
  children,
  containerClassName = "max-w-screen-2xl",
}: {
  title: string;
  breadcrumb: string;
  children: React.ReactNode;
  containerClassName?: string;
}) {
  return (
    <div className="min-h-[60vh] bg-brand-cream px-4 py-8 text-brand-charcoal md:px-8 md:py-12">
      <div className={`mx-auto ${containerClassName}`}>
        {breadcrumb && <MicroLabel>{breadcrumb}</MicroLabel>}
        {title && (
          <h1 className="mt-2 mb-8 font-black leading-none tracking-tight text-brand-charcoal" style={{ fontSize: 'clamp(24px, 3.5vw, 40px)', letterSpacing: '-0.03em' }}>
            {title}
          </h1>
        )}
        {children}
      </div>
    </div>
  )
}
