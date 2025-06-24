// @/utils/getTimeDifference.ts

// Convert time difference in human readable format
export const getTimeDifference = (mils: number): string => {
  if (mils < 60) return `${mils} seconds`;
  if (mils < 3600)
    return `${
      Math.floor(mils / 60) === 1
        ? `${Math.floor(mils / 60)} minute`
        : `${Math.floor(mils / 60)} minutes`
    }`;
  if (mils < 86400)
    return `${
      Math.floor(mils / 3600) === 1
        ? `${Math.floor(mils / 3600)} hour`
        : `${Math.floor(mils / 3600)} hours`
    }`;
  return `${
    Math.floor(mils / 86400) === 1
      ? `${Math.floor(mils / 86400)} day`
      : `${Math.floor(mils / 86400)} days`
  }`;
};
