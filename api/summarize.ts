import type { VercelRequest, VercelResponse } from "@vercel/node";
import dotenv from "dotenv";
import OpenAI from "openai";

import { YOUTUBE_ANALYZER_PROMPT } from "./prompts/youtubeAnalyzerPrompt";

dotenv.config();

// --------------------------------------
// RATE LIMIT (for free-tier usage)
// --------------------------------------
const RATE_LIMIT = 5;
const ipUsage: Record<string, { count: number; lastReset: number }> = {};

// --------------------------------------
// Extract Video ID
// --------------------------------------
function extractVideoId(url: string): string | null {
  const regex = /(?:v=|youtu\.be\/|\/shorts\/)([^&?/]+)/;
  const m = url.match(regex);
  return m ? m[1] : null;
}

// --------------------------------------
// Fetch transcript via SUPADATA (FIXED)
// --------------------------------------
async function fetchTranscriptSupadata(videoId: string): Promise<string> {
  const API_KEY = process.env.SUPADATA_API_KEY;
  if (!API_KEY) throw new Error("Missing SUPADATA_API_KEY");

  const url = `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}`;

  const resp = await fetch(url, {
    headers: { "x-api-key": API_KEY },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Supadata error: ${text}`);
  }

  const json = await resp.json();
  console.log("Supadata Raw Response:", json);

  // Validate format
  if (!json?.content || !Array.isArray(json.content)) {
    throw new Error("Supadata returned invalid transcript format");
  }

  // Merge transcript text chunks into one big string
  const mergedTranscript = json.content
    .map((c: any) => c.text?.trim() || "")
    .filter(Boolean)
    .join(" ");

  if (!mergedTranscript.length) {
    throw new Error("Supadata transcript was empty");
  }

  return mergedTranscript;
}


// --------------------------------------
// Fetch title using YouTube oEmbed
// --------------------------------------
async function fetchTitle(videoId: string): Promise<string> {
  try {
    const resp = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );

    if (!resp.ok) return "Untitled Video";

    const json = await resp.json();
    return json.title || "Untitled Video";
  } catch {
    return "Untitled Video";
  }
}

// --------------------------------------
// MAIN HANDLER
// --------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const ip =
      (req.headers["x-forwarded-for"] as string) ||
      req.socket?.remoteAddress ||
      "unknown";

    // DAILY RATE LIMIT RESET
    const now = Date.now();
    const day = 1000 * 60 * 60 * 24;

    if (!ipUsage[ip] || now - ipUsage[ip].lastReset > day) {
      ipUsage[ip] = { count: 0, lastReset: now };
    }

    // Parse request
    const { youtubeUrl, userApiKey } = req.body;
    const usingBYOK = !!userApiKey;

    if (!youtubeUrl)
      return res.status(400).json({ error: "Missing YouTube URL" });

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId)
      return res.status(400).json({ error: "Invalid YouTube URL" });

    // --------------------------------------
    // TITLE
    // --------------------------------------
    const title = await fetchTitle(videoId);

    // --------------------------------------
    // TRANSCRIPT (Supadata)
    // --------------------------------------
    let transcript: string;
    try {
      transcript = await fetchTranscriptSupadata(videoId);
    } catch (err: any) {
      console.error("Supadata Error:", err);
      return res.status(500).json({
        error: "Supadata error",
        details: err?.message || "Unknown error",
      });
    }

    // --------------------------------------
    // Build Final Prompt
    // --------------------------------------
    const filledPrompt = YOUTUBE_ANALYZER_PROMPT
      .replace("{{TITLE}}", title)
      .replace("{{TRANSCRIPT}}", transcript);

    // --------------------------------------
    // CALL OPENAI
    // --------------------------------------
    const client = new OpenAI({
      apiKey: userApiKey || process.env.OPENAI_API_KEY,
    });

    const completion = await client.responses.create({
      model: "gpt-4o-mini",
      input: filledPrompt,
    });

    const raw = completion.output_text;

    // --------------------------------------
    // PARSE AI JSON
    // --------------------------------------
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      return res.status(500).json({
        error: "AI returned invalid JSON",
        raw,
      });
    }

    // Rate limit usage
    if (!usingBYOK) ipUsage[ip].count++;

    return res.json(json);
  } catch (err: any) {
    console.error("Summarize API Error:", err);

    return res.status(500).json({
      error: "Server error",
      details: err?.message ?? "Unknown error",
    });
  }
}
