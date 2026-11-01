# -*- coding: utf-8 -*-
"""Render sungguhan (renderer ABT php56 asli) paket teks-pihak-1nov: SEBELUM (basis sesudah 25 paket, pohon /d/r155) dan SESUDAH (basis kerja
dengan paket terpasang, pohon /d/r155w).

pakai: python driver155.py <sebelum|sesudah> [siapkan] [kasus,kasus,...]
keluaran: D:/Aplikasi/aleta/tmp/w155/render/<mode>/<keadaan>/<kasus>.rtf (+ .txt teks tampak)
"""
import json
import os
import subprocess
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SINI)
MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
mode = sys.argv[1]
SRC = {'sebelum': 'aps_badilag_rantai155', 'sesudah': 'aps_badilag_w155d'}[mode]
TREE = {'sebelum': 'D:/r155/_blangko_abt/derry_briantono', 'sesudah': 'D:/r155w/_blangko_abt/derry_briantono'}[mode]
os.environ['ABT_SRC'] = SRC
import render155 as R  # noqa: E402

KELUAR = 'D:/Aplikasi/aleta/tmp/w155/render'

# ── teks uji: ketikan para pihak apa adanya (salah ketik, penanda tak rapi, huruf besar) ──
NASKAH_P = ("KESIMPULAN PENGGUGAT\n"
            "Bahwa Penggugat tetap pada dalil gugatanya semula ;\n"
            "1.Bahwa berdasarkan keterangan saksi-saksi terbukti rumah tangga sudah tidak harmonis ;\n"
            "2 . Bahwa tergugat pergi meninggalkan penggugat sejak bulan mei 2025 ;\n"
            "3 .Bahwa Penggugat telah berusaha rukun namun tidak berhasil\n"
            "Berdasarkan hal-hal tersebut diatas, Penggugat mohon agar Majelis Hakim menjatuhkan putusan :\n"
            "1. Mengabulkan gugatan Penggugat;\n"
            "2. Menjatuhkan talak satu ba'in sughra Tergugat terhadap Penggugat")
NASKAH_T = ("Bahwa Tergugat tetap pada jawabanya dan menolak seluruh dalil Penggugat kecuali yang diakui ;\n"
            "1 . Bahwa Tergugat tidak pernah meninggalkan Penggugat\n"
            "2.Bahwa Tergugat masih sayang kepada Penggugat\n"
            "Mohon gugatan Penggugat ditolak")
POKOK_P = "Bahwa Penggugat tetap pada gugatan semula dan memohon gugatannya dikabulkan"
POKOK_T = "Tergugat tetap pada jawabannya dan memohon gugatan ditolak"

# kasus: kode -> (berkas relatif pohon, perkara_id)
KASUS = {
    # putusan kontradiktoir perkara gugatan, kesimpulan dalam kalimat
    'kes1': ('1 Perceraian CG/[02c] [Kabul] CG - F - Pencabutan Ditolak T Sesudah Jawaban.rtf', 10284),
    'kes2': ('96a Verzet/[01] [Kabul] Verzet - Perlawanan Dikabulkan - Putusan Verstek Dibatalkan.rtf', 10284),
    # verstek / T tidak hadir setelah mediasi (hanya huruf kecil, tanpa naskah utuh)
    'ver1': ('1 Perceraian CG/[02a] [Kabul] CG - T Tidak Hadir Setelah Mediasi - F.rtf', 10284),
    # huruf pertama kecil
    'es1': ('10 Ekonomi Syariah/[01] [Kabul] ES Gugatan Sederhana - Wanprestasi - P & T Hadir.rtf', 10284),
    'eks1': ('1 Perceraian CG/[99c] [NO] CG - Eksepsi Kewenangan Absolut Dikabulkan.rtf', 10284),
    'sita1': ('97 Sita/[01] [Kabul] Putusan Sela - Sita Dikabulkan.rtf', 10284),
    # Asal Usul Anak tanpa sub-bab (bukti 4 keadaan)
    'aua1': ('8 Asal Usul Anak/[01] [Kabul] AUA - Anak Sah dari Perkawinan Tercatat, Belum Punya Akta Kelahiran.rtf', 10090),
    'aua2': ('8 Asal Usul Anak/[98] [Cabut] AUA - Setelah Pembuktian.rtf', 10090),
    # BAS pembuktian ("telah cukup dengan ...")
    'bas1': ('1 Perceraian CG - BAS/BAS ALUR 04 [6] BAS 6 P & T Hadir - Pembuktian P.rtf', 10284),
    'bas2': ('1 Perceraian CG - BAS/BAS ALUR 04 [7] BAS 7 P & T Hadir - Pembuktian T.rtf', 10284),
    'bas3': ('2 Itsbat Nikah - BAS/BAS ALUR 11 [1a] BAS 1 IN - Kabul Syahadah Istifadhah (1x Sidang).rtf', 10276),
}
KODE_P = (9955, 1214, 9958, 8131, 8132, 378, 9956)
ISIAN_KESIMPULAN = {
    'naskah': {8436: POKOK_P, 8437: POKOK_T, 12027: NASKAH_P, 12028: NASKAH_T},
    'pokok': {8436: POKOK_P, 8437: POKOK_T},
    'kosong': {},
}
ISIAN_KECIL = {9355: 'Menolak seluruh dalil Penggugat dan menyatakan tidak ada wanprestasi', 9491: 'Sengketa terikat klausula arbitrase',
               9681: 'Perkara ini merupakan kewenangan Pengadilan Negeri', 9164: 'Tidak keberatan atas permohonan sita tersebut'}
HAPUS_KES = (8436, 8437, 12027, 12028, 9355, 9491, 9681, 9164)


def sqljalan(s):
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '--default-character-set=latin1'], input=s.encode('latin1'), capture_output=True)
    if r.returncode:
        raise SystemExit(r.stderr.decode('latin1')[-500:])


def tulis_isian(perkara, nilai, hapus):
    s = []
    for no in hapus:
        s.append('DELETE FROM %s.abt_data_teks WHERE perkara_id = %d AND no_var = %d;' % (SRC, perkara, no))
    for no, t in nilai.items():
        s.append("INSERT INTO %s.abt_data_teks (no_var, perkara_id, data, modifier) VALUES (%d, %d, CONVERT(0x%s USING latin1), 'uji');" % (SRC, no, perkara, t.encode('latin1').hex()))
    sqljalan('\n'.join(s))


def isian_bukti():
    return json.loads(subprocess.run(['node', os.path.join(SINI, 'isian_bukti.js')], capture_output=True, check=True).stdout.decode('utf8'))


def jalankan(daftar_kasus, keadaan, nilai_fn, hapus_fn, nama_keadaan):
    tg = []
    for k in daftar_kasus:
        rel, pid = KASUS[k]
        tulis_isian(pid, nilai_fn(k), hapus_fn(k))
        tg.append((os.path.join(TREE, rel), pid, '', '%s/%s/%s/%s' % (KELUAR, mode, nama_keadaan, k)))
    hasil = R.render_banyak(tg)
    for k, v in hasil.items():
        print(mode, nama_keadaan, os.path.basename(k), v[:80], flush=True)


def main():
    pilih = sys.argv[3].split(',') if len(sys.argv) > 3 else list(KASUS)
    if 'siapkan' in sys.argv:
        R.siapkan()
    bukti = isian_bukti()
    # kesimpulan: 3 keadaan
    kes = [k for k in pilih if k in ('kes1', 'kes2', 'ver1')]
    for kd, isi in ISIAN_KESIMPULAN.items():
        if kes:
            jalankan(kes, kd, lambda k: isi, lambda k: HAPUS_KES, 'kesimpulan-' + kd)
    # huruf kecil (data teks pihak literal huruf besar)
    kc = [k for k in pilih if k in ('es1', 'eks1', 'sita1')]
    if kc:
        jalankan(kc, 'kecil', lambda k: ISIAN_KECIL, lambda k: HAPUS_KES, 'huruf-kecil')
    # bukti 4 keadaan
    bk = [k for k in pilih if k in ('aua1', 'aua2', 'bas1', 'bas2', 'bas3')]
    for kd in ('surat', 'elektronik', 'keduanya', 'tanpa'):
        if bk:
            def nilai(k, kd=kd):
                d = {9955: bukti[kd]['P'], 9911: bukti[kd]['T']}
                return {no: t for no, t in d.items() if t}
            jalankan(bk, kd, nilai, lambda k: KODE_P + (9911,), 'bukti-' + kd)


main()
