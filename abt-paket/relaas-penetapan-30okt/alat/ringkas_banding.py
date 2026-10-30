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
    if b in ("11204", "11214"):
        if lama == baru:
            return "identik"
        x = lama.replace("yang didaftarkan", " yang didaftarkan").replace("  yang", " yang")
        if x == baru:
            return "spasi sebelum 'yang didaftarkan'"
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
        def norm_upaya(s):
            s = re.sub(r"dapat mengajukan (banding|perlawanan \(verzet\))? ?dalam", "dapat mengajukan X dalam", s)
            return re.sub(r"sebagaimana (telah ditetapkan|ditentukan) dalam Pasal (153|199) ayat \(1\) RBg", "sebagaimana DASAR", s)
        lb, bb = norm_upaya(n(lama)), norm_upaya(n(baru))
        bb2 = bb
        bb3 = re.sub(r"Pemberitahuan isi putusan ini saya kirimkan secara elektronik melalui domisili elektronik (Kuasa Hukum )?\w+ yang telah "
                     r"terdaftar, yaitu \S+;", "Pemberitahuan isi putusan ini saya laksanakan melalui Surat Tercatat untuk selanjutnya "
                     r"disampaikan ke tempat tinggal/kediaman X;", bb2)
        lb3 = re.sub(r"kediaman (Penggugat|Pemohon|Tergugat|Termohon);", "kediaman X;", lb)
        bb3 = re.sub(r"kediaman (Penggugat|Pemohon|Tergugat|Termohon);", "kediaman X;", bb3)
        if bb2 == lb:
            return "upaya hukum/dasar pasal"
        if bb3 == lb3:
            return "upaya hukum + domisili elektronik"
        bb4 = bb2.replace(" (verzet)", "").replace("perlawanan", "")
        if a == "7008" and "melalui Bupati" in lb and "melalui Bupati" not in bb:
            return "cabang Bupati (ghaib Tergugat) dibuang"
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
