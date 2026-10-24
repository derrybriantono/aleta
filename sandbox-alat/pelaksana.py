#!/usr/bin/env python3
# =============================================================================
# SANDBOX ALAT BANTU ALETA Ai (tahap 3, 25 Okt 2026)
# =============================================================================
#
# Menjalankan skrip deterministik proyek V4.5 (aleta/*.py) atas permintaan
# portal, di kontainer TANPA JARINGAN. Portal tidak pernah memanggil kontainer
# ini lewat jaringan: keduanya berbagi folder antrian (SPOOL).
#
#   SPOOL/masuk/<id>/tugas.json   {"alat": "...", "masukan": {...}, "batas_detik": 30}
#   SPOOL/masuk/<id>/berkas/*     berkas masuk (mis. naskah.md)
#   SPOOL/keluar/<id>/hasil.json  {"ok": true, "keluaran": ...} | {"ok": false, "galat": "..."}
#   SPOOL/keluar/<id>/berkas/*    berkas keluaran skrip (folder ./keluar milik skrip)
#
# PENJAGA (lapis kedua; lapis pertama di portal: sandbox.ts ALAT_BANTU):
#   - hanya alat yang tertulis di IZIN (izin.json, baca-saja): alat -> skrip;
#     skrip harus berada di folder SKRIP (baca-saja), berakhiran .py;
#   - tiap skrip jalan sebagai proses sendiri: python -I -B, env kosong,
#     batas waktu, memori (RLIMIT_AS), CPU, ukuran berkas, jumlah berkas;
#   - folder kerja sementara per tugas, dihapus sesudahnya.
#
# IZIN per alat: {"skrip": "aleta_alat.py", "argumen": ["terbilang", "{angka}"]}
#   - SUBPERINTAH tetap ditulis di izin (bukan dari model/portal);
#   - "{nama}" diisi dari masukan; nilainya wajib teks/angka pendek tanpa
#     karakter kendali dan TIDAK diawali "-" (tidak bisa menyisipkan opsi);
#     "{format}" hanya docx/rtf/pdf.
# Kontrak skrip: argumen di atas; masukan juga dikirim sebagai JSON di stdin;
# keluaran JSON/teks di stdout; berkas keluaran ke ./keluar/; berkas masuk di
# ./masuk/ (naskah.md, naskah.txt, data.json).
#
#   python3 pelaksana.py            jalan terus (kontainer)
#   python3 pelaksana.py --sekali   kerjakan antrian yang ada lalu keluar (uji)
# =============================================================================
import json
import os
import re
import resource
import shutil
import subprocess
import sys
import tempfile
import time

SPOOL = os.environ.get("SANDBOX_SPOOL", "/spool")
SKRIP = os.path.realpath(os.environ.get("SANDBOX_SKRIP", "/skrip"))
IZIN = os.environ.get("SANDBOX_IZIN", "/etc/sandbox-alat/izin.json")
KERJA = os.environ.get("SANDBOX_KERJA", tempfile.gettempdir())
MEMORI_MB = int(os.environ.get("SANDBOX_MEMORI_MB", "256"))
BATAS_DETIK_MAKS = int(os.environ.get("SANDBOX_BATAS_DETIK", "60"))
BATAS_KELUARAN = 256 * 1024
BATAS_BERKAS = 5 * 1024 * 1024


FORMAT_SAH = {"docx", "rtf", "pdf"}
POLA_ISI = re.compile(r"\{([a-z_]{1,30})\}")


def isi_argumen(argumen, masukan):
    """Isi "{nama}" dari masukan. ValueError bila kurang atau tidak aman."""
    hasil = []
    for a in argumen:
        if not isinstance(a, (str, int, float)):
            raise ValueError("argumen izin tidak sah")
        a = str(a)

        def ganti(m):
            kunci = m.group(1)
            if kunci not in masukan:
                raise ValueError("Masukan alat kurang: " + kunci)
            nilai = masukan[kunci]
            if isinstance(nilai, bool) or not isinstance(nilai, (str, int, float)):
                raise ValueError("Masukan alat tidak sah: " + kunci)
            nilai = str(nilai)
            if kunci == "format" and nilai not in FORMAT_SAH:
                raise ValueError("Format tidak sah.")
            if len(nilai) > 200 or nilai.startswith("-") or any(ord(c) < 32 for c in nilai):
                raise ValueError("Masukan alat tidak sah: " + kunci)
            return nilai

        hasil.append(POLA_ISI.sub(ganti, a))
    return hasil


def baca_izin():
    try:
        with open(IZIN, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def batasi(detik):
    def pasang():
        os.setsid()
        resource.setrlimit(resource.RLIMIT_AS, (MEMORI_MB * 1024 * 1024,) * 2)
        resource.setrlimit(resource.RLIMIT_CPU, (detik, detik))
        resource.setrlimit(resource.RLIMIT_FSIZE, (10 * 1024 * 1024,) * 2)
        resource.setrlimit(resource.RLIMIT_NOFILE, (64, 64))
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))

    return pasang


def tulis_hasil(tugas_id, hasil, folder_berkas=None):
    keluar = os.path.join(SPOOL, "keluar")
    os.makedirs(keluar, exist_ok=True)
    sementara = os.path.join(keluar, "." + tugas_id + ".tmp")
    shutil.rmtree(sementara, ignore_errors=True)
    os.makedirs(os.path.join(sementara, "berkas"))
    if folder_berkas and os.path.isdir(folder_berkas):
        for nama in sorted(os.listdir(folder_berkas))[:10]:
            asal = os.path.join(folder_berkas, nama)
            if os.path.isfile(asal) and not os.path.islink(asal) and os.path.getsize(asal) <= BATAS_BERKAS:
                shutil.copyfile(asal, os.path.join(sementara, "berkas", os.path.basename(nama)))
    with open(os.path.join(sementara, "hasil.json"), "w", encoding="utf-8") as f:
        json.dump(hasil, f, ensure_ascii=False)
    os.rename(sementara, os.path.join(keluar, tugas_id))


def kerjakan(tugas_id):
    masuk = os.path.join(SPOOL, "masuk", tugas_id)
    kerja = None
    try:
        with open(os.path.join(masuk, "tugas.json"), "r", encoding="utf-8") as f:
            tugas = json.load(f)
        alat = str(tugas.get("alat", ""))
        izin = baca_izin().get(alat)
        if not isinstance(izin, dict):
            return tulis_hasil(tugas_id, {"ok": False, "galat": "Alat di luar daftar izin."})
        skrip = os.path.realpath(os.path.join(SKRIP, str(izin.get("skrip", ""))))
        if not skrip.startswith(SKRIP + os.sep) or not skrip.endswith(".py") or not os.path.isfile(skrip):
            return tulis_hasil(tugas_id, {"ok": False, "galat": "Skrip alat tidak tersedia."})
        masukan = tugas.get("masukan", {})
        if not isinstance(masukan, dict):
            masukan = {}
        try:
            argumen = isi_argumen(izin.get("argumen", []), masukan)
        except ValueError as e:
            return tulis_hasil(tugas_id, {"ok": False, "galat": str(e)[:200]})
        detik = max(1, min(int(tugas.get("batas_detik", 30) or 30), BATAS_DETIK_MAKS))

        kerja = tempfile.mkdtemp(prefix="alat-", dir=KERJA)
        os.makedirs(os.path.join(kerja, "keluar"))
        if os.path.isdir(os.path.join(masuk, "berkas")):
            shutil.copytree(os.path.join(masuk, "berkas"), os.path.join(kerja, "masuk"))
        else:
            os.makedirs(os.path.join(kerja, "masuk"))
        masukan = dict(masukan, berkas=sorted(os.listdir(os.path.join(kerja, "masuk"))))
        try:
            p = subprocess.run(
                [sys.executable, "-I", "-B", skrip, *argumen],
                input=json.dumps(masukan, ensure_ascii=False).encode("utf-8"),
                capture_output=True,
                cwd=kerja,
                env={"PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": kerja, "LANG": "C.UTF-8", "PYTHONIOENCODING": "utf-8"},
                timeout=detik,
                preexec_fn=batasi(detik),
            )
        except subprocess.TimeoutExpired:
            return tulis_hasil(tugas_id, {"ok": False, "galat": "Alat melewati batas waktu."})
        if p.returncode != 0:
            ekor = p.stderr.decode("utf-8", "replace").strip().splitlines()[-3:]
            return tulis_hasil(tugas_id, {"ok": False, "galat": ("Alat gagal: " + " | ".join(ekor))[:300]})
        teks = p.stdout[:BATAS_KELUARAN].decode("utf-8", "replace")
        try:
            keluaran = json.loads(teks)
        except ValueError:
            keluaran = {"teks": teks}
        return tulis_hasil(tugas_id, {"ok": True, "keluaran": keluaran}, os.path.join(kerja, "keluar"))
    except Exception:  # noqa: BLE001 - satu tugas rusak tidak boleh mematikan pelaksana
        tulis_hasil(tugas_id, {"ok": False, "galat": "Tugas alat tidak dapat dibaca."})
    finally:
        shutil.rmtree(masuk, ignore_errors=True)
        if kerja:
            shutil.rmtree(kerja, ignore_errors=True)


def putaran():
    folder = os.path.join(SPOOL, "masuk")
    os.makedirs(folder, exist_ok=True)
    for nama in sorted(os.listdir(folder)):
        if nama.startswith(".") or not os.path.isdir(os.path.join(folder, nama)):
            continue
        kerjakan(nama)


def main():
    if "--sekali" in sys.argv:
        putaran()
        return
    while True:
        putaran()
        time.sleep(0.2)


if __name__ == "__main__":
    main()
