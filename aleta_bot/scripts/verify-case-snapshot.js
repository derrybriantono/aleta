#!/usr/bin/env node
"use strict";

/**
 * Membuktikan potret perkara menurunkan beban SIPP TANPA melonggarkan keamanan
 * dan tanpa menjawab data yang keliru.
 *
 *   node scripts/verify-case-snapshot.js
 *
 * Tiga hal yang paling berisiko dari sebuah cache dan karenanya diuji paling
 * keras di sini:
 *   1. Data satu perkara TIDAK boleh terbawa ke perkara lain.
 *   2. Operasi yang MENULIS (pendaftaran antrian) tidak boleh dijawab dari
 *      simpanan - orang bisa mengira sudah terdaftar padahal belum.
 *   3. Data lama boleh dipakai saat sumber datanya mati, tetapi umurnya WAJIB
 *      disebutkan kepada penanya.
 */

const snapshot = require("../services/caseSnapshotService");
const breaker = require("../services/sippCircuitBreakerService");

let lulus = 0;
let gagal = 0;

function periksa(label, kondisi) {
  if (kondisi) {
    lulus += 1;
    console.log(`  OK    ${label}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${label}`);
  }
}

/** Pengambil data tiruan yang menghitung berapa kali benar-benar dipanggil. */
function pengambil(nilai) {
  const state = { panggilan: 0 };
  state.loader = async () => {
    state.panggilan += 1;
    if (typeof nilai === "function") return nilai(state.panggilan);
    return nilai;
  };
  return state;
}

async function utama() {
  console.log("\n== Permintaan kedua dilayani tanpa menyentuh SIPP ==");
  {
    snapshot.reset();
    const p = pengambil("jadwal sidang 8 September");
    const a = await snapshot.remember({ kind: "jadwal", caseNumber: "531/Pdt.G/2026/PA.Dgl", loader: p.loader });
    const b = await snapshot.remember({ kind: "jadwal", caseNumber: "531/Pdt.G/2026/PA.Dgl", loader: p.loader });
    const c = await snapshot.remember({ kind: "jadwal", caseNumber: "531/Pdt.G/2026/PA.Dgl", loader: p.loader });

    periksa("SIPP hanya dipanggil sekali untuk tiga permintaan", p.panggilan === 1);
    periksa("permintaan pertama diambil segar", a.source === "fresh");
    periksa("permintaan kedua dari potret", b.source === "cache");
    periksa("permintaan ketiga dari potret", c.source === "cache");
    periksa("isi jawaban tetap sama", b.value === a.value && c.value === a.value);

    const stat = snapshot.getStats();
    periksa(`rasio potret terpakai 2 dari 3 (${stat.hitRatio})`, stat.hits === 2 && stat.misses === 1);
  }

  console.log("\n== KEAMANAN: data perkara tidak pernah tertukar ==");
  {
    snapshot.reset();
    const a = pengambil("data perkara A");
    const b = pengambil("data perkara B");
    const hasilA = await snapshot.remember({ kind: "jadwal", caseNumber: "531/Pdt.G/2026/PA.Dgl", loader: a.loader });
    const hasilB = await snapshot.remember({ kind: "jadwal", caseNumber: "219/Pdt.P/2026/PA.Dgl", loader: b.loader });

    periksa("perkara berbeda mengambil datanya sendiri", a.panggilan === 1 && b.panggilan === 1);
    periksa("perkara A menerima datanya sendiri", hasilA.value === "data perkara A");
    periksa("perkara B menerima datanya sendiri", hasilB.value === "data perkara B");

    // Perkara sama, jenis informasi berbeda: harus terpisah juga.
    const biaya = pengambil("data biaya");
    const hasilBiaya = await snapshot.remember({ kind: "biaya", caseNumber: "531/Pdt.G/2026/PA.Dgl", loader: biaya.loader });
    periksa("jenis informasi berbeda tidak saling menimpa", hasilBiaya.value === "data biaya");
    periksa("jadwal perkara A tetap utuh", (await snapshot.remember({ kind: "jadwal", caseNumber: "531/Pdt.G/2026/PA.Dgl", loader: a.loader })).value === "data perkara A");
  }

  console.log("\n== Masa berlaku dibedakan menurut sifat datanya ==");
  {
    periksa("biaya ditahan paling singkat", snapshot.ttlFor("biaya") < snapshot.ttlFor("jadwal"));
    periksa("jadwal lebih singkat daripada identitas", snapshot.ttlFor("jadwal") < snapshot.ttlFor("identitas"));
    periksa("identitas perkara ditahan paling lama", snapshot.ttlFor("identitas") >= 30 * 60 * 1000);
    periksa("jenis tak dikenal memakai bawaan", snapshot.ttlFor("entah_apa") === snapshot.DEFAULT_TTL_MS);
  }

  console.log("\n== Potret kedaluwarsa diambil ulang ==");
  {
    snapshot.reset();
    const p = pengambil((n) => `pengambilan ke-${n}`);
    await snapshot.remember({ kind: "biaya", caseNumber: "X", loader: p.loader });

    // Memundurkan waktu simpan melewati masa berlakunya.
    const asliNow = Date.now;
    Date.now = () => asliNow() + snapshot.ttlFor("biaya") + 1000;
    const kedua = await snapshot.remember({ kind: "biaya", caseNumber: "X", loader: p.loader });
    Date.now = asliNow;

    periksa("data kedaluwarsa diambil ulang", p.panggilan === 2);
    periksa("nilai terbaru yang dipakai", kedua.value === "pengambilan ke-2");
    periksa("ditandai sebagai segar", kedua.source === "fresh");
  }

  console.log("\n== Operasi yang MENULIS tidak pernah disimpan ==");
  {
    snapshot.reset();
    const p = pengambil("pendaftaran antrian berhasil");
    await snapshot.remember({ kind: "antrian", caseNumber: "X", loader: p.loader, bypass: true });
    await snapshot.remember({ kind: "antrian", caseNumber: "X", loader: p.loader, bypass: true });
    await snapshot.remember({ kind: "antrian", caseNumber: "X", loader: p.loader, bypass: true });

    periksa("setiap pendaftaran benar-benar dijalankan", p.panggilan === 3);
    periksa("tidak ada yang tersimpan", snapshot.getStats().entries === 0);
  }

  console.log("\n== Tanpa nomor perkara, tidak disimpan ==");
  {
    snapshot.reset();
    const p = pengambil("data umum");
    await snapshot.remember({ kind: "jadwal", caseNumber: "", loader: p.loader });
    await snapshot.remember({ kind: "jadwal", caseNumber: "", loader: p.loader });
    periksa("selalu diambil ulang", p.panggilan === 2);
    periksa("tidak ada yang tersimpan", snapshot.getStats().entries === 0);
  }

  console.log("\n== Data lama menyelamatkan saat SIPP mati ==");
  {
    snapshot.reset();
    let gagalkan = false;
    const p = pengambil(() => {
      if (gagalkan) throw new Error("SIPP tidak dapat dijangkau");
      return "jadwal sidang 8 September";
    });

    await snapshot.remember({ kind: "jadwal", caseNumber: "X", loader: p.loader });

    // Lewat masa berlaku, lalu SIPP mati.
    const asliNow = Date.now;
    Date.now = () => asliNow() + snapshot.ttlFor("jadwal") + 60000;
    gagalkan = true;
    const hasil = await snapshot.remember({ kind: "jadwal", caseNumber: "X", loader: p.loader });
    Date.now = asliNow;

    periksa("tetap menjawab, tidak gagal total", hasil.value === "jadwal sidang 8 September");
    periksa("ditandai sebagai data lama", hasil.source === "stale");
    periksa("umur datanya dilaporkan", hasil.ageMs > 0);
    periksa("tercatat di statistik", snapshot.getStats().staleServed === 1);
  }

  console.log("\n== Tanpa data lama, kegagalan tetap dilaporkan ==");
  {
    snapshot.reset();
    const p = pengambil(() => {
      throw new Error("SIPP tidak dapat dijangkau");
    });
    let terlempar = false;
    try {
      await snapshot.remember({ kind: "jadwal", caseNumber: "BARU", loader: p.loader });
    } catch {
      terlempar = true;
    }
    periksa("kegagalan tidak disembunyikan", terlempar);
  }

  console.log("\n== Umur data ditulis dalam bahasa manusia ==");
  {
    periksa("kurang dari semenit", snapshot.describeAge(20000) === "kurang dari semenit lalu");
    periksa("sekitar semenit", snapshot.describeAge(62000) === "sekitar semenit lalu");
    periksa("beberapa menit", snapshot.describeAge(7 * 60000) === "sekitar 7 menit lalu");
  }

  console.log("\n== Potret dibuang saat perkaranya berubah ==");
  {
    snapshot.reset();
    const p = pengambil((n) => `versi ${n}`);
    await snapshot.remember({ kind: "jadwal", caseNumber: "X", loader: p.loader });
    await snapshot.remember({ kind: "biaya", caseNumber: "X", loader: p.loader });
    await snapshot.remember({ kind: "jadwal", caseNumber: "Y", loader: p.loader });

    const dibuang = snapshot.invalidateCase("X");
    periksa("dua potret perkara X dibuang", dibuang === 2);

    const setelah = await snapshot.remember({ kind: "jadwal", caseNumber: "X", loader: p.loader });
    periksa("perkara X diambil ulang", setelah.source === "fresh");

    const lain = await snapshot.remember({ kind: "jadwal", caseNumber: "Y", loader: p.loader });
    periksa("perkara lain tidak ikut terbuang", lain.source === "cache");
  }

  console.log("\n== Pemutus arus: hanya gangguan sistemik yang dihitung ==");
  {
    breaker.reset();
    periksa("batas waktu dihitung sebagai gangguan", breaker.isDistressError({ code: "PROTOCOL_SEQUENCE_TIMEOUT" }));
    periksa("sambungan putus dihitung", breaker.isDistressError({ code: "ECONNREFUSED" }));
    periksa("terlalu banyak sambungan dihitung", breaker.isDistressError({ message: "Too many connections" }));
    periksa("galat sintaks TIDAK dihitung", breaker.isDistressError({ code: "ER_PARSE_ERROR", message: "syntax" }) === false);
    periksa("tabel tidak ada TIDAK dihitung", breaker.isDistressError({ code: "ER_NO_SUCH_TABLE" }) === false);
  }

  console.log("\n== Pemutus arus membuka setelah gangguan beruntun ==");
  {
    breaker.reset();
    const ambang = breaker.getConfig().failureThreshold;

    // Galat SQL biasa berkali-kali tidak boleh membuka pemutus arus.
    for (let i = 0; i < ambang + 3; i += 1) {
      breaker.recordFailure("sipp_primary", { code: "ER_PARSE_ERROR", message: "syntax" });
    }
    periksa("galat query biasa tidak menghentikan layanan", breaker.canAttempt("sipp_primary").allowed === true);

    for (let i = 0; i < ambang; i += 1) {
      breaker.recordFailure("sipp_primary", { code: "PROTOCOL_SEQUENCE_TIMEOUT", message: "timeout" });
    }
    const izin = breaker.canAttempt("sipp_primary");
    periksa("pemutus arus terbuka setelah gangguan beruntun", izin.allowed === false);
    periksa("keadaan dilaporkan terbuka", izin.state === breaker.STATE_OPEN);
    periksa("menyebut sisa waktu tunggu", izin.retryInMs > 0);

    const galat = breaker.buildOpenCircuitError("sipp_primary");
    periksa("pesan penolakan dapat dibaca orang awam", galat.message.includes("mencoba lagi otomatis"));
    periksa("tidak berisi jargon teknis", !/PROTOCOL|SQL|pool/i.test(galat.message));
  }

  console.log("\n== Pemulihan setelah masa tenang ==");
  {
    breaker.reset();
    const config = breaker.getConfig();
    for (let i = 0; i < config.failureThreshold; i += 1) {
      breaker.recordFailure("sipp_primary", { code: "ETIMEDOUT" });
    }
    periksa("terbuka lebih dulu", breaker.canAttempt("sipp_primary").allowed === false);

    const asliNow = Date.now;
    Date.now = () => asliNow() + config.cooldownMs + 1000;
    const percobaan = breaker.canAttempt("sipp_primary");
    periksa("setelah masa tenang, satu percobaan diizinkan", percobaan.allowed === true);
    periksa("keadaan setengah terbuka", percobaan.state === breaker.STATE_HALF_OPEN);

    breaker.recordSuccess("sipp_primary");
    Date.now = asliNow;
    periksa("berhasil -> kembali normal", breaker.canAttempt("sipp_primary").state === breaker.STATE_CLOSED);
  }

  console.log("\n== Percobaan pemulihan yang gagal membuka lagi ==");
  {
    breaker.reset();
    const config = breaker.getConfig();
    for (let i = 0; i < config.failureThreshold; i += 1) {
      breaker.recordFailure("sipp_primary", { code: "ETIMEDOUT" });
    }
    const asliNow = Date.now;
    Date.now = () => asliNow() + config.cooldownMs + 1000;
    breaker.canAttempt("sipp_primary");
    breaker.recordFailure("sipp_primary", { code: "ETIMEDOUT" });
    const izin = breaker.canAttempt("sipp_primary");
    Date.now = asliNow;
    periksa("gagal lagi -> terbuka kembali", izin.allowed === false);
  }

  console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
  if (gagal > 0) {
    console.log("ADA PERIKSAAN YANG GAGAL.");
    process.exit(1);
  }
  console.log("SEMUA PERIKSAAN LULUS.");
  process.exit(0);
}

utama().catch((error) => {
  console.error("Gagal menjalankan pengujian:", error);
  process.exit(1);
});
