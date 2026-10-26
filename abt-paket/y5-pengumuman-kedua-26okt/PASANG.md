# Paket ABT `abt-y5-pengumuman-kedua-26okt` - tanggal pengumuman ke-2 yang dicatat pada sidang berikutnya (26 Okt 2026)

**Status: DISIAPKAN, BELUM dipasang di ABT server mana pun.** Alur SQL diuji di MySQL laptop (`alat/uji_lokal.sh`: PASANG, PERIKSA, pasang ulang = 0 baris, PULIH = md5 kembali sama dengan server, pasang lagi); query baru diukur BACA SAJA di server (`alat/uji_server.py`).

Satu variabel: `7063` "WAKTU PANGGILAN RADIO OTOMATIS" (`modifier` tetap `admin`). Tidak ada blangko (RTF), menu, atau isian per perkara yang disentuh.

## Sebab
Perkara 322/Pdt.G/2026/PA.Dgl (perkara_id 9824), Tergugat dipanggil ghaib: pengumuman ke-1 (R, 10 Agustus 2026) tercatat pada sidang pertama (`sidang_id` 19291), pengumuman ke-2 (W, 13 Oktober 2026) pada sidang kedua (`sidang_id` 20381). Variabel lama hanya membaca relaas pada SATU sidang (sidang dengan relaas paling awal), sehingga tanggal ke-2 tidak ketemu dan tercetak `...` di duduk perkara (`#8508#`/`#8547#`) dan pertimbangan hukum (`#8526#`): "pada tanggal 10 Agustus 2026 dan ...".

## Perbaikan
Tanggal ke-2 = (cara lama: tanggal kedua pada sidang yang sama) bila ada; bila tidak, tanggal relaas pengumuman berbeda berikutnya (R/M/W/P, pihak kedua, bukan sidang ikrar, tidak sesudah putusan) pada sidang mana pun. Isian 8564 (diisi tangan) tetap menang.

## Hasil ukur (server, baca saja, 26 Okt)
67 perkara punya relaas R/M/W/P: **61 hasil tetap sama**, **6 berubah dan semuanya dari `...` menjadi tanggal terisi** (8552, 8704, 8844, 9428, 9587, 9824); 0 galat; 0 perubahan selain itu. 9824: `10 Agustus 2026 dan ...` menjadi `10 Agustus 2026 dan 13 Oktober 2026`.

## Pasang (Git Bash, server hidup)
```bash
cd /d/aleta-dev/wt/w87/abt-paket/y5-pengumuman-kedua-26okt
ssh aleta 'mkdir -p /root/abt-y5-20261026'
scp -r paket-satker/* aleta:/root/abt-y5-20261026/
ssh aleta 'cd /root/abt-y5-20261026 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-y5-20261026/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (1)`, `CADANGAN: ... (1 baris lama)`, `SEMUA COCOK`, `SELESAI`. Pulih: `bash /root/abt-y5-20261026/pulih-satker.sh` (akhir `PULIH COCOK`). Pasang tidak mengubah blangko; ia aman dipasang kapan saja (perkara tanpa relaas ke-2 tetap tercetak `...`).

Bangun ulang: `python3 alat/bangun_paket.py` (uji `paket-y5-pengumuman-kedua-26okt.test.ts` menjaga berkas paket tidak basi).
