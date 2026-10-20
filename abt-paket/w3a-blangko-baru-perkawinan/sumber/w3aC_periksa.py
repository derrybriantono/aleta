# -*- coding: utf-8 -*-
"""Pemeriksa perilaku paket jenis 345 (agen W3a-C): membangun ulang semua RTF lalu memeriksa isinya. Keluaran JSON di baris terakhir.
Dipakai oleh manajemen_surat/src/test/w3a-kelalaian-kewajiban-21okt.test.ts. Tidak mengakses server."""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import w3a_lib as L  # noqa: E402
import variabel_def as VD  # noqa: E402
import jenis_kelalaian_kewajiban as M  # noqa: E402

J = M.J
KATA_DILARANG = ['aleta', 'nafkah anak', 'perwalian', 'hibah', 'wakaf', 'wasiat', 'hadhanah', 'hadanah', 'putusnya perkawinan', 'bapak', 'ayah', 'pencegahan perkawinan']


def server_var():
    ada = set()
    for ln in open('D:/aleta-dev/kerja/w3a/abt_variabel_server.tsv', encoding='latin1', newline='').read().split('\n'):
        f = ln.split('\t')
        if f and f[0].isdigit():
            ada.add(int(f[0]))
    return ada


def baca(folder):
    hasil = {}
    d = os.path.join(L.OUT, folder)
    for f in sorted(os.listdir(L.lp(d))):
        if f.lower().endswith('.rtf'):
            hasil[f] = open(L.lp(os.path.join(d, f)), 'rb').read().decode('latin1')
    return hasil


def main():
    put, bas = M.bangun()
    mine = {x['no']: x for x in VD.VAR if 3690 <= x['no'] <= 3739}
    ada = server_var() | set(VD.VAR_NOS if hasattr(VD, 'VAR_NOS') else []) | {x['no'] for x in VD.VAR}
    r = {'putusan': 0, 'bas': 0, 'galat': [], 'variabel': len(mine)}
    P = baca(J['folder'])
    B = baca(J['folder_bas'])
    r['putusan'], r['bas'] = len(P), len(B)
    semua = dict(('P/' + k, v) for k, v in P.items())
    semua.update(('B/' + k, v) for k, v in B.items())
    token_dipakai = set()
    for nama, raw in semua.items():
        teks = L.rtf_ke_teks(raw)
        low = teks.lower()
        for kata in KATA_DILARANG:
            if re.search(r'' + re.escape(kata) + r'', low):
                r['galat'].append('%s memuat "%s"' % (nama[:70], kata))
        if L.periksa_token(raw):
            r['galat'].append('%s token terpecah' % nama[:70])
        for t in set(re.findall(r'#(\d{4})#', raw)):
            token_dipakai.add(int(t))
            if int(t) not in ada:
                r['galat'].append('%s memakai #%s# yang tidak ada' % (nama[:70], t))
        for sisa in ('...', '________', '[ ]'):
            if sisa in teks:
                r['galat'].append('%s memuat sisa "%s"' % (nama[:70], sisa))
    # struktur putusan
    for kode, _d, tujuan in M.DASAR:
        nama = tujuan % M.S
        raw = P.get(nama)
        if raw is None:
            r['galat'].append('putusan hilang: ' + nama)
            continue
        teks = L.rtf_ke_teks(raw)
        if kode in M.KABUL:
            for t in ('#3695#', '#3698#', '#3721#', '#3723#', '#3725#', '#3729#', '#3690#', '#3692#'):
                if t not in teks:
                    r['galat'].append('%s tanpa %s' % (kode, t))
            if 'Menyatakan #0047# telah melalaikan' not in teks:
                r['galat'].append(kode + ' tanpa amar Menyatakan melalaikan')
        if kode in M.TOLAK and ('#3695#' not in teks or '#3712#' not in teks):
            r['galat'].append(kode + ' tanpa dasar hukum atau alasan tolak')
        if kode in ('02', '02b') and '#3711#' not in teks:
            r['galat'].append(kode + ' tanpa #3711#')
        # penomoran amar berurutan
        am = teks.split('MENGADILI', 1)
        if len(am) == 2:
            nomor = [int(x) for x in re.findall(r'(?m)^(\d{1,2})\.\t', am[1].split('\n#8501#')[0])]
            if nomor != list(range(1, len(nomor) + 1)):
                r['galat'].append('%s nomor amar tidak berurutan %r' % (kode, nomor))
        m = M.RX_ISIAN.search(raw)
        if m:
            for t in re.findall(r'#(\d{4})#', m.group(1)):
                if int(t) not in ada:
                    r['galat'].append('%s daftar isian memuat #%s# tak dikenal' % (kode, t))
    # variabel
    for no, x in mine.items():
        if len(x['nama']) > 200:
            r['galat'].append('nama %d > 200' % no)
        if x['tipe'] == 'data_sql':
            s = x['sql']
            if not s.lstrip().upper().startswith('SELECT') or s.count('(') != s.count(')') or s.count("'") % 2:
                r['galat'].append('sql %d tidak seimbang' % no)
            if len(s) > 59000:
                r['galat'].append('sql %d terlalu panjang' % no)
    teks_no = sorted(no for no, x in mine.items() if x['tipe'] == 'data_teks')
    if sorted(int(k) for k in M.ISIAN) != teks_no:
        r['galat'].append('ISIAN %r != data_teks %r' % (sorted(int(k) for k in M.ISIAN), teks_no))
    if sorted(int(k) for k in M.RAMAH) != teks_no:
        r['galat'].append('RAMAH tidak lengkap')
    for k, (jenis, _a) in M.ISIAN.items():
        if jenis not in ('manual', 'opsional'):
            r['galat'].append('ISIAN %s jenis %s' % (k, jenis))
    # PETA
    kunci = [(m['status'], m['keadaan']) for m in M.PETA]
    if len(set(kunci)) != len(kunci):
        r['galat'].append('PETA tidak unik')
    for m in M.PETA:
        if m['berkas'] not in P:
            r['galat'].append('PETA menunjuk berkas tak ada: ' + m['berkas'])
    r['peta'] = len(M.PETA)
    r['token_baru_dipakai'] = sorted(t for t in token_dipakai if 3690 <= t <= 3739)
    r['token_baru_tak_terpakai'] = sorted(set(mine) - token_dipakai - {3691, 3694, 3697, 3699, 3701, 3702, 3703, 3704, 3705, 3706, 3707, 3708, 3709, 3710, 3700, 3696, 3711, 3712, 3731}
                                         - {3698, 3720, 3721, 3722, 3723, 3724, 3725, 3726, 3727, 3728, 3729, 3732, 3733})
    print(json.dumps(r, ensure_ascii=False))


if __name__ == '__main__':
    main()
