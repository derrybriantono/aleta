# -*- coding: utf-8 -*-
"""
Susun RAK PERATURAN (P1, 1 Nov 2026) - deterministik, BACA SAJA atas naskah lokal.

  python -I scripts/rak-peraturan/susun_rak.py <korpus.json> <folder referensi> <khi-tambah.json> <pp54.htm> <keluaran rak.json>

<korpus.json>      keluaran pindai-korpus.ts (rujukan pasal di blangko Derry, variabel ABT, katalog saksi, kode deteksi)
<folder referensi> D:/aleta-dev/kerja/referensi (naskah yang sudah diunduh agen VERIFIKASI-HUKUM 18 Okt 2026, lihat SUMBER)
<khi-tambah.json>  pasal KHI dari pasal.id yang belum ada di khi-pasalid.json (dibaca 1 Nov 2026)
<pp54.htm>         naskah PP 54/2007 jdih.kemenkeu.go.id (teks lengkap HTML)

Aturan status (TIDAK ADA bunyi yang diketik dari ingatan):
  terverifikasi = bunyi diambil dari naskah penerbit resmi (BPK, peraturan.go.id, JDIH pengadilan, Kemenag, MK) - untuk KHI:
                  digitalisasi pasal.id DICOCOKKAN dengan OCR naskah Kemenag (daftar KHI-pasal-terverifikasi.md, atau kecocokan
                  pasangan kata otomatis >= AMBANG_KHI);
  belum         = naskah tidak tersedia (bunyi kosong), atau naskahnya bukan terbitan resmi (RBg terjemahan UNNES), atau ada
                  perubahan peraturan yang belum dibaca (UU 7/1989 sesudah UU 50/2009).
"""
import html as H
import json
import os
import re
import sys
import collections

KORPUS, REF, KHI_TAMBAH, PP54, KELUAR = sys.argv[1:6]
U = REF + "/_unduhan"
AMBANG_SEGMEN = 0.70
AMBANG_KHI = 0.88  # = skor terendah pasal yang dicocokkan manual (KHI-pasal-terverifikasi.md), 5-gram huruf
DIAKSES_LAMA = "2026-10-18"
DIAKSES = "2026-11-01"

SUMBER = {
    "kemenag-khi": dict(judul="Kompilasi Hukum Islam (lampiran Inpres 1/1991), buku Pedoman Penyuluhan Hukum Ditbinbapera Depag 1994/1995 - buku digital Kemenag (pindaian ber-OCR)", url="https://simbi.kemenag.go.id/eliterasi/storage/perpustakaan/pusat/316a67e6-6a05-4bf8-9f1d-6e8b22741b90/buku-digital/df7746a999-7125653410.pdf", diakses=DIAKSES_LAMA, resmi=True),
    "pasalid-khi": dict(judul="Digitalisasi KHI per pasal (pasal.id, bersumber naskah Kemenag; bukan naskah resmi - dipakai sebagai teks bersih sesudah dicocokkan dengan OCR naskah Kemenag)", url="https://pasal.id/peraturan/khi/kompilasi-hukum-islam", diakses=DIAKSES_LAMA + " dan " + DIAKSES, resmi=False),
    "bpk-uu1-1974": dict(judul="UU Nomor 1 Tahun 1974 tentang Perkawinan (naskah asli)", url="https://peraturan.bpk.go.id/Details/47406/uu-no-1-tahun-1974", diakses=DIAKSES_LAMA, resmi=True),
    "bpk-uu16-2019": dict(judul="UU Nomor 16 Tahun 2019 tentang Perubahan atas UU 1/1974", url="https://peraturan.bpk.go.id/Details/122740/uu-no-16-tahun-2019", diakses=DIAKSES_LAMA, resmi=True),
    "bpk-pp9-1975": dict(judul="PP Nomor 9 Tahun 1975 tentang Pelaksanaan UU 1/1974", url="https://peraturan.bpk.go.id/Details/67678/pp-no-9-tahun-1975", diakses=DIAKSES_LAMA, resmi=True),
    "bpk-uu3-2006": dict(judul="UU Nomor 3 Tahun 2006 tentang Perubahan atas UU 7/1989 tentang Peradilan Agama", url="https://peraturan.bpk.go.id/Details/40154/uu-no-3-tahun-2006", diakses=DIAKSES_LAMA, resmi=True),
    "go-uu23-2002": dict(judul="UU Nomor 23 Tahun 2002 tentang Perlindungan Anak", url="https://peraturan.go.id/files/uu23-2002.pdf", diakses=DIAKSES_LAMA, resmi=True),
    "bpk-uu35-2014": dict(judul="UU Nomor 35 Tahun 2014 tentang Perubahan atas UU 23/2002", url="https://peraturan.bpk.go.id/Details/38723/uu-no-35-tahun-2014", diakses=DIAKSES_LAMA, resmi=True),
    "bpk-pp29-2019": dict(judul="PP Nomor 29 Tahun 2019 tentang Syarat dan Tata Cara Penunjukan Wali", url="https://peraturan.bpk.go.id/Download/97304", diakses=DIAKSES_LAMA, resmi=True),
    "kemenkeu-pp54-2007": dict(judul="PP Nomor 54 Tahun 2007 tentang Pelaksanaan Pengangkatan Anak (teks lengkap JDIH Kemenkeu)", url="https://jdih.kemenkeu.go.id/api/download/fulltext/2007/54TAHUN2007PP.htm", diakses=DIAKSES, resmi=True),
    "pnbengkalis-hir": dict(judul="Herzien Inlandsch Reglement (HIR) / Reglemen Indonesia yang Diperbaharui (S. 1941-44) beserta penjelasan - JDIH Pengadilan Negeri Bengkalis", url="JDIH PN Bengkalis: kolonial/data_kolonial/KOLONIAL_HERZIEN_INLANDSCH_REGLEMENT.pdf", diakses=DIAKSES_LAMA, resmi=True, catatan="sebagian ayat tidak bernomor di naskah; Pasal 197 dinomori menurut urutan paragraf (lihat catatan pasal)"),
    "pnbengkalis-kuhperdata": dict(judul="Kitab Undang-Undang Hukum Perdata (Burgerlijk Wetboek) - JDIH Pengadilan Negeri Bengkalis", url="JDIH PN Bengkalis: kolonial/data_kolonial (KUHPerdata)", diakses=DIAKSES_LAMA, resmi=True),
    "unnes-rbg": dict(judul="Reglemen Acara Hukum untuk Daerah Luar Jawa dan Madura (RBg, S. 1927-227) - terjemahan, repositori Universitas Negeri Semarang", url="(salinan lokal rbg-unnes.pdf)", diakses=DIAKSES_LAMA, resmi=False, catatan="bukan terbitan resmi; OCR berderau - dipakai sebagai pembanding TIDAK PASTI"),
    "badilag-buku2-2013": dict(judul="Buku II Pedoman Pelaksanaan Tugas dan Administrasi Peradilan Agama Edisi Revisi 2013 (Ditjen Badilag MA RI), salinan PA Rumbia", url="https://pa-rumbia.go.id/images/Pedoman_Organisasi/1-Buku-II-edisi-Rev_2013_Pedoman-Tugas-dan-Adm.pdf", diakses=DIAKSES_LAMA, resmi=True),
    "mkri-46-2010": dict(judul="Putusan MK Nomor 46/PUU-VIII/2010", url="https://s.mkri.id (putusan_sidang_46 PUU 2010-TELAH BACA.pdf)", diakses=DIAKSES_LAMA, resmi=True),
    "mkri-69-2015": dict(judul="Putusan MK Nomor 69/PUU-XIII/2015 (pengujian UU 5/1960 dan UU 1/1974), diucapkan 27 Oktober 2016", url="https://s.mkri.id/public/content/persidangan/putusan/69_PUU-XIII_2015.pdf", diakses=DIAKSES, resmi=True),
    "mkri-69-2015-laman": dict(judul="Laman putusan MK 69/PUU-XIII/2015 (tanggal, pemohon, amar: dikabulkan sebagian)", url="https://www.mkri.id/perkara/persidangan/putusan?search=69/PUU-XIII/2015", diakses=DIAKSES, resmi=True),
    "ma-direktori-69-2015": dict(judul="Direktori Putusan MA - Peraturan: Putusan MK 69/PUU-XIII/2015 (inkonstitusional bersyarat Pasal 29 ayat (1) UU 1/1974)", url="https://putusan3.mahkamahagung.go.id/peraturan/detail/11ead07ae29e12208cb7303933343339.html", diakses=DIAKSES, resmi=True),
    "ma-direktori-sema6-1983": dict(judul="Direktori Putusan MA - Peraturan: SEMA Nomor 6 Tahun 1983 tentang Penyempurnaan Surat Edaran Nomor 2 Tahun 1979 (lampiran PDF tidak dibaca)", url="https://putusan3.mahkamahagung.go.id/peraturan/detail/11e9bd96086b2ba49f22313334363039.html", diakses=DIAKSES, resmi=True),
}

# ── korpus: pemakaian per (peraturan, pasal) ───────────────────────────────────────────────────────────────────────────
kor = json.load(open(KORPUS, encoding="utf-8"))
dipakai = collections.Counter()
for s in kor["sumber"]:
    for r in s["rujukan"]:
        if not r["peraturan"] or r["penjelasan"]:
            continue
        for b in r["butir"]:
            nomor = [b["pasal"]]
            if b.get("rentangKe") and b["pasal"].isdigit() and b["rentangKe"].isdigit():
                a, z = int(b["pasal"]), int(b["rentangKe"])
                if 0 < z - a < 40:
                    nomor = [str(x) for x in range(a, z + 1)]
            for n in nomor:
                dipakai[(r["peraturan"], n.lower())] += 1

# ── pengurai naskah ────────────────────────────────────────────────────────────────────────────────────────────────────
R_PASAL_MENTAH = re.compile(r"^\s*Pasal\s+([0-9lI][0-9lI ]{0,4}[A-Za-z]?)\s*\.?\s*$")


class _RPasal:
    """Kepala pasal; derau OCR "Pasal l3" / "Pasal 1 1" dibetulkan (hanya bila memuat angka - "Pasal I" romawi tetap ditolak)."""

    def match(self, baris):
        m = R_PASAL_MENTAH.match(baris)
        if not m or not re.search(r"\d", m.group(1)):
            return None
        n = re.sub(r"\s+", "", m.group(1))
        n = re.sub(r"^([0-9lI]+)", lambda x: x.group(1).replace("l", "1").replace("I", "1"), n)
        if not re.match(r"^\d{1,4}[A-Za-z]?$", n):
            return None
        return _M(n)


class _M:
    def __init__(self, n):
        self.n = n

    def group(self, i):
        return self.n


R_PASAL = _RPasal()
R_BUTIR = re.compile(r"^(\(\d{1,3}[a-z]?\)|[a-z][.)]\s|\d{1,2}\.\s)")
R_GANGGU = [
    re.compile(r"^\s*PRESIDEN\s*$"), re.compile(r"^\s*REPUBLIK INDONESIA\s*$"), re.compile(r"^\s*-\s*\d+\s*-\s*$"),
    re.compile(r"^\s*\d{1,3}\s*$"), re.compile(r"^\s*=+\s*HALAMAN"), re.compile(r"^\s*www\.|hukumonline", re.I),
    re.compile(r"^\s*SK No\b"),
    # derau OCR kop halaman: "trRESIDEN", "REPUBLIK' INDONESIA", "REPUBLIK INDONESI.A", "-3-"
    re.compile(r"^\s*\S{0,3}RESIDEN\W*\s*$"), re.compile(r"^\s*REPUBLIK\W{0,2}\s+INDONES\W{0,2}I?\W{0,2}A\W*\s*$"),
    re.compile(r"^\s*-\s*\d+\s*-?\s*$"),
]
R_JUDUL = re.compile(r"^\s*(BAB\s+[IVXLC]+|Bagian\s+\w+|Paragraf\s+\d+|TITEL\b|BAGIAN\b)", re.I)


def ganggu(baris):
    if any(r.search(baris) for r in R_GANGGU):
        return True
    # petunjuk sambungan halaman di tepi kanan ("b. Salah ...")
    return len(baris) - len(baris.lstrip()) > 40 and baris.rstrip().endswith("...")


def huruf_besar_semua(t):
    t = t.strip()
    return len(t) > 3 and not re.search(r"[a-z]", t) and re.search(r"[A-Z]{3}", t) and not R_BUTIR.match(t)


def rapikan(baris_list):
    """Gabung baris sambungan; butir baru = (n) / x. / n. di awal baris."""
    keluar = []
    ayat_akhir = 0
    for b in baris_list:
        t = b.strip().strip('"\u201c\u201d')
        if not t:
            continue
        # Ayat hanya bila nomornya urutan berikutnya: "dalam ayat\n(1) Pegawai ..." (putus baris di tengah kalimat) = sambungan.
        # Derau OCR "(21 Berakhirnya" / "(I) ..." dibetulkan bila memang urutan berikutnya.
        m = re.match(r"^\((\d{1,3}|I|l)\)\s*|^\((\d)[1lI]\s+", t)
        if m:
            n = int((m.group(1) or m.group(2)).replace("I", "1").replace("l", "1"))
            if n == ayat_akhir + 1:
                ayat_akhir = n
                t = "(%d) %s" % (n, t[m.end():])
            elif keluar:
                keluar[-1] += " " + t
                continue
        if keluar and not R_BUTIR.match(t):
            if keluar[-1].endswith("-") and t[:1].islower():
                keluar[-1] = keluar[-1][:-1] + t
            else:
                keluar[-1] += " " + t
        else:
            keluar.append(t)
    return [re.sub(r"\s+", " ", x).strip() for x in keluar]


def urai_bpk(path, berhenti=r"^\s*PENJELASAN\s*$", akhir_ubah=False):
    """Naskah resmi berformat BPK: Pasal N di baris sendiri, ayat (n), huruf a. Berhenti di PENJELASAN."""
    hasil = {}
    kini, isi = None, []
    R_STOP = re.compile(berhenti)
    R_UBAH = re.compile(r"^\s*\d{1,3}\.\s+(Ketentuan|Di antara|Pasal\s+\S+\s+dihapus|Penjelasan|Judul|Bagian)", re.I)

    def tutup():
        if kini and kini not in hasil:
            baris = rapikan(isi)
            if baris:
                hasil[kini] = "\n".join(baris)

    for baris in open(path, encoding="utf-8", errors="replace").read().splitlines():
        if R_STOP.match(baris):
            break
        if ganggu(baris):
            continue
        m = R_PASAL.match(baris.replace('"', "").replace("\u201c", ""))
        if m:
            tutup()
            kini, isi = m.group(1).lower(), []
            continue
        if re.match(r"^\s*Pasal\s+[IVX]+\s*$", baris):
            tutup()
            kini, isi = None, []
            continue
        if kini is None:
            continue
        if R_JUDUL.match(baris) or huruf_besar_semua(baris) or (akhir_ubah and R_UBAH.match(baris)):
            tutup()
            kini, isi = None, []
            continue
        isi.append(baris)
    tutup()
    return hasil


def urai_paragraf(path, mulai=None, berhenti_pasal=r"^\s*Penjelasan\s*:?\s*$", buang_catatan=False):
    """HIR/KUHPerdata/RBg: paragraf baru = baris tanpa inden atau (n). -> {pasal: (bunyi, ayat_tak_bernomor, paragraf)}"""
    hasil = {}
    kini, par, dalam_penjelasan = None, [], False
    R_PJ = re.compile(berhenti_pasal)

    def tutup():
        if not kini or kini in hasil:
            return
        ps = [re.sub(r"\s+", " ", " ".join(p)).strip() for p in par if " ".join(p).strip()]
        if buang_catatan:
            ps = [re.sub(r"\s*\((?:s\.d\.u\.|Rv\.|IR\.|IR |KUHPerd|Ov\.|S\.\s?\d)[^)]{0,80}\)\s*\.?\s*$", "", p).strip() for p in ps]
            ps = [re.sub(r"^\((?:s\.d\.u\.|s\.d\.t\.)[^)]{0,60}\)\s*", "", p).strip() for p in ps]
        ps = [p for p in ps if p]
        if not ps:
            return
        bernomor = any(re.match(r"^\(\d{1,3}\)", p) for p in ps)
        hasil[kini] = ("\n".join(ps), (not bernomor) and len(ps) > 1, ps)

    for baris in open(path, encoding="utf-8", errors="replace").read().splitlines():
        if ganggu(baris):
            continue
        m = R_PASAL.match(baris)
        if m:
            tutup()
            kini, par, dalam_penjelasan = m.group(1).lower(), [], False
            continue
        if kini is None or dalam_penjelasan:
            continue
        if R_PJ.match(baris):
            dalam_penjelasan = True
            continue
        if R_JUDUL.match(baris) or huruf_besar_semua(baris):
            tutup()
            kini = None
            continue
        if not baris.strip():
            continue
        if not baris.startswith((" ", "\t")) or re.match(r"^\s*\(\d{1,3}\)", baris):
            par.append([baris.strip()])
        elif par:
            last = par[-1]
            if last and last[-1].endswith("-"):
                last[-1] = last[-1][:-1] + baris.strip()
            else:
                last.append(baris.strip())
        else:
            par.append([baris.strip()])
    tutup()
    return hasil


# ── KHI ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
def kata(t):
    t = t.lower().replace("isteri", "istri")
    return re.sub(r"[^a-z0-9]+", " ", t).split()


def pasangan(k):
    return {k[i] + " " + k[i + 1] for i in range(len(k) - 1)}


ocr_khi = pasangan(kata(open(U + "/khi/khi.txt", encoding="utf-8", errors="replace").read()))
khi_md = {}
md = open(REF + "/KHI-pasal-terverifikasi.md", encoding="utf-8").read()
for m in re.finditer(r"^### Pasal (\d+)\s*\n(.*?)(?=^### |\Z)", md, re.S | re.M):
    baris = [b[1:].strip() for b in m.group(2).splitlines() if b.startswith(">")]
    if baris:
        khi_md[m.group(1)] = "\n".join(b for b in baris if b)
khi_pid = {str(k): v for k, v in json.load(open(U + "/khi/khi-pasalid.json", encoding="utf-8")).items()}
khi_pid.update({str(k): v for k, v in json.load(open(KHI_TAMBAH, encoding="utf-8")).items()})


def bersih_pid(t):
    baris = [b.strip() for b in t.splitlines()]
    if baris and re.match(r"^Pasal \d+$", baris[0]):
        baris = baris[1:]
    return "\n".join(rapikan(baris))


def gram5(t):
    s = re.sub(r"[^a-z]+", "", t.lower().replace("isteri", "istri"))
    return {s[i:i + 5] for i in range(len(s) - 4)}


ocr_khi5 = gram5(open(U + "/khi/khi.txt", encoding="utf-8", errors="replace").read())


def skor_ocr(t):
    """Bagian 5-gram huruf (tanpa spasi/tanda baca) teks pasal.id yang ada di OCR naskah Kemenag - tahan derau OCR per huruf."""
    p = gram5(t)
    return (sum(1 for x in p if x in ocr_khi5) / len(p)) if p else 0.0


# ── susun ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
PERATURAN = {}
PASAL = {}


def per(kode, nama, cakupan, sumber, pasalTerakhir=None, catatan=None):
    d = dict(nama=nama, cakupan=cakupan, sumber=sumber)
    if pasalTerakhir:
        d["pasalTerakhir"] = pasalTerakhir
    if catatan:
        d["catatan"] = catatan
    PERATURAN[kode] = d


def pasal(kode, nomor, bunyi, status, sumber, catatan=None, ayatTakBernomor=False):
    d = dict(peraturan=kode, pasal=str(nomor).lower(), bunyi=bunyi or "", status=status if bunyi else "belum", sumber=sumber if bunyi else [])
    if catatan:
        d["catatan"] = catatan
    if ayatTakBernomor:
        d["ayatTakBernomor"] = True
    d["dipakai"] = dipakai.get((kode, str(nomor).lower()), 0)
    PASAL[(kode, str(nomor).lower())] = d


# KHI - utuh menurut nomor (1-229); bunyi untuk pasal yang dipakai + yang sudah terverifikasi.
per("KHI", "Kompilasi Hukum Islam", "sebagian", ["kemenag-khi", "pasalid-khi"], 229)
khi_pakai = sorted({n for (k, n) in dipakai if k == "KHI"} | set(khi_md), key=lambda x: int(re.match(r"\d+", x).group(0)))
skor_md = []
def _segmen_ocr_khi():
    """Segmen OCR naskah Kemenag per nomor pasal (kepala "Pasal N" di baris sendiri; derau l/I/O dibetulkan)."""
    baris = open(U + "/khi/khi.txt", encoding="utf-8", errors="replace").read().splitlines()
    # Buku memuat UU 7/1989 lebih dulu, lalu KHI, lalu penjelasan KHI: hanya batang tubuh KHI (judul "KOMPILASI HUKUM ISLAM"
    # sampai Pasal 229).
    mulai = next(i for i, b in enumerate(baris) if re.match(r"^\s*KOMPILASI HUKUM ISLAM\s*$", b))
    akhir_khi = next(i for i, b in enumerate(baris) if re.match(r"^\s*Pasal\s*229\s*$", b)) + 30
    kepala = []
    for i, b in enumerate(baris):
        if i < mulai or i > akhir_khi:
            continue
        m = re.match(r"^\s*Pasal\s*([0-9lIO][0-9lIO ]{0,4})\s*$", b)
        if not m:
            continue
        n = re.sub(r"\s+", "", m.group(1)).replace("l", "1").replace("I", "1").replace("O", "0")
        if not n.isdigit():
            continue
        n, sebelum = int(n), (kepala[-1][1] if kepala else 0)
        harap = sebelum + 1
        # OCR menjatuhkan/menukar angka ("Pasal 16" sesudah Pasal 115 = 116): dibetulkan menurut urutan.
        if n != harap and (str(harap).endswith(str(n)) or str(harap).startswith(str(n))):
            n = harap
        if n <= sebelum:
            continue
        kepala.append((i, n))
    seg = {}
    for j, (i, n) in enumerate(kepala):
        akhir = kepala[j + 1][0] if j + 1 < len(kepala) else min(len(baris), i + 80)
        if n not in seg and 1 <= n <= 229:
            seg[n] = "\n".join(baris[i + 1:akhir])
    return seg


SEG_KHI = _segmen_ocr_khi()


def _hitung_butir(t, ocr):
    ayat = len(re.findall(r"(?m)^\s*\(\s*[0-9Il]{1,2}\s*\)\.?", t))
    huruf = len(re.findall(r"(?m)^\s*[a-k]\s*[.,]\s", t)) if not ocr else len(re.findall(r"(?m)^\s*[a-k]\s*[.,]\s", t))
    return ayat, huruf


def periksa_khi(n, teks):
    """(ok, catatan): teks pasal.id dibandingkan dengan SEGMEN OCR pasal yang sama - isi (5-gram), panjang, banyak ayat & huruf."""
    seg = SEG_KHI.get(int(re.match(r"\d+", n).group(0)))
    if seg is None:
        return False, "segmen pasal ini tidak ditemukan di OCR naskah Kemenag - perlu dibaca manual"
    g = gram5(teks)
    gs = gram5(seg)
    isi = (sum(1 for x in g if x in gs) / len(g)) if g else 0.0
    pj = len(re.sub(r"[^a-z]", "", teks.lower())) / max(1, len(re.sub(r"[^a-z]", "", seg.lower())))
    a1, h1 = _hitung_butir(teks, False)
    a2, h2 = _hitung_butir(seg, True)
    sebab = []
    # OCR naskah berderau (5-gram pasal yang dicocokkan manual: 50-90% per segmen) - ambang segmen lebih longgar daripada
    # ambang seluruh naskah; yang dijaga: isi pasal yang sama, tidak terpotong (panjang), ayat/huruf tidak hilang.
    if isi < AMBANG_SEGMEN:
        sebab.append("isi %d%%" % round(isi * 100))
    if not (0.8 <= pj <= 1.25):
        sebab.append("panjang %d%% dari naskah" % round(pj * 100))
    if a2 and a1 != a2:
        sebab.append("ayat %d vs %d di naskah" % (a1, a2))
    if h2 > h1:
        sebab.append("huruf %d vs %d di naskah" % (h1, h2))
    if sebab:
        return False, "tidak cocok dengan OCR naskah Kemenag (" + ", ".join(sebab) + ") - perlu dibaca manual"
    return True, "dicocokkan otomatis dengan OCR naskah Kemenag pasal yang sama: isi %d%%, panjang %d%%, ayat %d, huruf %d" % (round(isi * 100), round(pj * 100), a1, h1)


for n in khi_pakai:
    if n in khi_md:
        # Daftar manual mencocokkan "bagian yang relevan": bunyi utuh diambil dari pasal.id bila ada; bila pemeriksaan otomatis
        # mendapati teks itu lebih pendek dari naskah, pasal ditandai belum tentu lengkap (temuan ayat/huruf tidak pasti).
        b = bersih_pid(khi_pid[n]) if n in khi_pid else khi_md[n]
        ok, cat = periksa_khi(n, b) if n in khi_pid else (False, "")
        if n in khi_pid:
            skor_md.append(ok)
        pendek_ = "panjang" in cat and re.search(r"panjang (\d+)%", cat) and int(re.search(r"panjang (\d+)%", cat).group(1)) < 80
        pasal("KHI", n, b, "terverifikasi", ["kemenag-khi", "pasalid-khi"],
              "dicocokkan dengan naskah Kemenag pada bagian yang relevan (KHI-pasal-terverifikasi.md, 18 Okt 2026)" + ("; teks mungkin tidak lengkap - " + cat if pendek_ else ""))
        if pendek_:
            PASAL[("KHI", n)]["lengkap"] = False
    elif n in khi_pid:
        b = bersih_pid(khi_pid[n])
        ok, cat = periksa_khi(n, b)
        pasal("KHI", n, b, "terverifikasi" if ok else "belum", ["kemenag-khi", "pasalid-khi"] if ok else ["pasalid-khi"], cat)
        if not ok:
            # Belum dicocokkan: kelengkapan teks pasal.id juga belum pasti (sebagian terpotong, mis. Pasal 131 hanya ayat (1)).
            PASAL[("KHI", n)]["lengkap"] = False
    elif int(re.match(r"\d+", n).group(0)) <= 229:
        pasal("KHI", n, "", "belum", [], "bunyi belum diambil")

# UU 1/1974 (+ Pasal 7 sesudah UU 16/2019) - utuh
uu1 = urai_bpk(U + "/uu1-1974/uu1-1974-bpk.txt")
uu16 = urai_bpk(U + "/uu16-2019/uu16-2019-bpk.txt", akhir_ubah=True)
per("UU-1-1974", "Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan", "utuh", ["bpk-uu1-1974", "bpk-uu16-2019"], 67,
    "Pasal 7 dimuat menurut UU 16/2019; Pasal 29 ayat (1), (3), (4) dimaknai Putusan MK 69/PUU-XIII/2015; Pasal 43 ayat (1) dimaknai Putusan MK 46/PUU-VIII/2010 (lihat dokumen)")
for n, b in uu1.items():
    cat = None
    src = ["bpk-uu1-1974"]
    if n == "7" and "7" in uu16:
        b, src, cat = uu16["7"], ["bpk-uu16-2019"], "bunyi sesudah diubah UU 16/2019 (naskah asli: pria 19 tahun, wanita 16 tahun)"
    if n == "29":
        cat = "ayat (1), (3), (4) inkonstitusional bersyarat - dimaknai Putusan MK 69/PUU-XIII/2015 (perjanjian dapat dibuat pada waktu, sebelum dilangsungkan, atau selama dalam ikatan perkawinan)"
    if n == "43":
        cat = "ayat (1) dimaknai Putusan MK 46/PUU-VIII/2010"
    pasal("UU-1-1974", n, b, "terverifikasi", src, cat)
per("UU-16-2019", "Undang-Undang Nomor 16 Tahun 2019 tentang Perubahan atas UU 1/1974", "sebagian", ["bpk-uu16-2019"], None, "pasal yang dirujuk = pasal UU 1/1974 yang diubahnya")
for n, b in uu16.items():
    pasal("UU-16-2019", n, b, "terverifikasi", ["bpk-uu16-2019"], "bunyi pasal UU 1/1974 sebagaimana diubah")

# PP 9/1975 - utuh
pp9 = urai_bpk(U + "/pp9-1975/pp9-1975-bpk.txt")
per("PP-9-1975", "Peraturan Pemerintah Nomor 9 Tahun 1975 tentang Pelaksanaan UU 1/1974", "utuh", ["bpk-pp9-1975"], 49)
for n, b in pp9.items():
    pasal("PP-9-1975", n, b, "terverifikasi", ["bpk-pp9-1975"])

# UU 7/1989 (bunyi pasal yang diubah UU 3/2006 = belum: perubahan UU 50/2009 belum dibaca) dan UU 3/2006
uu3 = urai_bpk(U + "/ekstra/uu3-2006.txt", akhir_ubah=True)
per("UU-7-1989", "Undang-Undang Nomor 7 Tahun 1989 tentang Peradilan Agama (diubah UU 3/2006 dan UU 50/2009)", "sebagian", ["bpk-uu3-2006"], 108,
    "naskah UU 7/1989 dan UU 50/2009 belum ada di folder referensi; bunyi yang dimuat = pasal yang diubah UU 3/2006")
per("UU-3-2006", "Undang-Undang Nomor 3 Tahun 2006 tentang Perubahan atas UU 7/1989 tentang Peradilan Agama", "sebagian", ["bpk-uu3-2006"], None,
    "pasal yang dirujuk = pasal UU 7/1989 sebagaimana diubah")
for (k, n) in sorted(dipakai):
    if k == "UU-7-1989" and (k, n) not in PASAL:
        if n in uu3:
            pasal(k, n, uu3[n], "belum", ["bpk-uu3-2006"], "bunyi sesudah diubah UU 3/2006; perubahan kedua (UU 50/2009) belum dibaca")
        else:
            pasal(k, n, "", "belum", [], "naskah UU 7/1989 belum tersedia")
for n, b in uu3.items():
    pasal("UU-3-2006", n, b, "terverifikasi", ["bpk-uu3-2006"], "bunyi pasal UU 7/1989 sebagaimana diubah UU 3/2006")

# UU 23/2002 + UU 35/2014
uu23 = urai_bpk(U + "/ekstra/uu23-2002.txt")
uu35 = urai_bpk(U + "/ekstra/uu35-2014.txt", akhir_ubah=True)
per("UU-23-2002", "Undang-Undang Nomor 23 Tahun 2002 tentang Perlindungan Anak (diubah UU 35/2014)", "utuh", ["go-uu23-2002", "bpk-uu35-2014"], 93)
for n, b in uu23.items():
    if n in uu35:
        pasal("UU-23-2002", n, uu35[n], "terverifikasi", ["bpk-uu35-2014"], "bunyi sesudah diubah UU 35/2014")
    else:
        pasal("UU-23-2002", n, b, "terverifikasi", ["go-uu23-2002"])
for n, b in uu35.items():
    if ("UU-23-2002", n) not in PASAL:
        pasal("UU-23-2002", n, b, "terverifikasi", ["bpk-uu35-2014"], "pasal sisipan UU 35/2014")
per("UU-35-2014", "Undang-Undang Nomor 35 Tahun 2014 tentang Perubahan atas UU 23/2002", "sebagian", ["bpk-uu35-2014"], None, "pasal yang dirujuk = pasal UU 23/2002 sebagaimana diubah")
for n, b in uu35.items():
    pasal("UU-35-2014", n, b, "terverifikasi", ["bpk-uu35-2014"], "bunyi pasal UU 23/2002 sebagaimana diubah")

# PP 29/2019
pp29 = urai_bpk(U + "/ekstra/pp29-2019.txt")
per("PP-29-2019", "Peraturan Pemerintah Nomor 29 Tahun 2019 tentang Syarat dan Tata Cara Penunjukan Wali", "utuh", ["bpk-pp29-2019"], max(int(re.match(r"\d+", x).group(0)) for x in pp29) if pp29 else None)
for n, b in pp29.items():
    pasal("PP-29-2019", n, b, "terverifikasi", ["bpk-pp29-2019"])

# PP 54/2007 (HTML teks lengkap)
t54 = open(PP54, encoding="utf-8", errors="replace").read()
t54 = re.sub(r"<(br|/p|/div|/tr|/li|/h\d)[^>]*>", "\n", t54, flags=re.I)
t54 = H.unescape(re.sub(r"<[^>]+>", "", t54)).replace("\r", "")
_TMP54 = os.path.join(os.environ.get("TMP") or os.path.dirname(PP54), "rak-pp54.txt")
open(_TMP54, "w", encoding="utf-8").write(t54)
pp54 = urai_bpk(_TMP54)
per("PP-54-2007", "Peraturan Pemerintah Nomor 54 Tahun 2007 tentang Pelaksanaan Pengangkatan Anak", "utuh", ["kemenkeu-pp54-2007"], max(int(re.match(r"\d+", x).group(0)) for x in pp54) if pp54 else None)
for n, b in pp54.items():
    pasal("PP-54-2007", n, b, "terverifikasi", ["kemenkeu-pp54-2007"])

# HIR (JDIH PN Bengkalis) - pasal yang dipakai blangko/kode + padanan RBg yang dipakai paket hir-rbg-30okt
hir = urai_paragraf(U + "/hir-rbg-bw/hir-pn-bengkalis.txt")
per("HIR", "Herzien Inlandsch Reglement (HIR) / Reglemen Indonesia yang Diperbaharui", "sebagian", ["pnbengkalis-hir"],
    max(int(re.match(r"\d+", x).group(0)) for x in hir))
HIR_PADANAN = ["118", "120", "121", "122", "123", "124", "125", "126", "129", "130", "132a", "132b", "133", "134", "136", "144", "145", "147",
               "153", "155", "156", "163", "164", "165", "169", "170", "171", "172", "174", "175", "176", "178", "180", "181", "185", "195",
               "196", "197", "198", "199", "200", "226", "227", "390"]
for n in sorted({x for (k, x) in dipakai if k == "HIR"} | set(HIR_PADANAN), key=lambda x: (int(re.match(r"\d+", x).group(0)), x)):
    if n not in hir:
        pasal("HIR", n, "", "belum", [], "pasal tidak terbaca dari naskah lokal")
        continue
    b, tak, ps = hir[n]
    if n == "197":
        b = "\n".join("(%d) %s" % (i + 1, p) for i, p in enumerate(ps))
        pasal("HIR", n, b, "terverifikasi", ["pnbengkalis-hir", "badilag-buku2-2013"],
              "naskah tidak menomori ayat; %d paragraf dinomori (1)-(%d) menurut urutan. Penomoran dikuatkan: Buku II 2013 menyebut 'Pasal 197 (8) HIR / Pasal 211 RBg' untuk larangan menyita hewan/perkakas pencaharian (= paragraf ke-8), penjelasan naskah yang sama menyebut 'ayat (8)' untuk barang di tangan orang lain (= paragraf ke-8), dan catatan 'IR. 197 6,7' pada Pasal 210 RBg (dua saksi = paragraf ke-6 dan ke-7)" % (len(ps), len(ps)))
    else:
        pasal("HIR", n, b, "terverifikasi", ["pnbengkalis-hir"], "ayat tidak bernomor di naskah - pemeriksaan ayat dilewati" if tak else None, tak)

# RBg (terjemahan UNNES - belum)
rbg = urai_paragraf(U + "/hir-rbg-bw/rbg-unnes.txt", buang_catatan=True)
per("RBG", "Reglemen Acara Hukum untuk Daerah Luar Jawa dan Madura (RBg)", "sebagian", ["unnes-rbg"], 723,
    "naskah resmi belum tersedia; bunyi dari terjemahan UNNES (pembanding tidak pasti); padanan HIR di abt-paket/hir-rbg-30okt/hasil/tabel-padanan.md")
for n in sorted({x for (k, x) in dipakai if k == "RBG"}, key=lambda x: (int(re.match(r"\d+", x).group(0)), x)):
    if n in rbg:
        b, tak, _ = rbg[n]
        pasal("RBG", n, b, "belum", ["unnes-rbg"], "terjemahan tidak resmi" + ("; ayat tidak bernomor" if tak else ""), tak)
    else:
        pasal("RBG", n, "", "belum", [], "pasal tidak terbaca dari naskah terjemahan")

# KUHPerdata (JDIH PN Bengkalis)
kuh = urai_paragraf(U + "/hir-rbg-bw/kuhperdata-pn-bengkalis.txt")
per("KUHPERDATA", "Kitab Undang-Undang Hukum Perdata (Burgerlijk Wetboek)", "sebagian", ["pnbengkalis-kuhperdata"], 1993)
for n in sorted({x for (k, x) in dipakai if k == "KUHPERDATA"}, key=lambda x: (int(re.match(r"\d+", x).group(0)), x)):
    if n in kuh:
        b, tak, _ = kuh[n]
        pasal("KUHPERDATA", n, b, "terverifikasi", ["pnbengkalis-kuhperdata"], "ayat tidak bernomor di naskah - pemeriksaan ayat dilewati" if tak else None, tak)
    else:
        pasal("KUHPERDATA", n, "", "belum", [], "pasal tidak terbaca dari naskah lokal")

# Peraturan lain yang dipakai tanpa naskah lokal: entri BELUM tanpa bunyi.
NAMA = {
    "PERMA-1-2016": "PERMA Nomor 1 Tahun 2016 tentang Prosedur Mediasi di Pengadilan", "UU-10-2020": "UU Nomor 10 Tahun 2020 tentang Bea Meterai",
    "RV": "Reglement op de Rechtsvordering (Rv)", "PERMA-7-2022": "PERMA Nomor 7 Tahun 2022 tentang Perubahan PERMA 1/2019 (administrasi perkara elektronik)",
    "PERMA-3-2022": "PERMA Nomor 3 Tahun 2022 tentang Mediasi di Pengadilan secara Elektronik", "PERMA-5-2019": "PERMA Nomor 5 Tahun 2019 tentang Pedoman Mengadili Permohonan Dispensasi Kawin",
    "UU-11-2008": "UU Nomor 11 Tahun 2008 tentang Informasi dan Transaksi Elektronik", "UU-23-2006": "UU Nomor 23 Tahun 2006 tentang Administrasi Kependudukan",
    "PERMA-2-2015": "PERMA Nomor 2 Tahun 2015 tentang Tata Cara Penyelesaian Gugatan Sederhana", "UU-41-2004": "UU Nomor 41 Tahun 2004 tentang Wakaf",
    "PERMA-1-2019": "PERMA Nomor 1 Tahun 2019 tentang Administrasi Perkara dan Persidangan di Pengadilan secara Elektronik", "UU-48-2009": "UU Nomor 48 Tahun 2009 tentang Kekuasaan Kehakiman",
    "PP-10-1983": "PP Nomor 10 Tahun 1983 tentang Izin Perkawinan dan Perceraian bagi PNS", "PP-42-2006": "PP Nomor 42 Tahun 2006 tentang Pelaksanaan UU 41/2004 tentang Wakaf",
    "UU-18-2003": "UU Nomor 18 Tahun 2003 tentang Advokat", "PP-40-2019": "PP Nomor 40 Tahun 2019 tentang Pelaksanaan UU 23/2006 jo. UU 24/2013",
    "UU-23-2004": "UU Nomor 23 Tahun 2004 tentang Penghapusan Kekerasan dalam Rumah Tangga", "UU-22-1946": "UU Nomor 22 Tahun 1946 tentang Pencatatan Nikah, Talak dan Rujuk",
    "PP-45-1990": "PP Nomor 45 Tahun 1990 tentang Perubahan PP 10/1983", "UU-30-1999": "UU Nomor 30 Tahun 1999 tentang Arbitrase dan Alternatif Penyelesaian Sengketa",
    "INPRES-1-1991": "Instruksi Presiden Nomor 1 Tahun 1991 tentang Penyebarluasan KHI", "PERMA-14-2016": "PERMA Nomor 14 Tahun 2016 tentang Tata Cara Penyelesaian Perkara Ekonomi Syariah",
    "PP-45-2005": "PP Nomor 45 Tahun 2005 tentang Pendirian, Pengurusan, Pengawasan, dan Pembubaran BUMN", "UU-14-1985": "UU Nomor 14 Tahun 1985 tentang Mahkamah Agung",
    "UU-20-1947": "UU Nomor 20 Tahun 1947 tentang Peradilan Ulangan", "UUD-1945": "Undang-Undang Dasar Negara Republik Indonesia Tahun 1945",
}
for (k, n) in sorted(dipakai):
    if k in PERATURAN:
        if (k, n) not in PASAL and k not in ("UU-1-1974", "PP-9-1975", "UU-23-2002", "PP-29-2019", "PP-54-2007"):
            pasal(k, n, "", "belum", [], "bunyi belum diambil")
        continue
    per(k, NAMA.get(k, k), "sebagian", [], None, "naskah belum tersedia di folder referensi")
    pasal(k, n, "", "belum", [], "naskah belum tersedia")
for (k, n) in sorted(dipakai):
    if (k, n) not in PASAL and k in PERATURAN and PERATURAN[k]["cakupan"] == "sebagian":
        pasal(k, n, "", "belum", [], "bunyi belum diambil")

# ── dokumen (putusan MK, SEMA) ──────────────────────────────────────────────────────────────────────────────────────────
_b2 = open(U + "/hir-rbg-bw/bukuii-2013.txt", encoding="utf-8", errors="replace").read().splitlines()
_i = next(i for i, b in enumerate(_b2) if "Prosedur permohonan pemeriksaaan pengangkatan" in b)
BUKU2_ANGKAT = re.sub(r"\s+", " ", " ".join(b.strip() for b in _b2[_i:_i + 12])).strip()
DOKUMEN = [
    dict(kode="MK-69-PUU-XIII-2015", nama="Putusan Mahkamah Konstitusi Nomor 69/PUU-XIII/2015 (perjanjian perkawinan)", status="terverifikasi",
         sumber=["mkri-69-2015", "mkri-69-2015-laman", "ma-direktori-69-2015"],
         catatan="diputus RPH 21 Maret 2016 dan 18 Oktober 2016, diucapkan Kamis 27 Oktober 2016 pukul 10.51 WIB; amar 1.1-1.6 (Pasal 29 ayat (1), (3), (4) UU 1/1974 bertentangan dengan UUD 1945 dan tidak mempunyai kekuatan hukum mengikat sepanjang tidak dimaknai ...), 2 (pemuatan dalam Berita Negara), 3 (menolak selain dan selebihnya); halaman 156-158 naskah putusan",
         bunyi="\n".join([
             "(1) Pasal 29 ayat (1): \"Pada waktu, sebelum dilangsungkan atau selama dalam ikatan perkawinan kedua belah pihak atas persetujuan bersama dapat mengajukan perjanjian tertulis yang disahkan oleh pegawai pencatat perkawinan atau notaris, setelah mana isinya berlaku juga terhadap pihak ketiga sepanjang pihak ketiga tersangkut\"",
             "(3) Pasal 29 ayat (3): \"Perjanjian tersebut mulai berlaku sejak perkawinan dilangsungkan, kecuali ditentukan lain dalam Perjanjian Perkawinan\"",
             "(4) Pasal 29 ayat (4): \"Selama perkawinan berlangsung, perjanjian perkawinan dapat mengenai harta perkawinan atau perjanjian lainnya, tidak dapat diubah atau dicabut, kecuali bila dari kedua belah pihak ada persetujuan untuk mengubah atau mencabut, dan perubahan atau pencabutan itu tidak merugikan pihak ketiga\"",
         ])),
    dict(kode="MK-46-PUU-VIII-2010", nama="Putusan Mahkamah Konstitusi Nomor 46/PUU-VIII/2010 (hubungan perdata anak di luar perkawinan)", status="terverifikasi", sumber=["mkri-46-2010"],
         catatan="diputus 13 Februari 2012, diucapkan 17 Februari 2012 (VERIFIKASI-HUKUM.md, 18 Okt 2026)",
         bunyi="(1) Pasal 43 ayat (1) UU 1/1974 bertentangan dengan UUD 1945 sepanjang dimaknai menghilangkan hubungan perdata dengan laki-laki yang dapat dibuktikan berdasarkan ilmu pengetahuan dan teknologi dan/atau alat bukti lain menurut hukum mempunyai hubungan darah sebagai ayahnya; dibaca: anak yang dilahirkan di luar perkawinan mempunyai hubungan perdata dengan ibunya dan keluarga ibunya serta dengan laki-laki sebagai ayahnya yang dapat dibuktikan berdasarkan ilmu pengetahuan dan teknologi dan/atau alat bukti lain menurut hukum mempunyai hubungan darah, termasuk hubungan perdata dengan keluarga ayahnya"),
    dict(kode="SEMA-6-1983", nama="Surat Edaran Mahkamah Agung Nomor 6 Tahun 1983 tentang Penyempurnaan Surat Edaran Nomor 2 Tahun 1979 (pemeriksaan permohonan pengesahan/pengangkatan anak)", status="belum",
         sumber=["ma-direktori-sema6-1983", "badilag-buku2-2013"],
         catatan="keberadaan, nomor, dan judul terverifikasi di Direktori Putusan MA (1 Nov 2026); isi SEMA hanya tersedia sebagai lampiran PDF yang belum dibaca (perlu izin mengunduh). Yang dipakai ALETA (katalog saksi pengangkatan anak dh-buku2-2013-17) adalah kalimat Buku II 2013 hlm. 169-170 - sudah cocok",
         bunyi="Buku II 2013 hlm. 170 (dikutip apa adanya dari salinan teks): " + BUKU2_ANGKAT),
]

# Naskah asal berbahasa Belanda: bunyi Indonesianya terjemahan (beberapa terjemahan beredar) - kutipan beda kata tidak pasti salah.
for k in ("HIR", "RBG", "KUHPERDATA", "RV"):
    if k in PERATURAN:
        PERATURAN[k]["terjemahan"] = True

# Cakupan "utuh" hanya bila semua nomor 1..pasalTerakhir terbaca; selain itu "sebagian" (pasal yang tak terbaca = belum di rak).
for k, d in PERATURAN.items():
    if d["cakupan"] != "utuh":
        continue
    ada = {int(re.match(r"\d+", n).group(0)) for (kk, n), e in PASAL.items() if kk == k and e["bunyi"]}
    hilang = [n for n in range(1, (d.get("pasalTerakhir") or max(ada)) + 1) if n not in ada]
    if hilang:
        d["cakupan"] = "sebagian"
        d["catatan"] = ((d.get("catatan") or "") + "; " if d.get("catatan") else "") + "pasal tidak terbaca dari naskah: " + ", ".join(map(str, hilang))

# Pasal UU 1/1974 hanya yang dipakai + 29/43 (kecil); peraturan utuh tetap seluruhnya (dipakai untuk "pasal tidak ada").
rak = dict(
    skema="rak-peraturan/1",
    dibuat=DIAKSES,
    catatan="Disusun scripts/rak-peraturan/susun_rak.py dari naskah lokal (D:/aleta-dev/kerja/referensi) + korpus ALETA; jangan disunting tangan. Bunyi tidak pernah diketik dari ingatan.",
    sumber=SUMBER,
    peraturan=dict(sorted(PERATURAN.items())),
    pasal=sorted(PASAL.values(), key=lambda d: (d["peraturan"], int(re.match(r"\d+", d["pasal"]).group(0)), d["pasal"])),
    dokumen=DOKUMEN,
)
json.dump(rak, open(KELUAR, "w", encoding="utf-8", newline="\n"), ensure_ascii=False, indent=1)
st = collections.Counter((d["status"]) for d in rak["pasal"])
stp = collections.Counter((d["status"]) for d in rak["pasal"] if d["dipakai"])
print("peraturan", len(PERATURAN), "pasal", len(PASAL), dict(st), "dipakai:", dict(stp))
print("kalibrasi: pasal KHI yang dicocokkan manual dan juga lolos pemeriksaan otomatis: %d dari %d" % (sum(skor_md), len(skor_md)))
for k in sorted(PERATURAN):
    c = collections.Counter(d["status"] for d in rak["pasal"] if d["peraturan"] == k)
    print(" ", k, dict(c))
