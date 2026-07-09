import { readFileSync } from "node:fs";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  THEME_COLORS,
  THEME_CSS_VARIABLES,
  THEME_NAMES,
} from "@adventure-time/theme";

import { ThemeProvider, useTheme } from "./theme-provider";
import { WEB_THEME_STORAGE_KEY } from "./theme";

const themeCss = readFileSync("src/theme/theme.css", "utf8");

afterEach(cleanup);

function ThemeConsumer() {
  const { setTheme, themeName } = useTheme();

  return (
    <button type="button" onClick={() => setTheme("nightosphere")}>
      {themeName}
    </button>
  );
}

describe("ThemeProvider", () => {
  it("hydrates, applies, and persists the selected app theme", async () => {
    const values = new Map([[WEB_THEME_STORAGE_KEY, "ice"]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    render(
      <ThemeProvider storage={storage}>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    expect(screen.getByRole("button", { name: "ice" })).toBeInTheDocument();
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("ice");
    });

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "nightosphere" }),
      ).toBeInTheDocument();
      expect(document.documentElement.dataset.theme).toBe("nightosphere");
      expect(values.get(WEB_THEME_STORAGE_KEY)).toBe("nightosphere");
    });
  });

  it("keeps every semantic variable aligned with its raw token", () => {
    for (const [themeName, variables] of Object.entries(THEME_CSS_VARIABLES)) {
      expect(variables["--color-bg"]).toBe(
        THEME_COLORS[themeName as keyof typeof THEME_COLORS].bg,
      );
      expect(Object.keys(variables)).toHaveLength(
        Object.keys(THEME_COLORS.candy).length,
      );
    }
  });

  it("keeps the CSP-safe static CSS synchronized with shared theme tokens", () => {
    for (const themeName of THEME_NAMES) {
      const selector =
        themeName === "candy"
          ? ':root[data-theme="candy"]'
          : `:root[data-theme="${themeName}"]`;
      const blockStart = themeCss.indexOf(selector);
      const blockEnd = themeCss.indexOf("}", blockStart);
      const block = themeCss.slice(blockStart, blockEnd);

      expect(blockStart).toBeGreaterThanOrEqual(0);

      for (const [variableName, expectedValue] of Object.entries(
        THEME_CSS_VARIABLES[themeName],
      )) {
        const match = block.match(
          new RegExp(`${variableName}:\\s*([^;]+);`, "i"),
        );

        expect(match?.[1]?.replace(/\s/g, "").toLowerCase()).toBe(
          expectedValue.replace(/\s/g, "").toLowerCase(),
        );
      }
    }
  });
});
