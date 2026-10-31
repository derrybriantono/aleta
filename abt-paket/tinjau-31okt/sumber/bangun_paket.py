# -*- coding: utf-8 -*-
"""Bangun paket ABT tinjau-31okt (31 Okt 2026) - jawaban pengguna atas pertanyaan G6, dipasang SESUDAH identitas-kosong-31okt (terakhir).

pakai: python bangun_paket.py <akar _blangko_abt sesudah SEMUA paket rantai> <basis ABT sesudah semua paket> [<nama basis salinan>]
  nama basis salinan (laptop, mis. aps_badilag_rantai): teksnya di kueri dikembalikan ke bentuk server 'aps_badilag.' sebelum md5.

Isi (nomor variabel BARU 11896-11899 sisa blok G6, dan 12000-12012 dari blok eksekusi 12000-12019):
  18  #11896# dasar banding: Pasal 199 ayat (1) RBg / Pasal 7 ayat (1) Undang-Undang Nomor 20 Tahun 1947 tentang Peradilan Ulangan (#11217#)
  19  #11897# akta bawah tangan yang diakui: Pasal 288 RBg / Pasal 1875 Kitab Undang-Undang Hukum Perdata (isi dicocokkan; catatan RBg "KUHperd. 1875")
  20  #11898# nomor Pasal 718 RBg = 390 HIR; #11899# "144 ayat (1)" / "120" (HIR Pasal 120 tanpa ayat).
      Eksekusi 208-210/216-218 dengan ayat HIR 197/200: TIDAK cukup nomor variabel di blok yang diberikan (perlu +-12) - tetap RBg, dilaporkan.
  21  tenggang verzet 14 hari: Pasal 153 ayat (1) RBg -> ayat (2) (padanan 129 ayat (2) HIR) di kueri dan blangko yang menyebut tenggang itu.
  22  "R.Bg.", "Rbg", "RBG", nama panjang "Reglemen Acara Hukum untuk Daerah Luar Jawa dan Madura (RBg)" -> "RBg" (lalu ikut padanan).
  23  ";" di tengah paragraf berupa "...; bahwa ..." -> paragraf baru berbutir "-" berinden gantung (blangko RTF dan 3 kueri pertimbangan).
Keluaran: ../paket-satker (tambal ber-md5 + SQL) dan ../hasil.
"""
import collections
import difflib
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
HIR = os.path.join(SINI, '..', '..', 'hir-rbg-30okt', 'sumber')
sys.path.insert(0, HIR)
import ganti_pasal as G  # noqa: E402
import padanan as PD  # noqa: E402
import titik_koma as TK  # noqa: E402
from rtf_peta import peta  # noqa: E402

MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
N = 'abt-tinjau-31okt'
TANGGAL = '2026-10-31 00:00:00'
UU20 = 'Pasal 7 ayat (1) Undang-Undang Nomor 20 Tahun 1947 tentang Peradilan Ulangan'
KUH1875 = 'Pasal 1875 Kitab Undang-Undang Hukum Perdata'
BS = chr(92)

# --- tabel padanan: jawaban pengguna 31 Okt -------------------------------------------------------------------------------
PD.PASAL['718'].update(status='pasti', ayat={'3': '3'}, catatan='disetujui pengguna 31 Okt (marinews MA: 390 (3) HIR = 718 (3) RBg)')

VAR_BARU = [
    dict(no=11896, nama='ACARA: DASAR HUKUM BANDING (Pasal 199 ayat (1) RBg / Jawa-Madura: Pasal 7 ayat (1) UU Nomor 20 Tahun 1947 tentang Peradilan Ulangan; OTOMATIS #11850#)',
         sql="SELECT IF('#11850#' = 'HIR', '%s', 'Pasal 199 ayat (1) RBg') AS data" % UU20),
    dict(no=11897, nama='ACARA: AKTA DI BAWAH TANGAN YANG DIAKUI (Pasal 288 RBg / Jawa-Madura: Pasal 1875 Kitab Undang-Undang Hukum Perdata; OTOMATIS #11850#)',
         sql="SELECT IF('#11850#' = 'HIR', '%s', 'Pasal 288 RBg') AS data" % KUH1875),
    dict(no=11898, nama='ACARA: NOMOR PASAL PENYAMPAIAN PANGGILAN/SURAT JURU SITA (Pasal 718 RBg = Pasal 390 HIR; OTOMATIS #11850#)',
         sql="SELECT IF('#11850#' = 'HIR', '390', '718') AS data"),
    dict(no=11899, nama='ACARA: NOMOR PASAL GUGATAN LISAN BERAYAT ("144 ayat (1)" RBg = "120" HIR tanpa ayat; OTOMATIS #11850#)',
         sql="SELECT IF('#11850#' = 'HIR', '120', '144 ayat (1)') AS data"),
]
NILAI_RBG = {11896: 'Pasal 199 ayat (1) RBg', 11897: 'Pasal 288 RBg', 11898: '718', 11899: '144 ayat (1)'}

# --- 20 lanjutan: eksekusi (blok 12000-12019, diklaim sesi utama 31 Okt) ------------------------------------------------------
# Padanan ayat HIR 197/200 menurut catatan "IR." naskah RBg dan urutan kalimat HIR 197/200 (HIR 197 ayat (6)-(7) = RBg 210 dikunci catatan
# "IR. 197 6,7"; HIR 200 ayat (1), (10), (11) bernomor di naskah). Satu variabel = satu BUTIR rujukan (nomor pasal + ayatnya) karena
# HIR menyebutnya dengan ayat lain atau tanpa ayat. Kunci: (pasal RBg, teks ayat sesudah nomor pasal).
EKS = [
    (12000, ('208', ''), '197 ayat (1)', 'perintah sita eksekusi'),
    (12001, ('209', ''), '197 ayat (2) sampai dengan ayat (5)', 'sita eksekusi oleh panitera, pengganti, berita acara'),
    (12002, ('209', ' ayat (2) dan ayat (3)'), '197 ayat (3) dan ayat (4)', 'panitera berhalangan diganti, cara penunjukan'),
    (12003, ('209', ' ayat (4)'), '197 ayat (5)', 'berita acara sita'),
    (12004, ('210', ''), '197 ayat (6) dan ayat (7)', 'dua saksi penyitaan'),
    (12005, ('210', ' ayat (1)'), '197 ayat (6)', 'dua saksi penyitaan'),
    (12006, ('215', ' ayat (1)'), '200 ayat (1)', 'penjualan barang sitaan lewat kantor lelang'),
    (12007, ('216', ''), '200 ayat (4) dan ayat (5)', 'urutan barang dilelang, lelang dihentikan'),
    (12008, ('217', ''), '200 ayat (6) sampai dengan ayat (9)', 'pengumuman dan tata cara lelang'),
    (12009, ('217', ' ayat (1)'), '200 ayat (6)', 'pengumuman lelang barang bergerak'),
    (12010, ('218', ' ayat (2)'), '200 ayat (11)', 'pengosongan sesudah lelang'),
    (12011, ('207', ' ayat (1)'), '196', 'aanmaning (HIR 196 satu paragraf tanpa ayat)'),
    (12012, ('207', ' ayat (1) dan ayat (2)'), '196', 'aanmaning (HIR 196 satu paragraf tanpa ayat)'),
]
for no, (ps, ay), hir, pokok in EKS:
    VAR_BARU.append(dict(no=no, nama=('ACARA: EKSEKUSI - BUTIR "%s%s" (RBg) = "%s" (HIR); %s; OTOMATIS #11850#' % (ps, ay, hir, pokok.upper()))[:200],
                         sql="SELECT IF('#11850#' = 'HIR', '%s', '%s%s') AS data" % (hir, ps, ay)))
    NILAI_RBG[no] = ps + ay
EKS_KUNCI = {k: no for no, k, _, _ in EKS}
RE_BUTIR = re.compile(r'(?<![0-9#])(\d{1,3})((?:\s+[Aa]yat\s+\(\d+\)(?:\s*(?:,|dan|,\s*dan)\s+[Aa]yat\s+\(\d+\))*)?)')


def eksekusi(teks, A):
    """Rujukan "Pasal ... RBg" yang masih tersisa (gagal di mesin padanan) dan memuat butir eksekusi: tiap butir diganti variabel butir
    (EKS) atau padanan biasa (nomor pasal #N# + ayat sama); satu saja butir belum pasti = rujukan dibiarkan."""
    ubah = []
    for m in G.RE_RUJUKAN.finditer(teks):
        inti = m.group(1)
        keluar, pos, ok, ada_eks = [], 0, True, False
        for b in RE_BUTIR.finditer(inti):
            p, ay = b.group(1), re.sub(r'\s+', ' ', b.group(2))
            keluar.append(inti[pos:b.start()])
            if (p, ay) in EKS_KUNCI:
                keluar.append('#%d#' % EKS_KUNCI[(p, ay)])
                ada_eks = True
            else:
                t, _ = G.templat(b.group(0), A)
                if t is None:
                    ok = False
                    break
                keluar.append(t)
            pos = b.end()
        if not ok or not ada_eks:
            continue
        keluar.append(inti[pos:])
        awal = m.start(1)
        ubah.append((awal, m.end(1), ''.join(keluar)))
        ubah.append((m.end() - 3, m.end(), '#11851#'))
    return ubah


def panjang(p):
    p = os.path.abspath(p)
    a = BS * 2 + '?' + BS
    return p if p.startswith(a) else a + p


def md5b(b):
    return hashlib.md5(b).hexdigest()


def alokasi_hir():
    """Nomor variabel padanan hir-rbg-30okt (dibaca dari nama variabelnya) + 718 -> 11898."""
    A = G.Alokasi(mulai=11898, akhir=11898)
    nilai = {G.NO_KODE: 'RBg', G.NO_WILAYAH: 'di luar Jawa dan Madura'}
    for v in json.load(open(os.path.join(HIR, '..', 'hasil', 'variabel.json'), encoding='utf-8')):
        m = re.search(r'NOMOR PASAL .*\(Pasal (\d+[a-z]?) RBg = Pasal', v['nama'])
        if m:
            A.pasal[m.group(1)] = v['no']
            nilai[v['no']] = m.group(1)
        m = re.search(r'NOMOR AYAT .*\(Pasal (\d+) ayat \((\d+)\) RBg', v['nama'])
        if m:
            A.ayat[(m.group(1), m.group(2))] = v['no']
            nilai[v['no']] = m.group(2)
    A.no_pasal('718')
    assert A.pasal['718'] == 11898
    nilai.update(NILAI_RBG)
    return A, nilai


# --- 22: bentuk baku --------------------------------------------------------------------------------------------------------
RE_PANJANG = re.compile(r'Reglemen Acara Hukum untuk Daerah Luar Jawa dan Madura \(RBg\)')
RE_RBG_TITIK = re.compile(r'(?<![A-Za-z])R\.\s?Bg\.?(?![A-Za-z])')
RE_RBG_LAIN = re.compile(r'(?<![A-Za-z])(Rbg|RBG)(?![A-Za-z])')


def baku(teks):
    """-> [(awal, akhir, pengganti)] untuk bentuk tidak baku (atas teks polos/kueri; RTF dipetakan pemanggil)."""
    ubah = []
    for m in RE_PANJANG.finditer(teks):
        ubah.append((m.start(), m.end(), 'RBg'))
    for m in RE_RBG_TITIK.finditer(teks):
        sesudah = teks[m.end():m.end() + 8]
        titik = m.group(0).endswith('.') and not re.match(r'\s*([,;:)\]]|jo\b|dan\b|[a-z(])', sesudah)
        ubah.append((m.start(), m.end(), 'RBg.' if titik else 'RBg'))
    for m in RE_RBG_LAIN.finditer(teks):
        ubah.append((m.start(), m.end(), 'RBg'))
    return ubah


def ubah_rtf_teks(raw, fungsi):
    """Terapkan fungsi(teks_tampak)->[(a,b,ganti)] pada RTF: hanya bila rentang itu teks biasa utuh di raw."""
    teks, idx = peta(raw)
    keluar = []
    for a, b, ganti in fungsi(teks):
        if a >= b or idx[a] < 0 or idx[b - 1] < 0:
            continue
        s, e = idx[a], idx[b - 1] + 1
        if re.search(r'[\\{}]', raw[s:e].replace('\r', '').replace('\n', '')) or raw[s:e].replace('\r', '').replace('\n', '') != teks[a:b]:
            continue
        keluar.append((s, e, ganti))
    return keluar


def terapkan(raw, ubah):
    ubah = sorted(ubah)
    hasil, pos = [], 0
    for s, e, g in ubah:
        assert s >= pos, (s, pos)
        hasil.append(raw[pos:s])
        hasil.append(g)
        pos = e
    hasil.append(raw[pos:])
    return ''.join(hasil)


# --- 18/19/20 kalimat utuh --------------------------------------------------------------------------------------------------
KALIMAT_BARU = [
    ('Pasal 199 ayat (1) RBg', '#11896#'),
    ('Pasal 288 RBg', '#11897#'),
    ('Pasal 144 ayat (1) RBg', 'Pasal #11899# #11851#'),  # hasil variabel tanpa spasi tepi (ABT memangkas spasi tepi)
]


def kalimat(teks, A):
    ubah = []
    for asal, ganti in KALIMAT_BARU:
        g = ganti % A.pasal['144'] if '%d' in ganti else ganti
        for m in re.finditer(r'(?<![0-9A-Za-z#])' + re.escape(asal) + r'(?![A-Za-z0-9])', teks):
            sebelum = teks[max(0, m.start() - 12):m.start()]
            if re.search(r'(\d|,|\bdan)\s*$', sebelum):
                continue  # bagian dari daftar pasal - dibiarkan
            ubah.append((m.start(), m.end(), g))
    return ubah


# --- 21: tenggang verzet ----------------------------------------------------------------------------------------------------
RE_153_1 = re.compile(r'Pasal #11861# ayat \(1\) #11851#')
RE_TENGGANG = re.compile(r'14 \(empat belas\) hari')


def tenggang(teks):
    ubah = []
    for m in RE_153_1.finditer(teks):
        kiri = teks[max(0, m.start() - 260):m.start()]
        t = list(RE_TENGGANG.finditer(kiri))
        # tenggang 14 hari di KALIMAT yang sama (bukan judul bagian / kalimat lain sebelumnya)
        if t and not re.search(r'Menimbang|Mengenai|\n', kiri[t[-1].end():]) or teks[max(0, m.start() - 14):m.start()] == 'SELECT "':
            i = m.group(0).index('(1)')
            ubah.append((m.start() + i, m.start() + i + 3, '(2)'))
    return ubah


# --- 23: butir "-" ----------------------------------------------------------------------------------------------------------
KATA_PAR = re.compile(r'\\(s|qj|ql|qc|qr|ri|rin|sl|slmult|sb|sa|lisb|lisa|widctlpar|nowidctlpar|itap|aspalpha|aspnum|faauto|adjustright|hyphpar|keep|keepn)(-?\d+)?(?![a-zA-Z]) ?')


def props_par(raw, pos):
    """Properti paragraf (tanpa \\plain dan properti huruf) dari \\pard terakhir sebelum pos; -> (teks props tanpa li/fi/tx, li0)."""
    i = raw.rfind(BS + 'pard', 0, pos)
    if i < 0:
        return None, 0
    m = re.compile(r'\\pard(?:\s*\\[a-zA-Z]+-?\d* ?)*').match(raw, i)
    seg = m.group(0)
    li = re.search(r'\\li(-?\d+)', seg)
    props = ''.join(x.group(0).strip() for x in KATA_PAR.finditer(seg))
    return props, int(li.group(1)) if li else 0


def butir(raw, rel, catat):
    """';' golongan bahwa-berangkai -> akhir butir + paragraf baru '-<tab>' berinden gantung. -> [(awal, akhir, ganti)]."""
    ubah = []
    for pos, g, sb, sd in TK.semua(raw):
        if g != 'bahwa-berangkai' or pos < 0:
            continue
        props, li0 = props_par(raw, pos)
        if props is None:
            catat.append((rel, sb[-50:] + '[;]' + sd[:30], 'DILEWATI: tanpa \\pard'))
            continue
        # spasi sesudah ';' di raw ikut dibuang
        e = pos + 1
        while e < len(raw) and raw[e] in ' \r\n':
            e += 1
        if not raw.startswith('bahwa', e):
            catat.append((rel, sb[-50:] + '[;]' + sd[:30], 'DILEWATI: "bahwa" tidak langsung sesudah ;'))
            continue
        li = li0 + 1004
        pb = '%spard%s%sfi-284%sli%d%slin%d%stx%d' % (BS, props, BS, BS, li, BS, li, BS, li)
        # butir sebelumnya di paragraf yang sama: propertinya dipasang lagi tepat sebelum \par yang menutupnya (bisa di kelompok {...} lain)
        lanjut = bool(ubah) and not re.search(r'\\par(?![a-z])', raw[ubah[-1][1]:pos])
        # 31 Okt (pengguna): awal butir berhuruf kapital "- Bahwa"
        ganti = ';%s%spar%s -%stab B' % (pb + ' ' if lanjut else '', BS, pb, BS)
        ubah.append((pos, e + 1, ganti))
        catat.append((rel, sb[-50:] + '[;]' + sd[:30], 'butir'))
    return ubah


def pastikan_pard_sesudah(raw, ubah):
    """Paragraf berikut sesudah paragraf yang dibutirkan harus diawali \\pard sendiri (kalau tidak, inden butir terbawa)."""
    tambah = []
    for pos, _, _ in ubah:
        j = raw.find(BS + 'par', pos + 1)
        while j >= 0 and re.match(r'\\pard', raw[j:j + 5]):
            j = raw.find(BS + 'par', j + 1)
        if j < 0:
            continue
        # properti butir dipasang lagi tepat sebelum \par penutup (penutup bisa berada di kelompok {...} lain - properti
        # paragraf yang dipasang di kelompok yang sudah ditutup tidak berlaku lagi di sana)
        props_b, li0_b = props_par(raw, pos)
        li_b = li0_b + 1004
        tambah.append((j, j, '%spard%s%sfi-284%sli%d%slin%d%stx%d ' % (BS, props_b, BS, BS, li_b, BS, li_b, BS, li_b)))
        sesudah = re.sub(r'[\s{}]|\\(rtlch|ltrch|dbch|hich|loch|af\d+|f\d+|fs\d+|lang\d+|langnp\d+|insrsid\d+|charrsid\d+)\b ?', '', raw[j + 4:j + 400])
        if not sesudah.startswith(BS + 'pard') and not sesudah.startswith(BS + 'sect') and sesudah:
            props, li0 = props_par(raw, pos)
            asli = re.compile(r'\\pard(?:\s*\\[a-zA-Z]+-?\d* ?)*').match(raw, raw.rfind(BS + 'pard', 0, pos)).group(0)
            li_fi = ''.join(x.group(0).strip() for x in re.finditer(r'\\(fi|li|lin)-?\d+ ?', asli))
            k = j + 4
            if raw[k:k + 1] == ' ':
                k += 1
            tambah.append((k, k, BS + 'pard' + props + li_fi + ' '))
    return sorted(set(tambah))


# --- kueri variabel ---------------------------------------------------------------------------------------------------------
BUTIR_SQL = ';' + BS * 2 + 'par' + BS * 2 + 'pard' + BS * 2 + 'qj' + BS * 2 + 'sl360' + BS * 2 + 'slmult1' + BS * 2 + 'widctlpar' + \
    BS * 2 + 'fi-284' + BS * 2 + 'li1004' + BS * 2 + 'lin1004' + BS * 2 + 'tx1004 -' + BS * 2 + 'tab Bahwa'
PULIH_SQL = BS * 2 + 'par' + BS * 2 + 'pard' + BS * 2 + 'qj' + BS * 2 + 'fi720' + BS * 2 + 'li0' + BS * 2 + 'lin0' + BS * 2 + 'sl360' + BS * 2 + 'slmult1' + \
    BS * 2 + 'widctlpar '
VAR_BUTIR = (4303, 4864, 4308)  # kueri pertimbangan Derry yang memuat "...; bahwa ..." di tengah paragraf


def baca_variabel(db, salinan):
    q = "SELECT no_var, HEX(nama), data_type, HEX(IFNULL(sql_query, '')), IFNULL(modifier, '') FROM abt_variabel ORDER BY no_var"
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '-N', '--default-character-set=latin1', db, '-e', q], capture_output=True, check=True)
    v = {}
    for l in r.stdout.decode('latin1').splitlines():
        no, nm, jt, sq, mod = l.split('\t')
        s = bytes.fromhex(sq).decode('latin1')
        if salinan:
            s = s.replace(salinan + '.', 'aps_badilag.')
        v[int(no)] = dict(nama=bytes.fromhex(nm).decode('latin1'), jenis=jt, sql=s, pemilik=mod)
    return v


def aktif(rel):
    atas = rel.split('/')[0]
    return not ('terhapus' in rel.lower() or re.match(r'(ALUR|- BAS .* -$)', atas))


def main():
    akar, db = sys.argv[1:3]
    salinan = sys.argv[3] if len(sys.argv) > 3 else ''
    keluar = os.path.join(SINI, '..', 'paket-satker')
    hasil = os.path.join(SINI, '..', 'hasil')
    os.makedirs(hasil, exist_ok=True)
    A, nilai = alokasi_hir()
    # pasal pasti yang belum punya variabel padanan (blok nomor habis): tetap RBg di paket ini, dilaporkan
    for p, e in PD.PASAL.items():
        if e['status'] == 'pasti' and p not in A.pasal:
            e['status'] = 'pasti tetapi tanpa nomor variabel'
    var = baca_variabel(db, salinan)
    for x in VAR_BARU:
        assert x['no'] not in var, x['no']
    TK.BARIS_BARU = {no for no, v in var.items() if v['jenis'] == 'data_sql' and TK.mulai_baris_baru(v['sql'])}

    def sebagai_rbg(t):
        return re.sub(r'#(118[5-9]\d|120[01]\d)#', lambda m: nilai[int(m.group(1))], t)

    akar_d = os.path.join(akar, 'derry_briantono')
    rels = []
    for d, _, fs in os.walk(panjang(akar_d)):
        for f in fs:
            if f.lower().endswith('.rtf'):
                rel = os.path.relpath(os.path.join(d, f), panjang(akar_d)).replace(os.sep, '/')
                if aktif(rel):
                    rels.append(rel)
    rels.sort()
    berkas = {}
    catat = collections.defaultdict(list)
    for rel in rels:
        raw0 = open(panjang(os.path.join(akar_d, rel)), 'rb').read().decode('latin1')
        # 22 baku -> teks "harapan" (yang boleh terlihat beda di cetakan Donggala)
        u = ubah_rtf_teks(raw0, baku)
        r1 = terapkan(raw0, u)
        catat['22'] += [(rel, raw0[s:e], g) for s, e, g in u]
        # 18/19/20 kalimat + padanan pasal (tidak terlihat beda untuk RBg)
        u2 = ubah_rtf_teks(r1, lambda t: kalimat(t, A))
        r2 = terapkan(r1, u2)
        c = []
        r3 = G.terapkan(r2, G.rencana_rtf(r2, A, c))
        r3 = terapkan(r3, ubah_rtf_teks(r3, lambda t: eksekusi(t, A)))
        catat['padanan'] += [(rel, a, h or ('TIDAK: ' + s)) for a, h, s in c]
        assert sebagai_rbg(r3).replace('\r', '').replace('\n', '') == sebagai_rbg(r1).replace('\r', '').replace('\n', ''), rel
        # 21 tenggang verzet
        u4 = ubah_rtf_teks(r3, tenggang)
        r4 = terapkan(r3, u4)
        catat['21'] += [(rel, 'ayat (1)', 'ayat (2)') for _ in u4]
        # 23 butir
        cb = []
        u5 = butir(r4, rel, cb)
        u5 += pastikan_pard_sesudah(r4, u5)
        # penanda kueri berbutir (4303/4308/4864): \par penutup dipindah ke kelompok yang sama dengan penanda, supaya properti butir
        # yang dipasang hasil kueri masih berlaku saat paragraf ditutup (kelompok berikutnya hanya berisi format huruf yang sama)
        for m in re.finditer(r'#(?:4303|4308|4864)#(\}\{(?:\\[a-z]+-?\d* ?)+)\\par \}', r4):
            u5.append((m.start(1), m.end(1), ''))
            cb.append((rel, m.group(0)[:6], 'penanda butir: \\par sekelompok'))
        r5 = terapkan(r4, u5)
        catat['23'] += cb
        if r5 != raw0:
            berkas[rel] = (raw0, r5)
    # --- variabel ---
    ubah_var = {}
    for no, v in sorted(var.items()):
        if v['jenis'] != 'data_sql' or not v['sql'] or 11850 <= no <= 11899:
            continue
        s0 = v['sql']
        s1 = terapkan(s0, baku(s0))
        s2 = terapkan(s1, kalimat(s1, A))
        c = []
        s3 = G.ganti_teks(s2, A, c)
        s3 = terapkan(s3, eksekusi(s3, A))
        catat['padanan-var'] += [('#%d#' % no, a, h or ('TIDAK: ' + sb)) for a, h, sb in c]
        assert sebagai_rbg(s3) == sebagai_rbg(s1), no
        s4 = terapkan(s3, tenggang(s3))
        if no in VAR_BUTIR:
            n_butir = s4.count('; bahwa')
            i0 = s4.find('; bahwa')
            # paragraf <br> SESUDAH butir dikembalikan ke gaya paragraf pertimbangan (qj, inden baris pertama 720) agar inden butir tidak terbawa
            s4 = s4[:i0] + s4[i0:].replace('<br>', PULIH_SQL)
            s4 = s4.replace('; bahwa', BUTIR_SQL)
            catat['23'] += [('#%d#' % no, '; bahwa', 'butir x%d' % n_butir)]
        if s4 != s0:
            ubah_var[no] = dict(lama=s0, baru=s4, nama=v['nama'])
    # 11217 (dasar banding) memakai #11896#
    assert ubah_var.get(11217, {}).get('baru', '').find('#11896#') >= 0 or var[11217]['sql'].find('Pasal 199 ayat (1) RBg') < 0
    tulis(keluar, berkas, ubah_var, var)
    with open(os.path.join(hasil, 'ubahan.tsv'), 'w', encoding='utf-8', newline='\n') as o:
        o.write('butir\ttempat\tsebelum\tsesudah\n')
        for k in ('22', '21', '23', 'padanan', 'padanan-var'):
            for b in catat[k]:
                o.write('%s\t%s\n' % (k, '\t'.join(str(x).replace('\t', ' ').replace('\n', ' ')[:300] for x in b)))
    json.dump(VAR_BARU, open(os.path.join(hasil, 'variabel.json'), 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
    hit = {k: len(v) for k, v in catat.items()}
    print('berkas RTF diubah', len(berkas), '| variabel diubah', len(ubah_var), '| variabel baru', len(VAR_BARU), '|', hit,
          '| padanan baru', sum(1 for b in catat['padanan'] if not str(b[2]).startswith('TIDAK')), '| butir', sum(1 for b in catat['23'] if b[2] == 'butir'))


def hexs(s):
    return '0x' + s.encode('latin1').hex() if s else "''"


def tulis(keluar, berkas, ubah_var, var):
    import base64
    if os.path.isdir(keluar):
        shutil.rmtree(panjang(keluar))
    os.makedirs(keluar)
    for f in ('tambal_rtf.py',):
        shutil.copy(os.path.join(HIR, f), os.path.join(keluar, f))
    for f in ('pasang-satker.sh', 'pulih-satker.sh'):
        shutil.copy(os.path.join(SINI, f), os.path.join(keluar, f))
    # tambal: potongan per baris berkas (difflib atas baris; berkas RTF berpotong baris CR/LF)
    with open(os.path.join(keluar, 'daftar-tambal.tsv'), 'w', encoding='utf-8', newline='\n') as d, \
            open(os.path.join(keluar, 'tambal.tsv'), 'w', encoding='utf-8', newline='\n') as t:
        d.write('# kode\tberkas\tmd5_lama\tmd5_baru\tjumlah potongan - berkas diubah HANYA bila md5 persis md5_lama (keadaan sesudah semua paket rantai)\n')
        t.write('# kode\toffset\tb64(teks lama)\tb64(teks baru)\n')
        for i, rel in enumerate(sorted(berkas), 1):
            lama, baru = berkas[rel]
            kode = 'K%04d' % i
            a, b = lama.splitlines(True), baru.splitlines(True)
            off = [0]
            for x in a:
                off.append(off[-1] + len(x))
            pot = []
            for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
                if op != 'equal':
                    pot.append((off[i1], ''.join(a[i1:i2]), ''.join(b[j1:j2])))
            h = lama
            for o_, l_, n_ in sorted(pot, key=lambda x: -x[0]):
                assert h[o_:o_ + len(l_)] == l_
                h = h[:o_] + n_ + h[o_ + len(l_):]
            assert h == baru, rel
            d.write('%s\tderry_briantono/%s\t%s\t%s\t%d\n' % (kode, rel, md5b(lama.encode('latin1')), md5b(baru.encode('latin1')), len(pot)))
            for o_, l_, n_ in pot:
                t.write('%s\t%d\t%s\t%s\n' % (kode, o_, base64.b64encode(l_.encode('latin1')).decode('ascii'), base64.b64encode(n_.encode('latin1')).decode('ascii')))
    sidik = "MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), IFNULL(referensi, ''), IFNULL(multi_sidang, ''), locked, IFNULL(modifier, '')))"

    def sidik_py(x):
        return md5b('|'.join([x['nama'], 'data_sql', x['sql'], '', '', '0', 'admin']).encode('latin1'))

    uv = sorted(ubah_var.items())
    nb = [x['no'] for x in VAR_BARU]
    kepala = '-- Paket ABT "%s" (31 Okt 2026): jawaban pengguna G6 (banding UU 20/1947, 288 = 1875 KUHPerdata, 718 = 390 HIR, 144 (1) = 120 HIR, tenggang verzet ayat (2), RBg baku, butir "-"). Hanya derry_briantono.\n' % N
    open(os.path.join(keluar, 'nomor-variabel.txt'), 'w', newline='\n').write('# variabel BARU\n' + ''.join('%d\n' % n for n in nb))
    open(os.path.join(keluar, 'nomor-diubah.txt'), 'w', newline='\n').write('# variabel LAMA yang kuerinya diubah\n' + ''.join('%d\n' % n for n, _ in uv))
    nl = ' UNION ALL '.join("SELECT %d AS n, '%s' AS h" % (x['no'], sidik_py(x)) for x in VAR_BARU)
    sv = sidik.replace("nama", "v.nama").replace("data_type", "v.data_type").replace("sql_query", "v.sql_query").replace("referensi", "v.referensi") \
        .replace("multi_sidang", "v.multi_sidang").replace("locked", "v.locked").replace("modifier", "v.modifier")
    lama_c = ' OR '.join("(no_var = %d AND MD5(IFNULL(sql_query, '')) = '%s')" % (n, md5b(u['lama'].encode('latin1'))) for n, u in uv)
    baru_d = ' OR '.join("(no_var = %d AND MD5(IFNULL(sql_query, '')) = '%s')" % (n, md5b(u['baru'].encode('latin1'))) for n, u in uv)
    pras = kepala + ('-- PRASYARAT "A|B|C|D|E": A = 11896-11899 / 12000-12019 berisi lain (0) | B = variabel baru persis (0/%d) | C = kueri lama persis dasar (%d/0) | '
                     'D = kueri lama sudah isi baru (0/%d) | E = #11850# dan #11861# paket hir-rbg ada (2)\n' % (len(nb), len(uv), len(uv)))
    pras += ("SELECT CONCAT_WS('|',\n (SELECT COUNT(*) FROM abt_variabel v WHERE (v.no_var BETWEEN 11896 AND 11899 OR v.no_var BETWEEN 12000 AND 12019) AND NOT EXISTS (SELECT 1 FROM (%s) p WHERE p.n = v.no_var AND p.h = %s)),\n"
             " (SELECT COUNT(*) FROM abt_variabel v JOIN (%s) p ON p.n = v.no_var AND p.h = %s),\n (SELECT COUNT(*) FROM abt_variabel WHERE %s),\n"
             " (SELECT COUNT(*) FROM abt_variabel WHERE %s),\n (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (11850, 11861))) AS p;\n"
             % (nl, sv, nl, sv, lama_c or '0', baru_d or '0'))
    open(os.path.join(keluar, '%s-PRASYARAT.sql' % N), 'w', encoding='latin1', newline='\n').write(pras)
    open(os.path.join(keluar, 'harap.txt'), 'w', newline='\n').write('0|0|%d|0|2\n0|%d|0|%d|2\n' % (len(uv), len(nb), len(uv)))
    p = [kepala, 'START TRANSACTION;\n']
    for x in VAR_BARU:
        p.append("INSERT INTO abt_variabel (no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier, modified) "
                 "SELECT %d, %s, 'data_sql', NULL, NULL, NULL, NULL, %s, NULL, NULL, 0, 'admin', '%s' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM abt_variabel WHERE no_var = %d);\n"
                 % (x['no'], hexs(x['nama']), hexs(x['sql']), TANGGAL, x['no']))
    for n, u in uv:
        p.append("UPDATE abt_variabel SET sql_query = %s WHERE no_var = %d AND MD5(IFNULL(sql_query, '')) = '%s';\n" % (hexs(u['baru']), n, md5b(u['lama'].encode('latin1'))))
    p.append('COMMIT;\n')
    open(os.path.join(keluar, '%s-PASANG.sql' % N), 'w', encoding='latin1', newline='\n').write(''.join(p))
    bag = ["SELECT 'var %d' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = %d AND %s = '%s') AS ok" % (x['no'], x['no'], sidik, sidik_py(x)) for x in VAR_BARU]
    bag += ["SELECT 'ubah %d' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = %d AND MD5(IFNULL(sql_query, '')) = '%s') AS ok" % (n, n, md5b(u['baru'].encode('latin1'))) for n, u in uv]
    q = kepala + 'SELECT label, ok FROM (\n' + '\nUNION ALL '.join(bag) + '\n) x WHERE ok <> 1\nUNION ALL SELECT IF((SELECT COUNT(*) FROM (' + \
        '\nUNION ALL '.join(bag) + ") y WHERE y.ok <> 1) = 0, 'SEMUA COCOK', 'ADA BEDA'), '';\n"
    open(os.path.join(keluar, '%s-PERIKSA.sql' % N), 'w', encoding='latin1', newline='\n').write(q)
    r = [kepala, 'START TRANSACTION;\n']
    r += ["DELETE FROM abt_variabel WHERE no_var = %d AND %s = '%s';\n" % (x['no'], sidik, sidik_py(x)) for x in VAR_BARU]
    r += ["UPDATE abt_variabel SET sql_query = %s WHERE no_var = %d AND MD5(IFNULL(sql_query, '')) = '%s';\n" % (hexs(u['lama']), n, md5b(u['baru'].encode('latin1'))) for n, u in uv]
    r.append('COMMIT;\n')
    open(os.path.join(keluar, '%s-PULIH.sql' % N), 'w', encoding='latin1', newline='\n').write(''.join(r))
    semua = []
    for d_, _, fs in os.walk(panjang(keluar)):
        for f in fs:
            if f != 'MD5SUMS.txt':
                p_ = os.path.join(d_, f)
                semua.append((os.path.relpath(p_, panjang(keluar)).replace(os.sep, '/'), md5b(open(p_, 'rb').read())))
    with open(os.path.join(keluar, 'MD5SUMS.txt'), 'w', newline='\n') as o:
        for rel, m in sorted(semua):
            o.write('%s  %s\n' % (m, rel))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
