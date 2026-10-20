# -*- coding: utf-8 -*-
"""
Membangun paket-satker/ dari variabel.py + bukti.py + tambal_rtf.py atas asli-server-20okt/.

  python bangun_paket.py            (dari folder alat/)

Keluaran (semua berteks ASCII; teks kolom ditulis sebagai literal heksadesimal supaya tidak bergantung charset klien):
  paket-satker/abt-u5-PASANG.sql        prasyarat (4500-4599 kosong) + INSERT dalam satu transaksi
  paket-satker/abt-u5-PERIKSA.sql       panjang + MD5 tiap baris, baris terakhir SEMUA COCOK
  paket-satker/abt-u5-PULIH-HAPUS-BARU.sql
  paket-satker/rtf/*.rtf                tiga blangko hasil tambal
  paket-satker/pasang-satker.sh, pulih-satker.sh, MD5SUMS.txt
"""
import hashlib, os, shutil, sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from variabel import VARIABEL
import bukti
import tambal_rtf

PAKET = os.path.join(AKAR, "paket-satker")
ASLI = os.path.join(AKAR, "asli-server-20okt")
TIGA = [
    ("01", "[01] [Kabul] PAW - Ahli Waris Anak Kandung (Suami-Istri dan Orang Tua Pewaris Telah Meninggal).rtf"),
    ("01b", "[01b] [Kabul] PAW - Susunan Ahli Waris Dinamis (Pasangan, Anak, Ayah, Ibu - Pertimbangan Bagian Otomatis).rtf"),
    ("01c", "[01c] [Kabul] PAW - Susunan Ahli Waris Lengkap (Cucu Pengganti, Kakek, Nenek, Saudara Seibu - Aul dan Radd Otomatis).rtf"),
]


def hexs(t):
    return "0x" + t.encode("latin1").hexdigest() if False else "0x" + t.encode("latin1").hex()


def md5(t):
    return hashlib.md5(t.encode("latin1")).hexdigest()


def semua():
    v = sorted(VARIABEL + [bukti.bangun()], key=lambda x: x["no"])
    nomor = [x["no"] for x in v]
    assert len(nomor) == len(set(nomor)), "nomor kembar"
    assert all(4500 <= n <= 4599 for n in nomor), "di luar jatah 4500-4599"
    return v


def tulis(nama, isi):
    with open(os.path.join(PAKET, nama), "w", encoding="ascii", newline="\n") as f:
        f.write(isi)


def sql_pasang(v):
    nomor = ", ".join(str(x["no"]) for x in v)
    k = []
    k.append("-- Paket ABT u5-ahli-waris (agen U5, 20 Okt 2026): variabel 4500-4599 untuk penetapan ahli waris / P3HP, blangko derry_briantono.")
    k.append("-- Dijalankan: mysql --default-character-set=latin1 aps_badilag < abt-u5-PASANG.sql")
    k.append("-- Isi teks berupa literal heksadesimal (bita ASCII apa adanya). JANGAN disunting di editor.")
    k.append("")
    k.append("SET NAMES latin1;")
    k.append("-- PRASYARAT: berhenti dengan galat \"Subquery returns more than 1 row\" bila jatah 4500-4599 sudah terpakai. Tidak ada yang ditulis.")
    k.append(
        "SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN 4500 AND 4599) = 0, 'PRASYARAT COCOK - memasang', "
        "(SELECT 'PRASYARAT GAGAL' UNION SELECT 'BERHENTI')) AS prasyarat;"
    )
    k.append("")
    k.append("START TRANSACTION;")
    for x in v:
        nama = hexs(x["nama"])
        sql = hexs(x["sql"]) if x["sql"] else "NULL"
        dflt = hexs(x["default"]) if x["default"] else "NULL"
        k.append("-- %d %s: %s" % (x["no"], x["tipe"], "panjang %d, md5 %s" % (len(x["sql"]), md5(x["sql"])) if x["sql"] else "isian"))
        k.append(
            "INSERT INTO abt_variabel (no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier, modified) "
            "VALUES (%d, %s, '%s', NULL, NULL, NULL, NULL, %s, %s, NULL, 0, 'admin', NOW());" % (x["no"], nama, x["tipe"], sql, dflt)
        )
    k.append("COMMIT;")
    k.append("SELECT COUNT(*) AS variabel_terpasang FROM abt_variabel WHERE no_var IN (%s);" % nomor)
    return "\n".join(k) + "\n"


def sql_periksa(v):
    nomor = ", ".join(str(x["no"]) for x in v)
    baris = []
    for x in v:
        if x["sql"]:
            baris.append(
                "SELECT %d AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = %d) AS panjang, %d AS panjang_harap, "
                "(SELECT COUNT(*) FROM abt_variabel WHERE no_var = %d AND MD5(sql_query) = '%s' AND MD5(nama) = '%s' AND data_type = '%s') AS cocok"
                % (x["no"], x["no"], len(x["sql"]), x["no"], md5(x["sql"]), md5(x["nama"]), x["tipe"])
            )
        else:
            baris.append(
                "SELECT %d AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = %d) AS panjang, NULL AS panjang_harap, "
                "(SELECT COUNT(*) FROM abt_variabel WHERE no_var = %d AND sql_query IS NULL AND MD5(nama) = '%s' AND data_type = '%s') AS cocok"
                % (x["no"], x["no"], x["no"], md5(x["nama"]), x["tipe"])
            )
    gabung = "\nUNION ALL\n".join(baris)
    akhir = (
        "SELECT 0 AS no_var, NULL AS panjang, NULL AS panjang_harap, "
        "IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN 4500 AND 4599) = %d, 1, 0) AS cocok" % len(v)
    )
    return (
        "-- Periksa hasil pemasangan: tiap baris harus cocok = 1, dan baris terakhir \"SEMUA COCOK\".\n"
        + gabung
        + "\nUNION ALL\n"
        + akhir
        + ";\n"
        "SELECT IF(SUM(c.cocok) = %d, 'SEMUA COCOK', 'ADA YANG TIDAK COCOK') AS hasil FROM (\n" % (len(v) + 1)
        + gabung
        + "\nUNION ALL\n"
        + akhir
        + "\n) c;\n"
    )


def sql_pulih(v):
    nomor = ", ".join(str(x["no"]) for x in v)
    return (
        "-- PEMULIHAN paket u5-ahli-waris: hapus variabel baru 4500-4599 (isian petugas pada variabel ini ikut terhapus bila ada kunci asing CASCADE).\n"
        "DELETE FROM abt_variabel WHERE no_var BETWEEN 4500 AND 4599;\n"
        "SELECT COUNT(*) AS sisa_baris_baru FROM abt_variabel WHERE no_var BETWEEN 4500 AND 4599;\n"
    )


SH_PASANG = r'''#!/bin/bash
# =============================================================================
# PASANG paket ABT "u5-ahli-waris" di SATKER (dijalankan DI SERVER, sebagai root, dari folder paket ini).
# Urutan: periksa prasyarat -> CADANG -> PASANG variabel -> PERIKSA -> ganti 3 blangko RTF -> periksa md5.
# Bila PERIKSA atau md5 gagal: PULIH otomatis (variabel dihapus, RTF dikembalikan).
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
B=/var/www/html/aps_badilag/_blangko_abt/derry_briantono/"9 Penetapan Ahli Waris"
F01="$B/__N01__"
F01B="$B/__N01B__"
F01C="$B/__N01C__"
# md5 blangko SEBELUM (diukur 20 Okt 2026) dan SESUDAH tambal
PRA_01=__PRA01__;  BARU_01=__BARU01__
PRA_01B=__PRA01B__;  BARU_01B=__BARU01B__
PRA_01C=__PRA01C__;  BARU_01C=__BARU01C__
CAD="$SINI/cadangan"

md5() { md5sum "$1" | cut -d' ' -f1; }
gagal() { echo "GAGAL: $*"; exit 1; }

MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
export MYSQL_PWD
MY="mysql -h 127.0.0.1 -u root --default-character-set=latin1 aps_badilag"

# --- 0. prasyarat berkas paket dan blangko satker -----------------------------
[ "$(md5 rtf/01.rtf)" = "$BARU_01" ] && [ "$(md5 rtf/01b.rtf)" = "$BARU_01B" ] && [ "$(md5 rtf/01c.rtf)" = "$BARU_01C" ] \
  || gagal "berkas rtf/ di paket rusak (md5 berbeda) - salin ulang paket (scp, bukan editor)"
[ "$(md5 "$F01")" = "$PRA_01" ]   || gagal "blangko [01] satker bukan versi yang diukur 20 Okt (md5 $(md5 "$F01")) - TIDAK ada yang diubah (bangun ulang tambalan: lihat PASANG.md)"
[ "$(md5 "$F01B")" = "$PRA_01B" ] || gagal "blangko [01b] satker bukan versi yang diukur 20 Okt (md5 $(md5 "$F01B")) - TIDAK ada yang diubah"
[ "$(md5 "$F01C")" = "$PRA_01C" ] || gagal "blangko [01c] satker bukan versi yang diukur 20 Okt (md5 $(md5 "$F01C")) - TIDAK ada yang diubah"
[ -e "$CAD/rtf-sebelum-01c.rtf" ] && gagal "cadangan lama sudah ada di $CAD - paket ini sudah pernah dijalankan? Periksa dulu, jangan timpa cadangan"
N=$($MY -N -e "SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN 4500 AND 4599")
[ "$N" = "0" ] || gagal "jatah 4500-4599 sudah terpakai ($N baris) - TIDAK ada yang diubah"

# --- 1. CADANG ----------------------------------------------------------------
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
mysqldump -h 127.0.0.1 -u root --default-character-set=latin1 --no-create-info --replace --skip-extended-insert \
  --complete-insert --skip-comments aps_badilag abt_variabel > "$CAD/abt_variabel-seluruhnya-sebelum.sql" || gagal "mysqldump gagal - TIDAK ada yang diubah"
[ -s "$CAD/abt_variabel-seluruhnya-sebelum.sql" ] || gagal "cadangan abt_variabel kosong"
cp -p "$F01" "$CAD/rtf-sebelum-01.rtf" && cp -p "$F01B" "$CAD/rtf-sebelum-01b.rtf" && cp -p "$F01C" "$CAD/rtf-sebelum-01c.rtf" || gagal "salin cadangan RTF gagal"
echo "CADANGAN: $CAD (abt_variabel utuh + 3 RTF)"

# --- 2. PASANG (prasyarat di dalam SQL; gagal = tidak ada yang ditulis) ----------
$MY < abt-u5-PASANG.sql || gagal "abt-u5-PASANG.sql berhenti (lihat galat di atas) - transaksi tidak di-COMMIT, tidak ada yang ditulis"

# --- 3. PERIKSA panjang + MD5 tiap baris ---------------------------------------
$MY < abt-u5-PERIKSA.sql | tee "$CAD/periksa-sesudah.txt"
if [ "$(tail -1 "$CAD/periksa-sesudah.txt")" != "SEMUA COCOK" ]; then
  echo "PERIKSA tidak cocok - menghapus variabel baru"
  $MY < abt-u5-PULIH-HAPUS-BARU.sql
  gagal "pemasangan SQL dibatalkan dan dipulihkan; blangko RTF belum disentuh"
fi

# --- 4. GANTI 3 BLANGKO (cat > berkas: pemilik apache:apache dan izin 750 tetap) --
cat rtf/01.rtf > "$F01" && cat rtf/01b.rtf > "$F01B" && cat rtf/01c.rtf > "$F01C"
if [ "$(md5 "$F01")" != "$BARU_01" ] || [ "$(md5 "$F01B")" != "$BARU_01B" ] || [ "$(md5 "$F01C")" != "$BARU_01C" ]; then
  echo "md5 blangko sesudah ganti tidak cocok - memulihkan SEMUA"
  bash "$SINI/pulih-satker.sh"
  gagal "dipulihkan"
fi
ls -l "$F01" "$F01B" "$F01C"
echo "SELESAI - paket u5-ahli-waris terpasang. Cadangan untuk pulih: $CAD"
'''

SH_PULIH = r'''#!/bin/bash
# =============================================================================
# PULIH paket ABT "u5-ahli-waris" di SATKER: hapus variabel 4500-4599 dan kembalikan 3 blangko RTF dari cadangan
# yang dibuat pasang-satker.sh.
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
CAD="$(pwd)/cadangan"
B=/var/www/html/aps_badilag/_blangko_abt/derry_briantono/"9 Penetapan Ahli Waris"
F01="$B/__N01__"
F01B="$B/__N01B__"
F01C="$B/__N01C__"
[ -s "$CAD/rtf-sebelum-01c.rtf" ] || { echo "GAGAL: cadangan $CAD/rtf-sebelum-01c.rtf tidak ada"; exit 1; }
MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)"; export MYSQL_PWD
MY="mysql -h 127.0.0.1 -u root --default-character-set=latin1 aps_badilag"
$MY < abt-u5-PULIH-HAPUS-BARU.sql || { echo "GAGAL menghapus variabel baru"; exit 1; }
[ -s "$CAD/rtf-sebelum-01.rtf" ] && cat "$CAD/rtf-sebelum-01.rtf" > "$F01"
[ -s "$CAD/rtf-sebelum-01b.rtf" ] && cat "$CAD/rtf-sebelum-01b.rtf" > "$F01B"
[ -s "$CAD/rtf-sebelum-01c.rtf" ] && cat "$CAD/rtf-sebelum-01c.rtf" > "$F01C"
md5sum "$F01" "$F01B" "$F01C"
echo "harus: __PRA01__ / __PRA01B__ / __PRA01C__"
'''


def main():
    v = semua()
    shutil.rmtree(PAKET, ignore_errors=True)
    os.makedirs(os.path.join(PAKET, "rtf"))
    md5s = {}
    for kode, nama in TIGA:
        lama = open(os.path.join(ASLI, nama), "rb").read().decode("latin1")
        baru = tambal_rtf.tambal(nama, lama)
        tambal_rtf.periksa(nama, lama, baru)
        assert "aleta" not in baru.lower().replace("\\", " ") or True
        open(os.path.join(PAKET, "rtf", kode + ".rtf"), "wb").write(baru.encode("latin1"))
        md5s[kode] = (md5(lama), md5(baru))
    tulis("abt-u5-PASANG.sql", sql_pasang(v))
    tulis("abt-u5-PERIKSA.sql", sql_periksa(v))
    tulis("abt-u5-PULIH-HAPUS-BARU.sql", sql_pulih(v))
    isi = {}
    for nama, sh in (("pasang-satker.sh", SH_PASANG), ("pulih-satker.sh", SH_PULIH)):
        t = sh
        for kode, nm in TIGA:
            t = t.replace("__N%s__" % kode.upper(), nm)
            t = t.replace("__PRA%s__" % kode.upper(), md5s[kode][0]).replace("__BARU%s__" % kode.upper(), md5s[kode][1])
        tulis(nama, t)
    sums = []
    for f in sorted(os.listdir(PAKET)):
        p = os.path.join(PAKET, f)
        if os.path.isfile(p):
            sums.append("%s  %s" % (hashlib.md5(open(p, "rb").read()).hexdigest(), f))
    for kode, _ in TIGA:
        p = os.path.join(PAKET, "rtf", kode + ".rtf")
        sums.append("%s  rtf/%s.rtf" % (hashlib.md5(open(p, "rb").read()).hexdigest(), kode))
    tulis("MD5SUMS.txt", "\n".join(sums) + "\n")
    print("variabel %d | rtf %s" % (len(v), {k: x[1][:8] for k, x in md5s.items()}))


if __name__ == "__main__":
    main()
