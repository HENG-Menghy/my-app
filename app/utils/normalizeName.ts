// @/utils/normalizeName.ts

export function normalizeName(name: string): string {
  if (name.includes("-")) {
    return name.replace(/\s+/g, " ").trim().toUpperCase();
  }

  return name
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ") 
    .filter(Boolean) // Remove empty strings
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize first letter
    .join(" "); // Rejoin words
}
