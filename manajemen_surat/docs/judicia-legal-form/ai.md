# AI JLF

JLF memakai AI global ALETA. Tidak ada provider/model picker baru di JLF.

## Prinsip

- AI hanya asisten.
- Output AI adalah draft/bahan bantu.
- AI tidak mengambil keputusan hukum.
- AI tidak menggantikan hakim, panitera, atau pejabat berwenang.
- AI tidak boleh mengarang dasar hukum.

## Fitur

- AI Template Assistant.
- AI Variable Mapping Assistant.
- AI Draft Assistant.
- AI BAS Assistant.
- AI Consistency Checker.
- AI Anonymization Assistant.
- AI Legal Analysis.
- AI Regulation Lookup.
- AI Template Compliance Checker.

## Guardrail

- `jlf.ai.enabled` untuk mematikan seluruh AI JLF.
- Global AI ALETA harus aktif dan punya provider aktif.
- Input length dibatasi oleh `jlf.ai.max_input_chars`.
- Redaction menyamarkan NIK, email, telepon, dan secret.
- Prompt injection basic diblokir.
- Audit/log JLF disimpan di `jlf_ai_logs`.

## Legal Analysis

Flow:

1. User memilih jenis analisa dan query.
2. Sistem retrieval peraturan/section dari JLF Legal KB.
3. Jika verified-only aktif, hanya sumber verified dipakai.
4. Konteks terbatas dikirim ke AI global ALETA.
5. Sesi disimpan di `jlf_legal_analysis_sessions`.
6. Sumber disimpan di `jlf_legal_analysis_sources`.
7. Output ditampilkan bersama sumber.

Jika sumber hukum tidak ditemukan, AI tidak dipanggil dan sistem menjawab bahwa dasar hukum belum tersedia di database.

