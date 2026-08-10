#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import { refreshAccessToken } from "../lib/x-oauth.mjs";

/**
 * Trades the stored refresh token for a working access token, and for the refresh token
 * that replaces it.
 *
 * Both are written to files rather than printed. A value on stdout is in the workflow log,
 * and a workflow log is kept; a file under the runner's temporary directory goes away with
 * the runner. The caller is expected to store the new refresh token before it posts
 * anything — see the workflow, where those are two separate steps in that order.
 */
function parseArguments(argumentsList) {
  const options = {};
  const names = new Map([
    ["--access-token-out", "accessTokenPath"],
    ["--refresh-token-out", "refreshTokenPath"]
  ]);
  for (let index = 0; index < argumentsList.length; index += 1) {
    const name = names.get(argumentsList[index]);
    if (!name || !argumentsList[index + 1]) {
      throw new Error(`Unknown or incomplete option: ${argumentsList[index]}`);
    }
    options[name] = argumentsList[index + 1];
    index += 1;
  }
  if (!options.accessTokenPath || !options.refreshTokenPath) {
    throw new Error("Both --access-token-out and --refresh-token-out are required.");
  }
  return options;
}

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required to refresh the X access token.`);
  }
  return value;
}

const options = parseArguments(process.argv.slice(2));
const clientId = requiredEnvironment("X_CLIENT_ID");
const clientSecret = requiredEnvironment("X_CLIENT_SECRET");
const refreshToken = requiredEnvironment("X_REFRESH_TOKEN");

const tokens = await refreshAccessToken({ refreshToken, clientId }, { clientSecret });

// Written before anything is reported, and readable only by this user: the rotated token is
// now the single thing standing between the account and a re-authorization by hand.
await writeFile(options.refreshTokenPath, tokens.refreshToken, { mode: 0o600 });
await writeFile(options.accessTokenPath, tokens.accessToken, { mode: 0o600 });

console.log(`Refreshed. Scopes: ${tokens.scope}`);
console.log(`Access token expires in ${tokens.expiresIn} seconds.`);
console.log(`Access token written to ${options.accessTokenPath}`);
console.log(`Rotated refresh token written to ${options.refreshTokenPath}`);
