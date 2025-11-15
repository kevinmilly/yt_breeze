import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

// Load .env locally (ignored in prod)
import dotenv from "dotenv";
dotenv.config();

// Rate limit store
const RATE_LIMIT = 5;
const ipUsage: Record<string, { count: number; lastReset: number }> = {};


// --------------------------------------
// Utility: Extract YouTube Video ID
// --------------------------------------
function extractVideoId(url: string): string | null {
  const regex = /(?:v=|\/shorts\/|youtu\.be\/)([^&?/]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}


// --------------------------------------
// Utility: Fetch Transcript from Lemnos API
// --------------------------------------
async function fetchTranscript(videoId: string) {
  try {
    const url = `https://yt.lemnoslife.com/videos?part=transcript&id=${videoId}`;
    const response = await fetch(url);
    const json = await response.json();

    const transcript = json?.items?.[0]?.transcript;

    if (!transcript || transcript.length === 0) return null;

    // Join into one large text block
    return transcript.map((t: any) => t.text).join(" ");
  } catch (e) {
    console.error("Transcript fetch error:", e);
    return null;
  }
}


// --------------------------------------
// Utility: Fetch Title (no API key needed)
// --------------------------------------
async function fetchTitle(videoId: string): Promise<string | null> {
  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    return data.title || null;
  } catch {
    return null;
  }
}


// --------------------------------------
// MAIN HANDLER
// --------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed. Use POST." });
  }

  try {
    const ip =
      (req.headers["x-forwarded-for"] as string) ||
      req.socket?.remoteAddress ||
      "unknown";

    const now = Date.now();
    const day = 1000 * 60 * 60 * 24;

    if (!ipUsage[ip] || now - ipUsage[ip].lastReset > day) {
      ipUsage[ip] = { count: 0, lastReset: now };
    }

    const { youtubeUrl, userApiKey } = req.body;
    const usingBYOK = !!userApiKey;

    if (!youtubeUrl) {
      return res.status(400).json({ error: "Missing YouTube URL" });
    }

    // Enforce rate limit if not BYOK
    if (!usingBYOK && ipUsage[ip].count >= RATE_LIMIT) {
      return res.status(429).json({
        error: "Free-tier limit reached. Add your own API key.",
      });
    }

    // -------------------------------
    // Extract Video ID
    // -------------------------------
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return res.status(400).json({ error: "Invalid YouTube URL" });
    }

    // -------------------------------
    // Fetch Transcript
    // -------------------------------
    const transcript = await fetchTranscript(videoId);
    if (!transcript) {
      return res.status(404).json({
        error: "Transcript not available for this video.",
      });
    }

    // -------------------------------
    // Fetch Title
    // -------------------------------
    const title = await fetchTitle(videoId) || "Untitled Video";

    // -------------------------------
    // Setup OpenAI Key
    // -------------------------------
    const OPENAI_KEY = userApiKey || process.env.OPENAI_API_KEY;

    if (!OPENAI_KEY) {
      return res.status(500).json({
        error: "Server missing OpenAI API key.",
      });
    }

    const client = new OpenAI({ apiKey: OPENAI_KEY });


    // -------------------------------
    // Build JSON prompt
    // -------------------------------
    const prompt = `
You are an AI that returns ONLY valid JSON.

Analyze the following YouTube video title and transcript.
Then produce JSON EXCLUSIVELY in this structure:

{
  "bottom_line": "",
  "key_points": [],
  "skip_to_timestamp": "",
  "fluff_level": {
    "score": 0,
    "summary": ""
  },
  "clickbait_accuracy": {
    "score": 0,
    "title_claim": "",
    "actual_video_message": "",
    "explanation": ""
  },
  "better_title": "",
  "off_topic_segments": [
    {
      "start": "",
      "end": "",
      "reason": ""
    }
  ]
}

IMPORTANT:
- No commentary.
- No backticks.
- Only JSON.

TITLE:
${title}

TRANSCRIPT:
${transcript}
`;

    const completion = await client.responses.create({
      model: "gpt-4o-mini",
      input: prompt,
    });

    if (!usingBYOK) ipUsage[ip].count++;

    const raw = completion.output_text;

    let json;
    try {
      json = JSON.parse(raw);
    } catch (err) {
      console.error("JSON parse error:", err);
      return res.status(500).json({
        error: "AI returned invalid JSON",
        raw,
      });
    }

    return res.json(json);

  } catch (err: any) {
    console.error("Summarize API Error:", err);
    return res.status(500).json({
      error: "Server error",
      details: err?.message ?? "Unknown error",
    });
  }
}
