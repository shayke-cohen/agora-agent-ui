# ReviewBot

An AI code review assistant built with [Agora Agent UI](../../README.md).

## What It Does

- **Code review** — Analyze code for bugs, performance, security, and style
- **Architecture analysis** — Visualize data flow and structural issues
- **Security scanning** — Check for common vulnerabilities
- **Best practices** — Actionable suggestions with code examples

## Features Demonstrated

| Agora Feature | How ReviewBot Uses It |
|---------------|----------------------|
| Custom message types | `canvas:review-summary` |
| Custom interceptors | Extracts review summaries from agent responses |
| Custom endpoints | `/api/review-stats` for review metrics |
| Suggestion chips | Guides review workflows |
| Inline blocks | Issue cards (critical/warning/suggestion), code health score |
| Mermaid diagrams | Architecture and data flow visualization |

## Quick Start

```bash
cd examples/review-bot
npm install
npx agora-agent dev
# Open http://localhost:3456
```

## Try These

- "Review the code in src/index.js"
- "What are the top 5 code review best practices?"
- "Check my project for common security issues"
