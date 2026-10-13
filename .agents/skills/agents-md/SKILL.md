---
name: agents-md
description: Create, audit, or update AGENTS.md, CLAUDE.md, GEMINI.md, and linked agent reference docs using progressive disclosure, monorepo nesting, and symlinks.
---

# Configuring `AGENTS.md` & Agent Context

Use this skill whenever creating, auditing, or updating `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, or the `docs/` files they reference.

## Why `AGENTS.md` Must Stay Tiny

Every prompt sent to an AI coding agent includes:
1. The system prompt
2. The **entire** `AGENTS.md` / `CLAUDE.md` / `GEMINI.md`
3. The `name` and `description` frontmatter of **every** installed skill
4. Any loaded skills or docs
5. The user's prompt

Because `AGENTS.md` is sent in full on **every turn**, a bloated `AGENTS.md` wastes context tokens, dilutes attention with irrelevant rules, and degrades output quality once a session passes ~100k–200k tokens.

---

## 1. What Belongs in Root `AGENTS.md` ($\le 30$ lines)

Keep the root `AGENTS.md` restricted to information needed on almost every turn:

1. **1–2 sentence project summary**: What the application does and its top-level stack.
2. **Package manager & non-standard workflow rules**: Specify `pnpm` (or non-default tooling), the verification quality gate (`lint` $\rightarrow$ `typecheck` $\rightarrow$ targeted `test`), and non-obvious environment gotchas.
3. **High-level layout only**: Mention top-level packages (`frontend/`, `backend/`), never granular file paths. File names move frequently, and stale paths in `AGENTS.md` actively mislead the agent.
4. **Context pointers to `docs/` and nested `AGENTS.md` files**: One bullet per domain branch:
   ```markdown
   - **<Trigger branch>**: read [path/to/file.md](path/to/file.md).
   ```
   The agent loads the linked file only when the current task touches that branch.

## 2. What to Exclude or Disclose Out of `AGENTS.md`

- **Cut "Getting Started" / onboarding guides**: The agent operates in an already-configured workspace; do not include human first-time setup tutorials.
- **Cut standard `package.json` script tables**: The agent can read `package.json` directly. Only document non-standard scripts or required flags (such as targeted Vitest invocation).
- **Disclose domain-specific sections into `docs/`**: Never inline long sections for CSS conventions, testing setup, API rules, PR/delivery checklists, or worktree setup inside root `AGENTS.md`. Move each into a dedicated file in `docs/` (e.g., `docs/testing.md`, `docs/worktrees.md`) and link to it via a 1-line context pointer.
- **Add rules reactively, never speculatively**: Never ask an AI to "scan the repo and generate an `AGENTS.md`." Start minimal and add a rule only after observing the agent make a specific, repeated mistake—and place that rule in the narrowest file that owns that domain.

## 3. Monorepo Nesting (`<package>/AGENTS.md`)

In a monorepo, do not put frontend-only rules and backend-only rules in the root `AGENTS.md`:

- Place frontend-specific rules (UI/CSS constraints, mobile rules, frontend test setup) in `frontend/AGENTS.md`.
- Place backend-specific rules (ORM/schema conventions, test database port/migrations, API conventions) in `backend/AGENTS.md`.
- Keep a context pointer in the root `AGENTS.md` to both `frontend/AGENTS.md` and `backend/AGENTS.md` so agents launched from the repository root still load the package file when editing that package.

## 4. Symlink `CLAUDE.md` $\rightarrow$ `AGENTS.md`

Never create a `CLAUDE.md` (or `GEMINI.md`) that merely says `"Reference AGENTS.md"`—agents will append new rules to one file and not the other, causing silent drift.

Always symlink `CLAUDE.md` to `AGENTS.md` in every directory that contains an `AGENTS.md`:

```bash
# Linux / macOS
ln -sf AGENTS.md CLAUDE.md

# Windows (Administrator Command Prompt)
mklink CLAUDE.md AGENTS.md
```

## 5. `AGENTS.md` + `docs/` vs. Skills (`.agents/skills/`)

- **`AGENTS.md` + `docs/`**: Use for **general project conventions** (architecture, styling, testing rules) that apply whenever touching a domain.
- **Skills (`.agents/skills/<name>/SKILL.md`)**: Use for **specific, repeatable workflows or one-off tasks** (e.g., auth setup, migrations, commit formatting, UI stress-testing) that the agent loads on demand or the user triggers with `/skill-name`.
- **Keep skill `description` frontmatter to one tight sentence**: Because every installed skill's `name` and `description` is injected into every prompt, prune verbose examples and synonym lists from skill descriptions, and remove unused skills.

---

## Checklist When Updating `AGENTS.md`

Before finishing any update to `AGENTS.md`:

1. **Is the new rule needed on every single prompt?**
   - If **yes**: add it in 1–2 concise, positively phrased lines in root `AGENTS.md`.
   - If **package-specific**: add it to `frontend/AGENTS.md` or `backend/AGENTS.md`.
   - If **topic-specific** (testing, styling, delivery, worktrees): add it to `docs/<topic>.md` and ensure root `AGENTS.md` has a 1-line pointer to that file.
   - If **a repeatable workflow / task recipe**: create or update a skill in `.agents/skills/<name>/SKILL.md`.
2. **Are there any granular file paths that could go stale?** Replace them with high-level directory or concept pointers.
3. **Are there any broken markdown links?** Verify every linked path in `AGENTS.md` exists.
4. **Are `CLAUDE.md` symlinks intact?** Verify `CLAUDE.md -> AGENTS.md` exists at root and in each package directory.
