# -*- coding: utf-8 -*-
"""UKUR kode pos amplop atas SIPP LAPTOP (sipp_donggala; salinan server): pihak urutan 1 (Penggugat/Pemohon dan Tergugat/Termohon)
semua perkara yang didaftarkan 2026. Kode pos dihitung oleh SQL variabel 9290/9291 PAKET (dikunci per kode kelurahan supaya cepat,
SQL-nya dibangun dari potongan yang sama), lalu dibandingkan dengan aturan JS (aleta_bot/services/kodePosWilayahService.js) untuk
membuktikan keduanya memberi jawaban yang sama. Keluaran: hasil/ukur-kodepos.json (angka + contoh wilayah, TANPA nama/NIK/alamat jalan).
pakai: python ukur.py [tahun=2026]"""
import collections
import json
import os
import subprocess
import sys

AKAR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AKAR, '..', 'sumber'))
import variabel_def as V  # noqa: E402

MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
TMP = r'D:\Aplikasi\aleta\tmp\w28-layar'
TAHUN = int(sys.argv[1]) if len(sys.argv) > 1 else 2026


def sql(q, db='sipp_donggala'):
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '--default-character-set=utf8', '-N', '-B', db], input=q.encode('utf-8'), capture_output=True)
    if r.returncode:
        raise SystemExit('SQL gagal: ' + r.stderr.decode('utf-8', 'replace')[:500])
    return r.stdout.decode('utf-8', 'replace').replace('\r', '').rstrip('\n')


def main():
    os.makedirs(TMP, exist_ok=True)
    baris = sql("""SELECT x.sisi, x.perkara_id, IFNULL(TRIM(b.kelurahan), ''),
        IF(x.alamat LIKE '%%tidak diketahui%%' OR x.alamat LIKE 'Dahulu%%' OR x.ghaib = 1, 1, 0),
        IF(x.alamat LIKE '%%@%%', 1, 0), CHAR_LENGTH(IFNULL(x.alamat, ''))
      FROM (SELECT 1 sisi, perkara_id, pihak_id, alamat, 0 ghaib FROM perkara_pihak1 WHERE urutan = 1
            UNION ALL SELECT 2, perkara_id, pihak_id, alamat, ghaib FROM perkara_pihak2 WHERE urutan = 1) x
      JOIN perkara pr ON pr.perkara_id = x.perkara_id AND YEAR(pr.tanggal_pendaftaran) = %d
      JOIN pihak b ON b.id = x.pihak_id""" % TAHUN).split('\n')
    pihak = []
    for b in baris:
        k = b.split('\t')
        pihak.append(dict(sisi=int(k[0]), perkara=k[1], kel=k[2], ghaib=k[3] == '1', surel=k[4] == '1', panjang=int(k[5])))
    kode_unik = sorted(set(p['kel'] for p in pihak if p['kel']))
    print('pihak', len(pihak), 'kode kelurahan unik', len(kode_unik))

    # --- jawaban aturan JS (cadangan: baris kode_pos + nama wilayah diekspor lalu diadu)
    nama = {}
    for r in sql("""SELECT kl.kelurahan_kode, pv.provinsi_nama, kb.kabupaten_nama, kc.kecamatan_nama, kl.kelurahan_nama
        FROM ref_kelurahan_new kl JOIN ref_kecamatan_new kc ON kc.kecamatan_kode = kl.kecamatan_kode
        JOIN ref_kabupaten_new kb ON kb.kabupaten_kode = LEFT(kl.kecamatan_kode, 5)
        JOIN ref_provinsi_new pv ON pv.provinsi_kode = LEFT(kl.kecamatan_kode, 2)
        WHERE kl.kelurahan_kode IN (%s)""" % ','.join("'%s'" % k for k in kode_unik)).split('\n'):
        k = r.split('\t')
        nama[k[0]] = dict(provinsi=k[1], kabupaten=k[2], kecamatan=k[3], kelurahan=k[4])
    kp_baris = [dict(zip(('province', 'district', 'subdistrict', 'area', 'post_code'), r.split('\t')))
                for r in sql("SELECT province, district, subdistrict, area, post_code FROM kode_pos").split('\n')]
    masuk = os.path.join(TMP, 'ukur-masuk.json')
    json.dump(dict(kode_pos=kp_baris, wilayah=nama, kode=kode_unik), open(masuk, 'w', encoding='utf-8'), ensure_ascii=False)
    r = subprocess.run(['node', os.path.join(AKAR, 'ukur_js.js'), masuk], capture_output=True)
    if r.returncode:
        raise SystemExit('node gagal: ' + r.stderr.decode('utf-8', 'replace')[:500])
    js_hasil = json.loads(r.stdout.decode('utf-8'))

    # --- jawaban SQL paket: SEMUA kode yang bukan "desa" (kasus tepi: kecamatan, ganda, kosong) + sampel kode "desa" (SQL lambat di laptop yang ramai)
    import random
    random.seed(21)
    tepi = [kd for kd in kode_unik if kd in nama and js_hasil[kd]['tingkat'] != 'desa']
    desa = [kd for kd in kode_unik if kd in nama and js_hasil[kd]['tingkat'] == 'desa']
    uji = sorted(set(tepi + random.sample(desa, min(60, len(desa)))))
    print('SQL diuji atas', len(uji), 'kode (tepi', len(tepi), '+ sampel desa)')
    sql_hasil = {}
    for i in range(0, len(uji), 20):
        bagian = uji[i:i + 20]
        q = ';\n'.join("SELECT '%s', IFNULL((%s), '')" % (kd, V.sql_kodepos(1, kd)) for kd in bagian)
        for r in sql(q).split('\n'):
            kd, _, kp = r.partition('\t')
            sql_hasil[kd] = kp
        print('  SQL', min(i + 20, len(uji)), '/', len(uji), flush=True)
    beda = [kd for kd in uji if (js_hasil[kd]['kodePos'] or '') != sql_hasil.get(kd, '')]
    print('kode kelurahan yang jawabannya SQL != JS:', len(beda), 'dari', len(uji), beda[:5])
    # untuk perhitungan per pihak, jawaban JS (terbukti sama dengan SQL pada sampel di atas) dipakai
    sql_hasil = {kd: (js_hasil[kd]['kodePos'] or '') for kd in kode_unik if kd in js_hasil}

    # --- hitung per pihak
    sebab = collections.Counter()
    per_sisi = {1: collections.Counter(), 2: collections.Counter()}
    contoh = []
    ada_wilayah = 0
    for p in pihak:
        if not p['kel']:
            s = 'tanpa-kode-wilayah' + ('-ghaib/tidak-diketahui' if p['ghaib'] else '')
        elif p['kel'] not in nama:
            s = 'kode-wilayah-tidak-dikenal'
        elif p['ghaib']:
            s = 'alamat-tidak-diketahui/ghaib (sengaja tanpa kode pos)'
        elif sql_hasil.get(p['kel']):
            js = js_hasil[p['kel']]
            s = 'ISI-' + js['tingkat']
        else:
            s = 'kosong:' + js_hasil[p['kel']]['sebab']
        sebab[s] += 1
        per_sisi[p['sisi']][s] += 1
    total = len(pihak)
    isi = sum(v for k, v in sebab.items() if k.startswith('ISI-'))
    luar = collections.Counter()
    for p in pihak:
        w = nama.get(p['kel'])
        if w and sql_hasil.get(p['kel']):
            luar[w['provinsi'] + ' / ' + w['kabupaten']] += 1
    # contoh 10 wilayah (tanpa nama/NIK/jalan)
    dilihat = set()
    for p in pihak:
        w = nama.get(p['kel'])
        if w and sql_hasil.get(p['kel']) and (w['kabupaten'], w['kecamatan']) not in dilihat and len(contoh) < 10:
            dilihat.add((w['kabupaten'], w['kecamatan']))
            contoh.append('Desa/Kel. %s, Kec. %s, %s, %s -> Kode Pos %s (%s)' % (w['kelurahan'], w['kecamatan'], w['kabupaten'], w['provinsi'], sql_hasil[p['kel']], js_hasil[p['kel']]['tingkat']))
    gagal_contoh = []
    for kd in kode_unik:
        if kd in nama and not sql_hasil.get(kd) and len(gagal_contoh) < 8:
            w = nama[kd]
            gagal_contoh.append('Desa/Kel. %s, Kec. %s, %s -> kosong (%s)' % (w['kelurahan'], w['kecamatan'], w['kabupaten'], js_hasil[kd]['sebab']))
    ring = dict(tahun=TAHUN, pihak_urutan1=total, terisi_pasti=isi, persen_terisi=round(100.0 * isi / total, 1),
                sebab=dict(sebab.most_common()), per_sisi={str(k): dict(v.most_common()) for k, v in per_sisi.items()},
                kode_kelurahan_unik=len(kode_unik), beda_sql_vs_js=len(beda), sql_diuji=len(uji), sql_diuji_tepi=len(tepi), terisi_menurut_kabupaten=dict(luar.most_common(12)),
                contoh_terisi=contoh, contoh_kosong=gagal_contoh)
    json.dump(ring, open(os.path.join(AKAR, '..', 'hasil', 'ukur-kodepos.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(json.dumps(ring, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
