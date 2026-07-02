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
        d="M3 10.5L12 3L21 10.5V20C21 20.55 20.55 21 20 21H4C3.45 21 3 20.55 3 20V10.5Z"
        fill={color}
        fillOpacity={0.2}
      />
      <Path
        d="M3 10.5L12 3L21 10.5V20C21 20.55 20.55 21 20 21H4C3.45 21 3 20.55 3 20V10.5Z"
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
      <G transform="translate(12 12) rotate(-7) scale(.94) translate(-12 -12)">
        <Path
          d="M5.2 2.75 5.95 1.25 6.7 2.75 7.45 1.25 8.2 2.75 8.95 1.25 9.7 2.75 10.45 1.25 11.2 2.75 11.95 1.25 12.7 2.75 13.45 1.25 14.2 2.75 14.95 1.25 15.7 2.75 16.45 1.25 17.2 2.75 17.95 1.25 18.7 2.75V21.25L17.95 22.75 17.2 21.25 16.45 22.75 15.7 21.25 14.95 22.75 14.2 21.25 13.45 22.75 12.7 21.25 11.95 22.75 11.2 21.25 10.45 22.75 9.7 21.25 8.95 22.75 8.2 21.25 7.45 22.75 6.7 21.25 5.95 22.75 5.2 21.25Z"
          fill={color}
          fillOpacity={0.18}
          stroke={color}
          strokeLinejoin="miter"
          strokeMiterlimit={3}
          strokeWidth={0.9}
        />
        <Path
          d="M6.2 5.45H17.8M6.2 18.55H17.8"
          stroke={color}
          strokeWidth={0.95}
        />
        <G transform="translate(6.05 6.05) scale(.48)">
          <Path
            d="M6.152 19.092a3.1 3.1 0 0 0-.53-.71 3.1 3.1 0 0 0-.75-.55c-.325-.172-.068-.54-.068-.54.333-.507.636-1.015.887-1.458l-1.683-1.682H2.374a.57.57 0 0 1-.57-.569.57.57 0 0 1 .57-.569h1.869a.57.57 0 0 1 .403.167l6.15 6.144a.57.57 0 0 1 .167.403v1.878a.57.57 0 0 1-.57.569.57.57 0 0 1-.569-.57v-1.641l-1.676-1.675a25 25 0 0 0-1.5.955s-.298.212-.496-.152m-2.69-.466c-.512 0-.993.199-1.355.56a1.9 1.9 0 0 0-.56 1.353c0 .512.198.992.56 1.353s.843.56 1.355.56.993-.199 1.355-.56.56-.842.56-1.353-.199-.991-.56-1.352a1.9 1.9 0 0 0-1.355-.561m5.358-3.947a.65.65 0 0 1-.917 0l-.635-.634a.65.65 0 0 1 0-.916L18.102 2.306c.252-.252.75-.485 1.104-.517l2.656-.241a.522.522 0 0 1 .587.587l-.241 2.65c-.032.355-.265.852-.517 1.104L10.856 16.713a.65.65 0 0 1-.918 0l-.635-.635a.65.65 0 0 1 0-.916l9.071-9.063a.34.34 0 0 0 0-.483.34.34 0 0 0-.483 0z"
            fill={color}
          />
        </G>
      </G>
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
        d="M2 10C2 8.9 2.9 8 4 8H20C21.1 8 22 8.9 22 10V10H2V10Z"
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
        d="M6 4C6 2.9 6.9 2 8 2H16C17.1 2 18 2.9 18 4V20C18 21.1 17.1 22 16 22H8C6.9 22 6 21.1 6 20V4Z"
        fill={color}
        fillOpacity={0.2}
        stroke={color}
        strokeWidth={2}
      />
      <Path
        d="M6 6H4C3.45 6 3 5.55 3 5C3 4.45 3.45 4 4 4H6M18 6H20C20.55 6 21 5.55 21 5C21 4.45 20.55 4 20 4H18"
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
      <Path d="M6 3H18V9C18 12.31 15.31 15 12 15C8.69 15 6 12.31 6 9V3Z" fill={color} fillOpacity={0.2} stroke={color} strokeWidth={2} />
      <Path d="M6 5H4C3.45 5 3 5.45 3 6V8C3 9.66 4.34 11 6 11" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M18 5H20C20.55 5 21 5.45 21 6V8C21 9.66 19.66 11 18 11" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 15V18M8 21H16M12 18H12C10.9 18 10 18.9 10 20V21H14V20C14 18.9 13.1 18 12 18Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function UserPlusIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={9} cy={7} r={4} fill={color} fillOpacity={0.2} stroke={color} strokeWidth={2} />
      <Path d="M2 21C2 17.134 5.13 14 9 14H13C16.866 14 20 17.134 20 21" stroke={color} strokeWidth={2} strokeLinecap="round" />
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

export function ShareIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 4V15"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M8 8L12 4L16 8"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6 12V18C6 19.1 6.9 20 8 20H16C17.1 20 18 19.1 18 18V12"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PlayIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 5.5V18.5L18.5 12L8 5.5Z"
        fill={color}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PauseIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 5V19" stroke={color} strokeWidth={3} strokeLinecap="round" />
      <Path d="M16 5V19" stroke={color} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

export function SkipBackIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 5V19" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <Path
        d="M18 6L9 12L18 18V6Z"
        fill={color}
        fillOpacity={0.18}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SkipForwardIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 5V19" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <Path
        d="M6 6L15 12L6 18V6Z"
        fill={color}
        fillOpacity={0.18}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
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

function HPIcon({ size = 24, hpVal = 0 }: { size?: number; hpVal?: string | number }) {
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

function SpeedIcon({ size = 24, speedVal = 0 }: { size?: number; speedVal?: string | number }) {
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
        d="M12 8.25C9.93 8.25 8.25 9.93 8.25 12C8.25 14.07 9.93 15.75 12 15.75C14.07 15.75 15.75 14.07 15.75 12C15.75 9.93 14.07 8.25 12 8.25ZM9.75 12C9.75 10.76 10.76 9.75 12 9.75C13.24 9.75 14.25 10.76 14.25 12C14.25 13.24 13.24 14.25 12 14.25C10.76 14.25 9.75 13.24 9.75 12Z"
        fill={color}
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11.97 1.25C11.53 1.25 11.16 1.25 10.85 1.27C10.54 1.29 10.238 1.34 9.95 1.46C9.27 1.74 8.74 2.27 8.46 2.95C8.31 3.3 8.27 3.67 8.26 4.07C8.25 4.39 8.08 4.66 7.84 4.8C7.6 4.94 7.29 4.95 7 4.8C6.65 4.61 6.31 4.46 5.93 4.41C5.21 4.31 4.48 4.51 3.9 4.95C3.65 5.14 3.46 5.38 3.28 5.64C3.11 5.9 2.93 6.22 2.7 6.6L2.68 6.65C2.46 7.03 2.27 7.35 2.14 7.63C2 7.91 1.89 8.2 1.85 8.51C1.75 9.23 1.95 9.96 2.39 10.54C2.62 10.84 2.92 11.06 3.26 11.27C3.54 11.45 3.69 11.72 3.69 12C3.69 12.28 3.54 12.55 3.26 12.73C2.92 12.94 2.62 13.16 2.39 13.46C1.95 14.04 1.75 14.77 1.85 15.49C1.89 15.8 2 16.09 2.14 16.37C2.27 16.65 2.46 16.97 2.68 17.35L2.7 17.4C2.93 17.78 3.11 18.1 3.28 18.36C3.46 18.62 3.65 18.86 3.9 19.05C4.48 19.49 5.21 19.69 5.93 19.59C6.31 19.54 6.647 19.39 7 19.2C7.29 19.05 7.6 19.06 7.84 19.2C8.08 19.34 8.25 19.607 8.26 19.93C8.27 20.33 8.31 20.7 8.46 21.05C8.74 21.73 9.27 22.26 9.95 22.54C10.238 22.661 10.54 22.71 10.85 22.73C11.16 22.75 11.53 22.75 11.97 22.75H12.03C12.47 22.75 12.84 22.75 13.15 22.73C13.46 22.71 13.762 22.661 14.05 22.54C14.73 22.26 15.26 21.73 15.54 21.05C15.686 20.7 15.73 20.33 15.74 19.93C15.75 19.607 15.92 19.34 16.156 19.2C16.4 19.06 16.71 19.05 17 19.2C17.35 19.39 17.69 19.54 18.07 19.59C18.79 19.69 19.52 19.49 20.1 19.05C20.35 18.86 20.54 18.62 20.719 18.36C20.89 18.1 21.07 17.78 21.297 17.4L21.32 17.35C21.54 16.97 21.73 16.65 21.86 16.37C22 16.09 22.11 15.8 22.15 15.49C22.25 14.77 22.05 14.04 21.61 13.46C21.38 13.16 21.08 12.94 20.74 12.73C20.464 12.55 20.31 12.28 20.31 12C20.31 11.72 20.464 11.45 20.74 11.27C21.08 11.06 21.38 10.84 21.61 10.54C22.05 9.96 22.25 9.23 22.15 8.51C22.11 8.2 22 7.91 21.86 7.63C21.73 7.35 21.54 7.03 21.32 6.65L21.3 6.6C21.07 6.22 20.89 5.9 20.72 5.64C20.54 5.38 20.35 5.14 20.1 4.95C19.52 4.51 18.79 4.31 18.07 4.41C17.69 4.46 17.353 4.61 17 4.8C16.71 4.95 16.4 4.94 16.16 4.8C15.92 4.66 15.75 4.39 15.74 4.07C15.73 3.67 15.686 3.3 15.54 2.95C15.26 2.27 14.73 1.74 14.05 1.46C13.762 1.34 13.46 1.29 13.15 1.27C12.84 1.25 12.47 1.25 12.03 1.25H11.97ZM10.52 2.85C10.6 2.81 10.716 2.78 10.96 2.77C11.2 2.75 11.52 2.75 12 2.75C12.48 2.75 12.8 2.75 13.04 2.77C13.284 2.78 13.4 2.81 13.48 2.85C13.78 2.97 14.028 3.22 14.15 3.52C14.19 3.62 14.228 3.77 14.24 4.13C14.271 4.92 14.68 5.68 15.41 6.1C16.13 6.52 17 6.49 17.7 6.12C18.01 5.95 18.16 5.91 18.265 5.89C18.59 5.85 18.93 5.94 19.19 6.14C19.26 6.19 19.34 6.28 19.47 6.48C19.61 6.69 19.77 6.96 20.01 7.375C20.25 7.79 20.41 8.06 20.52 8.29C20.62 8.5 20.66 8.62 20.67 8.7C20.71 9.03 20.62 9.36 20.42 9.63C20.36 9.71 20.24 9.81 19.94 10C19.27 10.426 18.81 11.16 18.81 12C18.81 12.84 19.27 13.574 19.94 14C20.24 14.186 20.36 14.29 20.42 14.373C20.62 14.636 20.71 14.97 20.67 15.3C20.66 15.38 20.62 15.5 20.52 15.71C20.41 15.94 20.25 16.21 20.01 16.62C19.77 17.04 19.61 17.31 19.474 17.52C19.34 17.72 19.26 17.81 19.189 17.86C18.926 18.06 18.59 18.15 18.26 18.11C18.16 18.09 18.01 18.045 17.7 17.88C17 17.51 16.132 17.48 15.41 17.9C14.68 18.32 14.271 19.08 14.24 19.874C14.228 20.23 14.19 20.38 14.15 20.48C14.028 20.78 13.78 21.028 13.48 21.15C13.4 21.19 13.284 21.22 13.04 21.23C12.8 21.25 12.48 21.25 12 21.25C11.52 21.25 11.2 21.25 10.96 21.23C10.716 21.22 10.6 21.19 10.52 21.15C10.22 21.028 9.97 20.78 9.85 20.48C9.81 20.38 9.77 20.23 9.76 19.874C9.73 19.08 9.32 18.32 8.59 17.9C7.87 17.48 7 17.51 6.3 17.88C5.99 18.05 5.84 18.09 5.73 18.11C5.41 18.15 5.07 18.06 4.81 17.86C4.74 17.81 4.66 17.72 4.53 17.52C4.39 17.314 4.23 17.04 3.99 16.625C3.75 16.21 3.59 15.94 3.48 15.71C3.38 15.5 3.34 15.38 3.33 15.3C3.29 14.97 3.38 14.636 3.58 14.373C3.64 14.29 3.76 14.186 4.06 14C4.73 13.57 5.19 12.84 5.19 12C5.19 11.16 4.73 10.43 4.06 10.004C3.76 9.81 3.64 9.71 3.58 9.63C3.38 9.36 3.29 9.03 3.33 8.7C3.34 8.62 3.38 8.5 3.48 8.29C3.59 8.06 3.75 7.79 3.99 7.37C4.23 6.96 4.39 6.69 4.53 6.48C4.66 6.28 4.74 6.19 4.81 6.14C5.07 5.94 5.41 5.85 5.74 5.89C5.84 5.91 5.99 5.95 6.3 6.12C7 6.49 7.87 6.52 8.59 6.1C9.32 5.68 9.73 4.92 9.76 4.13C9.77 3.77 9.81 3.62 9.85 3.52C9.97 3.22 10.22 2.97 10.52 2.85Z"
        fill={color}
      />
    </Svg>
  );
}

function ShieldUserIcon({ size = 24, color = "#FFFFFF" }: IconProps) {
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

function WalkingIcon({ size = 24, color = "#DB2777" }: IconProps) {
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

export function StepQuestIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} fill={color} fillOpacity={0.09} />
      <G transform="rotate(90 9.6 14.5)">
        <G fill={color} transform="translate(1.3 3.4) scale(0.045)">
          <Path d="M145.454 182.99c16.485-8.948 34.84 9.218 46.38 32.816.153 12.414 4.804 23.314 10.484 32.06l-22.083 20.402c-29.716-13.468-59.267-63.634-39.823-81.6a25.137 25.137 0 0 1 5.054-3.667z" />
          <Path d="M210.094 257.45l-22.486 20.76c27.48 48.827 65.94-.32 22.485-20.76z" />
        </G>
      </G>
      <G transform="rotate(90 16.2 8.1)">
        <G fill={color} transform="translate(0.8 -4) scale(0.045)">
          <Path d="M297.23 207.9c-14.674 11.68-5.112 35.667 12.095 55.502 11.36 4.994 19.586 13.527 25.42 22.166l27.433-12.367c-.805-32.616-35.444-79.41-59.575-68.52a25.136 25.136 0 0 0-5.35 3.218z" />
          <Path d="M340.545 296.48c1.846 47.988 62.107 31.763 27.88-12.593z" />
        </G>
      </G>
    </Svg>
  );
}

export function DailyLoginQuestIcon({
  size = 24,
  color = "#DB2777",
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x={3.5}
        y={4}
        width={17}
        height={16.5}
        rx={3.2}
        fill={color}
        fillOpacity={0.14}
        stroke={color}
        strokeWidth={1.8}
      />
      <Path
        d="M3.5 8.8H20.5M8 2.8V5.6M16 2.8V5.6"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Path
        d="M8.2 14.5L10.6 16.9L16.4 11.4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function WordleQuestIcon({ size = 24, color = "#DB2777" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x={4}
        y={4}
        width={4.6}
        height={4.6}
        rx={1}
        fill={color}
      />
      <Rect
        x={9.7}
        y={4}
        width={4.6}
        height={4.6}
        rx={1}
        fill={color}
        fillOpacity={0.46}
      />
      <Rect
        x={15.4}
        y={4}
        width={4.6}
        height={4.6}
        rx={1}
        fill={color}
        fillOpacity={0.24}
      />
      <Rect
        x={4}
        y={9.7}
        width={4.6}
        height={4.6}
        rx={1}
        fill={color}
        fillOpacity={0.46}
      />
      <Rect
        x={9.7}
        y={9.7}
        width={4.6}
        height={4.6}
        rx={1}
        fill={color}
      />
      <Rect
        x={15.4}
        y={9.7}
        width={4.6}
        height={4.6}
        rx={1}
        fill={color}
        fillOpacity={0.24}
      />
      <Rect
        x={4}
        y={15.4}
        width={4.6}
        height={4.6}
        rx={1}
        fill={color}
        fillOpacity={0.24}
      />
      <Rect
        x={9.7}
        y={15.4}
        width={4.6}
        height={4.6}
        rx={1}
        fill={color}
        fillOpacity={0.46}
      />
      <Rect
        x={15.4}
        y={15.4}
        width={4.6}
        height={4.6}
        rx={1}
        fill={color}
      />
    </Svg>
  );
}

export function DailyNumbersQuestIcon({
  size = 24,
  color = "#DB2777",
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9.5} fill={color} fillOpacity={0.1} />
      <Circle
        cx={12}
        cy={12}
        r={8.05}
        fill={color}
        fillOpacity={0.09}
        stroke={color}
        strokeWidth={1.65}
      />
      <Circle
        cx={12}
        cy={12}
        r={5.45}
        fill="white"
        fillOpacity={0.78}
        stroke={color}
        strokeWidth={1.65}
      />
      <SvgText
        x={12}
        y={13.35}
        textAnchor="middle"
        fill={color}
        fontSize={3.85}
        fontWeight="900"
      >
        100
      </SvgText>
    </Svg>
  );
}

export function SpeedCalculusQuestIcon({
  size = 24,
  color = "#DB2777",
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 3.2H15M12 3.2V5.1"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Path
        d="M7.3 6.2L5.9 4.8M16.7 6.2L18.1 4.8"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Circle
        cx={12}
        cy={13}
        r={7.5}
        fill={color}
        fillOpacity={0.12}
        stroke={color}
        strokeWidth={1.8}
      />
      <Path
        d="M12.8 7.9L8.5 13.6H12L11.2 18.1L15.9 11.9H12.4L12.8 7.9Z"
        fill={color}
        fillOpacity={0.22}
        stroke={color}
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
      <Path
        d="M7.3 15.6H9.7M8.5 14.4V16.8M14.5 9.9H17.2M14.5 11.7H17.2"
        stroke={color}
        strokeWidth={1.35}
        strokeLinecap="round"
      />
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
      <Path fill="#F8F8F8" opacity={0} d=" M352,1001  C235.01,1001 118.03,1001 1.02,1001  C1.02,667.72 1.02,334.44 1.02,1.08  C250.91,1.08 500.83,1.08 750.87,1.08  C750.87,334.33 750.87,667.67 750.88,1001  C642.23,1001 533.57,1001 424.65,1000.61  C443.16,999.2 461.94,998.42 480.69,997.13  C523.4,994.19 565.79,988.82 607.46,978.73  C629.16,973.48 650.7,967.45 669.97,955.81  C677.1,951.51 683.52,945.66 689.27,939.58  C694.45,934.12 696.52,926.87 694.76,919.16  C691.23,903.77 687.51,888.42 683.96,873.03  C683.05,869.07 682.51,865.02 681.99,860.69  C688.8,843.34 695.39,826.3 702.06,809.29  C703.75,805 703.2,801.19 700.36,797.61  C683.88,776.74 667.41,755.87 650.89,734.67  C650.26,733.5 649.66,732.66 649.06,731.6  C649.05,731.39 648.9,731 648.99,730.59  C647.84,724.23 646.75,718.24 645.33,712.33  C627.32,637.03 609.25,561.74 591.21,486.44  C582.87,451.63 574.58,416.81 566.19,382.01  C564.39,374.56 560.5,372.03 551.63,372.48  C545.9,372.78 544.63,377.21 543.67,381.83  C534.8,424.88 525.88,467.93 517.01,510.99  C509.89,545.55 502.81,580.13 495.45,616.01  C494.77,613.39 494.3,612.03 494.07,610.63  C486.96,566.9 479.92,523.17 472.77,479.45  C459.78,400.07 446.72,320.7 433.73,241.33  C421.14,164.4 408.6,87.47 396.02,10.55  C395.08,4.79 392.38,1.91 388.07,1.94  C383.73,1.97 381.08,4.85 380.21,10.64  C373.83,53.13 367.44,95.62 361.1,138.12  C350.64,208.12 340.23,278.13 329.79,348.13  C316.47,437.41 303.14,526.68 289.8,615.96  C289.09,620.75 288.25,625.53 287.47,630.31  C286.07,628.64 285.55,626.97 285.13,625.28  C266.56,550.81 248.01,476.34 229.43,401.88  C226.85,391.54 224.27,381.2 221.41,370.94  C220.28,366.85 213.62,362.77 209.64,363.23  C204.85,363.79 203.12,367.29 202.08,371.39  C180.09,458.23 158.12,545.07 136.09,631.9  C130.15,655.29 124.04,678.64 117.78,702.16  C116.98,703.04 116.42,703.77 115.56,704.67  C114.72,705.57 114.17,706.3 113.34,707.17  C110.66,710.07 108.24,712.83 105.83,715.58  C87.52,736.49 69.23,757.42 50.89,778.31  C48.2,781.37 47.46,784.67 48.99,788.45  C58.07,810.97 67.17,833.49 76.28,856.33  C76.79,857.81 77.28,858.96 77.8,860.42  C77.88,861.15 77.92,861.57 77.74,862.29  C73.35,879.2 69.56,895.91 64.87,912.36  C62.23,921.62 63.91,929.39 69.51,936.73  C77.56,947.28 88.85,953.4 100.53,958.78  C125.02,970.07 151.02,976.61 177.32,981.94  C231.98,993.03 287.32,997.99 342.99,999.75  C346.01,999.84 349,1000.57 352,1001  z" />
      <Path fill="#42413F" opacity={1} d=" M681.8,861.01  C682.51,865.02 683.05,869.07 683.96,873.03  C687.51,888.42 691.23,903.77 694.76,919.16  C696.52,926.87 694.45,934.12 689.27,939.58  C683.52,945.66 677.1,951.51 669.97,955.81  C650.7,967.45 629.16,973.48 607.46,978.73  C565.79,988.82 523.4,994.19 480.69,997.13  C461.94,998.42 443.16,999.2 424.19,1000.61  C421.96,1001 419.92,1001 417.38,1000.66  C415.57,1000.24 414.26,1000.16 412.49,1000.04  C396.71,1000.04 381.39,1000.08 365.82,999.82  C363.72,1000.02 361.86,1000.51 360,1001  C357.63,1001 355.26,1001 352.44,1001  C349,1000.57 346.01,999.84 342.99,999.75  C287.32,997.99 231.98,993.03 177.32,981.94  C151.02,976.61 125.02,970.07 100.53,958.78  C88.85,953.4 77.56,947.28 69.51,936.73  C63.91,929.39 62.23,921.62 64.87,912.36  C69.56,895.91 73.35,879.2 78.02,862.48  C80.79,866.49 83.77,870.39 85.13,874.8  C86.44,879.02 87.54,882.86 90.33,886.6  C92.49,889.49 92.3,894.13 92.95,897.7  C91.18,893.64 89.61,889.88 87.57,884.98  C84.78,895.71 82.95,905.37 79.65,914.5  C77.14,921.47 79.27,926.33 84.09,930.39  C89.03,934.54 94.31,938.46 99.95,941.55  C116.85,950.8 135.19,956.39 153.77,961.08  C210.36,975.34 268.12,980.88 326.19,983.93  C339.15,984.61 352.11,985.02 365.22,985.89  C365.95,986.48 366.52,986.95 367.1,986.95  C380.15,987 393.2,987.02 406.24,986.94  C407.19,986.93 408.12,986.02 409.02,985.39  C408.98,985.26 409,984.98 409.46,985.06  C458.04,984.31 505.97,981.05 553.58,973.86  C581.07,969.72 608.32,964.34 634.66,955.15  C647.88,950.54 660.88,945.37 671.91,936.4  C676.14,932.96 680.51,928.8 679.62,923.15  C677.81,911.73 674.85,900.48 672.36,889.16  C672.02,889.19 671.68,889.22 671.33,889.24  C669.54,893.49 667.75,897.74 665.72,901.77  C665.58,899.88 665.69,898.22 665.85,895.49  C663.86,897.08 662.79,897.93 660.83,899.5  C660.04,896.85 659.45,894.87 658.86,892.88  C663,895.74 664.16,895.52 666.07,891.71  C666.61,890.65 667.59,889.71 668.57,888.99  C673.11,885.6 674.52,878.32 671.68,873.5  C671.06,872.44 671.26,870.9 671.01,868.99  C673.02,869.81 674.17,870.27 674.93,870.58  C677.37,867.18 679.59,864.09 681.8,861.01  z" />
      <Path fill="#42413F" opacity={1} d=" M118.01,702  C124.04,678.64 130.15,655.29 136.09,631.9  C158.12,545.07 180.09,458.23 202.08,371.39  C203.12,367.29 204.85,363.79 209.64,363.23  C213.62,362.77 220.28,366.85 221.41,370.94  C224.27,381.2 226.85,391.54 229.43,401.88  C248.01,476.34 266.56,550.81 285.13,625.28  C285.55,626.97 286.07,628.64 287.47,630.31  C288.25,625.53 289.09,620.75 289.8,615.96  C303.14,526.68 316.47,437.41 329.79,348.13  C340.23,278.13 350.64,208.12 361.1,138.12  C367.44,95.62 373.83,53.13 380.21,10.64  C381.08,4.85 383.73,1.97 388.07,1.94  C392.38,1.91 395.08,4.79 396.02,10.55  C408.6,87.47 421.14,164.4 433.73,241.33  C446.72,320.7 459.78,400.07 472.77,479.45  C479.92,523.17 486.96,566.9 494.07,610.63  C494.3,612.03 494.77,613.39 495.45,616.01  C502.81,580.13 509.89,545.55 517.01,510.99  C525.88,467.93 534.8,424.88 543.67,381.83  C544.63,377.21 545.9,372.78 551.63,372.48  C560.5,372.03 564.39,374.56 566.19,382.01  C574.58,416.81 582.87,451.63 591.21,486.44  C609.25,561.74 627.32,637.03 645.33,712.33  C646.75,718.24 647.84,724.23 648.64,730.52  C646.23,729.36 643.86,728.18 642.37,726.3  C637.3,719.92 632.54,713.28 627.65,706.75  C626.84,705.67 625.96,704.64 625.43,703.71  C626.33,704.1 626.93,704.37 628.02,704.85  C603.87,604.08 579.83,503.75 555.53,402.33  C554.79,404.41 554.29,405.43 554.07,406.5  C541.48,467.67 528.9,528.84 516.36,590.02  C511.71,612.69 507.19,635.39 502.56,658.07  C501.36,663.95 498.28,667.14 494.12,667.1  C489.69,667.07 487.29,664.01 486.31,657.77  C483.17,637.71 479.99,617.64 476.72,597.6  C462.17,508.7 447.58,419.8 433.03,330.9  C419.62,248.9 406.24,166.89 392.85,84.89  C391.53,76.86 390.18,68.84 388.85,60.81  C388.57,60.83 388.28,60.86 387.99,60.88  C387.04,67.61 386.1,74.34 385.05,81.47  C375.97,141.65 366.98,201.43 358.03,261.22  C348.12,327.44 338.26,393.66 328.37,459.88  C320.15,514.89 311.94,569.91 303.68,624.92  C301.78,637.6 299.87,650.28 297.69,662.92  C296.55,669.5 292.09,671.53 285.87,669.21  C281.05,667.41 279.12,663.82 277.97,659.16  C268.59,621.16 259.11,583.18 249.64,545.2  C237.71,497.36 225.76,449.53 213.81,401.7  C213.34,399.79 212.83,397.9 212.33,396  C210.81,398.97 210.19,401.73 209.49,404.46  C184.81,501.65 160.12,598.83 135.5,696.04  C135.03,697.88 135.4,699.93 135.02,701.95  C133.68,702.85 132.7,703.68 131.43,704.75  C131.1,702.93 130.94,701.63 130.62,700.37  C129.37,695.27 128.02,694.77 123.68,697.81  C121.76,699.15 119.9,700.6 118.01,702  z" />
      <Path fill="#484443" opacity={1} d=" M625.12,703.58  C625.96,704.64 626.84,705.67 627.65,706.75  C632.54,713.28 637.3,719.92 642.37,726.3  C643.86,728.18 646.23,729.36 648.55,730.93  C648.9,731 649.05,731.39 649.05,731.96  C649.67,733.36 650.3,734.18 650.93,735  C667.41,755.87 683.88,776.74 700.36,797.61  C703.2,801.19 703.75,805 702.06,809.29  C695.39,826.3 688.8,843.34 681.99,860.69  C679.59,864.09 677.37,867.18 674.93,870.58  C674.17,870.27 673.02,869.81 671.01,868.99  C671.26,870.9 671.06,872.44 671.68,873.5  C674.52,878.32 673.11,885.6 668.57,888.99  C667.59,889.71 666.61,890.65 666.07,891.71  C664.16,895.52 663,895.74 658.86,892.88  C659.45,894.87 660.04,896.85 660.83,899.5  C662.79,897.93 663.86,897.08 665.85,895.49  C665.69,898.22 665.58,899.88 665.69,902.14  C663.83,908.18 661.92,913.7 659.64,919.06  C656.24,927.08 649.43,927.96 644.36,920.92  C620.44,887.66 596.63,854.31 572.75,821.02  C570.18,817.43 569.9,814.03 571.72,809.84  C578.75,793.66 585.56,777.38 592.27,761.05  C599.35,743.8 606.19,726.45 613.22,709.17  C615.88,702.65 619.27,701.16 625.12,703.58  z" />
      <Path fill="#484443" opacity={1} d=" M117.78,702.16  C119.9,700.6 121.76,699.15 123.68,697.81  C128.02,694.77 129.37,695.27 130.62,700.37  C130.94,701.63 131.1,702.93 131.43,704.75  C132.7,703.68 133.68,702.85 135.25,702.19  C150.35,733.96 164.8,765.59 179.42,797.13  C181.91,802.5 181.08,806.84 177.63,811.44  C162.04,832.2 146.64,853.09 131.15,873.92  C123.8,883.8 116.57,893.77 109.01,903.48  C104.12,909.76 98.08,908.85 94.6,901.69  C94.02,900.5 93.63,899.23 93.16,897.99  C92.3,894.13 92.49,889.49 90.33,886.6  C87.54,882.86 86.44,879.02 85.13,874.8  C83.77,870.39 80.79,866.49 78.24,862.18  C77.92,861.57 77.88,861.15 78.08,860.24  C77.64,858.5 76.95,857.25 76.26,856.01  C67.17,833.49 58.07,810.97 48.99,788.45  C47.46,784.67 48.2,781.37 50.89,778.31  C69.23,757.42 87.52,736.49 105.83,715.58  C108.24,712.83 110.66,710.07 113.74,707.12  C114.89,706.11 115.38,705.3 115.86,704.49  C116.42,703.77 116.98,703.04 117.78,702.16  z" />
      <Path fill="#F2D177" fillOpacity={fillOpacity} opacity={1} d=" M92.95,897.7  C93.63,899.23 94.02,900.5 94.6,901.69  C98.08,908.85 104.12,909.76 109.01,903.48  C116.57,893.77 123.8,883.8 131.15,873.92  C146.64,853.09 162.04,832.2 177.63,811.44  C181.08,806.84 181.91,802.5 179.42,797.13  C164.8,765.59 150.35,733.96 135.62,702.13  C135.4,699.93 135.03,697.88 135.5,696.04  C160.12,598.83 184.81,501.65 209.49,404.46  C210.19,401.73 210.81,398.97 212.33,396  C212.83,397.9 213.34,399.79 213.81,401.7  C225.76,449.53 237.71,497.36 249.64,545.2  C259.11,583.18 268.59,621.16 277.97,659.16  C279.12,663.82 281.05,667.41 285.87,669.21  C292.09,671.53 296.55,669.5 297.69,662.92  C299.87,650.28 301.78,637.6 303.68,624.92  C311.94,569.91 320.15,514.89 328.37,459.88  C338.26,393.66 348.12,327.44 358.03,261.22  C366.98,201.43 375.97,141.65 385.31,81.78  C386.11,90.47 386.78,99.24 386.95,108.02  C387.41,132.31 387.69,156.61 387.99,180.9  C388.35,210.35 388.64,239.81 389,269.27  C389.3,293.4 389.67,317.52 389.99,341.64  C390.34,368.27 390.64,394.89 391,421.52  C391.31,445.14 391.77,468.77 391.97,492.39  C392.38,543.18 392.65,593.97 393.03,644.76  C393.06,649.07 393.52,653.36 393.66,657.66  C393.69,658.61 393.22,659.58 392.61,660.63  C389.98,662.26 387.34,663.46 385.56,665.43  C383.13,668.12 381.34,671.39 379.31,674.44  C363.65,697.81 348.05,721.21 332.33,744.53  C328.59,750.07 326.4,755.85 326.34,762.66  C326.24,773.31 325.59,783.95 325.19,794.59  C324.16,822.04 323.04,849.48 322.25,876.93  C322.16,879.81 323.4,883.19 325.09,885.59  C331.4,894.58 338.13,903.26 344.73,912.05  C356.24,927.34 367.71,942.66 379.29,957.9  C383.5,963.43 388.34,963.65 393.23,958.82  C394.16,957.9 395.02,956.91 396.2,956.1  C396.8,957.88 397.35,959.51 397.37,961.15  C397.46,968.62 397.41,976.1 397.41,982.5  C401.72,983.42 405.36,984.2 409,984.98  C409,984.98 408.98,985.26 408.57,985.31  C393.8,985.42 379.44,985.49 365.07,985.55  C352.11,985.02 339.15,984.61 326.19,983.93  C268.12,980.88 210.36,975.34 153.77,961.08  C135.19,956.39 116.85,950.8 99.95,941.55  C94.31,938.46 89.03,934.54 84.09,930.39  C79.27,926.33 77.14,921.47 79.65,914.5  C82.95,905.37 84.78,895.71 87.57,884.98  C89.61,889.88 91.18,893.64 92.95,897.7  z" />
      <Path fill="#DFC16E" fillOpacity={fillOpacity} opacity={1} d=" M409.46,985.06  C405.36,984.2 401.72,983.42 397.41,982.5  C397.41,976.1 397.46,968.62 397.37,961.15  C397.35,959.51 396.8,957.88 396.39,955.82  C415.52,932.24 434.88,909.18 453.84,885.8  C456.49,882.54 458.57,877.75 458.62,873.64  C459.08,836.03 459.11,798.41 459,760.79  C458.99,757.14 458.01,752.95 456.05,749.95  C437.7,721.78 419.11,693.78 400.35,665.89  C398.76,663.53 395.48,662.3 392.98,660.54  C393.22,659.58 393.69,658.61 393.66,657.66  C393.52,653.36 393.06,649.07 393.03,644.76  C392.65,593.97 392.38,543.18 391.97,492.39  C391.77,468.77 391.31,445.14 391,421.52  C390.64,394.89 390.34,368.27 389.99,341.64  C389.67,317.52 389.3,293.4 389,269.27  C388.64,239.81 388.35,210.35 387.99,180.9  C387.69,156.61 387.41,132.31 386.95,108.02  C386.78,99.24 386.11,90.47 385.41,81.38  C386.1,74.34 387.04,67.61 387.99,60.88  C388.28,60.86 388.57,60.83 388.85,60.81  C390.18,68.84 391.53,76.86 392.85,84.89  C406.24,166.89 419.62,248.9 433.03,330.9  C447.58,419.8 462.17,508.7 476.72,597.6  C479.99,617.64 483.17,637.71 486.31,657.77  C487.29,664.01 489.69,667.07 494.12,667.1  C498.28,667.14 501.36,663.95 502.56,658.07  C507.19,635.39 511.71,612.69 516.36,590.02  C528.9,528.84 541.48,467.67 554.07,406.5  C554.29,405.43 554.79,404.41 555.53,402.33  C579.83,503.75 603.87,604.08 628.02,704.85  C626.93,704.37 626.33,704.1 625.43,703.71  C619.27,701.16 615.88,702.65 613.22,709.17  C606.19,726.45 599.35,743.8 592.27,761.05  C585.56,777.38 578.75,793.66 571.72,809.84  C569.9,814.03 570.18,817.43 572.75,821.02  C596.63,854.31 620.44,887.66 644.36,920.92  C649.43,927.96 656.24,927.08 659.64,919.06  C661.92,913.7 663.83,908.18 665.93,902.36  C667.75,897.74 669.54,893.49 671.33,889.24  C671.68,889.22 672.02,889.19 672.36,889.16  C674.85,900.48 677.81,911.73 679.62,923.15  C680.51,928.8 676.14,932.96 671.91,936.4  C660.88,945.37 647.88,950.54 634.66,955.15  C608.32,964.34 581.07,969.72 553.58,973.86  C505.97,981.05 458.04,984.31 409.46,985.06  z" />
      <Path fill="#F06E5C" fillOpacity={fillOpacity} opacity={1} d=" M618.38,736.58  C619.07,735.3 619.61,734.35 620.53,732.74  C626.19,747.93 630.71,762.83 637.26,776.77  C642.78,788.5 641.46,798.5 635.3,809.04  C633.59,811.96 632.37,812.98 628.84,812.43  C617.67,810.67 606.42,809.48 595.2,808.04  C593.76,807.86 592.33,807.53 590.06,807.11  C599.58,783.38 608.91,760.15 618.38,736.58  z" />
      <Path fill="#B3515D" fillOpacity={fillOpacity} opacity={1} d=" M624.96,823.01  C630.97,823.02 635.8,824.27 639.1,829.44  C640.96,832.35 643.5,834.86 645.89,837.39  C648.93,840.6 649.83,843.96 649.2,848.56  C647.39,861.87 646.3,875.27 644.86,888.63  C644.72,889.9 644.16,891.12 643.43,893.62  C625.41,868.49 607.98,844.17 589.52,818.42  C602.12,820.06 613.32,821.52 624.96,823.01  z" />
      <Path fill="#CF5147" fillOpacity={fillOpacity} opacity={1} d=" M641.81,748.04  C655.92,765.74 670.03,783.45 684.55,801.66  C679.43,804.35 675.34,806.89 670.91,808.57  C669.68,809.04 667.08,807.34 665.8,805.99  C655.37,795.02 649.5,781.56 644.96,767.37  C643.1,761.54 640.89,755.82 638.89,749.37  C639.89,748.47 640.85,748.26 641.81,748.04  z" />
      <Path fill="#A35172" fillOpacity={fillOpacity} opacity={1} d=" M659.36,878.27  C658.85,879.49 658.48,880.37 658.11,881.24  C657.68,881.19 657.26,881.14 656.84,881.09  C657.21,877.36 657.61,873.64 657.93,869.91  C658.4,864.63 658.08,859.16 659.39,854.1  C662.16,843.41 665.75,832.93 669.08,822.38  C669.35,821.54 670.09,820.56 670.87,820.2  C674.59,818.47 678.39,816.93 683.81,814.63  C675.39,836.55 667.45,857.24 659.36,878.27  z" />
      <Path fill="#CB5149" fillOpacity={fillOpacity} opacity={1} d=" M646.92,808.91  C647.75,807.09 648.47,805.62 649.2,804.15  C659.27,809.74 661.07,818.89 654.06,830.49  C650.56,826.31 646.48,822.69 644.22,818.16  C643.21,816.13 645.84,812.29 646.92,808.91  z" />
      <Path fill="#CB5149" fillOpacity={fillOpacity} opacity={1} d=" M641.79,747.7  C640.85,748.26 639.89,748.47 638.85,748.99  C637.37,746.53 635.97,743.78 634.58,741.02  C635.17,740.65 635.77,740.28 636.36,739.92  C638.16,742.4 639.96,744.88 641.79,747.7  z" />
      <Path fill="#A85073" fillOpacity={fillOpacity} opacity={1} d=" M144.36,805.17  C150.73,804.6 156.64,804.09 162.55,803.58  C162.94,803.9 163.32,804.22 163.71,804.54  C145.3,829.33 126.9,854.12 107.64,880.06  C106.29,870.14 105.07,861.7 104.01,853.24  C102.55,841.56 101.23,829.87 99.8,818.19  C99.28,813.94 104.61,808.55 108.87,808.36  C117.61,807.97 126.33,807.16 135.05,806.42  C138.02,806.17 140.96,805.64 144.36,805.17  z" />
      <Path fill="#D25046" fillOpacity={fillOpacity} opacity={1} d=" M145.39,794.41  C136.03,795.38 127.1,796.09 118.2,797.12  C114.48,797.55 112.86,796.14 111.95,792.66  C110.75,788.02 108.97,783.53 107.6,778.92  C107.3,777.93 107.41,776.63 107.8,775.65  C113.44,761.51 119.16,747.39 124.84,733.26  C126,730.36 127.04,727.41 128.71,722.97  C139.61,746.74 149.94,769.24 160.63,792.52  C155.18,793.17 150.51,793.73 145.39,794.41  z" />
      <Path fill="#EB6E5E" fillOpacity={fillOpacity} opacity={1} d=" M92.21,776.21  C84.96,785.29 84.95,785.29 74.07,781.73  C72.71,781.28 71.38,780.72 69.41,779.98  C82.81,764.68 95.83,749.82 108.85,734.95  C109.23,735.16 109.61,735.36 109.99,735.57  C107.29,743.1 104.53,750.6 101.92,758.16  C99.69,764.6 97.62,771.09 92.21,776.21  z" />
      <Path fill="#AF525E" fillOpacity={fillOpacity} opacity={1} d=" M71.07,802.96  C69.5,799.13 68.04,795.67 66.49,792.01  C75.54,791.52 80.29,795.35 85.04,805.43  C90.16,816.28 89.72,828.01 91.06,839.47  C91.53,843.46 91.74,847.47 92.07,851.47  C91.56,851.6 91.04,851.73 90.52,851.86  C84.07,835.68 77.62,819.5 71.07,802.96  z" />
      <Path fill="#C5534D" fillOpacity={fillOpacity} opacity={1} d=" M92.74,797.18  C90.84,791.55 96.27,790.18 98.64,786.58  C99.49,789.13 100.12,791.79 101.25,794.22  C103.11,798.21 100.99,800.26 97.81,801.56  C94.08,803.07 94.27,799.22 92.74,797.18  z" />
      <Path fill="#484443" opacity={1} d=" M392.61,660.63  C395.48,662.3 398.76,663.53 400.35,665.89  C419.11,693.78 437.7,721.78 456.05,749.95  C458.01,752.95 458.99,757.14 459,760.79  C459.11,798.41 459.08,836.03 458.62,873.64  C458.57,877.75 456.49,882.54 453.84,885.8  C434.88,909.18 415.52,932.24 396.1,955.68  C395.02,956.91 394.16,957.9 393.23,958.82  C388.34,963.65 383.5,963.43 379.29,957.9  C367.71,942.66 356.24,927.34 344.73,912.05  C338.13,903.26 331.4,894.58 325.09,885.59  C323.4,883.19 322.16,879.81 322.25,876.93  C323.04,849.48 324.16,822.04 325.19,794.59  C325.59,783.95 326.24,773.31 326.34,762.66  C326.4,755.85 328.59,750.07 332.33,744.53  C348.05,721.21 363.65,697.81 379.31,674.44  C381.34,671.39 383.13,668.12 385.56,665.43  C387.34,663.46 389.98,662.26 392.61,660.63  z" />
      <Path fill="#D15046" fillOpacity={fillOpacity} opacity={1} d=" M401.15,851.32  C403.74,864.94 395.28,873.44 388.02,883.17  C382.79,876.19 377.38,870.27 377.92,860.61  C378.92,842.36 378.77,824.06 379.17,805.78  C379.38,796.48 379.5,787.17 380.19,777.9  C380.44,774.61 381.88,771.23 383.46,768.25  C385.87,763.75 388.87,759.57 392.33,754.14  C397.13,763.25 405.74,769.1 405.09,780.25  C403.82,802.29 402.93,824.36 401.85,846.42  C401.78,847.91 401.4,849.37 401.15,851.32  z" />
      <Path fill="#D15046" fillOpacity={fillOpacity} opacity={1} d=" M340.8,794.67  C340.81,783.95 340.81,773.69 340.81,762.31  C349.25,765.87 356.43,768.78 363.46,772.01  C364.38,772.44 365.04,774.5 365.01,775.78  C364.5,796.74 363.82,817.7 363.27,838.66  C363.08,845.65 363.07,852.65 363.13,859.65  C363.15,862.52 362.29,864.04 359.28,865.02  C353.6,866.88 348.16,869.43 342.6,871.65  C341.12,872.24 339.58,872.67 338.14,873.15  C338.14,865.9 338.03,859.16 338.17,852.43  C338.31,845.78 338.69,839.14 339,832.5  C339.58,820.05 340.19,807.59 340.8,794.67  z" />
      <Path fill="#B2515D" fillOpacity={fillOpacity} opacity={1} d=" M419.21,793.38  C419.54,788.45 419.64,783.95 420.18,779.52  C420.4,777.73 421.12,775.32 422.44,774.48  C429.13,770.23 436.1,766.39 443.59,762.05  C443.59,798.04 443.59,833.31 443.59,868.94  C442.21,868.79 441.04,868.87 440.01,868.52  C432.94,866.08 425.86,863.65 418.9,860.95  C417.76,860.51 416.4,858.68 416.44,857.54  C416.74,848.92 417.49,840.32 417.86,831.71  C418.4,819.09 418.73,806.47 419.21,793.38  z" />
      <Path fill="#D05046" fillOpacity={fillOpacity} opacity={1} d=" M398.02,734.39  C398.01,719.31 398.01,704.68 398.01,689.32  C411.78,710.05 425.44,730.62 439.51,751.8  C432.59,755.77 426.18,759.56 419.62,763.07  C418.73,763.54 416.45,763.09 415.93,762.31  C409.84,753.23 403.97,744.01 398.02,734.39  z" />
      <Path fill="#EF6E5D" fillOpacity={fillOpacity} opacity={1} d=" M379.83,745.85  C376.8,750.66 374.1,755.26 371.07,759.63  C370.34,760.7 368.21,761.92 367.31,761.57  C360.08,758.77 352.98,755.61 345.2,752.28  C358.82,731.99 372.01,712.33 385.2,692.68  C385.8,692.77 386.4,692.87 386.99,692.96  C386.99,706.68 387.5,720.44 386.67,734.11  C386.44,738.04 382.36,741.74 379.83,745.85  z" />
      <Path fill="#A85073" fillOpacity={fillOpacity} opacity={1} d=" M422.8,900.79  C413.55,912.04 404.54,923.03 395.52,934.02  C395.02,933.78 394.52,933.53 394.02,933.29  C394.02,922.76 393.98,912.22 394.1,901.69  C394.11,900.69 395.12,899.67 395.76,898.73  C401.19,890.77 406.68,882.86 412.05,874.87  C413.78,872.31 415.78,871.29 418.8,872.43  C425.31,874.87 431.86,877.22 439.3,879.95  C433.61,887.15 428.32,893.84 422.8,900.79  z" />
      <Path fill="#B1515D" fillOpacity={fillOpacity} opacity={1} d=" M361.19,908.82  C354.89,900.5 348.81,892.46 342.16,883.66  C349.92,880.5 356.87,877.65 363.86,874.8  C370.19,884.09 376.27,892.97 382.26,901.9  C382.77,902.66 382.9,903.79 382.91,904.74  C382.94,914.4 382.91,924.06 382.87,933.72  C382.86,934.31 382.57,934.91 382.11,936.67  C374.82,926.96 368.12,918.03 361.19,908.82  z" />
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

function RarityIcon({ rarityName, size = 8, color = "#fff" }: { rarityName: string; size?: number; color?: string }) {
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
