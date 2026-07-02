import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/play")({
  component: PlayPage,
});

/* ---------- Types ---------- */
type Vec = { x: number; y: number };
type Enemy = {
  id: number;
  pos: Vec;
  vel: Vec;
  hp: number;
  alive: boolean;
  hitFlash: number;
  type: "grunt" | "brute";
};
type Wall = { x: number; y: number; w: number; h: number };
type Barrel = { pos: Vec; alive: boolean; radius: number };
type Spike = { pos: Vec; radius: number; phase: number };
type Slash = { a: Vec; b: Vec; life: number; max: number };
type TrailDot = { pos: Vec; life: number };
type Particle = { pos: Vec; vel: Vec; life: number; max: number; color: string; size: number };
type Explosion = { pos: Vec; life: number; max: number; radius: number };

/* ---------- Constants ---------- */
const ARENA_W = 440;
const ARENA_H = 780;
const PLAYER_R = 16;
const DASH_SPEED = 1400; // px/s during dash
const DASH_MAX_LEN = 280;
const SLOWMO_FACTOR = 0.08;
const NORMAL_TIME_AFTER_DASH_MS = 220; // brief real-time window during dash

function PlayPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const [hp, setHp] = useState(3);
  const [gold, setGold] = useState(0);
  const [paused, setPaused] = useState(false);
  const [victory, setVictory] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  // Init game
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

    const state: GameState = createInitialState();
    stateRef.current = state;

    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dtMs = Math.min(50, t - last);
      last = t;
      if (!paused && !victory) {
        step(state, dtMs);
        setHp(state.player.hp);
        setGold(state.gold);
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
      if (paused || victory) return;
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
    const up = (e: PointerEvent) => {
      if (!state.aiming) return;
      state.aiming = false;
      const p = state.player.pos;
      const dir = { x: state.aimCurrent.x - state.aimStart.x, y: state.aimCurrent.y - state.aimStart.y };
      const len = Math.hypot(dir.x, dir.y);
      if (len < 12) return;
      const nx = dir.x / len;
      const ny = dir.y / len;
      // Dash away from drag direction feels like a slingshot. We use drag direction as dash direction (natural).
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
  }, [paused, victory]);

  const restart = () => {
    stateRef.current = createInitialState();
    setHp(3);
    setGold(0);
    setVictory(false);
    setPaused(false);
  };

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden flex items-center justify-center bg-black">
      <div
        className="relative w-full h-full max-w-[440px] mx-auto"
        style={{ background: "var(--gradient-sky)" }}
      >
        {/* Canvas fills the arena */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none"
          style={{ display: "block" }}
        />

        {/* HUD */}
        <div className="absolute top-0 left-0 right-0 z-10 px-4 pt-4 flex items-start justify-between pointer-events-none">
          {/* HP */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border"
              style={{
                background: "oklch(0.15 0.03 265 / 0.75)",
                borderColor: "var(--border)",
                backdropFilter: "blur(8px)",
              }}
            >
              {Array.from({ length: 3 }).map((_, i) => (
                <HeartIcon key={i} filled={i < hp} />
              ))}
            </div>
          </div>

          {/* Gold */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border pointer-events-auto"
            style={{
              background: "oklch(0.15 0.03 265 / 0.75)",
              borderColor: "var(--border)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              className="w-4 h-4 rounded-full"
              style={{ background: "var(--gradient-gold)", boxShadow: "0 0 10px var(--gold)" }}
            />
            <span className="font-display text-sm tracking-widest" style={{ color: "var(--gold)" }}>
              {String(gold).padStart(3, "0")}
            </span>
          </div>

          {/* Pause */}
          <button
            onClick={() => setPaused((p) => !p)}
            className="flex items-center justify-center w-10 h-10 rounded-full border pointer-events-auto"
            style={{
              background: "oklch(0.15 0.03 265 / 0.75)",
              borderColor: "var(--border)",
              backdropFilter: "blur(8px)",
              color: "var(--foreground)",
            }}
            aria-label="Pause"
          >
            {paused ? (
              <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor"><path d="M0 0 L12 7 L0 14 Z" /></svg>
            ) : (
              <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor"><rect x="0" y="0" width="4" height="14"/><rect x="8" y="0" width="4" height="14"/></svg>
            )}
          </button>
        </div>

        {/* Tactical hint */}
        <div className="absolute bottom-6 left-0 right-0 z-10 text-center pointer-events-none">
          <div
            className="inline-block px-4 py-2 rounded-full text-[0.65rem] tracking-[0.4em] uppercase"
            style={{
              background: "oklch(0.15 0.03 265 / 0.6)",
              color: "var(--muted-foreground)",
              backdropFilter: "blur(6px)",
              border: "1px solid var(--border)",
            }}
          >
            Drag to aim &nbsp;•&nbsp; Release to dash
          </div>
        </div>

        {/* Pause / Victory overlays */}
        {(paused || victory) && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center"
            style={{ background: "oklch(0 0 0 / 0.65)", backdropFilter: "blur(8px)" }}
          >
            <div
              className="rounded-2xl p-8 text-center border max-w-xs w-full mx-6"
              style={{
                background: "oklch(0.19 0.035 265 / 0.95)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-deep)",
                animation: "logo-in 0.3s ease-out",
              }}
            >
              <h2 className="text-3xl mb-2" style={{ color: victory ? "var(--primary)" : "var(--foreground)" }}>
                {victory ? "Victory" : "Paused"}
              </h2>
              <p className="text-xs tracking-widest uppercase mb-6" style={{ color: "var(--muted-foreground)" }}>
                {victory ? "Arena cleared" : "The blade rests"}
              </p>
              <div className="flex flex-col gap-3">
                {victory ? (
                  <button onClick={restart} className="btn-premium btn-premium-hover w-full">
                    Play again
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
    dashProgress: number; // 0..1
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
  gold: number;
  aiming: boolean;
  aimStart: Vec;
  aimCurrent: Vec;
  shake: number;
  slowRealMs: number; // time in ms of "real time" that overrides slowmo (during dash)
  time: number;
  victory: boolean;
  bgTiles: { x: number; y: number; shade: number }[];
};

function createInitialState(): GameState {
  const walls: Wall[] = [
    // outer frame
    { x: 0, y: 0, w: ARENA_W, h: 20 },
    { x: 0, y: ARENA_H - 20, w: ARENA_W, h: 20 },
    { x: 0, y: 0, w: 20, h: ARENA_H },
    { x: ARENA_W - 20, y: 0, w: 20, h: ARENA_H },
    // inner cover
    { x: 80, y: 260, w: 90, h: 22 },
    { x: 270, y: 260, w: 90, h: 22 },
    { x: 180, y: 460, w: 80, h: 22 },
    { x: 60, y: 580, w: 22, h: 90 },
    { x: 358, y: 580, w: 22, h: 90 },
  ];

  const enemies: Enemy[] = [
    mkEnemy(1, 120, 180, "grunt"),
    mkEnemy(2, 320, 180, "grunt"),
    mkEnemy(3, 100, 400, "grunt"),
    mkEnemy(4, 340, 400, "grunt"),
    mkEnemy(5, 220, 340, "brute"),
    mkEnemy(6, 220, 540, "grunt"),
    mkEnemy(7, 220, 660, "brute"),
  ];

  const bgTiles: GameState["bgTiles"] = [];
  const tile = 40;
  for (let y = 0; y < ARENA_H; y += tile) {
    for (let x = 0; x < ARENA_W; x += tile) {
      bgTiles.push({ x, y, shade: Math.random() });
    }
  }

  return {
    player: {
      pos: { x: ARENA_W / 2, y: ARENA_H - 120 },
      hp: 3,
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
    walls,
    barrels: [{ pos: { x: 220, y: 240 }, alive: true, radius: 16 }],
    spikes: [{ pos: { x: 220, y: 620 }, radius: 22, phase: 0 }],
    slashes: [],
    trail: [],
    particles: [],
    explosions: [],
    gold: 0,
    aiming: false,
    aimStart: { x: 0, y: 0 },
    aimCurrent: { x: 0, y: 0 },
    shake: 0,
    slowRealMs: 0,
    time: 0,
    victory: false,
    bgTiles,
  };
}

function mkEnemy(id: number, x: number, y: number, type: "grunt" | "brute"): Enemy {
  return {
    id,
    pos: { x, y },
    vel: { x: 0, y: 0 },
    hp: type === "brute" ? 2 : 1,
    alive: true,
    hitFlash: 0,
    type,
  };
}

/* ================= SIMULATION ================= */

function step(s: GameState, dtMsReal: number) {
  s.time += dtMsReal;

  // Determine time scale: slowmo when aiming or idle. Real speed during dash for a brief window.
  const inRealTime = s.player.dashing || s.slowRealMs > 0;
  const scale = inRealTime ? 1 : SLOWMO_FACTOR;
  if (s.slowRealMs > 0) s.slowRealMs -= dtMsReal;
  const dt = (dtMsReal / 1000) * scale;
  const dtReal = dtMsReal / 1000;

  // Shake decay (real time)
  s.shake *= Math.pow(0.001, dtReal);
  if (s.shake < 0.05) s.shake = 0;

  // Player invuln decay (real time)
  if (s.player.invuln > 0) s.player.invuln -= dtMsReal;

  // Aim spike animation on the sword-plant
  if (!s.player.dashing) s.player.plantedTimer += dtReal;
  else s.player.plantedTimer = 0;

  // Dash movement (real time)
  if (s.player.dashing) {
    const p = s.player;
    const moveDist = DASH_SPEED * dtReal;
    p.dashProgress += moveDist / p.dashLen;
    if (p.dashProgress >= 1) p.dashProgress = 1;
    const nx = p.dashTarget.x - p.pos.x;
    const ny = p.dashTarget.y - p.pos.y;
    const rem = Math.hypot(nx, ny);
    const step = Math.min(moveDist, rem);
    const dirx = rem > 0.01 ? nx / rem : p.dashDir.x;
    const diry = rem > 0.01 ? ny / rem : p.dashDir.y;
    const prev = { ...p.pos };
    p.pos.x += dirx * step;
    p.pos.y += diry * step;

    // Wall collision — stop at wall
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

    // Trail
    s.trail.push({ pos: { ...p.pos }, life: 350 });

    // Hit enemies in path
    for (const e of s.enemies) {
      if (!e.alive) continue;
      if (dist(e.pos, p.pos) < PLAYER_R + 16) {
        e.hp -= 1;
        e.hitFlash = 200;
        s.shake = Math.max(s.shake, 10);
        spawnHitBurst(s, e.pos);
        if (e.hp <= 0) {
          e.alive = false;
          s.gold += e.type === "brute" ? 25 : 10;
          spawnDeathBurst(s, e.pos);
        }
      }
    }

    // Hit barrels
    for (const b of s.barrels) {
      if (!b.alive) continue;
      if (dist(b.pos, p.pos) < PLAYER_R + b.radius) {
        b.alive = false;
        explodeBarrel(s, b.pos);
      }
    }

    // Slash streak at midpoint of dash
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

  // Enemies slowly chase player (uses slowed dt)
  for (const e of s.enemies) {
    if (!e.alive) continue;
    if (e.hitFlash > 0) e.hitFlash -= dtMsReal;
    const dx = s.player.pos.x - e.pos.x;
    const dy = s.player.pos.y - e.pos.y;
    const d = Math.hypot(dx, dy) || 1;
    const speed = e.type === "brute" ? 22 : 34;
    e.vel.x = (dx / d) * speed;
    e.vel.y = (dy / d) * speed;
    e.pos.x += e.vel.x * dt;
    e.pos.y += e.vel.y * dt;

    // Damage player if touching (only real-time-ish; small chance) — during real time only
    if (inRealTime && s.player.invuln <= 0 && dist(e.pos, s.player.pos) < 24) {
      s.player.hp = Math.max(0, s.player.hp - 1);
      s.player.invuln = 900;
      s.shake = 12;
    }
  }

  // Spikes damage on step-over during dash pass
  for (const sp of s.spikes) {
    sp.phase += dtReal * 2;
    if (s.player.dashing && dist(sp.pos, s.player.pos) < sp.radius + 6 && s.player.invuln <= 0) {
      s.player.hp = Math.max(0, s.player.hp - 1);
      s.player.invuln = 900;
      s.shake = Math.max(s.shake, 10);
    }
  }

  // Trail decay (real time so it fades naturally)
  for (const t of s.trail) t.life -= dtMsReal;
  s.trail = s.trail.filter((t) => t.life > 0);

  // Slashes
  for (const sl of s.slashes) sl.life -= dtMsReal;
  s.slashes = s.slashes.filter((sl) => sl.life > 0);

  // Particles
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

function spawnHitBurst(s: GameState, at: Vec) {
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 200 + Math.random() * 300;
    s.particles.push({
      pos: { ...at },
      vel: { x: Math.cos(a) * sp, y: Math.sin(a) * sp },
      life: 350, max: 350,
      color: "oklch(0.88 0.12 210)",
      size: 2 + Math.random() * 2,
    });
  }
}
function spawnDeathBurst(s: GameState, at: Vec) {
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 100 + Math.random() * 400;
    s.particles.push({
      pos: { ...at },
      vel: { x: Math.cos(a) * sp, y: Math.sin(a) * sp },
      life: 600, max: 600,
      color: Math.random() > 0.5 ? "oklch(0.65 0.22 20)" : "oklch(0.82 0.16 85)",
      size: 2 + Math.random() * 3,
    });
  }
}
function explodeBarrel(s: GameState, at: Vec) {
  s.explosions.push({ pos: { ...at }, life: 400, max: 400, radius: 90 });
  s.shake = Math.max(s.shake, 16);
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 200 + Math.random() * 600;
    s.particles.push({
      pos: { ...at },
      vel: { x: Math.cos(a) * sp, y: Math.sin(a) * sp },
      life: 700, max: 700,
      color: Math.random() > 0.4 ? "oklch(0.72 0.22 35)" : "oklch(0.9 0.15 80)",
      size: 2 + Math.random() * 4,
    });
  }
  // damage nearby enemies
  for (const e of s.enemies) {
    if (!e.alive) continue;
    if (dist(e.pos, at) < 90) {
      e.hp -= 2;
      e.hitFlash = 250;
      if (e.hp <= 0) {
        e.alive = false;
        s.gold += e.type === "brute" ? 25 : 10;
        spawnDeathBurst(s, e.pos);
      }
    }
  }
}

/* ================= RENDER ================= */

function render(ctx: CanvasRenderingContext2D, s: GameState, rect: DOMRect) {
  // Compute scale to fit canvas rect to ARENA
  const sx = rect.width / ARENA_W;
  const sy = rect.height / ARENA_H;
  ctx.save();
  ctx.scale(sx, sy);

  // Shake
  const sk = s.shake;
  const shx = (Math.random() - 0.5) * sk;
  const shy = (Math.random() - 0.5) * sk;
  ctx.translate(shx, shy);

  // Background floor
  ctx.fillStyle = "oklch(0.16 0.03 262)";
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);

  // Tile pattern
  for (const t of s.bgTiles) {
    ctx.fillStyle = `oklch(${0.17 + t.shade * 0.03} 0.03 262)`;
    ctx.fillRect(t.x, t.y, 40, 40);
    ctx.strokeStyle = "oklch(0.12 0.02 262)";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(t.x + 0.5, t.y + 0.5, 39, 39);
  }

  // Vignette hint of light around player
  const grd = ctx.createRadialGradient(
    s.player.pos.x, s.player.pos.y, 20,
    s.player.pos.x, s.player.pos.y, 260
  );
  grd.addColorStop(0, "oklch(0.85 0.15 60 / 0.18)");
  grd.addColorStop(1, "transparent");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);

  // Walls
  for (const w of s.walls) {
    ctx.fillStyle = "oklch(0.28 0.04 265)";
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = "oklch(0.36 0.05 265)";
    ctx.fillRect(w.x, w.y, w.w, 3);
    ctx.strokeStyle = "oklch(0.1 0.02 265)";
    ctx.lineWidth = 1;
    ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1);
  }

  // Spike trap
  for (const sp of s.spikes) {
    ctx.save();
    ctx.translate(sp.pos.x, sp.pos.y);
    // base
    ctx.fillStyle = "oklch(0.22 0.03 265)";
    ctx.beginPath();
    ctx.arc(0, 0, sp.radius, 0, Math.PI * 2);
    ctx.fill();
    // spikes
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

  // Barrels
  for (const b of s.barrels) {
    if (!b.alive) continue;
    ctx.save();
    ctx.translate(b.pos.x, b.pos.y);
    // shadow
    ctx.fillStyle = "oklch(0 0 0 / 0.35)";
    ctx.beginPath();
    ctx.ellipse(2, b.radius - 2, b.radius, b.radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    // body
    const bg = ctx.createLinearGradient(-b.radius, 0, b.radius, 0);
    bg.addColorStop(0, "oklch(0.45 0.12 40)");
    bg.addColorStop(1, "oklch(0.3 0.1 30)");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
    ctx.fill();
    // rings
    ctx.strokeStyle = "oklch(0.2 0.05 30)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-b.radius, -4); ctx.lineTo(b.radius, -4);
    ctx.moveTo(-b.radius, 4); ctx.lineTo(b.radius, 4);
    ctx.stroke();
    // fuse glow
    const glow = 0.5 + Math.sin(s.time * 0.01) * 0.5;
    ctx.fillStyle = `oklch(0.85 0.2 60 / ${0.4 + glow * 0.4})`;
    ctx.beginPath();
    ctx.arc(0, -b.radius - 4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Trail
  for (const t of s.trail) {
    const a = t.life / 350;
    ctx.fillStyle = `oklch(0.88 0.12 210 / ${a * 0.7})`;
    ctx.beginPath();
    ctx.arc(t.pos.x, t.pos.y, PLAYER_R * a * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Enemies
  for (const e of s.enemies) {
    if (!e.alive) continue;
    ctx.save();
    ctx.translate(e.pos.x, e.pos.y);
    // shadow
    ctx.fillStyle = "oklch(0 0 0 / 0.4)";
    ctx.beginPath();
    ctx.ellipse(1, 12, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // body
    const flash = e.hitFlash > 0 ? 1 : 0;
    const r = e.type === "brute" ? 18 : 14;
    const bodyCol = flash
      ? "oklch(0.98 0.02 210)"
      : e.type === "brute" ? "oklch(0.45 0.15 320)" : "oklch(0.5 0.16 340)";
    ctx.fillStyle = bodyCol;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    // eye slit
    ctx.fillStyle = flash ? "oklch(0.2 0.02 210)" : "oklch(0.95 0.2 25)";
    ctx.fillRect(-4, -3, 8, 2);
    // outline
    ctx.strokeStyle = "oklch(0.15 0.05 320)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Player
  drawPlayer(ctx, s);

  // Aim preview
  if (s.aiming) drawAim(ctx, s);

  // Slashes
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

  // Particles
  for (const p of s.particles) {
    const a = p.life / p.max;
    ctx.fillStyle = p.color.replace(")", ` / ${a})`).replace("oklch(", "oklch(");
    // fallback: draw with globalAlpha
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Explosions
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

  // Slow-mo vignette when planning
  if (!s.player.dashing && s.slowRealMs <= 0) {
    const vg = ctx.createRadialGradient(
      ARENA_W / 2, ARENA_H / 2, ARENA_W * 0.35,
      ARENA_W / 2, ARENA_H / 2, ARENA_W * 0.75
    );
    vg.addColorStop(0, "transparent");
    vg.addColorStop(1, "oklch(0.05 0.02 265 / 0.55)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    // subtle cool tint
    ctx.fillStyle = "oklch(0.5 0.1 220 / 0.05)";
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  }

  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, s: GameState) {
  const p = s.player;
  ctx.save();
  ctx.translate(p.pos.x, p.pos.y);
  // shadow
  ctx.fillStyle = "oklch(0 0 0 / 0.45)";
  ctx.beginPath();
  ctx.ellipse(2, 14, 16, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  const flicker = p.invuln > 0 && Math.floor(p.invuln / 60) % 2 === 0 ? 0.4 : 1;
  ctx.globalAlpha = flicker;

  // cape/aura
  const auraR = 22 + Math.sin(s.time * 0.004) * 2;
  const aura = ctx.createRadialGradient(0, 0, 8, 0, 0, auraR);
  aura.addColorStop(0, "oklch(0.88 0.12 210 / 0.5)");
  aura.addColorStop(1, "transparent");
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, auraR, 0, Math.PI * 2);
  ctx.fill();

  // body
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

  // helmet stripe
  ctx.fillStyle = "oklch(0.75 0.18 55)";
  ctx.fillRect(-3, -PLAYER_R + 2, 6, 6);

  // Sword: planted in ground when idle, forward when dashing
  ctx.rotate(p.facing + Math.PI / 2);
  if (!p.dashing) {
    // planted sword — points down (into ground), slight sway
    const sway = Math.sin(s.time * 0.002) * 0.03;
    ctx.rotate(sway);
    ctx.fillStyle = "oklch(0.45 0.1 40)";
    ctx.fillRect(-2, 6, 4, 10); // hilt
    ctx.fillStyle = "oklch(0.85 0.16 80)";
    ctx.fillRect(-6, 14, 12, 3); // crossguard
    // blade going down into the earth
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
    // planted glow
    ctx.fillStyle = "oklch(0.88 0.12 210 / 0.35)";
    ctx.beginPath();
    ctx.ellipse(0, 40, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // held forward
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

  // outer glow line
  ctx.save();
  ctx.strokeStyle = "oklch(0.88 0.12 210 / 0.25)";
  ctx.lineWidth = 22;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(tx, ty);
  ctx.stroke();

  // dashed core
  ctx.strokeStyle = "oklch(0.95 0.05 210)";
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.lineDashOffset = -((performance.now() / 40) % 18);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrow head
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

  // Impact ring at end
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
