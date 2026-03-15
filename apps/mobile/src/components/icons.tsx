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
      <Rect x={3} y={10} width={18} height={11} rx={2} fill={color} fillOpacity={0.2} stroke={color} strokeWidth={2} />
      <Path d="M2 10C2 8.89543 2.89543 8 4 8H20C21.1046 8 22 8.89543 22 10V10H2V10Z" fill={color} fillOpacity={0.3} stroke={color} strokeWidth={2} />
      <Path d="M12 7.5C10.5 7 8 6.5 7.5 5C7 3.5 9 3 10.5 3.5C12 4 12 6 12 7.5Z" fill={color} fillOpacity={0.5} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M12 7.5C13.5 7 16 6.5 16.5 5C17 3.5 15 3 13.5 3.5C12 4 12 6 12 7.5Z" fill={color} fillOpacity={0.5} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M12 8V21" stroke={color} strokeWidth={2} />
      <Path d="M12 17C12 17 9.5 14.8 9.5 13.2C9.5 12.3 10 12 10.8 12C11.4 12 11.8 12.3 12 12.6C12.2 12.3 12.6 12 13.2 12C14 12 14.5 12.3 14.5 13.2C14.5 14.8 12 17 12 17Z" fill={color} />
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
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
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
    </Svg>
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
// RARITY ICON (for RarityCrest)
// ============================================

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
