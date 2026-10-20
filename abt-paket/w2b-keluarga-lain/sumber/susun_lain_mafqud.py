# -*- coding: utf-8 -*-
"""Tambal blangko 9c Penetapan Mafqud [01] Kabul (agen W2b-C): keluarga dan harta yang ditinggalkan (4924) dan keterangan tambahan orang yang hilang (4925).

Keduanya kalimat BERSYARAT: kosong bila isiannya (4920-4923) belum diisi, sehingga penetapan lama tidak berubah untuk perkara yang tidak mengisinya.
Tidak ada kalimat yang dihapus.
"""
import os

FOLDER = '9c Penetapan Mafqud'
BERKAS = '[01] [Kabul] Mafqud - Orang Hilang Ditetapkan Meninggal Secara Hukum.rtf'


def jalan(S):
    from bangun import Dok
    d = Dok(os.path.join(S.ASLI, FOLDER, BERKAS))
    i_hidden = 0
    i_mafqud = S.satu(d, 'Menimbang, bahwa orang yang hilang (mafqud)')
    i_f2 = S.satu(d, '2.\tBahwa #9860# #9862#')
    out = []
    for i in range(len(d.par)):
        if i == i_hidden:
            out.append(d.ganti_teks(i, d.isi(i) + ' #4920# #4921# #4922# #4923#'))
        elif i == i_mafqud:
            out.append(d.ganti_teks(i, d.isi(i) + '#4924#'))
        elif i == i_f2:
            out.append(d.ganti_teks(i, '2.\tBahwa #9860# #9862##4925#;'))
        else:
            out.append(d.par[i])
    S.simpan_timpa(FOLDER, BERKAS, d, out, 'Mafqud Kabul: pertimbangan keluarga dan harta yang ditinggalkan (4924) dan keterangan tambahan orang yang hilang (4925), bersyarat')
