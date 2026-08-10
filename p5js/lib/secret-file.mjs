import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { REPOSITORY_ROOT } from "./catalog.mjs";

/**
 * Where a credential is allowed to land.
 *
 * Not in the working tree — not even for the minute between writing it and storing it as a
 * secret. A `.gitignore` entry is a guard on one spelling of one mistake; a file that was
 * never inside the repository cannot be committed by any of them. This is enforced rather
 * than warned about because the failure it prevents is not recoverable: a credential pushed
 * to a public repository stays fetchable at the old commit even after the branch is
 * rewritten, so there is no undo, only revocation.
 */
export function assertOutsideRepository(path, label) {
  const resolved = resolve(path);
  if (resolved === REPOSITORY_ROOT || resolved.startsWith(`${REPOSITORY_ROOT}${sep}`)) {
    throw new Error(
      `${label} would write a credential inside the repository (${resolved}). `
      + "Choose a path outside the working tree, or omit the option to use a temporary directory."
    );
  }
  return resolved;
}

/** A fresh directory outside the repository, which is where these files go by default. */
export function secretDirectory() {
  return mkdtemp(join(tmpdir(), "generative-art-x-"));
}

export async function writeSecret(path, value) {
  await writeFile(path, value, { mode: 0o600 });
  return path;
}
