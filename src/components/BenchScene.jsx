import React, { useEffect, useRef } from "react";

// Animation is driven from JavaScript (SVG transform attributes), not CSS keyframes,
// so it does not depend on CSS support for transform-box / transform-origin.
// By default it always animates. Pass respectReducedMotion to hold a still pose
// when the OS asks for reduced motion.

const CYCLE = 9000; // ms for one lean-in cycle
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const seg = (f, a, b) => ease(Math.min(Math.max((f - a) / (b - a), 0), 1)); // eased 0..1 between a and b

// 0 = upright, 1 = leaning into the eyepiece
const leanAt = (f) => {
  if (f < 0.12) return 0;
  if (f < 0.38) return seg(f, 0.12, 0.38);
  if (f < 0.68) return 1;
  if (f < 0.94) return 1 - seg(f, 0.68, 0.94);
  return 0;
};
// focus knob turns while the hand is on it
const knobAt = (f) => {
  if (f < 0.4) return 0;
  if (f < 0.52) return 70 * seg(f, 0.4, 0.52);
  if (f < 0.62) return 70 - 90 * seg(f, 0.52, 0.62);
  if (f < 0.7) return -20 + 20 * seg(f, 0.62, 0.7);
  return 0;
};

const SKIN = "#f2c29b";
const CALIPER_TICKS = Array.from({ length: 18 }, (_, i) => ({ x: 40 + i * 6, major: i % 5 === 0 }));
const DIAL_TICKS = Array.from({ length: 12 }, (_, k) => {
  const a = (k * 30 * Math.PI) / 180;
  return { x1: 610 + 17 * Math.sin(a), y1: 276 - 17 * Math.cos(a), x2: 610 + 14.5 * Math.sin(a), y2: 276 - 14.5 * Math.cos(a), k };
});

export default function BenchScene({ className = "", respectReducedMotion = false }) {
  const leanBody = useRef(null);
  const leanArm = useRef(null);
  const knob = useRef(null);
  const slide = useRef(null);
  const dial = useRef(null);

  useEffect(() => {
    const draw = (ms) => {
      const p = leanAt((ms % CYCLE) / CYCLE);
      const lean = `translate(${(64 * p).toFixed(2)} 0) rotate(${(10 * p).toFixed(2)} 300 330)`;
      leanBody.current?.setAttribute("transform", lean);
      leanArm.current?.setAttribute("transform", lean);
      knob.current?.setAttribute("transform", `rotate(${knobAt((ms % CYCLE) / CYCLE).toFixed(2)} 510 285)`);
      const s = (ms % 10000) / 10000;
      slide.current?.setAttribute("transform", `translate(${(38 * ease(s < 0.5 ? s * 2 : 2 - s * 2)).toFixed(2)} 0)`);
      const d = -30 + 55 * ((1 - Math.cos((2 * Math.PI * ms) / 4000)) / 2);
      dial.current?.setAttribute("transform", `rotate(${d.toFixed(2)} 610 276)`);
    };

    const hold = respectReducedMotion && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (hold) {
      draw(CYCLE * 0.4); // still pose: looking into the microscope
      return undefined;
    }
    let raf;
    const start = performance.now();
    const loop = (now) => {
      draw(now - start);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [respectReducedMotion]);

  return (
    <svg
      viewBox="0 0 680 380"
      className={`h-auto w-full ${className}`}
      role="img"
      aria-label="A technician leans in to look through a microscope, beside a caliper, gauge blocks and a dial indicator"
    >
      {/* Technician: body and head lean toward the eyepiece */}
      <g ref={leanBody}>
        <path d="M236 352 L242 252 Q290 232 338 252 L344 352 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
        <path d="M272 246 L290 272 L308 246" fill="none" stroke="#cbd5e1" strokeWidth="2" />
        <rect x="282" y="222" width="16" height="26" rx="6" fill={SKIN} />
        <circle cx="292" cy="200" r="26" fill={SKIN} />
        <path d="M266 198 A26 26 0 0 1 318 198 Q292 186 266 198 Z" fill="#bfdbfe" />
        <circle cx="282" cy="205" r="5" fill="#e0a97c" />
        <circle cx="309" cy="199" r="2.5" fill="#172554" />
        <path d="M318 203 L324 208 L318 210" fill="none" stroke="#e0a97c" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* Bench */}
      <rect x="0" y="330" width="680" height="12" fill="#94a3b8" />
      <rect x="0" y="342" width="680" height="38" fill="#e2e8f0" />

      {/* Microscope */}
      <rect x="420" y="312" width="120" height="18" rx="4" fill="#334155" />
      <circle cx="436" cy="321" r="3" fill="#10b981" />
      <path d="M510 312 L510 250 Q510 228 470 228" fill="none" stroke="#475569" strokeWidth="20" strokeLinecap="round" />
      <line x1="470" y1="228" x2="432" y2="214" stroke="#334155" strokeWidth="20" strokeLinecap="round" />
      <line x1="432" y1="214" x2="414" y2="207" stroke="#1e293b" strokeWidth="13" strokeLinecap="round" />
      <line x1="446" y1="226" x2="446" y2="248" stroke="#1e293b" strokeWidth="8" strokeLinecap="round" />
      <rect x="418" y="262" width="82" height="6" rx="2" fill="#94a3b8" />
      <rect x="438" y="252" width="26" height="10" rx="2" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />
      <g ref={knob}>
        <circle cx="510" cy="285" r="13" fill="#1d4ed8" stroke="#172554" strokeWidth="2" />
        <line x1="510" y1="285" x2="510" y2="275" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* Arm and hand, in front of the microscope so the hand reaches the focus knob */}
      <g ref={leanArm}>
        <path d="M326 262 Q348 316 428 286" fill="none" stroke="#cbd5e1" strokeWidth="22" strokeLinecap="round" />
        <path d="M326 262 Q348 316 428 286" fill="none" stroke="#f8fafc" strokeWidth="18" strokeLinecap="round" />
        <circle cx="430" cy="286" r="9" fill={SKIN} />
      </g>

      {/* Digital caliper: the jaw slides open and closed */}
      <rect x="24" y="318" width="132" height="12" rx="2" fill="#e2e8f0" stroke="#64748b" strokeWidth="1.5" />
      {CALIPER_TICKS.map((t) => (
        <line key={t.x} x1={t.x} y1="318" x2={t.x} y2={t.major ? 326 : 323} stroke="#64748b" strokeWidth="1" />
      ))}
      <rect x="24" y="298" width="8" height="32" rx="1.5" fill="#94a3b8" />
      <g ref={slide}>
        <rect x="70" y="298" width="8" height="32" rx="1.5" fill="#64748b" />
        <rect x="70" y="296" width="36" height="20" rx="3" fill="#1d4ed8" />
        <rect x="75" y="300" width="22" height="9" rx="1.5" fill="#d1fae5" />
      </g>

      {/* Gauge blocks */}
      <rect x="172" y="318" width="40" height="12" fill="#cbd5e1" stroke="#94a3b8" />
      <rect x="175" y="306" width="34" height="12" fill="#e2e8f0" stroke="#94a3b8" />
      <rect x="178" y="296" width="28" height="10" fill="#cbd5e1" stroke="#94a3b8" />

      {/* Dial indicator on a stand */}
      <rect x="586" y="322" width="48" height="8" rx="2" fill="#475569" />
      <rect x="606" y="292" width="8" height="30" fill="#64748b" />
      <circle cx="610" cy="276" r="20" fill="#f8fafc" stroke="#475569" strokeWidth="3" />
      {DIAL_TICKS.map((t) => (
        <line key={t.k} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="#64748b" strokeWidth="1" />
      ))}
      <g ref={dial}>
        <line x1="610" y1="276" x2="610" y2="263" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
      </g>
      <circle cx="610" cy="276" r="2.5" fill="#172554" />
    </svg>
  );
}