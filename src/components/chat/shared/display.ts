export function formatStudentName(studentId: string) {
  const trimmed = studentId.trim();
  const tail = trimmed.split("/").pop();
  return tail && tail.length > 0 ? tail : trimmed;
}

export function firstNameOf(name: string | null | undefined) {
  if (!name) {
    return null;
  }
  const trimmed = name.trim();
  if (!trimmed) {
    return null;
  }
  const first = trimmed.split(/\s+/)[0];
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : null;
}

export function initialsOf(name: string) {
  const parts = name
    .split(/[\s@.]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
