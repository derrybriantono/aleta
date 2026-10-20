/**
 * Ukur jawaban saksi otomatis atas perkara aktif 2026 (data baca-saja yang sudah ditarik ke berkas TSV).
 *
 *   npx tsx scripts/ukur-jawaban-saksi-20okt.mts [folder-data] [--isi] [--rinci=<jenis>] [--contoh=<nomor>]
 *
 * Menjalankan jalur yang SAMA dengan rute 'saksi-sdg' (set pertanyaan -> isiTemplatSaksi -> susunKeteranganSaksiSdg ->
 * lengkapiSusunan -> pengisi bersumber) lalu pasangJawaban, dan menghitung jawaban yang masih "..." sebelum (tanpa
 * --isi) dan sesudah (--isi) pengisi jawaban bersumber. Tidak menulis apa pun.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import { tawarkanSetSaksi } from "../src/lib/set-pertanyaan-saksi";

const req = createRequire(import.meta.url);
const bot = (p: string) => req("../../aleta_bot/" + p);
const usul = bot("services/abtUsulanService.js");
const djp = bot("services/deteksiJenisPerkaraService.js");
const dsaksi = bot("services/deteksiSaksiService.js");
const pemilih = bot("services/pemilihRagam.js");
const BD = req("../../ekstensi-sipp/blangko-derry-saksi.js");
// mode --katalog: jalur susunan katalog jenis perkara (blangko-derry-katalog.js) + pengisi 'isi-jawaban'
const KATALOG = args0().includes("--katalog");
function args0() {
  return process.argv.slice(2);
}
let KT: any = null;
let KATJ: any = null;
if (KATALOG) {
  (globalThis as any).AletaSaksiKatalog = req("../../ekstensi-sipp/saksi-katalog.js");
  req("../../ekstensi-sipp/saksi-katalog-data.js");
  KT = req("../../ekstensi-sipp/blangko-derry-katalog.js");
  KATJ = req("../../ekstensi-sipp/blangko-derry-jawab-katalog.js");
}

const args = process.argv.slice(2);
const DIR = (args.find((a) => !a.startsWith("--")) || "D:/Aplikasi/aleta/tmp/s7/data") + "/";
const PAKAI_ISI = args.includes("--isi");
const RINCI = (args.find((a) => a.startsWith("--rinci=")) || "").slice(8);
const CONTOH = (args.find((a) => a.startsWith("--contoh=")) || "").slice(9);
const ISI = PAKAI_ISI ? bot("services/isiJawabanSaksiService.js") : null;

const tsv = (f: string) => {
  const t = fs.readFileSync(DIR + f + ".tsv", "utf8").split("\n").filter(Boolean);
  const h = t[0].split("\t");
  return t.slice(1).map((l) => Object.fromEntries(l.split("\t").map((v, i) => [h[i], v === "NULL" ? "" : v.replace(/\\n/g, "\n")])));
};
const perkara = tsv("perkara");
const per = (f: string) => {
  const m: Record<string, any[]> = {};
  for (const r of tsv(f)) (m[r.perkara_id] = m[r.perkara_id] || []).push(r);
  return m;
};
// saksi.tsv (perkara_pihak5: pihak, urutan, keterangan = hubungan saksi di SIPP) - opsional
const saksiSipp = fs.existsSync(DIR + "saksi.tsv") ? per("saksi") : {};
const nikah = per("nikah"), itsbat = per("itsbat"), anak = per("anak"), pihak1 = per("pihak1"), pihak2 = per("pihak2"), sidang = per("sidang");

const NAMA: Record<string, string> = { "346": "Cerai Talak", "347": "Cerai Gugat", "360": "Itsbat Nikah", "362": "Dispensasi Kawin", "363": "Wali Adhal", "354": "Perwalian", "358": "Asal Usul Anak", "371": "Penetapan Ahli Waris", "364": "Kewarisan", "348": "Harta Bersama" };
const LABEL: Record<string, string> = { "346": "cerai talak", "347": "cerai gugat", "360": "itsbat nikah", "362": "dispensasi kawin", "363": "wali adhal", "354": "perwalian", "358": "asal usul anak", "371": "ahli waris (P3HP)", "364": "kewarisan", "348": "harta bersama" };
const AKTIF = new Set(["Sidang pertama", "Persidangan", "Putusan", "Pendaftaran Perkara"]);
const adaTitik = (t: string) => /\.{3,}|…|_{2,}|#\d{3,5}#|\{[a-zA-Z0-9_]+\}/.test(String(t || ""));

/** Identitas saksi dari SIPP seperti identitasSaksiPerkara: [{pihak 'P'|'T', urutPihak, keterangan}] (nama dsb. tidak ditarik). */
const identitasDari = (p: any) => {
  const hitung: Record<string, number> = { P: 0, T: 0 };
  return (saksiSipp[p.perkara_id] || []).map((b: any) => {
    const pihak = Number(b.pihak) === 2 ? "T" : "P";
    hitung[pihak] += 1;
    return { pihak, urutPihak: hitung[pihak], nama: "", umur: null, agama: "", pendidikan: "", pekerjaan: "", alamat: "", keterangan: b.keterangan || "" };
  });
};
const sippDari = (p: any) => ({
  saksi: identitasDari(p),
  nikah: (nikah[p.perkara_id] || [])[0] || null,
  itsbat: (itsbat[p.perkara_id] || [])[0] || null,
  anak: anak[p.perkara_id] || [],
  pihak1: pihak1[p.perkara_id] || [],
  pihak2: pihak2[p.perkara_id] || [],
  sidang: sidang[p.perkara_id] || [],
});

type Hasil = { jenis: string; aktif: boolean; baris: number; titik: number; ragu: number; terisiOleh: number; sisa: Record<string, number>; nomor: string };
const hasil: Hasil[] = [];
for (const p of KATALOG ? [] : perkara) {
  if (!NAMA[p.j]) continue;
  const sebP = p.j === "347" || p.j === "364" || p.j === "348" || (p.j === "360" && p.a === "15") ? "Penggugat" : "Pemohon";
  const sebT = sebP === "Penggugat" ? "Tergugat" : "Termohon";
  const sipp = sippDari(p);
  const jumlahP = p.j === "360" ? Math.max(1, sipp.pihak1.length) : 1;
  const t = tawarkanSetSaksi({ namaJenis: NAMA[p.j], nomor: p.nomor_perkara, folder: "", sebutanP: sebP, sebutanT: sebT, jumlahP } as any);
  const rows = t.set[0].baris.map((r: any) => ({ no: r.no, tanya: r.tanya, jawab: r.jawab }));
  const templatAsli = BD.templatDariBaris(BD.tandaiDasar(rows, true));
  const templat = templatAsli.map((x: any) => ({ ...x }));
  const posita = p.posita;
  let jenis3: any = null;
  try {
    jenis3 = djp.isiTemplatSaksi(templat, { posita, jenisPerkara: p.j, alur: p.a });
    if (jenis3 && jenis3.jenis && jenis3.terisi.length) templat.splice(0, templat.length, ...jenis3.templat);
  } catch {
    /* */
  }
  const saksiMuat = [
    { pihak: "P", ke: 1, modus: "sama", sumber: "penggugat", alasan: [] },
    { pihak: "P", ke: 2, modus: "sebagian", sumber: "penggugat", alasan: [] },
  ];
  const alamatPihak = { lawan: (sipp.pihak1[0] || {}).alamat || "", pelaku: (sipp.pihak2[0] || {}).alamat || "" };
  const muatan = BD.susunMuatan({ nomorPerkara: p.nomor_perkara, templat, kodeKumpulan: "", jenisPerkara: p.j, alur: p.a, pelaku: sebT, lawan: sebP, saksi: saksiMuat });
  const h = usul.susunKeteranganSaksiSdg({ templat, posita, alasan: [], pelaku: sebT, lawan: sebP, nomorPerkara: p.nomor_perkara, kodeKumpulan: "", jenisPerkara: p.j, alur: p.a, tanggalSidang: "", alamatPihak, modus: muatan.modus, saksi: muatan.saksi });
  if (!h.ok) continue;
  let ragu = 0,
    terisiOleh = 0;
  if (ISI) {
    const r = ISI.lengkapi(h, { templatMasuk: templatAsli, posita, jenisPerkara: p.j, alur: p.a, pelaku: sebT, lawan: sebP, tanggalSidang: "", alamatPihak, sipp, saksi: saksiMuat });
    ragu = r.ragu;
    terisiOleh = r.terisi;
  }
  try {
    Object.assign(h, dsaksi.lengkapiSusunan(h, { identitas: identitasDari(p), lawan: sebP, pelaku: sebT, kelompokTanya: pemilih.kelompokTanya, penutup: "" }));
  } catch {
    /* */
  }
  if (jenis3 && jenis3.jenis) {
    try {
      djp.lengkapiSaksiJenis(h, jenis3, { posita, jenisPerkara: p.j, alur: p.a });
    } catch {
      /* */
    }
  }
  let titik = 0;
  const sisa: Record<string, number> = {};
  const jum = [0, 1].map((ke) => {
    const sj = h.saksi && h.saksi[ke] ? h.saksi[ke].jawaban : [];
    const res = BD.pasangJawaban(rows.map((r: any) => ({ ...r, dasar: r.jawab })), sj, { hubungan: h.paragrafSaksi && h.paragrafSaksi[ke] ? h.paragrafSaksi[ke].hubungan : undefined });
    res.rows.forEach((r: any, i: number) => {
      if (CONTOH && p.nomor_perkara === CONTOH) console.log(`[saksi ${ke + 1}] ${String(i + 1).padStart(2)} ${r.jawab}${r.usulan ? `   <${r.usulan.yakin} | ${r.usulan.sumber}>` : ""}`);
      if (adaTitik(r.jawab)) {
        titik++;
        const k = rows[i].tanya.slice(0, 70);
        sisa[k] = (sisa[k] || 0) + 1;
      }
    });
    return res.rows.length;
  });
  hasil.push({ jenis: p.j, aktif: AKTIF.has(p.proses), baris: jum[0] + jum[1], titik, ragu, terisiOleh, sisa, nomor: p.nomor_perkara });
}

// ----------------------------------------------------------------------------
// Mode --katalog: susunan katalog jenis perkara (jalur panel Blangko Derry untuk jenis non-cerai) + pengisi 'isi-jawaban'
// ----------------------------------------------------------------------------
if (KATALOG) {
  const ISI2 = bot("services/isiJawabanSaksiService.js");
  const mesin = (globalThis as any).AletaSaksiKatalog;
  for (const p of perkara) {
    if (!NAMA[p.j] || p.j === "346" || p.j === "347") continue;
    const kn = KT.kenali({ jenisPerkaraId: p.j, alurPerkaraId: p.a, nomorPerkara: p.nomor_perkara });
    if (kn.mode !== "katalog") continue;
    const sipp = sippDari(p);
    const data = KT.keadaanDariData(kn.kat, { alurId: p.a, jumlahPemohon: sipp.pihak1.length, hadir: null });
    const ker = KT.lengkapiBawaan(kn.kat, Object.assign({}, mesin.keadaanBawaan(kn.kat, {}), data.keadaan));
    const saksiMasuk = [
      { kunci: "saksi 1 p", pihak: "P" },
      { kunci: "saksi 2 p", pihak: "P" },
    ];
    const sus = KT.susun({ kat: kn.kat, sebutan: kn.sebutan, benih: p.nomor_perkara, keadaan: ker, saksi: saksiMasuk });
    if (!sus.ada) continue;
    let usulan: any = {};
    let ragu = 0;
    let terisiOleh = 0;
    if (ISI) {
      const muatan = KATJ.susunMuatan({ perkara: { nomorPerkara: p.nomor_perkara, jenisPerkaraId: p.j, alurPerkaraId: p.a }, kenal: kn, keadaan: ker, saksi: sus.saksi, variabel: {} });
      const alamatPihak = { lawan: (sipp.pihak1[0] || {}).alamat || "", pelaku: (sipp.pihak2[0] || {}).alamat || "" };
      usulan = ISI2.isiBaris({ posita: p.posita, jenisPerkara: p.j, alur: p.a, pelaku: kn.sebutan.T, lawan: kn.sebutan.P, tanggalSidang: "", alamatPihak, isian: {}, sipp, saksiIsi: muatan.saksiIsi });
    }
    let titik = 0;
    let baris = 0;
    const sisa: Record<string, number> = {};
    sus.saksi.forEach((sk: any, ke: number) => {
      const g = KT.gabung([], sk.baris);
      const ter = KT.terapkanUsulan(g.rows, usulan, sk.kunci);
      terisiOleh += ter.terisi;
      ragu += ter.ragu;
      ter.rows.forEach((r: any, i: number) => {
        baris++;
        if (CONTOH && p.nomor_perkara === CONTOH) console.log(`[saksi ${ke + 1}] ${String(i + 1).padStart(2)} ${r.jawab}${r.usulan ? `   <${r.usulan.yakin} | ${r.usulan.sumber}>` : ""}`);
        if (adaTitik(r.jawab)) {
          titik++;
          const k = String(r.tanya).slice(0, 70);
          sisa[k] = (sisa[k] || 0) + 1;
        }
      });
    });
    hasil.push({ jenis: p.j, aktif: AKTIF.has(p.proses), baris, titik, ragu, terisiOleh, sisa, nomor: p.nomor_perkara });
  }
}
const kelompok = (f: (h: Hasil) => boolean) => {
  const out: Record<string, { perkara: number; baris: number; titik: number; ragu: number; isi: number }> = {};
  for (const h of hasil.filter(f)) {
    const o = (out[h.jenis] = out[h.jenis] || { perkara: 0, baris: 0, titik: 0, ragu: 0, isi: 0 });
    o.perkara++;
    o.baris += h.baris;
    o.titik += h.titik;
    o.ragu += h.ragu;
    o.isi += h.terisiOleh;
  }
  return out;
};
const cetak = (judul: string, o: ReturnType<typeof kelompok>) => {
  console.log(`\n== ${judul} ${PAKAI_ISI ? "(SESUDAH pengisi)" : "(SEBELUM pengisi)"}`);
  console.log("jenis".padEnd(20), "perkara".padStart(8), "jawaban".padStart(8), "...".padStart(6), "%".padStart(6), "terisi+".padStart(8), "ragu".padStart(6));
  const T = { perkara: 0, baris: 0, titik: 0, ragu: 0, isi: 0 };
  for (const [j, v] of Object.entries(o)) {
    console.log(LABEL[j].padEnd(20), String(v.perkara).padStart(8), String(v.baris).padStart(8), String(v.titik).padStart(6), (v.baris ? ((100 * v.titik) / v.baris).toFixed(1) : "0").padStart(6), String(v.isi).padStart(8), String(v.ragu).padStart(6));
    for (const k of Object.keys(T)) (T as any)[k] += (v as any)[k];
  }
  console.log("JUMLAH".padEnd(20), String(T.perkara).padStart(8), String(T.baris).padStart(8), String(T.titik).padStart(6), (T.baris ? ((100 * T.titik) / T.baris).toFixed(1) : "0").padStart(6), String(T.isi).padStart(8), String(T.ragu).padStart(6));
};
cetak("semua perkara 2026", kelompok(() => true));
cetak("perkara sedang bersidang (Sidang pertama/Persidangan/Putusan)", kelompok((h) => h.aktif));
if (RINCI) {
  const sisa: Record<string, number> = {};
  for (const h of hasil.filter((x) => x.jenis === RINCI)) for (const [k, v] of Object.entries(h.sisa)) sisa[k] = (sisa[k] || 0) + v;
  console.log(`\n== pertanyaan yang masih "..." (jenis ${RINCI})`);
  for (const [k, v] of Object.entries(sisa).sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(5), k);
}
