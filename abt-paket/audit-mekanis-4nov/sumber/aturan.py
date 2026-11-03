# -*- coding: utf-8 -*-
"""Aturan tambalan mekanis audit A3 (C1, 4 Nov 2026). (kode, jenis, pola regex atas teks tampak, pengganti)
Pengganti: huruf pertama mengikuti huruf besar/kecil teks lama (kecuali aturan bertanda 'tetap')."""
import re


def B(w):
    """kata dengan huruf pertama bebas besar/kecil"""
    return '[%s%s]%s' % (w[0].upper(), w[0].lower(), re.escape(w[1:]))


ATURAN = [
    # K01 - "#8554# Hakim" -> "#8554#" (8554 = "Majelis Hakim"/"Hakim")
    ('K01', 'hakim-ganda-8554', r'#8554# Hakim\b', '#8554#', 'tetap'),
    # K09 - "Penetapan Hakim #4004#" -> "Penetapan #4004#" (4004 = "Ketua Majelis"/"Hakim")
    ('K09', 'penetapan-hakim-4004', r'Penetapan Hakim #4004#', 'Penetapan #4004#', 'tetap'),
    # K13 - ejaan Itsbat
    ('K13', 'isbat', r'\b' + B('isbat') + r'\b', 'itsbat', ''),
    # K06 - salah ketik jelas
    ('K06', 'berkaitaan', r'\b' + B('berkaitaan') + r'\b', 'berkaitan', ''),
    ('K06', 'berdasarkan-ganda', r'\b' + B('berdasarkan') + r' berdasarkan\b', 'berdasarkan', ''),
    # "Repblik" (4 kali) hanya ada di "Republik Indonesia Repblik Indonesia" -> ikut aturan RI-ganda (bila ditambal sendiri,
    # tersisa "Republik Indonesia Republik Indonesia").
    ('K06', 'RI-ganda', r'\bRepublik Indonesia Repu?blik Indonesia\b', 'Republik Indonesia', 'tetap'),
    ('K06', 'Repblik', r'\bRepblik\b(?! Indonesia)', 'Republik', ''),
    ('K06', 'perempaun', r'\b' + B('perempaun') + r'\b', 'perempuan', ''),
    ('K06', 'satusa', r'\b' + B('satusa') + r'\b', 'status', ''),
    ('K06', 'perara', r'\b' + B('perara') + r'\b', 'perkara', ''),
    ('K06', 'bahwa-ganda', r'\b' + B('bahwa') + r' bahwa\b', 'bahwa', ''),
    ('K06', 'Nomor-ganda', r'\bNomor Nomor\b', 'Nomor', ''),
    ('K06', 'calon-istri-ganda', r'\bcalon istri istri\b', 'calon suami istri', ''),  # = 8 varian DK sesaudara (A3: 'calon istri')
    ('K06', 'sebagai-istri-istri', r'\bsebagai istri istri\b', 'sebagai suami istri', ''),
    ('K06', 'bependapat', r'\b' + B('bependapat') + r'\b', 'berpendapat', ''),
    ('K06', 'berdasakan', r'\b' + B('berdasakan') + r'\b', 'berdasarkan', ''),
    ('K06', 'bersesuain', r'\b' + B('bersesuain') + r'\b', 'bersesuaian', ''),
    # 'citakan -> cetakan' (A3) TIDAK dipakai: kedua tempat berbunyi "cita-citakan" (benar).
    ('K06', 'daapt', r'\b' + B('daapt') + r'\b', 'dapat', ''),
    ('K06', 'dipertimbangakan', r'\b' + B('dipertimbangakan') + r'\b', 'dipertimbangkan', ''),
    ('K06', 'istrri', r'\b' + B('istrri') + r'\b', 'istri', ''),
    ('K06', 'kandunganya', r'\b' + B('kandunganya') + r'\b', 'kandungannya', ''),
    ('K06', 'khuasa', r'\b' + B('khuasa') + r'\b', 'kuasa', ''),
    ('K06', 'melangar', r'\b' + B('melangar') + r'\b', 'melanggar', ''),
    ('K06', 'pendapaat', r'\b' + B('pendapaat') + r'\b', 'pendapat', ''),
    ('K06', 'pokoknta', r'\b' + B('pokoknta') + r'\b', 'pokoknya', ''),
    ('K06', 'Rasullulah', r'\b' + B('rasullulah') + r'\b', 'Rasulullah', ''),
    ('K06', 'rechtsground', r'\b' + B('rechtsground') + r'\b', 'rechtsgrond', ''),
    ('K06', 'sunguh', r'\b' + B('sunguh') + r'\b', 'sungguh', ''),
    ('K06', 'yaiitu', r'\b' + B('yaiitu') + r'\b', 'yaitu', ''),
    ('K06', 'sebaga', r'\b' + B('sebaga') + r'\b', 'sebagai', ''),
    ('K06', 'segara', r'\b' + B('segara') + r'\b', 'segera', ''),
    ('K06', 'penunjukkan', r'\b' + B('penunjukkan') + r'\b', 'penunjukan', ''),
    ('K06', 'hak-nya', r'\b' + B('hak') + r' nya\b', 'haknya', ''),
    ('K06', 'dalan-konvensi', r'\bdalan konvensi\b', 'dalam konvensi', ''),
    ('K06', 'testimonuim', r'\b' + B('testimonuim') + r'\b', 'testimonium', ''),
    ('K06', 'dipertahankankan', r'\b' + B('dipertahankankan') + r'\b', 'dipertahankan', ''),
    ('K06', 'diberikan-ganda', r'\byang diberikan yang diberikan\b', 'yang diberikan', ''),
    ('K06', 'setidak-setidaknya', r'\b' + B('setidak') + r'-setidaknya\b', 'setidak-tidaknya', ''),
    # K07 - ejaan baku (kata depan "di" dipisah; Undang-Undang)
    ('K07', 'diatas', r'\b' + B('diatas') + r'\b', 'di atas', ''),
    ('K07', 'dipersidangan', r'\b' + B('dipersidangan') + r'\b', 'di persidangan', ''),
    ('K07', 'dibawah', r'\b' + B('dibawah') + r'\b', 'di bawah', ''),
    ('K07', 'Undang-Undang', r'\bUndang Undang\b', 'Undang-Undang', 'tetap'),
]

DIKOMPILASI = [(k, j, re.compile(p), g, t) for k, j, p, g, t in ATURAN]


def pengganti(lama, baru, tanda):
    if tanda == 'tetap':
        return baru
    if lama[:1].isupper():
        return baru[:1].upper() + baru[1:]
    return baru
