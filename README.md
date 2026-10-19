# Fuckbuff

**Five free AI products for coding, building, and research.** No subscription, credits, or API key required.

Fuckbuff is the Halloween-fied fork of the Freebuff agent stack: same engines, same free model catalog, spookier house. Text ads support access to the included models.

## Choose your Fuckbuff

| Product            | What it does                         |
| ------------------ | ------------------------------------ |
| **Fuckbuff Desktop** | Run parallel agents locally         |
| **Fuckbuff CLI**     | Code from your terminal             |
| **Fuckbuff Web**     | Build and ship full-stack apps      |
| **Fuckbuff Cloud**   | Run agents on any GitHub repository |
| **Fuckbuff Chat**    | Research and think with AI          |

The hosted products live on the Fuckbuff web app (https://fuckbuff.itskers0ne.workers.dev), a fully self-contained Worker that talks to no third-party site.

## Quick start

Run Fuckbuff in any project from your terminal:

```bash
git clone https://github.com/kere0ne/Fuckbuff.git
cd Fuckbuff
bun install
bun start-cli
```

Then describe what you want. Fuckbuff finds the relevant files, makes changes, and runs the checks that matter for your project.

## Models

Fuckbuff keeps the Freebuff model catalog (MiMo v2.6 Flash Fast, GLM 5.3 Flash, DeepSeek V4.1 Flash, GPT-6 Luna, Solar Mini/Pro 4, Gemini, Muse Spark and more). Most models draw on your normal daily sessions rather than a separate limit; the unmetered picks cost no session at all. Availability and limits depend on your access tier, product, and current capacity.

## How Fuckbuff works

Fuckbuff uses specialized agents instead of sending every task through one model and one prompt. Depending on the task, agents gather context, plan, edit or research, run tools, and review the result.

- **Codebase context** — file-finding agents map the relevant parts of a project before editing.
- **Implementation and review** — agents can divide work, make changes, run commands, and inspect the result.
- **Research and browser use** — agents can investigate documentation and test applications in a real browser.
- **Parallel local work** — Desktop isolates concurrent agents in separate workspaces.
- **Hosted environments** — Web and Cloud provide sandboxes, previews, terminals, and deployment workflows.

## Free access

Fuckbuff is available in every country. Supported regions receive full access; other regions and VPN users receive limited access to the unmetered models. Balances read in hours; earned hours go into your wallet and are used after it.

## Contributing

Fuckbuff is a TypeScript monorepo built with Bun. Local development requires Docker and a configured `.env.local`; see the [Contributing Guide](./CONTRIBUTING.md) before starting the services.

```bash
git clone https://github.com/kere0ne/Fuckbuff.git
cd Fuckbuff
bun install
bun up
```

Start the CLI separately with:

```bash
bun start-cli
```

## License

Forked from the Freebuff project and released under its original Apache 2.0 license (see [LICENSE](./LICENSE) and [NOTICE](./NOTICE)).
