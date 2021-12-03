export const encoder = new TextEncoder();
export const decoder = new TextDecoder();

export async function println(e: any) {
  await Deno.stdout.write(encoder.encode(e + '\r\n'));
}

export async function print(e: any) {
  await Deno.stdout.write(encoder.encode(e));
}
