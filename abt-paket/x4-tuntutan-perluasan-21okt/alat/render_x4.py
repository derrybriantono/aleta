# -*- coding: utf-8 -*-
"""Render blangko Derry SEBELUM dan SESUDAH paket x4 memakai renderer php56 ABT ASLI (Abt_model::variabel_library lewat pengendali uji
Uji_t) atas salinan ABT laptop. Sebelum = RTF salinan server + abt_variabel aps_badilag_x4lama (salinan persis server 21 Okt);
sesudah = RTF hasil tambal paket + aps_badilag_x4 (paket terpasang). SIPP = sipp_x4 (alat/siapkan_sipp_uji.py: salinan perkara
sipp_donggala yang petitum/jenisnya boleh diatur per skenario). Isian uji ditulis ke aps_badilag.abt_data_teks LAPTOP lalu
DIKEMBALIKAN (baris lama dicadangkan dulu). Teks lengkap (memuat data perkara) hanya di D:/Aplikasi/aleta/tmp/w26/render/out;
ringkasan tanpa data pribadi -> hasil/render-ringkasan.json.
pakai: python render_x4.py [kode skenario ...]"""
import json, os, re, subprocess, sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'x3-tuntutan-sinkron-21okt', 'alat'))
import render_x3 as R3  # noqa: E402  (pemeriksa paragraf/nomor amar paket x3)

SALINAN = r'D:\Aplikasi\aleta\tmp\w26\render\abt-salinan'  # aps_badilag_x4render -> aps_badilag_x4 (paket terpasang)
SALINAN_LAMA = r'D:\Aplikasi\aleta\tmp\w26\render\abt-salinan-lama'  # aps_badilag_x4render_lama -> aps_badilag_x4lama (server)
PEKERJA = os.environ.get('PEKERJA', '0')
PHP = r'D:\sipp-server\php56\php.exe'
MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
TMP = r'D:\Aplikasi\aleta\tmp'
RTF_LAMA = r'D:\Aplikasi\aleta\tmp\w26\rtf-server\derry_briantono'
RTF_BARU = r'D:\Aplikasi\aleta\tmp\w26\rtf-hasil\derry_briantono'
KELUAR = r'D:\Aplikasi\aleta\tmp\w26\render\out'
RINGKAS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'hasil', 'render-ringkasan.json')
PJ = '\\\\?\\'
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sumber'))
from skenario_x4 import SKENARIO  # noqa: E402


def sql(q, db='aps_badilag'):
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '--default-character-set=latin1', '-N', db], input=q.encode('latin1'), capture_output=True)
    if r.returncode:
        raise SystemExit('SQL gagal: ' + r.stderr.decode('latin1', 'replace')[:300])
    return r.stdout.decode('latin1')


def esc(s):
    return s.replace('\\', '\\\\').replace("'", "''")


def pakai_lab(db):
    sql("CREATE OR REPLACE VIEW aps_badilag_x4render.abt_variabel AS SELECT * FROM %s.abt_variabel;" % db, 'aps_badilag_x4render')


def atur_perkara(pid, petitum, jenis):
    """Kembalikan perkara uji ke salinan sipp_donggala, lalu terapkan petitum/jenis skenario."""
    sql("UPDATE perkara p JOIN sipp_donggala.perkara s ON s.perkara_id=p.perkara_id SET p.petitum=s.petitum, p.jenis_perkara_id=s.jenis_perkara_id "
        "WHERE p.perkara_id=%d;" % pid, 'sipp_x4')
    if petitum is not None:
        sql("UPDATE perkara SET petitum='%s' WHERE perkara_id=%d;" % (esc(petitum), pid), 'sipp_x4')
    if jenis:
        sql("UPDATE perkara SET jenis_perkara_id=%d WHERE perkara_id=%d;" % (jenis, pid), 'sipp_x4')


def tulis_isian(pid, isian):
    kode = sorted(set(isian) | {'8503'})
    lama = {}
    for baris in sql("SELECT no_var, HEX(data) FROM abt_data_teks WHERE perkara_id=%d AND no_var IN (%s);" % (pid, ','.join(kode))).splitlines():
        if baris.strip():
            k, h = baris.split('\t')
            lama[str(int(k)).zfill(4)] = h
    perintah = ["DELETE FROM abt_data_teks WHERE perkara_id=%d AND no_var IN (%s);" % (pid, ','.join(kode))]
    for k, v in isian.items():
        perintah.append("INSERT INTO abt_data_teks (no_var, perkara_id, data, modifier) VALUES (%s, %d, '%s', 'uji');" % (k, pid, esc(v)))
    if '8503' not in isian:
        perintah.append("INSERT INTO abt_data_teks (no_var, perkara_id, data, modifier) VALUES (8503, %d, 'F', 'uji');" % pid)
    sql('SET FOREIGN_KEY_CHECKS=0;\n' + '\n'.join(perintah))
    return kode, lama


def pulihkan_isian(pid, kode, lama):
    perintah = ["DELETE FROM abt_data_teks WHERE perkara_id=%d AND no_var IN (%s);" % (pid, ','.join(kode))]
    for k, h in lama.items():
        perintah.append("INSERT INTO abt_data_teks (no_var, perkara_id, data, modifier) VALUES (%s, %d, UNHEX('%s'), 'pulih');" % (k, pid, h))
    sql('SET FOREIGN_KEY_CHECKS=0;\n' + '\n'.join(perintah))


def render(rtf_berkas, pid, salinan):
    nm = '_uji_x4_%s_%d.rtf' % (PEKERJA, pid)
    sem = os.path.join(salinan, '_blangko_abt', nm)
    open(sem, 'wb').write(open(PJ + rtf_berkas, 'rb').read())
    out = os.path.join(TMP, 'w26', '_keluar_%s_%d.rtf' % (PEKERJA, pid))
    tugas = os.path.join(TMP, 'w26', '_tugas_%s_%d.json' % (PEKERJA, pid))
    json.dump({'perkara_id': int(pid), 'rtf': '_blangko_abt/' + nm, 'keluar': out, 'sidang': ''}, open(tugas, 'w'))
    env = dict(os.environ, TMP=TMP, TEMP=TMP, UJI_T_TUGAS=tugas)
    r = subprocess.run([PHP, '-d', 'memory_limit=1024M', 'index.php', 'uji_t', 'render'], cwd=salinan, env=env, capture_output=True, timeout=7200)
    st = r.stdout.decode('cp1252', 'replace').strip()
    os.remove(sem)
    if not os.path.exists(out):
        raise SystemExit('render gagal: ' + st[:400] + r.stderr.decode('cp1252', 'replace')[:300])
    data = open(out, 'rb').read().decode('latin1')
    os.remove(out)
    return st, data


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    os.makedirs(KELUAR, exist_ok=True)
    pilih = set(sys.argv[1:])
    ring = {}
    for sk in SKENARIO:
        if pilih and sk['kode'] not in pilih:
            continue
        pid = sk['perkara']
        atur_perkara(pid, sk.get('petitum'), sk.get('jenis'))
        kd, lama = tulis_isian(pid, sk.get('isian', {}))
        hasil = {}
        try:
            for lab, salinan, akar in (('sebelum', SALINAN_LAMA, RTF_LAMA), ('sesudah', SALINAN, RTF_BARU)):
                rtf = os.path.join(akar, sk['rtf'].replace('/', '\\'))
                if not os.path.exists(PJ + rtf):
                    rtf = os.path.join(RTF_LAMA, sk['rtf'].replace('/', '\\'))  # berkas yang tidak ditambal
                st, data = render(rtf, pid, salinan)
                h = R3.periksa(data)
                teks = h.pop('teks')
                open(os.path.join(KELUAR, '%s-%s.txt' % (sk['kode'], lab)), 'w', encoding='utf-8').write(teks)
                h['status'] = st[:70]
                h['harap_ada'] = {k: bool(re.search(p, teks, re.I)) for k, p in sk.get('harap_ada', {}).items()}
                h['harap_tidak'] = {k: bool(re.search(p, teks, re.I)) for k, p in sk.get('harap_tidak', {}).items()}
                h['_teks'] = teks
                hasil[lab] = h
        finally:
            pulihkan_isian(pid, kd, lama)
            atur_perkara(pid, None, None)
        s, b = hasil['sesudah'], hasil['sebelum']
        sama = s.pop('_teks') == b.pop('_teks')
        lolos = (s['nomor_urut'] and s['butir_kosong'] == 0 and not s['penanda_sisa'] and all(s['harap_ada'].values())
                 and not any(s['harap_tidak'].values()) and (sama if sk.get('harus_sama') else True))
        ring[sk['kode']] = dict(label=sk['label'], blangko=sk['rtf'], sebelum=b, sesudah=s, teks_sama_dengan_sebelum=sama, lolos=lolos)
        print('%-34s %s | amar %s %s | kosong %d | sisa %s | PERIKSA %d->%d | sama %s | ada %s | tidak %s' % (
            sk['kode'], 'LOLOS' if lolos else 'GAGAL', s['nomor_amar'], 'urut' if s['nomor_urut'] else 'TIDAK URUT', s['butir_kosong'], s['penanda_sisa'],
            len(b['periksa']), len(s['periksa']), sama, s['harap_ada'], s['harap_tidak']))
    # tiap pekerja menulis ringkasannya sendiri; gabung_render() menyatukan ke hasil/render-ringkasan.json
    json.dump(ring, open(os.path.join(TMP, 'w26', 'render-ringkas-%s.json' % PEKERJA), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


def gabung_render():
    import glob
    semua = {}
    for f in sorted(glob.glob(os.path.join(TMP, 'w26', 'render-ringkas-*.json'))):
        semua.update(json.load(open(f, encoding='utf-8')))
    # nilai ulang dari teks tersimpan (pola skenario terbaru; nomor amar: sub-butir 4.1, 4.2 yang mulai dari 1 di tengah daftar
    # adalah daftar tingkat dua Word, bukan lompatan nomor)
    for sk in SKENARIO:
        r = semua.get(sk['kode'])
        f = os.path.join(KELUAR, '%s-sesudah.txt' % sk['kode'])
        if not r or not os.path.exists(f):
            continue
        teks = open(f, encoding='utf-8').read()
        s = r['sesudah']
        s['harap_ada'] = {k: bool(re.search(p, teks, re.I)) for k, p in sk.get('harap_ada', {}).items()}
        s['harap_tidak'] = {k: bool(re.search(p, teks, re.I)) for k, p in sk.get('harap_tidak', {}).items()}
        utama, i, n = [], 0, s['nomor_amar']
        while i < len(n):
            if utama and n[i] == 1:  # sub-daftar: lewati sampai nomor lanjut
                while i < len(n) and not (n[i] == utama[-1] + 1):
                    i += 1
                continue
            utama.append(n[i]); i += 1
        s['nomor_utama'] = utama
        s['nomor_utama_urut'] = utama == list(range(1, len(utama) + 1))
        r['lolos'] = (s['nomor_utama_urut'] and s['butir_kosong'] == 0 and not s['penanda_sisa'] and all(s['harap_ada'].values())
                      and not any(s['harap_tidak'].values()) and (r['teks_sama_dengan_sebelum'] if sk.get('harus_sama') else True))
    urut = [sk['kode'] for sk in SKENARIO if sk['kode'] in semua]
    json.dump({k: semua[k] for k in urut}, open(RINGKAS, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('gabung', len(urut), 'skenario; lolos', sum(1 for k in urut if semua[k]['lolos']))


if __name__ == '__main__':
    if sys.argv[1:] == ['gabung']:
        gabung_render()
    else:
        main()
