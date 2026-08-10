#!/usr/bin/env node

import { createServer } from "node:http";
import { join } from "node:path";
import { assertOutsideRepository, secretDirectory, writeSecret } from "../lib/secret-file.mjs";
import {
  authorizationUrl,
  createPkcePair,
  createState,
  exchangeAuthorizationCode,
  statesMatch
} from "../lib/x-oauth.mjs";

/**
 * The one step of this pipeline that needs a person: a browser, an account, and a click on
 * Authorize. It is run once by hand, and what it produces — a refresh token — is what the
 * unattended job trades in every night from then on.
 *
 * X will only redirect to an address registered with the app, so the browser is sent back
 * to a server this script starts on the loopback interface and shuts down as soon as it has
 * answered. Nothing is printed but progress: the code, the tokens and the verifier stay in
 * this process and in the files the tokens are written to.
 *
 * Those files land outside the repository — in a temporary directory by default, and never
 * inside the working tree even when a path is given. A credential that is never in the
 * repository cannot be committed from it, which matters here because there is no undoing a
 * push: a rewritten branch leaves the old commit fetchable, so the only remedy is to revoke
 * the credential and start again.
 */
const DEFAULT_PORT = 8080;

/**
 * The loopback address rather than the name. `localhost` resolves to both ::1 and 127.0.0.1
 * and a browser may try either, so a server bound to one of them can be knocked on at the
 * other; the address says which, and the registered callback has to match this exactly.
 */
const DEFAULT_HOST = "127.0.0.1";

function parseArguments(argumentsList) {
  const options = { port: DEFAULT_PORT, host: DEFAULT_HOST };
  const names = new Map([
    ["--refresh-token-out", "refreshTokenPath"],
    ["--access-token-out", "accessTokenPath"],
    ["--redirect-host", "host"],
    ["--port", "port"]
  ]);
  for (let index = 0; index < argumentsList.length; index += 1) {
    const name = names.get(argumentsList[index]);
    if (!name || !argumentsList[index + 1]) {
      throw new Error(`Unknown or incomplete option: ${argumentsList[index]}`);
    }
    options[name] = name === "port" ? Number(argumentsList[index + 1]) : argumentsList[index + 1];
    index += 1;
  }
  if (!Number.isInteger(options.port) || options.port <= 0) {
    throw new Error("--port must be a positive integer.");
  }
  if (options.refreshTokenPath) {
    assertOutsideRepository(options.refreshTokenPath, "--refresh-token-out");
  }
  if (options.accessTokenPath) {
    assertOutsideRepository(options.accessTokenPath, "--access-token-out");
  }
  return options;
}

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required. Take it from the app's Keys and tokens page.`);
  }
  return value;
}

/** Resolves with the authorization code once the browser comes back, or rejects. */
function waitForCallback(server, { port, path, state }) {
  return new Promise((resolve, reject) => {
    server.on("request", (request, response) => {
      const requested = new URL(request.url, `http://127.0.0.1:${port}`);
      if (requested.pathname !== path) {
        response.writeHead(404).end("Not found");
        return;
      }

      const failure = requested.searchParams.get("error");
      const code = requested.searchParams.get("code");
      // The state proves the redirect answers the request this process made, rather than
      // one someone else started in the same browser.
      const matched = statesMatch(state, requested.searchParams.get("state"));

      response.writeHead(failure || !code || !matched ? 400 : 200, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      if (failure) {
        response.end(`Authorization was refused: ${failure}`);
        reject(new Error(`Authorization was refused: ${failure}`));
        return;
      }
      if (!matched) {
        response.end("The state did not match. Nothing was exchanged.");
        reject(new Error("The redirect carried a state this run did not issue."));
        return;
      }
      if (!code) {
        response.end("No authorization code came back.");
        reject(new Error("The redirect carried no authorization code."));
        return;
      }
      response.end("Authorized. You can close this tab and return to the terminal.");
      resolve(code);
    });
    server.on("error", reject);
  });
}

const options = parseArguments(process.argv.slice(2));
const clientId = requiredEnvironment("X_CLIENT_ID");
const clientSecret = requiredEnvironment("X_CLIENT_SECRET");

const path = "/callback";
const redirectUri = `http://${options.host}:${options.port}${path}`;
const { verifier, challenge } = createPkcePair();
const state = createState();

const server = createServer();
const callback = waitForCallback(server, { port: options.port, path, state });
await new Promise((resolve) => server.listen(options.port, options.host, resolve));

console.log("Open this address, sign in as the posting account, and choose Authorize:");
console.log("");
console.log(authorizationUrl({ clientId, redirectUri, challenge, state }));
console.log("");
console.log(`Waiting for the redirect back to ${redirectUri} …`);

try {
  const code = await callback;
  const tokens = await exchangeAuthorizationCode(
    { code, verifier, clientId, redirectUri },
    { clientSecret }
  );
  const directory = options.refreshTokenPath && options.accessTokenPath
    ? undefined
    : await secretDirectory();
  const refreshTokenPath = options.refreshTokenPath ?? join(directory, "x-refresh-token");
  // The access token this exchange also returned, for anything that wants to try the
  // credentials at once. Taking it from here rather than refreshing for it is the whole
  // point: a refresh would spend the token that is about to be stored, and the copy in
  // storage would be dead on arrival.
  const accessTokenPath = options.accessTokenPath ?? join(directory, "x-access-token");

  await writeSecret(refreshTokenPath, tokens.refreshToken);
  await writeSecret(accessTokenPath, tokens.accessToken);

  console.log("");
  console.log(`Authorized. Scopes: ${tokens.scope}`);
  console.log(`Refresh token: ${refreshTokenPath}`);
  console.log(`Access token:  ${accessTokenPath} (good for ${tokens.expiresIn} seconds)`);
  console.log("");
  console.log("Next:");
  console.log(`  npm run x:check -- --access-token-file ${accessTokenPath}`);
  console.log(`  gh secret set X_REFRESH_TOKEN < ${refreshTokenPath}`);
  console.log(`  rm ${refreshTokenPath} ${accessTokenPath}`);
} finally {
  server.close();
}
