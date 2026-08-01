import { roleHome, otherParticipant } from "./roles";

test("roleHome sends administrators to moderation", () => {
  expect(roleHome("admin")).toBe("/app/admin/users");
  expect(roleHome("client")).toBe("/app/dashboard");
  expect(roleHome("lawyer")).toBe("/app/dashboard");
});

test("otherParticipant returns the counterpart", () => {
  const conversation = { participants: [{ _id: "one" }, { _id: "two" }] };
  expect(otherParticipant(conversation, "one")._id).toBe("two");
});
