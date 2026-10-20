# -*- coding: utf-8 -*-
"""Render RTF blangko lewat jalur cetak ABT asli (Abt_model->variabel_library, PHP 5.6) pada SALINAN ABT sendiri
(DB aps_badilag_w2a, folder D:/Aplikasi/aleta/tmp/w2a/abt-app; dibuat oleh klon_db.cjs + salinan aplikasi).
  python render_w3a.py <perkara_id> <berkas.rtf> [keluar.rtf]   -> cetak teks hasil render
Lingkungan: W3A_ABT = folder salinan ABT."""
import json, os, re, shutil, subprocess, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rtf2txt import rtf_ke_teks

ABT = os.environ.get("W3A_ABT", r"D:\Aplikasi\aleta\tmp\w2a\abt-app")
PHP = r"D:\sipp-server\php56\php.exe"


def render(pid, rtf, keluar=None, sidang=''):
    sem = os.path.join(ABT, "_blangko_abt", "_uji_w3a_%d.rtf" % os.getpid())
    shutil.copy(rtf, sem)
    out = keluar or os.path.join(os.environ.get("TMP", "."), "w3a_render_%s_%d.rtf" % (pid, os.getpid()))
    tugas = os.path.join(os.environ.get("TMP", "."), "w3a_tugas_%d.json" % os.getpid())
    json.dump({"perkara_id": int(pid), "rtf": "_blangko_abt/" + os.path.basename(sem), "keluar": out, "sidang": sidang}, open(tugas, "w"))
    try:
        r = subprocess.run(
            [PHP, "-d", "memory_limit=1024M", "index.php", "uji_u2", "render"],
            cwd=ABT,
            env=dict(os.environ, UJI_U2_TUGAS=tugas),
            capture_output=True,
            timeout=900,
        )
        st = r.stdout.decode("cp1252", "replace").strip()
    finally:
        os.remove(tugas)
        os.remove(sem)
    if not st.startswith("OK") or not os.path.exists(out):
        return st + " " + r.stderr.decode("utf-8", "replace")[:300], ""
    teks = rtf_ke_teks(open(out, "rb").read().decode("latin1"))
    return st, re.sub(r"\n{3,}", "\n\n", teks)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    st, t = render(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
    print(st[:200])
    print(t)
