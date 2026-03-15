---
name: working-standards
description: "Universal session management and coding standards for complex, multi-file, or multi-session projects. Use at the start of any structured task involving planning, token budgeting, file handoffs across chats, or architecture decisions. Trigger on: planning a large change, token budget concerns, session handoff, multi-file refactor, architecture decisions, 'where do we start', 'split into sessions', 'continue from last chat', version control workflow, or any task where scope is unclear. Applies to all languages and all projects."
---

# Working Standards — Universal

Applies to every project, every language, every session.

---

## 1. Plan Before Code — Always

Before writing any code or diff, verify:
- What is the blast radius if this goes wrong? (what breaks, what depends on it)
- What is the load order / dependency chain?
- What is the minimal change that solves the problem?

For non-trivial tasks, state the plan explicitly in chat before any tool use.
The user can correct a plan cheaply. They cannot easily un-apply 200 lines of wrong code.

Surgical edits only:
- ✅ str_replace / unified diff / targeted block
- ❌ Output entire file unless explicitly asked

---

## 2. Session & Token Management (Free Plan Workflow)

The user is on Claude Free Plan. Sessions end mid-task. This is expected and normal.

### Before starting any multi-step task:
1. Break work into numbered sessions with explicit scope per session
2. State what files are needed per session — ask only for what is needed now
3. After each session, report progress as: **"X% complete — sessions remaining: [list]"**

### Session handoff — always end with:
- % complete
- What was done this session (1-sentence per file changed)
- What the next session needs (exact file list)
- Any unresolved decisions the user must make

### Token efficiency rules:
- Read only the sections of files needed for the task (use view_range, grep, bash)
- Do not re-read files already in context unless the task requires verification
- Do not output file contents to chat — write to filesystem and present_files
- Never summarize what you just did in paragraphs — use a compact table or list

---

## 3. Model Selection Guidance

| Task | Recommended |
|------|-------------|
| Architecture planning, multi-file refactor design, complex debugging | Extended (claude-sonnet-4-5 or higher) |
| Executing a pre-written plan, single-file edits, straightforward patches | Sonnet (standard) |
| ❌ Planning + coding in the same standard Sonnet session | Avoid — quality degrades on complex plans |

Optimal workflow for complex tasks:
1. **Extended** — plan, scope, identify all dependencies, write session breakdown
2. **Standard Sonnet** — execute each session against the plan
3. OR: **Extended** for both if quality is the priority and budget allows

Avoid using standard Sonnet to plan AND code a complex multi-file change in one session.
The planning phase consumes tokens that then compress the coding quality.

---

## 4. File Versioning (Any Project)

```
New chat + file attached by user       → use uploads directly
New chat + no file attached            → ask for only the files needed for THIS task
Continuing chat + no new upload        → check /mnt/user-data/outputs/<file> first
                                         if exists → cp from outputs (not uploads)
                                         if not    → use uploads
Continuing chat + user uploads new     → always use new upload (outputs may be stale)
```

Mandatory before editing any file in a continuing chat:
```bash
ls /mnt/user-data/outputs/<filename>       # check first
cp /mnt/user-data/outputs/X /home/claude/X # ✅ if exists
cp /mnt/user-data/uploads/X /home/claude/X # ✅ only if no output version
```

Never ask for a file already present in uploads or outputs.

---

## 5. Version Numbers — Never Write Them

Claude must NOT write version numbers, cache strings, or build identifiers into any file.
Use `[NEXT VERSION]` as a placeholder in chat summaries only.

Reason: Claude sessions are interrupted. If Claude writes a version number mid-session,
the IDE may bump again at commit → all version references desync across files.

The IDE (Windsurf / Cursor / Antigravity / any tool used for commit) owns version bumps.
Claude owns code. One actor, one responsibility.

---

## 6. Output Format Rules

- **Lead with the answer** — no pleasantries, no restatement of the question
- **Exact edits only** — str_replace or diff; never dump a full file unless asked
- **Caveats in one line** — if something matters, say it once, briefly
- **At most one clarifying question per response** — only when ambiguity would produce wrong code
- **Tables over prose** for: file lists, session plans, comparison of options
- **No apologies, no "great question"** — just the work

---

## 7. Architecture Decision Log

When a decision has non-obvious long-term consequences, flag it once:

> ⚠️ **Architectural note:** [one sentence on what would break if this pattern changes]

This is not optional on decisions involving: inheritance, global state, load order,
shared update loops, or singleton patterns.

---

## 8. When to Stop and Ask

Stop and ask (one question) when:
- The blast radius is unclear and proceeding would require changes across 4+ files
- Two valid approaches have meaningfully different tradeoffs the user should choose
- A file needed for the task hasn't been uploaded and cannot be inferred from context

Do NOT stop to ask about:
- Config values / stat numbers (use ?? fallbacks from the codebase)
- Formatting preferences (follow the file's existing style)
- Whether to proceed (if the plan was approved, proceed)

---

## 9. Multi-Session Project Handoff Template

When ending a session on a large task, use this format:

```
📊 Progress: XX% complete

**This session:**
- [file] — [one sentence]
- [file] — [one sentence]

**Next session needs:**
- [exact file paths, one per line]

**Unresolved decisions:**
- [decision], needs user input: [question]
```

This ensures the next session resumes without asking for files or context.
