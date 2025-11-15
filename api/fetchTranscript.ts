export async function fetchTranscript(videoId: string) {
  try {
    const url = `https://yt.lemnoslife.com/videos?part=transcript&id=${videoId}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Transcript API failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.items?.length || !data.items[0]?.transcript?.length) {
      return null; // No transcript available
    }

    // Lemnos returns array of captions: [{ text: "...", start: 12.4 }, ...]
    const transcriptText = data.items[0].transcript
      .map((entry: any) => entry.text)
      .join(" ");

    return transcriptText;
  } catch (err) {
    console.error("Transcript fetch error:", err);
    return null;
  }
}
