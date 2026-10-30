"""Untuk tiap variabel bukti surat (data_teks), golongkan paragraf tempatnya di blangko: daftar bernomor RTF (\\ls/listtext)
atau paragraf biasa, dan apakah di paragraf itu sudah tertulis nomor butir ("1." + tab) sebelum penanda.
pakai: python konteks_bukti.py <akar derry_briantono>"""
import collections, os, re, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sumber'))
from rtfsatuan import satuan
from rtf2txt import rtf_ke_teks

VAR = ['9955', '9958', '0378', '1214', '9956', '9957', '9911', '8131', '8132', '8133']
LEWATI = ('ALUR', '- BAS', 'terhapus', 'BAS ')


def panjang(p):
    p = os.path.abspath(p)
    a = chr(92) * 2 + '?' + chr(92)
    return p if (os.name != 'nt' or p.startswith(a)) else a + p.replace('/', chr(92))


akar = panjang(sys.argv[1])
hit = collections.Counter()
contoh = {}
for dp, dn, fn in os.walk(akar):
    rel = os.path.relpath(dp, akar).replace(chr(92), '/')
    if rel != '.' and rel.split('/')[0].startswith(LEWATI):
        continue
    for f in fn:
        if not f.lower().endswith('.rtf'):
            continue
        d = open(os.path.join(dp, f), 'rb').read().decode('latin1')
        if not any('#%s#' % v in d for v in VAR):
            continue
        for s, e, _, _ in satuan(d):
            u = d[s:e]
            t = rtf_ke_teks(u).replace('\n', ' ').strip()
            for v in VAR:
                if '#%s#' % v not in t:
                    continue
                if '\\fs2 ' in u or '\\fs2\\' in u or len(re.findall(r'#\d{4}#', t)) > 4:
                    k = 'daftar-isian-tersembunyi'
                else:
                    daftar = bool(re.search(r'\\ls\d+', u)) or '\\listtext' in u
                    tulis = bool(re.match(r'^\s*\d+[.)]', t))
                    k = ('list' if daftar else 'biasa') + ('+nomor-tertulis' if tulis else '')
                hit[(v, k)] += 1
                contoh.setdefault((v, k), rel + '/' + f + ' :: ' + t[:70])
for (v, k), n in sorted(hit.items()):
    print(v, k, n, '|', contoh[(v, k)][:150])
