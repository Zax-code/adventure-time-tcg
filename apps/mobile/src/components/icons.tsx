import type { ComponentProps, ComponentType } from "react";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";

interface IconProps {
  size?: number;
  color?: string;
}

// ============================================
// NAVIGATION ICONS
// ============================================

export function HomeIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 10.5L12 3L21 10.5V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V10.5Z"
        fill={color}
        fillOpacity={0.2}
      />
      <Path
        d="M3 10.5L12 3L21 10.5V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V10.5Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 17C12 17 9 14.5 9 12.5C9 11.5 9.5 11 10.5 11C11.2 11 11.7 11.4 12 11.8C12.3 11.4 12.8 11 13.5 11C14.5 11 15 11.5 15 12.5C15 14.5 12 17 12 17Z"
        fill={color}
      />
    </Svg>
  );
}

export function CardsIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M20.466,1.967,14.78.221a5.011,5.011,0,0,0-6.224,3.24L8.368,4H5A5.006,5.006,0,0,0,0,9V19a5.006,5.006,0,0,0,5,5h6a4.975,4.975,0,0,0,3.92-1.934,5.029,5.029,0,0,0,.689.052,4.976,4.976,0,0,0,4.775-3.563L23.8,8.156A5.021,5.021,0,0,0,20.466,1.967ZM11,22H5a3,3,0,0,1-3-3V9A3,3,0,0,1,5,6h6a3,3,0,0,1,3,3V19A3,3,0,0,1,11,22ZM21.887,7.563l-3.412,10.4a2.992,2.992,0,0,1-2.6,2.134A4.992,4.992,0,0,0,16,19V9a5.006,5.006,0,0,0-5-5h-.507a3,3,0,0,1,3.7-1.867l5.686,1.746A3.006,3.006,0,0,1,21.887,7.563ZM12,13c0,1.45-1.544,3.391-2.714,4.378a1.991,1.991,0,0,1-2.572,0C5.544,16.391,4,14.45,4,13a2,2,0,0,1,4,0,2,2,0,0,1,4,0Z" />
    </Svg>
  );
}

export function PackIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={8} width={18} height={13} rx={2} fill={color} fillOpacity={0.2} stroke={color} strokeWidth={2} />
      <Path d="M2 8C2 6.89543 2.89543 6 4 6H20C21.1046 6 22 6.89543 22 8V8H2V8Z" fill={color} fillOpacity={0.3} stroke={color} strokeWidth={2} />
      <Path d="M12 6V21" stroke={color} strokeWidth={2} />
      <Path d="M8 6C8 4 9.5 3 12 3C14.5 3 16 4 16 6" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={12} cy={6} r={1.5} fill={color} />
    </Svg>
  );
}

export function GiftHeartIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x={3}
        y={10}
        width={18}
        height={11}
        rx={2}
        fill={color}
        fillOpacity={0.2}
        stroke={color}
        strokeWidth={2}
      />
      <Path
        d="M2 10C2 8.89543 2.89543 8 4 8H20C21.1046 8 22 8.89543 22 10V10H2V10Z"
        fill={color}
        fillOpacity={0.3}
        stroke={color}
        strokeWidth={2}
      />
      <Path
        d="M12 7.5C10.5 7 8 6.5 7.5 5C7 3.5 9 3 10.5 3.5C12 4 12 6 12 7.5Z"
        fill={color}
        fillOpacity={0.3}
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M12 7.5C13.5 7 16 6.5 16.5 5C17 3.5 15 3 13.5 3.5C12 4 12 6 12 7.5Z"
        fill={color}
        fillOpacity={0.3}
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Ellipse cx={12} cy={7.5} rx={1.5} ry={1} fill={color} />
      <Path
        d="M10.5 8L8.5 10M13.5 8L15.5 10"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M12 19.5C12 19.5 7.5 17 7.5 14.5C7.5 13.2 8.5 12.2 9.8 12.2C10.6 12.2 11.4 12.6 12 13.3C12.6 12.6 13.4 12.2 14.2 12.2C15.5 12.2 16.5 13.2 16.5 14.5C16.5 17 12 19.5 12 19.5Z"
        fill={color}
        fillOpacity={0.5}
        stroke={color}
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function QuestIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 4C6 2.89543 6.89543 2 8 2H16C17.1046 2 18 2.89543 18 4V20C18 21.1046 17.1046 22 16 22H8C6.89543 22 6 21.1046 6 20V4Z"
        fill={color}
        fillOpacity={0.2}
        stroke={color}
        strokeWidth={2}
      />
      <Path
        d="M6 6H4C3.44772 6 3 5.55228 3 5C3 4.44772 3.44772 4 4 4H6M18 6H20C20.5523 6 21 5.55228 21 5C21 4.44772 20.5523 4 20 4H18"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M12 8L13 10.5L15.5 11L13.5 13L14 15.5L12 14L10 15.5L10.5 13L8.5 11L11 10.5L12 8Z"
        fill={color}
      />
      <Path
        d="M9 18H15"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function SwordsIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M6.152 19.092a3.1 3.1 0 0 0-.53-.71 3.1 3.1 0 0 0-.75-.55c-.325-.172-.068-.54-.068-.54.333-.507.636-1.015.887-1.458l-1.683-1.682H2.374a.57.57 0 0 1-.57-.569.57.57 0 0 1 .57-.569h1.869a.57.57 0 0 1 .403.167l6.15 6.144a.57.57 0 0 1 .167.403v1.878a.57.57 0 0 1-.57.569.57.57 0 0 1-.569-.57v-1.641l-1.676-1.675a25 25 0 0 0-1.5.955s-.298.212-.496-.152m-2.69-.466c-.512 0-.993.199-1.355.56a1.9 1.9 0 0 0-.56 1.353c0 .512.198.992.56 1.353s.843.56 1.355.56.993-.199 1.355-.56.56-.842.56-1.353-.199-.991-.56-1.352a1.9 1.9 0 0 0-1.355-.561m5.358-3.947a.65.65 0 0 1-.917 0l-.635-.634a.65.65 0 0 1 0-.916L18.102 2.306c.252-.252.75-.485 1.104-.517l2.656-.241a.522.522 0 0 1 .587.587l-.241 2.65c-.032.355-.265.852-.517 1.104L10.856 16.713a.65.65 0 0 1-.918 0l-.635-.635a.65.65 0 0 1 0-.916l9.071-9.063a.34.34 0 0 0 0-.483.34.34 0 0 0-.483 0z" />
    </Svg>
  );
}

export function TrophyIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 3H18V9C18 12.3137 15.3137 15 12 15C8.68629 15 6 12.3137 6 9V3Z" fill={color} fillOpacity={0.2} stroke={color} strokeWidth={2} />
      <Path d="M6 5H4C3.44772 5 3 5.44772 3 6V8C3 9.65685 4.34315 11 6 11" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M18 5H20C20.5523 5 21 5.44772 21 6V8C21 9.65685 19.6569 11 18 11" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 15V18M8 21H16M12 18H12C10.8954 18 10 18.8954 10 20V21H14V20C14 18.8954 13.1046 18 12 18Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function UserPlusIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={9} cy={7} r={4} fill={color} fillOpacity={0.2} stroke={color} strokeWidth={2} />
      <Path d="M2 21C2 17.134 5.13401 14 9 14H13C16.866 14 20 17.134 20 21" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M19 8V14M16 11H22" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function ClockIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} fill={color} fillOpacity={0.15} stroke={color} strokeWidth={2} />
      <Path d="M12 7V12L15 15" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function EyeIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2.5 12C4.5 8.5 8 6 12 6C16 6 19.5 8.5 21.5 12C19.5 15.5 16 18 12 18C8 18 4.5 15.5 2.5 12Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={2} />
    </Svg>
  );
}

export function ZapIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 2L5 13H11L10 22L19 10H13L13 2Z"
        fill={color}
        fillOpacity={0.18}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function XIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 6L6 18M6 6L18 18" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function CheckIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12L9 17L20 6" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChevronRightIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6L15 12L9 18" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChevronDownIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M19 9l-7 7-7-7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SwapIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 8H17M17 8L14 5M17 8L14 11" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M19 16H7M7 16L10 13M7 16L10 19" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ============================================
// CURRENCY & STATUS ICONS
// ============================================

export function CoinIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 521 512">
      <Defs>
        <RadialGradient id="coinGoldRad" cx="35%" cy="30%" r="70%">
          <Stop offset="0%" stopColor="#FFF7A8" />
          <Stop offset="38%" stopColor="#FFD85A" />
          <Stop offset="70%" stopColor="#F6B231" />
          <Stop offset="100%" stopColor="#D88412" />
        </RadialGradient>
        <LinearGradient id="coinRimGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FFE27C" />
          <Stop offset="55%" stopColor="#F3A82B" />
          <Stop offset="100%" stopColor="#C56B0A" />
        </LinearGradient>
        <LinearGradient id="coinShineGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.85} />
          <Stop offset="55%" stopColor="#FFFFFF" stopOpacity={0.25} />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {/* Outer rim */}
      <Circle cx={256} cy={256} r={210} fill="url(#coinRimGrad)" stroke="#3A2208" strokeWidth={14} />

      {/* Rim bumps */}
      <G fill="#F7C14A" opacity={0.95} stroke="#3A2208" strokeWidth={6}>
        <Circle cx={256} cy={60} r={18} />
        <Circle cx={340} cy={78} r={18} />
        <Circle cx={406} cy={132} r={18} />
        <Circle cx={448} cy={216} r={18} />
        <Circle cx={448} cy={296} r={18} />
        <Circle cx={406} cy={380} r={18} />
        <Circle cx={340} cy={434} r={18} />
        <Circle cx={256} cy={452} r={18} />
        <Circle cx={172} cy={434} r={18} />
        <Circle cx={106} cy={380} r={18} />
        <Circle cx={64} cy={296} r={18} />
        <Circle cx={64} cy={216} r={18} />
        <Circle cx={106} cy={132} r={18} />
        <Circle cx={172} cy={78} r={18} />
      </G>

      {/* Inner face */}
      <Circle cx={256} cy={256} r={170} fill="url(#coinGoldRad)" stroke="#3A2208" strokeWidth={12} />

      {/* Eyes */}
      <G fill="#1A1208" opacity={0.95}>
        <Circle cx={205} cy={228} r={12} />
        <Circle cx={307} cy={228} r={12} />
      </G>
      {/* Eye highlights */}
      <G fill="#FFFFFF" opacity={0.9}>
        <Circle cx={201} cy={224} r={4} />
        <Circle cx={303} cy={224} r={4} />
      </G>
      {/* Smile */}
      <Path d="M206 290 C232 318, 280 318, 306 290" fill="none" stroke="#1A1208" strokeWidth={14} strokeLinecap="round" />
      {/* Cheeks */}
      <G fill="#FF7FB5" opacity={0.35}>
        <Ellipse cx={176} cy={275} rx={22} ry={16} />
        <Ellipse cx={336} cy={275} rx={22} ry={16} />
      </G>

      {/* Glossy shine */}
      <Path
        d="M130 210 C150 130, 230 92, 300 106 C260 132, 216 184, 208 246 C200 310, 148 336, 120 320 C118 280, 120 244, 130 210 Z"
        fill="url(#coinShineGrad)"
        opacity={0.85}
      />

      {/* Sparkles */}
      <G opacity={0.9} stroke="#3A2208" strokeWidth={6} strokeLinejoin="round" strokeLinecap="round">
        <G transform="translate(92, 150) scale(0.9)">
          <Path d="M0-14 L4-4 L14 0 L4 4 L0 14 L-4 4 L-14 0 L-4-4 Z" fill="#B8F3FF" />
        </G>
        <G transform="translate(430, 170) scale(0.7) rotate(18)">
          <Path d="M0-14 L4-4 L14 0 L4 4 L0 14 L-4 4 L-14 0 L-4-4 Z" fill="#C8FFB6" />
        </G>
        <G transform="translate(410, 380) scale(0.85) rotate(-12)">
          <Path d="M0-14 L4-4 L14 0 L4 4 L0 14 L-4 4 L-14 0 L-4-4 Z" fill="#FFD1F0" />
        </G>
        <G transform="translate(110, 390) scale(0.65) rotate(8)">
          <Path d="M0-14 L4-4 L14 0 L4 4 L0 14 L-4 4 L-14 0 L-4-4 Z" fill="#FFFFFF" />
        </G>
      </G>

      {/* Subtle inner ring */}
      <Circle cx={256} cy={256} r={136} fill="none" stroke="#3A2208" strokeWidth={8} opacity={0.35} />
    </Svg>
  );
}

export function DustIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256" fill={color}>
      <Path d="M247.769 150.406c-.621-7.079-8.779-11.157-16.669-15.101-3.163-1.582-8.436-4.217-9.388-5.624-2.966-7.613-4.592-8.336-16.975-13.843-3.595-1.599-8.07-3.589-13.989-6.339-16.138-7.497-28.605-17.704-38.623-25.906-6.096-4.991-11.361-9.301-16.257-12.053-7.321-4.115-13.951-4.706-19.367-1.956-8.019 4.071-25.936 23.747-37.833 34.045-16.338 14.143-45.719 32.539-59.563 36.186-15.422 4.062-16.859 15.213 9.184 18.589 46.661 6.05 36.308 16.493 81.825 19.16 28.434 1.666 104.438-8.216 129.889-17.625 2.583-.71 4.328-1.732 5.642-3.149 1.603-1.732 2.338-3.939 2.124-6.384m-137.451-2.015a3.938 3.938 0 1 1-.008-7.876 3.938 3.938 0 0 1 .008 7.876m11.662-12.217a3.5 3.5 0 1 1-.008-7 3.5 3.5 0 0 1 .008 7m7.897 19.197a4.374 4.374 0 0 1-4.38-4.371 4.374 4.374 0 0 1 4.371-4.38 4.376 4.376 0 0 1 .009 8.751m23.476-34.615c-11.005-12.065-17.739-30.072-23.983-41.293q.78.334 1.596.792c4.137 2.325 9.088 6.379 14.823 11.074 10.453 8.558 23.462 19.208 40.745 27.237 5.994 2.785 10.51 4.793 14.138 6.407 5.331 2.371 8.548 3.802 9.865 4.825.632.49.825.858 1.89 3.598 1.81 4.659 7.552 7.529 14.201 10.853 2.536 1.268 6.914 3.531 9.521 5.373.595.42.382 1.355-.339 1.461-2.599.381-7.172.66-14.533.182-16.989-1.102-45.885-6.346-67.924-30.509m-82.361 58.823a5.03 5.03 0 1 1-10.06-.001 5.03 5.03 0 0 1 10.06.001m-17.872-7.881a4.435 4.435 0 1 1-8.871-.001 4.435 4.435 0 0 1 8.871.001m-20.06 10.176a4 4 0 1 1-8 0 4 4 0 0 1 8 0m186.19-4.125a4.125 4.125 0 1 1-8.25 0 4.125 4.125 0 0 1 8.25 0" />
    </Svg>
  );
}

// ============================================
// CARD STAT ICONS
// ============================================

export function AttackStatIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs>
        <LinearGradient id="atkBlade" x1="14" y1="54" x2="50" y2="18" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#FFF4B8" />
          <Stop offset="55%" stopColor="#FFC54D" />
          <Stop offset="100%" stopColor="#FF8B3D" />
        </LinearGradient>
        <LinearGradient id="atkGuard" x1="18" y1="46" x2="44" y2="46" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#B85A19" />
          <Stop offset="100%" stopColor="#7D2E11" />
        </LinearGradient>
      </Defs>
      <Path
        d="M18 46L42 22C44.4 19.6 47.9 18.8 51.1 19.7L44.3 26.5L47.9 30.1L54.7 23.3C55.6 26.5 54.8 30 52.4 32.4L28.4 56.4C27.6 57.2 26.4 57.2 25.6 56.4L18 48.8C17.2 48 17.2 46.8 18 46Z"
        fill="url(#atkBlade)"
        stroke="#743017"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <Path
        d="M14 50L22 42L29 49L21 57C19.3 58.7 16.7 58.7 15 57L14 56C12.3 54.3 12.3 51.7 14 50Z"
        fill="#5C3219"
        stroke="#3B1E0E"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <Path
        d="M20 43L26 37L33 44L27 50L20 43Z"
        fill="url(#atkGuard)"
        stroke="#3B1E0E"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <Path
        d="M45 17L47.5 10L50 17L57 19.5L50 22L47.5 29L45 22L38 19.5L45 17Z"
        fill="#FFF6CE"
        stroke="#D76A27"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function HealthStatIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs>
        <LinearGradient id="hpHeart" x1="14" y1="16" x2="49" y2="50" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#FFB0C4" />
          <Stop offset="50%" stopColor="#FF6C8E" />
          <Stop offset="100%" stopColor="#E93D67" />
        </LinearGradient>
        <LinearGradient id="hpCross" x1="24" y1="24" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#FFFDF5" />
          <Stop offset="100%" stopColor="#FFE7EE" />
        </LinearGradient>
      </Defs>
      <Path
        d="M32 54C31.3 54 30.7 53.8 30.2 53.3L13.4 37C8.5 32.3 8.1 24.5 12.4 19.4C16.5 14.6 23.6 13.8 28.7 17.6L32 20.1L35.3 17.6C40.4 13.8 47.5 14.6 51.6 19.4C55.9 24.5 55.5 32.3 50.6 37L33.8 53.3C33.3 53.8 32.7 54 32 54Z"
        fill="url(#hpHeart)"
        stroke="#8C1D3C"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <Path
        d="M29 24.5C29 23.7 29.7 23 30.5 23H33.5C34.3 23 35 23.7 35 24.5V28H38.5C39.3 28 40 28.7 40 29.5V32.5C40 33.3 39.3 34 38.5 34H35V37.5C35 38.3 34.3 39 33.5 39H30.5C29.7 39 29 38.3 29 37.5V34H25.5C24.7 34 24 33.3 24 32.5V29.5C24 28.7 24.7 28 25.5 28H29V24.5Z"
        fill="url(#hpCross)"
      />
      <Path
        d="M21 18.5C18.8 18.5 16.8 19.4 15.3 21.1"
        stroke="#FFD9E4"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function DefenseStatIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs>
        <LinearGradient id="defShield" x1="32" y1="10" x2="32" y2="54" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#DDE3FF" />
          <Stop offset="48%" stopColor="#909BFF" />
          <Stop offset="100%" stopColor="#5767E8" />
        </LinearGradient>
        <LinearGradient id="defGem" x1="24" y1="25" x2="40" y2="39" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="100%" stopColor="#D9E4FF" />
        </LinearGradient>
      </Defs>
      <Path
        d="M32 55C31.6 55 31.2 54.9 30.8 54.7C19.6 49.8 13 39.9 13 28.2V14.7C13 13.8 13.6 13 14.4 12.7L31.2 7.2C31.7 7 32.3 7 32.8 7.2L49.6 12.7C50.4 13 51 13.8 51 14.7V28.2C51 39.9 44.4 49.8 33.2 54.7C32.8 54.9 32.4 55 32 55Z"
        fill="url(#defShield)"
        stroke="#3342A8"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <Path
        d="M32 17L23.5 24V34.5L32 42L40.5 34.5V24L32 17Z"
        fill="url(#defGem)"
        stroke="#4153D8"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <Path d="M32 17V42" stroke="#C8D3FF" strokeWidth="1.8" />
      <Path d="M23.5 24H40.5" stroke="#C8D3FF" strokeWidth="1.8" />
    </Svg>
  );
}

export function SpeedStatIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs>
        <LinearGradient id="spdBoot" x1="16" y1="22" x2="48" y2="52" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#BFF9EE" />
          <Stop offset="50%" stopColor="#41D8C0" />
          <Stop offset="100%" stopColor="#0D9F92" />
        </LinearGradient>
        <LinearGradient id="spdWing" x1="10" y1="18" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#F6FFFE" />
          <Stop offset="100%" stopColor="#C8FFF5" />
        </LinearGradient>
      </Defs>
      <Path
        d="M21 18C24.7 18 27.7 21 27.7 24.7V29.7C27.7 31 28.7 32 30 32H36.5C39.2 32 41.8 33.1 43.7 35L49.8 41.1C50.7 42 50.9 43.5 50.2 44.6L46.8 50.1C46.4 50.8 45.6 51.2 44.8 51.2H26.1C24.7 51.2 23.3 50.7 22.2 49.9L14.4 44.3C13.3 43.5 12.9 42 13.4 40.8L16.3 33.4C17.1 31.3 18.5 29.5 20.4 28.5L21 28.2V18Z"
        fill="url(#spdBoot)"
        stroke="#0A6B68"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <Path
        d="M22 19C19.8 15.8 16.4 14 12.4 14C13.8 17.6 16.4 20.6 20 22C16.4 22.4 13 24.2 10.6 27.1C14.4 28 18.4 27.4 21.7 25.4"
        fill="url(#spdWing)"
        stroke="#0EA99A"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M33 23L39 17" stroke="#E8FFFD" strokeWidth="2.2" strokeLinecap="round" />
      <Path d="M37 26L45 18" stroke="#E8FFFD" strokeWidth="2.2" strokeLinecap="round" />
    </Svg>
  );
}

export function HPIcon({ size = 24, hpVal = 0 }: { size?: number; hpVal?: string | number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G transform="scale(0.375)">
        <Path
          fill="#F76D57"
          d="M58.714,29.977c0,0-0.612,0.75-1.823,1.961S33.414,55.414,33.414,55.414C33.023,55.805,32.512,56,32,56 s-1.023-0.195-1.414-0.586c0,0-22.266-22.266-23.477-23.477s-1.823-1.961-1.823-1.961C3.245,27.545,2,24.424,2,21 C2,13.268,8.268,7,16,7c3.866,0,7.366,1.566,9.899,4.101l0.009-0.009l4.678,4.677c0.781,0.781,2.047,0.781,2.828,0l4.678-4.677 l0.009,0.009C40.634,8.566,44.134,7,48,7c7.732,0,14,6.268,14,14C62,24.424,60.755,27.545,58.714,29.977z"
        />
        <Path
          fill="#394240"
          d="M48,5c-4.418,0-8.418,1.791-11.313,4.687l-3.979,3.961c-0.391,0.391-1.023,0.391-1.414,0 c0,0-3.971-3.97-3.979-3.961C24.418,6.791,20.418,5,16,5C7.163,5,0,12.163,0,21c0,3.338,1.024,6.436,2.773,9 c0,0,0.734,1.164,1.602,2.031s24.797,24.797,24.797,24.797C29.953,57.609,30.977,58,32,58s2.047-0.391,2.828-1.172 c0,0,23.93-23.93,24.797-24.797S61.227,30,61.227,30C62.976,27.436,64,24.338,64,21C64,12.163,56.837,5,48,5z M58.714,29.977 c0,0-0.612,0.75-1.823,1.961S33.414,55.414,33.414,55.414C33.023,55.805,32.512,56,32,56s-1.023-0.195-1.414-0.586 c0,0-22.266-22.266-23.477-23.477s-1.823-1.961-1.823-1.961C3.245,27.545,2,24.424,2,21C2,13.268,8.268,7,16,7 c3.866,0,7.366,1.566,9.899,4.101l0.009-0.009l4.678,4.677c0.781,0.781,2.047,0.781,2.828,0l4.678-4.677l0.009,0.009 C40.634,8.566,44.134,7,48,7c7.732,0,14,6.268,14,14C62,24.424,60.755,27.545,58.714,29.977z"
        />
        <SvgText
          x={32}
          y={30}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#ffffff"
          fontSize={20}
          fontWeight="bold"
        >
          {String(hpVal)}
        </SvgText>
      </G>
    </Svg>
  );
}

export function SpeedIcon({ size = 24, speedVal = 0 }: { size?: number; speedVal?: string | number }) {
  // `overflow` is a valid SVG attribute but not typed in react-native-svg's SvgProps
  const SvgOverflow = Svg as ComponentType<ComponentProps<typeof Svg> & { overflow?: string }>;
  return (
    <SvgOverflow width={size} height={size} viewBox="0 0 24 24" fill="none" overflow="visible">
      <G transform="rotate(-45, 12, 12)">
        <Path
          fill="#76bb40"
          d="M24 15.28c0-2.14-1.74-3.88-3.88-3.88h-1.27v3.02c0 .48-.39.87-.87.87s-.87-.39-.87-.87V11.4h-1.73v3.02c0 .48-.39.87-.87.87s-.87-.39-.87-.87V7.08h.35c.48 0 .87-.39.87-.87V1.62c0-.48-.39-.87-.87-.87H.87C.39.75 0 1.14 0 1.62v4.59c0 .48.39.87.87.87h.35v4l7.39 7.39H6.16L1.22 13.53c0 .51 0 8.78 0 9.2 0 .48.39.87.87.87h21.04c.48 0 .87-.39.87-.87 0-.16 0-6.85 0-7.02zM1.73 5.04V2.5h11.41v2.54H1.73zm20.54 16.03H2.94v-1.69h19.33v1.69z"
        />
        <SvgText
          x={7}
          y={11}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#ffffff"
          fontSize={8}
          fontWeight="bold"
          transform="rotate(45, 6, 12)"
        >
          {String(speedVal)}
        </SvgText>
      </G>
    </SvgOverflow>
  );
}

// ============================================
// COLLECTION ICONS
// ============================================

export function RecycleIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 232.058 232.058" fill={color}>
      <G>
        <Path d="M16.45,103.92c5.972-33.874,29.885-61.607,61.536-73.034L76.5,33.461c-2.072,3.587-0.844,8.174,2.743,10.246c1.182,0.682,2.471,1.007,3.744,1.007c2.591,0,5.112-1.345,6.501-3.75l10.34-17.901c0.995-1.723,1.266-3.77,0.751-5.691c-0.515-1.922-1.771-3.56-3.494-4.555L79.179,2.476c-3.59-2.072-8.175-0.842-10.246,2.744c-2.071,3.587-0.843,8.174,2.744,10.245l1.868,1.079C36.59,29.628,8.631,61.879,1.679,101.315c-3.364,19.06-1.651,38.703,4.953,56.807c1.11,3.043,3.984,4.931,7.047,4.931c0.853,0,1.722-0.147,2.569-0.456c3.892-1.42,5.896-5.725,4.476-9.616C15.022,137.352,13.544,120.388,16.45,103.92z" />
        <Path d="M193.646,180.699c-3.172-2.666-7.902-2.256-10.567,0.915c-21.818,25.955-56.084,38.429-89.437,32.542c-16.189-2.855-31.295-9.876-43.866-20.192h2.413c4.143,0,7.5-3.358,7.5-7.5c0-4.142-3.357-7.5-7.5-7.5H32.222c-1.927-0.182-3.923,0.376-5.523,1.718c-1.56,1.308-2.449,3.116-2.639,4.993c-0.001,0.007-0.002,0.013-0.003,0.02c0,0.002,0,0.004,0,0.006c-0.021,0.215-0.031,0.431-0.033,0.647c-0.001,0.038-0.006,0.074-0.006,0.112l-0.008,20.67c-0.002,4.142,3.355,7.501,7.497,7.503h0.003c4.141,0,7.498-3.356,7.5-7.497l0.001-2.612c14.795,12.509,32.75,21.004,52.026,24.403c6.326,1.116,12.679,1.662,18.994,1.662c32.221,0,63.415-14.205,84.53-39.323C197.227,188.096,196.817,183.364,193.646,180.699z" />
        <Path d="M231.052,142.479c-2.07-3.587-6.659-4.816-10.245-2.745l-2.467,1.424c0.102-0.53,0.222-1.057,0.315-1.588c5.109-28.982-1.372-58.216-18.25-82.32c-16.878-24.104-42.132-40.191-71.109-45.296c-4.08-0.718-7.97,2.006-8.687,6.085c-0.719,4.079,2.005,7.969,6.084,8.688c25.031,4.41,46.847,18.306,61.426,39.128c14.55,20.779,20.153,45.973,15.791,70.958l-1.099-1.903c-2.071-3.587-6.658-4.818-10.245-2.747c-3.588,2.07-4.817,6.657-2.747,10.245l10.336,17.909c0.995,1.723,2.633,2.98,4.555,3.495c0.639,0.171,1.291,0.256,1.941,0.256c1.305,0,2.6-0.341,3.75-1.005l17.906-10.338C231.894,150.653,233.123,146.066,231.052,142.479z" />
      </G>
    </Svg>
  );
}

export function CraftIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      <Path fill={color} d="M128.688 115.594v147.75h285v-147.75h-285zm-111.844 20.47c17.374 47.14 54.372 80.413 94.906 93.81v-93.81H16.844zm414.375 12.31v88.657c21.457-9.083 42.92-25.257 64.374-47.374-21.52-22.562-42.633-35.173-64.375-41.28zm-226.25 132.47c-12.15 38.536-33.897 71.5-60.595 100.47l257.844-.002c-28.705-29.016-49.952-62.054-61.5-100.468H204.97zM101.843 400v43.78h337.562V400H101.844z" />
    </Svg>
  );
}

// ============================================
// QUEST ICONS
// ============================================

export function CheckCircleIcon({ size = 24, color = "#16A34A" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={2} />
      <Path d="M7 12l3.5 3.5L17 9" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ClaimedIcon({ size = 24, color = "#9CA3AF" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} fill={color} fillOpacity={0.2} stroke={color} strokeWidth={2} />
      <Path d="M6.5 12l3 3L17.5 8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 12l3 3L13.5 9" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.4} />
    </Svg>
  );
}

export function XCircleIcon({ size = 24, color = "#DC2626" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={2} />
      <Path d="M9 9l6 6M15 9l-6 6" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function SparklesIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2l1.2 3.6L17 7l-3.8 1.2L12 12l-1.2-3.8L7 7l3.8-1.4L12 2z" fill={color} />
      <Path d="M19 13l.7 2L22 16l-2.3.7L19 19l-.7-2.3L16 16l2.3-.7L19 13z" fill={color} />
      <Path d="M5.5 15l.5 1.5L7.5 17l-1.5.5L5.5 19l-.5-1.5L3.5 17l1.5-.5L5.5 15z" fill={color} />
    </Svg>
  );
}

export function SettingsIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 8.25C9.92894 8.25 8.25 9.92893 8.25 12C8.25 14.0711 9.92894 15.75 12 15.75C14.0711 15.75 15.75 14.0711 15.75 12C15.75 9.92893 14.0711 8.25 12 8.25ZM9.75 12C9.75 10.7574 10.7574 9.75 12 9.75C13.2426 9.75 14.25 10.7574 14.25 12C14.25 13.2426 13.2426 14.25 12 14.25C10.7574 14.25 9.75 13.2426 9.75 12Z"
        fill={color}
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11.9747 1.25C11.5303 1.24999 11.1592 1.24999 10.8546 1.27077C10.5375 1.29241 10.238 1.33905 9.94761 1.45933C9.27379 1.73844 8.73843 2.27379 8.45932 2.94762C8.31402 3.29842 8.27467 3.66812 8.25964 4.06996C8.24756 4.39299 8.08454 4.66251 7.84395 4.80141C7.60337 4.94031 7.28845 4.94673 7.00266 4.79568C6.64714 4.60777 6.30729 4.45699 5.93083 4.40743C5.20773 4.31223 4.47642 4.50819 3.89779 4.95219C3.64843 5.14353 3.45827 5.3796 3.28099 5.6434C3.11068 5.89681 2.92517 6.21815 2.70294 6.60307L2.67769 6.64681C2.45545 7.03172 2.26993 7.35304 2.13562 7.62723C1.99581 7.91267 1.88644 8.19539 1.84541 8.50701C1.75021 9.23012 1.94617 9.96142 2.39016 10.5401C2.62128 10.8412 2.92173 11.0602 3.26217 11.2741C3.53595 11.4461 3.68788 11.7221 3.68786 12C3.68785 12.2778 3.53592 12.5538 3.26217 12.7258C2.92169 12.9397 2.62121 13.1587 2.39007 13.4599C1.94607 14.0385 1.75012 14.7698 1.84531 15.4929C1.88634 15.8045 1.99571 16.0873 2.13552 16.3727C2.26983 16.6469 2.45535 16.9682 2.67758 17.3531L2.70284 17.3969C2.92507 17.7818 3.11058 18.1031 3.28089 18.3565C3.45817 18.6203 3.64833 18.8564 3.89769 19.0477C4.47632 19.4917 5.20763 19.6877 5.93073 19.5925C6.30717 19.5429 6.647 19.3922 7.0025 19.2043C7.28833 19.0532 7.60329 19.0596 7.8439 19.1986C8.08452 19.3375 8.24756 19.607 8.25964 19.9301C8.27467 20.3319 8.31403 20.7016 8.45932 21.0524C8.73843 21.7262 9.27379 22.2616 9.94761 22.5407C10.238 22.661 10.5375 22.7076 10.8546 22.7292C11.1592 22.75 11.5303 22.75 11.9747 22.75H12.0252C12.4697 22.75 12.8407 22.75 13.1454 22.7292C13.4625 22.7076 13.762 22.661 14.0524 22.5407C14.7262 22.2616 15.2616 21.7262 15.5407 21.0524C15.686 20.7016 15.7253 20.3319 15.7403 19.93C15.7524 19.607 15.9154 19.3375 16.156 19.1985C16.3966 19.0596 16.7116 19.0532 16.9974 19.2042C17.3529 19.3921 17.6927 19.5429 18.0692 19.5924C18.7923 19.6876 19.5236 19.4917 20.1022 19.0477C20.3516 18.8563 20.5417 18.6203 20.719 18.3565C20.8893 18.1031 21.0748 17.7818 21.297 17.3969L21.3223 17.3531C21.5445 16.9682 21.7301 16.6468 21.8644 16.3726C22.0042 16.0872 22.1135 15.8045 22.1546 15.4929C22.2498 14.7697 22.0538 14.0384 21.6098 13.4598C21.3787 13.1586 21.0782 12.9397 20.7378 12.7258C20.464 12.5538 20.3121 12.2778 20.3121 11.9999C20.3121 11.7221 20.464 11.4462 20.7377 11.2742C21.0783 11.0603 21.3788 10.8414 21.6099 10.5401C22.0539 9.96149 22.2499 9.23019 22.1547 8.50708C22.1136 8.19546 22.0043 7.91274 21.8645 7.6273C21.7302 7.35313 21.5447 7.03183 21.3224 6.64695L21.2972 6.60318C21.0749 6.21825 20.8894 5.89688 20.7191 5.64347C20.5418 5.37967 20.3517 5.1436 20.1023 4.95225C19.5237 4.50826 18.7924 4.3123 18.0692 4.4075C17.6928 4.45706 17.353 4.60782 16.9975 4.79572C16.7117 4.94679 16.3967 4.94036 16.1561 4.80144C15.9155 4.66253 15.7524 4.39297 15.7403 4.06991C15.7253 3.66808 15.686 3.2984 15.5407 2.94762C15.2616 2.27379 14.7262 1.73844 14.0524 1.45933C13.762 1.33905 13.4625 1.29241 13.1454 1.27077C12.8407 1.24999 12.4697 1.24999 12.0252 1.25H11.9747ZM10.5216 2.84515C10.5988 2.81319 10.716 2.78372 10.9567 2.76729C11.2042 2.75041 11.5238 2.75 12 2.75C12.4762 2.75 12.7958 2.75041 13.0432 2.76729C13.284 2.78372 13.4012 2.81319 13.4783 2.84515C13.7846 2.97202 14.028 3.21536 14.1548 3.52165C14.1949 3.61826 14.228 3.76887 14.2414 4.12597C14.271 4.91835 14.68 5.68129 15.4061 6.10048C16.1321 6.51968 16.9974 6.4924 17.6984 6.12188C18.0143 5.9549 18.1614 5.90832 18.265 5.89467C18.5937 5.8514 18.9261 5.94047 19.1891 6.14228C19.2554 6.19312 19.3395 6.27989 19.4741 6.48016C19.6125 6.68603 19.7726 6.9626 20.0107 7.375C20.2488 7.78741 20.4083 8.06438 20.5174 8.28713C20.6235 8.50382 20.6566 8.62007 20.6675 8.70287C20.7108 9.03155 20.6217 9.36397 20.4199 9.62698C20.3562 9.70995 20.2424 9.81399 19.9397 10.0041C19.2684 10.426 18.8122 11.1616 18.8121 11.9999C18.8121 12.8383 19.2683 13.574 19.9397 13.9959C20.2423 14.186 20.3561 14.29 20.4198 14.373C20.6216 14.636 20.7107 14.9684 20.6674 15.2971C20.6565 15.3799 20.6234 15.4961 20.5173 15.7128C20.4082 15.9355 20.2487 16.2125 20.0106 16.6249C19.7725 17.0373 19.6124 17.3139 19.474 17.5198C19.3394 17.72 19.2553 17.8068 19.189 17.8576C18.926 18.0595 18.5936 18.1485 18.2649 18.1053C18.1613 18.0916 18.0142 18.045 17.6983 17.8781C16.9973 17.5075 16.132 17.4803 15.4059 17.8995C14.68 18.3187 14.271 19.0816 14.2414 19.874C14.228 20.2311 14.1949 20.3817 14.1548 20.4784C14.028 20.7846 13.7846 21.028 13.4783 21.1549C13.4012 21.1868 13.284 21.2163 13.0432 21.2327C12.7958 21.2496 12.4762 21.25 12 21.25C11.5238 21.25 11.2042 21.2496 10.9567 21.2327C10.716 21.2163 10.5988 21.1868 10.5216 21.1549C10.2154 21.028 9.97201 20.7846 9.84514 20.4784C9.80512 20.3817 9.77195 20.2311 9.75859 19.874C9.72896 19.0817 9.31997 18.3187 8.5939 17.8995C7.86784 17.4803 7.00262 17.5076 6.30158 17.8781C5.98565 18.0451 5.83863 18.0917 5.73495 18.1053C5.40626 18.1486 5.07385 18.0595 4.81084 17.8577C4.74458 17.8069 4.66045 17.7201 4.52586 17.5198C4.38751 17.314 4.22736 17.0374 3.98926 16.625C3.75115 16.2126 3.59171 15.9356 3.4826 15.7129C3.37646 15.4962 3.34338 15.3799 3.33248 15.2971C3.28921 14.9684 3.37828 14.636 3.5801 14.373C3.64376 14.2901 3.75761 14.186 4.0602 13.9959C4.73158 13.5741 5.18782 12.8384 5.18786 12.0001C5.18791 11.1616 4.73165 10.4259 4.06021 10.004C3.75769 9.81389 3.64385 9.70987 3.58019 9.62691C3.37838 9.3639 3.28931 9.03149 3.33258 8.7028C3.34348 8.62001 3.37656 8.50375 3.4827 8.28707C3.59181 8.06431 3.75125 7.78734 3.98935 7.37493C4.22746 6.96253 4.3876 6.68596 4.52596 6.48009C4.66055 6.27983 4.74468 6.19305 4.81093 6.14222C5.07395 5.9404 5.40636 5.85133 5.73504 5.8946C5.83873 5.90825 5.98576 5.95483 6.30173 6.12184C7.00273 6.49235 7.86791 6.51962 8.59394 6.10045C9.31998 5.68128 9.72896 4.91837 9.75859 4.12602C9.77195 3.76889 9.80512 3.61827 9.84514 3.52165C9.97201 3.21536 10.2154 2.97202 10.5216 2.84515Z"
        fill={color}
      />
    </Svg>
  );
}

export function ShieldUserIcon({ size = 24, color = "#FFFFFF" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L4 5V11C4 16.5 7.5 20.5 12 22C16.5 20.5 20 16.5 20 11V5L12 2Z"
        fill={color}
        fillOpacity={0.2}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={9} r={2.5} fill={color} />
      <Path
        d="M8 16C8 14 9.5 13 12 13C14.5 13 16 14 16 16"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function HelpCircleIcon({ size = 24, color = "#DB2777", noCircle = false }: IconProps & { noCircle?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {!noCircle && <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={2} />}
      <Path
        d="M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.5-1.5 2-2.5 2.5V14"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx={12} cy={17} r={1} fill={color} />
    </Svg>
  );
}

export function WalkingIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Head */}
      <Circle cx={13} cy={3.5} r={2} fill={color} />
      {/* Body */}
      <Path d="M13 5.5L12 10" stroke={color} strokeWidth={2} strokeLinecap="round" />
      {/* Arms */}
      <Path d="M12 7.5L9.5 6M12 7.5L15 9.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* Legs */}
      <Path d="M12 10L9 14L7.5 18.5M12 10L15 14.5L17 18.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* Feet */}
      <Path d="M7.5 18.5L6 19M17 18.5L18.5 18" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

// ============================================
// RARITY ICON (for RarityCrest)
// ============================================

// ============================================
// PACK ICONS
// ============================================

export function CrownIcon({ size = 24 }: IconProps) {
  const fillOpacity = 0.4;
  return (
    <Svg width={size + 10} height={size + 10} viewBox="0 0 750 1000">
      <Path fill="#F8F8F8" opacity={0} d=" M352.000000,1001.000000  C235.014328,1001.000000 118.028664,1001.000000 1.021497,1001.000000  C1.021497,667.721802 1.021497,334.443665 1.021497,1.082740  C250.914200,1.082740 500.828430,1.082740 750.871338,1.082740  C750.871338,334.333313 750.871338,667.666626 750.875610,1001.000000  C642.226379,1001.000000 533.572876,1001.000000 424.654358,1000.608276  C443.156219,999.203552 461.939117,998.422791 480.686768,997.130798  C523.398315,994.187256 565.785400,988.820251 607.459229,978.732849  C629.157043,973.480774 650.699768,967.451111 669.973145,955.814209  C677.098328,951.512085 683.515137,945.659180 689.274109,939.583740  C694.451111,934.122131 696.524292,926.866516 694.758362,919.158325  C691.231873,903.765686 687.506042,888.418762 683.963318,873.029724  C683.050781,869.065857 682.512695,865.015686 681.990845,860.688232  C688.800171,843.340698 695.391235,826.298340 702.063354,809.287781  C703.745361,804.999634 703.196777,801.193176 700.363770,797.607788  C683.878296,776.744690 667.408936,755.868896 650.894165,734.673462  C650.258301,733.504456 649.662415,732.659302 649.060059,731.602417  C649.053589,731.390625 648.897339,730.996765 648.990967,730.586426  C647.841003,724.226257 646.745056,718.241089 645.331421,712.331909  C627.317139,637.029175 609.253357,561.738281 591.210510,486.442413  C582.868713,451.630493 574.579224,416.805939 566.185852,382.006470  C564.389038,374.556641 560.498718,372.028137 551.634827,372.482086  C545.900452,372.775787 544.626404,377.209839 543.674316,381.828217  C534.798584,424.884552 525.880249,467.932068 517.008301,510.989166  C509.886047,545.554932 502.810913,580.130432 495.445404,616.014648  C494.769348,613.393799 494.300995,612.030640 494.072876,610.628296  C486.959564,566.903076 479.916260,523.166321 472.766083,479.447144  C459.783936,400.068665 446.720337,320.703461 433.728088,241.326630  C421.137482,164.403580 408.596191,87.472427 396.024841,10.546208  C395.083557,4.786353 392.384460,1.907253 388.067780,1.937987  C383.727081,1.968892 381.080566,4.845345 380.209869,10.641578  C373.827057,53.131622 367.441162,95.621223 361.096405,138.116959  C350.644775,208.119659 340.230560,278.127930 329.787537,348.131897  C316.469421,437.408905 303.141327,526.684448 289.804596,615.958679  C289.088684,620.750916 288.253296,625.525391 287.473541,630.308105  C286.068756,628.639709 285.553406,626.970520 285.131378,625.277954  C266.562042,550.811523 248.009735,476.340820 229.428802,401.877228  C226.849701,391.541351 224.270859,381.201477 221.414719,370.940613  C220.276184,366.850403 213.623688,362.767120 209.642319,363.230865  C204.853714,363.788635 203.119629,367.290283 202.080505,371.393463  C180.089386,458.229950 158.117462,545.071350 136.087860,631.898132  C130.153061,655.289368 124.041420,678.635864 117.779236,702.159485  C116.984634,703.040833 116.421738,703.765625 115.562744,704.666260  C114.717651,705.570496 114.168655,706.298889 113.343727,707.174316  C110.655434,710.074890 108.242195,712.827637 105.830841,715.582092  C87.522903,736.494446 69.229309,757.419434 50.892277,778.306274  C48.201248,781.371582 47.458202,784.669006 48.985786,788.453796  C58.074234,810.971619 67.166252,833.488098 76.278824,856.330200  C76.788879,857.807800 77.277153,858.960205 77.802643,860.424316  C77.881325,861.151794 77.922791,861.567566 77.744186,862.287842  C73.353699,879.196472 69.559120,895.907837 64.866035,912.362915  C62.226547,921.617615 63.905090,929.385193 69.506248,936.727051  C77.560638,947.284424 88.851921,953.402771 100.527168,958.783813  C125.024170,970.074158 151.015320,976.607117 177.315399,981.942261  C231.979843,993.031128 287.316223,997.988159 342.993683,999.745239  C346.005981,999.840210 348.998352,1000.567200 352.000000,1001.000000  z" />
      <Path fill="#42413F" opacity={1} d=" M681.802612,861.005188  C682.512695,865.015686 683.050781,869.065857 683.963318,873.029724  C687.506042,888.418762 691.231873,903.765686 694.758362,919.158325  C696.524292,926.866516 694.451111,934.122131 689.274109,939.583740  C683.515137,945.659180 677.098328,951.512085 669.973145,955.814209  C650.699768,967.451111 629.157043,973.480774 607.459229,978.732849  C565.785400,988.820251 523.398315,994.187256 480.686768,997.130798  C461.939117,998.422791 443.156219,999.203552 424.194672,1000.608276  C421.958344,1001.000000 419.916656,1001.000000 417.375824,1000.657104  C415.568359,1000.235352 414.260040,1000.156433 412.487183,1000.044434  C396.705414,1000.044373 381.388214,1000.077332 365.823883,999.818115  C363.717834,1000.017273 361.858917,1000.508667 360.000000,1001.000000  C357.629425,1001.000000 355.258881,1001.000000 352.444153,1001.000000  C348.998352,1000.567200 346.005981,999.840210 342.993683,999.745239  C287.316223,997.988159 231.979843,993.031128 177.315399,981.942261  C151.015320,976.607117 125.024170,970.074158 100.527168,958.783813  C88.851921,953.402771 77.560638,947.284424 69.506248,936.727051  C63.905090,929.385193 62.226547,921.617615 64.866035,912.362915  C69.559120,895.907837 73.353699,879.196472 78.020432,862.479736  C80.789520,866.489441 83.765602,870.393433 85.132980,874.796875  C86.443359,879.016785 87.536293,882.861511 90.330566,886.599304  C92.489609,889.487427 92.301308,894.130371 92.951019,897.695923  C91.178314,893.638123 89.611214,889.877502 87.570206,884.979614  C84.775223,895.705383 82.947601,905.369446 79.652046,914.503845  C77.139565,921.467712 79.267044,926.327148 84.094231,930.389832  C89.025620,934.540222 94.306213,938.463013 99.946388,941.548889  C116.854630,950.799622 135.190186,956.392212 153.774979,961.077942  C210.357254,975.343933 268.117889,980.875122 326.192780,983.930359  C339.145569,984.611816 352.112793,985.018799 365.219940,985.891235  C365.945496,986.481140 366.523682,986.948792 367.103577,986.950867  C380.149811,986.997803 393.196411,987.024048 406.242126,986.935608  C407.185394,986.929199 408.122528,986.017883 409.020905,985.393066  C408.979309,985.258850 408.998077,984.978333 409.460663,985.061523  C458.036865,984.307068 505.968842,981.045593 553.575195,973.864441  C581.069885,969.716980 608.323975,964.342102 634.660522,955.153381  C647.878967,950.541565 660.875061,945.365845 671.912109,936.396729  C676.138489,932.962219 680.511963,928.802917 679.616943,923.150513  C677.807861,911.725098 674.848572,900.481873 672.363647,889.163452  C672.019409,889.190491 671.675232,889.217529 671.330994,889.244568  C669.539490,893.493286 667.747925,897.742004 665.718262,901.768372  C665.582642,899.884338 665.685181,898.222534 665.853577,895.494385  C663.864319,897.078186 662.792419,897.931641 660.827820,899.495789  C660.040771,896.848877 659.450989,894.865295 658.861145,892.881653  C662.997314,895.740112 664.155640,895.524902 666.074646,891.712891  C666.609802,890.649658 667.589539,889.712219 668.565247,888.985596  C673.113525,885.598450 674.517761,878.323853 671.676208,873.495605  C671.055664,872.441223 671.260559,870.900940 671.006226,868.990234  C673.020264,869.807495 674.165039,870.272034 674.931213,870.582947  C677.370789,867.182495 679.586670,864.093872 681.802612,861.005188  z" />
      <Path fill="#42413F" opacity={1} d=" M118.010925,702.002869  C124.041420,678.635864 130.153061,655.289368 136.087860,631.898132  C158.117462,545.071350 180.089386,458.229950 202.080505,371.393463  C203.119629,367.290283 204.853714,363.788635 209.642319,363.230865  C213.623688,362.767120 220.276184,366.850403 221.414719,370.940613  C224.270859,381.201477 226.849701,391.541351 229.428802,401.877228  C248.009735,476.340820 266.562042,550.811523 285.131378,625.277954  C285.553406,626.970520 286.068756,628.639709 287.473541,630.308105  C288.253296,625.525391 289.088684,620.750916 289.804596,615.958679  C303.141327,526.684448 316.469421,437.408905 329.787537,348.131897  C340.230560,278.127930 350.644775,208.119659 361.096405,138.116959  C367.441162,95.621223 373.827057,53.131622 380.209869,10.641578  C381.080566,4.845345 383.727081,1.968892 388.067780,1.937987  C392.384460,1.907253 395.083557,4.786353 396.024841,10.546208  C408.596191,87.472427 421.137482,164.403580 433.728088,241.326630  C446.720337,320.703461 459.783936,400.068665 472.766083,479.447144  C479.916260,523.166321 486.959564,566.903076 494.072876,610.628296  C494.300995,612.030640 494.769348,613.393799 495.445404,616.014648  C502.810913,580.130432 509.886047,545.554932 517.008301,510.989166  C525.880249,467.932068 534.798584,424.884552 543.674316,381.828217  C544.626404,377.209839 545.900452,372.775787 551.634827,372.482086  C560.498718,372.028137 564.389038,374.556641 566.185852,382.006470  C574.579224,416.805939 582.868713,451.630493 591.210510,486.442413  C609.253357,561.738281 627.317139,637.029175 645.331421,712.331909  C646.745056,718.241089 647.841003,724.226257 648.643433,730.516785  C646.234070,729.358765 643.862793,728.180359 642.370911,726.303101  C637.297058,719.918640 632.538452,713.283936 627.646667,706.754333  C626.836365,705.672729 625.962219,704.639038 625.426147,703.710754  C626.330139,704.102661 626.925537,704.367004 628.019409,704.852661  C603.872986,604.080566 579.831177,503.745270 555.531250,402.332520  C554.789856,404.413086 554.287048,405.427826 554.066345,406.500610  C541.480042,467.669220 528.900146,528.839172 516.360657,590.017395  C511.713196,612.691772 507.185181,635.390747 502.559967,658.069763  C501.361115,663.948181 498.284912,667.139099 494.115784,667.104309  C489.687592,667.067383 487.290985,664.014648 486.314453,657.773315  C483.174683,637.705688 479.993500,617.644043 476.715027,597.598572  C462.174957,508.696533 447.579468,419.803528 433.034882,330.902191  C419.619110,248.900391 406.244446,166.891861 392.846191,84.887192  C391.534515,76.858994 390.184174,68.837105 388.851776,60.812283  C388.565186,60.833992 388.278564,60.855705 387.991974,60.877419  C387.043518,67.607742 386.095032,74.338058 385.046509,81.469307  C375.973816,141.653198 366.981293,201.433197 358.033783,261.219940  C348.124237,327.435150 338.259918,393.657135 328.368347,459.875031  C320.150116,514.890808 311.937012,569.907288 303.684784,624.917969  C301.782196,637.600830 299.866425,650.284851 297.688507,662.922119  C296.554840,669.500244 292.085999,671.532898 285.865173,669.208679  C281.053894,667.411194 279.119110,663.824890 277.967743,659.161011  C268.586517,621.158936 259.107574,583.180908 249.636322,545.201111  C237.706924,497.364197 225.757339,449.532288 213.813171,401.699066  C213.337646,399.794739 212.827896,397.898926 212.334076,395.999146  C210.809830,398.969788 210.189117,401.725800 209.494064,404.462921  C184.814377,501.650269 160.120331,598.833923 135.498230,696.035889  C135.031647,697.877808 135.404755,699.932495 135.021133,701.951050  C133.676147,702.846252 132.696121,703.678162 131.434662,704.749023  C131.103439,702.928589 130.936813,701.629150 130.624817,700.365479  C129.367126,695.271484 128.021454,694.770996 123.684654,697.806396  C121.758125,699.154785 119.900063,700.601013 118.010925,702.002869  z" />
      <Path fill="#484443" opacity={1} d=" M625.117554,703.583191  C625.962219,704.639038 626.836365,705.672729 627.646667,706.754333  C632.538452,713.283936 637.297058,719.918640 642.370911,726.303101  C643.862793,728.180359 646.234070,729.358765 648.549805,730.927124  C648.897339,730.996765 649.053589,731.390625 649.045532,731.964966  C649.669678,733.358643 650.301941,734.177979 650.934204,734.997314  C667.408936,755.868896 683.878296,776.744690 700.363770,797.607788  C703.196777,801.193176 703.745361,804.999634 702.063354,809.287781  C695.391235,826.298340 688.800171,843.340698 681.990845,860.688232  C679.586670,864.093872 677.370789,867.182495 674.931213,870.582947  C674.165039,870.272034 673.020264,869.807495 671.006226,868.990234  C671.260559,870.900940 671.055664,872.441223 671.676208,873.495605  C674.517761,878.323853 673.113525,885.598450 668.565247,888.985596  C667.589539,889.712219 666.609802,890.649658 666.074646,891.712891  C664.155640,895.524902 662.997314,895.740112 658.861145,892.881653  C659.450989,894.865295 660.040771,896.848877 660.827820,899.495789  C662.792419,897.931641 663.864319,897.078186 665.853577,895.494385  C665.685181,898.222534 665.582642,899.884338 665.689087,902.139404  C663.825867,908.180054 661.916687,913.696411 659.643433,919.058533  C656.244202,927.076660 649.426208,927.957214 644.360718,920.915588  C620.435059,887.656799 596.631348,854.310364 572.752136,821.018066  C570.181702,817.434387 569.895142,814.031128 571.716492,809.843384  C578.754395,793.661987 585.558411,777.376404 592.265320,761.053894  C599.353943,743.802368 606.191467,726.447754 613.224182,709.173035  C615.878662,702.652771 619.273865,701.157959 625.117554,703.583191  z" />
      <Path fill="#484443" opacity={1} d=" M117.779221,702.159485  C119.900063,700.601013 121.758125,699.154785 123.684654,697.806396  C128.021454,694.770996 129.367126,695.271484 130.624817,700.365479  C130.936813,701.629150 131.103439,702.928589 131.434662,704.749023  C132.696121,703.678162 133.676147,702.846252 135.250305,702.191650  C150.350220,733.964294 164.798401,765.586426 179.417526,797.129211  C181.905167,802.496582 181.081207,806.841736 177.627701,811.440674  C162.041580,832.196106 146.636078,853.087097 131.150604,873.918274  C123.804703,883.800049 116.571999,893.771179 109.008904,903.484436  C104.124176,909.757935 98.078659,908.853516 94.598076,901.686218  C94.022629,900.501282 93.632431,899.226440 93.156624,897.993103  C92.301308,894.130371 92.489609,889.487427 90.330566,886.599304  C87.536293,882.861511 86.443359,879.016785 85.132980,874.796875  C83.765602,870.393433 80.789520,866.489441 78.240494,862.175171  C77.922791,861.567566 77.881325,861.151794 78.084351,860.238647  C77.638252,858.495850 76.947655,857.250427 76.257050,856.005005  C67.166252,833.488098 58.074234,810.971619 48.985786,788.453796  C47.458202,784.669006 48.201248,781.371582 50.892277,778.306274  C69.229309,757.419434 87.522903,736.494446 105.830841,715.582092  C108.242195,712.827637 110.655434,710.074890 113.740318,707.119751  C114.894844,706.108887 115.376854,705.299622 115.858856,704.490417  C116.421738,703.765625 116.984634,703.040833 117.779221,702.159485  z" />
      <Path fill="#F2D177" fillOpacity={fillOpacity} opacity={1} d=" M92.951019,897.695923  C93.632431,899.226440 94.022629,900.501282 94.598076,901.686218  C98.078659,908.853516 104.124176,909.757935 109.008904,903.484436  C116.571999,893.771179 123.804703,883.800049 131.150604,873.918274  C146.636078,853.087097 162.041580,832.196106 177.627701,811.440674  C181.081207,806.841736 181.905167,802.496582 179.417526,797.129211  C164.798401,765.586426 150.350220,733.964294 135.615265,702.128418  C135.404755,699.932495 135.031647,697.877808 135.498230,696.035889  C160.120331,598.833923 184.814377,501.650269 209.494064,404.462921  C210.189117,401.725800 210.809830,398.969788 212.334076,395.999146  C212.827896,397.898926 213.337646,399.794739 213.813171,401.699066  C225.757339,449.532288 237.706924,497.364197 249.636322,545.201111  C259.107574,583.180908 268.586517,621.158936 277.967743,659.161011  C279.119110,663.824890 281.053894,667.411194 285.865173,669.208679  C292.085999,671.532898 296.554840,669.500244 297.688507,662.922119  C299.866425,650.284851 301.782196,637.600830 303.684784,624.917969  C311.937012,569.907288 320.150116,514.890808 328.368347,459.875031  C338.259918,393.657135 348.124237,327.435150 358.033783,261.219940  C366.981293,201.433197 375.973816,141.653198 385.309448,81.781586  C386.111908,90.469368 386.780426,99.241470 386.946960,108.023079  C387.407532,132.312363 387.685883,156.605301 387.985504,180.897415  C388.348816,210.354630 388.637115,239.812790 389.000946,269.269989  C389.298950,293.395172 389.673737,317.519409 389.989777,341.644409  C390.338562,368.268951 390.644531,394.894043 390.996521,421.518555  C391.308838,445.143829 391.774933,468.767700 391.967957,492.393829  C392.382812,543.183350 392.650818,593.973999 393.029114,644.763794  C393.061157,649.065002 393.520538,653.361816 393.662689,657.664612  C393.694061,658.614746 393.220551,659.581543 392.607849,660.631226  C389.980011,662.262268 387.340057,663.456421 385.561371,665.427673  C383.132080,668.119934 381.343414,671.393677 379.306183,674.435608  C363.653717,697.806763 348.053223,721.212891 332.326111,744.533691  C328.591858,750.070984 326.396851,755.852539 326.336395,762.659912  C326.241852,773.307068 325.589020,783.948914 325.188782,794.593689  C324.156952,822.036865 323.039215,849.477600 322.247314,876.927734  C322.164093,879.811646 323.404266,883.185608 325.090485,885.588135  C331.398376,894.575562 338.132263,903.264709 344.733795,912.045166  C356.235413,927.343201 367.711578,942.660767 379.294800,957.896912  C383.500000,963.428284 388.337616,963.645447 393.233276,958.819214  C394.162872,957.902710 395.020538,956.913208 396.202789,956.099609  C396.799805,957.879333 397.348480,959.513733 397.369354,961.154907  C397.464447,968.624146 397.411041,976.095337 397.411041,982.496582  C401.719421,983.419373 405.358734,984.198853 408.998077,984.978333  C408.998077,984.978333 408.979309,985.258850 408.573547,985.307007  C393.803009,985.420837 379.438171,985.486511 365.073364,985.552246  C352.112793,985.018799 339.145569,984.611816 326.192780,983.930359  C268.117889,980.875122 210.357254,975.343933 153.774979,961.077942  C135.190186,956.392212 116.854630,950.799622 99.946388,941.548889  C94.306213,938.463013 89.025620,934.540222 84.094231,930.389832  C79.267044,926.327148 77.139565,921.467712 79.652046,914.503845  C82.947601,905.369446 84.775223,895.705383 87.570206,884.979614  C89.611214,889.877502 91.178314,893.638123 92.951019,897.695923  z" />
      <Path fill="#DFC16E" fillOpacity={fillOpacity} opacity={1} d=" M409.460663,985.061523  C405.358734,984.198853 401.719421,983.419373 397.411041,982.496582  C397.411041,976.095337 397.464447,968.624146 397.369354,961.154907  C397.348480,959.513733 396.799805,957.879333 396.392883,955.824951  C415.522919,932.242798 434.877747,909.177551 453.843811,885.796997  C456.485413,882.540527 458.565704,877.748169 458.616028,873.638794  C459.076599,836.025879 459.112427,798.406433 459.002441,760.789734  C458.991760,757.143677 458.008331,752.952820 456.048645,749.945190  C437.699890,721.784363 419.106049,693.781799 400.349213,665.890747  C398.758362,663.525208 395.476013,662.297180 392.979492,660.540649  C393.220551,659.581543 393.694061,658.614746 393.662689,657.664612  C393.520538,653.361816 393.061157,649.065002 393.029114,644.763794  C392.650818,593.973999 392.382812,543.183350 391.967957,492.393829  C391.774933,468.767700 391.308838,445.143829 390.996521,421.518555  C390.644531,394.894043 390.338562,368.268951 389.989777,341.644409  C389.673737,317.519409 389.298950,293.395172 389.000946,269.269989  C388.637115,239.812790 388.348816,210.354630 387.985504,180.897415  C387.685883,156.605301 387.407532,132.312363 386.946960,108.023079  C386.780426,99.241470 386.111908,90.469368 385.409485,81.380661  C386.095032,74.338058 387.043518,67.607742 387.991974,60.877419  C388.278564,60.855705 388.565186,60.833992 388.851776,60.812283  C390.184174,68.837105 391.534515,76.858994 392.846191,84.887192  C406.244446,166.891861 419.619110,248.900391 433.034882,330.902191  C447.579468,419.803528 462.174957,508.696533 476.715027,597.598572  C479.993500,617.644043 483.174683,637.705688 486.314453,657.773315  C487.290985,664.014648 489.687592,667.067383 494.115784,667.104309  C498.284912,667.139099 501.361115,663.948181 502.559967,658.069763  C507.185181,635.390747 511.713196,612.691772 516.360657,590.017395  C528.900146,528.839172 541.480042,467.669220 554.066345,406.500610  C554.287048,405.427826 554.789856,404.413086 555.531250,402.332520  C579.831177,503.745270 603.872986,604.080566 628.019409,704.852661  C626.925537,704.367004 626.330139,704.102661 625.426147,703.710754  C619.273865,701.157959 615.878662,702.652771 613.224182,709.173035  C606.191467,726.447754 599.353943,743.802368 592.265320,761.053894  C585.558411,777.376404 578.754395,793.661987 571.716492,809.843384  C569.895142,814.031128 570.181702,817.434387 572.752136,821.018066  C596.631348,854.310364 620.435059,887.656799 644.360718,920.915588  C649.426208,927.957214 656.244202,927.076660 659.643433,919.058533  C661.916687,913.696411 663.825867,908.180054 665.927185,902.361694  C667.747925,897.742004 669.539490,893.493286 671.330994,889.244568  C671.675232,889.217529 672.019409,889.190491 672.363647,889.163452  C674.848572,900.481873 677.807861,911.725098 679.616943,923.150513  C680.511963,928.802917 676.138489,932.962219 671.912109,936.396729  C660.875061,945.365845 647.878967,950.541565 634.660522,955.153381  C608.323975,964.342102 581.069885,969.716980 553.575195,973.864441  C505.968842,981.045593 458.036865,984.307068 409.460663,985.061523  z" />
      <Path fill="#F06E5C" fillOpacity={fillOpacity} opacity={1} d=" M618.381836,736.583069  C619.071594,735.300110 619.614502,734.348877 620.530457,732.744019  C626.191772,747.929565 630.707520,762.827087 637.261719,776.766052  C642.778992,788.499878 641.460999,798.496399 635.295715,809.038147  C633.586304,811.960999 632.372131,812.983704 628.837585,812.428101  C617.672607,810.672791 606.419800,809.477966 595.204041,808.041504  C593.757080,807.856201 592.328796,807.525330 590.057129,807.108826  C599.582764,783.379395 608.908875,760.147095 618.381836,736.583069  z" />
      <Path fill="#B3515D" fillOpacity={fillOpacity} opacity={1} d=" M624.961304,823.007996  C630.973450,823.024231 635.804016,824.274536 639.104614,829.440735  C640.963257,832.349915 643.495544,834.856995 645.890381,837.388062  C648.925171,840.595459 649.828552,843.963013 649.202148,848.556885  C647.387451,861.865662 646.296021,875.272583 644.859924,888.634399  C644.723755,889.901550 644.160522,891.122864 643.426453,893.622131  C625.414307,868.493958 607.976807,844.167419 589.523132,818.423340  C602.121765,820.062256 613.318359,821.518799 624.961304,823.007996  z" />
      <Path fill="#CF5147" fillOpacity={fillOpacity} opacity={1} d=" M641.814087,748.039368  C655.923401,765.744141 670.032715,783.448853 684.546936,801.661621  C679.432800,804.346863 675.337219,806.887085 670.914917,808.567688  C669.683716,809.035583 667.081482,807.343811 665.795166,805.990051  C655.372192,795.020081 649.499084,781.557983 644.962646,767.365479  C643.099854,761.537476 640.891418,755.819946 638.885742,749.371948  C639.892151,748.474243 640.853149,748.256775 641.814087,748.039368  z" />
      <Path fill="#A35172" fillOpacity={fillOpacity} opacity={1} d=" M659.364136,878.266296  C658.847900,879.488647 658.476990,880.365112 658.106018,881.241577  C657.684082,881.189636 657.262207,881.137756 656.840271,881.085815  C657.206970,877.359497 657.605469,873.635986 657.932678,869.906189  C658.395813,864.628357 658.079468,859.157532 659.389771,854.104553  C662.162476,843.411499 665.749329,832.928223 669.083313,822.384583  C669.351257,821.537170 670.092285,820.562622 670.870850,820.200378  C674.587280,818.471130 678.392700,816.932800 683.805908,814.628784  C675.389648,836.552979 667.449585,857.236694 659.364136,878.266296  z" />
      <Path fill="#CB5149" fillOpacity={fillOpacity} opacity={1} d=" M646.923462,808.906250  C647.754333,807.087219 648.474426,805.624451 649.201538,804.147522  C659.274292,809.742310 661.070679,818.889404 654.059509,830.491699  C650.561340,826.310730 646.482544,822.691345 644.222412,818.164001  C643.208923,816.133789 645.837097,812.285706 646.923462,808.906250  z" />
      <Path fill="#CB5149" fillOpacity={fillOpacity} opacity={1} d=" M641.788391,747.703430  C640.853149,748.256775 639.892151,748.474243 638.847900,748.991333  C637.369202,746.534302 635.973877,743.777649 634.578613,741.020935  C635.173279,740.652710 635.768005,740.284485 636.362732,739.916260  C638.162720,742.400024 639.962708,744.883789 641.788391,747.703430  z" />
      <Path fill="#A85073" fillOpacity={fillOpacity} opacity={1} d=" M144.364792,805.170776  C150.726166,804.598816 156.637146,804.089539 162.548111,803.580322  C162.935959,803.899780 163.323807,804.219299 163.711655,804.538757  C145.304504,829.331787 126.897377,854.124817 107.643623,880.058167  C106.292686,870.139526 105.069092,861.698853 104.008560,853.237732  C102.545158,841.562317 101.227623,829.868774 99.799698,818.188843  C99.280067,813.938477 104.611862,808.554810 108.870972,808.362671  C117.608276,807.968567 126.328545,807.157898 135.047821,806.423706  C138.015701,806.173767 140.959549,805.638489 144.364792,805.170776  z" />
      <Path fill="#D25046" fillOpacity={fillOpacity} opacity={1} d=" M145.391479,794.412109  C136.032990,795.377136 127.098045,796.090271 118.199188,797.116333  C114.479050,797.545410 112.857994,796.143372 111.951973,792.655884  C110.746445,788.015625 108.968620,783.526611 107.596947,778.924805  C107.301399,777.933350 107.414825,776.628906 107.803352,775.653259  C113.437408,761.505127 119.162224,747.393311 124.835083,733.260559  C125.999611,730.359436 127.040657,727.408752 128.706787,722.965759  C139.614868,746.735962 149.941406,769.238892 160.627319,792.524963  C155.182571,793.173157 150.506088,793.729858 145.391479,794.412109  z" />
      <Path fill="#EB6E5E" fillOpacity={fillOpacity} opacity={1} d=" M92.209023,776.212585  C84.955009,785.286743 84.952858,785.293274 74.068542,781.726379  C72.705978,781.279907 71.380569,780.720032 69.412247,779.976318  C82.809189,764.681091 95.828835,749.816589 108.848480,734.952087  C109.227509,735.158508 109.606529,735.364990 109.985550,735.571411  C107.289764,743.098816 104.529160,750.603882 101.917976,758.160522  C99.692863,764.599976 97.620560,771.088745 92.209023,776.212585  z" />
      <Path fill="#AF525E" fillOpacity={fillOpacity} opacity={1} d=" M71.067078,802.958862  C69.500671,799.131409 68.039833,795.673279 66.492317,792.009949  C75.538544,791.523254 80.287537,795.345642 85.041458,805.428467  C90.157585,816.279480 89.721802,828.014343 91.064034,839.473694  C91.530640,843.457458 91.743988,847.470947 92.073006,851.470825  C91.556564,851.599976 91.040123,851.729126 90.523689,851.858276  C84.073334,835.681580 77.622986,819.504822 71.067078,802.958862  z" />
      <Path fill="#C5534D" fillOpacity={fillOpacity} opacity={1} d=" M92.736862,797.181946  C90.836617,791.549194 96.274033,790.180542 98.643051,786.576050  C99.494026,789.130554 100.116249,791.791931 101.247681,794.215515  C103.112350,798.209900 100.993019,800.260437 97.811417,801.555298  C94.081116,803.073425 94.272614,799.219238 92.736862,797.181946  z" />
      <Path fill="#484443" opacity={1} d=" M392.607788,660.631226  C395.476013,662.297180 398.758362,663.525208 400.349213,665.890747  C419.106049,693.781799 437.699890,721.784363 456.048645,749.945190  C458.008331,752.952820 458.991760,757.143677 459.002441,760.789734  C459.112427,798.406433 459.076599,836.025879 458.616028,873.638794  C458.565704,877.748169 456.485413,882.540527 453.843811,885.796997  C434.877747,909.177551 415.522919,932.242798 396.101501,955.682739  C395.020538,956.913208 394.162872,957.902710 393.233276,958.819214  C388.337616,963.645447 383.500000,963.428284 379.294800,957.896912  C367.711578,942.660767 356.235413,927.343201 344.733795,912.045166  C338.132263,903.264709 331.398376,894.575562 325.090485,885.588135  C323.404266,883.185608 322.164093,879.811646 322.247314,876.927734  C323.039215,849.477600 324.156952,822.036865 325.188782,794.593689  C325.589020,783.948914 326.241852,773.307068 326.336395,762.659912  C326.396851,755.852539 328.591858,750.070984 332.326111,744.533691  C348.053223,721.212891 363.653717,697.806763 379.306183,674.435608  C381.343414,671.393677 383.132080,668.119934 385.561371,665.427673  C387.340057,663.456421 389.980011,662.262268 392.607788,660.631226  z" />
      <Path fill="#D15046" fillOpacity={fillOpacity} opacity={1} d=" M401.151917,851.317688  C403.738739,864.935852 395.282410,873.442383 388.020111,883.172668  C382.788055,876.187256 377.384979,870.273254 377.917694,860.608521  C378.923248,842.364197 378.766388,824.057007 379.170990,805.777710  C379.376801,796.479736 379.496185,787.166321 380.189819,777.899963  C380.436310,774.607605 381.877686,771.226685 383.463470,768.254150  C385.866486,763.749817 388.872498,759.567139 392.329437,754.137085  C397.132538,763.246155 405.736420,769.102539 405.094238,780.247070  C403.823700,802.294739 402.934692,824.364258 401.851868,846.422974  C401.779083,847.905334 401.403839,849.372864 401.151917,851.317688  z" />
      <Path fill="#D15046" fillOpacity={fillOpacity} opacity={1} d=" M340.798462,794.669617  C340.813110,783.945129 340.813110,773.692566 340.813110,762.310486  C349.248627,765.870911 356.427795,768.782959 363.461090,772.012756  C364.383545,772.436340 365.038940,774.499878 365.007690,775.784058  C364.497498,796.743713 363.819214,817.699097 363.266479,838.657776  C363.082031,845.651062 363.070374,852.651428 363.128235,859.647339  C363.151947,862.516602 362.291443,864.041504 359.279358,865.024658  C353.602570,866.877686 348.155975,869.431702 342.596375,871.650879  C341.119873,872.240295 339.580383,872.671875 338.138153,873.153076  C338.138153,865.896240 338.027222,859.160339 338.169586,852.429749  C338.310120,845.783875 338.685516,839.142456 338.995697,832.500854  C339.577301,820.046997 340.186218,807.594543 340.798462,794.669617  z" />
      <Path fill="#B2515D" fillOpacity={fillOpacity} opacity={1} d=" M419.206421,793.383057  C419.538269,788.446838 419.637024,783.954163 420.182709,779.516357  C420.401855,777.734314 421.123169,775.318604 422.437195,774.483459  C429.132568,770.227478 436.096832,766.394409 443.594971,762.049500  C443.594971,798.044861 443.594971,833.310303 443.594971,868.943665  C442.209259,868.790833 441.036774,868.868164 440.012634,868.515137  C432.942841,866.077942 425.864197,863.653381 418.895264,860.949402  C417.764557,860.510681 416.400452,858.678467 416.440308,857.535522  C416.740570,848.920044 417.491302,840.321228 417.858398,831.706848  C418.395966,819.091919 418.731262,806.468445 419.206421,793.383057  z" />
      <Path fill="#D05046" fillOpacity={fillOpacity} opacity={1} d=" M398.021606,734.385254  C398.007568,719.314941 398.007568,704.679688 398.007568,689.315796  C411.780396,710.049805 425.444580,730.620178 439.513885,751.800476  C432.586395,755.770569 426.176392,759.556519 419.619659,763.068726  C418.733765,763.543274 416.449890,763.085205 415.930206,762.310120  C409.841675,753.229797 403.966827,744.006165 398.021606,734.385254  z" />
      <Path fill="#EF6E5D" fillOpacity={fillOpacity} opacity={1} d=" M379.834595,745.847656  C376.801544,750.658386 374.096313,755.255066 371.073059,759.632019  C370.337952,760.696228 368.214172,761.921509 367.310455,761.571472  C360.077728,758.769775 352.984772,755.607422 345.199371,752.277588  C358.818939,731.987793 372.011780,712.333679 385.204620,692.679626  C385.800751,692.773743 386.396912,692.867920 386.993042,692.962097  C386.993042,706.683960 387.499390,720.436340 386.674377,734.108398  C386.437012,738.042175 382.361298,741.744385 379.834595,745.847656  z" />
      <Path fill="#A85073" fillOpacity={fillOpacity} opacity={1} d=" M422.797058,900.794556  C413.546021,912.044312 404.535431,923.031311 395.524841,934.018311  C395.023804,933.775696 394.522736,933.533142 394.021698,933.290527  C394.021698,922.756531 393.975372,912.222046 394.097137,901.689453  C394.108643,900.693054 395.117249,899.669312 395.761261,898.725281  C401.187195,890.771851 406.680573,882.864014 412.052277,874.874268  C413.777924,872.307495 415.775116,871.288330 418.802826,872.426636  C425.312439,874.874084 431.858673,877.224304 439.298706,879.946899  C433.609100,887.149292 428.323303,893.840515 422.797058,900.794556  z" />
      <Path fill="#B1515D" fillOpacity={fillOpacity} opacity={1} d=" M361.191345,908.824158  C354.888092,900.501953 348.809113,892.457764 342.163635,883.663940  C349.915039,880.496338 356.869904,877.654297 363.861389,874.797180  C370.188721,884.086853 376.268402,892.965942 382.264771,901.900879  C382.772430,902.657349 382.902649,903.786682 382.905609,904.743713  C382.935425,914.402893 382.910339,924.062378 382.866516,933.721558  C382.863831,934.314087 382.573547,934.905396 382.106445,936.672241  C374.819489,926.962524 368.117554,918.032349 361.191345,908.824158  z" />
    </Svg>
  );
}

export function DiamondIcon({ size = 24, color = "#7C3AED" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3L20 9L12 21L4 9L12 3Z" fill={color} fillOpacity={0.2}
            stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M4 9H20M12 3L8 9M12 3L16 9M8 9L12 21M16 9L12 21"
            stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M9 6L7 9L10 13" stroke={color} strokeWidth={1}
            strokeLinecap="round" strokeOpacity={0.5} />
    </Svg>
  );
}

export function GiftBoxIcon({ size = 24, color = "#DC2626" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={9} width={16} height={12} rx={2}
            fill={color} fillOpacity={0.2} stroke={color} strokeWidth={2} />
      <Rect x={3} y={6} width={18} height={4} rx={1}
            fill={color} fillOpacity={0.3} stroke={color} strokeWidth={2} />
      <Path d="M12 6V21" stroke={color} strokeWidth={2} />
      <Path d="M4 13H20" stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

export function BoxIcon({ size = 24, color = "#6B7280" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 8L12 4L20 8V16L12 20L4 16V8Z"
            fill={color} fillOpacity={0.15} stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M12 4V20M4 8L12 12L20 8"
            stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </Svg>
  );
}

export function SparkleIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 1C12.4 5.5 13 10 12 12C14 11 18.5 11.6 23 12C18.5 12.4 14 13 12 12C13 14 12.4 18.5 12 23C11.6 18.5 11 14 12 12C10 13 5.5 12.4 1 12C5.5 11.6 10 11 12 12C11 10 11.6 5.5 12 1Z"
            fill={color} />
      <Path d="M19 2C19.15 3.2 19.4 4.4 19 5C20 4.6 20.8 4.85 22 5C20.8 5.15 20 5.4 19 5C19.4 6 19.15 6.8 19 8C18.85 6.8 18.6 6 19 5C18 5.4 17.2 5.15 16 5C17.2 4.85 18 4.6 19 5C18.6 4 18.85 3.2 19 2Z"
            fill={color} fillOpacity={0.6} />
      <Path d="M6 17C6.1 17.8 6.25 18.6 6 19C6.7 18.75 7.2 18.9 8 19C7.2 19.1 6.7 19.25 6 19C6.25 19.7 6.1 20.2 6 21C5.9 20.2 5.75 19.7 6 19C5.3 19.25 4.8 19.1 4 19C4.8 18.9 5.3 18.75 6 19C5.75 18.3 5.9 17.8 6 17Z"
            fill={color} fillOpacity={0.45} />
    </Svg>
  );
}

// ============================================
// RARITY ICON (for RarityCrest)
// ============================================

export function BarChartIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </Svg>
  );
}

export function RarityIcon({ rarityName, size = 8, color = "#fff" }: { rarityName: string; size?: number; color?: string }) {
  if (rarityName === "Legendary") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <G transform="translate(0, 2.4)">
          <Circle cx={6} cy={4.5} r={1.4} fill={color} />
          <Circle cx={12} cy={3.2} r={1.4} fill={color} />
          <Circle cx={18} cy={4.5} r={1.4} fill={color} />
          <Path d="M4 7l3.5 5L12 7l4.5 5L20 7l-1.2 9H5.2L4 7z" fill={color} />
        </G>
      </Svg>
    );
  }
  if (rarityName === "Epic") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M12 2.5l2.2 5.3 5.3 2.2-5.3 2.2L12 17.5l-2.2-5.3-5.3-2.2 5.3-2.2L12 2.5z" fill={color} />
      </Svg>
    );
  }
  if (rarityName === "Rare") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M12 4l8 8-8 8-8-8 8-8z" fill={color} />
      </Svg>
    );
  }
  if (rarityName === "Uncommon") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x={5} y={5} width={14} height={14} rx={3} fill={color} />
      </Svg>
    );
  }
  // Common
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={7} fill={color} />
    </Svg>
  );
}
