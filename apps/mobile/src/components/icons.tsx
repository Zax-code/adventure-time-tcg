// One outline icon set (Lucide, board 01 of the design system proposal),
// tinted by theme tokens. Names and props are unchanged for callers; an icon
// without a color uses its tone text token. Card art glyphs (rarity, type)
// live with the card components, not here.

import type { LucideIcon } from "lucide-react-native";
import ArrowLeftRight from "lucide-react-native/icons/arrow-left-right";
import Box from "lucide-react-native/icons/box";
import CalendarCheck from "lucide-react-native/icons/calendar-check";
import ChartColumn from "lucide-react-native/icons/chart-column";
import Check from "lucide-react-native/icons/check";
import ChevronDown from "lucide-react-native/icons/chevron-down";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import CircleCheck from "lucide-react-native/icons/circle-check";
import CircleQuestionMark from "lucide-react-native/icons/circle-question-mark";
import CircleX from "lucide-react-native/icons/circle-x";
import Clock from "lucide-react-native/icons/clock";
import Coins from "lucide-react-native/icons/coins";
import Crown from "lucide-react-native/icons/crown";
import Eye from "lucide-react-native/icons/eye";
import Footprints from "lucide-react-native/icons/footprints";
import Gem from "lucide-react-native/icons/gem";
import Gift from "lucide-react-native/icons/gift";
import Grid3x3 from "lucide-react-native/icons/grid-3x3";
import Hammer from "lucide-react-native/icons/hammer";
import Hash from "lucide-react-native/icons/hash";
import House from "lucide-react-native/icons/house";
import Layers from "lucide-react-native/icons/layers";
import Package from "lucide-react-native/icons/package";
import Pause from "lucide-react-native/icons/pause";
import Play from "lucide-react-native/icons/play";
import Recycle from "lucide-react-native/icons/recycle";
import ScrollText from "lucide-react-native/icons/scroll-text";
import Settings from "lucide-react-native/icons/settings";
import Share from "lucide-react-native/icons/share";
import SkipBack from "lucide-react-native/icons/skip-back";
import SkipForward from "lucide-react-native/icons/skip-forward";
import Sparkle from "lucide-react-native/icons/sparkle";
import Sparkles from "lucide-react-native/icons/sparkles";
import Swords from "lucide-react-native/icons/swords";
import Timer from "lucide-react-native/icons/timer";
import Trophy from "lucide-react-native/icons/trophy";
import UserPlus from "lucide-react-native/icons/user-plus";
import X from "lucide-react-native/icons/x";
import Zap from "lucide-react-native/icons/zap";

import { THEME_COLORS } from "../theme/themes";
import { ICON_STROKE_WIDTH, useThemePalette } from "./ui/tokens";

interface IconProps {
  size?: number;
  color?: string;
}

type ToneKey = keyof (typeof THEME_COLORS)["candy"];

function themedIcon(Icon: LucideIcon, defaultTone: ToneKey, name: string) {
  function ThemedIcon({ size = 24, color }: IconProps) {
    const tc = useThemePalette();

    return (
      <Icon
        size={size}
        color={color ?? tc[defaultTone]}
        strokeWidth={ICON_STROKE_WIDTH}
      />
    );
  }

  ThemedIcon.displayName = name;
  return ThemedIcon;
}

export const HomeIcon = themedIcon(House, "primaryText", "HomeIcon");
export const CardsIcon = themedIcon(Layers, "primaryText", "CardsIcon");
export const PackIcon = themedIcon(Package, "primaryText", "PackIcon");
export const GiftHeartIcon = themedIcon(Gift, "primaryText", "GiftHeartIcon");
export const QuestIcon = themedIcon(ScrollText, "primaryText", "QuestIcon");
export const SwordsIcon = themedIcon(Swords, "primaryText", "SwordsIcon");
export const TrophyIcon = themedIcon(Trophy, "primaryText", "TrophyIcon");
export const UserPlusIcon = themedIcon(UserPlus, "primaryText", "UserPlusIcon");
export const ClockIcon = themedIcon(Clock, "primaryText", "ClockIcon");
export const EyeIcon = themedIcon(Eye, "primaryText", "EyeIcon");
export const ZapIcon = themedIcon(Zap, "primaryText", "ZapIcon");
export const XIcon = themedIcon(X, "primaryText", "XIcon");
export const CheckIcon = themedIcon(Check, "primaryText", "CheckIcon");
export const ShareIcon = themedIcon(Share, "primaryText", "ShareIcon");
export const PlayIcon = themedIcon(Play, "primaryText", "PlayIcon");
export const PauseIcon = themedIcon(Pause, "primaryText", "PauseIcon");
export const SkipBackIcon = themedIcon(SkipBack, "primaryText", "SkipBackIcon");
export const SkipForwardIcon = themedIcon(SkipForward, "primaryText", "SkipForwardIcon");
export const ChevronRightIcon = themedIcon(ChevronRight, "primaryText", "ChevronRightIcon");
export const ChevronDownIcon = themedIcon(ChevronDown, "primaryText", "ChevronDownIcon");
export const SwapIcon = themedIcon(ArrowLeftRight, "primaryText", "SwapIcon");
export const CoinIcon = themedIcon(Coins, "secondaryText", "CoinIcon");
export const DustIcon = themedIcon(Sparkles, "secondaryText", "DustIcon");
export const RecycleIcon = themedIcon(Recycle, "primaryText", "RecycleIcon");
export const CraftIcon = themedIcon(Hammer, "primaryText", "CraftIcon");
export const CheckCircleIcon = themedIcon(CircleCheck, "successText", "CheckCircleIcon");
export const XCircleIcon = themedIcon(CircleX, "dangerText", "XCircleIcon");
export const SparklesIcon = themedIcon(Sparkles, "primaryText", "SparklesIcon");
export const SettingsIcon = themedIcon(Settings, "primaryText", "SettingsIcon");
const HelpCircleBase = themedIcon(CircleQuestionMark, "primaryText", "HelpCircleIcon");

export function HelpCircleIcon({
  noCircle: _noCircle,
  ...props
}: IconProps & { noCircle?: boolean }) {
  return <HelpCircleBase {...props} />;
}

export const StepQuestIcon = themedIcon(Footprints, "primaryText", "StepQuestIcon");
export const DailyLoginQuestIcon = themedIcon(CalendarCheck, "primaryText", "DailyLoginQuestIcon");
export const WordleQuestIcon = themedIcon(Grid3x3, "primaryText", "WordleQuestIcon");
export const DailyNumbersQuestIcon = themedIcon(Hash, "primaryText", "DailyNumbersQuestIcon");
export const SpeedCalculusQuestIcon = themedIcon(Timer, "primaryText", "SpeedCalculusQuestIcon");
export const CrownIcon = themedIcon(Crown, "secondaryText", "CrownIcon");
export const DiamondIcon = themedIcon(Gem, "accentText", "DiamondIcon");
export const GiftBoxIcon = themedIcon(Gift, "dangerText", "GiftBoxIcon");
export const BoxIcon = themedIcon(Box, "fgMuted", "BoxIcon");
export const SparkleIcon = themedIcon(Sparkle, "primaryText", "SparkleIcon");
export const BarChartIcon = themedIcon(ChartColumn, "primaryText", "BarChartIcon");
