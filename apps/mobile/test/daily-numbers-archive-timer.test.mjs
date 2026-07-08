import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync("app/quests/daily-numbers-play.tsx", "utf8");

function extractCallbackBody(name) {
  const start = source.indexOf(`const ${name} = useCallback(() => {`);
  assert.notEqual(start, -1, `${name} callback should exist`);

  const dependencyStart = source.indexOf("\n  }, [", start);
  assert.notEqual(
    dependencyStart,
    -1,
    `${name} callback dependencies should be present`,
  );

  return source.slice(start, dependencyStart);
}

describe("Daily Numbers archive timer controls", () => {
  it("leaves the timer alone when Reset board is pressed", () => {
    const resetBoardBody = extractCallbackBody("handleResetBoard");

    assert.equal(resetBoardBody.includes("resetElapsedMs"), false);
  });

  it("resets the timer only when the result retry button is pressed", () => {
    const startRetryBody = extractCallbackBody("handleStartRetry");

    assert.equal(startRetryBody.includes("chronometer.resetElapsedMs()"), true);
  });
});
