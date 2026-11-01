# -*- coding: utf-8 -*-
"""Render 4 keadaan bukti untuk daftar blangko uji. pakai: python driver.py <sebelum|sesudah> [keadaan,...] [nomor uji,...]"""
import json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, 'D:/aleta-dev/wt/w152/abt-paket/bas-tanya-jawab-29okt/sumber')
MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
mode = sys.argv[1]
SRC = {'sebelum': 'aps_badilag_w152sb', 'sesudah': 'aps_badilag_w152d'}[mode]
TREE = {'sebelum': 'D:/r152/sebelum', 'sesudah': 'D:/r152p/derry_briantono'}[mode]
os.environ['ABT_SRC'] = SRC
import render152 as R
KEAD = sys.argv[2].split(',') if len(sys.argv) > 2 and sys.argv[2] else ['surat', 'elektronik', 'keduanya', 'tanpa']
UJI = [
 ('b01', '1 Perceraian CG - BAS/BAS ALUR 04 [6] BAS 6 P & T Hadir - Pembuktian P.rtf', 10284),
 ('b02', '1 Perceraian CG - BAS/BAS ALUR 04 [7] BAS 7 P & T Hadir - Pembuktian T.rtf', 10284),
 ('b03', '1 Perceraian CG - BAS/BAS ALUR 02 [2] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi).rtf', 10284),
 ('b04', None, 10276),   # IN 2+ sidang (", lalu")
 ('b05', None, 10261),   # DK (bentuk c)
 ('b06', None, 10096),   # perwalian (bentuk b / lalu)
 ('p01', '1 Perceraian CG/[02] [Kabul] CG - F.rtf', 10284),
 ('p02', '1 Perceraian CG/[03] [Tolak] Cerai - T Tidak Hadir Setelah Mediasi - F Tidak Terbukti.rtf', 10284),
 ('p03', '1 Perceraian CG/[01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi).rtf', 10284),
 ('p04', None, 10261),   # DK putusan "A. Surat :"
 ('p05', None, 10276),   # IN putusan
 ('p06', None, 10090),   # AUA tanpa sub-bab
 ('p07', None, 10178),   # PAW
]
CARI = {
 'b04': '2 Itsbat Nikah - BAS/BAS ALUR 17 IN 2+ Sidang - [1a]',
 'b05': '3 Dispensasi Kawin - BAS/BAS ALUR 12 DK - [1at]',
 'b06': '6 Perwalian - BAS/BAS ALUR 16 Perwalian - [1]',
 'p04': '3 Dispensasi Kawin/[01] [Kabul] DK - (Anak P Cewek) Hamil',
 'p05': '2 Itsbat Nikah/[01] [Kabul] IN.rtf',
 'p06': '8 Asal Usul Anak/[01] [Kabul] AUA - Anak Sah dari Perkawinan Tercatat, Belum Punya',
 'p07': '9 Penetapan Ahli Waris/[01] [Kabul] PAW - Ahli Waris Anak Kandung (Sua',
}
def cari_berkas(pref):
    ak, sisa = pref.split('/', 1) if '/' in pref else (pref, '')
    # cari berkas yang namanya diawali pref di tree
    import glob
    awal = pref
    d = os.path.dirname(awal) if '/' in awal else ''
    base = os.path.basename(awal)
    for f in os.listdir(os.path.join(TREE, d)):
        if f.startswith(base.replace('.rtf', '')) :
            return (d + '/' + f) if d else f
    raise SystemExit('tidak ada ' + pref)
berkas = []
for k, rel, pid in UJI:
    rel = rel or cari_berkas(CARI[k])
    berkas.append((k, rel, pid))
json.dump(berkas, open('D:/Aplikasi/aleta/tmp/w152/uji-berkas.json', 'w'), ensure_ascii=False, indent=1)
isian = json.loads(subprocess.run(['node', 'D:/Aplikasi/aleta/tmp/w152/alat/isian_bukti.js'], capture_output=True, check=True).stdout.decode('utf8'))
KODE_P = (9955, 1214, 9958, 8131, 8132, 378, 9956)
def terapkan(keadaan):
    s = ['SET NAMES latin1;']
    for pid in sorted(set(p for _, _, p in berkas)):
        for kd in KODE_P + (9911,):
            s.append('DELETE FROM %s.abt_data_teks WHERE perkara_id = %d AND no_var = %d;' % (SRC, pid, kd))
            t = isian[keadaan]['T' if kd == 9911 else 'P']
            if t:
                s.append("INSERT INTO %s.abt_data_teks (no_var, perkara_id, data, modifier) VALUES (%d, %d, CONVERT(0x%s USING latin1), 'uji');" % (SRC, kd, pid, t.encode('latin1').hex()))
    subprocess.run([MYSQL, '-h127.0.0.1', '-uroot'], input='\n'.join(s).encode('latin1'), check=True)
if 'siapkan' in sys.argv:
    R.siapkan()
for kd in KEAD:
    terapkan(kd)
    tg = []
    for k, rel, pid in berkas:
        keluar = 'D:/Aplikasi/aleta/tmp/w152/render/%s/%s/%s' % (mode, kd, k)
        tg.append((os.path.join(TREE, rel), pid, '', keluar))
    hasil = R.render_banyak(tg)
    print(mode, kd, {v[:30] for v in hasil.values()}, flush=True)
