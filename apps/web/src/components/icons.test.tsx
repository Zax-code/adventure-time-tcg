import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  BarChartIcon,
  BoxIcon,
  CardsIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClaimedIcon,
  ClockIcon,
  CoinIcon,
  CraftIcon,
  CrownIcon,
  DailyLoginQuestIcon,
  DailyNumbersQuestIcon,
  DiamondIcon,
  DustIcon,
  EyeIcon,
  GiftBoxIcon,
  GiftHeartIcon,
  HelpCircleIcon,
  HomeIcon,
  PackIcon,
  PauseIcon,
  PlayIcon,
  QuestIcon,
  RecycleIcon,
  SearchIcon,
  SettingsIcon,
  ShareIcon,
  SkipBackIcon,
  SkipForwardIcon,
  SparkleIcon,
  SparklesIcon,
  SpeedCalculusQuestIcon,
  StepQuestIcon,
  SwapIcon,
  SwordsIcon,
  TrophyIcon,
  UserPlusIcon,
  WordleQuestIcon,
  XCircleIcon,
  XIcon,
  ZapIcon,
} from "./icons";

const LIVE_MOBILE_ICONS = [
  HomeIcon,
  CardsIcon,
  PackIcon,
  GiftHeartIcon,
  QuestIcon,
  SwordsIcon,
  TrophyIcon,
  UserPlusIcon,
  ClockIcon,
  EyeIcon,
  ZapIcon,
  XIcon,
  CheckIcon,
  ShareIcon,
  PlayIcon,
  PauseIcon,
  SkipBackIcon,
  SkipForwardIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  SwapIcon,
  CoinIcon,
  DustIcon,
  RecycleIcon,
  CraftIcon,
  CheckCircleIcon,
  ClaimedIcon,
  XCircleIcon,
  SparklesIcon,
  SettingsIcon,
  HelpCircleIcon,
  StepQuestIcon,
  DailyLoginQuestIcon,
  WordleQuestIcon,
  DailyNumbersQuestIcon,
  SpeedCalculusQuestIcon,
  CrownIcon,
  DiamondIcon,
  GiftBoxIcon,
  BoxIcon,
  SparkleIcon,
  BarChartIcon,
] as const;

describe("web app icons", () => {
  it("ports every live mobile SVG as a decorative native DOM SVG", () => {
    expect(LIVE_MOBILE_ICONS).toHaveLength(42);

    for (const Icon of LIVE_MOBILE_ICONS) {
      const { container, unmount } = render(<Icon />);
      const svg = container.querySelector("svg");

      expect(svg).not.toBeNull();
      expect(svg).toHaveAttribute("aria-hidden", "true");
      expect(svg).toHaveAttribute("focusable", "false");
      expect(svg?.querySelector("path, circle, rect, ellipse")).not.toBeNull();
      unmount();
    }
  });

  it("namespaces repeated coin gradient ids", () => {
    const { container } = render(
      <>
        <CoinIcon />
        <CoinIcon />
      </>,
    );
    const ids = [...container.querySelectorAll("[id]")].map((node) => node.id);

    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses the exact SVG Ionicons search adapter instead of a Unicode glyph", () => {
    const { container } = render(<SearchIcon />);

    expect(container.querySelector("svg path")).toHaveAttribute(
      "d",
      expect.stringContaining("456.69 421.39"),
    );
  });
});
