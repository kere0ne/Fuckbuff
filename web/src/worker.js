const CHAT_SYSTEM = [
  "You are Fuckbuff, a Halloween-spirited AI coding assistant.",
  "You write real, complete, working code: scripts, bots, sites, and fixes.",
  "Answer with substance first: give the code, then at most a couple of short lines explaining it.",
  "Always put code in fenced code blocks with the right language tag.",
  "Your flavor is spooky-season: a dry jack-o-lantern sense of humor, an occasional pumpkin/bat/ghost wordplay, never more than one short spooky line per reply, and never at the cost of correctness.",
  "You never browse, open, or link external websites; if asked for a URL, say you keep everything in-house and ask them to paste what they need.",
  "If a request is for something harmful (malware, credential theft, account takeover), refuse plainly and offer a safe alternative.",
].join(" ");

const AGENT_SYSTEM = [
  "You are Fuckbuff Agent, a Halloween-spirited autonomous coding agent working inside a browser IDE.",
  "You act by returning STRICT JSON only, no prose outside the JSON, no markdown fences:",
  '{"actions":[{"type":"write_file","path":"<name>","content":"<full file content>"},{"type":"run_js","code":"<js>"},{"type":"run_py","code":"<python>"},{"type":"reply","message":"<final answer to the user>"}],"say":"<one short spooky status line>"}',
  "Tool rules:",
  "- write_file writes or replaces a whole file in the workspace. Always write COMPLETE files, never diffs or placeholders. Use plain filenames (bot.py, index.html); folders as folder/name.py.",
  "- run_js executes JavaScript in a browser sandbox (console.log is captured, no network, no npm, no DOM). Use it to test logic.",
  "- run_py executes Python 3.13 (stdlib only) in a browser Pyodide sandbox. No pip, no network, no discord.py. Use it to test pure logic.",
  "- A sandbox cannot hold a persistent Discord websocket connection. When the task is a Discord bot, write the complete bot file (discord.py or discord.js style, token read from env DISCORD_TOKEN), then use run_py/run_js ONLY for a small self-test that mocks the parts you can (command parsing, embed building, math) and prints PASS lines.",
  "- After each batch of actions you will receive their results as tool output. If a run errored, read the error, fix the file, and run again. Iterate at most a few times.",
  "- When the work is done, or the task is pure explanation or chat, end with ONE reply action containing the final answer in clean markdown (fenced code blocks for code).",
  "Keep the JSON valid: escape newlines properly. Say short. Code complete.",
].join(" ");

const CHAIN = [
  "@cf/openai/gpt-oss-120b",
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/google/gemma-7b-it",
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

function cap(s, n) {
  s = String(s || "");
  return s.length > n ? s.slice(0, n) + "\n...[truncated]" : s;
}

function extractText(result) {
  if (!result) return "";
  if (typeof result === "string") return result;
  if (typeof result.response === "string") return result.response;
  if (typeof result.result === "string") return result.result;
  if (typeof result.output_text === "string") return result.output_text;
  const c = Array.isArray(result.choices) && result.choices[0];
  if (c && c.message && typeof c.message.content === "string") return c.message.content;
  return "";
}

function trimHistory(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((m) => m && typeof m.content === "string" && m.content.trim() && (m.role === "user" || m.role === "assistant"))
    .slice(-14)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 12000) }));
}

async function runChain(env, messages, maxTokens) {
  for (const model of CHAIN) {
    try {
      const result = await env.AI.run(model, { messages, max_tokens: maxTokens, temperature: 0.6 });
      const reply = extractText(result);
      if (reply.trim()) return { text: reply.trim(), model };
    } catch (err) {
      // next model in the chain
    }
  }
  return null;
}

function filesBlock(files) {
  if (!files || !files.length) return "(workspace is empty)";
  return files
    .map((f) => `--- FILE ${f.path} (${f.binary ? "binary, " + f.size + " bytes" : f.content.length + " chars"}) ---\n` + (f.binary ? "(binary file, contents not shown)" : cap(f.content, 8000)))
    .join("\n\n");
}

function logBlock(log) {
  if (!log || !log.length) return "(no tool results yet)";
  return log.slice(-6).map((l) => `>> ${cap(l, 4000)}`).join("\n");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat" && request.method === "POST") {
      let body;
      try { body = await request.json(); } catch { return json({ error: "bad request body" }, 400); }
      const history = trimHistory(body.messages);
      if (!history.length || history[history.length - 1].role !== "user") return json({ error: "say something first" }, 400);

      if (body.stream) {
        for (const model of CHAIN) {
          let stream;
          try {
            stream = await env.AI.run(model, { messages: [{ role: "system", content: CHAT_SYSTEM }, ...history], max_tokens: 3072, temperature: 0.6, stream: true });
          } catch (err) { continue; }
          if (stream && typeof stream.getReader === "function") {
            return new Response(stream, { headers: { ...HEADERS, "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache", "x-accel-buffering": "no" } });
          }
        }
        const res = await runChain(env, [{ role: "system", content: CHAT_SYSTEM }, ...history], 3072);
        if (!res) return json({ error: "all the jack-o-lanterns blew out, try again" }, 502);
        return json({ reply: res.text, brain: res.model });
      }

      const res = await runChain(env, [{ role: "system", content: CHAT_SYSTEM }, ...history], 3072);
      if (!res) return json({ error: "all the jack-o-lanterns blew out, try again" }, 502);
      return json({ reply: res.text, brain: res.model });
    }

    if (url.pathname === "/api/agent" && request.method === "POST") {
      let body;
      try { body = await request.json(); } catch { return json({ error: "bad request body" }, 400); }
      const task = cap(body.task, 6000);
      if (!task.trim()) return json({ error: "give the agent a task" }, 400);

      const prompt = [
        "TASK: " + task,
        "",
        "WORKSPACE FILES:\n" + filesBlock(body.files),
        "",
        "TOOL RESULTS FROM YOUR LAST ACTIONS:\n" + logBlock(body.log),
        "",
        "Respond with the strict JSON object now.",
      ].join("\n");

      const res = await runChain(env, [
        { role: "system", content: AGENT_SYSTEM },
        { role: "user", content: prompt },
      ], 4096);
      if (!res) return json({ error: "all the jack-o-lanterns blew out, try again" }, 502);

      let parsed = null;
      let text = res.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start !== -1 && end > start) {
        try { parsed = JSON.parse(text.slice(start, end + 1)); } catch { parsed = null; }
      }
      if (parsed && Array.isArray(parsed.actions)) {
        parsed.actions = parsed.actions
          .filter((a) => a && typeof a === "object")
          .map((a) => ({
            type: String(a.type || ""),
            path: typeof a.path === "string" ? a.path.replace(/[^\w.\-/]/g, "_").slice(0, 120) : "",
            content: typeof a.content === "string" ? a.content : "",
            code: typeof a.code === "string" ? a.code : "",
            message: typeof a.message === "string" ? a.message : "",
          }))
          .filter((a) => ["write_file", "run_js", "run_py", "reply"].includes(a.type));
        return json({ actions: parsed.actions, say: cap(parsed.say, 200), brain: res.model });
      }
      return json({ actions: [{ type: "reply", message: res.text }], say: "the spirits spoke in riddles", brain: res.model });
    }

    return env.ASSETS.fetch(request);
  },
};
