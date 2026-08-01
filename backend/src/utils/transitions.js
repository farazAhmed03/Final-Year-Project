const { APPOINTMENT_STATUS, CASE_STATUS } = require("../constants");

const appointmentTransitions = Object.freeze({
  [APPOINTMENT_STATUS.REQUESTED]: new Set([
    APPOINTMENT_STATUS.CONFIRMED,
    APPOINTMENT_STATUS.REJECTED,
    APPOINTMENT_STATUS.CANCELLED
  ]),
  [APPOINTMENT_STATUS.CONFIRMED]: new Set([
    APPOINTMENT_STATUS.COMPLETED,
    APPOINTMENT_STATUS.CANCELLED
  ]),
  [APPOINTMENT_STATUS.REJECTED]: new Set(),
  [APPOINTMENT_STATUS.CANCELLED]: new Set(),
  [APPOINTMENT_STATUS.COMPLETED]: new Set()
});

const caseTransitions = Object.freeze({
  [CASE_STATUS.SUBMITTED]: new Set([CASE_STATUS.ACCEPTED, CASE_STATUS.REJECTED]),
  [CASE_STATUS.ACCEPTED]: new Set([CASE_STATUS.IN_PROGRESS, CASE_STATUS.CLOSED]),
  [CASE_STATUS.IN_PROGRESS]: new Set([CASE_STATUS.CLOSED]),
  [CASE_STATUS.CLOSED]: new Set(),
  [CASE_STATUS.REJECTED]: new Set()
});

function canTransition(map, current, next) {
  return Boolean(map[current]?.has(next));
}

module.exports = { appointmentTransitions, caseTransitions, canTransition };
