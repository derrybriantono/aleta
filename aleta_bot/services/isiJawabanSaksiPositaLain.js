"use strict";

/**
 * ============================================================================
 * POLA POSITA TAMBAHAN: PERWALIAN, AHLI WARIS, KEWARISAN, HARTA BERSAMA, DAN JENIS LAIN (20 Okt 2026, S7)
 * ============================================================================
 *
 * Melengkapi isiJawabanSaksiPosita.js. Hanya yang TERTULIS di posita yang diambil; pola baku (kalimat gugatan yang lazim)
 * berkeyakinan "cukup", pola longgar "ragu" dengan keterangan untuk petugas. Murni (tanpa jaringan).
 * Hasil: [{ kunci, nilai, yakin, ket }] - kunci fakta milik isiJawabanSaksiFakta.js / isiJawabanSaksiVariabel.js.
 */

const { bersihNilai, tanggalIndo, rapat, jumlahAnakDariTeks } = require("./isiJawabanSaksiFakta");

const BULAN = "Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember|Pebruari|Nopember";
const TGL = `\\d{1,2}\\s+(?:${BULAN})\\s+(?:19|20)\\d{2}`;
const RE_TGL = new RegExp(TGL, "i");
const NAMA_KATA = "[A-Z][A-Za-z.'’`-]*";
/** Nama orang: kata berhuruf besar, boleh "bin/binti X", "alias X". */
const NAMA = `${NAMA_KATA}(?:\\s+(?:${NAMA_KATA}|bin|binti|alias|Bin|Binti|Alias)){0,7}`;

const potongBatas = (t, maks = 170) => {
  const s = rapat(t);
  if (s.length <= maks) return s;
  const p = s.slice(0, maks);
  return p.slice(0, Math.max(p.lastIndexOf(","), p.lastIndexOf(" "))).trim();
};

const bersihNama = (t) =>
  bersihNilai(t)
    .replace(/\s*\((?:alm|almh|almarhum\w*)\.?\)\s*/gi, " ")
    .replace(/^(?:Almarhum(?:ah)?|Alm\.?|Almh\.?|bapak|ibu|Bapak|Ibu)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();

/** Nama + "bin/binti" saja ("Fritdzilya Vensima binti Ferdyk F. Kindangen"), atau "" bila tidak ada. */
function namaBinBinti(t) {
  const m = new RegExp(`(${NAMA_KATA}(?:\\s+${NAMA_KATA}){0,5}\\s+(?:bin|binti|Bin|Binti)\\s+${NAMA_KATA}(?:\\s+${NAMA_KATA}){0,4})`).exec(String(t || ""));
  return m ? bersihNama(m[1]) : "";
}

// ============================================================================
// Kematian (dipakai perwalian, ahli waris, kewarisan, wasiat)
// ============================================================================

/**
 * Peristiwa kematian pertama yang tertulis lengkap dengan tanggal.
 * -> { nama, tgl, sebab, peran } (peran: "ayah"|"ibu"|"suami"|"isteri"|"")
 */
function kematianPertama(butir) {
  for (const b of butir) {
    const m = new RegExp(`((?:(?:Almarhum(?:ah)?|Alm\\.?|Almh\\.?)\\s+)?${NAMA})\\s*(?:\\((?:alm|almh|almarhum\\w*)\\.?\\)\\s*)?(?:\\(([^)]{0,40})\\)\\s*)?(Ayah|Ibu|Bapak|Suami|Isteri|Istri)?(?:\\s+dari\\s+anak(?:\\s+tersebut)?)?\\s*(?:telah\\s+)?(?:meninggal|wafat)\\s+dunia\\s+(?:terlebih\\s+dahulu\\s+)?(?:pada\\s+)?(?:hari\\s+\\w+\\s*,?\\s*)?(?:tanggal\\s+)?(${TGL})(?:\\s*,?\\s*(?:dikarenakan|dikarena|karena|disebabkan(?:\\s+oleh)?)\\s+([^,;(.]{3,60}?))?(?=\\s+(?:sesuai|berdasarkan|dengan|yang)\\b|\\s*[(,;.]|\\s*$)`, "i").exec(b);
    if (!m) continue;
    const nama = bersihNama(m[1]);
    if (nama.length < 3) continue;
    const tgl = tanggalIndo(m[4]);
    if (!tgl) continue;
    const ket = `${m[2] || ""} ${m[3] || ""}`.toLowerCase();
    const peran = /ayah|bapak/.test(ket) ? "ayah" : /ibu/.test(ket) ? "ibu" : /suami/.test(ket) ? "suami" : /isteri|istri/.test(ket) ? "isteri" : "";
    return { nama, tgl, sebab: m[5] ? bersihNilai(m[5]) : "", peran };
  }
  // Almarhum menyebut tanggal tanpa "dunia": "wafat pada hari Senin, Tanggal 19 November 2012" didahului "bernama X"
  for (const b of butir) {
    const m = new RegExp(`(?:pewaris|almarhum(?:ah)?)[^.;]{0,60}?bernama\\s+(${NAMA})[^.;]{0,200}?(?:wafat|meninggal)[^.;]{0,40}?(${TGL})`, "i").exec(b);
    if (m) {
      const tgl = tanggalIndo(m[2]);
      if (tgl) return { nama: bersihNama(m[1]), tgl, sebab: "", peran: "" };
    }
  }
  return null;
}

// ============================================================================
// Perwalian
// ============================================================================

function perwalian(butir) {
  const hasil = [];
  const gabung = butir.join(" ; ");
  // anak yang dimohonkan: "wali atas anak Pemohon (X binti Y), Umur 12 Tahun" / "wali anak X binti Y"
  for (const b of butir) {
    const m = /\bwali\s+(?:atas|bagi|dari|terhadap)?\s*anak(?:\s+(?:para\s+)?Pemohon)?\s*(?:yang\s+)?(?:bernama\s*)?:?\s*\(?\s*(.{3,120})/i.exec(b);
    if (!m) continue;
    const nama = namaBinBinti(m[1].slice(0, 90));
    if (!nama) continue;
    hasil.push({ kunci: "anakNama", nilai: nama, yakin: "cukup", ket: "Dari kalimat 'ditetapkan sebagai wali anak ...' pada permohonan." });
    const u = /(?:umur|usia|berumur|berusia)\s+(\d{1,2})\s*tahun/i.exec(m[1].slice(nama.length, nama.length + 60));
    if (u) hasil.push({ kunci: "anakUmur", nilai: u[1], yakin: "cukup" });
    break;
  }
  const mati = kematianPertama(butir);
  if (mati) {
    hasil.push({ kunci: "pewarisNama", nilai: mati.nama, yakin: "cukup", ket: "Orang tua/pasangan yang meninggal pertama kali disebut pada permohonan." }, { kunci: "wafatTgl", nilai: mati.tgl, yakin: "cukup" });
    if (mati.sebab) hasil.push({ kunci: "wafatSebab", nilai: mati.sebab, yakin: "cukup" });
    const anak = /\bbinti\b/i.test(mati.nama) ? "ibu kandung" : /\bbin\b/i.test(mati.nama) ? "ayah kandung" : "";
    const orangTua = mati.peran === "ayah" ? "ayah kandung" : mati.peran === "ibu" ? "ibu kandung" : mati.peran === "suami" ? "ayah kandung" : anak;
    if (orangTua) hasil.push({ kunci: "orangTuaMeninggal", nilai: orangTua, yakin: mati.peran ? "cukup" : "ragu", ket: mati.peran ? "" : "Ayah atau ibu dipastikan dari 'bin/binti' pada nama yang meninggal; periksa." });
  }
  // hubungan Pemohon dengan anak
  let hub = /\bPemohon\s+(?:adalah|merupakan|sebagai)\s+(Ibu\s+Kandung|Ayah\s+Kandung|Kakek|Nenek|Tante|Bibi|Paman|Om|Kakak\s+Kandung|Saudara\s+Kandung|Ibu|Ayah|Bapak)\b/i.exec(gabung);
  if (hub) hasil.push({ kunci: "hubunganPemohonAnak", nilai: hub[1].toLowerCase(), yakin: "cukup", ket: "Dari kalimat 'Pemohon adalah ... dari anak' pada permohonan." });
  else {
    hub = /\bPemohon\s*\(\s*(Ibu\s+Kandung|Ayah\s+Kandung|Ibu|Ayah)\s*\)/i.exec(gabung);
    if (hub) hasil.push({ kunci: "hubunganPemohonAnak", nilai: hub[1].toLowerCase(), yakin: "cukup" });
    else if (/\b(?:suami|isteri|istri)\s+Pemohon\b[^;]{0,200}\banak\s+Pemohon\b/i.test(gabung) || /\banak\s+Pemohon\b[^;]{0,200}\b(?:suami|isteri|istri)\s+Pemohon\b/i.test(gabung)) {
      const suami = /\bsuami\s+Pemohon\b/i.test(gabung);
      hasil.push({ kunci: "hubunganPemohonAnak", nilai: suami ? "ibu kandung" : "ayah kandung", yakin: "ragu", ket: `Disimpulkan dari 'anak Pemohon' dan '${suami ? "suami" : "isteri"} Pemohon' pada permohonan; periksa.` });
    }
  }
  // keperluan
  for (const b of butir) {
    const m = /\b(?:Pemohon\s+)?(?:ingin|bermaksud|berniat|hendak|bertujuan|memerlukan)\s+((?:mengurus|mencairkan|mengambil|menarik|menjual|mengelola|mengajukan)\s+[^;]{5,260}?)(?:\s+maka\b|\s+sehingga\b|\s+oleh\s+karena\b|\s+dan\s+memerlukan\b|;|\.\s|$)/i.exec(b);
    if (m) {
      hasil.push({ kunci: "tujuan", nilai: potongBatas(m[1]), yakin: "ragu", ket: "Dari kalimat tentang maksud Pemohon pada permohonan; bunyinya bebas, periksa." });
      break;
    }
  }
  return hasil;
}

// ============================================================================
// Ahli waris (P3HP) dan kewarisan
// ============================================================================

function waris(butir) {
  const hasil = [];
  const mati = kematianPertama(butir);
  if (mati) {
    hasil.push({ kunci: "pewarisNama", nilai: mati.nama, yakin: "cukup", ket: "Pewaris adalah yang pertama disebut meninggal pada posita." }, { kunci: "wafatTgl", nilai: mati.tgl, yakin: "cukup" });
    if (mati.sebab) hasil.push({ kunci: "wafatSebab", nilai: mati.sebab, yakin: "cukup" });
  }
  for (const b of butir) {
    const m = /\bmeninggal\s+dunia\s+(?:pada\s+[^.;]{0,60}?)?\bdi\s+((?:Desa|Kelurahan|Kota|Kabupaten|Dusun|Rumah|RS)[^,;.(]{3,60})/i.exec(b);
    if (m) {
      hasil.push({ kunci: "wafatTempat", nilai: bersihNilai(m[1]), yakin: "ragu", ket: "Dari kalimat 'meninggal dunia di ...' pada posita; periksa." });
      break;
    }
  }
  for (const b of butir) {
    const m = /\bsebanyak\s+(\d+|[a-z]+)\s*(?:\([^)]*\)\s*)?orang\s+anak|\b(?:memiliki|mempunyai|meninggalkan|dikaruniai|dikaruniakan|memperoleh\s+keturunan)\s+(\d+|[a-z]+)\s*(?:\([^)]*\)\s*)?orang\s+anak/i.exec(b);
    if (m) {
      const n = jumlahAnakDariTeks(`${m[1] || m[2]} orang anak`);
      if (n !== null) {
        hasil.push({ kunci: "jumlahAnakPewaris", nilai: String(n), yakin: "cukup" });
        break;
      }
    }
  }
  // pasangan pewaris: "menikah dengan seorang wanita bernama Dinar"
  for (const b of butir) {
    const m = new RegExp(`\\bmenikah\\s+dengan\\s+(?:seorang\\s+)?(?:wanita|pria|perempuan|laki-laki)?\\s*(?:yang\\s+)?(?:bernama\\s+)?(${NAMA})`, "i").exec(b);
    if (m && /semasa\s+hidup|telah\s+menikah/i.test(b)) {
      const nama = bersihNama(m[1]);
      if (nama.length > 2) hasil.push({ kunci: "pewarisPasangan", nilai: nama, yakin: "ragu", ket: "Dari kalimat 'semasa hidupnya menikah dengan ...' pada posita; periksa." });
      break;
    }
  }
  // harta peninggalan
  for (const b of butir) {
    const m = /\b(?:meninggalkan\s+(?:harta|warisan)|harta\s+peninggalan)\s*(?:berupa|yaitu|:)?\s*([^;]{8,240})/i.exec(b);
    if (m) {
      hasil.push({ kunci: "hartaPeninggalan", nilai: potongBatas(m[1], 160), yakin: "ragu", ket: "Dari kalimat tentang harta peninggalan pada posita; periksa." });
      break;
    }
  }
  const tujuan = /\b(?:untuk\s+(?:keperluan\s+)?)(administrasi[^.;]{0,120}|mengurus[^.;]{0,160}|pembagian[^.;]{0,120}|balik\s+nama[^.;]{0,120})/i;
  for (const b of butir) {
    const m = tujuan.exec(b);
    if (m && /pemohon|penetapan|ahli\s*waris/i.test(b)) {
      hasil.push({ kunci: "tujuan", nilai: potongBatas(m[1].replace(/\s+(?:para\s+)?Pemohon\s+memerlukan.*$/i, ""), 150), yakin: "ragu", ket: "Dari kalimat 'untuk keperluan ...' pada posita; periksa." });
      break;
    }
  }
  return hasil;
}

// ============================================================================
// Harta bersama
// ============================================================================

function hartaBersama(butir) {
  const hasil = [];
  for (const b of butir) {
    const m = new RegExp(`(?:Akta\\s+Cerai|putusan)[^.;]{0,40}?(?:Nomor|No\\.?)\\s*:?\\s*([0-9A-Za-z/.\\-]{5,40})[^.;]{0,40}?(?:tanggal|tgl\\.?)\\s*(${TGL})`, "i").exec(b);
    if (m && /cerai|bercerai/i.test(b)) {
      const tgl = tanggalIndo(m[2]);
      hasil.push({ kunci: "putusanCerai", nilai: `Nomor ${m[1].replace(/[.,]$/, "")} tanggal ${tgl}`, yakin: "cukup", ket: "Dari kalimat tentang putusan/akta cerai pada gugatan." });
      break;
    }
  }
  const harta = [];
  for (const b of butir) {
    const m = /\b(sebidang\s+tanah[^;]{5,200}|(?:sebuah|satu\s+unit|1\s+unit)\s+(?:rumah|mobil|sepeda\s+motor|kendaraan)[^;]{3,160}|(?:rumah|tanah|mobil|sepeda\s+motor)\s+(?:yang\s+)?(?:terletak|berlokasi|berupa|merk|merek)[^;]{3,160})/i.exec(b);
    if (m && /harta|bersama|diperoleh|dibeli|dibangun/i.test(b)) harta.push(potongBatas(m[1], 110));
    if (harta.length >= 3) break;
  }
  if (harta.length) hasil.push({ kunci: "hartaPeninggalan", nilai: harta.join("; "), yakin: "ragu", ket: "Objek harta dibaca dari posita dengan pola longgar; periksa kelengkapannya." });
  return hasil;
}

// ============================================================================
// Jenis lain: hibah, wakaf, wasiat, ekonomi syariah, izin poligami, pembatalan/pencegahan, mafqud, pengangkatan anak
// ============================================================================

function hibah(butir) {
  const hasil = [];
  for (const b of butir) {
    const m = new RegExp(`(?:Penghibah|yang\\s+menghibahkan|bernama)\\s*(?:adalah|ialah|:)?\\s*(${NAMA})[^;]{0,120}?(?:telah\\s+)?menghibahkan\\s+(.{8,200})`, "i").exec(b) || new RegExp(`(${NAMA})\\s+(?:telah\\s+)?menghibahkan\\s+(.{8,200})`, "i").exec(b);
    if (m) {
      hasil.push({ kunci: "penghibah", nilai: bersihNama(m[1]), yakin: "ragu", ket: "Dari kalimat 'menghibahkan' pada gugatan; periksa." });
      const obj = rapat(m[2]).split(/\s+kepada\b/i)[0];
      if (obj.length > 5) hasil.push({ kunci: "objekHibah", nilai: potongBatas(obj, 150), yakin: "ragu" });
      break;
    }
  }
  return hasil;
}

function wakaf(butir) {
  const hasil = [];
  for (const b of butir) {
    const m = new RegExp(`(${NAMA})\\s+(?:telah\\s+)?(?:berikrar\\s+)?(?:mewakafkan|berwakaf)\\s+(.{8,220})`, "i").exec(b);
    if (m) {
      hasil.push({ kunci: "wakif", nilai: bersihNama(m[1]), yakin: "ragu", ket: "Dari kalimat 'mewakafkan' pada gugatan; periksa." });
      const sisa = rapat(m[2]);
      const harta = sisa.split(/\s+kepada\b|\s+untuk\b/i)[0];
      if (harta.length > 5) hasil.push({ kunci: "hartaWakaf", nilai: potongBatas(harta, 150), yakin: "ragu" });
      const nz = new RegExp(`kepada\\s+(?:nazhir\\s+|nadzir\\s+)?(${NAMA})`, "i").exec(sisa);
      if (nz) hasil.push({ kunci: "nazhir", nilai: bersihNama(nz[1]), yakin: "ragu" });
      const un = /\buntuk\s+(.{5,100}?)(?:[;.]|$)/i.exec(sisa);
      if (un) hasil.push({ kunci: "peruntukanWakaf", nilai: potongBatas(un[1], 100), yakin: "ragu" });
      break;
    }
  }
  return hasil;
}

function eksyar(butir) {
  const hasil = [];
  for (const b of butir) {
    const m = /\b(akad\s+(?:murabahah|mudharabah|musyarakah|ijarah|qardh|wadiah|istishna|salam|pembiayaan|kredit)[^;]{0,120}?)(?:\s+yang\s+dibuat|\s+Nomor|\s+No\.|[;,.]|$)/i.exec(b);
    if (m) {
      hasil.push({ kunci: "akad", nilai: potongBatas(m[1].replace(/^akad\s+/i, ""), 100), yakin: "ragu", ket: "Dari kalimat tentang akad pada gugatan; periksa." });
      break;
    }
  }
  for (const b of butir) {
    const m = /\b(?:sisa\s+)?(?:utang|hutang|kewajiban|tunggakan|kerugian|pokok)[^;]{0,60}?(?:sebesar|senilai|sejumlah)\s+Rp\.?\s*([\d.,]+)/i.exec(b);
    if (m) {
      hasil.push({ kunci: "jumlahUtang", nilai: m[1].replace(/[.,]+$/, ""), yakin: "ragu", ket: "Nilai rupiah pertama yang disebut sebagai kewajiban pada gugatan; periksa." });
      break;
    }
  }
  return hasil;
}

function poligami(butir) {
  const hasil = [];
  for (const b of butir) {
    const m = new RegExp(`(?:calon\\s+isteri\\s+(?:kedua|kedua\\s+Pemohon)|menikah\\s+lagi\\s+dengan|calon\\s+isteri)[^;]{0,40}?(?:yang\\s+)?bernama\\s*:?\\s*(${NAMA})`, "i").exec(b);
    if (m) {
      hasil.push({ kunci: "calonIstri", nilai: bersihNama(m[1]), yakin: "cukup", ket: "Dari kalimat tentang calon isteri kedua pada permohonan." });
      break;
    }
  }
  for (const b of butir) {
    const m = /\bPemohon\b[^;]{0,60}?\b(?:bekerja\s+sebagai|pekerjaan(?:nya)?)\s+([A-Za-z][^,;(.]{2,50}?)(?:\s+dengan\s+penghasilan|[,;(.]|$)/i.exec(b);
    if (m) {
      hasil.push({ kunci: "pekerjaanSuami", nilai: bersihNilai(m[1]), yakin: "ragu", ket: "Dari kalimat tentang pekerjaan Pemohon; periksa." });
      break;
    }
  }
  return hasil;
}

function mafqud(butir) {
  const hasil = [];
  for (const b of butir) {
    const m = new RegExp(`(?:suami|isteri|istri|anak|ayah|ibu|saudara)\\s+(?:Pemohon\\s+)?(?:yang\\s+)?bernama\\s*:?\\s*(${NAMA})[^;]{0,200}?(?:pergi|meninggalkan|hilang|tidak\\s+ada\\s+kabar)`, "i").exec(b);
    if (m) {
      hasil.push({ kunci: "orangHilang", nilai: bersihNama(m[1]), yakin: "cukup", ket: "Dari kalimat tentang orang yang pergi/hilang pada permohonan." });
      const k = /\b(suami|isteri|istri|anak|ayah|ibu|saudara)\s+(?:Pemohon\s+)?(?:yang\s+)?bernama/i.exec(b);
      if (k) hasil.push({ kunci: "hubunganOrangHilang", nilai: `${k[1].toLowerCase()} Pemohon`, yakin: "cukup" });
      break;
    }
  }
  for (const b of butir) {
    const m = /\b(?:sudah|telah|selama|sejak)\s+(?:berpisah\s+)?(?:selama\s+)?(?:kurang\s+lebih\s+|sekitar\s+)?(\d+\s*(?:\([^)]*\)\s*)?(?:tahun|bulan))[^.;]{0,60}?(?:tidak\s+(?:ada|diketahui)|hilang|pergi)/i.exec(b);
    if (m) {
      hasil.push({ kunci: "lamaHilang", nilai: rapat(m[1].replace(/\([^)]*\)/g, "")), yakin: "ragu", ket: "Lamanya dibaca dari kalimat tentang kepergian pada permohonan; periksa." });
      break;
    }
  }
  return hasil;
}

function pengangkatanAnak(butir) {
  const hasil = [];
  for (const b of butir) {
    const m = /\b(?:anak|mengangkat|pengangkatan)\s+(?:yang\s+)?(?:anak\s+)?bernama\s*:?\s*(.{3,120})/i.exec(b);
    if (m) {
      const nama = namaBinBinti(m[1]) || bersihNama(m[1].split(/[,;(]/)[0]);
      if (nama.length >= 3) {
        hasil.push({ kunci: "anakNama", nilai: nama, yakin: "cukup", ket: "Dari kalimat tentang anak yang dimohonkan pada permohonan." });
        const u = /(?:umur|usia|berumur|berusia)\s+(\d{1,2})\s*tahun/i.exec(m[1]);
        if (u) hasil.push({ kunci: "anakUmur", nilai: u[1], yakin: "cukup" });
        break;
      }
    }
  }
  return hasil;
}

function hakAsuh(butir) {
  const hasil = [];
  for (const b of butir) {
    const m = /\banak(?:-anak)?\s+(?:yang\s+)?(?:masing-masing\s+)?bernama\s*:?\s*(.{3,160})/i.exec(b);
    if (m) {
      const nama = namaBinBinti(m[1]) || bersihNama(m[1].split(/[,;(]/)[0]);
      if (nama.length >= 3) {
        hasil.push({ kunci: "anakNama", nilai: nama, yakin: "cukup", ket: "Dari kalimat tentang anak yang disengketakan pada gugatan." });
        break;
      }
    }
  }
  return hasil;
}

const KE_FUNGSI = {
  perwalian,
  paw: waris,
  waris,
  hb: hartaBersama,
  hibah,
  wakaf,
  wasiat: waris,
  eksyar,
  ip: poligami,
  mafqud,
  angkat: pengangkatanAnak,
  asuh: hakAsuh,
  nafkahAnak: hakAsuh,
};

/** @returns {Array} fakta tambahan untuk jenis ini ([] bila jenis tidak punya pola di sini) */
function positaLain(butir, jenis) {
  const f = KE_FUNGSI[jenis];
  if (!f) return [];
  try {
    return f(butir);
  } catch (_galat) {
    return [];
  }
}

module.exports = { positaLain, kematianPertama, namaBinBinti, KE_FUNGSI };
