# ALETA Legacy Send Path Audit

Generated: 2026-05-02T22:03:44.325Z

Overall: **WARN**
Legacy direct send enabled: false
Cron schedule count: 24
client.sendMessage calls: 4
safeSendMessage calls: 55

## Guard
legacy_direct_send_blocked_by_guard

## Remediation
- Legacy direct-send is blocked by productionGuardService while legacyDirectSendEnabled=false.
- Long-term: migrate each cron to production notification registry with idempotency, cap, and approval gates.
- Do not enable legacyDirectSendEnabled for production.
