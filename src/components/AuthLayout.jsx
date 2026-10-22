import React from "react";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children, backgroundImage }) {
  return (
    <main className={`relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 ${backgroundImage ? "bg-slate-950" : "bg-background"}`}>
      {backgroundImage && (
        <>
          <div className="absolute inset-0 -z-20 bg-cover bg-center" style={{ backgroundImage: `url(${backgroundImage})` }} aria-hidden="true" />
          <div className="absolute inset-0 -z-10 bg-slate-950/55" aria-hidden="true" />
        </>
      )}
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
            <Icon className="w-7 h-7 text-primary-foreground" aria-hidden="true" />
          </div>
          <h1 className={`text-3xl font-bold tracking-tight ${backgroundImage ? "text-white" : "text-foreground"}`}>{title}</h1>
          {subtitle && <p className={`mt-2 ${backgroundImage ? "text-white/80" : "text-muted-foreground"}`}>{subtitle}</p>}
        </div>
        <div className={`rounded-xl border p-8 ${backgroundImage ? "border-white/40 bg-white/95 shadow-2xl backdrop-blur-sm" : "bg-card shadow-sm border-border"}`}>
          {children}
        </div>
        {footer && (
          <p className={`mt-6 text-center text-sm ${backgroundImage ? "text-white/80" : "text-muted-foreground"}`}>{footer}</p>
        )}
      </div>
    </main>
  );
}
