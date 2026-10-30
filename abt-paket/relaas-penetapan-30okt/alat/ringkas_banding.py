# -*- coding: utf-8 -*-
"""Ringkas hasil banding.py: per pasangan (lama -> baru) hitung perkara identik / beda menurut jenis beda yang DIHARAPKAN, dan
galat (render gagal, sisa penanda #NNNN#, DATA_TIDAK_ADA) lama vs baru. Beda yang tidak termasuk jenis yang diharapkan = LAIN
(harus 0, contoh dicetak).
pakai: python ringkas_banding.py <keluar.json> banding-*.jsonl"""
import collections
import json
import re
import sys

sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from banding import PASANGAN  # noqa: E402


def galat(v):
    return v is None or bool(re.search(r"#\d{4,5}#|DATA_TIDAK_ADA|TIDAK_BISA_LOAD|ERROR", v))


def jenis(lama, baru, a, b):
    if lama == baru:
        return "identik"
    if b in ("11204", "11214", "11216"):
        if lama == baru:
            return "identik"
        x = lama.replace("yang didaftarkan", " yang didaftarkan").replace("  yang", " yang")
        if x == baru:
            return "spasi sebelum 'yang didaftarkan'"
        if b == "11216":
            ekor = lambda t: re.sub(r"^(\d{2} \w+ \d{4}|\.\.\.)", "", t)  # noqa: E731
            return "tanggal putusan (bukan PHS)" + ("" if ekor(x) == ekor(baru) else " LAIN")
        if b == "11214":
            return "tanggal PHS ikrar (bukan PHS pokok)" + ("" if x.split(" yang", 1)[-1] == baru.split(" yang", 1)[-1] and x.endswith(";") == baru.endswith(";") else " LAIN")
        return "LAIN"
    if (a, b) == ("7108", "11205"):
        x = re.sub(r"^(.*?) NIK ", r"\1, NIK ", lama, count=1)
        if x == baru:
            return "koma sesudah nama"
        if re.sub(r"(sebagai (Penggugat|Pemohon)) I;$", r"\1;", baru) in (lama, x) or re.sub(r"(sebagai (Pemohon)) I;$", r"\1;", lama) == baru:
            return "nomor I menurut jumlah pihak"
        if re.sub(r"(sebagai (Penggugat|Pemohon)) I;$", r"\1;", baru) == x:
            return "koma + nomor I"
        return "LAIN"
    if (a, b) == ("7109", "11206"):
        x = re.sub(r"(sebagai (Tergugat|Termohon)) I;$", r"\1;", baru)
        if x == lama:
            return "nomor I (Tergugat lebih dari satu)"
        y = re.sub(r"agama [^,]*,", "agama Islam,", x, count=1)
        if y == lama:
            return "agama dari SIPP" if x == baru else "agama + nomor I"
        return "LAIN"
    if (a, b) in (("7008", "11207"), ("7006", "11208")):
        n = lambda s: re.sub(r"\s+", " ", s)  # noqa: E731
        UP = r"(?:Para )?(\w+) dapat mengajukan (banding|perlawanan \(verzet\)|kasasi)? ?dalam"

        def upaya_dari(s):
            m = re.search(UP, s)
            return (m.group(2) or "(kosong)").replace("perlawanan (verzet)", "verzet") if m else "-"

        def norm_upaya(s):
            s = re.sub(UP, "X dapat mengajukan X dalam", s)
            s = re.sub(r"sebagaimana (telah ditetapkan|ditentukan) dalam (Pasal (153|199) ayat \(1\) RBg|Pasal 46 ayat \(1\) Undang-Undang "
                       r"Nomor 14 Tahun 1985 tentang Mahkamah Agung sebagaimana telah diubah dengan Undang-Undang Nomor 5 Tahun 2004 dan "
                       r"perubahan kedua dengan Undang-Undang Nomor 3 Tahun 2009)", "sebagaimana DASAR", s)
            s = re.sub(r"Pemberitahuan isi putusan ini saya kirimkan secara elektronik melalui domisili elektronik (Kuasa Hukum )?\w+ yang telah "
                       r"terdaftar, yaitu \S+;", "CARA;", s)
            s = re.sub(r"Pemberitahuan isi putusan ini saya laksanakan melalui Surat Tercatat untuk selanjutnya disampaikan ke tempat "
                       r"tinggal/kediaman \w+;", "CARA;", s)
            return s
        lb, bb = norm_upaya(n(lama)), norm_upaya(n(baru))
        ul, ub = upaya_dari(n(lama)), upaya_dari(n(baru))
        if a == "7008" and "melalui Bupati" in lama and "melalui Bupati" not in baru:
            return "cabang Bupati (ghaib Tergugat) dibuang; upaya %s -> %s" % (ul, ub)
        if lb == bb:
            return "upaya %s -> %s" % (ul, ub)
        if ub == "-" and ul != "-" and re.sub(r"Bahwa terhadap putusan tersebut X dapat mengajukan X dalam [^;]*sebagaimana DASAR; ?", "", lb).strip() == bb.strip():
            return "upaya %s -> dibuang (cabut/coret/gugur)" % ul
        return "LAIN"
    if (a, b) in (("9564", "11209"), ("9565", "11210")):
        return "relaas kepada kuasa terbaca" if lama.startswith("....") and not baru.startswith("....") else "LAIN"
    if a == "0180":
        return "tanggal relaas (bukan tanggal PJS)"
    if (a, b) in (("1066", "11202"), ("1167", "11203")):
        return "PA tujuan delegasi dari SIPP" if not baru.startswith("...") else "PA tujuan belum dicatat = titik-titik"
    return "LAIN"


def main():
    hit = collections.defaultdict(collections.Counter)
    contoh = collections.defaultdict(list)
    gl = collections.Counter()
    gb = collections.Counter()
    gagal = []
    n = 0
    for f in sys.argv[2:]:
        for l in open(f, encoding="utf-8"):
            d = json.loads(l)
            if "galat" in d:
                gagal.append(d)
                continue
            n += 1
            v = d["nilai"]
            for a, b in PASANGAN:
                la, ba = v.get(a), v.get(b)
                if galat(la):
                    gl[a] += 1
                if galat(ba):
                    gb[b] += 1
                j = jenis(la or "", ba or "", a, b)
                hit["%s->%s" % (a, b)][j] += 1
                if j == "LAIN" or len(contoh["%s->%s %s" % (a, b, j)]) < 2:
                    contoh["%s->%s %s" % (a, b, j)].append({"perkara": d["perkara"], "lama": (la or "")[:500], "baru": (ba or "")[:500]})
    hasil = {"perkara": n, "render_gagal": len(gagal), "galat_lama": gl, "galat_baru": gb, "pasangan": hit, "contoh": contoh}
    json.dump(hasil, open(sys.argv[1], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("perkara", n, "render gagal", len(gagal))
    print("galat lama", dict(gl))
    print("galat baru", dict(gb))
    for k, c in hit.items():
        print(k, dict(c))
    for k, c in contoh.items():
        if " LAIN" in k:
            print("LAIN", k, len(c), json.dumps(c[:2], ensure_ascii=False)[:1500])


main()
