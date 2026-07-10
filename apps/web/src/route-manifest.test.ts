import { describe, expect, it } from "vitest";

import { titleForPath, websiteRoutes } from "./route-manifest";

describe("website route inventory", () => {
  it("keeps every redesigned public, player, and admin surface unique", () => {
    expect(websiteRoutes).toHaveLength(45);
    expect(new Set(websiteRoutes.map((route) => route.path)).size).toBe(45);
    expect(new Set(websiteRoutes.map((route) => route.group))).toEqual(
      new Set(["Public", "Player", "Admin"]),
    );
  });

  it("resolves titles for dynamic website routes", () => {
    expect(titleForPath("/collection/finn-the-human")).toBe("Card detail");
    expect(titleForPath("/pvp/match/9f23")).toBe("Live battle");
    expect(titleForPath("/admin/users/rowan")).toBe("User detail");
  });
});
