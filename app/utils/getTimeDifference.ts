// @/utils/getTimeDifference.ts

// Convert time difference in human readable format
export const getTimeDifference = (seconds: number): string => {
  if (seconds < 60) 
    return `${
      seconds === 0 || seconds === 1 
        ? `${seconds} second`
        : `${seconds} seconds`
    }`;
  if (seconds < 3600)
    return `${
      Math.floor(seconds / 60) === 1
        ? `${Math.floor(seconds / 60)} minute`
        : `${Math.floor(seconds / 60)} minutes`
    }`;
  if (seconds < 86400)
    return `${
      Math.floor(seconds / 3600) === 1
        ? `${Math.floor(seconds / 3600)} hour`
        : `${Math.floor(seconds / 3600)} hours`
    }`;
  return `${
    Math.floor(seconds / 86400) === 1
      ? `${Math.floor(seconds / 86400)} day`
      : `${Math.floor(seconds / 86400)} days`
  }`;
};