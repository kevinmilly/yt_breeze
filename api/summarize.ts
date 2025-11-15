import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

// ------------------------
// Rate Limit per IP
// ------------------------
const RATE_LIMIT = 5;
const ipUsage: Record<string, { count: number; lastReset: number }> = {};

// ------------------------
// Extract video ID
// ------------------------
function extractVideoId(url: string): string | null {
  const regex = /(?:v=|\/shorts\/|youtu\.be\/)([^&?/]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// ------------------------------------------------------
// PIPE.video — Fetch transcript via VTT file
// ------------------------------------------------------
async function fetchTranscriptFromPiped(videoId: string): Promise<string | null> {
  try {
    const infoUrl = `https://pipedapi.kavin.rocks/streams/${videoId}`;
    const infoRes = await fetch(infoUrl);

    if (!infoRes.ok) return null;

    const info = await infoRes.json();

    if (!info.captions || info.captions.length === 0) return null;

    const english =
      info.captions.find((c: any) =>
        c.language.toLowerCase().includes("english")
      ) || info.captions[0];

    const vttUrl = english.url.replace(
      "https://pipedapi.kavin.rocks",
      "https://pipedproxy.kavin.rocks"
    );

    const vttRes = await fetch(vttUrl);
    if (!vttRes.ok) return null;

    const vtt = await vttRes.text();

    const text = vtt
      .split("\n")
      .filter((line) => line && !line.includes("-->") && isNaN(Number(line)))
      .join(" ");

    return text.trim();
  } catch (err) {
    console.error("Transcript error:", err);
    return null;
  }
}

// ------------------------
// Fetch title via oEmbed
// ------------------------
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

// ------------------------
// MAIN HANDLER
// ------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Use POST" });

  try {
    const ip =
      (req.headers["x-forwarded-for"] as string) ||
      req.socket?.remoteAddress ||
      "unknown";

    const now = Date.now();
    const day = 1000 * 60 * 60 * 24;

    if (!ipUsage[ip] || now - ipUsage[ip].lastReset > day)
      ipUsage[ip] = { count: 0, lastReset: now };

    const { youtubeUrl, userApiKey } = req.body;
    const usingBYOK = !!userApiKey;

    if (!youtubeUrl)
      return res.status(400).json({ error: "Missing YouTube URL" });

    if (!usingBYOK && ipUsage[ip].count >= RATE_LIMIT)
      return res
        .status(429)
        .json({ error: "Free-tier limit reached. Add your API key." });

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId)
      return res.status(400).json({ error: "Invalid YouTube URL" });

    const transcript = await fetchTranscriptFromPiped(videoId);
    if (!transcript)
      return res
        .status(404)
        .json({ error: "Transcript not available." });

    const title = (await fetchTitle(videoId)) || "Untitled Video";

    const OPENAI_KEY = userApiKey || process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY)
      return res.status(500).json({ error: "Missing OpenAI key" });

    const client = new OpenAI({ apiKey: OPENAI_KEY });

    const prompt = `
You output ONLY valid JSON. No commentary.

Analyze the YouTube title and transcript:

TITLE:
${title}

TRANSCRIPT:
${transcript}

Respond with JSON matching EXACTLY this structure:

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
  "off_topic_segments": [{ "start": "", "end": "", "reason": "" }]
}
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
      return res.status(500).json({
        error: "Invalid JSON returned by model",
        raw,
      });
    }

    res.json(json);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
}
