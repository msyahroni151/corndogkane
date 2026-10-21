export const passwordMinLength = 6;
export const passwordMaxLength = 128;
export const passwordPattern = String.raw`(?=.*\p{L})(?=.*\p{N})(?=.*[^\p{L}\p{N}\s]).{6,128}`;
export const passwordHint = "Minimal 6 karakter, berisi huruf, angka, dan simbol.";
export const passwordError =
  "Password harus 6–128 karakter dan mengandung huruf, angka, serta simbol.";
const newPassword = new RegExp(`^(?:${passwordPattern})$`, "u");
export function isValidNewPassword(value: string) {
  return value.length <= passwordMaxLength && newPassword.test(value);
}
