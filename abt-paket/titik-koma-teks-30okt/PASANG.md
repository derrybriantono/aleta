# Paket ABT `abt-titik-koma-teks-30okt` - titik koma di tengah paragraf TEKS blangko (G6 6.2, 30 Okt 2026)

**Status: dibangun di LAPTOP (server mati). Server: BELUM dipasang. URUTAN: SESUDAH `../hir-rbg-30okt` (md5 dasar = keadaan sesudah paket itu).**
Hanya blangko **derry_briantono**; tidak ada variabel/menu/data yang diubah. Dibangun oleh `../hir-rbg-30okt/sumber/bangun_paket.py`
(aturan `sumber/titik_koma.py`), daftar perbaikan `../hir-rbg-30okt/hasil/titik-koma-diperbaiki.tsv`.

Keputusan pengguna 30 Okt: ";" hanya di akhir butir, ";" di tengah jadi ",". Paket titik-koma-30okt/-data-30okt sudah merapikan ISIAN;
paket ini TEKS BLANGKO. Penggolongan tiap ";" yang masih diikuti teks di paragraf yang sama (pohon sesudah semua paket, blangko aktif):

| golongan | tindakan |
|---|---|
| kutipan-berhuruf (`; (b) ...`, `; dan (e)`, `; (2) bahwa`, `; b. Saudara`) | dibiarkan (benar) |
| pilih-petunjuk (`; (PILIH SALAH SATUNYA ...`, `(APABILA ...`, `(PERTIMBANGAN ...`) | dibiarkan |
| susunan-majelis (`... sebagai Hakim Anggota; dan dibantu`) | dibiarkan |
| akhir-butir (sesudahnya hanya penanda yang hasilnya selalu diawali baris baru `<br>` atau kosong) / akhir-butir-daftar (`...; dan` di akhir butir) | dibiarkan (di cetakan ";" ada di akhir paragraf) |
| penanda-sebaris (sesudahnya penanda yang hasilnya sebaris, mis. `#7084#`, `#8509#`) | dibiarkan - tidak dapat dipastikan dari teks; dilaporkan |
| bahwa-berangkai (`...; bahwa ...` gaya pertimbangan berangkai) | dibiarkan - **keputusan sementara, ditanyakan** |
| **salah-tanda-baca** (`...tidak berhasil; dan oleh karena ...`, `...persidangan; terhadap panggilan ...`, `...; sedangkan Pasal ...`) | **";" -> ","** (722 tempat di 292 berkas) |

Jumlah atas pohon sesudah SEMUA paket 29-30 Okt (1.779 blangko aktif; arsip ALUR*/- BAS * -/terhapus dilewati): salah-tanda-baca 722 (292
berkas, DIPERBAIKI) | penanda-sebaris 516 (362) | akhir-butir 391 (233) | pilih-petunjuk 213 (189) | bahwa-berangkai 132 (63) | kutipan-berhuruf 86
(28) | susunan-majelis 62 (62) | akhir-butir-daftar 23 (12) | lain 13 (10). ("akhir-butir" memakai penanda yang SEMUA cabang keluarannya
diawali `<br>`/kosong menurut kueri - heuristik ketat; yang ragu masuk penanda-sebaris dan dibiarkan.)

## Pasang / pulih (server, root)

```bash
ssh aleta 'mkdir -p /root/abt-titik-koma-teks-20261030'; scp -r paket-satker/* aleta:/root/abt-titik-koma-teks-20261030/
ssh aleta 'bash /root/abt-titik-koma-teks-20261030/pasang-satker.sh'   # SIAP=292 -> TAMBAL=292 -> BERKAS COCOK -> SELESAI
ssh aleta 'bash /root/abt-titik-koma-teks-20261030/pulih-satker.sh'    # PULIH=292 -> BERKAS PULIH -> PULIH COCOK
```
Berkas yang md5-nya bukan keadaan sesudah hir-rbg-30okt -> GAGAL tanpa mengubah apa pun.
