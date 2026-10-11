import type { ReactElement, ReactNode } from "react";
import { isValidElement } from "react";
import type { LucideIcon } from "lucide-react-native";

import { BACKDROP, SHADOW, type ShadowToken } from "@adventure-time/theme";

import { useThemeStore } from "../../stores/theme-store";
import { THEME_COLORS, type ThemeName } from "../../theme/themes";

export type Tone =
  | "primary"
  | "secondary"
  | "accent"
  | "success"
  | "info"
  | "danger";

// The spec's icon set is Lucide at a 1.75 stroke. Import icons one by one
// ("lucide-react-native/icons/coins") so Metro does not bundle the whole set.
export const ICON_STROKE_WIDTH = 1.75;

// An icon is a Lucide component, a ready element, or a render function that
// receives the tone color and size picked by the component.
export type IconRender = (props: { color: string; size: number }) => ReactNode;

export type IconSlot = LucideIcon | ReactElement | IconRender;

export const TONE_CLASS: Record<
  Tone,
  { tint: string; border: string; text: string; fill: string }
> = {
  primary: {
    tint: "bg-primaryTint",
    border: "border-primaryBorder",
    text: "text-primaryText",
    fill: "bg-primary",
  },
  secondary: {
    tint: "bg-secondaryTint",
    border: "border-secondaryBorder",
    text: "text-secondaryText",
    fill: "bg-secondary",
  },
  accent: {
    tint: "bg-accentTint",
    border: "border-accentBorder",
    text: "text-accentText",
    fill: "bg-accent",
  },
  success: {
    tint: "bg-successTint",
    border: "border-successBorder",
    text: "text-successText",
    fill: "bg-success",
  },
  info: {
    tint: "bg-infoTint",
    border: "border-infoBorder",
    text: "text-infoText",
    fill: "bg-info",
  },
  danger: {
    tint: "bg-dangerTint",
    border: "border-dangerBorder",
    text: "text-dangerText",
    fill: "bg-danger",
  },
};

export type ThemePalette = (typeof THEME_COLORS)[ThemeName];

export function useThemeName() {
  return useThemeStore((state) => state.themeName);
}

export function useThemePalette(): ThemePalette {
  return THEME_COLORS[useThemeName()];
}

export function toneTextColor(tc: ThemePalette, tone: Tone) {
  return tc[`${tone}Text`];
}

export function getBackdropColor(themeName: ThemeName) {
  return BACKDROP[themeName];
}

function toBoxShadow({ color, offsetX, offsetY, blur }: ShadowToken) {
  return `${offsetX}px ${offsetY}px ${blur}px ${color}`;
}

export function getElevation(themeName: ThemeName, level: "float" | "overlay") {
  return toBoxShadow(SHADOW[themeName][level]);
}

export function SlotIcon({
  icon,
  color,
  size,
}: {
  icon: IconSlot | undefined;
  color: string;
  size: number;
}) {
  if (icon == null) {
    return null;
  }

  if (isValidElement(icon)) {
    return icon;
  }

  // Lucide icons are forwardRef objects; render functions are plain functions.
  if (typeof icon === "object") {
    const Icon = icon as LucideIcon;
    return <Icon size={size} color={color} strokeWidth={ICON_STROKE_WIDTH} />;
  }

  return <>{(icon as IconRender)({ color, size })}</>;
}
