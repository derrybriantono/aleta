# -*- coding: utf-8 -*-
"""Golongkan hasil pindai_mesin.js per variabel. Keluaran: ringkasan (tanpa nama pihak: contoh dipotong & nama diganti) ke keluar.txt
dan rincian lengkap ke keluar.json (rincian memuat data perkara -> TIDAK masuk repo).
Golongan:
  galat_sql   status galat bukan waktu habis (atas perkara jenis apa pun)
  lambat      kueri > 5 dtk (dari catatan pindai) atau waktu habis
  penanda     sisa #nnnn# atau [...] di keluaran
  bunyi       TIDAK BENAR / ERROR / QUERY / undefined / NULL / Array / NaN / DATA_TIDAK_ADA tercetak
  angka       Rp dengan bilangan < 1.000 (bukan 0) -> kemungkinan angka terpotong
  tanggal     tanggal mentah (yyyy-mm-dd), tahun 0000/-0001/1970/1900, hari 00, tanggal ganda berurutan
  sebutan     sebutan pihak yang tidak sesuai jenis perkara (Penggugat/Tergugat di permohonan & cerai talak, Pemohon/Termohon di cerai gugat)
  baca        kata ganda berurutan, tanda baca rusak (", ,", " ,", ",,", "..", " .", ";;", "()"), kalimat kosong
Golongan selain galat_sql/lambat hanya dihitung bila folder blangko pemakai variabel cocok dengan jenis perkara (FOLDER) atau folder umum.
pakai: python analisa.py <pakai.json> <dir pindai> <keluar-awalan>"""
import collections, glob, json, os, re, sys

FOLDER = [  # awalan folder -> awalan nama jenis perkara SIPP (None = umum, semua jenis)
    (r'^1 Perceraian CG|^1c |^1d |^1e |^1f |^- BAS (CONTRA|VERSTEK) PERCERAIAN', ('Cerai Gugat', 'Cerai Talak')),
    (r'^1a Perceraian CT', ('Cerai Talak',)),
    (r'^2 Itsbat|^2a Itsbat', ('Pengesahan Perkawinan',)),
    (r'^3 Dispensasi', ('Dispensasi Kawin',)), (r'^3a Izin', ('Izin Kawin',)),
    (r'^4a Harta', ('Harta Bersama',)), (r'^4b Kewarisan', ('Kewarisan',)), (r'^4c Wasiat', ('Wasiat',)),
    (r'^4d Hibah', ('Hibah',)), (r'^4e Wakaf', ('Wakaf',)),
    (r'^5 Izin Poligami', ('Izin Poligami',)), (r'^5a ', ('Pembatalan Perkawinan',)), (r'^5b ', ('Pencegahan',)),
    (r'^5c ', ('Penolakan',)), (r'^5d ', ('Perkawinan Campuran',)),
    (r'^6 Perwalian', ('Perwalian',)), (r'^6[a-h] ', ('Lain-Lain', 'Hak Asuh', 'Penguasaan Anak', 'Nafkah Anak', 'Pencabutan', 'Penunjukan', 'Ganti Rugi')),
    (r'^7 Wali', ('Wali Adhol',)), (r'^8 Asal|^- BAS ASAL', ('Asal Usul Anak',)), (r'^8a ', ('Pengesahan Anak', 'Lain-Lain')),
    (r'^9 Penetapan Ahli Waris', ('P3HP',)), (r'^9a ', ('Lain-Lain', 'Pengangkatan Anak')), (r'^9c ', ('Lain-Lain', 'Mafqud')),
    (r'^10 Ekonomi|^10a Ekonomi', ('Ekonomi Syariah',)),
]


def cocok(folder, jenis):
    for f in folder:
        dikenal = False
        for pola, js in FOLDER:
            if re.match(pola, f):
                dikenal = True
                if any(jenis.startswith(j) for j in js):
                    return True
        if not dikenal:   # folder umum (relaas, PTSP, sita, eksekusi, verzet, berkas perkara, sela, permohonan umum, ALUR)
            return True
    return False


LAMBAT = re.compile(r'timeout|inactivity|ETIMEDOUT|ECONNRESET|PROTOCOL_CONNECTION_LOST|Query execution was interrupted', re.I)
BUNYI = re.compile(r'TIDAK BENAR|\bERROR\b|\bQUERY\b|undefined|\bNULL\b|\bnull\b|\bArray\b|\bNaN\b|DATA_TIDAK_ADA|TIDAK_BISA_LOAD|Unknown column|syntax', )
PENANDA = re.compile(r'#\d{3,5}#|\[\s*(\.{2,}|…)\s*\]')
RP = re.compile(r'Rp\.?\s?(\d{1,3}(?:\.\d{3})*)(,\d{1,2})?(?![\d.])')
TGL = re.compile(r'\b\d{4}-\d{2}-\d{2}\b|\b(0000|-0001|1970|1900)\b|\b00 (Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\b')
BULAN = r'(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)'
TGL_GANDA = re.compile(r'(\d{1,2} ' + BULAN + r' \d{4})\W+\1\b')
GANDA = re.compile(r'\b([A-Za-z]{3,})\s+\1\b', re.I)
BACA = re.compile(r',\s*,|(?<=[a-z]{2})\.\.(?!\.)|;\s*;|\(\s*\)|:\s*[.;,]|(?<=[a-z]{2}),\s*\.|(?<=[a-z]{2})\.\s*,(?!\d)|;\s*\.|\.\s*;')
GANDA_BOLEH = {'bin', 'binti', 'atau', 'dan'}   # "dan dan" tetap dicek di bawah
PIHAK_GUGAT = re.compile(r'\b(Penggugat|Tergugat)\b')
PIHAK_MOHON = re.compile(r'\b(Pemohon|Termohon)\b')


def golongkan(no, v, jenis, alur, info, lambat_var):
    st, polos, sebab = v
    out = []
    if st == 'galat':
        out.append(('lambat' if LAMBAT.search(sebab) else 'galat_sql', sebab))
    if no in lambat_var:
        out.append(('lambat', '%d ms' % lambat_var[no]))
    if st != 'terisi' or not polos.strip():
        return out
    if not cocok(info.get('folder', []), jenis):
        return out
    t = re.sub(r'\s+', ' ', polos)
    if PENANDA.search(t):
        out.append(('penanda', PENANDA.search(t).group(0)))
    if BUNYI.search(t):
        out.append(('bunyi', t[max(0, BUNYI.search(t).start() - 60):BUNYI.search(t).end() + 60]))
    for m in RP.finditer(t):
        bil = int(m.group(1).replace('.', ''))
        if 0 < bil < 1000:
            out.append(('angka', t[max(0, m.start() - 40):m.end() + 20]))
            break
    m = TGL.search(t) or TGL_GANDA.search(t)
    if m:
        out.append(('tanggal', t[max(0, m.start() - 40):m.end() + 20]))
    if alur == '16' or jenis.startswith('Cerai Talak'):
        m = PIHAK_GUGAT.search(t)
        if m and 'Rekonvensi' not in t and 'Gugatan' not in t[:0]:
            out.append(('sebutan', t[max(0, m.start() - 60):m.end() + 30]))
    if jenis.startswith('Cerai Gugat'):
        m = PIHAK_MOHON.search(t)
        if m:
            out.append(('sebutan', t[max(0, m.start() - 60):m.end() + 30]))
    for m in GANDA.finditer(t):
        if m.group(1).lower() not in GANDA_BOLEH or m.group(1).lower() == 'dan':
            out.append(('baca', 'kata ganda: ' + t[max(0, m.start() - 40):m.end() + 30]))
            break
    t2 = re.sub(r'\.{3,}|…', ' … ', t)   # titik-titik ABT = isian kosong, bukan tanda baca
    m = BACA.search(t2)
    if m:
        out.append(('baca', t2[max(0, m.start() - 50):m.end() + 30]))
    return out


def main():
    pakai = json.load(open(sys.argv[1], encoding='utf-8'))
    berkas = sorted(glob.glob(os.path.join(sys.argv[2], 'p*.json')))
    kel = sys.argv[3]
    # SQL katalog untuk menisbatkan kueri lambat (awal teks kueri sebelum penanda pertama)
    kepala = {}
    for k, v in pakai.items():
        s = re.sub(r'\s+', ' ', v.get('sql', '') or '').strip()
        s = re.split(r'#\d+#|#perkara_id#', s)[0].replace('aps_badilag.', '')
        if len(s) >= 40:
            kepala[k] = s[:120]
    temuan = collections.defaultdict(lambda: collections.defaultdict(list))
    detik = []
    for f in berkas:
        d = json.load(open(f, encoding='utf-8'))
        detik.append(d['detik'])
        lv = {}
        for ms, sql in d.get('lambat', []):
            q = re.sub(r'aps_badilag_\w+\.', '', sql)
            for k, h in kepala.items():
                if q.startswith(h[:len(q)] if len(q) < len(h) else h):
                    lv[k] = max(lv.get(k, 0), ms)
        for no, v in d['nilai'].items():
            for gol, contoh in golongkan(no, v, d['jenis'], str(d['alur']), pakai.get(no, {}), lv):
                temuan[no][gol].append([d['perkara'], d['jenis'], d['gol'], contoh[:300]])
    ring = collections.Counter()
    baris = []
    for no in sorted(temuan, key=int):
        info = pakai.get(no, {})
        for gol, xs in temuan[no].items():
            ring[gol] += 1
            baris.append(dict(no=no, gol=gol, n=len(set(x[0] for x in xs)), pemilik=info.get('pemilik'), jenis=info.get('jenis'),
                              nama=info.get('nama', '')[:80], blangko=info.get('blangko'), contoh=xs[:6]))
    json.dump(dict(perkara=len(berkas), variabel=len(pakai), detik=detik, temuan=baris), open(kel + '.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    out = ['perkara dipindai %d, variabel %d, detik rata-rata %.0f' % (len(berkas), len(pakai), sum(detik) / max(1, len(detik))),
           'variabel bertemuan per golongan: ' + ', '.join('%s %d' % kv for kv in ring.most_common())]
    for b in sorted(baris, key=lambda b: (b['gol'], -b['n'])):
        out.append('%s | %s | %s | %s | %d perkara | %s blangko | %s | contoh %s %s: %s' % (
            b['gol'], b['no'], b['pemilik'], b['jenis'], b['n'], b['blangko'], b['nama'][:50], b['contoh'][0][0], b['contoh'][0][1], b['contoh'][0][3][:160]))
    open(kel + '.txt', 'w', encoding='utf-8').write('\n'.join(out) + '\n')
    print('\n'.join(out[:2]))


if __name__ == '__main__':
    main()
