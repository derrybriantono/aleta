// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  hurufDikutip,
  keadaanAmar,
  periksaDasarHukum,
  periksaKonsistensi,
  samarkanAlinea,
  susunRaporAdvance,
  type PutusanSerupaMasuk,
} from "@/lib/putusan-advance";

/**
 * F4.4 Putusan Advance (17 Okt 2026): pemeriksa draf putusan Blangko Derry.
 * Aturan diukur atas 2.305 putusan sipp_donggala (lihat kepala putusan-advance.ts);
 * uji ini menjaga bentuk aturannya, termasuk salah tangkap yang ditemukan saat ukur.
 */

const PERT_F = [
  "Menimbang, bahwa maksud dan tujuan gugatan Penggugat adalah sebagaimana diuraikan di atas;",
  "Menimbang, bahwa Tergugat tidak pernah datang menghadap di persidangan walaupun telah dipanggil secara resmi dan patut;",
  "Menimbang, bahwa Majelis Hakim telah menasihati Penggugat agar rukun kembali dengan Tergugat, tetapi tidak berhasil;",
  "Menimbang, bahwa berdasarkan keterangan dua orang saksi dari keluarga Penggugat, antara Penggugat dan Tergugat terus-menerus terjadi perselisihan dan pertengkaran, telah berpisah tempat tinggal selama satu tahun dan tidak ada harapan akan hidup rukun lagi, sehingga memenuhi Pasal 19 huruf f Peraturan Pemerintah Nomor 9 Tahun 1975 jo. Pasal 116 huruf f Kompilasi Hukum Islam;",
  "Menimbang, bahwa oleh karena itu gugatan Penggugat patut dikabulkan dengan verstek;",
  "Menimbang, bahwa berdasarkan Pasal 89 ayat (1) Undang-Undang Nomor 7 Tahun 1989 sebagaimana telah diubah dengan Undang-Undang Nomor 3 Tahun 2006 dan Undang-Undang Nomor 50 Tahun 2009, biaya perkara dibebankan kepada Penggugat;",
].join("\n");

const AMAR_CG = [
  "1. Menyatakan Tergugat yang telah dipanggil secara resmi dan patut tidak hadir;",
  "2. Mengabulkan gugatan Penggugat dengan verstek;",
  "3. Menjatuhkan talak satu ba'in sughra Tergugat terhadap Penggugat;",
  "4. Membebankan kepada Penggugat untuk membayar biaya perkara sejumlah Rp300.000,00;",
].join("\n");

const DASAR = { nomorPerkara: "123/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", dudukPerkara: "Bahwa Penggugat dan Tergugat menikah ...", pertimbangan: PERT_F, amar: AMAR_CG };

function serupa(nomor: string, pert: string, nama: string[] = []): PutusanSerupaMasuk {
  return { nomor, tanggalPutusan: "2026-05-01", tanggalBht: "2026-05-20", pertimbangan: pert, amar: AMAR_CG, nama };
}

describe("huruf alasan dan unsur", () => {
  it("membaca huruf Pasal 19 dan Pasal 116, termasuk bentuk berkurung dan berangkai", () => {
    expect(hurufDikutip("Pasal 19 huruf (b) dan (f) PP 9/1975 jo. Pasal 116 huruf b dan f KHI")).toMatchObject({ pp19: "BF", khi116: "BF", gabung: "BF" });
    expect(hurufDikutip("Pasal 116 huruf a, b dan f Kompilasi Hukum Islam").khi116).toBe("ABF");
    // "dan" sesudah huruf bukan huruf d.
    expect(hurufDikutip("Pasal 19 huruf f dan Pasal 39 ayat (2)").pp19).toBe("F");
    expect(hurufDikutip(PERT_F).gabung).toBe("F");
  });

  it("draf huruf f yang lengkap tidak mendapat perhatian", () => {
    const r = susunRaporAdvance({ ...DASAR, hurufIsian: "F", keteranganSaksi: ["Penggugat dan Tergugat sering bertengkar, sudah pisah rumah, keluarga sudah merukunkan tidak berhasil"] });
    expect(r.temuan.filter((t) => t.tingkat === "perhatian")).toEqual([]);
    const f = r.alasan.find((a) => a.huruf === "F")!;
    expect(f.unsur.every((u) => u.dipertimbangkan)).toBe(true);
    expect(f.unsur.find((u) => u.kode === "f-pisah")!.saksi).toBe(true);
  });

  it("huruf yang didalilkan (#8503#) tetapi tidak dipertimbangkan = perhatian, diberi langkah pertimbangan", () => {
    const r = susunRaporAdvance({ ...DASAR, hurufIsian: "AF·zina" });
    const t = r.temuan.find((x) => x.kode === "alasan-tidak-dipertimbangkan")!;
    expect(t).toMatchObject({ tingkat: "perhatian", langkah: "pertimbangan" });
    expect(t.judul).toMatch(/huruf a/);
    // Unsur huruf a ikut diperiksa dan belum dibahas.
    expect(r.alasan.find((a) => a.huruf === "A")!.unsur.some((u) => !u.dipertimbangkan)).toBe(true);
  });

  it("unsur yang hilang: tingkat menurut kebiasaan hakim sendiri bila pembanding >= 5", () => {
    const tanpaPisah = PERT_F.replace("telah berpisah tempat tinggal selama satu tahun dan ", "");
    // Tanpa pembanding: ambang bawaan (pisah 99%) -> perhatian.
    const r1 = susunRaporAdvance({ ...DASAR, pertimbangan: tanpaPisah, hurufIsian: "F" });
    expect(r1.temuan.find((t) => t.kode === "unsur-f-pisah")!.tingkat).toBe("perhatian");
    // Hakim ini justru jarang membahasnya (1 dari 5) -> catatan... tetapi < 50% tidak dijadikan temuan.
    const jarang = [serupa("1/Pdt.G/2026/PA.Dgl", PERT_F), ...[2, 3, 4, 5].map((n) => serupa(`${n}/Pdt.G/2026/PA.Dgl`, tanpaPisah))];
    const r2 = susunRaporAdvance({ ...DASAR, pertimbangan: tanpaPisah, hurufIsian: "F", serupa: jarang });
    expect(r2.temuan.find((t) => t.kode === "unsur-f-pisah")).toBeUndefined();
    const unsur = r2.alasan[0].unsur.find((u) => u.kode === "f-pisah")!;
    expect(unsur.lazim).toEqual({ ada: 1, dari: 5 });
    // Contoh alinea dari putusan yang membahasnya, berlabel nomornya.
    expect(unsur.contoh[0]).toMatchObject({ sumber: "putusan", label: expect.stringContaining("1/Pdt.G/2026/PA.Dgl") });
  });

  it("perkara bukan cerai tanpa katalog unsur: disebut di 'tidak diperiksa' (17 Okt: jenis lain lihat putusan-advance-jenis-17okt)", () => {
    const r = susunRaporAdvance({ ...DASAR, nomorPerkara: "5/Pdt.P/2026/PA.Dgl", jenisPerkara: "Lain-Lain", amar: "Mengabulkan permohonan Para Pemohon;" });
    expect(r.alasan).toEqual([]);
    expect(r.tidakDiperiksa.join(" ")).toMatch(/Unsur per jenis belum tersedia/);
  });
});

describe("dasar hukum", () => {
  it("huruf Pasal 19 berbeda dengan Pasal 116 = perhatian", () => {
    const t = periksaDasarHukum("Menimbang, bahwa memenuhi Pasal 19 huruf f PP Nomor 9 Tahun 1975 jo. Pasal 116 huruf b KHI;", "");
    expect(t.map((x) => x.kode)).toContain("huruf-19-116");
  });

  it("tahun yang tidak cocok dengan nomornya (temuan nyata: UU 50 Tahun 2019)", () => {
    const t = periksaDasarHukum("", "Undang-Undang Nomor 7 Tahun 1989 ... Undang-Undang Nomor 50 Tahun 2019");
    expect(t.find((x) => x.kode === "tahun-peraturan")!.rinci).toMatch(/2009/);
  });

  it("nomor sama tahun berbeda yang sah tidak ditandai (PERMA 1/2008 & 1/2016, UU 1/1974 & 1/2023, UU 23/2002 & 23/2004)", () => {
    const t = periksaDasarHukum(
      "",
      "PERMA Nomor 1 Tahun 2008 diubah PERMA Nomor 1 Tahun 2016; Undang-Undang Nomor 1 Tahun 1974; Undang-Undang Nomor 1 Tahun 2023; Undang-Undang Nomor 23 Tahun 2002; Undang-Undang Nomor 23 Tahun 2004; Undang-Undang Nomor 50 Tahun 2009"
    );
    expect(t).toEqual([]);
  });

  it("UU 7/1989 tanpa perubahan kedua hanya catatan", () => {
    const t = periksaDasarHukum("", "Pasal 89 Undang-Undang Nomor 7 Tahun 1989");
    expect(t).toEqual([expect.objectContaining({ kode: "uu7-tanpa-perubahan", tingkat: "catatan" })]);
  });

  it("kutipan yang lazim dipakai hakim (>= 80% dari >= 5 pembanding) tetapi tidak ada di draf = catatan", () => {
    const denganP39 = `${PERT_F}\nMenimbang, bahwa sesuai Pasal 39 ayat (2) Undang-Undang Nomor 1 Tahun 1974 perceraian hanya dapat dilakukan dengan cukup alasan;`;
    const kand = [1, 2, 3, 4, 5].map((n) => serupa(`${n}/Pdt.G/2026/PA.Dgl`, denganP39));
    const r = susunRaporAdvance({ ...DASAR, hurufIsian: "F", serupa: kand });
    const t = r.temuan.find((x) => x.kode === "kutipan-lazim")!;
    expect(t.tingkat).toBe("catatan");
    expect(t.judul).toMatch(/Pasal 39/);
    expect(t.rinci).toMatch(/5 dari 5/);
  });
});

describe("konsistensi pertimbangan - amar", () => {
  it("amar pokok = kata kerja pertama (rekonvensi 'menolak selebihnya' bukan ditolak)", () => {
    expect(keadaanAmar("Dalam Konvensi: Mengabulkan permohonan Pemohon; Dalam Rekonvensi: Menolak gugatan Penggugat Rekonvensi selebihnya")).toBe("dikabulkan");
    expect(keadaanAmar("Mengabulkan permohonan pencabutan perkara Nomor 56/Pdt.G/2025/PA.Dgl dari Penggugat")).toBe("dicabut");
    expect(keadaanAmar("Menyatakan gugatan Penggugat tidak dapat diterima")).toBe("tidakDiterima");
  });

  it("cerai gugat dengan amar izin talak raj'i (temuan nyata 390/Pdt.G/2025) = perhatian", () => {
    const amar = "Mengabulkan gugatan Penggugat secara verstek; Memberi izin kepada Penggugat untuk menjatuhkan talak satu raj'i terhadap Tergugat;";
    const t = periksaKonsistensi({ jenis: "cg", dudukPerkara: "", pertimbangan: PERT_F, amar });
    expect(t.map((x) => x.kode)).toContain("talak-cg");
  });

  it("cerai talak ba'in: perhatian, kecuali pertimbangan menyebut qabla dukhul", () => {
    const amar = "Mengabulkan permohonan Pemohon; Menjatuhkan talak satu ba'in sughra Termohon terhadap Pemohon;";
    const pert = "Menimbang, bahwa permohonan Pemohon dapat dikabulkan;";
    expect(periksaKonsistensi({ jenis: "ct", dudukPerkara: "", pertimbangan: pert, amar }).map((x) => x.kode)).toContain("talak-ct");
    const qabla = `${pert}\nMenimbang, bahwa Pemohon dan Termohon belum pernah berhubungan sebagai suami isteri (qabla dukhul);`;
    expect(periksaKonsistensi({ jenis: "ct", dudukPerkara: "", pertimbangan: qabla, amar }).map((x) => x.kode)).not.toContain("talak-ct");
  });

  it("biaya dibebankan ke pihak berbeda, dan nafkah iddah diamarkan tanpa pertimbangan", () => {
    const amar = `${AMAR_CG.replace("Membebankan kepada Penggugat", "Membebankan kepada Pemohon")}\n5. Menghukum Tergugat membayar nafkah iddah Rp3.000.000,00;`;
    const kode = periksaKonsistensi({ jenis: "cg", dudukPerkara: "", pertimbangan: PERT_F, amar }).map((x) => x.kode);
    expect(kode).toEqual(expect.arrayContaining(["biaya-pihak", "tambahan-iddah"]));
  });

  it("kesimpulan pertimbangan bertentangan dengan amar", () => {
    const t = periksaKonsistensi({ jenis: "cg", dudukPerkara: "", pertimbangan: "Menimbang, bahwa gugatan Penggugat harus ditolak;", amar: "Mengabulkan gugatan Penggugat;" });
    expect(t.find((x) => x.kode === "kesimpulan-amar")).toMatchObject({ tingkat: "perhatian", langkah: "amar" });
  });

  it("tidak pernah ada tingkat 'hentikan' - alat bantu, bukan penahan", () => {
    const r = susunRaporAdvance({ ...DASAR, pertimbangan: "Menimbang, bahwa gugatan harus ditolak;", amar: "Memberi izin kepada Penggugat menjatuhkan talak satu raj'i; nafkah iddah;", hurufIsian: "ABCDEFGH" });
    expect(new Set(r.temuan.map((t) => t.tingkat))).toEqual(new Set(["perhatian", "catatan"]));
  });
});

describe("contoh alinea disamarkan", () => {
  it("nama pihak dan nasab diganti; alinea yang masih bernama tidak ditawarkan", () => {
    expect(samarkanAlinea("Menimbang, bahwa saksi Ahmad Yani bin Lamusu menerangkan Penggugat Siti Aminah binti Usman pergi", ["Siti Aminah binti Usman", "Ahmad Yani bin Lamusu"])).toBe(
      "Menimbang, bahwa saksi [nama] menerangkan Penggugat [nama] pergi"
    );
    // Nama di depan nasab ikut disamarkan, kata peran di depannya tetap.
    expect(samarkanAlinea("Menimbang, bahwa Rahmawati binti Lahiya menerangkan", [])).toBe("Menimbang, bahwa [nama] menerangkan");
    expect(samarkanAlinea("bahwa Saksi Penggugat AHMAD KADIR BIN TEDDY hadir", [])).toBe("bahwa Saksi Penggugat [nama] hadir");
    // Nama pihak dari SIPP masih tersisa sebagian (nama depan saja) -> ditolak.
    expect(samarkanAlinea("Menimbang, bahwa Sulastri pergi meninggalkan rumah", ["Sulastri Andini"])).toBeNull();
  });

  it("rapor tidak memuat nama dari daftar nama pembanding", () => {
    const pertNama = PERT_F.replace("keterangan dua orang saksi dari keluarga Penggugat", "keterangan saksi Ahmad Yani bin Lamusu, keluarga Penggugat Siti Aminah binti Usman");
    const tanpaKeluarga = PERT_F.replace("dua orang saksi dari keluarga Penggugat", "para saksi");
    const kand = [1, 2, 3, 4, 5].map((n) => serupa(`${n}/Pdt.G/2026/PA.Dgl`, pertNama, ["Siti Aminah binti Usman", "Ahmad Yani bin Lamusu"]));
    const r = susunRaporAdvance({ ...DASAR, pertimbangan: tanpaKeluarga, hurufIsian: "F", serupa: kand });
    const json = JSON.stringify(r);
    expect(json).not.toMatch(/Ahmad|Yani|Lamusu|Aminah|Usman/);
    const keluarga = r.alasan[0].unsur.find((u) => u.kode === "f-keluarga")!;
    expect(keluarga.contoh.length).toBeGreaterThan(0);
    expect(keluarga.contoh[0].teks).toContain("[nama]");
  });
});

// ── Rute ────────────────────────────────────────────────────────────────────
const keadaan = vi.hoisted(() => ({ serupa: null as unknown, galat: "", butir: [] as unknown[] }));
vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
// 17 Okt: hak = hakim/konseptor/Admin - pengguna uji seorang hakim.
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({ pastikanKapabilitas: async () => ({ id: "usr_uji", name: "Hakim Uji", roleId: "hakim" }) }));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (galat: unknown) => {
    throw galat;
  },
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  getGatewaySippPutusanSerupa: async () => (keadaan.galat ? { ok: false, error: keadaan.galat } : { ok: true, data: keadaan.serupa }),
}));
vi.mock("@/server/modules/aleta-ecourt/pustaka-pertimbangan", () => ({ cariButir: async () => keadaan.butir }));

function rtfDari(teks: string): string {
  const isi = teks
    .split("\n")
    .map((p) => `{${p.replace(/\\/g, "\\\\").replace(/[{}]/g, (c) => `\\${c}`)}}\\par`)
    .join("\n");
  return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Times New Roman;}}\n${isi}\n}`;
}

const NASKAH = ["P U T U S A N", "Nomor 123/Pdt.G/2026/PA.Dgl", "DUDUK PERKARA", "Bahwa Penggugat dan Tergugat menikah pada tahun 2015;", "PERTIMBANGAN HUKUM", PERT_F, "MENGADILI", AMAR_CG, "Demikian diputuskan dalam rapat musyawarah Majelis Hakim"].join("\n");

async function panggil(badan: Record<string, unknown>) {
  const mod = await import("@/app/api/aleta-ecourt/putusan/advance/route");
  const p = new Request("http://uji.local/aleta/api/aleta-ecourt/putusan/advance", { method: "POST", body: JSON.stringify(badan), headers: { "Content-Type": "application/json" } });
  const jawab = await mod.POST(p as unknown as Parameters<typeof mod.POST>[0]);
  return ((await jawab.json()) as { data: Record<string, any> }).data;
}

describe("rute /putusan/advance", () => {
  beforeEach(() => {
    keadaan.galat = "";
    keadaan.butir = [{ id: "b1", teks: "Menimbang, bahwa keterangan keluarga dan orang dekat telah didengar sesuai Pasal 76 ayat (1) UU 7/1989;", labelAlasan: ["F"], jumlahPemakaian: 9 }];
    keadaan.serupa = { ok: true, perkara: { nomor: "123/Pdt.G/2026/PA.Dgl", jenis: "Cerai Gugat" }, hakim: { nama: "Hakim X" }, kandidat: [1, 2, 3].map((n) => ({ ...serupa(`${n}/Pdt.G/2025/PA.Dgl`, PERT_F, ["Siti Aminah binti Usman"]), verstek: true })) };
  });

  it("RTF Blangko Derry -> rapor; bagian terpecah, jenis dari SIPP, nama pembanding tidak dikirim", async () => {
    const d = await panggil({ rtfBase64: Buffer.from(rtfDari(NASKAH), "latin1").toString("base64"), nomorPerkara: "123/Pdt.G/2026/PA.Dgl", huruf: "F" });
    expect(d.ok).toBe(true);
    expect(d.rapor.jenis).toBe("cg");
    expect(d.rapor.huruf).toMatchObject({ didalilkan: "F", dikutip: "F" });
    expect(d.rapor.jumlahSerupa).toBe(3);
    expect(d.rapor.tidakDiperiksa.join(" ")).not.toMatch(/tidak ditemukan di naskah/);
    expect(JSON.stringify(d)).not.toMatch(/Aminah|Usman|Hakim X/);
  });

  it("SIPP tidak terbaca: rapor tetap jadi dengan catatan pembanding", async () => {
    keadaan.galat = "aleta_bot tidak dapat dihubungi";
    const d = await panggil({ teks: NASKAH, nomorPerkara: "123/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat" });
    expect(d.ok).toBe(true);
    expect(d.rapor.tidakDiperiksa.join(" ")).toMatch(/Putusan serupa dari SIPP tidak terbaca/);
  });

  it("naskah kosong / bukan RTF ditolak tanpa menulis apa pun", async () => {
    expect((await panggil({ nomorPerkara: "123/Pdt.G/2026/PA.Dgl" })).ok).toBe(false);
    expect((await panggil({ rtfBase64: Buffer.from("%PDF-1.4").toString("base64"), nomorPerkara: "123/Pdt.G/2026/PA.Dgl" })).ok).toBe(false);
  });
});

// ── Bot: putusanSerupaService ───────────────────────────────────────────────
describe("bot putusanSerupaService (SELECT saja)", () => {
  const akar = path.resolve(process.cwd(), "..");
  const req = createRequire(path.join(akar, "aleta_bot/package.json"));
  const layanan = req(path.join(akar, "aleta_bot/services/putusanSerupaService.js"));

  it("hakim ketua/tunggal yang sama, jenis sama, hanya BHT; nama ikut untuk disamarkan", async () => {
    const sql: string[] = [];
    layanan._aturKueri(async (q: string, nilai: unknown[]) => {
      sql.push(q);
      if (/FROM perkara WHERE nomor_perkara/.test(q)) return [{ perkara_id: 9, nomor_perkara: "123/Pdt.G/2026/PA.Dgl", jenis_perkara_id: 346, jenis_perkara_nama: "Cerai Gugat" }];
      if (/FROM perkara_hakim_pn/.test(q) && !/EXISTS/.test(q)) return [{ hakim_id: 7, hakim_nama: "Hakim X" }];
      if (/pertimbangan_hukum/.test(q)) {
        expect(nilai).toEqual([346, 9, 7]);
        return [{ perkara_id: 5, nomor_perkara: "5/Pdt.G/2026/PA.Dgl", tanggal_putusan: "2026-03-01", tanggal_bht: "2026-03-20", putusan_verstek: "Y", amar_putusan: "<p>Mengabulkan</p>", pertimbangan_hukum: "<p>Menimbang</p>" }];
      }
      if (/perkara_pihak/.test(q)) return [{ perkara_id: 5, nama: "Siti Aminah binti Usman" }];
      return [];
    });
    const h = await layanan.putusanSerupa("123/Pdt.G/2026/PA.Dgl");
    expect(h).toMatchObject({ ok: true, perkara: { jenis: "Cerai Gugat" }, kandidat: [{ nomor: "5/Pdt.G/2026/PA.Dgl", tanggalBht: "2026-03-20", verstek: true, nama: ["Siti Aminah binti Usman"] }] });
    expect(sql.every((q) => /^\s*SELECT/i.test(q))).toBe(true);
    const utama = sql.find((q) => /pertimbangan_hukum/.test(q))!;
    expect(utama).toMatch(/tanggal_bht IS NOT NULL/);
    expect(utama).toMatch(/jabatan_hakim_id IN \(1, 3\)/);
    // Audit 17 Okt: ketua PEMERIKSAAN pada hari putusan, bukan aktif='Y' (majelis ikrar
    // talak ikut aktif - 27 dari 301 cerai talak BHT terkredit ke hakim lain, sipp_donggala_1610).
    expect(utama).toMatch(/h\.tahapan_id = 10/);
    expect(utama).toMatch(/h\.tanggal_penetapan <= pu\.tanggal_putusan/);
    expect(utama).not.toMatch(/h\.aktif = 'Y'/);
    const ketua = sql.find((q) => /FROM perkara_hakim_pn/.test(q) && !/EXISTS/.test(q))!;
    expect(ketua).toMatch(/ORDER BY \(tahapan_id = 10\) DESC/);
  });

  it("nomor tidak sah / majelis belum ditetapkan", async () => {
    expect((await layanan.putusanSerupa("bukan nomor")).ok).toBe(false);
    layanan._aturKueri(async (q: string) => (/FROM perkara WHERE/.test(q) ? [{ perkara_id: 9, nomor_perkara: "1/Pdt.G/2026/PA.Dgl", jenis_perkara_id: 1, jenis_perkara_nama: "Cerai Gugat" }] : []));
    expect(await layanan.putusanSerupa("1/Pdt.G/2026/PA.Dgl")).toMatchObject({ ok: true, kandidat: [], sebab: "majelis_belum_ditetapkan" });
  });
});

// ── Ekstensi ────────────────────────────────────────────────────────────────
const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");

describe("ekstensi putusan-advance.js", () => {
  const terbuka: JSDOM[] = [];
  afterEach(() => {
    while (terbuka.length) terbuka.pop()!.window.close();
  });

  it("terdaftar di manifest, susunan ekstensi, menu Alat saya hakim, dan Blangko Derry menyediakan naskahRtf", () => {
    const manifest = JSON.parse(baca("manifest.json"));
    const js = manifest.content_scripts.flatMap((c: { js?: string[] }) => c.js ?? []);
    expect(js.indexOf("putusan-advance.js")).toBe(js.indexOf("konseptor-langkah.js") + 1);
    expect(readFileSync(path.resolve(process.cwd(), "scripts/susun-ekstensi.mjs"), "utf8")).toContain('"putusan-advance.js"');
    expect(baca("blangko-derry.js")).toContain('["advance", "Putusan Advance (periksa draf)"]');
    expect(baca("blangko-derry-isian.js")).toMatch(/naskahRtf: \(paksa\) => ambilRtf\(paksa\)/);
  });

  it("hanya membaca: tidak memanggil simpan ABT/SIPP, hanya POST ke rute advance", () => {
    const isi = baca("putusan-advance.js");
    expect(isi).not.toMatch(/klienAbt\(|\.simpan\w*\(|unggah\w*\(|tanyajawab_perkara_edit|method:\s*"(?:PUT|DELETE|PATCH)"/i);
    expect([...new Set(isi.match(/\/aleta\/api\/[a-z0-9/-]+/g))]).toEqual(["/aleta/api/aleta-ecourt/putusan/advance"]);
  });

  it("alat terpasang, mengirim RTF + huruf + jawaban saksi, menampilkan rapor", async () => {
    const dom = new JSDOM(`<!doctype html><html><body><div id="aleta-bd-akar"></div></body></html>`, { url: "http://192.168.10.10/aps_badilag/index.php/abt/main/beranda", runScripts: "outside-only" });
    terbuka.push(dom);
    const w = dom.window as any;
    const alat = new Map<string, () => void>();
    const minta: any[] = [];
    w.aletaBlangkoDerry = { daftarkanAlat: (id: string, fn: () => void) => alat.set(id, fn), perkaraTerpilih: () => ({ perkara: { nomorPerkara: "123/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat" } }) };
    w.aletaBlangkoDerryIsian = {
      keadaan: () => ({ pk: { nomorPerkara: "123/Pdt.G/2026/PA.Dgl", perkaraId: "9" }, blangko: { jenis: "put" }, isi: { "8503": "F" }, tj: { s1: { rows: [{ no: "1", tanya: "Kenal?", jawab: "Kenal, saya kakak Penggugat" }] } } }),
      naskahRtf: async () => new TextEncoder().encode("{\\rtf1 uji}").buffer,
    };
    w.fetch = async (url: string, o: any) => {
      minta.push({ url, badan: JSON.parse(o.body) });
      return { ok: true, status: 200, json: async () => ({ data: { ok: true, rapor: { ringkas: "1 perhatian, 0 catatan.", perLangkah: { amar: { perhatian: 1, catatan: 0 } }, temuan: [{ kode: "talak-cg", tingkat: "perhatian", langkah: "amar", judul: "Cerai gugat dengan talak raj'i", rinci: "x" }], alasan: [], serupa: [], kutipan: [], tidakDiperiksa: [] } } }) };
    };
    w.eval(baca("putusan-advance.js"));
    expect(alat.has("advance")).toBe(true);
    alat.get("advance")!();
    const kartu = w.document.getElementById("bd-advance");
    expect(kartu.hidden).toBe(false);
    await w.aletaPutusanAdvance.periksa();
    expect(minta).toHaveLength(1);
    expect(minta[0].url).toBe("/aleta/api/aleta-ecourt/putusan/advance");
    expect(minta[0].badan).toMatchObject({ nomorPerkara: "123/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", huruf: "F", saksi: ["Kenal, saya kakak Penggugat"] });
    expect(Buffer.from(minta[0].badan.rtfBase64, "base64").toString("latin1")).toBe("{\\rtf1 uji}");
    expect(kartu.textContent).toContain("Cerai gugat dengan talak raj'i");
    expect(kartu.textContent).toContain("Amar 1 perhatian");
  });

  it("tanpa blangko putusan terbuka: meminta membuka blangko putusan, tidak mengirim apa pun", () => {
    const { bahanDariKeadaan } = (() => {
      const dom = new JSDOM(`<!doctype html><body></body>`, { runScripts: "outside-only" });
      terbuka.push(dom);
      dom.window.eval(baca("putusan-advance.js"));
      return (dom.window as any).aletaPutusanAdvance.murni;
    })();
    // Tanya jawab belum dibuka = saksi tidak terkirim (bukan daftar kosong).
    expect(bahanDariKeadaan({ pk: { nomorPerkara: "1/Pdt.G/2026/PA.Dgl" }, isi: {}, tj: {} }, null).saksi).toBeUndefined();
  });
});
