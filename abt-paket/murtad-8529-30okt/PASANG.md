# Paket ABT `abt-murtad-8529-30okt` - pertimbangan bukti surat cerai verstek untuk huruf alasan H (murtad) (30-31 Okt 2026, G1)

**Status: diuji di basis salinan laptop (`aps_badilag_g1` = salinan `aps_badilag_bas29`, sudah memuat paket alasan-belum-dipilih-30okt).
Server: BELUM dipasang - dipasang sesi utama. URUTAN: SESUDAH `alasan-belum-dipilih-30okt` (urutan bebas terhadap `agama-belum-diubah-30okt`).**

Jawaban pengguna 30 Okt malam butir 48: 8529 (PERTIMBANGAN BUKTI SURAT PERCERAIAN VERSTEK) diberi bunyi untuk huruf H (murtad): bukti surat
perpindahan agama bila ada di daftar bukti, bila tidak bersandar pada keterangan saksi; pihak murtad bisa Tergugat ATAU Penggugat.

## Koreksi temuan sebelumnya
8529 sebenarnya TIDAK bercabang menurut huruf alasan: kalimatnya dipilih menurut daftar bukti surat (#1214#) - memuat KTP -> kalimat P.1/P.2
akta autentik; memuat "Domisili" -> kalimat surat domisili; selainnya cabang terakhir yang sejak paket alasan-belum-dipilih berbunyi
"[HURUF ALASAN PERCERAIAN BELUM DIPILIH]" (dulu "TIDAK BENAR QUERY NYA"). Render 553/Pdt.G/2026 yang dulu saya laporkan sebagai "8529 tidak
punya cabang H" jatuh ke cabang terakhir itu karena daftar buktinya KOSONG, bukan karena hurufnya. Cabang itu TIDAK diubah di paket ini
(mengubahnya mengubah keluaran perkara tanpa huruf H) - lihat "Keputusan sementara" butir 4.

## Isi
- Hanya 8529 (modifier=admin). Kalimat lama TIDAK diubah; paragraf murtad DITAMBAHKAN di bawahnya (CONCAT_WS baris baru) HANYA bila isian
  huruf alasan (8503) memuat H (dibaca seperti 8531: FASAKH/MURTAD = H, huruf A-H sah).
- Pihak yang murtad: (1) agama pihak di SIPP (pihak pertama bukan Islam -> #0046#, pihak kedua -> #0047#; sama dengan 8521/8522/8528/8531);
  (2) bila keduanya masih Islam di SIPP: posita (pola "#0046#/#0047# ... keluar dari agama Islam / murtad / pindah agama / beragama Kristen
  ...", seperti pola pihak sakit paket eg-sakit-28okt); (3) tidak terbaca -> "[AGAMA PIHAK YANG MURTAD BELUM DIUBAH DI SIPP]".
- Agama baru: dari SIPP (Protestan -> Kristen Protestan, Katolik -> Kristen Katolik, Kong Hu Cu -> Khonghucu, Lainnya -> lain selain
  Islam); dari posita bila SIPP belum diubah.
- Bukti: daftar bukti surat memuat "pindah/perpindahan/masuk agama, keluar dari agama, baptis, sidi, sudhi wadani, surat keterangan
  gereja/agama, sertifikat baptis/sidi" -> kalimat bukti surat + saksi; selainnya kalimat keterangan saksi.
- Sebutan pihak dari variabel (#0046#/#0047#); tanpa nama atau satker tertulis mati. Isi baru di `sumber/8529-baru.sql`.

## Bunyi (KEPUTUSAN SEMENTARA - mohon ditinjau)
- Dengan bukti surat: "Menimbang, bahwa dalil {pihak} telah keluar dari agama Islam (*murtad*) dan memeluk agama {agama} dikuatkan oleh
  bukti surat tentang perpindahan agama {pihak} yang telah bermeterai cukup dan dicocokkan dengan aslinya, serta oleh keterangan
  saksi-saksi #0046# yang saling bersesuaian, sehingga harus dinyatakan terbukti bahwa {pihak} telah keluar dari agama Islam;"
- Tanpa bukti surat: "Menimbang, bahwa meskipun tidak diajukan bukti surat tentang perpindahan agama {pihak}, keterangan saksi-saksi #0046#
  yang saling bersesuaian dan berdasarkan pengetahuan saksi sendiri menerangkan bahwa {pihak} telah keluar dari agama Islam (*murtad*)
  dan memeluk agama {agama}, sehingga harus dinyatakan terbukti bahwa {pihak} telah keluar dari agama Islam;"
- Sengaja TIDAK menyebut pasal kekuatan pembuktian (Pasal 285 RBg hanya untuk akta autentik; surat baptis/keterangan gereja umumnya bukan
  akta autentik) dan TIDAK menyebut dasar huruf H (KHI Pasal 116 huruf h; PP 9/1975 Pasal 19 tidak memuat murtad) - dasar itu sudah ada
  di 8522/8532.

## Ukuran
- Banding SEMUA perkara di basis salinan (`alat/banding.js`, mesin variabel ALETA, hanya membaca; isi baru lewat timpaKatalog):
  **10.278 perkara: 10.275 sama persis, 3 berubah - ketiganya perkara berhuruf H** (162, 235, 612/Pdt.G/2026; semuanya Penggugat murtad,
  agama Penggugat di SIPP Hindu/Protestan/Protestan, tanpa bukti surat perpindahan agama -> kalimat keterangan saksi), perkara tanpa H
  berubah 0, galat lama 0 / baru 0. `hasil/banding-ringkasan.json`.
- Render php56 ABT ASLI (`alat/render_murtad.py`, huruf H dan agama pihak diubah SEMENTARA di salinan lalu dikembalikan),
  `hasil/render-ringkasan.json`, blangko [01] Format Lengkap:
  | perkara | keadaan | sesudah paket |
  |---|---|---|
  | CG 235/Pdt.G/2026 | nyata: Penggugat Protestan di SIPP | paragraf murtad 1: Penggugat; 8521 juga Penggugat |
  | CG 235/Pdt.G/2026 | agama SIPP dikembalikan Islam | paragraf murtad 1: Penggugat (dari posita); 8521/8522/8528/8531 "[AGAMA ... BELUM DIUBAH DI SIPP]" |
  | CG 553/Pdt.G/2026 | Tergugat dibuat Protestan | paragraf murtad 1: Tergugat; 8521 Tergugat |
  | CT 274/Pdt.G/2026 | Pemohon dibuat Hindu | paragraf murtad 1: Pemohon; 8521 Pemohon |
  | CT 274/Pdt.G/2026 | Termohon dibuat Katolik | paragraf murtad 1: Termohon; 8521 Termohon |
  | CG 553/Pdt.G/2026 (RTF uji) | kedua pihak Islam, posita tanpa murtad | "[AGAMA ... BELUM DIUBAH DI SIPP]" |
  Sebelum paket: paragraf murtad 0 di semua render. Penanda tersisa 0.
- Siklus pasang/pulih: `hasil/uji-lokal.txt` (2.684 variabel lain tak berubah; pulih = sebelum; pasang ulang 0|1; basis tanpa paket
  alasan-belum-dipilih menjawab 0|0 -> berhenti).

## Keputusan sementara - mohon ditinjau
1. Bunyi dua kalimat di atas.
2. Pola bukti surat perpindahan agama (daftar kata di atas).
3. Posita sebagai cadangan HANYA di 8529; 8521/8522/8528/8531 tetap meminta agama di SIPP diubah (bunyi "[AGAMA ... BELUM DIUBAH DI SIPP]")
   karena amar/akta bergantung data SIPP. Akibatnya naskah dengan agama SIPP belum diubah memuat paragraf 8529 lengkap DAN penanda kurung
   siku di pertimbangan lain (Periksa sebelum cetak menandainya).
4. Cabang terakhir 8529 ("[HURUF ALASAN PERCERAIAN BELUM DIPILIH]" bila daftar bukti tanpa KTP/surat domisili) dibiarkan; usul: diganti
   "[BUKTI SURAT KTP/SURAT DOMISILI BELUM ADA DI DAFTAR BUKTI]" dalam paket terpisah (mengubah perkara tanpa huruf H).

## Pasang / pulih (server, root, dari `paket-satker`)
```
bash pasang-satker.sh   # md5 -> PRASYARAT 1|0 -> cadangan baris 8529 (mysqldump) -> PASANG (1 transaksi, isi hex latin1) -> PERIKSA
bash pulih-satker.sh    # -> PRASYARAT 1|0 = "PULIH COCOK"
```
Laptop: `ABT_LOKAL=1 ABT_DB=<basis salinan> bash pasang-satker.sh`. Bangun ulang: `python sumber/bangun_paket.py <basis salinan sesudah alasan-belum-dipilih>`.
