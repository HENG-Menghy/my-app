// @/utils/generateRoomName.ts

export function getRoomName(buildingName: string, floorNumber: number, roomIndex: number): string {
    const acronym = buildingName
      .split(' ')
      .map(w => w[0].toUpperCase())
      .join('');
      
    return `${acronym}-F${String(floorNumber).padStart(2, '0')}-R${String(roomIndex+1).padStart(2, '0')}`;
}