"use strict";

/**
 * ============================================================================
 * SET PERTANYAAN SAKSI BAKU UNTUK PANITERA SIDANG (12 Okt 2026, Agen Q)
 * ============================================================================
 *
 * Data: kamus-deteksi/awal/pertanyaan-saksi.json (kelompok "pertanyaan-saksi"), dibaca HANYA lewat services/kamusDeteksi.js
 * (lapis database ikut berlaku). Dua bagian templat:
 *
 *   bagian "pertanyaan"  satu butir: teks (penanda #0046#/#0047# = SEBUTAN pihak, bukan nama), jawabContoh (dari templat ABT bila ada)
 *   bagian "set"         pertanyaan:[{kode, tingkat, n, persen, posisi}] berurutan; syarat.jenisPerkaraId; pihakSaksi; belumAdaContoh
 *
 * tingkat: inti (>= 50% saksi nyata ditanya), pilihan (15-50%), jarang (< 15%), templat (contoh nyata < 5 saksi - bunyi dari
 * templat ABT), tambahan (khusus huruf alasan). Bunyi & urutan = kumpulan resmi ABT satker; angka = praktik BAS nyata
 * (abt_keterangan_saksi, 9 Okt 2026). Yang tidak punya contoh nyata dicatat belumAdaContoh dan TIDAK dikarang.
 *
 * Dipakai: (1) Lembar BAS portal lewat jembatan abt.katalogTanyaJawab / abt.tanyaJawab (kode "ALETA:<namaSet>");
 *          (2) ekstensi "Susun keterangan saksi" lewat /abt/usulan sumber "pertanyaan-saksi".
 */

const kamus = require("./kamusDeteksi");

const KELOMPOK = "pertanyaan-saksi";
const AWALAN_KODE = "ALETA:";

/** Nama jenis perkara SIPP (perkara.jenis_perkara_nama) -> id. Cermin ID_JENIS_PERKARA_SIPP di ekstensi dan portal. */
const ID_JENIS = Object.freeze({
  "izin poligami": "341",
  "pencegahan perkawinan": "342",
  "penolakan perkawinan": "343",
  "pembatalan perkawinan": "344",
  "cerai talak": "346",
  "cerai gugat": "347",
  "harta bersama": "348",
  "penguasaan anak": "349",
  "pengesahan anak": "352",
  perwalian: "354",
  "asal usul anak": "358",
  "istbat nikah": "360",
  "pengesahan perkawinan/istbat nikah": "360",
  "dispensasi kawin": "362",
  "wali adhol": "363",
  kewarisan: "364",
  wasiat: "365",
  wakaf: "367",
  "lain-lain": "369",
  "lain-lain *)": "369",
  "ekonomi syariah": "370",
  "p3hp/penetapan ahli waris": "371",
});

/** "Cerai Gugat" / 347 / "347" -> "347"; tidak dikenal -> "". */
function idJenis(masukan) {
  const s = String(masukan === undefined || masukan === null ? "" : masukan).replace(/\s+/g, " ").trim().toLowerCase();
  if (!s) return "";
  if (/^\d{3}$/.test(s)) return s;
  return ID_JENIS[s] || "";
}

function butir() {
  const semua = kamus.templatKelompok(KELOMPOK);
  const pertanyaan = new Map();
  const set = [];
  for (const t of semua) {
    if (t.bagian === "set") set.push(t);
    else pertanyaan.set(t.kode, t);
  }
  return { pertanyaan, set };
}

/** Akhiran kode gabungan ("+a") -> nama set tambahan. */
const SINGKAT_TAMBAHAN = Object.freeze({ a: "tambah-a", b: "tambah-b", d: "tambah-d", "anak-nafkah": "tambah-anak-nafkah" });

/** Huruf alasan cerai yang punya set tambahan -> nama set. C/E/G/H belum punya contoh nyata. */
const TAMBAHAN_HURUF = Object.freeze({ A: "tambah-a", B: "tambah-b", D: "tambah-d" });
const TANPA_CONTOH = Object.freeze(["C", "E", "G", "H"]);

/** Huruf (A-H) yang ditunjuk teks (posita/ gugatan) menurut mesin deteksi alasan - USULAN, bukan putusan hukum. */
function hurufDariTeks(teks) {
  const t = String(teks || "").trim();
  if (!t) return [];
  const da = require("./deteksiAlasanService");
  const huruf = new Set();
  for (const s of da.sebabDariTeks(t)) {
    if (s.pelaku === "lawan" || s.pelaku === "tuduhan") continue;
    const h = da.HURUF_LANGSUNG[s.sebab] || (s.huruf === "B" ? "B" : "");
    if (h) huruf.add(h);
  }
  return Array.from(huruf).sort();
}

function ringkasSet(s, pertanyaan) {
  const daftar = Array.isArray(s.pertanyaan) ? s.pertanyaan : [];
  const dipakai = daftar.filter((q) => q.tingkat !== "jarang");
  return {
    namaSet: s.namaSet,
    kodeKatalog: AWALAN_KODE + s.namaSet,
    label: s.label,
    gaya: s.gaya, // templat-abt | praktik-data | tambahan | belum-ada
    kodeAbt: s.kodeAbt || "",
    jenisPerkaraId: (s.syarat && s.syarat.jenisPerkaraId) || [],
    pihakSaksi: s.pihakSaksi || "P",
    huruf: s.huruf || "",
    jumlah: dipakai.length,
    jumlahSemua: daftar.length,
    contoh: s.contoh || { saksiSidang: 0, perkara: 0 },
    belumAdaContoh: Boolean(s.belumAdaContoh),
    catatan: s.catatan || "",
    tambahan: s.gaya === "tambahan",
    adaIsi: daftar.every((q) => pertanyaan.has(q.kode)) && daftar.length > 0,
  };
}

/**
 * Set yang cocok. praktik-data lebih dulu (urutan dari data nyata), lalu templat ABT, lalu tambahan huruf, lalu "belum ada contoh".
 * @param {{jenisPerkaraId?: string|number, pihak?: 'P'|'T'|'*', termasukTambahan?: boolean}} opsi
 */
function daftarSet(opsi = {}) {
  const { pertanyaan, set } = butir();
  const jenis = idJenis(opsi.jenisPerkaraId) || String(opsi.jenisPerkaraId || "").trim();
  const urut = { "praktik-data": 0, "templat-abt": 1, tambahan: 2, "belum-ada": 3, set: 4 };
  return set
    .map((s) => ringkasSet(s, pertanyaan))
    .filter((r) => !jenis || r.jenisPerkaraId.includes(jenis))
    .filter((r) => !opsi.pihak || opsi.pihak === "*" || r.pihakSaksi === "*" || r.pihakSaksi === opsi.pihak)
    .filter((r) => opsi.termasukTambahan !== false || !r.tambahan)
    .sort((a, b) => (urut[a.gaya] ?? 9) - (urut[b.gaya] ?? 9));
}

const POLA_PENUTUP = /ingin\s+(?:saudara|saksi)\s+sampaikan|keterangan\s+yang\s+saksi\s+akan\s+sampaikan|hal\s+lain/i;

/**
 * Menyusun satu set menjadi baris pertanyaan berurutan.
 *
 * @param {string} namaSet  nama set, atau kode katalog "ALETA:<namaSet>"
 * @param {{huruf?: string[], tambahan?: string[], termasukJarang?: boolean}} opsi
 *   huruf     huruf alasan yang didalilkan (A-H); set tambahan untuk A, B, D disisipkan SEBELUM pertanyaan penutup
 *   tambahan  nama set tambahan eksplisit (mis. "tambah-anak-nafkah")
 *   termasukJarang  ikutkan pertanyaan tingkat "jarang" (< 15% saksi)
 */
function ambilSet(namaSet, opsi = {}) {
  // Kode gabungan "<set>+a+b" (huruf/tambahan di kodenya sendiri) - dipakai Lembar BAS, yang menyimpan jawaban menurut URUTAN
  // pertanyaan sehingga susunannya harus tetap untuk satu kode.
  const mentah = String(namaSet || "").replace(new RegExp("^" + AWALAN_KODE), "");
  const bagian = mentah.split("+");
  const nama = bagian[0];
  if (bagian.length > 1) {
    const tambahanKode = bagian.slice(1).filter(Boolean).map((x) => (SINGKAT_TAMBAHAN[x] ? SINGKAT_TAMBAHAN[x] : `tambah-${x}`));
    opsi = { ...opsi, tambahan: [...(opsi.tambahan || []), ...tambahanKode] };
  }
  const { pertanyaan, set } = butir();
  const s = set.find((x) => x.namaSet === nama);
  if (!s) return { ok: false, sebab: "set_tidak_ada", nama, pertanyaan: [] };
  if (s.belumAdaContoh) return { ok: false, sebab: "belum_ada_contoh", nama, catatan: s.catatan || "", pertanyaan: [] };
  const ikut = (q) => opsi.termasukJarang === true || q.tingkat !== "jarang";
  const baris = [];
  const catatan = [];
  const pakai = (daftar, asal) => {
    for (const q of daftar) {
      const p = pertanyaan.get(q.kode);
      if (!p) {
        catatan.push(`pertanyaan ${q.kode} tidak ada di kamus`);
        continue;
      }
      baris.push({ kode: q.kode, tanya: p.teks, jawab: p.jawabContoh || "", tingkat: q.tingkat, persen: q.persen, n: q.n, asal });
    }
  };
  const dasar = (Array.isArray(s.pertanyaan) ? s.pertanyaan : []).filter(ikut);
  // Pertanyaan di luar templat yang lazim di BAS nyata (dariData) menyusul menurut posisi mediannya bila ada; tanpa posisi di belakang templat.
  pakai(dasar.filter((q) => !q.dariData), s.namaSet);
  const lazim = dasar.filter((q) => q.dariData);
  if (lazim.length) pakai(lazim, s.namaSet);

  // Tambahan huruf / eksplisit disisipkan sebelum penutup.
  const namaTambahan = new Set();
  for (const h of (opsi.huruf || []).map((x) => String(x).toUpperCase())) if (TAMBAHAN_HURUF[h]) namaTambahan.add(TAMBAHAN_HURUF[h]);
  for (const n of opsi.tambahan || []) namaTambahan.add(String(n).replace(/^ps-set-/, ""));
  const tanpaContoh = (opsi.huruf || []).map((x) => String(x).toUpperCase()).filter((h) => TANPA_CONTOH.includes(h));
  const sisip = [];
  for (const n of namaTambahan) {
    const t = set.find((x) => x.namaSet === n);
    if (!t) continue;
    const sebelum = baris.length;
    pakai(t.pertanyaan || [], t.namaSet);
    sisip.push(...baris.splice(sebelum));
  }
  if (sisip.length) {
    const kodeAda = new Set(baris.map((b) => b.kode));
    const baru = sisip.filter((b) => !kodeAda.has(b.kode));
    let letak = baris.length;
    for (let i = baris.length - 1; i >= 0; i--) {
      if (POLA_PENUTUP.test(baris[i].tanya)) {
        letak = i;
        break;
      }
    }
    baris.splice(letak, 0, ...baru);
  }
  if (tanpaContoh.length) {
    catatan.push(`huruf ${tanpaContoh.join(", ")}: belum ada contoh pertanyaan khusus di BAS satker - dipakai pertanyaan dasar`);
  }
  return {
    ok: true,
    nama: s.namaSet,
    label: s.label,
    pihakSaksi: s.pihakSaksi || "P",
    jenisPerkaraId: (s.syarat && s.syarat.jenisPerkaraId) || [],
    kodeAbt: s.kodeAbt || "",
    contoh: s.contoh || {},
    pertanyaan: baris.map((b, i) => ({ ...b, no: String(i + 1) })),
    catatan,
  };
}

/** Entri katalog untuk Lembar BAS (menambah abt.katalogTanyaJawab): kumpulan ALETA yang bisa dipilih panitera. */
function untukKatalog(jenisPerkaraId) {
  const dasar = daftarSet({ jenisPerkaraId, termasukTambahan: false }).filter((r) => !r.belumAdaContoh && r.adaIsi);
  const katalog = [];
  for (const r of dasar) {
    katalog.push({
      kode: r.kodeKatalog,
      nama: `Pertanyaan Saksi ${r.pihakSaksi === "T" ? "T" : "P"} - ${r.label}${r.gaya === "praktik-data" ? " (praktik BAS satker)" : ""}`,
      jenisPerkaraId: r.jenisPerkaraId[0] || "",
      jumlahPertanyaan: r.jumlah,
      sumber: "aleta",
    });
    // Perceraian: set praktik + pertanyaan khusus huruf alasan yang punya contoh nyata (A, B, D) sebagai kumpulan sendiri,
    // supaya "pilih sesuai alasan" tersedia di Lembar BAS dengan susunan yang tetap per kode.
    if (r.gaya === "praktik-data" && r.pihakSaksi === "P" && r.jenisPerkaraId.some((j) => j === "346" || j === "347")) {
      for (const [akhiran, label] of [["a", "huruf A (zina/mabuk/judi/obat)"], ["b", "huruf B (meninggalkan)"], ["d", "huruf D (KDRT)"]]) {
        const t = daftarSet({ jenisPerkaraId: r.jenisPerkaraId[0], termasukTambahan: true }).find((x) => x.namaSet === `tambah-${akhiran}`);
        if (!t || !t.adaIsi) continue;
        katalog.push({
          kode: `${r.kodeKatalog}+${akhiran}`,
          nama: `Pertanyaan Saksi P - ${r.label} + ${label}`,
          jenisPerkaraId: r.jenisPerkaraId[0] || "",
          jumlahPertanyaan: r.jumlah + t.jumlah,
          sumber: "aleta",
        });
      }
    }
  }
  return katalog;
}

/** Bentuk jawaban abt.tanyaJawab untuk kode "ALETA:<namaSet>" - sama dengan kumpulan ABT, tanpa variabel ABT. */
function untukTanyaJawab(kode, opsi = {}) {
  const hasil = ambilSet(kode, opsi);
  if (!hasil.ok) return { ada: false, sebab: hasil.sebab, pertanyaan: [], variabel: [] };
  return {
    ada: hasil.pertanyaan.length > 0,
    sumber: "ALETA kamus pertanyaan-saksi",
    kode: AWALAN_KODE + hasil.nama,
    jumlahPertanyaan: hasil.pertanyaan.length,
    pertanyaan: hasil.pertanyaan.map((p, i) => ({ urutan: i + 1, pertanyaan: p.tanya, jawabanBawaan: p.jawab })),
    variabel: [],
  };
}

function kodeAleta(kode) {
  return String(kode || "").startsWith(AWALAN_KODE);
}

module.exports = {
  KELOMPOK,
  AWALAN_KODE,
  idJenis,
  hurufDariTeks,
  daftarSet,
  ambilSet,
  untukKatalog,
  untukTanyaJawab,
  kodeAleta,
  TAMBAHAN_HURUF,
  TANPA_CONTOH,
};
