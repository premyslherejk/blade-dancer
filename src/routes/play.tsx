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
  frozen: number; // ms remaining of Chrono Freeze
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
type Particle = { pos: Vec; vel: Vec; life: number; max: number; color: string; size: number; glow?: number; kind?: "spark" | "ember" | "dust" };
type Explosion = { pos: Vec; life: number; max: number; radius: number };
type Projectile = { pos: Vec; vel: Vec; life: number; radius: number; friendly?: boolean; damage?: number; rot?: number };
type Prop = { kind: "moss" | "rock" | "grass" | "skull" | "crack" | "flower" | "pebble"; x: number; y: number; rot: number; size: number; seed: number };
type Torch = { x: number; y: number; flicker: number };

/* ---------- Skills ---------- */
type SkillId = "void" | "freeze" | "storm";
type SkillState = { cd: number; maxCd: number; cost: number };
const SKILL_DEFS: Record<SkillId, { cost: number; maxCd: number; label: string }> = {
  void:   { cost: 20, maxCd: 5000,  label: "Void Slash" },
  freeze: { cost: 30, maxCd: 8000,  label: "Chrono Freeze" },
  storm:  { cost: 45, maxCd: 10000, label: "Blade Storm" },
};
const MAX_MANA = 100;
const MAX_HP = 3;
const MANA_REGEN = 5; // per real second

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
    intro: "The Warlord slams the ground and fires radial arcs. Dash between telegraphs and strike his back. He enrages below 25% HP.",
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
  const [mana, setMana] = useState(MAX_MANA);
  const [gold, setGold] = useState(0);
  const [potions, setPotions] = useState({ hp: 2, mana: 2 });
  const [skillCds, setSkillCds] = useState<Record<SkillId, number>>({ void: 0, freeze: 0, storm: 0 });
  const [paused, setPaused] = useState(false);
  const [victory, setVictory] = useState(false);
  const [defeat, setDefeat] = useState(false);
  const [levelIdx, setLevelIdx] = useState(0);
  const [showTutorial, setShowTutorial] = useState(true);
  const [carryGold, setCarryGold] = useState(0);
  const [carryHp, setCarryHp] = useState(3);
  const [carryMana, setCarryMana] = useState(MAX_MANA);
  const [carryPotions, setCarryPotions] = useState({ hp: 2, mana: 2 });

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

    const state: GameState = createLevelState(levelIdx, carryHp, carryGold, carryMana, carryPotions);
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
        setMana(Math.round(state.player.mana));
        setGold(state.gold);
        setPotions({ hp: state.potions.hp, mana: state.potions.mana });
        setSkillCds({ void: state.skills.void.cd, freeze: state.skills.freeze.cd, storm: state.skills.storm.cd });
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
  }, [paused, victory, defeat, levelIdx, showTutorial, carryHp, carryGold, carryMana, carryPotions]);

  const restartLevel = () => {
    setDefeat(false);
    setVictory(false);
    setPaused(false);
    setCarryHp(3);
    setCarryMana(MAX_MANA);
    setCarryPotions({ hp: 2, mana: 2 });
    setCarryGold(gold);
  };

  const nextLevel = () => {
    const hasNext = levelIdx < LEVELS.length - 1;
    if (!hasNext) {
      setCarryHp(3);
      setCarryMana(MAX_MANA);
      setCarryPotions({ hp: 2, mana: 2 });
      setCarryGold(0);
      setLevelIdx(0);
      setVictory(false);
      setDefeat(false);
      setPaused(false);
      setShowTutorial(true);
      return;
    }
    setCarryHp(Math.max(1, hp));
    setCarryMana(mana);
    // grant +1 of each potion between levels
    setCarryPotions({ hp: Math.min(3, potions.hp + 1), mana: Math.min(3, potions.mana + 1) });
    setCarryGold(gold);
    const next = levelIdx + 1;
    setLevelIdx(next);
    setVictory(false);
    setDefeat(false);
    setPaused(false);
    if (LEVELS[next]?.intro) setShowTutorial(true);
  };

  const usePotion = (kind: "hp" | "mana") => {
    const st = stateRef.current;
    if (!st || paused || victory || defeat || showTutorial) return;
    if (st.potions[kind] <= 0) return;
    if (kind === "hp") {
      if (st.player.hp >= MAX_HP) return;
      st.potions.hp -= 1;
      st.player.hp = Math.min(MAX_HP, st.player.hp + 1);
      spawnHealVfx(st, st.player.pos, "hp");
    } else {
      if (st.player.mana >= MAX_MANA) return;
      st.potions.mana -= 1;
      st.player.mana = Math.min(MAX_MANA, st.player.mana + 50);
      spawnHealVfx(st, st.player.pos, "mana");
    }
  };

  const castSkill = (id: SkillId) => {
    const st = stateRef.current;
    if (!st || paused || victory || defeat || showTutorial) return;
    const sk = st.skills[id];
    if (sk.cd > 0) return;
    if (st.player.mana < sk.cost) return;
    st.player.mana -= sk.cost;
    sk.cd = sk.maxCd;
    activateSkill(st, id);
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
    mana: number;
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
  potions: { hp: number; mana: number };
  skills: Record<SkillId, SkillState>;
  freezePulse: number; // ms remaining of overall freeze visual pulse
  aiming: boolean;
  aimStart: Vec;
  aimCurrent: Vec;
  shake: number;
  slowRealMs: number;
  time: number;
  victory: boolean;
  defeat: boolean;
  props: Prop[];
  torches: Torch[];
  floorSeed: number;
};

function createLevelState(idx: number, carryHp: number, carryGold: number, carryMana: number, carryPotions: { hp: number; mana: number }): GameState {
  const def = LEVELS[idx];
  const enemies: Enemy[] = def.enemies.map((e, i) => mkEnemy(i + 1, e.x, e.y, e.type));

  const seed = (idx + 1) * 1337 + 42;
  const rng = mulberry32(seed);

  // Generate ambient props avoiding gameplay elements
  const blockers: Array<{ x: number; y: number; r: number }> = [
    { x: def.playerStart.x, y: def.playerStart.y, r: 44 },
    ...def.enemies.map((e) => ({ x: e.x, y: e.y, r: 34 })),
    ...def.barrels.map((b) => ({ x: b.x, y: b.y, r: 30 })),
    ...def.spikes.map((sp) => ({ x: sp.x, y: sp.y, r: 34 })),
  ];
  const isBlocked = (x: number, y: number, pad = 10) => {
    for (const w of def.walls) {
      if (x > w.x - pad && x < w.x + w.w + pad && y > w.y - pad && y < w.y + w.h + pad) return true;
    }
    for (const b of blockers) {
      const dx = x - b.x, dy = y - b.y;
      if (dx * dx + dy * dy < b.r * b.r) return true;
    }
    return false;
  };

  const props: Prop[] = [];
  const kinds: Prop["kind"][] = ["moss", "moss", "crack", "grass", "grass", "grass", "pebble", "rock", "rock", "flower", "skull"];
  // Restrict decorative props to a border band around the arena — keep the play area clean.
  const borderPad = 70; // width of decorated border ring
  const innerX0 = borderPad, innerX1 = ARENA_W - borderPad;
  const innerY0 = borderPad, innerY1 = ARENA_H - borderPad;
  for (let i = 0; i < 400 && props.length < 70; i++) {
    const x = 14 + rng() * (ARENA_W - 28);
    const y = 14 + rng() * (ARENA_H - 28);
    // Skip center stage — decorations belong at the edges
    if (x > innerX0 && x < innerX1 && y > innerY0 && y < innerY1) continue;
    if (isBlocked(x, y, 6)) continue;
    const kind = kinds[Math.floor(rng() * kinds.length)];
    props.push({ kind, x, y, rot: rng() * Math.PI * 2, size: 0.6 + rng() * 0.9, seed: rng() * 1000 });
  }

  // Torches on inner walls (not outer border)
  const torches: Torch[] = [];
  for (const w of def.walls) {
    const outer =
      w.x <= 0 || w.y <= 0 || w.x + w.w >= ARENA_W || w.y + w.h >= ARENA_H;
    if (outer) continue;
    const long = Math.max(w.w, w.h);
    if (long < 70) continue;
    // Place a torch at midpoint on the "top" edge (facing arena interior toward smaller y for horizontal walls)
    if (w.w >= w.h) {
      torches.push({ x: w.x + w.w / 2, y: w.y - 6, flicker: rng() * 100 });
    } else {
      torches.push({ x: w.x - 6, y: w.y + w.h / 2, flicker: rng() * 100 });
      torches.push({ x: w.x + w.w + 6, y: w.y + w.h / 2, flicker: rng() * 100 });
    }
    if (torches.length >= 6) break;
  }

  return {
    player: {
      pos: { ...def.playerStart },
      hp: carryHp,
      mana: carryMana,
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
    potions: { hp: carryPotions.hp, mana: carryPotions.mana },
    skills: {
      void:   { cd: 0, maxCd: SKILL_DEFS.void.maxCd,   cost: SKILL_DEFS.void.cost },
      freeze: { cd: 0, maxCd: SKILL_DEFS.freeze.maxCd, cost: SKILL_DEFS.freeze.cost },
      storm:  { cd: 0, maxCd: SKILL_DEFS.storm.maxCd,  cost: SKILL_DEFS.storm.cost },
    },
    freezePulse: 0,
    aiming: false,
    aimStart: { x: 0, y: 0 },
    aimCurrent: { x: 0, y: 0 },
    shake: 0,
    slowRealMs: 0,
    time: 0,
    victory: false,
    defeat: false,
    props,
    torches,
    floorSeed: seed,
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
    shootCd: type === "archer" ? 1600 + Math.random() * 900 : 0,
    fuse: 0,
    frozen: 0,
    slamCd: 5200,
    slamCharge: 0,
    slamPos: { x, y },
    volleyCd: 4800,
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

  // Mana regen (real time, always ticks)
  s.player.mana = Math.min(MAX_MANA, s.player.mana + MANA_REGEN * dtReal);
  // Skill cooldowns (real time)
  for (const id of ["void", "freeze", "storm"] as SkillId[]) {
    if (s.skills[id].cd > 0) s.skills[id].cd = Math.max(0, s.skills[id].cd - dtMsReal);
  }
  if (s.freezePulse > 0) s.freezePulse -= dtMsReal;

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
    if (e.frozen > 0) {
      e.frozen -= dtMsReal;
      // Frozen enemies do nothing — no movement, no attacks, no facing change
      continue;
    }
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

    // Movement per type — +65% speed boost across the board
    let speed = 0;
    switch (e.type) {
      case "grunt": speed = 56; break;
      case "brute": speed = 36; break;
      case "archer": speed = d < 260 ? -56 : d > 360 ? 36 : 0; break;
      case "shielder": speed = 43; break;
      case "bomber": speed = e.fuse > 0 ? 17 : 86; break;
      case "boss": {
        const enraged = e.hp <= e.maxHp * 0.25;
        e.phase = enraged ? 1 : 0;
        // charging slam → freeze in place
        speed = e.slamCharge > 0 ? 0 : (enraged ? 73 : 43);
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
        e.shootCd = 2300 + Math.random() * 800;
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
          explodeAt(s, e.pos, 78, true);
          continue;
        }
      }
    }

    // Boss: telegraphed slam + radial volleys
    if (e.type === "boss") {
      const enraged = e.phase === 1;
      // Slam (1.6s telegraph, 2x longer cooldown than before)
      if (e.slamCharge > 0) {
        e.slamCharge -= dtMsReal;
        if (e.slamCharge <= 0) {
          explodeAt(s, e.slamPos, enraged ? 105 : 88, true);
          e.slamCd = enraged ? 4160 : 5200;
        }
      } else {
        e.slamCd -= dtMsReal;
        if (e.slamCd <= 0 && d < 340) {
          // lock target on player's current spot
          e.slamPos = { ...s.player.pos };
          e.slamCharge = 1600;
        }
      }
      // Radial volley
      e.volleyCd -= dtMsReal;
      if (e.volleyCd <= 0) {
        e.volleyCd = enraged ? 3840 : 4800;
        const count = enraged ? 6 : 4;
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

    // Melee damage on touch — only when player is NOT dashing (dash = i-frames + attack)
    if (
      inRealTime && !s.player.dashing && s.player.invuln <= 0 &&
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
    if (p.kind === "ember") {
      p.vel.y -= 8 * dtReal; // embers drift up
      p.vel.x *= 0.995;
    } else if (p.kind === "dust") {
      p.vel.x *= 0.99;
      p.vel.y *= 0.99;
    } else {
      p.vel.x *= 0.94;
      p.vel.y *= 0.94;
    }
  }
  s.particles = s.particles.filter((p) => p.life > 0);

  // Ambient atmosphere — embers and dust drifting through the arena
  if (Math.random() < 0.55) {
    s.particles.push({
      pos: { x: Math.random() * ARENA_W, y: ARENA_H - 20 + Math.random() * 40 },
      vel: { x: (Math.random() - 0.5) * 12, y: -20 - Math.random() * 30 },
      life: 2200 + Math.random() * 1200,
      max: 2600,
      color: Math.random() > 0.4 ? "oklch(0.85 0.22 55)" : "oklch(0.92 0.18 30)",
      size: 0.9 + Math.random() * 1.3,
      glow: 10,
      kind: "ember",
    });
  }
  if (Math.random() < 0.35) {
    s.particles.push({
      pos: { x: Math.random() * ARENA_W, y: Math.random() * ARENA_H },
      vel: { x: (Math.random() - 0.5) * 8, y: (Math.random() - 0.5) * 6 },
      life: 1800,
      max: 1800,
      color: "oklch(0.75 0.05 240 / 0.6)",
      size: 0.6 + Math.random() * 0.8,
      glow: 4,
      kind: "dust",
    });
  }

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

  drawFloor(ctx, s);
  drawFloorProps(ctx, s);
  drawSpikes(ctx, s);
  drawTorches(ctx, s);

  // Player warm halo
  const grd = ctx.createRadialGradient(s.player.pos.x, s.player.pos.y, 22, s.player.pos.x, s.player.pos.y, 240);
  grd.addColorStop(0, "oklch(0.85 0.15 60 / 0.18)");
  grd.addColorStop(1, "transparent");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);

  drawTrail(ctx, s);
  drawSlamTelegraphs(ctx, s);

  // Y-sorted pass: barrels + enemies + walls + player draw back-to-front
  // so overlapping stacked units get correct fake-3D occlusion.
  type SortItem = { y: number; draw: () => void };
  const items: SortItem[] = [];
  for (const b of s.barrels) {
    if (!b.alive) continue;
    items.push({ y: b.pos.y + b.radius, draw: () => drawBarrel(ctx, b, s.time) });
  }
  for (const w of s.walls) {
    items.push({ y: w.y + w.h, draw: () => drawWall(ctx, w) });
  }
  for (const e of s.enemies) {
    if (!e.alive) continue;
    items.push({ y: e.pos.y + enemyRadius(e.type), draw: () => drawEnemy(ctx, e, s.time) });
  }
  items.push({ y: s.player.pos.y + PLAYER_R, draw: () => drawPlayer(ctx, s) });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();

  drawProjectiles(ctx, s);
  if (s.aiming) drawAim(ctx, s);
  drawSlashes(ctx, s);
  drawParticles(ctx, s);
  drawExplosions(ctx, s);

  if (!s.player.dashing && s.slowRealMs <= 0) {
    const vg = ctx.createRadialGradient(
      ARENA_W / 2, ARENA_H / 2, ARENA_W * 0.35,
      ARENA_W / 2, ARENA_H / 2, ARENA_W * 0.8
    );
    vg.addColorStop(0, "transparent");
    vg.addColorStop(1, "oklch(0.05 0.02 265 / 0.6)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    ctx.fillStyle = "oklch(0.5 0.1 220 / 0.045)";
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  }

  ctx.restore();
}

/* ---------- Environment ---------- */

function drawFloor(ctx: CanvasRenderingContext2D, s: GameState) {
  // Deep pit backdrop
  ctx.fillStyle = "oklch(0.07 0.02 265)";
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);

  const cx = ARENA_W / 2;
  const cy = ARENA_H / 2;

  // Warm overhead spotlight — big center pool of light, dramatic falloff
  const bg = ctx.createRadialGradient(cx, cy - 40, 20, cx, cy, Math.max(ARENA_W, ARENA_H) * 0.8);
  bg.addColorStop(0, "oklch(0.34 0.04 70)");
  bg.addColorStop(0.35, "oklch(0.24 0.03 262)");
  bg.addColorStop(0.75, "oklch(0.14 0.02 262)");
  bg.addColorStop(1, "oklch(0.06 0.02 262)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);

  // Isometric stone tile hint — diamond grid gives a subtle depth read
  ctx.save();
  ctx.strokeStyle = "oklch(0.05 0.01 262 / 0.32)";
  ctx.lineWidth = 1;
  const tile = 120;
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  ctx.beginPath();
  const N = 14;
  for (let i = -N; i <= N; i++) {
    ctx.moveTo(i * tile, -N * tile);
    ctx.lineTo(i * tile, N * tile);
    ctx.moveTo(-N * tile, i * tile);
    ctx.lineTo(N * tile, i * tile);
  }
  ctx.stroke();
  ctx.restore();

  // faint diagonal light streak — as if a shaft comes from top-left
  const streak = ctx.createLinearGradient(0, 0, ARENA_W * 0.8, ARENA_H * 0.7);
  streak.addColorStop(0, "oklch(0.9 0.1 70 / 0.06)");
  streak.addColorStop(0.5, "transparent");
  streak.addColorStop(1, "transparent");
  ctx.fillStyle = streak;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);

  // Vignette — strong at edges, focuses attention on gameplay
  const vg = ctx.createRadialGradient(cx, cy, ARENA_W * 0.3, cx, cy, ARENA_W * 0.9);
  vg.addColorStop(0, "transparent");
  vg.addColorStop(1, "oklch(0.03 0.02 260 / 0.85)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
}

function drawFloorProps(ctx: CanvasRenderingContext2D, s: GameState) {
  for (const p of s.props) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    switch (p.kind) {
      case "moss": {
        const rr = 9 * p.size;
        ctx.fillStyle = "oklch(0.32 0.09 145 / 0.42)";
        ctx.beginPath();
        ctx.ellipse(0, 0, rr, rr * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "oklch(0.44 0.14 140 / 0.4)";
        ctx.beginPath();
        ctx.ellipse(1, -1, rr * 0.55, rr * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "crack": {
        ctx.strokeStyle = "oklch(0.06 0.01 260 / 0.7)";
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(-7 * p.size, 0);
        ctx.lineTo(-2 * p.size, 1 * p.size);
        ctx.lineTo(3 * p.size, -1.2 * p.size);
        ctx.lineTo(7 * p.size, 1.6 * p.size);
        ctx.stroke();
        break;
      }
      case "grass": {
        ctx.strokeStyle = "oklch(0.55 0.15 135)";
        ctx.lineWidth = 1;
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 1.6, 2);
          ctx.lineTo(i * 1.6 + (i % 2 === 0 ? 0.5 : -0.5), -3 - Math.abs(i));
          ctx.stroke();
        }
        break;
      }
      case "pebble": {
        ctx.fillStyle = "oklch(0.34 0.02 260)";
        ctx.beginPath();
        ctx.ellipse(0, 0, 2.2 * p.size, 1.5 * p.size, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "oklch(0.5 0.02 260 / 0.6)";
        ctx.beginPath();
        ctx.ellipse(-0.6, -0.4, 1 * p.size, 0.5 * p.size, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "rock": {
        const rr = 5.5 * p.size;
        ctx.fillStyle = "oklch(0 0 0 / 0.4)";
        ctx.beginPath();
        ctx.ellipse(1.5, 2.5, rr, rr * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        const g = ctx.createLinearGradient(-rr, -rr, rr, rr);
        g.addColorStop(0, "oklch(0.58 0.02 260)");
        g.addColorStop(1, "oklch(0.26 0.02 260)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-rr, 1); ctx.lineTo(-rr * 0.4, -rr * 0.9);
        ctx.lineTo(rr * 0.6, -rr * 0.6); ctx.lineTo(rr, rr * 0.2);
        ctx.lineTo(rr * 0.2, rr * 0.7); ctx.lineTo(-rr * 0.6, rr * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "oklch(0.12 0.02 260)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
        break;
      }
      case "flower": {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          ctx.fillStyle = "oklch(0.82 0.16 30 / 0.95)";
          ctx.beginPath();
          ctx.arc(Math.cos(a) * 1.5, Math.sin(a) * 1.5, 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = "oklch(0.92 0.16 90)";
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "skull": {
        ctx.fillStyle = "oklch(0.86 0.02 80 / 0.9)";
        ctx.beginPath();
        ctx.arc(0, 0, 3 * p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-2 * p.size, 2 * p.size, 4 * p.size, 2 * p.size);
        ctx.fillStyle = "oklch(0.05 0.01 260)";
        ctx.fillRect(-1.7 * p.size, -0.4 * p.size, 1.2 * p.size, 1.2 * p.size);
        ctx.fillRect(0.5 * p.size, -0.4 * p.size, 1.2 * p.size, 1.2 * p.size);
        ctx.fillRect(-0.4 * p.size, 1.2 * p.size, 0.8 * p.size, 0.8 * p.size);
        break;
      }
    }
    ctx.restore();
  }
}

function drawWall(ctx: CanvasRenderingContext2D, w: { x: number; y: number; w: number; h: number }) {
  const H = 22; // extrusion height (fake 3D)
  // Ground shadow projected south-east
  ctx.fillStyle = "oklch(0 0 0 / 0.55)";
  ctx.beginPath();
  ctx.moveTo(w.x + 6, w.y + w.h);
  ctx.lineTo(w.x + w.w + 10, w.y + w.h);
  ctx.lineTo(w.x + w.w + 14, w.y + w.h + 12);
  ctx.lineTo(w.x + 10, w.y + w.h + 12);
  ctx.closePath();
  ctx.fill();

  // Front (south) face — visible extrusion below top face
  const front = ctx.createLinearGradient(0, w.y + w.h, 0, w.y + w.h + H);
  front.addColorStop(0, "oklch(0.28 0.03 262)");
  front.addColorStop(1, "oklch(0.12 0.02 262)");
  ctx.fillStyle = front;
  ctx.beginPath();
  ctx.moveTo(w.x, w.y + w.h);
  ctx.lineTo(w.x + w.w, w.y + w.h);
  ctx.lineTo(w.x + w.w + 3, w.y + w.h + H);
  ctx.lineTo(w.x - 3, w.y + w.h + H);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "oklch(0.04 0.02 262)"; ctx.lineWidth = 1; ctx.stroke();
  // vertical mortar hints on front face
  ctx.strokeStyle = "oklch(0.06 0.01 262 / 0.7)"; ctx.lineWidth = 0.8;
  for (let vx = w.x + 18; vx < w.x + w.w; vx += 24) {
    ctx.beginPath();
    ctx.moveTo(vx, w.y + w.h);
    ctx.lineTo(vx + 1, w.y + w.h + H);
    ctx.stroke();
  }

  // Top face (raised)
  const top = ctx.createLinearGradient(0, w.y, 0, w.y + w.h);
  top.addColorStop(0, "oklch(0.62 0.03 262)");
  top.addColorStop(1, "oklch(0.38 0.03 262)");
  ctx.fillStyle = top;
  ctx.fillRect(w.x, w.y, w.w, w.h);

  // Brick pattern on top face
  ctx.strokeStyle = "oklch(0.1 0.02 262 / 0.75)"; ctx.lineWidth = 1;
  const brickH = 14, brickW = 26;
  for (let y = w.y + brickH; y < w.y + w.h; y += brickH) {
    ctx.beginPath();
    ctx.moveTo(w.x, y + 0.5);
    ctx.lineTo(w.x + w.w, y + 0.5);
    ctx.stroke();
  }
  for (let y = w.y; y < w.y + w.h; y += brickH) {
    const off = Math.floor((y - w.y) / brickH) % 2 === 0 ? 0 : brickW / 2;
    for (let x = w.x + off + brickW; x < w.x + w.w; x += brickW) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, y);
      ctx.lineTo(x + 0.5, y + brickH);
      ctx.stroke();
    }
  }
  // top-face bevel: bright north edge, dark south edge
  ctx.fillStyle = "oklch(0.78 0.03 262 / 0.9)";
  ctx.fillRect(w.x, w.y, w.w, 2);
  ctx.fillStyle = "oklch(0.08 0.02 262 / 0.55)";
  ctx.fillRect(w.x, w.y + w.h - 2, w.w, 2);

  // moss dribble hanging off top edge (fake 3D — grows over the lip)
  if (w.w > w.h && w.w >= 60) {
    ctx.fillStyle = "oklch(0.5 0.16 140 / 0.7)";
    for (let mx = w.x + 8; mx < w.x + w.w - 8; mx += 18) {
      ctx.beginPath();
      ctx.ellipse(mx, w.y + w.h + 1, 3, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.strokeStyle = "oklch(0.05 0.02 262)"; ctx.lineWidth = 1;
  ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1);
}

function drawTorches(ctx: CanvasRenderingContext2D, s: GameState) {
  const t = s.time;
  for (const tr of s.torches) {
    const flick = Math.sin((t + tr.flicker * 100) * 0.015) * 0.5 + 0.5;
    const flick2 = Math.sin((t + tr.flicker * 137) * 0.023) * 0.5 + 0.5;
    // sconce
    ctx.fillStyle = "oklch(0.22 0.03 30)";
    ctx.beginPath();
    ctx.arc(tr.x, tr.y + 1, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "oklch(0.08 0.02 30)"; ctx.lineWidth = 0.8; ctx.stroke();
    // outer glow
    const glow = ctx.createRadialGradient(tr.x, tr.y, 2, tr.x, tr.y, 40 + flick * 6);
    glow.addColorStop(0, `oklch(0.95 0.2 70 / ${0.55 + flick * 0.2})`);
    glow.addColorStop(0.4, "oklch(0.75 0.22 45 / 0.18)");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(tr.x, tr.y, 44, 0, Math.PI * 2);
    ctx.fill();
    // flame body
    ctx.fillStyle = `oklch(0.95 0.2 80 / ${0.9 - flick * 0.15})`;
    ctx.beginPath();
    ctx.ellipse(tr.x, tr.y - 1 - flick * 1.5, 2.6, 4 + flick2, 0, 0, Math.PI * 2);
    ctx.fill();
    // inner core
    ctx.fillStyle = "oklch(0.98 0.18 45)";
    ctx.beginPath();
    ctx.ellipse(tr.x, tr.y, 1.4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSpikes(ctx: CanvasRenderingContext2D, s: GameState) {
  for (const sp of s.spikes) {
    ctx.save();
    ctx.translate(sp.pos.x, sp.pos.y);
    // shadow
    ctx.fillStyle = "oklch(0 0 0 / 0.7)";
    ctx.beginPath();
    ctx.ellipse(2, 4, sp.radius + 3, (sp.radius + 3) * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // red hazard glow ring — signals danger, pops from floor
    const dpulse = 0.6 + Math.sin(s.time * 0.006 + sp.phase) * 0.4;
    const dg = ctx.createRadialGradient(0, 0, sp.radius, 0, 0, sp.radius + 14);
    dg.addColorStop(0, `oklch(0.7 0.28 25 / ${0.28 + dpulse * 0.18})`);
    dg.addColorStop(1, "transparent");
    ctx.fillStyle = dg;
    ctx.beginPath(); ctx.arc(0, 0, sp.radius + 14, 0, Math.PI * 2); ctx.fill();
    // stone plate
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, sp.radius);
    g.addColorStop(0, "oklch(0.36 0.03 260)");
    g.addColorStop(1, "oklch(0.18 0.02 260)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, sp.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "oklch(0.06 0.02 260)"; ctx.lineWidth = 1.2; ctx.stroke();

    const wobble = Math.sin(sp.phase) * 0.15 + 0.9;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      const h = sp.radius * wobble;
      const bladeGrad = ctx.createLinearGradient(0, -h, 0, 0);
      bladeGrad.addColorStop(0, "oklch(0.98 0.03 220)");
      bladeGrad.addColorStop(1, "oklch(0.4 0.06 240)");
      ctx.fillStyle = bladeGrad;
      ctx.beginPath();
      ctx.moveTo(-2.6, 0);
      ctx.lineTo(2.6, 0);
      ctx.lineTo(0, -h);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "oklch(0.2 0.03 260)"; ctx.lineWidth = 0.5; ctx.stroke();
      ctx.restore();
    }
    // rune center
    ctx.fillStyle = "oklch(0.5 0.18 25)";
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "oklch(0.9 0.2 30 / 0.7)"; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.fillStyle = "oklch(0.15 0.05 25)";
    ctx.fillRect(-3, -0.5, 6, 1);
    ctx.fillRect(-0.5, -3, 1, 6);
    ctx.restore();
  }
}

function drawBarrel(ctx: CanvasRenderingContext2D, b: { pos: { x: number; y: number }; radius: number; alive: boolean }, time: number) {
  const R = b.radius;
  const H = 26;
  ctx.save();
  ctx.translate(b.pos.x, b.pos.y);

  ctx.fillStyle = "oklch(0 0 0 / 0.6)";
  ctx.beginPath();
  ctx.ellipse(4, R + 2, R + 4, (R + 4) * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  const rim = ctx.createRadialGradient(0, R, R, 0, R, R + 14);
  rim.addColorStop(0, "oklch(0.75 0.22 45 / 0.4)");
  rim.addColorStop(1, "transparent");
  ctx.fillStyle = rim;
  ctx.beginPath(); ctx.ellipse(0, R, R + 14, (R + 14) * 0.45, 0, 0, Math.PI * 2); ctx.fill();

  const side = ctx.createLinearGradient(-R, 0, R, 0);
  side.addColorStop(0, "oklch(0.22 0.1 30)");
  side.addColorStop(0.5, "oklch(0.6 0.19 50)");
  side.addColorStop(1, "oklch(0.22 0.1 30)");
  ctx.fillStyle = side;
  ctx.fillRect(-R, -H + R, R * 2, H);
  ctx.beginPath();
  ctx.ellipse(0, R, R, R * 0.42, 0, 0, Math.PI);
  ctx.fillStyle = "oklch(0.22 0.1 30)";
  ctx.fill();

  ctx.strokeStyle = "oklch(0.08 0.05 30 / 0.85)"; ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    const x = i * (R / 3);
    ctx.beginPath();
    ctx.moveTo(x, -H + R);
    ctx.lineTo(x, R - 1);
    ctx.stroke();
  }
  for (const hy of [-H + R + 4, 0, R - 6]) {
    ctx.strokeStyle = "oklch(0.16 0.02 260)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, hy, R, R * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "oklch(0.75 0.02 260 / 0.7)"; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.ellipse(0, hy - 1, R, R * 0.42, 0, -0.5, 0.3); ctx.stroke();
  }
  ctx.strokeStyle = "oklch(0.05 0.03 30)"; ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-R, -H + R); ctx.lineTo(-R, R - 1);
  ctx.moveTo(R, -H + R); ctx.lineTo(R, R - 1);
  ctx.stroke();

  const cap = ctx.createRadialGradient(-R * 0.3, -H + R - 2, 2, 0, -H + R, R);
  cap.addColorStop(0, "oklch(0.74 0.14 55)");
  cap.addColorStop(1, "oklch(0.32 0.12 35)");
  ctx.fillStyle = cap;
  ctx.beginPath();
  ctx.ellipse(0, -H + R, R, R * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "oklch(0.06 0.05 30)"; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.strokeStyle = "oklch(0.2 0.08 30 / 0.6)"; ctx.lineWidth = 0.6;
  for (const rr of [R * 0.35, R * 0.65]) {
    ctx.beginPath(); ctx.ellipse(-1, -H + R, rr, rr * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
  }

  const glow = 0.5 + Math.sin(time * 0.008) * 0.5;
  ctx.shadowColor = "oklch(0.95 0.22 60)"; ctx.shadowBlur = 14;
  ctx.fillStyle = `oklch(0.95 0.22 70 / ${0.8 + glow * 0.2})`;
  ctx.beginPath();
  ctx.moveTo(0, -6); ctx.lineTo(5, 4); ctx.lineTo(-5, 4);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawTrail(ctx: CanvasRenderingContext2D, s: GameState) {
  for (const t of s.trail) {
    const a = t.life / 350;
    const rr = PLAYER_R * (0.55 + a * 0.55);
    const g = ctx.createRadialGradient(t.pos.x, t.pos.y, 0, t.pos.x, t.pos.y, rr);
    g.addColorStop(0, `oklch(0.95 0.15 210 / ${a * 0.85})`);
    g.addColorStop(0.55, `oklch(0.65 0.2 220 / ${a * 0.4})`);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(t.pos.x, t.pos.y, rr, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSlamTelegraphs(ctx: CanvasRenderingContext2D, s: GameState) {
  for (const e of s.enemies) {
    if (!e.alive || e.type !== "boss" || e.slamCharge <= 0) continue;
    const maxCharge = 1600;
    const t = 1 - e.slamCharge / maxCharge;
    const r = (e.phase === 1 ? 105 : 88);
    const pulse = 0.6 + Math.sin(s.time * 0.03) * 0.4;
    const eg = ctx.createRadialGradient(e.slamPos.x, e.slamPos.y, r * 0.2, e.slamPos.x, e.slamPos.y, r);
    eg.addColorStop(0, `oklch(0.7 0.28 25 / ${0.18 + t * 0.4})`);
    eg.addColorStop(1, "transparent");
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.arc(e.slamPos.x, e.slamPos.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `oklch(0.85 0.28 25 / ${0.5 + pulse * 0.4})`;
    ctx.lineWidth = 2 + t * 3;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(e.slamPos.x, e.slamPos.y, r * (0.55 + t * 0.45), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = `oklch(0.9 0.24 25 / ${0.4 + t * 0.5})`; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(e.slamPos.x - 9, e.slamPos.y); ctx.lineTo(e.slamPos.x + 9, e.slamPos.y);
    ctx.moveTo(e.slamPos.x, e.slamPos.y - 9); ctx.lineTo(e.slamPos.x, e.slamPos.y + 9);
    ctx.stroke();
  }
}

function drawProjectiles(ctx: CanvasRenderingContext2D, s: GameState) {
  for (const pr of s.projectiles) {
    ctx.save();
    ctx.translate(pr.pos.x, pr.pos.y);
    const ang = Math.atan2(pr.vel.y, pr.vel.x);
    ctx.rotate(ang);
    ctx.strokeStyle = "oklch(0.9 0.18 55 / 0.45)";
    ctx.lineWidth = 2.2; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-4, 0); ctx.lineTo(-22, 0);
    ctx.stroke();
    ctx.strokeStyle = "oklch(0.32 0.05 40)"; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(6, 0); ctx.lineTo(-8, 0);
    ctx.stroke();
    ctx.shadowColor = "oklch(0.9 0.2 55)"; ctx.shadowBlur = 10;
    ctx.fillStyle = "oklch(0.95 0.15 70)";
    ctx.beginPath();
    ctx.moveTo(10, 0); ctx.lineTo(4, 3); ctx.lineTo(4, -3);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "oklch(0.75 0.16 55)";
    ctx.beginPath();
    ctx.moveTo(-8, 0); ctx.lineTo(-12, 3); ctx.lineTo(-10, 0); ctx.lineTo(-12, -3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/* ---------- Enemies ---------- */

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, time: number) {
  ctx.save();
  ctx.translate(e.pos.x, e.pos.y);

  // Lift character up off the ground (fake 3D standing pose)
  const lift =
    e.type === "boss" ? 16 :
    e.type === "brute" ? 12 :
    e.type === "shielder" ? 11 :
    e.type === "archer" ? 10 :
    e.type === "bomber" ? 9 :
    10;

  const shadowR = e.type === "boss" ? 38 : 19;
  const shadowH = e.type === "boss" ? 12 : 7;
  const shBob = Math.sin((time + e.id * 137) * 0.004) * 0.6;

  // Soft ground shadow (kept at ground plane, NOT lifted)
  const shGrad = ctx.createRadialGradient(2, e.type === "boss" ? 26 : 15, 2, 2, e.type === "boss" ? 26 : 15, shadowR);
  shGrad.addColorStop(0, "oklch(0 0 0 / 0.7)");
  shGrad.addColorStop(1, "oklch(0 0 0 / 0)");
  ctx.fillStyle = shGrad;
  ctx.beginPath();
  ctx.ellipse(2, e.type === "boss" ? 26 : 15, shadowR + shBob, shadowH + shBob * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Bright rim spotlight on the ground (unlifted)
  const rimR = e.type === "boss" ? 30 : 15;
  ctx.strokeStyle = e.type === "boss" ? "oklch(0.9 0.22 30 / 0.32)" : "oklch(0.92 0.14 210 / 0.26)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(0, e.type === "boss" ? 22 : 13, rimR, rimR * 0.32, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Projected body silhouette (skewed to look like a cast shadow of the standing figure)
  ctx.save();
  ctx.transform(1, 0, -0.55, 0.32, 0, 0);
  ctx.fillStyle = "oklch(0 0 0 / 0.28)";
  ctx.beginPath();
  ctx.ellipse(0, 20 + lift * 1.2, (e.type === "boss" ? 22 : 12), (e.type === "boss" ? 30 : 18), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Lift the whole character body
  ctx.translate(0, -lift);

  const flash = e.hitFlash > 0 ? Math.min(1, e.hitFlash / 200) : 0;
  switch (e.type) {
    case "grunt": drawGoblin(ctx, e, time, flash); break;
    case "brute": drawOrc(ctx, e, time, flash); break;
    case "archer": drawElfArcher(ctx, e, time, flash); break;
    case "shielder": drawKnight(ctx, e, time, flash); break;
    case "bomber": drawBombGoblin(ctx, e, time, flash); break;
    case "boss": drawWarlord(ctx, e, time, flash); break;
  }

  // Top-down rim light (screen-blend highlight streak across upper body)
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const rimGrad = ctx.createLinearGradient(0, -22, 0, 4);
  rimGrad.addColorStop(0, "oklch(0.98 0.08 90 / 0.45)");
  rimGrad.addColorStop(0.5, "oklch(0.9 0.08 90 / 0.12)");
  rimGrad.addColorStop(1, "transparent");
  ctx.fillStyle = rimGrad;
  const rr = e.type === "boss" ? 22 : 12;
  ctx.beginPath();
  ctx.ellipse(-2, -8, rr, rr * 1.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const r = enemyRadius(e.type);
  if (e.type !== "boss" && e.hp > 1) {
    for (let i = 0; i < e.hp; i++) {
      ctx.fillStyle = "oklch(0.7 0.22 20)";
      ctx.beginPath();
      ctx.arc(-((e.hp - 1) * 2.5) + i * 5, -r - 9, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "oklch(0.1 0.05 20)"; ctx.lineWidth = 0.6; ctx.stroke();
    }
  }
  ctx.restore();
}

function bob(time: number, seed: number) {
  return Math.sin((time + seed * 137) * 0.004) * 1.3;
}

function drawGoblin(ctx: CanvasRenderingContext2D, e: Enemy, time: number, flash: number) {
  ctx.save();
  ctx.translate(0, bob(time, e.id));
  ctx.rotate(e.facing + Math.PI / 2);
  // body
  ctx.fillStyle = flash > 0 ? "oklch(0.98 0.05 145)" : "oklch(0.48 0.14 145)";
  ctx.beginPath(); ctx.ellipse(0, 2, 9, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "oklch(0.14 0.06 145)"; ctx.lineWidth = 1.2; ctx.stroke();
  // shoulder pads (leather)
  ctx.fillStyle = "oklch(0.32 0.06 40)";
  ctx.beginPath(); ctx.arc(-8, -1, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(8, -1, 3, 0, Math.PI * 2); ctx.fill();
  // dagger
  ctx.save();
  ctx.translate(8, -6); ctx.rotate(-0.35);
  ctx.fillStyle = "oklch(0.3 0.05 40)"; ctx.fillRect(-1, 0, 2, 4);
  ctx.fillStyle = "oklch(0.92 0.05 210)";
  ctx.beginPath();
  ctx.moveTo(-1.4, -9); ctx.lineTo(1.4, -9); ctx.lineTo(0.7, 0); ctx.lineTo(-0.7, 0);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "oklch(0.3 0.05 220)"; ctx.lineWidth = 0.5; ctx.stroke();
  ctx.restore();
  // head
  ctx.fillStyle = flash > 0 ? "oklch(0.98 0.05 145)" : "oklch(0.58 0.16 140)";
  ctx.beginPath(); ctx.arc(0, -7, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "oklch(0.16 0.06 145)"; ctx.lineWidth = 1; ctx.stroke();
  // pointed ears
  ctx.fillStyle = flash > 0 ? "oklch(0.9 0.05 145)" : "oklch(0.5 0.15 140)";
  ctx.beginPath(); ctx.moveTo(-5, -8); ctx.lineTo(-9, -11); ctx.lineTo(-4.5, -6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(5, -8); ctx.lineTo(9, -11); ctx.lineTo(4.5, -6); ctx.closePath(); ctx.fill();
  // eyes
  ctx.fillStyle = flash > 0 ? "oklch(0.2 0.05 40)" : "oklch(0.95 0.2 90)";
  ctx.beginPath(); ctx.arc(-1.8, -8, 0.9, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(1.8, -8, 0.9, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawOrc(ctx: CanvasRenderingContext2D, e: Enemy, time: number, flash: number) {
  ctx.save();
  ctx.translate(0, bob(time, e.id) * 1.4);
  ctx.rotate(e.facing + Math.PI / 2);
  // body
  ctx.fillStyle = flash > 0 ? "oklch(0.98 0.05 320)" : "oklch(0.42 0.1 320)";
  ctx.beginPath(); ctx.ellipse(0, 3, 13, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "oklch(0.1 0.05 320)"; ctx.lineWidth = 1.5; ctx.stroke();
  // pauldrons + spikes
  ctx.fillStyle = "oklch(0.28 0.05 30)";
  ctx.beginPath(); ctx.arc(-11, -2, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(11, -2, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "oklch(0.85 0.04 260)";
  for (const sx of [-11, 11]) {
    ctx.beginPath();
    ctx.moveTo(sx - 2, -5); ctx.lineTo(sx, -9); ctx.lineTo(sx + 2, -5);
    ctx.closePath(); ctx.fill();
  }
  // mace
  ctx.save();
  ctx.translate(11, -6); ctx.rotate(-0.2);
  ctx.strokeStyle = "oklch(0.28 0.06 40)"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -12); ctx.stroke();
  ctx.fillStyle = "oklch(0.42 0.03 260)";
  ctx.beginPath(); ctx.arc(0, -14, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "oklch(0.78 0.04 260)";
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 5, -14 + Math.sin(a) * 5);
    ctx.lineTo(Math.cos(a) * 8, -14 + Math.sin(a) * 8);
    ctx.lineTo(Math.cos(a + 0.35) * 5, -14 + Math.sin(a + 0.35) * 5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // head
  ctx.fillStyle = flash > 0 ? "oklch(0.98 0.05 320)" : "oklch(0.5 0.15 320)";
  ctx.beginPath(); ctx.arc(0, -9, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "oklch(0.12 0.06 320)"; ctx.lineWidth = 1; ctx.stroke();
  // tusks
  ctx.fillStyle = "oklch(0.92 0.03 80)";
  ctx.beginPath(); ctx.moveTo(-2.5, -6); ctx.lineTo(-3.5, -3); ctx.lineTo(-1.8, -5.5); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(2.5, -6); ctx.lineTo(3.5, -3); ctx.lineTo(1.8, -5.5); ctx.closePath(); ctx.fill();
  // red eyes
  ctx.shadowColor = "oklch(0.85 0.24 25)"; ctx.shadowBlur = 6;
  ctx.fillStyle = flash > 0 ? "oklch(0.15 0.05 320)" : "oklch(0.8 0.24 25)";
  ctx.beginPath(); ctx.arc(-2, -10, 1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(2, -10, 1, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawElfArcher(ctx: CanvasRenderingContext2D, e: Enemy, time: number, flash: number) {
  ctx.save();
  ctx.translate(0, bob(time, e.id));
  ctx.rotate(e.facing + Math.PI / 2);
  // cape
  ctx.fillStyle = "oklch(0.28 0.08 155)";
  ctx.beginPath();
  ctx.moveTo(-8, -2); ctx.quadraticCurveTo(0, 14, 8, -2); ctx.quadraticCurveTo(0, 18, -8, -2);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "oklch(0.12 0.05 155)"; ctx.lineWidth = 0.8; ctx.stroke();
  // Quiver on back with visible arrows — instant "archer" read
  ctx.save();
  ctx.translate(-5, 5); ctx.rotate(-0.4);
  ctx.fillStyle = "oklch(0.32 0.08 40)";
  ctx.fillRect(-2.2, -6, 4.4, 10);
  ctx.strokeStyle = "oklch(0.12 0.05 40)"; ctx.lineWidth = 0.8; ctx.strokeRect(-2.2, -6, 4.4, 10);
  // arrow fletchings
  for (const ox of [-1.2, 0, 1.2]) {
    ctx.fillStyle = "oklch(0.85 0.16 25)";
    ctx.beginPath();
    ctx.moveTo(ox - 0.8, -6); ctx.lineTo(ox + 0.8, -6); ctx.lineTo(ox, -9);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // body
  ctx.fillStyle = flash > 0 ? "oklch(0.98 0.05 155)" : "oklch(0.42 0.1 155)";
  ctx.beginPath(); ctx.ellipse(0, 1, 7, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "oklch(0.15 0.05 155)"; ctx.lineWidth = 1; ctx.stroke();
  // Bow — larger, held in front
  ctx.save();
  ctx.translate(0, -11);
  ctx.strokeStyle = flash > 0 ? "oklch(0.98 0.05 210)" : "oklch(0.72 0.16 55)";
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(0, 0, 11, -Math.PI * 0.42, Math.PI * 0.42);
  ctx.stroke();
  // bow tips
  ctx.fillStyle = "oklch(0.35 0.08 40)";
  ctx.beginPath(); ctx.arc(11 * Math.cos(-Math.PI * 0.42), 11 * Math.sin(-Math.PI * 0.42), 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(11 * Math.cos(Math.PI * 0.42), 11 * Math.sin(Math.PI * 0.42), 1.2, 0, Math.PI * 2); ctx.fill();
  // string
  ctx.strokeStyle = "oklch(0.94 0.02 240 / 0.9)"; ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(11 * Math.cos(-Math.PI * 0.42), 11 * Math.sin(-Math.PI * 0.42));
  ctx.lineTo(11 * Math.cos(Math.PI * 0.42), 11 * Math.sin(Math.PI * 0.42));
  ctx.stroke();
  // nocked arrow if close to firing
  if (e.shootCd < 500) {
    ctx.fillStyle = "oklch(0.88 0.05 60)";
    ctx.fillRect(-0.7, -14, 1.4, 14);
    ctx.fillStyle = "oklch(0.9 0.18 30)";
    ctx.beginPath();
    ctx.moveTo(-2, -14); ctx.lineTo(2, -14); ctx.lineTo(0, -19); ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // hood
  ctx.fillStyle = "oklch(0.24 0.08 155)";
  ctx.beginPath(); ctx.arc(0, -6, 5.8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "oklch(0.1 0.05 155)"; ctx.lineWidth = 1; ctx.stroke();
  // hood peak
  ctx.fillStyle = "oklch(0.18 0.06 155)";
  ctx.beginPath();
  ctx.moveTo(-5, -8); ctx.lineTo(0, -13); ctx.lineTo(5, -8); ctx.quadraticCurveTo(0, -5, -5, -8);
  ctx.closePath(); ctx.fill();
  // glowing eyes
  ctx.shadowColor = "oklch(0.95 0.2 90)"; ctx.shadowBlur = 6;
  ctx.fillStyle = flash > 0 ? "oklch(0.15 0.05 155)" : "oklch(0.95 0.2 90)";
  ctx.beginPath(); ctx.arc(-1.5, -6, 0.8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(1.5, -6, 0.8, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawKnight(ctx: CanvasRenderingContext2D, e: Enemy, time: number, flash: number) {
  ctx.save();
  ctx.translate(0, bob(time, e.id) * 0.6);
  ctx.rotate(e.facing + Math.PI / 2);
  // armor body
  const bg = ctx.createLinearGradient(-10, 0, 10, 0);
  bg.addColorStop(0, flash > 0 ? "oklch(0.98 0.02 260)" : "oklch(0.55 0.04 260)");
  bg.addColorStop(1, flash > 0 ? "oklch(0.82 0.02 260)" : "oklch(0.3 0.04 260)");
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.ellipse(0, 2, 10, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "oklch(0.08 0.03 260)"; ctx.lineWidth = 1.5; ctx.stroke();
  // chest cross
  ctx.strokeStyle = "oklch(0.85 0.16 80 / 0.9)"; ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(0, -3); ctx.lineTo(0, 9);
  ctx.moveTo(-4, 2); ctx.lineTo(4, 2);
  ctx.stroke();
  // sword sheathed
  ctx.save();
  ctx.translate(-8, 5); ctx.rotate(0.3);
  ctx.fillStyle = "oklch(0.4 0.05 40)"; ctx.fillRect(-1, 0, 2, 4);
  ctx.fillStyle = "oklch(0.9 0.05 210)";
  ctx.beginPath();
  ctx.moveTo(-1.2, -10); ctx.lineTo(1.2, -10); ctx.lineTo(0.7, 0); ctx.lineTo(-0.7, 0);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  // shield in front — oversized tower shield, dominant silhouette
  ctx.save();
  ctx.translate(0, -15);
  // shield drop-shadow behind
  ctx.fillStyle = "oklch(0 0 0 / 0.5)";
  ctx.beginPath();
  ctx.moveTo(-14, -6); ctx.lineTo(14, -6); ctx.lineTo(14, 4);
  ctx.quadraticCurveTo(0, 18, -14, 4);
  ctx.closePath(); ctx.fill();
  const shieldGrd = ctx.createLinearGradient(-13, 0, 13, 0);
  shieldGrd.addColorStop(0, flash > 0 ? "oklch(0.98 0.05 210)" : "oklch(0.75 0.16 240)");
  shieldGrd.addColorStop(0.5, flash > 0 ? "oklch(0.95 0.05 210)" : "oklch(0.55 0.14 240)");
  shieldGrd.addColorStop(1, flash > 0 ? "oklch(0.85 0.05 210)" : "oklch(0.3 0.1 245)");
  ctx.fillStyle = shieldGrd;
  ctx.beginPath();
  ctx.moveTo(-13, -6); ctx.lineTo(13, -6); ctx.lineTo(13, 4);
  ctx.quadraticCurveTo(0, 17, -13, 4);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "oklch(0.06 0.04 240)"; ctx.lineWidth = 2; ctx.stroke();
  // gold rim studs
  ctx.fillStyle = "oklch(0.92 0.16 80)";
  for (const rx of [-9, -3, 3, 9]) {
    ctx.beginPath();
    ctx.arc(rx, -4, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // large gold emblem — clear identity
  ctx.shadowColor = "oklch(0.9 0.18 70)"; ctx.shadowBlur = 6;
  ctx.fillStyle = "oklch(0.94 0.18 80)";
  ctx.beginPath();
  ctx.moveTo(0, -3); ctx.lineTo(5, 4); ctx.lineTo(0, 10); ctx.lineTo(-5, 4);
  ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
  // helm
  ctx.fillStyle = flash > 0 ? "oklch(0.98 0.02 260)" : "oklch(0.42 0.04 260)";
  ctx.beginPath(); ctx.arc(0, -3, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "oklch(0.08 0.03 260)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = "oklch(0.04 0.02 260)";
  ctx.fillRect(-3.5, -4, 7, 1.4);
  // plume
  ctx.fillStyle = "oklch(0.68 0.22 25)";
  ctx.beginPath();
  ctx.moveTo(0, -9); ctx.lineTo(-2, -3); ctx.lineTo(2, -3);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawBombGoblin(ctx: CanvasRenderingContext2D, e: Enemy, time: number, flash: number) {
  const armed = e.fuse > 0;
  ctx.save();
  ctx.translate(0, bob(time, e.id) * (armed ? 0.4 : 1.5));
  ctx.rotate(e.facing + Math.PI / 2);
  // body
  ctx.fillStyle = flash > 0 ? "oklch(0.98 0.05 40)" : (armed ? "oklch(0.65 0.24 25)" : "oklch(0.5 0.15 55)");
  ctx.beginPath(); ctx.ellipse(0, 2, 7, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "oklch(0.15 0.06 40)"; ctx.lineWidth = 1; ctx.stroke();
  // bomb — oversized, held above head so silhouette reads "bomber" instantly
  ctx.save();
  ctx.translate(0, -11);
  // bomb shadow on body
  ctx.fillStyle = "oklch(0 0 0 / 0.35)";
  ctx.beginPath(); ctx.ellipse(1.5, 8, 8, 2.4, 0, 0, Math.PI * 2); ctx.fill();
  // main sphere
  const bombGrd = ctx.createRadialGradient(-3, -3, 1, 0, 0, 9);
  bombGrd.addColorStop(0, "oklch(0.32 0.02 260)");
  bombGrd.addColorStop(1, "oklch(0.08 0.02 260)");
  ctx.fillStyle = bombGrd;
  ctx.beginPath(); ctx.arc(0, 0, 8.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = armed ? "oklch(0.85 0.28 25 / 0.9)" : "oklch(0.55 0.02 260)";
  ctx.lineWidth = 1.4; ctx.stroke();
  // hilight
  ctx.fillStyle = "oklch(0.6 0.02 260 / 0.7)";
  ctx.beginPath(); ctx.arc(-3, -3, 2, 0, Math.PI * 2); ctx.fill();
  // fuse cap
  ctx.fillStyle = "oklch(0.4 0.03 260)";
  ctx.fillRect(-1.6, -10, 3.2, 2.4);
  // fuse rope
  const rate = armed ? 0.05 : 0.02;
  const pulse = 0.5 + Math.sin(time * rate) * 0.5;
  const col = armed ? "oklch(0.78 0.28 25)" : "oklch(0.95 0.2 80)";
  ctx.strokeStyle = "oklch(0.42 0.05 40)"; ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -10); ctx.quadraticCurveTo(5, -14, 3, -17); ctx.stroke();
  // spark
  ctx.shadowColor = col; ctx.shadowBlur = 14 + pulse * 10;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(3, -17, 2.2 + pulse * (armed ? 1.8 : 0.9), 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
  // head
  ctx.fillStyle = flash > 0 ? "oklch(0.98 0.05 40)" : "oklch(0.55 0.16 60)";
  ctx.beginPath(); ctx.arc(0, -5, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "oklch(0.18 0.06 40)"; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.fillStyle = "oklch(0.95 0.2 90)";
  ctx.beginPath(); ctx.arc(-1.3, -5, 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(1.3, -5, 0.7, 0, Math.PI * 2); ctx.fill();
  if (armed) {
    const r = enemyRadius(e.type);
    ctx.strokeStyle = `oklch(0.8 0.26 30 / ${0.4 + pulse * 0.55})`;
    ctx.lineWidth = 1.5 + pulse;
    ctx.beginPath();
    ctx.arc(0, 0, r + 6 + pulse * 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawWarlord(ctx: CanvasRenderingContext2D, e: Enemy, time: number, flash: number) {
  const enraged = e.phase === 1;
  ctx.save();
  ctx.translate(0, bob(time, e.id) * 0.5);
  ctx.rotate(e.facing + Math.PI / 2);
  // cape
  ctx.fillStyle = enraged ? "oklch(0.28 0.15 25)" : "oklch(0.16 0.06 300)";
  ctx.beginPath();
  ctx.moveTo(-16, 4); ctx.quadraticCurveTo(0, 28, 16, 4); ctx.quadraticCurveTo(0, 34, -16, 4);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "oklch(0.05 0.05 300)"; ctx.lineWidth = 1; ctx.stroke();
  // torso
  const bg = ctx.createRadialGradient(-6, -6, 4, 0, 0, 24);
  if (enraged) {
    bg.addColorStop(0, flash > 0 ? "oklch(0.98 0.05 25)" : "oklch(0.5 0.2 25)");
    bg.addColorStop(1, "oklch(0.2 0.1 20)");
  } else {
    bg.addColorStop(0, flash > 0 ? "oklch(0.98 0.02 260)" : "oklch(0.44 0.06 300)");
    bg.addColorStop(1, "oklch(0.14 0.04 300)");
  }
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.ellipse(0, 3, 18, 20, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "oklch(0.05 0.03 300)"; ctx.lineWidth = 2; ctx.stroke();
  // pauldrons + spikes
  for (const sx of [-16, 16]) {
    ctx.fillStyle = "oklch(0.26 0.05 300)";
    ctx.beginPath(); ctx.arc(sx, -3, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "oklch(0.05 0.03 300)"; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = enraged ? "oklch(0.78 0.24 30)" : "oklch(0.82 0.05 260)";
    for (const off of [-4, 0, 4]) {
      ctx.beginPath();
      ctx.moveTo(sx + off - 1.5, -8);
      ctx.lineTo(sx + off, -13);
      ctx.lineTo(sx + off + 1.5, -8);
      ctx.closePath(); ctx.fill();
    }
  }
  // chest emblem
  ctx.shadowColor = enraged ? "oklch(0.75 0.28 25)" : "oklch(0.85 0.18 60)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = enraged ? "oklch(0.85 0.28 25)" : "oklch(0.9 0.2 70)";
  ctx.beginPath();
  ctx.moveTo(0, -4); ctx.lineTo(6, 4); ctx.lineTo(0, 10); ctx.lineTo(-6, 4);
  ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  // greatsword forward
  ctx.save();
  ctx.translate(0, -20);
  ctx.fillStyle = "oklch(0.26 0.05 40)"; ctx.fillRect(-2, 0, 4, 8);
  ctx.fillStyle = "oklch(0.75 0.16 55)"; ctx.fillRect(-8, -2, 16, 3);
  const bladeGrad = ctx.createLinearGradient(0, -2, 0, -34);
  bladeGrad.addColorStop(0, enraged ? "oklch(0.98 0.1 30)" : "oklch(0.98 0.05 210)");
  bladeGrad.addColorStop(1, enraged ? "oklch(0.5 0.2 20)" : "oklch(0.55 0.12 220)");
  ctx.fillStyle = bladeGrad;
  ctx.beginPath();
  ctx.moveTo(-4, -2); ctx.lineTo(4, -2); ctx.lineTo(2, -32); ctx.lineTo(0, -38); ctx.lineTo(-2, -32);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "oklch(0.12 0.05 220)"; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.strokeStyle = enraged ? "oklch(0.5 0.15 25 / 0.5)" : "oklch(0.4 0.08 220 / 0.5)";
  ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(0, -34); ctx.stroke();
  ctx.fillStyle = enraged ? "oklch(0.95 0.2 30 / 0.4)" : "oklch(0.88 0.14 210 / 0.35)";
  ctx.beginPath(); ctx.ellipse(0, -36, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // helm
  ctx.fillStyle = flash > 0 ? "oklch(0.98 0.02 260)" : (enraged ? "oklch(0.32 0.15 25)" : "oklch(0.26 0.05 300)");
  ctx.beginPath(); ctx.arc(0, -5, 9, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "oklch(0.04 0.03 300)"; ctx.lineWidth = 1.2; ctx.stroke();
  // crown horns
  ctx.fillStyle = enraged ? "oklch(0.7 0.24 25)" : "oklch(0.85 0.05 260)";
  for (let i = -2; i <= 2; i++) {
    const ang = -Math.PI / 2 + (i / 5) * Math.PI * 0.9;
    const bx = Math.cos(ang) * 9;
    const by = Math.sin(ang) * 9 - 5;
    ctx.beginPath();
    ctx.moveTo(bx - 1.5, by);
    ctx.lineTo(bx + Math.cos(ang) * 8, by + Math.sin(ang) * 8);
    ctx.lineTo(bx + 1.5, by);
    ctx.closePath(); ctx.fill();
  }
  // glowing visor slits
  ctx.shadowColor = enraged ? "oklch(0.9 0.28 25)" : "oklch(0.9 0.24 60)";
  ctx.shadowBlur = 10;
  ctx.fillStyle = enraged ? "oklch(0.95 0.28 25)" : "oklch(0.92 0.24 60)";
  ctx.fillRect(-5, -5.5, 3, 1.6);
  ctx.fillRect(2, -5.5, 3, 1.6);
  ctx.shadowBlur = 0;
  ctx.restore();

  // rune ring
  ctx.strokeStyle = enraged ? "oklch(0.75 0.28 25 / 0.5)" : "oklch(0.85 0.18 60 / 0.4)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 7]);
  ctx.beginPath();
  ctx.arc(0, 0, 34, (time * 0.001) % (Math.PI * 2), (time * 0.001) % (Math.PI * 2) + Math.PI * 1.5);
  ctx.stroke();
  ctx.setLineDash([]);

  // HP bar
  const barW = 76;
  const pct = Math.max(0, e.hp / e.maxHp);
  ctx.fillStyle = "oklch(0.08 0.03 265 / 0.9)";
  ctx.fillRect(-barW / 2 - 2, -46, barW + 4, 8);
  const hpGrad = ctx.createLinearGradient(-barW / 2, 0, barW / 2, 0);
  if (enraged) {
    hpGrad.addColorStop(0, "oklch(0.78 0.28 25)");
    hpGrad.addColorStop(1, "oklch(0.6 0.24 15)");
  } else {
    hpGrad.addColorStop(0, "oklch(0.9 0.12 210)");
    hpGrad.addColorStop(1, "oklch(0.72 0.22 35)");
  }
  ctx.fillStyle = hpGrad;
  ctx.fillRect(-barW / 2, -44, barW * pct, 4);
  ctx.strokeStyle = "oklch(0.85 0.16 80 / 0.8)"; ctx.lineWidth = 0.6;
  ctx.strokeRect(-barW / 2 - 2, -46, barW + 4, 8);
}

/* ---------- Player ---------- */

function drawPlayer(ctx: CanvasRenderingContext2D, s: GameState) {
  const p = s.player;
  ctx.save();
  ctx.translate(p.pos.x, p.pos.y);

  const lift = p.dashing ? 8 : 12;

  // Soft ground shadow
  const shGrad = ctx.createRadialGradient(2, 16, 2, 2, 16, 20);
  shGrad.addColorStop(0, "oklch(0 0 0 / 0.7)");
  shGrad.addColorStop(1, "oklch(0 0 0 / 0)");
  ctx.fillStyle = shGrad;
  ctx.beginPath();
  ctx.ellipse(2, 16, 18, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Projected body silhouette
  ctx.save();
  ctx.transform(1, 0, -0.55, 0.32, 0, 0);
  ctx.fillStyle = "oklch(0 0 0 / 0.3)";
  ctx.beginPath();
  ctx.ellipse(0, 22 + lift * 1.2, 13, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Lift character up
  ctx.translate(0, -lift);

  const flicker = p.invuln > 0 && Math.floor(p.invuln / 60) % 2 === 0 ? 0.4 : 1;
  ctx.globalAlpha = flicker;

  const auraR = 28 + Math.sin(s.time * 0.004) * 2;
  const aura = ctx.createRadialGradient(0, 0, 8, 0, 0, auraR);
  aura.addColorStop(0, "oklch(0.9 0.15 210 / 0.4)");
  aura.addColorStop(1, "transparent");
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, auraR, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(p.facing + Math.PI / 2);

  // Cape (behind)
  const capeSway = Math.sin(s.time * 0.005) * 2;
  ctx.fillStyle = "oklch(0.4 0.16 25)";
  ctx.beginPath();
  ctx.moveTo(-10, 3);
  ctx.quadraticCurveTo(capeSway, 22, 10, 3);
  ctx.quadraticCurveTo(0, 26 + capeSway, -10, 3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "oklch(0.2 0.1 20)"; ctx.lineWidth = 1; ctx.stroke();

  // Body armor
  const bg = ctx.createRadialGradient(-4, -4, 4, 0, 0, 14);
  bg.addColorStop(0, "oklch(0.97 0.04 250)");
  bg.addColorStop(1, "oklch(0.42 0.08 250)");
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.ellipse(0, 1, 10, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "oklch(0.12 0.05 250)"; ctx.lineWidth = 1.4; ctx.stroke();
  // belt
  ctx.strokeStyle = "oklch(0.35 0.1 40)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-8, 4); ctx.lineTo(8, 4); ctx.stroke();
  ctx.fillStyle = "oklch(0.88 0.16 80)"; ctx.fillRect(-1.5, 3, 3, 2);
  // pauldrons
  ctx.fillStyle = "oklch(0.3 0.06 250)";
  ctx.beginPath(); ctx.arc(-9, -2, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(9, -2, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "oklch(0.88 0.16 80)";
  ctx.beginPath(); ctx.arc(-9, -2, 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(9, -2, 1.2, 0, Math.PI * 2); ctx.fill();

  // Hooded head
  ctx.fillStyle = "oklch(0.26 0.06 250)";
  ctx.beginPath(); ctx.arc(0, -6, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "oklch(0.1 0.05 250)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = "oklch(0.2 0.06 250)";
  ctx.beginPath();
  ctx.moveTo(-6, -9); ctx.lineTo(0, -14); ctx.lineTo(6, -9);
  ctx.quadraticCurveTo(0, -6, -6, -9); ctx.closePath();
  ctx.fill();
  // glowing eyes
  ctx.shadowColor = "oklch(0.88 0.14 210)"; ctx.shadowBlur = 8;
  ctx.fillStyle = "oklch(0.95 0.12 210)";
  ctx.beginPath(); ctx.arc(-2, -6, 0.9, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(2, -6, 0.9, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  if (!p.dashing) {
    // Sword planted in the ground in front
    const sway = Math.sin(s.time * 0.002) * 0.03;
    ctx.save();
    ctx.rotate(sway);
    ctx.fillStyle = "oklch(0.4 0.08 40)"; ctx.fillRect(-1.5, 8, 3, 8);
    ctx.fillStyle = "oklch(0.88 0.16 80)";
    ctx.beginPath(); ctx.arc(0, 8, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "oklch(0.88 0.16 80)"; ctx.fillRect(-7, 15, 14, 3);
    ctx.strokeStyle = "oklch(0.32 0.1 40)"; ctx.lineWidth = 0.8;
    ctx.strokeRect(-7, 15, 14, 3);
    const bg2 = ctx.createLinearGradient(0, 18, 0, 44);
    bg2.addColorStop(0, "oklch(0.98 0.04 210)");
    bg2.addColorStop(0.6, "oklch(0.75 0.06 220)");
    bg2.addColorStop(1, "oklch(0.38 0.1 220)");
    ctx.fillStyle = bg2;
    ctx.beginPath();
    ctx.moveTo(-3.5, 18); ctx.lineTo(3.5, 18);
    ctx.lineTo(1, 44); ctx.lineTo(-1, 44);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "oklch(0.35 0.08 220 / 0.6)"; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(0, 19); ctx.lineTo(0, 42); ctx.stroke();
    const tipGlow = 0.5 + Math.sin(s.time * 0.005) * 0.5;
    ctx.shadowColor = "oklch(0.88 0.14 210)"; ctx.shadowBlur = 14;
    ctx.fillStyle = `oklch(0.88 0.14 210 / ${0.5 + tipGlow * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(0, 44, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  } else {
    // Sword held forward in dash
    ctx.fillStyle = "oklch(0.4 0.08 40)"; ctx.fillRect(-1.5, -8, 3, 8);
    ctx.fillStyle = "oklch(0.88 0.16 80)"; ctx.fillRect(-7, -12, 14, 3);
    const bg3 = ctx.createLinearGradient(0, -12, 0, -40);
    bg3.addColorStop(0, "oklch(0.98 0.04 210)");
    bg3.addColorStop(1, "oklch(0.55 0.1 220)");
    ctx.fillStyle = bg3;
    ctx.beginPath();
    ctx.moveTo(-4, -12); ctx.lineTo(4, -12);
    ctx.lineTo(1, -38); ctx.lineTo(0, -42); ctx.lineTo(-1, -38);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "oklch(0.15 0.05 220)"; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.shadowColor = "oklch(0.88 0.14 210)"; ctx.shadowBlur = 18;
    ctx.strokeStyle = "oklch(0.9 0.14 210 / 0.6)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, -42); ctx.stroke();
    ctx.shadowBlur = 0;
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

/* ---------- Slashes / Particles / Explosions ---------- */

function drawSlashes(ctx: CanvasRenderingContext2D, s: GameState) {
  for (const sl of s.slashes) {
    const a = sl.life / sl.max;
    const cx = (sl.a.x + sl.b.x) / 2;
    const cy = (sl.a.y + sl.b.y) / 2;
    const dx = sl.b.x - sl.a.x;
    const dy = sl.b.y - sl.a.y;
    const len = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.shadowColor = "oklch(0.88 0.14 210)";
    ctx.shadowBlur = 26 * a;
    ctx.strokeStyle = `oklch(0.98 0.05 210 / ${a})`;
    ctx.lineWidth = 6 * a + 1;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, 0, len / 2, -Math.PI * 0.55, Math.PI * 0.55);
    ctx.stroke();
    ctx.strokeStyle = `oklch(1 0 0 / ${a * 0.9})`;
    ctx.lineWidth = 2 * a + 0.4;
    ctx.beginPath();
    ctx.arc(0, 0, len / 2, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, s: GameState) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of s.particles) {
    const a = Math.max(0, Math.min(1, p.life / p.max));
    const glow = p.glow ?? 8;
    ctx.globalAlpha = a;
    if (glow > 0) {
      ctx.shadowColor = p.color;
      ctx.shadowBlur = glow;
    } else {
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawExplosions(ctx: CanvasRenderingContext2D, s: GameState) {
  for (const ex of s.explosions) {
    const a = ex.life / ex.max;
    const rr = ex.radius * (1.05 - a);
    // shockwave ring
    ctx.strokeStyle = `oklch(0.98 0.15 80 / ${a})`;
    ctx.lineWidth = 2 + (1 - a) * 4;
    ctx.beginPath();
    ctx.arc(ex.pos.x, ex.pos.y, rr, 0, Math.PI * 2);
    ctx.stroke();
    const eg = ctx.createRadialGradient(ex.pos.x, ex.pos.y, 0, ex.pos.x, ex.pos.y, rr);
    eg.addColorStop(0, `oklch(0.98 0.16 80 / ${a})`);
    eg.addColorStop(0.5, `oklch(0.72 0.24 35 / ${a * 0.7})`);
    eg.addColorStop(1, "transparent");
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.arc(ex.pos.x, ex.pos.y, rr, 0, Math.PI * 2);
    ctx.fill();
  }
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
  ctx.strokeStyle = "oklch(0.88 0.12 210 / 0.22)";
  ctx.lineWidth = 24;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(tx, ty);
  ctx.stroke();

  ctx.strokeStyle = "oklch(0.98 0.05 210)";
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
  ctx.shadowColor = "oklch(0.88 0.14 210)"; ctx.shadowBlur = 12;
  ctx.fillStyle = "oklch(0.98 0.05 210)";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-16, -9);
  ctx.lineTo(-11, 0);
  ctx.lineTo(-16, 9);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();

  ctx.strokeStyle = "oklch(0.85 0.18 55 / 0.65)";
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
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
