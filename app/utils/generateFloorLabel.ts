// @/utils/generateFloorLabel.ts

export function getFloorLabel(floorNumber: number): string {
  if (floorNumber === 0) return "Ground floor";
  const suffix = (n: number): string => {
    if (n % 100 >= 11 && n % 100 <= 13) return "th";
    switch (n % 10) {
      case 1:
        return "st";
      case 2:
        return "nd";
      case 3:
        return "rd";
      default:
        return "th";
    }
  };
  
  return `${floorNumber}${suffix(floorNumber)} floor`;
}
