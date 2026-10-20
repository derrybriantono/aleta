# Hasil render php56 (20 Okt 2026)

Renderer `Abt_model::variabel_library` (php 5.6) atas SALINAN aplikasi ABT yang menunjuk basis sementara `aps_badilag_u3r`
(tabel selain `abt_variabel` = view baca-saja ke `aps_badilag`; `abt_variabel` = salinan + 14 variabel paket). Aplikasi dan basis asli tidak disentuh.
Perintah: `python alat/render_uji.py <keluar> kode=<rtf>@<perkara_id> ...`

| blangko | perkara | hasil | token tersisa | galat |
|---|---|---|---|---|
| IN [01d] | 10041 (wali hakim, ayah kristen) | OK | 0 | tidak |
| IN [01e] | 9774 | OK | 0 | tidak |
| AUA [01a] | 9712 (nikah siri 2018, dicatat 2026) | OK | 0 | tidak |
| AUA [01b] | 9760 | OK | 0 | tidak |
| AUA [01c] | 10090 (tiga anak) | OK | 0 | tidak |
| BAS ALUR 11 [1b] | 10041 | OK | 0 | tidak |
| BAS ALUR 13 [1b] | 9712 | OK | 0 | tidak |

Titik-titik (`...`) yang tersisa adalah isian petugas yang memang belum diisi pada salinan lokal (mis. tanggal nikah, wali, mahar pada 9712).
Tanda kutip lurus dipakai pada kutipan Pasal 7 ayat (3) KHI karena karakter non-ASCII pada keluaran variabel hilang saat dirender ABT.
