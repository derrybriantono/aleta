#!/usr/bin/env python3
"""
Membangun paket ABT y5-pengumuman-kedua-26okt (26 Okt 2026; BELUM dipasang di ABT mana pun).

Satu variabel diubah: 7063 "WAKTU PANGGILAN RADIO OTOMATIS" (tanggal pengumuman panggilan ghaib: "<tgl 1> dan <tgl 2>").

SEBAB (perkara 322/Pdt.G/2026/PA.Dgl, perkara_id 9824): pengumuman pertama (R, 10 Agustus 2026) dicatat pada sidang pertama (sidang_id 19291),
pengumuman kedua (W, 13 Oktober 2026) dicatat pada sidang kedua (sidang_id 20381). Variabel lama hanya membaca relaas pada SATU sidang
(sidang yang relaasnya paling awal), sehingga tanggal kedua tidak ditemukan dan tercetak "..." pada duduk perkara (#8508#/#8547#) dan
pertimbangan hukum (#8526#): "...pada tanggal 10 Agustus 2026 dan ...".

PERBAIKAN: tanggal kedua = (cara lama: tanggal kedua pada sidang yang sama) bila ada; bila tidak, tanggal relaas pengumuman (R/M/W/P, pihak
kedua, bukan sidang ikrar, tidak sesudah putusan) yang berbeda berikutnya pada sidang mana pun. Perkara yang sudah terisi benar tidak berubah.

Hanya UPDATE satu baris abt_variabel dengan penjaga MD5 (isi lama harus persis yang diukur di server 26 Okt); pulih = UPDATE kembali.
Tidak ada blangko (RTF), menu, atau isian per perkara yang disentuh. modifier tetap `admin` (tanpa nama aplikasi di ABT).

Jalankan dari folder paket:  python3 alat/bangun_paket.py
"""
import hashlib
import os

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KELUAR = os.path.join(AKAR, "paket-satker")
NAMA_PAKET = "abt-y5-pengumuman-kedua-26okt"
NO_VAR = 7063

LAMA_BERKAS = os.path.join(AKAR, "sumber", "7063-lama-server-26okt.sql")
BARU_BERKAS = os.path.join(AKAR, "sumber", "7063-baru.sql")

# d2 lama: "(SELECT DISTINCT ... LIMIT 1, 1) AS d2" -> "COALESCE((... LIMIT 1, 1), (cadangan: tanggal berbeda berikutnya pada sidang mana pun)) AS d2"
D2_LAMA = """    (SELECT DISTINCT r.tanggal_relaas FROM perkara_pelaksanaan_relaas r
      WHERE r.perkara_id = '#perkara_id#' AND r.sidang_id = y.sid AND r.ket_temu IN ('R', 'M', 'W', 'P') AND r.tanggal_relaas > '1000-01-01'
        AND r.pihak_id IN (SELECT p2.pihak_id FROM perkara_pihak2 p2 WHERE p2.perkara_id = '#perkara_id#')
      ORDER BY r.tanggal_relaas LIMIT 1, 1) AS d2
"""
D2_BARU = """    COALESCE((SELECT DISTINCT r.tanggal_relaas FROM perkara_pelaksanaan_relaas r
      WHERE r.perkara_id = '#perkara_id#' AND r.sidang_id = y.sid AND r.ket_temu IN ('R', 'M', 'W', 'P') AND r.tanggal_relaas > '1000-01-01'
        AND r.pihak_id IN (SELECT p2.pihak_id FROM perkara_pihak2 p2 WHERE p2.perkara_id = '#perkara_id#')
      ORDER BY r.tanggal_relaas LIMIT 1, 1),
      (SELECT DISTINCT r2.tanggal_relaas FROM perkara_pelaksanaan_relaas r2 JOIN perkara_jadwal_sidang j2 ON j2.id = r2.sidang_id
      WHERE r2.perkara_id = '#perkara_id#' AND r2.ket_temu IN ('R', 'M', 'W', 'P') AND r2.tanggal_relaas > '1000-01-01'
        AND IFNULL(j2.ikrar_talak, 'T') <> 'Y'
        AND r2.pihak_id IN (SELECT p3.pihak_id FROM perkara_pihak2 p3 WHERE p3.perkara_id = '#perkara_id#')
        AND r2.tanggal_relaas <= IFNULL((SELECT MAX(pu2.tanggal_putusan) FROM perkara_putusan pu2 WHERE pu2.perkara_id = '#perkara_id#' AND pu2.tanggal_putusan > '1000-01-01'), '9999-12-31')
      ORDER BY r2.tanggal_relaas LIMIT 1, 1)) AS d2
"""
KOMENTAR_LAMA = """--    pertama kali dipanggil secara ghaib - bukan sidang ikrar, tidak sesudah putusan; tanggal ke-1 dan ke-2;
"""
KOMENTAR_BARU = """--    pertama kali dipanggil secara ghaib - bukan sidang ikrar, tidak sesudah putusan; tanggal ke-1 dan ke-2;
--    bila sidang itu hanya memuat satu tanggal (pengumuman kedua dicatat pada sidang berikutnya), tanggal ke-2 =
--    tanggal pengumuman berbeda berikutnya pada sidang mana pun (26 Okt 2026, perkara 322/Pdt.G/2026/PA.Dgl);
"""


def md5b(b: bytes) -> str:
    return hashlib.md5(b).hexdigest()


def baca_lama() -> bytes:
    with open(LAMA_BERKAS, "rb") as f:
        return f.read()


def susun_baru(lama: bytes) -> bytes:
    t = lama.decode("latin1")
    assert t.count(D2_LAMA) == 1, "bagian d2 lama tidak ditemukan persis sekali"
    assert t.count(KOMENTAR_LAMA) == 1, "komentar lama tidak ditemukan persis sekali"
    t = t.replace(D2_LAMA, D2_BARU).replace(KOMENTAR_LAMA, KOMENTAR_BARU)
    b = t.encode("latin1")
    assert all(c < 128 for c in b), "teks baru harus ASCII"
    assert b"\r" not in b
    return b


def pasang(lama: bytes, baru: bytes) -> str:
    return (
        f"-- Paket ABT y5-pengumuman-kedua-26okt (26 Okt 2026): variabel {NO_VAR} - tanggal pengumuman ke-2 bila dicatat pada sidang berikutnya.\n"
        f"-- Dijalankan: mysql --default-character-set=latin1 aps_badilag < {NAMA_PAKET}-PASANG.sql\n"
        "-- Satu UPDATE dengan penjaga MD5: bila isi lama bukan yang diukur, 0 baris berubah (dilaporkan baris_berubah).\n"
        "\n"
        "SET NAMES latin1;\n"
        f"UPDATE abt_variabel SET sql_query = 0x{baru.hex()}, modified = NOW()\n"
        f"  WHERE no_var = {NO_VAR} AND data_type = 'data_sql' AND MD5(sql_query) = '{md5b(lama)}';\n"
        "SELECT ROW_COUNT() AS baris_berubah;\n"
    )


def periksa(lama: bytes, baru: bytes) -> str:
    return (
        "-- Periksa: keluaran terakhir harus \"SEMUA COCOK\" (isi baru persis; modifier tetap admin; baris lain tidak disentuh).\n"
        f"SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var = {NO_VAR} AND MD5(sql_query) = '{md5b(baru)}' "
        "AND LENGTH(sql_query) = " + str(len(baru)) + " AND modifier = 'admin' AND data_type = 'data_sql') = 1, 'SEMUA COCOK', 'ADA YANG TIDAK COCOK') AS hasil;\n"
    )


def pulih(lama: bytes, baru: bytes) -> str:
    return (
        f"-- PEMULIHAN paket y5-pengumuman-kedua-26okt: kembalikan variabel {NO_VAR} ke isi lama (penjaga MD5 isi baru).\n"
        "SET NAMES latin1;\n"
        f"UPDATE abt_variabel SET sql_query = 0x{lama.hex()}, modified = NOW()\n"
        f"  WHERE no_var = {NO_VAR} AND MD5(sql_query) = '{md5b(baru)}';\n"
        "SELECT ROW_COUNT() AS baris_dipulihkan;\n"
        f"SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var = {NO_VAR} AND MD5(sql_query) = '{md5b(lama)}') = 1, 'PULIH COCOK', 'PULIH TIDAK COCOK') AS hasil;\n"
    )


def sh_pasang(lama: bytes, baru: bytes) -> str:
    return f"""#!/bin/bash
# =============================================================================
# PASANG paket ABT "y5-pengumuman-kedua-26okt" di SATKER (dijalankan DI SERVER, sebagai root, dari folder paket ini).
# BELUM dijalankan di mana pun (26 Okt 2026). Urutan: md5 paket -> prasyarat (isi lama persis) -> CADANG -> PASANG -> PERIKSA (gagal = pulih).
# Hanya satu baris abt_variabel (7063) yang diubah; tidak ada blangko (RTF) yang diubah.
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
CAD="$SINI/cadangan"
gagal() {{ echo "GAGAL: $*"; exit 1; }}

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp"
MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
export MYSQL_PWD
MY="mysql -h 127.0.0.1 -u root --default-character-set=latin1 aps_badilag"

P=$($MY -N -e "SELECT COUNT(*) FROM abt_variabel WHERE no_var = {NO_VAR} AND MD5(sql_query) = '{md5b(lama)}'") || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
if [ "$P" != "1" ]; then
  B=$($MY -N -e "SELECT COUNT(*) FROM abt_variabel WHERE no_var = {NO_VAR} AND MD5(sql_query) = '{md5b(baru)}'")
  [ "$B" = "1" ] && gagal "variabel {NO_VAR} sudah berisi versi paket ini - tidak diulang"
  gagal "isi variabel {NO_VAR} bukan yang diukur 26 Okt (md5 {md5b(lama)}) - TIDAK ada yang diubah"
fi
echo "PRASYARAT COCOK (1)"

[ -e "$CAD/abt_variabel-7063-sebelum.sql" ] && gagal "cadangan lama sudah ada di $CAD - periksa dulu, jangan timpa"
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
mysqldump -h 127.0.0.1 -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \\
  --complete-insert --skip-comments --hex-blob --where="no_var = {NO_VAR}" aps_badilag abt_variabel > "$CAD/abt_variabel-7063-sebelum.sql" || gagal "mysqldump gagal - TIDAK ada yang diubah"
[ "$(grep -c '^REPLACE' "$CAD/abt_variabel-7063-sebelum.sql")" = "1" ] || gagal "cadangan variabel {NO_VAR} tidak berisi tepat 1 baris"
echo "CADANGAN: $CAD/abt_variabel-7063-sebelum.sql (1 baris lama)"

$MY < {NAMA_PAKET}-PASANG.sql || gagal "PASANG berhenti (lihat galat di atas)"

$MY -N < {NAMA_PAKET}-PERIKSA.sql | tee "$CAD/periksa-sesudah.txt"
if [ "$(tail -1 "$CAD/periksa-sesudah.txt")" != "SEMUA COCOK" ]; then
  echo "PERIKSA tidak cocok - memulihkan"
  $MY < {NAMA_PAKET}-PULIH.sql
  gagal "pemasangan dibatalkan dan dipulihkan"
fi
echo "SELESAI - paket y5-pengumuman-kedua-26okt terpasang (variabel {NO_VAR}). Cadangan: $CAD"
"""


def sh_pulih(lama: bytes, baru: bytes) -> str:
    return f"""#!/bin/bash
# =============================================================================
# PULIH paket ABT "y5-pengumuman-kedua-26okt" di SATKER: kembalikan variabel {NO_VAR} ke isi lama.
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)"; export MYSQL_PWD
MY="mysql -h 127.0.0.1 -u root --default-character-set=latin1 aps_badilag"
$MY -N < {NAMA_PAKET}-PULIH.sql | tee /dev/stderr | tail -1 | grep -q "PULIH COCOK" || {{ echo "GAGAL memulihkan variabel {NO_VAR}"; exit 1; }}
echo "PULIH COCOK"
"""


def tulis(nama: str, isi: str):
    os.makedirs(KELUAR, exist_ok=True)
    with open(os.path.join(KELUAR, nama), "w", encoding="latin1", newline="\n") as f:
        f.write(isi)


def main():
    lama = baca_lama()
    baru = susun_baru(lama)
    with open(BARU_BERKAS, "wb") as f:
        f.write(baru)
    tulis(f"{NAMA_PAKET}-PASANG.sql", pasang(lama, baru))
    tulis(f"{NAMA_PAKET}-PERIKSA.sql", periksa(lama, baru))
    tulis(f"{NAMA_PAKET}-PULIH.sql", pulih(lama, baru))
    tulis("pasang-satker.sh", sh_pasang(lama, baru))
    tulis("pulih-satker.sh", sh_pulih(lama, baru))
    baris = []
    for nama in sorted(os.listdir(KELUAR)):
        if nama == "MD5SUMS.txt":
            continue
        with open(os.path.join(KELUAR, nama), "rb") as f:
            baris.append(f"{hashlib.md5(f.read()).hexdigest()}  {nama}")
    tulis("MD5SUMS.txt", "\n".join(baris) + "\n")
    print(f"lama md5 {md5b(lama)} ({len(lama)} B) -> baru md5 {md5b(baru)} ({len(baru)} B)")
    print("\n".join(baris))


if __name__ == "__main__":
    main()
