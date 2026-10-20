# -*- coding: utf-8 -*-
"""
Pustaka bersama pembangun katalog saksi versi 2 untuk wasiat, hibah, wakaf dan ekonomi syariah (agen W2a-K2, 20-21 Okt 2026).
Memakai kerangka kalimat agen U5 (abt-paket/u5-ahli-waris/alat/kerangka.py) tanpa menyalinnya.
"""
import copy, json, os, re, subprocess, sys

AKAR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
sys.path.insert(0, os.path.join(AKAR, "abt-paket", "u5-ahli-waris", "alat"))
import kerangka as K  # noqa: E402
from kerangka import Q, bangun_q  # noqa: E402

KATALOG = os.path.join(AKAR, "ekstensi-sipp", "saksi-katalog")
V1 = os.path.join(AKAR, "abt-paket", "w2a-kebendaan", "katalog-v1-k2")
KAMUS_LAMA = "D:/Aplikasi/aleta/tmp/abt-variabel.json"


class Daftar:
    """Kumpulan butir baru satu jenis."""

    def __init__(self):
        self.semua = []

    def tambah(self, q, gaya="campur", **keadaan):
        q.gaya = gaya
        q.keadaan = keadaan or None
        self.semua.append(q)
        return q


def B(pada, maksud, A, Bv):
    return dict(pada=pada, maksud=maksud, A=A, B=Bv)


PETA_AKTIF = {}


def tanda(core):
    """Daftar kode pembawa fakta pada satu inti, dengan jumlah kemunculan (token <X> diperluas; sebutan pihak 0046 dan 0047 tidak dihitung)."""
    t = re.sub(r"<([A-Za-z0-9]+)>", lambda m: PETA_AKTIF.get(m.group(1), m.group(0)), core)
    kode = [k for k in re.findall(r"#(\d{4})#", t) if k not in ("0046", "0047")]
    slot = re.findall(r"\{[a-z]+\}", t)
    return sorted(kode) + sorted(slot)


def penanda_semua(teks):
    t = re.sub(r"<([A-Za-z0-9]+)>", lambda m: PETA_AKTIF.get(m.group(1), m.group(0)), teks)
    return sorted(re.findall(r"#\d{4}#|\{[^{}]*\}", t))


def periksa_inti(q):
    """Setiap daftar inti harus memuat himpunan penanda yang sama (mesin menolak bila tidak)."""
    for nama in ("melihat", "sebagian", "de_auditu", "mendengar"):
        daftar = getattr(q, nama)
        if daftar and isinstance(daftar, list) and daftar and isinstance(daftar[0], str):
            base = tanda(daftar[0])
            for c in daftar:
                assert tanda(c) == base, (q.id, nama, c, tanda(c), base)
    if q.berbeda:
        for kunci in ("A", "B"):
            daftar = q.berbeda[kunci]
            base = tanda(daftar[0])
            for c in daftar:
                assert tanda(c) == base, (q.id, "berbeda", kunci, c)
    for tv in q.teks_varian or []:
        assert penanda_semua(tv) == penanda_semua(q.teks), (q.id, "teksVarian", tv)
    for c in (q.melihat or []) + (q.sebagian or []) + (q.mendengar or []) + ((q.berbeda["A"] + q.berbeda["B"]) if q.berbeda else []):
        assert c[:1] != c[:1].upper() or not c[:1].isalpha(), (q.id, "inti diawali huruf besar", c)


NEGASI = re.compile(r"\b(tidak|bukan|belum|tanpa|tak|tiada|nihil|jangan)\b", re.I)


def periksa_negasi(q):
    """Jumlah kata negasi harus sama pada seluruh inti satu daftar (de-auditu memakai inti melihat)."""
    for nama in ("melihat", "sebagian", "mendengar"):
        daftar = getattr(q, nama)
        if daftar and isinstance(daftar, list) and isinstance(daftar[0], str):
            n = len(NEGASI.findall(daftar[0]))
            for c in daftar:
                assert len(NEGASI.findall(c)) == n, (q.id, nama, "negasi tidak sama", c)
    if q.berbeda:
        for kunci in ("A", "B"):
            daftar = q.berbeda[kunci]
            n = len(NEGASI.findall(daftar[0]))
            for c in daftar:
                assert len(NEGASI.findall(c)) == n, (q.id, "berbeda", kunci, "negasi tidak sama", c)


def kode_dipakai(kat):
    kode = set()
    for q in kat["pertanyaan"]:
        semua = [q["teks"]] + q.get("teksVarian", [])
        for ob in q["jawaban"].values():
            for x in ob if isinstance(ob, list) else [ob]:
                semua += x["saksi1"] + x["saksi2"]
        for t in semua:
            kode |= set(re.findall(r"#(\d{4})#", t))
    return kode


def kamus_lama():
    return set(json.load(open(KAMUS_LAMA, encoding="utf8")).keys())


def bangun(v1, modul, peta, versi=2):
    """Menambahkan isi `modul` (POKOK_BARU, DASAR_BARU, KEADAAN_BARU, DAFTAR, PEMBARUAN, CATATAN, PROFIL, BLANGKO) ke katalog v1."""
    kat = copy.deepcopy(v1)
    kat["versi"] = versi
    ids_lama = {p["id"] for p in kat["pertanyaan"]}
    for fn in getattr(modul, "PEMBARUAN", []):
        fn(kat)
    for d in modul.DASAR_BARU:
        assert d["id"] not in {x["id"] for x in kat["dasarHukum"]}, d["id"]
        kat["dasarHukum"].append(d)
    ids_dasar = {x["id"] for x in kat["dasarHukum"]}
    for p in modul.POKOK_BARU:
        assert p["id"] not in {x["id"] for x in kat["pokokPembuktian"]}, p["id"]
        for dh in p["dasarHukum"]:
            assert dh in ids_dasar, (p["id"], dh)
        kat["pokokPembuktian"].append(p)
    for k, v in modul.KEADAAN_BARU.items():
        assert k not in kat["keadaan"], k
        kat["keadaan"][k] = v
    galat = []
    PETA_AKTIF.clear()
    PETA_AKTIF.update(peta)
    for q in modul.DAFTAR.semua:
        assert q.id not in ids_lama, q.id
        try:
            periksa_inti(q)
            periksa_negasi(q)
            kat["pertanyaan"].append(bangun_q(q, peta))
        except (AssertionError, ValueError, KeyError) as e:
            galat.append("%s: %s" % (q.id, e))
    if galat:
        raise SystemExit("GALAT PEMBANGUNAN:" + chr(10) + chr(10).join(galat))
    urut = [p["urutan"] for p in kat["pertanyaan"]]
    assert len(urut) == len(set(urut)), "urutan kembar: %s" % sorted(x for x in set(urut) if urut.count(x) > 1)
    kat["pertanyaan"].sort(key=lambda p: p["urutan"])
    kat["catatanPetugas"] = list(kat.get("catatanPetugas", [])) + list(modul.CATATAN)
    if getattr(modul, "PROFIL", None):
        kat["profilSaksi"] = modul.PROFIL
    if getattr(modul, "BLANGKO_PERBAIKAN", None):
        modul.BLANGKO_PERBAIKAN(kat)
    lama = kamus_lama()
    baru = set(kat.get("variabelBaru", [])) | (kode_dipakai(kat) - lama)
    kat["variabelBaru"] = sorted(baru)
    # urutan kunci mengikuti v1
    return kat


def tulis(kat, nama):
    p = os.path.join(KATALOG, nama + ".json")
    with open(p, "w", encoding="utf-8", newline="\n") as f:
        json.dump(kat, f, ensure_ascii=False, indent=1)
        f.write("\n")
    return p


def periksa(berkas):
    r = subprocess.run(["node", os.path.join(os.path.dirname(os.path.abspath(__file__)), "periksa_katalog.js"), berkas], capture_output=True)
    return r.stdout.decode("utf-8", "replace") + r.stderr.decode("utf-8", "replace")


def dasar(id, rujukan, uraian, status, sumber):
    return dict(id=id, rujukan=rujukan, uraian=uraian, status=status, sumber=sumber)
