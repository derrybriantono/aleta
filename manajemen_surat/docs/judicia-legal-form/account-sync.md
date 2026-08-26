# Account Sync ALETA-SIPP

Account sync menyinergikan akun ALETA dengan user SIPP tanpa menyimpan password atau hash password SIPP.

## Data SIPP Yang Boleh Disimpan

- `sipp_user_id`
- `sipp_username`
- `sipp_fullname`
- `sipp_nip`
- `sipp_email`
- `sipp_group_id`
- `sipp_group_name`
- `sipp_satker_code`
- `sipp_satker_name`

Password dan hash password SIPP dilarang.

## Auto Suggestion

Confidence dihitung dari:

- NIP exact match
- Username exact match
- Email exact match
- Fullname similarity
- Relevansi role/group

Jika ada lebih dari satu kandidat kuat, status menjadi `conflict`. Sistem tidak auto-link.

## Manual Linking

Admin dengan `judicia_legal_form.account_sync.manage` dapat memilih user SIPP dan membuat link manual. Jika kandidat sebelumnya `suggested/conflict`, manual link akan mengubah status menjadi `linked`.

## Unlink/Relink

Unlink mencatat actor, waktu, alasan, dan audit. Relink memutus link lama lalu membuat link baru melalui proses admin.

## Role Mapping

Mapping group SIPP ke role/permission ALETA adalah rekomendasi. Default:

- `is_auto_apply = false`
- `requires_admin_approval = true`

Auto-apply tidak aktif tanpa approval eksplisit.

## Audit

Action audit utama:

- `account_link.suggest`
- `account_link.manual_link`
- `account_link.approve`
- `account_link.reject`
- `account_link.unlink`

