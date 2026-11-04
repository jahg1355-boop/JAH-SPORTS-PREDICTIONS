
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { imageDataUrl, homeTeam, awayTeam } = req.body || {};

    if (!imageDataUrl || !imageDataUrl.startsWith("data:image/")) {
      return res.status(400).json({
        error: "Please upload a valid match screenshot."
      });
    }

    if (imageDataUrl.length > 7_000_000) {
      return res.status(413).json({
        error: "Image is too large. Please use a smaller screenshot."
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "AI service is not configured."
      });
    }

    const prompt = `
Analyse this virtual football match screenshot.

Home team: ${String(homeTeam || "Unknown").slice(0, 100)}
Away team: ${String(awayTeam || "Unknown").slice(0, 100)}

Read only information visible in the screenshot.
Explain the available match information and provide a cautious,
probability-based assessment if the image contains enough evidence.

Do not invent statistics, fixtures, results or confidence percentages.
If the screenshot does not contain enough evidence, say so clearly.
Virtual football outcomes may be random and cannot be guaranteed.

Return:
1. Teams identified
2. Visible match information
3. Analysis
4. Possible outcome scenarios, if justified
5. Limitations and uncertainty
`;

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          input: [{
            role: "user",
            content: [
              {
                type: "input_text",
                text: prompt
              },
              {
                type: "input_image",
                image_url: imageDataUrl
              }
            ]
          }],
          max_output_tokens: 700
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", data);
      return res.status(502).json({
        error: "AI analysis failed. Please try again."
      });
    }

    const analysis = data.output_text;

    if (!analysis) {
      return res.status(502).json({
        error: "The AI returned no analysis."
      });
    }

    return res.status(200).json({ analysis });

  } catch (error) {
    console.error("Analysis error:", error);
    return res.status(500).json({
      error: "Something went wrong during analysis."
    });
  }
}
