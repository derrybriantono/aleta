# -*- coding: utf-8 -*-
"""Uji kueri variabel data_sql jenis 345 atas SIPP server (BACA SAJA, butuh VPN: ssh aleta). Agen W3a-C.

Perkara jenis 345 di server NOL, jadi kueri diukur atas perkara cerai gugat nyata (jenis kelamin Penggugat nyata: 10260 = perempuan, 79 = laki-laki).
Isian petugas (abt_data_teks) tidak dapat ditulis ke server; cabang berisi diuji dengan mengganti SUB-KUERI PEMBACA ISIAN (M.T(no)) menjadi literal,
kueri selebihnya persis yang dipasang. Pakai: python w3aC_uji_sql.py   (keluar kode 1 bila ada yang gagal)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'alat'))
import variabel_def as VD  # noqa: E402
import jenis_kelalaian_kewajiban as M  # noqa: E402
import uji_sql  # noqa: E402

ISI = {3694: 'kewajiban memberi nafkah lahir dan menyediakan tempat kediaman', 3697: 'sejak bulan Maret 2024', 3699: 'Penggugat nusyuz karena pergi dari rumah tanpa izin',
       3700: 'Rp1.500.000,00 (satu juta lima ratus ribu rupiah)', 3701: 'sejak bulan Maret 2024 sampai dengan bulan Juli 2026 (29 bulan)',
       3702: 'Rp43.500.000,00 (empat puluh tiga juta lima ratus ribu rupiah)', 3703: 'pakaian layak', 3704: 'rumah yang layak di Kota Palu', 3705: 'kebutuhan pokok dan biaya berobat',
       3706: 'kembali tinggal serumah dengan Penggugat', 3707: 'Tergugat berpenghasilan Rp5.000.000,00 per bulan', 3708: 'PT Contoh Jaya', 3709: 'sebidang tanah di Desa Contoh',
       3710: 'Rp100.000,00 (seratus ribu rupiah)'}
VARS = {x['no']: x for x in VD.VAR}
gagal = []


def jalan(no, perkara, isian=True, penanda=None):
    sql = VARS[no]['sql']
    for n in range(3690, 3740):
        t = M.T(n)
        if t in sql:
            sql = sql.replace(t, "'" + (ISI.get(n, '') if isian else '').replace("'", '') + "'")
    pen = {'0046': 'Penggugat', '0047': 'Tergugat', '8554': 'Majelis Hakim'}
    pen.update(penanda or {})
    out = uji_sql.jalankan(sql, perkara, pen).splitlines()
    return '\n'.join(out[1:]) if out and out[0] == 'data' else '\n'.join(out)


def harap(nama, nilai, mengandung=None, sama=None):
    ok = (sama is None or nilai == sama) and all(m in nilai for m in (mengandung or []))
    print(('OK   ' if ok else 'GAGAL'), nama, '' if ok else '| %r' % nilai[:300])
    if not ok:
        gagal.append(nama)


# kedudukan menurut jenis kelamin Penggugat di SIPP
harap('3690 perempuan -> istri', jalan(3690, '10260'), sama='istri')
harap('3690 laki-laki -> suami', jalan(3690, '79'), sama='suami')
harap('3692 kebalikan istri -> suami', jalan(3692, '10260', penanda={'3690': 'istri'}), sama='suami')
harap('3692 kebalikan suami -> istri', jalan(3692, '79', penanda={'3690': 'suami'}), sama='istri')
harap('3692 tak terbaca -> titik-titik', jalan(3692, '10260', penanda={'3690': ''}), sama='........')
harap('3693 bawaan istri', jalan(3693, '10260', isian=False, penanda={'3690': 'istri'}), sama='kewajibannya selaku suami')
harap('3693 bawaan suami', jalan(3693, '79', isian=False, penanda={'3690': 'suami'}), sama='kewajibannya selaku istri')
harap('3693 isian', jalan(3693, '10260', penanda={'3690': 'istri'}), mengandung=['kewajiban memberi nafkah lahir'])
harap('3695 Tergugat suami', jalan(3695, '10260', penanda={'3692': 'suami'}), mengandung=['Pasal 34 ayat (1)', 'Pasal 80 ayat (2)', 'tamkin sempurna', 'Pasal 34 ayat (3)'])
harap('3695 Tergugat istri', jalan(3695, '79', penanda={'3692': 'istri'}), mengandung=['Pasal 34 ayat (2)', 'Pasal 83 ayat (1)', 'Pasal 84 ayat (1)', 'Pasal 34 ayat (3)'])
harap('3695 tak terbaca', jalan(3695, '79', penanda={'3692': '........'}), mengandung=['Pasal 34 ayat (1) dan ayat (2)'])
harap('3698 dengan sejak', jalan(3698, '10260', penanda={'3692': 'suami', '3690': 'istri', '3693': 'X'}), mengandung=['terbukti tidak melaksanakan X terhadap Penggugat selaku istri sejak bulan Maret 2024'])
harap('3698 tanpa sejak', jalan(3698, '10260', isian=False, penanda={'3692': 'suami', '3690': 'istri', '3693': 'X'}), mengandung=['selaku istri, tanpa alasan yang sah'])
for no in (3720, 3722, 3724, 3726, 3727, 3728, 3732):
    harap('%d terisi' % no, jalan(no, '10260'), mengandung=['<br>Menimbang, bahwa'])
    harap('%d kosong' % no, jalan(no, '10260', isian=False), sama='')
harap('3721 terisi', jalan(3721, '10260'), mengandung=['membayar nafkah kepada Penggugat sebesar Rp1.500.000,00'])
harap('3721 peringatan bila semua kosong', jalan(3721, '10260', isian=False), mengandung=['kewajiban belum diisi'])
harap('3723 terisi', jalan(3723, '10260'), mengandung=['nafkah lampau (nafkah madliyah)', 'Rp43.500.000,00'])
harap('3725 terisi', jalan(3725, '10260'), mengandung=['kiswah', 'tempat kediaman', 'pemotongan langsung', 'sita jaminan'])
harap('3729 terisi', jalan(3729, '10260'), mengandung=['uang paksa (dwangsom) sebesar Rp100.000,00'])
harap('3733 terisi', jalan(3733, '10260'), mengandung=['memerintahkan agar sita jaminan'])
print('GAGAL: %d' % len(gagal) if gagal else 'SEMUA OK')
sys.exit(1 if gagal else 0)
