# -*- coding: utf-8 -*-
"""Ukur pembacaan petitum paket U2 atas putusan cerai NYATA (SIPP server, BACA SAJA lewat lihat-jejak.sh).

Kebenaran dasar = amar_putusan putusan hakim (perkara_putusan, status kabul, putusan sejak 2023-01-01).
Yang diukur per tuntutan (hak asuh, nafkah anak, iddah, mut'ah, madliyah, harta bersama):
  petitum_dan_amar   petitum terbaca menuntut DAN amar memuatnya (tuntutan dikabulkan)
  petitum_saja       petitum terbaca menuntut, amar tidak memuatnya (ditolak / tidak dipertimbangkan: kata [PERIKSA] menahan)
  amar_saja          amar memuat, petitum tidak terbaca (rekonvensi, kesepakatan mediasi, ex officio: ditangani pilihan keputusan hakim)
Pakai: python ukur_server.py <keluar.json>"""
import json, os, subprocess, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'sumber'))
import susun_variabel as sv

AMAR = {
    'hak asuh': 'hadhanah|hadlanah|hak asuh|hak pengasuhan|pemeliharaan|pengasuhan|asuhan',
    'nafkah anak': 'nafkah[^;]{0,60}anak|anak[^;]{0,60}nafkah|biaya[^;]{0,60}anak',
    'nafkah iddah': 'iddah|idah',
    "mut'ah": 'mut[^a-z]{0,4}ah',
    'nafkah madliyah': 'madli|madhi|mahdhi|lampau|yang lalu|terhutang',
    'harta bersama': 'harta bersama|harta gono|gono.?gini',
}
PET = {'hak asuh': sv.RE_H, 'nafkah anak': sv.RE_N, 'nafkah iddah': sv.RE_I, "mut'ah": sv.RE_M, 'nafkah madliyah': sv.RE_D, 'harta bersama': sv.RE_B}
KUM = {'hak asuh': 349, 'harta bersama': 348}


def q_srv(sql):
    r = subprocess.run(['ssh', '-o', 'ConnectTimeout=25', 'aleta', 'cat > /tmp/u2q.$$.sql; bash /root/lihat-jejak.sh "$(cat /tmp/u2q.$$.sql)"; rm -f /tmp/u2q.$$.sql'],
                       input=sql.encode('utf-8'), capture_output=True, timeout=600)
    if r.returncode or r.stdout.startswith(b'ERROR'):
        raise SystemExit((r.stdout + r.stderr).decode('utf-8', 'replace')[:500])
    return r.stdout.decode('utf-8', 'replace').splitlines()


def main():
    amar = 'LOWER(pu.amar_putusan)'
    hasil = {}
    for jn, nm in ((347, 'cerai gugat'), (346, 'cerai talak')):
        sel = []
        for k in PET:
            pf = "(%s REGEXP '%s'%s)" % (sv.PET, PET[k], (" OR EXISTS(SELECT 1 FROM perkara_kumulasi kk WHERE kk.perkara_id=p.perkara_id AND kk.jenis_perkara_id=%d)" % KUM[k]) if k in KUM else '')
            af = "(%s REGEXP '%s')" % (amar, AMAR[k])
            sel.append("SUM(%s AND %s), SUM(%s AND NOT %s), SUM(NOT %s AND %s)" % (pf, af, pf, af, pf, af))
        q = ("SELECT COUNT(*), %s FROM perkara p JOIN perkara_putusan pu ON pu.perkara_id=p.perkara_id WHERE p.jenis_perkara_id=%d AND pu.status_putusan_id=62 "
             "AND pu.tanggal_putusan>='2023-01-01'") % (', '.join(sel), jn)
        v = q_srv(q)[1].split('\t')
        d = {'putusan_kabul': int(v[0])}
        for i, k in enumerate(PET):
            a, b, c = (int(x or 0) for x in v[1 + 3 * i:4 + 3 * i])
            d[k] = {'petitum_dan_amar': a, 'petitum_saja': b, 'amar_saja': c}
        hasil[nm] = d
    json.dump(hasil, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for nm, d in hasil.items():
        print(nm, d['putusan_kabul'])
        for k in PET:
            print('  ', k.ljust(16), d[k])


if __name__ == '__main__':
    main()
