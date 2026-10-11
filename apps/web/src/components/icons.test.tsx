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
  it("renders every mobile icon name as a decorative outline SVG", () => {
    expect(LIVE_MOBILE_ICONS).toHaveLength(42);

    for (const Icon of LIVE_MOBILE_ICONS) {
      const { container, unmount } = render(<Icon />);
      const svg = container.querySelector("svg");

      expect(svg).not.toBeNull();
      expect(svg).toHaveAttribute("aria-hidden", "true");
      expect(svg).toHaveAttribute("focusable", "false");
      expect(
        svg?.querySelector("path, circle, rect, ellipse, line, polyline, polygon"),
      ).not.toBeNull();
      expect(svg).toHaveAttribute("stroke-width", "1.75");
      unmount();
    }
  });

  it("renders repeated icons without element ids that could collide", () => {
    const { container } = render(
      <>
        <CoinIcon />
        <CoinIcon />
      </>,
    );

    expect(container.querySelectorAll("[id]")).toHaveLength(0);
  });

  it("draws search as an SVG instead of a Unicode glyph", () => {
    const { container } = render(<SearchIcon />);

    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.textContent).toBe("");
  });
});
