import { test } from "node:test";
import assert from "node:assert/strict";
import { scorePrediction, splitPot, splitPrizes, wrongness } from "../src/lib/scoring.ts";

test("exact score = 3, correct result = 1, wrong = 0", () => {
  assert.equal(scorePrediction({ home: 2, away: 1 }, { home: 2, away: 1 }, false).points, 3);
  assert.equal(scorePrediction({ home: 3, away: 1 }, { home: 2, away: 1 }, false).points, 1);
  assert.equal(scorePrediction({ home: 1, away: 1 }, { home: 0, away: 0 }, false).points, 1);
  assert.equal(scorePrediction({ home: 0, away: 1 }, { home: 2, away: 1 }, false).points, 0);
});

test("wildcard doubles points", () => {
  assert.equal(scorePrediction({ home: 2, away: 1 }, { home: 2, away: 1 }, true).points, 6);
  assert.equal(scorePrediction({ home: 1, away: 0 }, { home: 2, away: 1 }, true).points, 2);
  assert.equal(scorePrediction({ home: 0, away: 0 }, { home: 2, away: 1 }, true).points, 0);
});

const pot = 3000; // 6 players x €5

test("clear 1st and 2nd: 40% / 20%, 40% rolls over", () => {
  const { awards, rolloverCents } = splitPrizes(
    [{ userId: 1, points: 10 }, { userId: 2, points: 8 }, { userId: 3, points: 5 }],
    pot,
  );
  assert.equal(awards.get(1), 1200);
  assert.equal(awards.get(2), 600);
  assert.equal(awards.get(3), undefined);
  assert.equal(rolloverCents, 1200);
});

test("two tied for 1st share 1st+2nd", () => {
  const { awards, rolloverCents } = splitPrizes(
    [{ userId: 1, points: 10 }, { userId: 2, points: 10 }, { userId: 3, points: 5 }],
    pot,
  );
  assert.equal(awards.get(1), 900);
  assert.equal(awards.get(2), 900);
  assert.equal(awards.has(3), false);
  assert.equal(rolloverCents, 1200);
});

test("tie for 2nd splits the 20%", () => {
  const { awards, rolloverCents } = splitPrizes(
    [{ userId: 1, points: 10 }, { userId: 2, points: 6 }, { userId: 3, points: 6 }, { userId: 4, points: 6 }],
    pot,
  );
  assert.equal(awards.get(1), 1200);
  assert.equal(awards.get(2), 200);
  assert.equal(awards.get(3), 200);
  assert.equal(awards.get(4), 200);
  assert.equal(rolloverCents, 1200);
});

test("three tied for 1st share 60%; rounding pennies roll over", () => {
  const { awards, rolloverCents } = splitPrizes(
    [{ userId: 1, points: 4 }, { userId: 2, points: 4 }, { userId: 3, points: 4 }, { userId: 4, points: 1 }],
    2000,
  );
  assert.equal(awards.get(1), 400);
  assert.equal(rolloverCents, 2000 - 1200);
  const odd = splitPrizes([{ userId: 1, points: 4 }, { userId: 2, points: 4 }, { userId: 3, points: 4 }], 1000);
  assert.equal(odd.awards.get(1), 200);
  assert.equal(odd.rolloverCents, 400);
});

test("season pot split between tied leaders", () => {
  const awards = splitPot([{ userId: 1, points: 50 }, { userId: 2, points: 50 }, { userId: 3, points: 40 }], 4800);
  assert.equal(awards.get(1), 2400);
  assert.equal(awards.get(2), 2400);
  assert.equal(awards.has(3), false);
});

test("wrongness only for wrong results, flipped winners hurt most", () => {
  assert.equal(wrongness({ home: 2, away: 1 }, { home: 3, away: 0 }), 0);
  assert.equal(wrongness({ home: 3, away: 0 }, { home: 0, away: 3 }), 8);
  assert.equal(wrongness({ home: 1, away: 1 }, { home: 2, away: 0 }), 2);
});
