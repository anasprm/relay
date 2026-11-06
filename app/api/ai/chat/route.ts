import { NextResponse } from "next/server";

/**
 * Smart mock AI responder for Relay Messenger Pro.
 * Analyzes user prompt context and returns intelligent, helpful responses
 * just like a modern assistant (Meta AI style).
 */
function generateSmartResponse(input: string): string {
  const lower = input.toLowerCase().trim();

  // Greetings
  if (lower.match(/^(hi|hello|hey|good morning|good afternoon|good evening|greetings)(\s|$|!|\.|,)/i)) {
    const greetings = [
      "Hello! 👋 I'm Relay AI, your intelligent workspace assistant. How can I help you today?",
      "Hi there! Ready to tackle some work or just chat? I'm here to help.",
      "Greetings! What's on your mind? I can help with summaries, coding, explanations, or just casual conversation.",
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  // Jokes / comedy
  if (lower.match(/\b(joke|funny|comedy|laugh|humor)\b/i)) {
    const jokes = [
      "Why do developers prefer dark mode? Because light attracts bugs! 🐛",
      "Why did the React component go to therapy? It had too many state issues. ⚛️",
      "Why did the JavaScript developer break up with their partner? Too many undefined behaviors.",
      "A SQL query walks into a bar, walks up to two tables, and asks: 'Can I join you?' 🍺",
      "Why do programmers always mix up Halloween and Christmas? Because Oct 31 == Dec 25! 🎃🎄",
      "Why did the dev quit his job? Because he didn't get arrays (a raise)! 💰",
    ];
    return jokes[Math.floor(Math.random() * jokes.length)];
  }

  // Coding / programming help
  if (lower.match(/\b(code|coding|program|javascript|typescript|react|node|html|css|python|bug|debug|function|component|api|endpoint|deploy|github|git)\b/i)) {
    const codingResponses = [
      "I'd be happy to help with code! Could you share what you're working on? I can help debug, refactor, or explain concepts.",
      "Sure thing! Paste your code snippet and tell me what you're trying to achieve. I'll help you optimize or fix it.",
      "Code assistance is my specialty! Whether it's React components, TypeScript types, or API design, just drop the code and let's go.",
      "I can help with that! Are you dealing with a specific error message, or do you need help architecting something new?",
    ];
    return codingResponses[Math.floor(Math.random() * codingResponses.length)];
  }

  // Relay / workspace questions
  if (lower.match(/\b(relay|messenger|workspace|glassmorphic|spatial|glassmorphism)\b/i)) {
    return "Relay Messenger Pro is a secure, real-time spatial glassmorphic workspace messaging app. It features direct threads, voice/video notes, secure calls, file attachments, 24-hour stories, AI-powered conversation briefs, and IndexedDB offline-first caching. Built with Next.js 16, Tailwind CSS 4, and Socket.io for sub-100ms message delivery. How can I help you with it?";
  }

  // Help / capabilities
  if (lower.match(/\b(help|assist|what can you do|capabilities|features)\b/i)) {
    return "I can help you with:\n• Summarizing long conversations and extracting action items\n• Writing and debugging code in JavaScript, TypeScript, React, and more\n• Answering general knowledge questions\n• Telling jokes and having casual conversation\n• Explaining Relay Messenger Pro features\n\nJust type your question and I'll respond! 💬";
  }

  // Thank you
  if (lower.match(/\b(thank|thanks|ty)\b/i)) {
    const thanks = [
      "You're welcome! Happy to help anytime. 🙌",
      "No problem at all! Let me know if you need anything else.",
      "Glad I could help! What's next on your agenda?",
    ];
    return thanks[Math.floor(Math.random() * thanks.length)];
  }

  // Goodbye
  if (lower.match(/\b(bye|goodbye|see you|farewell|take care)\b/i)) {
    const goodbyes = [
      "Goodbye! I'll be here whenever you need me. Take care! 👋",
      "Catch you later! Have a productive day. 🚀",
      "Bye for now! Don't hesitate to reach out if you need anything.",
    ];
    return goodbyes[Math.floor(Math.random() * goodbyes.length)];
  }

  // Weather
  if (lower.match(/\b(weather|temperature|rain|snow|sunny|cloudy)\b/i)) {
    return "I don't have access to live weather data, but I hope it's beautiful wherever you are! ☀️ Is there something else I can help you with?";
  }

  // Explain / definition
  if (lower.match(/\b(what is|define|explain|meaning of|who is)\b/i)) {
    return "I'd be happy to explain! Could you tell me specifically what you'd like me to define or explain? Whether it's a technical concept, a Relay feature, or general knowledge, I'll do my best to give you a clear, helpful answer.";
  }

  // Default intelligent fallback
  const defaults = [
    "That's an interesting question! Could you give me a bit more context so I can give you the best answer?",
    "I'm not entirely sure about that, but I'd love to help you figure it out. Could you elaborate?",
    "Good question! While I don't have a specific answer ready, I'd be happy to explore this topic with you. What aspect interests you most?",
    "I appreciate you asking! Let me think about that... In the meantime, is there anything else I can help you with?",
    "That's a great topic! I don't have detailed information on that right now, but I'm always here to chat and help however I can.",
  ];
  return defaults[Math.floor(Math.random() * defaults.length)];
}

export async function POST(request: Request) {
  try {
    const { message, conversationId } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Simulate AI thinking delay
    await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 400));

    const response = generateSmartResponse(message);

    return NextResponse.json({
      response,
      conversationId: conversationId || null,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "AI chat failed" }, { status: 500 });
  }
}
