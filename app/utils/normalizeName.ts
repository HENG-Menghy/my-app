// @/utils/normalizeName.ts

export function normalizeName(name: string): string {
  const linkingWords = new Set([
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
  name = name.trim();
  if (name.includes("-") || name.split(/\s+/).length === 1) 
    return name.toUpperCase();

  return name
    .split(/\s+/)
    .map((word, index) => {
      const islinkingWord = linkingWords.has(word.toLowerCase());
      return (index === 0 || !islinkingWord) 
        ? `${word[0].toUpperCase()}${word.toLowerCase().slice(1)}`
        : word.toLowerCase();
    })
    .join(" ");
}