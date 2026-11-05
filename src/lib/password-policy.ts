export const passwordMinLength = 12;
export const passwordMaxLength = 128;
export const passwordPattern = String.raw`(?=.*\p{L})(?=.*\p{N})(?=.*[^\p{L}\p{N}\s]).{12,128}`;
export const passwordHint = "Minimal 12 karakter, berisi huruf, angka, dan simbol.";
export const passwordError =
  "Password harus 12–128 karakter dan mengandung huruf, angka, serta simbol.";
const newPassword = new RegExp(`^(?:${passwordPattern})$`, "u");
export function isValidNewPassword(value: string) {
  return value.length <= passwordMaxLength && newPassword.test(value);
}
