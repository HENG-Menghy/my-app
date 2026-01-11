// @/utils/generateRoomName.ts

export function getRoomName(
  buildingName: string,
  floorNumber: number,
  roomIndex: number
): string {
  const acronym = getAcronym(buildingName);
  return `${acronym}-F${String(floorNumber).padStart(2, "0")}-R${String(
    roomIndex + 1
  ).padStart(2, "0")}`;
}

export function getAcronym(name: string): string {
  const excludeWords = new Set([
    "in",
    "at",
    "of",
    "the",
    "on",
    "a",
    "an",
    "and",
    "or",
    "to",
    "by",
    "for",
    "with",
  ]);
  const cleanedWords = name
    .trim()
    .split(/\s+/)
    .filter((word) => word && !excludeWords.has(word.toLowerCase()));

  return cleanedWords.length > 1
    ? cleanedWords
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : name.trim().toUpperCase();
}
