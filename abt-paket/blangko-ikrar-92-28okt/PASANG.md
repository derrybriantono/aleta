# Paket ABT `abt-blangko-ikrar-92-28okt` - blangko Derry BARU penetapan Rukun Kembali pada sidang ikrar talak (28 Okt 2026)

**Status: teruji di LAPTOP (prasyarat, pasang, pasang ulang, pulih = keadaan awal persis, dua jalur gagal; render dengan mesin variabel ALETA atas perkara nyata `sipp_donggala`). Server: BELUM dipasang - dipasang sesi utama.**
Keputusan pengguna P4a (28 Okt 2026): status 3 borang SIPP "Penetapan Ikrar Talak" (Rukun Kembali) diberi blangko e-Doc sendiri. Tanpa kata "Aleta"/"ALETA" di ABT.

## Isi (`paket-satker/`)

| berkas | isi |
|---|---|
| `rtf/derry_briantono/1a Perceraian CT/[92] [Ikrar Rukun] Penetapan Rukun Kembali - P Hadir & T Tidak Hadir.rtf` | dari `[90]` (Pemohon hadir, Termohon tidak) |
| `rtf/derry_briantono/1a Perceraian CT/[92a] [Ikrar Rukun] Penetapan Rukun Kembali - P & T Hadir.rtf` | dari `[90a]` (keduanya hadir) |
| `abt-blangko-ikrar-92-28okt-PRASYARAT.sql` | baca saja: jumlah dari **27** variabel yang dirujuk kedua blangko yang ada di `abt_variabel` - harus `27` (`nomor-dirujuk.txt`) |
| `berkas_rtf.py`, `pasang-satker.sh`, `pulih-satker.sh`, `daftar-rtf.tsv`, `folder-ada.txt`, `MD5SUMS.txt` | urutan: md5 -> folder ada -> prasyarat -> cek berkas -> pasang -> periksa; gagal sesudah pasang = pulih otomatis |

**Tidak ada** variabel, menu, `abt_menu`, atau berkas lama yang diubah: folder `1a Perceraian CT` sudah ada (menu "Putusan Cerai Talak", proses 80-297), dan ABT membaca isi folder saat dibuka. Berkas yang sudah ada bernama sama tetapi isinya lain = GAGAL, tidak ditimpa.

## Isi blangko (teks; gaya RTF persis `[90]`/`[90a]`)

Kepala, identitas (`#7062#`), kutipan amar putusan (`#9500#`), PHS ikrar, kehadiran, dan penutup (`#9218#` tanda tangan majelis ikrar, rincian biaya) sama dengan `[90]`/`[90a]`. Yang diganti:
- "Telah mendengar keterangan #0046# di persidangan;"
- nasihat: #0046# menyatakan telah rukun kembali dan tidak akan mengucapkan ikrar talak;
- ikrar talak hak #0046# atas kehendaknya sendiri -> tidak dijatuhkan, perkawinan tetap utuh;
- tujuan perkawinan sakinah, mawaddah, rahmah (Pasal 3 KHI);
- perkara tidak dapat dilanjutkan dan dicoret dari register; permohonan untuk tidak menjatuhkan ikrar talak patut dikabulkan;
- `[92]`: kalimat Pasal 70 ayat (5) (ikrar tanpa hadirnya istri) dibuang; `[92a]`: kalimat keadaan istri (`#9219#`) dan isian tersembunyi `#9220#` dibuang;
- AMAR (sama dengan amar SIPP status 3 yang disusun ALETA, `ikrarTalakService.susunAmarIkrar`, dan amar petugas perkara 9596): 1. Mengabulkan permohonan #0046# untuk tidak menjatuhkan ikrar talak terhadap #0047#; 2. Menyatakan perkara Nomor #0001# tidak dapat dilanjutkan; 3. Memerintahkan Panitera #8008# untuk mencoret perkara Nomor #0001# dari register perkara; 4. biaya (#1101#/#2050#, sama dengan [90]).
Lafal ikrar, jenis talak (`#9215#`), dan "putus karena perceraian" tidak ada (pembangun berhenti bila tertinggal).

## Pasang (Git Bash, server hidup)

```bash
cd /d/.../abt-paket/blangko-ikrar-92-28okt           # folder repo hasil gabung
rm -rf paket-satker/cadangan                          # cadangan uji laptop JANGAN ikut tersalin
ssh aleta 'mkdir -p /root/abt-blangko-ikrar-92-20261028'
scp -r paket-satker/* aleta:/root/abt-blangko-ikrar-92-20261028/
ssh aleta 'cd /root/abt-blangko-ikrar-92-20261028 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-blangko-ikrar-92-20261028/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (27)`, `BERKAS SIAP`, `BUAT=2`, `COCOK=2`, `BERKAS COCOK`, `SELESAI`. Pasang ulang: `SUDAH_BARU=2` ... `SELESAI`.
Pulih: `ssh aleta 'bash /root/abt-blangko-ikrar-92-20261028/pulih-satker.sh'` (akhir `PULIH COCOK`; berkas yang sudah disunting sesudah dipasang dibiarkan dan dilaporkan). Tidak perlu memulai ulang apa pun.

## Hasil uji (28 Okt 2026, laptop)

- Basis uji `aps_badilag_ikrar` (milik agen ini: `abt_variabel` 2.677 baris + 49 fungsi disalin dari `aps_badilag_ps0` = keadaan server sesudah paket 27 Okt), akar blangko uji `D:/b92/derry_briantono/1a Perceraian CT` (salinan folder server). Perintah: `PATH=<xampp mysql/bin>:$PATH ABT_LOKAL=1 ABT_DB=aps_badilag_ikrar ABT_BLANGKO=D:/b92 PY=python bash pasang-satker.sh` dari salinan paket di jalur pendek (`D:/p92`).
- Siklus: pasang (`PRASYARAT COCOK (27)`, `BUAT=2`, `BERKAS COCOK`) -> pasang ulang (`SUDAH_BARU=2`, idempoten) -> pulih (`HAPUS=2`, `PULIH COCOK`; sidik isi folder kembali PERSIS awal `dda32f943e15`) -> **gagal 1**: variabel 9218 dihapus dari basis uji -> `GAGAL: prasyarat '26'`, folder tidak berubah -> **gagal 2**: berkas lain bernama `[92] ...` sudah ada -> `GAGAL: berkas lain bernama sama`, tidak ditimpa -> pasang lagi = sama dengan pasang pertama (sidik `351a4f2a1557`).
- Render (`alat/uji_render.js`, mesin variabel ALETA yang sama dengan e-Doc ikrar, baca saja): perkara 9596 (status 3 sungguhan) `[92]`/`[92a]` dan 9988/9812 (status 1): **0 galat, 0 penanda mentah, tanpa kata aplikasi**; isian kosong `[92]`/`[92a]` = persis yang juga kosong pada `[90]` di laptop yang sama (`#1090#`, `#7062#` - keadaan data/basis laptop, bukan blangko baru). `[90a]` laptop juga kosong `#9220#` (isian keadaan istri) - di `[92a]` isian itu dibuang.
- Uji perilaku di repo: `manajemen_surat/src/test/ikrar-putus-menu-28okt.test.ts` (pemilihan `[92]`/`[92a]` menurut kehadiran, PDF ber-TTD, RTF cadangan).

## Yang dipasang di ALETA (repo, bukan server ABT)
`aleta_bot/services/ikrarEdocService.js` (status 3 -> `[92]`/`[92a]`), `manajemen_surat/src/lib/rekomendasi-blangko.ts` (saran blangko bila hasil sidang "rukun kembali"). Sebelum paket ini terpasang, e-Doc status 3 gagal `blangko_tidak_terbaca` dan dilaporkan; form SIPP-nya tetap benar.

## Membangun ulang
`python sumber/bangun_paket.py [akar pohon derry_briantono]` (bawaan `D:/aleta-dev/kerja/w3a/asli/derry_briantono`; md5 `[90]`/`[90a]` diperiksa = pohon server `u2b-cerai-susulan/data/pohon-asli-md5.tsv`). Deterministik.

## Belum / batas (jujur)
- Belum dicetak lewat ABT php56 asli (render memakai mesin variabel ALETA). Cetak satu kali dari menu ABT "Putusan Cerai Talak" di server sesudah dipasang.
- Belum ada perkara rukun kembali sesudah fitur ini; uji manual satu perkara di SIPP satker (tab Ikrar Talak + Cetak e-Doc) wajib.
