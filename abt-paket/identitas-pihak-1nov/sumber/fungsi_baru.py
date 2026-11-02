# -*- coding: utf-8 -*-
"""Definisi fungsi isian_rtf_pihak_identitas BARU (paket identitas-pihak-1nov) dibentuk dari definisi LAMA persis (paket alamat-putusan-28okt),
dengan tiga perubahan kecil yang dicek jumlah kemunculannya:
  1. (DIBATALKAN, keputusan 112 / 2 Nov: "umur tidak perlu dalam putusan") TANPA umur dalam kurung sesudah tanggal lahir: "..., 16 Maret 1975, agama ...".
     Fungsi ini global: umur hilang di putusan, penetapan, dan BAS yang memakai #7047#/#7048#.
  2. urutan agama, PENDIDIKAN, PEKERJAAN (dulu pekerjaan lalu pendidikan) - sama dengan bunyi contoh pengguna.
  3b. v_akhir (kalimat kuasa + sebutan) VARCHAR(400) -> TEXT: kalimat kuasa panjang (>400 huruf, kantor/alamat/nomor lengkap) terpotong di tengah kata dan "sebagai Penggugat;" hilang.
  4. kalimat kuasa: ", yang telah didaftarkan" -> " yang telah didaftarkan" (tanpa koma, bunyi contoh pengguna) - HANYA di jalur identitas ini; variabel kalimat kuasa 8540/8541 yang dipakai relaas dan bagian lain TIDAK diubah.
Selain itu persis fungsi lama (komentar fungsi diberi awalan "AP:" agar paket mengenali; tanpa komentar -- di badan)."""
import re

LAMA_CETAK = """    SET hasil = CONCAT(hasil, IF(hasil = '', '', '<br>'),
      '<strong>', IFNULL(v_nama, ''), '</strong>, NIK ', IFNULL(v_nik, ''),
      ', tempat dan tanggal lahir ', IFNULL(v_tempat, ''), ', ', isian_rtf_tanggal(v_tgl),
      ', agama ', IFNULL(v_agama, ''), ', pekerjaan ', IFNULL(v_pekerjaan, ''), ', pendidikan ', IFNULL(v_pendidikan, ''),
      ', ', TRIM(CONCAT_WS(' ', v_kedi, IFNULL(v_alamat, ''))), v_akhir);"""

BARU_CETAK = """    SET hasil = CONCAT(hasil, IF(hasil = '', '', '<br>'),
      '<strong>', IFNULL(v_nama, ''), '</strong>, NIK ', IFNULL(v_nik, ''),
      ', tempat dan tanggal lahir ', IFNULL(v_tempat, ''), ', ', isian_rtf_tanggal(v_tgl),
      ', agama ', IFNULL(v_agama, ''), ', pendidikan ', IFNULL(v_pendidikan, ''), ', pekerjaan ', IFNULL(v_pekerjaan, ''),
      ', ', TRIM(CONCAT_WS(' ', v_kedi, IFNULL(v_alamat, ''))), v_akhir);"""


LAMA_AWAL = "  SET v_kuasa = TRIM(IFNULL(p_kuasa, ''));\n  SET selesai = 0;\n"
BARU_AWAL = ("  SET v_kuasa = REPLACE(TRIM(IFNULL(p_kuasa, '')), ', yang telah didaftarkan', ' yang telah didaftarkan');\n"
             "  SET selesai = 0;\n")

LAMA_AKHIR = "  DECLARE v_akhir VARCHAR(400) CHARSET latin1;\n"
BARU_AKHIR = "  DECLARE v_akhir TEXT CHARSET latin1;\n"
LAMA_KOMENTAR = "identitas SEMUA pihak sisi 1 atau 2 menurut peringkat (urut urutan, id) untuk perkara yang urutannya tidak rapat dari 1; satu pihak tanpa angka romawi; alamat pihak pertama boleh diganti p_alamat1; p_kuasa (bila terisi) = kalimat kuasa"
BARU_KOMENTAR = "identitas SEMUA pihak sisi 1 atau 2 menurut peringkat (urut urutan, id), satu jalan untuk semua perkara (urutan rapat atau tidak); tanpa umur; urutan agama, pendidikan, pekerjaan; satu pihak tanpa angka romawi; alamat pihak pertama boleh diganti p_alamat1; p_kuasa (bila terisi) = kalimat kuasa"


def baru(lama):
    """lama = teks 'DROP FUNCTION ... CREATE FUNCTION ... END' (tanpa $$ akhir). Kembalikan teks baru."""
    for a, n in ((LAMA_CETAK, 1), (LAMA_AWAL, 1), (LAMA_KOMENTAR, 1), (LAMA_AKHIR, 1)):
        assert lama.count(a) == n, (a[:60], lama.count(a))
    t = lama.replace(LAMA_CETAK, BARU_CETAK).replace(LAMA_AWAL, BARU_AWAL).replace(LAMA_KOMENTAR, BARU_KOMENTAR).replace(LAMA_AKHIR, BARU_AKHIR)
    return t


# ---------------------------------------------------------------------------------------------------------------------------------------------
# isian_rtf_pihak_tambahan (Turut Tergugat/Termohon = #8710#, pihak intervensi = #7054#; dipanggil di paragraf yang sama dengan #7048#):
# identitas yang ikut dicetak di paragraf identitas, jadi diselaraskan: PENDIDIKAN sebelum pekerjaan (TANPA umur, keputusan 112)
# (bagian yang kosong tetap dilewati seperti sebelumnya; "beralamat di" tetap karena pihak ini sering badan/instansi).
T_REP = [
    ("  DECLARE v_agama_id INT;\n",
     "  DECLARE v_agama_id INT;\n  DECLARE v_pend VARCHAR(100) CHARSET latin1;\n", 1),
    ("ph.agama_id, ph.pekerjaan\n      FROM SIPP.perkara_pihak4 t LEFT JOIN SIPP.pihak ph ON ph.id = t.pihak_id\n",
     "ph.agama_id, ph.pekerjaan, d.kode\n      FROM SIPP.perkara_pihak4 t LEFT JOIN SIPP.pihak ph ON ph.id = t.pihak_id LEFT JOIN SIPP.tingkat_pendidikan d ON d.id = ph.pendidikan_id\n", 1),
    ("ph.agama_id, ph.pekerjaan\n      FROM SIPP.perkara_pihak3 t LEFT JOIN SIPP.pihak ph ON ph.id = t.pihak_id\n",
     "ph.agama_id, ph.pekerjaan, d.kode\n      FROM SIPP.perkara_pihak3 t LEFT JOIN SIPP.pihak ph ON ph.id = t.pihak_id LEFT JOIN SIPP.tingkat_pendidikan d ON d.id = ph.pendidikan_id\n", 1),
    ("v_agama_id, v_pekerjaan;\n", "v_agama_id, v_pekerjaan, v_pend;\n", 1),
    ("      IF(TRIM(IFNULL(v_pekerjaan, '')) = '', '', CONCAT(', pekerjaan ', TRIM(v_pekerjaan))),\n",
     "      IF(TRIM(IFNULL(v_pend, '')) = '', '', CONCAT(', pendidikan ', TRIM(v_pend))),\n      IF(TRIM(IFNULL(v_pekerjaan, '')) = '', '', CONCAT(', pekerjaan ', TRIM(v_pekerjaan))),\n", 1),
    ("semua pihak menurut peringkat (urut urutan, id), diawali <br>; kosong bila tidak ada'",
     "semua pihak menurut peringkat (urut urutan, id), diawali <br>; pendidikan ikut bila ada (tanpa umur); kosong bila tidak ada'", 1),
]


def baru_tambahan(lama):
    t = lama
    for a, b, n in T_REP:
        assert t.count(a) == n, (a[:70], t.count(a))
        t = t.replace(a, b)
    return t
