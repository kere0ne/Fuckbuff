importScripts("/pyodide/pyodide.js");
let readyPromise = (async () => {
  self.pyodide = await loadPyodide({ indexURL: "/pyodide/" });
  postMessage({ type: "ready" });
})();
readyPromise.catch((e) => postMessage({ type: "loaderror", error: String(e) }));

self.onmessage = async (event) => {
  if (event.data && event.data.type === "run") {
    try { await readyPromise; } catch (e) { postMessage({ type: "done", error: "python engine failed to load: " + e }); return; }
    const out = [];
    const write = (s) => out.push(String(s));
    self.pyodide.setStdout({ batched: write });
    self.pyodide.setStderr({ batched: write });
    try {
      await self.pyodide.runPythonAsync(event.data.code);
      postMessage({ type: "done", output: out.join("\n") });
    } catch (err) {
      const msg = err && err.message ? String(err.message) : String(err);
      postMessage({ type: "done", output: out.join("\n"), error: msg.split("\n").slice(-12).join("\n") });
    }
  }
};
