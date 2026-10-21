import { promises as fs } from "fs";
import path from "path";

// TEMPORARY home of the students' mobile numbers, used until the `student` table has a mobile column.
//
// While you run the project on your computer the numbers are also written to
// .data/mobile-numbers.json, so they survive a restart. (Do not commit that file: add `.data/` to .gitignore.)
// In tests, and in production, they are only kept in memory, so on a server they are lost on restart.
// That is why the database column has to be added before the project goes live.
//
// DB SWAP: when the `student` table has `mobile_no`, delete this file and
//   get(studentId)        -> select student.mobileNo where studentId = ...
//   set(studentId, value) -> update student set mobileNo = value where studentId = ...
// (or simply save mobileNo inside studentRepo.upsert and read row.mobileNo in profile.service.ts).

type Store = { numbers: Record<string, string>; loading?: Promise<void>; writing: Promise<void> };
const g = globalThis as unknown as { __hmsMobileStore?: Store };
const store: Store = (g.__hmsMobileStore ??= { numbers: {}, writing: Promise.resolve() });

const FILE = process.env.MOBILE_STORE_FILE ?? path.join(process.cwd(), ".data", "mobile-numbers.json");
const useFile = !process.env.VITEST && process.env.NODE_ENV !== "production";

function load(): Promise<void> {
  store.loading ??= (async () => {
    if (!useFile) return;
    try {
      store.numbers = JSON.parse(await fs.readFile(FILE, "utf8"));
    } catch {
      // no file yet: start empty
    }
  })();
  return store.loading;
}

async function persist(): Promise<void> {
  if (!useFile) return;
  store.writing = store.writing.then(async () => {
    try {
      await fs.mkdir(path.dirname(FILE), { recursive: true });
      await fs.writeFile(FILE, JSON.stringify(store.numbers, null, 2));
    } catch (e) {
      console.error("[mobile store] could not write the file:", e);
    }
  });
  await store.writing;
}

export const mobileRepo = {
  /** The saved 10-digit number of a student, or null when there is none. */
  async get(studentId: string): Promise<string | null> {
    await load();
    return store.numbers[studentId] ?? null;
  },
  async set(studentId: string, mobileNo: string): Promise<void> {
    await load();
    store.numbers[studentId] = mobileNo;
    await persist();
  },
};
