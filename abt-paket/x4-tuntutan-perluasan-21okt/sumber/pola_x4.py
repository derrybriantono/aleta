# -*- coding: utf-8 -*-
"""SATU SUMBER pola pembaca petitum paket x4 (21 Okt 2026). Dipakai pembangun variabel (bangun_paket.py) dan alat ukur
(alat/ukur_pola.py). Semua pola = ERE POSIX yang sama artinya di MariaDB 5.5 (Henry Spencer), MariaDB 10.x (PCRE) dan Python re:
tanpa \\b, tanpa lookaround, huruf kecil (petitum di-LOWER sebelum dicocokkan).

Prinsip: kata kunci harus BERDIRI SENDIRI (diapit bukan-huruf) atau berupa frasa tuntutan, supaya nama pihak (Rosita, Azidah,
Mutahir, Pramadhika, Ramahar, ...) dan kata umum (alamat "bertempat tinggal di") tidak menyalakan tuntutan."""

B0 = '(^|[^a-z])'  # awal kata
B1 = '([^a-z]|$)'  # akhir kata

# ---------------------------------------------------------------------------------------------------------------------
# Hak-hak bekas istri (jenis 351, variabel 3760-3779): pola lama -> baru (tiap potongan tepat sekali per variabel)
# ---------------------------------------------------------------------------------------------------------------------
HBI_LAMA = {
    'pi': 'iddah|idah',
    'pk': 'maskan|tempat tinggal|tempat kediaman|tempat berteduh',
    'ps': 'kiswah|pakaian|sandang',
    'pt': 'mut[^a-z]{0,6}ah',
    'pm': 'madli|madhi|mahdhi|lampau|yang lalu|tidak diberikan nafkah|tidak memberi nafkah',
    'ph': 'mahar|mas kawin|maskawin',
    'pa': 'nafkah[^;]{0,60}anak|anak[^;]{0,60}nafkah|biaya[^;]{0,40}hadh?anah|hadh?anah[^;]{0,40}biaya|biaya[^;]{0,40}anak',
}
# nafkah iddah HARUS didahului nafkah/biaya hidup/uang (maskan dan kiswah "selama masa iddah" bukan nafkah iddah)
HBI_BARU = {
    'pi': '(nafkah|biaya hidup|uang)[^;]{0,40}[^a-z](iddah|idah|eddah)' + B1,
    'pk': B0 + 'maskan' + B1 + '|(biaya|uang|nafkah|hak atas) tempat (tinggal|kediaman|berteduh)|tempat (tinggal|kediaman|berteduh)[^;]{0,30}(selama|masa)[^;]{0,15}(iddah|idah)',
    # "biaya pakaian" anak bukan kiswah bekas istri (terukur 21 Okt: 2 petitum nafkah anak)
    'ps': B0 + 'kiswah' + B1 + '|(pakaian|sandang)[^;]{0,30}(selama|masa)[^;]{0,15}(iddah|idah)',
    'pt': B0 + 'muth?[^a-z]{0,6}ah' + B1,
    'pm': B0 + '(madl?iy*ah|madhiy*ah|mahdhiy*ah)|nafkah[^;]{0,30}(lampau|yang lalu|terhutang|terutang|tertunggak|yang belum dibayar|yang tidak dibayar|yang tidak diberikan)',
    'ph': '(melunasi|membayar|pelunasan|terhutang|terutang|hutang|utang|belum (dibayar|dilunasi|lunas))[^;]{0,40}' + B0 + '(mahar|mas kawin|maskawin)' + B1
          + '|' + B0 + '(mahar|mas kawin|maskawin)' + B1 + '[^;]{0,40}(terhutang|terutang|hutang|utang|belum (dibayar|dilunasi|lunas)|dilunasi)',
    # 'hadhanah ... biaya' (lama) menyala atas 'hak hadhanah ... biaya perkara'; 'biaya ... anak' dipertahankan (biaya hak asuh anak, biaya kehidupan untuk anak)
    'pa': 'nafkah[^;]{0,60}anak|anak[^;]{0,60}nafkah|biaya[^;]{0,40}hadh?anah|biaya[^;]{0,40}anak',
}

# ---------------------------------------------------------------------------------------------------------------------
# Kebendaan (harta bersama, waris, wasiat, hibah, wakaf, ekonomi syariah; 4788-4847): hanya pola yang salah nyala diubah
# ---------------------------------------------------------------------------------------------------------------------
KEB_LAMA = {
    'tsita': 'sita|beslag',
    'tutang': 'hutang|utang',
    'tjam': 'jaminan|agunan|hak tanggungan|fidusia|gadai|lelang|rahn',
    'tbat': 'batal|fasakh',
}
KEB_BARU = {
    'tsita': B0 + '(sita|disita|disitanya|penyitaan|beslag|conservatoir|revindicatoir)' + B1,
    'tutang': B0 + '(hutang|utang|piutang|berhutang|berutang)' + B1,
    # "sita jaminan" bukan tuntutan penyelesaian jaminan/agunan akad
    'tjam': B0 + '(agunan|hak tanggungan|fidusia|gadai|lelang|rahn|marhun)' + B1 + '|(objek|barang|benda|harta|aset) jaminan|jaminan (berupa|atas|utang|hutang|kredit|pembiayaan|fidusia)',
    'tbat': B0 + '(batal|membatalkan|dibatalkan|pembatalan|fasakh|memfasakh|difasakh)' + B1,
}

# ---------------------------------------------------------------------------------------------------------------------
# Tuntutan tambahan perkara anak (6a-6c, gelombang 3): pemicu BARU (variabel 3430-3435)
# ---------------------------------------------------------------------------------------------------------------------
ANAK = {
    # "menyerahkan kepada penggugat nafkah ... anak" bukan penyerahan anak (terukur 21 Okt: 2 petitum): kata anak harus langsung
    # sesudah kata kerja (boleh: kembali, kepada <pihak>, bilangan orang)
    'penyerahan': '(menyerahkan|penyerahan|mengembalikan)( kembali)?( kepada (penggugat|pemohon|tergugat|termohon|ibu|ayah)( (konvensi|rekonvensi|kandungnya|kandung))?)? (([a-z0-9()]+ )?orang |kedua |ketiga |seorang )?anak' + B1 + '|' + B0 + 'anak' + B1 + '[^;]{0,40}(diserahkan|dikembalikan) kepada',
    'kenaikan': '(kenaikan|bertambah|penambahan|naik)[^;]{0,40}([0-9]+ ?%|persen|setiap tahun|per tahun|tiap tahun)|([0-9]+ ?%|persen)[^;]{0,40}(setiap|per|tiap) tahun',
    'pendidikan': 'biaya (pendidikan|kesehatan|sekolah)|pendidikan dan kesehatan|kesehatan dan pendidikan',
    'pemotongan': '(memotong|pemotongan|dipotong|potong)[^;]{0,40}(gaji|penghasilan|upah|tunjangan)|(gaji|penghasilan|upah)[^;]{0,40}(dipotong|pemotongan|memotong)',
    'lampau': '(nafkah|biaya)[^;]{0,40}(lampau|madl?iy*ah|madhiy*ah|terhutang|terutang|tertunggak|yang lalu)[^;]{0,60}' + B0 + 'anak'
              + '|' + B0 + 'anak' + B1 + '[^;]{0,60}(nafkah|biaya)[^;]{0,30}(lampau|madl?iy*ah|madhiy*ah|terhutang|terutang|tertunggak|yang lalu)',
    'sita': KEB_BARU['tsita'],
}

# ---------------------------------------------------------------------------------------------------------------------
# Kelalaian kewajiban suami/istri (jenis 345, gelombang 3 W3a, 3700-3733): pemicu BARU 3441-3449 (kewajiban lain 3706 tidak dapat
# dibaca mesin dari petitum - selalu tampil)
# ---------------------------------------------------------------------------------------------------------------------
KELALAIAN = {
    'nafkah': B0 + 'nafkah' + B1,
    'lampau': HBI_BARU['pm'],
    'kiswah': B0 + '(kiswah|pakaian|sandang)' + B1,
    'kediaman': '(menyediakan|memberikan|menyiapkan|memberi)[^;]{0,30}(tempat (kediaman|tinggal)|rumah)' + B1 + '|tempat kediaman',
    'biaya': 'biaya (rumah tangga|perawatan|pengobatan|kesehatan|berobat)|' + B0 + '(perawatan|pengobatan)' + B1,
    'pemotongan': ANAK['pemotongan'],
    'sita': KEB_BARU['tsita'],
    'paksa': 'uang paksa|dwangsom',
}

# ---------------------------------------------------------------------------------------------------------------------
# Ukuran: pola lama/baru, jenis perkara yang dinilai, pola amar (A) pembanding
# ---------------------------------------------------------------------------------------------------------------------
CERAI = {346, 347}
KEBENDAAN = {348, 364, 365, 366, 367, 370}
ANAK_JN = {349, 350, 353, 354}  # hak asuh, (nafkah anak), penguasaan anak, perwalian
AMAR = {
    'pi': r"(?:^|[^a-z])(?:nafkah[^;]{0,40})(?:iddah|idah|'iddah)(?:[^a-z]|$)",
    'pk': r'maskan|tempat tinggal selama|biaya tempat tinggal',
    'ps': r'kiswah|pakaian',
    'pt': r"(?:^|[^a-z])muth?\W{0,6}ah(?:[^a-z]|$)",
    'pm': r'madl?iy?ah|madhiy?ah|nafkah (?:lampau|yang lalu|terhutang|terutang)',
    'ph': r'(?:^|[^a-z])(?:mahar|mas kawin|maskawin)(?:[^a-z]|$)',
    'pa': r'nafkah[^;]{0,60}anak|biaya (?:hidup|pemeliharaan|pendidikan|kebutuhan)[^;]{0,60}anak|biaya hadh?anah',
    'tsita': r'(?:^|[^a-z])(?:sita|beslag|penyitaan)(?:[^a-z]|$)',
    'tutang': r'(?:^|[^a-z])(?:hutang|utang)(?:[^a-z]|$)',
    'tjam': r'agunan|hak tanggungan|fidusia|lelang|objek jaminan|barang jaminan',
    'tbat': r'(?:^|[^a-z])(?:batal|membatalkan|pembatalan|fasakh)',
    'penyerahan': r'menyerahkan[^;]{0,60}anak',
    'kenaikan': r'kenaikan|(?:[0-9]+ ?%|persen)[^;]{0,40}(?:setiap|per|tiap) tahun',
    'pendidikan': r'pendidikan dan kesehatan|biaya pendidikan|kesehatan',
    'pemotongan': r'memotong|pemotongan|dipotong',
    'lampau': r'(?:lampau|madl?iy?ah|madhiyah|terhutang)[^;]{0,60}anak|anak[^;]{0,60}(?:lampau|madl?iy?ah)',
    'sita': r'(?:^|[^a-z])(?:sita|beslag|penyitaan)(?:[^a-z]|$)',
}
UKUR = {}
for k in HBI_BARU:
    UKUR['hbi_' + k] = dict(label='hak bekas istri ' + k, jenis=CERAI | {351}, lama=HBI_LAMA[k], baru=HBI_BARU[k], amar=AMAR[k])
for k in KEB_BARU:
    UKUR['keb_' + k] = dict(label='kebendaan ' + k, jenis=KEBENDAAN | CERAI, lama=KEB_LAMA[k], baru=KEB_BARU[k], amar=AMAR[k])
for k in KELALAIAN:
    UKUR['kel_' + k] = dict(label='kelalaian kewajiban ' + k, jenis=CERAI | {345}, lama=None, baru=KELALAIAN[k], amar=None)
for k in ANAK:
    UKUR['anak_' + k] = dict(label='anak ' + k, jenis=ANAK_JN | CERAI, lama=None, baru=ANAK[k], amar=AMAR[k])
