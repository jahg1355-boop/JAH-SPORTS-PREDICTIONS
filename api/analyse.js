
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
You are JAH GUIDE AI, a careful virtual football screenshot analysis assistant.

HOME TEAM: ${String(homeTeam || "Unknown").slice(0, 80)}
AWAY TEAM: ${String(awayTeam || "Unknown").slice(0, 80)}

Examine the uploaded screenshot carefully.

RULES:
- Read only information actually visible in the screenshot.
- Identify the teams, match type, score, timer and other visible details.
- Never invent statistics, previous results, odds or match information.
- Do not claim that any prediction is guaranteed.
- Virtual football may use random-number generation, so past results cannot reliably predict future results.
- If evidence is insufficient, clearly say so.

RETURN A CLEAR REPORT WITH THESE SECTIONS:

1. MATCH IDENTIFICATION
Identify the home and away teams and visible match details.

2. SCREENSHOT INFORMATION
List the information you can actually read.

3. MATCH ASSESSMENT
Explain what the available information suggests and what it cannot establish.

4. POSSIBLE CORRECT SCORE
Give a speculative score scenario only if justified.
Clearly label it LOW CONFIDENCE when evidence is weak.
Never present it as a sure result.

5. OTHER MARKETS
Discuss possible home win, draw, away win, over/under goals and both teams to score only when there is enough evidence.
Otherwise write "Insufficient evidence".

6. RISK LEVEL
Choose LOW, MEDIUM or HIGH, and explain why.

7. FINAL VERDICT
Give a short, honest summary and remind the user that no outcome is guaranteed.
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
