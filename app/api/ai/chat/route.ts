/**
 * AI Assistant route for Relay Messenger Pro.
 *
 * Production behavior:
 *   - When a Google Gemini key is configured (`GEMINI_API_KEY`,
 *     `GOOGLE_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, ...), the route proxies
 *     the prompt to Gemini and returns a real, live answer. Model names are
 *     tried newest-first because Google retires older model IDs; `GEMINI_MODEL`
 *     can pin an explicit model.
 *   - When `OPENAI_API_KEY` is configured (and Gemini is unavailable), it
 *     proxies to OpenAI's Chat Completions API.
 *   - Without any usable key (or if every provider call fails) a smart local
 *     fallback keeps the assistant responsive instead of erroring out.
 *
 * Diagnostics: `GET /api/ai/chat` reports whether a key is visible to the
 * running deployment (never the secret itself). `GET /api/ai/chat?test=1`
 * additionally performs a live round-trip so model/permission failures are
 * returned as plain JSON instead of being hidden behind the fallback.
 *
 * Standardized output: { response: string, success: boolean, model: string }
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT =
  "You are Relay AI, an intelligent, helpful, and concise AI assistant embedded " +
  "inside Relay Messenger. Answer general knowledge questions, coding requests, " +
  "summaries, and casual chat accurately and naturally. Keep replies short and " +
  "friendly unless the user asks for detail.";

/** Environment variable names that can hold a Gemini key, in priority order. */
const GEMINI_KEY_NAMES = [
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GOOGLE_AI_API_KEY",
  "NEXT_PUBLIC_GEMINI_API_KEY",
];

/**
 * Model IDs tried in order. Google retires old models without notice (1.5, 2.0
 * and 2.5 Flash are all gone for new keys), so we walk a list instead of
 * hardcoding a single ID, and fall back to live model discovery if none work.
 */
const GEMINI_MODELS = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : [
      "gemini-3.8-flash",
      "gemini-flash-latest",
      "gemini-3-flash",
      "gemini-3-flash-preview",
    ];

/**
 * Ask the Gemini API which models this key can actually use, and return the
 * Flash-family ones that support generateContent. Used only when the preferred
 * list goes stale, so a future rename self-heals instead of silently falling
 * back to canned replies.
 */
async function discoverGeminiModels(key: string): Promise<string[]> {
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200",
      {
        headers: { "x-goog-api-key": key },
        cache: "no-store",
      },
    );
    if (!response.ok) return [];

    const data = (await response.json()) as {
      models?: Array<{
        name?: string;
        supportedGenerationMethods?: string[];
      }>;
    };

    const usable = (data.models ?? [])
      .filter((model) =>
        (model.supportedGenerationMethods ?? []).includes("generateContent"),
      )
      .map((model) => (model.name ?? "").replace(/^models\//, ""))
      .filter((name) => name.includes("flash"))
      // Newest version first: gemini-3.8-flash before gemini-2.5-flash.
      .sort((a, b) => {
        const version = (id: string) => {
          const match = id.match(/(\d+)(?:\.(\d+))?/);
          if (!match) return 0;
          return Number(match[1]) * 1000 + Number(match[2] ?? 0);
        };
        return version(b) - version(a);
      });

    return usable.slice(0, 4);
  } catch (error) {
    process.stderr.write(
      `[AI] Model discovery failed: ${
        error instanceof Error ? error.message : String(error)
      }\n`,
    );
    return [];
  }
}

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

function isPlaceholderKey(key: string | undefined): boolean {
  if (!key) return true;
  const lower = key.toLowerCase().trim();
  return (
    lower === "your_key_here" ||
    lower === "your-api-key" ||
    lower === "your_key" ||
    lower === "add_your_key_here" ||
    lower === "sk-" ||
    lower.length < 12 ||
    (lower.startsWith("your_") && lower.endsWith("_key")) ||
    (lower.startsWith("your_") && lower.endsWith("_here")) ||
    lower.includes("placeholder") ||
    lower.includes("<") ||
    lower.includes("...")
  );
}

/**
 * Read and sanitize a key from the environment.
 * Handles copy/paste damage: surrounding quotes, whitespace, "Bearer " prefixes.
 */
function sanitizeKey(raw: string | undefined): string | null {
  if (typeof raw !== "string") return null;
  let value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith("`") && value.endsWith("`"))
  ) {
    value = value.slice(1, -1).trim();
  }
  if (value.toLowerCase().startsWith("bearer ")) {
    value = value.slice(7).trim();
  }
  if (isPlaceholderKey(value)) return null;
  return value;
}

type KeyInfo = {
  key: string;
  source: string;
  length: number;
  prefix: string;
  suffix: string;
};

function resolveGeminiKey(): KeyInfo | null {
  for (const name of GEMINI_KEY_NAMES) {
    const key = sanitizeKey(process.env[name]);
    if (key) {
      return {
        key,
        source: name,
        length: key.length,
        prefix: key.slice(0, 4),
        suffix: key.slice(-2),
      };
    }
  }
  return null;
}

function resolveOpenAIKey(): { key: string; source: string } | null {
  const key = sanitizeKey(process.env.OPENAI_API_KEY);
  return key ? { key, source: "OPENAI_API_KEY" } : null;
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function smartLocalReply(prompt: string): string {
  const lower = prompt.toLowerCase().trim();

  // Greetings — handle "hlo", "hi", "hello", "hey", etc.
  if (
    lower.match(
      /^(hlo|hlw|hi|hii+|hello|helo|hey+|good morning|good afternoon|good evening|greetings|yo|sup)(\s|$|!|\.|,)/i,
    )
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
  if (
    lower.match(/\b(help|assist|what can you do|capabilities|features|who are you)\b/i)
  ) {
    return HELP_TEXT;
  }

  // Thanks
  if (lower.match(/\b(thank|thanks|ty|appreciate)\b/i)) {
    return "You're welcome! Happy to help anytime. 🙌";
  }

  // Goodbye
  if (
    lower.match(/\b(bye|goodbye|see you|farewell|take care|catch you later)\b/i)
  ) {
    return "Goodbye! I'll be here whenever you need me. Take care! 👋";
  }

  // Relay-specific
  if (
    lower.match(
      /\b(relay|messenger|workspace|glassmorphic|spatial|glassmorphism)\b/i,
    )
  ) {
    return "Relay Messenger Pro is a secure, real-time glassmorphic workspace messaging app. It features direct threads, voice/video notes, secure calls, file attachments, 24-hour stories, AI-powered conversation briefs, and IndexedDB offline-first caching. How can I help you with it?";
  }

  // Weather
  if (
    lower.match(/\b(weather|temperature|rain|snow|sunny|cloudy|forecast)\b/i)
  ) {
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

type GeminiResult =
  | { ok: true; text: string; model: string }
  | { ok: false; error: string; attempts: Array<{ model: string; status: number; error: string }> };

async function callGemini(prompt: string): Promise<GeminiResult> {
  const keyInfo = resolveGeminiKey();
  if (!keyInfo) {
    return {
      ok: false,
      error:
        "No Gemini API key is visible to this deployment. Check Vercel → Settings → Environment Variables and redeploy.",
      attempts: [],
    };
  }

  const attempts: Array<{ model: string; status: number; error: string }> = [];
  let lastError = "Gemini request failed.";
  let keyIsInvalid = false;

  const attemptModel = async (model: string) => {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": keyInfo.key,
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: SYSTEM_PROMPT }],
            },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 1024,
            },
          }),
          cache: "no-store",
        },
      );

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        const shortError = errorBody.slice(0, 300);
        attempts.push({ model, status: response.status, error: shortError });
        lastError = `Gemini ${model} returned ${response.status}`;
        if (/API_KEY_INVALID|API key not valid/i.test(errorBody)) {
          keyIsInvalid = true;
        }
        process.stderr.write(
          `[AI] Gemini ${model} (key via ${keyInfo.source}) returned ${response.status}: ${shortError}\n`,
        );
        return null;
      }

      const data = await response.json();
      const text: string =
        data?.candidates?.[0]?.content?.parts
          ?.map((part: { text?: string }) => part?.text ?? "")
          .join("")
          .trim() || "";

      if (!text) {
        attempts.push({ model, status: 200, error: "Empty candidate text" });
        return null;
      }

      return { ok: true as const, text, model };
    } catch (geminiError) {
      const message =
        geminiError instanceof Error ? geminiError.message : String(geminiError);
      attempts.push({ model, status: 0, error: message });
      lastError = message;
      process.stderr.write(`[AI] Gemini ${model} transport error: ${message}\n`);
      return null;
    }
  };

  for (const model of GEMINI_MODELS) {
    const result = await attemptModel(model);
    if (result) return result;
    if (keyIsInvalid) return { ok: false, error: lastError, attempts };
  }

  // Every preferred ID is gone (Google retires models often) — ask the API
  // which ones exist for this key and retry with those.
  if (!keyIsInvalid) {
    const discovered = await discoverGeminiModels(keyInfo.key);
    const untried = discovered.filter((model) => !GEMINI_MODELS.includes(model));
    process.stderr.write(
      `[AI] Falling back to discovered models: ${untried.join(", ") || "none"}\n`,
    );

    for (const model of untried) {
      const result = await attemptModel(model);
      if (result) return result;
      if (keyIsInvalid) break;
    }
  }

  return { ok: false, error: lastError, attempts };
}

async function callOpenAI(
  prompt: string,
): Promise<{ ok: true; text: string; model: string } | { ok: false; error: string }> {
  const keyInfo = resolveOpenAIKey();
  if (!keyInfo) {
    return { ok: false, error: "No OpenAI API key configured." };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${keyInfo.key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
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
        `[AI] OpenAI returned ${response.status}: ${errorBody.slice(0, 300)}\n`,
      );
      return { ok: false, error: `OpenAI returned ${response.status}` };
    }

    const data = await response.json();
    const text: string = data?.choices?.[0]?.message?.content?.trim() || "";
    if (!text) return { ok: false, error: "OpenAI returned an empty message." };
    return { ok: true, text, model: "gpt-4o-mini" };
  } catch (openAIError) {
    const message =
      openAIError instanceof Error ? openAIError.message : String(openAIError);
    process.stderr.write(`[AI] OpenAI error: ${message}\n`);
    return { ok: false, error: message };
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

    const gemini = await callGemini(prompt);
    if (gemini.ok) {
      return NextResponse.json({
        success: true,
        response: gemini.text,
        model: gemini.model,
        provider: "google-gemini",
        timestamp: new Date().toISOString(),
      });
    }

    const openai = await callOpenAI(prompt);
    if (openai.ok) {
      return NextResponse.json({
        success: true,
        response: openai.text,
        model: openai.model,
        provider: "openai",
        timestamp: new Date().toISOString(),
      });
    }

    // Never go silent: local fallback always produces something useful.
    return NextResponse.json({
      success: true,
      response: smartLocalReply(prompt),
      model: "relay-ai-local-fallback",
      provider: "local",
      fallbackReason: gemini.error,
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

/**
 * Diagnostics endpoint.
 *   GET /api/ai/chat          → is a key visible to this deployment?
 *   GET /api/ai/chat?test=1   → live-call every candidate model and report
 *                               the real HTTP status/error per model.
 *
 * Secrets are never returned — only length, 4-char prefix and 2-char suffix.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const liveTest = url.searchParams.get("test") === "1";

  const keyInfo = resolveGeminiKey();
  const openaiInfo = resolveOpenAIKey();

  const envPresence = GEMINI_KEY_NAMES.reduce<Record<string, string>>(
    (acc, name) => {
      const raw = process.env[name];
      acc[name] = raw ? `present (${raw.length} chars)` : "missing";
      return acc;
    },
    {},
  );

  const diagnostics: Record<string, unknown> = {
    success: true,
    runtime: process.version,
    vercelEnv: process.env.VERCEL_ENV ?? "local",
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    gemini: {
      configured: Boolean(keyInfo),
      keySource: keyInfo?.source ?? null,
      keyLength: keyInfo?.length ?? 0,
      keyPrefix: keyInfo?.prefix ?? null,
      keySuffix: keyInfo?.suffix ?? null,
      models: GEMINI_MODELS,
    },
    openai: {
      configured: Boolean(openaiInfo),
      keySource: openaiInfo?.source ?? null,
    },
    envPresence,
  };

  if (liveTest) {
    const gemini = await callGemini("Reply with exactly: Relay is online.");
    diagnostics.liveTest = gemini.ok
      ? { ok: true, model: gemini.model, reply: gemini.text }
      : { ok: false, error: gemini.error, attempts: gemini.attempts };
  }

  return NextResponse.json(diagnostics, {
    headers: { "Cache-Control": "no-store" },
  });
}
