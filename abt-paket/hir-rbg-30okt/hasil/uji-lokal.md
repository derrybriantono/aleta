# Uji lokal paket hir-rbg-30okt + titik-koma-teks-30okt (laptop, 30-31 Okt 2026)

Basis milik sendiri: `aps_badilag_g6` (dump server 28 Okt 15.44 = aps_badilag_2810, fungsi diarahkan ke `sipp_g6`) dan `sipp_g6`
(salinan sipp_2810, sys_audittrail kosong); pohon blangko `D:/Aplikasi/aleta/tmp/g6/blangko` = `bas29/dasar2` + SEMUA paket 29-30 Okt dipasang
dengan skripnya sendiri (urutan: prodeo -> ket-saksi-kata -> ket-saksi-baris -> alasan-belum-dipilih -> relaas-penetapan -> sampul-rapi -> sela-ps
-> bas-tanya-jawab (berkas w124, lihat temuan PASANG.md) -> bas-itsbat-varian -> bukti-nomor (DIBANGUN ULANG atas pohon ini) -> titik-koma
-> titik-koma-data). Renderer: php56 ABT asli (`alat/render_g6.py`, controller CLI Uji_sela, `Abt_model::variabel_library`).

| uji | hasil |
|---|---|
| PRASYARAT pertama | `0\|0\|40\|0\|1` |
| pasang | `SIAP=603`, `SEMUA COCOK`, `UJI: satker PA.Dgl provinsi 'Sulawesi Tengah' -> hukum acara RBg`, `TAMBAL=603`, `BERKAS COCOK`, `SELESAI` |
| pasang ulang | `SUDAH=603`, `BERKAS COCOK`, tidak ada yang berubah |
| pulih | `PULIH=603`, `BERKAS PULIH`, `PULIH COCOK (0\|0\|40\|0\|1)`; 603 berkas = pohon dasar persis (byte) |
| pasang lagi | `TAMBAL=603`, `BERKAS COCOK` |
| **identik Donggala, SEMUA perkara** | bukti pembangun (assert): 603 RTF dan 40 kueri, padanan diisi nilai RBg = isi lama persis |
| **identik Donggala, render nyata** | 89 blangko (semua 46 variabel baru terpakai, 40 folder, + blangko pemakai 36 kueri yang diubah) x perkara sejenis: RTF hasil sebelum vs sesudah **89/89 sama persis byte demi byte** (`alat/banding_g6.py`) |
| otomatis dari provinsi | kueri #11850#: Jawa Timur / DKI Jakarta / DI Yogyakarta / Banten -> HIR; Sulawesi Tengah / Kalimantan Barat / kosong -> RBg |
| **simulasi satker Jawa** (cabang `WHEN 'PA.Dgl' THEN 'HIR'` seperti tombol Super Admin, lalu dikembalikan; md5 kueri kembali persis) | CG verstek 628/Pdt.G/2026: Pasal 149 RBg -> **Pasal 125 HIR**, 283 -> **163 HIR**, 285 -> **165 HIR**, 172 ayat (1) -> **145 ayat (1) HIR**; Waris [98e]: 145 dan 146 -> **121 dan 122 HIR**, 154 -> 130, 144 -> 120, 160 -> 134, 162 -> 136, **192 ayat (3) RBg -> 181 ayat (2) HIR**; Gugur 3a: 148 -> 124, "berada di luar Jawa dan Madura, hukum acara yang berlaku adalah RBg" -> "**berada di Jawa dan Madura, hukum acara yang berlaku adalah HIR**"; sela eksepsi relatif: 159 -> 133, 162 -> 136; BAS sita HB 175/Pdt.G/2026: 261 ayat (1) -> **227 ayat (1) HIR**. 0 penanda `#nnnn#` tersisa |
| titik-koma-teks (sesudah hir) | `TAMBAL=292`, `BERKAS COCOK`; render nyata: "...tetap diperiksa dan diputus**,** terhadap keberatan Tergugat ...", "...Pasal 272 Rv tidak terpenuhi**,** oleh karena itu ...", "...dengan izin Pengadilan**,** sejalan dengan itu ..." - hanya ";" itu yang berubah |
