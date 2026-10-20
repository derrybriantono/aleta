// Ukur isi katalog saksi sembilan jenis keluarga: SEBELUM (cadangan-katalog) dan SESUDAH (ekstensi-sipp/saksi-katalog), tanpa data perkara.
//   node ukur_katalog_w2b.cjs [--tulis]     --tulis menyimpan docs/gelombang2/UKURAN-W2b-katalog.json
// Yang dihitung: pokok pembuktian, butir, butir aktif per saksi pada keadaan bawaan (tingkat inti / inti+pilihan / semua),
// kalimat jawaban (saksi 1 + saksi 2 semua tingkat), dasar hukum, keadaan, dan berapa butir berlaku HANYA pada keadaan tertentu.
const fs = require("fs");
const path = require("path");

const REPO = path.resolve(__dirname, "..", "..", "..");
const EK = path.join(REPO, "ekstensi-sipp");
const CAD = path.join(REPO, "abt-paket", "w2b-keluarga-lain", "cadangan-katalog");
const JENIS = ["izin-poligami", "pencegahan-perkawinan", "pembatalan-perkawinan", "hak-asuh", "penguasaan-anak", "nafkah-anak", "pengangkatan-anak", "mafqud", "permohonan-umum"];
const muat = (dir, n) => JSON.parse(fs.readFileSync(path.join(dir, `${n}.json`), "utf8"));

globalThis.window = globalThis;
const Mesin = require(path.join(EK, "saksi-katalog.js"));

function ukur(kat) {
  const bawaan = Mesin.keadaanBawaan(kat, {});
  const aktif = (tingkat) => Mesin.pertanyaanAktif(kat, { ...bawaan, pihakSaksi: "P" }, "P", { tingkat }).length;
  let kalimat = 0;
  let tingkatJawab = 0;
  for (const q of kat.pertanyaan) {
    for (const v of Object.values(q.jawaban || {})) {
      for (const x of Array.isArray(v) ? v : [v]) {
        kalimat += (x.saksi1 || []).length + (x.saksi2 || []).length;
        tingkatJawab += 1;
      }
    }
  }
  const bersyarat = kat.pertanyaan.filter((q) => q.keadaan && Object.keys(q.keadaan).length).length;
  return {
    versi: kat.versi,
    pokok: kat.pokokPembuktian.length,
    butir: kat.pertanyaan.length,
    butirBersyaratKeadaan: bersyarat,
    aktifPerSaksiInti: aktif(["inti"]),
    aktifPerSaksiIntiPilihan: aktif(["inti", "pilihan"]),
    aktifPerSaksiIntiPilihanTambahan: aktif(["inti", "pilihan", "tambahan"]),
    aktifPerSaksiSemua: aktif(["inti", "pilihan", "tambahan", "jarang"]),
    kalimatJawaban: kalimat,
    blokJawabanTingkat: tingkatJawab,
    dasarHukum: kat.dasarHukum.length,
    keadaan: Object.keys(kat.keadaan).length,
  };
}

const hasil = {};
const jumlah = { sebelum: {}, sesudah: {} };
for (const j of JENIS) {
  const s = ukur(muat(CAD, j));
  const b = ukur(muat(path.join(EK, "saksi-katalog"), j));
  hasil[j] = { sebelum: s, sesudah: b };
  for (const k of Object.keys(s)) {
    if (k === "versi") continue;
    jumlah.sebelum[k] = (jumlah.sebelum[k] || 0) + s[k];
    jumlah.sesudah[k] = (jumlah.sesudah[k] || 0) + b[k];
  }
}
hasil.JUMLAH = jumlah;
console.log("jenis".padEnd(24), "pokok", "butir", "aktif(inti+pilihan)", "aktif(semua)", "kalimat");
for (const j of JENIS) {
  const { sebelum: s, sesudah: b } = hasil[j];
  console.log(j.padEnd(24), `${s.pokok}->${b.pokok}`.padEnd(7), `${s.butir}->${b.butir}`.padEnd(8), `${s.aktifPerSaksiIntiPilihan}->${b.aktifPerSaksiIntiPilihan}`.padEnd(20), `${s.aktifPerSaksiSemua}->${b.aktifPerSaksiSemua}`.padEnd(13), `${s.kalimatJawaban}->${b.kalimatJawaban}`);
}
console.log("JUMLAH".padEnd(24), `${jumlah.sebelum.pokok}->${jumlah.sesudah.pokok}`.padEnd(7), `${jumlah.sebelum.butir}->${jumlah.sesudah.butir}`.padEnd(8), `${jumlah.sebelum.aktifPerSaksiIntiPilihan}->${jumlah.sesudah.aktifPerSaksiIntiPilihan}`.padEnd(20), `${jumlah.sebelum.aktifPerSaksiSemua}->${jumlah.sesudah.aktifPerSaksiSemua}`.padEnd(13), `${jumlah.sebelum.kalimatJawaban}->${jumlah.sesudah.kalimatJawaban}`);
if (process.argv.includes("--tulis")) {
  fs.writeFileSync(path.join(REPO, "docs", "gelombang2", "UKURAN-W2b-katalog.json"), JSON.stringify({ dibuat: "2026-10-21", cara: "abt-paket/w2b-keluarga-lain/alat/ukur_katalog_w2b.cjs (tanpa data perkara; keadaan bawaan, pihak Pemohon)", hasil }, null, 2) + "\n", "utf8");
  console.log("ditulis docs/gelombang2/UKURAN-W2b-katalog.json");
}
