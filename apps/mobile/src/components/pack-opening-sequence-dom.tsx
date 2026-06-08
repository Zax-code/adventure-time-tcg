"use dom";

import { useState, type CSSProperties } from "react";

import {
  getPackOpeningVisualProfile,
  type PackVisualIconKind,
} from "./pack-opening-visuals";

type PackAnimationData = {
  backgroundColor: string;
  cardCountLabel: string;
  color: string;
  guaranteedRarity?: string | null;
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

const CSS = `
  html, body {
    margin: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--app-bg);
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
      radial-gradient(circle at 50% 36%, rgba(var(--pack-highlight-rgb), .18), transparent 26%),
      radial-gradient(circle at 50% 54%, rgba(var(--pack-rgb), .12), transparent 34%),
      radial-gradient(circle at 50% 68%, rgba(var(--pack-shadow-rgb), .14), transparent 48%),
      var(--app-bg);
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
    background: radial-gradient(circle, rgba(var(--pack-highlight-rgb), .5), rgba(var(--pack-rgb), .18) 35%, transparent 68%);
    filter: blur(14px);
    animation: pack-aura-pulse 3.2s ease-in-out infinite;
  }

  .pack-opening-stage.exploding .pack-opening-aura {
    animation: pack-burst-aura 1.58s cubic-bezier(.16,.82,.22,1) forwards;
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
      radial-gradient(circle, rgba(255, 255, 245, .98) 0 8%, rgba(var(--pack-highlight-rgb), .86) 16%, rgba(var(--pack-rgb), .42) 35%, rgba(var(--pack-shadow-rgb), .14) 58%, transparent 73%);
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
        rgba(var(--pack-highlight-rgb), .56) 14deg 20deg,
        transparent 21deg 40deg,
        rgba(var(--pack-soft-rgb), .42) 41deg 48deg,
        transparent 49deg 76deg,
        rgba(255, 255, 255, .5) 77deg 84deg,
        transparent 85deg 116deg,
        rgba(var(--pack-rgb), .38) 117deg 124deg,
        transparent 125deg 160deg,
        rgba(var(--pack-highlight-rgb), .5) 161deg 169deg,
        transparent 170deg 210deg,
        rgba(var(--pack-rgb), .38) 211deg 218deg,
        transparent 219deg 254deg,
        rgba(255, 255, 255, .48) 255deg 262deg,
        transparent 263deg 302deg,
        rgba(var(--pack-soft-rgb), .42) 303deg 310deg,
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
      0 0 0 9px var(--pack-border),
      0 22px 55px rgba(0, 0, 0, .72),
      0 0 42px rgba(var(--pack-rgb), .42);
    animation: pack-card-idle 2.6s ease-in-out infinite;
    background:
      linear-gradient(140deg, var(--pack-soft) 0%, var(--pack-base) 16%, var(--pack-deep) 34%, var(--pack-dark) 72%, var(--pack-bright) 100%);
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
      radial-gradient(circle at 50% 18%, rgba(255, 255, 255, .28), transparent 20%),
      linear-gradient(165deg, var(--pack-surface) 0%, rgba(var(--pack-soft-rgb), .94) 24%, rgba(var(--pack-rgb), .96) 52%, var(--pack-dark) 100%);
    box-shadow:
      inset 0 0 0 4px #1d0d04,
      inset 0 0 0 9px rgba(var(--pack-highlight-rgb), .34),
      inset 0 0 32px rgba(0, 0, 0, .65);
  }

  .pack-opening-card-face {
    position: absolute;
    inset: 17px;
    z-index: 8;
    border-radius: 13px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 18px;
    padding: 30px 18px 24px;
  }

  .pack-opening-icon-frame {
    width: 108px;
    height: 108px;
    border-radius: 28px;
    display: grid;
    place-items: center;
    background: rgba(255, 255, 255, .16);
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, .22),
      0 18px 34px rgba(var(--pack-shadow-rgb), .22);
    backdrop-filter: blur(10px);
  }

  .pack-opening-icon {
    width: 68px;
    height: 68px;
    color: var(--pack-icon-color);
    filter: drop-shadow(0 0 14px rgba(var(--pack-highlight-rgb), .42));
  }

  .pack-opening-card-copy {
    margin-top: auto;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .pack-opening-card-title {
    color: #fff8f0;
    font-size: 28px;
    line-height: 1.05;
    font-weight: 800;
    letter-spacing: .02em;
    text-align: center;
    text-shadow: 0 2px 12px rgba(0, 0, 0, .3);
  }

  .pack-opening-card-count {
    padding: 8px 14px;
    border-radius: 999px;
    color: rgba(255, 255, 255, .92);
    font-size: 13px;
    font-weight: 700;
    background: rgba(255, 255, 255, .16);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .18);
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
    stroke: rgba(var(--pack-rgb), .85);
    stroke-width: 9;
    filter: blur(4px);
  }

  .pack-opening-crack-core {
    stroke: rgba(var(--pack-highlight-rgb), .98);
    stroke-width: 3.2;
    filter:
      drop-shadow(0 0 5px rgba(var(--pack-highlight-rgb), .88))
      drop-shadow(0 0 13px rgba(var(--pack-rgb), .82))
      drop-shadow(0 0 22px rgba(var(--pack-shadow-rgb), .75));
  }

  .pack-opening-center-flare {
    position: absolute;
    left: 50%;
    top: 47%;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    background: rgb(var(--pack-highlight-rgb));
    box-shadow:
      0 0 18px rgba(var(--pack-highlight-rgb), .92),
      0 0 42px rgba(var(--pack-rgb), .82),
      0 0 80px rgba(var(--pack-shadow-rgb), .68);
    opacity: 0;
    z-index: 42;
  }

  .pack-opening-shockwave {
    position: absolute;
    left: calc(50% - 60px);
    top: calc(47% - 60px);
    width: 120px;
    height: 120px;
    border: 3px solid rgba(var(--pack-highlight-rgb), .9);
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
    background: linear-gradient(135deg, rgba(var(--pack-highlight-rgb), .95), rgba(var(--pack-shadow-rgb), .95));
    clip-path: polygon(50% 0, 100% 72%, 40% 100%, 0 45%);
    box-shadow: 0 0 14px rgba(var(--pack-rgb), .6);
  }

  .pack-opening-sparkle {
    width: var(--size);
    height: var(--size);
    transform: translate(-50%, -50%);
    filter: drop-shadow(0 0 8px rgba(var(--pack-highlight-rgb), .78)) drop-shadow(0 0 18px rgba(var(--pack-rgb), .72));
  }

  .pack-opening-sparkle::before,
  .pack-opening-sparkle::after {
    content: "";
    position: absolute;
    inset: 0;
    background: rgba(255, 255, 255, .96);
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

  .pack-opening-stage.loading-active .pack-opening-aura {
    opacity: .34;
    transform: scale(.9);
    filter: blur(16px);
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

  @keyframes pack-burst-aura {
    0% {
      opacity: .72;
      transform: scale(.9);
      filter: blur(13px);
    }
    42% {
      opacity: .92;
      transform: scale(1);
      filter: blur(16px);
    }
    72% {
      opacity: .84;
      transform: scale(1.08);
      filter: blur(18px);
    }
    100% {
      opacity: .38;
      transform: scale(1.2);
      filter: blur(22px);
    }
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

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hexToRgb(hex: string) {
  const normalized = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#C96A24";
  return {
    b: Number.parseInt(normalized.slice(5, 7), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    r: Number.parseInt(normalized.slice(1, 3), 16),
  };
}

function mixHex(baseHex: string, targetHex: string, amount: number) {
  const base = hexToRgb(baseHex);
  const target = hexToRgb(targetHex);
  const channels: Array<keyof typeof base> = ["r", "g", "b"];

  return `#${channels
    .map((channel) =>
      clampChannel(
        base[channel as keyof typeof base] +
          (target[channel as keyof typeof target] -
            base[channel as keyof typeof base]) *
            amount,
      )
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function toRgbTriplet(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return `${r}, ${g}, ${b}`;
}

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

function buildParticlePalette(packColor: string, iconColor: string) {
  return [
    mixHex(packColor, "#FFFFFF", 0.74),
    mixHex(packColor, "#FFFFFF", 0.46),
    packColor,
    iconColor,
    mixHex(packColor, "#140707", 0.34),
  ];
}

function buildBurstElements(pack: PackAnimationData) {
  const profile = getPackOpeningVisualProfile(pack);
  const particlePalette = buildParticlePalette(pack.color, profile.iconColor);
  const particles = Array.from({ length: 82 }, (_, index) => {
    const angle = randomBetween(0, Math.PI * 2);
    const distance = randomBetween(140, 390);
    return {
      color:
        particlePalette[
          Math.floor(randomBetween(0, particlePalette.length))
        ] ?? particlePalette[0],
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

function buildSparkles(count: number): Sparkle[] {
  return Array.from({ length: count }, (_, index) => {
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

function createBurstPattern(pack: PackAnimationData) {
  const visualProfile = getPackOpeningVisualProfile(pack);
  const burst = buildBurstElements(pack);

  return {
    cracks: buildCracks(),
    particles: burst.particles,
    shards: burst.shards,
    sparkles: buildSparkles(visualProfile.sparkCount),
  };
}

function PackOpeningIcon({ iconKind }: { iconKind: PackVisualIconKind }) {
  switch (iconKind) {
    case "crown":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3 18L5 7L9.2 11.2L12 5L14.8 11.2L19 7L21 18"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M4 18H20"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "diamond":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 3L20 9L12 21L4 9L12 3Z"
            fill="currentColor"
            fillOpacity=".2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M4 9H20M12 3L8 9M12 3L16 9M8 9L12 21M16 9L12 21"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "sparkle":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 1C12.4 5.5 13 10 12 12C14 11 18.5 11.6 23 12C18.5 12.4 14 13 12 12C13 14 12.4 18.5 12 23C11.6 18.5 11 14 12 12C10 13 5.5 12.4 1 12C5.5 11.6 10 11 12 12C11 10 11.6 5.5 12 1Z"
            fill="currentColor"
          />
          <path
            d="M19 2C19.15 3.2 19.4 4.4 19 5C20 4.6 20.8 4.85 22 5C20.8 5.15 20 5.4 19 5C19.4 6 19.15 6.8 19 8C18.85 6.8 18.6 6 19 5C18 5.4 17.2 5.15 16 5C17.2 4.85 18 4.6 19 5C18.6 4 18.85 3.2 19 2Z"
            fill="currentColor"
            fillOpacity=".6"
          />
        </svg>
      );
    case "gift-box":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect
            x="4"
            y="9"
            width="16"
            height="12"
            rx="2"
            fill="currentColor"
            fillOpacity=".2"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <rect
            x="3"
            y="6"
            width="18"
            height="4"
            rx="1"
            fill="currentColor"
            fillOpacity=".3"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path d="M12 6V21" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4 13H20" stroke="currentColor" strokeWidth="1.35" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 8L12 4L20 8V16L12 20L4 16V8Z"
            fill="currentColor"
            fillOpacity=".15"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M12 4V20M4 8L12 12L20 8"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

export default function PackOpeningSequenceDom({
  mode,
  pack,
}: {
  dom?: import("expo/dom").DOMProps;
  mode: PackOpeningSequenceMode;
  pack: PackAnimationData;
}) {
  const visualProfile = getPackOpeningVisualProfile(pack);
  const [{ cracks, particles, shards, sparkles }] = useState(() =>
    createBurstPattern(pack),
  );
  const packBright = mixHex(pack.color, "#FFF7DF", 0.52);
  const packSoft = mixHex(pack.color, "#FFF4EC", 0.28);
  const packSurface = mixHex(pack.color, "#FFF7F3", 0.48);
  const packDark = mixHex(pack.color, "#2A1407", 0.56);
  const packDeep = mixHex(pack.color, "#130907", 0.74);
  const packBorder = mixHex(pack.color, "#F3C55E", 0.38);
  const packHighlight = mixHex(pack.color, "#FFF6C5", 0.72);
  const packShadow = mixHex(pack.color, "#331007", 0.72);
  const cssVars = cssVarStyle({
    "--app-bg": pack.backgroundColor,
    "--pack-base": pack.color,
    "--pack-border": packBorder,
    "--pack-bright": packBright,
    "--pack-color": pack.color,
    "--pack-dark": packDark,
    "--pack-deep": packDeep,
    "--pack-highlight-rgb": toRgbTriplet(packHighlight),
    "--pack-icon-color": visualProfile.iconColor,
    "--pack-rgb": toRgbTriplet(pack.color),
    "--pack-shadow-rgb": toRgbTriplet(packShadow),
    "--pack-soft": packSoft,
    "--pack-soft-rgb": toRgbTriplet(packSoft),
    "--pack-surface": packSurface,
  });

  return (
    <div className="pack-opening-root" style={cssVars}>
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
            <div className="pack-opening-card-face">
              <div
                className="pack-opening-icon-frame"
                aria-label={`${pack.name} ${pack.cardCountLabel}`}
                title={`${pack.name} ${pack.cardCountLabel}`}
              >
                <div className="pack-opening-icon">
                  <PackOpeningIcon iconKind={visualProfile.iconKind} />
                </div>
              </div>
              <div className="pack-opening-card-copy">
                <div className="pack-opening-card-title">{pack.name}</div>
                <div className="pack-opening-card-count">{pack.cardCountLabel}</div>
              </div>
            </div>
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
