import assert from "node:assert/strict";
import { readFile, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { P5JS_DIRECTORY, REPOSITORY_ROOT } from "../lib/catalog.mjs";
import { assertOutsideRepository, secretDirectory, writeSecret } from "../lib/secret-file.mjs";

test("a credential may not be written anywhere inside the repository", () => {
  // The exact place the leak happened: the working directory the scripts are run from.
  assert.throws(
    () => assertOutsideRepository(join(P5JS_DIRECTORY, "x-refresh-token"), "--refresh-token-out"),
    /inside the repository/
  );
  assert.throws(
    () => assertOutsideRepository(REPOSITORY_ROOT, "--refresh-token-out"),
    /inside the repository/
  );
  assert.throws(
    () => assertOutsideRepository(join(REPOSITORY_ROOT, "..", "generative-art", "token"), "out"),
    /inside the repository/
  );
});

test("a path outside the repository is allowed and resolved", () => {
  const outside = resolve(REPOSITORY_ROOT, "..", "x-refresh-token");
  assert.equal(assertOutsideRepository(outside, "--refresh-token-out"), outside);
});

test("a sibling directory whose name merely starts the same is not inside it", () => {
  // `startsWith` on the bare root would call `<root>-backup` a subdirectory of `<root>`.
  const sibling = `${REPOSITORY_ROOT}-backup/x-refresh-token`;
  assert.equal(assertOutsideRepository(sibling, "--refresh-token-out"), sibling);
});

test("the default directory is outside the repository, and its files are private", async () => {
  const directory = await secretDirectory();
  try {
    assert.doesNotThrow(() => assertOutsideRepository(directory, "default"));
    const path = await writeSecret(join(directory, "token"), "s3cret");
    assert.equal(await readFile(path, "utf8"), "s3cret");
    // 0o600: nobody but this user, since the whole point is that it is a credential.
    assert.equal((await stat(path)).mode & 0o777, 0o600);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
