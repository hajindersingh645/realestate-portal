/** `+919815012345` → `+91******2345`. */
export function maskPhone(phone: string): string {
  return phone.length <= 7
    ? '****'
    : `${phone.slice(0, 3)}${'*'.repeat(phone.length - 7)}${phone.slice(-4)}`;
}
