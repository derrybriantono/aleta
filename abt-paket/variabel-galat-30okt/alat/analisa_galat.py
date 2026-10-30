# -*- coding: utf-8 -*-
"""Ringkas hasil pindai_galat.py: galat/penanda mentah HANYA dihitung bila perkara sampel berjenis sama dengan folder blangko
yang memakai variabel itu (variabel cerai yang dijalankan atas perkara itsbat wajar kosong/galat). Keluar: daftar per pemilik.
pakai: python analisa_galat.py <galat.json> <keluar.txt>"""
import collections, json, re, sys

FOLDER = [  # awalan folder blangko Derry -> jenis perkara SIPP yang memakainya
    (r'^1 Perceraian CG|^1c |^1d |^1e |^1f ', ('Cerai Gugat', 'Cerai Talak')),
    (r'^1a Perceraian CT', ('Cerai Talak',)),
    (r'^2 Itsbat', ('Pengesahan Perkawinan/Istbat Nikah alur 16',)),
    (r'^2a Itsbat', ('Pengesahan Perkawinan/Istbat Nikah alur 15',)),
    (r'^3 Dispensasi', ('Dispensasi Kawin',)), (r'^3a Izin', ('Izin Kawin',)),
    (r'^4a Harta', ('Harta Bersama',)), (r'^4b Kewarisan', ('Kewarisan',)),
    (r'^6 Perwalian', ('Perwalian',)), (r'^7 Wali', ('Wali Adhol',)), (r'^8 Asal', ('Asal Usul Anak',)),
    (r'^9 Penetapan Ahli Waris', ('P3HP/Penetapan Ahli Waris',)),
]


def cocok(folder, jenis):
    for f in folder:
        for pola, js in FOLDER:
            if re.match(pola, f) and any(jenis.startswith(j) for j in js):
                return True
    return False


h = json.load(open(sys.argv[1], encoding='utf-8'))
baris = []
hit = collections.Counter()
for k, v in sorted(h.items(), key=lambda kv: int(kv[0])):
    g = [x for x in v['galat'] if cocok(v.get('folder', []), x[1])]
    m = [x for x in v['mentah'] if cocok(v.get('folder', []), x[1])]
    if not g and not m:
        continue
    pem = 'Derry (admin)' if v['pemilik'] == 'admin' else 'bawaan/lain (%s)' % (v['pemilik'] or '-')
    hit[pem] += 1
    contoh = (g or m)[0]
    baris.append('%s | %s | %s | %d blangko | %s | galat %d, penanda mentah %d | contoh %s %s: %s' % (
        k, pem, v['jenis'], v['blangko'], v['nama'][:60], len(g), len(m), contoh[0], contoh[1], str(contoh[2])[:120]))
out = ['variabel bermasalah atas perkara sejenis: ' + ', '.join('%s %d' % kv for kv in hit.items())] + baris
open(sys.argv[2], 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print('\n'.join(out))
