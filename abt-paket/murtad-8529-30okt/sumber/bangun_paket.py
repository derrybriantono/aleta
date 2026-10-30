# -*- coding: utf-8 -*-
"""Bangun paket ABT abt-murtad-8529-30okt (G1, jawaban pengguna 30 Okt malam butir 48): variabel 8529 (pertimbangan bukti surat
perceraian verstek) mendapat paragraf untuk huruf alasan H (murtad).

Kalimat lama 8529 (cabang KTP / surat domisili / ELSE) TIDAK diubah; paragraf murtad DITAMBAHKAN sesudahnya hanya bila isian
huruf alasan memuat H (dibaca seperti 8531: FASAKH/MURTAD = H, huruf A-H sah). Pihak yang murtad:
  1. data agama pihak di SIPP (sama dengan 8521/8522/8528/8531: pihak pertama bukan Islam -> #0046#, pihak kedua -> #0047#);
  2. bila agama keduanya masih Islam di SIPP: POSITA gugatan (pola "#0046#/#0047# ... keluar dari agama Islam / murtad / pindah
     agama / beragama Kristen ...", seperti pola pihak sakit #0046#/#0047# paket eg-sakit-28okt);
  3. tidak terbaca keduanya -> "[AGAMA PIHAK YANG MURTAD BELUM DIUBAH DI SIPP]" (bunyi sama dengan 8521/8522/8528/8531).
Bukti: daftar bukti surat (1214) memuat surat perpindahan agama (pindah/masuk agama, baptis, sidi, sudhi wadani, surat keterangan
gereja/agama) -> kalimat bukti surat + saksi; tidak ada -> kalimat bersandar pada keterangan saksi.
Sebutan pihak dari variabel (#0046#/#0047#), tidak ada nama/satker tertulis mati.

URUTAN: SESUDAH paket alasan-belum-dipilih-30okt (md5 dasar = keadaan sesudah paket itu). Urutan bebas terhadap agama-belum-diubah.
pakai: python bangun_paket.py <basis salinan sesudah alasan-belum-dipilih-30okt>"""
import binascii, io, os, subprocess, sys
SINI = os.path.dirname(os.path.abspath(__file__))
PK = os.path.join(SINI, '..', 'paket-satker')
N = 'abt-murtad-8529-30okt'
MYSQL = r'D:\satker asal\website pa bungku\xampp\mysql\bin\mysql.exe'
db = sys.argv[1]
NORM = "REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')"


def q(sql):
    r = subprocess.run([MYSQL, '-u', 'root', '-h', '127.0.0.1', '-N', '-r', '--default-character-set=latin1', db, '-e', sql], capture_output=True)
    if r.returncode:
        sys.exit(r.stderr.decode('latin1'))
    return r.stdout.decode('latin1')


# Dibaca lewat HEX: isi kueri memuat CRLF, dan keluaran mysql.exe di Windows menambah CR pada tiap LF.
lama = bytes.fromhex(q("SELECT HEX(%s) FROM abt_variabel WHERE no_var = 8529" % NORM).strip()).decode('latin1')
modifier = q("SELECT modifier FROM abt_variabel WHERE no_var = 8529").strip()
assert modifier == 'admin', modifier
assert lama.rstrip().endswith('AS data;'), lama[-60:]
assert 'HURUF ALASAN PERCERAIAN BELUM DIPILIH' in lama, 'paket alasan-belum-dipilih-30okt belum terpasang'
assert 'murtad' not in lama.lower()
inti = lama.rstrip().rstrip(';').rstrip()

IS = lambda no: ("IFNULL(REPLACE(REPLACE(REPLACE(CONVERT((SELECT data FROM aps_badilag.abt_data_teks WHERE no_var=%d AND perkara_id='#perkara_id#') USING utf8),"
                 "'\\\\','/'),'\"','&quot;'),'''','&#39;'),'')" % no)
HURUF = ("CASE WHEN UPPER(TRIM(%s)) IN ('FASAKH', 'MURTAD') THEN 'H' ELSE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE("
         "UPPER(TRIM(%s)), 'DAN', ''), '&', ''), ',', ''), ' ', ''), '+', ''), '/', ''), '.', ''), '-', '') END" % (IS(8503), IS(8503)))
AGAMA = lambda t, kol: ("(SELECT %s FROM %s pp JOIN pihak ph ON ph.id = pp.pihak_id LEFT JOIN agama ag ON ag.id = ph.agama_id "
                        "WHERE pp.perkara_id = '#perkara_id#' ORDER BY pp.urutan LIMIT 1)" % (kol, t))
AG_BARU = "kristen|katolik|katholik|protestan|hindu|buddha|budha|konghucu|khonghucu"
KATA = ("( yang| telah| sudah| kini| kemudian| pun| saat ini| sekarang| sejak [^,.;]{1,40}| hingga [^,.;]{1,30})* "
        "(keluar dari agama islam|murtad|berpindah agama|pindah agama|pindah ke agama|kembali (memeluk|ke) agama|masuk agama|"
        "memeluk agama (%s)|beragama (%s))" % (AG_BARU, AG_BARU))
POLA_P = "#0046#" + KATA
POLA_T = "#0047#" + KATA
BUKTI = ("pindah agama|perpindahan agama|keluar dari agama|masuk agama|baptis|sidi|sudhi wadani|sudi wadani|surat keterangan gereja|"
         "surat keterangan agama|sertifikat (baptis|sidi)")
PAG_SIPP = ("CASE x.nag WHEN 'Protestan' THEN 'memeluk agama Kristen Protestan' WHEN 'Katolik' THEN 'memeluk agama Kristen Katolik' "
            "WHEN 'Kong Hu Cu' THEN 'memeluk agama Khonghucu' WHEN 'Lainnya' THEN 'memeluk agama lain selain Islam' "
            "ELSE CONCAT('memeluk agama ', x.nag) END")
PAG_POSITA = ("CASE WHEN x.ps REGEXP 'protestan' THEN 'memeluk agama Kristen Protestan' WHEN x.ps REGEXP 'katolik|katholik' THEN "
              "'memeluk agama Kristen Katolik' WHEN x.ps REGEXP 'kristen' THEN 'memeluk agama Kristen' WHEN x.ps REGEXP 'hindu' THEN "
              "'memeluk agama Hindu' WHEN x.ps REGEXP 'buddha|budha' THEN 'memeluk agama Buddha' WHEN x.ps REGEXP 'konghucu|khonghucu' THEN "
              "'memeluk agama Khonghucu' ELSE 'memeluk agama lain selain Islam' END")
KAL_BUKTI = ('CONCAT("Menimbang, bahwa dalil ", m.mp, " telah keluar dari agama Islam (<i>murtad</i>) dan ", m.pag, '
             '" dikuatkan oleh bukti surat tentang perpindahan agama ", m.mp, " yang telah bermeterai cukup dan dicocokkan dengan aslinya, '
             'serta oleh keterangan saksi-saksi #0046# yang saling bersesuaian, sehingga harus dinyatakan terbukti bahwa ", m.mp, '
             '" telah keluar dari agama Islam;")')
KAL_SAKSI = ('CONCAT("Menimbang, bahwa meskipun tidak diajukan bukti surat tentang perpindahan agama ", m.mp, ", keterangan saksi-saksi #0046# '
             'yang saling bersesuaian dan berdasarkan pengetahuan saksi sendiri menerangkan bahwa ", m.mp, " telah keluar dari agama Islam '
             '(<i>murtad</i>) dan ", m.pag, ", sehingga harus dinyatakan terbukti bahwa ", m.mp, " telah keluar dari agama Islam;")')

baru = (
    "SELECT CONCAT_WS(CHAR(10 USING utf8), b.data, m.murtad) AS data\n"
    "FROM (\n" + inti + "\n) b,\n"
    "-- Huruf alasan H (murtad), paket abt-murtad-8529-30okt: paragraf tambahan; kalimat bukti surat di atas tidak diubah.\n"
    "(SELECT m.hH, m.mp,\n"
    "  CASE WHEN m.hH = 0 THEN NULL\n"
    "    WHEN m.mp IS NULL THEN \"<mark>[AGAMA PIHAK YANG MURTAD BELUM DIUBAH DI SIPP]</mark>\"\n"
    "    WHEN m.bk = 1 THEN " + KAL_BUKTI + "\n"
    "    ELSE " + KAL_SAKSI + "\n"
    "  END AS murtad\n"
    " FROM (SELECT x.hH, x.bk,\n"
    "    CASE WHEN x.ag1 <> 1 THEN \"#0046#\" WHEN x.ag2 <> 1 THEN \"#0047#\"\n"
    "      WHEN x.ps REGEXP '" + POLA_P + "' AND x.ps NOT REGEXP '" + POLA_T + "' THEN \"#0046#\"\n"
    "      WHEN x.ps REGEXP '" + POLA_T + "' AND x.ps NOT REGEXP '" + POLA_P + "' THEN \"#0047#\" END AS mp,\n"
    "    CASE WHEN x.ag1 <> 1 OR x.ag2 <> 1 THEN " + PAG_SIPP + " ELSE " + PAG_POSITA + " END AS pag\n"
    "  FROM (SELECT IF(z.n <> '' AND z.n NOT REGEXP '[^A-H]' AND INSTR(z.n, 'H') > 0, 1, 0) AS hH,\n"
    "      " + AGAMA('perkara_pihak1', 'ph.agama_id') + " AS ag1,\n"
    "      " + AGAMA('perkara_pihak2', 'ph.agama_id') + " AS ag2,\n"
    "      CASE WHEN " + AGAMA('perkara_pihak1', 'ph.agama_id') + " <> 1 THEN " + AGAMA('perkara_pihak1', 'ag.nama') +
    " ELSE " + AGAMA('perkara_pihak2', 'ag.nama') + " END AS nag,\n"
    "      IFNULL((SELECT p.posita FROM perkara p WHERE p.perkara_id = '#perkara_id#'), '') AS ps,\n"
    "      IF(" + IS(1214) + " REGEXP '" + BUKTI + "', 1, 0) AS bk\n"
    "    FROM (SELECT " + HURUF + " AS n) z\n"
    "  ) x\n"
    " ) m\n"
    ") m;"
)
assert '\u2014' not in baru and all(ord(c) < 256 for c in baru)

hexl = lambda t: '0x' + binascii.hexlify(t.encode('latin1')).decode()
ISI = lambda t: "REPLACE(CONVERT(%s USING latin1), 'aps_badilag.', CONCAT(DATABASE(), '.'))" % hexl(t)
import hashlib
md5 = lambda t: hashlib.md5(t.encode('latin1')).hexdigest()
ML, MB = md5(lama), md5(baru)
# periksa: md5 lama dari basis sama dengan md5 hitungan python (penormalan identik)
assert q("SELECT MD5(%s) FROM abt_variabel WHERE no_var = 8529" % NORM).strip() == ML


def tulis(nama, isi):
    with io.open(os.path.join(PK, nama), 'w', encoding='utf-8', newline='\n') as f:
        f.write(isi)


os.makedirs(PK, exist_ok=True)
tulis(N + '-PRASYARAT.sql',
      "-- PRASYARAT %s (BACA SAJA). Satu baris A|B: A = 8529 PERSIS sebelum paket (sesudah alasan-belum-dipilih-30okt), B = PERSIS hasil paket.\n"
      "-- Pasang bila 1|0; pasang ulang bila 0|1; selain itu berhenti tanpa mengubah apa pun.\n"
      "SELECT CONCAT_WS('|',\n (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 8529 AND MD5(%s) = '%s'),\n"
      " (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 8529 AND MD5(%s) = '%s')\n) AS prasyarat;\n" % (N, NORM, ML, NORM, MB))
tulis(N + '-PASANG.sql',
      "-- Paket ABT \"%s\": satu transaksi; hanya 8529, hanya bila isinya persis sebelum paket. Isi baru = hex latin1 (nama basis dipasang).\n"
      "START TRANSACTION;\nUPDATE abt_variabel SET sql_query = %s\n WHERE no_var = 8529 AND MD5(%s) = '%s';\nCOMMIT;\n" % (N, ISI(baru), NORM, ML))
tulis(N + '-PULIH.sql',
      "-- PULIH %s: 8529 dikembalikan persis (hanya bila isinya persis hasil paket).\n"
      "START TRANSACTION;\nUPDATE abt_variabel SET sql_query = %s\n WHERE no_var = 8529 AND MD5(%s) = '%s';\nCOMMIT;\n" % (N, ISI(lama), NORM, MB))
tulis(N + '-PERIKSA.sql',
      "-- PERIKSA %s (BACA SAJA). Baris terakhir harus \"SEMUA COCOK\".\n"
      "SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var = 8529 AND MD5(%s) = '%s') = 1, 'SEMUA COCOK', 'TIDAK COCOK') AS periksa;\n" % (N, NORM, MB))
tulis('harap.txt', '1|0\n0|1\n')
tulis(os.path.join('..', 'sumber', '8529-baru.sql'), baru + '\n')
print('lama', ML, 'baru', MB, 'panjang', len(lama), '->', len(baru))
