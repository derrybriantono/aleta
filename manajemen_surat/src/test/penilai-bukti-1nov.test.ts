// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type Dalil, type MatriksDalil } from "@/lib/matriks-dalil";
import { nilaiPembuktian, sidikBahan, topikKalimat, ubahanPembuktian, type BuktiMasuk, type SaksiMasuk } from "@/lib/penilai-bukti";
import { FITUR_PENILAIAN_AI, bahanPenilaianAi, uraiUsulanAi } from "@/lib/penilai-bukti-ai";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { buangSinggahanMatriks, pastikanMatriksDalil, type DepsMatriksDalil } from "@/server/modules/aleta-ecourt/matriks-dalil";
import { buangSinggahanPenilai, nilaiPembuktianPerkara, statusAkhir, tetapkanPembuktian, type DepsPenilai } from "@/server/modules/aleta-ecourt/penilai-bukti";

/**
 * A2 (1 Nov 2026) - PENILAI PEMBUKTIAN. Aturan pembuktian (Pasal 306/309/285/311 RBg; keputusan 53/57/60/70 selingkuh) atas
 * matriks dalil P2 x saksi x bukti; simpan ke matriks; panel; lapis ALETA Ai (pengurai usulan). Kalimat saksi di sini meniru BAS
 * sungguhan PA Donggala (gaya tanya-jawab blangko Derry); nama dan nomor dikarang.
 */

const AKAR = path.resolve(process.cwd(), "..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
type Apa = any;
const MD: Apa = muat(path.join(AKAR, "aleta_bot/services/matriksDalilService.js"));
const PB: Apa = muat(path.join(AKAR, "ekstensi-sipp/blangko-derry-penilai-bukti.js"));
const BP: Apa = muat(path.join(AKAR, "aleta_bot/services/bahanPembuktianService.js"));

const SB = { P: "Penggugat", T: "Tergugat" };
const POSITA = [
  "<p>1. Bahwa pada tanggal 08 November 2021 Penggugat dan Tergugat telah melangsungkan pernikahan yang dicatat oleh Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan Contoh;</p>",
  "<p>2. Bahwa setelah menikah Penggugat dan Tergugat tinggal bersama di rumah orang tua Penggugat di Desa Contoh;</p>",
  "<p>3. Bahwa Penggugat dan Tergugat hidup selayaknya suami isteri namun belum dikaruniai anak;</p>",
  "<p>4. Bahwa sejak pertengahan tahun 2025 rumah tangga Penggugat dan Tergugat mulai tidak harmonis dan sering terjadi perselisihan dan pertengkaran;</p>",
  "<p>5. Bahwa puncaknya pada bulan September 2025 Penggugat pergi meninggalkan tempat tinggal bersama dan sejak itu Penggugat dan Tergugat telah berpisah tempat tinggal;</p>",
  "<p>6. Bahwa Tergugat telah menjalin hubungan dengan perempuan lain;</p>",
  "<p>7. Bahwa berdasarkan dalil-dalil di atas telah cukup alasan bagi Penggugat untuk mengajukan gugatan ini;</p>",
  "<p>8. Bahwa Penggugat sanggup membayar seluruh biaya yang timbul dalam perkara ini;</p>",
].join("");
const matriks = (): MatriksDalil => MD.susunMatriksDalil({ dokumen: [], sebutan: { lawan: "Penggugat", pelaku: "Tergugat" }, sipp: { posita: POSITA, petitum: "" } });
const saksi = (id: string, pihak: "P" | "T", ke: number, baris: Array<[string, string]>): SaksiMasuk => ({ id, pihak, ke, baris: baris.map(([tanya, jawab]) => ({ tanya, jawab })) });
const AKTA: BuktiMasuk = { kode: "P.2", pihak: "P", jenis: "surat", teks: "Fotokopi Kutipan Akta Nikah Nomor 123/45/XI/2021 tanggal 08 November 2021 yang dikeluarkan oleh Kantor Urusan Agama Kecamatan Contoh" };
const KTP: BuktiMasuk = { kode: "P.1", pihak: "P", jenis: "surat", teks: "Fotokopi Kartu Tanda Penduduk Elektronik (KTP-el) atas nama Penggugat" };
const nomor = (h: Apa, n: string) => h.baris.find((r: Apa) => r.nomor === n);

const S1 = saksi("p1", "P", 1, [
  ["Apakah saudara kenal dengan Penggugat?", "Saya kenal dengan Penggugat karena saya adalah ibu kandung Penggugat;"],
  ["Kenapa Penggugat mengajukan cerai?", "Penggugat mengajukan cerai terhadap Tergugat karena sudah tidak rukun;"],
  ["Bagaimana keadaan rumah tangga mereka?", "Awalnya rumah tangga Penggugat dan Tergugat rukun dan harmonis, namun sejak pertengahan tahun 2025 sering terjadi perselisihan dan pertengkaran;"],
  ["Apakah saudara pernah melihat langsung?", "Saya pernah melihat dan mendengar langsung Penggugat dan Tergugat bertengkar sebanyak tiga kali;"],
  ["Apakah Penggugat dan Tergugat sudah dikaruniai anak?", "Penggugat dan Tergugat belum dikaruniai anak;"],
  ["Apakah masih tinggal satu rumah?", "Penggugat dan Tergugat sudah pisah tempat tinggal sejak bulan September 2025, sampai sekarang sudah sekitar 9 (sembilan) bulan;"],
  ["Apakah masih ada yang ingin disampaikan?", "Sudah cukup;"],
]);
const S2 = saksi("p2", "P", 2, [
  ["Bagaimana keadaan rumah tangga mereka?", "Antara Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran sejak tahun 2025;"],
  ["Apakah masih tinggal satu rumah?", "Penggugat dan Tergugat sudah berpisah tempat tinggal kurang lebih 9 bulan lamanya;"],
]);
const S2_CERITA = saksi("p2", "P", 2, [
  ["Apakah saudara mengetahui perselisihan mereka?", "Saya tidak pernah melihat dan mendengar langsung Penggugat dan Tergugat bertengkar, saya tahu hanya dengar cerita dari Penggugat;"],
  ["Apa penyebabnya?", "Saya tidak tahu penyebab perselisihan dan pertengkaran antara Penggugat dan Tergugat;"],
]);

describe("aturan pembuktian (lapis 1, tanpa AI)", () => {
  it("dua saksi bersesuaian -> terbukti; akta nikah -> terbukti (akta otentik); dalil kesimpulan/biaya tidak dinilai", () => {
    const h = nilaiPembuktian(matriks(), [S1, S2], [KTP, AKTA], { sebutan: SB });
    expect(nomor(h, "4")).toMatchObject({ status: "terbukti", kekuatan: "cukup" });
    expect(nomor(h, "4").alasan).toMatch(/Saksi 1 Penggugat dan Saksi 2 Penggugat: dua saksi .*Pasal 309 RBg/);
    expect(nomor(h, "1")).toMatchObject({ status: "terbukti", kekuatan: "sempurna" });
    expect(nomor(h, "1").bukti.map((b: Apa) => b.label)).toEqual(["P.2 akta nikah"]);
    expect(nomor(h, "7")).toBeUndefined();
    expect(nomor(h, "8")).toBeUndefined();
    expect(h.dilewati).toBe(2);
    expect(h.kesimpulan.alasanTerbukti).toContain("perselisihan dan pertengkaran");
    expect(h.kesimpulan.bulanPisah).toBe(9);
  });

  it("satu saksi saja -> belum terbukti (Pasal 306 RBg); saksi lain hanya dari cerita -> de auditu, tidak dihitung langsung", () => {
    const h = nilaiPembuktian(matriks(), [S1, S2_CERITA], [], { sebutan: SB });
    const r = nomor(h, "4");
    expect(r).toMatchObject({ status: "belum-terbukti", kekuatan: "lemah" });
    expect(r.alasan).toMatch(/Saksi 1 Penggugat saja: .*Pasal 306 RBg.*Saksi 2 Penggugat hanya mendengar dari cerita/);
    expect(r.saksi.find((s: Apa) => s.label === "Saksi 2 Penggugat")).toMatchObject({ langsung: false });
    expect(h.kesimpulan.alasanTerbukti).toEqual([]);
    expect(h.kesimpulan.catatan.join(" ")).toMatch(/Alasan perceraian belum terbukti/);
  });

  it("'mengajukan cerai karena sudah tidak rukun' (mengulang alasan gugatan) bukan penguat", () => {
    const hanya = saksi("p3", "P", 1, [["Kenapa Penggugat mengajukan cerai?", "Penggugat mengajukan cerai terhadap Tergugat karena sudah tidak rukun dalam rumah tangganya;"]]);
    const h = nilaiPembuktian(matriks(), [hanya, { ...hanya, id: "p4", ke: 2 }], [], { sebutan: SB });
    expect(nomor(h, "4").status).toBe("belum-terbukti");
    expect(nomor(h, "4").saksi).toEqual([]);
  });

  it("keterangan sebaliknya saksi pihak lawan -> bertentangan; 'awalnya rukun' bukan bantahan", () => {
    const T1 = saksi("t1", "T", 1, [["Bagaimana keadaan rumah tangga mereka?", "Sampai sekarang rumah tangga Penggugat dan Tergugat masih rukun dan baik-baik saja, tidak pernah bertengkar;"]]);
    const h = nilaiPembuktian(matriks(), [S1, S2, T1], [], { sebutan: SB });
    const r = nomor(h, "4");
    expect(r.status).toBe("bertentangan");
    expect(r.alasan).toMatch(/Saksi 1 Tergugat menerangkan sebaliknya/);
    expect(r.saksi.find((s: Apa) => s.pihak === "T")).toMatchObject({ sikap: "sebaliknya" });
    expect([...topikKalimat("Awalnya rumah tangga mereka rukun dan harmonis, namun sejak 2025 sering bertengkar")]).toEqual([["selisih", 1]]);
    expect([...topikKalimat("Selama pernikahan Penggugat dan Tergugat hidup rukun dan harmonis layaknya suami istri")].find(([k]) => k === "selisih")?.[1]).toBe(0);
  });

  it("arah topik: dalil 'belum dikaruniai anak' didukung saksi 'belum dikaruniai anak', dibantah saksi 'dikaruniai dua orang anak'", () => {
    const anakAda = saksi("p5", "P", 2, [["Apakah sudah dikaruniai anak?", "Penggugat dan Tergugat sudah dikaruniai 2 (dua) orang anak;"]]);
    expect(nomor(nilaiPembuktian(matriks(), [S1], [], { sebutan: SB }), "3").saksi[0]).toMatchObject({ sikap: "mendukung" });
    expect(nomor(nilaiPembuktian(matriks(), [S1, anakAda], [], { sebutan: SB }), "3").status).toBe("bertentangan");
  });

  it("tuduhan selingkuh (keputusan 53/57/60/70): bukti elektronik saja belum; 1 saksi + bukti elektronik terbukti; putusan PN zina terbukti tanpa saksi", () => {
    const foto: BuktiMasuk = { kode: "P.3", pihak: "P", jenis: "elektronik", teks: "Tangkapan layar percakapan WhatsApp Tergugat dengan perempuan lain" };
    const lihat = saksi("p6", "P", 1, [["Apa penyebab pertengkaran?", "Saya pernah melihat sendiri Tergugat berboncengan dengan perempuan lain di pasar;"]]);
    expect(nomor(nilaiPembuktian(matriks(), [], [foto], { sebutan: SB }), "6")).toMatchObject({ status: "belum-terbukti" });
    expect(nomor(nilaiPembuktian(matriks(), [], [foto], { sebutan: SB }), "6").alasan).toMatch(/keputusan 70/);
    expect(nomor(nilaiPembuktian(matriks(), [lihat], [], { sebutan: SB }), "6").status).toBe("belum-terbukti");
    expect(nomor(nilaiPembuktian(matriks(), [lihat], [foto], { sebutan: SB }), "6")).toMatchObject({ status: "terbukti", kekuatan: "cukup" });
    const pn: BuktiMasuk = { kode: "P.4", pihak: "P", jenis: "surat", teks: "Fotokopi Putusan Pengadilan Negeri Palu Nomor 12/Pid.B/2025/PN Pal tentang perzinahan yang dilakukan Tergugat" };
    expect(nomor(nilaiPembuktian(matriks(), [], [pn], { sebutan: SB }), "6")).toMatchObject({ status: "terbukti", kekuatan: "sempurna" });
  });

  it("diakui tegas: fakta lain (perkawinan) tidak perlu dibuktikan; perselisihan & pertengkaran tetap perlu saksi (Pasal 22 ayat (2) PP 9/1975)", () => {
    const m = matriks();
    const akui = (n: string, no: string) => {
      m.dalil.find((d: Dalil) => d.nomor === n)!.tanggapan = { status: "diakui", ragu: false, rincian: [{ dari: "j", sumber: "jawaban", nomor: no, status: "diakui", cara: "rujukan", kutipan: `membenarkan dalil angka ${n}` }] };
    };
    akui("1", "1");
    akui("4", "2");
    const h = nilaiPembuktian(m, [], [], { sebutan: SB, cerai: true });
    expect(nomor(h, "1")).toMatchObject({ status: "tidak-perlu-dibuktikan", kekuatan: "sempurna", diakui: true });
    expect(nomor(h, "1").alasan).toMatch(/Diakui Tergugat \(jawaban angka 1\).*Pasal 311 RBg/);
    const r = nomor(h, "4");
    expect(r).toMatchObject({ status: "belum-terbukti", diakui: true });
    expect(r.alasan).toMatch(/Diakui Tergugat \(jawaban angka 2\) - tetap perlu didengar keluarga\/orang dekat \(Pasal 22 ayat \(2\) PP 9\/1975\)/);
    expect(h.kesimpulan.alasanTerbukti).toEqual([]);
    // Satu saksi + pengakuan: pengakuan bukan "bukti lain" -> tetap belum; dua saksi bersesuaian -> terbukti.
    expect(nomor(nilaiPembuktian(m, [S1], [], { sebutan: SB, cerai: true }), "4").status).toBe("belum-terbukti");
    const dua = nomor(nilaiPembuktian(m, [S1, S2], [], { sebutan: SB, cerai: true }), "4");
    expect(dua).toMatchObject({ status: "terbukti", diakui: true });
    expect(dua.alasan).toMatch(/dikuatkan keterangan saksi/);
    expect(PB.htmlTabel({ ada: true, hasil: h }, SB, false, false)).toMatch(/belum terbukti<\/span> <span class="bd-catat" title="Diakui pihak lawan/);
    m.dalil.find((d: Dalil) => d.nomor === "1")!.tanggapan!.ragu = true; // pengakuan yang belum pasti tidak membebaskan pembuktian
    expect(nomor(nilaiPembuktian(m, [], [], { sebutan: SB }), "1").status).toBe("belum-terbukti");
  });

  it("saksi tanpa sumber pengetahuan: dianggap tahu langsung, diberi catatan", () => {
    const h = nilaiPembuktian(matriks(), [S1, S2], [], { sebutan: SB });
    expect(nomor(h, "4").status).toBe("terbukti");
    expect(nomor(h, "4").catatan.join(" ")).toMatch(/Sumber pengetahuan Saksi 2 Penggugat tidak disebut \(dianggap mengetahui langsung\)/);
    expect(nomor(h, "4").catatan.join(" ")).not.toMatch(/Saksi 1 Penggugat tidak disebut/); // S1 "pernah melihat langsung"
  });

  it("isian blangko yang belum diisi/dipilih tidak dinilai dan dicatat; pisah < 6 bulan diberi catatan", () => {
    const sisa = saksi("p7", "P", 1, [["Apakah pernah melihat?", "Saya pernah melihat dan mendengar langsung Penggugat dan Tergugat bertengkar, sebanyak .... kali, di ........;Saya tidak pernah melihat dan mendengar langsung"]]);
    const h = nilaiPembuktian(matriks(), [sisa], [], { sebutan: SB });
    expect(h.kesimpulan.catatan.join(" ")).toMatch(/Saksi 1 Penggugat masih memuat isian blangko/);
    const baru = (id: string, ke: number) => saksi(id, "P", ke, [["Keadaan?", "Antara Penggugat dan Tergugat sering terjadi pertengkaran;"], ["Pisah?", "Penggugat dan Tergugat sudah pisah tempat tinggal kira-kira sampai sekarang sudah sekitar 4 (empat) bulan lamanya;"]]);
    const h2 = nilaiPembuktian(matriks(), [baru("a", 1), baru("b", 2)], [], { sebutan: SB });
    expect(h2.kesimpulan.bulanPisah).toBe(4);
    expect(h2.kesimpulan.catatan.join(" ")).toMatch(/baru ±4 bulan; periksa syarat lama pisah \(sedikitnya 6 bulan\)/);
  });

  it("bukti dirujuk nomor dalil ('untuk membuktikan dalil angka 2') ikut menjadi dasar", () => {
    const sk: BuktiMasuk = { kode: "P.3", pihak: "P", jenis: "surat", teks: "Surat keterangan Kepala Desa, untuk membuktikan dalil angka 2 gugatan" };
    const h = nilaiPembuktian(matriks(), [saksi("p8", "P", 1, [["Tinggal di mana?", "Setelah menikah Penggugat dan Tergugat tinggal bersama di rumah orang tua Penggugat;"]])], [sk], { sebutan: SB });
    expect(nomor(h, "2")).toMatchObject({ status: "terbukti" });
    expect(nomor(h, "2").alasan).toMatch(/satu saksi ditambah alat bukti lain/);
  });

  it("simpan ke matriks: status tetapan majelis tidak ditimpa, status aturan basi dihapus, tanpa ubahan bila sama", () => {
    const h = nilaiPembuktian(matriks(), [S1, S2], [AKTA], { sebutan: SB });
    const id4 = nomor(h, "4").id;
    const u = ubahanPembuktian(h, { [id4]: { status: "belum-terbukti", oleh: "hakim-1" }, "G-0000000000": { status: "terbukti", oleh: "aturan" } });
    expect(u[id4]).toBeUndefined();
    expect(u["G-0000000000"]).toBeNull();
    const id1 = nomor(h, "1").id;
    expect(u[id1]).toMatchObject({ status: "terbukti", oleh: "aturan", kekuatan: "sempurna", dasar: { bukti: ["P.2 akta nikah"] } });
    const lagi = ubahanPembuktian(h, { ...(Object.fromEntries(Object.entries(u).filter(([, v]) => v)) as Apa), [id4]: { status: "belum-terbukti", oleh: "hakim-1" } });
    expect(Object.keys(lagi)).toEqual([]);
  });

  it("kinerja: 300 dalil x 4 saksi x 30 baris < 300 ms; sidik bahan stabil", () => {
    const butir = Array.from({ length: 300 }, (_, i) => `<p>${i + 1}. Bahwa pada tahun ${2000 + (i % 25)} Tergugat ${["pergi meninggalkan rumah", "tidak memberi nafkah", "sering bertengkar dengan Penggugat", "memukul Penggugat"][i % 4]} kejadian ke-${i + 1};</p>`).join("");
    const m = MD.susunMatriksDalil({ dokumen: [], sebutan: { lawan: "Penggugat", pelaku: "Tergugat" }, sipp: { posita: butir, petitum: "" } });
    const banyak = Array.from({ length: 4 }, (_, k) => saksi(`s${k}`, "P", k + 1, Array.from({ length: 30 }, (_, i) => [`Tanya ${i}`, ["Tergugat sering memukul Penggugat", "Tergugat tidak memberi nafkah", "Sering terjadi pertengkaran", "Sudah pisah rumah 2 tahun"][i % 4]] as [string, string])));
    const t0 = performance.now();
    const h = nilaiPembuktian(m, banyak, [AKTA, KTP], { sebutan: SB });
    expect(performance.now() - t0).toBeLessThan(300);
    expect(h.baris.length).toBeGreaterThan(250);
    expect(sidikBahan(banyak, [AKTA])).toBe(sidikBahan(JSON.parse(JSON.stringify(banyak)), [AKTA]));
    expect(sidikBahan(banyak, [AKTA])).not.toBe(sidikBahan(banyak, [AKTA, KTP]));
  });
});

describe("portal: hitung, simpan ke matriks, API A1", () => {
  let db: AletaDatabase | null = null;
  const NOMOR = "217/Pdt.G/2026/PA.Xyz";
  const CT = { lawan: "Penggugat", pelaku: "Tergugat" };
  const depsM: DepsMatriksDalil = {
    rincian: async () => ({ ok: true, dokumen: [] }),
    bacaEcourt: async () => {
      throw new Error("tidak dipakai");
    },
    bacaSipp: async () => ({ matriks: matriks(), sidik: "s1" }),
  };
  const buat = (abt: { saksi: SaksiMasuk[]; bukti: BuktiMasuk[] }) => {
    const catat = { abt: 0 };
    const deps: DepsPenilai = {
      matriks: (n, sb) => pastikanMatriksDalil(db!, n, sb, depsM),
      bahanAbt: async () => {
        catat.abt += 1;
        return { ok: true, ...abt };
      },
    };
    return { deps, catat };
  };
  beforeEach(async () => {
    buangSinggahanMatriks();
    buangSinggahanPenilai();
    db = await createAletaDatabase({ useInMemory: true, seed: true });
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("tanpa bahan panel: dari ABT; status tersimpan di matriks (dibaca A1 dan panel)", async () => {
    const { deps, catat } = buat({ saksi: [S1, S2], bukti: [AKTA] });
    const h = await nilaiPembuktianPerkara(db!, NOMOR, CT, deps);
    expect(h).toMatchObject({ ada: true, sumberBahan: "abt" });
    expect(catat.abt).toBe(1);
    expect(h.disimpan).toBeGreaterThan(3);
    const m = await pastikanMatriksDalil(db!, NOMOR, CT, depsM);
    const d4 = m.matriks!.dalil.find((d) => d.nomor === "4")!;
    expect(d4.pembuktian).toMatchObject({ status: "terbukti", oleh: "aturan" });
    // Bahan sama -> singgahan, tanpa tulis ulang.
    const lagi = await nilaiPembuktianPerkara(db!, NOMOR, CT, deps);
    expect(lagi).toMatchObject({ dariSinggahan: true, disimpan: 0 });
  });

  it("bahan panel menang atas ABT; bukti pihak yang belum dimuat panel diambil dari ABT; perubahan saksi menghitung ulang", async () => {
    const { deps, catat } = buat({ saksi: [S1, S2], bukti: [AKTA, { kode: "T.1", pihak: "T", jenis: "surat", teks: "Fotokopi KTP atas nama Tergugat" }] });
    const a = await nilaiPembuktianPerkara(db!, NOMOR, CT, deps, { saksi: [S1, S2_CERITA], bukti: [KTP], pihakBukti: ["P"] });
    expect(a.sumberBahan).toBe("campuran");
    expect(catat.abt).toBe(1);
    expect(a.hasil!.baris.find((r) => r.nomor === "4")!.status).toBe("belum-terbukti");
    expect(a.hasil!.jumlahBukti.surat).toBe(2); // KTP panel (P) + T.1 dari ABT; akta P dari ABT tidak dipakai (pihak P dari panel)
    const b = await nilaiPembuktianPerkara(db!, NOMOR, CT, deps, { saksi: [S1, S2], bukti: [KTP], pihakBukti: ["P", "T"] });
    expect(b.sumberBahan).toBe("panel");
    expect(catat.abt).toBe(1);
    expect(b.hasil!.baris.find((r) => r.nomor === "4")!.status).toBe("terbukti");
  });

  it("tetapan majelis tersimpan, menang di tampilan/A1, tidak ditimpa hitungan berikutnya; null kembali ke aturan", async () => {
    const { deps } = buat({ saksi: [S1, S2], bukti: [AKTA] });
    const a = await nilaiPembuktianPerkara(db!, NOMOR, CT, deps);
    const id = a.hasil!.baris.find((r) => r.nomor === "4")!.id;
    expect(await tetapkanPembuktian(db!, NOMOR, id, "belum-terbukti", "hakim-9", "saksi kedua tidak melihat sendiri")).toBe(true);
    const b = await nilaiPembuktianPerkara(db!, NOMOR, CT, deps);
    const r = b.hasil!.baris.find((x) => x.id === id)!;
    expect(r.status).toBe("terbukti"); // hitungan aturan tetap terlihat
    expect(r.ditetapkan).toMatchObject({ status: "belum-terbukti", oleh: "hakim-9" });
    expect(statusAkhir(r)).toBe("belum-terbukti");
    expect(await tetapkanPembuktian(db!, NOMOR, id, "salah" as Apa, "x")).toBe(false);
    await tetapkanPembuktian(db!, NOMOR, id, null, "hakim-9");
    const c = await nilaiPembuktianPerkara(db!, NOMOR, CT, deps);
    expect(c.hasil!.baris.find((x) => x.id === id)!.ditetapkan).toBeNull();
  });
});

describe("bot: bahan dari ABT (hanya SELECT)", () => {
  it("sidang terakhir per saksi, pihak dari perkara_pihak5, bukti elektronik dikenali, tanpa nama saksi", async () => {
    const sql: string[] = [];
    const runQuery = async (q: string) => {
      sql.push(q);
      if (/FROM perkara WHERE/.test(q)) return [{ id: 77 }];
      return [{ id: 5, ke: 1, urutan: 1, keterangan: "Ibu Kandung Penggugat" }, { id: 6, ke: 2, urutan: 1, keterangan: "Tetangga" }];
    };
    const runAbt = async (q: string) => {
      sql.push(q);
      if (/abt_keterangan_saksi/.test(q))
        return [
          { sidang_id: 10, saksi_id: 5, urutan_pertanyaan: 1, pertanyaan: "Keadaan?", jawaban: "lama" },
          { sidang_id: 11, saksi_id: 5, urutan_pertanyaan: 1, pertanyaan: "Keadaan?", jawaban: "Sering bertengkar;" },
          { sidang_id: 11, saksi_id: 6, urutan_pertanyaan: 1, pertanyaan: "Keadaan?", jawaban: "Masih rukun sampai sekarang;" },
        ];
      return [{ no_var: 1214, data: "Fotokopi Kutipan Akta Nikah, lalu diberi tanda P.1;\nTangkapan layar percakapan WhatsApp, bukti elektronik tersebut diberi tanda P.2;" }];
    };
    const h = await BP.bahanPembuktian("1/Pdt.G/2026/PA.Xyz", { runQuery, runAbt });
    expect(h.saksi).toEqual([
      { id: "5", pihak: "P", ke: 1, hubungan: "Ibu Kandung Penggugat", baris: [{ tanya: "Keadaan?", jawab: "Sering bertengkar;" }] },
      { id: "6", pihak: "T", ke: 1, hubungan: "Tetangga", baris: [{ tanya: "Keadaan?", jawab: "Masih rukun sampai sekarang;" }] },
    ]);
    expect(h.bukti.map((b: Apa) => [b.kode, b.jenis])).toEqual([["P.1", "surat"], ["P.2", "elektronik"]]);
    expect(sql.every((q) => /^\s*SELECT/i.test(q))).toBe(true);
  });
});

describe("ekstensi: Penilaian pembuktian", () => {
  const data = (h: Apa) => ({ ada: true, sumberBahan: "panel", hasil: h });

  it("tabel ringkas: lencana status, dasar saksi/bukti, escape HTML, batas 40 baris", () => {
    const h = nilaiPembuktian(matriks(), [S1, S2_CERITA], [AKTA], { sebutan: SB });
    const t = PB.htmlTabel(data(h), SB, false, false);
    expect(t).toContain('class="bd-tanda hijau"');
    expect(t).toContain('class="bd-tanda kuning"');
    expect(t).toContain("Saksi 2 Penggugat (dari cerita)");
    expect(t).toContain(">P.2<");
    expect(t).not.toContain("Penilaian lanjutan ALETA Ai");
    expect(PB.ringkasPenilaian(data(h))).toMatch(/^\d+ dalil · \d+ terbukti · \d+ belum terbukti/);
    const jahat = { ...h, baris: [{ ...h.baris[0], ringkas: "<img src=x onerror=alert(1)>" }] };
    expect(PB.htmlTabel(data(jahat), SB, false, false)).toContain("&lt;img");
    const banyak = { ...h, baris: Array.from({ length: 55 }, (_, i) => ({ ...h.baris[0], id: `G-${i}` })) };
    expect((PB.htmlTabel(data(banyak), SB, false, false).match(/<tr>/g) || []).length - 1).toBe(PB.BATAS_BARIS);
    expect(PB.htmlTabel(data(banyak), SB, false, false)).toContain("Tampilkan 15 dalil lainnya");
    expect(PB.htmlTabel(data(h), SB, false, true)).toContain('data-pb="ai"');
    expect(PB.htmlBungkus("1/Pdt.G/2026/PA.Xyz", SB)).toMatch(/^<details class="bd-tambahan bd-penilaian" id="bd-penilaian"[^>]*><summary>Penilaian pembuktian/);
  });

  it("dihitung ulang sendiri saat bahan berubah (debounce 1,5 dtk), sidik sama = tanpa permintaan", async () => {
    vi.useFakeTimers();
    try {
      const minta: Apa[] = [];
      let bahan: Apa = { saksi: [{ id: "saksi-1-p", pihak: "P", ke: 1, baris: [{ tanya: "a", jawab: "b" }] }], bukti: [], pihakBukti: ["P"] };
      const o = { nomor: "2/Pdt.G/2026/PA.Xyz", sebutan: SB, bahan: () => bahan, ambil: async (u: string, op: Apa) => (minta.push([u, op && op.method]), { ada: false, hasil: null }) };
      PB.segarkan(o);
      PB.segarkan(o);
      PB.segarkan(o);
      expect(minta.length).toBe(0);
      await vi.advanceTimersByTimeAsync(PB.TUNDA_MS + 10);
      expect(minta).toEqual([[PB.API, "POST"]]);
      PB.segarkan(o); // sidik sama
      await vi.advanceTimersByTimeAsync(PB.TUNDA_MS + 10);
      expect(minta.length).toBe(1);
      bahan = { ...bahan, saksi: [{ ...bahan.saksi[0], baris: [{ tanya: "a", jawab: "c" }] }] };
      PB.segarkan(o);
      await vi.advanceTimersByTimeAsync(PB.TUNDA_MS + 10);
      expect(minta.length).toBe(2);
      // Tanpa bahan & bagian tertutup & belum pernah dihitung: tidak ada permintaan sama sekali (saklar ringan).
      PB.segarkan({ ...o, nomor: "3/Pdt.G/2026/PA.Xyz", bahan: () => null });
      await vi.advanceTimersByTimeAsync(PB.TUNDA_MS + 10);
      expect(minta.length).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("didaftarkan di manifest dan susun-ekstensi sebelum blangko-derry-isian.js; panel memanggilnya dari laporKeKerangka", () => {
    const manifest = readFileSync(path.join(AKAR, "ekstensi-sipp/manifest.json"), "utf8");
    const susunEks = readFileSync(path.join(AKAR, "manajemen_surat/scripts/susun-ekstensi.mjs"), "utf8");
    for (const t of [manifest, susunEks]) {
      expect(t.indexOf('"blangko-derry-penilai-bukti.js"')).toBeGreaterThan(0);
      expect(t.indexOf('"blangko-derry-penilai-bukti.js"')).toBeLessThan(t.indexOf('"blangko-derry-isian.js"'));
    }
    const isian = readFileSync(path.join(AKAR, "ekstensi-sipp/blangko-derry-isian.js"), "utf8");
    expect(isian).toMatch(/function laporKeKerangka\(\) \{\s*perbaruiPeriksa\(\);\s*segarPenilaian\(\);/);
  });
});

describe("ALETA Ai (lapis 2): pengurai usulan", () => {
  const h = nilaiPembuktian(matriks(), [S1, S2_CERITA], [AKTA], { sebutan: SB });
  const id4 = nomor(h, "4").id;

  it("hanya id yang ada, status sah, pasal terverifikasi di rak; hasil = usulan, status aturan tidak diubah", () => {
    const jawab = `Berikut hasilnya:\n[{"id":"${id4}","status":"terbukti","alasan":"Saksi 2 mendengar dari Penggugat.","pasal":["Pasal 169 HIR","Pasal 999 KUHPerdata"]},{"id":"G-ngarang","status":"terbukti"},{"id":"${nomor(h, "1").id}","status":"menang"}]`;
    const u = uraiUsulanAi(jawab, h);
    expect(u).toHaveLength(1);
    expect(u[0]).toMatchObject({ id: id4, status: "terbukti", statusAturan: "belum-terbukti", berubah: true, pasal: ["Pasal 169 HIR"] });
    expect(u[0].pasalDitolak.map((x) => x.teks)).toEqual(["Pasal 999 KUHPerdata"]);
    expect(nomor(h, "4").status).toBe("belum-terbukti");
    expect(uraiUsulanAi("maaf, tidak bisa", h)).toEqual([]);
  });

  it("definisi fitur C6 (kelompok putusan) dan bahan tabel tanpa nama saksi", () => {
    expect(FITUR_PENILAIAN_AI).toMatchObject({ kode: "C6", kelompok: "mendalam-putusan", wajib: ["temuan"] });
    const b = bahanPenilaianAi(h);
    expect(b).toContain(`[${id4}] Dalil 4:`);
    expect(b).toMatch(/Saksi 2 Penggugat \(dari cerita\)/);
    expect(PB.teksUntukAi({ ada: true, hasil: h })).toContain(`[${id4}] Dalil 4:`);
  });
});
