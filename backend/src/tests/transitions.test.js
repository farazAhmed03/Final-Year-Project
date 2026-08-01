const test = require("node:test");
const assert = require("node:assert/strict");
const {
  appointmentTransitions,
  caseTransitions,
  canTransition
} = require("../utils/transitions");

test("appointment transition policy allows expected workflow", () => {
  assert.equal(canTransition(appointmentTransitions, "requested", "confirmed"), true);
  assert.equal(canTransition(appointmentTransitions, "confirmed", "completed"), true);
  assert.equal(canTransition(appointmentTransitions, "completed", "requested"), false);
});

test("case transition policy prevents reopening a closed case", () => {
  assert.equal(canTransition(caseTransitions, "submitted", "accepted"), true);
  assert.equal(canTransition(caseTransitions, "accepted", "in_progress"), true);
  assert.equal(canTransition(caseTransitions, "closed", "in_progress"), false);
});
