# -*- coding: utf-8 -*-
"""Definisi isi paket x3-tuntutan-sinkron-21okt (21 Okt 2026): tuntutan akibat perceraian yang diminta petitum.

UBAH: 24 variabel paket u2 (pertimbangan/amar/pemicu akibat perceraian 4110-4119, 4130-4134, 4138-4146, 4150) memuat SALINAN
yang sama dari pembaca petitum. Tiga pola di dalamnya keliru menyala atas NAMA PIHAK (diukur atas 2.269 putusan CG/CT 2023-2026
di server, MariaDB 5.5 sendiri):
  nafkah iddah  'iddah|idah'                 menyala pada Rosidah, Azidah, Holidah, Nurzaidah, Nurfaidah, Zulkaidah, Saidah (7 perkara)
  mut'ah        'mut[^a-z]{0,4}ah'           menyala pada Mutahir, Mutaher (2 perkara)
  madliyah      'madli|madhi|...|terhutang'  menyala pada Pramadhika (1 perkara); 'terhutang' juga mahar terhutang
Akibatnya putusan mencetak "[PERIKSA: petitum menuntut nafkah iddah ...]" dan panel menampilkan isian nafkah iddah/mut'ah padahal
petitum tidak memintanya. Pola baru: kata harus berdiri sendiri, nafkah iddah harus didahului kata nafkah/biaya/uang/masa/selama/
membayar/tunggu (paling jauh 40 huruf, tanpa titik koma). Pola hak asuh, nafkah anak dan harta bersama tidak diubah (0 salah nyala).

BARU: 3400 (data_sql, TIDAK dipakai blangko mana pun): keadaan tiap tuntutan + kutipan petitumnya untuk layar Blangko Derry.
Bendera dihitung dengan pola yang SAMA PERSIS dengan 4140-4145 sesudah paket ini (satu sumber), kutipannya dari teks petitum yang
tagnya dibuang. Satu baris per tuntutan: "<pemicu>|ya|<kutipan>", "<pemicu>|tidak|", atau "<pemicu>|ragu|petitum di SIPP kosong".

Semua teks ASCII, tanpa kata nama aplikasi. Hanya SELECT. MariaDB 5.5 (regex Henry Spencer) dan 10.x (PCRE) sama hasilnya
untuk pola ini (diperiksa: alat/uji_pola_server.py)."""

MODIFIER = 'admin'
MODIFIED = '2026-10-21 00:00:00'

# (lama, baru) - masing-masing harus muncul TEPAT SEKALI di tiap variabel yang diubah
RX = [
    ("IF(w.pet REGEXP 'iddah|idah', 1, 0) AS ti",
     "IF(w.pet REGEXP '(nafkah|biaya|uang|masa|selama|membayar|tunggu)[^;]{0,40}[^a-z](iddah|idah|eddah)([^a-z]|$)', 1, 0) AS ti"),
    ("IF(w.pet REGEXP 'mut[^a-z]{0,4}ah', 1, 0) AS tm",
     "IF(w.pet REGEXP '(^|[^a-z])muth?[^a-z]{0,6}ah([^a-z]|$)', 1, 0) AS tm"),
    ("IF(w.pet REGEXP 'madli|madhi|mahdhi|lampau|yang lalu|terhutang', 1, 0) AS td",
     "IF(w.pet REGEXP '(^|[^a-z])(madl?iy*ah|madhiy*ah|mahdhiy*ah)|nafkah[^;]{0,30}(lampau|yang lalu|terhutang|terutang|tertunggak|yang belum dibayar|yang tidak dibayar)', 1, 0) AS td"),
]
# pola yang tidak diubah (disalin apa adanya ke 3400 supaya benderanya sama dengan 4140/4141/4145)
RX_TETAP = {
    'th': "IF(w.pet REGEXP 'hadhanah|hadlanah|hadanah|hak asuh|hak pengasuhan|kuasa asuh|hak pemeliharaan|pemeliharaan anak|pengasuhan anak|asuhan anak|di bawah (asuhan|pemeliharaan)|berada (di bawah|dalam) (asuhan|pemeliharaan|hadhanah)' OR w.kh > 0, 1, 0) AS th",
    'tn': "IF(w.pet REGEXP 'nafkah[^;]{0,60}anak|anak[^;]{0,60}nafkah|biaya (hidup|pemeliharaan|pendidikan|kebutuhan)[^;]{0,60}anak|biaya anak', 1, 0) AS tn",
    'tb': "IF(w.pet REGEXP 'harta bersama|harta gono|gono.?gini' OR w.kbh > 0, 1, 0) AS tb",
}

NO_UBAH = list(range(4110, 4120)) + list(range(4130, 4135)) + [4138, 4139, 4140, 4141, 4142, 4143, 4144, 4145, 4146, 4150]


def ubah_sql(b):
    s = b.decode('latin1')
    for lama, baru in RX:
        assert s.count(lama) == 1, ('pola lama tidak tepat sekali', lama[:40], s.count(lama))
        s = s.replace(lama, baru)
    for v in RX_TETAP.values():
        assert s.count(v) == 1, ('pola tetap tidak tepat sekali', v[:40])
    return s.encode('latin1')


UBAH = {no: dict(kolom='sql_query', fungsi=ubah_sql, butir='pola pembaca petitum (nama pihak tidak lagi menyalakan tuntutan)') for no in NO_UBAH}

# ---- 3400: keadaan + kutipan tuntutan untuk layar ----------------------------------------------------------------------------
PET = ("LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(CONCAT(IFNULL(p.petitum,''), ' ', IFNULL((SELECT GROUP_CONCAT(r.isi_petitum SEPARATOR ' ') "
       "FROM perkara_rekonvensi r WHERE r.perkara_id = p.perkara_id),'')),'<strong>',''),'</strong>',''),'<em>',''),'</em>',''),'&nbsp;',' '),CHAR(10),' '),CHAR(13),' '))")
# teks kutipan: semua tag yang lazim di editor SIPP dibuang, tanda pemisah baris layar diganti spasi
TAG = ['<strong>', '</strong>', '<em>', '</em>', '<p>', '</p>', '<li>', '</li>', '<ol>', '</ol>', '<ul>', '</ul>', '<br>', '<br />', '<br/>', '<u>', '</u>', '<b>', '</b>', '<i>', '</i>']
POLOS = "CONCAT(IFNULL(p.petitum,''), ' ', IFNULL((SELECT GROUP_CONCAT(r.isi_petitum SEPARATOR ' ') FROM perkara_rekonvensi r WHERE r.perkara_id = p.perkara_id),''))"
for t in TAG:
    POLOS = "REPLACE(%s,'%s',' ')" % (POLOS, t)
for a, b in (("'&nbsp;'", "' '"), ("CHAR(10)", "' '"), ("CHAR(13)", "' '"), ("CHAR(9)", "' '"), ("'|'", "' '")):
    POLOS = "REPLACE(%s,%s,%s)" % (POLOS, a, b)

KATA = {
    '4140': ['hak asuh', 'hadhanah', 'hadlanah', 'hadanah', 'hak pemeliharaan', 'pemeliharaan anak', 'pengasuhan', 'kuasa asuh', 'asuhan'],
    '4141': ['nafkah anak', 'nafkah untuk anak', 'nafkah kepada anak', 'biaya hidup', 'biaya pemeliharaan', 'biaya pendidikan', 'biaya kebutuhan', 'biaya anak', 'nafkah'],
    '4142': ['nafkah iddah', 'nafkah idah', 'nafkah selama masa', 'masa iddah', 'masa idah', 'iddah', 'idah'],
    '4143': ["mut&#39;ah", "mut''ah", 'mutah', 'muth', 'mut'],
    '4144': ['madliyah', 'madhiyah', 'mahdhiyah', 'madiyah', 'nafkah lampau', 'lampau', 'terhutang', 'terutang', 'tertunggak', 'yang lalu'],
    '4145': ['harta bersama', 'gono', 'harta'],
}
BENDERA = {'4140': 'th', '4141': 'tn', '4142': 'ti', '4143': 'tm', '4144': 'td', '4145': 'tb'}
KUM = {'4140': ('kh', 'kumulasi hak asuh anak tercatat di SIPP'), '4145': ('kbh', 'kumulasi harta bersama tercatat di SIPP')}


def _letak(kode):
    bag = ["IF(LOCATE('%s', c.kecil) = 0, 999999, LOCATE('%s', c.kecil))" % (k, k) for k in KATA[kode]]
    return 'LEAST(%s)' % ', '.join(bag) if len(bag) > 1 else bag[0]


def _baris(kode):
    f = BENDERA[kode]
    letak = _letak(kode)
    kut = "IF(%s = 999999, 'kata kunci tidak dapat dikutip', CONCAT(IF(%s > 70, '...', ''), TRIM(SUBSTRING(c.polos, GREATEST(1, %s - 70), 190)), '...'))" % (letak, letak, letak)
    if kode in KUM:
        kol, teks = KUM[kode]
        kut = "IF(c.%s > 0 AND c.%s_teks = 0, '%s', %s)" % (kol, f, teks, kut)
    return "CONCAT('%s|', IF(c.kosong = 1, 'ragu|petitum di SIPP kosong', IF(c.%s = 1, CONCAT('ya|', %s), 'tidak|')))" % (kode, f, kut)


def _flags():
    lst = [RX_TETAP['th'], RX_TETAP['tn'], RX[0][1], RX[1][1], RX[2][1], RX_TETAP['tb']]
    # bendera teks saja (tanpa kumulasi) untuk memilih kutipan "kumulasi ... tercatat di SIPP"
    lst.append("IF(w.pet REGEXP 'hadhanah|hadlanah|hadanah|hak asuh|hak pengasuhan|kuasa asuh|hak pemeliharaan|pemeliharaan anak|pengasuhan anak|asuhan anak|di bawah (asuhan|pemeliharaan)|berada (di bawah|dalam) (asuhan|pemeliharaan|hadhanah)', 1, 0) AS th_teks")
    lst.append("IF(w.pet REGEXP 'harta bersama|harta gono|gono.?gini', 1, 0) AS tb_teks")
    return ', '.join(lst)


# kecil dihitung dari ungkapan teks sendiri (bukan LOWER(w.polos)): MariaDB 5.5 menggabung tabel turunan dan LOWER atas kolom
# turunan ikut mengecilkan kolom aslinya (terukur 21 Okt: kutipan tercetak huruf kecil semua).
SQL_3400 = ("SELECT CONCAT_WS(CHAR(10), %s) AS data FROM (SELECT w.*, %s, IF(CHAR_LENGTH(TRIM(w.pet)) < 30, 1, 0) AS kosong "
            "FROM (SELECT %s AS pet, %s AS polos, LOWER(%s) AS kecil, "
            "(SELECT COUNT(*) FROM perkara_kumulasi k WHERE k.perkara_id = p.perkara_id AND k.jenis_perkara_id = 349) AS kh, "
            "(SELECT COUNT(*) FROM perkara_kumulasi k WHERE k.perkara_id = p.perkara_id AND k.jenis_perkara_id = 348) AS kbh "
            "FROM perkara p WHERE p.perkara_id = '#perkara_id#') w) c") % (
    ', '.join(_baris(k) for k in ['4140', '4141', '4142', '4143', '4144', '4145']), _flags(), PET, POLOS, POLOS)

BARU = [
    dict(no=3400, nama='TUNTUTAN AKIBAT PERCERAIAN: KEADAAN DAN KUTIPAN PETITUM (OTOMATIS dari petitum/rekonvensi/kumulasi SIPP, satu baris per tuntutan 4140-4145; '
                       'tidak dicetak di blangko)',
         tipe='data_sql', tabel=None, kolom=None, urutan=None, sql=SQL_3400, default=None,
         butir='keadaan diminta/tidak/ragu dan kutipan petitum untuk layar (pola sama dengan 4140-4145)'),
]
