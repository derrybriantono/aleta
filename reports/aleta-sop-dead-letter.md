# SOP: Active Dead-letter

## Goal

Handle failed messages safely without accidental resend.

## Do Not

- Do not resend immediately.
- Do not broadcast.
- Do not hard-delete queue/dead-letter history.
- Do not send to external parties without approval.

## Steps

1. Open Admin ALETA Bot Queue Recovery/Pesan Gagal.
2. Check recipient category and source feature.
3. Read the sanitized error.
4. If it is a validation artifact, use Tandai Ditangani.
5. If it is operational, check WhatsApp status, safe window, worker, policy skip, and recipient validity.
6. Decide whether resend is allowed. Require explicit approval for any risky category.
7. After action, run smoke dry-run.

## Launch Decision Impact

- Active dead-letter greater than 0 blocks WhatsApp pilot expansion.
- Internal non-WA operations may continue if the issue is isolated.
- Production automation remains disabled.
