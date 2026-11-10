import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Lock, Loader2, ShieldCheck, Timer, FileWarning } from "lucide-react";
import { safeReturnTo } from "@/lib/authReturnTo";
import { usePrefersReducedMotion } from "@/hooks/useMotion";
import BenchScene from "@/components/BenchScene";
import factoryImage from "@/assets/nikkoshi-factory.jpeg";

// Same four states as the dashboard. Order matters: they are the gauge zones, left to right.
const ZONES = [
  { label: "Done verification", note: "Verified and in date", hex: "#10b981" },
  { label: "For verify", note: "Due next month", hex: "#facc15" },
  { label: "Near expiration", note: "Inside the alert window", hex: "#f97316" },
  { label: "Expired", note: "Out of date, needs action", hex: "#ef4444" },
];

const FEATURES = [
  { icon: ShieldCheck, title: "Compliance by department", text: "See which departments are behind on verification, with the lowest first." },
  { icon: Timer, title: "Warnings before expiry", text: "Instruments due next month or inside the alert window are flagged before they expire." },
  { icon: FileWarning, title: "Pending reports", text: "Track which equipment still needs a report and open that list in one click." },
];

/* ---------- Dial gauge ---------- */
const CX = 200, CY = 210;
// deg is measured from straight up: -90 = far left, 0 = top, +90 = far right
const pt = (deg, r) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
};
const arc = (d1, d2, r) => {
  const [x1, y1] = pt(d1, r);
  const [x2, y2] = pt(d2, r);
  return `M${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}`;
};
const TICKS = Array.from({ length: 61 }, (_, i) => {
  const deg = -90 + i * 3;
  const major = i % 5 === 0;
  const [x1, y1] = pt(deg, 124);
  const [x2, y2] = pt(deg, major ? 110 : 117);
  return { x1, y1, x2, y2, major, key: i };
});
// Self-check sweep: rest left, swing past the red zone, settle inside the green zone.
const ANGLES = [-90, 80, -62];

function Gauge({ step, reduced }) {
  const transition = reduced || step === 0
    ? "none"
    : step === 1
      ? "transform 900ms cubic-bezier(.3,.7,.3,1)"
      : "transform 1100ms cubic-bezier(.34,1.4,.64,1)";
  const settled = step >= 2;
  return (
    <svg viewBox="0 0 400 270" className="mx-auto w-full max-w-sm" role="img" aria-label="Gauge needle resting in the done verification zone">
      <path d={arc(-90, 90, 158)} fill="none" stroke="#fff" strokeOpacity="0.25" strokeWidth="1" />
      {ZONES.map((z, i) => (
        <path
          key={z.label}
          d={arc(-90 + i * 45 + 1.5, -45 + i * 45 - 1.5, 140)}
          fill="none"
          stroke={z.hex}
          strokeWidth="14"
          style={{ opacity: settled && i > 0 ? 0.4 : 1, transition: reduced ? "none" : "opacity 600ms ease-out" }}
        />
      ))}
      {TICKS.map((t) => (
        <line key={t.key} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="#fff" strokeOpacity={t.major ? 0.8 : 0.4} strokeWidth={t.major ? 1.5 : 1} />
      ))}
      <g style={{ transformOrigin: `${CX}px ${CY}px`, transformBox: "view-box", transform: `rotate(${ANGLES[step > 2 ? 2 : step]}deg)`, transition }}>
        <path d={`M${CX - 3} ${CY} L${CX} ${CY - 112} L${CX + 3} ${CY} Z`} fill="#fff" />
      </g>
      <circle cx={CX} cy={CY} r="10" fill="#fff" />
      <circle cx={CX} cy={CY} r="4" fill="#172554" />
      <text x={CX} y="252" textAnchor="middle" fill="#fff" fontSize="16" style={{ opacity: step >= 3 ? 1 : 0, transition: reduced ? "none" : "opacity 500ms ease-out" }}>
        Done verification
      </text>
    </svg>
  );
}

/* ---------- Page ---------- */
export default function Landing() {
  const [idNumber, setIdNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const reduced = usePrefersReducedMotion();
  const [step, setStep] = useState(reduced ? 3 : 0);
  const returnTo = safeReturnTo();

  // One page-load sequence: text rises in, the needle sweeps the scale, then settles in the green zone.
  useEffect(() => {
    if (reduced) { setStep(3); return undefined; }
    const timers = [
      setTimeout(() => setStep(1), 600),
      setTimeout(() => setStep(2), 1600),
      setTimeout(() => setStep(3), 2800),
    ];
    return () => timers.forEach(clearTimeout);
  }, [reduced]);

  useEffect(() => {
    let active = true;
    apiClient.auth.status()
      .then((status) => { if (active) setSetupRequired(status.setup_required); })
      .catch((statusError) => console.error("Could not check administrator setup:", statusError));
    return () => { active = false; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiClient.auth.loginViaEmailPassword(idNumber, password);
      window.location.href = returnTo;
    } catch (err) {
      setError(err.message || "Invalid ID number or password");
    } finally {
      setLoading(false);
    }
  };

  const shown = step >= 0;
  const rv = (delay, extra = "") => ({
    className: `transition duration-700 ease-out motion-reduce:transition-none ${shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"} ${extra}`,
    style: { transitionDelay: reduced ? "0ms" : `${delay}ms` },
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <section className="grid min-h-screen lg:grid-cols-[1fr_28rem]">
        {/* Hero */}
        <div className="relative flex flex-col justify-between gap-12 overflow-hidden p-8 pb-16 text-white sm:p-12 sm:pb-16 lg:p-16 lg:pb-20">
          <img src={factoryImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-blue-950/85" />

          <p className="relative text-lg font-semibold tracking-tight">QA/QC Nikkoshi System</p>

          <div className="relative grid items-center gap-12 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <div>
              <h1 {...rv(0, "text-4xl font-semibold leading-tight tracking-tight sm:text-5xl")}>
                Know which equipment is due before it expires.
              </h1>
              <p {...rv(120, "mt-5 max-w-xl text-lg text-white/80")}>
                Calibration and verification status for every instrument, across every department.
              </p>
              <ul className="mt-8 grid gap-4 border-t border-white/25 pt-6 sm:grid-cols-2">
                {ZONES.map((z, i) => (
                  <li key={z.label} {...rv(300 + i * 120, "flex items-start gap-3")}>
                    <span className="mt-1.5 h-3 w-3 shrink-0 rounded-sm" style={{ background: z.hex }} />
                    <div>
                      <p className="font-medium">{z.label}</p>
                      <p className="text-sm text-white/70">{z.note}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <Gauge step={step} reduced={reduced} />
          </div>

          <p className="relative text-sm text-white/70">Need an account? Contact your administrator.</p>

          {/* Ruler graduations along the bottom edge: minor ticks every 8px, major every 40px */}
          <div className="absolute inset-x-0 bottom-0 h-3" aria-hidden="true">
            <div className="absolute bottom-0 h-1.5 w-full opacity-50" style={{ backgroundImage: "repeating-linear-gradient(to right, #fff 0 1px, transparent 1px 8px)" }} />
            <div className="absolute bottom-0 h-3 w-full opacity-70" style={{ backgroundImage: "repeating-linear-gradient(to right, #fff 0 1px, transparent 1px 40px)" }} />
          </div>
        </div>

        {/* Login */}
        <div className="relative flex items-center justify-center bg-white p-6 sm:p-10">
          <div className="absolute inset-y-0 left-0 hidden w-3 lg:block" aria-hidden="true">
            <div className="absolute left-0 h-full w-1.5" style={{ backgroundImage: "repeating-linear-gradient(to bottom, #cbd5e1 0 1px, transparent 1px 8px)" }} />
            <div className="absolute left-0 h-full w-3" style={{ backgroundImage: "repeating-linear-gradient(to bottom, #94a3b8 0 1px, transparent 1px 40px)" }} />
          </div>

          <div className="w-full max-w-sm">
            <BenchScene className="mb-8" forceMotion />
            <h2 className="text-2xl font-semibold tracking-tight">Log in</h2>
            <p className="mb-6 mt-1 text-sm text-muted-foreground">Use your ID number and password.</p>

            {error && <div role="alert" className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            {setupRequired && (
              <div role="note" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Administrator setup is required. On the API host, run <code>node server/reset-admin.mjs &lt;id_number&gt;</code> in a terminal.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="idNumber">ID number</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input id="idNumber" type="text" autoComplete="username" autoFocus placeholder="e.g. 1863" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} className="h-12 pl-10" required />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 pl-10" required />
                </div>
              </div>
              <Button type="submit" className="h-12 w-full font-medium" disabled={loading}>
                {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Logging in...</>) : "Log in"}
              </Button>
            </form>
          </div>
        </div>
      </section>

      {/* What it does: each item sits under a dimension line */}
      <section className="mx-auto max-w-6xl px-8 py-16 sm:px-12">
        <h2 className="max-w-xl text-2xl font-semibold tracking-tight">Built for the calibration team's daily work</h2>
        <div className="mt-10 grid gap-10 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="relative border-t border-slate-400 pt-5">
              <span className="absolute -top-1.5 left-0 h-3 w-px bg-slate-400" aria-hidden="true" />
              <span className="absolute -top-1.5 right-0 h-3 w-px bg-slate-400" aria-hidden="true" />
              <Icon className="h-6 w-6 text-blue-700" aria-hidden="true" />
              <h3 className="mt-4 font-medium">{title}</h3>
              <p className="mt-2 text-sm text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}