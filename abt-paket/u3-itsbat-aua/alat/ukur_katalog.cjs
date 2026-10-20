// Ukur katalog saksi atas perkara nyata 2026 (data baca-saja): SEBELUM (cadangan-katalog) dan SESUDAH (ekstensi-sipp/saksi-katalog).
//   node ukur_katalog.cjs [--jenis=360|358] [--rinci]
// Jalur yang sama dengan Blangko Derry mode katalog: kenali -> keadaanDariData -> susun (variabel dari usulan posita).
//   otomatis = jawaban lengkap hanya dengan nilai yang yakin/cukup ; ragu = lengkap bila nilai ragu ikut ; manual = masih ada isian kosong.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const REPO = path.resolve(__dirname, "..", "..", "..");
const DIR = process.env.DATA_UKUR || "D:/Aplikasi/aleta/tmp/s2/data/";
const arg = (n) => (process.argv.find((a) => a.startsWith("--" + n + "=")) || "").split("=")[1] || "";
const jenisUkur = arg("jenis") || "360";
const rinci = process.argv.includes("--rinci");

const U = require(path.join(REPO, "aleta_bot/services/abtUsulanService.js"));
const L = require(path.join(REPO, "aleta_bot/services/abtUsulanLainService.js"));
const D = require(path.join(REPO, "aleta_bot/services/deteksiJenisPerkaraService.js"));
const AU = require(path.join(REPO, "aleta_bot/services/deteksi/asalUsul.js"));

const tsv = (f) => {
  const t = fs.readFileSync(DIR + f + ".tsv", "utf8").split("\n").filter(Boolean);
  const h = t[0].split("\t");
  return t.slice(1).map((l) => Object.fromEntries(l.split("\t").map((v, i) => [h[i], v === "NULL" ? "" : v.replace(/\\n/g, "\n")])));
};
const perkara = tsv("perkara").filter((p) => p.j === jenisUkur);
const anak = {};
for (const a of tsv("anak")) (anak[a.perkara_id] = anak[a.perkara_id] || []).push(a);

function muatKatalog(sumberLama) {
  // Mesin + pembungkus Blangko Derry dimuat ulang tiap kali supaya data katalog berganti bersih.
  for (const k of ["AletaSaksiKatalog", "AletaBdKatalog", "ALETA_SAKSI_KATALOG_DATA"]) delete globalThis[k];
  for (const f of ["saksi-katalog.js", "blangko-derry-katalog.js"]) {
    delete require.cache[require.resolve(path.join(REPO, "ekstensi-sipp", f))];
  }
  const Mesin = require(path.join(REPO, "ekstensi-sipp", "saksi-katalog.js"));
  const dir = sumberLama ? path.join(REPO, "abt-paket/u3-itsbat-aua/cadangan-katalog") : path.join(REPO, "ekstensi-sipp/saksi-katalog");
  const semua = fs.readdirSync(path.join(REPO, "ekstensi-sipp/saksi-katalog")).filter((n) => n.endsWith(".json"));
  const data = semua.map((n) => {
    const lama = sumberLama && fs.existsSync(path.join(dir, n));
    return JSON.parse(fs.readFileSync(path.join(lama ? dir : path.join(REPO, "ekstensi-sipp/saksi-katalog"), n), "utf8"));
  });
  globalThis.ALETA_SAKSI_KATALOG_DATA = data;
  const Bd = require(path.join(REPO, "ekstensi-sipp", "blangko-derry-katalog.js"));
  return { Mesin, Bd, data };
}

function usulanPerkara(p) {
  const peta = {};
  const tambah = (kode, nilai, yakin) => {
    if (nilai && !peta[kode]) peta[kode] = { nilai: String(nilai), yakin: yakin === "ragu" ? "ragu" : "cukup" };
  };
  if (p.j === "360") {
    const r = D.tambahUsulanJenis(L.saringUsulanItsbat(U.dariPositaItsbat(p.posita, { pemohon: "Pemohon", pemohon2: "" }), ""), p.posita, { jenisPerkara: "360" });
    for (const u of r.usulan) tambah(u.kode, u.nilai, u.keyakinan);
  } else {
    const r = D.tambahUsulanJenis(L.saringUsulanItsbat(U.dariPositaItsbat(p.posita, { pemohon: "Pemohon", pemohon2: "" }), ""), p.posita, { jenisPerkara: "360" });
    for (const u of r.usulan) tambah(u.kode, u.nilai, u.keyakinan);
    const d = AU.deteksi(p.posita, { petitum: p.petitum }) || {};
    for (const [k, v] of Object.entries(d)) tambah(k, v.nilai, v.yakin);
    const a = anak[p.perkara_id] || [];
    if (a.length) tambah("8602", a.map((x) => x.nama_anak.trim()).join(", "), "cukup");
  }
  return peta;
}

function ukur(sumberLama) {
  const { Mesin, Bd } = muatKatalog(sumberLama);
  const hasil = { perkara: 0, butirAktif: 0, baris: 0, otomatis: 0, ragu: 0, manual: 0, jenisKode: {} };
  const manualKode = {};
  for (const p of perkara) {
    const kenal = Bd.kenali({ jenisPerkaraId: p.j, alurPerkaraId: p.a, nomorPerkara: p.nomor_perkara, jenisPerkara: "" });
    if (!kenal || kenal.mode !== "katalog") continue;
    const usul = usulanPerkara(p);
    // variabel yang dihitung/diambil ABT sendiri dari SIPP (selalu tersedia di ABT): alamat pihak, alasan tiada buku nikah, nama anak bila ada di SIPP
    const ABT_SENDIRI = new Set(["0101", "1358", "0098", "1033"]);
    const nilai = (hanyaYakin) => (kode) => {
      if (ABT_SENDIRI.has(kode)) return "(dari ABT)";
      const u = usul[kode] || (kode === "8602" ? usul["8603"] : undefined);
      if (!u) return undefined;
      if (hanyaYakin && u.yakin === "ragu") return undefined;
      return u.nilai;
    };
    const jumlahP = p.j === "360" ? (p.a === "16" ? 2 : 1) : 2;
    const dari = Bd.keadaanDariData(kenal.kat, { alurId: p.a, jumlahPemohon: jumlahP, hadir: 1 });
    const keadaan = Bd.lengkapiBawaan ? Bd.lengkapiBawaan(kenal.kat, dari.keadaan) : dari.keadaan;
    const saksi = [{ kunci: "saksi 1 p", pihak: "P" }, { kunci: "saksi 2 p", pihak: "P" }];
    const hit = (hanyaYakin) => Bd.susun({ kat: kenal.kat, sebutan: kenal.sebutan, benih: p.nomor_perkara, keadaan, saksi, variabel: nilai(hanyaYakin) });
    const a = hit(false);
    const b = hit(true);
    hasil.perkara++;
    for (let s = 0; s < a.saksi.length; s++) {
      a.saksi[s].baris.forEach((bar, i) => {
        hasil.baris++;
        const sisa = bar.kosong || [];
        const sisaYakin = (b.saksi[s].baris[i].kosong || []).length;
        if (sisa.length) {
          hasil.manual++;
          for (const k of sisa) manualKode[k] = (manualKode[k] || 0) + 1;
        } else if (sisaYakin) hasil.ragu++;
        else hasil.otomatis++;
      });
    }
    hasil.butirAktif += a.saksi[0].baris.length;
  }
  hasil.butirPerSaksi = hasil.perkara ? (hasil.butirAktif / hasil.perkara).toFixed(1) : 0;
  return { hasil, manualKode };
}

const sebelum = ukur(true);
const sesudah = ukur(false);
const fmt = (x) => `${x.hasil.perkara} perkara | butir/saksi ${x.hasil.butirPerSaksi} | baris ${x.hasil.baris} | otomatis ${x.hasil.otomatis} (${((100 * x.hasil.otomatis) / Math.max(1, x.hasil.baris)).toFixed(1)}%) | ragu ${x.hasil.ragu} | manual ${x.hasil.manual}`;
console.log(`jenis ${jenisUkur}`);
console.log("SEBELUM :", fmt(sebelum));
console.log("SESUDAH :", fmt(sesudah));
if (rinci) {
  const top = (m) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k}:${v}`).join("  ");
  console.log("manual sebelum:", top(sebelum.manualKode));
  console.log("manual sesudah:", top(sesudah.manualKode));
}
