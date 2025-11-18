/**
 * Strict YouTube URL validator with domain, length, format, and link-type checks.
 * Production-safe, defensive, and concise.
 */

interface ValidationResult {
  valid: boolean;
  message?: string;
  videoId?: string;
}

/**
 * Validates a YouTube URL and extracts the video ID.
 *
 * Checks:
 * 1. URL length <= 500 chars
 * 2. Valid URL format (parseable by URL constructor)
 * 3. Allowed YouTube domain (youtube.com, youtu.be, etc.)
 * 4. Valid YouTube link type (/watch?v= or youtu.be short form)
 * 5. Video ID extraction
 *
 * @param rawUrl - The raw URL string from user input
 * @returns { valid: true, videoId: "..." } on success
 * @returns { valid: false, message: "..." } on failure
 */
export function validateYouTubeUrl(rawUrl: string): ValidationResult {
  // Trim whitespace
  const url = rawUrl.trim();

  // Check 1: URL length
  if (url.length > 500) {
    return { valid: false, message: "URL too long." };
  }

  // Check 2: URL format
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { valid: false, message: "Invalid URL format." };
  }

  // Check 3: Allowed domains
  const hostname = parsedUrl.hostname.toLowerCase();
  const isYoutubeDomain = hostname === "youtube.com" || hostname.endsWith(".youtube.com");
  const isYoutubeBe = hostname === "youtu.be";
  const isYoutubeNoCookie =
    hostname === "youtube-nocookie.com" || hostname.endsWith(".youtube-nocookie.com");

  const isDomainAllowed = isYoutubeDomain || isYoutubeBe || isYoutubeNoCookie;

  if (!isDomainAllowed) {
    return {
      valid: false,
      message: "Invalid domain. Only YouTube URLs are allowed.",
    };
  }

  // Check 4: Valid YouTube link type and extract video ID
  let videoId: string | null = null;

  // Case 1: youtu.be short links (e.g., https://youtu.be/dQw4w9WgXcQ)
  if (isYoutubeBe) {
    const match = parsedUrl.pathname.match(/^\/([a-zA-Z0-9_-]{11})$/);
    if (match) {
      videoId = match[1];
    }
  }

  // Case 2: youtube.com /watch?v= links
  if (!videoId && (isYoutubeDomain || isYoutubeNoCookie)) {
    const vParam = parsedUrl.searchParams.get("v");
    if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
      videoId = vParam;
    }
  }

  // Check 5: Video ID found and valid
  if (!videoId) {
    return {
      valid: false,
      message: "Unsupported YouTube link type.",
    };
  }

  return { valid: true, videoId };
}
