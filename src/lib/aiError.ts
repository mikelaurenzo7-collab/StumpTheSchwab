// Map raw API errors to user-friendly title + hint pairs. Used by every AI
// panel so users know what to do when something goes wrong.

export interface FriendlyError {
  title: string;
  hint: string;
}

const SIGNATURES: Array<{ test: RegExp; result: FriendlyError }> = [
  {
    test: /\b401\b|invalid_request_error.*api[_ ]?key|ANTHROPIC_API_KEY/i,
    result: {
      title: "API key issue",
      hint: "Check that ANTHROPIC_API_KEY is set in .env.local and restart the dev server.",
    },
  },
  {
    test: /\b429\b|rate.?limit/i,
    result: {
      title: "Rate limited",
      hint: "Wait 30 seconds and try again, or switch to a less busy model.",
    },
  },
  {
    test: /\b503\b/i,
    result: {
      title: "Service unavailable",
      hint: "Anthropic returned 503. Try again in a moment.",
    },
  },
  {
    test: /\b502\b|timeout|timed[_ ]?out|aborted|fetch failed|Failed to fetch|NetworkError/i,
    result: {
      title: "Couldn't reach Claude",
      hint: "Check your internet connection and try again.",
    },
  },
  {
    test: /Did not return|Model did not/i,
    result: {
      title: "Model returned no result",
      hint: "Sometimes Claude declines to answer. Try rewording your prompt.",
    },
  },
];

export function friendlyError(err: unknown): FriendlyError {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  for (const { test, result } of SIGNATURES) {
    if (test.test(msg)) return result;
  }
  return {
    title: "Something went wrong",
    hint: msg.length > 0 && msg.length < 200 ? msg : "Try again in a moment.",
  };
}
