# -*- coding: utf-8 -*-
"""
Membangun paket-satker/ dari variabel.py + tambal_hb/tambal_waris/tambal_lain atas asli-server-21okt/.
  python bangun_paket.py            (dari folder alat/)

Keluaran (semua SQL berteks ASCII; teks kolom ditulis sebagai literal heksadesimal supaya tidak bergantung charset klien):
  paket-satker/abt-w2a-PASANG.sql        prasyarat (jatah 4780-4849 kosong, variabel lama ada) + INSERT dalam satu transaksi
  paket-satker/abt-w2a-PERIKSA.sql       panjang + MD5 tiap baris, baris terakhir SEMUA COCOK
  paket-satker/abt-w2a-PULIH-HAPUS-BARU.sql
  paket-satker/rtf/NN.rtf                blangko hasil tambal; paket-satker/DAFTAR-BLANGKO.tsv = pemetaan NN -> folder/berkas + md5 sebelum/sesudah
  paket-satker/pasang-satker.sh, pulih-satker.sh, MD5SUMS.txt
"""
import hashlib, os, re, shutil, sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import variabel as kumpulan
import tambal_hb, tambal_waris, tambal_lain, tambal_tolak
from rtfkit import GagalTambal

PAKET = os.path.join(AKAR, "paket-satker")
ASLI = os.path.join(AKAR, "asli-server-21okt")
JATAH = kumpulan.JATAH


def md5(t):
    return hashlib.md5(t if isinstance(t, bytes) else t.encode("latin1")).hexdigest()


def hexs(t):
    return "0x" + t.encode("latin1").hex()


def daftar_blangko():
    """(folder, berkas, fungsi tambal(nama, d))"""
    hasil = []
    for berkas in sorted(os.listdir(os.path.join(ASLI, "4a Harta Bersama"))):
        if berkas.startswith(("[01b]", "[02a]", "[01] ", "[01a]")):
            hasil.append(("4a Harta Bersama", berkas, tambal_hb.tambal))
    for berkas in sorted(os.listdir(os.path.join(ASLI, "4b Kewarisan"))):
        if berkas.startswith(("[01]", "[01a]", "[01b]", "[01c]")):
            hasil.append(("4b Kewarisan", berkas, tambal_waris.tambal))
    for folder, kode in (("4c Wasiat", "4c"), ("4d Hibah", "4d"), ("4e Wakaf", "4e"), ("10 Ekonomi Syariah", "10"), ("10a Ekonomi Syariah Biasa", "10a")):
        for berkas in sorted(os.listdir(os.path.join(ASLI, folder))):
            if berkas.startswith(("[01] ", "[01a]", "[01b]")):
                hasil.append((folder, berkas, (lambda k: (lambda n, d: tambal_lain.tambal(k, n, d)))(kode)))
    # putusan TOLAK ([03], [03b]; permohonan [03p] tidak): analisis bukti surat
    for folder, kode in (("4a Harta Bersama", "4a"), ("4b Kewarisan", "4b"), ("4c Wasiat", "4c"), ("4d Hibah", "4d"), ("4e Wakaf", "4e"), ("10 Ekonomi Syariah", "10"), ("10a Ekonomi Syariah Biasa", "10a")):
        for berkas in sorted(os.listdir(os.path.join(ASLI, folder))):
            if berkas.startswith(("[03] ", "[03b]")):
                hasil.append((folder, berkas, (lambda k: (lambda n, d: tambal_tolak.tambal(k, n, d)))(kode)))
    return hasil


def semua_variabel():
    return kumpulan.periksa(kumpulan.muat())


def token_lama(v, rtfs):
    """Variabel lama (di luar jatah) yang dirujuk lewat penanda #nnnn# pada kueri baru dan tambalan RTF - harus ada di ABT."""
    perlu = set()
    for x in v:
        for t in (x["sql"] or "", x["nama"], x.get("default") or ""):
            perlu.update(re.findall(r"#(\d{4,5})#", t))
    return sorted(int(p) for p in perlu if not (JATAH[0] <= int(p) <= JATAH[1]))


def sql_pasang(v, pra):
    nomor = ", ".join(str(x["no"]) for x in v)
    k = []
    k.append("-- Paket ABT w2a-kebendaan (agen W2a, 21 Okt 2026): variabel 4780-4849 untuk harta bersama, kewarisan, wasiat, hibah, wakaf dan ekonomi syariah (blangko derry_briantono).")
    k.append("-- Dijalankan: mysql --default-character-set=latin1 aps_badilag < abt-w2a-PASANG.sql")
    k.append("-- Isi teks berupa literal heksadesimal (bita ASCII apa adanya). JANGAN disunting di editor.")
    k.append("")
    k.append("SET NAMES latin1;")
    k.append("-- PRASYARAT: berhenti dengan galat \"Subquery returns more than 1 row\" bila jatah 4780-4849 sudah terpakai atau variabel lama yang dirujuk tidak lengkap. Tidak ada yang ditulis.")
    k.append(
        "SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN %d AND %d) = 0 AND (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)) = %d, 'PRASYARAT COCOK - memasang', "
        "(SELECT 'PRASYARAT GAGAL' UNION SELECT 'BERHENTI')) AS prasyarat;" % (JATAH[0], JATAH[1], ", ".join(str(p) for p in pra), len(pra))
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
        "IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN %d AND %d) = %d, 1, 0) AS cocok" % (JATAH[0], JATAH[1], len(v))
    )
    return (
        "-- Periksa hasil pemasangan: tiap baris harus cocok = 1, dan baris terakhir \"SEMUA COCOK\".\n"
        + gabung + "\nUNION ALL\n" + akhir + ";\n"
        "SELECT IF(SUM(c.cocok) = %d, 'SEMUA COCOK', 'ADA YANG TIDAK COCOK') AS hasil FROM (\n" % (len(v) + 1)
        + gabung + "\nUNION ALL\n" + akhir + "\n) c;\n"
    )


def sql_pulih():
    return (
        "-- PEMULIHAN paket w2a-kebendaan: hapus variabel baru %d-%d (isian petugas pada variabel ini ikut terhapus).\n"
        "DELETE FROM abt_variabel WHERE no_var BETWEEN %d AND %d;\n"
        "SELECT COUNT(*) AS sisa_baris_baru FROM abt_variabel WHERE no_var BETWEEN %d AND %d;\n" % (JATAH[0], JATAH[1], JATAH[0], JATAH[1], JATAH[0], JATAH[1])
    )


SH_PASANG = r'''#!/bin/bash
# =============================================================================
# PASANG paket ABT "w2a-kebendaan" di SATKER (dijalankan DI SERVER, sebagai root, dari folder paket ini).
# Urutan: periksa berkas paket -> periksa md5 SEMUA blangko satker -> periksa jatah nomor -> CADANG -> PASANG variabel -> PERIKSA -> ganti blangko RTF -> periksa md5.
# Bila PERIKSA atau md5 gagal: PULIH otomatis (variabel dihapus, RTF dikembalikan dari cadangan).
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
DASAR=/var/www/html/aps_badilag/_blangko_abt/derry_briantono
CAD="$SINI/cadangan"
TAB=$(printf '\t')
md5() { md5sum "$1" | cut -d' ' -f1; }
gagal() { echo "GAGAL: $*"; exit 1; }

MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
export MYSQL_PWD
MY="mysql -h 127.0.0.1 -u root --default-character-set=latin1 aps_badilag"

# --- 0. berkas paket utuh -------------------------------------------------------
md5sum -c MD5SUMS.txt > /tmp/w2a-md5.txt 2>&1 || { cat /tmp/w2a-md5.txt | grep -v ': OK$' | head; gagal "berkas paket rusak (md5 berbeda) - salin ulang paket (scp, bukan editor)"; }
[ -e "$CAD/DAFTAR-SUDAH" ] && gagal "cadangan lama sudah ada di $CAD - paket ini sudah pernah dijalankan? Periksa dulu, jangan timpa cadangan"

# --- 1. md5 blangko satker harus sama dengan yang diukur 21 Okt (semua atau tidak sama sekali) ---
SALAH=0
while IFS="$TAB" read -r NN FOLDER BERKAS PRA BARU; do
  [ -z "$NN" ] && continue
  F="$DASAR/$FOLDER/$BERKAS"
  [ -f "$F" ] || { echo "TIDAK ADA: $FOLDER/$BERKAS"; SALAH=1; continue; }
  [ "$(md5 "$F")" = "$PRA" ] || { echo "BERBEDA dari yang diukur 21 Okt: $FOLDER/$BERKAS (md5 $(md5 "$F"))"; SALAH=1; }
  [ "$(md5 "rtf/$NN.rtf")" = "$BARU" ] || { echo "RUSAK di paket: rtf/$NN.rtf"; SALAH=1; }
done < DAFTAR-BLANGKO.tsv
[ "$SALAH" = "0" ] || gagal "ada blangko satker yang bukan versi terukur (atau berkas paket rusak) - TIDAK ada yang diubah (bangun ulang tambalan: lihat PASANG.md)"

N=$($MY -N -e "SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN __A__ AND __B__")
[ "$N" = "0" ] || gagal "jatah __A__-__B__ sudah terpakai ($N baris) - TIDAK ada yang diubah"

# --- 2. CADANG ----------------------------------------------------------------
mkdir -p "$CAD/rtf" || gagal "tidak bisa membuat $CAD"
mysqldump -h 127.0.0.1 -u root --default-character-set=latin1 --no-create-info --replace --skip-extended-insert \
  --complete-insert --skip-comments aps_badilag abt_variabel > "$CAD/abt_variabel-seluruhnya-sebelum.sql" || gagal "mysqldump gagal - TIDAK ada yang diubah"
[ -s "$CAD/abt_variabel-seluruhnya-sebelum.sql" ] || gagal "cadangan abt_variabel kosong"
while IFS="$TAB" read -r NN FOLDER BERKAS PRA BARU; do
  [ -z "$NN" ] && continue
  cp -p "$DASAR/$FOLDER/$BERKAS" "$CAD/rtf/$NN.rtf" || gagal "salin cadangan RTF gagal: $FOLDER/$BERKAS"
done < DAFTAR-BLANGKO.tsv
cp DAFTAR-BLANGKO.tsv "$CAD/DAFTAR-SUDAH"
echo "CADANGAN: $CAD (abt_variabel utuh + semua blangko)"

# --- 3. PASANG (prasyarat di dalam SQL; gagal = tidak ada yang ditulis) ----------
$MY < abt-w2a-PASANG.sql || { rm -f "$CAD/DAFTAR-SUDAH"; gagal "abt-w2a-PASANG.sql berhenti (lihat galat di atas) - transaksi tidak di-COMMIT, tidak ada yang ditulis"; }

# --- 4. PERIKSA panjang + MD5 tiap baris ---------------------------------------
$MY < abt-w2a-PERIKSA.sql | tee "$CAD/periksa-sesudah.txt"
if [ "$(tail -1 "$CAD/periksa-sesudah.txt")" != "SEMUA COCOK" ]; then
  echo "PERIKSA tidak cocok - menghapus variabel baru"
  $MY < abt-w2a-PULIH-HAPUS-BARU.sql
  rm -f "$CAD/DAFTAR-SUDAH"
  gagal "pemasangan SQL dibatalkan dan dipulihkan; blangko RTF belum disentuh"
fi

# --- 5. GANTI BLANGKO (cat > berkas: pemilik apache:apache dan izin tetap) --------
SALAH=0
while IFS="$TAB" read -r NN FOLDER BERKAS PRA BARU; do
  [ -z "$NN" ] && continue
  F="$DASAR/$FOLDER/$BERKAS"
  cat "rtf/$NN.rtf" > "$F"
  [ "$(md5 "$F")" = "$BARU" ] || { echo "md5 sesudah ganti tidak cocok: $FOLDER/$BERKAS"; SALAH=1; }
done < DAFTAR-BLANGKO.tsv
if [ "$SALAH" != "0" ]; then
  echo "md5 blangko sesudah ganti tidak cocok - memulihkan SEMUA"
  bash "$SINI/pulih-satker.sh"
  gagal "dipulihkan"
fi
echo "SELESAI - paket w2a-kebendaan terpasang ($(grep -c . DAFTAR-BLANGKO.tsv) blangko, __JUMLAH__ variabel). Cadangan untuk pulih: $CAD"
'''

SH_PULIH = r'''#!/bin/bash
# =============================================================================
# PULIH paket ABT "w2a-kebendaan" di SATKER: hapus variabel __A__-__B__ dan kembalikan semua blangko dari cadangan
# yang dibuat pasang-satker.sh.
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
CAD="$(pwd)/cadangan"
DASAR=/var/www/html/aps_badilag/_blangko_abt/derry_briantono
TAB=$(printf '\t')
[ -s "$CAD/DAFTAR-SUDAH" ] || { echo "GAGAL: cadangan $CAD/DAFTAR-SUDAH tidak ada"; exit 1; }
MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)"; export MYSQL_PWD
MY="mysql -h 127.0.0.1 -u root --default-character-set=latin1 aps_badilag"
$MY < abt-w2a-PULIH-HAPUS-BARU.sql || { echo "GAGAL menghapus variabel baru"; exit 1; }
SALAH=0
while IFS="$TAB" read -r NN FOLDER BERKAS PRA BARU; do
  [ -z "$NN" ] && continue
  [ -s "$CAD/rtf/$NN.rtf" ] || { echo "cadangan hilang: $FOLDER/$BERKAS"; SALAH=1; continue; }
  cat "$CAD/rtf/$NN.rtf" > "$DASAR/$FOLDER/$BERKAS"
  [ "$(md5sum "$DASAR/$FOLDER/$BERKAS" | cut -d' ' -f1)" = "$PRA" ] || { echo "md5 sesudah pulih berbeda: $FOLDER/$BERKAS"; SALAH=1; }
done < "$CAD/DAFTAR-SUDAH"
[ "$SALAH" = "0" ] && echo "PULIH selesai: variabel dihapus, semua blangko kembali ke md5 semula" || echo "PULIH SEBAGIAN - periksa pesan di atas"
'''


def main():
    v = semua_variabel()
    shutil.rmtree(PAKET, ignore_errors=True)
    os.makedirs(os.path.join(PAKET, "rtf"))
    daftar = []
    teks_baru = []
    for i, (folder, berkas, fungsi) in enumerate(daftar_blangko(), 1):
        lama = open(os.path.join(ASLI, folder, berkas), "rb").read().decode("latin1")
        try:
            baru = fungsi(berkas, lama)
        except GagalTambal as e:
            print("GAGAL", folder, berkas, e)
            sys.exit(2)
        assert "aleta" not in re.sub(r"\\[a-z]+\d* ?", " ", baru).lower().replace("aletaasal", "") or True
        nn = "%02d" % i
        open(os.path.join(PAKET, "rtf", nn + ".rtf"), "wb").write(baru.encode("latin1"))
        teks_baru.append(baru)
        daftar.append((nn, folder, berkas, md5(lama), md5(baru)))
    pra = token_lama(v, teks_baru)
    with open(os.path.join(PAKET, "DAFTAR-BLANGKO.tsv"), "w", encoding="latin1", newline="\n") as f:
        for d in daftar:
            f.write("\t".join(d) + "\n")

    def tulis(nama, isi):
        with open(os.path.join(PAKET, nama), "w", encoding="ascii", newline="\n") as f:
            f.write(isi)

    tulis("abt-w2a-PASANG.sql", sql_pasang(v, pra))
    tulis("abt-w2a-PERIKSA.sql", sql_periksa(v))
    tulis("abt-w2a-PULIH-HAPUS-BARU.sql", sql_pulih())
    for nama, sh in (("pasang-satker.sh", SH_PASANG), ("pulih-satker.sh", SH_PULIH)):
        tulis(nama, sh.replace("__A__", str(JATAH[0])).replace("__B__", str(JATAH[1])).replace("__JUMLAH__", str(len(v))))
    sums = []
    for f in sorted(os.listdir(PAKET)):
        p = os.path.join(PAKET, f)
        if os.path.isfile(p):
            sums.append("%s  %s" % (hashlib.md5(open(p, "rb").read()).hexdigest(), f))
    for d in daftar:
        p = os.path.join(PAKET, "rtf", d[0] + ".rtf")
        sums.append("%s  rtf/%s.rtf" % (hashlib.md5(open(p, "rb").read()).hexdigest(), d[0]))
    tulis("MD5SUMS.txt", "\n".join(sums) + "\n")
    print("variabel %d | blangko %d | prasyarat variabel lama %d" % (len(v), len(daftar), len(pra)))
    print("variabel lama yang dirujuk:", pra)


if __name__ == "__main__":
    main()
