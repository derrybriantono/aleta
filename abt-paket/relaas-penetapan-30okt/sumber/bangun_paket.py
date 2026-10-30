# -*- coding: utf-8 -*-
"""Bangun paket ABT abt-relaas-penetapan-30okt (Python 3, laptop). Deterministik dari:
  - basis ABT keadaan server (bawaan aps_badilag_2810 = dump server 28 Okt 15.44): kueri lama 7100 7108 7109 7006 7008 9564 9565
    (variabel pengganti diturunkan darinya) dan bukti nomor 11200-11219 kosong;
  - pohon RTF derry_briantono keadaan server PERKIRAAN (bawaan D:/Aplikasi/aleta/tmp/bas29/dasar3/derry_briantono = salinan
    server 21 Okt w82 + semua paket terpasang sampai 28 Okt, disusun agen BAS dengan susun_dasar.py). Folder yang disentuh paket ini
    (98 Relaas, 99 PTSP) TIDAK disentuh paket prodeo-panggilan-29okt maupun bas-tanya-jawab-29okt.
Keluaran: ../paket-satker/ (SQL, nomor-baru.txt, daftar-timpa.tsv, timpa.tgz, uji-kueri.tsv, MD5SUMS.txt) dan ../hasil/isi-paket.json.
pakai: python bangun_paket.py [basis] [akar RTF derry_briantono]"""
import gzip
import hashlib
import io
import json
import os
import re
import subprocess
import sys
import tarfile

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SINI)
import isi_variabel as IV  # noqa: E402
import tambal_rtf as TR  # noqa: E402

PAKET = os.path.join(SINI, "..", "paket-satker")
HASIL = os.path.join(SINI, "..", "hasil")
N = "abt-relaas-penetapan-30okt"
MYSQL = r"D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe"
BASIS = sys.argv[1] if len(sys.argv) > 1 else "aps_badilag_2810"
RTF = sys.argv[2] if len(sys.argv) > 2 else r"D:\Aplikasi\aleta\tmp\bas29\dasar3\derry_briantono"
FOLDER = ("98 Relaas", "99 PTSP")
BLOK = (11200, 11229)
KEPALA = ("-- Paket ABT \"%s\" (30 Okt 2026): relaas/pemberitahuan dan penetapan PTSP blangko Derry - koma tunggal, spasi, identitas, "
          "upaya hukum pemberitahuan putusan, tanggal relaas e-Court, PA tujuan delegasi, penetapan hari sidang.\n" % N)


def sql(q):
    r = subprocess.run([MYSQL, "-h127.0.0.1", "-uroot", "-N", "--raw", "--default-character-set=latin1", BASIS, "-e", q],
                       capture_output=True, check=True)
    return r.stdout.decode("latin1")


def hx(s):
    return "0x" + s.encode("latin1").hex()


def md5(b):
    return hashlib.md5(b).hexdigest()


def tanda(nama, q):
    """MD5(CONCAT_WS('|', nama, data_type, sql_query, locked)) baris baru (dihitung sama di MySQL)."""
    return md5(("%s|data_sql|%s|0" % (nama, q)).encode("latin1"))


def main():
    os.makedirs(PAKET, exist_ok=True)
    os.makedirs(HASIL, exist_ok=True)
    # --- basis ABT ----------------------------------------------------------------------------------------------------------
    ada = sql("SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN %d AND %d" % BLOK).strip()
    assert ada == "0", "blok %s sudah terpakai di %s" % (BLOK, BASIS)
    asal = {}
    for no in IV.ASAL_DIPAKAI:
        h = sql("SELECT HEX(sql_query) FROM abt_variabel WHERE no_var = %d" % no).strip()
        asal[no] = bytes.fromhex(h).decode("latin1")
    var = IV.buat(asal)
    nomor = sorted(var)
    assert all(BLOK[0] <= n <= BLOK[1] for n in nomor)
    # --- RTF ------------------------------------------------------------------------------------------------------------------
    timpa = []          # (folder, berkas, md5_lama, md5_baru, ket, isi_baru)
    disentuh_penanda = set()
    for f in FOLDER:
        for b in sorted(os.listdir(os.path.join(RTF, f))):
            if not b.lower().endswith(".rtf"):
                continue
            raw = open(os.path.join(RTF, f, b), "rb").read()
            baru, hitung = TR.tambal(f + "/" + b, raw)
            if baru == raw:
                continue
            ket = " ".join("%s=%d" % (k, v) for k, v in sorted(hitung.items()))
            timpa.append((f, b, md5(raw), md5(baru), ket, baru))
            t_lama = set(re.findall(r"#(\d{4,5})#", TR.urai(raw)[0]))
            t_baru = set(re.findall(r"#(\d{4,5})#", TR.urai(baru)[0]))
            disentuh_penanda |= (t_baru - t_lama)
    # --- variabel yang dirujuk (harus ada di server) --------------------------------------------------------------------------
    rujuk = set()
    for no, (nama, q) in var.items():
        rujuk |= set(int(x) for x in re.findall(r"#(\d{4,5})#", q))
    rujuk |= set(int(x) for x in disentuh_penanda)
    rujuk -= set(nomor)
    rujuk = sorted(rujuk)
    # --- SQL --------------------------------------------------------------------------------------------------------------------
    hs = {n: tanda(*var[n]) for n in nomor}
    ha = {n: md5(asal[n].encode("latin1")) for n in IV.ASAL_DIPAKAI}
    daftar_h = " UNION ALL ".join("SELECT %d AS n, '%s' AS h" % (n, hs[n]) for n in nomor)
    pr = [KEPALA,
          "-- PRASYARAT (baca saja) \"A|B|C|D\": A = nomor %d-%d yang sudah ada tetapi isinya bukan isi paket (harus 0) | B = nomor baru yang sudah "
          "persis isi paket | C = variabel yang dirujuk paket yang ADA (harus %d) | D = variabel asal turunan (7100 7108 7109 7006 7008 9564 9565) "
          "yang isinya persis dasar paket (harus %d).\n" % (BLOK[0], BLOK[1], len(rujuk), len(ha)),
          "-- Benar: \"0|0|%d|%d\" (pasang pertama) atau \"0|%d|%d|%d\" (pasang ulang). Selain itu berhenti, tidak ada yang diubah.\n"
          % (len(rujuk), len(ha), len(nomor), len(rujuk), len(ha)),
          "SELECT CONCAT_WS('|',\n",
          "  (SELECT COUNT(*) FROM aps_badilag.abt_variabel v WHERE v.no_var BETWEEN %d AND %d AND NOT EXISTS (SELECT 1 FROM (%s) x WHERE x.n = v.no_var "
          "AND x.h = MD5(CONCAT_WS('|', v.nama, v.data_type, IFNULL(v.sql_query, ''), v.locked)))),\n" % (BLOK[0], BLOK[1], daftar_h),
          "  (SELECT COUNT(*) FROM aps_badilag.abt_variabel v JOIN (%s) x ON x.n = v.no_var AND x.h = MD5(CONCAT_WS('|', v.nama, v.data_type, "
          "IFNULL(v.sql_query, ''), v.locked))),\n" % daftar_h,
          "  (SELECT COUNT(*) FROM aps_badilag.abt_variabel v WHERE v.no_var IN (%s)),\n" % ", ".join(str(n) for n in rujuk),
          "  (SELECT COUNT(*) FROM aps_badilag.abt_variabel v JOIN (%s) x ON x.n = v.no_var AND x.h = MD5(v.sql_query))\n"
          % " UNION ALL ".join("SELECT %d AS n, '%s' AS h" % (n, ha[n]) for n in IV.ASAL_DIPAKAI),
          ") AS prasyarat;\n"]
    ps = [KEPALA, "-- PASANG: satu transaksi; baris baru INSERT ... WHERE NOT EXISTS (aman diulang). Tidak ada baris lama yang diubah.\n",
          "START TRANSACTION;\n"]
    for n in nomor:
        nama, q = var[n]
        ps.append("INSERT INTO aps_badilag.abt_variabel (no_var, nama, data_type, sql_query, locked) SELECT %d, %s, 'data_sql', %s, 0 FROM DUAL "
                  "WHERE NOT EXISTS (SELECT 1 FROM aps_badilag.abt_variabel WHERE no_var = %d);\n" % (n, hx(nama), hx(q), n))
    ps.append("COMMIT;\n")
    pe = [KEPALA, "-- PERIKSA (baca saja): tiap baris persis isi paket. Baris terakhir harus: SEMUA COCOK\n", "SELECT label, ok FROM (\n"]
    baris = ["SELECT 'variabel %d' AS label, (SELECT COUNT(*) FROM aps_badilag.abt_variabel v WHERE v.no_var = %d AND MD5(CONCAT_WS('|', v.nama, "
             "v.data_type, IFNULL(v.sql_query, ''), v.locked)) = '%s') AS ok" % (n, n, hs[n]) for n in nomor]
    pe.append("\nUNION ALL ".join(baris) + "\n) t\nUNION ALL SELECT IF((SELECT COUNT(*) FROM aps_badilag.abt_variabel v JOIN (%s) x ON x.n = v.no_var "
              "AND x.h = MD5(CONCAT_WS('|', v.nama, v.data_type, IFNULL(v.sql_query, ''), v.locked))) = %d, 'SEMUA COCOK', 'TIDAK COCOK'), 1;\n"
              % (daftar_h, len(nomor)))
    pu = [KEPALA, "-- PULIH: baris baru paket ini dihapus HANYA bila isinya masih persis isi paket (baris lain tidak disentuh).\n",
          "START TRANSACTION;\n"]
    for n in nomor:
        pu.append("DELETE FROM aps_badilag.abt_variabel WHERE no_var = %d AND MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), locked)) "
                  "= '%s';\n" % (n, hs[n]))
    pu.append("COMMIT;\n")
    tulis("%s-PRASYARAT.sql" % N, "".join(pr))
    tulis("%s-PASANG.sql" % N, "".join(ps))
    tulis("%s-PERIKSA.sql" % N, "".join(pe))
    tulis("%s-PULIH.sql" % N, "".join(pu))
    tulis("nomor-baru.txt", "# nomor variabel baru paket (satu per baris)\n" + "".join("%d\n" % n for n in nomor))
    tulis("nomor-dirujuk.txt", "# variabel lama yang dirujuk paket (harus ada di server)\n" + "".join("%04d\n" % n for n in rujuk))
    uk = ["# nomor<TAB>kueri satu baris (#perkara_id# diganti; penanda #NNNN# lain diganti 0: diuji bahwa kueri JALAN di MariaDB server)\n"]
    for n in nomor:
        q = var[n][1]
        assert "--" not in q and "/*" not in q and "\t" not in q
        uk.append("%d\t%s\n" % (n, " ".join(q.split()).rstrip(";").rstrip()))
    tulis("uji-kueri.tsv", "".join(uk))
    # --- berkas timpa (deterministik) -----------------------------------------------------------------------------------------
    dt = ["# folder<TAB>berkas<TAB>md5_lama<TAB>md5_baru<TAB>ket - ditimpa HANYA bila md5 server persis md5_lama (lihat berkas_rtf.py)\n"]
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="wb", mtime=0) as gz:
        with tarfile.open(fileobj=gz, mode="w", format=tarfile.USTAR_FORMAT) as tar:
            for f, b, m0, m1, ket, isi in timpa:
                dt.append("derry_briantono/%s\t%s\t%s\t%s\t%s\n" % (f, b, m0, m1, ket))
                ti = tarfile.TarInfo("timpa/derry_briantono/%s/%s" % (f, b))
                ti.size, ti.mtime, ti.mode, ti.uid, ti.gid, ti.uname, ti.gname = len(isi), 0, 0o644, 0, 0, "root", "root"
                tar.addfile(ti, io.BytesIO(isi))
    open(os.path.join(PAKET, "timpa.tgz"), "wb").write(buf.getvalue())
    tulis("daftar-timpa.tsv", "".join(dt))
    # --- MD5SUMS -----------------------------------------------------------------------------------------------------------------
    nama_berkas = sorted(x for x in os.listdir(PAKET) if os.path.isfile(os.path.join(PAKET, x)) and x != "MD5SUMS.txt")
    tulis("MD5SUMS.txt", "".join("%s  %s\n" % (md5(open(os.path.join(PAKET, x), "rb").read()), x) for x in nama_berkas))
    json.dump({"paket": N, "basis": BASIS, "rtf": RTF, "variabel_baru": {str(n): {"nama": var[n][0], "md5": hs[n]} for n in nomor},
               "variabel_asal_md5": {str(n): ha[n] for n in ha}, "dirujuk": rujuk,
               "timpa": [{"folder": f, "berkas": b, "md5_lama": m0, "md5_baru": m1, "aturan": ket} for f, b, m0, m1, ket, _ in timpa]},
              open(os.path.join(HASIL, "isi-paket.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("variabel baru %d, dirujuk %d, blangko ditimpa %d" % (len(nomor), len(rujuk), len(timpa)))
    for f, b, m0, m1, ket, _ in timpa:
        print("  %-75s %s" % ((f + "/" + b)[:75], ket))


def tulis(nama, isi):
    with open(os.path.join(PAKET, nama), "w", encoding="latin1", newline="\n") as o:
        o.write(isi)


if __name__ == "__main__":
    main()
