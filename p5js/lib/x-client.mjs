import { open, stat } from "node:fs/promises";

const DEFAULT_API_BASE_URL = "https://api.x.com";
const DEFAULT_CHUNK_BYTES = 4 * 1024 * 1024;
const MAXIMUM_STATUS_CHECKS = 30;

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function parseResponse(response) {
  const responseText = await response.text();
  let responseBody;
  try {
    responseBody = responseText ? JSON.parse(responseText) : undefined;
  } catch {
    responseBody = responseText;
  }
  if (!response.ok) {
    const failure = new Error(
      `X API request failed with ${response.status}: ${JSON.stringify(responseBody)}`
    );
    // Carried separately so a caller can tell "these credentials may not" from "this
    // request was malformed" without reading the sentence back.
    failure.status = response.status;
    throw failure;
  }
  return responseBody;
}

/**
 * The token is the short-lived one a refresh just produced, not something kept in storage:
 * an X access token lasts two hours, so there is never a stored one worth reading. It is
 * passed in through the environment by the step that refreshed it.
 */
export function assertPublishingEnabled(environment = process.env) {
  if (environment.X_POSTING_ENABLED !== "true") {
    throw new Error("Publishing is disabled. Set X_POSTING_ENABLED=true as an explicit second gate.");
  }
  if (!environment.X_OAUTH2_ACCESS_TOKEN) {
    throw new Error("X_OAUTH2_ACCESS_TOKEN is required for publishing.");
  }
  return environment.X_OAUTH2_ACCESS_TOKEN;
}

export function createXClient({
  token,
  fetchImplementation = fetch,
  sleep = delay,
  apiBaseUrl = DEFAULT_API_BASE_URL,
  chunkBytes = DEFAULT_CHUNK_BYTES
}) {
  if (!token) {
    throw new Error("A user access token is required.");
  }

  async function request(path, options = {}) {
    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return parseResponse(await fetchImplementation(`${apiBaseUrl}${path}`, {
      ...options,
      headers
    }));
  }

  /*
   * The chunked upload has three endpoints of its own. It is worth saying why, because the
   * quickstart guide still describes the older shape — one path, `POST /2/media/upload`,
   * with a `command` field naming the step — and following it gets a 400 reading "Missing
   * media field in JSON". That path is now the *simple* upload, which takes the whole file
   * in one request under a `media` field, so a form saying `command=INIT` looks to it like
   * an upload with no file in it. The reference pages for initialize, append and finalize
   * are the ones that match what the service does.
   */
  async function initializeUpload(filePath, mediaType, mediaCategory) {
    const fileStats = await stat(filePath);
    const response = await request("/2/media/upload/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: mediaType,
        total_bytes: fileStats.size,
        media_category: mediaCategory
      })
    });
    // `data.id` rather than `data.media_key`: it is the numeric id the append and finalize
    // paths are built from, and the one a post's `media_ids` takes.
    const mediaId = response?.data?.id;
    if (!mediaId) {
      throw new Error("X media initialize response did not include a media id.");
    }
    return { mediaId: String(mediaId), size: fileStats.size };
  }

  async function appendChunks(filePath, mediaId, totalBytes, mediaType) {
    const file = await open(filePath, "r");
    try {
      let offset = 0;
      let segmentIndex = 0;
      while (offset < totalBytes) {
        const bytesToRead = Math.min(chunkBytes, totalBytes - offset);
        const buffer = Buffer.allocUnsafe(bytesToRead);
        const { bytesRead } = await file.read(buffer, 0, bytesToRead, offset);
        if (bytesRead === 0) {
          throw new Error(`Unexpected end of media file at byte ${offset}.`);
        }
        const form = new FormData();
        form.set("segment_index", String(segmentIndex));
        form.set(
          "media",
          new Blob([buffer.subarray(0, bytesRead)], { type: mediaType }),
          "media"
        );
        await request(`/2/media/upload/${mediaId}/append`, { method: "POST", body: form });
        offset += bytesRead;
        segmentIndex += 1;
      }
    } finally {
      await file.close();
    }
  }

  async function status(mediaId) {
    const parameters = new URLSearchParams({ command: "STATUS", media_id: mediaId });
    return request(`/2/media/upload?${parameters}`);
  }

  async function waitForProcessing(mediaId, initialProcessingInfo) {
    let processingInfo = initialProcessingInfo;
    for (let check = 0; processingInfo && check < MAXIMUM_STATUS_CHECKS; check += 1) {
      if (processingInfo.state === "succeeded") {
        return;
      }
      if (processingInfo.state === "failed") {
        throw new Error(`X media processing failed: ${JSON.stringify(processingInfo.error)}`);
      }
      const waitSeconds = Math.max(1, Number(processingInfo.check_after_secs) || 1);
      await sleep(waitSeconds * 1000);
      const response = await status(mediaId);
      processingInfo = response?.data?.processing_info ?? response?.processing_info;
    }
    if (processingInfo) {
      throw new Error("X media processing did not complete within the status-check limit.");
    }
  }

  // No body: the id is the whole request, and it is in the path.
  async function finalizeUpload(mediaId) {
    const response = await request(`/2/media/upload/${mediaId}/finalize`, { method: "POST" });
    const processingInfo = response?.data?.processing_info ?? response?.processing_info;
    await waitForProcessing(mediaId, processingInfo);
  }

  async function uploadMedia(filePath, mediaType, mediaCategory) {
    const { mediaId, size } = await initializeUpload(filePath, mediaType, mediaCategory);
    await appendChunks(filePath, mediaId, size, mediaType);
    await finalizeUpload(mediaId);
    return mediaId;
  }

  async function createPost(text, mediaId) {
    return request("/2/tweets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, media: { media_ids: [mediaId] } })
    });
  }

  // `initializeUpload` is exposed on its own so that the question "may these credentials
  // upload media?" can be asked without uploading anything: an initialized upload that is
  // never appended to expires by itself and creates no post.
  return { initializeUpload, uploadMedia, createPost };
}
