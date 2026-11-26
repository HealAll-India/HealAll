import { apiPost } from "@/lib/api/client";

export interface PresignedUploadResponse {
  upload_url: string;
  object_key: string;
  bucket: string;
  expires_in: number;
  public_url: string | null;
}

interface PresignBody {
  file_name: string;
  content_type: string;
  /** Exact file size in bytes. Signed into the URL, so S3 rejects a different size. */
  size_bytes: number;
}

export function presignProfilePhoto(token: string, body: PresignBody) {
  return apiPost<PresignedUploadResponse>("/v1/uploads/profile-photo", {
    token,
    data: body,
  });
}

export function presignPostAttachment(
  token: string,
  postId: string,
  body: PresignBody,
) {
  return apiPost<PresignedUploadResponse>(
    `/v1/uploads/post-attachment?post_id=${encodeURIComponent(postId)}`,
    { token, data: body },
  );
}

/**
 * PUT the given file to a presigned S3 URL. Throws on non-2xx.
 * The Content-Type header and the body size MUST match what was sent to the
 * presign endpoint — S3 signs both and rejects mismatches. The browser sets
 * Content-Length from the File itself.
 */
export async function putToPresignedUrl(
  uploadUrl: string,
  file: File,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!res.ok) {
    // Read the body for diagnostics but don't surface it to users — storage
    // responses can carry internal request IDs / bucket policy hints that
    // shouldn't leak into UI banners.
    const text = await res.text().catch(() => "");
    console.debug("Storage PUT failed", { status: res.status, body: text.slice(0, 200) });
    throw new Error(`Upload to storage failed (${res.status}). Please try again.`);
  }
}
