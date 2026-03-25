export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || "gemini-3-flash-preview";

    if (!apiKey) {
      return res.status(500).json({
        error: "Missing GEMINI_API_KEY environment variable."
      });
    }

    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const systemPrompt = String(body.systemPrompt || "").trim() || "You are Rishi AI, a helpful assistant.";

    const contents = messages
      .filter((m) => m && (m.role === "user" || m.role === "assistant"))
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: String(m.content ?? "") }]
      }));

    const payload = {
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const msg = data?.error?.message || "Gemini API request failed.";
      return res.status(response.status).json({ error: msg });
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((part) => part?.text || "").join("").trim();

    return res.status(200).json({
      text: text || "No response returned.",
      raw: data
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Server error"
    });
  }
}
