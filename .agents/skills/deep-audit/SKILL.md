---
name: deep-audit
description: Runs a deep code review and architecture verification using the high-reasoning thinking model (pro tier) to generate an actionable fix checklist for the fast coder model.
---

# Deep Audit & Verification Skill

Use this skill when the user asks to audit, review, verify, find bugs, or harden the codebase.

This workflow uses a two-tier model approach:
1. **Thinking Model (`pro` tier -> Claude Opus / Gemini Pro)**: Analyzes the codebase, finds hidden race conditions and edge cases, and writes a structured fix checklist to `AUDIT_REPORT.md`.
2. **Fast Execution Model (`flash` tier -> Gemini Flash)**: Implements the fixes file-by-file with automated syntax and `npm test` verification.

---

## Step 1: Launch the Thinking Model Auditor

Invoke the `auditor` subagent with **`Model: "pro"`**:

```json
{
  "TypeName": "auditor",
  "Model": "pro",
  "Role": "Senior MV3 Code Auditor",
  "Prompt": "Perform an exhaustive review of target files (background.js, content.js, popup.js, utils.js, manifest.json).\nConsult references/mv3_audit_rubric.md.\n\nDO NOT modify source code files directly.\nWrite your findings as an actionable Markdown checklist to AUDIT_REPORT.md and return a summary in chat.\nInclude for each finding:\n- File & Line numbers\n- Severity: [Critical / High / Medium / Low]\n- Root cause explanation\n- Exact drop-in replacement snippet or diff\n- Verification instruction (e.g. npm test, node --check)"
}
```

---

## Step 2: Review Findings Checklist

Once the `auditor` writes `AUDIT_REPORT.md`:
1. Present the summary of issues found to the user.
2. Confirm with the user before applying fixes.

---

## Step 3: Implement Fixes with the Fast Coder

For each item in `AUDIT_REPORT.md`:
1. Dispatch the task to the `coder` subagent (**`Model: "flash"`**) to apply changes using file editing tools directly.
2. The coder runs `node --check <filename>` and `npm test` automatically to verify the fix.
3. Check off the resolved item in `AUDIT_REPORT.md`.
