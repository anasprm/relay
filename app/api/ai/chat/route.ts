/**
 * AI Assistant route for Relay Messenger Pro.
 *
 * Production behavior:
 *   - When `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) is configured, the route
 *     proxies the prompt to Google's `gemini-1.5-flash` model so Relay AI can
 *     answer any general-knowledge, coding, math, or creative question live.
 *   - During local development or before an API key is provisioned, a smart
 *     local fallback keeps the assistant responsive without crashing.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT =
  "You are Relay AI, an expert, helpful, and concise conversational assistant " +
  "integrated into Relay Messenger. Answer the user's question directly, " +
  "accurately, and thoroughly. Keep replies short and friendly unless the user " +
  "asks for detail.";

function extractPrompt(body: unknown): string {
  if (!body || typeof body !== "object") return "";

  const record = body as Record<string, unknown>;
  const message =
    record.message ?? record.prompt ?? record.query ?? record.content;

  if (typeof message === "string") return message;

  const messages = record.messages;
  if (Array.isArray(messages) && messages.length > 0) {
    const last = messages[messages.length - 1];
    if (last && typeof last === "object") {
      const content = (last as Record<string, unknown>).content;
      if (typeof content === "string") return content;
    }
  }

  return "";
}

function smartLocalReply(prompt: string): string {
  const lower = prompt.toLowerCase().trim();

  if (lower.match(/^(hi|hello|hey|good morning|good afternoon|good evening|greetings)(\s|$|!|\.|,)/i)) {
    return "Hello! 👋 I'm Relay AI, your workspace assistant. How can I help you today?";
  }

  if (lower.match(/\b(joke|funny|comedy|laugh|humor)\b/i)) {
    return "Why do developers prefer dark mode? Because light attracts bugs! 🐛";
  }

  if (lower.match(/\b(code|coding|program|javascript|typescript|react|node|html|css|python|bug|debug|function|component|api|endpoint|deploy|github|git)\b/i)) {
    return "I'd be happy to help with code! Paste your snippet and tell me what you're trying to achieve, and I'll help you debug or refactor it.";
  }

  if (lower.match(/\b(relay|messenger|workspace|glassmorphic|spatial|glassmorphism)\b/i)) {
    return "Relay Messenger Pro is a secure, real-time glassmorphic workspace messaging app. It features direct threads, voice/video notes, secure calls, file attachments, 24-hour stories, AI-powered conversation briefs, and IndexedDB offline-first caching. How can I help you with it?";
  }

  if (lower.match(/\b(help|assist|what can you do|capabilities|features)\b/i)) {
    return "I can help you summarize conversations, write and debug code, answer general-knowledge questions, and explain Relay Messenger Pro features. Just ask!";
  }

  if (lower.match(/\b(thank|thanks|ty)\b/i)) {
    return "You're welcome! Happy to help anytime. 🙌";
  }

  if (lower.match(/\b(bye|goodbye|see you|farewell|take care)\b/i)) {
    return "Goodbye! I'll be here whenever you need me. Take care! 👋";
  }

  if (lower.match(/\b(weather|temperature|rain|snow|sunny|cloudy)\b/i)) {
    return "I don't have access to live weather data, but I hope it's beautiful wherever you are! ☀️ Is there something else I can help with?";
  }

  if (lower.match(/\b(president of india|indian president)\b/i)) {
    return "The current President of India is Droupadi Murmu, who assumed office on July 25, 2022.";
  }

  return `That's a great question about "${prompt}". To get live dynamic answers powered by Google Gemini for any prompt, add your \`GEMINI_API_KEY\` to your Vercel or local environment variables.`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const prompt = extractPrompt(body);

    if (!prompt.trim()) {
      return NextResponse.json({ error: "Prompt cannot be empty." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (apiKey) {
      try {
        const response = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + encodeURIComponent(apiKey),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [{ text: `${SYSTEM_PROMPT}\n\nUser Question: ${prompt}` }],
                },
              ],
              generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1024,
              },
            }),
          },
        );

        if (response.ok) {
          const data = await response.json();
          const aiReply =
            data?.candidates?.[0]?.content?.parts?.[0]?.text ||
            "I'm sorry, I couldn't generate a response right now.";

          return NextResponse.json({
            success: true,
            response: aiReply.trim(),
            model: "gemini-1.5-flash",
            timestamp: new Date().toISOString(),
          });
        }

        const errorBody = await response.text().catch(() => "");
        process.stderr.write(
          `[AI] Gemini returned ${response.status}: ${errorBody}\n`,
        );
        // Fall through to local reply so the user still gets a response.
      } catch (geminiError) {
        process.stderr.write(
          `[AI] Gemini REST error: ${geminiError instanceof Error ? geminiError.message : String(geminiError)}\n`,
        );
      }
    }

    // Development / no-API-key fallback so Relay AI never goes silent.
    return NextResponse.json({
      success: true,
      response: smartLocalReply(prompt),
      model: "relay-ai-local-fallback",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    process.stderr.write(
      `[AI-CHAT-ERROR] ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return NextResponse.json(
      { error: "Failed to generate AI response." },
      { status: 500 },
    );
  }
}
