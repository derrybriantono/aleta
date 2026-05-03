# SOP: WhatsApp Disconnected

## Goal

Restore visibility safely without resetting session or creating duplicate clients.

## Do Not

- Do not scan QR from shell/script.
- Do not logout.
- Do not reset session.
- Do not delete auth/session folders.
- Do not change session name.
- Do not start a second ALETA Bot instance.

## Steps

1. Check Admin ALETA Bot Status WhatsApp.
2. Run `node scripts/aleta-preflight.mjs`.
3. Confirm whether runtime is reachable on port 3003.
4. Confirm diagnostics does not show `browser_locked`, `initialize_timeout`, or stuck initializing.
5. If disconnected but runtime is healthy, use the Super Admin UI flow to reconnect.
6. If `browser_locked`, stop the old ALETA Bot/Chrome process carefully, then start one ALETA Bot instance. Do not delete session data.
7. After reconnect, run smoke dry-run.

## Launch Decision Impact

- Non-WA internal operations may continue.
- WhatsApp limited pilot is paused.
- Production automation remains disabled.
