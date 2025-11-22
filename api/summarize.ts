import type { VercelRequest, VercelResponse } from "@vercel/node";
import dotenv from "dotenv";
import OpenAI from "openai";

import { YOUTUBE_ANALYZER_PROMPT } from "./prompts/youtubeAnalyzerPrompt";
import { validateYouTubeUrl } from "./utils/validateYouTubeUrl";

dotenv.config();

// --------------------------------------
// RATE LIMIT (for free-tier usage)
// --------------------------------------
const RATE_LIMIT = 5;
const ipUsage: Record<string, { count: number; lastReset: number }> = {};

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
    // Log detailed error for debugging
    console.error("Transcript fetch failed:", text);
    throw new Error("Unable to fetch transcript for this video. Please try again or use a different video.");
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
    throw new Error("Transcript was empty");
  }

  return mergedTranscript;
}


// --------------------------------------
// Fetch title and thumbnail using YouTube oEmbed
// --------------------------------------
async function fetchTitleAndThumbnail(videoId: string): Promise<{ title: string; thumbnail: string }> {
  try {
    const resp = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );

    if (!resp.ok) return { title: "Untitled Video", thumbnail: "" };

    const json = await resp.json();
    const thumbnail = json.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    return {
      title: json.title || "Untitled Video",
      thumbnail,
    };
  } catch {
    return {
      title: "Untitled Video",
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    };
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

    // STRICT URL VALIDATION
    const validation = validateYouTubeUrl(youtubeUrl);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }

    const videoId = validation.videoId!;

    // --------------------------------------
    // TITLE AND THUMBNAIL
    // --------------------------------------
    const { title, thumbnail } = await fetchTitleAndThumbnail(videoId);

    // --------------------------------------
    // TRANSCRIPT (Supadata)
    // --------------------------------------
    let transcript: string;
    try {
      transcript = await fetchTranscriptSupadata(videoId);
    } catch (err: any) {
      console.error("Transcript fetch error:", err);
      return res.status(500).json({
        error: "Unable to process this video",
        message: "We couldn't retrieve the transcript for this video. This might be due to:\n• The video doesn't have captions or transcripts available\n• The video is restricted or private\n• Temporary service issues\n\nPlease try another video.",
      });
    }

    // --------------------------------------
    // Build Final Prompt
    // --------------------------------------
    const filledPrompt = YOUTUBE_ANALYZER_PROMPT
      .replace("{{TITLE}}", title)
      .replace("{{TRANSCRIPT}}", transcript);

    // Attach metadata to result
    const metadata = {
      videoId,
      title,
      thumbnail,
    };

    // --------------------------------------
    // CALL OPENAI
    // --------------------------------------
    const client = new OpenAI({
      apiKey: userApiKey || process.env.OPENAI_API_KEY,
    });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: filledPrompt,
        },
      ],
      temperature: 0.3,
    });

    const raw = completion.choices[0]?.message?.content || "";

    // --------------------------------------
    // PARSE AI JSON
    // --------------------------------------
    let json: any;
    try {
      json = JSON.parse(raw);
    } catch {
      return res.status(500).json({
        error: "AI returned invalid JSON",
        raw,
      });
    }

    // --------------------------------------
    // NORMALIZE/VALIDATE `debate` OBJECT (ensure required shape and defaults)
    // --------------------------------------
    function ensureString(v: any, fallback = "insufficient data") {
      if (typeof v === "string" && v.trim().length) return v;
      return fallback;
    }

    function ensureNumber(v: any) {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      // If parseable string, try parseInt
      if (typeof v === "string") {
        const n = parseInt(v, 10);
        if (!isNaN(n)) return n;
      }
      return 0;
    }

    function normalizeArgument(a: any, forSide = true) {
      if (!a || typeof a !== "object") return forSide
        ? { argument: "insufficient data", evidence: "", strength: "low" }
        : { counterpoint: "insufficient data", evidence: "", strength: "low" };

      if (forSide) {
        return {
          argument: ensureString(a.argument, "insufficient data"),
          evidence: ensureString(a.evidence, ""),
          strength: ensureString(a.strength, "low"),
        };
      }

      return {
        counterpoint: ensureString(a.counterpoint, "insufficient data"),
        evidence: ensureString(a.evidence, ""),
        strength: ensureString(a.strength, "low"),
      };
    }

    try {
      const d = json?.debate || {};

      const debate = {
        central_claim: ensureString(d.central_claim, "insufficient data"),
        arguments_for: Array.isArray(d.arguments_for)
          ? d.arguments_for.map((x: any) => normalizeArgument(x, true))
          : [],
        arguments_against: Array.isArray(d.arguments_against)
          ? d.arguments_against.map((x: any) => normalizeArgument(x, false))
          : [],
        logical_fallacies: Array.isArray(d.logical_fallacies)
          ? d.logical_fallacies.map((f: any) => ({
              type: ensureString(f.type, "unspecified"),
              example: ensureString(f.example, ""),
              why_it_matters: ensureString(f.why_it_matters, ""),
            }))
          : [],
        evidence_reliability: {
          verified_facts: ensureNumber(d?.evidence_reliability?.verified_facts),
          speculation_level: ensureNumber(d?.evidence_reliability?.speculation_level),
          independent_sources: ensureNumber(d?.evidence_reliability?.independent_sources),
          video_evidence_quality: ensureNumber(d?.evidence_reliability?.video_evidence_quality),
        },
        neutral_interpretation: ensureString(d.neutral_interpretation, "insufficient data"),
        verdict: ensureString(d.verdict, "insufficient data"),
      };

      // Ensure arrays are present (even if empty)
      debate.arguments_for = debate.arguments_for || [];
      debate.arguments_against = debate.arguments_against || [];
      debate.logical_fallacies = debate.logical_fallacies || [];

      json.debate = debate;
    } catch (e) {
      // If normalization fails for any reason, ensure we still return a valid debate object
      json.debate = {
        central_claim: "insufficient data",
        arguments_for: [],
        arguments_against: [],
        logical_fallacies: [],
        evidence_reliability: {
          verified_facts: 0,
          speculation_level: 0,
          independent_sources: 0,
          video_evidence_quality: 0,
        },
        neutral_interpretation: "insufficient data",
        verdict: "insufficient data",
      };
    }

    // Rate limit usage
    if (!usingBYOK) ipUsage[ip].count++;

    // Return metadata alongside analysis
    return res.json({ ...json, metadata });
  } catch (err: any) {
    console.error("Summarize API Error:", err);

    return res.status(500).json({
      error: "Server error",
      details: err?.message ?? "Unknown error",
    });
  }
}
