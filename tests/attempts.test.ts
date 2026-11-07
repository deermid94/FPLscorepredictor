import { test } from "node:test";
import assert from "node:assert/strict";
import { afterFailure, lockedFor, LIMITS, type AttemptRow } from "../src/lib/attempts.ts";

const MIN = 60_000;

test("locks a name after 5 wrong PINs within 15 minutes", () => {
  let row: AttemptRow | undefined;
  for (let i = 0; i < 4; i++) row = afterFailure(row, i * MIN, LIMITS.name);
  assert.equal(lockedFor(row, 4 * MIN), 0);
  row = afterFailure(row, 4 * MIN, LIMITS.name);
  assert.equal(lockedFor(row, 4 * MIN), 15 * MIN);
  assert.equal(lockedFor(row, 19 * MIN), 0);
});

test("failures spread beyond the window start a fresh count", () => {
  let row: AttemptRow | undefined;
  for (let i = 0; i < 4; i++) row = afterFailure(row, i * MIN, LIMITS.name);
  row = afterFailure(row, 16 * MIN, LIMITS.name);
  assert.equal(row.fails, 1);
  assert.equal(lockedFor(row, 16 * MIN), 0);
});

test("the next failure after a lock expires starts a new window", () => {
  let row: AttemptRow | undefined;
  for (let i = 0; i < 5; i++) row = afterFailure(row, 0, LIMITS.name);
  row = afterFailure(row, 15 * MIN, LIMITS.name);
  assert.equal(row.fails, 1);
  assert.equal(lockedFor(row, 15 * MIN), 0);
});

test("IP limit is looser than the per-name limit", () => {
  let row: AttemptRow | undefined;
  for (let i = 0; i < 29; i++) row = afterFailure(row, 0, LIMITS.ip);
  assert.equal(lockedFor(row, 0), 0);
  row = afterFailure(row, 0, LIMITS.ip);
  assert.ok(lockedFor(row, 0) > 0);
});
