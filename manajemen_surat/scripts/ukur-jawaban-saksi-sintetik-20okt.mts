/**
 * Ukur jenis katalog yang TIDAK punya perkara di salinan lokal (hibah, wakaf, wasiat, ekonomi syariah, izin poligami,
 * pengangkatan anak, hak asuh, nafkah anak, pembatalan/pencegahan perkawinan, mafqud): posita buatan dengan bunyi gugatan
 * yang lazim, jalur yang sama dengan panel (susun -> isi-jawaban -> susun ulang -> terapkanUsulan).
 *
 *   npx tsx scripts/ukur-jawaban-saksi-sintetik-20okt.mts [--isi]
 */
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
(globalThis as any).AletaSaksiKatalog = req("../../ekstensi-sipp/saksi-katalog.js");
req("../../ekstensi-sipp/saksi-katalog-data.js");
const KT = req("../../ekstensi-sipp/blangko-derry-katalog.js");
const KATJ = req("../../ekstensi-sipp/blangko-derry-jawab-katalog.js");
const ISI = req("../../aleta_bot/services/isiJawabanSaksiService.js");
const mesin = (globalThis as any).AletaSaksiKatalog;
const PAKAI_ISI = process.argv.includes("--isi");

const KASUS: Array<{ nama: string; j: string; a: string; posita: string }> = [
  { nama: "hibah", j: "366", a: "15", posita: "1. Bahwa Haji Ahmad bin Salim telah menghibahkan sebidang tanah seluas 500 m2 yang terletak di Desa Watusampu kepada Tergugat;\n2. Bahwa hibah tersebut belum dibuatkan akta;" },
  { nama: "wakaf", j: "367", a: "16", posita: "1. Bahwa Haji Umar bin Ali telah mewakafkan sebidang tanah di Desa Loli kepada nazhir Masjid Al Ikhlas untuk pembangunan masjid;" },
  { nama: "wasiat", j: "365", a: "16", posita: "1. Bahwa Almarhum Hasan bin Idris meninggal dunia pada tanggal 3 Maret 2025 karena sakit;\n2. Bahwa Almarhum Hasan bin Idris telah meninggalkan 2 orang anak;" },
  { nama: "ekonomi syariah", j: "370", a: "15", posita: "1. Bahwa Penggugat dan Tergugat membuat akad murabahah pembiayaan rumah;\n2. Bahwa sisa utang Tergugat sebesar Rp. 150.000.000;" },
  { nama: "izin poligami", j: "341", a: "16", posita: "1. Bahwa Pemohon bermaksud menikah lagi dengan calon isteri kedua yang bernama Siti Aminah binti Yusuf;" },
  { nama: "pengangkatan anak", j: "369", a: "16", posita: "1. Bahwa Pemohon mengajukan pengangkatan anak yang bernama Rizky bin Hasan, umur 4 tahun;" },
  { nama: "hak asuh anak", j: "349", a: "15", posita: "1. Bahwa dari pernikahan tersebut lahir anak yang bernama Aisyah binti Rahmat;" },
  { nama: "nafkah anak", j: "743", a: "15", posita: "1. Bahwa dari pernikahan tersebut lahir anak yang bernama Fahri bin Rahmat;" },
  { nama: "pembatalan perkawinan", j: "344", a: "15", posita: "1. Bahwa Tergugat menikah pada tanggal 5 Mei 2020 tanpa sepengetahuan Penggugat;" },
  { nama: "pencegahan perkawinan", j: "342", a: "16", posita: "1. Bahwa calon suami bernama Budi bin Hamid masih terikat perkawinan;" },
];
const adaTitik = (t: string) => /\.{3,}|…|_{2,}|#\d{3,5}#|\{[a-zA-Z0-9_]+\}/.test(String(t || ""));
console.log("jenis".padEnd(22), "jawaban".padStart(8), "...".padStart(6), "%".padStart(6), "terisi+".padStart(8));
for (const k of KASUS) {
  const nomor = `1/${k.a === "16" ? "Pdt.P" : "Pdt.G"}/2026/PA.Dgl`;
  const kn = KT.kenali({ jenisPerkaraId: k.j, alurPerkaraId: k.a, nomorPerkara: nomor });
  if (kn.mode !== "katalog") {
    console.log(k.nama.padEnd(22), "tanpa katalog");
    continue;
  }
  const ker = KT.lengkapiBawaan(kn.kat, mesin.keadaanBawaan(kn.kat, {}));
  const saksi = [{ kunci: "saksi 1 p", pihak: "P" }, { kunci: "saksi 2 p", pihak: "P" }];
  let sus = KT.susun({ kat: kn.kat, sebutan: kn.sebutan, benih: nomor, keadaan: ker, saksi });
  let usulan: any = {};
  if (PAKAI_ISI) {
    const muatan = KATJ.susunMuatan({ perkara: { nomorPerkara: nomor, jenisPerkaraId: k.j, alurPerkaraId: k.a }, kenal: kn, keadaan: ker, saksi: sus.saksi, variabel: {}, kodeBelum: sus.variabelAbt });
    usulan = ISI.isiBaris({ posita: k.posita, jenisPerkara: k.j, alur: k.a, kunciKatalog: kn.kunci, pelaku: kn.sebutan.T, lawan: kn.sebutan.P, isian: {}, sipp: { pihak1: [{}], pihak2: [], anak: [], saksi: [] }, saksiIsi: muatan.saksiIsi, kodeVariabel: muatan.kodeVariabel });
    const vb = KATJ.petakan(usulan).variabel || {};
    if (Object.keys(vb).length) sus = KT.susun({ kat: kn.kat, sebutan: kn.sebutan, benih: nomor, keadaan: ker, saksi, variabel: (kode: string) => (vb[kode] ? vb[kode].teks : undefined) });
  }
  let n = 0;
  let titik = 0;
  let isi = 0;
  sus.saksi.forEach((sk: any) => {
    const ter = KT.terapkanUsulan(KT.gabung([], sk.baris).rows, usulan, sk.kunci);
    isi += ter.terisi;
    for (const r of ter.rows) {
      n += 1;
      if (adaTitik(r.jawab)) titik += 1;
    }
  });
  console.log(k.nama.padEnd(22), String(n).padStart(8), String(titik).padStart(6), ((100 * titik) / n).toFixed(1).padStart(6), String(isi).padStart(8));
}
