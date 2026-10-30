# 6.3 - variabel data_sql Derry yang selalu kosong (G6, 31 Okt 2026) - KEPUTUSAN SEMENTARA, tidak ada yang diubah/dihapus

Metode: `alat/pindai_kosong.py` - satu RTF berisi SEMUA 1.856 penanda yang dipakai blangko Derry aktif (termasuk bersarang), dirender
php56 ABT asli (salinan G6, sesudah semua paket 29-30 Okt + hir-rbg) untuk **35 perkara** beragam (`alat/sampel-g6.tsv`: CG putus
verstek e-Court/kuasa/belum putus, CT putus/kuasa/belum putus, itsbat, DK, P3HP (+kuasa), perwalian, waris, pihak P >= 5, pihak T >= 6,
asal usul, HB, wasiat, ES, poligami, wali adhol, lain-lain, hakim/panitera berganti; sidang = sidang terakhir). Lalu `alat/analisa_kosong.py`.
8 dari 43 sampel belum sempat dirender (batas waktu 03.00) - golongan "jenis-lain" bisa menyusut bila diulang penuh.

Hasil (variabel modifier admin = Derry, KOSONG di semua 35 sampel): **199** (`variabel-kosong-35-sampel.txt`)

| golongan | jumlah | arti / tindakan |
|---|---|---|
| bersyarat-keadaan | 144 | nama/kueri menyebut keadaan yang tidak ada di sampel (pihak II..X / ke-5 dst., kuasa, penggantian/cuti hakim-panitera, sidang lanjutan, eksepsi, rekonvensi, banding, verzet, ikrar, mediasi, sita, PS, intervensi, sumpah, kumulasi, PNS/TNI, ...) - **biarkan** |
| jenis-lain | 42 | hanya dipakai folder blangko yang jenis perkaranya tidak ada di sampel yang dirender - **biarkan** (ulangi pindai penuh untuk memastikan) |
| isian-petugas | 7 | membaca isian ABT yang belum diisi (3411, 3413, 3726, 3727, 4823, 9257, 9258) - **biarkan** (terisi sesudah petugas mengisi) |
| ditinjau manual | 6 | 7081 agenda tundaan berikut = kosong bila sidang yang dicetak tidak punya sidang berikut/kata kunci agenda -> **bersyarat sah**; 1252 hubungan saksi ke-2 Tergugat (SIPP perkara_pihak5 saksi_pihak_ke=2) -> **bersyarat sah**; 7078/7110/7153/7005 kedudukan & nama TTD di relaas (98 Relaas): `CASE WHEN LOCATE('E-COURT', "#7017#") > 0 THEN ''` -> kosong menurut jenis relaas yang dipilih di ABT, tidak dapat dibuktikan dari render tanpa pilihan relaas -> **dibiarkan, ditanyakan** |

**Rusak: 0 yang dapat dipastikan** (tidak ada galat SQL, tidak ada penanda mentah di keluaran 35 sampel) - tidak ada perbaikan di paket.
Catatan perbaikan yang mungkin (BELUM dibuat, tanya pengguna): tanggal/hari jawaban, replik, duplik, pembuktian (2111, 2112, 7111-7121)
hanya membaca `perkara_court_calendar` - perkara non-e-Court/tanpa court calendar selalu kosong walau sidangnya ada di jadwal SIPP.

**Tidak dipakai blangko aktif mana pun: 210** variabel data_sql Derry (`variabel-derry-tidak-dipakai-blangko.txt`) - dilaporkan, tidak dihapus.
Agen VARIABEL-SEHAT (w144) memindai semua variabel bermasalah; pindai ini hanya golongan "selalu kosong".
