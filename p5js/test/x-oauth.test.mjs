import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  SCOPES,
  authorizationUrl,
  createPkcePair,
  refreshAccessToken,
  statesMatch
} from "../lib/x-oauth.mjs";

const CLIENT_ID = "client-id";
const CLIENT_SECRET = "client-secret";

function respondWith(status, body) {
  const calls = [];
  const fetchImplementation = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body
    };
  };
  return { calls, fetchImplementation };
}

test("the challenge is the hash of the verifier, and only the hash travels", () => {
  const { verifier, challenge } = createPkcePair();
  assert.equal(challenge, createHash("sha256").update(verifier).digest("base64url"));
  assert.notEqual(verifier, challenge);

  const url = new URL(authorizationUrl({
    clientId: CLIENT_ID,
    redirectUri: "http://localhost:8080/callback",
    challenge,
    state: "state"
  }));
  assert.equal(url.searchParams.get("code_challenge"), challenge);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.ok(!url.href.includes(verifier));
});

test("the authorization asks for every scope the posting job needs", () => {
  const url = new URL(authorizationUrl({
    clientId: CLIENT_ID,
    redirectUri: "http://localhost:8080/callback",
    challenge: "challenge",
    state: "state"
  }));
  const asked = new Set(url.searchParams.get("scope").split(" "));
  for (const scope of ["tweet.write", "media.write", "offline.access"]) {
    assert.ok(asked.has(scope), `${scope} is not being asked for`);
  }
  assert.deepEqual([...asked], SCOPES);
});

test("a redirect carrying somebody else's state is not accepted", () => {
  assert.ok(statesMatch("abc", "abc"));
  assert.ok(!statesMatch("abc", "abd"));
  assert.ok(!statesMatch("abc", "abcd"));
  assert.ok(!statesMatch("abc", undefined));
});

test("a refresh sends the client's credentials and returns the rotated token", async () => {
  const { calls, fetchImplementation } = respondWith(200, {
    access_token: "new-access",
    refresh_token: "new-refresh",
    expires_in: 7200,
    scope: SCOPES.join(" ")
  });

  const tokens = await refreshAccessToken(
    { refreshToken: "old-refresh", clientId: CLIENT_ID },
    { clientSecret: CLIENT_SECRET, fetchImplementation }
  );

  assert.deepEqual(tokens, {
    accessToken: "new-access",
    refreshToken: "new-refresh",
    expiresIn: 7200,
    scope: SCOPES.join(" ")
  });
  // A confidential client authenticates the refresh itself, so the secret rides in the
  // header rather than in the form.
  const [call] = calls;
  assert.equal(
    call.options.headers.Authorization,
    `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`
  );
  const sent = new URLSearchParams(call.options.body);
  assert.equal(sent.get("grant_type"), "refresh_token");
  assert.equal(sent.get("refresh_token"), "old-refresh");
});

test("a refused refresh is reported without echoing the request", async () => {
  const { fetchImplementation } = respondWith(400, {
    error: "invalid_request",
    error_description: "Value passed for the token was invalid."
  });

  await assert.rejects(
    () => refreshAccessToken(
      { refreshToken: "spent-token", clientId: CLIENT_ID },
      { clientSecret: CLIENT_SECRET, fetchImplementation }
    ),
    (error) => {
      assert.match(error.message, /400/);
      assert.match(error.message, /invalid_request/);
      // The token that failed is exactly the kind of value that must not reach a log.
      assert.ok(!error.message.includes("spent-token"));
      assert.ok(!error.message.includes(CLIENT_SECRET));
      return true;
    }
  );
});

test("a response missing either token is a failure rather than a half-refresh", async () => {
  const { fetchImplementation } = respondWith(200, { access_token: "only-access", expires_in: 7200 });
  await assert.rejects(
    () => refreshAccessToken(
      { refreshToken: "old", clientId: CLIENT_ID },
      { clientSecret: CLIENT_SECRET, fetchImplementation }
    ),
    /both an access token and a refresh token/
  );
});
