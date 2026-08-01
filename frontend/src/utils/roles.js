export function roleHome(role) {
  if (role === "admin") return "/app/admin/users";
  return "/app/dashboard";
}

export function otherParticipant(conversation, userId) {
  return conversation?.participants?.find((person) => person._id !== userId);
}
