function pickBase64Image(data) {
  return (
    data?.artifacts?.[0]?.base64 ||
    data?.images?.[0]?.base64 ||
    data?.output?.[0]?.base64 ||
    data?.image?.base64 ||
    data?.imageBase64 ||
    data?.b64_json ||
    data?.data?.[0]?.b64_json ||
    data?.candidates?.[0]?.content?.parts?.find((p) => p?.inlineData?.data)?.inlineData?.data ||
    null
  );
}

function pickText(data) {
  return (
    data?.text ||
    data?.message ||
    data?.detail ||
    data?.error?.message ||
    data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || "").join("").trim() ||
    ""
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const prompt = String(body.prompt || "").trim();
    const provider = String(body.provider || "gemini").toLowerCase();

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    if (provider === "stable") {
      const apiKey = process.env.NVIDIA_API_KEY;
      const model = process.env.NVIDIA_IMAGE_MODEL || "stable-diffusion-3-medium";

      if (!apiKey) {
        return res.status(500).json({
          error: "Missing NVIDIA_API_KEY environment variable."
        });
      }

      const endpoint = `https://ai.api.nvidia.com/v1/genai/stabilityai/${model}`;

      const payload = {
        prompt,
        negative_prompt: "",
        steps: 30,
        cfg_scale: 7,
        aspect_ratio: "1:1",
        seed: 0
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload)
      });

      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        const msg = pickText(data) || "Stable Diffusion request failed.";
        return res.status(response.status).json({ error: msg });
      }

      const imageBase64 = pickBase64Image(data);
      const text = pickText(data);

      if (!imageBase64) {
        return res.status(200).json({
          text: text || "No image returned.",
          raw: data
        });
      }

      return res.status(200).json({
        text,
        mimeType: "image/jpeg",
        imageBase64,
        raw: data
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image-preview";

    if (!apiKey) {
      return res.status(500).json({
        error: "Missing GEMINI_API_KEY environment variable."
      });
    }

    const payload = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        responseModalities: ["IMAGE"]
      }
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

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const msg = pickText(data) || "Gemini image request failed.";
      return res.status(response.status).json({ error: msg });
    }

    const imageBase64 =
      data?.candidates?.[0]?.content?.parts?.find((p) => p?.inlineData?.data)?.inlineData?.data ||
      null;

    const text = pickText(data);

    if (!imageBase64) {
      return res.status(200).json({
        text: text || "No image returned.",
        raw: data
      });
    }

    return res.status(200).json({
      text,
      mimeType: "image/png",
      imageBase64,
      raw: data
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Server error"
    });
  }
}
