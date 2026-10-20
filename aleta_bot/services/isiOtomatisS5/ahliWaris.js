"use strict";

/**
 * ============================================================================
 * PENETAPAN AHLI WARIS / P3HP (jenis_perkara_id 371) - susunan ahli waris, harta, dan pencairan dana
 * ============================================================================
 *
 * Petitum P3HP PA Donggala hampir seragam: "Menetapkan ahli waris {pewaris} adalah: a. X (Pemohon I); b. Y (Pemohon II)"
 * atau "Menetapkan bahwa para Pemohon adalah Ahli Waris dari Almarhum X ..., yaitu : - A (Anak kandung). - B (Istri)" dan
 * "untuk pemberian izin untuk pencairan Dana BPJS Ketenagakerjaan dengan nomor ... nama ...". Posita menyebut golongan yang
 * ditinggalkan ("meninggalkan Isteri, tujuh orang anak" / "Ibu, Saudara-Saudara") dan nama pasangan ("menikah dengan ... X").
 * Hubungan tiap ahli waris dengan pewaris dibaca (1) dari keterangan dalam kurung bila ada ("(Anak kandung)"), (2) dari POLA
 * NAMA: anak memakai nama diri pewaris sesudah bin/binti ("Fatimah binti Maulid Agusta" untuk pewaris "Maulid Agusta bin
 * Djorihi"; pewaris perempuan: nama suaminya), saudara memakai nama ayah pewaris.
 *
 *   9701 pasangan pewaris yang masih hidup     ahli waris yang namanya = pasangan di posita, atau satu-satunya yang tersisa bila posita menyebut isteri/suami
 *   9702 anak kandung pewaris                  ahli waris berhubungan anak
 *   9703 / 9704 ayah / ibu yang masih hidup    sisa ahli waris bila posita menyebut TEPAT satu dari ayah / ibu
 *   9718 saudara kandung atau seayah           ahli waris ber-bin/binti nama ayah pewaris
 *   8608 nama ahli waris (anak)                sama dengan 9702
 *   8610 nama suami/istri pewaris              pasangan di posita ("menikah dengan ...")
 *   8614 harta peninggalan                     kalimat posita "(dan juga) meninggalkan ..." (dana, tanah)
 *   9700 pencairan dana                        kalimat petitum "pencairan Dana ..."
 *
 * Hukum waris adalah penilaian hakim: bacaan "cukup" hanya bila SELURUH ahli waris tergolong dan jumlah anak sama dengan yang
 * tertulis di posita; selainnya "ragu" dengan keterangan golongan mana yang tidak terbaca. Daftar yang tidak dapat dipecah
 * (nama bertumpuk tanpa penanda, silsilah banyak istri) tidak diusulkan - golongan itu tetap diisi petugas.
 */

const B = require("./bantu");

const NAMA = Object.freeze({
  "9701": "Ahli waris: pasangan pewaris yang masih hidup",
  "9702": "Ahli waris: anak kandung pewaris",
  "9703": "Ahli waris: ayah kandung pewaris yang masih hidup",
  "9704": "Ahli waris: ibu kandung pewaris yang masih hidup",
  "9718": "Ahli waris: saudara kandung atau seayah pewaris",
  "8608": "Nama ahli waris (anak kandung)",
  "8610": "Nama suami/istri pewaris",
  "8614": "Harta peninggalan pewaris",
  "9700": "Pencairan dana",
});

const ANGKA_KATA = { satu: 1, seorang: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10, sebelas: 11, "dua belas": 12 };

/** Kata hubungan dalam kurung/keterangan -> golongan. */
const GOLONGAN_KATA = [
  [/\banak\b/i, "anak"],
  [/\b(?:isteri|istri|suami)\b/i, "pasangan"],
  [/\b(?:saudara|kakak|adik)\b/i, "saudara"],
  [/\b(?:ibu|ibunda)\b/i, "ibu"],
  [/\b(?:ayah|bapak|ayahanda)\b/i, "ayah"],
];
const golonganDariKata = (t) => {
  for (const [re, g] of GOLONGAN_KATA) if (re.test(String(t || ""))) return g;
  return "";
};

/**
 * Daftar ahli waris dari petitum.
 * @returns {{pewaris: string, daftar: string}} daftar = teks sesudah "adalah"/"yaitu"; "" bila petitum tidak berdaftar
 */
function potongDaftarPetitum(petitum) {
  const t = B.polos(petitum);
  const re = [
    /\bahli\s+waris\b[^:;]{0,260}?\badalah\s*:?\s*/i,
    /\bahli\s+waris\b[^:;]{0,260}?\byaitu\s*:\s*/i,
  ];
  for (const r of re) {
    const m = r.exec(t);
    if (!m) continue;
    let sisa = t.slice(m.index + m[0].length);
    // Butir berikutnya: "4. Menetapkan", "Menetapkan Para Pemohon ...", "Membebankan", "SUBSIDER".
    const akhir = sisa.search(/\s(?:\d{1,2}\s*\.\s*)?Menetapkan\b|\s(?:\d{1,2}\s*\.\s*)?Membebankan\b|\s(?:\d{1,2}\s*\.\s*)?Menyatakan\b|\sSUBSID/i);
    if (akhir >= 0) sisa = sisa.slice(0, akhir);
    const pw = /\bahli\s+waris\s+(?:dari\s+)?(?:almarhum(?:ah)?\s+|alm\.?\s+|almh\.?\s+)?(.+?)\s+adalah/i.exec(t.slice(m.index, m.index + m[0].length));
    return { pewaris: pw ? pw[1].replace(/\s*\((?:alm|almh|almarhum|almarhumah)\.?\)\s*/gi, " ").trim() : "", daftar: sisa.trim() };
  }
  return { pewaris: "", daftar: "" };
}

/**
 * Memecah daftar menjadi { nama, hubungan }: "a. X bin Y, (Pemohon I); b. Z binti W (Anak kandung)" / "- A Bin B (Anak kandung). - C ...".
 * hubungan = golongan dari keterangan dalam kurung ("" bila tidak ada).
 */
function pecahDaftar(daftar) {
  const t = String(daftar || "").replace(/\s+/g, " ").trim();
  if (!t) return { butir: [], berpenanda: false };
  const berpenanda = /(?:^|[\s;,])(?:[a-h]|\d{1,2})\s*[.)]\s+[A-Z]/.test(t) || /;/.test(t) || /(?:^|\s)-\s+[A-Z]/.test(t);
  const potongan = berpenanda
    ? t.split(/(?:^|\s*;\s*|\s+)(?:[a-h]|\d{1,2})\s*[.)]\s+(?=[A-Z])|(?:^|\s+)-\s+(?=[A-Z])|\s*;\s*/).filter((x) => x && x.trim())
    : [t];
  const butir = [];
  for (const p of potongan) {
    const kurung = [...p.matchAll(/\(([^)]{2,60})\)/g)].map((m) => m[1]);
    const hubungan = kurung.map(golonganDariKata).find(Boolean) || "";
    const bersih = p
      .replace(/^\s*(?:sebagai\s+berikut|yaitu|antara\s+lain)\s*:?\s*/i, "")
      .replace(/\s*\((?:[^)]*)\)\s*/g, " ")
      .replace(/[,\s]*(?:umur|usia)\s+\d{1,3}\s*(?:\([^)]*\)\s*)?tahun.*$/i, "")
      .replace(/[\s,;.]+$/, "")
      .replace(/^[\s,;.]+/, "")
      .replace(/\)+$/, "")
      .trim();
    if (bersih.length >= 3 && (/\b(?:bin|binti)\b/i.test(bersih) || /^[A-Z]/.test(bersih))) butir.push({ nama: bersih, hubungan });
  }
  return { butir, berpenanda };
}

/** Pisah "X bin Y alias Z" -> { diri: "X", ayah: "Y alias Z", jk }. */
function uraiNama(nama) {
  const m = /^(.*?)\s+\b(bin|binti)\b\.?\s+(.+)$/i.exec(String(nama || "").trim());
  if (!m) return { diri: String(nama || "").trim(), ayah: "", jk: "" };
  return { diri: m[1].trim(), ayah: m[3].trim(), jk: m[2].toLowerCase() === "binti" ? "P" : "L" };
}

const kunciDiri = (s) => B.rapat(String(s || "").replace(/\s+alias\b.*$/i, ""));

/** Nama dan alias-nya sebagai daftar kunci rapat: "Ahmad alias Ahmad Yambo" -> ["ahmad", "ahmadyambo"]. */
const kunciNama = (s) =>
  String(s || "")
    .split(/\s+alias\s+/i)
    .map((x) => B.rapat(x.replace(/\)+$/, "")))
    .filter(Boolean);

/** Apakah ayah-heir (teks sesudah bin/binti) menunjuk orang bernama `acuan` (nama diri atau salah satu alias)? */
function menunjuk(ayahHeir, acuanLengkap) {
  const a = kunciNama(ayahHeir);
  const b = kunciNama(acuanLengkap);
  if (!a.length || !b.length) return false;
  return a.some((x) => b.some((y) => x === y || (x.length >= 4 && y.length >= 4 && (x.startsWith(y) || y.startsWith(x)))));
}

/** Nama pasangan di posita: "menikah dengan (seorang) Perempuan bernama X bin/binti Y (Pemohon)". */
function pasanganPosita(posita) {
  const t = B.polos(posita);
  const m = /\b(?:telah\s+)?menikah\s+dengan\s+(?:seorang\s+)?(?:lelaki|laki-laki|pria|perempuan|wanita)?\s*(?:ber\s*nama\w*|yang\s+bernama)?\s*:?\s*([A-Z][^()]{2,100}?(?:\b(?:bin|binti)\b[^()]{2,60}?)?)\s*(?:\(|pada\s+tanggal|,|;)/i.exec(t);
  if (!m) return null;
  const nama = m[1].replace(/\s+/g, " ").trim();
  // Nama pasangan harus bernama lengkap "X bin/binti Y"; kata tunggal ("Dinar") bukan nama yang dapat dipercaya.
  if (!/\b(?:bin|binti)\b/i.test(nama) || nama.split(" ").length > 8) return null;
  return { nama, kalimat: m[0] };
}

/** Golongan yang ditinggalkan menurut posita: "meninggalkan Isteri, tujuh orang anak, ibu dan juga meninggalkan Dana ..." */
function golonganPosita(posita) {
  const t = B.polos(posita);
  const m = /\bmeninggalkan\s+(.{3,160}?)(?=\s+dan\s+juga\s+meninggalkan\b|\s+dan\s+meninggalkan\b|;|\.\s+[A-Z]|$)/i.exec(t);
  if (!m) return null;
  const s = m[1];
  const anak = /\b(?:(\d{1,2})|(satu|seorang|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|dua belas))\s*(?:\([^)]*\)\s*)?(?:orang\s+)?anak\b/i.exec(s);
  return {
    kalimat: m[0],
    pasangan: /\b(?:isteri|istri|suami)\b/i.test(s),
    anak: anak ? (anak[1] ? Number(anak[1]) : ANGKA_KATA[anak[2].toLowerCase()] || 0) : /\banak\b/i.test(s) ? -1 : 0,
    ayah: /\b(?:ayah|bapak)\b/i.test(s),
    ibu: /\bibu\b/i.test(s),
    saudara: /\bsaudara\b/i.test(s),
  };
}

/** Harta/dana yang ditinggalkan: "dan juga meninggalkan Dana BPJS ..." atau "meninggalkan harta berupa ...". */
function hartaPosita(posita) {
  const t = B.polos(posita);
  // Berhenti di butir bernomor berikutnya ("7. Bahwa ...") atau titik koma yang diikuti kalimat baru; titik singkatan ("No.", "PT.") tidak memutus.
  const m = /\b(?:dan\s+juga\s+meninggalkan|juga\s+meninggalkan|meninggalkan\s+harta(?:\s+(?:warisan|peninggalan))?(?:\s+berupa)?)\s*:?\s+((?:(?:Dana|Tabungan|Deposito|Asuransi|Santunan|Polis|Taspen|Pensiun|BPJS|sebidang|tanah|rumah|kendaraan|harta)\b|[a-h]\s*\.\s).{3,900}?)(?=\s*;\s*(?:\d{1,2}\s*\.\s*)?Bahwa\b|\s\d{1,2}\s*\.\s*Bahwa\b|\s+Bahwa\b|$)/i.exec(t);
  if (!m) return null;
  const nilai = m[1]
    .replace(/\s+/g, " ")
    .replace(/\b(\w+)(?:\s+\1\b)+/gi, "$1")
    .replace(/\s+(?:sehingga|dan\s+harta\s+tersebut|oleh\s+karena|maka)\b.*$/i, "")
    .replace(/[\s,;.]+$/, "")
    .trim();
  return nilai.length >= 5 ? { nilai, kalimat: m[0] } : null;
}

/** Pencairan dana di petitum: "untuk pemberian izin untuk pencairan Dana BPJS Ketenagakerjaan dengan nomor ... nama ...". */
function pencairanDana(petitum) {
  const t = B.polos(petitum);
  const m = /\bpencairan\s+((?:Dana|Tabungan|Deposito|Asuransi|Santunan|Polis|Taspen|Pensiun|BPJS|Gaji|Hak)\b.{3,260}?)(?=\s+(?:\d{1,2}\s*\.\s*)?Menetapkan\b|\s+Membebankan\b|\s+SUBSID|;|$)/i.exec(t);
  if (!m) return null;
  // "Dana Dana BPJS" (salah ketik di petitum) -> "Dana BPJS": kata yang sama berturut-turut diringkas.
  const nilai = m[1].replace(/\s+/g, " ").replace(/\b(\w+)(?:\s+\1\b)+/gi, "$1").replace(/[\s,;.]+$/, "").trim();
  return { nilai, kalimat: m[0] };
}

/**
 * Menggolongkan ahli waris terhadap pewaris.
 * @param {{petitum: string, posita: string, pewaris?: string, pihak1?: object[]}} o
 * @returns {{anak: string[], pasangan: string[], saudara: string[], ibu: string[], ayah: string[], sisa: string[], semua: string[], pewaris: string, dari: string}}
 */
function golongkan({ petitum, posita, pewaris, pihak1 }) {
  const { pewaris: pwPetitum, daftar } = potongDaftarPetitum(petitum);
  const pw = pewaris || pwPetitum;
  let { butir, berpenanda } = pecahDaftar(daftar);
  let dari = "petitum";
  // Petitum tanpa daftar yang dapat dipecah (nama bertumpuk): pakai nama Pemohon di SIPP bila petitum menyebut Pemohon sebagai ahli waris.
  const bertumpuk = butir.length === 1 && !berpenanda && (butir[0].nama.match(/\b(?:bin|binti)\b/gi) || []).length > 1;
  if ((!butir.length || bertumpuk) && Array.isArray(pihak1) && pihak1.length && /\bahli\s+waris\b/i.test(B.polos(petitum))) {
    const nama = pihak1.map((p) => B.rapikanNama(p.nama)).filter((n) => /\b(?:bin|binti)\b/i.test(n));
    if (nama.length === pihak1.length) {
      butir = nama.map((n) => ({ nama: n, hubungan: "" }));
      dari = "pihak";
    }
  }
  const hasil = { anak: [], pasangan: [], saudara: [], ibu: [], ayah: [], sisa: [], semua: butir.map((b) => b.nama), pewaris: pw, dari };
  if (!pw || !butir.length) return hasil;
  const u = uraiNama(pw);
  const pasanganP = pasanganPosita(posita);
  // Pewaris perempuan: anaknya memakai nama SUAMI (pasangan) sesudah bin/binti, bukan nama pewaris.
  const ayahAnak = u.jk === "P" && pasanganP ? uraiNama(pasanganP.nama).diri : "";
  for (const b of butir) {
    const n = b.nama;
    const x = uraiNama(n);
    if (b.hubungan && hasil[b.hubungan]) hasil[b.hubungan].push(n);
    else if (pasanganP && B.samaNama(n, pasanganP.nama)) hasil.pasangan.push(n);
    else if (x.ayah && ((menunjuk(x.ayah, u.diri) && kunciDiri(x.diri) !== kunciDiri(u.diri)) || (ayahAnak && menunjuk(x.ayah, ayahAnak)))) hasil.anak.push(n);
    else if (x.ayah && u.ayah && menunjuk(x.ayah, u.ayah)) hasil.saudara.push(n);
    else hasil.sisa.push(n);
  }
  // Pemohon tunggal menyatakan hubungannya sendiri: "Pemohon adalah Ayah kandung dari pewaris".
  if (!butir.length && Array.isArray(pihak1) && pihak1.length === 1) {
    const h = /\bPemohon\s+adalah\s+(ayah|bapak|ibu|isteri|istri|suami|anak)\s+(?:kandung\s+)?(?:dari\s+)?(?:pewaris|almarhum|alm)/i.exec(B.polos(posita));
    const g = h ? golonganDariKata(h[1]) : "";
    const nama = B.rapikanNama(pihak1[0].nama);
    if (g && hasil[g] && nama) {
      hasil[g].push(nama);
      hasil.semua.push(nama);
    }
  }
  // Satu orang tersisa dan posita menyebut isteri/suami (tanpa ibu/ayah/saudara): itulah pasangannya.
  const gol = golonganPosita(posita);
  // Posita menyebut jumlah anak yang SAMA dengan banyaknya ahli waris tersisa (dan tidak ada golongan lain): semuanya anak
  // (pewaris perempuan: anak memakai nama suaminya, tidak dapat dikenali dari nama).
  if (hasil.sisa.length && gol && gol.anak > 0 && hasil.sisa.length === gol.anak - hasil.anak.length && !gol.pasangan && !gol.ibu && !gol.ayah && !gol.saudara) {
    hasil.anak.push(...hasil.sisa.splice(0));
  }
  if (hasil.sisa.length === 1 && !hasil.pasangan.length && gol && gol.pasangan && !gol.ibu && !gol.ayah && !gol.saudara) hasil.pasangan.push(hasil.sisa.pop());
  return hasil;
}

const daftarTitikKoma = (d) => d.join("; ");

/**
 * Golongan ahli waris yang PASTI tidak ada (daftar terbaca penuh, tidak ada sisa, posita tidak menyebutnya): dasar syarat
 * "kosong bila tidak ada" pada 9701/9703/9704/9718 - mengosongkan isian itu sudah benar.
 */
function golonganTiada(d) {
  const posita = String((d.perkara && d.perkara.posita) || "");
  const petitum = String((d.perkara && d.perkara.petitum) || "");
  const g = golongkan({ petitum, posita, pihak1: d.pihak1 });
  const gol = golonganPosita(posita);
  const terbaca = Boolean(g.pewaris) && g.semua.length > 0 && g.sisa.length === 0;
  return {
    terbaca,
    pasangan: terbaca && !g.pasangan.length && !(gol && gol.pasangan),
    ayah: terbaca && !g.ayah.length && !(gol && gol.ayah),
    ibu: terbaca && !g.ibu.length && !(gol && gol.ibu),
    saudara: terbaca && !g.saudara.length && !(gol && gol.saudara),
    anak: terbaca && !g.anak.length && !(gol && gol.anak),
  };
}

/**
 * @param {{perkara: {posita: string, petitum: string}, pihak1?: object[]}} d
 * @param {{pewaris?: string}} [opsi] pewaris (nilai 1025 hasil waris.js) bila sudah dibaca
 */
function usulanAhliWaris(d, opsi = {}) {
  const posita = String((d.perkara && d.perkara.posita) || "");
  const petitum = String((d.perkara && d.perkara.petitum) || "");
  const hasil = [];
  const g = golongkan({ petitum, posita, pewaris: opsi.pewaris, pihak1: d.pihak1 });
  const gol = golonganPosita(posita);
  if (g.pewaris && g.semua.length) {
    const sumberDaftar = g.dari === "pihak" ? "Pemohon di SIPP" : "petitum";
    const kalimatDaftar = `Ahli waris ${g.pewaris} menurut ${sumberDaftar}: ${g.semua.join("; ")}`;
    // Rujukan silang: jumlah anak harus sama dengan yang tertulis di posita, dan semua ahli waris harus tergolong.
    const kocokAnak = gol && gol.anak > 0 ? gol.anak === g.anak.length : null;
    // Satu ahli waris tersisa dan posita menyebut TEPAT satu dari ayah/ibu: itulah orang tuanya.
    const orangTuaSisa = g.sisa.length === 1 && gol && gol.ibu !== gol.ayah ? (gol.ibu ? "9704" : "9703") : "";
    const semuaTergolong = g.sisa.length === 0 || Boolean(orangTuaSisa);
    const pasti = semuaTergolong && (kocokAnak === null || kocokAnak === true) && g.dari === "petitum";
    const buat = (kode, nilai, kodePola) =>
      B.butir({
        kode,
        nama: NAMA[kode],
        nilai,
        keyakinan: pasti ? "cukup" : "ragu",
        kalimat: kalimatDaftar,
        asal: "posita-gugatan",
        catatan: pasti
          ? "Semua ahli waris di petitum tergolong menurut keterangan/pola nama dan sesuai golongan yang disebut posita; periksa dengan kartu keluarga."
          : "Hubungan dibaca dari keterangan dan pola nama (anak memakai nama pewaris sesudah bin/binti, saudara memakai nama ayah pewaris), bukan dari keterangan tertulis yang lengkap; penetapan ahli waris adalah penilaian hakim - periksa dengan kartu keluarga dan akta.",
        kodePola,
      });
    if (g.anak.length) {
      hasil.push(buat("9702", daftarTitikKoma(g.anak), "s5-paw-9702-anak"));
      hasil.push(buat("8608", g.anak.join(", "), "s5-paw-8608-anak"));
    }
    if (g.pasangan.length) hasil.push(buat("9701", daftarTitikKoma(g.pasangan), "s5-paw-9701-pasangan"));
    if (g.saudara.length) hasil.push(buat("9718", daftarTitikKoma(g.saudara), "s5-paw-9718-saudara"));
    if (g.ibu.length) hasil.push(buat("9704", daftarTitikKoma(g.ibu), "s5-paw-9704-ibu"));
    if (g.ayah.length) hasil.push(buat("9703", daftarTitikKoma(g.ayah), "s5-paw-9703-ayah"));
    if (orangTuaSisa) hasil.push(buat(orangTuaSisa, g.sisa[0], `s5-paw-${orangTuaSisa}-sisa`));
  }
  const pas = pasanganPosita(posita);
  if (pas) {
    hasil.push(
      B.butir({
        kode: "8610",
        nama: NAMA["8610"],
        nilai: pas.nama,
        keyakinan: "ragu",
        kalimat: pas.kalimat,
        asal: "posita-gugatan",
        catatan: "Nama pasangan pewaris dari kalimat pernikahan di posita; periksa ejaannya dengan akta nikah.",
        kodePola: "s5-paw-8610-pasangan",
      })
    );
  }
  const harta = hartaPosita(posita);
  if (harta) {
    hasil.push(
      B.butir({
        kode: "8614",
        nama: NAMA["8614"],
        nilai: harta.nilai,
        keyakinan: harta.nilai.length > 260 ? "ragu" : "cukup",
        kalimat: harta.kalimat,
        asal: "posita-gugatan",
        catatan: "Harta/dana yang ditinggalkan pewaris menurut kalimat posita; periksa dengan bukti (nomor rekening, sertifikat).",
        kodePola: "s5-paw-8614-posita",
      })
    );
  }
  const dana = pencairanDana(petitum);
  if (dana) {
    hasil.push(
      B.butir({
        kode: "9700",
        nama: NAMA["9700"],
        nilai: dana.nilai,
        keyakinan: "cukup",
        kalimat: dana.kalimat,
        asal: "posita-gugatan",
        catatan: "Salinan kalimat petitum tentang pencairan dana (jenis dana, lembaga dan atas nama); ringkas menjadi satu frasa tanpa titik akhir bila perlu.",
        kodePola: "s5-paw-9700-dana",
      })
    );
  }
  return hasil;
}

module.exports = { usulanAhliWaris, golongkan, golonganTiada, potongDaftarPetitum, pecahDaftar, uraiNama, pasanganPosita, golonganPosita, hartaPosita, pencairanDana, menunjuk };
