export const generateOtp = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };
  
  export const isOtpExpired = (expiresAt: Date): boolean => {
    return new Date() > expiresAt;
  };
  