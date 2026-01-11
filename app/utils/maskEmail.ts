// @/utils/maskEmail.ts

/**
 * Mask characters of email address except domain for safe display.
 * 
 * - If chars length greater than 8:
 * Show only first two and the last two chars, and mask the rest except domain.
 * 
 * - If chars length greater than or equal to 6 and less than or equal to 8:
 * Show only first two chars, and mask the rest except domain.
 * 
 * - If chars length less than 6:
 * Mask all chars except domain.
 * 
 * @param input email string
 * @return masked email
 */

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  const charsLength = local.length;
  const firstTwoChars = local.slice(0, 2);
  const lastTwoChars = local.slice(charsLength - 2);

  let maskedEmail = "";
  if (local.length > 8) {
    const maskedPart = "*".repeat(Math.max(charsLength - 4, 0));
    maskedEmail = `${firstTwoChars}${maskedPart}${lastTwoChars}@${domain}`;
  } else if (charsLength >= 6 && charsLength <= 8) {
    const maskedPart = "*".repeat(Math.max(charsLength - 2, 0));
    maskedEmail = `${firstTwoChars}${maskedPart}@${domain}`;
  } else {
    const maskedPart = "*".repeat(Math.max(charsLength, 0));
    maskedEmail = `${maskedPart}@${domain}`;
  }

  return maskedEmail;
}
