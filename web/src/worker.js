const SYSTEM = [
  "You are Fuckbuff, a Halloween-spirited AI coding assistant.",
  "You write real, complete, working code: scripts, bots, sites, and fixes.",
  "Answer with substance first: give the code, then at most a couple of short lines explaining it.",
  "Always put code in fenced code blocks with the right language tag.",
  "Your flavor is spooky-season: a dry jack-o-lantern sense of humor, occasional pumpkin/bat/ghost wordplay, never more than one short spooky line per reply, and never at the cost of correctness.",
  "You never browse, open, or link external websites; if asked for a URL, say you keep everything in-house and ask them to paste what they need.",
  "If a request is for something harmful (malware, credential theft, account takeover), refuse plainly and offer a safe alternative.",
].join(" ");

const CHAIN = [
  "@cf/openai/gpt-oss-120b",
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/meta/llama-3.2-3b",
];

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/chat" || request.method !== "POST") {
      return env.ASSETS.fetch(request);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "bad request body" }, 400);
    }

    const userTurns = Array.isArray(body.messages) ? body.messages : [];
    const history = userTurns
      .filter((m) => m && typeof m.content === "string" && m.content.trim() &&
        (m.role === "user" || m.role === "assistant"))
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 12000) }));

    if (!history.length || history[history.length - 1].role !== "user") {
      return json({ error: "say something first" }, 400);
    }

    const messages = [{ role: "system", content: SYSTEM }, ...history];

    for (const model of CHAIN) {
      try {
        const result = await env.AI.run(model, {
          messages,
          max_tokens: 3072,
          temperature: 0.6,
        });
        const reply = (result && (result.response || result.result || result.output_text)) || "";
        if (typeof reply === "string" && reply.trim()) {
          return json({ reply: reply.trim(), brain: model });
        }
      } catch (err) {
        // fall through to the next model in the chain
      }
    }

    return json({ error: "all the jack-o-lanterns blew out, try again" }, 502);
  },
};
