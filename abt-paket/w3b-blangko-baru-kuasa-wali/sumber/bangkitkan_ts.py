# -*- coding: utf-8 -*-
"""Membangkitkan data sisi portal/ekstensi paket W3b dari registri jenis + berkas RTF hasil bangun_semua.py:

  manajemen_surat/src/lib/w3b-jenis-data.ts      JENIS_W3B (jenis, folder, menu, nama berkas putusan per peran), FOLDER_MENU_W3B, SET_BLANGKO_W3B
  manajemen_surat/src/lib/alur-bas-w3b-data.ts   ALUR_BAS_W3B (langkah BAS per ALUR), SALINAN_W3B (folder jenis penerima salinan BAS ALUR 04-09)
  ekstensi-sipp/panel-alat.js                    blok /* === W3b === */ ... /* === AKHIR W3b === */ (menu putusan + peta bawaan)

Pakai (sesudah bangun_semua.py):  python bangkitkan_ts.py
Cermin portal untuk ALAT_PETA_BAWAAN (bawaan-ekstensi.ts) dibangkitkan terpisah oleh alat/cermin_peta.mjs (menjalankan panel-alat.js di vm).
"""
import importlib
import json
import os
import re
import sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(os.path.dirname(AKAR))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(AKAR, 'alat'))
from bangun import lp  # noqa: E402
import jenis as J  # noqa: E402
import gugatan  # noqa: E402
import permohonan  # noqa: E402
import bas  # noqa: E402
import ramah_w3b  # noqa: E402

KELUAR = os.path.join(AKAR, 'rtf', 'derry_briantono')
LIB = os.path.join(REPO, 'manajemen_surat', 'src', 'lib')
BLANGKO_DERRY = os.path.join(REPO, 'manajemen_surat', 'src', 'app', 'api', 'aleta-ecourt', 'blangko-derry')
PANEL = os.path.join(REPO, 'ekstensi-sipp', 'panel-alat.js')

NAMA_SIPP = {'353': 'Pencabutan Kekuasaan Orang Tua', '355': 'Pencabutan Kekuasaan Wali', '356': 'Penunjukan orang lain sebagai Wali oleh Pengadilan',
             '357': 'Ganti Rugi terhadap Wali', '350': 'Nafkah Anak Oleh Ibu karena Ayah tidak mampu', 'eksekusi': 'Eksekusi', 'verzet': 'Verzet'}
KODE_MENU = {'353': 'kk', '355': 'kw', '356': 'pw', '357': 'gr', '350': 'ni', 'eksekusi': 'ek', 'verzet': 'vz'}
KUNCI_JENIS_PETA = ('353', '355', '356', '357', '350')   # jenis yang punya baris peta putusan (eksekusi/verzet tidak: bukan jenis perkara)


def ts_str(x):
    return json.dumps(x, ensure_ascii=False)


def muat():
    hasil = []
    for kunci, info in J.JENIS.items():
        try:
            m = importlib.import_module(info['modul'])
        except ModuleNotFoundError as e:
            if e.name != info['modul']:
                raise
            continue
        S = m.SPEK
        S['alur'], S['nama_pendek'] = info['alur'], info['nama_pendek']
        hasil.append((kunci, info, S))
    return hasil


def berkas_putusan(S):
    n = S['nama_berkas']
    peran = {}
    if 'gugatan' in S:
        nama = {'[01]': 'kabul', '[01a]': 'setelahMediasi', '[01b]': 'verstek', '[03]': 'tolak', '[03b]': 'tolakVerstek', '[97]': 'damai', '[98]': 'cabut',
                '[98b]': 'cabutSesudahJawaban', '[98a]': 'gugur', '[98c]': 'coret', '[99]': 'noSema', '[99a]': 'noFormil', '[99b]': 'noKabur'}
        for kode, _dasar, keluar, _p in gugatan.BERKAS:
            if kode == '[97]' and not S.get('perdamaian'):
                continue
            peran[nama[kode]] = keluar.replace('{N}', n)[:-4]
    if 'permohonan' in S:
        nama = {'[01p]': 'mohonKabul', '[03p]': 'mohonTolak', '[99p]': 'mohonNo'}
        for kode, _dasar, keluar, _p in permohonan.BERKAS:
            peran[nama[kode]] = keluar.replace('{N}', n)[:-4]
    return peran


def langkah_bas(kunci, S):
    """[(kode, berkas, keterangan)] dari berkas BAS yang ada di folder keluaran. Hanya berkas spesifik-ALUR (bukan salinan ALUR 04-09)."""
    folder = os.path.join(KELUAR, S['folder'] + ' - BAS')
    daftar = []
    if not os.path.isdir(lp(folder)):
        return daftar
    alur = S['alur']
    untuk_g = {bas.nama_langkah_g(S, k): (k, ket) for k, ket, _d in bas.LANGKAH_G}
    ket_g = {'CB': 'Sidang 2 - Mediasi Berhasil - Gugatan Dicabut'}
    for f in sorted(os.listdir(lp(folder))):
        if not f.startswith('BAS ALUR %d ' % alur):
            continue
        if f in untuk_g:
            k, ket = untuk_g[f]
            daftar.append((k, f, ket))
            continue
        m = re.match(r'^BAS ALUR %d [^\[]*- \[([0-9A-Za-z]+)\] (.*)\.rtf$' % alur, f)
        if m:
            daftar.append((m.group(1), f, m.group(2)))
    # urutan: gugatan dulu (V1 V2 AP CB TP NO CS CM) lalu permohonan (1 1a 1b 1c 2 2a 2b 3 T N)
    urut_g = [k for k, _, _ in bas.LANGKAH_G]
    urut_p = bas.LANGKAH_P
    def kunci_urut(x):
        k = x[0]
        if k in urut_g and not x[1].endswith('Mohon') and ' Mohon ' not in x[1]:
            return (0, urut_g.index(k))
        if ' Mohon ' in x[1] or k in urut_p:
            return (1, urut_p.index(k) if k in urut_p else 99)
        return (2, 0)
    return sorted(daftar, key=kunci_urut)


def tulis(path, isi):
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(isi)


def bangkit():
    semua = muat()
    # ---------------- w3b-jenis-data.ts ----------------
    baris = ['/* DIBANGKITKAN oleh abt-paket/w3b-blangko-baru-kuasa-wali/sumber/bangkitkan_ts.py - jangan disunting tangan. */', '/**',
             ' * JENIS BLANGKO DERRY BARU GELOMBANG 3 (agen W3b, 21 Okt 2026): pencabutan kekuasaan orang tua (353), pencabutan kekuasaan wali (355), penunjukan wali (356),',
             ' * ganti rugi terhadap wali (357), nafkah anak oleh ibu (350), eksekusi dan verzet. Paket ABT: abt-paket/w3b-blangko-baru-kuasa-wali.',
             ' */',
             'export type JenisW3b = {', '  kunci: string;', '  idJenis: number | null;', '  kunciPeta: string;', '  namaSipp: string;', '  label: string;', '  folder: string;', '  folderBas: string;',
             '  menuPutusan: { id: number; nama: string; alias: string };', '  menuBas: { id: number; nama: string; alias: string };', '  alur: { id: string; nomor: number; namaPendek: string };',
             '  gugatan: boolean;', '  permohonan: boolean;', '  perdamaian: boolean;', '  berkas: Record<string, string>;', '  kodeMenuEkstensi: string;', '};', '']
    daftar = []
    folder_menu, set_blangko = {}, []
    for kunci, info, S in semua:
        putusan, bas_m = J.menu_baris(kunci, S['folder'])
        peran = berkas_putusan(S) if kunci in KUNCI_JENIS_PETA else {}
        item = dict(kunci=kunci, idJenis=int(kunci) if kunci.isdigit() else None, kunciPeta=NAMA_SIPP[kunci].lower() if kunci in KUNCI_JENIS_PETA else kunci,
                    namaSipp=NAMA_SIPP[kunci], label=S['label'], folder=S['folder'], folderBas=S['folder'] + ' - BAS',
                    menuPutusan=dict(id=putusan['id'], nama=putusan['nama'], alias=putusan['nama_alias']),
                    menuBas=dict(id=bas_m['id'], nama=bas_m['nama'], alias=bas_m['nama_alias']),
                    alur=dict(id='alur-%d' % info['alur'], nomor=info['alur'], namaPendek=info['nama_pendek']),
                    gugatan='gugatan' in S, permohonan='permohonan' in S, perdamaian=bool(S.get('perdamaian')), berkas=peran, kodeMenuEkstensi=KODE_MENU[kunci])
        daftar.append(item)
        folder_menu[putusan['nama']] = S['folder']
    baris.append('export const JENIS_W3B: JenisW3b[] = ' + json.dumps(daftar, ensure_ascii=False, indent=2) + ';')
    baris.append('')
    baris.append('/** abt_menu.nama putusan -> folder (relatif derry_briantono), untuk FOLDER_MENU_PUTUSAN. */')
    baris.append('export const FOLDER_MENU_W3B: Record<string, string> = ' + json.dumps(folder_menu, ensure_ascii=False, indent=2) + ';')
    baris.append('')
    tulis(os.path.join(LIB, 'w3b-jenis-data.ts'), '\n'.join(baris))

    # ---------------- alur-bas-w3b-data.ts ----------------
    alur_list, salinan_penerima = [], []
    for kunci, info, S in semua:
        langkah = langkah_bas(kunci, S)
        putusan, bas_m = J.menu_baris(kunci, S['folder'])
        jmin, jmax = info['jenis']
        alur_list.append(dict(id='alur-%d' % info['alur'], nomor=info['alur'], nama='%s - %s' % (NAMA_SIPP[kunci], 'gugatan dan permohonan' if ('gugatan' in S and 'permohonan' in S) else 'gugatan' if 'gugatan' in S else 'permohonan' if 'permohonan' in S else 'berita acara'),
                              folder='derry_briantono/' + S['folder'] + ' - BAS', menu=dict(id=bas_m['id'], nama=bas_m['nama'], alias=bas_m['nama_alias']), jenisMin=jmin, jenisMaks=jmax,
                              langkah=[dict(kode=k, berkas=b, keterangan=ket) for k, b, ket in langkah]))
        if 'gugatan' in S:
            salinan_penerima.append(S['folder'] + ' - BAS')
    b2 = ['/* DIBANGKITKAN oleh abt-paket/w3b-blangko-baru-kuasa-wali/sumber/bangkitkan_ts.py - jangan disunting tangan. */',
          'import type { AlurBasBaru } from "@/lib/alur-bas-baru-data";', '',
          '/** BAS gelombang 3 (ALUR 70-76): ditambahkan ke ALUR_BAS_BARU oleh alur-bas-baru-data.ts. */',
          'export const ALUR_BAS_W3B: AlurBasBaru[] = ' + json.dumps(alur_list, ensure_ascii=False, indent=2) + ';', '',
          '/** Folder BAS jenis gugatan yang menerima 29 salinan BAS ALUR 04-09 (sama dengan 6c Nafkah Anak - BAS). */',
          'export const SALINAN_PENERIMA_W3B: string[] = ' + json.dumps(salinan_penerima, ensure_ascii=False, indent=2) + ';', '']
    tulis(os.path.join(LIB, 'alur-bas-w3b-data.ts'), '\n'.join(b2))

    # ---------------- blok panel-alat.js ----------------
    js = ['/* === W3b 21 Okt === */', '/**',
          ' * BLANGKO DERRY BARU GELOMBANG 3 (agen W3b): pencabutan kekuasaan orang tua (353), pencabutan kekuasaan wali (355), penunjukan orang lain sebagai wali (356),',
          ' * ganti rugi terhadap wali (357), nafkah anak oleh ibu karena ayah tidak mampu (350); menu putusan 240-248 berpasangan dengan BAS 241-249 (paket abt-w3b-blangko-baru-kuasa-wali).',
          ' * DIBANGKITKAN oleh abt-paket/w3b-blangko-baru-kuasa-wali/sumber/bangkitkan_ts.py. Gugatan (Pdt.G) berpola wasiat/hibah; permohonan (Pdt.P, keadaan "permohonan") memakai [01p]/[03p]/[99p];',
          ' * cabut, gugur dan NO SEMA 1/2022 permohonan memakai 9b Permohonan Umum. Eksekusi dan verzet bukan jenis perkara: hanya menu ABT (proses SIPP 600-645 / 240-280).',
          ' */']
    menu_js = {KODE_MENU[k]: dict(blangko=J.menu_baris(k, S['folder'])[0]['nama'], lain=[J.menu_baris(k, S['folder'])[0]['nama_alias']]) for k, _i, S in semua}
    js.append('Object.assign(ALAT_MENU_PUTUSAN, ' + json.dumps(menu_js, ensure_ascii=False, indent=2) + ');')
    js.append('''function alatPetaW3b(kunci, jenisAsli, menu, B, punyaGugatan, punyaPermohonan) {
  const baris = punyaGugatan ? alatPetaGugatanDua(kunci, jenisAsli, menu, B, {}) : {};
  const kl = (status, tanda) => `${kunci}|${status}${tanda ? `|${tanda}` : ""}`;
  if (punyaGugatan && !B.damai) delete baris[kl("perdamaian", "")]; // pencabutan kekuasaan orang tua / wali: tanpa akta perdamaian
  const r = (status, berkas, catatan) => alatBarisPutusanLain(menu, jenisAsli, status, berkas, catatan);
  const um = (status, catatan) => alatBarisPutusanLain("um", jenisAsli, status, status === "Tidak Dapat Diterima" ? ALAT_BERKAS_UMUM.no : status === "Dicabut" ? ALAT_BERKAS_UMUM.cabut : ALAT_BERKAS_UMUM.gugur, catatan);
  if (punyaGugatan) {
    baris[kl("dicabut", "sesudah-jawaban")] = r("Dicabut", B.cabutSesudahJawaban, "keadaan: dicabut sesudah Tergugat menjawab (dengan persetujuannya)");
    baris[kl("tidak dapat diterima", "kurang-pihak")] = r("Tidak Dapat Diterima", B.noFormil, "dipilih manual: kurang pihak (plurium litis consortium)");
    baris[kl("tidak dapat diterima", "gugatan-kabur")] = r("Tidak Dapat Diterima", B.noKabur, "dipilih manual: gugatan kabur (obscuur libel)");
  }
  if (punyaPermohonan) {
    const mohon = "keadaan: permohonan (nomor perkara Pdt.P)";
    if (!punyaGugatan) baris[kunci] = r("", B.mohonKabul, `varian: ${B.mohonTolak}; ${B.mohonNo}`);
    baris[kl("dikabulkan", "permohonan")] = r("Dikabulkan", B.mohonKabul, mohon);
    baris[kl("ditolak", "permohonan")] = r("Ditolak", B.mohonTolak, mohon);
    baris[kl("tidak dapat diterima", "permohonan")] = r("Tidak Dapat Diterima", B.mohonNo, `${mohon}; NO formil`);
    baris[kl("dicabut", "permohonan")] = um("Dicabut", `${mohon}; permohonan umum (9b)`);
    baris[kl("digugurkan", "permohonan")] = um("Digugurkan", `${mohon}; permohonan umum (9b)`);
    baris[kl("gugur", "permohonan")] = um("Gugur", `${mohon}; permohonan umum (9b)`);
    baris[kl("tidak dapat diterima", "permohonan-sema-1-2022")] = um("Tidak Dapat Diterima", `${mohon}; permohonan umum (9b) - pola SEMA 1/2022`);
  }
  return baris;
}''')
    for kunci, info, S in semua:
        if kunci not in KUNCI_JENIS_PETA:
            continue
        peran = berkas_putusan(S)
        B = dict(peran)
        B.setdefault('noKabur', '')
        js.append('const ALAT_BERKAS_W3B_%s = %s;' % (kunci, json.dumps(B, ensure_ascii=False, indent=2)))
    pemanggilan = ['Object.assign(ALAT_PETA_BAWAAN']
    for kunci, info, S in semua:
        if kunci not in KUNCI_JENIS_PETA:
            continue
        pemanggilan.append('  , alatPetaW3b(%s, %s, %s, ALAT_BERKAS_W3B_%s, %s, %s)' % (
            ts_str(NAMA_SIPP[kunci].lower()), ts_str(NAMA_SIPP[kunci]), ts_str(KODE_MENU[kunci]), kunci, 'true' if 'gugatan' in S else 'false', 'true' if 'permohonan' in S else 'false'))
    pemanggilan.append(');')
    js.append('\n'.join(pemanggilan))
    js.append('/* === AKHIR W3b === */')
    blok = '\n'.join(js)
    src = open(PANEL, encoding='utf-8', newline='').read()
    if '/* === W3b 21 Okt === */' in src:
        src = re.sub(r'/\* === W3b 21 Okt === \*/.*?/\* === AKHIR W3b === \*/', lambda m: blok, src, flags=re.S)
    else:
        sisip = src.index('/* === AKHIR I28 === */') + len('/* === AKHIR I28 === */')
        src = src[:sisip] + '\n' + blok + src[sisip:]
    with open(PANEL, 'w', encoding='utf-8', newline='') as f:
        f.write(src)
    print('dibangkitkan: %d jenis; BAS ALUR: %s; panel-alat.js diperbarui' % (len(semua), ', '.join('%d(%d)' % (a['nomor'], len(a['langkah'])) for a in alur_list)))


def bangkit_ramah():
    ramah, manual, opsional = ramah_w3b.bangun()
    baris = ['/* DIBANGKITKAN oleh abt-paket/w3b-blangko-baru-kuasa-wali/sumber/bangkitkan_ts.py (label dari nama variabel + sumber/ramah_w3b.py META) - jangan disunting tangan. */',
             '/** Label pengguna, pilihan huruf, penanda "diisi manual" dan "opsional" untuk isian blangko Derry baru gelombang 3 (variabel ABT 3800-3999). */',
             'export const RAMAH_W3B: Record<string, { nm: string; pil?: string[]; saran?: string }> = ' + json.dumps(ramah, ensure_ascii=False, indent=2) + ';', '',
             'export const ISIAN_MANUAL_W3B: Record<string, string> = ' + json.dumps(manual, ensure_ascii=False, indent=2) + ';', '',
             'export const ISIAN_OPSIONAL_W3B: Record<string, string> = ' + json.dumps(opsional, ensure_ascii=False, indent=2) + ';', '']
    tulis(os.path.join(BLANGKO_DERRY, 'ramah-w3b.ts'), chr(10).join(baris))
    return len(ramah)


if __name__ == '__main__':
    bangkit()
    print('ramah: %d isian' % bangkit_ramah())
