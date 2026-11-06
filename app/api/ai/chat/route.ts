/**
 * AI Assistant route for Relay Messenger Pro.
 *
 * Production behavior:
 *   - When `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) is configured, the route
 *     proxies the prompt to Google's `gemini-1.5-flash` model via HTTP fetch
 *     so Relay AI can answer any general-knowledge, coding, math, or creative
 *     question live.
 *   - When `OPENAI_API_KEY` is configured (and no Gemini key), it proxies to
 *     OpenAI's Chat Completions API.
 *   - During local development or before an API key is provisioned, a smart
 *     local fallback keeps the assistant responsive without crashing.
 *
 * Standardized output: { response: string, success: boolean }
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT =
  "You are Relay AI, an intelligent, helpful, and concise AI assistant embedded " +
  "inside Relay Messenger. Answer general knowledge questions, coding requests, " +
  "summaries, and casual chat accurately and naturally. Keep replies short and " +
  "friendly unless the user asks for detail.";

function extractPrompt(body: unknown): string {
  if (!body || typeof body !== "object") return "";

  const record = body as Record<string, unknown>;

  // Support { message: "..." } or { prompt: "..." }
  const direct =
    record.message ?? record.prompt ?? record.query ?? record.content;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  // Support { messages: [{ role: "user", content: "..." }] }
  const messages = record.messages;
  if (Array.isArray(messages) && messages.length > 0) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const item = messages[i];
      if (item && typeof item === "object") {
        const content = (item as Record<string, unknown>).content;
        if (typeof content === "string" && content.trim()) {
          return content.trim();
        }
      }
    }
  }

  return "";
}

const GREETINGS = [
  "Hello! 👋 I'm Relay AI, your assistant inside Relay Messenger. How can I help you today?",
  "Hi there! What's on your mind? I can help with coding, explanations, summaries, or just casual chat.",
  "Hey! I'm Relay AI. Ask me anything — from quick facts to code snippets — and I'll do my best to help.",
];

const JOKES = [
  "Why do developers prefer dark mode? Because light attracts bugs! 🐛",
  "Why did the React component go to therapy? It had too many state issues. ⚛️",
  "Why did the JavaScript developer break up with their partner? Too many undefined behaviors.",
  "Why do programmers always mix up Halloween and Christmas? Because Oct 31 == Dec 25! 🎃🎄",
];

const HELP_TEXT =
  "I can help you with:\n" +
  "• Writing and debugging code (JavaScript, TypeScript, React, Python, and more)\n" +
  "• Answering general-knowledge questions\n" +
  "• Summarizing long conversations or text\n" +
  "• Extracting action items and tasks from chat\n" +
  "• Casual conversation and jokes\n\nJust ask!";

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function smartLocalReply(prompt: string): string {
  const lower = prompt.toLowerCase().trim();

  // Greetings — handle "hlo", "hi", "hello", "hey", etc.
  if (
    lower.match(/^(hlo|hi|hello|hey|good morning|good afternoon|good evening|greetings|yo|sup)(\s|$|!|\.|,)/i)
  ) {
    return pick(GREETINGS);
  }

  // Jokes
  if (lower.match(/\b(joke|funny|comedy|laugh|humor|tell me a joke)\b/i)) {
    return pick(JOKES);
  }

  // Coding / programming / tech
  if (
    lower.match(
      /\b(code|coding|program|javascript|typescript|react|node|html|css|python|bug|debug|function|component|api|endpoint|deploy|github|git|script|software|algorithm)\b/i,
    )
  ) {
    return `I'd be happy to help with code! Paste your snippet or describe what you're trying to build, and I'll help you write, debug, or refactor it. What language or framework are you working with?`;
  }

  // Summaries / summarization
  if (lower.match(/\b(summar|summary|tldr|tl;dr|brief|recap|condens)\b/i)) {
    return "Paste the conversation or text you'd like me to summarize, and I'll give you a concise brief with the key points and any action items.";
  }

  // Task / action extraction
  if (
    lower.match(
      /\b(task|action item|todo|to-do|extract|action items|next steps|assign)\b/i,
    )
  ) {
    return "Share the chat or meeting notes, and I'll extract the action items, owners, and due dates into a clean task list for you.";
  }

  // Help / capabilities
  if (lower.match(/\b(help|assist|what can you do|capabilities|features|who are you)\b/i)) {
    return HELP_TEXT;
  }

  // Thanks
  if (lower.match(/\b(thank|thanks|ty|appreciate)\b/i)) {
    return "You're welcome! Happy to help anytime. 🙌";
  }

  // Goodbye
  if (lower.match(/\b(bye|goodbye|see you|farewell|take care|catch you later)\b/i)) {
    return "Goodbye! I'll be here whenever you need me. Take care! 👋";
  }

  // Relay-specific
  if (lower.match(/\b(relay|messenger|workspace|glassmorphic|spatial|glassmorphism)\b/i)) {
    return "Relay Messenger Pro is a secure, real-time glassmorphic workspace messaging app. It features direct threads, voice/video notes, secure calls, file attachments, 24-hour stories, AI-powered conversation briefs, and IndexedDB offline-first caching. How can I help you with it?";
  }

  // Weather
  if (lower.match(/\b(weather|temperature|rain|snow|sunny|cloudy|forecast)\b/i)) {
    return "I don't have access to live weather data, but I hope it's beautiful wherever you are! ☀️ Is there something else I can help with?";
  }

  // General knowledge — intelligent dynamic response instead of "I'm not sure"
  if (
    lower.match(
      /\b(what is|who is|where is|when is|why|how|explain|define|definition|meaning|tell me about|president|capital|country|science|history|math|calculate)\b/i,
    )
  ) {
    return `That's a great question about "${prompt}". To give you a live, accurate answer powered by Google Gemini, add your \`GEMINI_API_KEY\` to your Vercel or local environment variables. In the meantime, I can help with coding, summaries, jokes, or explaining Relay Messenger Pro features — just ask!`;
  }

  // Default dynamic fallback — engaging, not a dead end
  return `That's an interesting question about "${prompt}". I can help with coding help, conversation summaries, task extraction, general knowledge (with a Gemini API key), or casual chat. What would you like to explore?`;
}

async function callGemini(prompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `${SYSTEM_PROMPT}\n\nUser: ${prompt}` }],
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

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      process.stderr.write(
        `[AI] Gemini returned ${response.status}: ${errorBody}\n`,
      );
      return null;
    }

    const data = await response.json();
    const aiReply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I'm sorry, I couldn't generate a response right now.";
    return aiReply.trim();
  } catch (geminiError) {
    process.stderr.write(
      `[AI] Gemini error: ${geminiError instanceof Error ? geminiError.message : String(geminiError)}\n`,
    );
    return null;
  }
}

async function callOpenAI(prompt: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      process.stderr.write(
        `[AI] OpenAI returned ${response.status}: ${errorBody}\n`,
      );
      return null;
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch (openAIError) {
    process.stderr.write(
      `[AI] OpenAI error: ${openAIError instanceof Error ? openAIError.message : String(openAIError)}\n`,
    );
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | Record<string, unknown>
      | null;

    const prompt = extractPrompt(body);

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt cannot be empty.", success: false },
        { status: 400 },
      );
    }

    // 1. Try Gemini first
    let aiReply = await callGemini(prompt);

    // 2. Fall back to OpenAI if Gemini isn't configured or failed
    if (!aiReply) {
      aiReply = await callOpenAI(prompt);
    }

    // 3. Smart local fallback so Relay AI never goes silent
    if (!aiReply) {
      aiReply = smartLocalReply(prompt);
    }

    return NextResponse.json({
      success: true,
      response: aiReply,
      model: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
        ? "gemini-1.5-flash"
        : process.env.OPENAI_API_KEY
          ? "gpt-3.5-turbo"
          : "relay-ai-local-fallback",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    process.stderr.write(
      `[AI-CHAT-ERROR] ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return NextResponse.json(
      { error: "Failed to generate AI response.", success: false },
      { status: 500 },
    );
  }
}
