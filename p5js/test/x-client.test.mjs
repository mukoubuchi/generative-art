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
    /X_OAUTH2_ACCESS_TOKEN/
  );
  assert.equal(
    assertPublishingEnabled({
      X_POSTING_ENABLED: "true",
      X_OAUTH2_ACCESS_TOKEN: "token"
    }),
    "token"
  );
});

test("the X client refuses to initialize without a token", () => {
  assert.throws(() => createXClient({ token: "" }), /user access token/);
});

test("media publishing walks the three upload endpoints, then creates a post", async () => {
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
      body: options.body,
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
    // The paths, spelled out, because the older shape — one path with a `command` field —
    // is still what the quickstart guide describes and is answered with a 400 that blames
    // a missing `media` field. Pinning them here is what stops a well-meant simplification
    // from putting that request back.
    assert.deepEqual(requests.map((request) => request.url), [
      "https://api.x.com/2/media/upload/initialize",
      "https://api.x.com/2/media/upload/123/append",
      "https://api.x.com/2/media/upload/123/finalize",
      "https://api.x.com/2/tweets"
    ]);

    const [initialize, append, finalize] = requests;
    assert.deepEqual(JSON.parse(initialize.body), {
      media_type: "image/png",
      total_bytes: 5,
      media_category: "tweet_image"
    });
    assert.ok(append.body instanceof FormData);
    assert.equal(append.body.get("segment_index"), "0");
    assert.ok(append.body.get("media"));
    assert.equal(finalize.body, undefined);
    assert.ok(requests.every((request) => request.authorization === "Bearer token"));
  } finally {
    await rm(testDirectory, { recursive: true });
  }
});

test("a failed request carries its status so the caller can tell why", async () => {
  const fetchImplementation = async () => new Response(
    JSON.stringify({ title: "Unauthorized" }),
    { status: 401 }
  );
  const client = createXClient({ token: "token", fetchImplementation });
  await assert.rejects(
    () => client.createPost("body", "123"),
    (error) => {
      assert.equal(error.status, 401);
      return true;
    }
  );
});
