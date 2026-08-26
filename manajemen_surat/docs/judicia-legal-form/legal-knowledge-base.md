# Legal Knowledge Base

Legal Knowledge Base JLF menyimpan sumber hukum yang dapat dipakai untuk template compliance dan AI legal analysis.

## Struktur

- `jlf_regulation_types`
- `jlf_regulations`
- `jlf_regulation_versions`
- `jlf_regulation_sections`
- `jlf_regulation_topics`
- `jlf_regulation_topic_links`
- `jlf_template_regulations`
- `jlf_variable_regulations`

## Jenis Peraturan

Jenis peraturan memiliki kode, nama, hierarchy level, issuing scope, binding flag, dan sort order.

## Peraturan

Status:

- `draft`
- `active`
- `revoked`
- `partially_revoked`
- `superseded`
- `archived`
- `unknown`

Verification status:

- `unverified`
- `needs_review`
- `verified`
- `rejected`

## Section/Pasal

Section mendukung parent-child:

- pembukaan
- konsiderans
- bab
- bagian
- paragraf
- pasal
- ayat
- huruf
- angka
- lampiran
- penjelasan
- lainnya

## Verifikasi

Hanya permission `judicia_legal_form.regulation.verify` yang boleh mengubah status ke `verified`.

Jika setting `jlf.ai.require_verified_regulations` aktif, AI legal analysis hanya memakai peraturan verified.

## Relasi

Template dan variabel dapat dihubungkan ke peraturan/section sebagai:

- dasar hukum
- rujukan format
- syarat formil
- syarat materiil
- pedoman redaksi
- validasi kelengkapan
- lainnya

