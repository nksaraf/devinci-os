export function checkFlag(f: number, flags: any): boolean {
  return (f & flags) > 0;
}
