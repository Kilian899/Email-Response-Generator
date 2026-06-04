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
          "You write short, professional business email replies (3–6 sentences)."
      },
      {
        role: "user",
        content: `Tone: ${tone}\n\nMessage:\n${message}`
      }
    ]
  })
});

const data = await response.json();

// IMPORTANT: debug safety
if (!response.ok) {
  return res.status(500).json({
    error: data
  });
}

const reply = data?.choices?.[0]?.message?.content;

return res.status(200).json({ reply });