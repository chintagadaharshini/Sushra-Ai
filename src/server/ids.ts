import "server-only";
import { randomInt } from "node:crypto";
import { prisma } from "./db";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O/1/I confusion

/** App-level health ID such as "SU-7K2P9Q". Not an ABHA number. */
export async function newHealthId(): Promise<string> {
  for (;;) {
    const id = "SU-" + Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
    if (!(await prisma.patientProfile.findFirst({ where: { healthId: id }, select: { id: true } }))) return id;
  }
}

export function tempPassword(): string {
  return "Sv" + Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("") + randomInt(10, 99);
}
