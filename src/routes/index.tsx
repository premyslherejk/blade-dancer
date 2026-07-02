import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  component: MenuPage,
});

function MenuPage() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Generate particles once
  const [particles] = useState(() =>
    Array.from({ length: 28 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: 1 + Math.random() * 3,
      delay: Math.random() * 6,
      duration: 6 + Math.random() * 8,
      hue: Math.random() > 0.5 ? "var(--gold)" : "var(--blade)",
    }))
  );
  const [embers] = useState(() =>
    Array.from({ length: 14 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 5,
      duration: 5 + Math.random() * 5,
    }))
  );

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden flex items-center justify-center">
      {/* Portrait viewport frame — mobile 9:16 focus */}
      <div className="relative w-full max-w-[440px] h-full mx-auto">
        {/* Deep sky gradient background */}
        <div className="absolute inset-0" style={{ background: "var(--gradient-sky)" }} />

        {/* Distant mountains silhouette */}
        <svg className="absolute bottom-0 left-0 w-full opacity-70" viewBox="0 0 440 300" preserveAspectRatio="none" style={{ height: "45%" }}>
          <defs>
            <linearGradient id="mt1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.22 0.05 275)" />
              <stop offset="100%" stopColor="oklch(0.1 0.02 265)" />
            </linearGradient>
            <linearGradient id="mt2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.16 0.04 270)" />
              <stop offset="100%" stopColor="oklch(0.08 0.02 265)" />
            </linearGradient>
          </defs>
          <path d="M0,180 L60,90 L120,150 L180,60 L240,140 L300,80 L360,160 L440,100 L440,300 L0,300 Z" fill="url(#mt1)" />
          <path d="M0,220 L50,170 L110,210 L170,140 L230,200 L290,160 L350,220 L440,170 L440,300 L0,300 Z" fill="url(#mt2)" />
        </svg>

        {/* Moon / sun disc */}
        <div
          className="absolute rounded-full"
          style={{
            top: "12%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 180,
            height: 180,
            background: "radial-gradient(circle at 50% 50%, oklch(0.9 0.14 70 / 0.35), oklch(0.7 0.2 45 / 0.15) 40%, transparent 70%)",
            filter: "blur(2px)",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            top: "16%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 90,
            height: 90,
            background: "radial-gradient(circle at 40% 40%, oklch(0.95 0.1 80), oklch(0.75 0.18 55) 70%)",
            boxShadow: "0 0 60px oklch(0.8 0.18 55 / 0.7), 0 0 120px oklch(0.7 0.2 45 / 0.4)",
          }}
        />

        {/* Rune ring behind logo */}
        <div
          className="absolute rounded-full border"
          style={{
            top: "10%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 260,
            height: 260,
            borderColor: "oklch(0.75 0.18 55 / 0.25)",
            animation: "rune-spin 40s linear infinite",
          }}
        />
        <div
          className="absolute rounded-full border"
          style={{
            top: "13%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 200,
            height: 200,
            borderColor: "oklch(0.88 0.12 210 / 0.2)",
            borderStyle: "dashed",
            animation: "rune-spin 60s linear infinite reverse",
          }}
        />

        {/* Soft particles */}
        <div className="particle-field">
          {particles.map((p) => (
            <div
              key={p.id}
              className="absolute rounded-full"
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
                width: p.size,
                height: p.size,
                background: p.hue,
                boxShadow: `0 0 ${p.size * 4}px ${p.hue}`,
                animation: `float-slow ${p.duration}s ease-in-out ${p.delay}s infinite`,
                opacity: 0.6,
              }}
            />
          ))}
        </div>

        {/* Rising embers */}
        <div className="particle-field">
          {embers.map((e) => (
            <div
              key={e.id}
              className="absolute rounded-full"
              style={{
                left: `${e.left}%`,
                bottom: "-10px",
                width: 3,
                height: 3,
                background: "var(--ember)",
                boxShadow: "0 0 8px var(--ember)",
                animation: `float-slow ${e.duration}s ease-in ${e.delay}s infinite`,
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col items-center justify-between py-16 px-8">
          {/* Top: subtitle */}
          <div className="text-center mt-4" style={{ animation: "logo-in 1s ease-out both" }}>
            <div
              className="text-[0.7rem] tracking-[0.5em] uppercase mb-1"
              style={{ color: "var(--muted-foreground)" }}
            >
              Season I
            </div>
          </div>

          {/* Logo */}
          <div
            className="text-center flex flex-col items-center mt-8"
            style={{ animation: "logo-in 1.2s ease-out 0.2s both" }}
          >
            {/* Crossed blade emblem */}
            <div className="relative mb-6" style={{ width: 120, height: 120 }}>
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, oklch(0.75 0.18 55 / 0.35), transparent 70%)",
                  filter: "blur(6px)",
                }}
              />
              <svg viewBox="0 0 120 120" className="relative">
                <defs>
                  <linearGradient id="blade-g" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="oklch(0.95 0.05 210)" />
                    <stop offset="100%" stopColor="oklch(0.65 0.1 220)" />
                  </linearGradient>
                  <linearGradient id="hilt-g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.85 0.15 80)" />
                    <stop offset="100%" stopColor="oklch(0.5 0.15 50)" />
                  </linearGradient>
                </defs>
                {/* blade 1 */}
                <g transform="rotate(45 60 60)">
                  <rect x="57" y="15" width="6" height="70" fill="url(#blade-g)" />
                  <polygon points="60,10 57,20 63,20" fill="oklch(0.98 0.03 210)" />
                  <rect x="48" y="82" width="24" height="4" rx="1" fill="url(#hilt-g)" />
                  <rect x="57" y="86" width="6" height="18" fill="oklch(0.35 0.08 40)" />
                  <circle cx="60" cy="107" r="4" fill="url(#hilt-g)" />
                </g>
                {/* blade 2 */}
                <g transform="rotate(-45 60 60)">
                  <rect x="57" y="15" width="6" height="70" fill="url(#blade-g)" opacity="0.9" />
                  <polygon points="60,10 57,20 63,20" fill="oklch(0.98 0.03 210)" />
                  <rect x="48" y="82" width="24" height="4" rx="1" fill="url(#hilt-g)" />
                  <rect x="57" y="86" width="6" height="18" fill="oklch(0.35 0.08 40)" />
                  <circle cx="60" cy="107" r="4" fill="url(#hilt-g)" />
                </g>
              </svg>
            </div>

            <h1
              className="text-6xl font-extrabold leading-none"
              style={{
                background:
                  "linear-gradient(180deg, oklch(0.98 0.02 250) 0%, oklch(0.82 0.16 85) 55%, oklch(0.55 0.18 40) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                textShadow: "0 0 30px oklch(0.75 0.18 55 / 0.3)",
              }}
            >
              BLADESTEP
            </h1>
            <div
              className="mt-3 text-xs tracking-[0.6em] uppercase"
              style={{ color: "var(--blade)" }}
            >
              One Dash. One Blade.
            </div>
          </div>

          {/* Buttons */}
          <div
            className="w-full flex flex-col items-center gap-4 mb-4"
            style={{ animation: "logo-in 1s ease-out 0.6s both" }}
          >
            <Link
              to="/play"
              className="btn-premium btn-premium-hover w-64 text-center"
            >
              <PlayIcon /> Play
            </Link>
            <button
              onClick={() => setSettingsOpen(true)}
              className="btn-ghost-premium w-64"
            >
              <GearIcon /> Settings
            </button>
            <div
              className="text-[0.65rem] tracking-[0.4em] uppercase mt-3"
              style={{ color: "var(--muted-foreground)" }}
            >
              Prototype Build v0.1
            </div>
          </div>
        </div>

        {/* Settings modal */}
        {settingsOpen && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center p-6"
            style={{ background: "oklch(0 0 0 / 0.6)", backdropFilter: "blur(8px)" }}
            onClick={() => setSettingsOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl p-6 border"
              style={{
                background: "oklch(0.19 0.035 265 / 0.95)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-deep)",
                animation: "logo-in 0.3s ease-out",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl mb-6" style={{ color: "var(--primary)" }}>
                Settings
              </h2>
              <SettingRow label="Music" defaultValue={70} />
              <SettingRow label="Sound FX" defaultValue={85} />
              <SettingRow label="Screen Shake" defaultValue={60} />
              <SettingRow label="Haptics" toggle />
              <button
                onClick={() => setSettingsOpen(false)}
                className="btn-ghost-premium w-full mt-4"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingRow({
  label,
  defaultValue = 50,
  toggle,
}: {
  label: string;
  defaultValue?: number;
  toggle?: boolean;
}) {
  const [val, setVal] = useState(defaultValue);
  const [on, setOn] = useState(true);
  return (
    <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: "var(--border)" }}>
      <span className="text-sm tracking-widest uppercase" style={{ color: "var(--muted-foreground)" }}>
        {label}
      </span>
      {toggle ? (
        <button
          onClick={() => setOn(!on)}
          className="relative w-12 h-6 rounded-full transition-colors"
          style={{ background: on ? "var(--primary)" : "var(--muted)" }}
        >
          <span
            className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
            style={{ transform: on ? "translateX(26px)" : "translateX(2px)" }}
          />
        </button>
      ) : (
        <div className="flex items-center gap-3 w-40">
          <input
            type="range"
            min={0}
            max={100}
            value={val}
            onChange={(e) => setVal(+e.target.value)}
            className="flex-1 accent-[var(--primary)]"
          />
          <span className="text-xs w-8 text-right" style={{ color: "var(--foreground)" }}>{val}</span>
        </div>
      )}
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M2 1.5 L12 7 L2 12.5 Z" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>
    </svg>
  );
}
