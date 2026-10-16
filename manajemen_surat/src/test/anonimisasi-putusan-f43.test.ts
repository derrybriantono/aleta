// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { anonimkanRtf, anonimkanTeks, bentukTanggal, buangInfoRtf, namaTanpaGelar, type EntitasAnonim } from "@/lib/anonimisasi-putusan";
import { petaRtf } from "@/lib/samarkan-sisa-rtf";
import { namaIntiDalamNaskah } from "@/server/modules/aleta-ecourt/unggah-naskah-putusan";

/**
 * ============================================================================
 * F4.3 (16 Okt 2026) - ANONIMISASI PUTUSAN MANDIRI ALETA
 * ============================================================================
 *
 * Diukur atas 251 pasangan putusan + anonimisasi yang SUDAH diunggah petugas
 * (PA Donggala 2025-2026, salinan baca-saja, data SIPP perkaranya):
 *
 *                               naskah asli   ABT/petugas   ALETA mandiri
 *   kemunculan nama pihak          2.695          718            0
 *   kemunculan nama saksi            876          325            0
 *   kemunculan nama anak             421          176            0
 *   NIK 16 angka                     889          349            0
 *   perkara dengan nama bocor          -     139 (55%)            0
 *   nama majelis/PP/kuasa          2.227        2.224        2.227 (utuh)
 *   lolos penjaga unggah-sipp          -     147 (59%)     251 (100%)
 *
 * Salah samar terukur (diperiksa tangan atas daftar penggantian di luar data
 * SIPP): klausa alamat tanpa "di" ("kediaman bersama adalah Tergugat") - 130+
 * pada ukuran pertama, kini wajib "di"/titik dua; kata umum penanda kutipan
 * (imam, ibnu, firman, syar'i) menahan nama orang perkara dan tidak satu pun
 * menandai kutipan sungguhan - kini hanya penanda khas; nama SIPP yang juga
 * kata biasa ("Kuat", "Minggu") hanya disamarkan bila ditulis seperti nama.
 *
 * Nama, NIK, nomor di uji ini karangan.
 */

const ENTITAS: EntitasAnonim = {
  sebutan: { satu: "Penggugat", dua: "Tergugat" },
  pihak: [
    {
      pihakKe: 1,
      urutan: 1,
      nama: "Sulastri Andini binti Muh. Idris",
      nik: "7203014101900001",
      telepon: "081234567890",
      tanggalLahir: "1990-01-01",
      pekerjaan: "Petani",
      alamat: "Dusun II Lorong Mawar",
    },
    { pihakKe: 2, urutan: 1, nama: "Rahmat Hidayat bin La Ode Hamzah", nik: "7203010202880002", tanggalLahir: "1988-02-02" },
  ],
  saksi: [
    { nama: "Kuat bin Darmo", urutan: 2 },
    { nama: "Haeruddin bin Lagu", urutan: 1 },
  ],
  anak: [{ nama: "Rasya Putra", tanggalLahir: "2015-05-12" }],
  lindungi: [
    { peran: "hakim", nama: "Drs. H. Sudarmin Tang, M.H." },
    { peran: "hakim", nama: "Idris, S.H.I., M.H." },
    { peran: "panitera", nama: "Qadariyah Sari, S.H." },
    { peran: "kuasa", nama: "Andi Baso Pratama, S.H." },
  ],
};

const NASKAH = [
  "PUTUSAN",
  "Nomor 123/Pdt.G/2026/PA.Dgl",
  "Sulastri Andini binti Muh. Idris, NIK 7203014101900001, tempat dan tanggal lahir Donggala, 01 Januari 1990, agama Islam, pekerjaan Petani, tempat kediaman di Dusun II Lorong Mawar, Desa Towale, Kecamatan Banawa, Kabupaten Donggala, sebagai Penggugat;",
  "dalam hal ini memberi kuasa kepada Andi Baso Pratama, S.H., advokat;",
  "melawan",
  "Rahmat Hidayat bin La Ode Hamzah, umur 38 tahun, agama Islam, pekerjaan Sopir, bertempat tinggal di Jalan Poros Palu, RT 002/RW 003, Kelurahan Kabonga, Kecamatan Banawa, Kabupaten Donggala, sebagai Tergugat;",
  "Bahwa Penggugat dan Tergugat dikaruniai seorang anak bernama Rasya Putra bin RAHMAT HIDAYAT, lahir di Palu, tanggal 12 Mei 2015, sekarang sekolah di SD Negeri 3 Towale;",
  "Bahwa Tergugat bekerja sebagai sopir truk dan pernah dihubungi di nomor 0812-3456-7890 atau sulastri.andini@gmail.com, serta rekening BRI nomor 1234-01-000123-50-1;",
  "Bahwa tempat kediaman bersama adalah Tergugat, hal ini merupakan bukti yang kuat;",
  "Penggugat menghadirkan saksi-saksi sebagai berikut:",
  "1. Haeruddin bin Lagu, umur 45 tahun, tetangga Penggugat;",
  "2. Kuat bin Darmo, umur 50 tahun, paman Penggugat; saksi menikah dengan Nurmi binti Sakka;",
  "3. Wahyuni binti Ambo Dalle, umur 33 tahun, sepupu Penggugat;",
  "Menimbang, bahwa saksi Haeruddin dan saksi Wahyuni menerangkan hal yang sama;",
  "Menimbang, bahwa sesuai hadis riwayat Bukhari dari Abdullah bin Umar, perceraian dibenci Allah;",
  "Demikian diputuskan oleh Drs. H. Sudarmin Tang, M.H. sebagai Ketua Majelis, Idris, S.H.I., M.H. sebagai Hakim Anggota, dibantu Qadariyah Sari, S.H. sebagai Panitera Pengganti; email pengadilan pa.donggala@gmail.com, laman pa-donggala.go.id",
].join("\n");

function rtfDari(teks: string): string {
  const isi = teks
    .split("\n")
    .map((p) => `{\\b0 ${p.replace(/\\/g, "\\\\").replace(/[{}]/g, (c) => `\\${c}`)}}\\par`)
    .join("\n");
  return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Times New Roman;}}{\\info{\\title Putusan Sulastri Andini}{\\author pp}}\n${isi}\n}`;
}

describe("F4.3 penyamar mandiri - teks", () => {
  const h = anonimkanTeks(NASKAH, ENTITAS);
  const t = h.teks;

  it("pihak menjadi sebutan; nasab anak memakai sebutan pihak", () => {
    expect(t).toContain("PENGGUGAT, NIK xxxxxxxxxxxxxxxx");
    expect(t).toContain("TERGUGAT, umur 38 tahun");
    expect(t).toContain("anak bernama ANAK I bin TERGUGAT");
    expect(t).not.toMatch(/Sulastri|Andini|Rahmat|Hidayat|Hamzah|Rasya/i);
  });

  it("saksi diberi nomor menurut urutan muncul, termasuk saksi yang tidak tercatat di SIPP", () => {
    expect(t).toContain("1. SAKSI I, umur 45 tahun");
    expect(t).toContain("2. SAKSI II, umur 50 tahun");
    // Wahyuni tidak tercatat di SIPP: dikenali dari pola "X binti Y, umur" sesudah daftar saksi.
    expect(t).toMatch(/3\. SAKSI III binti xxx, umur 33 tahun|3\. SAKSI III, umur 33 tahun/);
    expect(t).toContain("saksi SAKSI I dan saksi SAKSI III menerangkan");
    expect(t).not.toMatch(/Haeruddin|Wahyuni|Darmo|Ambo Dalle/);
    // Orang lain (istri saksi) disamarkan "xxx".
    expect(t).toContain("menikah dengan xxx binti xxx");
  });

  it("nama majelis, panitera, dan kuasa tetap; nama ayah 'Muh. Idris' tetap disamarkan walau hakim bernama Idris", () => {
    expect(t).toContain("Drs. H. Sudarmin Tang, M.H. sebagai Ketua Majelis");
    expect(t).toContain("Idris, S.H.I., M.H. sebagai Hakim Anggota");
    expect(t).toContain("Qadariyah Sari, S.H. sebagai Panitera Pengganti");
    expect(t).toContain("kuasa kepada Andi Baso Pratama, S.H.");
    expect(t).not.toContain("binti Muh. Idris");
  });

  it("NIK, telepon, email pribadi, rekening, tanggal & tempat lahir, pekerjaan, sekolah disamarkan", () => {
    expect(t).not.toMatch(/7203014101900001|7203010202880002|0812-3456-7890|sulastri\.andini|000123/);
    expect(t).toContain("tempat dan tanggal lahir xxx, xxx");
    expect(t).toContain("lahir di xxx, tanggal xxx");
    expect(t).toContain("pekerjaan xxx, tempat kediaman");
    expect(t).toContain("bekerja sebagai xxx dan");
    expect(t).toContain("sekolah di xxx;");
    // Email & laman pengadilan tetap.
    expect(t).toContain("pa.donggala@gmail.com");
  });

  it("alamat cukup kabupaten; kalimat biasa tentang kediaman tidak tersentuh", () => {
    expect(t).toContain("tempat kediaman di xxx, Kabupaten Donggala, sebagai Penggugat");
    expect(t).toContain("bertempat tinggal di xxx, Kabupaten Donggala, sebagai Tergugat");
    expect(t).not.toMatch(/Towale|Kabonga|Mawar|Poros Palu/);
    expect(t).toContain("tempat kediaman bersama adalah Tergugat, hal ini merupakan bukti yang kuat");
  });

  it("kutipan hadis tidak disamarkan, tetapi dicatat untuk diperiksa", () => {
    expect(t).toContain("dari Abdullah bin Umar");
    expect(h.dilewati.some((d) => /Abdullah bin Umar/.test(d.kata))).toBe(true);
  });

  it("tidak ada sisa data SIPP; penjaga unggah-sipp meloloskan hasilnya", () => {
    expect(h.sisa).toEqual([]);
    expect(namaIntiDalamNaskah(t, ENTITAS.pihak.map((p) => p.nama))).toEqual([]);
  });

  it("pihak lebih dari satu di satu sisi diberi nomor; perkara permohonan memakai PEMOHON", () => {
    const e: EntitasAnonim = {
      sebutan: { satu: "Pemohon", dua: "Termohon" },
      pihak: [
        { pihakKe: 1, urutan: 1, nama: "Budiman Saleh" },
        { pihakKe: 1, urutan: 2, nama: "Nurhaliza Kamal" },
      ],
    };
    const x = anonimkanTeks("Budiman Saleh dan Nurhaliza Kamal, selanjutnya disebut Pemohon I dan Pemohon II", e).teks;
    expect(x).toBe("PEMOHON I dan PEMOHON II, selanjutnya disebut Pemohon I dan Pemohon II");
  });
});

describe("F4.3 penyamar mandiri - RTF", () => {
  const rtf = rtfDari(NASKAH);
  const h = anonimkanRtf(rtf, ENTITAS);

  it("hasil RTF terbaca sama dengan teks hasil; format dan paragraf tetap", () => {
    const ulang = petaRtf(h.rtf).teks;
    expect(ulang.replace(/\s+/g, " ")).toBe(h.teks.replace(/\s+/g, " "));
    expect(h.rtf.startsWith("{\\rtf1")).toBe(true);
    expect((h.rtf.match(/\\par/g) ?? []).length).toBe((rtf.match(/\\par/g) ?? []).length);
  });

  it("grup \\info (judul dokumen memuat nama pihak) dibuang", () => {
    expect(h.rtf).not.toContain("Sulastri");
    expect(buangInfoRtf("{\\rtf1{\\info{\\title A}}x}")).toBe("{\\rtf1x}");
  });

  it("potongan pratinjau menandai tiap samaran beserta jenisnya; ringkasan per jenis", () => {
    expect(h.potongan.map((p) => p.t).join("")).toBe(h.teks);
    expect(h.potongan.filter((p) => p.j === "nama pihak").length).toBeGreaterThanOrEqual(3);
    expect(h.ringkas["NIK"]).toBeGreaterThanOrEqual(1);
    expect(h.ringkas["alamat"]).toBeGreaterThanOrEqual(2);
  });
});

describe("F4.3 pembantu", () => {
  it("nama tanpa gelar", () => {
    expect(namaTanpaGelar("Drs. H. Ahmad Yani, M.H.")).toBe("Ahmad Yani");
    expect(namaTanpaGelar("Hj. Siti Aminah")).toBe("Siti Aminah");
  });
  it("bentuk tanggal lahir di naskah", () => {
    expect(bentukTanggal("1990-01-05")).toEqual(expect.arrayContaining(["05 Januari 1990", "5 Januari 1990", "05-01-1990"]));
    expect(bentukTanggal("")).toEqual([]);
  });
  it("nama SIPP yang juga kata biasa hanya disamarkan bila ditulis seperti nama", () => {
    const e: EntitasAnonim = { pihak: [{ pihakKe: 1, nama: "Ani Lestari" }], saksi: [{ nama: "Minggu" }] };
    const x = anonimkanTeks("saksi nikah bernama Minggu; sidang hari Minggu; bukti yang kuat", e).teks;
    expect(x).toBe("saksi nikah bernama SAKSI I; sidang hari Minggu; bukti yang kuat");
  });
});

// ── Rute ────────────────────────────────────────────────────────────────────
const keadaan = vi.hoisted(() => ({ entitas: null as unknown, galat: "" }));
vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({ pastikanKapabilitas: async () => ({}) }));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (galat: unknown) => {
    throw galat;
  },
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  getGatewaySippEntitasAnonim: async () => (keadaan.galat ? { ok: false, error: keadaan.galat } : { ok: true, data: keadaan.entitas }),
}));

async function panggil(badan: Record<string, unknown>) {
  const mod = await import("@/app/api/aleta-ecourt/putusan/anonim-mandiri/route");
  const p = new Request("http://uji.local/aleta/api/aleta-ecourt/putusan/anonim-mandiri", {
    method: "POST",
    body: JSON.stringify(badan),
    headers: { "Content-Type": "application/json" },
  });
  const jawab = await mod.POST(p as unknown as Parameters<typeof mod.POST>[0]);
  return ((await jawab.json()) as { data: Record<string, any> }).data;
}

describe("rute anonim-mandiri", () => {
  beforeEach(() => {
    keadaan.entitas = { ok: true, ...ENTITAS, tidakTerbaca: [] };
    keadaan.galat = "";
  });

  it("memulangkan RTF tersamar - nilai mentah SIPP tidak ikut dikirim", async () => {
    const d = await panggil({ rtfBase64: Buffer.from(rtfDari(NASKAH), "latin1").toString("base64"), nomorPerkara: "123/Pdt.G/2026/PA.Dgl" });
    expect(d.ok).toBe(true);
    const rtf = Buffer.from(d.rtfBase64, "base64").toString("latin1");
    expect(rtf).toContain("PENGGUGAT");
    expect(JSON.stringify(d)).not.toMatch(/7203014101900001|081234567890|Sulastri/);
    expect(d.ringkas["nama pihak"]).toBeGreaterThan(0);
  });

  it("SIPP tidak terbaca -> ok:false (ekstensi jatuh ke anonimisasi ABT)", async () => {
    keadaan.galat = "aleta_bot tidak dapat dihubungi";
    const d = await panggil({ rtfBase64: Buffer.from(rtfDari(NASKAH), "latin1").toString("base64"), nomorPerkara: "123/Pdt.G/2026/PA.Dgl" });
    expect(d.ok).toBe(false);
    expect(d.sebab).toMatch(/SIPP belum terbaca/);
  });

  it("bukan RTF ditolak", async () => {
    const d = await panggil({ rtfBase64: Buffer.from("%PDF-1.4").toString("base64"), nomorPerkara: "123/Pdt.G/2026/PA.Dgl" });
    expect(d.ok).toBe(false);
  });
});
