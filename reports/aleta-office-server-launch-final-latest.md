# ALETA Office Server Launch Final

Generated: 2026-05-02T13:58:43.321Z

Office Server Launch: **GO**
WhatsApp Production Launch: **NO_GO**
Safe for office internal operation: **yes**
Partial production plan available: **yes**

## Runtime
- Portal reachable: true
- ALETA Bot reachable: true
- WhatsApp: connected
- Worker: enabled=true, activeTimer=true, paused=false
- botEnabled: false

## Queue
- pending=0, processing=0, failed=0
- active dead-letter=0
- approval pending=0

## WhatsApp Production Gate
- runtime: PASS
- queue: PASS
- data: WARN
- recipientResolver: PASS
- template: PASS
- idempotency: WARN
- massSendOutlier: PASS
- schedulerReminder: WARN
- approval: PASS
- publicQa: PASS
- rollback: PASS

## Workflow Status
- PASS - Internal disposition notification: recipients=3, potentialMessages=3. Workflow internal disposition lulus shadow-run sample dengan eligibility guard, cap, template, dan idempotency preview.
- PASS - Internal incoming letter notification: recipients=5, potentialMessages=5. Workflow surat masuk lulus shadow-run sample PILOT-PROD-GATE-INCOMING dengan recipient internal eligible, template aman, cap, dan idempotency preview.
- PASS - Deadline H-1 reminder: recipients=0, potentialMessages=0. Template reminder production-ready. Shadow-run hari ini tidak memaksa data palsu; scheduler/reminder tetap disabled/dry_run sampai approval, kandidat nyata, dan canary terpisah PASS.
- PASS - Public Q&A runtime: recipients=0, potentialMessages=0. Safe mode policy passes; unapproved active intents are not production eligible.
- PASS - Broadcast capability gate: recipients=0, potentialMessages=0. Broadcast capability remains locked behind approval/dry-run/cap gate; no free-send production.
- PASS - External party notification capability gate: recipients=0, potentialMessages=0. External party capability remains locked behind approval/template/case-context gate; no free-send production.
- PASS - Mass resend capability gate: recipients=0, potentialMessages=0. Mass resend remains locked behind reviewed-item approval and cap gate.

## Data Hygiene
- active employees=42
- valid production recipients=36
- dummy=2, duplicateGroups=2, invalid=0, excluded=6

## Validation
- preflight: WARN
- smokeDryRun: PASS
- officeReadiness: PASS
- riskCheck: WARN
- shadowRun: PASS
- canary: FAIL
- nodeCheck: PASS
- tsc: PASS
- lint: PASS
- build: PASS
- test: PASS 38/38

## Blockers
- risk_check_not_pass: Risk check=WARN.
- canary_not_pass_or_not_run: Canary=FAIL, executed=false.
- production_canary_not_executed: Canary production tidak dijalankan karena risk-check masih WARN dan production launch script tetap NO_GO.

## Warnings
- employee_phone_data: employees=42, invalid=0, dummy=2, duplicateGroups=2, excluded=6. Recipient tidak layak produksi dikecualikan oleh production guard.
- legacy_send_idempotency: legacy client.sendMessage calls=4, safeSendMessage calls=55, buildIdempotencyKey calls=2. Legacy direct send diblokir production guard; workflow registry wajib memakai idempotency key production.
- scheduler_reminder_gate: reminder=false/dry_run, scheduler=false/dry_run, approved=false, legacyCronCount=24. Scheduler production tetap terkunci; legacy direct send diblokir guard.
- office_server_actual_cutover: Readiness ini dijalankan di environment Codex/lokal. Jalankan ulang script yang sama di mesin server kantor sebelum cutover final.

## Rollback
- Set botEnabled=false.
- Set notificationsEnabled=false.
- Set dispositionDeadlineReminder.enabled=false dan scheduler.enabled=false.
- Pause worker dari Admin ALETA Bot bila queue failed/dead-letter muncul.
- Jangan resend dead-letter otomatis; review dan acknowledge manual.
