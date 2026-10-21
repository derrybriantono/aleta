# -*- coding: utf-8 -*-
"""Definisi isi paket x8-sisa-tuntutan-21okt (21 Okt 2026): sisa dari paket x4.

BARU 3450 (data_sql, TIDAK dicetak blangko mana pun): keadaan dan kutipan petitum untuk pemicu tuntutan di luar akibat perceraian
     (paket x4: 3401-3408 hak bekas istri, 3430-3435 anak, 3440 utang bersama, 3441-3448 kelalaian kewajiban; pemicu kebendaan lama
     4788-4791, 4845-4847). Satu baris per pemicu "<pemicu>|ya|<kutipan>", "<pemicu>|tidak|" atau "<pemicu>|ragu|petitum di SIPP kosong",
     sama dengan bentuk #3400# (paket x3). Bendera = NILAI PEMICU ITU SENDIRI (#3401# dst. diganti ABT/bot dengan nilainya sebelum kueri
     jalan) - satu sumber, tidak ada pola kedua yang bisa berbeda.
BARU 3451, 3452: pertimbangan dan amar harta bersama pada blangko CT [02] Rekonvensi (isi tetap mut'ah, iddah, madliyah, hak asuh,
     nafkah anak tidak disentuh; harta bersama dalam gugatan rekonvensi sebelumnya tidak tercetak). Disusun dari penyusun paket u2
     (pert_harta, amar_harta) + pola x3 + penjaga daftar bawaan x4, sebutan pihak "Penggugat Rekonvensi"/"Tergugat Rekonvensi" seperti
     isi blangko, dasar Pasal 66 ayat (5) UU 7/1989 yang sudah dikutip blangko itu.
Semua teks ASCII, tanpa kata nama aplikasi, hanya SELECT."""
import importlib.util
import os
import sys

AKAR = os.path.dirname(os.path.abspath(__file__))
PAKET = os.path.join(AKAR, '..', '..')
sys.path.insert(0, os.path.join(PAKET, 'u2-putusan-cerai-lengkap', 'sumber'))
import susun_variabel as U2  # noqa: E402


def _muat(nama, jalur):
    s = importlib.util.spec_from_file_location(nama, jalur)
    m = importlib.util.module_from_spec(s)
    s.loader.exec_module(m)
    return m


X3 = _muat('x3_def', os.path.join(PAKET, 'x3-tuntutan-sinkron-21okt', 'sumber', 'variabel_def.py'))
X4 = _muat('x4_def', os.path.join(PAKET, 'x4-tuntutan-perluasan-21okt', 'sumber', 'definisi_x4.py'))

MODIFIER = 'admin'
MODIFIED = '2026-10-21 00:00:00'
BARU = []


def baru(no, nama, sql, butir, kelompok):
    BARU.append(dict(no=no, nama=nama, tipe='data_sql', tabel=None, kolom=None, urutan=None, sql=sql, default=None, butir=butir, kelompok=kelompok))


# ---- 3450 kutipan -------------------------------------------------------------------------------------------------------
# kata kunci untuk MENEMUKAN letak kutipan (bukan untuk menyalakan - nyala = nilai pemicu); urut dari yang paling khas
KATA = {
    '3401': ['nafkah iddah', 'nafkah idah', 'nafkah selama', 'iddah', 'idah'],
    '3402': ['maskan', 'tempat tinggal', 'tempat kediaman'],
    '3403': ['kiswah', 'pakaian'],
    '3404': ["mut&#39;ah", "mut''ah", 'mutah', 'muth', 'mut'],
    '3405': ['madliyah', 'madhiyah', 'madiyah', 'nafkah lampau', 'lampau', 'terhutang', 'tertunggak'],
    '3406': ['mahar', 'mas kawin', 'maskawin'],
    '3407': ['biaya hadhanah', 'biaya hadlanah', 'nafkah anak', 'biaya hidup', 'biaya pemeliharaan', 'biaya pendidikan', 'biaya'],
    '3408': ['sita jaminan', 'sita marital', 'sita', 'beslag', 'conservatoir'],
    '4788': ['sita jaminan', 'sita marital', 'sita', 'beslag', 'conservatoir'],
    '4789': ['1/3', '2/3', '1/4', '3/4', '%', 'bagian'],
    '4790': ['uang paksa', 'dwangsom'],
    '4791': ['serta merta', 'serta-merta', 'uitvoerbaar', 'voorraad'],
    '3440': ['utang', 'hutang'],
    '4845': ['denda', 'ganti rugi', 'widh', 'kerugian', 'margin'],
    '4846': ['agunan', 'hak tanggungan', 'fidusia', 'gadai', 'lelang', 'jaminan'],
    '4847': ['pembatalan', 'batal', 'fasakh'],
    '3430': ['menyerahkan', 'penyerahan', 'mengembalikan', 'diserahkan'],
    '3431': ['kenaikan', 'persen', '%'],
    '3432': ['biaya pendidikan', 'biaya kesehatan', 'pendidikan', 'kesehatan'],
    '3433': ['pemotongan', 'memotong', 'dipotong', 'potong'],
    '3434': ['lampau', 'madliyah', 'madhiyah', 'terhutang', 'tertunggak'],
    '3435': ['sita jaminan', 'sita', 'beslag'],
    '3441': ['nafkah'],
    '3442': ['madliyah', 'madhiyah', 'lampau', 'terhutang'],
    '3443': ['kiswah', 'pakaian', 'sandang'],
    '3444': ['tempat kediaman', 'tempat tinggal', 'rumah'],
    '3445': ['biaya rumah tangga', 'perawatan', 'pengobatan', 'kesehatan'],
    '3446': ['pemotongan', 'memotong', 'dipotong'],
    '3447': ['sita jaminan', 'sita', 'beslag'],
    '3448': ['uang paksa', 'dwangsom'],
}
PEMICU = list(KATA)
for _p in PEMICU:
    for _k in KATA[_p]:
        assert "'" not in _k.replace("''", ''), _k


def _letak(p):
    bag = ["IF(LOCATE('%s', c.kecil) = 0, 999999, LOCATE('%s', c.kecil))" % (k, k) for k in KATA[p]]
    return ('LEAST(%s)' % ', '.join(bag) if len(bag) > 1 else bag[0]) + ' AS l%s' % p


def _baris(p):
    lk = 'd.l%s' % p
    kut = ("IF(%s = 999999, 'tercatat di SIPP (kata kunci tidak dapat dikutip)', CONCAT(IF(%s > 70, '...', ''), TRIM(SUBSTRING(d.polos, GREATEST(1, %s - 70), 190)), '...'))"
           % (lk, lk, lk))
    return "CONCAT('%s|', IF(d.kosong = 1, 'ragu|petitum di SIPP kosong', IF('#%s#' = 'ya', CONCAT('ya|', %s), 'tidak|')))" % (p, p, kut)


# MariaDB 5.5: LOWER atas kolom tabel turunan ikut mengecilkan kolom aslinya (catatan x3) - "kecil" dihitung dari ungkapan sendiri.
SQL_3450 = ("SELECT CONCAT_WS(CHAR(10), %s) AS data FROM (SELECT c.*, %s FROM (SELECT %s AS polos, LOWER(%s) AS kecil, "
            "IF(CHAR_LENGTH(TRIM(%s)) < 30, 1, 0) AS kosong FROM perkara p WHERE p.perkara_id = '#perkara_id#') c) d") % (
    ', '.join(_baris(p) for p in PEMICU), ', '.join(_letak(p) for p in PEMICU), X3.POLOS, X3.POLOS, X3.PET)
baru(3450, 'TUNTUTAN LAIN (HAK BEKAS ISTRI, KEBENDAAN, ANAK, KELALAIAN): KEADAAN DAN KUTIPAN PETITUM (OTOMATIS dari nilai pemicu dan petitum SIPP; tidak dicetak di blangko)',
     SQL_3450, 'keadaan dan kutipan petitum untuk layar (bendera = nilai pemicu itu sendiri)', 2)

# ---- 3451 / 3452 harta bersama dalam gugatan rekonvensi CT ---------------------------------------------------------------
S_LAMA = 'IF(w.jn = 346, "#0046#", "#0047#") AS S, IF(w.jn = 346, "#0047#", "#0046#") AS I'
S_REK = '"Tergugat Rekonvensi" AS S, "Penggugat Rekonvensi" AS I'


def rekonvensi(sql):
    sql = X4.ganti(sql, S_LAMA, S_REK)
    return sql


def pert_harta_rek():
    p = U2.pert_harta()
    p = X4.ganti(p, '"Menimbang, bahwa dalam perkara ini dituntut pula penetapan harta bersama "',
                 '"Menimbang, bahwa dalam gugatan rekonvensinya dituntut pula penetapan harta bersama "', n=0)
    p = X4.ganti(p, 'Tuntutan mengenai harta bersama suami istri dapat diajukan bersama-sama dengan perkara perceraian sebagaimana ketentuan Pasal 86 ayat (1)',
                 'Tuntutan mengenai harta bersama suami istri dapat diajukan bersama-sama dengan permohonan cerai talak sebagaimana ketentuan Pasal 66 ayat (5)', n=0)
    p = X4.ganti(p, 'mempertimbangkannya bersama-sama dengan pokok perkara perceraian', 'mempertimbangkannya bersama-sama dengan permohonan cerai talak dalam konvensi', n=0)
    return p


baru(3451, 'PERTIMBANGAN HARTA BERSAMA DALAM REKONVENSI CERAI TALAK (OTOMATIS dari petitum/rekonvensi dan keputusan isian 4105; kosong bila tidak dituntut dan tidak dipilih)',
     rekonvensi(X4.sel(pert_harta_rek())), 'pertimbangan harta bersama gugatan rekonvensi CT [02]', 1)


def amar_awal_br(ekspr):
    """Amar yang disisipkan di UJUNG butir amar terakhir (bukan sebelum butir): tiap paragraf diawali <br> (butir baru dalam daftar bernomor
    otomatis), tanpa <br> penutup; kosong = tidak ada apa pun."""
    return ("SELECT IF(IFNULL(t.d, '') = '', '', CONCAT('<br>', IF(RIGHT(t.d, 4) = '<br>', LEFT(t.d, CHAR_LENGTH(t.d) - 4), t.d))) AS data "
            "FROM (SELECT %s AS d FROM %s) t" % (ekspr, U2.tabel_turunan()))


baru(3452, 'AMAR HARTA BERSAMA DALAM REKONVENSI CERAI TALAK (OTOMATIS dari keputusan isian 4105; disambung di ujung butir amar rekonvensi terakhir, kosong bila tidak ada)',
     rekonvensi(X4.jaga_daftar(X4.pola_x3(amar_awal_br(U2.amar_harta())))), 'amar harta bersama gugatan rekonvensi CT [02]', 1)


def susun_ubah(server):
    return {}
