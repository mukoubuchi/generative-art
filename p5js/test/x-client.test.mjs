import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { assertPublishingEnabled, createXClient } from "../lib/x-client.mjs";

test("publishing requires both the enable flag and a user token", () => {
  assert.throws(() => assertPublishingEnabled({}), /Publishing is disabled/);
  assert.throws(
    () => assertPublishingEnabled({ X_POSTING_ENABLED: "true" }),
    /X_USER_ACCESS_TOKEN/
  );
  assert.equal(
    assertPublishingEnabled({
      X_POSTING_ENABLED: "true",
      X_USER_ACCESS_TOKEN: "token"
    }),
    "token"
  );
});

test("the X client refuses to initialize without a token", () => {
  assert.throws(() => createXClient({ token: "" }), /user access token/);
});

test("media publishing uses INIT, APPEND, FINALIZE, then creates a post", async () => {
  const testDirectory = await mkdtemp(join(tmpdir(), "generative-art-x-client-test-"));
  const mediaPath = join(testDirectory, "image.png");
  await writeFile(mediaPath, "image");
  const requests = [];
  const responses = [
    new Response(JSON.stringify({ data: { id: "123" } }), { status: 200 }),
    new Response(null, { status: 204 }),
    new Response(JSON.stringify({ data: { id: "123" } }), { status: 200 }),
    new Response(JSON.stringify({ data: { id: "456" } }), { status: 201 })
  ];
  const fetchImplementation = async (url, options) => {
    requests.push({
      url,
      command: options.body instanceof FormData ? options.body.get("command") : undefined,
      authorization: new Headers(options.headers).get("Authorization")
    });
    return responses.shift();
  };

  try {
    const client = createXClient({ token: "token", fetchImplementation });
    const mediaId = await client.uploadMedia(mediaPath, "image/png", "tweet_image");
    const post = await client.createPost("body", mediaId);

    assert.equal(mediaId, "123");
    assert.equal(post.data.id, "456");
    assert.deepEqual(requests.map((request) => request.command), [
      "INIT",
      "APPEND",
      "FINALIZE",
      undefined
    ]);
    assert.deepEqual(requests.map((request) => request.url), [
      "https://api.x.com/2/media/upload",
      "https://api.x.com/2/media/upload",
      "https://api.x.com/2/media/upload",
      "https://api.x.com/2/tweets"
    ]);
    assert.ok(requests.every((request) => request.authorization === "Bearer token"));
  } finally {
    await rm(testDirectory, { recursive: true });
  }
});
