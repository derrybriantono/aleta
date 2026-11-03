# -*- coding: utf-8 -*-
"""Bangun SQL paket saksi-rapi-3nov secara mekanis dari definisi terpasang (paket titik-koma-30okt).
isian_rtf_ket_saksi: SATU baris ditambah (sesudah isian_rtf_saring_penutup): SET t = isian_rtf_tahu_lengkap(t, tq);
pakai: python bangun_sql.py <abt-paket> <paket-satker> <md5 ket_saksi baru (normal)>
"""
import os
import sys

akar, keluar = sys.argv[1], sys.argv[2]
md5_baru = sys.argv[3] if len(sys.argv) > 3 else 'BELUM'
N = 'abt-saksi-rapi-3nov'
SUMBER = os.path.join(akar, 'titik-koma-30okt', 'paket-satker', 'abt-titik-koma-30okt-FUNGSI.sql')
s = open(SUMBER, encoding='latin1').read()
a = s.index('DROP FUNCTION IF EXISTS `isian_rtf_ket_saksi`;')
b = s.index('DELIMITER ;\n', s.index('END;;', a)) + len('DELIMITER ;\n')
lama = s[a:b]
SISIP_SETELAH = '        SET t = isian_rtf_saring_penutup(t, tq);\n'
assert lama.count(SISIP_SETELAH) == 1
baru = lama.replace(SISIP_SETELAH, SISIP_SETELAH + '        SET t = isian_rtf_tahu_lengkap(t, tq);\n')
baru = baru.replace("T30 butir rapi'", "T30 butir rapi, S3N tidak tahu dilengkapi'")
fb = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fungsi-baru.sql'), encoding='latin1').read()
kepala = '-- Paket ABT "%s" (3 Nov 2026): 2 fungsi baru (isian_rtf_objek_tanya, isian_rtf_tahu_lengkap) + isian_rtf_ket_saksi diganti (nama dan tanda tangan sama,\n-- satu baris ditambah). Dijalankan pasang-satker.sh SESUDAH PRASYARAT.\n' % N
open(os.path.join(keluar, N + '-FUNGSI.sql'), 'w', encoding='latin1', newline='\n').write(kepala + fb + baru)
open(os.path.join(keluar, N + '-FUNGSI-LAMA.sql'), 'w', encoding='latin1', newline='\n').write(
    '-- PULIH "%s": isian_rtf_ket_saksi kembali ke versi titik-koma-30okt, 2 fungsi paket dihapus.\n' % N + lama +
    'DROP FUNCTION IF EXISTS `isian_rtf_tahu_lengkap`;\nDROP FUNCTION IF EXISTS `isian_rtf_objek_tanya`;\n')
NORMAL = ("MD5(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), 'aps_badilag.abt_'), "
          "CHAR(92), ''), ' ', ''), CHAR(9), ''), CHAR(13), ''), CHAR(10), ''))")


def ada(nama, md5=None):
    return ("(SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='%s'%s)"
            % (nama, (' AND %s = \'%s\'' % (NORMAL, md5)) if md5 else ''))


pras = ('-- PRASYARAT %s (BACA SAJA). Satu baris A|B|C:\n'
        '--  A = isian_rtf_ket_saksi = versi titik-koma-30okt (md5 9ba910f2eb7ada8bd1807b08735af6db) (1 sebelum, 0 sesudah)\n'
        '--  B = isian_rtf_tahu_lengkap dan isian_rtf_objek_tanya ada (0 sebelum, 2 sesudah)\n'
        '--  C = isian_rtf_ket_saksi = versi paket ini (md5 %s) (0 sebelum, 1 sesudah)\n'
        '-- Pasang bila 1|0|0; pasang ulang bila 0|2|1; selain itu berhenti tanpa mengubah apa pun.\n'
        "SELECT CONCAT_WS('|', %s, %s + %s, %s) AS prasyarat;\n") % (
    N, md5_baru, ada('isian_rtf_ket_saksi', '9ba910f2eb7ada8bd1807b08735af6db'), ada('isian_rtf_tahu_lengkap'), ada('isian_rtf_objek_tanya'),
    ada('isian_rtf_ket_saksi', md5_baru))
open(os.path.join(keluar, N + '-PRASYARAT.sql'), 'w', encoding='latin1', newline='\n').write(pras)
open(os.path.join(keluar, 'harap.txt'), 'w', newline='\n').write('1|0|0\n0|2|1\n')
# PERIKSA: kasus tetap (pertanyaan, jawaban) -> hasil yang diharapkan; semua cocok = "SEMUA COCOK"
KASUS = [
    ('Apakah Tergugat masih memberikan nafkah kepada Penggugat?', 'Saya tidak tahu;', 'Saya tidak tahu apakah Tergugat masih memberikan nafkah kepada Penggugat'),
    ('Apakah saksi tahu proses akad jual beli?', 'Saya tidak tahu', 'Saya tidak tahu proses akad jual beli'),
    ('Pernahkah ada upaya untuk merukunkan Penggugat dan Tergugat?', 'Tidak tahu;', 'saya tidak tahu apakah pernah ada upaya untuk merukunkan Penggugat dan Tergugat'),
    ('Berapa penghasilan Pemohon yang saudara ketahui?', 'saya tidak tahu;', 'saya tidak tahu berapa penghasilan Pemohon'),
    ('Apakah Saudara pernah melihat Tergugat memukul Penggugat?', 'Saya tidak pernah melihatnya;', 'Saya tidak pernah melihat Tergugat memukul Penggugat'),
    ('Apakah Saudara mengetahui kalau Tergugat berselingkuh?', 'Saya tidak mengetahuinya;', 'Saya tidak mengetahui apakah Tergugat berselingkuh'),
    ('Apa yang menjadi penyebab sehingga ada kesepakatan itu?', 'saya tidak tahu;', 'saya tidak tahu apa yang menjadi penyebab sehingga ada kesepakatan itu'),
    ('Apakah saksi melihat dan mendengar Penggugat dan Tergugat bertengkar?', 'Saya tidak pernah melihatnya;', 'Saya tidak pernah melihat Penggugat dan Tergugat bertengkar'),
    ('Apakah pekerjaan Pemohon dan berapa penghasilan Pemohon setiap bulan?', 'Saya tidak tahu;', 'Saya tidak tahu;'),
    ('Apakah saudara pernah melihat Tergugat memarahi Penggugat?', 'Saya tidak tahu;', 'Saya tidak tahu;'),
    ('Apakah Tergugat masih memberikan nafkah kepada Penggugat?', 'Masalah nafkah, saya tidak tahu;', 'Masalah nafkah, saya tidak tahu;'),
    ('Apakah Saudara pernah melihat Tergugat bermain judi?', 'Saya tidak pernah melihatnya, saya hanya mengetahuinya dari cerita Penggugat;',
     'Saya tidak pernah melihat Tergugat bermain judi, saya hanya mengetahuinya dari cerita Penggugat'),
    ('Dimana Pemohon dan Termohon tinggal bersama setelah menikah?', 'saya tidak tahu karena saya baru kenal dengan Pemohon tahun lalu;',
     'saya tidak tahu di mana Pemohon dan Termohon tinggal bersama setelah menikah karena saya baru kenal dengan Pemohon tahun lalu'),
    ('Apakah selama pisah, Tergugat masih memberi nafkah kepada Penggugat?', 'Saya tidak tahu, Tergugat masih memberi nafkah atau tidak;',
     'Saya tidak tahu, Tergugat masih memberi nafkah atau tidak;'),
    ('Apakah saksi kenal dengan Penggugat?', 'Saya kenal dengan Penggugat karena saya tetangganya;', 'Saya kenal dengan Penggugat karena saya tetangganya;'),
]


def lit(x):
    return "'" + x.replace("'", "''") + "'"


baris = ['-- PERIKSA %s (BACA SAJA): fungsi terpasang dan %d kasus tetap tidak tahu -> lengkap; keluaran satu baris.' % (N, len(KASUS)),
         "SELECT IF(%s = 1 AND %s + %s = 2 AND (" % (ada('isian_rtf_ket_saksi', md5_baru), ada('isian_rtf_tahu_lengkap'), ada('isian_rtf_objek_tanya'))]
baris.append(' + '.join('(BINARY isian_rtf_tahu_lengkap(%s, %s) = BINARY %s)' % (lit(j), lit(q), lit(h)) for q, j, h in KASUS))
baris.append(") = %d, 'SEMUA COCOK', 'BEDA') AS periksa;" % len(KASUS))
open(os.path.join(keluar, N + '-PERIKSA.sql'), 'w', encoding='latin1', newline='\n').write('\n'.join(baris) + '\n')
print('SQL selesai; md5 baru', md5_baru)
