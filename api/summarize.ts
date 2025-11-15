import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";
import dotenv from "dotenv";
import { YoutubeTranscript } from "youtube-transcript";

dotenv.config();

// Rate limit store
const RATE_LIMIT = 5;
const ipUsage: Record<string, { count: number; lastReset: number }> = {};


// Extract YouTube video ID
function extractVideoId(url: string): string | null {
  const regex = /(?:v=|\/shorts\/|youtu\.be\/)([^&?/]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}


// NEW Transcript Scraper (works 2025)
async function fetchTranscript(videoId: string) {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    return segments.map(s => s.text).join(" ");
  } catch (err) {
    console.error("Transcript fetch error:", err);
    return null;
  }
}


// Fetch title via YouTube oEmbed
async function fetchTitle(videoId: string): Promise<string | null> {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (!response.ok) return null;

    const data = await response.json();
    return data.title || null;
  } catch {
    return null;
  }
}


export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const ip = (req.headers["x-forwarded-for"] as string) || req.socket?.remoteAddress || "unknown";
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

    if (!usingBYOK && ipUsage[ip].count >= RATE_LIMIT) {
      return res.status(429).json({ error: "Free-tier limit reached. Add your own API key." });
    }

    // Extract video ID
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return res.status(400).json({ error: "Invalid YouTube URL" });
    }

    // Fetch transcript
    const transcript = await fetchTranscript(videoId);
    if (!transcript) {
      return res.status(404).json({ error: "Transcript not available for this video." });
    }

    // Fetch title
    const title = await fetchTitle(videoId) || "Untitled Video";

    // OpenAI key
    const OPENAI_KEY = userApiKey || process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) {
      return res.status(500).json({ error: "Server missing OpenAI API key." });
    }

    const client = new OpenAI({ apiKey: OPENAI_KEY });

    // Build JSON prompt
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

Do not add commentary.
Do not use backticks.
Only JSON.

TITLE: ${title}
TRANSCRIPT: ${transcript}
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
    } catch {
      return res.status(500).json({ error: "AI returned invalid JSON", raw });
    }

    res.json(json);

  } catch (err: any) {
    console.error("Summarize Error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
}
