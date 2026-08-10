import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const AUTHORIZE_ENDPOINT = "https://x.com/i/oauth2/authorize";
export const TOKEN_ENDPOINT = "https://api.x.com/2/oauth2/token";

/**
 * `tweet.write` alone is not enough to post: the endpoint that creates a post also asks for
 * the two read scopes, and the upload endpoint asks for `media.write` of its own. The last
 * one is what makes a refresh token be issued at all, and without a refresh token an
 * unattended job would need a person at a browser every two hours.
 */
export const SCOPES = [
  "tweet.read",
  "tweet.write",
  "users.read",
  "media.write",
  "offline.access"
];

/**
 * The authorization code flow with PKCE. The verifier is a secret this process invents and
 * keeps; only its hash travels with the browser redirect, so an authorization code stolen
 * in transit cannot be exchanged by whoever took it.
 */
export function createPkcePair(randomSource = randomBytes) {
  const verifier = randomSource(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function createState(randomSource = randomBytes) {
  return randomSource(16).toString("base64url");
}

/** Compares two states without letting the comparison's duration say where they differ. */
export function statesMatch(expected, received) {
  const expectedBytes = Buffer.from(String(expected));
  const receivedBytes = Buffer.from(String(received ?? ""));
  return expectedBytes.length === receivedBytes.length
    && timingSafeEqual(expectedBytes, receivedBytes);
}

export function authorizationUrl({ clientId, redirectUri, challenge, state, scopes = SCOPES }) {
  const url = new URL(AUTHORIZE_ENDPOINT);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256"
  }).toString();
  return url.href;
}

/**
 * Every failure here is reported by status and by the two fields X uses to explain itself.
 * The response body is not passed through: on the way in it holds the client secret's work
 * and on the way out it holds tokens, and an error that prints either one puts it in a log
 * that outlives the run.
 */
async function requestToken(parameters, { clientId, clientSecret, fetchImplementation = fetch }) {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetchImplementation(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams(parameters).toString()
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = [body.error, body.error_description].filter(Boolean).join(": ");
    throw new Error(`X token request failed with ${response.status}${reason ? `: ${reason}` : ""}.`);
  }
  if (!body.access_token || !body.refresh_token) {
    throw new Error("X token response did not include both an access token and a refresh token.");
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresIn: Number(body.expires_in) || 0,
    scope: body.scope ?? ""
  };
}

export async function exchangeAuthorizationCode(
  { code, verifier, clientId, redirectUri },
  options
) {
  return requestToken(
    {
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      code_verifier: verifier
    },
    { clientId, ...options }
  );
}

/**
 * A refresh consumes the token it is given and hands back a different one, so the value in
 * storage is stale the moment this returns. Whatever calls it has to store the new token
 * before it does anything else it might fail at.
 */
export async function refreshAccessToken({ refreshToken, clientId }, options) {
  return requestToken(
    { grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId },
    { clientId, ...options }
  );
}
