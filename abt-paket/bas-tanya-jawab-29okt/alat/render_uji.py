# -*- coding: utf-8 -*-
"""Render blangko SEBELUM/SESUDAH paket dengan renderer php56 ABT asli atas perkara nyata (baca saja), lalu bandingkan.

Salinan renderer milik sendiri: D:/Aplikasi/aleta/tmp/bas29/abt (application/system dari salinan ABT laptop; basis
SIPP sipp_2810 dan ABT aps_badilag_bas29 = salinan dump server 28 Okt 15.44, nama skema di kueri/fungsi diarahkan ke salinan).
pakai: python render_uji.py <tugas.tsv> <keluar.json>
  tugas.tsv: perkara_id <TAB> jalur relatif blangko <TAB> label [<TAB> urutan sidang pemeriksaan saksi, untuk BAS]
  pohon SEBELUM = D:/Aplikasi/aleta/tmp/bas29/dasar3/derry_briantono, SESUDAH = D:/Aplikasi/aleta/tmp/bas29/baru3/rtf
Hasil teks lengkap ke D:/Aplikasi/aleta/tmp/bas29/render/ (memuat data perkara - TIDAK masuk repo); ringkasan (tanpa nama) ke keluar.json.
"""
import json, os, re, subprocess, sys

ABT = r'D:\Aplikasi\aleta\tmp\bas29\abt'
PHP = r'D:\sipp-server\php56\php.exe'
TMP = r'D:\Aplikasi\aleta\tmp'
OUT = r'D:\Aplikasi\aleta\tmp\bas29\render'
SEBELUM = r'D:\Aplikasi\aleta\tmp\bas29\dasar3\derry_briantono'
SESUDAH = r'D:\Aplikasi\aleta\tmp\bas29\baru3\rtf'
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sumber'))
from rtf2txt import rtf_ke_teks  # noqa: E402


def panjang(p):
    p = os.path.abspath(p)
    a = chr(92) * 2 + '?' + chr(92)
    return p if p.startswith(a) else a + p


def render(raw, pid, sidang=''):
    sem = os.path.join(ABT, '_blangko_abt', '_uji_bas29.rtf')
    open(sem, 'wb').write(raw)
    out = os.path.join(OUT, '_keluar_%s.rtf' % pid)
    tugas = os.path.join(OUT, '_tugas.json')
    json.dump({'perkara_id': int(pid), 'rtf': '_blangko_abt/_uji_bas29.rtf', 'keluar': out, 'sidang': sidang}, open(tugas, 'w'))
    env = dict(os.environ, TMP=TMP, TEMP=TMP, UJI_T_TUGAS=tugas)
    if os.path.exists(out):
        os.remove(out)
    r = subprocess.run([PHP, '-d', 'memory_limit=1024M', 'index.php', 'uji_t', 'render'], cwd=ABT, env=env,
                       capture_output=True, timeout=900)
    if not os.path.exists(out):
        raise RuntimeError('render gagal: ' + r.stdout.decode('cp1252', 'replace')[-400:] + r.stderr.decode('cp1252', 'replace')[-400:])
    b = open(out, 'rb').read()
    os.remove(out)
    return b


def baris(raw):
    t = rtf_ke_teks(raw.decode('latin1'))
    return [re.sub(r'\s+', ' ', x).strip() for x in t.split('\n') if x.strip()]


def bagian_saksi(bs):
    """Baris dari identitas saksi pertama sampai sebelum kalimat penutup pembuktian."""
    a = next((i for i, x in enumerate(bs) if re.search(r'umur \d+ tahun|umur .{0,6} tahun', x) and ('saksi' in ' '.join(bs[max(0, i - 3):i + 1]).lower())), None)
    if a is None:
        return []
    z = next((i for i in range(a + 1, len(bs)) if re.search(r'(tidak akan mengajukan sesuatu|telah cukup dengan alat-alat bukti|cukup dengan alat bukti|mencukupkan bukti|mohon (pen)?(etapan|keputusan|putusan)|PERTIMBANGAN HUKUM|Menimbang)', bs[i])), len(bs))
    return bs[a:z]


def main():
    tugas = [l.rstrip('\n').split('\t') for l in open(sys.argv[1], encoding='utf-8') if l.strip() and not l.startswith('#')]
    os.makedirs(OUT, exist_ok=True)
    hasil = []
    for t in tugas:
        pid, rel, label = t[:3]
        sidang = t[3] if len(t) > 3 else ''   # urutan sidang pemeriksaan saksi (BAS tanya-jawab per sidang, ?d= di ABT)
        rec = dict(perkara_id=pid, blangko=rel, label=label)
        diubah = os.path.exists(panjang(os.path.join(SESUDAH, rel)))
        for tahap, akar in (('sebelum', SEBELUM), ('sesudah', SESUDAH)):
            p = os.path.join(akar, rel)
            if not diubah:
                if tahap == 'sesudah':
                    rec['sesudah'] = dict(rec['sebelum'], catatan='berkas tidak diubah paket - sama dengan sebelum')
                    continue
                p = os.path.join(SEBELUM, rel)   # berkas yang tidak diubah paket (patokan): dirender sekali
            raw = open(panjang(p), 'rb').read()
            try:
                keluar = render(raw, pid, sidang)
            except Exception as e:  # noqa: BLE001
                rec[tahap] = dict(galat=str(e)[:300])
                continue
            bs = baris(keluar)
            nama = '%s_%s_%s.txt' % (pid, re.sub(r'[^A-Za-z0-9]+', '_', rel)[-80:], tahap)
            open(os.path.join(OUT, nama), 'w', encoding='utf-8').write('\n'.join(bs))
            sisa = sorted(set(re.findall(r'#\d{4,5}#', '\n'.join(bs))))
            sk = bagian_saksi(bs)
            ganda = [bs[i][:60] for i in range(1, len(bs)) if bs[i] == bs[i - 1] and len(bs[i]) > 20]
            titik = [x[:60] for x in sk if x.strip(' -;.') == '' or re.search(r'(^|\s)\.\.\.(\s|;|$)', x)]
            rec[tahap] = dict(baris=len(bs), penanda_sisa=sisa, baris_saksi=len(sk), berkas_teks=nama,
                              baris_ganda=len(ganda), contoh_ganda=ganda[:2], titik_saksi=len(titik),
                              jawab_bas=sum(1 for x in sk if x.startswith('- ') and not x.startswith('- Bahwa')),
                              bahwa_saksi=sum(1 for x in sk if x.lstrip('-– ').startswith('Bahwa')),
                              tanya=sum(1 for x in sk if x.rstrip().endswith('?')))
        hasil.append(rec)
        print(pid, label, json.dumps({k: {kk: vv for kk, vv in v.items() if kk != 'berkas_teks'} for k, v in rec.items() if k in ('sebelum', 'sesudah')}, ensure_ascii=False)[:400])
    json.dump(hasil, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
