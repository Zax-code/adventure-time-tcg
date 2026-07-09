import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AuthenticatedProfileImage,
  CardArt,
  CardBack,
  PackArt,
} from "./game-art";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("game art components", () => {
  it("layers a real card illustration under the exact theme outline", () => {
    const { container } = render(
      <CardArt
        character="Finn"
        imageAssetId="card-id"
        name="Hero Finn"
        rarityName="Legendary"
        themeName="candy"
      />,
    );

    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute("src", "/media/card/card-id");
    expect(images[0]).toHaveAttribute("alt", "Hero Finn — Finn");
    expect(images[0]).toHaveAttribute("loading", "lazy");
    expect(images[1]).toHaveAttribute("alt", "");
    expect(images[1]).toHaveAttribute("aria-hidden", "true");
    expect(
      container.querySelector('source[type="image/avif"]'),
    ).toHaveAttribute("srcset", expect.stringContaining(" 2x"));
  });

  it("falls back to an accessible initial when card media fails", () => {
    render(
      <CardArt
        imageAssetId="missing-card"
        name="Princess Bubblegum"
        rarityName="Epic"
        themeName="ice"
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "Princess Bubblegum" }));
    expect(
      screen.getByRole("img", { name: "Princess Bubblegum" }),
    ).toHaveTextContent("P");
  });

  it("uses catalog media first for card backs and bundled art as the fallback", () => {
    render(
      <CardBack
        imageAssetId="back-id"
        rarityName="Rare"
        themeName="nightosphere"
      />,
    );

    const cardBack = screen.getByRole("img", { name: "Rare card back" });
    expect(cardBack).toHaveAttribute("src", "/media/catalog/back-id");
    fireEvent.error(cardBack);
    expect(cardBack.getAttribute("src")).not.toContain("/media/catalog/");
  });

  it("derives accessible pack alt text and the real bundled pack visual", () => {
    render(<PackArt guaranteedRarity="Legendary" name="Champion Pack" />);

    const pack = screen.getByRole("img", { name: "Champion Pack artwork" });
    expect(pack).toHaveAttribute("loading", "lazy");
    expect(pack.getAttribute("src")).toContain("legendary-pack");
  });
});

describe("AuthenticatedProfileImage", () => {
  it("ignores and revokes a stale request after its asset changes", async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    vi.stubGlobal("fetch", fetchMock);
    const createObjectURL = vi
      .fn()
      .mockReturnValueOnce("blob:second")
      .mockReturnValueOnce("blob:first");
    const revokeObjectURL = vi.fn();
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: createObjectURL },
      revokeObjectURL: { configurable: true, value: revokeObjectURL },
    });

    const { rerender } = render(
      <AuthenticatedProfileImage
        accessToken="token"
        alt="Profile"
        fallback={<span>Fallback</span>}
        imageAssetId="first"
      />,
    );
    rerender(
      <AuthenticatedProfileImage
        accessToken="token"
        alt="Profile"
        fallback={<span>Fallback</span>}
        imageAssetId="second"
      />,
    );

    await act(async () => {
      second.resolve(new Response(new Blob(["second"]), { status: 200 }));
      await second.promise;
    });
    await waitFor(() => {
      expect(screen.getByRole("img", { name: "Profile" })).toHaveAttribute(
        "src",
        "blob:second",
      );
    });

    await act(async () => {
      first.resolve(new Response(new Blob(["first"]), { status: 200 }));
      await first.promise;
    });

    expect(screen.getByRole("img", { name: "Profile" })).toHaveAttribute(
      "src",
      "blob:second",
    );
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:first");
  });

  it("revokes undecodable media and restores its fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Blob(["bad"]), { status: 200 })),
    );
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: vi.fn(() => "blob:bad") },
      revokeObjectURL: { configurable: true, value: vi.fn() },
    });

    render(
      <AuthenticatedProfileImage
        accessToken="token"
        alt="Profile"
        fallback={<span>Fallback</span>}
        imageAssetId="bad"
      />,
    );
    const image = await screen.findByRole("img", { name: "Profile" });
    fireEvent.error(image);

    expect(screen.getByText("Fallback")).toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:bad");
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}
