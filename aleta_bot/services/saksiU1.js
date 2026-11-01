"use strict";

/**
 * ============================================================================
 * KETERANGAN SAKSI CERAI - PERBAIKAN U1 (1 Nov 2026, lanjutan audit kekurangan-saksi-1nov.md bagian 5)
 * ============================================================================
 *
 * Langkah penutup di perbaiki() (saksiPerbaikan1Nov.js), MURNI (tanpa basis data/jaringan), hanya mengubah hasil susunan
 * 'saksi-sdg' dan tidak pernah menulis ke SIPP/ABT. Isi:
 *
 *   1  hubungan saksi: "karena saya adalah ... Penggugat" diisi dari (a) PILIHAN petugas di panel (kotak hubungan per saksi),
 *      (b) kolom Keterangan saksi SIPP, (c) variabel ABT hubungan saksi (1241/1242/... bila ikut terkirim). Petugas selalu menang.
 *   4  butir kesaksian murni ("pernah disampaikan kepada Tergugat", "pernah mendengar Tergugat membantah atau membenarkan",
 *      "sikap Tergugat"): bawaan menurut pengetahuan saksi dan kehadiran Tergugat; sikap/bantahan dari jawaban & duplik hanya
 *      bila naskahnya ada (bertanda "jawaban"); selain itu tetap titik-titik.
 *   5  huruf A (kebiasaan buruk), B (meninggalkan), H (pindah agama): butir yang dahulu selalu titik-titik diisi dari posita/
 *      alasan (variabel 5227) - bertanda "gugatan" (keputusan 61), hanya untuk saksi yang mengetahui langsung.
 *   6  arah Tolak/NO "tidak-tahu-apa": butir A/D bergantung sebab berbunyi konsisten (pola jawabTidakTahuSebab T11).
 *
 * Tidak satu kata pun tentang aplikasi ini masuk ke jawaban. Teks pihak (posita) disalin apa adanya ke dalam bunyi saksi hanya
 * sebagai potongan fakta (tanggal, jenis kebiasaan) - bukan kalimat pihak.
 */

const teks = (x) => String(x == null ? "" : x);
const RE_TITIK = /\.{3,}|…/;
const adaTitik = (t) => RE_TITIK.test(teks(t));
const adaPilih = (t) => /\s\/\s/.test(teks(t)) && !/\d\s\/\s\d/.test(teks(t));
const belumTerisi = (j) => adaTitik(j.jawab) || adaPilih(j.jawab) || (Array.isArray(j.pilihan) && j.pilihan.length >= 2);
const bersih = (p) =>
  teks(p)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const kalimat = (t) => {
  let s = teks(t).replace(/\s+/g, " ").trim().replace(/[\s;,.]+$/, "");
  if (!s) return "";
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return `${s};`;
};

// ─── 1. Hubungan saksi ───────────────────────────────────────────────────────

/**
 * Daftar pilihan hubungan saksi dengan pihak. [kunci, label, frasa, keluarga]. Frasa ditulis sebelum sebutan pihak:
 * "saya adalah <frasa> Penggugat". Kunci sama dengan DAFTAR_HUBUNGAN di ekstensi-sipp/blangko-derry-saksi.js (diuji sama).
 */
const HUBUNGAN = Object.freeze([
  ["ayah-kandung", "Ayah kandung", "ayah kandung", true],
  ["ibu-kandung", "Ibu kandung", "ibu kandung", true],
  ["kakak-kandung", "Kakak kandung", "kakak kandung", true],
  ["adik-kandung", "Adik kandung", "adik kandung", true],
  ["saudara-kandung", "Saudara kandung", "saudara kandung", true],
  ["anak-kandung", "Anak kandung", "anak kandung", true],
  ["paman", "Paman", "paman", true],
  ["bibi", "Bibi", "bibi", true],
  ["kakek", "Kakek", "kakek", true],
  ["nenek", "Nenek", "nenek", true],
  ["sepupu", "Sepupu", "sepupu", true],
  ["keponakan", "Keponakan", "keponakan", true],
  ["ipar", "Ipar", "ipar", true],
  ["mertua", "Mertua", "mertua", true],
  ["menantu", "Menantu", "menantu", true],
  ["keluarga-lain", "Keluarga dekat lainnya", "keluarga dekat", true],
  ["tetangga", "Tetangga", "tetangga", false],
  ["teman", "Teman", "teman", false],
  ["sahabat", "Sahabat", "sahabat", false],
  ["rekan-kerja", "Rekan kerja", "rekan kerja", false],
  ["ketua-rt", "Ketua RT/RW", "Ketua RT/RW di lingkungan tempat tinggal", false],
  ["kepala-desa", "Kepala desa/lurah", "Kepala Desa/Lurah tempat tinggal", false],
  ["tokoh-masyarakat", "Tokoh masyarakat/adat", "tokoh masyarakat di lingkungan tempat tinggal", false],
]);
const PETA_HUBUNGAN = new Map(HUBUNGAN.map((h) => [h[0], h]));
const kunciHubunganSah = (k) => PETA_HUBUNGAN.has(teks(k));
/** "ibu kandung Penggugat" dari kunci pilihan dan sebutan pihak; null bila kunci tidak dikenal. */
function frasaHubungan(kunci, sebutan) {
  const h = PETA_HUBUNGAN.get(teks(kunci));
  return h ? `${h[2]} ${teks(sebutan).trim()}`.trim() : null;
}
/** Kata hubungan -> kunci pilihan (untuk menampilkan hubungan dari SIPP sebagai pilihan); "" bila tak dikenal (tidak ditebak). */
function kunciDariTeks(t) {
  const s = teks(t).toLowerCase().replace(/\b(?:penggugat|tergugat|pemohon|termohon|para)\b\s*(?:i{1,3}|iv|\d)?/g, " ").replace(/[^a-z\s/]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return "";
  const urut = [
    [/ketua\s+r[tw]|ketua\s+rt/, "ketua-rt"],
    [/kepala\s+desa|lurah|kades/, "kepala-desa"],
    [/tokoh/, "tokoh-masyarakat"],
    [/rekan\s+kerja|teman\s+kerja/, "rekan-kerja"],
    [/sahabat/, "sahabat"],
    [/tetangga/, "tetangga"],
    [/\bteman\b|\bkawan\b/, "teman"],
    [/ayah\s+kandung|bapak\s+kandung/, "ayah-kandung"],
    [/ibu\s+kandung/, "ibu-kandung"],
    [/kakak\s+kandung|\bkakak\b|\babang\b/, "kakak-kandung"],
    [/adik\s+kandung|\badik\b/, "adik-kandung"],
    [/saudara\s+kandung/, "saudara-kandung"],
    [/anak\s+kandung/, "anak-kandung"],
    [/sepupu/, "sepupu"],
    [/keponakan/, "keponakan"],
    [/\bpaman\b|\bom\b/, "paman"],
    [/\bbibi\b|\btante\b/, "bibi"],
    [/kakek/, "kakek"],
    [/nenek/, "nenek"],
    [/ipar/, "ipar"],
    [/mertua/, "mertua"],
    [/menantu/, "menantu"],
  ];
  for (const [re, k] of urut) if (re.test(s)) return k;
  return "";
}

/** "saya [adalah] ... Penggugat" - sama dengan pola isiHubungan di blangko-derry-saksi.js. */
const RE_HUBUNGAN = /(\b(?:adalah|sebagai|saya)\s+)(?:\.{3,}|…|_{2,})(\s+(?:Penggugat|Pemohon|Tergugat|Termohon)\b(?:\s+(?:I{1,3}|IV|\d)\b)?)/i;
const RE_TANYA_KENAL = /\bkenal\b|\bmengenal\b/i;
/** Jawaban butir "kenal" dengan hubungan terisi; null bila jawaban itu tidak memuat tempat hubungan. */
function isiHubungan(jawab, bentuk) {
  const j = teks(jawab);
  if (!RE_HUBUNGAN.test(j)) return null;
  return j.replace(RE_HUBUNGAN, (_, depan, sebutan) => `${depan}${bentuk(sebutan.trim())}`);
}

/**
 * Hubungan satu saksi: pilihan petugas > SIPP > variabel ABT. null bila tidak ada.
 * @returns {{teks: (sebutan:string)=>string, kunci: string, tampil: string, sumber: string, yakin: string, ket: string}|null}
 */
function hubunganSaksi(o) {
  const { pilihan, sipp, isian, pihak, urut, P, T } = o;
  if (kunciHubunganSah(pilihan)) {
    const h = PETA_HUBUNGAN.get(pilihan);
    return { bentuk: (sebutan) => frasaHubungan(pilihan, sebutan), kunci: pilihan, tampil: h[1], sumber: "pilihan hubungan saksi", yakin: "pasti", ket: "Hubungan saksi dengan pihak sesuai pilihan di panel." };
  }
  const D = (() => {
    try {
      return require("./deteksiSaksiService");
    } catch (_g) {
      return null;
    }
  })();
  const dariLabel = (label, sumber) => {
    const l = teks(label).replace(/\s+/g, " ").trim();
    if (!l) return null;
    let isi = l;
    let yakin = "cukup";
    try {
      const d = D && D.deteksiHubungan(l, { bentuk: "label" });
      if (d) {
        isi = D.hubunganTampil(l, d, pihak, P, T);
        yakin = "yakin";
      }
    } catch (_g) {
      /* label ditulis apa adanya */
    }
    return {
      bentuk: () => isi.replace(/\b[A-Z][a-z-]+\b/g, (k) => (/^(?:Pemohon|Termohon|Penggugat|Tergugat|Para)$/.test(k) ? (k === "Para" ? "para" : k) : k.toLowerCase())),
      kunci: kunciDariTeks(isi),
      tampil: isi,
      sumber,
      yakin,
      ket: yakin === "yakin" ? "" : "Hubungan saksi ditulis seperti di sumbernya; periksa penulisannya.",
    };
  };
  const daftar = sipp && Array.isArray(sipp.saksi) ? sipp.saksi : [];
  const id = daftar.find((x) => x && x.pihak === pihak && Number(x.urutPihak) === Number(urut));
  const dariSipp = id ? dariLabel(id.keterangan, "data SIPP") : null;
  if (dariSipp) return dariSipp;
  // Variabel ABT "Hbgn. Saksi n dg. Pihak" (P: 1241, 1242, 6149, 8923/6150, 8930; T: 1251, 1252, 8922, 8940).
  const KODE = { P: [["1241"], ["1242"], ["6149"], ["8923", "6150"], ["8930"]], T: [["1251"], ["1252"], ["8922"], ["8940"]] };
  for (const kode of (KODE[pihak] || [])[urut - 1] || []) {
    const v = isian && isian[kode];
    const nilai = teks(v && typeof v === "object" ? v.nilai : v).trim();
    if (nilai && !adaTitik(nilai) && !/#\d{3,5}#/.test(nilai)) return dariLabel(nilai, "isian blangko");
  }
  return null;
}

// ─── Pengetahuan saksi (golongan) ────────────────────────────────────────────

const LANGSUNG = new Set(["sama", "sebagian", "mendengar", ""]);
const TAK_TAHU = new Set(["tidak-tahu", "tidak-melihat", "tahu-pisah", "tidak-tahu-apa"]);
const golongan = (modus) => (LANGSUNG.has(modus) ? "langsung" : TAK_TAHU.has(modus) ? "tak-tahu" : modus === "ragu" ? "ragu" : modus === "dari-cerita" ? "cerita" : modus === "sebaliknya" ? "sebaliknya" : "langsung");

// ─── 4. Butir kesaksian murni ────────────────────────────────────────────────

const RE_DISAMPAIKAN = /menyampaikan\s+kepada\s+\S+\s+bahwa/i;
const RE_MEMBANTAH = /pernah\s+mendengar\s+\S+\s+membantah\s+atau\s+membenarkan/i;
const RE_SIKAP = /bagaimana\s+sikap\s+\S+\s+terhadap\s+rumah\s+tangga/i;
const RE_SETUJU_CERAI = /tidak\s+keberatan\s+(?:untuk\s+)?(?:ber)?cerai|setuju\s+(?:untuk\s+)?(?:ber)?cerai|bersedia\s+(?:ber)?cerai|mengikuti\s+kehendak\s+\S+\s+(?:untuk\s+)?(?:ber)?cerai/i;

function sikapDariNaskah(b, naskah, T) {
  if (!b || !b.ada) return null;
  const bagian = [];
  const setuju = RE_SETUJU_CERAI.test(teks(naskah));
  if (b.bantahan.has("tidak-ada-pertengkaran")) bagian.push("membantah adanya pertengkaran");
  if (b.bantahan.has("masih-ingin-rukun")) bagian.push("masih ingin mempertahankan rumah tangga");
  if (setuju && bagian.length) return null; // naskah bertentangan: biarkan petugas memilih
  if (setuju) bagian.push("tidak keberatan bercerai");
  return bagian.length ? `${T} ${bagian.join(" dan ")}` : null;
}

function kesaksianMurni(o) {
  const { tanya, gol, kontra, bantahan, naskah, P, T, ke, sumberJawaban, hanyaLisan } = o;
  const n = Number(ke) % 2;
  if (RE_DISAMPAIKAN.test(tanya)) {
    if (gol === "tak-tahu") return { jawab: kalimat(n ? `Saya tidak mengetahui apakah hal itu pernah disampaikan kepada ${T}` : `Hal itu tidak saya ketahui, apakah pernah disampaikan kepada ${T}`), yakin: "cukup", sumber: "pengetahuan saksi", ket: "Saksi tidak mengetahui hal ini (pilihan pengetahuan saksi); sesuaikan dengan keterangan saksi." };
    if (gol === "ragu") return { jawab: kalimat(`Saya kurang ingat apakah hal itu pernah disampaikan kepada ${T}`), yakin: "ragu", sumber: "pengetahuan saksi", ket: "Saksi ragu dan kurang ingat (pilihan pengetahuan saksi); sesuaikan dengan keterangan saksi." };
    return null;
  }
  if (RE_MEMBANTAH.test(tanya)) {
    if (gol === "tak-tahu") return { jawab: kalimat(n ? `Saya tidak pernah mendengar ${T} membantah maupun membenarkan adanya pertengkaran itu` : `Saya tidak pernah mendengar ${T} membantah ataupun membenarkan hal itu`), yakin: "cukup", sumber: "pengetahuan saksi", ket: "Saksi tidak mengetahui hal ini (pilihan pengetahuan saksi); sesuaikan dengan keterangan saksi." };
    if (gol === "ragu") return { jawab: kalimat(`Saya kurang ingat apakah saya pernah mendengar ${T} membantah atau membenarkan adanya pertengkaran itu`), yakin: "ragu", sumber: "pengetahuan saksi", ket: "Saksi ragu dan kurang ingat (pilihan pengetahuan saksi); sesuaikan dengan keterangan saksi." };
    if (gol === "langsung" && kontra && bantahan && bantahan.ada) {
      const bantah = bantahan.bantahan.has("tidak-ada-pertengkaran");
      if (bantah === Boolean(bantahan.membenarkan)) return null; // tidak ada / bertentangan
      return { jawab: kalimat(`Saya pernah mendengar ${T} ${bantah ? "membantah" : "membenarkan"} adanya pertengkaran itu`), yakin: "ragu", sumber: sumberJawaban, ket: `Disusun dari ${hanyaLisan ? "jawaban/duplik LISAN" : "jawaban/duplik"} ${T}, bukan dari ucapan saksi; periksa dengan keterangan saksi.`, peringatan: "jawaban" };
    }
    return null;
  }
  if (RE_SIKAP.test(tanya)) {
    if (gol === "tak-tahu") return { jawab: kalimat(`Sikap ${T} terhadap rumah tangganya dengan ${P} tidak saya ketahui`), yakin: "cukup", sumber: "pengetahuan saksi", ket: "Saksi tidak mengetahui hal ini (pilihan pengetahuan saksi); sesuaikan dengan keterangan saksi." };
    if (gol === "ragu") return { jawab: kalimat(`Saya kurang yakin bagaimana sikap ${T} terhadap rumah tangganya`), yakin: "ragu", sumber: "pengetahuan saksi", ket: "Saksi ragu dan kurang ingat (pilihan pengetahuan saksi); sesuaikan dengan keterangan saksi." };
    if (gol === "langsung" || gol === "cerita") {
      const s = sikapDariNaskah(bantahan, naskah, T);
      if (s) return { jawab: kalimat(s), yakin: "ragu", sumber: sumberJawaban, ket: `Disusun dari ${hanyaLisan ? "jawaban/duplik LISAN" : "jawaban/duplik"} ${T}, bukan dari ucapan saksi; periksa dengan keterangan saksi.`, peringatan: "jawaban" };
    }
    return null;
  }
  return null;
}

// ─── 5. Huruf A, B, H dari posita / alasan ───────────────────────────────────

const KEBIASAAN = [
  ["judi", /\b(?:berjudi|judi|main\s+judi|bermain\s+judi|togel|judi\s+online|judol)\b/i, "berjudi"],
  ["mabuk", /\b(?:mabuk|mabuk-mabukan|minuman\s+keras|miras|minum-minuman|alkohol|menenggak)\b/i, "mabuk-mabukan"],
  ["narkoba", /\b(?:narkoba|narkotika|sabu|sabu-sabu|obat-obatan\s+terlarang|obat\s+terlarang|obat\s+terlarang|ganja|putau|pil\s+koplo)\b/i, "memakai narkoba"],
  ["zina", /\b(?:berzina|zina)\b/i, "berbuat zina"],
];
const gabung = (daftar) => (daftar.length < 2 ? daftar.join("") : `${daftar.slice(0, -1).join(", ")} dan ${daftar[daftar.length - 1]}`);
/** Kalimat posita (potongan) yang memuat salah satu kebiasaan buruk. */
function kalimatPosita(p) {
  return teks(p)
    .split(/(?<=;)\s+|\s+(?=\d{1,2}\s*[.)]\s+Bahwa)|(?<=[a-z0-9)])\.\s+(?=[A-Z])/)
    .map((x) => x.trim())
    .filter(Boolean);
}
const BULAN = "(?:Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)";
const RE_SEJAK = new RegExp(`\\bsejak\\s+((?:bulan\\s+)?${BULAN}\\s+\\d{4}|tahun\\s+\\d{4}|(?:awal|akhir|pertengahan)\\s+tahun\\s+\\d{4}|\\d{4}|menikah|awal\\s+(?:pernikahan|menikah)|sebelum\\s+menikah)`, "i");

function kebiasaanDariPosita(bahan, ct) {
  const hasil = [];
  for (const [kunci, re, frasa] of KEBIASAAN) {
    if (kunci === "zina" && !ct) continue;
    if (re.test(bahan)) hasil.push({ kunci, frasa, re });
  }
  return hasil;
}

function jawabHurufA(o) {
  const { tanya, daftar, kalimat: kal, T, P, gol, ke, ct, bahan, alasanDipilih } = o;
  if (!daftar.length) return null;
  const frasa = gabung(daftar.map((d) => d.frasa));
  // "sejak Januari 2022 rumah tangga tidak harmonis karena Tergugat berjudi": tanggal itu awal perselisihan, bukan awal kebiasaan.
  const sek = (re) => kal.filter((k) => daftar.some((d) => d.re.test(k)) && re.test(k) && !/rumah\s+tangga|harmonis|perselisihan|pertengkaran|puncak/i.test(k));
  if (/kebiasaan\s+buruk\s+apa/i.test(tanya)) return { jawab: kalimat(`${T} mempunyai kebiasaan ${frasa}`) };
  if (/sejak\s+kapan\s+dan\s+seberapa\s+sering/i.test(tanya)) {
    const k = sek(RE_SEJAK)[0];
    const m = k && RE_SEJAK.exec(k);
    if (!m) return null;
    const sejak = m[1].replace(/^menikah$/i, "menikah");
    const unit = (sek(/\bsetiap\s+(hari|malam|minggu|bulan)\b/i)[0] || "").match(/\bsetiap\s+(hari|malam|minggu|bulan)\b/i);
    return { jawab: kalimat(unit ? `Sejak ${sejak}, hampir setiap ${unit[1]}` : `Sejak ${sejak}, ${T} sering melakukannya`) };
  }
  if (/bagaimana\s+Saudara\s+mengetahui\s+kebiasaan/i.test(tanya)) {
    if (gol !== "langsung") return null;
    return { jawab: kalimat(Number(ke) % 2 === 1 ? `Saya pernah menyaksikan sendiri ketika ${T} ${frasa}` : `Saya melihat sendiri ketika ${T} ${frasa}`), pengetahuan: true };
  }
  if (/dinasihati\s+agar\s+berhenti/i.test(tanya)) {
    if (!/\b(?:dinasihati|dinasehati|ditegur|diingatkan|dibujuk|dilarang)\b/i.test(bahan)) return null;
    if (!/\b(?:tetap|namun|tetapi|tidak\s+(?:mau\s+)?berubah|mengulangi|terus)\b/i.test(bahan)) return null;
    return { jawab: kalimat(`Sudah dinasihati, tetapi ${T} tetap mengulanginya`) };
  }
  if (/sampai\s+sekarang\s+\S+\s+masih\s+melakukan/i.test(tanya)) {
    if (/\b(?:sudah|telah)\s+(?:berhenti|tidak\s+lagi)\b/i.test(bahan)) return null;
    return { jawab: kalimat(`Ya, sampai sekarang ${T} masih ${frasa}`) };
  }
  if (/akibat\s+kebiasaan/i.test(tanya)) {
    if (!/\b(?:pertengkaran|perselisihan|tidak\s+harmonis)\b/i.test(bahan)) return null;
    return { jawab: kalimat(`Akibatnya rumah tangga ${P} dan ${T} menjadi tidak harmonis dan sering terjadi pertengkaran`) };
  }
  void ke;
  void ct;
  void alasanDipilih;
  return null;
}

function jawabHurufB(o) {
  const { tanya, fakta, bahan, T, P } = o;
  if (/sejak\s+kapan\s+\S+\s+meninggalkan/i.test(tanya)) {
    if (!fakta || !fakta.adaPisah || !fakta.pisahSejak) return null;
    if (fakta.siapaPergi && fakta.siapaPergi !== T) return null;
    const lama = teks(fakta.lamaPisah).trim();
    return { jawab: kalimat(lama ? `${T} pergi meninggalkan ${P} sejak ${fakta.pisahSejak}, sampai sekarang sudah ${lama}` : `${T} pergi meninggalkan ${P} sejak ${fakta.pisahSejak}`) };
  }
  if (/keluarga\s+pernah\s+berusaha\s+mencari/i.test(tanya)) {
    if (!/\b(?:dicari|mencari|dibujuk|membujuk|dijemput|menjemput)\b|\b(?:diminta|meminta(?:\s+\S+)?)\s+(?:untuk\s+)?(?:kembali|pulang)\b/i.test(bahan)) return null;
    if (!/\b(?:tidak\s+(?:mau|bersedia)|menolak|tidak\s+(?:pernah\s+)?(?:kembali|pulang))\b/i.test(bahan)) return null;
    return { jawab: kalimat(`Sudah dicari dan diminta kembali, namun ${T} tidak mau kembali`) };
  }
  return null;
}

const AGAMA = "(Kristen|Katolik|Protestan|Hindu|Buddha|Budha|Konghucu|Kristen\\s+Protestan)";
function jawabHurufH(o) {
  const { tanya, bahan, jawab, T } = o;
  const m = new RegExp(`(?:berpindah|pindah|beralih|kembali|memeluk|menganut|masuk)\\s+(?:ke\\s+)?(?:agama\\s+)?${AGAMA}`, "i").exec(bahan) || new RegExp(`agama\\s+${AGAMA}`, "i").exec(bahan);
  if (!m) return null;
  const agama = m[1];
  if (!/agama\s+\.{3,}/i.test(jawab)) return null;
  void tanya;
  void T;
  const isi = jawab.replace(/agama\s+(?:\.{3,}|…)/gi, `agama ${agama}`);
  return isi === jawab ? null : { jawab: isi, sebagian: true };
}

// ─── 3. Pisah rumah dan komunikasi (dua pertanyaan BAS nyata) ────────────────

const RE_TANYA_SERUMAH = /masih\s+tinggal\s+(?:serumah|satu\s+rumah)/i;
const RE_TANYA_KOMUNIKASI = /(?:ada|menjalin|masih)\s+(?:komunikasi|berkomunikasi)|berkomunikasi/i;
/**
 * Jawaban bawaan "masih serumah?" dan "masih ada komunikasi selama pisah?" menurut posita. null = biarkan bunyi set
 * (sudah tidak ada komunikasi / sudah berpisah tempat tinggal sejak ...). \`serumah\` dihitung penelepon (keadaanPisah).
 */
function jawabPisah(o) {
  const { tanya, bahan, P, T, serumah } = o;
  if (RE_TANYA_SERUMAH.test(tanya)) return serumah ? kalimat(`Ya, ${P} dan ${T} masih tinggal serumah`) : null;
  if (RE_TANYA_KOMUNIKASI.test(tanya) && /selama\s+(?:ber)?pisah/i.test(tanya)) {
    if (!/\bmasih\s+(?:ada\s+|saling\s+|sering\s+)?(?:berkomunikasi|komunikasi|menghubungi|bertelepon)/i.test(bahan)) return null;
    if (/tidak\s+(?:pernah\s+)?(?:lagi\s+)?(?:ada\s+)?(?:berkomunikasi|komunikasi)/i.test(bahan)) return null; // bertentangan: biarkan bunyi set
    const anak = /komunikasi[^.;]{0,50}\b(?:anak|urusan\s+anak)\b|\banak\b[^.;]{0,40}komunikasi/i.test(bahan);
    return kalimat(anak ? `Selama pisah antara ${P} dan ${T} masih ada komunikasi, hanya mengenai anak` : `Selama pisah antara ${P} dan ${T} masih ada komunikasi`);
  }
  return null;
}

/** Huruf D (kekerasan): bentuk kekerasan dan laporan, hanya yang disebut posita. */
const BENTUK_KEKERASAN = [
  [/\b(?:memukul|dipukul|pukulan|memukuli)\b/i, "memukul"],
  [/\b(?:menampar|ditampar|tamparan)\b/i, "menampar"],
  [/\b(?:menendang|ditendang|tendangan)\b/i, "menendang"],
  [/\b(?:mencekik|dicekik)\b/i, "mencekik"],
  [/\b(?:menjambak|dijambak)\b/i, "menjambak"],
  [/\b(?:melempar|dilempar)\b/i, "melempar"],
  [/\b(?:mengancam|diancam|ancaman)\b/i, "mengancam"],
  [/\b(?:menganiaya|dianiaya|penganiayaan)\b/i, "menganiaya"],
];
function jawabHurufD(o) {
  const { tanya, bahan, T, P } = o;
  if (/pernah\s+melakukan\s+kekerasan\s+terhadap/i.test(tanya)) {
    const bentuk = BENTUK_KEKERASAN.filter(([re]) => re.test(bahan)).map(([, k]) => k);
    return bentuk.length ? { jawab: kalimat(`Ya, ${T} pernah ${gabung(bentuk)} ${P}`) } : null;
  }
  if (/dilaporkan\s+kepada/i.test(tanya)) {
    const m = /\b(?:melapor|melaporkan|dilaporkan|laporan)\b[^.;]{0,80}?\b(polisi|polres|polsek|kepolisian|pemerintah\s+desa|kepala\s+desa|lurah)\b/i.exec(bahan);
    if (!m) return null;
    const tujuan = /pol/i.test(m[1]) ? "polisi" : "pemerintah desa";
    return { jawab: kalimat(`Kejadian itu pernah dilaporkan kepada ${tujuan}`) };
  }
  return null;
}

// ─── 6. Arah Tolak/NO "tidak-tahu-apa" pada butir A/D ────────────────────────

/**
 * Jawaban butir huruf A (kebiasaan buruk) dan D (kekerasan) untuk arah "tidak-tahu-apa" (Tolak/NO: saksi tidak tahu
 * perselisihan maupun sebabnya) dan "sebaliknya" (keterangan berkebalikan). Pola sama dengan jawabTidakTahuSebab (T11).
 * null = bukan butir A/D bergantung sebab.
 */
const RE_A = /kebiasaan|dinasihati\s+agar\s+berhenti/i;
const RE_D = /kekerasan|bekas\s+luka|kejadian\s+itu|dilaporkan\s+kepada/i;
function jawabArahSebab(o) {
  const { tanya, modus, P, T, ke, n } = o;
  const q = teks(tanya);
  const a = RE_A.test(q);
  const d = !a && RE_D.test(q);
  if (!a && !d) return null;
  const objek = a ? `kebiasaan buruk ${T}` : "kekerasan itu";
  const genap = Number(ke) % 2 === 1;
  if (modus === "sebaliknya") {
    const daftar = a
      ? genap
        ? [`Sepengetahuan saya ${T} tidak mempunyai kebiasaan buruk seperti itu`, `Setahu saya ${T} tidak pernah berbuat seperti yang disebutkan ${P}`, `Saya tidak pernah melihat ${T} melakukan kebiasaan buruk seperti itu`]
        : [`Setahu saya ${T} tidak mempunyai kebiasaan buruk seperti itu`, `Sepengetahuan saya ${T} tidak berbuat seperti yang disebutkan ${P}`, `Saya tidak pernah mengetahui ${T} melakukan kebiasaan buruk seperti itu`]
      : genap
        ? [`Sepengetahuan saya ${T} tidak pernah melakukan kekerasan terhadap ${P}`, `Setahu saya tidak pernah ada kekerasan yang dilakukan ${T} kepada ${P}`, `Saya tidak pernah mengetahui ${T} berbuat kasar kepada ${P}`]
        : [`Setahu saya ${T} tidak pernah melakukan kekerasan terhadap ${P}`, `Sepengetahuan saya tidak pernah ada kekerasan antara ${T} dan ${P}`, `Saya tidak pernah mendengar ${T} berbuat kasar kepada ${P}`];
    return kalimat(daftar[Number(n) % daftar.length]);
  }
  if (modus === "ragu") {
    const daftarRagu = genap ? [`Saya kurang ingat apakah ada ${objek}`, `Soal ${objek} saya kurang ingat`] : [`Saya kurang yakin apakah ada ${objek}`, `Mengenai ${objek} saya kurang ingat`];
    return kalimat(daftarRagu[Number(n) % daftarRagu.length]);
  }
  const daftar = genap
    ? [`Saya tidak mengetahui adanya ${objek}`, `Soal ${objek} tidak saya ketahui`, `Saya tidak tahu apakah ada ${objek}`]
    : [`Saya tidak mengetahui apakah ada ${objek}`, `${objek.charAt(0).toUpperCase()}${objek.slice(1)} tidak saya ketahui`, `Saya tidak pernah mengetahui adanya ${objek}`];
  return kalimat(daftar[Number(n) % daftar.length]);
}

// ─── Penutup ──────────────────────────────────────────────────────────────────

function tulis(j, jawab, u) {
  j.jawab = jawab;
  delete j.pilihan;
  delete j.saran;
  j.usulan = { teks: jawab, yakin: u.yakin || "cukup", sumber: u.sumber || "", ket: u.ket || "", ...(u.peringatan ? { peringatan: u.peringatan } : {}) };
}

/**
 * @param {object} hasil hasil susunan saksi-sdg (DIUBAH di tempat)
 * @param {object} o  P, T, cerai, ct, posita, bantahan, naskahTeks, sumberJawaban, hanyaLisan, saksi (masukan), sipp, isian, tanggalSidang, templat
 * @returns {object} ringkasan {hubungan, murni, hurufA, hurufB, hurufH}
 */
function terapkan(hasil, o) {
  const ringkas = { hubungan: 0, murni: 0, hurufA: 0, hurufB: 0, hurufH: 0, hurufD: 0, pisah: 0, sebab: 0 };
  if (!hasil || !Array.isArray(hasil.saksi) || !o || !o.cerai) return ringkas;
  const { P, T, ct } = o;
  const posita = bersih(o.posita);
  const isianAlasan = o.isian && o.isian["5227"] ? teks(typeof o.isian["5227"] === "object" ? o.isian["5227"].nilai : o.isian["5227"]) : "";
  const bahan = `${posita} ${bersih(isianAlasan)}`.trim();
  const adaBahan = bahan.length >= 20;
  const kal = kalimatPosita(bahan);
  const daftarKebiasaan = adaBahan ? kebiasaanDariPosita(bahan, ct) : [];
  let fakta = null;
  const perlukanFakta = adaBahan && hasil.saksi.some((s) => (s.jawaban || []).some((j) => /sejak\s+kapan\s+\S+\s+meninggalkan/i.test(teks(j && j.tanya))));
  if (perlukanFakta) {
    try {
      fakta = require("./abtUsulanService").faktaDariPosita(posita, T, P, { tanggalSidang: teks(o.tanggalSidang) });
    } catch (_g) {
      fakta = null;
    }
  }
  const kontra = (hasil.saksi[0] && hasil.saksi[0].jawaban ? hasil.saksi[0].jawaban : []).some((j) => RE_SIKAP.test(teks(j && j.tanya)) || RE_MEMBANTAH.test(teks(j && j.tanya)));
  const hitung = { P: 0, T: 0 };
  let murniTanpaNaskah = false;
  let serumah = null;

  hasil.saksi.forEach((s, idx) => {
    const masuk = (Array.isArray(o.saksi) && o.saksi[idx]) || {};
    const pihak = (s.pihak || masuk.pihak) === "T" ? "T" : "P";
    hitung[pihak] += 1;
    const modus = teks(masuk.modus || s.modus);
    const gol = golongan(modus);
    const hub = hubunganSaksi({ pilihan: masuk.hubungan, sipp: o.sipp, isian: o.isian, pihak, urut: hitung[pihak], P, T });
    if (hub) s.hubunganDipakai = { kunci: hub.kunci, teks: hub.tampil, sumber: hub.sumber };
    (s.jawaban || []).forEach((j, n) => {
      if (!j || typeof j !== "object" || j.belumTerisi) return;
      const tanya = teks(j.tanya || (o.templat && o.templat[n] && o.templat[n].tanya));
      // 1. hubungan saksi
      if (hub && RE_TANYA_KENAL.test(tanya)) {
        const baru = isiHubungan(j.jawab, hub.bentuk);
        if (baru) {
          tulis(j, baru, { yakin: hub.yakin, sumber: hub.sumber, ket: hub.ket });
          ringkas.hubungan += 1;
        }
      }
      // 3. pisah rumah / komunikasi menurut posita (jawaban set sudah tanpa titik: hanya diganti bila posita menyatakan lain)
      if (pihak === "P" && gol === "langsung" && adaBahan && (RE_TANYA_SERUMAH.test(tanya) || RE_TANYA_KOMUNIKASI.test(tanya))) {
        if (serumah === null && RE_TANYA_SERUMAH.test(tanya)) {
          try {
            serumah = require("./saksiPerbaikan1Nov").keadaanPisah(posita, T, P, o.tanggalSidang).serumah;
          } catch (_g) {
            serumah = false;
          }
        }
        const d = jawabPisah({ tanya, bahan, P, T, serumah: serumah === true });
        if (d) {
          tulis(j, d, { yakin: "ragu", sumber: "gugatan", ket: "Dibaca dari gugatan perkara ini; periksa dengan keterangan saksi.", peringatan: "gugatan" });
          ringkas.pisah += 1;
          return;
        }
      }
      if (pihak === "T" || !belumTerisi(j)) return; // saksi Tergugat dan butir yang sudah terisi tidak diubah di bawah ini
      // 4. kesaksian murni
      const murni = kesaksianMurni({ tanya, gol, kontra, bantahan: o.bantahan, naskah: o.naskahTeks, P, T, ke: idx, sumberJawaban: o.sumberJawaban, hanyaLisan: o.hanyaLisan });
      if (murni && belumTerisi(j)) {
        tulis(j, murni.jawab, murni);
        ringkas.murni += 1;
        return;
      }
      if (!murni && belumTerisi(j) && (RE_SIKAP.test(tanya) || RE_MEMBANTAH.test(tanya)) && gol === "langsung" && !(o.bantahan && o.bantahan.ada)) murniTanpaNaskah = true;
      // 6. butir huruf A (kebiasaan buruk) / D (kekerasan) bagi saksi yang tidak melihat, hanya tahu pisah, atau ragu
      if (modus === "tidak-melihat" || modus === "tahu-pisah" || modus === "ragu") {
        const x = jawabArahSebab({ tanya, modus: modus === "ragu" ? "ragu" : "tidak-tahu-apa", P, T, ke: idx, n });
        if (x) {
          tulis(j, x, { yakin: "cukup", sumber: "pengetahuan saksi", ket: "Sesuai pilihan pengetahuan saksi; sesuaikan dengan keterangan saksi." });
          ringkas.sebab += 1;
          return;
        }
      }
      // 5. huruf A / B / H - hanya saksi yang mengetahui langsung (sama/mendengar; sebagian bila alasannya memang itu)
      if (gol !== "langsung" || !adaBahan) return;
      const sebagianCocok = (masuk.alasan || []).some((x) => /judi|mabuk|obat|narkoba|pihak lain|meninggalkan|pergi|agama|murtad/i.test(teks(x)));
      if (modus === "sebagian" && !sebagianCocok) return;
      const a = jawabHurufA({ tanya, daftar: daftarKebiasaan, kalimat: kal, T, P, gol, ke: idx, ct, bahan });
      if (a) {
        tulis(j, a.jawab, { yakin: "ragu", sumber: "gugatan", ket: "Dibaca dari gugatan/alasan perkara ini; periksa dengan keterangan saksi.", peringatan: "gugatan" });
        ringkas.hurufA += 1;
        return;
      }
      const b = jawabHurufB({ tanya, fakta, bahan, T, P });
      if (b) {
        tulis(j, b.jawab, { yakin: "ragu", sumber: "gugatan", ket: "Dibaca dari gugatan perkara ini; periksa dengan keterangan saksi.", peringatan: "gugatan" });
        ringkas.hurufB += 1;
        return;
      }
      const d = jawabHurufD({ tanya, bahan, T, P });
      if (d) {
        tulis(j, d.jawab, { yakin: "ragu", sumber: "gugatan", ket: "Dibaca dari gugatan perkara ini; periksa dengan keterangan saksi.", peringatan: "gugatan" });
        ringkas.hurufD += 1;
        return;
      }
      if (/agama/i.test(tanya)) {
        const h = jawabHurufH({ tanya, bahan, jawab: teks(j.jawab), T });
        if (h) {
          tulis(j, h.jawab, { yakin: "ragu", sumber: "gugatan", ket: "Agama baru dibaca dari gugatan perkara ini; periksa dengan keterangan saksi.", peringatan: "gugatan" });
          ringkas.hurufH += 1;
        }
      }
    });
  });

  if (murniTanpaNaskah && !hasil.jawabanTBelumAda) {
    hasil.catatan = `${teks(hasil.catatan)} Jawaban ${T} belum ada (jawaban dan duplik e-Court maupun jawaban lisan di BAS tidak terbaca) - sikap ${T} dan bantahannya dibiarkan bertitik-titik; isi dari keterangan saksi.`.trim();
  }

  // Saksi berikutnya (pihak yang sama) tidak berbunyi sama persis dengan saksi sebelumnya.
  try {
    const PB = require("./saksiPerbaikan1Nov");
    const sebutan = [P, T, "Penggugat", "Tergugat", "Pemohon", "Termohon"];
    const dipakai = new Map();
    hasil.saksi.forEach((s, idx) => {
      (s.jawaban || []).forEach((j, n) => {
        if (!j || j.belumTerisi || belumTerisi(j)) return;
        const kunci = `${s.pihak || "P"}|${n}`;
        const lalu = dipakai.get(kunci) || new Set();
        const norma = (t) => teks(t).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
        const a = norma(j.jawab);
        const diubahU1 = j.usulan && /gugatan|pengetahuan saksi|pilihan hubungan saksi|jawaban/i.test(teks(j.usulan.sumber));
        if (diubahU1 && lalu.has(a) && !/^(?:sudah cukup|cukup|tidak ada)/i.test(teks(j.jawab))) {
          const v = PB.variasi(j.jawab, idx + n, sebutan);
          if (v && !lalu.has(norma(v))) {
            j.jawab = v;
            j.usulan.teks = v;
          }
        }
        lalu.add(norma(j.jawab));
        dipakai.set(kunci, lalu);
      });
    });
  } catch (_g) {
    /* ragam tidak kritis */
  }
  hasil.perbaikanU1 = ringkas;
  return ringkas;
}

module.exports = { HUBUNGAN, kunciHubunganSah, frasaHubungan, kunciDariTeks, isiHubungan, hubunganSaksi, kesaksianMurni, sikapDariNaskah, kebiasaanDariPosita, jawabHurufA, jawabHurufB, jawabHurufH, jawabHurufD, jawabPisah, jawabArahSebab, golongan, terapkan };
