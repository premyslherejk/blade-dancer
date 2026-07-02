import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/play")({
  component: PlayPage,
});

/* ---------- Types ---------- */
type Vec = { x: number; y: number };
type EnemyType = "grunt" | "brute" | "archer" | "shielder" | "bomber" | "boss";
type Enemy = {
  id: number;
  pos: Vec;
  vel: Vec;
  hp: number;
  maxHp: number;
  alive: boolean;
  hitFlash: number;
  type: EnemyType;
  facing: number;
  shootCd: number;
  fuse: number; // bomber: >0 means armed, counts down to 0 then explodes
  // boss-only
  slamCd: number;
  slamCharge: number; // ms remaining on telegraph
  slamPos: Vec;
  volleyCd: number;
  phase: number; // enrage phase (0 or 1)
};
type Wall = { x: number; y: number; w: number; h: number };
type Barrel = { pos: Vec; alive: boolean; radius: number };
type Spike = { pos: Vec; radius: number; phase: number };
type Slash = { a: Vec; b: Vec; life: number; max: number };
type TrailDot = { pos: Vec; life: number };
type Particle = { pos: Vec; vel: Vec; life: number; max: number; color: string; size: number };
type Explosion = { pos: Vec; life: number; max: number; radius: number };
type Projectile = { pos: Vec; vel: Vec; life: number; radius: number };

/* ---------- Constants ---------- */
const ARENA_W = 440;
const ARENA_H = 780;
const PLAYER_R = 16;
const DASH_SPEED = 1400;
const DASH_MAX_LEN = 280;
const SLOWMO_FACTOR = 0.08;
const NORMAL_TIME_AFTER_DASH_MS = 220;

/* ---------- Levels ---------- */
type LevelDef = {
  name: string;
  subtitle: string;
  playerStart: Vec;
  walls: Wall[];
  enemies: Array<{ x: number; y: number; type: EnemyType }>;
  barrels: Vec[];
  spikes: Vec[];
  intro?: string;
};

const OUTER: Wall[] = [
  { x: 0, y: 0, w: ARENA_W, h: 20 },
  { x: 0, y: ARENA_H - 20, w: ARENA_W, h: 20 },
  { x: 0, y: 0, w: 20, h: ARENA_H },
  { x: ARENA_W - 20, y: 0, w: 20, h: ARENA_H },
];

const LEVELS: LevelDef[] = [
  {
    name: "I · Awakening",
    subtitle: "Trial of the Blade",
    playerStart: { x: ARENA_W / 2, y: ARENA_H - 120 },
    walls: [
      ...OUTER,
      { x: 80, y: 260, w: 90, h: 22 },
      { x: 270, y: 260, w: 90, h: 22 },
      { x: 180, y: 460, w: 80, h: 22 },
      { x: 60, y: 580, w: 22, h: 90 },
      { x: 358, y: 580, w: 22, h: 90 },
    ],
    enemies: [
      { x: 120, y: 180, type: "grunt" },
      { x: 320, y: 180, type: "grunt" },
      { x: 100, y: 400, type: "grunt" },
      { x: 340, y: 400, type: "grunt" },
      { x: 220, y: 340, type: "brute" },
      { x: 220, y: 540, type: "grunt" },
      { x: 220, y: 660, type: "brute" },
    ],
    barrels: [{ x: 220, y: 240 }],
    spikes: [{ x: 220, y: 620 }],
  },
  {
    name: "II · The Watchers",
    subtitle: "Beware the arrows",
    intro: "Archers shoot glowing arrows from afar. Dash to close the distance.",
    playerStart: { x: ARENA_W / 2, y: ARENA_H - 100 },
    walls: [
      ...OUTER,
      { x: 20, y: 200, w: 130, h: 22 },
      { x: 290, y: 200, w: 130, h: 22 },
      { x: 160, y: 380, w: 120, h: 22 },
      { x: 20, y: 520, w: 90, h: 22 },
      { x: 330, y: 520, w: 90, h: 22 },
    ],
    enemies: [
      { x: 70, y: 110, type: "archer" },
      { x: 370, y: 110, type: "archer" },
      { x: 220, y: 130, type: "grunt" },
      { x: 100, y: 310, type: "bomber" },
      { x: 340, y: 310, type: "bomber" },
      { x: 220, y: 460, type: "brute" },
      { x: 130, y: 620, type: "grunt" },
      { x: 310, y: 620, type: "grunt" },
    ],
    barrels: [{ x: 220, y: 260 }, { x: 220, y: 560 }],
    spikes: [{ x: 90, y: 460 }, { x: 350, y: 460 }],
  },
  {
    name: "III · Iron Wall",
    subtitle: "Shields cannot be broken from the front",
    intro: "Shielders block frontal dashes. Strike from behind to shatter them.",
    playerStart: { x: ARENA_W / 2, y: ARENA_H - 90 },
    walls: [
      ...OUTER,
      { x: 90, y: 170, w: 22, h: 110 },
      { x: 328, y: 170, w: 22, h: 110 },
      { x: 180, y: 320, w: 80, h: 22 },
      { x: 60, y: 470, w: 140, h: 22 },
      { x: 240, y: 470, w: 140, h: 22 },
    ],
    enemies: [
      { x: 220, y: 110, type: "archer" },
      { x: 140, y: 240, type: "shielder" },
      { x: 300, y: 240, type: "shielder" },
      { x: 220, y: 400, type: "bomber" },
      { x: 100, y: 560, type: "shielder" },
      { x: 340, y: 560, type: "shielder" },
      { x: 220, y: 620, type: "brute" },
      { x: 220, y: 700, type: "grunt" },
    ],
    barrels: [{ x: 220, y: 200 }, { x: 100, y: 400 }, { x: 340, y: 400 }],
    spikes: [{ x: 220, y: 520 }],
  },
];


const LEVEL_IV: LevelDef = {
  name: "IV · The Gauntlet",
  subtitle: "Everything they can throw at you",
  intro: "A mix of foes. Chain dashes — use barrels to clear crowds.",
  playerStart: { x: ARENA_W / 2, y: ARENA_H - 90 },
  walls: [
    ...OUTER,
    { x: 60, y: 150, w: 22, h: 130 },
    { x: 358, y: 150, w: 22, h: 130 },
    { x: 120, y: 360, w: 200, h: 22 },
    { x: 60, y: 520, w: 22, h: 130 },
    { x: 358, y: 520, w: 22, h: 130 },
  ],
  enemies: [
    { x: 130, y: 110, type: "archer" },
    { x: 310, y: 110, type: "archer" },
    { x: 220, y: 200, type: "shielder" },
    { x: 110, y: 300, type: "bomber" },
    { x: 330, y: 300, type: "bomber" },
    { x: 220, y: 440, type: "brute" },
    { x: 110, y: 600, type: "grunt" },
    { x: 330, y: 600, type: "grunt" },
    { x: 220, y: 680, type: "brute" },
  ],
  barrels: [{ x: 220, y: 140 }, { x: 220, y: 320 }, { x: 220, y: 560 }],
  spikes: [{ x: 110, y: 440 }, { x: 330, y: 440 }],
};

const LEVEL_V: LevelDef = {
  name: "V · Crossfire",
  subtitle: "No safe corner remains",
  intro: "Archers hold every corner. Break the line before their volleys land.",
  playerStart: { x: ARENA_W / 2, y: ARENA_H - 80 },
  walls: [
    ...OUTER,
    { x: 160, y: 180, w: 120, h: 22 },
    { x: 20, y: 320, w: 100, h: 22 },
    { x: 320, y: 320, w: 100, h: 22 },
    { x: 160, y: 460, w: 120, h: 22 },
    { x: 20, y: 600, w: 100, h: 22 },
    { x: 320, y: 600, w: 100, h: 22 },
  ],
  enemies: [
    { x: 60, y: 90, type: "archer" },
    { x: 380, y: 90, type: "archer" },
    { x: 220, y: 130, type: "shielder" },
    { x: 60, y: 260, type: "archer" },
    { x: 380, y: 260, type: "archer" },
    { x: 220, y: 400, type: "bomber" },
    { x: 220, y: 540, type: "shielder" },
    { x: 60, y: 680, type: "brute" },
    { x: 380, y: 680, type: "brute" },
    { x: 220, y: 700, type: "grunt" },
  ],
  barrels: [{ x: 220, y: 260 }, { x: 220, y: 620 }],
  spikes: [{ x: 220, y: 340 }, { x: 220, y: 480 }],
};

const LEVEL_BOSS: LevelDef = {
  name: "VI · The Warlord",
  subtitle: "Boss — Iron Warlord of the Ash",
  intro: "The Warlord slams the ground and fires radial arcs. Dash between telegraphs and strike his back. He enrages below half HP.",
  playerStart: { x: ARENA_W / 2, y: ARENA_H - 80 },
  walls: [
    ...OUTER,
    { x: 30, y: 260, w: 80, h: 22 },
    { x: 330, y: 260, w: 80, h: 22 },
    { x: 30, y: 500, w: 80, h: 22 },
    { x: 330, y: 500, w: 80, h: 22 },
  ],
  enemies: [
    { x: ARENA_W / 2, y: 200, type: "boss" },
    { x: 90, y: 640, type: "grunt" },
    { x: 350, y: 640, type: "grunt" },
    { x: 220, y: 620, type: "bomber" },
  ],
  barrels: [{ x: 80, y: 400 }, { x: 360, y: 400 }],
  spikes: [{ x: 220, y: 400 }],
};

LEVELS.push(LEVEL_IV, LEVEL_V, LEVEL_BOSS);



function PlayPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const [hp, setHp] = useState(3);
  const [gold, setGold] = useState(0);
  const [paused, setPaused] = useState(false);
  const [victory, setVictory] = useState(false);
  const [defeat, setDefeat] = useState(false);
  const [levelIdx, setLevelIdx] = useState(0);
  const [showTutorial, setShowTutorial] = useState(true);
  const [carryGold, setCarryGold] = useState(0);
  const [carryHp, setCarryHp] = useState(3);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  // Init game — rebuilds when level changes
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const state: GameState = createLevelState(levelIdx, carryHp, carryGold);
    stateRef.current = state;

    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dtMs = Math.min(50, t - last);
      last = t;
      const frozen = paused || victory || defeat || showTutorial;
      if (!frozen) {
        step(state, dtMs);
        setHp(state.player.hp);
        setGold(state.gold);
        if (state.player.hp <= 0 && !state.defeat) {
          state.defeat = true;
          setDefeat(true);
        }
        if (state.enemies.every((e) => !e.alive) && !state.victory) {
          state.victory = true;
          setVictory(true);
        }
      }
      render(ctx, state, canvas.getBoundingClientRect());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    /* ---------- Input ---------- */
    const getPos = (e: PointerEvent): Vec => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = ARENA_W / rect.width;
      const scaleY = ARENA_H / rect.height;
      return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    };
    const down = (e: PointerEvent) => {
      if (paused || victory || defeat || showTutorial) return;
      if (state.player.dashing) return;
      state.aiming = true;
      state.aimStart = getPos(e);
      state.aimCurrent = state.aimStart;
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!state.aiming) return;
      state.aimCurrent = getPos(e);
    };
    const up = () => {
      if (!state.aiming) return;
      state.aiming = false;
      const p = state.player.pos;
      const dir = { x: state.aimCurrent.x - state.aimStart.x, y: state.aimCurrent.y - state.aimStart.y };
      const len = Math.hypot(dir.x, dir.y);
      if (len < 12) return;
      const nx = dir.x / len;
      const ny = dir.y / len;
      const dashLen = Math.min(DASH_MAX_LEN, len * 1.4);
      state.player.dashDir = { x: nx, y: ny };
      state.player.dashTarget = { x: p.x + nx * dashLen, y: p.y + ny * dashLen };
      state.player.dashing = true;
      state.player.dashProgress = 0;
      state.player.dashLen = dashLen;
      state.slowRealMs = NORMAL_TIME_AFTER_DASH_MS;
      state.shake = 6;
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
    };
  }, [paused, victory, defeat, levelIdx, showTutorial, carryHp, carryGold]);

  const restartLevel = () => {
    setDefeat(false);
    setVictory(false);
    setPaused(false);
    // rebuild via effect dependency change
    setCarryHp(3);
    setCarryGold(gold);
  };

  const nextLevel = () => {
    const hasNext = levelIdx < LEVELS.length - 1;
    if (!hasNext) {
      // full clear — reset to level 0
      setCarryHp(3);
      setCarryGold(0);
      setLevelIdx(0);
      setVictory(false);
      setDefeat(false);
      setPaused(false);
      setShowTutorial(true);
      return;
    }
    setCarryHp(Math.max(1, hp));
    setCarryGold(gold);
    setLevelIdx(levelIdx + 1);
    setVictory(false);
    setDefeat(false);
    setPaused(false);
  };

  const current = LEVELS[levelIdx];
  const isFinal = levelIdx === LEVELS.length - 1;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden flex items-center justify-center bg-black">
      <div
        className="relative w-full h-full max-w-[440px] mx-auto"
        style={{ background: "var(--gradient-sky)" }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none"
          style={{ display: "block" }}
        />

        {/* HUD */}
        <div className="absolute top-0 left-0 right-0 z-10 px-4 pt-4 flex items-start justify-between pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border"
              style={{ background: "oklch(0.15 0.03 265 / 0.75)", borderColor: "var(--border)", backdropFilter: "blur(8px)" }}
            >
              {Array.from({ length: 3 }).map((_, i) => (
                <HeartIcon key={i} filled={i < hp} />
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center gap-1 pointer-events-none">
            <div
              className="px-3 py-1 rounded-full border text-[0.6rem] tracking-[0.35em] uppercase"
              style={{ background: "oklch(0.15 0.03 265 / 0.75)", borderColor: "var(--border)", backdropFilter: "blur(8px)", color: "var(--muted-foreground)" }}
            >
              Level {levelIdx + 1} / {LEVELS.length}
            </div>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border"
              style={{ background: "oklch(0.15 0.03 265 / 0.75)", borderColor: "var(--border)", backdropFilter: "blur(8px)" }}
            >
              <div className="w-4 h-4 rounded-full" style={{ background: "var(--gradient-gold)", boxShadow: "0 0 10px var(--gold)" }} />
              <span className="font-display text-sm tracking-widest" style={{ color: "var(--gold)" }}>
                {String(gold).padStart(3, "0")}
              </span>
            </div>
            <button
              onClick={() => setPaused((p) => !p)}
              className="flex items-center justify-center w-10 h-10 rounded-full border"
              style={{ background: "oklch(0.15 0.03 265 / 0.75)", borderColor: "var(--border)", backdropFilter: "blur(8px)", color: "var(--foreground)" }}
              aria-label="Pause"
            >
              {paused ? (
                <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor"><path d="M0 0 L12 7 L0 14 Z" /></svg>
              ) : (
                <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor"><rect x="0" y="0" width="4" height="14"/><rect x="8" y="0" width="4" height="14"/></svg>
              )}
            </button>
          </div>
        </div>

        {/* Tactical hint */}
        {!showTutorial && !victory && !defeat && !paused && (
          <div className="absolute bottom-6 left-0 right-0 z-10 text-center pointer-events-none">
            <div
              className="inline-block px-4 py-2 rounded-full text-[0.65rem] tracking-[0.4em] uppercase"
              style={{ background: "oklch(0.15 0.03 265 / 0.6)", color: "var(--muted-foreground)", backdropFilter: "blur(6px)", border: "1px solid var(--border)" }}
            >
              Drag to aim &nbsp;•&nbsp; Release to dash
            </div>
          </div>
        )}

        {/* Tutorial overlay */}
        {showTutorial && (
          <div className="absolute inset-0 z-30 flex items-center justify-center" style={{ background: "oklch(0 0 0 / 0.72)", backdropFilter: "blur(10px)" }}>
            <div
              className="rounded-2xl p-7 border max-w-xs w-full mx-6"
              style={{ background: "oklch(0.19 0.035 265 / 0.96)", borderColor: "var(--border)", boxShadow: "var(--shadow-deep)", animation: "logo-in 0.4s ease-out" }}
            >
              <p className="text-[0.6rem] tracking-[0.5em] uppercase mb-2" style={{ color: "var(--primary)" }}>How to play</p>
              <h2 className="text-2xl mb-4" style={{ color: "var(--foreground)" }}>Every dash is a strike</h2>

              <ul className="space-y-3 mb-6 text-sm" style={{ color: "var(--muted-foreground)" }}>
                <TutorialRow n="1" title="Drag to aim">
                  Time slows to a crawl. Plan your path.
                </TutorialRow>
                <TutorialRow n="2" title="Release to dash">
                  Slice through every enemy on the line.
                </TutorialRow>
                <TutorialRow n="3" title="Clear the arena">
                  Defeat all enemies. Avoid traps. Chain smart dashes.
                </TutorialRow>
              </ul>

              {current.intro && (
                <div
                  className="text-xs mb-5 px-3 py-2 rounded-lg border"
                  style={{ background: "oklch(0.13 0.03 265 / 0.7)", borderColor: "var(--border)", color: "var(--foreground)" }}
                >
                  {current.intro}
                </div>
              )}

              <button onClick={() => setShowTutorial(false)} className="btn-premium btn-premium-hover w-full">
                Begin
              </button>
            </div>
          </div>
        )}

        {/* Pause / Victory / Defeat overlays */}
        {(paused || victory || defeat) && !showTutorial && (
          <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ background: "oklch(0 0 0 / 0.65)", backdropFilter: "blur(8px)" }}>
            <div
              className="rounded-2xl p-8 text-center border max-w-xs w-full mx-6"
              style={{ background: "oklch(0.19 0.035 265 / 0.95)", borderColor: "var(--border)", boxShadow: "var(--shadow-deep)", animation: "logo-in 0.3s ease-out" }}
            >
              <h2 className="text-3xl mb-2" style={{ color: victory ? "var(--primary)" : defeat ? "oklch(0.7 0.2 25)" : "var(--foreground)" }}>
                {victory ? (isFinal ? "All Clear" : "Victory") : defeat ? "Defeated" : "Paused"}
              </h2>
              <p className="text-xs tracking-widest uppercase mb-6" style={{ color: "var(--muted-foreground)" }}>
                {victory ? current.name : defeat ? "The blade falls" : "The blade rests"}
              </p>
              <div className="flex flex-col gap-3">
                {victory ? (
                  <button onClick={nextLevel} className="btn-premium btn-premium-hover w-full">
                    {isFinal ? "Restart run" : "Next level"}
                  </button>
                ) : defeat ? (
                  <button onClick={restartLevel} className="btn-premium btn-premium-hover w-full">
                    Retry level
                  </button>
                ) : (
                  <button onClick={() => setPaused(false)} className="btn-premium btn-premium-hover w-full">
                    Resume
                  </button>
                )}
                <Link to="/" className="btn-ghost-premium w-full">
                  Main menu
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TutorialRow({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[0.7rem] font-display"
        style={{ background: "var(--gradient-gold)", color: "oklch(0.15 0.03 265)" }}
      >
        {n}
      </span>
      <span>
        <span className="block text-[0.9rem]" style={{ color: "var(--foreground)" }}>{title}</span>
        <span className="block text-xs" style={{ color: "var(--muted-foreground)" }}>{children}</span>
      </span>
    </li>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="16" viewBox="0 0 24 22" fill={filled ? "oklch(0.65 0.22 20)" : "none"} stroke="oklch(0.65 0.22 20)" strokeWidth="2">
      <path d="M12 21s-8-4.5-8-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.5-8 11-8 11z" />
    </svg>
  );
}

/* ================= GAME STATE ================= */

type GameState = {
  player: {
    pos: Vec;
    hp: number;
    dashing: boolean;
    dashDir: Vec;
    dashTarget: Vec;
    dashProgress: number;
    dashLen: number;
    facing: number;
    plantedTimer: number;
    invuln: number;
  };
  enemies: Enemy[];
  walls: Wall[];
  barrels: Barrel[];
  spikes: Spike[];
  slashes: Slash[];
  trail: TrailDot[];
  particles: Particle[];
  explosions: Explosion[];
  projectiles: Projectile[];
  gold: number;
  aiming: boolean;
  aimStart: Vec;
  aimCurrent: Vec;
  shake: number;
  slowRealMs: number;
  time: number;
  victory: boolean;
  defeat: boolean;
  bgTiles: { x: number; y: number; shade: number }[];
};

function createLevelState(idx: number, carryHp: number, carryGold: number): GameState {
  const def = LEVELS[idx];
  const enemies: Enemy[] = def.enemies.map((e, i) => mkEnemy(i + 1, e.x, e.y, e.type));

  const bgTiles: GameState["bgTiles"] = [];
  const tile = 40;
  for (let y = 0; y < ARENA_H; y += tile) {
    for (let x = 0; x < ARENA_W; x += tile) {
      bgTiles.push({ x, y, shade: Math.random() });
    }
  }

  return {
    player: {
      pos: { ...def.playerStart },
      hp: carryHp,
      dashing: false,
      dashDir: { x: 0, y: -1 },
      dashTarget: { x: 0, y: 0 },
      dashProgress: 0,
      dashLen: 0,
      facing: -Math.PI / 2,
      plantedTimer: 0,
      invuln: 0,
    },
    enemies,
    walls: def.walls,
    barrels: def.barrels.map((p) => ({ pos: { ...p }, alive: true, radius: 16 })),
    spikes: def.spikes.map((p) => ({ pos: { ...p }, radius: 22, phase: 0 })),
    slashes: [],
    trail: [],
    particles: [],
    explosions: [],
    projectiles: [],
    gold: carryGold,
    aiming: false,
    aimStart: { x: 0, y: 0 },
    aimCurrent: { x: 0, y: 0 },
    shake: 0,
    slowRealMs: 0,
    time: 0,
    victory: false,
    defeat: false,
    bgTiles,
  };
}

function mkEnemy(id: number, x: number, y: number, type: EnemyType): Enemy {
  const hpMap: Record<EnemyType, number> = { grunt: 1, brute: 2, archer: 1, shielder: 3, bomber: 1, boss: 14 };
  return {
    id,
    pos: { x, y },
    vel: { x: 0, y: 0 },
    hp: hpMap[type],
    maxHp: hpMap[type],
    alive: true,
    hitFlash: 0,
    type,
    facing: Math.PI / 2,
    shootCd: type === "archer" ? 1200 + Math.random() * 800 : 0,
    fuse: 0,
    slamCd: 2600,
    slamCharge: 0,
    slamPos: { x, y },
    volleyCd: 3400,
    phase: 0,
  };
}

function goldFor(type: EnemyType) {
  switch (type) {
    case "boss": return 250;
    case "brute": return 25;
    case "shielder": return 30;
    case "archer": return 20;
    case "bomber": return 15;
    default: return 10;
  }
}


/* ================= SIMULATION ================= */

function step(s: GameState, dtMsReal: number) {
  s.time += dtMsReal;

  const inRealTime = s.player.dashing || s.slowRealMs > 0;
  const scale = inRealTime ? 1 : SLOWMO_FACTOR;
  if (s.slowRealMs > 0) s.slowRealMs -= dtMsReal;
  const dt = (dtMsReal / 1000) * scale;
  const dtReal = dtMsReal / 1000;

  s.shake *= Math.pow(0.001, dtReal);
  if (s.shake < 0.05) s.shake = 0;

  if (s.player.invuln > 0) s.player.invuln -= dtMsReal;

  if (!s.player.dashing) s.player.plantedTimer += dtReal;
  else s.player.plantedTimer = 0;

  // Dash movement
  if (s.player.dashing) {
    const p = s.player;
    const moveDist = DASH_SPEED * dtReal;
    p.dashProgress += moveDist / p.dashLen;
    if (p.dashProgress >= 1) p.dashProgress = 1;
    const nx = p.dashTarget.x - p.pos.x;
    const ny = p.dashTarget.y - p.pos.y;
    const rem = Math.hypot(nx, ny);
    const stepD = Math.min(moveDist, rem);
    const dirx = rem > 0.01 ? nx / rem : p.dashDir.x;
    const diry = rem > 0.01 ? ny / rem : p.dashDir.y;
    const prev = { ...p.pos };
    p.pos.x += dirx * stepD;
    p.pos.y += diry * stepD;

    for (const w of s.walls) {
      if (circleRectHit(p.pos, PLAYER_R, w)) {
        p.pos.x = prev.x;
        p.pos.y = prev.y;
        p.dashProgress = 1;
        s.shake = Math.max(s.shake, 8);
        for (let i = 0; i < 10; i++) {
          s.particles.push({
            pos: { ...p.pos },
            vel: { x: (Math.random() - 0.5) * 300, y: (Math.random() - 0.5) * 300 },
            life: 400, max: 400,
            color: "oklch(0.7 0.05 260)",
            size: 2 + Math.random() * 2,
          });
        }
        break;
      }
    }

    s.trail.push({ pos: { ...p.pos }, life: 350 });

    // Hit enemies in path
    for (const e of s.enemies) {
      if (!e.alive) continue;
      const r = enemyRadius(e.type);
      if (dist(e.pos, p.pos) < PLAYER_R + r) {
        // Shielder: check facing — dash coming from front is blocked
        if (e.type === "shielder") {
          const toPlayer = Math.atan2(p.pos.y - e.pos.y, p.pos.x - e.pos.x);
          const diff = Math.abs(angDelta(toPlayer, e.facing));
          if (diff < Math.PI / 2.4) {
            // blocked — spark, small knockback of player, no damage
            s.shake = Math.max(s.shake, 12);
            for (let i = 0; i < 14; i++) {
              const a = Math.random() * Math.PI * 2;
              s.particles.push({
                pos: { ...e.pos },
                vel: { x: Math.cos(a) * 260, y: Math.sin(a) * 260 },
                life: 350, max: 350,
                color: "oklch(0.9 0.14 85)",
                size: 2 + Math.random() * 2,
              });
            }
            // stop the dash
            p.pos.x = prev.x;
            p.pos.y = prev.y;
            p.dashProgress = 1;
            continue;
          }
        }
        // Boss: i-frames to avoid multi-hit per dash
        if (e.type === "boss" && e.hitFlash > 0) continue;
        e.hp -= 1;
        e.hitFlash = e.type === "boss" ? 260 : 200;
        s.shake = Math.max(s.shake, 10);
        spawnHitBurst(s, e.pos);
        if (e.hp <= 0) {
          e.alive = false;
          s.gold += goldFor(e.type);
          spawnDeathBurst(s, e.pos);
          if (e.type === "bomber") explodeAt(s, e.pos, 78, true);
          if (e.type === "boss") {
            explodeAt(s, e.pos, 140, false);
            spawnDeathBurst(s, e.pos);
            spawnDeathBurst(s, e.pos);
          }
        }
      }
    }

    for (const b of s.barrels) {
      if (!b.alive) continue;
      if (dist(b.pos, p.pos) < PLAYER_R + b.radius) {
        b.alive = false;
        explodeAt(s, b.pos, 90, false);
      }
    }

    if (p.dashProgress > 0.5 && s.slashes.length === 0) {
      const perpx = -diry, perpy = dirx;
      const cx = (prev.x + p.pos.x) / 2;
      const cy = (prev.y + p.pos.y) / 2;
      const len = 44;
      s.slashes.push({
        a: { x: cx + perpx * len, y: cy + perpy * len },
        b: { x: cx - perpx * len, y: cy - perpy * len },
        life: 220, max: 220,
      });
    }

    p.facing = Math.atan2(diry, dirx);

    if (p.dashProgress >= 1) {
      p.dashing = false;
      s.slashes = [];
    }
  }

  // Enemies (slowed)
  for (const e of s.enemies) {
    if (!e.alive) continue;
    if (e.hitFlash > 0) e.hitFlash -= dtMsReal;
    const dx = s.player.pos.x - e.pos.x;
    const dy = s.player.pos.y - e.pos.y;
    const d = Math.hypot(dx, dy) || 1;

    // Facing: most snap; shielder & boss rotate slowly so player can flank
    const targetFacing = Math.atan2(dy, dx);
    if (e.type === "shielder") {
      const maxTurn = 1.2 * dt;
      const delta = angDelta(targetFacing, e.facing);
      e.facing += Math.max(-maxTurn, Math.min(maxTurn, delta));
    } else if (e.type === "boss") {
      const maxTurn = 1.6 * dt;
      const delta = angDelta(targetFacing, e.facing);
      e.facing += Math.max(-maxTurn, Math.min(maxTurn, delta));
    } else {
      e.facing = targetFacing;
    }

    // Movement per type
    let speed = 0;
    switch (e.type) {
      case "grunt": speed = 34; break;
      case "brute": speed = 22; break;
      case "archer": speed = d < 260 ? -34 : d > 360 ? 22 : 0; break;
      case "shielder": speed = 26; break;
      case "bomber": speed = e.fuse > 0 ? 10 : 52; break;
      case "boss": {
        const enraged = e.hp <= e.maxHp / 2;
        e.phase = enraged ? 1 : 0;
        // charging slam → freeze in place
        speed = e.slamCharge > 0 ? 0 : (enraged ? 44 : 26);
        break;
      }
    }
    const vx = (dx / d) * speed;
    const vy = (dy / d) * speed;
    e.vel.x = vx;
    e.vel.y = vy;

    // Axis-separated movement with wall collision
    const r = enemyRadius(e.type);
    const prevX = e.pos.x;
    e.pos.x += vx * dt;
    for (const w of s.walls) {
      if (circleRectHit(e.pos, r, w)) { e.pos.x = prevX; break; }
    }
    const prevY = e.pos.y;
    e.pos.y += vy * dt;
    for (const w of s.walls) {
      if (circleRectHit(e.pos, r, w)) { e.pos.y = prevY; break; }
    }

    // Archer shooting — long range, real-time cadence
    if (e.type === "archer") {
      e.shootCd -= dtMsReal;
      if (e.shootCd <= 0 && d < 700) {
        e.shootCd = 1800 + Math.random() * 700;
        const sp = 340;
        s.projectiles.push({
          pos: { ...e.pos },
          vel: { x: (dx / d) * sp, y: (dy / d) * sp },
          life: 5000,
          radius: 5,
        });
      }
    }

    // Bomber: proximity fuse → AOE explosion
    if (e.type === "bomber") {
      const TRIGGER = 78;
      if (e.fuse === 0 && d < TRIGGER) {
        e.fuse = 650; // ms until boom
      }
      if (e.fuse > 0) {
        e.fuse -= dtMsReal;
        if (e.fuse <= 0) {
          e.alive = false;
          spawnDeathBurst(s, e.pos);
          explodeAt(s, e.pos, 110, true);
          continue;
        }
      }
    }

    // Boss: telegraphed slam + radial volleys
    if (e.type === "boss") {
      const enraged = e.phase === 1;
      // Slam
      if (e.slamCharge > 0) {
        e.slamCharge -= dtMsReal;
        if (e.slamCharge <= 0) {
          explodeAt(s, e.slamPos, enraged ? 105 : 88, true);
          e.slamCd = enraged ? 1900 : 2800;
        }
      } else {
        e.slamCd -= dtMsReal;
        if (e.slamCd <= 0 && d < 340) {
          // lock target on player's current spot
          e.slamPos = { ...s.player.pos };
          e.slamCharge = enraged ? 700 : 900;
        }
      }
      // Radial volley
      e.volleyCd -= dtMsReal;
      if (e.volleyCd <= 0) {
        e.volleyCd = enraged ? 2200 : 3400;
        const count = enraged ? 10 : 8;
        const sp = 260;
        const off = Math.random() * Math.PI * 2;
        for (let i = 0; i < count; i++) {
          const a = off + (i / count) * Math.PI * 2;
          s.projectiles.push({
            pos: { ...e.pos },
            vel: { x: Math.cos(a) * sp, y: Math.sin(a) * sp },
            life: 3500,
            radius: 5,
          });
        }
      }
    }

    // Melee damage on touch (real-time only) — archers & bombers don't melee
    if (
      inRealTime && s.player.invuln <= 0 &&
      e.type !== "archer" && e.type !== "bomber" &&
      d < enemyRadius(e.type) + PLAYER_R - 2
    ) {
      s.player.hp = Math.max(0, s.player.hp - 1);
      s.player.invuln = 900;
      s.shake = 12;
    }
  }


  // Projectiles (real time — they visibly slow during aim thanks to global scale not applied; but we want them to slow too)
  for (const pr of s.projectiles) {
    pr.pos.x += pr.vel.x * dt;
    pr.pos.y += pr.vel.y * dt;
    pr.life -= dtMsReal;
    // hit walls
    for (const w of s.walls) {
      if (pr.pos.x > w.x && pr.pos.x < w.x + w.w && pr.pos.y > w.y && pr.pos.y < w.y + w.h) {
        pr.life = 0;
        for (let i = 0; i < 6; i++) {
          s.particles.push({
            pos: { ...pr.pos },
            vel: { x: (Math.random() - 0.5) * 200, y: (Math.random() - 0.5) * 200 },
            life: 300, max: 300, color: "oklch(0.85 0.18 55)", size: 1.5,
          });
        }
        break;
      }
    }
    // hit player
    if (pr.life > 0 && s.player.invuln <= 0 && dist(pr.pos, s.player.pos) < PLAYER_R + pr.radius) {
      pr.life = 0;
      s.player.hp = Math.max(0, s.player.hp - 1);
      s.player.invuln = 900;
      s.shake = Math.max(s.shake, 10);
    }
  }
  s.projectiles = s.projectiles.filter((p) => p.life > 0);

  // Spikes
  for (const sp of s.spikes) {
    sp.phase += dtReal * 2;
    if (s.player.dashing && dist(sp.pos, s.player.pos) < sp.radius + 6 && s.player.invuln <= 0) {
      s.player.hp = Math.max(0, s.player.hp - 1);
      s.player.invuln = 900;
      s.shake = Math.max(s.shake, 10);
    }
  }

  for (const t of s.trail) t.life -= dtMsReal;
  s.trail = s.trail.filter((t) => t.life > 0);

  for (const sl of s.slashes) sl.life -= dtMsReal;
  s.slashes = s.slashes.filter((sl) => sl.life > 0);

  for (const p of s.particles) {
    p.life -= dtMsReal;
    p.pos.x += p.vel.x * dtReal;
    p.pos.y += p.vel.y * dtReal;
    p.vel.x *= 0.94;
    p.vel.y *= 0.94;
  }
  s.particles = s.particles.filter((p) => p.life > 0);

  for (const ex of s.explosions) ex.life -= dtMsReal;
  s.explosions = s.explosions.filter((ex) => ex.life > 0);
}

function enemyRadius(t: EnemyType): number {
  switch (t) {
    case "boss": return 30;
    case "brute": return 18;
    case "shielder": return 17;
    case "bomber": return 13;
    case "archer": return 13;
    default: return 14;
  }
}

function angDelta(a: number, b: number) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function spawnHitBurst(s: GameState, at: Vec) {
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 200 + Math.random() * 300;
    s.particles.push({
      pos: { ...at }, vel: { x: Math.cos(a) * sp, y: Math.sin(a) * sp },
      life: 350, max: 350, color: "oklch(0.88 0.12 210)", size: 2 + Math.random() * 2,
    });
  }
}
function spawnDeathBurst(s: GameState, at: Vec) {
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 100 + Math.random() * 400;
    s.particles.push({
      pos: { ...at }, vel: { x: Math.cos(a) * sp, y: Math.sin(a) * sp },
      life: 600, max: 600,
      color: Math.random() > 0.5 ? "oklch(0.65 0.22 20)" : "oklch(0.82 0.16 85)",
      size: 2 + Math.random() * 3,
    });
  }
}
function explodeAt(s: GameState, at: Vec, radius: number, damagePlayer: boolean) {
  s.explosions.push({ pos: { ...at }, life: 400, max: 400, radius });
  s.shake = Math.max(s.shake, 16);
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 200 + Math.random() * 600;
    s.particles.push({
      pos: { ...at }, vel: { x: Math.cos(a) * sp, y: Math.sin(a) * sp },
      life: 700, max: 700,
      color: Math.random() > 0.4 ? "oklch(0.72 0.22 35)" : "oklch(0.9 0.15 80)",
      size: 2 + Math.random() * 4,
    });
  }
  for (const e of s.enemies) {
    if (!e.alive) continue;
    if (dist(e.pos, at) < radius) {
      e.hp -= 2;
      e.hitFlash = 250;
      if (e.hp <= 0) {
        e.alive = false;
        s.gold += goldFor(e.type);
        spawnDeathBurst(s, e.pos);
      }
    }
  }
  if (damagePlayer && dist(s.player.pos, at) < radius && s.player.invuln <= 0) {
    s.player.hp = Math.max(0, s.player.hp - 1);
    s.player.invuln = 900;
  }
}

/* ================= RENDER ================= */

function render(ctx: CanvasRenderingContext2D, s: GameState, rect: DOMRect) {
  const sx = rect.width / ARENA_W;
  const sy = rect.height / ARENA_H;
  ctx.save();
  ctx.scale(sx, sy);

  const sk = s.shake;
  const shx = (Math.random() - 0.5) * sk;
  const shy = (Math.random() - 0.5) * sk;
  ctx.translate(shx, shy);

  ctx.fillStyle = "oklch(0.16 0.03 262)";
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);

  for (const t of s.bgTiles) {
    ctx.fillStyle = `oklch(${0.17 + t.shade * 0.03} 0.03 262)`;
    ctx.fillRect(t.x, t.y, 40, 40);
    ctx.strokeStyle = "oklch(0.12 0.02 262)";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(t.x + 0.5, t.y + 0.5, 39, 39);
  }

  const grd = ctx.createRadialGradient(s.player.pos.x, s.player.pos.y, 20, s.player.pos.x, s.player.pos.y, 260);
  grd.addColorStop(0, "oklch(0.85 0.15 60 / 0.18)");
  grd.addColorStop(1, "transparent");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);

  for (const w of s.walls) {
    ctx.fillStyle = "oklch(0.28 0.04 265)";
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = "oklch(0.36 0.05 265)";
    ctx.fillRect(w.x, w.y, w.w, 3);
    ctx.strokeStyle = "oklch(0.1 0.02 265)";
    ctx.lineWidth = 1;
    ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1);
  }

  for (const sp of s.spikes) {
    ctx.save();
    ctx.translate(sp.pos.x, sp.pos.y);
    ctx.fillStyle = "oklch(0.22 0.03 265)";
    ctx.beginPath();
    ctx.arc(0, 0, sp.radius, 0, Math.PI * 2);
    ctx.fill();
    const wobble = Math.sin(sp.phase) * 0.15 + 0.85;
    ctx.fillStyle = "oklch(0.8 0.05 240)";
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(-3, 0);
      ctx.lineTo(3, 0);
      ctx.lineTo(0, -sp.radius * wobble);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = "oklch(0.55 0.15 25)";
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const b of s.barrels) {
    if (!b.alive) continue;
    ctx.save();
    ctx.translate(b.pos.x, b.pos.y);
    ctx.fillStyle = "oklch(0 0 0 / 0.35)";
    ctx.beginPath();
    ctx.ellipse(2, b.radius - 2, b.radius, b.radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    const bg = ctx.createLinearGradient(-b.radius, 0, b.radius, 0);
    bg.addColorStop(0, "oklch(0.45 0.12 40)");
    bg.addColorStop(1, "oklch(0.3 0.1 30)");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "oklch(0.2 0.05 30)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-b.radius, -4); ctx.lineTo(b.radius, -4);
    ctx.moveTo(-b.radius, 4); ctx.lineTo(b.radius, 4);
    ctx.stroke();
    const glow = 0.5 + Math.sin(s.time * 0.01) * 0.5;
    ctx.fillStyle = `oklch(0.85 0.2 60 / ${0.4 + glow * 0.4})`;
    ctx.beginPath();
    ctx.arc(0, -b.radius - 4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const t of s.trail) {
    const a = t.life / 350;
    ctx.fillStyle = `oklch(0.88 0.12 210 / ${a * 0.7})`;
    ctx.beginPath();
    ctx.arc(t.pos.x, t.pos.y, PLAYER_R * a * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Slam telegraphs (drawn beneath enemies)
  for (const e of s.enemies) {
    if (!e.alive || e.type !== "boss" || e.slamCharge <= 0) continue;
    const maxCharge = e.phase === 1 ? 700 : 900;
    const t = 1 - e.slamCharge / maxCharge;
    const r = (e.phase === 1 ? 105 : 88);
    const pulse = 0.6 + Math.sin(s.time * 0.03) * 0.4;
    const eg = ctx.createRadialGradient(e.slamPos.x, e.slamPos.y, r * 0.2, e.slamPos.x, e.slamPos.y, r);
    eg.addColorStop(0, `oklch(0.7 0.28 25 / ${0.15 + t * 0.35})`);
    eg.addColorStop(1, "transparent");
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.arc(e.slamPos.x, e.slamPos.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `oklch(0.75 0.28 25 / ${0.5 + pulse * 0.4})`;
    ctx.lineWidth = 2 + t * 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(e.slamPos.x, e.slamPos.y, r * (0.6 + t * 0.4), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const e of s.enemies) {
    if (!e.alive) continue;
    drawEnemy(ctx, e, s.time);
  }

  // Projectiles
  for (const pr of s.projectiles) {
    ctx.save();
    ctx.translate(pr.pos.x, pr.pos.y);
    const ang = Math.atan2(pr.vel.y, pr.vel.x);
    ctx.rotate(ang);
    ctx.shadowColor = "oklch(0.85 0.18 55)";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "oklch(0.95 0.15 70)";
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-6, 3);
    ctx.lineTo(-6, -3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "oklch(0.6 0.15 40 / 0.7)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-6, 0); ctx.lineTo(-16, 0);
    ctx.stroke();
    ctx.restore();
  }

  drawPlayer(ctx, s);

  if (s.aiming) drawAim(ctx, s);

  for (const sl of s.slashes) {
    const a = sl.life / sl.max;
    ctx.save();
    ctx.strokeStyle = `oklch(0.95 0.05 210 / ${a})`;
    ctx.lineWidth = 8 * a;
    ctx.lineCap = "round";
    ctx.shadowColor = "oklch(0.88 0.12 210)";
    ctx.shadowBlur = 20 * a;
    ctx.beginPath();
    ctx.moveTo(sl.a.x, sl.a.y);
    ctx.lineTo(sl.b.x, sl.b.y);
    ctx.stroke();
    ctx.restore();
  }

  for (const p of s.particles) {
    const a = p.life / p.max;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  for (const ex of s.explosions) {
    const a = ex.life / ex.max;
    const rr = ex.radius * (1 - a);
    const eg = ctx.createRadialGradient(ex.pos.x, ex.pos.y, 0, ex.pos.x, ex.pos.y, rr);
    eg.addColorStop(0, `oklch(0.95 0.15 80 / ${a})`);
    eg.addColorStop(0.5, `oklch(0.72 0.22 35 / ${a * 0.7})`);
    eg.addColorStop(1, "transparent");
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.arc(ex.pos.x, ex.pos.y, rr, 0, Math.PI * 2);
    ctx.fill();
  }

  if (!s.player.dashing && s.slowRealMs <= 0) {
    const vg = ctx.createRadialGradient(
      ARENA_W / 2, ARENA_H / 2, ARENA_W * 0.35,
      ARENA_W / 2, ARENA_H / 2, ARENA_W * 0.75
    );
    vg.addColorStop(0, "transparent");
    vg.addColorStop(1, "oklch(0.05 0.02 265 / 0.55)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    ctx.fillStyle = "oklch(0.5 0.1 220 / 0.05)";
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  }

  ctx.restore();
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, time: number) {
  ctx.save();
  ctx.translate(e.pos.x, e.pos.y);

  // shadow (larger for boss)
  const shadowR = e.type === "boss" ? 28 : 14;
  ctx.fillStyle = "oklch(0 0 0 / 0.4)";
  ctx.beginPath();
  ctx.ellipse(1, e.type === "boss" ? 22 : 12, shadowR, e.type === "boss" ? 8 : 5, 0, 0, Math.PI * 2);
  ctx.fill();

  const flash = e.hitFlash > 0 ? 1 : 0;
  const r = enemyRadius(e.type);

  let bodyCol = "oklch(0.5 0.16 340)";
  let outline = "oklch(0.15 0.05 320)";
  let eyeCol = "oklch(0.95 0.2 25)";
  switch (e.type) {
    case "brute": bodyCol = "oklch(0.45 0.15 320)"; break;
    case "archer": bodyCol = "oklch(0.55 0.15 155)"; outline = "oklch(0.2 0.06 155)"; eyeCol = "oklch(0.92 0.2 100)"; break;
    case "shielder": bodyCol = "oklch(0.45 0.08 260)"; outline = "oklch(0.15 0.04 260)"; eyeCol = "oklch(0.9 0.15 210)"; break;
    case "bomber": bodyCol = "oklch(0.55 0.2 40)"; outline = "oklch(0.2 0.08 40)"; eyeCol = "oklch(0.95 0.2 80)"; break;
    case "boss": bodyCol = e.phase === 1 ? "oklch(0.38 0.18 25)" : "oklch(0.32 0.09 300)"; outline = "oklch(0.08 0.05 300)"; eyeCol = e.phase === 1 ? "oklch(0.95 0.28 25)" : "oklch(0.9 0.24 60)"; break;
  }
  if (flash) { bodyCol = "oklch(0.98 0.02 210)"; eyeCol = "oklch(0.2 0.02 210)"; }


  ctx.fillStyle = bodyCol;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // eye slit
  ctx.fillStyle = eyeCol;
  ctx.fillRect(-4, -3, 8, 2);

  // Per-type accessories
  if (e.type === "shielder") {
    ctx.save();
    ctx.rotate(e.facing);
    // shield in front (facing direction)
    const shieldD = r + 4;
    ctx.translate(shieldD, 0);
    ctx.fillStyle = flash ? "oklch(0.95 0.05 210)" : "oklch(0.75 0.12 240)";
    ctx.strokeStyle = "oklch(0.25 0.05 240)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.quadraticCurveTo(8, 0, 0, 12);
    ctx.quadraticCurveTo(-2, 0, 0, -12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // rivet
    ctx.fillStyle = "oklch(0.85 0.16 80)";
    ctx.beginPath();
    ctx.arc(2, 0, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (e.type === "archer") {
    ctx.save();
    ctx.rotate(e.facing);
    ctx.strokeStyle = flash ? "oklch(0.95 0.05 210)" : "oklch(0.82 0.16 85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r + 2, 0, 8, -Math.PI / 2.2, Math.PI / 2.2);
    ctx.stroke();
    // string
    ctx.strokeStyle = "oklch(0.9 0.02 240 / 0.7)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(r + 2, -6.5);
    ctx.lineTo(r + 2, 6.5);
    ctx.stroke();
    ctx.restore();
  }

  if (e.type === "bomber") {
    // pulsing fuse — much faster & red when armed
    const armed = e.fuse > 0;
    const rate = armed ? 0.05 : 0.02;
    const pulse = 0.5 + Math.sin(time * rate) * 0.5;
    const col = armed ? "oklch(0.7 0.28 25)" : "oklch(0.92 0.2 80)";
    ctx.fillStyle = `${col.slice(0, -1)} / ${0.5 + pulse * 0.5})`;
    ctx.beginPath();
    ctx.arc(0, -r - 3, 3 + pulse * (armed ? 2.4 : 1.2), 0, Math.PI * 2);
    ctx.fill();
    if (armed) {
      ctx.strokeStyle = `oklch(0.75 0.25 30 / ${0.3 + pulse * 0.5})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, r + 4 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    // cross-hatch danger
    ctx.strokeStyle = "oklch(0.3 0.1 40)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, -r * 0.2); ctx.lineTo(r * 0.6, r * 0.2);
    ctx.moveTo(-r * 0.6, r * 0.2); ctx.lineTo(r * 0.6, -r * 0.2);
    ctx.stroke();
  }

  if (e.type === "brute") {
    // shoulder spikes
    ctx.fillStyle = "oklch(0.7 0.05 260)";
    ctx.beginPath();
    ctx.moveTo(-r + 2, -r + 4); ctx.lineTo(-r - 4, -r - 2); ctx.lineTo(-r + 2, -r - 2);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r - 2, -r + 4); ctx.lineTo(r + 4, -r - 2); ctx.lineTo(r - 2, -r - 2);
    ctx.closePath(); ctx.fill();
  }

  if (e.type === "boss") {
    // giant blade on back, spikes crown
    ctx.save();
    ctx.rotate(e.facing);
    // horns / crown
    ctx.fillStyle = e.phase === 1 ? "oklch(0.65 0.24 30)" : "oklch(0.7 0.05 260)";
    for (let i = -2; i <= 2; i++) {
      const ang = (i / 5) * Math.PI * 0.9 - Math.PI;
      const hx = Math.cos(ang) * r;
      const hy = Math.sin(ang) * r;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + Math.cos(ang) * 10, hy + Math.sin(ang) * 10);
      ctx.lineTo(hx + Math.cos(ang + 0.15) * 4, hy + Math.sin(ang + 0.15) * 4);
      ctx.closePath();
      ctx.fill();
    }
    // giant blade in front
    ctx.translate(r + 4, 0);
    ctx.fillStyle = "oklch(0.3 0.05 240)";
    ctx.fillRect(-4, -3, 8, 6);
    const bladeGrad = ctx.createLinearGradient(0, -6, 32, 0);
    bladeGrad.addColorStop(0, "oklch(0.95 0.05 210)");
    bladeGrad.addColorStop(1, "oklch(0.55 0.12 220)");
    ctx.fillStyle = bladeGrad;
    ctx.beginPath();
    ctx.moveTo(4, -5);
    ctx.lineTo(34, -2);
    ctx.lineTo(38, 0);
    ctx.lineTo(34, 2);
    ctx.lineTo(4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "oklch(0.2 0.05 240)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // rune ring around boss
    ctx.strokeStyle = e.phase === 1 ? "oklch(0.75 0.28 25 / 0.45)" : "oklch(0.85 0.18 60 / 0.35)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, r + 6, (time * 0.001) % (Math.PI * 2), (time * 0.001) % (Math.PI * 2) + Math.PI * 1.5);
    ctx.stroke();
    ctx.setLineDash([]);

    // HP bar
    const barW = 60;
    const pct = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = "oklch(0.15 0.03 265 / 0.85)";
    ctx.fillRect(-barW / 2 - 1, -r - 14, barW + 2, 6);
    const hpGrad = ctx.createLinearGradient(-barW / 2, 0, barW / 2, 0);
    if (e.phase === 1) {
      hpGrad.addColorStop(0, "oklch(0.75 0.28 25)");
      hpGrad.addColorStop(1, "oklch(0.65 0.24 15)");
    } else {
      hpGrad.addColorStop(0, "oklch(0.88 0.12 210)");
      hpGrad.addColorStop(1, "oklch(0.72 0.22 35)");
    }
    ctx.fillStyle = hpGrad;
    ctx.fillRect(-barW / 2, -r - 13, barW * pct, 4);
    ctx.strokeStyle = "oklch(0.5 0.05 260 / 0.6)";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(-barW / 2 - 1, -r - 14, barW + 2, 6);
  }

  // hp pips for multi-hp (skip boss — has bar)
  if (e.hp > 1 && e.type !== "shielder" && e.type !== "boss") {
    ctx.fillStyle = "oklch(0.9 0.02 260 / 0.85)";
    for (let i = 0; i < e.hp; i++) {
      ctx.beginPath();
      ctx.arc(-4 + i * 4, -r - 6, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (e.type === "shielder") {
    ctx.fillStyle = "oklch(0.9 0.02 260 / 0.85)";
    for (let i = 0; i < e.hp; i++) {
      ctx.beginPath();
      ctx.arc(-4 + i * 4, -r - 6, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, s: GameState) {
  const p = s.player;
  ctx.save();
  ctx.translate(p.pos.x, p.pos.y);
  ctx.fillStyle = "oklch(0 0 0 / 0.45)";
  ctx.beginPath();
  ctx.ellipse(2, 14, 16, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  const flicker = p.invuln > 0 && Math.floor(p.invuln / 60) % 2 === 0 ? 0.4 : 1;
  ctx.globalAlpha = flicker;

  const auraR = 22 + Math.sin(s.time * 0.004) * 2;
  const aura = ctx.createRadialGradient(0, 0, 8, 0, 0, auraR);
  aura.addColorStop(0, "oklch(0.88 0.12 210 / 0.5)");
  aura.addColorStop(1, "transparent");
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, auraR, 0, Math.PI * 2);
  ctx.fill();

  const bg = ctx.createLinearGradient(-PLAYER_R, -PLAYER_R, PLAYER_R, PLAYER_R);
  bg.addColorStop(0, "oklch(0.95 0.03 250)");
  bg.addColorStop(1, "oklch(0.6 0.1 250)");
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(0, 0, PLAYER_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "oklch(0.3 0.06 250)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "oklch(0.75 0.18 55)";
  ctx.fillRect(-3, -PLAYER_R + 2, 6, 6);

  ctx.rotate(p.facing + Math.PI / 2);
  if (!p.dashing) {
    const sway = Math.sin(s.time * 0.002) * 0.03;
    ctx.rotate(sway);
    ctx.fillStyle = "oklch(0.45 0.1 40)";
    ctx.fillRect(-2, 6, 4, 10);
    ctx.fillStyle = "oklch(0.85 0.16 80)";
    ctx.fillRect(-6, 14, 12, 3);
    const bg2 = ctx.createLinearGradient(0, 16, 0, 40);
    bg2.addColorStop(0, "oklch(0.95 0.05 210)");
    bg2.addColorStop(1, "oklch(0.55 0.1 220)");
    ctx.fillStyle = bg2;
    ctx.beginPath();
    ctx.moveTo(-3, 16);
    ctx.lineTo(3, 16);
    ctx.lineTo(1, 40);
    ctx.lineTo(-1, 40);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "oklch(0.88 0.12 210 / 0.35)";
    ctx.beginPath();
    ctx.ellipse(0, 40, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "oklch(0.45 0.1 40)";
    ctx.fillRect(-2, -6, 4, 10);
    ctx.fillStyle = "oklch(0.85 0.16 80)";
    ctx.fillRect(-6, -8, 12, 3);
    const bg3 = ctx.createLinearGradient(0, -8, 0, -34);
    bg3.addColorStop(0, "oklch(0.95 0.05 210)");
    bg3.addColorStop(1, "oklch(0.7 0.1 220)");
    ctx.fillStyle = bg3;
    ctx.beginPath();
    ctx.moveTo(-4, -8);
    ctx.lineTo(4, -8);
    ctx.lineTo(0, -34);
    ctx.closePath();
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawAim(ctx: CanvasRenderingContext2D, s: GameState) {
  const p = s.player.pos;
  const dir = { x: s.aimCurrent.x - s.aimStart.x, y: s.aimCurrent.y - s.aimStart.y };
  const len = Math.hypot(dir.x, dir.y);
  if (len < 8) return;
  const nx = dir.x / len;
  const ny = dir.y / len;
  const dashLen = Math.min(DASH_MAX_LEN, len * 1.4);
  const tx = p.x + nx * dashLen;
  const ty = p.y + ny * dashLen;

  ctx.save();
  ctx.strokeStyle = "oklch(0.88 0.12 210 / 0.25)";
  ctx.lineWidth = 22;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(tx, ty);
  ctx.stroke();

  ctx.strokeStyle = "oklch(0.95 0.05 210)";
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.lineDashOffset = -((performance.now() / 40) % 18);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.setLineDash([]);

  const ang = Math.atan2(ny, nx);
  ctx.translate(tx, ty);
  ctx.rotate(ang);
  ctx.fillStyle = "oklch(0.95 0.05 210)";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-16, -9);
  ctx.lineTo(-11, 0);
  ctx.lineTo(-16, 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "oklch(0.75 0.18 55 / 0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(tx, ty, PLAYER_R + 4, 0, Math.PI * 2);
  ctx.stroke();
}

/* ================= UTIL ================= */
function dist(a: Vec, b: Vec) { return Math.hypot(a.x - b.x, a.y - b.y); }
function circleRectHit(c: Vec, r: number, rect: Wall) {
  const cx = Math.max(rect.x, Math.min(c.x, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(c.y, rect.y + rect.h));
  return (c.x - cx) ** 2 + (c.y - cy) ** 2 < r * r;
}
