/** Ids are long UUIDs; people see and quote the first 8 characters, e.g. "3F9A1C2B". */
export function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}
