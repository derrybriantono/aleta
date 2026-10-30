# -*- coding: utf-8 -*-
"""Bangun paket ABT abt-prodeo-panggilan-29okt (Python 3, laptop). Deterministik dari:
  - basis ABT keadaan server (bawaan aps_badilag_2810 = dump server 28 Okt 15.44): HEX + MD5 variabel 8508 8547 8600,
    dan bukti nomor 11120-11143 belum dipakai;
  - pohon RTF derry_briantono keadaan server (bawaan salinan server 26 Okt D:/Aplikasi/aleta/tmp/w82/rtf/derry_briantono)
    + berkas paket sesudahnya (blangko-ikrar-92-28okt, court-calendar-28okt, sampul-daftar-isi-26okt) yang menimpanya.
Keluaran: ../paket-satker/ (SQL, daftar-timpa.tsv, timpa.tgz, MD5SUMS.txt) dan ../hasil/isi-paket.json.
pakai: python bangun_paket.py [basis] [akar RTF]"""
import gzip
import hashlib
import io
import json
import re
import os
import shutil
import subprocess
import sys
import tarfile

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SINI)
import isi_variabel as IV  # noqa: E402
import tambal_rtf as TR  # noqa: E402

PAKET = os.path.join(SINI, "..", "paket-satker")
HASIL = os.path.join(SINI, "..", "hasil")
N = "abt-prodeo-panggilan-29okt"
MYSQL = r"D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe"
BASIS = sys.argv[1] if len(sys.argv) > 1 else "aps_badilag_2810"
# pohon blangko PERKIRAAN SERVER sebelum paket ini (agen BAS, w124 alat/susun_dasar.py SEMUA=1): salinan server w82 + alamat-ganda-26okt,
# sampul-daftar-isi-26okt, pihak-urut-ecourt-27okt, court-calendar-28okt, blangko-ikrar-92-28okt (semua sudah terpasang di server)
RTF = sys.argv[2] if len(sys.argv) > 2 else r"D:\Aplikasi\aleta\tmp\bas29\dasar2\derry_briantono"
REPO_PAKET = os.path.join(SINI, "..", "..")
TINDIH = ["blangko-ikrar-92-28okt", "court-calendar-28okt", "sampul-daftar-isi-26okt"]
KEPALA = "-- Paket ABT \"%s\" (29 Okt 2026): perkara prodeo (amar tanpa nominal, rincian Rp0,00 (nihil)) dan tanggal panggilan sebanyak relaas.\n" % N


def sql(q):
    r = subprocess.run([MYSQL, "-h127.0.0.1", "-uroot", "-N", "--raw", "--default-character-set=latin1", BASIS, "-e", q],
                       capture_output=True, check=True)
    return r.stdout.decode("latin1")


def hx(s):
    return "0x" + s.encode("latin1").hex()


def md5(b):
    return hashlib.md5(b).hexdigest()


def tanda_baris(no, nama, q):
    """MD5(CONCAT_WS('|', nama, data_type, sql_query, locked)) baris baru (dihitung sama di MySQL)."""
    return md5(("%s|data_sql|%s|0" % (nama, q)).encode("latin1"))


def satu_baris(q):
    assert "--" not in q and "/*" not in q, "kueri berkomentar tidak bisa dijadikan satu baris"
    return " ".join(q.split()).rstrip(";").rstrip()


def main():
    os.makedirs(PAKET, exist_ok=True)
    os.makedirs(HASIL, exist_ok=True)
    # --- RTF -----------------------------------------------------------------------------------------------------------
    dasar = {}
    for akar, _, fs in os.walk(RTF):
        for f in fs:
            if f.lower().endswith(".rtf"):
                p = os.path.join(akar, f)
                dasar["derry_briantono/" + os.path.relpath(p, RTF).replace("\\", "/")] = p
    for pk in TINDIH:
        a = os.path.join(REPO_PAKET, pk, "paket-satker", "rtf")
        for akar, _, fs in os.walk(a):
            for f in fs:
                if f.lower().endswith(".rtf"):
                    p = os.path.join(akar, f)
                    dasar[os.path.relpath(p, a).replace("\\", "/")] = p
    # --- bentuk amar biaya tertulis langsung: dikumpulkan dari semua blangko, diberi nomor 11150.. urut kalimat -------------
    for rel in sorted(dasar):
        TR.cari_edit(TR.urai(open(dasar[rel], 'rb').read())[0], rel[len('derry_briantono/'):])
    # nomor TETAP per kalimat (sumber/varian-nomor.tsv): paket lain (BAS w124) dibangun di atas RTF paket ini, jadi kalimat lama
    # tidak boleh berganti nomor; kalimat baru mendapat nomor berikutnya dan dicatat
    tetap_p = os.path.join(SINI, "varian-nomor.tsv")
    tetap = {}
    for b in io.open(tetap_p, encoding="utf-8"):
        if b.strip() and not b.startswith("#"):
            no, k = b.rstrip("\n").split("\t")
            tetap[k] = int(no)
    for k in sorted(TR.DIKUMPUL - set(tetap)):
        tetap[k] = max(list(tetap.values()) + [11149]) + 1
    assert max(tetap.values()) <= 11199
    with io.open(tetap_p, "w", encoding="utf-8", newline="\n") as o:
        o.write("# nomor<TAB>kalimat amar biaya tertulis - nomor TETAP (bentuk baru mendapat nomor berikutnya; jangan diurut ulang: paket lain dibangun di atas RTF paket ini)\n")
        for k, no in sorted(tetap.items(), key=lambda x: x[1]):
            o.write("%d\t%s\n" % (no, k))
    for k, no in sorted(tetap.items(), key=lambda x: x[1]):
        if k in TR.DIKUMPUL:
            TR.VARIAN[k] = no
            IV.BARU.append(IV.varian(no, k))

    # --- variabel ----------------------------------------------------------------------------------------------------
    nomor_baru = [n for n, _, _ in IV.BARU]
    assert len(set(nomor_baru)) == len(nomor_baru)
    ada = sql("SELECT no_var FROM abt_variabel WHERE no_var BETWEEN 11120 AND 11199").split()
    assert not ada, "nomor baru sudah dipakai di %s: %s" % (BASIS, ada)
    ubah = {}
    for no in sorted(set(IV.UBAH) | set(IV.GANTI_UTUH)):
        h, m, mod = sql("SELECT HEX(sql_query), MD5(sql_query), IFNULL(modifier, '-') FROM abt_variabel WHERE no_var = %d" % no).split()
        lama = bytes.fromhex(h).decode("latin1")
        assert md5(lama.encode("latin1")) == m
        assert mod == "admin", "variabel %d bukan milik pekerjaan Derry" % no
        if no in IV.GANTI_UTUH:
            baru = IV.GANTI_UTUH[no]
        else:
            baru = lama
            for a, b, k in IV.UBAH[no]:
                assert baru.count(a) == k, "%d: '%s' muncul %d kali, harap %d" % (no, a, baru.count(a), k)
                baru = baru.replace(a, b)
        ubah[no] = (lama, baru, m, md5(baru.encode("latin1")))
    # NAMA variabel ikut dirender ABT (data_variabel_detil: 'nama' => variabel($nama)): penanda #NNNN# di nama DIHITUNG tiap cetak.
    # Di nama hanya sebutan #0046#/#0047# yang boleh; selain itu ditulis [NNNN] (mis. #8505# -> #0143# -> #5223# membuat verzet GALAT).
    IV.BARU[:] = [(n, re.sub(r"#(?!0046#|0047#)(\d{4,5})#", r"[\1]", nama), q) for n, nama, q in IV.BARU]
    for n, nama, q in IV.BARU:
        assert "aleta" not in (nama + q).lower()
        assert len(nama) <= 200, "nama %d terlalu panjang (%d)" % (n, len(nama))
        assert not re.search(r"#(?!0046#|0047#)\d{4,5}#", nama), nama
    for no, (lama, baru, a, b) in ubah.items():
        assert "aleta" not in baru.lower()

    fungsi = io.open(os.path.join(SINI, "fungsi-terbilang.sql"), encoding="utf-8").read()
    io.open(os.path.join(PAKET, N + "-FUNGSI.sql"), "w", encoding="ascii", newline="\n").write(fungsi)
    io.open(os.path.join(PAKET, N + "-FUNGSI-PULIH.sql"), "w", encoding="ascii", newline="\n").write(
        "-- PULIH fungsi paket (hanya fungsi milik paket ini)\nDROP FUNCTION IF EXISTS aps_badilag.isian_rtf_terbilang;\n")

    # PRASYARAT A|B|C|D|E: A nomor baru yang ada dengan isi BUKAN paket (0) | B nomor baru yang sudah persis paket (0 / 23)
    #   | C variabel ubahan berisi LAMA (3 / 0) | D berisi BARU (0 / 3) | E fungsi isian_rtf_tanggal ada (1)
    nb = len(IV.BARU)
    daftar_baru = " UNION ALL ".join("SELECT %d AS n, '%s' AS h" % (n, tanda_baris(n, nama, q)) for n, nama, q in IV.BARU)
    daftar_ubah = " UNION ALL ".join("SELECT %d AS n, '%s' AS l, '%s' AS b" % (no, v[2], v[3]) for no, v in sorted(ubah.items()))
    pras = (KEPALA + "-- PRASYARAT (baca saja) \"A|B|C|D|E\": A = nomor 11120-11199 yang sudah ada tetapi isinya bukan isi paket (harus 0) | B = nomor baru"
            " yang sudah persis isi paket | C = variabel ubahan (nomor-ubah.txt) berisi LAMA | D = berisi BARU | E = fungsi isian_rtf_tanggal ada (1).\n"
            "-- Benar: \"0|0|%d|0|1\" (pasang pertama) atau \"0|%d|0|%d|1\" (pasang ulang). Selain itu berhenti, tidak ada yang diubah.\n" % (len(ubah), nb, len(ubah)))
    pras += ("SELECT CONCAT_WS('|',\n"
             "  (SELECT COUNT(*) FROM aps_badilag.abt_variabel v WHERE v.no_var BETWEEN 11120 AND 11199 AND NOT EXISTS (SELECT 1 FROM (%s) d WHERE d.n = v.no_var AND d.h = MD5(CONCAT_WS('|', v.nama, v.data_type, IFNULL(v.sql_query, ''), v.locked)))),\n"
             "  (SELECT COUNT(*) FROM aps_badilag.abt_variabel v JOIN (%s) d ON d.n = v.no_var AND d.h = MD5(CONCAT_WS('|', v.nama, v.data_type, IFNULL(v.sql_query, ''), v.locked))),\n"
             "  (SELECT COUNT(*) FROM aps_badilag.abt_variabel v JOIN (%s) d ON d.n = v.no_var AND MD5(v.sql_query) = d.l),\n"
             "  (SELECT COUNT(*) FROM aps_badilag.abt_variabel v JOIN (%s) d ON d.n = v.no_var AND MD5(v.sql_query) = d.b),\n"
             "  (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'isian_rtf_tanggal')) AS prasyarat;\n"
             % (daftar_baru, daftar_baru, daftar_ubah, daftar_ubah))
    pasang = [KEPALA + "-- PASANG: satu transaksi. Baris baru INSERT ... WHERE NOT EXISTS; ubahan UPDATE bersyarat MD5 isi lama (aman diulang).", "START TRANSACTION;"]
    pulih = [KEPALA + "-- PULIH: baris baru dihapus HANYA bila isinya masih persis paket; ubahan dikembalikan HANYA bila isinya masih persis isi baru.", "START TRANSACTION;"]
    periksa = [KEPALA + "-- PERIKSA (baca saja): tiap baris persis isi paket. Baris terakhir harus: SEMUA COCOK", "SELECT label, ok FROM ("]
    cek = []
    for n, nama, q in IV.BARU:
        h = tanda_baris(n, nama, q)
        pasang.append("INSERT INTO aps_badilag.abt_variabel (no_var, nama, data_type, sql_query, locked) SELECT %d, %s, 'data_sql', %s, 0 FROM DUAL"
                      " WHERE NOT EXISTS (SELECT 1 FROM aps_badilag.abt_variabel WHERE no_var = %d);" % (n, hx(nama), hx(q), n))
        pulih.append("DELETE FROM aps_badilag.abt_variabel WHERE no_var = %d AND MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), locked)) = '%s';" % (n, h))
        cek.append("SELECT 'variabel %d' AS label, (SELECT COUNT(*) FROM aps_badilag.abt_variabel v WHERE v.no_var = %d AND MD5(CONCAT_WS('|', v.nama, v.data_type, IFNULL(v.sql_query, ''), v.locked)) = '%s') AS ok" % (n, n, h))
    for no, (lama, baru, ml, mb) in sorted(ubah.items()):
        pasang.append("UPDATE aps_badilag.abt_variabel SET sql_query = %s WHERE no_var = %d AND MD5(sql_query) = '%s';" % (hx(baru), no, ml))
        pulih.append("UPDATE aps_badilag.abt_variabel SET sql_query = %s WHERE no_var = %d AND MD5(sql_query) = '%s';" % (hx(lama), no, mb))
        cek.append("SELECT 'variabel %d' AS label, (SELECT COUNT(*) FROM aps_badilag.abt_variabel v WHERE v.no_var = %d AND MD5(v.sql_query) = '%s') AS ok" % (no, no, mb))
    cek.append("SELECT 'fungsi isian_rtf_terbilang' AS label, (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'isian_rtf_terbilang') AS ok")
    gab = "\nUNION ALL ".join(cek)
    periksa.append(gab)
    periksa.append(") t\nUNION ALL SELECT IF(MIN(t2.ok) = 1 AND MAX(t2.ok) = 1 AND COUNT(*) = %d, 'SEMUA COCOK', 'TIDAK COCOK'), '' FROM (\n%s\n) t2;"
                   % (len(cek), gab))
    pasang.append("COMMIT;")
    pulih.append("COMMIT;")
    for nama, isi in (("PRASYARAT", [pras]), ("PASANG", pasang), ("PULIH", pulih), ("PERIKSA", periksa)):
        io.open(os.path.join(PAKET, "%s-%s.sql" % (N, nama)), "w", encoding="ascii", newline="\n").write("\n".join(isi) + "\n")
    with io.open(os.path.join(PAKET, "nomor-baru.txt"), "w", encoding="ascii", newline="\n") as o:
        o.write("# nomor variabel baru paket (satu per baris)\n" + "".join("%d\n" % n for n in nomor_baru))
    with io.open(os.path.join(PAKET, "nomor-ubah.txt"), "w", encoding="ascii", newline="\n") as o:
        o.write("# nomor variabel Derry yang diubah bersyarat md5 (satu per baris)\n" + "".join("%d\n" % n for n in sorted(ubah)))
    # uji kueri (server, baca saja): nomor<TAB>kueri satu baris
    with io.open(os.path.join(PAKET, "uji-kueri.tsv"), "w", encoding="ascii", newline="\n") as o:
        o.write("# nomor<TAB>kueri satu baris (#perkara_id# diganti; penanda #NNNN# lain dibiarkan apa adanya: diuji bahwa kueri JALAN)\n")
        for n, nama, q in IV.BARU:
            o.write("%d\t%s\n" % (n, satu_baris(q)))
        for no, (lama, baru, ml, mb) in sorted(ubah.items()):
            o.write("%d\t%s\n" % (no, satu_baris(baru)))

    timpa_dir = os.environ.get("PP29_SEMENTARA", r"D:\Aplikasi\aleta\tmp\pp29\tb")  # jalur pendek: nama berkas blangko panjang (MAX_PATH)
    shutil.rmtree(timpa_dir, ignore_errors=True)
    baris, ringkas, gagal = [], {}, []
    for rel in sorted(dasar):
        raw = open(dasar[rel], "rb").read()
        try:
            baru, hit, cat = TR.tambal(raw, rel[len("derry_briantono/"):])
        except ValueError as e:
            gagal.append((rel, str(e)))
            continue
        if baru == raw:
            continue
        folder, berkas = rel.rsplit("/", 1)
        q = os.path.join(timpa_dir, folder, berkas)
        os.makedirs(os.path.dirname(q), exist_ok=True)
        open(q, "wb").write(baru)
        for k, v in hit.items():
            ringkas[k] = ringkas.get(k, 0) + v
        baris.append((folder, berkas, md5(raw), md5(baru), " ".join("%s=%d" % kv for kv in sorted(hit.items()))))
    assert not gagal, gagal
    with io.open(os.path.join(PAKET, "daftar-timpa.tsv"), "w", encoding="utf-8", newline="\n") as o:
        o.write("# folder<TAB>berkas<TAB>md5_lama<TAB>md5_baru<TAB>ket - ditimpa HANYA bila md5 server persis md5_lama (lihat berkas_rtf.py)\n")
        for b in baris:
            o.write("\t".join(b) + "\n")
    # timpa.tgz: urut, mtime tetap, tanpa pemilik -> isi tar deterministik
    tgz = os.path.join(PAKET, "timpa.tgz")
    with gzip.GzipFile(tgz, "wb", compresslevel=9, mtime=0) as gz, tarfile.open(fileobj=gz, mode="w", format=tarfile.GNU_FORMAT) as t:
        for folder, berkas, _, _, _ in baris:
            p = os.path.join(timpa_dir, folder, berkas)
            ti = t.gettarinfo(p, arcname="timpa/%s/%s" % (folder, berkas))
            ti.mtime, ti.uid, ti.gid, ti.uname, ti.gname, ti.mode = 1793145600, 0, 0, "", "", 0o644
            with open(p, "rb") as f:
                t.addfile(ti, f)
    shutil.rmtree(timpa_dir, ignore_errors=True)
    json.dump({"basis": BASIS, "rtf_dasar": RTF, "tindih": TINDIH, "variabel_baru": nomor_baru,
               "variabel_ubah": {str(k): {"md5_lama": v[2], "md5_baru": v[3]} for k, v in sorted(ubah.items())},
               "berkas_ditimpa": len(baris), "aturan": ringkas,
               "varian_amar": {str(v): k for k, v in sorted(TR.VARIAN.items(), key=lambda x: x[1])}},
              io.open(os.path.join(HASIL, "isi-paket.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    # MD5SUMS: semua berkas paket-satker kecuali cadangan/ dan timpa/ (dibuat saat pasang)
    with io.open(os.path.join(PAKET, "MD5SUMS.txt"), "w", encoding="utf-8", newline="\n") as o:
        for f in sorted(os.listdir(PAKET)):
            p = os.path.join(PAKET, f)
            if os.path.isfile(p) and f != "MD5SUMS.txt":
                o.write("%s  %s\n" % (md5(open(p, "rb").read()), f))
    print("variabel baru %d, ubahan %s, berkas RTF ditimpa %d, aturan %s" % (nb, sorted(ubah), len(baris), ringkas))


if __name__ == "__main__":
    main()
