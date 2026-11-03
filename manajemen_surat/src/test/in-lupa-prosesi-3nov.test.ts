// @vitest-environment node
/**
 * ============================================================================
 * 3 Nov 2026 - ITSBAT: SAKSI HANYA HADIR DI PESTA, TIDAK TAHU PROSESI AKAD
 * ============================================================================
 *
 * Permintaan pengguna (3 Nov 13.15):
 *   1. blangko baru "[01f] [Kabul] IN Kabul (Hadir Tapi Lupa Prosesi Nikah)" di "2 Itsbat Nikah" (dari [01]) - paket ABT
 *      abt-paket/in-lupa-prosesi-3nov (berkas baru saja, tanpa variabel/menu baru);
 *   2. pilihan cara saksi mengetahui pernikahan "Saksi hanya hadir di pesta pernikahan, tidak tahu prosesi akad nikah"
 *      (keadaan bentukKesaksian = "pesta") di katalog saksi itsbat dan kumulasi cerai+itsbat (panel Blangko Derry dan ABT lama);
 *   3. rekomendasi putusan itsbat menyarankan [01f] bila dua saksi hanya hadir di pesta.
 * Data rekaan saja.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { SaksiMasuk } from "@/lib/penilai-bukti";
import { keberatanDiterangkan, rekomendasiPutusanDariBukti, type MasukanRekomendasiPutusan } from "@/lib/rekomendasi-putusan";

const REPO = path.resolve(process.cwd(), "..");
const PAKET = path.join(REPO, "abt-paket/in-lupa-prosesi-3nov/paket-satker");
const BARU = "[01f] [Kabul] IN Kabul (Hadir Tapi Lupa Prosesi Nikah).rtf";
const RTF = path.join(PAKET, "rtf/derry_briantono/2 Itsbat Nikah", BARU);
const md5 = (b: Buffer | string) => createHash("md5").update(b).digest("hex");
const req = createRequire(import.meta.url);

/** Teks polos kasar RTF (cukup untuk mencari kalimat): kendali, grup gambar, dan kurawal dibuang. */
function polos(rtf: string): string {
  let s = rtf.replace(/\{\\\*\\shppict[\s\S]*?\}\}\}/g, " ").replace(/\{\\pict[\s\S]*?\}/g, " ");
  s = s.replace(/\\u(-?\d+) ?\??/g, (_, n) => String.fromCharCode(Number(n) < 0 ? Number(n) + 65536 : Number(n)));
  s = s.replace(/\\'([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  s = s.replace(/\\par\b/g, "\n").replace(/\\tab\b/g, " ").replace(/\\[a-z]+-?\d* ?/gi, "").replace(/[{}]/g, "");
  return s.replace(/[ \t]+/g, " ");
}

describe("paket ABT in-lupa-prosesi-3nov: berkas [01f]", () => {
  const isi = readFileSync(RTF);
  const teks = polos(isi.toString("latin1"));

  it("daftar-rtf, MD5SUMS, dan PRASYARAT cocok dengan isi paket; hanya satu berkas BARU di folder yang sudah ada", () => {
    const daftar = readFileSync(path.join(PAKET, "daftar-rtf.tsv"), "utf8").split("\n").filter((x) => x && !x.startsWith("#"));
    expect(daftar).toEqual([`derry_briantono/2 Itsbat Nikah\t${BARU}\t${md5(isi)}\t[01] [Kabul] IN.rtf`]);
    for (const b of readFileSync(path.join(PAKET, "MD5SUMS.txt"), "utf8").split("\n").filter(Boolean)) {
      const [h, rel] = [b.slice(0, 32), b.slice(34)];
      expect(md5(readFileSync(path.join(PAKET, rel))), rel).toBe(h);
    }
    const nomor = readFileSync(path.join(PAKET, "nomor-dirujuk.txt"), "utf8").split("\n").filter(Boolean);
    const diRtf = [...new Set([...isi.toString("latin1").matchAll(/#(\d{4,5})#/g)].map((m) => m[1]))].sort((a, b) => Number(a) - Number(b));
    expect(nomor).toEqual(diRtf);
    const sql = readFileSync(path.join(PAKET, "abt-in-lupa-prosesi-3nov-PRASYARAT.sql"), "utf8");
    expect(sql).toContain(`IN (${nomor.map(Number).join(",")})`);
    expect(readFileSync(path.join(PAKET, "folder-ada.txt"), "utf8")).toContain("derry_briantono/2 Itsbat Nikah");
    expect(readdirSync(path.join(PAKET, "rtf/derry_briantono/2 Itsbat Nikah"))).toEqual([BARU]);
    // tanpa variabel baru: semua nomor sudah dipakai blangko itsbat lama (tidak ada nomor klaim 12120-12139 dst.)
    expect(nomor.every((n) => Number(n) < 12100)).toBe(true);
  });

  it("pertimbangan pengguna masuk dengan salah ketik dibetulkan dan sebutan hakim/pihak/tempat dari variabel", () => {
    for (const k of [
      "Menimbang, bahwa meskipun saksi-saksi menghadiri perkawinan #0046# I dan #0046# II namun tidak mengetahui siapa yang bertindak sebagai wali nikah",
      "#8554# berpendapat bahwa hal tersebut adalah lumrah",
      "tidak mengikuti akad nikah dan kehadirannya adalah menghadiri pesta perkawinan",
      "hidup rukun sebagaimana layaknya suami istri dan #0007#, hingga kini masih tetap berstatus sebagai suami istri",
      "masyarakat pemeluk agama Islam di wilayah #5105# memandang perkawinan",
      "tidak ada seorang pun masyarakat setempat yang berkeberatan dengan perkawinan tersebut maka #8554# berkesimpulan",
      "#8554# perlu mengetengahkan dalil dalam Kitab I’anatut Thalibin Juz IV halaman 253-254",
      "Pengakuan seorang laki-laki yang menikahi seorang perempuan harus bisa menyebutkan sahnya nikah",
      "Bughyatul Mustarsyidin halaman 298",
      "Bahwa saksi-saksi para #0046# menghadiri pesta perkawinan",
    ])
      expect(teks.replace(/\s+/g, " "), k).toContain(k);
    for (const salah of ["dan dan", "orang orang", "agama islam", "seorangpun", "tidak berkeberatan", "Kab. Sigi", "Majelis Hakim memandang", "Hakim berpendapat", "pendapat hakim", "Ianatut", "suami isteri", "tanpa ada jeda waktu"])
      expect(teks, salah).not.toContain(salah);
    expect(/aleta/i.test(isi.toString("latin1"))).toBe(false);
  });

  it("teks Arab I'anatut Thalibin dan Bughyatul Mustarsyidin tetap gambar yang sama dengan [01]; amar kabul tetap", () => {
    expect((isi.toString("latin1").match(/\\pngblip/g) || []).length).toBe(3);
    expect(teks).toContain("MENETAPKAN");
    expect(teks).toContain("Menyatakan sah pernikahan antara #0046# I (#0098#) dengan #0046# II (#1033#)");
  });
});

// ─── Katalog saksi ──────────────────────────────────────────────────────────
const EK = path.join(REPO, "ekstensi-sipp");
const semua = readdirSync(path.join(EK, "saksi-katalog")).filter((n) => n.endsWith(".json")).map((n) => JSON.parse(readFileSync(path.join(EK, "saksi-katalog", n), "utf8")));
(globalThis as any).ALETA_SAKSI_KATALOG_DATA = semua;
const Mesin = req(path.join(EK, "saksi-katalog.js"));
const Bd = req(path.join(EK, "blangko-derry-katalog.js"));
const IN = semua.find((k: any) => k.kunci === "itsbat-nikah");
const KM = semua.find((k: any) => k.kunci === "cerai-kumulasi-itsbat");
const VAR: Record<string, string> = { "1046": "Ayah Kandung Pemohon II", "1217": "Rekaan", "8087": "Imam Rekaan", "0650": "Saksi Satu", "0651": "Saksi Dua", "5197": "10 Juni 2010", "5105": "Desa Contoh", "1001": "seperangkat alat salat", "1002": "Jejaka", "1003": "Perawan" };
const LABEL = "Saksi hanya hadir di pesta pernikahan, tidak tahu prosesi akad nikah";

function susun(kat: any, keadaan: Record<string, any>, sebutan = { P: "Pemohon", T: "Termohon" }) {
  const h = Bd.susun({
    kat,
    sebutan,
    benih: "1/Pdt.P/2026/PA.Rkn",
    keadaan: Bd.lengkapiBawaan(kat, keadaan),
    saksi: [{ kunci: "saksi 1 p", pihak: "P" }, { kunci: "saksi 2 p", pihak: "P" }],
    variabel: (k: string) => VAR[k],
  });
  expect(h.ada).toBe(true);
  return h;
}
const jawab = (h: any, id: string, ke = 0) => (h.saksi[ke].baris.find((b: any) => b.butir === id) || {}).jawab as string | undefined;
const ids = (h: any, ke = 0) => h.saksi[ke].baris.map((b: any) => b.butir) as string[];

describe("katalog saksi: pilihan 'hadir di pesta, tidak tahu prosesi akad'", () => {
  it("pilihan ada di itsbat dan kumulasi cerai+itsbat, katalog tetap sah, tulisannya tanpa istilah teknis", () => {
    for (const kat of [IN, KM]) {
      expect(kat.keadaan.bentukKesaksian.nilai).toEqual(["langsung", "istifadhah", "pesta"]);
      expect(kat.keadaan.bentukKesaksian.bawaan).toBe("langsung");
      expect(kat.keadaan.bentukKesaksian.labelNilai.pesta).toBe(LABEL);
      expect(Mesin.periksaKatalog(kat).galat).toEqual([]);
    }
  });

  it("panel Blangko Derry dan panel ABT lama menawarkan pilihan yang sama", () => {
    const bidang = Bd.bidangKeadaan(IN, Bd.lengkapiBawaan(IN, { bentuk: "permohonan-berdua" }), { P: "Pemohon", T: "Termohon" }, []);
    const bk = bidang.find((f: any) => f.kunci === "bentukKesaksian");
    expect(bk.nilai.map((n: any) => n.label)).toContain(LABEL);
    const borang = Mesin.keadaanUntukBorang(IN).find((f: any) => f.kunci === "bentukKesaksian");
    expect(borang.nilai).toContain("pesta");
  });

  it("dua pemohon: hadir di pesta, tidak tahu wali, yang menikahkan, lafaz akad, saksi nikah, mahar; tetap tahu kenal, rukun, anak, keberatan", () => {
    const h = susun(IN, { bentuk: "permohonan-berdua", bentukKesaksian: "pesta" });
    for (const ke of [0, 1]) {
      expect(jawab(h, "q-in-hadir-pb", ke)).toMatch(/pesta/);
      expect(jawab(h, "q-in-hadir-pb", ke)).toMatch(/akad/);
      for (const id of ["q-in-wali-pb", "q-in-menikahkan-pb", "q-in-ijab-kabul-pb", "q-in-saksi-nikah-pb", "q-in-mahar-pb"]) {
        const j = jawab(h, id, ke) || "";
        expect(j, id).toMatch(/tidak (?:tahu|mengetahui|dapat menerangkan)|tidak saya ketahui/);
        expect(j, id).toMatch(/akad|pesta/);
        expect(j, id).not.toMatch(/Ayah Kandung|Imam Rekaan|Saksi Satu|alat salat/);
      }
      for (const id of ["q-in-kenal-pb", "q-in-keberatan-pb", "q-in-tidak-bercerai-pb", "q-in-anak-pb", "q-in-hidup-bersama-pb", "q-in-halangan-pb"]) expect(ids(h, ke), id).toContain(id);
      for (const id of ["q-in-hadirin-pb", "q-in-wali-syarat-pb", "q-in-wali-urutan-pb", "q-in-saksi-syarat-pb", "q-in-saksi-hadir-pb", "q-in-kabul-pribadi-pb", "q-in-mahar-serah-pb", "q-in-saksi-adil-pb"])
        expect(ids(h, ke), id).not.toContain(id);
    }
    // saksi 1 dan saksi 2 tidak berbunyi sama
    for (const id of ["q-in-hadir-pb", "q-in-wali-pb", "q-in-ijab-kabul-pb", "q-in-saksi-nikah-pb", "q-in-mahar-pb"]) expect(jawab(h, id, 0), id).not.toBe(jawab(h, id, 1));
  });

  it("varian kalimat: 4 kalimat saksi 1 + 4 saksi 2, semuanya berbeda, di semua bentuk perkara dan kumulasi", () => {
    let n = 0;
    for (const kat of [IN, KM])
      for (const q of kat.pertanyaan) {
        const m = q.jawaban.melihat;
        for (const o of Array.isArray(m) ? m : [m]) {
          if (!(o.keadaan && o.keadaan.bentukKesaksian === "pesta")) continue;
          n += 1;
          expect(o.saksi1.length).toBe(4);
          expect(o.saksi2.length).toBe(4);
          expect(new Set([...o.saksi1, ...o.saksi2]).size, q.id).toBe(8);
          expect(JSON.stringify(o), q.id).not.toContain("{P}");
        }
      }
    expect(n).toBe(28); // 7 butir x 3 bentuk itsbat + 7 butir kumulasi
  });

  it("bentuk gugatan dan pasangan meninggal memakai sebutan masing-masing; kumulasi cerai+itsbat ikut", () => {
    const g = susun(IN, { bentuk: "gugatan", kehadiran: "kontradiktoir", bentukKesaksian: "pesta" }, { P: "Penggugat", T: "Tergugat" });
    expect(jawab(g, "q-in-hadir-lw")).toMatch(/pesta pe\w+ Penggugat dan Tergugat/);
    const pm = susun(IN, { bentuk: "permohonan-sendiri", bentukKesaksian: "pesta" });
    expect(jawab(pm, "q-in-wali-pm")).toMatch(/tidak/);
    const km = Mesin.susunSaksi(KM, {
      keadaan: Object.assign(Mesin.keadaanBawaan(KM, {}), { bentukKesaksian: "pesta", kumulasi: "itsbat-nikah" }),
      benih: "1/Pdt.G/2026/PA.Rkn",
      saksi: [{ pihak: "P", jenis: "melihat" }, { pihak: "P", jenis: "melihat" }],
      variabel: (k: string) => (k === "0046" ? "Penggugat" : k === "0047" ? "Tergugat" : VAR[k] || ""),
      tingkat: ["inti", "pilihan", "tambahan"],
    });
    const b = km.saksi[0].baris;
    const hadir = b.find((x: any) => x.butir === "q-in-hadir-km");
    expect(hadir && hadir.jawab).toMatch(/pesta/);
    expect(b.some((x: any) => x.butir === "q-in-hadirin-km")).toBe(false);
  });

  it("keadaan lain (langsung, istifadhah) tidak berubah: tanpa kalimat pesta, rincian akad tetap ditanyakan", () => {
    for (const bk of ["langsung", "istifadhah"]) {
      const h = susun(IN, { bentuk: "permohonan-berdua", bentukKesaksian: bk });
      expect(h.saksi[0].baris.some((x: any) => /pesta/.test(x.jawab || ""))).toBe(false);
      expect(ids(h)).toContain("q-in-wali-syarat-pb");
    }
    expect(jawab(susun(IN, { bentuk: "permohonan-berdua" }), "q-in-wali-pb")).toMatch(/Ayah Kandung Pemohon II/);
  });
});

// ─── Rekomendasi putusan ────────────────────────────────────────────────────
const s = (id: string, ke: number, baris: Array<[string, string]>): SaksiMasuk => ({ id, pihak: "P", ke, hubungan: "Tetangga", baris: baris.map(([tanya, jawab]) => ({ tanya, jawab })) });
function saksiPesta(ke: number): SaksiMasuk {
  return s(`p${ke}`, ke, [
    ["Apakah saksi kenal dengan Pemohon I dan Pemohon II?", "Saya kenal karena saya tetangga Pemohon I;"],
    ["Apakah saksi hadir sewaktu Pemohon I dengan Pemohon II menikah?", "Saya hadir di pesta pernikahan Pemohon I dan Pemohon II, tetapi saya tidak mengikuti acara akad nikahnya;"],
    ["Siapa yang menjadi wali nikah Pemohon II?", "Saya tidak tahu siapa yang menjadi wali nikahnya karena saya tidak mengikuti akad nikah;"],
    ["Siapakah yang bertindak sebagai saksi nikah?", "Saya tidak tahu siapa saksi nikahnya karena saya tidak mengikuti akad nikah;"],
    ["Apa mahar yang diberikan Pemohon I kepada Pemohon II?", "Saya tidak tahu apa maharnya karena saya tidak mengikuti akad nikah;"],
    ["Bagaimana proses pengucapan ijab dan kabul?", "Saya tidak tahu bagaimana lafaz ijab kabulnya karena saya tidak mengikuti akad nikah;"],
    ["Apakah antara Pemohon I dan Pemohon II ada hubungan darah, semenda atau sesusuan?", "Pemohon I dan Pemohon II tidak ada hubungan darah, semenda atau sesusuan;"],
    ["Pernahkah saksi mendengar ada pihak lain yang keberatan?", "Saya tidak pernah mendengar ada pihak lain yang keberatan;"],
    ["Apakah Pemohon I dengan Pemohon II pernah bercerai?", "Pemohon I dengan Pemohon II belum bercerai, keduanya hidup rukun;"],
    ["Apakah sudah dikaruniai anak?", "Telah dikaruniai dua orang anak;"],
  ]);
}
const itsbat = (o: Partial<MasukanRekomendasiPutusan> = {}): MasukanRekomendasiPutusan => ({
  jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah",
  nomorPerkara: "1/Pdt.P/2026/PA.Rkn",
  saksi: [saksiPesta(1), saksiPesta(2)],
  bukti: [{ kode: "P.1", pihak: "P", jenis: "surat", teks: "Fotokopi Kartu Tanda Penduduk atas nama Pemohon I" }],
  tanggalNikah: "2010-06-10",
  ...o,
});

describe("rekomendasi putusan itsbat: saksi hanya hadir di pesta -> blangko [01f]", () => {
  it("dua saksi hadir di pesta, tidak tahu prosesi akad, tidak ada halangan/keberatan -> dikabulkan, ragu, [01f] di depan, [01] di belakangnya", () => {
    const r = rekomendasiPutusanDariBukti(itsbat())!;
    expect(r.hasil).toBe("dikabulkan");
    expect(r.keyakinan).toBe("ragu");
    expect(r.blangko[0].berkas).toBe("[01f] [Kabul] IN Kabul (Hadir Tapi Lupa Prosesi Nikah).rtf");
    expect(r.blangko.some((b) => b.berkas === "[01] [Kabul] IN.rtf")).toBe(true);
    const u = Object.fromEntries(r.unsur.map((x) => [x.id, x]));
    expect(u.hadir.status).toBe("catatan");
    expect(u.hadir.ringkas).toMatch(/pesta/);
    expect(u.mahar).toBeUndefined(); // "tidak tahu apa maharnya" bukan keterangan mahar
    expect(u.ijab.status).toBe("belum");
    expect(r.sebabRagu.join(" ")).toMatch(/pesta/);
  });

  it("katalog -> rekomendasi: kalimat susunan katalog pilihan pesta dikenali sebagai saksi pesta", () => {
    const h = susun(IN, { bentuk: "permohonan-berdua", bentukKesaksian: "pesta" });
    const saksi = h.saksi.map((x: any, i: number) => s(`k${i}`, i + 1, x.baris.map((b: any) => [b.tanya, b.jawab] as [string, string])));
    const r = rekomendasiPutusanDariBukti(itsbat({ saksi }))!;
    expect(r.blangko[0].berkas).toBe("[01f] [Kabul] IN Kabul (Hadir Tapi Lupa Prosesi Nikah).rtf");
  });

  it("satu saksi pesta saja, ada yang keberatan, atau itsbat kontensius -> tidak memakai [01f]", () => {
    const keberatan = s("kb", 2, [...saksiPesta(2).baris.map((b) => [b.tanya, b.jawab] as [string, string]).filter(([t]) => !/keberatan/.test(t)), ["Pernahkah saksi mendengar ada pihak lain yang keberatan?", "Ada keluarga yang keberatan atas pernikahan itu;"]]);
    for (const [i, r] of [
      rekomendasiPutusanDariBukti(itsbat({ saksi: [saksiPesta(1)] }))!,
      rekomendasiPutusanDariBukti(itsbat({ saksi: [saksiPesta(1), keberatan] }))!,
      rekomendasiPutusanDariBukti(itsbat({ jenisPerkara: "Itsbat Nikah", nomorPerkara: "2/Pdt.G/2026/PA.Rkn" }))!,
    ].entries())
      expect(r.blangko.map((b) => b.berkas), `kasus ${i}`).not.toContain("[01f] [Kabul] IN Kabul (Hadir Tapi Lupa Prosesi Nikah).rtf");
  });
});

// ─── Keberatan pihak lain (keputusan pengguna 3 Nov 14.45): pola lama tidak pernah cocok ─────────────────────────────
describe("keberatan pihak lain menurut jawaban saksi: negasi menang atas kata 'ada'", () => {
  const ADA = [
    "Ada keluarga yang keberatan",
    "pernah ada yang keberatan",
    "keluarga Pemohon II keberatan",
    "Ya, ada. Orang tua Pemohon II keberatan karena belum setuju",
    "Ada, yaitu orang tua Pemohon II",
    "Pernah, mantan istri Pemohon I mempermasalahkan pernikahan itu",
    "Benar, ada pihak yang keberatan atas pernikahan tersebut",
    "pernah ada kerabat yang mempersoalkan pernikahan Pemohon I dan Pemohon II, begitulah yang saya alami",
    "Tidak ada yang keberatan, namun awalnya ibu Pemohon II sempat keberatan",
  ];
  const TIDAK = [
    "tidak ada yang keberatan",
    "tidak pernah ada yang keberatan",
    "tidak seorang pun keberatan",
    "tidak ada pihak yang keberatan atau merasa dirugikan",
    "Saya tidak pernah mendengar ada pihak lain yang keberatan;",
    "Tidak ada",
    "Tidak, keluarga kedua belah pihak tidak keberatan",
    "Keberatan dari pihak lain tidak ada",
    "Belum pernah ada orang yang mempermasalahkan pernikahan mereka",
    "Tak seorang pun keberatan",
    "Semua keluarga setuju dan tanpa ada keberatan",
    // jawaban umum katalog (tidak tahu / ragu / sebagian / mendengar) hanya menyebut pokok yang ditanya
    "saya tidak mengetahui ada tidaknya pihak yang keberatan atas pernikahan itu",
    "mengenai ada tidaknya pihak yang keberatan atas pernikahan itu ingatan saya kurang jelas dan saya ragu",
    "mengenai ada tidaknya pihak yang keberatan atas pernikahan itu saya mendengar langsung dari mulut mereka sendiri",
    "keberatan anggota keluarga atas rencana poligami tidak saya ketahui",
  ];
  it.each(ADA)("ADA: %s", (t) => expect(keberatanDiterangkan(t)).toBe(true));
  it.each(TIDAK)("TIDAK: %s", (t) => expect(keberatanDiterangkan(t)).toBe(false));

  it("semua kalimat butir keberatan katalog itsbat dan kumulasi: hanya versi 'berbeda' yang menerangkan keberatan", () => {
    for (const kat of [IN, KM])
      for (const q of kat.pertanyaan.filter((x: any) => /^q-in-keberatan-/.test(x.id)))
        for (const [jenis, v] of Object.entries(q.jawaban) as [string, any][])
          for (const o of Array.isArray(v) ? v : [v])
            for (const [daftar, kalimat] of [["saksi1", o.saksi1], ["saksi2", o.saksi2]] as const)
              for (const t of kalimat) {
                const isi = t.replace(/\{[a-z]+\}/g, "ibu saya").replace(/#\d{4}#/g, "Pemohon");
                // versi "berbeda": saksi 1 = tidak ada keberatan, saksi 2 = ada kerabat yang mempersoalkan
                const harap = jenis === "berbeda" && daftar === "saksi2";
                expect(keberatanDiterangkan(isi), `${q.id}/${jenis}/${daftar}: ${isi}`).toBe(harap);
              }
  });

  it("rekomendasi itsbat: saksi menerangkan ada keluarga yang keberatan -> unsur keberatan tidak terbukti dan ragu (dulu terbaca terbukti)", () => {
    const kb = (ke: number, j: string) => s(`kb${ke}`, ke, [["Pernahkah saksi mendengar ada pihak lain yang keberatan?", j]]);
    const dasar = rekomendasiPutusanDariBukti(itsbat())!;
    expect(dasar.unsur.find((u) => u.id === "keberatan")!.status).toBe("terbukti");
    const r = rekomendasiPutusanDariBukti(itsbat({ saksi: [saksiPesta(1), kb(2, "Ya, ada keluarga Pemohon II yang keberatan;")] }))!;
    expect(r.unsur.find((u) => u.id === "keberatan")!.status).toBe("tidak-terbukti");
    expect(r.sebabRagu).toContain("ada pihak lain yang keberatan");
  });
});
