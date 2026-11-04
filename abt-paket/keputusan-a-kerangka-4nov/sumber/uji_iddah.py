# -*- coding: utf-8 -*-
"""Uji kueri #9268# / #9269# (nafkah iddah per bulan / per hari) atas isian #6054# bermacam bentuk di basis laptop.
pakai: python -B uji_iddah.py <basis ABT uji> <basis SIPP> [keluaran.tsv]
Isian uji disisipkan ke abt_data_teks (no_var 6054, perkara_id 987654321 - rekaan) lalu DIHAPUS lagi."""
import os
import subprocess
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SINI)
import bangun_kerangka as K  # noqa: E402

MYSQL = K.MYSQL
PID = 987654321
KASUS = [
    ('sejumlah Rp1.800.000,00 (satu juta delapan ratus ribu rupiah)', 'Rp600.000,00 (enam ratus ribu rupiah)', 'Rp20.000,00 (dua puluh ribu rupiah)'),
    ('sejumlah Rp6.000.000,00 (enam juta rupiah)', 'Rp2.000.000,00 (dua juta rupiah)', 'Rp66.667,00 (enam puluh enam ribu enam ratus enam puluh tujuh rupiah)'),
    ('Rp5.000.000,00 (lima juta rupiah) setiap bulan dikali 3 bulan dengan jumlah Rp15.000.000,00 (lima belas juta rupiah) selama masa iddah', 'Rp5.000.000,00 (lima juta rupiah)', 'Rp166.667,00 (seratus enam puluh enam ribu enam ratus enam puluh tujuh rupiah)'),
    ('sejumlah Rp. 3.000.000,00 (tiga jiuta rupiah)', 'Rp1.000.000,00 (satu juta rupiah)', 'Rp33.333,00 (tiga puluh tiga ribu tiga ratus tiga puluh tiga rupiah)'),
    ('sejumlah Rp300.000,00 (tiga ratus ribu rupiah)', 'Rp100.000,00 (seratus ribu rupiah)', 'Rp3.333,00 (tiga ribu tiga ratus tiga puluh tiga rupiah)'),
    ('sejumlah Rp_,00 (_ rupiah)', '..........', '..........'),
    ('', '..........', '..........'),
    ('sejumlah Rp1500000 (satu juta lima ratus ribu rupiah)', 'Rp500.000,00 (lima ratus ribu rupiah)', 'Rp16.667,00 (enam belas ribu enam ratus enam puluh tujuh rupiah)'),
    ('Nafkah iddah selama 3 bulan sebesar Rp 900.000,00', 'Rp300.000,00 (tiga ratus ribu rupiah)', 'Rp10.000,00 (sepuluh ribu rupiah)'),
    ('tidak ada angka', '..........', '..........'),
]


def my(db, q):
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '-N', '-r', '--default-character-set=latin1', db, '-e', q], capture_output=True)
    if r.returncode:
        raise SystemExit(r.stderr.decode('latin1'))
    return r.stdout.decode('latin1').rstrip('\r\n')


def main():
    abt, sipp = sys.argv[1], sys.argv[2]
    keluar = sys.argv[3] if len(sys.argv) > 3 else None
    baru = {x['no']: x for x in K.variabel_baru()}
    q_bulan = baru[K.V_IDDAH_BULAN]['sql'].replace('#perkara_id#', str(PID)).replace('aps_badilag.', abt + '.')
    q_hari = baru[K.V_IDDAH_HARI]['sql'].replace('#perkara_id#', str(PID)).replace('aps_badilag.', abt + '.')
    gagal = 0
    baris = []
    try:
        for teks, bulan, hari in KASUS:
            my(abt, "DELETE FROM abt_data_teks WHERE no_var = 6054 AND perkara_id = %d" % PID)
            my(abt, "INSERT INTO abt_data_teks (no_var, perkara_id, data, modifier) VALUES (6054, %d, CONVERT(UNHEX('%s') USING latin1), 'uji')" % (PID, teks.encode('latin1').hex()))
            b = my(sipp, q_bulan)
            h = my(sipp, q_hari)
            ok = (b == bulan and h == hari)
            gagal += 0 if ok else 1
            baris.append('%s\t%s\t%s\t%s' % ('COCOK' if ok else 'BEDA', teks, b, h))
            print('COCOK' if ok else 'BEDA ', '|', teks, '->', b, '|', h)
            if not ok:
                print('        harap:', bulan, '|', hari)
        # perkara tanpa isian sama sekali
        my(abt, "DELETE FROM abt_data_teks WHERE no_var = 6054 AND perkara_id = %d" % PID)
        b, h = my(sipp, q_bulan), my(sipp, q_hari)
        ok = (b == '..........' and h == '..........')
        gagal += 0 if ok else 1
        baris.append('%s\t(tanpa isian)\t%s\t%s' % ('COCOK' if ok else 'BEDA', b, h))
        print('COCOK' if ok else 'BEDA ', '| (tanpa isian) ->', b, '|', h)
    finally:
        my(abt, "DELETE FROM abt_data_teks WHERE no_var = 6054 AND perkara_id = %d" % PID)
    print('GAGAL=%d dari %d' % (gagal, len(KASUS) + 1))
    if keluar:
        open(keluar, 'w', encoding='utf-8', newline='\n').write('\n'.join(baris) + '\nGAGAL=%d dari %d\n' % (gagal, len(KASUS) + 1))
    sys.exit(1 if gagal else 0)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
