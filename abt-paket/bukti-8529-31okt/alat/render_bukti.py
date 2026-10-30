# -*- coding: utf-8 -*-
"""Render php56 ABT ASLI sebelum (pulih) / sesudah (pasang) paket abt-bukti-8529-31okt atas perkara nyata, di salinan rantai
aps_badilag_g1r (renderer D:/Aplikasi/aleta/tmp/g1abt; berkas konfigurasi basis diarahkan ke g1r selama render lalu dikembalikan).
pakai: python render_bukti.py <tugas.tsv: perkara_id TAB blangko relatif derry_briantono TAB label> <keluar.json>"""
import json, os, re, subprocess, sys
SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(SINI, '..', '..', 'murtad-8529-30okt', 'alat'))
import render_murtad as R  # noqa: E402

R.DB = 'aps_badilag_g1r'
R.PAKET = os.path.join(SINI, '..', 'paket-satker')
KONF = os.path.join(R.ABT, 'application', 'config', 'database.php')


def ringkas(raw):
    t = R.rtf_ke_teks(raw.decode('latin1'))
    return {'bukti_baru': t.count('[BUKTI SURAT KTP/SURAT DOMISILI BELUM ADA DI DAFTAR BUKTI]'),
            'huruf_belum_dipilih': t.count('[HURUF ALASAN PERCERAIAN BELUM DIPILIH]'),
            'penanda_sisa': sorted(set(re.findall(r'#(\d{4,5})#', t)))}


def main():
    asli = open(KONF, encoding='utf-8').read()
    open(KONF, 'w', encoding='utf-8').write(asli.replace("'database' => 'aps_badilag_g1',", "'database' => 'aps_badilag_g1r',"))
    hasil = []
    try:
        for l in open(sys.argv[1], encoding='utf-8'):
            if not l.strip() or l.startswith('#'):
                continue
            pid, rel, label = l.rstrip('\n').split('\t')[:3]
            raw = open(os.path.join(R.POHON, rel), 'rb').read()
            rec = dict(perkara_id=pid, blangko=rel, label=label,
                       bukti_surat_terisi=R.q("SELECT COUNT(*) FROM abt_data_teks WHERE no_var=1214 AND perkara_id=%d AND TRIM(IFNULL(data,'')) <> ''" % int(pid)))
            for tahap, skrip in (('sebelum', 'pulih-satker.sh'), ('sesudah', 'pasang-satker.sh')):
                rec['paket_' + tahap] = R.paket(skrip)
                rec[tahap] = ringkas(R.render(raw, pid))
            hasil.append(rec)
            print(json.dumps(rec, ensure_ascii=False), flush=True)
    finally:
        open(KONF, 'w', encoding='utf-8').write(asli)
    json.dump({'keterangan': 'render php56 ABT asli di salinan rantai aps_badilag_g1r, sebelum (pulih) dan sesudah (pasang) paket abt-bukti-8529-31okt', 'hasil': hasil},
              open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
