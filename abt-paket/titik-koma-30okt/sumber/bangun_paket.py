# -*- coding: utf-8 -*-
"""Bangun paket ABT abt-titik-koma-30okt.

Masalah (keputusan pengguna 30 Okt): di blangko Derry titik koma ";" muncul DI TENGAH butir - keterangan saksi putusan
("tidak berhasil;karena ...", "karena :- A;- B;"), daftar bukti surat ("Fotokopi KTP; telah diberi meterai"), juga
tanda baca ganda (";;", ".,", ";.") dan spasi sebelum tanda baca. ";" hanya boleh di AKHIR butir.
Perbaikan di PERANGKAI (bukan data tersimpan): fungsi baru isian_rtf_butir_rapi(t, ujung) merapikan satu butir; dipanggil
  - isian_rtf_ket_saksi (variabel keterangan saksi putusan 9259-9265): tiap jawaban, ujung ";"
  - isian_rtf_bukti (variabel daftar bukti 11170-11177): tiap butir bukti, ujung dibiarkan
Dasar: definisi SESUDAH paket ket-saksi-kata-30okt dan bukti-nomor-30okt (md5 diperiksa PRASYARAT). Selain baris pemanggil
fungsi baru, definisi SAMA PERSIS (diperiksa di sini).
pakai: python bangun_paket.py   -> ../paket-satker/*.sql
"""
import hashlib, io, json, os, re

SINI = os.path.dirname(os.path.abspath(__file__))
AKAR = os.path.join(SINI, '..', '..')
PK = os.path.join(SINI, '..', 'paket-satker')
N = 'abt-titik-koma-30okt'
md5 = lambda s: hashlib.md5(s.encode('utf-8')).hexdigest()


KOMENTAR = re.compile("--[^" + chr(10) + "]*")
KOSONG = re.compile("[" + chr(92) * 2 + " " + chr(9) + chr(13) + chr(10) + "]")


def sidik(badan):
    # md5 definisi yang TAHAN beda klien/versi: routine_definition MariaDB menyimpan badan tanpa komentar (dibuang klien mysql)
    # dan escape literal sudah diolah. Sidik = badan tanpa komentar, tanpa garis miring terbalik, tanpa spasi/tab/ganti baris.
    # Rumus SQL yang sama: SIDIK_SQL (PRASYARAT).
    t = re.sub(KOMENTAR, "", badan)
    t = re.sub(KOSONG, "", t)
    return hashlib.md5(t.encode('utf-8')).hexdigest()


SIDIK_SQL = ("MD5(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), 'aps_badilag.abt_'), "
             "CHAR(92), ''), ' ', ''), CHAR(9), ''), CHAR(13), ''), CHAR(10), ''))")


def baca(p):
    return io.open(os.path.join(AKAR, p), encoding='utf-8', newline='').read()


def potong(sql, nama):
    """(kepala CREATE..COMMENT, badan BEGIN..END) fungsi `nama` dari berkas FUNGSI paket lain."""
    m = re.search(r'DELIMITER ;;\r?\n(CREATE DEFINER=CURRENT_USER FUNCTION `%s`.*?\r?\n)(BEGIN\r?\n.*?\r?\nEND);;' % re.escape(nama), sql, re.S)
    assert m, nama
    return m.group(1), m.group(2)


# --- dasar: ket-saksi-kata (isian_rtf_ket_saksi) dan bukti-nomor (isian_rtf_bukti)
KS_KEP, KS_LAMA = potong(baca('ket-saksi-kata-30okt/paket-satker/abt-ket-saksi-kata-30okt-FUNGSI.sql'), 'isian_rtf_ket_saksi')
BK_KEP, BK_LAMA = potong(baca('bukti-nomor-30okt/paket-satker/abt-bukti-nomor-30okt-FUNGSI.sql'), 'isian_rtf_bukti')
MD5_KS_LAMA, MD5_BK_LAMA = sidik(KS_LAMA), sidik(BK_LAMA)
nl = '\r\n' if '\r\n' in KS_LAMA else '\n'

# --- isian_rtf_ket_saksi: rapikan tiap jawaban sesudah penggantian kata; jawaban yang habis tidak dicetak
a = ("        SET t = isian_rtf_iganti(t, 'termohon', 'Termohon');\n"
     "        SET o = CONCAT(o, IF(CHAR_LENGTH(o) > 0, '<br>', ''), '-   Bahwa ', t);\n")
b = ("        SET t = isian_rtf_iganti(t, 'termohon', 'Termohon');\n"
     "        SET t = isian_rtf_butir_rapi(t, ';');\n"
     "        IF CHAR_LENGTH(t) > 0 THEN\n"
     "          SET o = CONCAT(o, IF(CHAR_LENGTH(o) > 0, '<br>', ''), '-   Bahwa ', t);\n"
     "        END IF;\n")
a, b = a.replace('\n', nl), b.replace('\n', nl)
assert KS_LAMA.count(a) == 1
KS_BARU = KS_LAMA.replace(a, b)
KS_KEP_BARU = KS_KEP.replace("saya/ya kata utuh'", "saya/ya kata utuh, T30 butir rapi'")
assert KS_KEP_BARU != KS_KEP

# --- isian_rtf_bukti: tiap butir dirapikan (dua tempat CONCAT butir)
a2 = "n, '.\\\\tab ', butir);"
assert BK_LAMA.count(a2) == 2, BK_LAMA.count(a2)
BK_BARU = BK_LAMA.replace(a2, "n, '.\\\\tab ', isian_rtf_butir_rapi(butir, ''));")
BK_KEP_BARU = BK_KEP.replace("baris lanjutan digabung)'", "baris lanjutan digabung, T30 butir rapi)'")
assert BK_KEP_BARU != BK_KEP

RAPI = io.open(os.path.join(SINI, 'fungsi-butir-rapi.sql'), encoding='utf-8').read().rstrip('\r\n')
RAPI_KEP, RAPI_BADAN = RAPI[:RAPI.index('BEGIN')], RAPI[RAPI.index('BEGIN'):]
MD5_RAPI = sidik(RAPI_BADAN)
MD5_KS_BARU, MD5_BK_BARU = sidik(KS_BARU), sidik(BK_BARU)


def fungsi(kep, badan):
    return 'DELIMITER ;;\n%s%s;;\nDELIMITER ;\n' % (kep, badan)


def tulis(nama, isi):
    with io.open(os.path.join(PK, nama), 'w', encoding='utf-8', newline='\n') as f:
        f.write(isi)


os.makedirs(PK, exist_ok=True)
tulis(N + '-FUNGSI.sql',
      "-- Paket ABT \"%s\": 1 fungsi baru (isian_rtf_butir_rapi) + 2 diganti (isian_rtf_ket_saksi, isian_rtf_bukti; nama dan tanda tangan sama).\n"
      "-- Dijalankan pasang-satker.sh SESUDAH PRASYARAT.\n"
      "DROP FUNCTION IF EXISTS `isian_rtf_butir_rapi`;\n%s"
      "DROP FUNCTION IF EXISTS `isian_rtf_ket_saksi`;\n%s"
      "DROP FUNCTION IF EXISTS `isian_rtf_bukti`;\n%s" % (N, fungsi(RAPI_KEP, RAPI_BADAN), fungsi(KS_KEP_BARU, KS_BARU), fungsi(BK_KEP_BARU, BK_BARU)))
tulis(N + '-FUNGSI-LAMA.sql',
      "-- Paket ABT \"%s\": PULIH - isian_rtf_ket_saksi (md5 %s) dan isian_rtf_bukti (md5 %s) persis seperti sebelum paket;\n"
      "-- fungsi baru isian_rtf_butir_rapi dihapus.\n"
      "DROP FUNCTION IF EXISTS `isian_rtf_ket_saksi`;\n%s"
      "DROP FUNCTION IF EXISTS `isian_rtf_bukti`;\n%s"
      "DROP FUNCTION IF EXISTS `isian_rtf_butir_rapi`;\n" % (N, MD5_KS_LAMA, MD5_BK_LAMA, fungsi(KS_KEP, KS_LAMA), fungsi(BK_KEP, BK_LAMA)))

DEF = ("(SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='%s'%s)")
NORM = "\n    AND " + SIDIK_SQL + " = '%s'"
tulis(N + '-PRASYARAT.sql',
      "-- PRASYARAT %s (BACA SAJA). Satu baris A|B|C|D|E:\n"
      "--  A = isian_rtf_ket_saksi = versi paket ket-saksi-kata-30okt (md5 %s) (1 sebelum, 0 sesudah)\n"
      "--  B = isian_rtf_bukti = versi paket bukti-nomor-30okt (md5 %s) (1 sebelum, 0 sesudah)\n"
      "--  C = isian_rtf_butir_rapi ada (0 sebelum, 1 sesudah)\n"
      "--  D = isian_rtf_ket_saksi = versi paket ini (md5 %s) (0 sebelum, 1 sesudah)\n"
      "--  E = isian_rtf_bukti = versi paket ini (md5 %s) (0 sebelum, 1 sesudah)\n"
      "-- Pasang bila 1|1|0|0|0; pasang ulang bila 0|0|1|1|1; selain itu berhenti tanpa mengubah apa pun\n"
      "-- (A=0 atau B=0 sebelum pasang: pasang ket-saksi-kata-30okt dan bukti-nomor-30okt dulu).\n"
      "SELECT CONCAT_WS('|',\n %s,\n %s,\n %s,\n %s,\n %s\n) AS prasyarat;\n" % (
          N, MD5_KS_LAMA, MD5_BK_LAMA, MD5_KS_BARU, MD5_BK_BARU,
          DEF % ('isian_rtf_ket_saksi', NORM % MD5_KS_LAMA), DEF % ('isian_rtf_bukti', NORM % MD5_BK_LAMA), DEF % ('isian_rtf_butir_rapi', ''),
          DEF % ('isian_rtf_ket_saksi', NORM % MD5_KS_BARU), DEF % ('isian_rtf_bukti', NORM % MD5_BK_BARU)))
tulis('harap.txt', '1|1|0|0|0\n0|0|1|1|1\n')

# PERIKSA: seluruh vektor (sama dengan uji ekstensi) + pemanggil memakai fungsi baru
vek = json.load(io.open(os.path.join(SINI, 'vektor-rapi.json'), encoding='utf-8'))
hx = lambda s: "CONVERT(X'%s' USING latin1)" % s.encode('latin1').hex()
syarat = ["HEX(isian_rtf_butir_rapi(%s, '%s')) = '%s'" % (hx(v['masuk']), v['ujung'], v['harap'].encode('latin1').hex().upper()) for v in vek]
syarat += [
    "isian_rtf_butir_rapi(NULL, ';') IS NULL",
    "isian_rtf_bukti(CONCAT('1. Fotokopi KTP ; diberi meterai;', CHAR(10), '2. Fotokopi KK;')) = CONCAT('1.', CHAR(92), 'tab Fotokopi KTP, diberi meterai;<br>2.', CHAR(92), 'tab Fotokopi KK;')",
    "isian_rtf_bukti('') = CONCAT('1.', CHAR(92), 'tab ...')",
    "isian_rtf_ket_saksi(0, NULL) = '...'",
    DEF % ('isian_rtf_ket_saksi', " AND LOCATE('isian_rtf_butir_rapi', routine_definition) > 0 AND LOCATE('isian_rtf_ganti_kata', routine_definition) > 0") + ' = 1',
    DEF % ('isian_rtf_bukti', " AND LOCATE('isian_rtf_butir_rapi', routine_definition) > 0 AND LOCATE('isian_rtf_bukti_nomor', routine_definition) > 0") + ' = 1',
]
tulis(N + '-PERIKSA.sql',
      "-- PERIKSA %s (BACA SAJA): %d vektor isian_rtf_butir_rapi (sama dengan uji panel ekstensi) + pemanggil. Baris terakhir harus \"SEMUA COCOK\".\n"
      "SELECT IF(\n  %s,\n  'SEMUA COCOK', 'TIDAK COCOK') AS periksa;\n" % (N, len(vek), '\n  AND '.join(syarat)))
json.dump(dict(md5_ket_saksi_lama=MD5_KS_LAMA, md5_ket_saksi_baru=MD5_KS_BARU, md5_bukti_lama=MD5_BK_LAMA, md5_bukti_baru=MD5_BK_BARU, md5_butir_rapi=MD5_RAPI),
          io.open(os.path.join(SINI, '..', 'hasil', 'md5-definisi.json'), 'w', encoding='utf-8'), indent=1)
print('ket_saksi', MD5_KS_LAMA, '->', MD5_KS_BARU, '| bukti', MD5_BK_LAMA, '->', MD5_BK_BARU, '| rapi', MD5_RAPI)
