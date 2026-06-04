export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  const { message, tone } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Missing message" });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You write short, professional business replies (3–6 sentences). Never invent facts."
        },
        {
          role: "user",
          content: `Tone: ${tone}\n\nMessage:\n${message}`
        }
      ]
    })
  });

  const data = await response.json();

  const reply = data?.choices?.[0]?.message?.content || "No response";

  res.status(200).json({ reply });
}