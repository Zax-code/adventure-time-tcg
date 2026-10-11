// One outline icon set (Lucide, board 01 of the design system proposal),
// drawn in currentColor so CSS tone classes tint it. Names and props match
// the mobile icons. Brand sign-in marks live in brand-logos.tsx.
import {
  ArrowLeftRight,
  Box,
  CalendarCheck,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleCheckBig,
  CircleQuestionMark,
  CircleX,
  Clock,
  Coins,
  Crown,
  Eye,
  Footprints,
  Gem,
  Gift,
  Grid3x3,
  Hammer,
  Hash,
  House,
  Layers,
  Package,
  Pause,
  Play,
  Recycle,
  ScrollText,
  Search,
  Settings,
  Share,
  SkipBack,
  SkipForward,
  Sparkle,
  Sparkles,
  Swords,
  Timer,
  Trophy,
  UserPlus,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface IconProps {
  size?: number;
  color?: string;
}

const ICON_STROKE_WIDTH = 1.75;

function outlineIcon(Icon: LucideIcon, name: string) {
  function OutlineIcon({ size = 24, color = "currentColor" }: IconProps) {
    return (
      <Icon
        aria-hidden="true"
        focusable="false"
        size={size}
        color={color}
        strokeWidth={ICON_STROKE_WIDTH}
      />
    );
  }

  OutlineIcon.displayName = name;
  return OutlineIcon;
}

export const HomeIcon = outlineIcon(House, "HomeIcon");
export const CardsIcon = outlineIcon(Layers, "CardsIcon");
export const PackIcon = outlineIcon(Package, "PackIcon");
export const GiftHeartIcon = outlineIcon(Gift, "GiftHeartIcon");
export const QuestIcon = outlineIcon(ScrollText, "QuestIcon");
export const SwordsIcon = outlineIcon(Swords, "SwordsIcon");
export const TrophyIcon = outlineIcon(Trophy, "TrophyIcon");
export const UserPlusIcon = outlineIcon(UserPlus, "UserPlusIcon");
export const ClockIcon = outlineIcon(Clock, "ClockIcon");
export const EyeIcon = outlineIcon(Eye, "EyeIcon");
export const ZapIcon = outlineIcon(Zap, "ZapIcon");
export const XIcon = outlineIcon(X, "XIcon");
export const CheckIcon = outlineIcon(Check, "CheckIcon");
export const ShareIcon = outlineIcon(Share, "ShareIcon");
export const PlayIcon = outlineIcon(Play, "PlayIcon");
export const PauseIcon = outlineIcon(Pause, "PauseIcon");
export const SkipBackIcon = outlineIcon(SkipBack, "SkipBackIcon");
export const SkipForwardIcon = outlineIcon(SkipForward, "SkipForwardIcon");
export const ChevronRightIcon = outlineIcon(ChevronRight, "ChevronRightIcon");
export const ChevronDownIcon = outlineIcon(ChevronDown, "ChevronDownIcon");
export const SwapIcon = outlineIcon(ArrowLeftRight, "SwapIcon");
export const CoinIcon = outlineIcon(Coins, "CoinIcon");
export const DustIcon = outlineIcon(Sparkles, "DustIcon");
export const RecycleIcon = outlineIcon(Recycle, "RecycleIcon");
export const CraftIcon = outlineIcon(Hammer, "CraftIcon");
export const CheckCircleIcon = outlineIcon(CircleCheck, "CheckCircleIcon");
export const ClaimedIcon = outlineIcon(CircleCheckBig, "ClaimedIcon");
export const XCircleIcon = outlineIcon(CircleX, "XCircleIcon");
export const SparklesIcon = outlineIcon(Sparkles, "SparklesIcon");
export const SettingsIcon = outlineIcon(Settings, "SettingsIcon");
const HelpCircleBase = outlineIcon(CircleQuestionMark, "HelpCircleIcon");

export function HelpCircleIcon({
  noCircle: _noCircle,
  ...props
}: IconProps & { noCircle?: boolean }) {
  return <HelpCircleBase {...props} />;
}

export const StepQuestIcon = outlineIcon(Footprints, "StepQuestIcon");
export const DailyLoginQuestIcon = outlineIcon(CalendarCheck, "DailyLoginQuestIcon");
export const WordleQuestIcon = outlineIcon(Grid3x3, "WordleQuestIcon");
export const DailyNumbersQuestIcon = outlineIcon(Hash, "DailyNumbersQuestIcon");
export const SpeedCalculusQuestIcon = outlineIcon(Timer, "SpeedCalculusQuestIcon");
export const CrownIcon = outlineIcon(Crown, "CrownIcon");
export const DiamondIcon = outlineIcon(Gem, "DiamondIcon");
export const GiftBoxIcon = outlineIcon(Gift, "GiftBoxIcon");
export const BoxIcon = outlineIcon(Box, "BoxIcon");
export const SparkleIcon = outlineIcon(Sparkle, "SparkleIcon");
export const BarChartIcon = outlineIcon(ChartColumn, "BarChartIcon");
export const SearchIcon = outlineIcon(Search, "SearchIcon");
