# -*- coding: utf-8 -*-
"""Variabel ABT baru untuk BLANGKO keluarga lain-lain (mafqud 4924-4925, permohonan umum 4935-4939); agen W2b-C.

Isian permohonan umum diisi petugas/hakim (kalimat lanjutan), karena isinya berbeda tiap jenis permohonan dan menyangkut
penilaian hakim (dasar kewenangan, kepentingan hukum, fakta terbukti, amar pokok, alasan penolakan). Pengisi otomatis hanya
memberi saran bertingkat ragu.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from variabel_def import v  # noqa: E402

# ---- MAFQUD: kalimat tambahan bersyarat (kosong bila isiannya belum ada, sehingga blangko lama tidak berubah) -------------
v(4924, 'MAFQUD: PERTIMBANGAN KELUARGA DAN HARTA YANG DITINGGALKAN (OTOMATIS dari #4921# dan #4922#; kosong bila keduanya belum diisi; diawali baris baru)', 'data_sql',
  '''SELECT IF(TRIM("#4921#") IN ("", "...", "-") AND TRIM("#4922#") IN ("", "...", "-"), "",
  CONCAT("<br>Menimbang, bahwa berdasarkan keterangan para saksi, ",
    IF(TRIM("#4921#") NOT IN ("", "...", "-"), CONCAT("keluarga yang ditinggalkan oleh #9860# adalah #4921#"), ""),
    IF(TRIM("#4921#") NOT IN ("", "...", "-") AND TRIM("#4922#") NOT IN ("", "...", "-"), " dan ", ""),
    IF(TRIM("#4922#") NOT IN ("", "...", "-"), CONCAT("harta yang ditinggalkan adalah #4922#"), ""),
    ", sehingga penetapan ini diperlukan untuk memberikan kepastian hukum bagi hak-hak keluarga yang ditinggalkan;")) AS data''')
v(4925, 'MAFQUD: KETERANGAN TAMBAHAN ORANG YANG HILANG (OTOMATIS dari #4920# dan #4923#; kosong bila keduanya belum diisi; disambung ke fakta kepergian)', 'data_sql',
  '''SELECT IF(TRIM("#4920#") IN ("", "...", "-") AND TRIM("#4923#") IN ("", "...", "-"), "",
  CONCAT(", dengan keterangan bahwa ",
    IF(TRIM("#4920#") NOT IN ("", "...", "-"), CONCAT("#9860# #4920#"), ""),
    IF(TRIM("#4920#") NOT IN ("", "...", "-") AND TRIM("#4923#") NOT IN ("", "...", "-"), " dan kepergiannya ", ""),
    IF(TRIM("#4923#") NOT IN ("", "...", "-"), CONCAT(IF(TRIM("#4920#") IN ("", "...", "-"), "kepergian #9860# ", ""), "#4923#"), ""))) AS data''')

# ---- PERMOHONAN UMUM: isian blangko penetapan ----------------------------------------------------------------------------
v(4935, 'PERMOHONAN UMUM: DASAR KEWENANGAN PENGADILAN AGAMA - ISIAN (lanjutan kalimat "dan ...", mis. "menurut Penjelasan Pasal 49 ... perkara ini termasuk kewenangan Pengadilan Agama")', 'data_teks')
v(4936, 'PERMOHONAN UMUM: KEDUDUKAN DAN KEPENTINGAN HUKUM #0046# - ISIAN (lanjutan kalimat "Menimbang, bahwa ...", mis. "#0046# adalah ahli waris yang berkepentingan atas penetapan ini")', 'data_teks')
v(4937, 'PERMOHONAN UMUM: FAKTA YANG TERBUKTI - ISIAN (lanjutan kalimat "Bahwa ...", dari bukti surat, keterangan #0046# dan saksi; boleh beberapa fakta dipisah "; bahwa")', 'data_teks')
v(4938, 'PERMOHONAN UMUM: AMAR POKOK - ISIAN (kalimat amar nomor 2 tanpa nomor, mis. "Menetapkan bahwa ... telah meninggal dunia pada tanggal ... di ...")', 'data_teks')
v(4939, 'PERMOHONAN UMUM: ALASAN PENOLAKAN ATAU TIDAK DAPAT DITERIMA - ISIAN (lanjutan kalimat "..., #0046# tidak berhasil membuktikan ...", mis. "dalil ... tidak didukung bukti surat maupun keterangan saksi")', 'data_teks')
