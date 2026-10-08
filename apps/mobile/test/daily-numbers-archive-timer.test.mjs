import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync("app/quests/daily-numbers-play.tsx", "utf8");

function sliceFrom(marker, endMarker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${marker} should exist`);
  const end = source.indexOf(endMarker, start + marker.length);
  assert.notEqual(end, -1, `${endMarker} should follow ${marker}`);
  return source.slice(start, end);
}

describe("Daily Numbers archive timer controls", () => {
  it("restarts the chronometer from the retry counter only", () => {
    assert.match(
      source,
      /resetSignal: interaction\.retrying \? interaction\.retryAttempt : 0,/,
    );
  });

  it("leaves the retry counter alone when Reset board is pressed", () => {
    const resetBoardReducer = sliceFrom(
      'if (action.type === "resetBoard") {',
      "\n  }\n",
    );
    assert.equal(resetBoardReducer.includes("retryAttempt"), false);
    assert.equal(resetBoardReducer.includes("retrying"), false);
  });

  it("increments the retry counter when the result retry button is pressed", () => {
    const startRetryHandler = sliceFrom(
      "const handleStartRetry = useCallback(() => {",
      "\n  }, [",
    );
    assert.match(startRetryHandler, /dispatch\(\{ type: "startRetry" \}\);/);

    const startRetryReducer = sliceFrom(
      'if (action.type === "startRetry") {',
      "\n  }\n",
    );
    assert.match(startRetryReducer, /retrying: true,/);
    assert.match(startRetryReducer, /retryAttempt: state\.retryAttempt \+ 1,/);
  });
});
