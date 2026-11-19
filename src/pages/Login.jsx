import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User,
  Lock,
  Loader2,
  ShieldCheck,
  Timer,
  FileWarning,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
} from "lucide-react";
import { safeReturnTo } from "@/lib/authReturnTo";
import { usePrefersReducedMotion } from "@/hooks/useMotion";
import BenchScene from "@/components/BenchScene";
import factoryImage from "@/assets/nikkoshi-factory.jpeg";

const ZONES = [
  { label: "Done verification", note: "Verified and in date", hex: "#10b981" },
  { label: "For verify", note: "Due next month", hex: "#facc15" },
  { label: "Near expiration", note: "Inside the alert window", hex: "#f97316" },
  { label: "Expired", note: "Out of date, needs action", hex: "#ef4444" },
];

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Compliance by department",
    text: "See which departments are behind on verification, with the lowest first.",
  },
  {
    icon: Timer,
    title: "Warnings before expiry",
    text: "Instruments due next month or inside the alert window are flagged before they expire.",
  },
  {
    icon: FileWarning,
    title: "Pending reports",
    text: "Track which equipment still needs a report and open that list in one click.",
  },
];

const CX = 200;
const CY = 210;

const pointOnArc = (degrees, radius) => {
  const angle = ((degrees - 90) * Math.PI) / 180;
  return [CX + radius * Math.cos(angle), CY + radius * Math.sin(angle)];
};

const arcPath = (startDegrees, endDegrees, radius) => {
  const [x1, y1] = pointOnArc(startDegrees, radius);
  const [x2, y2] = pointOnArc(endDegrees, radius);
  return `M${x1} ${y1} A${radius} ${radius} 0 0 1 ${x2} ${y2}`;
};

const TICKS = Array.from({ length: 61 }, (_, index) => {
  const degrees = -90 + index * 3;
  const major = index % 5 === 0;
  const [x1, y1] = pointOnArc(degrees, 124);
  const [x2, y2] = pointOnArc(degrees, major ? 110 : 117);
  return { x1, y1, x2, y2, major, key: index };
});

const NEEDLE_ANGLES = [-90, 80, -62];

function Gauge({ step, reduced }) {
  const safeStep = Math.min(step, 2);
  const settled = step >= 2;
  const transition =
    reduced || step === 0
      ? "none"
      : step === 1
        ? "transform 900ms cubic-bezier(.3,.7,.3,1)"
        : "transform 1100ms cubic-bezier(.34,1.4,.64,1)";

  return (
    <div className="mx-auto w-full max-w-[360px]">
      <svg
        viewBox="0 0 400 270"
        className="w-full"
        role="img"
        aria-label="Calibration status gauge"
      >
        <path
          d={arcPath(-90, 90, 158)}
          fill="none"
          stroke="#fff"
          strokeOpacity="0.18"
          strokeWidth="1"
        />

        {ZONES.map((zone, index) => (
          <path
            key={zone.label}
            d={arcPath(-90 + index * 45 + 1.5, -45 + index * 45 - 1.5, 140)}
            fill="none"
            stroke={zone.hex}
            strokeWidth="14"
            style={{
              opacity: settled && index > 0 ? 0.42 : 1,
              transition: reduced ? "none" : "opacity 600ms ease-out",
            }}
          />
        ))}

        {TICKS.map((tick) => (
          <line
            key={tick.key}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke="#fff"
            strokeOpacity={tick.major ? 0.8 : 0.38}
            strokeWidth={tick.major ? 1.5 : 1}
          />
        ))}

        <g
          style={{
            transformOrigin: `${CX}px ${CY}px`,
            transformBox: "view-box",
            transform: `rotate(${NEEDLE_ANGLES[safeStep]}deg)`,
            transition,
          }}
        >
          <path
            d={`M${CX - 3} ${CY} L${CX} ${CY - 112} L${CX + 3} ${CY} Z`}
            fill="#fff"
          />
        </g>

        <circle cx={CX} cy={CY} r="10" fill="#fff" />
        <circle cx={CX} cy={CY} r="4" fill="#172554" />
        <text
          x={CX}
          y="252"
          textAnchor="middle"
          fill="#fff"
          fontSize="15"
          fontWeight="500"
          style={{
            opacity: step >= 3 ? 1 : 0,
            transition: reduced ? "none" : "opacity 500ms ease-out",
          }}
        >
          Done verification
        </text>
      </svg>
    </div>
  );
}

export default function Landing() {
  const [idNumber, setIdNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);

  const reduced = usePrefersReducedMotion();

  const seenIntro = (() => {
    try {
      return sessionStorage.getItem("cal_intro_seen") === "1";
    } catch {
      return false;
    }
  })();

  const [step, setStep] = useState(reduced || seenIntro ? 3 : 0);
  const returnTo = safeReturnTo();

  useEffect(() => {
    if (reduced || seenIntro) {
      setStep(3);
      return undefined;
    }

    try {
      sessionStorage.setItem("cal_intro_seen", "1");
    } catch {
      // Continue without session storage.
    }

    const timers = [
      setTimeout(() => setStep(1), 300),
      setTimeout(() => setStep(2), 900),
      setTimeout(() => setStep(3), 1700),
    ];

    return () => timers.forEach(clearTimeout);
  }, [reduced]);

  useEffect(() => {
    let active = true;

    apiClient.auth
      .status()
      .then((status) => {
        if (active) setSetupRequired(status.setup_required);
      })
      .catch((statusError) => {
        console.error("Could not check administrator setup:", statusError);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
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

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="grid min-h-screen lg:grid-cols-[minmax(0,1.25fr)_minmax(400px,0.75fr)]">
        {/* Left: industrial introduction */}
        <div className="relative flex min-h-[650px] flex-col overflow-hidden bg-[#142b54] px-7 py-8 text-white sm:px-10 lg:min-h-screen lg:px-12 lg:py-10 xl:px-16">
          <img
            src={factoryImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-[#10264d]/85" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#10264d]/35 to-[#10264d]/10" />

          <header className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-white/25 bg-white/10">
              <ShieldCheck className="h-5 w-5 text-blue-100" />
            </div>
            <div>
              <p className="text-base font-semibold tracking-tight">
                QA Nikkoshi System
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-blue-100/70">
                Calibration management
              </p>
            </div>
          </header>

          <div className="relative my-auto grid items-center gap-8 py-14 xl:grid-cols-[minmax(0,1fr)_minmax(270px,0.8fr)] xl:gap-5">
            <div className="max-w-[560px]">
              <p className="text-xs font-semibold uppercase tracking-[0.17em] text-blue-200">
                Quality assurance
              </p>

              <h1 className="mt-5 max-w-[560px] text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl xl:text-[3.35rem]">
                Know which equipment is due before it expires.
              </h1>

              <p className="mt-5 max-w-lg text-base leading-7 text-blue-50/80 sm:text-lg">
                Calibration and verification status for every instrument,
                across every department.
              </p>

              <div className="mt-9 border-t border-white/25 pt-5">
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-blue-100/75">
                  Calibration status guide
                </p>

                <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                  {ZONES.map((zone, index) => {
                    const StatusIcon = [
                      CheckCircle2,
                      CalendarClock,
                      AlertTriangle,
                      FileWarning,
                    ][index];

                    return (
                      <div key={zone.label} className="flex items-start gap-2.5">
                        <span
                          className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: zone.hex }}
                        />
                        <div>
                          <p className="text-sm font-medium text-white">
                            {zone.label}
                          </p>
                          <p className="mt-0.5 text-xs text-blue-100/65">
                            {zone.note}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="w-full self-center xl:pt-8">
              <Gauge step={step} reduced={reduced} />
            </div>
          </div>

          <footer className="relative border-t border-white/20 pt-4 text-xs text-blue-100/70">
            Need an account? Contact your administrator.
          </footer>
        </div>

        {/* Right: compact login area, vertically centered in the viewport */}
        <div className="flex min-h-[650px] items-center justify-center bg-[#f7f8fa] px-5 py-8 sm:px-9 lg:min-h-screen lg:px-10 lg:py-6">
          <div className="w-full max-w-[390px]">
            <div className="mx-auto mb-3 max-w-[245px]">
              <BenchScene className="w-full" forceMotion />
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-6 py-6 shadow-[0_8px_28px_rgba(15,23,42,0.06)] sm:px-8 sm:py-7">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                  Log in
                </h2>
                <p className="mt-1.5 text-sm leading-5 text-slate-500">
                  Use your ID number and password.
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              {setupRequired && (
                <div
                  role="note"
                  className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
                >
                  <p className="font-semibold">Administrator setup required.</p>
                  <p className="mt-1 leading-5">
                    On the API host, run{" "}
                    <code className="text-xs">
                      node server/reset-admin.mjs &lt;id_number&gt;
                    </code>{" "}
                    in a terminal.
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="idNumber"
                    className="text-sm font-medium text-slate-700"
                  >
                    ID number
                  </Label>
                  <div className="relative">
                    <User
                      className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <Input
                      id="idNumber"
                      type="text"
                      autoComplete="username"
                      autoFocus
                      placeholder="Enter your ID number"
                      value={idNumber}
                      onChange={(event) => setIdNumber(event.target.value)}
                      className="h-11 rounded-md border-slate-300 bg-white pl-9 text-sm focus-visible:ring-2 focus-visible:ring-blue-600/20"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <Label
                      htmlFor="password"
                      className="text-sm font-medium text-slate-700"
                    >
                      Password
                    </Label>
                    <Link
                      to="/forgot-password"
                      className="text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <div className="relative">
                    <Lock
                      className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-11 rounded-md border-slate-300 bg-white pl-9 pr-11 text-sm focus-visible:ring-2 focus-visible:ring-blue-600/20"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="h-11 w-full rounded-md bg-blue-700 text-sm font-semibold hover:bg-blue-800"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    "Log in"
                  )}
                </Button>
              </form>

              <div className="mt-5 flex items-center justify-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Secure employee access
              </div>
            </div>

            <p className="mt-4 text-center text-xs text-slate-400">
              QA/QC Nikkoshi System
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white px-6 py-16 sm:px-10 lg:px-14">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-700">
              System capabilities
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Built for the calibration team's daily work
            </h2>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <article
                key={title}
                className="border-t border-slate-300 pt-5"
              >
                <Icon className="h-6 w-6 text-blue-700" aria-hidden="true" />
                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-[#f7f8fa] px-6 py-5 text-xs text-slate-500 sm:px-10 lg:px-14">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-medium text-slate-700">QA Nikkoshi System</span>
          <span>Calibration and verification management</span>
        </div>
      </footer>
    </main>
  );
}
