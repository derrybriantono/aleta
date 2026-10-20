# -*- coding: utf-8 -*-
"""Katalog saksi PENCABUTAN KEKUASAAN ORANG TUA (jenis 353) -> ekstensi-sipp/saksi-katalog/pencabutan-kuasa-asuh.json.
Pakai: python katalog_353.py   (menulis berkas JSON; lalu node alat/periksa_katalog.cjs pencabutan-kuasa-asuh.json)

Isian milik jenis ini (variabel_353.py): 3800 hubungan Penggugat/Pemohon dengan anak, 3801 kedudukan (otomatis), 3802 huruf alasan (A melalaikan, B berkelakuan buruk),
3805 fakta kelalaian/kelakuan buruk yang terbukti, 3806 jangka waktu, 3808/3817 orang tua yang dicabut, 3809 wali pengganti. Jawaban saksi memakai isian itu supaya
bagian "keterangan saksi" putusan sama dengan fakta yang dipakai pertimbangan hukum.
"""
import json
import sys

from katalog_lib import Q, dasar_dari, jawaban_umum_dari, tulis_katalog

P1 = {'id': 'pp-hubungan-saksi', 'judul': 'Hubungan saksi dengan para pihak dan anak', 'uraian': 'saksi menerangkan siapa dirinya dan bagaimana ia mengenal para pihak dan anak (sebab pengetahuan)',
      'dasarHukum': ['dh-sebab-pengetahuan', 'dh-unus-testis', 'dh-saksi-syarat'], 'wajib': True}
POKOK = [
    P1,
    {'id': 'pp-hubungan-pengaju-anak', 'judul': 'Kedudukan pengaju terhadap anak', 'uraian': 'pengaju adalah orang tua yang lain, keluarga anak dalam garis lurus ke atas, saudara kandung dewasa atau pejabat yang berwenang',
     'dasarHukum': ['dh-uu1-49-1'], 'wajib': True},
    {'id': 'pp-status-anak', 'judul': 'Anak, umur dan hubungannya dengan orang tua yang dimohonkan dicabut', 'uraian': 'anak belum berumur 18 tahun, belum pernah menikah dan anak kandung orang tua yang dimohonkan dicabut',
     'dasarHukum': ['dh-uu1-47'], 'wajib': True},
    {'id': 'pp-kelalaian', 'judul': 'Orang tua sangat melalaikan kewajibannya terhadap anak', 'uraian': 'perbuatan atau pengabaian yang nyata, sejak kapan, dan bahwa kelalaian itu sangat serius',
     'dasarHukum': ['dh-uu1-49-1', 'dh-uu1-45', 'dh-beban-bukti'], 'wajib': True, 'keadaan': {'alasanPencabutan': 'A'}},
    {'id': 'pp-kelakuan-buruk', 'judul': 'Orang tua berkelakuan buruk sekali', 'uraian': 'kelakuan buruk yang nyata (mabuk, judi, kekerasan, perbuatan tercela) dan dampaknya pada anak',
     'dasarHukum': ['dh-uu1-49-1', 'dh-beban-bukti'], 'wajib': True, 'keadaan': {'alasanPencabutan': 'B'}},
    {'id': 'pp-akibat-anak', 'judul': 'Akibat bagi anak', 'uraian': 'keadaan anak: pendidikan, kesehatan, kebutuhan dasar, pergaulan dan kejiwaan',
     'dasarHukum': ['dh-uu23-30'], 'wajib': True},
    {'id': 'pp-upaya', 'judul': 'Upaya sebelumnya', 'uraian': 'teguran, nasihat atau musyawarah keluarga sebelum perkara diajukan', 'dasarHukum': ['dh-uu23-30'], 'wajib': False},
    {'id': 'pp-pengasuhan', 'judul': 'Pengasuhan anak sekarang dan kesanggupan pengaju', 'uraian': 'siapa yang mengasuh dan membiayai anak saat ini; kemampuan dan kesediaan pengaju',
     'dasarHukum': ['dh-uu1-45'], 'wajib': True},
    {'id': 'pp-biaya-orang-tua', 'judul': 'Kewajiban biaya orang tua yang dicabut', 'uraian': 'orang tua yang dicabut tetap berkewajiban memberi biaya pemeliharaan; hubungan darah tidak putus',
     'dasarHukum': ['dh-uu1-49-2', 'dh-uu23-32'], 'wajib': False},
    {'id': 'pp-wali', 'judul': 'Calon wali pengganti', 'uraian': 'kelayakan, kesediaan dan hubungan calon wali dengan anak (bila penunjukan wali diminta bersamaan)',
     'dasarHukum': ['dh-pp29-9', 'dh-uu23-31'], 'wajib': False, 'keadaan': {'wali': 'ada'}},
    {'id': 'pp-keberatan', 'judul': 'Keberatan pihak lain', 'uraian': 'ada tidaknya keluarga atau pihak lain yang keberatan', 'dasarHukum': [], 'wajib': False},
    {'id': 'pp-penutup', 'judul': 'Penutup keterangan', 'uraian': 'saksi menyatakan keterangannya telah cukup', 'dasarHukum': [], 'wajib': False},
]

DASAR_BARU = [
    {'id': 'dh-uu1-47', 'rujukan': 'Pasal 47 ayat (1) dan ayat (2) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan',
     'uraian': 'anak yang belum berumur 18 tahun atau belum pernah menikah berada di bawah kekuasaan orang tuanya selama tidak dicabut; orang tua mewakili anak dalam perbuatan hukum di dalam dan di luar pengadilan',
     'status': 'terverifikasi', 'sumber': 'UU 1/1974 naskah BPK (berkas uu1-1974-bpk.txt), dibaca 21 Okt 2026.'},
    {'id': 'dh-uu1-45', 'rujukan': 'Pasal 45 ayat (1) dan ayat (2) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan',
     'uraian': 'kedua orang tua wajib memelihara dan mendidik anak sebaik-baiknya sampai anak kawin atau dapat berdiri sendiri, juga setelah perkawinan orang tua putus',
     'status': 'terverifikasi', 'sumber': 'UU 1/1974 naskah BPK, dibaca 21 Okt 2026.'},
    {'id': 'dh-uu1-49-1', 'rujukan': 'Pasal 49 ayat (1) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan',
     'uraian': 'salah seorang atau kedua orang tua dapat dicabut kekuasaannya untuk waktu tertentu atas permintaan orang tua yang lain, keluarga anak dalam garis lurus ke atas, saudara kandung dewasa atau pejabat yang berwenang, bila sangat melalaikan kewajibannya terhadap anaknya atau berkelakuan buruk sekali',
     'status': 'terverifikasi', 'sumber': 'UU 1/1974 naskah BPK, dibaca 21 Okt 2026.'},
    {'id': 'dh-uu1-49-2', 'rujukan': 'Pasal 49 ayat (2) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan',
     'uraian': 'meskipun dicabut kekuasaannya, orang tua tetap berkewajiban memberi biaya pemeliharaan kepada anak',
     'status': 'terverifikasi', 'sumber': 'UU 1/1974 naskah BPK, dibaca 21 Okt 2026.'},
    {'id': 'dh-uu23-30', 'rujukan': 'Pasal 30 ayat (1) dan ayat (2) Undang-Undang Nomor 23 Tahun 2002 tentang Perlindungan Anak',
     'uraian': 'orang tua yang melalaikan kewajibannya dapat dikenai tindakan pengawasan atau kuasa asuhnya dicabut melalui penetapan pengadilan',
     'status': 'terverifikasi', 'sumber': 'UU 23/2002 (pasal ini tidak diubah UU 35/2014), naskah/berkas uu23-2002.txt di folder referensi hukum, dibaca 21 Okt 2026.'},
    {'id': 'dh-uu23-31', 'rujukan': 'Pasal 31 Undang-Undang Nomor 23 Tahun 2002 tentang Perlindungan Anak',
     'uraian': 'salah satu orang tua, saudara kandung atau keluarga sampai derajat ketiga dapat memohon pencabutan kuasa asuh; penetapan dapat menunjuk perseorangan atau lembaga sebagai wali yang seagama dengan anak',
     'status': 'terverifikasi', 'sumber': 'UU 23/2002, berkas uu23-2002.txt di folder referensi hukum, dibaca 21 Okt 2026.'},
    {'id': 'dh-uu23-32', 'rujukan': 'Pasal 32 Undang-Undang Nomor 23 Tahun 2002 tentang Perlindungan Anak',
     'uraian': 'penetapan pencabutan kuasa asuh memuat: tidak memutuskan hubungan darah, tidak menghilangkan kewajiban membiayai anak, dan batas waktu pencabutan',
     'status': 'terverifikasi', 'sumber': 'UU 23/2002, berkas uu23-2002.txt di folder referensi hukum, dibaca 21 Okt 2026.'},
    {'id': 'dh-pp29-9', 'rujukan': 'Pasal 3, Pasal 4 dan Pasal 9 ayat (2) Peraturan Pemerintah Nomor 29 Tahun 2019 tentang Syarat dan Tata Cara Penunjukan Wali',
     'uraian': 'syarat calon wali dari keluarga anak (antara lain berumur paling rendah 30 tahun, sehat, berkelakuan baik, mampu secara ekonomi, seagama dengan anak); permohonan penunjukan wali diajukan bersamaan dengan permohonan pencabutan kuasa asuh',
     'status': 'terverifikasi', 'sumber': 'PP 29/2019 (naskah/ekstra/pp29-2019.txt), dibaca 21 Okt 2026.'},
]
DASAR_ID_UMUM = ['dh-sebab-pengetahuan', 'dh-unus-testis', 'dh-saksi-syarat', 'dh-beban-bukti']

V = ['0046', '0047', '4406', '4407']   # variabel yang hampir selalu dipakai

from pert_353 import PERT  # noqa: E402


def susun():
    ju = jawaban_umum_dari('wasiat.json')
    dasar = dasar_dari('wasiat.json', DASAR_ID_UMUM) + DASAR_BARU
    kat = {
        'skema': 'saksi-katalog/1', 'kunci': 'pencabutan-kuasa-asuh', 'judul': 'Pencabutan kekuasaan orang tua', 'versi': 1, 'penulis': 'W3B', 'tahap': 2, 'contoh': False,
        'syarat': {'jenisPerkaraId': ['353']}, 'pihak': {'pengaju': '#0046#', 'lawan': '#0047#'},
        'blangkoBas': [
            {'folder': '6d Pencabutan Kekuasaan Orang Tua - BAS', 'berkas': 'BAS ALUR 04 [6] BAS 6 P & T Hadir - Pembuktian P', 'variabelSaksi': ['5058', '5059'], 'catatan': ''},
            {'folder': '6d Pencabutan Kekuasaan Orang Tua - BAS', 'berkas': 'BAS ALUR 60 Pencabutan Kuasa Asuh - Sidang 2 - T Tetap Tidak Hadir - Pembuktian dan Putusan Verstek', 'variabelSaksi': ['5058', '5059'], 'catatan': ''},
            {'folder': '6d Pencabutan Kekuasaan Orang Tua - BAS', 'berkas': 'BAS ALUR 60 Pencabutan Kuasa Asuh Mohon - [1a] Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan', 'variabelSaksi': ['5058', '5059'], 'catatan': ''},
        ],
        'dasarHukum': dasar,
        'keadaan': {
            'kehadiran': {'sumber': 'otomatis', 'nilai': ['verstek', 'kontradiktoir', 't-tidak-hadir-setelah-mediasi'], 'bawaan': 'kontradiktoir', 'label': 'Kehadiran Tergugat'},
            'alasanPencabutan': {'sumber': 'borang', 'nilai': ['A', 'B'], 'bawaan': ['A'], 'label': 'Alasan pencabutan (A sangat melalaikan kewajiban, B berkelakuan buruk sekali)', 'jamak': True},
            'wali': {'sumber': 'borang', 'nilai': ['ada', 'tidak'], 'bawaan': 'tidak', 'label': 'Penunjukan wali pengganti diminta bersamaan'},
        },
        'pokokPembuktian': POKOK, 'pertanyaan': PERT, 'jawabanUmum': ju,
        'catatanPetugas': [
            'Titik-titik (...) pada keterangan saksi wajib diganti dengan keterangan saksi yang sebenarnya; jangan dibiarkan kosong.',
            'Pencabutan kekuasaan orang tua hanya untuk waktu tertentu; tidak memutuskan hubungan darah dan tidak menghilangkan kewajiban orang tua membiayai anak (Pasal 49 ayat (2) UU 1/1974; Pasal 32 UU 23/2002).',
            'Keterangan saksi yang ragu atau hanya cerita orang lain bukan keterangan yang dialami sendiri; pertimbangkan menghadirkan saksi tambahan untuk hal yang menentukan.',
            'Jawaban yang memakai isian (#3805#, #3817#) mengikuti isian blangko; isi isian itu lebih dulu agar keterangan saksi dan fakta putusan sama.',
        ],
        'variabelBaru': ['3801', '3805', '3809', '3817', '4406', '4407'],
    }
    return kat


if __name__ == '__main__':
    p = tulis_katalog(susun(), 'pencabutan-kuasa-asuh.json')
    print(p)
