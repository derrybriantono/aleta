// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { hakPutusanAdvance, KATALOG_JENIS, kodeJenisAdvance, SAMPEL_PERHATIAN, susunRaporAdvance } from "@/lib/putusan-advance";
import { semuaSetSaksi, setCerai, tawarkanSetSaksi } from "@/lib/set-pertanyaan-saksi";

/**
 * 17 Okt 2026 - keputusan pengguna:
 *   55-57 Putusan Advance tetap PEMERIKSA; diperluas ke jenis selain cerai
 *         (unsur dari set saksi F3.3); hak = hakim DAN konseptor + Admin.
 *   23-30 set saksi: pisah 6 bulan kecuali KDRT, perwalian 18 tahun,
 *         Permensos 110/HUK/2009, itsbat poligami liar (SEMA 3/2018), izin
 *         poligami + harta bersama, sighat taklik per tahun nikah, zina hanya
 *         cerai talak.
 * Ukur salah tangkap (sipp_donggala, BHT dikabulkan, pertimbangan utuh):
 * itsbat 0/291, dispensasi 0/16, PAW 0/14 (4 catatan), perwalian 0/15
 * (1 catatan); jenis berputusan < 5 hanya catatan.
 */

const MAKSUD = "Menimbang, bahwa maksud dan tujuan permohonan para Pemohon adalah sebagaimana diuraikan di atas;";
const ITSBAT_LENGKAP = [
  MAKSUD,
  "Menimbang, bahwa Pemohon I dan Pemohon II menikah secara agama dengan wali nikah ayah kandung Pemohon II, disaksikan oleh dua orang saksi nikah, dengan ijab dan kabul, mahar seperangkat alat salat;",
  "Menimbang, bahwa saat menikah Pemohon I berstatus jejaka dan Pemohon II perawan, tidak ada hubungan darah maupun sesusuan;",
  "Menimbang, bahwa pengesahan nikah diperlukan untuk pengurusan akta kelahiran anak sesuai Pasal 7 ayat (3) huruf e Kompilasi Hukum Islam;",
].join("\n");
const KABUL = "1. Mengabulkan permohonan para Pemohon;\n2. Menyatakan sah perkawinan Pemohon I dengan Pemohon II;";

describe("Putusan Advance: jenis selain cerai", () => {
  it("kode pemeriksaan: set saksi + pembatalan perkawinan & ekonomi syariah; semua jenis yang diminta punya katalog unsur", () => {
    expect(kodeJenisAdvance("Pembatalan Perkawinan")).toBe("pembatalan");
    expect(kodeJenisAdvance("Ekonomi Syariah")).toBe("es");
    expect(kodeJenisAdvance("Pengesahan Perkawinan/Istbat Nikah")).toBe("itsbat");
    for (const k of ["itsbat", "dk", "paw", "waris", "hb", "perwalian", "wa", "aua", "angkat", "ip", "hadhanah", "pembatalan", "es"] as const) {
      expect(KATALOG_JENIS[k]?.unsur.length, k).toBeGreaterThanOrEqual(2);
    }
  });

  it("itsbat lengkap dikabulkan: semua unsur dipertimbangkan, tanpa temuan unsur", () => {
    const r = susunRaporAdvance({ nomorPerkara: "10/Pdt.P/2026/PA.Dgl", jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah", dudukPerkara: "", pertimbangan: ITSBAT_LENGKAP, amar: KABUL });
    expect(r.jenisPeriksa).toBe("itsbat");
    expect(r.alasan).toHaveLength(1);
    expect(r.alasan[0].huruf).toBe("");
    expect(r.alasan[0].unsur.every((u) => u.dipertimbangkan)).toBe(true);
    expect(r.temuan.filter((t) => t.kode.startsWith("unsur-"))).toEqual([]);
  });

  it("itsbat tanpa wali & mahar: PERHATIAN (sampel 291 >= 20), langkah pertimbangan; saksi memuatnya disebut", () => {
    const pert = ITSBAT_LENGKAP.replace(/dengan wali nikah ayah kandung Pemohon II, /, "").replace(/, mahar seperangkat alat salat/, "");
    const r = susunRaporAdvance({ nomorPerkara: "10/Pdt.P/2026/PA.Dgl", jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah", dudukPerkara: "", pertimbangan: pert, amar: KABUL, keteranganSaksi: ["Wali nikahnya ayah kandung Pemohon II, maharnya emas 2 gram"] });
    const t = r.temuan.filter((x) => x.kode === "unsur-i-wali" || x.kode === "unsur-i-mahar");
    expect(t.map((x) => x.tingkat)).toEqual(["perhatian", "perhatian"]);
    expect(t[0].langkah).toBe("pertimbangan");
    expect(t[0].rinci).toMatch(/dari 291 putusan BHT PA Donggala.*Keterangan saksi sudah memuatnya/);
    expect(KATALOG_JENIS.itsbat!.sampel).toBeGreaterThanOrEqual(SAMPEL_PERHATIAN);
  });

  it("amar menolak: unsur tidak diperiksa (dijelaskan); sampel kecil: paling jauh catatan dengan kalimat 'belum cukup'", () => {
    const tolak = susunRaporAdvance({ nomorPerkara: "10/Pdt.P/2026/PA.Dgl", jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah", dudukPerkara: "", pertimbangan: MAKSUD, amar: "1. Menolak permohonan para Pemohon;" });
    expect(tolak.alasan).toEqual([]);
    expect(tolak.tidakDiperiksa.join(" ")).toMatch(/diperiksa bila amar mengabulkan; amar draf ini ditolak/);
    const ip = susunRaporAdvance({ nomorPerkara: "3/Pdt.G/2026/PA.Dgl", jenisPerkara: "Izin Poligami", dudukPerkara: "", pertimbangan: `${MAKSUD}\nMenimbang, bahwa Pemohon mampu secara ekonomi;`, amar: "1. Mengabulkan permohonan Pemohon;" });
    const unsur = ip.temuan.filter((t) => t.kode.startsWith("unsur-ip-"));
    expect(unsur.map((t) => t.kode)).toContain("unsur-ip-hb");
    expect(unsur.every((t) => t.tingkat === "catatan")).toBe(true);
    expect(unsur[0].rinci).toMatch(/belum cukup untuk diukur/);
    // Dispensasi (sampel 16 < 20): catatan, bukan perhatian.
    const dk = susunRaporAdvance({ nomorPerkara: "4/Pdt.P/2026/PA.Dgl", jenisPerkara: "Dispensasi Kawin", dudukPerkara: "", pertimbangan: MAKSUD, amar: "1. Mengabulkan permohonan Pemohon;" });
    expect(dk.temuan.filter((t) => t.kode.startsWith("unsur-dk-")).every((t) => t.tingkat === "catatan")).toBe(true);
  });

  it("cerai tidak berubah: unsur per huruf tetap", () => {
    const r = susunRaporAdvance({ nomorPerkara: "1/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", dudukPerkara: "", pertimbangan: "Menimbang, bahwa memenuhi Pasal 19 huruf f PP 9/1975;", amar: "Mengabulkan gugatan Penggugat;" });
    expect(r.alasan[0].huruf).toBe("F");
  });
});

describe("hak Putusan Advance: hakim DAN konseptor + Admin", () => {
  const dasar = { admin: false, peran: ["panitera-pengganti"], nama: ["Nur Aisyah, S.H."], usernames: ["nuraisyah"] };
  it("Admin, hakim (termasuk Ketua/Wakil), konseptor sementara, konseptor SIPP boleh; PP lain tidak", () => {
    expect(hakPutusanAdvance({ ...dasar, admin: true }).sebagai).toBe("admin");
    expect(hakPutusanAdvance({ ...dasar, peran: ["ketua"] }).sebagai).toBe("hakim");
    expect(hakPutusanAdvance({ ...dasar, konseptorSementara: { nama: "Nur Aisyah" } }).sebagai).toBe("konseptor");
    expect(hakPutusanAdvance({ ...dasar, konseptorSipp: [{ pengguna: "NURAISYAH", nama: "x" }] }).sebagai).toBe("konseptor");
    const tidak = hakPutusanAdvance({ ...dasar, konseptorSementara: { nama: "Orang Lain" }, konseptorSipp: [{ pengguna: "lain", nama: "Orang Lain" }] });
    expect(tidak.boleh).toBe(false);
    expect(tidak.sebab).toMatch(/hakim, konseptor perkara ini/);
  });
});

// ── Rute: PP bukan konseptor ditolak 403, PP konseptor SIPP boleh ─────────
const k = vi.hoisted(() => ({ aktor: {} as Record<string, unknown>, konseptor: [] as unknown[] }));
vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({ queryOne: async () => null, queryAll: async () => [] }) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_pp" }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({ pastikanKapabilitas: async () => k.aktor }));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (galat: { status?: number; message?: string }) => Response.json({ ok: false, error: { message: galat.message } }, { status: galat.status ?? 500 }),
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  getGatewaySippPutusanSerupa: async () => ({ ok: true, data: { ok: true, perkara: { id: "77", nomor: "77/Pdt.G/2026/PA.Dgl", jenis: "Cerai Gugat" }, konseptor: k.konseptor, kandidat: [] } }),
}));
vi.mock("@/server/modules/aleta-ecourt/pustaka-pertimbangan", () => ({ cariButir: async () => [] }));
// Saklar per akun (17 Okt) diuji di putusan-advance-akun-17okt.test.ts - di sini semua akun dinyalakan.
vi.mock("@/server/modules/aleta-ecourt/putusan-advance-akun", () => ({ advanceMenyalaUntuk: async () => true }));

async function panggil() {
  const mod = await import("@/app/api/aleta-ecourt/putusan/advance/route");
  const p = new Request("http://uji.local/aleta/api/aleta-ecourt/putusan/advance", {
    method: "POST",
    body: JSON.stringify({ teks: "PERTIMBANGAN HUKUM\nMenimbang, bahwa ...\nMENGADILI\nMengabulkan gugatan Penggugat;", nomorPerkara: "77/Pdt.G/2026/PA.Dgl" }),
    headers: { "Content-Type": "application/json" },
  });
  return mod.POST(p as unknown as Parameters<typeof mod.POST>[0]);
}

describe("rute /putusan/advance - hak per perkara", () => {
  it("PP yang bukan konseptor perkara: 403 dengan kalimat awam", async () => {
    k.aktor = { id: "usr_pp", name: "PP Lain", roleId: "panitera-pengganti" };
    k.konseptor = [{ pengguna: "orang", nama: "Orang Lain" }];
    const j = await panggil();
    expect(j.status).toBe(403);
    expect(JSON.stringify(await j.json())).toMatch(/hakim, konseptor perkara ini/);
  });
  it("PP yang tercatat konseptor di SIPP: rapor jadi", async () => {
    k.aktor = { id: "usr_pp", name: "Nur Aisyah", roleId: "panitera-pengganti" };
    k.konseptor = [{ pengguna: "nur", nama: "Nur Aisyah, S.H." }];
    const j = await panggil();
    expect(j.status).toBe(200);
    expect(((await j.json()) as { data: { ok: boolean } }).data.ok).toBe(true);
  });
});

describe("bot putusanSerupaService: perkara.id + konseptor SIPP", () => {
  it("konseptor dari jejak tahapan ikut dikirim; gagal baca = []", async () => {
    const akar = path.resolve(process.cwd(), "..");
    const layanan = createRequire(path.join(akar, "aleta_bot/package.json"))(path.join(akar, "aleta_bot/services/putusanSerupaService.js"));
    const kueri = async (q: string) =>
      /FROM perkara WHERE/.test(q) ? [{ perkara_id: 9, nomor_perkara: "1/Pdt.G/2026/PA.Dgl", jenis_perkara_id: 1, jenis_perkara_nama: "Cerai Gugat" }] : [];
    layanan._aturKueri(kueri, async (id: number) => ({ terbaca: true, baris: [{ pengguna: "nur", nama: "Nur Aisyah", tanggal: "2026-10-01", id }] }));
    expect(await layanan.putusanSerupa("1/Pdt.G/2026/PA.Dgl")).toMatchObject({ perkara: { id: "9" }, konseptor: [{ pengguna: "nur", nama: "Nur Aisyah" }] });
    layanan._aturKueri(kueri, async () => {
      throw new Error("db");
    });
    expect((await layanan.putusanSerupa("1/Pdt.G/2026/PA.Dgl")).konseptor).toEqual([]);
  });
});

// ── Set saksi: jawaban hukum 17 Okt ────────────────────────────────────────
const semuaTeks = (s: ReturnType<typeof setCerai>) => [...s.pembuka, ...s.inti, ...s.penutup].map((b) => `${b.tanya} ${b.jawab} ${b.unsur}`).join(" ");

describe("set saksi: jawaban hukum 17 Okt", () => {
  it("pisah rumah 6 bulan dengan pengecualian KDRT (SEMA 1/2022 jo. SEMA 3/2023); huruf D menyebut pengecualiannya", () => {
    const f = setCerai("F");
    expect(semuaTeks(f)).toMatch(/paling singkat 6 bulan, kecuali terbukti ada KDRT/);
    expect(f.dasar.join(" ")).toMatch(/kecuali ditemukan fakta hukum Tergugat\/Penggugat melakukan KDRT/);
    expect(setCerai("D").dasar.join(" ")).toMatch(/syarat pisah 6 bulan tidak diberlakukan/);
    expect([...f.perluDicek, ...setCerai("D").perluDicek]).toEqual([]);
  });

  it("zina hanya cerai talak", () => {
    const cg = tawarkanSetSaksi({ namaJenis: "Cerai Gugat", huruf: "A" }).set[0];
    const ct = tawarkanSetSaksi({ namaJenis: "Cerai Talak", huruf: "A", sebutanP: "Pemohon" }).set[0];
    expect(cg.baris.map((b) => b.jawab).join(" ")).not.toMatch(/zina/i);
    expect(ct.baris.map((b) => b.jawab).join(" ")).toMatch(/berbuat zina/);
    expect(ct.dasar.join(" ")).toMatch(/li'an/);
    expect(ct.id).toBe("cerai-A-ct");
  });

  it("perwalian 18 tahun; pengangkatan anak Permensos 110/HUK/2009 (ragu tetap ditandai)", () => {
    const s = semuaSetSaksi();
    const pw = s.find((x) => x.id === "perwalian")!;
    expect(semuaTeks(pw as never)).toMatch(/belum berumur 18 tahun/);
    expect(semuaTeks(pw as never)).not.toMatch(/21 tahun/);
    expect(pw.perluDicek).toEqual([]);
    const an = s.find((x) => x.id === "pengangkatan-anak")!;
    expect(an.dasar.join(" ")).toMatch(/Permensos 110\/HUK\/2009/);
    expect(semuaTeks(an as never)).toMatch(/30-55 tahun, menikah paling singkat 5 tahun/);
    expect(an.perluDicek.join(" ")).toMatch(/JDIH BPK.*17 Okt 2026/);
  });

  it("itsbat menanyakan poligami tanpa izin (SEMA 3/2018); izin poligami menanyakan harta bersama isteri pertama", () => {
    const s = semuaSetSaksi();
    const it_ = s.find((x) => x.id === "itsbat")!;
    expect(semuaTeks(it_ as never)).toMatch(/masih mempunyai isteri lain/);
    expect(semuaTeks(it_ as never)).toMatch(/izin beristeri lebih dari seorang dari Pengadilan Agama/);
    expect(it_.dasar.join(" ")).toMatch(/SEMA 3\/2018/);
    expect(it_.perluDicek).toEqual([]);
    const ip = s.find((x) => x.id === "izin-poligami")!;
    expect(ip.inti.filter((b) => /harta|utang/i.test(b.tanya)).length).toBeGreaterThanOrEqual(3);
    expect(ip.dasar.join(" ")).toMatch(/Buku II/);
    expect(ip.perluDicek).toEqual([]);
  });

  it("sighat taklik menurut tahun nikah: sejak 1990 butir PMA 2/1990; sebelum 1990 bunyi buku nikah + tanda ragu", () => {
    const baru = tawarkanSetSaksi({ namaJenis: "Cerai Gugat", huruf: "G", tahunNikah: 2005 }).set[0];
    expect(baru.id).toBe("cerai-G");
    expect(baru.baris.map((b) => b.tanya).join(" ")).toMatch(/dua tahun berturut-turut/);
    expect(baru.perluDicek).toEqual([]);
    const lama = tawarkanSetSaksi({ namaJenis: "Cerai Gugat", huruf: "G", tahunNikah: 1984 }).set[0];
    expect(lama.id).toBe("cerai-G-sighat-lama");
    expect(lama.baris.map((b) => b.tanya).join(" ")).toMatch(/bunyi janji taklik talak yang tertulis di buku nikah/);
    expect(lama.perluDicek.join(" ")).toMatch(/belum terverifikasi/);
    // Tahun belum diketahui: kedua bentuk ditawarkan.
    expect(tawarkanSetSaksi({ namaJenis: "Cerai Gugat", huruf: "G" }).set.map((x) => x.id)).toEqual(expect.arrayContaining(["cerai-G", "cerai-G-sighat-lama"]));
  });

  it("tanda 'perlu dicek' yang sudah dijawab hilang (wali adhal PMA 30/2005 tetap)", () => {
    const wa = semuaSetSaksi().find((x) => x.id === "wali-adhal")!;
    expect(wa.perluDicek).toEqual([]);
    expect(wa.dasar.join(" ")).toMatch(/PMA 30\/2005/);
  });
});
