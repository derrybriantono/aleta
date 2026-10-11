"use strict";

/**
 * ============================================================================
 * TEMPAT TINGGAL BERSAMA SEMASA RUKUN (KDL2 11 Okt 2026)
 * ============================================================================
 *
 * "Setelah menikah Penggugat dan Tergugat tinggal bersama di rumah orang tua
 * Penggugat di Desa X selama 1 tahun, setelah itu ... dan terakhir tinggal di
 * rumah bersama di Desa Y hingga pisah rumah" - dibaca per RUAS tempat: jenis
 * & pemilik (orang tua siapa, rumah siapa, bersama, kontrakan, keluarga, dinas,
 * rumah saksi), alamat, lama, ruas terakhir, berpindah-pindah, tidak pernah
 * serumah. Seluruh pola dari kamus kelompok "tempat-tinggal" (kamusDeteksi) -
 * tidak ada pola tertulis-mati di sini.
 *
 * Usulan ABT:
 *   1006  Tempat tinggal setelah nikah - "Setelah menikah #0046# dan #0047#
 *         membina rumah tangga di #1006#;" (389 tempat di blangko satker).
 *         Bentuk nilainya meniru isian petugas & 8491 OTOMATIS: bunyi riwayat
 *         posita sesudah "tinggal (bersama) di" sampai sebelum "hingga pisah".
 *   8570  Kediaman bersama terakhir (paket ABT abt-tempat-tinggal) - ruas
 *         terakhir saja.
 * Nilai diambil dari POSITA (dalil yang ditulis dengan sebutan pihak); jawaban
 * saksi hanya pembanding (kesesuaian per jenis tempat) - saksi menulis "rumah
 * saya", yang tidak boleh masuk ke berita acara sebagai tempat tinggal pihak.
 * Selalu usulan: dicentang manusia.
 *
 * pelaku = 0047 = Tergugat/Termohon; lawan = 0046 = Penggugat/Pemohon.
 */

const kamus = require("./kamusDeteksi");

const KELOMPOK = "tempat-tinggal";

function pola(kunci) {
  return kamus
    .polaKelompok(KELOMPOK)
    .filter((p) => (p.status || "aktif") === "aktif" && p.kunci === kunci)
    .sort((a, b) => (a.urut || 0) - (b.urut || 0));
}
function polaJenis() {
  return kamus
    .polaKelompok(KELOMPOK)
    .filter((p) => (p.status || "aktif") === "aktif" && p.jenis === "jenis")
    .sort((a, b) => (a.urut || 0) - (b.urut || 0));
}
const uji = (kunci, teks) => pola(kunci).some((p) => p.re.test(String(teks || "")));
const global = (p) => new RegExp(p.re.source, p.re.flags.includes("g") ? p.re.flags : `${p.re.flags}g`);

/** Letak kecocokan pertama di antara pola sekunci (atau -1) dan panjangnya. */
function cariPertama(kunci, teks, dari) {
  let terbaik = null;
  for (const p of pola(kunci)) {
    const re = global(p);
    re.lastIndex = dari || 0;
    const m = re.exec(teks);
    if (m && (!terbaik || m.index < terbaik.index)) terbaik = { index: m.index, panjang: m[0].length, m };
  }
  return terbaik;
}

const sisiDari = (sebutan) => (/tergugat|termohon|terggugat/i.test(sebutan) ? "pelaku" : /penggugat|pemohon|pengugat/i.test(sebutan) ? "lawan" : "");

/** Butir kalimat dari teks berbutir ("- Bahwa ...") atau posita polos/HTML. */
function butirDari(teks) {
  return String(teks || "")
    .replace(/<\/(p|li|div|tr)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .split(/\n+|(?:^|\s)-\s+(?=Bahwa\b)/)
    .map((x) => x.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/**
 * Kalimat riwayat tempat tinggal bersama. Posita: butir "setelah menikah ... tinggal".
 * Saksi: juga jawaban tanpa "setelah menikah" yang menyebut tinggal bersama/membina rumah
 * tangga di suatu tempat - asal bukan keadaan SESUDAH berpisah.
 */
function kalimatRiwayat(butir, opsi) {
  const o = opsi || {};
  const cocok = (b) => uji("kata-tinggal", b) && cariPertama("awal-tempat", b);
  const utama = butir.find((b) => uji("sesudah-nikah", b) && cocok(b) && !/^\W*(?:bahwa\s+)?(?:saat\s+ini|sekarang)\b/i.test(b));
  if (utama) return utama;
  if (!o.saksi) return "";
  return butir.find((b) => cocok(b) && /\btinggal\s+bersama|membina\s+rumah\s+tangga/i.test(b) && !uji("bukan-riwayat", b)) || "";
}

function jenisTempat(tempat) {
  for (const p of polaJenis()) {
    const m = String(tempat).match(p.re);
    if (!m) continue;
    const sebutan = m.groups && m.groups.sebutan ? m.groups.sebutan : "";
    return { jenis: p.kunci, sisi: sisiDari(sebutan), sebutan: sebutan ? sebutan.charAt(0).toUpperCase() + sebutan.slice(1).toLowerCase() : "", kode: p.kode };
  }
  return { jenis: cariPertama("alamat", tempat) ? "alamat" : "lain", sisi: "", sebutan: "", kode: "" };
}

/**
 * Riwayat tempat tinggal dari sekumpulan butir.
 * @returns {{kalimat, ruas: Array<{tempat, jenis, sisi, sebutan, alamat, lama, terakhir, kodePola}>,
 *           berpindah: boolean, tidakPernahSerumah: boolean, potongan: string}}
 */
/** Pembetul ejaan petugas (pola kunci "ejaan", ruas `ganti`). */
function rapikanEjaan(teks) {
  let t = String(teks || "");
  for (const p of pola("ejaan")) if (typeof p.ganti === "string") t = t.replace(global(p), p.ganti);
  return t;
}

function riwayat(butir, opsi) {
  const kosong = { kalimat: "", ruas: [], berpindah: false, tidakPernahSerumah: false, potongan: "" };
  const asli = butir || [];
  const baku = asli.map(rapikanEjaan);
  const kalBaku = kalimatRiwayat(baku, opsi);
  const kal = kalBaku;
  const kalimatAsli = kalBaku ? asli[baku.indexOf(kalBaku)] || kalBaku : "";
  const iKosong = baku.findIndex((b) => uji("sesudah-nikah", b) && uji("tidak-serumah", b));
  if (!kal) return iKosong >= 0 ? { ...kosong, kalimat: asli[iKosong], tidakPernahSerumah: true } : kosong;
  // Potong pada "hingga pisah"/"saat ini": tempat sesudah berpisah bukan kediaman bersama.
  const ekor = cariPertama("ekor-pisah", kal);
  const teks = ekor ? kal.slice(0, ekor.index) : kal;
  const awal = [];
  for (const p of pola("awal-tempat")) {
    for (const m of teks.matchAll(global(p))) awal.push({ index: m.index, akhir: m.index + m[0].length });
  }
  awal.sort((a, b) => a.index - b.index);
  const ruas = [];
  let potonganMulai = -1;
  for (let i = 0; i < awal.length; i++) {
    const a = awal[i];
    if (i > 0 && a.index < awal[i - 1].akhir) continue; // tumpang tindih
    const ujung = i + 1 < awal.length ? awal[i + 1].index : teks.length;
    const isi = teks.slice(a.akhir, ujung);
    const batas = cariPertama("batas-tempat", isi);
    const tempat = (batas ? isi.slice(0, batas.index) : isi).replace(/^\s*(?:di|ke)\s+/i, "").replace(/\s+/g, " ").trim();
    const sekitar = teks.slice(Math.max(0, a.index - 30), a.akhir);
    const lamaM = cariPertama("lama", isi);
    const lama = lamaM && (!batas || lamaM.index >= batas.index - 1) ? lamaM.m[0].replace(/\s+/g, " ").trim() : "";
    const j = jenisTempat(tempat);
    // "dengan saya" (tanpa nama tempat) tetap ruas rumah saksi.
    const denganSaksi = /dengan\s+saya\b/i.test(teks.slice(a.index, a.akhir));
    if (!tempat && !denganSaksi) continue;
    if (tempat && j.jenis === "lain" && !/rumah|kediaman/i.test(tempat)) continue;
    const al = cariPertama("alamat", tempat);
    if (potonganMulai < 0) potonganMulai = a.akhir;
    ruas.push({
      tempat: tempat || "rumah saksi",
      jenis: denganSaksi && !tempat ? "rumah-saksi" : denganSaksi && j.jenis !== "rumah-saksi" && j.jenis !== "alamat" ? j.jenis : denganSaksi ? "rumah-saksi" : j.jenis,
      sisi: j.sisi,
      sebutan: j.sebutan,
      alamat: al ? tempat.slice(al.index).trim() : "",
      lama,
      terakhir: uji("terakhir", sekitar),
      kodePola: [j.kode, "tt-awal-tempat"].filter(Boolean),
    });
    if (ruas.length >= 6) break;
  }
  const potongan = potonganMulai >= 0 ? teks.slice(potonganMulai).replace(/^\s*(?:di|ke)\s+/i, "").replace(/\s+/g, " ").replace(/[\s,;.]+$/, "").trim() : "";
  return { kalimat: kalimatAsli, ruas, berpindah: uji("berpindah", teks), tidakPernahSerumah: false, potongan };
}

const LABEL_JENIS = {
  "orang-tua": "rumah orang tua",
  "milik-pihak": "rumah milik pihak",
  bersama: "rumah sendiri/bersama",
  sewa: "kontrakan/kos",
  keluarga: "rumah keluarga",
  dinas: "rumah dinas/asrama/mess",
  "rumah-saksi": "rumah saksi",
  alamat: "alamat saja",
  lain: "lain",
};

/** Ringkasan satu ruas untuk dibandingkan antar sumber: jenis + sisi pemilik. */
function sidikRuas(r) {
  if (!r) return "";
  return `${r.jenis}${r.sisi ? `:${r.sisi}` : ""}`;
}

/** Nama desa/kelurahan/kota pertama di alamat ruas, dibakukan (huruf kecil). */
function namaDesa(alamat) {
  const m = String(alamat || "").match(/\b(?:desa|kelurahan|kel\.|dusun|kota|kecamatan|kabupaten)\s+([a-z0-9][a-z0-9' ]*?)(?=\s*(?:,|kecamatan|kabupaten|kota|provinsi|kec\.|kab\.|rt\b|$))/i);
  return m ? m[1].toLowerCase().replace(/\s+/g, " ").trim() : "";
}

/**
 * Dua ruas sama? true/false, atau null bila tidak dapat dibandingkan (salah satunya hanya
 * alamat/rumah saksi tanpa pemilik dan desanya tidak sama-sama disebut). Pemilik yang tidak
 * disebut di salah satu sumber ("rumah orang tua") tidak menyalahkan yang menyebutnya.
 */
function cocokRuas(a, b) {
  if (!a || !b) return null;
  const tanpaPemilik = (r) => ["alamat", "lain", "rumah-saksi"].includes(r.jenis);
  if (tanpaPemilik(a) || tanpaPemilik(b)) {
    const d1 = namaDesa(a.alamat);
    const d2 = namaDesa(b.alamat);
    return d1 && d2 && (d1 === d2 || d1.startsWith(d2) || d2.startsWith(d1)) ? true : null;
  }
  if (a.jenis !== b.jenis) return false;
  if (a.sisi && b.sisi && a.sisi !== b.sisi) return false;
  return true;
}

/**
 * Rumah saksi -> pemilik menurut hubungan saksi (bila diketahui): saksi ibu/ayah/orang tua
 * kandung pihak X = rumah orang tua X; saudara/keluarga = rumah keluarga.
 */
function ruasSaksiDipetakan(r, hubungan) {
  if (!r || r.jenis !== "rumah-saksi" || !hubungan) return r;
  const k = String(hubungan.kunci || "");
  const sisi = hubungan.sisi || "";
  if (/^(?:Ibu Kandung|Ayah Kandung|Orang Tua Kandung|Ibu Tiri|Ayah Tiri)$/.test(k)) return { ...r, jenis: "orang-tua", sisi, dipetakan: k };
  if (hubungan.golongan === "keluarga") return { ...r, jenis: "keluarga", sisi, dipetakan: k };
  return r;
}

/** Kesesuaian ruas pertama & terakhir antar sumber (posita, saksi 1, saksi 2). */
function kesesuaian(rp, r1, r2) {
  const ruasDi = (r, i) => (r && r.ruas.length ? (i === "akhir" ? r.ruas[r.ruas.length - 1] : r.ruas[0]) : null);
  const satu = (i) => {
    const a = ruasDi(r1, i);
    const b = ruasDi(r2, i);
    const p = ruasDi(rp, i);
    return {
      posita: sidikRuas(p),
      saksi1: sidikRuas(a),
      saksi2: sidikRuas(b),
      saksiSama: cocokRuas(a, b),
      // per saksi yang menyebut: true sama dengan posita, false berbeda, null tak dapat dibandingkan
      sesuaiPosita: [a, b].filter(Boolean).map((x) => cocokRuas(x, p)),
    };
  };
  return { pertama: satu("awal"), terakhir: satu("akhir") };
}

function bunyiJenis(r) {
  if (!r) return "";
  const pemilik = r.sebutan ? ` ${r.sebutan}` : "";
  return `${LABEL_JENIS[r.jenis] || r.jenis}${pemilik}${r.alamat ? ` (${r.alamat})` : ""}`;
}

/**
 * Usulan kartu ABT 1006 & 8570 dari posita + keterangan saksi.
 * @param {{posita?: string, saksi1?: string, saksi2?: string, hubunganSaksi?: Array}} bahan
 * @returns {{usulan: Array, tempatTinggal: object}}
 */
function usulanTempatTinggal(bahan) {
  const b = bahan || {};
  const rp = riwayat(butirDari(b.posita), {});
  const r1 = riwayat(butirDari(b.saksi1), { saksi: true });
  const r2 = riwayat(butirDari(b.saksi2), { saksi: true });
  const hub = Array.isArray(b.hubunganSaksi) ? b.hubunganSaksi : [];
  for (const [r, h] of [[r1, hub[0]], [r2, hub[1]]]) r.ruas = r.ruas.map((x) => ruasSaksiDipetakan(x, h));
  const ks = kesesuaian(rp, r1, r2);
  const sumber = [];
  if (rp.kalimat) sumber.push({ saksi: 0, asal: "posita", kalimat: rp.kalimat });
  if (r1.kalimat) sumber.push({ saksi: 1, kalimat: r1.kalimat });
  if (r2.kalimat) sumber.push({ saksi: 2, kalimat: r2.kalimat });

  const usulan = [];
  const keyakinanDari = (bagian) => {
    const k = ks[bagian];
    if (!k.posita) return "ragu";
    const sesuai = k.sesuaiPosita.filter((x) => x === true).length;
    const beda = k.sesuaiPosita.filter((x) => x === false).length;
    if (beda && !sesuai) return "bentrok";
    return sesuai ? "cukup" : "ragu";
  };
  const catatanDari = (bagian, rPosita) => {
    const k = ks[bagian];
    const bunyi = [];
    if (rp.berpindah) bunyi.push("posita menyebut berpindah-pindah tempat tinggal");
    for (const [i, r] of [[1, r1], [2, r2]]) {
      const x = r.ruas.length ? (bagian === "terakhir" ? r.ruas[r.ruas.length - 1] : r.ruas[0]) : null;
      if (!x) continue;
      const p = rp.ruas.length ? (bagian === "terakhir" ? rp.ruas[rp.ruas.length - 1] : rp.ruas[0]) : null;
      const sama = cocokRuas(x, p);
      bunyi.push(`saksi ${i}: ${bunyiJenis(x)}${x.dipetakan ? ` (rumah saksi - ${x.dipetakan})` : ""}${p ? (sama === true ? " - sama dengan posita" : sama === false ? " - BERBEDA dengan posita" : "") : ""}`);
    }
    if (!rPosita) bunyi.unshift("posita tidak menyebut tempat tinggal sesudah menikah - isi dari keterangan saksi (tanpa 'rumah saya')");
    return bunyi.join("; ");
  };
  const kodePola = (r) => (r && r.kodePola ? r.kodePola[0] || "" : "");

  if (rp.tidakPernahSerumah) {
    usulan.push({ kode: "1006", nama: "Tempat tinggal setelah nikah", nilai: "", keyakinan: "kosong", bentrok: "", catatan: "Posita: setelah menikah tidak pernah tinggal bersama - 1006 tidak diisi.", dihitung: false, sumber, kodePola: "tt-tidak-serumah" });
  } else if (rp.ruas.length) {
    usulan.push({
      kode: "1006",
      nama: "Tempat tinggal setelah nikah",
      nilai: rp.potongan,
      keyakinan: keyakinanDari("pertama"),
      bentrok: "",
      catatan: catatanDari("pertama", true),
      dihitung: false,
      sumber,
      kodePola: kodePola(rp.ruas[0]),
    });
    const akhir = rp.ruas.find((x) => x.terakhir) || rp.ruas[rp.ruas.length - 1];
    usulan.push({
      kode: "8570",
      nama: "Kediaman bersama terakhir",
      nilai: akhir.tempat,
      keyakinan: keyakinanDari("terakhir"),
      bentrok: "",
      catatan: [rp.ruas.length > 1 ? `ruas ${rp.ruas.indexOf(akhir) + 1} dari ${rp.ruas.length} tempat di posita` : "satu-satunya tempat di posita", catatanDari("terakhir", true)].filter(Boolean).join("; "),
      dihitung: false,
      sumber,
      kodePola: kodePola(akhir),
    });
  } else {
    // Posita diam: saksi yang tidak menyebut "rumah saya" boleh menjadi usulan RAGU.
    const r = [r1, r2].find((x) => x.ruas.length && !x.ruas.some((y) => y.jenis === "rumah-saksi" || y.dipetakan));
    if (r) {
      usulan.push({ kode: "1006", nama: "Tempat tinggal setelah nikah", nilai: r.potongan, keyakinan: "ragu", bentrok: "", catatan: catatanDari("pertama", false), dihitung: false, sumber, kodePola: kodePola(r.ruas[0]) });
      const akhir = r.ruas.find((x) => x.terakhir) || r.ruas[r.ruas.length - 1];
      usulan.push({ kode: "8570", nama: "Kediaman bersama terakhir", nilai: akhir.tempat, keyakinan: "ragu", bentrok: "", catatan: catatanDari("terakhir", false), dihitung: false, sumber, kodePola: kodePola(akhir) });
    }
  }
  return { usulan, tempatTinggal: { posita: rp, saksi1: r1, saksi2: r2, kesesuaian: ks } };
}

module.exports = { riwayat, kalimatRiwayat, jenisTempat, butirDari, sidikRuas, cocokRuas, namaDesa, rapikanEjaan, ruasSaksiDipetakan, kesesuaian, usulanTempatTinggal, LABEL_JENIS };
