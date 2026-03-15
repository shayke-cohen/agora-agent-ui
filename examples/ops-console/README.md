# OpsConsole

A DevOps monitoring and incident response assistant built with [Agora Agent UI](../../README.md).

## What It Does

- **Service monitoring** — Real-time health dashboards for all services
- **Incident response** — Guided troubleshooting with runbooks and escalation
- **Log analysis** — Search and analyze logs from any service
- **Architecture visualization** — Service dependency maps and traffic flow

## Features Demonstrated

| Agora Feature | How OpsConsole Uses It |
|---------------|----------------------|
| Custom message types | `canvas:status-panel`, `canvas:log-viewer` |
| Custom interceptors | Extracts status panels and log views from agent responses |
| Custom endpoints | `/api/service-health`, `/api/incidents` |
| Suggestion chips | Guides monitoring and incident workflows |
| Inline blocks | Alert cards, runbook steps, progress indicators |
| Mermaid diagrams | Architecture maps, dependency graphs |

## Quick Start

```bash
cd examples/ops-console
npm install
npx agora-agent dev
# Open http://localhost:3458
```

## Try These

- "Show me the current service health dashboard"
- "What incidents are currently active?"
- "Show me recent error logs from the API gateway"
