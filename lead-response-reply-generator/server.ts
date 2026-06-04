import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Setup JSON body parsing
app.use(express.json());

// Simple In-Memory IP Rate Limiter to protect against high API costs
interface IPUsage {
  count: number;
  resetTime: number;
}
const ipRegistry: Record<string, IPUsage> = {};
const LIMIT_PER_DAY = 15;
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  let record = ipRegistry[ip];

  if (!record || now > record.resetTime) {
    record = {
      count: 0,
      resetTime: now + WINDOW_MS,
    };
    ipRegistry[ip] = record;
  }

  if (record.count >= LIMIT_PER_DAY) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }

  record.count += 1;
  return { allowed: true, remaining: LIMIT_PER_DAY - record.count, resetTime: record.resetTime };
}

// Lazy-initialized Google GenAI client
let aiInstance: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables. Please configure it in your Secrets panel.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiInstance;
}

// Health check route
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Reply generation endpoint with strict safety controls
app.post("/api/generate", async (req, res) => {
  try {
    const { message, tone } = req.body;
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Customer message is required." });
    }

    // Apply strict usage limits
    const clientIp = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "unknown").split(",")[0].trim();
    const limitStatus = checkRateLimit(clientIp);

    if (!limitStatus.allowed) {
      return res.status(429).json({
        error: `Daily limit reached! Free users are capped at ${LIMIT_PER_DAY} generations per day to prevent host abuse. Please try again after ${new Date(limitStatus.resetTime).toLocaleTimeString()}.`,
        remaining: 0
      });
    }

    const ai = getAIClient();
    const systemInstruction = `You are a high-precision business communication assistant designed for customer support and sales teams. Your job is to produce accurate, conversion-oriented replies that help move conversations forward while remaining truthful and non-deceptive.

Primary Objective:
Write professional customer responses that:
- resolve inquiries clearly
- maintain trust and accuracy
- gently guide the conversation toward the next step (clarification, booking, or continuation)
- do NOT fabricate any business information

Selected Tone Context: Ensure style incorporates "${tone || 'Friendly'}" qualities while maintaining extreme professional excellence.

Hard Safety Constraints (Non-negotiable):
- Never invent or assume facts (pricing, features, integrations, availability, timelines, policies, trials, links, attachments, or company actions).
- Only use information explicitly provided in the user message.
- If key details are missing, ask a focused clarification question.
- If uncertain, state uncertainty indirectly by requesting confirmation (never guess) using phrases like "Could you confirm..." instead of assuming details.
- Do NOT fabricate urgency, scarcity, or guarantees.

Conversion Principles (Allowed persuasion behavior):
- Always include a clear next step: a question, a request for clarification, or a suggestion to continue the conversation.
- Keep momentum toward resolution (avoid dead-end replies).
- Make responses easy to reply to (reduce cognitive load).
- When appropriate, frame questions to help the customer decide (without assuming facts).

Style Requirements:
- 3–6 sentences maximum
- Professional, neutral, business-appropriate tone
- Concise and direct language
- Minimal filler or repetitive politeness
- Natural human business communication (not overly formal or robotic)

Response Structure (mandatory):
1. Brief acknowledgment of the message
2. Direct answer (or clarification of missing info)
3. One clear next-step question

Behavior Rules:
- Do not mention “AI”, “model”, or system behavior.
- Do not add fictional extras (no invented demos, links, attachments, discounts, or features).
- Do not overpromise capabilities.
- If the user asks technical questions (API, integrations, etc.), respond only based on provided context and ask for required system details if missing.

Output Constraint:
Return ONLY the final customer reply. No explanations, no formatting notes, no headers.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Customer message: ${message}`,
      config: {
        systemInstruction,
        temperature: 0.1,
      },
    });

    const reply = response.text || "";
    return res.json({ reply, remaining: limitStatus.remaining });
  } catch (err: any) {
    console.error("AI Response Generation Error:", err);
    return res.status(500).json({ error: err.message || "Failed to generate reply" });
  }
});

// Vite middleware flow for full-stack asset loading
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server booted and running on http://0.0.0.0:${PORT}`);
  });
}

setupVite().catch((err) => {
  console.error("Initialization failed:", err);
});
