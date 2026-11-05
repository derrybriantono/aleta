import { createHash } from "node:crypto";

import type { Tambalan } from "@/lib/aleta-abt-sinkron";
import { TAMBAL_RTF_PY } from "@/server/modules/aleta-abt-sinkron/tambal-rtf-py";

/**
 * ============================================================================
 * PAKET UBAHAN UNTUK ABT (5 Nov 2026, Tahap 9) - HANYA BERKAS, TIDAK DIPASANG
 * ============================================================================
 *
 * Bentuknya mengikuti paket ABT di abt-paket/ (contoh: audit-ejaan-4nov): folder paket-satker berisi tambal_rtf.py,
 * daftar-tambal.tsv, tambal.tsv, pasang-satker.sh, pulih-satker.sh, MD5SUMS.txt, ditambah PASANG.md. Yang diubah hanya blangko
 * pengguna derry_briantono, lewat potongan (offset, teks lama, teks baru) atas berkas yang md5-nya PERSIS md5 dasar; satu berkas
 * saja yang berbeda = pemasangan berhenti tanpa mengubah apa pun.
 *
 * Isinya tidak memuat nama aplikasi (keputusan lama: tidak satu kata pun tentang aplikasi masuk ke ABT/SIPP), dijaga uji.
 * Berkas ini tidak menulis ke mana pun; pemasangan di server dilakukan pemilik sendiri sesudah meninjau.
 */

export const FOLDER_BLANGKO_DERRY = "derry_briantono";

export type ButirPaket = {
  /** Jalur relatif di folder derry_briantono (= id blangko di pustaka). */
  id: string;
  lama: Buffer;
  baru: Buffer;
  potongan: Tambalan[];
};

export type BerkasPaket = { jalur: string; isi: Buffer };

const md5 = (b: Buffer | string) => createHash("md5").update(b).digest("hex");
const b64 = (b: Buffer) => b.toString("base64");

/** Nama paket sah: huruf kecil, angka, strip. */
export function namaPaketSah(tanggal: string): string {
  const t = tanggal.replace(/[^0-9]/g, "").slice(0, 8);
  return `abt-ubahan-${t || "tanpa-tanggal"}`;
}

const kodeButir = (i: number) => `U${String(i + 1).padStart(4, "0")}`;

function skripPasang(nama: string, jumlah: number): string {
  return `#!/bin/bash
# =============================================================================
# PASANG paket ABT "${nama}" (ubahan blangko hasil tinjauan). Dijalankan DI SERVER sebagai root, dari folder paket. HANYA blangko
# pengguna derry_briantono (${jumlah} berkas), lewat potongan teks. Tanpa variabel, menu, fungsi, tabel, atau data yang diubah.
# Urutan: md5 paket -> CEK berkas (md5 tiap berkas PERSIS md5 dasar di daftar-tambal.tsv; satu saja beda = BERHENTI, tidak ada yang
#         diubah) -> PASANG (cadangan utuh tiap berkas di cadangan/rtf-lama, tulis atomik, baca ulang) -> PERIKSA. Gagal = pulih otomatis.
# Laptop: ABT_BLANGKO=<_blangko_abt uji> PY=python bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=${nama}
CAD="$SINI/cadangan"
B="\${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
PY="\${PY:-python}"
gagal() { echo "GAGAL: $*"; exit 1; }

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp"
[ -d "$B/derry_briantono" ] || gagal "folder $B/derry_briantono tidak ada - TIDAK ada yang diubah"

# --- 1. PRASYARAT = md5 berkas (baca saja) ----------------------------------------------------------------------------
c=$($PY tambal_rtf.py cek "$B"); echo "$c" | tail -20
[ "$(echo "$c" | tail -1 | tr -d '\\r')" = "BERKAS SIAP" ] || gagal "ada berkas yang sudah berbeda dari dasar paket (disunting di ABT sesudah paket dibuat) - TIDAK ada yang diubah"
echo "PRASYARAT COCOK"

# --- 2. PASANG ----------------------------------------------------------------------------------------------------------
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
$PY tambal_rtf.py pasang "$B" "$CAD" > "$CAD/berkas-pasang.txt"
if [ "$?" != "0" ]; then
  cat "$CAD/berkas-pasang.txt"
  $PY tambal_rtf.py pulih "$B" "$CAD"
  gagal "berkas tidak terpasang - dikembalikan (lihat $CAD/berkas-pasang.txt)"
fi
tail -1 "$CAD/berkas-pasang.txt"

# --- 3. PERIKSA ---------------------------------------------------------------------------------------------------------
$PY tambal_rtf.py periksa "$B" > "$CAD/berkas-periksa.txt"
tail -1 "$CAD/berkas-periksa.txt"
if [ "$(tail -1 "$CAD/berkas-periksa.txt" | tr -d '\\r')" != "BERKAS COCOK" ]; then
  $PY tambal_rtf.py pulih "$B" "$CAD"
  gagal "periksa berkas tidak cocok - berkas dikembalikan"
fi
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
`;
}

function skripPulih(nama: string): string {
  return `#!/bin/bash
# PULIH paket ABT "${nama}" - tanpa hapus permanen: berkas yang ditambal paket ini dikembalikan dari cadangan HANYA bila isinya
# masih persis isi paket (yang sudah disunting orang dibiarkan dan dilaporkan). Baris terakhir harus "PULIH COCOK".
# Laptop: ABT_BLANGKO=<_blangko_abt uji> PY=python bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
CAD="$SINI/cadangan"
B="\${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
PY="\${PY:-python}"
mkdir -p "$CAD"
$PY tambal_rtf.py pulih "$B" "$CAD" || { echo "GAGAL: pulih berkas"; exit 1; }
c=$($PY tambal_rtf.py cek "$B")
if [ "$(echo "$c" | tail -1 | tr -d '\\r')" = "BERKAS SIAP" ] && ! echo "$c" | grep -q "SUDAH="; then echo "PULIH COCOK"; else echo "$c" | tail -20; echo "PULIH SEBAGIAN"; exit 1; fi
`;
}

function berkasPetunjuk(nama: string, tanggal: string, butir: ButirPaket[], potonganTotal: number): string {
  const baris = butir
    .map((b, i) => `| ${kodeButir(i)} | ${b.id.replace(/\|/g, "/")} | ${b.potongan.length} |`)
    .join("\n");
  return `# Paket ABT \`${nama}\` - ubahan blangko hasil tinjauan (${tanggal})

**Status: HANYA BERKAS. Belum dipasang ke ABT mana pun dan pemasangannya belum pernah diuji.** Dibuat dari layar Beda dengan ABT di
portal: isi tiap blangko di bawah dibandingkan dengan isi ABT yang menjadi dasarnya, lalu bedanya disimpan sebagai potongan teks.
Hanya blangko pengguna **derry_briantono** (${butir.length} berkas, ${potonganTotal} potongan). Tanpa variabel, menu, fungsi, tabel, atau
data yang diubah; tanpa kata nama aplikasi di dalam isi yang masuk ke ABT.

## Isi
| kode | blangko | potongan |
|---|---|---|
${baris}

## Dasar md5 (PRASYARAT)
Tiap berkas di ABT harus PERSIS berisi md5 dasar di \`paket-satker/daftar-tambal.tsv\` (kolom md5_lama). Bila satu saja berbeda
(blangko itu disunting di ABT sesudah paket dibuat) pemasangan BERHENTI tanpa mengubah apa pun; jangan dipaksa. Buat ulang paket
dari layar Beda dengan ABT sesudah sinkron.

## Tinjau dulu
- \`paket-satker/daftar-tambal.tsv\`: berkas, md5 dasar, md5 hasil, jumlah potongan.
- \`paket-satker/tambal.tsv\`: kode, offset, teks lama (base64), teks baru (base64) - atas berkas dasar.
- Periksa isinya dengan membaca potongan, bukan dengan memasang.

## Pasang (Git Bash, SESUDAH ditinjau dan disetujui pemilik)
Ganti \`SERVER\` dengan nama sambungan ssh ke server ABT (yang sama dengan pemasangan paket-paket ABT sebelumnya).
\`\`\`bash
ssh SERVER 'mkdir -p /root/${nama}'
scp -r paket-satker/* SERVER:/root/${nama}/
ssh SERVER 'cd /root/${nama} && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh SERVER 'bash /root/${nama}/pasang-satker.sh'
\`\`\`
Keluaran benar: \`PRASYARAT COCOK\`, \`BERKAS COCOK\`, \`SELESAI\`. Pulih: \`ssh SERVER 'bash /root/${nama}/pulih-satker.sh'\` -> \`PULIH COCOK\`
(berkas yang disunting sesudah dipasang dibiarkan dan dilaporkan).
`;
}

/** Susun isi paket sebagai daftar berkas (jalur di dalam folder paket). Semua teks LF dan ASCII/UTF-8. */
export function susunPaket(tanggal: string, butir: ButirPaket[]): { nama: string; berkas: BerkasPaket[]; potongan: number } {
  const nama = namaPaketSah(tanggal);
  const daftar = ["# kode\tberkas\tmd5_lama (isi ABT yang menjadi dasar)\tmd5_baru\tpotongan"];
  const tambal = ["# kode\toffset\tb64(teks lama)\tb64(teks baru)"];
  let total = 0;
  butir.forEach((b, i) => {
    const kode = kodeButir(i);
    daftar.push([kode, `${FOLDER_BLANGKO_DERRY}/${b.id}`, md5(b.lama), md5(b.baru), String(b.potongan.length)].join("\t"));
    for (const p of b.potongan) tambal.push([kode, String(p.offset), b64(p.lama), b64(p.baru)].join("\t"));
    total += b.potongan.length;
  });
  const isiDaftar = Buffer.from(`${daftar.join("\n")}\n`, "utf8");
  const isiTambal = Buffer.from(`${tambal.join("\n")}\n`, "ascii");
  const isiPy = Buffer.from(TAMBAL_RTF_PY, "utf8");
  const isiPasang = Buffer.from(skripPasang(nama, butir.length), "utf8");
  const isiPulih = Buffer.from(skripPulih(nama), "utf8");
  const sidik = [
    ["tambal_rtf.py", isiPy],
    ["daftar-tambal.tsv", isiDaftar],
    ["tambal.tsv", isiTambal],
    ["pasang-satker.sh", isiPasang],
    ["pulih-satker.sh", isiPulih],
  ] as const;
  const isiSidik = Buffer.from(`${sidik.map(([n, b]) => `${md5(b)} *${n}`).join("\n")}\n`, "utf8");
  const tgl = /^\d{4}-\d{2}-\d{2}/.test(tanggal) ? tanggal.slice(0, 10) : tanggal;
  const berkas: BerkasPaket[] = [
    { jalur: `${nama}/PASANG.md`, isi: Buffer.from(berkasPetunjuk(nama, tgl, butir, total), "utf8") },
    ...sidik.map(([n, b]) => ({ jalur: `${nama}/paket-satker/${n}`, isi: b })),
    { jalur: `${nama}/paket-satker/MD5SUMS.txt`, isi: isiSidik },
  ];
  return { nama, berkas, potongan: total };
}
