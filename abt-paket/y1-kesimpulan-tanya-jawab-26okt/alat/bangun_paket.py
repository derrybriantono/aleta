#!/usr/bin/env python3
"""
Membangun paket ABT y1-kesimpulan-tanya-jawab-26okt (rancangan 26 Okt 2026; BELUM dipasang di ABT mana pun).

Empat variabel tanya_jawab baru, kembaran persis jawaban/replik lisan (6112, 6113, 2018, 2019):
  4950  Kesimpulan Lisan #0046#               penyunting (multi_sidang 'tanyajawab'), referensi 0098   <- salinan 6113
  4951  Kesimpulan Lisan #0047#               penyunting, referensi 0102                              <- salinan 6112
  4952  Keterangan Kesimpulan Lisan #0046#    tampil/cetak (multi_sidang 'keterangan'), referensi 0098 <- salinan 2019
  4953  Keterangan Kesimpulan Lisan #0047#    tampil/cetak, referensi 0102                             <- salinan 2018

Barisnya DISALIN dari variabel saudaranya (INSERT ... SELECT) dengan no_var dan nama diganti, sehingga setiap kolom lain
(tipe, NULL atau kosong, referensi, multi_sidang, locked, modifier) persis kebiasaan ABT. Tidak ada UPDATE/DELETE pada baris
lama; tidak ada blangko (RTF), menu, atau isian per perkara yang disentuh.

Jalankan dari folder paket:  python3 alat/bangun_paket.py
"""
import hashlib
import os

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KELUAR = os.path.join(AKAR, "paket-satker")
JATAH = (4950, 4959)
NAMA_PAKET = "abt-y1-kesimpulan-tanya-jawab-26okt"

# (no_var baru, nama baru, no_var saudara, nama saudara yang diharapkan, referensi, multi_sidang)
BARIS = [
    (4950, "Kesimpulan Lisan #0046#", 6113, "Replik Lisan #0046#", 98, "tanyajawab"),
    (4951, "Kesimpulan Lisan #0047#", 6112, "Jawaban Lisan #0047#", 102, "tanyajawab"),
    (4952, "Keterangan Kesimpulan Lisan #0046#", 2019, "Keterangan Replik Lisan #0046#", 98, "keterangan"),
    (4953, "Keterangan Kesimpulan Lisan #0047#", 2018, "Keterangan Jawaban Lisan #0047#", 102, "keterangan"),
]


def md5(teks: str) -> str:
    return hashlib.md5(teks.encode("latin1")).hexdigest()


def kondisi_saudara() -> str:
    bagian = []
    for _, _, sau, nama_sau, ref, multi in BARIS:
        bagian.append(
            f"(no_var = {sau} AND nama = '{nama_sau}' AND data_type = 'tanya_jawab' AND referensi = {ref} AND multi_sidang = '{multi}')"
        )
    return " OR ".join(bagian)


def pasang() -> str:
    awal, akhir = JATAH
    k = []
    k.append(f"-- Paket ABT y1-kesimpulan-tanya-jawab-26okt (rancangan 26 Okt 2026): variabel tanya_jawab {awal}-{akhir} untuk kesimpulan lisan para pihak.")
    k.append("-- Dijalankan: mysql --default-character-set=latin1 aps_badilag < abt-y1-kesimpulan-tanya-jawab-26okt-PASANG.sql")
    k.append("-- Empat baris disalin dari variabel saudaranya (6112, 6113, 2018, 2019); tidak ada UPDATE/DELETE, tidak ada blangko yang disentuh.")
    k.append("")
    k.append("SET NAMES latin1;")
    k.append("-- PRASYARAT: berhenti dengan galat \"Subquery returns more than 1 row\" bila (a) jatah sudah terpakai, (b) ada variabel lain bernama sama,")
    k.append("-- atau (c) keempat variabel saudara tidak persis seperti yang diukur. Tidak ada yang ditulis.")
    k.append(
        "SELECT IF("
        f"(SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN {awal} AND {akhir}) = 0 "
        "AND (SELECT COUNT(*) FROM abt_variabel WHERE nama LIKE 'Kesimpulan Lisan%' OR nama LIKE 'Keterangan Kesimpulan Lisan%') = 0 "
        f"AND (SELECT COUNT(*) FROM abt_variabel WHERE {kondisi_saudara()}) = {len(BARIS)}, "
        "'PRASYARAT COCOK - memasang', (SELECT 'PRASYARAT GAGAL' UNION SELECT 'BERHENTI')) AS prasyarat;"
    )
    k.append("")
    k.append("START TRANSACTION;")
    for no, nama, sau, _, _, _ in BARIS:
        k.append(f"-- {no}: salinan {sau}")
        k.append(
            "INSERT INTO abt_variabel (no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier, modified) "
            f"SELECT {no}, '{nama}', data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier, NOW() "
            f"FROM abt_variabel WHERE no_var = {sau};"
        )
    k.append("COMMIT;")
    k.append(f"SELECT COUNT(*) AS variabel_terpasang FROM abt_variabel WHERE no_var IN ({', '.join(str(b[0]) for b in BARIS)});")
    return "\n".join(k) + "\n"


def periksa() -> str:
    potongan = []
    for no, nama, sau, _, ref, multi in BARIS:
        potongan.append(
            f"SELECT {no} AS no_var, (SELECT COUNT(*) FROM abt_variabel v WHERE v.no_var = {no} AND MD5(v.nama) = '{md5(nama)}' "
            f"AND v.data_type = 'tanya_jawab' AND v.referensi = {ref} AND v.multi_sidang = '{multi}' "
            f"AND EXISTS (SELECT 1 FROM abt_variabel s WHERE s.no_var = {sau} AND s.data_tabel <=> v.data_tabel AND s.data_kolom <=> v.data_kolom "
            "AND s.urutan_data <=> v.urutan_data AND s.sql_query <=> v.sql_query AND s.default_data <=> v.default_data "
            "AND s.locked <=> v.locked AND s.modifier <=> v.modifier)) AS cocok"
        )
    isi = "\nUNION ALL\n".join(potongan)
    awal, akhir = JATAH
    k = []
    k.append("-- Periksa hasil pemasangan: tiap baris cocok = 1; baris terakhir keluaran harus \"SEMUA COCOK\".")
    k.append(f"SELECT no_var, cocok FROM (\n{isi}\n) c;")
    k.append(
        "SELECT IF(SUM(cocok) = "
        f"{len(BARIS)} AND (SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN {awal} AND {akhir}) = {len(BARIS)}, 'SEMUA COCOK', 'ADA YANG TIDAK COCOK') AS hasil FROM (\n{isi}\n) c;"
    )
    return "\n".join(k) + "\n"


def pulih() -> str:
    awal, akhir = JATAH
    return (
        f"-- PEMULIHAN paket y1-kesimpulan-tanya-jawab-26okt: hapus variabel baru {awal}-{akhir} (isian petugas pada variabel ini ikut hilang; paket belum dipakai blangko mana pun).\n"
        f"DELETE FROM abt_variabel WHERE no_var BETWEEN {awal} AND {akhir};\n"
        f"SELECT COUNT(*) AS sisa_baris_baru FROM abt_variabel WHERE no_var BETWEEN {awal} AND {akhir};\n"
    )


SH_PASANG = """#!/bin/bash
# =============================================================================
# PASANG paket ABT "y1-kesimpulan-tanya-jawab-26okt" di SATKER (dijalankan DI SERVER, sebagai root, dari folder paket ini).
# BELUM dijalankan di mana pun (rancangan 26 Okt 2026). Urutan: prasyarat -> CADANG -> PASANG -> PERIKSA (gagal = hapus variabel baru).
# Hanya 4 baris abt_variabel yang ditambah; tidak ada blangko (RTF) yang diubah.
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
CAD="$SINI/cadangan"
gagal() { echo "GAGAL: $*"; exit 1; }

MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
export MYSQL_PWD
MY="mysql -h 127.0.0.1 -u root --default-character-set=latin1 aps_badilag"

[ -e "$CAD/abt_variabel-seluruhnya-sebelum.sql" ] && gagal "cadangan lama sudah ada di $CAD - paket ini sudah pernah dijalankan? Periksa dulu, jangan timpa cadangan"
N=$($MY -N -e "SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN 4950 AND 4959")
[ "$N" = "0" ] || gagal "jatah 4950-4959 sudah terpakai ($N baris) - TIDAK ada yang diubah"

mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
mysqldump -h 127.0.0.1 -u root --default-character-set=latin1 --no-create-info --replace --skip-extended-insert \\
  --complete-insert --skip-comments aps_badilag abt_variabel > "$CAD/abt_variabel-seluruhnya-sebelum.sql" || gagal "mysqldump gagal - TIDAK ada yang diubah"
[ -s "$CAD/abt_variabel-seluruhnya-sebelum.sql" ] || gagal "cadangan abt_variabel kosong"
echo "CADANGAN: $CAD"

$MY < abt-y1-kesimpulan-tanya-jawab-26okt-PASANG.sql || gagal "PASANG berhenti (lihat galat di atas) - transaksi tidak di-COMMIT, tidak ada yang ditulis"

$MY < abt-y1-kesimpulan-tanya-jawab-26okt-PERIKSA.sql | tee "$CAD/periksa-sesudah.txt"
if [ "$(tail -1 "$CAD/periksa-sesudah.txt")" != "SEMUA COCOK" ]; then
  echo "PERIKSA tidak cocok - menghapus variabel baru"
  $MY < abt-y1-kesimpulan-tanya-jawab-26okt-PULIH-HAPUS-BARU.sql
  gagal "pemasangan dibatalkan dan dipulihkan"
fi
echo "SELESAI - paket y1-kesimpulan-tanya-jawab-26okt terpasang (4 variabel). Cadangan: $CAD"
"""

SH_PULIH = """#!/bin/bash
# =============================================================================
# PULIH paket ABT "y1-kesimpulan-tanya-jawab-26okt" di SATKER: hapus variabel 4950-4959.
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)"; export MYSQL_PWD
MY="mysql -h 127.0.0.1 -u root --default-character-set=latin1 aps_badilag"
$MY < abt-y1-kesimpulan-tanya-jawab-26okt-PULIH-HAPUS-BARU.sql || { echo "GAGAL menghapus variabel baru"; exit 1; }
echo "PULIH: variabel 4950-4959 dihapus (sisa_baris_baru harus 0)"
"""


def tulis(nama: str, isi: str):
    os.makedirs(KELUAR, exist_ok=True)
    with open(os.path.join(KELUAR, nama), "w", encoding="latin1", newline="\n") as f:
        f.write(isi)


def main():
    tulis(f"{NAMA_PAKET}-PASANG.sql", pasang())
    tulis(f"{NAMA_PAKET}-PERIKSA.sql", periksa())
    tulis(f"{NAMA_PAKET}-PULIH-HAPUS-BARU.sql", pulih())
    tulis("pasang-satker.sh", SH_PASANG)
    tulis("pulih-satker.sh", SH_PULIH)
    baris = []
    for nama in sorted(os.listdir(KELUAR)):
        if nama == "MD5SUMS.txt":
            continue
        with open(os.path.join(KELUAR, nama), "rb") as f:
            baris.append(f"{hashlib.md5(f.read()).hexdigest()}  {nama}")
    tulis("MD5SUMS.txt", "\n".join(baris) + "\n")
    print("\n".join(baris))


if __name__ == "__main__":
    main()
