import path from "node:path";
import { createRequire } from "node:module";
import fs from "node:fs";
import { EventEmitter } from "node:events";

import { describe, expect, it } from "vitest";

import { lupakanMesinOcr } from "@/app/api/aleta-ecourt/saksi-scan/ocr";

import {
  BATAS_BITA_LAMPIRAN,
  BATAS_HALAMAN_KUASA,
  BATAS_HALAMAN_LAMPIRAN,
  aturUlangLampiran,
  bacaLampiran,
  pengaturanLampiran,
  pindaiLampiran,
  putaranLampiran,
  skorTeks,
  type DepsLampiran,
} from "@/server/modules/aleta-ecourt/lampiran-ecourt";

/**
 * OCR-ECOURT (19 Okt 2026): isian ABT dari lampiran e-Court hasil pindai, atas teks REKAAN
 * (fixtures/lampiran-ecourt-rekaan.cjs - nama, nomor, NIK karangan). Yang diuji:
 *   pengenalan jenis halaman; urai medan; pencocokan pihak; NIK tidak tampil; isian manual menang;
 *   tanpa kata Aleta dan tanpa kode #nnnn# di teks yang akan ditulis; batas antrean OCR (satu berkas sekali,
 *   ukuran maksimal, waktu maksimal, tidak bertumpuk dengan penyapu KTP).
 */

const AKAR = path.resolve(process.cwd(), "..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Apa = any;
const L: Apa = muat(path.join(AKAR, "aleta_bot/services/lampiranEcourtService.js"));
const S: Apa = muat(path.join(AKAR, "aleta_bot/services/lampiranEcourtStoreService.js"));
const F: Apa = muat(path.join(AKAR, "manajemen_surat/src/test/fixtures/lampiran-ecourt-rekaan.cjs"));
const SEBUTAN = { lawan: "Penggugat", pelaku: "Tergugat" };

const satu = (teks: string, judul = "Dokumen Bukti") => L.bacaBerkas({ judul, halaman: [{ teks }] })[0];
const bacaanDari = (kunci: string[], judul = "Dokumen Bukti") =>
  kunci.map((k, i) => {
    const b = satu(F[k], k === "KUASA_T" ? "Surat Kuasa" : judul);
    return { ...L.tanpaRahasia(b, F.PIHAK), pihak: L.cocokkanPihak(b, F.PIHAK), fileId: `f${i}`, judul, pengunggah: "" };
  });

describe("pengenalan jenis halaman", () => {
  it("tiap jenis lampiran dikenali dari isinya, bukan dari judul e-Court 'Dokumen Bukti'", () => {
    const harap: Record<string, string> = {
      KK: "kk",
      AKTA_LAHIR: "akta_lahir",
      AKTA_KEMATIAN: "akta_kematian",
      SK_DESA: "sk_desa",
      SK_KUA_TOLAK: "sk_kua",
      KUASA_T: "surat_kuasa",
      KUASA_INSIDENTIL: "kuasa_insidentil",
      SLIP_GAJI: "slip_gaji",
      KTP: "ktp",
    };
    for (const [k, jenis] of Object.entries(harap)) expect([k, L.kenaliJenis(F[k], "Dokumen Bukti").jenis]).toEqual([k, jenis]);
  });
  it("derau OCR (halaman miring/foto) menjadi 'lain' dan tidak diurai", () => {
    expect(L.kenaliJenis(F.SAMPAH).jenis).toBe("lain");
    expect(satu(F.SAMPAH).medan).toEqual({});
  });
  it("surat kuasa yang menyebut akta cerai tidak dikenali sebagai akta cerai", () => {
    const teks = `${F.KUASA_T}\nuntuk mengambil Akta Cerai dan salinan putusan`;
    expect(L.kenaliJenis(teks).jenis).toBe("surat_kuasa");
  });
});

describe("urai medan", () => {
  it("kartu keluarga: nomor 16 angka dengan galat OCR diperbaiki, kepala keluarga, tanggal dikeluarkan", () => {
    const m = L.uraiMedan("kk", F.KK);
    expect(m).toMatchObject({ nomor: "7203011203200045", kepala: "ANDI SAPUTRA", tanggal: { iso: "2020-03-12" }, kabupaten: "Donggala" });
  });
  it("akta kelahiran: nomor LT, tanggal berhuruf, nama anak, orang tua", () => {
    const m = L.uraiMedan("akta_lahir", F.AKTA_LAHIR);
    expect(m).toMatchObject({ nomor: "7203-LT-10042018-0021", tanggalLahir: { iso: "2018-04-10" }, tanggal: { iso: "2018-04-20" }, nama: "NURUL AINI", ayah: "ANDI SAPUTRA", ibu: "SITI RAHMAWATI" });
  });
  it("akta kematian: tanggal meninggal dari angka berhuruf", () => {
    expect(L.angkaKata("DUA RIBU DUA PULUH LIMA")).toBe(2025);
    expect(L.angkaKata("SERIBU SEMBILAN RATUS LIMA PULUH")).toBe(1950);
    expect(L.uraiMedan("akta_kematian", F.AKTA_KEMATIAN)).toMatchObject({ nomor: "7203-KM-19112025-0004", tanggalMeninggal: { iso: "2025-11-19" } });
  });
  it("surat keterangan desa: nomor (bulan Romawi galat OCR diperbaiki), tanggal kaki surat ejaan lama, penerbit, perihal", () => {
    expect(L.uraiMedan("sk_desa", F.SK_DESA)).toMatchObject({ nomor: "470/12/KB-B/II/2026", tanggal: { iso: "2026-02-05" }, penerbit: "Lurah Kabonga Besar", perihal: "domisili" });
  });
  it("surat kuasa: tanggal kaki, kantor advokat, kedudukan pihak; kuasa insidentil: penerima dan hubungan", () => {
    expect(L.uraiMedan("surat_kuasa", F.KUASA_T)).toMatchObject({ tanggal: { iso: "2026-06-03" }, kantor: "Kantor Hukum Rusdi Hamzah & Rekan", selaku: "Tergugat" });
    expect(L.uraiMedan("kuasa_insidentil", F.KUASA_INSIDENTIL)).toMatchObject({ penerima: "HAMDAN bin LA ODE HASAN", hubungan: "saudara kandung" });
  });
  it("tanggal Indonesia: bulan salah eja OCR dan bentuk angka", () => {
    expect(L.uraiTanggal("12 FEARUARI 2024")).toMatchObject({ iso: "2024-02-12" });
    expect(L.uraiTanggal("3 Nopember 2019")).toMatchObject({ iso: "2019-11-03" });
    expect(L.uraiTanggal("31-02-2020")).toBeNull();
  });
});

describe("pencocokan pihak", () => {
  it("KK pihak perkara cocok lewat NIK anggota; KK orang lain tidak cocok dan tidak menghasilkan usulan/kalimat", () => {
    expect(L.cocokkanPihak(satu(F.KK), F.PIHAK).map((c: Apa) => c.cabang).sort()).toEqual([1, 2]);
    expect(L.cocokkanPihak(satu(F.KK_ORANG_LAIN), F.PIHAK)).toEqual([]);
    const u = L.susunUsulan({ bacaan: bacaanDari(["KK_ORANG_LAIN"]), sebutan: SEBUTAN });
    expect(u.usulan).toEqual([]);
    expect(u.kalimat).toEqual([]);
  });
  it("surat kuasa Tergugat -> 0185 dan 0157; kuasa insidentil Penggugat -> 8894/8895; slip gaji Tergugat -> 5271", () => {
    const u = L.susunUsulan({ bacaan: bacaanDari(["KUASA_T", "KUASA_INSIDENTIL", "SLIP_GAJI"]), sebutan: SEBUTAN });
    const per = Object.fromEntries(u.usulan.map((x: Apa) => [x.kode, x]));
    expect(per["0185"]).toMatchObject({ nilai: "2026-06-03", tipe: "tanggal", keyakinan: "ragu", jagaIsianLama: true });
    expect(per["0157"].nilai).toBe("Kantor Hukum Rusdi Hamzah & Rekan");
    expect(per["8894"].nilai).toBe("HAMDAN bin LA ODE HASAN");
    expect(per["8895"].nilai).toBe("saudara kandung");
    expect(per["5271"].nilai).toBe("Rp4.150.000,00");
    expect(per["0184"]).toBeUndefined();
  });
  it("nomor 'KK' yang ternyata NIK pihak dibuang", () => {
    const b = satu(`KARTU KELUARGA\nNo. ${F.NIK_ISTRI}\nNama Kepala Keluarga : ANDI SAPUTRA\nDikeluarkan Tanggal : 12-03-2020`);
    expect(L.tanpaRahasia(b, F.PIHAK).medan.nomor).toBeUndefined();
  });
});

describe("NIK tidak tampil", () => {
  it("bacaan yang disimpan dan semua keluaran usulan/kalimat/catatan tidak memuat NIK", () => {
    const bacaan = bacaanDari(["KK", "AKTA_LAHIR", "SK_DESA", "KUASA_T", "KUASA_INSIDENTIL", "SLIP_GAJI", "KTP"]);
    const u = L.susunUsulan({ bacaan, sebutan: SEBUTAN, jenisPerkara: "Asal Usul Anak" });
    const semua = JSON.stringify({ bacaan, u });
    for (const nik of [F.NIK_SUAMI, F.NIK_ISTRI, F.NIK_ORANG_LAIN]) expect(semua).not.toContain(nik);
    // Calon NIK hanya ada di bacaan mentah (memori) lalu dibuang sebelum disimpan.
    expect(satu(F.SK_DESA)._nik).toContain(F.NIK_ISTRI);
    expect(L.tanpaRahasia(satu(F.SK_DESA))).not.toHaveProperty("_nik");
    expect(L.buangNik(`NIK ${F.NIK_ISTRI}`)).not.toContain(F.NIK_ISTRI);
  });
  it("baris yang disimpan bot (barisMedan) tidak memuat NIK maupun teks halaman", () => {
    const baris = S.barisMedan({ judul: "Dokumen Bukti", halaman: [{ teks: F.KK }, { teks: F.SK_DESA }, { teks: F.KTP }], pihak: F.PIHAK });
    const json = JSON.stringify(baris);
    expect(baris.map((b: Apa) => b.jenis)).toEqual(["kk", "sk_desa"]);
    for (const nik of [F.NIK_SUAMI, F.NIK_ISTRI]) expect(json).not.toContain(nik);
    expect(json).not.toContain("Demikian Surat Keterangan");
  });
});

describe("isian manual menang", () => {
  it("isian petugas yang sudah ada tidak diusulkan ulang; titik-titik/garis bawah dianggap kosong", () => {
    const bacaan = bacaanDari(["KUASA_T"]);
    const u = L.susunUsulan({ bacaan, sebutan: SEBUTAN, isianLama: { "0185": "2026-06-01", "0157": "...." } });
    expect(u.usulan.map((x: Apa) => x.kode)).toEqual(["0157"]);
    expect(u.catatan.join(" ")).toMatch(/sudah diisi petugas/);
    expect(u.usulan.every((x: Apa) => x.jagaIsianLama === true)).toBe(true);
  });
  it("semua usulan 'ragu' sampai terukur (tidak ada medan yang memenuhi ambang 95% / 20 perkara)", () => {
    const u = L.susunUsulan({ bacaan: bacaanDari(["KUASA_T", "KUASA_INSIDENTIL", "SLIP_GAJI", "AKTA_LAHIR"]), sebutan: SEBUTAN, jenisPerkara: "Asal Usul Anak" });
    expect(u.usulan.length).toBeGreaterThan(0);
    expect(u.usulan.every((x: Apa) => x.keyakinan === "ragu")).toBe(true);
    const ukuran = JSON.parse(fs.readFileSync(path.join(AKAR, "docs/isi-sipp-abt/UKURAN-OCR-ECOURT.json"), "utf8"));
    for (const [kunci, t] of Object.entries(L.TINGKAT_TERUKUR)) {
      if (t !== "cukup") continue;
      const u2 = ukuran.medan[kunci];
      expect(u2 && u2.perkara >= 20 && u2.persen >= 95).toBe(true);
    }
  });
});

describe("tanpa Aleta, tanpa kode tampil", () => {
  it("nilai usulan dan kalimat salin tanpa kata Aleta dan tanpa #nnnn#", () => {
    const u = L.susunUsulan({ bacaan: bacaanDari(["KK", "AKTA_LAHIR", "AKTA_KEMATIAN", "SK_DESA", "KUASA_T", "KUASA_INSIDENTIL", "SLIP_GAJI"]), sebutan: SEBUTAN, jenisPerkara: "Asal Usul Anak" });
    const tulis = [...u.usulan.map((x: Apa) => `${x.nilai} ${x.nama} ${x.catatan}`), ...u.kalimat.map((k: Apa) => `${k.teks} ${k.judul}`)].join("\n");
    expect(tulis).not.toMatch(/aleta/i);
    expect(tulis).not.toMatch(/#\d{4}#/);
    expect(tulis).not.toMatch(/\b(?:kk|akta_lahir|sk_desa|surat_kuasa|undefined|null)\b/);
  });
});

describe("batas antrean OCR", () => {
  const deps = (o: Partial<DepsLampiran> = {}): DepsLampiran & { dikirim: Apa[]; dibaca: string[] } => {
    const dikirim: Apa[] = [];
    const dibaca: string[] = [];
    return {
      antrian: async () => ({
        versi: 1,
        berkas: [
          { fileId: "a", format: "pdf", ukuran: 1000, nomorPerkara: "1/Pdt.G/2026/PA.Xyz", judul: "Dokumen Bukti" },
          { fileId: "b", format: "pdf", ukuran: BATAS_BITA_LAMPIRAN + 1, nomorPerkara: "2/Pdt.G/2026/PA.Xyz", judul: "Dokumen Bukti" },
          { fileId: "c", format: "pdf", ukuran: 1000, nomorPerkara: "3/Pdt.G/2026/PA.Xyz", judul: "Surat Kuasa" },
        ],
      }),
      ambil: async (id: string) => (dibaca.push(id), Buffer.from("%PDF-1.4 rekaan")),
      kirim: async (h: Apa[]) => (dikirim.push(...h), true),
      baca: async () => ({ status: "terbaca", sebab: "", halaman: [{ teks: F.SK_DESA, sumber: "ocr" }], halamanOcr: 1 }),
      sekarang: () => Date.now(),
      ocrLainSibuk: () => false,
      dikirim,
      dibaca,
      ...o,
    } as Apa;
  };
  it("bawaan satu berkas per putaran; paling banyak tiga; teks dihapus dari memori sesudah dikirim", async () => {
    const d = deps();
    const r = await pindaiLampiran([], d);
    expect(r.dibaca).toBe(1);
    expect(d.dibaca).toEqual(["a"]);
    expect(d.dikirim[0].halaman[0].teks).toBe("");
    const d3 = deps();
    await pindaiLampiran([], d3, { batas: 10 });
    expect(d3.dikirim.length).toBe(3);
  });
  it("berkas melebihi batas ukuran tidak diambil maupun dibaca", async () => {
    const d = deps();
    await pindaiLampiran([], d, { batas: 3 });
    expect(d.dibaca).not.toContain("b");
    expect(d.dikirim.find((h: Apa) => h.fileId === "b")).toMatchObject({ status: "tidak_terbaca", sebab: "berkas_terlalu_besar" });
  });
  it("berhenti bila waktu putaran habis, dan tidak berjalan selama penyapu KTP membaca", async () => {
    let jam = 0;
    const d = deps({ sekarang: () => jam, baca: async () => ((jam += 300_000), { status: "terbaca", sebab: "", halaman: [], halamanOcr: 0 }) });
    const r = await pindaiLampiran([], d, { batas: 3, batasMs: 200_000 });
    expect(r.dibaca).toBe(1);
    const sibuk = deps({ ocrLainSibuk: () => true });
    aturUlangLampiran();
    expect(await putaranLampiran([], sibuk)).toBeNull();
    expect(sibuk.dibaca).toEqual([]);
  });
  it("satu putaran sekaligus per proses (yang kedua ditolak selama yang pertama berjalan)", async () => {
    aturUlangLampiran();
    let lepas: () => void = () => undefined;
    const tahan = new Promise<void>((ok) => (lepas = ok));
    const d = deps({ baca: async () => (await tahan, { status: "terbaca", sebab: "", halaman: [], halamanOcr: 0 }) });
    const pertama = putaranLampiran([], d);
    await new Promise((ok) => setTimeout(ok, 5));
    expect(await putaranLampiran([], d)).toBeNull();
    lepas();
    expect(await pertama).toMatchObject({ dibaca: 1 });
  });
  it("pengaturan env: mati dengan 0; batas 1-3; jeda paling cepat 60 detik", () => {
    expect(pengaturanLampiran({ ALETA_LAMPIRAN_LATAR: "0" } as Apa).aktif).toBe(false);
    expect(pengaturanLampiran({ ALETA_LAMPIRAN_BATAS: "9", ALETA_LAMPIRAN_JEDA_MS: "1000" } as Apa)).toMatchObject({ aktif: true, batas: 3, jedaMs: 60_000 });
    expect(pengaturanLampiran({} as Apa)).toMatchObject({ batas: 1, jedaMs: 180_000 });
    expect(BATAS_HALAMAN_LAMPIRAN).toBe(12);
    expect(BATAS_HALAMAN_KUASA).toBeLessThan(BATAS_HALAMAN_LAMPIRAN);
  });
  it("bacaLampiran: halaman miring dicek arahnya (OSD) dan dibaca ulang setelah diputar; tesseract dimatikan bila lewat batas", async () => {
    const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    const panggilan: string[][] = [];
    const palsu = (macet = false) =>
      ((bin: string, args: string[]) => {
        panggilan.push(args);
        const p = new EventEmitter() as Apa;
        p.stdout = new EventEmitter();
        p.stderr = new EventEmitter();
        p.kill = () => setImmediate(() => p.emit("close", null));
        p.stdin = {
          on: () => undefined,
          end: (masuk?: Buffer) =>
            setImmediate(() => {
              if (macet && !args.includes("--version")) return; // tidak pernah selesai -> habis waktu
              const isi = String(masuk || "");
              const keluar = args.includes("--version")
                ? "tesseract 5.3.0"
                : args.includes("0") && args.includes("--psm") && args[args.indexOf("--psm") + 1] === "0"
                  ? "Rotate: 90\nOrientation confidence: 6.2\n"
                  : isi === "PUTARputar90"
                    ? F.SK_DESA
                    : F.SAMPAH;
              p.stdout.emit("data", Buffer.from(keluar));
              p.emit("close", 0);
            }),
        };
        return p;
      }) as Apa;
    const pembantu = (async (mode: string) =>
      mode === "gambar" ? new Map([["abu", Buffer.from("ABU")]]) : mode.startsWith("putar") ? new Map([["putar", Buffer.from(`PUTAR${mode}`)]]) : null) as Apa;
    lupakanMesinOcr();
    const r = await bacaLampiran(PNG, { spawn: palsu(), pembantu });
    expect(r.status).toBe("terbaca");
    expect(r.halaman[0].teks).toContain("SURAT KETERANGAN DOMISILI");
    expect(panggilan.some((a) => a[a.indexOf("--psm") + 1] === "0")).toBe(true);
    // Lintasan OCR yang macet dimatikan pada batasnya - berkas berakhir "habis waktu", bukan menggantung.
    lupakanMesinOcr();
    const t0 = Date.now();
    const macet = await bacaLampiran(PNG, { spawn: palsu(true), pembantu, batasMs: 4000 });
    expect(macet).toMatchObject({ status: "tidak_terbaca" });
    expect(Date.now() - t0).toBeLessThan(8000);
    lupakanMesinOcr();
  });
  it("bacaLampiran: berkas bukan PDF/gambar ditolak tanpa OCR; skorTeks membedakan teks wajar dari derau", async () => {
    expect(await bacaLampiran(Buffer.from("bukan berkas"))).toMatchObject({ status: "tidak_terbaca", sebab: "format_tidak_dikenal" });
    expect(skorTeks(F.SK_DESA)).toBeGreaterThan(25);
    expect(skorTeks(F.SAMPAH)).toBeLessThan(10);
  });
});
