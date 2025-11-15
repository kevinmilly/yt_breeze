import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

const RATE_LIMIT = 5;
const ipUsage: Record<string, { count: number; lastReset: number }> = {};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

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

    const { transcript, title, userApiKey } = req.body;
    const usingBYOK = !!userApiKey;

    if (!usingBYOK && ipUsage[ip].count >= RATE_LIMIT) {
      return res.status(429).json({
        error: "Free-tier limit reached. Add your own API key.",
      });
    }

    if (!transcript || !title) {
      return res.status(400).json({ error: "Missing transcript or title" });
    }

    const OPENAI_KEY = userApiKey || process.env.OPENAI_API_KEY;

    if (!OPENAI_KEY) {
      return res.status(500).json({
        error: "Server missing OpenAI API key.",
      });
    }

    const client = new OpenAI({ apiKey: OPENAI_KEY });

    // ---------------------------------------
    // Build text prompt (NO response_format)
    // ---------------------------------------
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
- Do NOT include any text before or after the JSON.
- Do NOT add commentary.
- Do NOT add backticks.

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

    // ---------------------------------------
    // Extract raw text result
    // ---------------------------------------
    const raw = completion.output_text; // works in all 5.x SDK versions

    // ---------------------------------------
    // Parse JSON safely
    // ---------------------------------------
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
