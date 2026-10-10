# Kamus deteksi & rangkaian kata ALETA (kontrak bersama, 10 Okt 2026)

Pola DETEKSI (apa yang dikenali dari teks saksi/posita/gugatan) dan TEMPLAT kalimat (rangkaian kata otomatis)
disimpan sebagai DATA, bukan kode, agar bisa ditambah tanpa rilis. Sumbernya dua lapis:

1. **Benih** - berkas JSON di folder `awal/` ini (ikut citra Docker; folder ini SENGAJA di luar `data/` karena
   `data/` di-mount volume di server dan isinya ditimpa).
2. **Database** (tabel `aleta_*` di Postgres portal) - tambahan/ubahan dari layar Admin "Kamus deteksi & kalimat".
   Baris database dengan `kode` yang sama MENIMPA benih; `status: "nonaktif"` mematikan pola benih.

Kode pemakai SELALU membaca lewat `services/kamusDeteksi.js` (`polaKelompok`, `templatKelompok`), tidak pernah
membaca JSON langsung - agar lapisan database berlaku di mana-mana.

## Berkas benih: `awal/<kelompok>.json`

```json
{
  "kelompok": "alasan",
  "versi": 1,
  "pola": [
    {
      "kode": "alasan-b-nafkah-tidak-memberi",
      "label": "Tidak memberi nafkah",
      "kunci": "B",
      "regex": "tidak\\s+(pernah\\s+)?(memberi|menafkahi)",
      "flags": "i",
      "status": "aktif",
      "yakin": "pasti",
      "contohBenar": ["Tergugat tidak pernah memberi nafkah sejak 2023"],
      "contohSalah": ["Tergugat tidak memberi tahu"],
      "ukur": { "n": 0, "tepat": 0, "salahTangkap": 0, "sumber": "sipp_donggala salinan 9 Okt", "tanggal": "2026-10-10" },
      "catatan": ""
    }
  ],
  "templat": [
    {
      "kode": "saksi-pembuka-lengkap",
      "label": "Pembuka keterangan saksi (lengkap)",
      "gaya": "lengkap",
      "teks": "Bahwa saksi {ke} bernama {nama}, umur {umur} tahun, ... di bawah sumpah pada pokoknya menerangkan:",
      "syarat": {},
      "status": "aktif"
    }
  ]
}
```

- `kelompok` (nama berkas): `alasan`, `waktu`, `pelaku`, `saksi-identitas`, `saksi-hubungan`, `tuntutan`,
  `kalimat-saksi`, `kalimat-hakim`. Kelompok baru boleh ditambah - sebut di laporan.
- `kunci`: arti hasil deteksi menurut kelompoknya (huruf alasan A-K, jenis tuntutan, peran pelaku, dsb.).
- `yakin`: `pasti` HANYA bila `ukur` membuktikan ketepatan >= 95% atas data nyata (n cukup besar, salah tangkap
  dihitung); selain itu `ragu`. Pola tanpa ukuran = `draf`/`ragu`, tidak pernah `pasti`.
- `regex` ditulis untuk `new RegExp(regex, flags)` JavaScript; uji `contohBenar` HARUS cocok dan `contohSalah`
  HARUS tidak cocok (dijaga uji `kamus-deteksi-benih.test`).
- Hal HUKUM (huruf alasan, amar, dasar hukum) selalu usulan untuk diperiksa manusia, sekalipun `pasti`.
