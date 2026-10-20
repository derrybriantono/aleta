# -*- coding: utf-8 -*-
"""Pemeriksa isi RTF paket W3a (jalan otomatis oleh bangun_paket.py; juga: python periksa_isi.py).

Memeriksa SEMUA RTF di rtf/derry_briantono/:
  1. dapat dibaca (rtf_peta) dan tak ada penanda #nnnn# yang terpecah kode RTF;
  2. setiap penanda #nnnn# adalah variabel yang ADA di server (D:/aleta-dev/kerja/w3a/abt_variabel_server.tsv) atau variabel baru paket;
  3. tanpa kata ALETA (ABT tidak boleh memuat tanda ALETA);
  4. tanpa sisa isian mentah dari berkas dasar ("ANAK 1 PERSATU", "PERSATU P NYA", "TODO", "XXX", "COPY FILE" bila bukan BAS);
  5. tanpa kata milik jenis lain (perwalian, wali adhal, hibah, wakaf, wasiat, nafkah anak, pencegahan, mafqud) kecuali yang dibolehkan jenis itu.
Mengembalikan daftar galat (kosong = lolos)."""
import os
import re
import sys

SUMBER = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SUMBER)
import w3a_lib as L  # noqa: E402
import variabel_def as VD  # noqa: E402

KATA_JENIS_LAIN = ['perwalian', 'wali adhal', 'wali adhol', 'hibah', 'wakaf', 'wasiat', 'mafqud', 'pencegahan perkawinan', 'dispensasi kawin', 'asal usul anak']
BOLEH = {
    'penolakan-perkawinan': ['wali adhal', 'dispensasi kawin', 'pencegahan perkawinan'],
    'perkawinan-campuran': ['dispensasi kawin'],
    'izin-kawin': ['dispensasi kawin', 'perwalian', 'wali adhal'],
    'pengesahan-anak': ['asal usul anak', 'perwalian'],
    'kelalaian-kewajiban': ['wasiat'],
    'hak-bekas-istri': ['perwalian'],
}
SISA_MENTAH = ['ANAK 1 PERSATU', 'PERSATU P NYA', 'TODO', 'XXXX', 'lahir tanggal _ (_ tahun)']


def variabel_server():
    ada = set()
    p = 'D:/aleta-dev/kerja/w3a/abt_variabel_server.tsv'
    for ln in open(p, encoding='latin1', newline='').read().split('\n'):
        f = ln.split('\t')
        if f and f[0].isdigit():
            ada.add(int(f[0]))
    return ada


def periksa(muat_modul=True):
    galat = []
    ada = variabel_server() | {x['no'] for x in VD.VAR}
    jenis_folder = {}
    for k, j in L.JENIS.items():
        jenis_folder[j['folder']] = k
        jenis_folder[j['folder_bas']] = k
    n = 0
    for d, _, fs in os.walk(L.lp(L.OUT)):
        for f in sorted(fs):
            if not f.lower().endswith('.rtf'):
                continue
            n += 1
            path = os.path.join(d, f)
            folder = os.path.basename(d)
            raw = open(path, 'rb').read().decode('latin1')
            try:
                teks = L.rtf_ke_teks(raw)
            except Exception as e:  # noqa: BLE001
                galat.append('%s/%s: tidak terbaca (%s)' % (folder, f, e))
                continue
            pecah = L.periksa_token(raw)
            if pecah:
                galat.append('%s/%s: token terpecah %r' % (folder, f, pecah))
            for t in sorted(set(re.findall(r'#(\d{4})#', raw))):
                if int(t) not in ada:
                    galat.append('%s/%s: variabel #%s# tidak ada di server maupun paket' % (folder, f, t))
            if 'aleta' in teks.lower() or 'aleta' in f.lower():
                galat.append('%s/%s: memuat kata ALETA' % (folder, f))
            for s in SISA_MENTAH:
                if s.lower() in teks.lower():
                    galat.append('%s/%s: sisa isian mentah "%s"' % (folder, f, s))
            kunci = jenis_folder.get(folder)
            if kunci:
                boleh = BOLEH.get(kunci, [])
                tl = teks.lower()
                for kata in KATA_JENIS_LAIN:
                    if kata in tl and kata not in boleh:
                        galat.append('%s/%s: memuat kata jenis lain "%s"' % (folder, f, kata))
    return n, galat


if __name__ == '__main__':
    import glob
    import importlib
    import relaas_w3a  # noqa: F401
    for f in sorted(glob.glob(os.path.join(SUMBER, 'jenis_*.py'))):
        importlib.import_module(os.path.basename(f)[:-3])
    n, g = periksa()
    print('berkas diperiksa:', n, '| galat:', len(g))
    for x in g[:200]:
        print('  GALAT', x)
    sys.exit(1 if g else 0)
