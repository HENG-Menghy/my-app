export function toTitleCase(name: string): string {
    return name
      .toLowerCase()
      .split(' ')
      .filter(Boolean)
      .map(word => word[0].toUpperCase() + word.slice(1))
      .join(' ');
  }
  