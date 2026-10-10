"use strict";

/**
 * ============================================================================
 * P7 (10 Okt 2026, agen 3) - RANGKAIAN KATA HAKIM
 * ============================================================================
 *
 * Kalimat 5227 (sebab perselisihan), duduk perkara ringkas, pertimbangan fakta
 * hukum per tuntutan accessoir, dan kalimat "saksi saling bersesuaian".
 *
 * Bunyinya DATA: templat kelompok "kalimat-hakim" (kamus-deteksi/awal/
 * kalimat-hakim.json + lapis database), diambil dari blangko hakim satker
 * sendiri. Berkas ini hanya mengisi penandanya. Semua hasilnya USULAN teks -
 * hakim menyunting sebelum Input; dasar hukum dan amar tidak pernah disusun
 * di sini.
 */

const kamus = require("./kamusDeteksi");
const kalimatBaku = require("./abtKalimatBaku");
const T = require("./tuntutanDeteksiService");

/** Isi {penanda}. Penanda tanpa isian dibiarkan tertulis dan disebut di `kosong`. */
function isiTemplat(teks, isian) {
  const kosong = [];
  const hasil = String(teks || "").replace(/\{([a-zA-Z]+)\}/g, (asli, k) => {
    const v = isian && Object.prototype.hasOwnProperty.call(isian, k) ? isian[k] : undefined;
    if (v === undefined || v === null || String(v).trim() === "") {
      if (!kosong.includes(k)) kosong.push(k);
      return asli;
    }
    return String(v);
  });
  return { teks: hasil.replace(/\s+([,;.])/g, "$1").replace(/\s{2,}/g, " ").trim(), kosong };
}

/** Templat aktif yang syaratnya cocok (setiap kunci syarat yang diminta harus sama). */
function templatMenurut(syarat) {
  const s = syarat || {};
  return kamus.templatKelompok("kalimat-hakim").filter((t) => {
    const ts = t.syarat || {};
    return Object.keys(s).every((k) => s[k] === undefined || ts[k] === s[k]);
  });
}

function gabungDaftar(daftar) {
  const d = daftar.filter(Boolean);
  if (d.length <= 1) return d.join("");
  return `${d.slice(0, -1).join(", ")} dan ${d[d.length - 1]}`;
}

// ─── 5227 ────────────────────────────────────────────────────────────────────

/**
 * Bunyi-bunyi 5227 dari ciri alasan (kunci CIRI_ALASAN, mis. dari
 * abtUsulanService.alasanDariPosita): satu per templat "5227".
 * {perbuatan} = daftar perbuatan berpelaku dari frasa baku (abtKalimatBaku),
 * TANPA akibat - akibatnya ditulis templat (atau blangko) sendiri.
 *
 * @returns {{kode, label, nilai, gaya}[]} - kosong bila tidak ada perbuatan berfrasa.
 */
function varian5227(ciri, pihak, opsi) {
  const pelaku = String((pihak && pihak.pelaku) || "Tergugat").trim() || "Tergugat";
  const lawan = String((pihak && pihak.lawan) || "Penggugat").trim() || "Penggugat";
  const { peta } = kalimatBaku.frasaCiriEfektif(opsi);
  const perbuatanCiri = (ciri || []).filter((c) => peta[c] && !peta[c].akibat);
  if (!perbuatanCiri.length) return { varian: [], tanpaFrasa: (ciri || []).filter((c) => !peta[c]) };
  const rinci = kalimatBaku.susunAlasanRinci(perbuatanCiri, { pelaku, lawan }, opsi);
  const perbuatan = rinci.kalimat.startsWith(`${pelaku} `) ? rinci.kalimat.slice(pelaku.length + 1) : rinci.kalimat;
  const varian = templatMenurut({ bagian: "5227" }).map((t) => {
    const { teks, kosong } = isiTemplat(t.teks, { pelaku, lawan, perbuatan });
    return { kode: t.kode, label: t.label, gaya: t.gaya || "", nilai: kosong.length ? "" : teks };
  });
  return { varian: varian.filter((v) => v.nilai), tanpaFrasa: rinci.tanpaFrasa };
}

// ─── Nilai variabel tuntutan (bunyi isian ABT satker) ────────────────────────

/**
 * Bunyi isian ABT per jenis, meniru isian petugas satker (aps_badilag
 * abt_data_teks 6054/6055/6071/7120, dibaca 10 Okt):
 *   6054  "sejumlah Rp6.000.000,00 (enam juta rupiah)"
 *         "Rp5.000.000,00 (lima juta rupiah) setiap bulan dikali 3 bulan dengan jumlah Rp15.000.000,00 (...) selama masa iddah"
 *   6055  "berupa uang tunai sebesar Rp10.000.000,00 (sepuluh juta rupiah)" / "berupa kalung emas 20 gram ..."
 *   6071  "sebesar Rp1.000.000,00 (satu juta rupiah) setiap bulan"
 *   7120  "sejumlah Rp3.000.000,00 (...) setiap bulan dikali 7 (tujuh) bulan dengan total sejumlah Rp21.000.000,00 (...)"
 */
/**
 * Nafkah iddah dihitung 3 bulan (keputusan pengguna 10 Okt 2026).
 * Per bulan dari berkas bila ada; bila hanya total, per bulan = total / 3.
 * Hasil: { perBulan, total, catatan } - catatan menyebut bila berkas berbeda.
 */
function iddahTigaBulan(n) {
  if (!n) return null;
  if (n.perBulan) {
    const catatan =
      n.kali && n.kali !== 3
        ? `Berkas menyebut ${n.kali} bulan; nafkah iddah dihitung 3 bulan.`
        : !n.kali && !n.total
          ? "Lama iddah tidak tertulis di berkas - dihitung 3 bulan."
          : n.total && n.total !== n.perBulan * 3
            ? `Total di berkas ${T.formatRupiah(n.total)} tidak sama dengan 3 x per bulan - dihitung 3 bulan.`
            : "";
    return { perBulan: n.perBulan, total: n.perBulan * 3, catatan };
  }
  const total = n.total || n.nilai;
  if (!total) return null;
  const perBulan = Math.round(total / 3);
  const bulat = perBulan * 3 === total;
  return {
    perBulan,
    total: bulat ? total : perBulan * 3,
    catatan: bulat
      ? "Berkas hanya menyebut total - per bulan = total dibagi 3."
      : `Berkas hanya menyebut total ${T.formatRupiah(total)} yang tidak habis dibagi 3 - per bulan dibulatkan; periksa.`,
  };
}

function nilaiAbtTuntutan(t) {
  if (!t) return "";
  const n = t.nominal;
  const rT = T.rupiahTerbilang;
  if (t.jenis === "mutah") {
    if (n) return `berupa uang tunai sebesar ${rT(n.nilai)}`;
    return t.benda ? `berupa ${t.benda}` : "";
  }
  if (!n) return "";
  const pb = n.perBulan;
  const kali = n.kali;
  if (t.jenis === "iddah") {
    // Keputusan pengguna 10 Okt 2026: nafkah iddah SELALU dijumlah 3 (tiga) bulan, dan
    // nafkah per bulannya tetap disebut - juga bila berkas hanya menyebut total atau
    // menyebut lama lain. Penyimpangan dari berkas disebut di catatan kartu (iddahTigaBulan).
    const i3 = iddahTigaBulan(n);
    if (i3) return `${rT(i3.perBulan)} setiap bulan dikali 3 (tiga) bulan dengan jumlah ${rT(i3.total)} selama masa iddah`;
    return `sejumlah ${rT(n.total || n.nilai)}`;
  }
  if (t.jenis === "madliyah") {
    if (pb && kali) return `sejumlah ${rT(pb)} setiap bulan dikali ${kali} (${T.terbilang(kali)}) bulan dengan total sejumlah ${rT(pb * kali)}`;
    return `sejumlah ${rT(n.total || n.nilai)}`;
  }
  if (t.jenis === "nafkah-anak") {
    const nilai = pb || n.nilai;
    return `sebesar ${rT(nilai)}${n.periode === "bulan" || pb || !n.periode ? " setiap bulan" : ""}`;
  }
  if (t.jenis === "mahar" || t.jenis === "harta-bersama") return `sejumlah ${rT(n.nilai)}`;
  return "";
}

/** "nafkah lampau sejumlah Rp..., mut'ah berupa ..., hak asuh anak dan nafkah anak sebesar ..." */
function daftarTuntutan(tuntutan) {
  const NAMA = { mutah: "mut'ah", iddah: "nafkah iddah", madliyah: "nafkah lampau (madliyah)", "nafkah-anak": "nafkah anak", hadhanah: "hak asuh anak (hadhanah)", "harta-bersama": "pembagian harta bersama", mahar: "mahar yang terutang" };
  return gabungDaftar(
    (tuntutan || []).map((t) => {
      const v = nilaiAbtTuntutan(t);
      return `${NAMA[t.jenis] || t.jenis}${v ? ` ${v}` : ""}`;
    })
  );
}

// ─── Kalimat pertimbangan per tuntutan ───────────────────────────────────────

/**
 * Kalimat hakim untuk tuntutan accessoir yang terdeteksi.
 *
 * @param tuntutan  hasil tuntutanDeteksiService.deteksiTuntutan (boleh gabungan beberapa dokumen)
 * @param o.sebutan {lawan, pelaku}; o.jenisSurat ("gugatan"/"permohonan"); o.majelis ("Majelis Hakim"/"Hakim");
 *          o.anak (nama anak dipisah koma); o.pengasuh (sebutan pihak tempat anak tinggal)
 * @returns {{kode, label, bagian, jenis, teks, kosong}[]}
 */
function kalimatTuntutan(tuntutan, o) {
  const opsi = o || {};
  const sebutan = opsi.sebutan || {};
  const majelis = opsi.majelis || "Majelis Hakim";
  const jenisSurat = opsi.jenisSurat || (/pemohon/i.test(sebutan.lawan || "") ? "permohonan" : "gugatan");
  const hasil = [];
  const kelompok = new Map();
  for (const t of tuntutan || []) {
    if (!t.penuntutKode) continue;
    const k = `${t.penuntutKode}|${t.rekonvensi ? "r" : "k"}`;
    if (!kelompok.has(k)) kelompok.set(k, []);
    kelompok.get(k).push(t);
  }
  for (const daftar of kelompok.values()) {
    const contoh = daftar[0];
    const rek = Boolean(contoh.rekonvensi);
    const penuntut = T.sebutanUntuk(contoh.penuntutKode, sebutan, false);
    const dibebaniKode = contoh.dibebaniKode || (contoh.penuntutKode === "0046" ? "0047" : "0046");
    const dibebani = T.sebutanUntuk(dibebaniKode, sebutan, false);
    const penuntutR = rek ? `${contoh.penuntutKode === "0047" ? "Penggugat" : "Tergugat"} Rekonvensi` : penuntut;
    const dibebaniR = rek ? `${dibebaniKode === "0046" ? "Tergugat" : "Penggugat"} Rekonvensi` : dibebani;
    const dasar = { lawan: sebutan.lawan || "Penggugat", pelaku: sebutan.pelaku || "Tergugat", penuntut: penuntutR, dibebani: dibebaniR, majelis, jenisSurat, anak: opsi.anak || "", pengasuh: opsi.pengasuh || "" };
    for (const t of templatMenurut({ bagian: "tuntutan-pokok", posisi: rek ? "rekonvensi" : "konvensi" })) {
      const { teks, kosong } = isiTemplat(t.teks, { ...dasar, daftarTuntutan: daftarTuntutan(daftar) });
      hasil.push({ kode: t.kode, label: t.label, bagian: "tuntutan-pokok", jenis: "", teks, kosong });
    }
    for (const x of daftar) {
      const nilai = nilaiAbtTuntutan(x);
      const kali = x.nominal && x.nominal.kali ? `${x.nominal.kali} (${T.terbilang(x.nominal.kali)}) bulan` : "";
      for (const bagian of ["sengketa", "fakta"]) {
        for (const t of templatMenurut({ bagian, jenis: x.jenis })) {
          const { teks, kosong } = isiTemplat(t.teks, { ...dasar, nilai, kali });
          hasil.push({ kode: t.kode, label: t.label, bagian, jenis: x.jenis, teks, kosong });
        }
      }
    }
  }
  return hasil;
}

/** "Keterangan para saksi ... saling bersesuaian ..." untuk saksi pihak tertentu atau keduanya. */
function kalimatBersesuaian(sebutan, pihak) {
  const s = sebutan || {};
  const pihakKe = pihak === "pelaku" ? "pelaku" : pihak === "keduanya" ? "keduanya" : "lawan";
  const pihakSaksi = pihakKe === "pelaku" ? s.pelaku || "Tergugat" : s.lawan || "Penggugat";
  return templatMenurut({ bagian: "bersesuaian", pihak: pihakKe }).map((t) => {
    const { teks, kosong } = isiTemplat(t.teks, { lawan: s.lawan || "Penggugat", pelaku: s.pelaku || "Tergugat", pihakSaksi });
    return { kode: t.kode, label: t.label, bagian: "bersesuaian", jenis: "", teks, kosong };
  });
}

/**
 * Duduk perkara ringkas. Isian yang tidak diketahui dibiarkan sebagai {penanda}
 * (disebut di `kosong`) - kalimatnya tetap dapat disalin lalu dilengkapi.
 */
function dudukRingkas(f, sebutan) {
  const s = sebutan || {};
  const isian = {
    lawan: s.lawan || "Penggugat",
    pelaku: s.pelaku || "Tergugat",
    jenisSurat: f && f.jenisSurat ? f.jenisSurat : /pemohon/i.test(s.lawan || "") ? "permohonan" : "gugatan",
    awal: f && f.awal,
    sebab: f && f.sebab,
    pisah: f && f.pisah,
    lama: f && f.lama,
  };
  return templatMenurut({ bagian: "duduk" }).map((t) => {
    const { teks, kosong } = isiTemplat(t.teks, isian);
    return { kode: t.kode, label: t.label, bagian: "duduk", jenis: "", teks, kosong };
  });
}

/** Kalimat ex officio untuk tuntutan akibat cerai talak yang TIDAK diajukan. */
function kalimatExOfficio(jenisTidakAda, sebutan, majelis) {
  if (!jenisTidakAda || !jenisTidakAda.length) return [];
  const s = sebutan || {};
  const NAMA = { mutah: "mut'ah", iddah: "nafkah iddah", "nafkah-anak": "nafkah anak" };
  return templatMenurut({ bagian: "exofficio" }).map((t) => {
    const { teks, kosong } = isiTemplat(t.teks, { penuntut: s.pelaku || "Termohon", daftarTuntutan: gabungDaftar(jenisTidakAda.map((j) => NAMA[j] || j)), majelis: majelis || "Majelis Hakim" });
    return { kode: t.kode, label: t.label, bagian: "exofficio", jenis: "", teks, kosong };
  });
}

module.exports = {
  isiTemplat,
  templatMenurut,
  varian5227,
  nilaiAbtTuntutan,
  iddahTigaBulan,
  daftarTuntutan,
  kalimatTuntutan,
  kalimatBersesuaian,
  dudukRingkas,
  kalimatExOfficio,
};
