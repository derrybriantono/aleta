# -*- coding: utf-8 -*-
"""A5 (keputusan Derry 182): daftar teks MERAH per berkas untuk ditandai Derry. TIDAK mengubah satu blangko pun.
pakai: python daftar_merah.py <akar _blangko_abt (memuat derry_briantono/)> <temuan A3 (temuan.json)> <keluar folder>
Sumber daftar berkas: A3-K05 (63 blangko teks merah di luar K02-K04). Keluaran: daftar-teks-merah.csv dan daftar-teks-merah.html."""
import csv
import html
import json
import os
import re
import sys

sys.path.insert(0, 'D:/aleta-dev/kerja/audit-abt-4nov/A3/alat')
import rtfmini  # noqa: E402

SAJA_PENANDA = re.compile(r'^(?:#\d{4,5}#[\s.,;:]*)+$')


def usulan(f):
    t = f.strip()
    if SAJA_PENANDA.match(t):
        return 'hitamkan', 'variabel otomatis (isi datang dari data): warna merah tidak perlu'
    if re.fullmatch(r'\(.*\)[.;]?', t) and re.search(r'[A-Z]{4,}', t):
        return 'buang/hitamkan', 'catatan kerja dalam kurung: buang dari cetakan atau hitamkan'
    if '_' in t or '...' in t or '\u2026' in t:
        return 'isian', 'ada bagian kosong untuk diketik (_ / ...): jadikan isian (variabel) agar muncul di Perlu diisi'
    if re.search(r'\b\w+/\w+\b', t) and len(t) < 120:
        return 'isian', 'pilihan dengan garis miring: jadikan isian pilihan'
    if len(t) <= 3:
        return 'hitamkan', 'tanda baca/kata pendek'
    return 'hitamkan atau isian', 'kalimat pilihan: hitamkan bila bunyinya memang tetap; jadikan isian bila berubah per perkara'


def main():
    akar, temuan, keluar = sys.argv[1:4]
    os.makedirs(keluar, exist_ok=True)
    k05 = [t for t in json.load(open(temuan, encoding='utf-8')) if t['id'] == 'A3-K05'][0]['berkas']
    baris = []
    for rel in k05:
        p = os.path.join(akar, 'derry_briantono', rel)
        if not os.path.exists(p):
            baris.append((rel, '(berkas tidak ada di pohon ini)', 0, '', ''))
            continue
        r = rtfmini.urai(open(p, 'rb').read())
        for f in r['merah']:
            if len(f.strip()) < 2:
                continue
            u, ket = usulan(f)
            baris.append((rel, f.strip().replace('\n', ' / ').replace('\t', ' '), len(f.strip()), u, ket))
    with open(os.path.join(keluar, 'daftar-teks-merah.csv'), 'w', encoding='utf-8-sig', newline='') as fo:
        w = csv.writer(fo)
        w.writerow(['no', 'berkas', 'potongan teks merah', 'huruf', 'usulan', 'alasan usulan', 'keputusan Derry (isian / hitamkan / biarkan)'])
        for i, b in enumerate(baris, 1):
            w.writerow([i, b[0], b[1][:400], b[2], b[3], b[4], ''])
    per = {}
    for b in baris:
        per.setdefault(b[0], []).append(b)
    h = ['<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Daftar teks merah blangko Derry</title>',
         '<style>body{font:14px/1.45 system-ui,sans-serif;margin:16px;max-width:1100px}h1{font-size:20px}h2{font-size:15px;margin:22px 0 6px;word-break:break-all}'
         'table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:4px 6px;vertical-align:top}th{background:#eee;text-align:left}'
         '.m{color:#b00020}.u{white-space:nowrap}small{color:#555}button{margin:6px 6px 6px 0;padding:6px 10px}</style></head><body>',
         '<h1>Teks merah di %d blangko Derry (A5)</h1>' % len(per),
         '<p>Tidak ada blangko yang diubah. Pilih keputusan per baris; tombol di bawah menyalin hasilnya sebagai CSV.</p>',
         '<button id="salin">Salin keputusan (CSV)</button><small id="st"></small>']
    n = 0
    for rel, rows in per.items():
        h.append('<h2>%s</h2><table><tr><th>#</th><th>potongan teks merah</th><th>usulan</th><th>keputusan</th></tr>' % html.escape(rel))
        for b in rows:
            n += 1
            h.append('<tr data-b="%s"><td>%d</td><td class="m">%s</td><td class="u"><b>%s</b><br><small>%s</small></td><td><select><option></option><option>isian</option><option>hitamkan</option><option>biarkan</option></select></td></tr>'
                     % (html.escape(rel, True), n, html.escape(b[1][:400]), html.escape(b[3]), html.escape(b[4])))
        h.append('</table>')
    h.append('<script>document.getElementById("salin").onclick=function(){var o=[["no","berkas","potongan","keputusan"]];document.querySelectorAll("tr[data-b]").forEach(function(r){var s=r.querySelector("select").value;if(s){o.push([r.cells[0].textContent,r.dataset.b,r.cells[1].textContent,s]);}});'
             'var t=o.map(function(c){return c.map(function(x){return "\\""+String(x).replace(/"/g,"\\"\\"")+"\\""}).join(",")}).join("\\n");'
             'navigator.clipboard.writeText(t).then(function(){document.getElementById("st").textContent=" disalin "+(o.length-1)+" baris"},function(){prompt("Salin:",t)})};</script></body></html>')
    open(os.path.join(keluar, 'daftar-teks-merah.html'), 'w', encoding='utf-8', newline='\n').write('\n'.join(h))
    jenis = {}
    for b in baris:
        jenis[b[3]] = jenis.get(b[3], 0) + 1
    print('blangko %d, potongan merah %d' % (len(per), len(baris)), jenis)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
