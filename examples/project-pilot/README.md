# ProjectPilot

An AI project management assistant built with [Agora Agent UI](../../README.md).

## What It Does

- **Sprint planning** — Break features into estimated tasks with dependencies
- **Task tracking** — Kanban boards and progress visualization
- **Blocker detection** — Identify and resolve project blockers
- **Velocity tracking** — Monitor team velocity across sprints

## Features Demonstrated

| Agora Feature | How ProjectPilot Uses It |
|---------------|-------------------------|
| Custom message types | `canvas:kanban`, `canvas:burndown` |
| Custom interceptors | Extracts kanban/burndown data from agent responses |
| Custom endpoints | `/api/project-stats` for sprint metrics |
| Suggestion chips | Guides planning workflows |
| Inline blocks | Task cards with status, estimates, dependencies |
| Mermaid diagrams | Dependency graphs and timelines |

## Quick Start

```bash
cd examples/project-pilot
npm install
npx agora-agent dev
# Open http://localhost:3457
```

## Try These

- "Help me plan a 2-week sprint for our team"
- "Break down a user authentication feature into tasks"
- "Show me the current project status and blockers"
