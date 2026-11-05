"use client";
import { useState, useEffect } from "react";

export function useSentimentTheme(messageText: string) {
  const [sentiment, setSentiment] = useState<"neutral" | "urgent" | "joy">("neutral");

  useEffect(() => {
    if (!messageText) return;
    const lower = messageText.toLowerCase();
    if (lower.includes("urgent") || lower.includes("asap") || lower.includes("alert")) {
      setSentiment("urgent");
    } else if (lower.includes("!") || lower.includes("great") || lower.includes("awesome")) {
      setSentiment("joy");
    } else {
      setSentiment("neutral");
    }
  }, [messageText]);

  return sentiment;
}
