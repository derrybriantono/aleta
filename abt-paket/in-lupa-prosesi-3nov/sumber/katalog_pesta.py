# -*- coding: utf-8 -*-
"""
Katalog saksi itsbat (3 Nov 2026, permintaan pengguna): pilihan cara saksi mengetahui pernikahan
"Saksi hanya hadir di pesta pernikahan, tidak tahu prosesi akad nikah" (keadaan bentukKesaksian = "pesta").

Berlaku di katalog itsbat-nikah dan cerai-kumulasi-itsbat (serumpun; keadaan bentukKesaksian sama), dipakai panel Blangko
Derry dan panel ABT lama (keduanya membaca keadaan katalog yang sama). Yang diubah - tidak ada yang dihapus:
  1. keadaan.bentukKesaksian: nilai "pesta" + tulisannya;
  2. butir hadir, wali, yang menikahkan, ijab kabul (lafaz akad), saksi nikah, mahar: jawaban "melihat" bersyarat
     {bentukKesaksian: pesta} - saksi hadir di pesta, TIDAK mengikuti akad, jadi tidak tahu hal itu (4 kalimat saksi 1 +
     4 kalimat saksi 2, maksud sama kata berbeda); jawaban lama tetap untuk keadaan lain;
  3. butir rincian akad yang tidak mungkin dijawab orang yang tidak mengikuti akad (hadirin akad, syarat wali, urutan wali,
     kabul diucapkan sendiri, syarat/kehadiran/nama baik saksi nikah, penyerahan mahar) tidak ditanyakan pada keadaan pesta
     (syarat "bukan:bentukKesaksian": "pesta");
  4. versi katalog TIDAK dinaikkan (sama dengan ubahan 2 Nov: uji u3 menjaga versi = cadangan + 1).
Pertanyaan tentang kenal para pihak, hidup bersama, anak, tidak bercerai, keberatan, halangan, status - tetap (jawaban lama).

Pakai: python katalog_pesta.py <folder ekstensi-sipp>   (idempoten: dijalankan dua kali = hasil sama)
Sesudahnya: node manajemen_surat/scripts/susun-saksi-katalog.mjs (saksi-katalog-data.js, indeks, saksi-katalog-jenis/).
"""
import io
import json
import os
import sys

EK = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "ekstensi-sipp")
NILAI = "pesta"
LABEL = "Saksi hanya hadir di pesta pernikahan, tidak tahu prosesi akad nikah"
SYARAT = {"bentukKesaksian": NILAI}

# Sebutan pasangan per akhiran butir.
PASANGAN = {"pb": "#0046# I dan #0046# II", "lw": "#0046# dan #0047#", "pm": "#0046# dengan #1025#", "km": "#0046# dan #0047#"}

# Butir dasar -> (maksud, saksi1, saksi2); {P} = sebutan pasangan.
JAWAB = {
    "q-in-hadir": (
        "saksi menerangkan bahwa ia hanya menghadiri pesta pernikahan {P} dan tidak mengikuti akad nikahnya",
        [
            "saya hadir di pesta pernikahan {P}, tetapi saya tidak mengikuti acara akad nikahnya",
            "saya datang ke pesta perkawinan {P} untuk ikut merayakan, namun pada saat akad nikah saya tidak berada di tempat itu",
            "saya hanya menghadiri pesta pernikahan {P}, sedangkan prosesi akad nikahnya tidak saya ikuti",
            "yang saya hadiri adalah pesta perkawinan {P}, adapun akad nikahnya tidak saya saksikan",
        ],
        [
            "benar saya hadir pada pesta pernikahan {P}, tetapi saya tidak menyaksikan akad nikahnya",
            "saya diundang dan datang ke pesta perkawinan {P}, namun saya tidak mengikuti prosesi akad nikah",
            "saya ikut merayakan pesta pernikahan {P}, akan tetapi ketika akad nikah berlangsung saya tidak berada di tempat akad",
            "saya menghadiri pesta perkawinan {P} saja dan tidak mengikuti jalannya akad nikah",
        ],
    ),
    "q-in-wali": (
        "saksi tidak mengetahui wali nikah karena tidak mengikuti akad nikah, hanya menghadiri pestanya",
        [
            "saya tidak tahu siapa yang menjadi wali nikahnya karena saya tidak mengikuti akad nikah, saya hanya datang ke pestanya",
            "siapa wali nikah pada pernikahan itu tidak saya ketahui sebab saya tidak menyaksikan akad nikahnya",
            "karena saya hanya menghadiri pesta pernikahan, saya tidak mengetahui siapa yang bertindak sebagai wali nikah",
            "saya tidak dapat menerangkan siapa wali nikahnya karena saya tidak ikut dalam prosesi akad nikah",
        ],
        [
            "mengenai wali nikahnya saya tidak tahu karena saya tidak mengikuti acara akad nikah",
            "saya tidak mengetahui siapa wali nikahnya sebab yang saya hadiri hanya pestanya",
            "wali nikah pada pernikahan itu tidak saya ketahui karena saya tidak berada di tempat akad nikah",
            "saya tidak tahu siapa yang menjadi wali nikah, sebab saya datang ketika pesta saja dan tidak mengikuti akadnya",
        ],
    ),
    "q-in-menikahkan": (
        "saksi tidak mengetahui siapa yang menikahkan karena tidak mengikuti akad nikah, hanya menghadiri pestanya",
        [
            "saya tidak tahu siapa yang menikahkan mereka karena saya tidak mengikuti akad nikah",
            "siapa yang menikahkan mereka tidak saya ketahui sebab saya hanya menghadiri pestanya",
            "saya tidak mengetahui siapa yang menikahkan karena saya tidak menyaksikan prosesi akad nikah",
            "karena saya tidak ikut dalam akad nikah, saya tidak tahu siapa yang menikahkan mereka",
        ],
        [
            "mengenai siapa yang menikahkan saya tidak tahu karena saya tidak berada di tempat akad nikah",
            "saya tidak mengetahui siapa yang menikahkan mereka sebab saya datang pada waktu pestanya saja",
            "yang menikahkan mereka tidak saya ketahui karena saya tidak mengikuti acara akad nikahnya",
            "saya tidak tahu siapa yang menikahkan, sebab yang saya hadiri hanya pesta pernikahannya",
        ],
    ),
    "q-in-ijab-kabul": (
        "saksi tidak mengetahui lafaz ijab kabul karena tidak mengikuti akad nikah, hanya menghadiri pestanya",
        [
            "saya tidak tahu bagaimana lafaz ijab kabulnya karena saya tidak mengikuti akad nikah",
            "bagaimana lafaz akad nikahnya tidak saya ketahui sebab saya hanya menghadiri pesta pernikahannya",
            "saya tidak mengetahui ucapan ijab kabulnya karena saya tidak berada di tempat akad nikah",
            "lafaz akad nikahnya saya tidak tahu karena saya tidak menyaksikan prosesi akad",
        ],
        [
            "mengenai lafaz ijab kabulnya saya tidak tahu sebab saya tidak mengikuti acara akad nikah",
            "saya tidak mengetahui bagaimana akad nikahnya diucapkan karena saya datang ketika pesta saja",
            "ucapan ijab kabul pada pernikahan itu tidak saya ketahui karena saya tidak menyaksikan akad nikahnya",
            "saya tidak tahu lafaz akad nikah itu sebab yang saya hadiri hanya pesta pernikahannya",
        ],
    ),
    "q-in-saksi-nikah": (
        "saksi tidak mengetahui siapa saksi nikah karena tidak mengikuti akad nikah, hanya menghadiri pestanya",
        [
            "saya tidak tahu siapa saksi nikahnya karena saya tidak mengikuti akad nikah",
            "siapa yang menjadi saksi nikah tidak saya ketahui sebab saya hanya menghadiri pesta pernikahannya",
            "saya tidak mengetahui siapa saksi nikahnya karena saya tidak menyaksikan prosesi akad nikah",
            "karena saya tidak ikut dalam akad nikah, saya tidak tahu siapa yang bertindak sebagai saksi nikah",
        ],
        [
            "mengenai saksi nikahnya saya tidak tahu karena saya tidak berada di tempat akad nikah",
            "saya tidak mengetahui siapa saksi nikahnya sebab saya datang pada waktu pestanya saja",
            "saksi nikah pada pernikahan itu tidak saya ketahui karena saya tidak mengikuti acara akad nikahnya",
            "saya tidak tahu siapa yang menjadi saksi nikah, sebab yang saya hadiri hanya pesta pernikahannya",
        ],
    ),
    "q-in-mahar": (
        "saksi tidak mengetahui mahar karena tidak mengikuti akad nikah, hanya menghadiri pestanya",
        [
            "saya tidak tahu apa maharnya karena saya tidak mengikuti akad nikah",
            "mahar pernikahan itu tidak saya ketahui sebab saya hanya menghadiri pestanya",
            "saya tidak mengetahui apa mas kawinnya karena saya tidak menyaksikan prosesi akad nikah",
            "karena saya tidak ikut dalam akad nikah, saya tidak tahu mahar yang diberikan",
        ],
        [
            "mengenai maharnya saya tidak tahu karena saya tidak berada di tempat akad nikah",
            "saya tidak mengetahui apa maharnya sebab saya datang pada waktu pestanya saja",
            "mas kawin pada pernikahan itu tidak saya ketahui karena saya tidak mengikuti acara akad nikahnya",
            "saya tidak tahu apa mahar pada pernikahan itu sebab yang saya hadiri hanya pesta pernikahannya",
        ],
    ),
}
JAWAB["q-in-menikahkan-wali"] = JAWAB["q-in-menikahkan"]

# Rincian akad yang tidak ditanyakan kepada saksi yang hanya hadir di pesta.
SEMBUNYI = ["q-in-hadirin", "q-in-wali-syarat", "q-in-wali-urutan", "q-in-kabul-pribadi", "q-in-saksi-syarat", "q-in-saksi-hadir", "q-in-saksi-adil", "q-in-mahar-serah"]


def dasar_dan_akhiran(qid):
    i = qid.rfind("-")
    return qid[:i], qid[i + 1:]


def ubah(nama):
    p = os.path.join(EK, "saksi-katalog", nama)
    with io.open(p, encoding="utf-8") as f:
        mentah = f.read()
    kat = json.loads(mentah)
    bk = kat["keadaan"]["bentukKesaksian"]
    if NILAI not in bk["nilai"]:
        bk["nilai"].append(NILAI)
    bk.setdefault("labelNilai", {})[NILAI] = LABEL
    n_jawab = n_sembunyi = 0
    for q in kat["pertanyaan"]:
        dasar, akhir = dasar_dan_akhiran(q["id"])
        if dasar in JAWAB and akhir in PASANGAN:
            maksud, s1, s2 = JAWAB[dasar]
            P = PASANGAN[akhir]
            objek = {
                "keadaan": dict(SYARAT),
                "maksud": maksud.replace("{P}", P),
                "saksi1": [t.replace("{P}", P) for t in s1],
                "saksi2": [t.replace("{P}", P) for t in s2],
            }
            lama = q["jawaban"]["melihat"]
            daftar = lama if isinstance(lama, list) else [lama]
            daftar = [x for x in daftar if not (isinstance(x, dict) and x.get("keadaan") == SYARAT)]
            daftar.append(objek)
            q["jawaban"]["melihat"] = daftar
            n_jawab += 1
        if dasar in SEMBUNYI and akhir in PASANGAN:
            q.setdefault("keadaan", {})["bukan:bentukKesaksian"] = NILAI
            n_sembunyi += 1
    akhir_baris = "\n" if mentah.endswith("\n") else ""
    with io.open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(kat, ensure_ascii=False, indent=2) + akhir_baris)
    print("%s: versi %s, jawaban pesta %d butir, disembunyikan pada pesta %d butir" % (nama, kat["versi"], n_jawab, n_sembunyi))


if __name__ == "__main__":
    ubah("itsbat-nikah.json")
    ubah("cerai-kumulasi-itsbat.json")
