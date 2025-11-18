/**
 * Unit tests for YouTube URL validation
 * Run with: npx ts-node api/utils/validateYouTubeUrl.test.ts
 */

import { validateYouTubeUrl } from "./validateYouTubeUrl";

const testCases = [
  // VALID cases
  {
    input: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    expected: { valid: true, videoId: "dQw4w9WgXcQ" },
    desc: "Standard YouTube watch URL",
  },
  {
    input: "https://youtu.be/dQw4w9WgXcQ",
    expected: { valid: true, videoId: "dQw4w9WgXcQ" },
    desc: "Short youtu.be link",
  },
  {
    input: "https://m.youtube.com/watch?v=abc123DEF-_",
    expected: { valid: true, videoId: "abc123DEF-_" },
    desc: "Mobile YouTube URL",
  },
  {
    input: "https://youtube.com/watch?v=xyz_ABC1-34",
    expected: { valid: true, videoId: "xyz_ABC1-34" },
    desc: "YouTube without www",
  },
  {
    input: "  https://youtu.be/abc123DEF-_  ",
    expected: { valid: true, videoId: "abc123DEF-_" },
    desc: "URL with whitespace (should trim)",
  },

  // INVALID domain cases
  {
    input: "https://vimeo.com/123456789",
    expected: { valid: false, message: "Invalid domain. Only YouTube URLs are allowed." },
    desc: "Non-YouTube domain (Vimeo)",
  },
  {
    input: "https://evil.com/youtube.com/watch?v=abc",
    expected: { valid: false, message: "Invalid domain. Only YouTube URLs are allowed." },
    desc: "Typosquatting domain",
  },

  // INVALID URL length case
  {
    input: "https://youtube.com/watch?v=abc123DEF-_&" + "a=1&".repeat(200),
    expected: { valid: false, message: "URL too long." },
    desc: "URL exceeds 500 character limit",
  },

  // INVALID format cases
  {
    input: "not a url",
    expected: { valid: false, message: "Invalid URL format." },
    desc: "Malformed URL",
  },
  {
    input: "youtube.com/watch?v=abc",
    expected: { valid: false, message: "Invalid URL format." },
    desc: "URL without protocol",
  },

  // INVALID link type cases
  {
    input: "https://www.youtube.com/",
    expected: { valid: false, message: "Unsupported YouTube link type." },
    desc: "YouTube homepage (no video ID)",
  },
  {
    input: "https://www.youtube.com/watch?v=toolong",
    expected: { valid: false, message: "Unsupported YouTube link type." },
    desc: "Video ID too short (not 11 chars)",
  },
  {
    input: "https://www.youtube.com/watch?v=abc123DEF-_xyz",
    expected: { valid: false, message: "Unsupported YouTube link type." },
    desc: "Video ID too long (not 11 chars)",
  },
  {
    input: "https://youtu.be/abc",
    expected: { valid: false, message: "Unsupported YouTube link type." },
    desc: "youtu.be with invalid ID length",
  },
];

function runTests() {
  let passed = 0;
  let failed = 0;

  console.log("\n🧪 YouTube URL Validation Tests\n");
  console.log("━".repeat(80));

  testCases.forEach((test, idx) => {
    const result = validateYouTubeUrl(test.input);
    const isPass =
      result.valid === test.expected.valid &&
      result.videoId === test.expected.videoId &&
      result.message === test.expected.message;

    const status = isPass ? "✅ PASS" : "❌ FAIL";
    console.log(`\n[${idx + 1}] ${status} — ${test.desc}`);
    console.log(`    Input: ${test.input.substring(0, 60)}${test.input.length > 60 ? "..." : ""}`);

    if (!isPass) {
      console.log(`    Expected: ${JSON.stringify(test.expected)}`);
      console.log(`    Got:      ${JSON.stringify(result)}`);
      failed++;
    } else {
      passed++;
    }
  });

  console.log("\n" + "━".repeat(80));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests\n`);

  return failed === 0;
}

// Run tests
const allPass = runTests();
process.exit(allPass ? 0 : 1);
