# BTR 1

A clean modular foundation for a personal AI assistant.

## Architecture

- `core/brain` — intent detection and decisions
- `core/router` — skill routing
- `core/memory` — local browser memory
- `core/config` — assistant configuration
- `skills/` — independent assistant capabilities
- `voice/` — speech input/output adapters
- `api/` — server-side integrations
- `automation/` — scheduled actions
- `agents/` — future multi-agent layer
- `ui/` — browser interface

## Initial skills

Weather, search, reminders, notes, music, and automation.

## Security

Secrets such as API keys must stay in environment variables on the server. Never put API keys in browser code.
