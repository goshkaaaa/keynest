import test from "node:test";
import assert from "node:assert/strict";
import {
  addKey,
  checkout,
  emptyWorkspace,
  returnKey,
  validate,
  csv,
} from "../src/model.js";
const fresh = () => structuredClone(emptyWorkspace);
const today = "2026-10-20";
const now = Date.parse(today + "T12:00:00");
test("physical tags are unique regardless of case", () => {
  const state = addKey(fresh(), { tag: "A1", property: "Flat 12" }, "key");
  assert.throws(
    () => addKey(state, { tag: "a1", property: "Other" }),
    /already exists/,
  );
});
test("a key can have only one open handover", () => {
  const state = addKey(fresh(), { tag: "A1", property: "Flat 12" }, "key");
  checkout(state, { keyId: "key", borrower: "Alex", due: today }, now, "loan");
  assert.throws(
    () => checkout(state, { keyId: "key", borrower: "Sam", due: today }, now),
    /already checked out/,
  );
});
test("returns close a handover and allow the next one", () => {
  const state = addKey(fresh(), { tag: "A1", property: "Flat" }, "key");
  checkout(state, { keyId: "key", borrower: "Alex", due: today }, now, "loan");
  returnKey(state, "loan", now + 1000);
  checkout(
    state,
    { keyId: "key", borrower: "Sam", due: today },
    now + 2000,
    "second",
  );
  assert.equal(
    state.loans.filter((item) => item.returnedAt === null).length,
    1,
  );
  assert.throws(() => returnKey(state, "loan"), /already closed/);
  validate(state);
});
test("invalid calendar dates and past return dates are rejected", () => {
  const state = addKey(fresh(), { tag: "A1", property: "Flat" }, "key");
  for (const due of ["2026-02-30", "2026-10-19", "not-a-date"])
    assert.throws(
      () => checkout(state, { keyId: "key", borrower: "Alex", due }, now),
      /return date/,
    );
});
test("restore rejects dangling handovers and duplicate tags", () => {
  const state = addKey(fresh(), { tag: "A1", property: "Flat" }, "key");
  state.loans = [
    {
      id: "x",
      keyId: "absent",
      borrower: "Sam",
      due: today,
      outAt: now,
      returnedAt: null,
      note: "",
    },
  ];
  assert.throws(() => validate(state), /Invalid/);
});
test("CSV quotes records and neutralises spreadsheet formulas", () => {
  const state = addKey(fresh(), { tag: "=CMD", property: "A, B" }, "key");
  checkout(state, { keyId: "key", borrower: "Alex", due: today }, now, "loan");
  assert.ok(csv(state).includes('"\'=CMD"'));
  assert.ok(csv(state).includes('"A, B"'));
});
