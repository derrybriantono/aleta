# -*- coding: utf-8 -*-
"""Menambah deteksi 9709 (tempat dan tanggal lahir anak tunggal) dan 4310 (penetapan itsbat orang tua) pada deteksi/asalUsul.js."""
import sys

P = r'D:\aleta-dev\wt\u3-itsbat-aua\aleta_bot\services\deteksi\asalUsul.js'
t = open(P, encoding='utf-8', newline='').read()
if '9709' in t.split('const B = require')[1]:
    print('sudah dipasang')
    sys.exit(0)
crlf = '\r\n' in t
t = t.replace('\r\n', '\n')

# 1. daftar variabel
a = '''  { kode: "8605", nama: "Pernikahan resmi/tercatat para Pemohon", sumber: "posita", blangko: ["putusan"] },
'''
assert a in t
t = t.replace(a, a + '''  { kode: "9709", nama: "Tempat dan tanggal lahir anak (anak tunggal)", sumber: "posita", blangko: ["putusan", "bas"], catatan: "U3 20 Okt 2026" },
  { kode: "4310", nama: "Penetapan itsbat nikah orang tua anak (nomor dan tanggal)", sumber: "posita", blangko: ["katalog saksi"], catatan: "U3 20 Okt 2026" },
''')

# 2. fungsi
b = '''function deteksi(posita, opsi = {}) {'''
assert b in t
fungsi = r'''/**
 * 9709 (U3, 20 Okt 2026): "yang lahir di Tibo, pada hari Senin, tanggal 18 Agustus 2019" -> "di Tibo pada tanggal 18 Agustus 2019".
 * Hanya bila posita menyebut TEPAT SATU kelahiran (anak tunggal); beberapa anak (a., b., c.) = isian manual.
 */
function lahirAnak(kalimat) {
  const hasil = [];
  const re = /\blahir\s+(?:di\s+([^,;.]{2,60}?)\s*,?\s*)?(?:pada\s+)?(?:hari\s+[A-Za-z]+\s*,?\s*)?(?:pada\s+)?(?:tanggal\s+|tgl\.?\s+)?(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b/gi;
  for (const k of kalimat) {
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(k)) !== null) {
      const bulan = B.angkaBulan(m[3]);
      const hari = Number(m[2]);
      if (!bulan || hari < 1 || hari > 31) continue;
      const tempat = m[1] ? m[1].replace(/\s+/g, " ").trim() : "";
      const tanggal = `${hari} ${B.BULAN[bulan - 1]} ${m[4]}`;
      hasil.push({ nilai: tempat ? `di ${tempat} pada tanggal ${tanggal}` : `pada tanggal ${tanggal}`, kalimat: k });
    }
  }
  const unik = [...new Set(hasil.map((h) => h.nilai))];
  return unik.length === 1 ? hasil[0] : null;
}

/** 4310 (U3): "telah diitsbatkan ... Penetapan Pengadilan Agama X Nomor 12/Pdt.P/2025/PA.Dgl tanggal 3 Maret 2025" -> "Nomor ... tanggal ...". */
function penetapanItsbat(kalimat) {
  for (const k of kalimat) {
    if (!/(?:diitsbatkan|disahkan|itsbat\s+nikah|isbat\s+nikah)/i.test(k)) continue;
    const m = /(?:Penetapan|Putusan)\s+(?:Pengadilan\s+Agama\s+[A-Za-z]+\s+)?Nomor\s*:?\s*(\d{1,5}\/Pdt\.[PG]\/\d{4}\/PA\.[A-Za-z]+)(?:[^;]{0,40}?tanggal\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4}))?/i.exec(k);
    if (!m) continue;
    return { nilai: m[2] ? `Nomor ${m[1]} tanggal ${m[2]}` : `Nomor ${m[1]}`, kalimat: k };
  }
  return null;
}

'''
t = t.replace(b, fungsi + b, 1)

# 3. pemakaian di deteksi()
c = '''  if (nikah) B.taruh(peta, "8605", B.fakta(nikah.nilai, nikah.kalimat, "ragu", "asal-usul-8605-tercatat"));
'''
assert c in t
t = t.replace(c, c + '''  const kal = B.kalimat(posita);
  const lahir = lahirAnak(kal);
  if (lahir) B.taruh(peta, "9709", B.fakta(lahir.nilai, lahir.kalimat, "cukup", "asal-usul-9709-lahir"));
  const itsbat = penetapanItsbat(kal);
  if (itsbat) B.taruh(peta, "4310", B.fakta(itsbat.nilai, itsbat.kalimat, "ragu", "asal-usul-4310-itsbat"));
''')
d = 'module.exports = { kunci: "asal-usul", jenisPerkaraId: [358], variabel, deteksi, anakPetitum, anakPosita };'
assert d in t
t = t.replace(d, 'module.exports = { kunci: "asal-usul", jenisPerkaraId: [358], variabel, deteksi, anakPetitum, anakPosita, lahirAnak, penetapanItsbat };')
if crlf:
    t = t.replace('\n', '\r\n')
open(P, 'w', encoding='utf-8', newline='').write(t)
print('dipasang')
