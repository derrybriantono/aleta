// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { buatPenulisZip, susunZip, type BerkasZip } from "@/server/shared/zip";

/**
 * ============================================================================
 * BUTIR 25 (6 Okt 2026) - "Unduh seluruh berkas" jangan sampai Failed to fetch
 * ============================================================================
 *
 * Terukur di peladen: ZIP 445/Pdt.G/2026/PA.Dgl (51 berkas, 25.818.199 byte)
 * tersusun dalam 1 detik, tetapi Apache hanya sempat mengirim 11,5-12,9 MB
 * sebelum sambungannya diputus sisi peramban - enam kali. Tombol lama
 * memanggil fetch() dan menunggu seluruh ZIP sebagai blob.
 *
 * Yang dijaga di sini DIJALANKAN, bukan dibaca:
 *   - rute MENGALIRKAN ZIP: jawabannya sudah kembali dan potongan pertama sudah
 *     terbaca SEBELUM berkas terakhir selesai ditarik dari bot;
 *   - peramban yang menutup unduhan menghentikan penarikan berkas sisanya;
 *   - penulis bertahap menghasilkan byte yang SAMA PERSIS dengan susunZip;
 *   - kepala jawaban: attachment, tanpa Content-Length palsu, cookie token.
 */

const keadaan = vi.hoisted(() => ({
  arsip: null as unknown,
  gerbang: null as Promise<void> | null,
  ditarik: [] as string[],
}));

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({
  pastikanKapabilitas: async () => ({ name: "Penguji" }),
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/shared/ids", () => ({ nextPrefixedId: async () => "adt_uji" }));
vi.mock("@/server/shared/audit", () => ({ appendAuditLog: async () => undefined }));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (galat: unknown) => {
    throw galat;
  },
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  getGatewayStatusPerkara: async () => ({ ok: false, error: "tidak dipakai" }),
  getGatewayRincianSidang: async () => ({ ok: false, error: "tidak dipakai" }),
  getGatewayArsipRincian: async () => keadaan.arsip,
  ambilBerkasSippGateway: async () => new Response("x", { status: 404 }),
  ambilBerkasGateway: async (kunci: string) => {
    keadaan.ditarik.push(kunci);
    // Berkas ketiga dan seterusnya menunggu gerbang dibuka oleh uji.
    if (keadaan.ditarik.length >= 3 && keadaan.gerbang) await keadaan.gerbang;
    // 64 KB per berkas - cukup untuk melihat potongan mengalir.
    return new Response(new Uint8Array(64 * 1024).fill(kunci.charCodeAt(kunci.length - 1)), {
      headers: { "content-disposition": `attachment; filename="${kunci}.pdf"` },
    });
  },
}));

function arsipPalsu(jumlah: number) {
  return {
    ok: true,
    data: {
      nomorPerkara: "445/Pdt.G/2026/PA.Dgl",
      dokumen: Array.from({ length: jumlah }, (_, i) => ({
        documentKey: `dok${i + 1}`,
        judulDokumen: `Dokumen ${i + 1}`,
        adaPdf: true,
        adaWord: false,
      })),
    },
  };
}

async function panggil(kueri: string) {
  // Tanpa resetModules: memuat ulang rute tiap panggilan memakan detik, dan
  // uji pertama mengukur waktu jawab - yang diukur harus rutenya, bukan
  // penyusunan modulnya.
  const mod = await import("@/app/api/aleta-ecourt/berkas-zip/route");
  const permintaan = { nextUrl: new URL(`http://uji.local/api/aleta-ecourt/berkas-zip${kueri}`) };
  return mod.GET(permintaan as unknown as Parameters<typeof mod.GET>[0]);
}

/** Menunggu janji atau menyerah - membedakan "mengalir" dari "menunggu semuanya". */
function atauHabisWaktu<T>(janji: Promise<T>, ms: number) {
  return Promise.race([janji, new Promise<"habis">((r) => setTimeout(() => r("habis"), ms))]);
}

beforeAll(async () => {
  await import("@/app/api/aleta-ecourt/berkas-zip/route");
}, 60_000);

beforeEach(() => {
  keadaan.arsip = arsipPalsu(5);
  keadaan.gerbang = null;
  keadaan.ditarik = [];
});

describe("butir 25 - ZIP dialirkan, bukan dikirim sekaligus", () => {
  it("jawaban kembali dan potongan pertama terbaca SEBELUM berkas ketiga selesai ditarik", async () => {
    let buka: () => void = () => {};
    keadaan.gerbang = new Promise<void>((r) => {
      buka = r;
    });

    const jawaban = await atauHabisWaktu(panggil("?nomor=445/Pdt.G/2026/PA.Dgl&sumber=ecourt&isi=berkas"), 3000);
    // Rute lama menyusun ZIP utuh dulu: dengan gerbang tertutup ia tidak
    // pernah menjawab, dan uji ini habis waktu di sini.
    expect(jawaban).not.toBe("habis");
    const res = jawaban as Response;
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="ecourt-445-Pdt\.G-2026-PA\.Dgl\.zip"/);
    // Tanpa Content-Length: panjangnya baru diketahui di akhir aliran.
    expect(res.headers.get("content-length")).toBeNull();

    const pembaca = res.body!.getReader();
    const pertama = await pembaca.read();
    expect(pertama.done).toBe(false);
    // Kepala lokal ZIP (PK\x03\x04) sudah sampai - selagi berkas ketiga masih ditahan.
    expect(Buffer.from(pertama.value!).subarray(0, 4).toString("hex")).toBe("504b0304");
    expect(keadaan.ditarik.length).toBeLessThanOrEqual(3);

    buka();
    const potongan: Uint8Array[] = [pertama.value!];
    for (;;) {
      const { done, value } = await pembaca.read();
      if (done) break;
      potongan.push(value!);
    }
    const zip = Buffer.concat(potongan);
    // Lima dokumen + DAFTAR ISI + KETERANGAN, dan penutup ZIP di akhir.
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
    expect(zip.readUInt16LE(zip.length - 22 + 10)).toBe(7);
    expect(keadaan.ditarik).toEqual(["dok1", "dok2", "dok3", "dok4", "dok5"]);
  });

  it("peramban menutup unduhan di tengah: berkas sisanya TIDAK ditarik lagi dari bot", async () => {
    let buka: () => void = () => {};
    keadaan.gerbang = new Promise<void>((r) => {
      buka = r;
    });
    keadaan.arsip = arsipPalsu(8);

    const res = (await panggil("?nomor=445/Pdt.G/2026/PA.Dgl&sumber=ecourt&isi=berkas")) as Response;
    const pembaca = res.body!.getReader();
    await pembaca.read();
    await pembaca.cancel();
    buka();
    await new Promise((r) => setTimeout(r, 50));
    // dok3 sudah dalam perjalanan saat ditutup; dok4-dok8 tidak pernah diminta.
    expect(keadaan.ditarik.length).toBeLessThanOrEqual(3);
  });

  it("token dari tombol dipulangkan sebagai cookie penanda; token yang tidak sah diabaikan", async () => {
    const sah = await panggil("?nomor=445/Pdt.G/2026/PA.Dgl&sumber=ecourt&isi=berkas&token=abc123def456");
    expect(sah.headers.get("set-cookie")).toMatch(/^aleta_unduh_abc123def456=1; Path=\/; Max-Age=300; SameSite=Lax/);
    await sah.arrayBuffer();

    const nakal = await panggil("?nomor=445/Pdt.G/2026/PA.Dgl&sumber=ecourt&isi=berkas&token=a%3Bb%0Ac");
    expect(nakal.headers.get("set-cookie")).toBeNull();
    await nakal.arrayBuffer();
  });

  it("perkara tanpa satu berkas pun tetap dijawab 404 berpesan, bukan ZIP kosong", async () => {
    keadaan.arsip = { ok: false, error: "gateway mati" };
    const res = await panggil("?nomor=445/Pdt.G/2026/PA.Dgl&sumber=ecourt&isi=berkas&token=abc123def456");
    expect(res.status).toBe(404);
    expect(res.headers.get("set-cookie")).toBeNull();
    const badan = await res.json();
    expect(badan.alasan).toBe("tidak_ada_berkas_tersimpan");
  });
});

describe("penulis ZIP bertahap", () => {
  it("byte demi byte SAMA dengan susunZip atas daftar yang sama", () => {
    const daftar: BerkasZip[] = [
      { nama: "01 Gugatan/gugatan.pdf", isi: Buffer.from("%PDF-1.4 gugatan") },
      { nama: "../jahat.txt", isi: Buffer.from("jalur menaik dibersihkan") },
      { nama: "", isi: Buffer.from("tanpa nama dilewati") },
      { nama: "06 e-Court/Ma’ruf.pdf", isi: Buffer.alloc(70_000, 7) },
    ];
    const penulis = buatPenulisZip();
    const potongan = daftar.flatMap((b) => penulis.tambah(b));
    potongan.push(penulis.tutup());
    expect(Buffer.concat(potongan).equals(susunZip(daftar))).toBe(true);
    expect(penulis.jumlah).toBe(3);
  });
});

describe("penjaga teks: jalur fetch + blob tidak kembali", () => {
  const akar = path.resolve(process.cwd(), "src");
  const baca = (f: string) => readFileSync(path.join(akar, f), "utf8");
  /** Kode tanpa komentar - komentarnya memang menceritakan fetch() lama. */
  const kode = (f: string) =>
    baca(f)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

  it("tombol ZIP memakai unduhan biasa peramban (mulaiUnduhAlir), tanpa fetch dan tanpa blob", () => {
    const tombol = kode("components/portal/tombol-unduh-zip.tsx");
    expect(tombol).toContain('import { mulaiUnduhAlir } from "@/lib/unduh-alir";');
    expect(tombol).toContain("await mulaiUnduhAlir(");
    expect(tombol).not.toMatch(/\bfetch\(/);
    expect(tombol).not.toMatch(/\.blob\(\)/);
    expect(tombol).not.toContain("tanganiUnduhan");
  });

  it("rute tidak lagi menyusun ZIP utuh di memori", () => {
    const rute = kode("app/api/aleta-ecourt/berkas-zip/route.ts");
    expect(rute).toContain("buatPenulisZip()");
    expect(rute).toContain("new ReadableStream");
    expect(rute).not.toMatch(/susunZip\(/);
    expect(rute).not.toContain('"Content-Length"');
  });

  it('tulisan tombol Status Perkara "Unduh seluruh berkas", bukan "Unduh seluruh perkara"', () => {
    const tombol = baca("components/portal/tombol-unduh-zip.tsx");
    const layar = baca("components/portal/aleta-ecourt-status-perkara.tsx");
    expect(tombol).toContain('export const LABEL_UNDUH_SELURUH = "Unduh seluruh berkas";');
    expect(layar).not.toContain('"Unduh seluruh perkara"');
  });
});
