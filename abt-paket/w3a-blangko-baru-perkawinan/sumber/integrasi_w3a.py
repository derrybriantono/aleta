# -*- coding: utf-8 -*-
"""Menyuntikkan peta enam jenis W3a (peta-w3a.json) ke kode ALETA, idempoten (blok bertanda W3a 21 Okt diganti utuh bila ada):

  ekstensi-sipp/panel-alat.js                                ALAT_MENU_PUTUSAN, ALAT_PADANAN_JENIS, ALAT_PETA_BAWAAN (blok W3a)
  manajemen_surat/src/lib/tipe-keluaran/bawaan/bawaan-ekstensi.ts   cermin putusan.peta-blangko + putusan.padanan-jenis (deep-equal dengan panel-alat.js, dijaga uji)
  manajemen_surat/src/lib/alur-bas-baru-data.ts              ALUR 60-65 (dari berkas BAS di rtf/)
Pakai: python integrasi_w3a.py   (sesudah python bangun_paket.py)"""
import json
import os
import re
import sys

SUMBER = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SUMBER)
import w3a_lib as L  # noqa: E402

REPO = os.environ.get('W3A_REPO') or os.path.abspath(os.path.join(L.AKAR, '..', '..'))
PANEL = os.path.join(REPO, 'ekstensi-sipp', 'panel-alat.js')
CERMIN = os.path.join(REPO, 'manajemen_surat', 'src', 'lib', 'tipe-keluaran', 'bawaan', 'bawaan-ekstensi.ts')
ALUR = os.path.join(REPO, 'manajemen_surat', 'src', 'lib', 'alur-bas-baru-data.ts')
AWAL = '/* === W3a 21 Okt === */'
AKHIR = '/* === AKHIR W3a === */'
MENU_KODE = {'penolakan-perkawinan': 'w3pk', 'perkawinan-campuran': 'w3pc', 'izin-kawin': 'w3ik', 'pengesahan-anak': 'w3pa', 'kelalaian-kewajiban': 'w3kk', 'hak-bekas-istri': 'w3hb'}


def baris_jenis(k, rows):
    """Daftar baris peta (status, keadaan, berkas_tanpa_rtf, catatan) satu jenis, urut deterministik; baris pertama = kunci jenis tanpa status."""
    nama = lambda r: r['berkas'][:-4] if r['berkas'].lower().endswith('.rtf') else r['berkas']  # noqa: E731
    grup, urut = {}, []
    for r in rows:
        kk = (r['status'], r['keadaan'])
        if kk not in grup:
            grup[kk] = []
            urut.append(kk)
        grup[kk].append(r)
    # status yang hanya punya baris berkeadaan khusus tetap perlu baris polos (tanpa keadaan): tanpa itu pilihan jatuh ke blangko KABUL jenisnya
    for kk in list(urut):
        status, keadaan = kk
        if keadaan and (status, '') not in grup:
            sama = [r for r in rows if r['status'] == status]
            grup[(status, '')] = [sama[0]] + [r for r in sama[1:]]
            urut.insert(urut.index(kk), (status, ''))
    hasil = []
    kabul = grup.get(('Dikabulkan', ''))
    if kabul:
        varian = '; '.join(nama(x) for x in kabul[1:] + [r for r in rows if r['status'] == 'Dikabulkan' and r['keadaan'] and r is not kabul[0]][:4])
        hasil.append(('', '', nama(kabul[0]), ('varian: ' + varian) if varian else ''))
    for kk in urut:
        status, keadaan = kk
        g = grup[kk]
        utama = g[0]
        cat = utama['catatan'] or ''
        if len(g) > 1:
            # konvensi peta: catatan yang diawali "varian: " memuat nama berkas varian (dibaca rekomendasi sebagai alternatif); catatan lain dibuang agar awalan tetap
            cat = 'varian: ' + '; '.join(nama(x) for x in g[1:])
        elif keadaan and not cat:
            cat = 'keadaan: ' + keadaan.replace('-', ' ')
        hasil.append((status, keadaan, nama(utama), cat))
        if status == 'Digugurkan':
            hasil.append(('Gugur', keadaan, nama(utama), cat))
    return hasil


def kunci_baris(kunci, status, keadaan):
    if not status:
        return kunci
    return '%s|%s%s' % (kunci, status.lower(), ('|' + keadaan) if keadaan else '')


def js_str(t):
    return json.dumps(t, ensure_ascii=False)


def blok_js(data):
    menu, tabel, padanan = [], [], []
    for k, j in L.JENIS.items():
        if j['padanan_sipp']:
            padanan.append('  [%s, [%s]],' % (js_str(j['kunci_cermin']), ', '.join(js_str(x) for x in j['padanan_sipp'])))
        rows = [r for r in data['peta'] if r['jenis'] == k]
        if not rows:
            continue
        kode = MENU_KODE[k]
        menu.append('  %s: { blangko: %s, lain: [%s] },' % (kode, js_str(j['nama_menu_putusan']), js_str(j['alias_putusan'])))
        baris = baris_jenis(k, rows)
        tabel.append('  %s: {\n    asli: %s,\n    menu: %s,\n    baris: [\n%s\n    ],\n  },' % (
            js_str(j['kunci_cermin']), js_str(j['nama']), js_str(kode),
            '\n'.join('      [%s, %s, %s, %s],' % tuple(js_str(x) for x in b) for b in baris)))
    return menu, tabel, padanan


def sisip_blok(teks, blok, sebelum_penanda):
    """Ganti blok W3a yang ada, atau sisipkan blok sebelum `sebelum_penanda`."""
    if AWAL in teks:
        a = teks.index(AWAL)
        b = teks.index(AKHIR, a) + len(AKHIR)
        return teks[:a] + blok.rstrip('\n') + teks[b:]
    i = teks.index(sebelum_penanda)
    return teks[:i] + blok + teks[i:]


def suntik_panel(data):
    menu, tabel, padanan = blok_js(data)
    blok = (AWAL + '''
/**
 * ENAM JENIS PERKAWINAN/KELUARGA BARU versi Derry - paket ABT abt-w3a-blangko-baru-perkawinan (21 Okt 2026): penolakan perkawinan (343), perkawinan campuran (359), izin kawin (361),
 * pengesahan anak (352) = PERMOHONAN (Pdt.P, penetapan); kelalaian atas kewajiban suami/istri (345) dan hak-hak bekas istri/kewajiban bekas suami (351) = GUGATAN (Pdt.G).
 * Folder 5c / 5d / 3a / 8a / 1e / 1f; menu putusan 168 / 170 / 172 / 174 / 176 / 178 berpasangan dengan BAS 169 / 171 / 173 / 175 / 177 / 179. Baris dibangkitkan dari
 * abt-paket/w3a-blangko-baru-perkawinan/peta-w3a.json (integrasi_w3a.py); [status, keadaan, berkas, catatan].
 */
Object.assign(ALAT_MENU_PUTUSAN, {
%s
});
const ALAT_W3A_PETA = {
%s
};
function alatPetaW3a() {
  const hasil = {};
  for (const [kunci, j] of Object.entries(ALAT_W3A_PETA)) {
    for (const [status, keadaan, berkas, catatan] of j.baris) {
      const k = status ? `${kunci}|${status.toLowerCase()}${keadaan ? `|${keadaan}` : ""}` : kunci;
      hasil[k] = alatBarisPutusanLain(j.menu, j.asli, status, berkas, catatan);
    }
  }
  return hasil;
}
Object.assign(ALAT_PETA_BAWAAN, alatPetaW3a());
''' % ('\n'.join(menu), '\n'.join(tabel)) + AKHIR + '\n')
    s = open(PANEL, encoding='utf-8').read()
    # blok peta: sebelum penanda padanan; padanan jenis disisipkan ke ALAT_PADANAN_JENIS
    penanda = '\n\n\nconst ALAT_PADANAN_JENIS = ['
    if AWAL in s:
        s = sisip_blok(s, blok, '')
    else:
        # taruh blok sesudah blok I28 (/* === AKHIR I28 === */)
        pen = '/* === AKHIR I28 === */\n'
        assert pen in s
        i = s.index(pen) + len(pen)
        s = s[:i] + blok + s[i:]
    # padanan
    pad_awal = '  // W3a 21 Okt: padanan nama SIPP -> kunci baku\n'
    pad_akhir = '  // AKHIR W3a padanan\n'
    if pad_awal in s:
        a = s.index(pad_awal)
        b = s.index(pad_akhir, a) + len(pad_akhir)
        s = s[:a] + pad_awal + '\n'.join(padanan) + '\n' + pad_akhir + s[b:]
    else:
        ang = '  ["wali adhal", ["wali adhol", "wali adlal"]],\n'
        assert ang in s
        i = s.index(ang) + len(ang)
        s = s[:i] + pad_awal + '\n'.join(padanan) + '\n' + pad_akhir + s[i:]
    open(PANEL, 'w', encoding='utf-8', newline='').write(s)
    return len(sum(([b for b in baris_jenis(k, [r for r in data['peta'] if r['jenis'] == k])] for k in L.JENIS if any(r['jenis'] == k for r in data['peta'])), []))


def entri_ts(data):
    """Entri cermin TS (urutan lanjut dari entri terakhir putusan.peta-blangko)."""
    s = open(CERMIN, encoding='utf-8').read()
    a = s.index('"putusan.peta-blangko": [')
    b = s.index('  "putusan.padanan-jenis": [')
    segmen = s[a:b]
    if AWAL in segmen:
        # buang blok lama dari segmen untuk menghitung urutan terakhir
        segmen = segmen[:segmen.index('    ' + AWAL)] + segmen[segmen.index(AKHIR) + len(AKHIR):]
    urutan = [int(x) for x in re.findall(r'urutan: (\d+)', segmen)]
    nxt = max(urutan) + 1
    out = ['    ' + AWAL]
    for k, j in L.JENIS.items():
        rows = [r for r in data['peta'] if r['jenis'] == k]
        if not rows:
            continue
        for status, keadaan, berkas, cat in baris_jenis(k, rows):
            kunci = kunci_baris(j['kunci_cermin'], status, keadaan)
            d = {'jenisAsli': j['nama']}
            if status:
                d['statusAsli'] = status
            d['blangko'] = j['nama_menu_putusan']
            d['blangkoLain'] = [j['alias_putusan']]
            if cat:
                d['catatan'] = cat
            dts = '{ ' + ', '.join('%s: %s' % (kk, json.dumps(v, ensure_ascii=False)) for kk, v in d.items()) + ' }'
            out.append('    { kunci: %s, nilai: %s, data: %s, urutan: %d },' % (json.dumps(kunci, ensure_ascii=False), json.dumps(berkas, ensure_ascii=False), dts, nxt))
            nxt += 1
    out.append('    ' + AKHIR)
    return '\n'.join(out) + '\n', nxt


def suntik_cermin(data):
    s = open(CERMIN, encoding='utf-8').read()
    blok, nxt = entri_ts(data)
    a = s.index('"putusan.peta-blangko": [')
    b = s.index('  "putusan.padanan-jenis": [')
    segmen = s[a:b]
    if AWAL in segmen:
        i1 = s.index('    ' + AWAL, a)
        i2 = s.index(AKHIR, i1) + len(AKHIR) + 1
        s = s[:i1] + blok + s[i2:]
    else:
        # sebelum '  ],' penutup array peta-blangko (tepat sebelum padanan-jenis)
        penutup = s.rindex('  ],\n', a, b)
        s = s[:penutup] + blok + s[penutup:]
    # padanan-jenis
    a2 = s.index('  "putusan.padanan-jenis": [')
    b2 = s.index('  ],', a2)
    seg2 = s[a2:b2]
    if AWAL in seg2:
        j1 = s.index('    ' + AWAL, a2)
        j2 = s.index(AKHIR, j1) + len(AKHIR) + 1
        s = s[:j1] + '@@PAD@@' + s[j2:]
        base = [int(x) for x in re.findall(r'urutan: (\d+)', s[a2:b2])]
        s = s.replace('@@PAD@@', '')
        u = max(base) + 1 if base else 0
    else:
        u = max(int(x) for x in re.findall(r'urutan: (\d+)', seg2)) + 1
    pad = ['    ' + AWAL]
    for k, j in L.JENIS.items():
        for nilai in j['padanan_sipp']:
            pad.append('    { kunci: %s, nilai: %s, urutan: %d },' % (json.dumps(j['kunci_cermin']), json.dumps(nilai), u))
            u += 1
    pad.append('    ' + AKHIR)
    padteks = '\n'.join(pad) + '\n'
    a2 = s.index('  "putusan.padanan-jenis": [')
    b2 = s.index('  ],', a2)
    if AWAL in s[a2:b2]:
        i1 = s.index('    ' + AWAL, a2)
        i2 = s.index(AKHIR, i1) + len(AKHIR) + 1
        s = s[:i1] + padteks + s[i2:]
    else:
        s = s[:b2] + padteks + s[b2:]
    open(CERMIN, 'w', encoding='utf-8', newline='').write(s)


# --------------------------------------------------------------------------------------------------------------------
# ALUR BAS (alur-bas-baru-data.ts)
# --------------------------------------------------------------------------------------------------------------------
KODE_PERMOHONAN = {'[1]': '1', '[1a]': '1a', '[1b]': '1b', '[1c]': '1c', '[2]': '2', '[2a]': '2a', '[2b]': '2b', '[3]': '3', '[C]': 'C', '[G]': 'G', '[N]': 'N', '[T]': 'T'}
URUT_PERMOHONAN = ['1', '1a', '1b', '1c', '2', '2a', '2b', '3', 'NO', 'C', 'G', 'T', 'N']


def entri_alur(j):
    folder = os.path.join(L.OUT, j['folder_bas'])
    berkas = sorted(os.listdir(L.lp(folder)))
    awalan = j['awalan_bas'] + ' - '
    langkah = []
    if j['tipe'] == 'permohonan':
        for b in berkas:
            if not b.startswith(awalan):
                continue
            m = re.match(r'^(\[\w+\])\s+(.*)\.rtf$', b[len(awalan):])
            if not m:
                continue
            kode = KODE_PERMOHONAN.get(m.group(1))
            if not kode:
                continue
            langkah.append((kode, b, m.group(2)))
        langkah.sort(key=lambda x: URUT_PERMOHONAN.index(x[0]) if x[0] in URUT_PERMOHONAN else 99)
        nama = j['alur_nama'] + ' (permohonan)'
    else:
        peta_kode = {l[1]: l[0] for l in L.KHUSUS_GUGATAN}
        urut = ['V1', 'V2', 'V2S', 'AP', 'GD', 'N', 'T', 'CS', 'CM']
        for kode, akhir in L.KHUSUS_GUGATAN:
            b = '%s - %s.rtf' % (j['awalan_bas'], akhir)
            if b in berkas:
                ket = {'CS': 'Cabut sesudah jawaban - Tergugat setuju', 'CM': 'Cabut sesudah jawaban - Tergugat menolak (dilanjutkan)'}.get(kode, akhir)
                langkah.append((kode, b, ket))
        langkah.sort(key=lambda x: urut.index(x[0]))
        nama = j['alur_nama'] + ' - Verstek, Perdamaian, Cabut, P Tidak Hadir, NO'
    if not langkah:
        raise SystemExit('tidak ada BAS khusus untuk %s' % j['kunci'])
    teks = ['  {', '    "id": "alur-%d",' % j['alur'], '    "nomor": %d,' % j['alur'], '    "nama": %s,' % json.dumps(nama, ensure_ascii=False),
            '    "folder": "derry_briantono/%s",' % j['folder_bas'], '    "menu": {', '      "id": %d,' % j['menu_bas'],
            '      "nama": %s,' % json.dumps(j['nama_menu_bas']), '      "alias": %s' % json.dumps(j['alias_bas']), '    },',
            '    "jenisMin": %d,' % j['sipp'], '    "jenisMaks": %d,' % j['sipp'], '    "langkah": [']
    isi = []
    for kode, b, ket in langkah:
        isi.append('      {\n        "kode": %s,\n        "berkas": %s,\n        "keterangan": %s\n      }' % (json.dumps(kode), json.dumps(b, ensure_ascii=False), json.dumps(ket, ensure_ascii=False)))
    teks.append(',\n'.join(isi))
    teks += ['    ]', '  }']
    return '\n'.join(teks), len(langkah)


def suntik_alur():
    s = open(ALUR, encoding='utf-8').read()
    awal, akhir = '  ' + AWAL + '\n', '  ' + AKHIR + '\n'
    blok = awal
    ent = []
    jumlah = {}
    for k, j in L.JENIS.items():
        if not os.path.isdir(L.lp(os.path.join(L.OUT, j['folder_bas']))):
            continue
        t, n = entri_alur(j)
        ent.append(t)
        jumlah[k] = n
    blok += ',\n'.join(ent) + '\n' + akhir
    if awal in s:
        a = s.index(awal)
        b = s.index(akhir, a) + len(akhir)
        # tutup array sebelum blok: pastikan koma sebelum blok ada
        s = s[:a] + blok + s[b:]
    else:
        # sisip sebelum penutup array "];\n/* === AKHIR G3 === */"
        pen = '\n];\n/* === AKHIR G3 === */'
        assert pen in s
        i = s.index(pen)
        sebelum = s[:i].rstrip()
        assert sebelum.endswith('}')
        s = sebelum + ',\n' + blok.rstrip('\n') + s[i:]
    open(ALUR, 'w', encoding='utf-8', newline='').write(s)
    return jumlah


# --------------------------------------------------------------------------------------------------------------------
# susun.ts RAMAH + isian-metadata.ts (ISIAN_MANUAL, ISIAN_OPSIONAL)
# --------------------------------------------------------------------------------------------------------------------
SUSUN = os.path.join(REPO, 'manajemen_surat', 'src', 'app', 'api', 'aleta-ecourt', 'blangko-derry', 'susun.ts')
META = os.path.join(REPO, 'manajemen_surat', 'src', 'app', 'api', 'aleta-ecourt', 'blangko-derry', 'isian-metadata.ts')


def ts_str(t):
    return json.dumps(t, ensure_ascii=False)


def suntik_susun(data):
    baris = ['  ' + AWAL]
    for kode in sorted(data.get('ramah', {}), key=int):
        r = data['ramah'][kode]
        bagian = ['nm: ' + ts_str(r['nm'])]
        if r.get('pil'):
            bagian.append('pil: [' + ', '.join(ts_str(x) for x in r['pil']) + ']')
        if r.get('saran'):
            bagian.append('saran: ' + ts_str(r['saran']))
        baris.append('  %s: { %s },' % (ts_str(kode), ', '.join(bagian)))
    baris.append('  ' + AKHIR)
    blok = '\n'.join(baris) + '\n'
    s = open(SUSUN, encoding='utf-8').read()
    if AWAL in s:
        a = s.index('  ' + AWAL)
        b = s.index(AKHIR, a) + len(AKHIR) + 1
        s = s[:a] + blok + s[b:]
    else:
        pen = '  /* === AKHIR U2 === */\n'
        assert pen in s
        i = s.index(pen) + len(pen)
        s = s[:i] + blok + s[i:]
    open(SUSUN, 'w', encoding='utf-8', newline='').write(s)
    return len(data.get('ramah', {}))


def suntik_meta(data):
    s = open(META, encoding='utf-8').read()
    manual = ['  ' + AWAL]
    opsional = ['  ' + AWAL]
    for kode in sorted(data.get('isian', {}), key=int):
        jenis, teks = data['isian'][kode]
        (manual if jenis == 'manual' else opsional).append('  %s: %s,' % (ts_str(kode), ts_str(teks)))
    manual.append('  ' + AKHIR)
    opsional.append('  ' + AKHIR)
    for nama, blok in (('ISIAN_MANUAL', manual), ('ISIAN_OPSIONAL', opsional)):
        awal_obj = 'export const %s: Record<string, string> = {\n' % nama
        a = s.index(awal_obj)
        akhir_obj = s.index('\n};', a)
        seg = s[a:akhir_obj + 4]
        if AWAL in seg:
            i1 = s.index('  ' + AWAL, a)
            i2 = s.index(AKHIR, i1) + len(AKHIR) + 1
            s = s[:i1] + '\n'.join(blok) + '\n' + s[i2:]
        else:
            s = s[:akhir_obj + 1] + '\n'.join(blok) + '\n' + s[akhir_obj + 1:]
    open(META, 'w', encoding='utf-8', newline='').write(s)
    return len(data.get('isian', {}))


def main():
    data = json.load(open(L.lp(os.path.join(L.AKAR, 'peta-w3a.json')), encoding='utf-8'))
    n = suntik_panel(data)
    suntik_cermin(data)
    jumlah = suntik_alur()
    nr = suntik_susun(data)
    nm = suntik_meta(data)
    print('peta: %d baris panel-alat.js/cermin TS; ALUR BAS: %s; RAMAH %d; isian-metadata %d' % (n, jumlah, nr, nm))


if __name__ == '__main__':
    main()
