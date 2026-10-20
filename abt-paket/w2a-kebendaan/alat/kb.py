# -*- coding: utf-8 -*-
"""
Perkakas bersama pembangun katalog saksi versi 2 harta bersama dan kewarisan (agen W2a-K1, 20-21 Okt 2026).
Meniru abt-paket/u5-ahli-waris/alat/katalog_v2.py: butir baru ditulis lewat Q(...) lalu dijadikan JSON skema saksi-katalog/1
oleh kerangka.bangun_q. Pemeriksa akhir: periksa_katalog.js (mesin repo) dan uji manajemen_surat/src/test/w2a-k1-hb-waris.test.ts.
"""
import json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kerangka import Q, bangun_q  # noqa: E402,F401


GALAT = []


def periksa_ragu(q):
    for c in (q.melihat or []):
        if isinstance(c, str):
            assert not POLA_RAGU.search(c), (q.id, "melihat memuat kata ragu", c)


class Berkas:
    """Satu katalog yang sedang dibangun: kumpulan Q baru + pokok + dasar hukum + keadaan."""

    def __init__(self, peta):
        self.peta = peta
        self.semua = []

    def tambah(self, q, gaya="tahu", **keadaan):
        q.gaya = gaya
        keadaan = dict(getattr(q, "ke_kw", {}) or {}, **keadaan)
        q.keadaan = keadaan or None
        # pengecualian (kunci "bukan_X") ditulis dengan awalan "bukan:" pada keadaan
        if q.keadaan:
            q.keadaan = {k.replace("bukan_", "bukan:"): v for k, v in q.keadaan.items()}
        for fn in (periksa_inti, periksa_ragu):
            try:
                fn(q)
            except AssertionError as e:
                GALAT.append(str(e.args[0] if e.args else e))
        self.semua.append(q)
        return q


def selesai():
    if GALAT:
        for g in GALAT:
            print("GALAT:", g)
        raise SystemExit("%d galat inti" % len(GALAT))


def B(pada, maksud, A, Bv):
    return dict(pada=pada, maksud=maksud, A=A, B=Bv)


# Penanda sebutan pihak boleh berbeda antar kalimat (aturan 7.3 butir 2); selebihnya wajib sama.
def tanda(core):
    t = re.findall(r"#\d{4}#|<[A-Z]+>|\{[a-z]+\}", core)
    return sorted(x for x in t if x not in ("<PM>", "<TG>", "<PW>", "<PS>", "#0046#", "#0047#", "{pengaju}", "{lawan}"))


POLA_NEGASI = re.compile(r"\b(tidak|bukan|belum|tanpa|tak|tiada|nihil|jangan)\b", re.I)
POLA_RAGU = re.compile(r"\b(ragu|tidak yakin|kurang yakin|lupa|tidak ingat|kurang pasti|kurang jelas|kira-kira|mungkin|rasanya|entah|belum pasti|tidak pasti|tidak begitu jelas|samar|tidak begitu ingat|kurang ingat)\b", re.I)


def negasi(c):
    return len(POLA_NEGASI.findall(c))


def periksa_inti(q):
    """Setiap daftar inti memuat himpunan penanda pembawa fakta yang sama (mesin menolak bila tidak)."""
    for nama in ("melihat", "sebagian", "mendengar", "de_auditu"):
        daftar = getattr(q, nama)
        if daftar and not isinstance(daftar, (dict, tuple)):
            base = tanda(daftar[0])
            for c in daftar:
                assert tanda(c) == base, (q.id, nama, c, tanda(c), base)
    if q.berbeda and "A" in q.berbeda:
        for kunci in ("A", "B"):
            daftar = q.berbeda[kunci]
            base = tanda(daftar[0])
            for c in daftar:
                assert tanda(c) == base, (q.id, "berbeda", kunci, c)
    if q.teks_varian:
        for tv in q.teks_varian:
            assert sorted(re.findall(r"#\d{4}#|<[A-Z]+>", tv)) == sorted(re.findall(r"#\d{4}#|<[A-Z]+>", q.teks)), (q.id, "penanda teks_varian", tv)
    # inti tidak boleh memuat digit di luar penanda (invarian angka) atau 'ya, '
    for nama in ("melihat", "sebagian", "mendengar", "de_auditu"):
        daftar = getattr(q, nama)
        if daftar and not isinstance(daftar, (dict, tuple)):
            for c in daftar:
                sisa = re.sub(r"#\d{4}#", "", c)
                assert not re.search(r"\d", sisa), (q.id, nama, c)
                assert "sayang" not in c.lower(), (q.id, c)
