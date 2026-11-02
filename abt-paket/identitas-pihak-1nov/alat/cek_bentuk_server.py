# -*- coding: utf-8 -*-
import hashlib, json, re, sys
sys.path.insert(0, 'D:/Aplikasi/aleta/tmp/kompat55')
sys.path.insert(0, 'D:/aleta-dev/wt/w181/abt-paket/identitas-pihak-1nov/sumber')
import tiru55
import bangun_paket as P
d = 'D:/aleta-dev/wt/w181/abt-paket/identitas-pihak-1nov/paket-satker/'
isi = json.load(open('D:/aleta-dev/wt/w181/abt-paket/identitas-pihak-1nov/hasil/isi-paket.json', encoding='utf-8'))
for nama, f, kunci in (('baru', 'abt-identitas-pihak-1nov-FUNGSI.sql', 'baru_md5'), ('lama', 'abt-identitas-pihak-1nov-FUNGSI-LAMA.sql', 'lama_md5')):
    t = open(d + f, 'rb').read().decode('latin1').replace('\r\n', '\n')
    for fn in P.FN_UBAH:
        _, bd = P.blok(fn, t)
        laptop = hashlib.md5(bd.encode('latin1')).hexdigest()
        server = hashlib.md5(tiru55.tiru(bd).encode('latin1')).hexdigest()
        print(nama, fn, 'md5 laptop', laptop, '== isi-paket', laptop == isi['fungsi'][fn][kunci], '| bentuk server', server, 'SAMA' if server == laptop else 'BEDA')
