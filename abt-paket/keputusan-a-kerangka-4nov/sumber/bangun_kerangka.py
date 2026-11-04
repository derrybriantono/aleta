# -*- coding: utf-8 -*-
"""Bangun paket abt-keputusan-a-kerangka-4nov (keputusan Derry 182/184, 4 Nov 2026): kerangka berisian + variabel baru.
pakai: python -B bangun_kerangka.py <akar _blangko_abt SESUDAH keputusan-a-mekanis-4nov (memuat derry_briantono/)> <paket-satker> <hasil> <basis ABT (mis. aps_badilag_w206)>
  A4  nafkah iddah: di 9 varian CT Mut'ah Iddah "Rp600.000,00 (...) setiap bulan atau Rp20.000,00 (...) setiap harinya" tetap ->
      #9268# (per bulan) dan #9269# (per hari), dihitung dari isian Nafkah iddah #6054# (dibagi 3 bulan; bila isian sudah menyebut "setiap bulan"
      angkanya dipakai apa adanya). Teks tidak lagi merah.
  A8  dua BAS "- BAS ITSTBAT NIKAH -" [01a]/[01ab]: tabel tanya-jawab teks tetap -> #5058# / #5059# (alat bas-tanya-jawab-29okt/sumber/ubah.py).
  A9  variabel keterangan otomatis saksi 3 T (#9266#) dan saksi 4 T (#9267#) + 4 blangko putusan kontradiktoir baru (CG/CT [02], 3 dan 4 saksi T).
  A10 Asal Usul Anak [01b]: identitas saksi, keterangan (#9259#/#9260#) dan kalimat berikutnya dipecah menjadi paragraf seperti [01]/[01a]/[01c].
Variabel BARU: 9266 9267 9268 9269 (kosong di basis server 3 Nov; data_sql; hanya milik blangko Derry)."""
import base64
import csv
import hashlib
import os
import re
import shutil
import subprocess
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SINI)
sys.path.insert(0, os.path.join(SINI, '..', '..', 'keputusan-a-mekanis-4nov', 'sumber'))
sys.path.insert(0, os.path.join(SINI, '..', '..', 'bas-tanya-jawab-29okt', 'sumber'))
from abtlib import md5b, peta, ubah, periksa, kurung_seimbang  # noqa: E402
import ubah as U8  # noqa: E402  (bas-tanya-jawab-29okt/sumber/ubah.py)

N = 'abt-keputusan-a-kerangka-4nov'
TANGGAL = '2026-11-04 00:00:00'
MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
PREFIX = 'derry_briantono/'

A4_BERKAS = [
    "1a Perceraian CT/[01] [Kabul Verstek] Cerai (Format Lengkap) - Mut'ah Iddah - (3 Saksi).rtf",
    "1a Perceraian CT/[01] [Kabul Verstek] Cerai (Format Lengkap) - Mut'ah Iddah - (4 Saksi).rtf",
    "1a Perceraian CT/[01] [Kabul Verstek] Cerai (Format Lengkap) - Mut'ah Iddah - (5 Saksi).rtf",
    "1a Perceraian CT/[01] [Kabul Verstek] Cerai (Format Lengkap) - Mut'ah Iddah.rtf",
    '1a Perceraian CT/[01a] [Kabul Verstek] CT - F (Ex Offiicio mutah iddah dan nafkah anak).rtf',
    "1a Perceraian CT/[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi - Mut'ah Iddah - (3 Saksi).rtf",
    "1a Perceraian CT/[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi - Mut'ah Iddah - (4 Saksi).rtf",
    "1a Perceraian CT/[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi - Mut'ah Iddah - (5 Saksi).rtf",
    "1a Perceraian CT/[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi - Mut'ah Iddah.rtf",
]
A4_LAMA = 'Rp600.000,00 (enam ratus ribu rupiah) setiap bulan atau Rp20.000,00 (dua puluh ribu rupiah) setiap harinya'
A4_BARU = '#9268# setiap bulan atau #9269# setiap harinya'
A8_BERKAS = ['- BAS ITSTBAT NIKAH -/[01a] BAS 1 IN - Kabul.rtf', '- BAS ITSTBAT NIKAH -/[01ab] BAS 1 IN - Kabul Syahadah Istifadhah.rtf']
A10_BERKAS = '8 Asal Usul Anak/[01b] [Kabul] AUA - Anak Luar Perkawinan Sah, Hubungan Perdata (Ibu Saja atau Perkawinan Siri).rtf'
A10_PATOKAN = '8 Asal Usul Anak/[01] [Kabul] AUA - Anak Sah dari Perkawinan Tercatat, Belum Punya Akta Kelahiran.rtf'
A9_ASAL = [('1 Perceraian CG', '[02] [Kabul] CG - F.rtf', 'CG'), ('1a Perceraian CT', '[02] [Kabul] CT - F.rtf', 'CT')]

# nomor variabel BARU
V_SAKSI3T, V_SAKSI4T, V_IDDAH_BULAN, V_IDDAH_HARI = 9266, 9267, 9268, 9269


def rd(akar, rel):
    return open(os.path.join(akar, PREFIX + rel), 'rb').read()


# ---------------------------------------------------------------------------------------------------------------- SQL variabel
def sql_ket_saksi(nama_var):
    return ('SELECT aps_badilag.isian_rtf_ket_saksi(\'#perkara_id#\', (SELECT CAST(d.id AS CHAR) FROM pihak a JOIN perkara_pihak5 d ON d.pihak_id = a.id '
            'AND d.perkara_id = \'#perkara_id#\' WHERE a.nama = "#%s#" ORDER BY d.urutan LIMIT 1)) AS data' % nama_var)


def sql_iddah(pembagi):
    """Nafkah iddah per bulan (pembagi=1) atau per hari (pembagi=30) dari isian 6054 (teks bebas 'sejumlah Rp1.800.000,00 (...)').
    Angka pertama sesudah 'Rp'; bila isian menyebut 'setiap bulan'/'per bulan'/'tiap bulan'/'dikali' angka itu sudah per bulan, selain itu dibagi 3 bulan.
    Tak terbaca / di luar 12..999.999.999 -> titik-titik. Tanpa fungsi baru; tanpa escape; pembagi per hari = per bulan / 30."""
    z = ("SELECT LOWER(t.data) AS s, REPLACE(REPLACE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(LOWER(t.data), 'rp', 2), 'rp', -1), ' (', 1), ',', 1), '.', ''), ' ', '') AS d "
         "FROM aps_badilag.abt_data_teks t WHERE t.no_var = 6054 AND t.perkara_id = '#perkara_id#' LIMIT 1")
    y = "SELECT z.s AS s, CASE WHEN z.d REGEXP '^[0-9]+$' THEN CAST(z.d AS UNSIGNED) END AS a FROM (%s) z" % z
    bulan = ("ROUND(IF(y.s LIKE '%%setiap bulan%%' OR y.s LIKE '%%tiap bulan%%' OR y.s LIKE '%%per bulan%%' OR y.s LIKE '%%dikali%%', y.a, y.a / 3))")
    b = bulan if pembagi == 1 else 'ROUND(%s / 30)' % bulan
    x = "SELECT %s AS b FROM (%s) y" % (b, y)
    angka = ("IF(x.b >= 1000000, CONCAT(x.b DIV 1000000, '.', LPAD((x.b DIV 1000) MOD 1000, 3, '0'), '.', LPAD(x.b MOD 1000, 3, '0')), "
             "CONCAT(x.b DIV 1000, '.', LPAD(x.b MOD 1000, 3, '0')))")
    return ("SELECT IFNULL((SELECT CONCAT('Rp', %s, ',00 (', aps_badilag.isian_rtf_terbilang(x.b), ' rupiah)') FROM (%s) x WHERE x.b >= 12 AND x.b < 1000000000), '..........') AS data"
            % (angka, x))


def variabel_baru():
    return [
        dict(no=V_SAKSI3T, nama='KETERANGAN SAKSI 3 #0047# TANPA BARIS KOSONG (OTOMATIS: sama dengan tanya jawab keterangan saksi ABT, tanpa enter di ujung)', sql=sql_ket_saksi('6138')),
        dict(no=V_SAKSI4T, nama='KETERANGAN SAKSI 4 #0047# TANPA BARIS KOSONG (OTOMATIS: sama dengan tanya jawab keterangan saksi ABT, tanpa enter di ujung)', sql=sql_ket_saksi('8934')),
        dict(no=V_IDDAH_BULAN, nama='NAFKAH IDDAH PER BULAN (OTOMATIS: isian Nafkah iddah #6054# dibagi 3 bulan, atau angka per bulan bila isian menyebut setiap bulan; titik-titik bila belum berisi angka)', sql=sql_iddah(1)),
        dict(no=V_IDDAH_HARI, nama='NAFKAH IDDAH PER HARI (OTOMATIS: nafkah iddah per bulan #9268# dibagi 30 hari; titik-titik bila isian belum berisi angka)', sql=sql_iddah(30)),
    ]


# ---------------------------------------------------------------------------------------------------------------------- A4
def ubah_a4(b):
    teks, pos = peta(b)
    if teks.count(A4_LAMA) != 1:
        raise SystemExit('A4: kalimat tidak tepat satu')
    i = teks.index(A4_LAMA)
    j = i + len(A4_LAMA)
    o0 = pos[i][0]
    o1 = pos[j - 1][0] + pos[j - 1][1]
    a = b.rfind(b'{', 0, o0)
    z = b.find(b'}', o1) + 1
    wilayah = b[a:z]
    if not kurung_seimbang(wilayah):
        raise SystemExit('A4: wilayah run tidak seimbang')
    t_w, _ = peta(wilayah)
    if t_w != A4_LAMA:
        raise SystemExit('A4: wilayah run bukan persis kalimat: %r' % t_w[:80])
    # tiap run di wilayah: harus berwarna \cf3 (merah); header run pertama dipakai ulang dengan \cf1 (hitam)
    runs = re.findall(rb'\{[^{}]*\}', wilayah)
    if b''.join(runs) != wilayah:
        raise SystemExit('A4: wilayah bukan deretan run polos')
    for r in runs:
        if b'\\cf3 ' not in r:
            raise SystemExit('A4: ada run bukan merah')
    kepala = runs[0][1:runs[0].index(b'\\cf3 ')]
    if b'\\cf' in kepala or b'\\par' in kepala:
        raise SystemExit('A4: kepala run janggal')

    def run(isi):
        return b'{' + kepala + b'\\cf1 ' + isi + b'}'
    baru = run(b'#9268#') + run(b' setiap bulan atau ') + run(b'#9269#') + run(b' setiap harinya')
    h = b[:a] + baru + b[z:]
    harap = teks[:i] + A4_BARU + teks[j:]
    periksa(b, h, harap)
    return h, [(a, wilayah, baru)]


# --------------------------------------------------------------------------------------------------------------------- A10
def ubah_a10(b, patokan):
    m = re.search(rb'\\par  \\pard (\\fi-400 [^{}]*?\\itap0 )\{#9259#\}\{\\par \}\\pard (\\qj [^{}]*?\\itap0 )2\.\\tab', patokan)
    if not m:
        raise SystemExit('A10: pola patokan [01] tidak ditemukan')
    ket, badan = m.group(1), m.group(2)

    def blok(n):
        return b'\\pard ' + ket + b'{#%d#}{\\par }\\pard ' % n + badan

    mulai = b.index(b'Bahwa, demi kepentingan dimulainya')
    akhir = b.index(b'mohon penetapan;') + len(b'mohon penetapan;')
    seg = b[mulai:akhir]
    baru = seg
    pasangan = [
        (b'sebagai berikut:\\line #9259#\\line 2.\\tab ', b'sebagai berikut:\\par  ' + blok(9259) + b'2.\\tab '),
        (b'sebagai berikut:\\line #9260#\\line Bahwa atas keterangan', b'sebagai berikut:\\par  ' + blok(9260) + b'Bahwa atas keterangan'),
        (b'\\line 1.\\tab ', b'\\par 1.\\tab '),
    ]
    for lama, ganti in pasangan:
        if baru.count(lama) != 1:
            raise SystemExit('A10: pola tidak tepat satu: %r (%d)' % (lama[:50], baru.count(lama)))
        baru = baru.replace(lama, ganti)
    baru = baru.replace(b'\\line ', b'\\par ')
    if b'\\line' in baru:
        raise SystemExit('A10: \\line tersisa')
    h = b[:mulai] + baru + b[akhir:]
    periksa(b, h)
    t0, _ = peta(b)
    t1, _ = peta(h)
    norm = lambda s: re.sub(r'\s+', ' ', s).strip()
    if norm(t0) != norm(t1):
        raise SystemExit('A10: teks tampak berubah (selain spasi/paragraf)')
    for k in ('#9259#', '#9260#'):
        if t1.count(k) != t0.count(k):
            raise SystemExit('A10: jumlah penanda berubah')
    return h, [(mulai, seg, baru)]


# ---------------------------------------------------------------------------------------------------------------------- A8
def ubah_a8(b):
    d = b.decode('latin1')
    out, cat, edit, buang = U8.ubah_rinci(d, True)
    if buang or len(edit) != 2 or [c['keadaan'] for c in cat] != ['TABEL-KERAS', 'TABEL-KERAS']:
        raise SystemExit('A8: hasil ubah tak terduga: %r' % [c['keadaan'] for c in cat])
    h = out.encode('latin1')
    periksa(b, h)
    t1, _ = peta(h)
    if t1.count('#5058#') != 1 or t1.count('#5059#') != 1:
        raise SystemExit('A8: #5058#/#5059# tidak tepat satu')
    pot = [(s, d[s:e].encode('latin1'), r.encode('latin1')) for s, e, r in sorted(edit)]
    hh = b
    for off, l0, l1 in sorted(pot, key=lambda x: -x[0]):
        assert hh[off:off + len(l0)] == l0
        hh = hh[:off] + l1 + hh[off + len(l0):]
    if hh != h:
        raise SystemExit('A8: potongan tidak menghasilkan keluaran alat')
    return h, pot, cat


# ---------------------------------------------------------------------------------------------------------------------- A9
PETA_SAKSI = {
    3: [(b'#6106#', b'#6138#'), (b'#6107#', b'#6139#'), (b'#6108#', b'#6140#'), (b'#6109#', b'#6141#'), (b'#6110#', b'#6142#'), (b'#6111#', b'#6143#'),
        (b'#1252#', b'#8922#'), (b'#9265#', b'#9266#')],
    4: [(b'#6138#', b'#8934#'), (b'#6139#', b'#8935#'), (b'#6140#', b'#8936#'), (b'#6141#', b'#8937#'), (b'#6142#', b'#8938#'), (b'#6143#', b'#8939#'),
        (b'#8922#', b'#8940#'), (b'#9266#', b'#9267#')],
}
KATA_BILANGAN = {3: ('3 (tiga)', 'ketiganya', '#6100# (Saksi I), #6106# (Saksi II) dan #6138# (Saksi III)', '#1251#, #1252# dan #8922#', 'saksi pertama, saksi kedua maupun saksi ketiga'),
                 4: ('4 (empat)', 'keempatnya', '#6100# (Saksi I), #6106# (Saksi II), #6138# (Saksi III) dan #8934# (Saksi IV)', '#1251#, #1252#, #8922# dan #8940#', 'saksi pertama, saksi kedua, saksi ketiga maupun saksi keempat')}
T_TEKS = [
    # (regex lama atas teks tampak, fungsi pengganti)
    (re.compile(r'bantahan-bantahannya, #0047# telah mengajukan bukti tertulis T\.1 dan T\.2, bukti elektronik T\.3 dan 2 \(dua\) orang saksi,'),
     lambda n: 'bantahan-bantahannya, #0047# telah mengajukan bukti tertulis T.1 dan T.2, bukti elektronik T.3 dan %s orang saksi,' % KATA_BILANGAN[n][0]),
    (re.compile(r'juga telah mengajukan bukti berupa 2 \(dua\) orang saksi yaitu #6100# \(Saksi I\) dan #6106# \(Saksi II\), keduanya merupakan #1251# dan #1252#,'),
     lambda n: 'juga telah mengajukan bukti berupa %s orang saksi yaitu %s, %s merupakan %s,' % (KATA_BILANGAN[n][0], KATA_BILANGAN[n][2], KATA_BILANGAN[n][1], KATA_BILANGAN[n][3])),
    (re.compile(r'#0047# telah menghadirkan 2 \(dua\) orang saksi di muka'),
     lambda n: '#0047# telah menghadirkan %s orang saksi di muka' % KATA_BILANGAN[n][0]),
    (re.compile(r'baik saksi pertama maupun saksi kedua #0047# tidak ada'),
     lambda n: 'baik %s #0047# tidak ada' % KATA_BILANGAN[n][4]),
]


def klon_saksi(b, n):
    """Sisip pasangan paragraf (identitas saksi + keterangan otomatis) saksi ke-(n) T sesudah pasangan saksi sebelumnya."""
    lama_nama = {3: b'#6106#', 4: b'#6138#'}[n]
    lama_ket = {3: b'#9265#', 4: b'#9266#'}[n]
    nomor_lama = {3: b'2.\\tab ', 4: b'3.\\tab '}[n]
    nomor_baru = {3: b'3.\\tab ', 4: b'4.\\tab '}[n]
    P = [m.start() for m in re.finditer(rb'(?<=\})\\pard \\plain', b)]
    for k in range(len(P) - 2):
        ident = b[P[k]:P[k + 1]]
        ket = b[P[k + 1]:P[k + 2]]
        if lama_nama in ident and lama_ket in ket and b'\\listtext' in ident and nomor_lama in ident:
            if ident.count(lama_nama) != 1 or ket.count(lama_ket) != 1:
                continue
            klon = ident + ket
            for x, y in PETA_SAKSI[n]:
                klon = klon.replace(x, y)
            if klon.count(nomor_lama) != 1:
                raise SystemExit('A9: nomor daftar saksi tidak tepat satu')
            klon = klon.replace(nomor_lama, nomor_baru)
            return b[:P[k + 2]] + klon + b[P[k + 2]:]
    raise SystemExit('A9: pasangan paragraf saksi %d tidak ditemukan' % n)


def buat_varian(b, n):
    """n = 3 atau 4 (jumlah saksi Tergugat)."""
    h = klon_saksi(b, 3)
    if n == 4:
        h = klon_saksi(h, 4)
    teks, pos = peta(h)
    ops = []
    for rx, f in T_TEKS:
        ms = list(rx.finditer(teks))
        if len(ms) != 1:
            raise SystemExit('A9: kalimat tak tepat satu (%d): %s' % (len(ms), rx.pattern[:60]))
        ops.append((ms[0].start(), ms[0].end(), f(n)))
    h2, pot, harap = ubah(h, ops, teks, pos)
    periksa(b, h2, harap)
    return h2


# --------------------------------------------------------------------------------------------------------------------- keluaran
def hexs(s):
    return '0x' + s.encode('latin1').hex()


SIDIK_SQL = "MD5(CONCAT_WS('|', v.nama, v.data_type, REPLACE(IFNULL(v.sql_query, ''), CONCAT(DATABASE(), '.'), 'aps_badilag.'), IFNULL(v.referensi, ''), IFNULL(v.multi_sidang, ''), v.locked, IFNULL(v.modifier, '')))"


def sidik_py(x):
    return md5b('|'.join([x['nama'], 'data_sql', x['sql'], '', '', '0', 'admin']).encode('latin1'))


def tulis_sql(keluar, baru):
    kepala = '-- Paket ABT "%s" (4 Nov 2026): kerangka berisian + variabel baru (keputusan Derry 182/184). Hanya derry_briantono.\n' % N
    nb = [x['no'] for x in baru]
    open(os.path.join(keluar, 'nomor-variabel.txt'), 'w', newline='\n').write('# variabel BARU (kosong di basis server 3 Nov; diperiksa PRASYARAT)\n' + ''.join('%d\n' % n for n in nb))
    nl = ' UNION ALL '.join("SELECT %d AS n, '%s' AS h" % (x['no'], sidik_py(x)) for x in baru)
    pras = kepala + ('-- PRASYARAT "A|B|C": A = nomor %d-%d berisi lain dari paket (0) | B = variabel paket persis (0 pasang pertama / %d pasang ulang) | '
                     'C = yang dipakai ada: fungsi isian_rtf_ket_saksi, isian_rtf_terbilang dan variabel 6054, 6138, 8934, 1197 (6)\n' % (nb[0], nb[-1], len(nb)))
    pras += ("SELECT CONCAT_WS('|',\n (SELECT COUNT(*) FROM abt_variabel v WHERE v.no_var BETWEEN %d AND %d AND NOT EXISTS (SELECT 1 FROM (%s) p WHERE p.n = v.no_var AND p.h = %s)),\n"
             " (SELECT COUNT(*) FROM abt_variabel v JOIN (%s) p ON p.n = v.no_var AND p.h = %s),\n"
             " (SELECT (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name IN ('isian_rtf_ket_saksi', 'isian_rtf_terbilang')) "
             "+ (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (6054, 6138, 8934, 1197)))) AS p;\n" % (nb[0], nb[-1], nl, SIDIK_SQL, nl, SIDIK_SQL))
    open(os.path.join(keluar, '%s-PRASYARAT.sql' % N), 'w', encoding='latin1', newline='\n').write(pras)
    open(os.path.join(keluar, 'harap.txt'), 'w', newline='\n').write('0|0|6\n0|%d|6\n' % len(nb))
    p = [kepala, 'START TRANSACTION;\n']
    for x in baru:
        p.append("INSERT INTO abt_variabel (no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier, modified) "
                 "SELECT %d, CONVERT(%s USING latin1), 'data_sql', NULL, NULL, NULL, NULL, REPLACE(CONVERT(%s USING latin1), 'aps_badilag.', CONCAT(DATABASE(), '.')), NULL, NULL, 0, 'admin', '%s' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM abt_variabel WHERE no_var = %d);\n"
                 % (x['no'], hexs(x['nama']), hexs(x['sql']), TANGGAL, x['no']))
    p.append('COMMIT;\n')
    open(os.path.join(keluar, '%s-PASANG.sql' % N), 'w', encoding='latin1', newline='\n').write(''.join(p))
    bag = ["SELECT 'var %d' AS label, (SELECT COUNT(*) FROM abt_variabel v WHERE v.no_var = %d AND %s = '%s') AS ok" % (x['no'], x['no'], SIDIK_SQL, sidik_py(x)) for x in baru]
    q = kepala + 'SELECT IF((SELECT COUNT(*) FROM (\n' + '\nUNION ALL '.join(bag) + "\n) y WHERE y.ok <> 1) = 0, 'SEMUA COCOK', 'ADA BEDA') AS periksa;\n"
    open(os.path.join(keluar, '%s-PERIKSA.sql' % N), 'w', encoding='latin1', newline='\n').write(q)
    r = [kepala, 'START TRANSACTION;\n']
    r += ["DELETE v FROM abt_variabel v WHERE v.no_var = %d AND %s = '%s';\n" % (x['no'], SIDIK_SQL, sidik_py(x)) for x in baru]
    r.append('COMMIT;\n')
    open(os.path.join(keluar, '%s-PULIH.sql' % N), 'w', encoding='latin1', newline='\n').write(''.join(r))
    with open(os.path.join(keluar, 'uji-kueri.tsv'), 'w', encoding='utf-8', newline='\n') as o:
        for x in baru:
            o.write('%d\t%s\n' % (x['no'], base64.b64encode(x['sql'].encode('latin1')).decode('ascii')))


def main():
    akar, keluar, hasil_dir = sys.argv[1:4]
    if os.path.isdir(keluar):
        for f in os.listdir(keluar):
            p = os.path.join(keluar, f)
            if os.path.isdir(p):
                shutil.rmtree(p)
            elif f not in ('tambal_rtf.py', 'berkas_rtf.py', 'pasang-satker.sh', 'pulih-satker.sh'):
                os.remove(p)
    os.makedirs(keluar, exist_ok=True)
    os.makedirs(hasil_dir, exist_ok=True)
    daftar, tambal, ringkas, csvb = [], [], [], []
    no = 0
    # ---- tambalan atas berkas yang ada (A4, A8, A10)
    kerja = [(rel, 'A4') for rel in A4_BERKAS] + [(rel, 'A8') for rel in A8_BERKAS] + [(A10_BERKAS, 'A10')]
    for rel in sorted(kerja):
        r, jenis = rel
        b = rd(akar, r)
        if jenis == 'A4':
            h, pot = ubah_a4(b)
            ket = 'nafkah iddah per bulan/hari dari isian #6054# (#9268#/#9269#)'
        elif jenis == 'A8':
            h, pot, _ = ubah_a8(b)
            ket = 'tabel tanya-jawab saksi 1 dan 2 teks tetap -> #5058# / #5059#'
        else:
            h, pot = ubah_a10(b, rd(akar, A10_PATOKAN))
            ket = 'identitas saksi, keterangan #9259#/#9260# dan kalimat berikutnya dipecah per paragraf'
        no += 1
        kode = 'K%04d' % no
        daftar.append((kode, PREFIX + r, md5b(b), md5b(h), len(pot)))
        for off, l0, l1 in pot:
            tambal.append((kode, off, l0, l1))
        csvb.append((r, jenis, ket, len(pot), len(b), len(h)))
    # ---- blangko BARU (A9)
    baru_rtf = []
    os.makedirs(os.path.join(keluar, 'rtf'), exist_ok=True)
    for folder, asal, pk in A9_ASAL:
        b = rd(akar, folder + '/' + asal)
        for n in (3, 4):
            nama = asal.replace('.rtf', ' - (%d Saksi T).rtf' % n)
            h = buat_varian(b, n)
            dst = os.path.join(keluar, 'rtf', PREFIX + folder)
            os.makedirs(dst, exist_ok=True)
            open(os.path.join(dst, nama), 'wb').write(h)
            baru_rtf.append((PREFIX + folder, nama, md5b(h), asal))
            csvb.append((folder + '/' + nama, 'A9', 'blangko BARU dari %s: saksi T ke-%d..%d (#9266#%s)' % (asal, 3, n, '/#9267#' if n == 4 else ''), 0, len(b), len(h)))
    from abtlib import tulis_paket
    tulis_paket(keluar, daftar, tambal, 'sesudah keputusan-a-mekanis-4nov')
    with open(os.path.join(keluar, 'daftar-rtf.tsv'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('# folder\tberkas\tmd5\tasal (berkas BARU, tidak pernah menimpa)\n')
        for x in baru_rtf:
            f.write('%s\t%s\t%s\t%s\n' % x)
    open(os.path.join(keluar, 'folder-ada.txt'), 'w', encoding='utf-8', newline='\n').write('# folder blangko yang HARUS sudah ada\n' + ''.join(f + '\n' for f in sorted(set(x[0] for x in baru_rtf))))
    open(os.path.join(keluar, 'daftar-timpa.tsv'), 'w', encoding='utf-8', newline='\n').write('# folder\tberkas\tmd5_lama\tmd5_baru\tket (kosong: paket ini tidak menimpa berkas)\n')
    open(os.path.join(keluar, 'folder-baru.txt'), 'w', encoding='utf-8', newline='\n').write('')
    baru = variabel_baru()
    for x in baru:
        assert not re.search(r'aleta', x['nama'] + x['sql'], re.I)
        assert x['sql'].count("'") % 2 == 0
        assert len(x['nama']) <= 200 and len(x['sql']) < 65000, x['no']
    tulis_sql(keluar, baru)
    for f in ('pasang-satker.sh', 'pulih-satker.sh'):
        shutil.copyfile(os.path.join(SINI, f), os.path.join(keluar, f))
    shutil.copyfile(os.path.join(SINI, '..', '..', 'keputusan-a-mekanis-4nov', 'paket-satker', 'tambal_rtf.py'), os.path.join(keluar, 'tambal_rtf.py'))
    shutil.copyfile(os.path.join(SINI, '..', '..', 'in-lupa-prosesi-3nov', 'paket-satker', 'berkas_rtf.py'), os.path.join(keluar, 'berkas_rtf.py'))
    semua = []
    for d_, _, fs in os.walk(keluar):
        for f in fs:
            if f != 'MD5SUMS.txt':
                p_ = os.path.join(d_, f)
                semua.append((os.path.relpath(p_, keluar).replace(os.sep, '/'), md5b(open(p_, 'rb').read())))
    with open(os.path.join(keluar, 'MD5SUMS.txt'), 'w', newline='\n') as o:
        for rel, m in sorted(semua):
            o.write('%s  %s\n' % (m, rel))
    with open(os.path.join(hasil_dir, 'ubahan.csv'), 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        w.writerow(['berkas', 'keputusan', 'ubahan', 'potongan', 'ukuran_lama', 'ukuran_baru'])
        w.writerows(csvb)
    print('TAMBAL %d berkas, %d potongan; BARU %d berkas; variabel %d' % (len(daftar), len(tambal), len(baru_rtf), len(baru)))


if __name__ == '__main__':
    main()
