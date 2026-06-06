"use dom";

import { useState, type CSSProperties } from "react";

type PackAnimationData = {
  cardCountLabel: string;
  color: string;
  name: string;
};

type PackOpeningSequenceMode = "burst" | "charge" | "loading";

type Crack = {
  dashLength: number;
  delay: number;
  id: string;
  path: string;
};

type Particle = {
  color: string;
  id: string;
  size: number;
  spin: number;
  x: number;
  y: number;
};

type Shard = {
  id: string;
  spin: number;
  x: number;
  y: number;
};

type Sparkle = {
  delay: number;
  id: string;
  loadingDelay: number;
  size: number;
  x: number;
  y: number;
};

const CARD_W = 230;
const CARD_H = 330;
const CENTER = { x: CARD_W * 0.5, y: CARD_H * 0.47 };
const PARTICLE_COLORS = ["#FFF2A8", "#FFC247", "#FF7622", "#FF3B16", "#7BD6FF"];

const CSS = `
  html, body {
    margin: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #070302;
  }

  body > div {
    width: 100%;
    height: 100%;
  }

  .pack-opening-root {
    width: 100%;
    height: 100%;
    min-height: 100%;
    overflow: hidden;
    display: grid;
    place-items: center;
    position: relative;
    background:
      radial-gradient(circle at 50% 42%, rgba(255, 197, 71, .18), transparent 28%),
      radial-gradient(circle at 50% 62%, #351707, #070302 72%);
    font-family: system-ui, sans-serif;
  }

  .pack-opening-stage-shell {
    position: absolute;
    left: 50%;
    top: 50%;
    width: min(92vw, 680px);
    height: min(92vh, 620px);
    max-width: 100%;
    max-height: 100%;
    display: grid;
    place-items: center;
    transform: translate(-50%, -50%);
    transform-origin: center;
  }

  .pack-opening-stage {
    position: relative;
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    perspective: 1000px;
    overflow: visible;
  }

  .pack-opening-aura {
    position: absolute;
    width: 390px;
    height: 390px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 226, 128, .5), rgba(255, 115, 19, .16) 35%, transparent 68%);
    filter: blur(14px);
    animation: pack-aura-pulse 3.2s ease-in-out infinite;
  }

  .pack-opening-light {
    position: absolute;
    left: 50%;
    top: 47%;
    width: 440px;
    height: 440px;
    border-radius: 50%;
    transform: translate(-50%, -50%) scale(.15);
    opacity: 0;
    z-index: 35;
    pointer-events: none;
    background:
      radial-gradient(circle, rgba(255, 255, 235, .98) 0 8%, rgba(255, 228, 126, .86) 16%, rgba(255, 172, 45, .42) 35%, rgba(255, 116, 22, .14) 58%, transparent 73%);
    filter: blur(6px);
    mix-blend-mode: screen;
  }

  .pack-opening-rays {
    position: absolute;
    left: 50%;
    top: 47%;
    width: 520px;
    height: 520px;
    border-radius: 50%;
    transform: translate(-50%, -50%) scale(.1) rotate(0deg);
    opacity: 0;
    z-index: 34;
    pointer-events: none;
    background:
      conic-gradient(
        from 8deg,
        transparent 0deg 13deg,
        rgba(255, 242, 168, .52) 14deg 20deg,
        transparent 21deg 40deg,
        rgba(255, 194, 70, .42) 41deg 48deg,
        transparent 49deg 76deg,
        rgba(255, 255, 210, .5) 77deg 84deg,
        transparent 85deg 116deg,
        rgba(255, 202, 88, .38) 117deg 124deg,
        transparent 125deg 160deg,
        rgba(255, 244, 180, .5) 161deg 169deg,
        transparent 170deg 210deg,
        rgba(255, 177, 54, .38) 211deg 218deg,
        transparent 219deg 254deg,
        rgba(255, 255, 218, .48) 255deg 262deg,
        transparent 263deg 302deg,
        rgba(255, 203, 80, .42) 303deg 310deg,
        transparent 311deg 360deg
      );
    mask-image: radial-gradient(circle, transparent 0 10%, black 18% 58%, transparent 74%);
    filter: blur(2px);
    mix-blend-mode: screen;
  }

  .pack-opening-card {
    position: relative;
    width: 230px;
    height: 330px;
    border-radius: 18px;
    overflow: hidden;
    box-shadow:
      0 0 0 5px #2a1407,
      0 0 0 9px #d9902c,
      0 22px 55px rgba(0, 0, 0, .72),
      0 0 42px rgba(255, 166, 42, .42);
    animation: pack-card-idle 2.6s ease-in-out infinite;
    background:
      linear-gradient(135deg, #ffe0a0 0%, #9f4a17 12%, #281005 18%, #5e2b10 65%, #f9b64a 100%);
  }

  .pack-opening-card::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(115deg, transparent 20%, rgba(255,255,255,.35) 38%, transparent 52%);
    transform: translateX(-120%);
    animation: pack-sheen 3.4s ease-in-out infinite;
    mix-blend-mode: screen;
  }

  .pack-opening-card::before {
    content: "";
    position: absolute;
    inset: 17px;
    border-radius: 13px;
    background:
      radial-gradient(circle at 50% 44%, rgba(255, 238, 166, .96), transparent 8%),
      conic-gradient(
        from 0deg,
        color-mix(in srgb, var(--pack-color) 18%, #522206 82%),
        color-mix(in srgb, var(--pack-color) 40%, #d58524 60%),
        color-mix(in srgb, var(--pack-color) 24%, #ffd771 76%),
        color-mix(in srgb, var(--pack-color) 52%, #7b320d 48%),
        #351504,
        color-mix(in srgb, var(--pack-color) 18%, #522206 82%)
      );
    box-shadow:
      inset 0 0 0 4px #1d0d04,
      inset 0 0 0 9px rgba(255, 212, 102, .45),
      inset 0 0 32px rgba(0, 0, 0, .65);
  }

  .pack-opening-gem {
    position: absolute;
    left: 50%;
    top: 47%;
    width: 70px;
    height: 70px;
    transform: translate(-50%, -50%) rotate(45deg);
    border-radius: 13px;
    background: radial-gradient(circle at 28% 24%, #fff7cb, #ffcf54 28%, #f77620 62%, #7a1607 100%);
    box-shadow: inset 0 0 10px rgba(255,255,255,.75), 0 0 32px rgba(255,174,45,.9);
    z-index: 8;
  }

  .pack-opening-crack-layer {
    position: absolute;
    inset: 0;
    z-index: 16;
    pointer-events: none;
  }

  .pack-opening-crack-core,
  .pack-opening-crack-glow {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: var(--dash);
    stroke-dashoffset: var(--dash);
  }

  .pack-opening-crack-glow {
    stroke: rgba(255, 116, 24, .85);
    stroke-width: 9;
    filter: blur(4px);
  }

  .pack-opening-crack-core {
    stroke: #fff8bf;
    stroke-width: 3.2;
    filter:
      drop-shadow(0 0 5px #ffe16e)
      drop-shadow(0 0 13px #ff771b)
      drop-shadow(0 0 22px rgba(255, 55, 15, .75));
  }

  .pack-opening-center-flare {
    position: absolute;
    left: 50%;
    top: 47%;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    background: #fff2aa;
    box-shadow: 0 0 18px #fff2aa, 0 0 42px #ff9c25, 0 0 80px #ff5b12;
    opacity: 0;
    z-index: 42;
  }

  .pack-opening-shockwave {
    position: absolute;
    left: calc(50% - 60px);
    top: calc(47% - 60px);
    width: 120px;
    height: 120px;
    border: 3px solid rgba(255, 228, 130, .9);
    border-radius: 50%;
    opacity: 0;
    pointer-events: none;
  }

  .pack-opening-particle,
  .pack-opening-shard,
  .pack-opening-sparkle {
    position: absolute;
    left: 50%;
    top: 47%;
    opacity: 0;
    z-index: 60;
    pointer-events: none;
  }

  .pack-opening-particle {
    width: var(--size);
    height: var(--size);
    border-radius: 50%;
    background: var(--color);
    box-shadow: 0 0 14px var(--color);
  }

  .pack-opening-shard {
    width: 36px;
    height: 56px;
    background: linear-gradient(135deg, rgba(255, 225, 121, .95), rgba(137, 54, 12, .95));
    clip-path: polygon(50% 0, 100% 72%, 40% 100%, 0 45%);
    box-shadow: 0 0 14px rgba(255, 168, 42, .6);
  }

  .pack-opening-sparkle {
    width: var(--size);
    height: var(--size);
    transform: translate(-50%, -50%);
    filter: drop-shadow(0 0 8px #fff4b8) drop-shadow(0 0 18px #ffb733);
  }

  .pack-opening-sparkle::before,
  .pack-opening-sparkle::after {
    content: "";
    position: absolute;
    inset: 0;
    background: #fff9d8;
    border-radius: 99px;
  }

  .pack-opening-sparkle::before {
    transform: scaleX(.2);
  }

  .pack-opening-sparkle::after {
    transform: scaleY(.2);
  }

  .pack-opening-stage.exploding .pack-opening-card {
    animation:
      pack-crack-shake 1.45s ease-in-out forwards,
      pack-card-burst .58s cubic-bezier(.2,.8,.2,1) 1.45s forwards;
  }

  .pack-opening-stage.exploding .pack-opening-crack-core,
  .pack-opening-stage.exploding .pack-opening-crack-glow {
    animation:
      pack-draw-crack .5s cubic-bezier(.12,.92,.18,1) var(--delay) forwards,
      pack-vanish-crack .12s ease-out 1.42s forwards;
  }

  .pack-opening-stage.exploding .pack-opening-center-flare {
    animation: pack-flare-build 1.45s ease-in forwards, pack-flare-pop .42s ease-out 1.45s forwards;
  }

  .pack-opening-stage.exploding .pack-opening-shockwave {
    animation: pack-shockwave .7s ease-out 1.45s forwards;
  }

  .pack-opening-stage.exploding .pack-opening-particle {
    animation: pack-particle-fly 1.2s cubic-bezier(.12,.75,.2,1) 1.45s forwards;
  }

  .pack-opening-stage.exploding .pack-opening-shard {
    animation: pack-shard-fly 1s cubic-bezier(.12,.75,.2,1) 1.45s forwards;
  }

  .pack-opening-stage.exploding .pack-opening-light {
    animation: pack-treasure-glow 2.6s cubic-bezier(.12,.75,.2,1) 1.52s forwards;
  }

  .pack-opening-stage.exploding .pack-opening-rays {
    animation: pack-treasure-rays 2.8s ease-out 1.52s forwards;
  }

  .pack-opening-stage.exploding .pack-opening-sparkle {
    animation: pack-sparkle-reveal 1.8s ease-out var(--delay) forwards;
  }

  .pack-opening-stage.loading-active .pack-opening-light {
    opacity: .58;
    animation: pack-loading-glow 3.4s ease-in-out infinite;
  }

  .pack-opening-stage.loading-active .pack-opening-rays {
    opacity: .38;
    animation: pack-loading-rays 7.2s linear infinite;
  }

  .pack-opening-stage.loading-active .pack-opening-card,
  .pack-opening-stage.loading-active .pack-opening-crack-layer,
  .pack-opening-stage.loading-active .pack-opening-center-flare,
  .pack-opening-stage.loading-active .pack-opening-shockwave,
  .pack-opening-stage.loading-active .pack-opening-particle,
  .pack-opening-stage.loading-active .pack-opening-shard {
    opacity: 0;
  }

  .pack-opening-stage.loading-active .pack-opening-sparkle {
    opacity: 1;
    animation: pack-sparkle-drift 2.9s ease-in-out calc(var(--loading-delay) * -1) infinite;
  }

  @keyframes pack-card-idle {
    0%, 100% { transform: rotateX(0deg) rotateZ(-1deg) translateY(0); }
    50% { transform: rotateX(6deg) rotateZ(1deg) translateY(-8px); }
  }

  @keyframes pack-aura-pulse {
    0%, 100% { transform: scale(.74); opacity: .45; }
    50% { transform: scale(.94); opacity: .72; }
  }

  @keyframes pack-sheen {
    0%, 45% { transform: translateX(-120%); }
    70%, 100% { transform: translateX(120%); }
  }

  @keyframes pack-draw-crack {
    to { stroke-dashoffset: 0; }
  }

  @keyframes pack-vanish-crack {
    to { opacity: 0; filter: brightness(5) blur(5px); }
  }

  @keyframes pack-crack-shake {
    0%, 100% { transform: translate(0, 0) rotateZ(0deg) scale(1); filter: brightness(1); }
    18% { transform: translate(-2px, 1px) rotateZ(-1deg) scale(1.01); }
    34% { transform: translate(2px, -2px) rotateZ(1.1deg) scale(1.015); }
    52% { transform: translate(-3px, -1px) rotateZ(-1.4deg) scale(1.025); }
    72% { transform: translate(4px, 2px) rotateZ(1.9deg) scale(1.035); filter: brightness(1.35); }
    94% { transform: translate(3px, -3px) rotateZ(2.4deg) scale(1.06); filter: brightness(2.1); }
  }

  @keyframes pack-card-burst {
    0% { opacity: 1; transform: scale(1.06); filter: brightness(2.5); }
    28% { opacity: 1; transform: scale(1.2) rotateZ(2deg); filter: brightness(4); }
    100% { opacity: 0; transform: scale(.42) rotateZ(25deg); filter: brightness(6) blur(8px); }
  }

  @keyframes pack-flare-build {
    0% { opacity: 0; transform: translate(-50%, -50%) scale(.2); }
    55% { opacity: .8; transform: translate(-50%, -50%) scale(1.4); }
    100% { opacity: 1; transform: translate(-50%, -50%) scale(3.5); }
  }

  @keyframes pack-flare-pop {
    to { opacity: 0; transform: translate(-50%, -50%) scale(14); }
  }

  @keyframes pack-shockwave {
    0% { opacity: .95; transform: scale(.2); }
    100% { opacity: 0; transform: scale(5.5); }
  }

  @keyframes pack-treasure-glow {
    0% { opacity: 0; transform: translate(-50%, -50%) scale(.12); filter: blur(14px); }
    20% { opacity: .95; transform: translate(-50%, -50%) scale(.95); filter: blur(8px); }
    55% { opacity: .82; transform: translate(-50%, -50%) scale(1.2); filter: blur(12px); }
    100% { opacity: .48; transform: translate(-50%, -50%) scale(1.35); filter: blur(18px); }
  }

  @keyframes pack-treasure-rays {
    0% { opacity: 0; transform: translate(-50%, -50%) scale(.15) rotate(0deg); }
    22% { opacity: .72; transform: translate(-50%, -50%) scale(.95) rotate(12deg); }
    100% { opacity: .28; transform: translate(-50%, -50%) scale(1.18) rotate(36deg); }
  }

  @keyframes pack-particle-fly {
    0% { opacity: 1; transform: translate(-50%, -50%) scale(.5); }
    100% { opacity: 0; transform: translate(calc(-50% + var(--x)), calc(-50% + var(--y))) scale(0) rotate(var(--spin)); }
  }

  @keyframes pack-shard-fly {
    0% { opacity: 1; transform: translate(-50%, -50%) rotate(0deg) scale(.8); }
    100% { opacity: 0; transform: translate(calc(-50% + var(--x)), calc(-50% + var(--y))) rotate(var(--spin)) scale(1.25); }
  }

  @keyframes pack-sparkle-reveal {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(.15) rotate(0deg);
    }
    18% {
      opacity: 1;
      transform: translate(calc(-50% + var(--x) * .82), calc(-50% + var(--y) * .82)) scale(1) rotate(70deg);
    }
    55% {
      opacity: .95;
      transform: translate(calc(-50% + var(--x)), calc(-50% + var(--y))) scale(.65) rotate(145deg);
    }
    100% {
      opacity: 0;
      transform: translate(calc(-50% + var(--x) * 1.12), calc(-50% + var(--y) * 1.12 - 42px)) scale(.1) rotate(250deg);
    }
  }

  @keyframes pack-sparkle-drift {
    0% {
      opacity: .24;
      transform: translate(calc(-50% + var(--x) * .88), calc(-50% + var(--y) * .9)) scale(.48) rotate(0deg);
    }
    20% {
      opacity: 1;
      transform: translate(calc(-50% + var(--x) * 1.02), calc(-50% + var(--y) - 10px)) scale(1.08) rotate(92deg);
    }
    55% {
      opacity: .82;
      transform: translate(calc(-50% + var(--x) * 1.08), calc(-50% + var(--y) * 1.04 - 20px)) scale(.78) rotate(168deg);
    }
    100% {
      opacity: .22;
      transform: translate(calc(-50% + var(--x) * .84), calc(-50% + var(--y) * .82 - 30px)) scale(.38) rotate(248deg);
    }
  }

  @keyframes pack-loading-glow {
    0%, 100% {
      opacity: .5;
      transform: translate(-50%, -50%) scale(.82);
      filter: blur(14px);
    }
    50% {
      opacity: .68;
      transform: translate(-50%, -50%) scale(.94);
      filter: blur(10px);
    }
  }

  @keyframes pack-loading-rays {
    0% {
      opacity: .28;
      transform: translate(-50%, -50%) scale(.76) rotate(20deg);
    }
    50% {
      opacity: .42;
      transform: translate(-50%, -50%) scale(.84) rotate(34deg);
    }
    100% {
      opacity: .3;
      transform: translate(-50%, -50%) scale(.78) rotate(48deg);
    }
  }
`;

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function shuffleArray<T>(items: T[]) {
  return [...items]
    .map((item) => ({ item, sort: Math.random() }))
    .sort((left, right) => left.sort - right.sort)
    .map(({ item }) => item);
}

function getRayToCardEdge(angle: number) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const candidates: number[] = [];

  if (dx > 0) {
    candidates.push((CARD_W - CENTER.x) / dx);
  }
  if (dx < 0) {
    candidates.push((0 - CENTER.x) / dx);
  }
  if (dy > 0) {
    candidates.push((CARD_H - CENTER.y) / dy);
  }
  if (dy < 0) {
    candidates.push((0 - CENTER.y) / dy);
  }

  const distance = Math.min(...candidates.filter((candidate) => candidate > 0));

  return {
    x: CENTER.x + dx * distance,
    y: CENTER.y + dy * distance,
    dx,
    dy,
    distance,
  };
}

function createLightningCrackPath(angle: number) {
  const edge = getRayToCardEdge(angle);
  const normalX = -edge.dy;
  const normalY = edge.dx;
  const points = [CENTER];
  const segments = Math.floor(randomBetween(5, 8));

  for (let index = 1; index < segments; index += 1) {
    const progress = index / segments;
    const baseX = CENTER.x + edge.dx * edge.distance * progress;
    const baseY = CENTER.y + edge.dy * edge.distance * progress;
    const amplitude =
      Math.min(22, edge.distance * 0.11) * Math.sin(Math.PI * progress);
    const offset = randomBetween(-amplitude, amplitude);

    points.push({
      x: baseX + normalX * offset,
      y: baseY + normalY * offset,
    });
  }

  points.push({ x: edge.x, y: edge.y });

  return {
    dashLength: Math.ceil(
      points.slice(1).reduce((length, point, index) => {
        const previousPoint = points[index];
        if (!previousPoint) {
          return length;
        }
        return (
          length +
          Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y)
        );
      }, 0),
    ),
    path: points
      .map((point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
      )
      .join(" "),
  };
}

function buildCracks(): Crack[] {
  const count = 9;
  const start = randomBetween(0, Math.PI * 2);
  const angles = Array.from({ length: count }, (_, index) => {
    const evenlySpaced = start + (Math.PI * 2 * index) / count;
    return evenlySpaced + randomBetween(-0.24, 0.24);
  });

  return shuffleArray(angles).map((angle, index) => {
    const path = createLightningCrackPath(angle);
    return {
      ...path,
      delay: index * 0.075 + randomBetween(0, 0.045),
      id: `crack-${index}`,
    };
  });
}

function buildBurstElements() {
  const particles = Array.from({ length: 82 }, (_, index) => {
    const angle = randomBetween(0, Math.PI * 2);
    const distance = randomBetween(140, 390);
    return {
      color:
        PARTICLE_COLORS[
          Math.floor(randomBetween(0, PARTICLE_COLORS.length))
        ] ?? PARTICLE_COLORS[0],
      id: `particle-${index}`,
      size: randomBetween(4, 13),
      spin: randomBetween(-540, 540),
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
    };
  });

  const shards = Array.from({ length: 18 }, (_, index) => {
    const angle = randomBetween(0, Math.PI * 2);
    const distance = randomBetween(120, 330);
    return {
      id: `shard-${index}`,
      spin: randomBetween(-760, 760),
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
    };
  });

  return { particles, shards };
}

function buildSparkles(): Sparkle[] {
  return Array.from({ length: 36 }, (_, index) => {
    const angle = randomBetween(0, Math.PI * 2);
    const distance = randomBetween(44, 215);
    return {
      delay: 1.54 + randomBetween(0, 0.55),
      id: `sparkle-${index}`,
      loadingDelay: randomBetween(0, 3.4),
      size: randomBetween(7, 19),
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
    };
  });
}

function cssVarStyle(vars: Record<string, number | string>) {
  return vars as CSSProperties;
}

function createBurstPattern() {
  const burst = buildBurstElements();

  return {
    cracks: buildCracks(),
    particles: burst.particles,
    shards: burst.shards,
    sparkles: buildSparkles(),
  };
}

export default function PackOpeningSequenceDom({
  mode,
  pack,
}: {
  dom?: import("expo/dom").DOMProps;
  mode: PackOpeningSequenceMode;
  pack: PackAnimationData;
}) {
  const [{ cracks, particles, shards, sparkles }] = useState(createBurstPattern);

  return (
    <div className="pack-opening-root">
      <style>{CSS}</style>
      <div className="pack-opening-stage-shell">
        <div
          className={`pack-opening-stage ${mode === "burst" ? "exploding" : ""} ${mode === "loading" ? "loading-active" : ""}`}
        >
          <div className="pack-opening-aura" />
          <div className="pack-opening-rays" />
          <div className="pack-opening-light" />
          <div className="pack-opening-shockwave" />
          <div
            className="pack-opening-card"
            style={cssVarStyle({ "--pack-color": pack.color })}
          >
            <div
              className="pack-opening-gem"
              aria-label={`${pack.name} ${pack.cardCountLabel}`}
              title={`${pack.name} ${pack.cardCountLabel}`}
            />
            <svg
              className="pack-opening-crack-layer"
              viewBox={`0 0 ${CARD_W} ${CARD_H}`}
              preserveAspectRatio="none"
            >
              {cracks.map((crack) => (
                <g key={crack.id}>
                  <path
                    className="pack-opening-crack-glow"
                    d={crack.path}
                    style={cssVarStyle({
                      "--dash": crack.dashLength,
                      "--delay": `${crack.delay}s`,
                    })}
                  />
                  <path
                    className="pack-opening-crack-core"
                    d={crack.path}
                    style={cssVarStyle({
                      "--dash": crack.dashLength,
                      "--delay": `${crack.delay}s`,
                    })}
                  />
                </g>
              ))}
            </svg>
          </div>
          <div className="pack-opening-center-flare" />
          {particles.map((particle) => (
            <i
              key={particle.id}
              className="pack-opening-particle"
              style={cssVarStyle({
                "--color": particle.color,
                "--size": `${particle.size}px`,
                "--spin": `${particle.spin}deg`,
                "--x": `${particle.x}px`,
                "--y": `${particle.y}px`,
              })}
            />
          ))}
          {shards.map((shard) => (
            <i
              key={shard.id}
              className="pack-opening-shard"
              style={cssVarStyle({
                "--spin": `${shard.spin}deg`,
                "--x": `${shard.x}px`,
                "--y": `${shard.y}px`,
              })}
            />
          ))}
          {sparkles.map((sparkle) => (
            <i
              key={sparkle.id}
              className="pack-opening-sparkle"
              style={cssVarStyle({
                "--delay": `${sparkle.delay}s`,
                "--loading-delay": `${sparkle.loadingDelay}s`,
                "--size": `${sparkle.size}px`,
                "--x": `${sparkle.x}px`,
                "--y": `${sparkle.y}px`,
              })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
