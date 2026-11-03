# Paket ABT `abt-in-lupa-prosesi-3nov` - blangko Derry BARU "[01f] [Kabul] IN Kabul (Hadir Tapi Lupa Prosesi Nikah)" (3 Nov 2026)

**Status: dibangun dan diuji di LAPTOP. Server: BELUM dipasang - dipasang sesi utama (persetujuan pengguna: keputusan 156).**
Urutan: sesudah 33 paket yang terpasang 2 Nov 18.40 (`../URUTAN-PASANG-1nov.md`); tidak bergantung paket lain - hanya MENAMBAH satu berkas.
Hanya blangko **derry_briantono**; tanpa variabel, menu, fungsi, atau tabel baru; tanpa berkas lama yang diubah. Tanpa kata "Aleta"/"ALETA".

| berkas | isi |
|---|---|
| `paket-satker/rtf/derry_briantono/2 Itsbat Nikah/[01f] [Kabul] IN Kabul (Hadir Tapi Lupa Prosesi Nikah).rtf` | dari `[01] [Kabul] IN.rtf` (md5 `a1a7b90f11665e64621d71bee733e1a9`, sama di server 3 Nov dan cadangan 2 Nov 18.50) |
| `abt-in-lupa-prosesi-3nov-PRASYARAT.sql` | baca saja: 82 variabel yang dirujuk ada di `abt_variabel` (`nomor-dirujuk.txt`; semuanya sudah dipakai [01]) |
| `berkas_rtf.py`, `pasang-satker.sh`, `pulih-satker.sh`, `daftar-rtf.tsv`, `folder-ada.txt`, `MD5SUMS.txt` | pola paket `blangko-ikrar-92-28okt`: md5 -> folder ada -> prasyarat -> cek berkas -> pasang -> periksa; gagal = pulih otomatis |

Folder `2 Itsbat Nikah` sudah punya menu ABT (menu Itsbat Nikah); ABT membaca isi folder saat dibuka, jadi `[01f]` ikut tampil tanpa
ubahan `abt_menu`. Nomor `[01f]` belum dipakai (yang ada [01] [01a] [01b] [01d] [01e]). Berkas lain bernama sama = GAGAL, tidak ditimpa.

## Isi (yang berbeda dari [01])
- **Fakta hukum** butir 3-7 lama (wali, yang menikahkan, saksi nikah, mahar, ijab kabul tanpa jeda - tidak diketahui saksi) menjadi:
  3. menurut dalil permohonan: wali `#1046#`, yang menikahkan `#8087#`, saksi nikah `#0650#`/`#0651#`, mahar `#1001#`;
  4. saksi-saksi menghadiri pesta, tidak mengikuti prosesi akad, tidak tahu wali/lafadz akad/mahar/saksi nikah;
  5. hidup rukun dan `#0007#` (anak: "telah dikaruniai ... orang anak ..." / "belum dikaruniai anak"), tetap suami istri, tidak bercerai, tidak pindah agama.
  Butir lama 8-11 menjadi 6-9 (butir 7: "termasuk masyarakat setempat"; butir 8: P I tidak beristri lain, P II tidak bersuami lain).
- **Pertimbangan**: paragraf "fakta para #0046# melangsungkan perkawinan ... bunyinya sebagai berikut:" diganti empat paragraf pengguna
  (tangkapan layar 3 Nov) + pengantar dalil I'anatut Thalibin; gambar teks Arab I'anatut Thalibin dan Bughyatul Mustarsyidin = gambar yang
  sudah ada di [01] (tidak diubah, tampil kanan-ke-kiri di Word); terjemahan I'anatut Thalibin kedua mengikuti rumusan pengguna.
- Sebutan hakim `#8554#` (Hakim / Majelis Hakim menurut SIPP, sama dengan [01]); tempat `#5105#`; anak `#0007#`. Identitas, duduk perkara,
  amar kabul, biaya: sama dengan [01].

## Pasang / pulih (server, root)
```bash
cd /d/.../abt-paket/in-lupa-prosesi-3nov && rm -rf paket-satker/cadangan
ssh aleta 'mkdir -p /root/abt-in-lupa-prosesi-20261103'
scp -r paket-satker/* aleta:/root/abt-in-lupa-prosesi-20261103/
ssh aleta 'cd /root/abt-in-lupa-prosesi-20261103 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-in-lupa-prosesi-20261103/pasang-satker.sh'
ssh aleta 'cd "/var/www/html/aps_badilag/_blangko_abt/derry_briantono/2 Itsbat Nikah" && ls -l "[01f]"* && md5sum "[01f]"*'
```
Keluaran benar: `PRASYARAT COCOK (82)`, `BERKAS SIAP`, `BUAT=1`, `COCOK=1`, `BERKAS COCOK`, `SELESAI`. Pasang ulang: `COCOK=1 ... SELESAI` (tidak mengubah apa pun).
Pulih: `ssh aleta 'bash /root/abt-in-lupa-prosesi-20261103/pulih-satker.sh'` -> `HAPUS=1`, `PULIH COCOK` (berkas yang sudah disunting sesudah
dipasang dibiarkan dan dilaporkan). Tidak perlu memulai ulang apa pun. Sesudah dipasang: cetak satu kali dari menu ABT Itsbat Nikah.

## Uji (laptop)
- `hasil/uji-lokal.txt`: pasang, pasang ulang (idempoten), pulih (= sidik awal persis), gagal berkas bernama sama, gagal prasyarat, sunting lalu pulih (dibiarkan).
- Render: `hasil/render.md` (renderer ABT php56 asli atas perkara itsbat laptop: 0 penanda mentah; render REKAAN lewat mesin variabel ALETA -> PDF Word).
- Penjaga repo: `manajemen_surat/src/test/in-lupa-prosesi-3nov.test.ts`.

## Membangun ulang
`python sumber/bangun_paket.py [akar pohon derry_briantono]` (bawaan `D:/Aplikasi/aleta/tmp/w194/pohon/derry_briantono` = ekstrak
`D:/aleta-dev/cadangan-db/aplikasi-20261102-185007/blangko-derry-briantono.tar.gz`). Deterministik; berhenti bila md5 [01] berubah,
teks dasar tidak tunggal, gambar Arab berubah jumlah, atau salah ketik/teks terlarang tersisa.

## Katalog saksi (bukan bagian paket ABT; ikut rilis ekstensi)
`sumber/katalog_pesta.py` menambah pilihan "Saksi hanya hadir di pesta pernikahan, tidak tahu prosesi akad nikah" (keadaan
`bentukKesaksian` = `pesta`) di `ekstensi-sipp/saksi-katalog/itsbat-nikah.json` dan `cerai-kumulasi-itsbat.json`, lalu
`node manajemen_surat/scripts/susun-saksi-katalog.mjs`.
