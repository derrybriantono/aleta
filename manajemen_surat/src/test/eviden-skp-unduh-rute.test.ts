// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DataEvidenSkp } from "@/lib/eviden-skp-tipe";
import { PESAN_PERIODE_BELUM_DIMULAI, namaDariDisposition } from "@/lib/eviden-skp-unduh";
import { tanggalPanjang } from "@/lib/tanggal-indonesia";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { simpanAksesEkstensi } from "@/server/modules/aleta-ecourt/akses";

import { bacaPdfUji, bacaZip, penandaZip } from "./eviden-skp-baca";
import { paketContoh } from "./eviden-skp-contoh";

/**
 * ============================================================================
 * GET /api/aleta-ecourt/eviden-skp/unduh - KEWENANGAN, ALAMAT, BERKAS
 * ============================================================================
 *
 * Handler sungguhan atas pg-mem berbenih, dengan pemeriksa kewenangan yang
 * SUNGGUHAN (pastikanKapabilitas "panel" - sama dengan rekap petugas) dan
 * Identitas Instansi sungguhan dari basis data. Yang ditiru hanya dua modul
 * agen data: ambilDataEvidenSkp (bot/SIPP) dan susunPaketEvidenSkp (katalog)
 * - kontraknya dari lib/eviden-skp-tipe.ts.
 *
 *   - tanpa sesi 401, panel dimatikan 403 - SEBELUM alamat dibaca dan SEBELUM
 *     data SIPP diminta
 *   - alamat salah 400 dengan kalimat yang menyebut ruasnya
 *   - data gagal: status dan kalimat bot diteruskan
 *   - PDF/Excel/Word: berkasnya, jenisnya, dan Content-Disposition ber-filename*
 *   - "semua": ZIP berisi SELURUH dokumen tersedia + KETERANGAN yang tidak
 *   - unduhan yang berhasil tercatat di jejak audit
 */

vi.mock("@/server/modules/aleta-ecourt/eviden-skp-data", () => ({ ambilDataEvidenSkp: vi.fn() }));
vi.mock("@/lib/eviden-skp-katalog", () => ({ susunPaketEvidenSkp: vi.fn(), DAFTAR_DOKUMEN_EVIDEN_SKP: [] }));

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-hakim";

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

const { ambilDataEvidenSkp } = await import("@/server/modules/aleta-ecourt/eviden-skp-data");
const { susunPaketEvidenSkp } = await import("@/lib/eviden-skp-katalog");
const ambil = vi.mocked(ambilDataEvidenSkp);
const susun = vi.mocked(susunPaketEvidenSkp);

const DATA = { ok: true } as unknown as DataEvidenSkp;

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
  aktor = "usr-hakim";
  ambil.mockReset();
  susun.mockReset();
  ambil.mockResolvedValue({ ok: true, data: DATA });
  susun.mockImplementation(() => paketContoh());
});

afterEach(async () => {
  await db?.close();
  db = null;
});

const DASAR = "peran=hakim&id=26&tahun=2026&periode=tw2";

async function panggil(kueri: string) {
  const { GET } = await import("@/app/api/aleta-ecourt/eviden-skp/unduh/route");
  return GET(new NextRequest(`http://localhost/api/aleta-ecourt/eviden-skp/unduh?${kueri}`));
}

async function galat(jawaban: Response) {
  const isi = (await jawaban.json()) as { ok: boolean; error?: { message?: string } };
  return { status: jawaban.status, ok: isi.ok, pesan: isi.error?.message ?? "" };
}

async function berkas(jawaban: Response) {
  return Buffer.from(await jawaban.arrayBuffer());
}

describe("kewenangan lebih dahulu - sama dengan rekap petugas", () => {
  it("tanpa sesi: 401, data SIPP tidak diminta", async () => {
    aktor = null;
    const r = await galat(await panggil(`${DASAR}&dokumen=rekap-perkara&format=pdf`));
    expect(r.status).toBe(401);
    expect(ambil).not.toHaveBeenCalled();
  });

  it("peran yang kemampuan panelnya dimatikan: 403, data SIPP tidak diminta", async () => {
    await simpanAksesEkstensi(db!, { actorUserId: "usr-super", roleId: "hakim", kapabilitas: "panel", aktif: false });
    const r = await galat(await panggil(`${DASAR}&dokumen=rekap-perkara&format=pdf`));
    expect(r.status).toBe(403);
    expect(r.pesan).toMatch(/tidak diberi akses/);
    expect(ambil).not.toHaveBeenCalled();
  });

  it("tanpa sesi DAN alamat salah tetap 401 - bentuk alamat tidak dibocorkan", async () => {
    aktor = null;
    const r = await galat(await panggil("peran=ketua&id=abc&format=exe"));
    expect(r.status).toBe(401);
  });
});

describe("alamat yang salah ditolak 400 tanpa meminta data", () => {
  const kasus: Array<[string, RegExp]> = [
    ["", /hanya hakim/],
    ["peran=panitera&id=26&tahun=2026&periode=tw2&dokumen=semua&format=pdf", /hanya hakim/],
    ["peran=hakim&id=abc&tahun=2026&periode=tw2&dokumen=semua&format=pdf", /ID SIPP/],
    ["peran=hakim&id=0&tahun=2026&periode=tw2&dokumen=semua&format=pdf", /ID SIPP/],
    ["peran=hakim&id=26&tahun=26&periode=tw2&dokumen=semua&format=pdf", /Tahun/],
    ["peran=hakim&id=26&tahun=1999&periode=tw2&dokumen=semua&format=pdf", /Tahun/],
    ["peran=hakim&id=26&tahun=2026&periode=tw5&dokumen=semua&format=pdf", /Periode/],
    ["peran=hakim&id=26&tahun=2026&periode=tw2&dokumen=../rahasia&format=pdf", /Dokumen/],
    ["peran=hakim&id=26&tahun=2026&periode=tw2&dokumen=&format=pdf", /Dokumen/],
    ["peran=hakim&id=26&tahun=2026&periode=tw2&dokumen=semua&format=exe", /Format/],
    ["peran=hakim&id=26&tahun=2026&periode=tw2&dokumen=semua&format=pdf&tanggal=2026-02-30", /Tanggal tanda tangan/],
    ["peran=hakim&id=26&tahun=2026&periode=tw2&dokumen=semua&format=pdf&tanggal=30-06-2026", /Tanggal tanda tangan/],
  ];
  for (const [kueri, pesan] of kasus) {
    it(`"${kueri || "(kosong)"}" -> 400`, async () => {
      const r = await galat(await panggil(kueri));
      expect(r.status).toBe(400);
      expect(r.pesan).toMatch(pesan);
      expect(ambil).not.toHaveBeenCalled();
    });
  }

  it("periode yang belum dimulai (menurut WITA) ditolak dengan kalimat yang sama dengan rute daftar", async () => {
    const tahunDepan = Number(waktuPengadilan().tanggal.slice(0, 4)) + 1;
    const r = await galat(await panggil(`peran=hakim&id=26&tahun=${tahunDepan}&periode=tw1&dokumen=semua&format=pdf`));
    expect(r.status).toBe(400);
    expect(r.pesan).toBe(PESAN_PERIODE_BELUM_DIMULAI);
    expect(ambil).not.toHaveBeenCalled();
  });
});

describe("data yang gagal dijawab dengan kalimat yang jelas", () => {
  it("bot/SIPP gagal: status dan kalimatnya diteruskan", async () => {
    ambil.mockResolvedValue({ ok: false, status: 503, alasan: "ALETA Bot belum dapat dihubungi." });
    const r = await galat(await panggil(`${DASAR}&dokumen=rekap-perkara&format=pdf`));
    expect(r).toMatchObject({ status: 503, ok: false, pesan: "ALETA Bot belum dapat dihubungi." });
    expect(susun).not.toHaveBeenCalled();
  });

  it("katalog gagal menyusun: 500 dengan sebabnya", async () => {
    susun.mockImplementation(() => {
      throw new Error("eviden-skp-katalog belum dibangun");
    });
    const r = await galat(await panggil(`${DASAR}&dokumen=rekap-perkara&format=pdf`));
    expect(r.status).toBe(500);
    expect(r.pesan).toContain("tidak dapat disusun");
    expect(r.pesan).toContain("belum dibangun");
  });

  it("dokumen tak dikenal 404; dokumen tidak tersedia 409 beserta sebabnya", async () => {
    const a = await galat(await panggil(`${DASAR}&dokumen=tidak-ada&format=pdf`));
    expect(a.status).toBe(404);
    expect(a.pesan).toContain('"tidak-ada"');
    const b = await galat(await panggil(`${DASAR}&dokumen=posbakum&format=docx`));
    expect(b.status).toBe(409);
    expect(b.pesan).toBe("Bukti dukung Posbakum bukan data SIPP - dilampirkan dari laporan Posbakum.");
  });

  it("tidak satu pun dokumen tersedia: ZIP ditolak 409, bukan ZIP kosong", async () => {
    susun.mockImplementation(() => paketContoh({ dokumen: [paketContoh().dokumen[3]] }));
    const r = await galat(await panggil(`${DASAR}&dokumen=semua&format=pdf`));
    expect(r.status).toBe(409);
    expect(r.pesan).toContain("Triwulan II Tahun 2026");
  });
});

describe("berkas yang diunduh", () => {
  it("PDF satu dokumen: jenis, nama berkas ber-filename*, isi, dan data diminta dengan parameter yang benar", async () => {
    const jawaban = await panggil(`${DASAR}&dokumen=rekap-perkara&format=pdf&tanggal=2026-06-30`);
    expect(jawaban.status).toBe(200);
    expect(jawaban.headers.get("content-type")).toBe("application/pdf");
    const cd = jawaban.headers.get("content-disposition") ?? "";
    expect(cd).toMatch(/^attachment; filename="[^"]+"; filename\*=UTF-8''/);
    // Petik tunggal disandikan di filename* - pemisah RFC 5987.
    expect(cd.split("filename*=UTF-8''")[1]).not.toContain("'");
    expect(namaDariDisposition(cd)).toBe("Eviden SKP 2026 - Triwulan II - Rekap Perkara - Hakim Contoh Ma'ruf, S.H.I., M.H.pdf");
    expect(jawaban.headers.get("x-content-type-options")).toBe("nosniff");
    expect(jawaban.headers.get("cache-control")).toContain("no-store");
    const isi = await berkas(jawaban);
    expect(isi.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(Number(jawaban.headers.get("content-length"))).toBe(isi.length);
    expect(ambil).toHaveBeenCalledWith({ peran: "hakim", id: "26", tahun: 2026, periode: "tw2" });
    expect(susun).toHaveBeenCalledWith(DATA);

    // Kop dan tempat tanda tangan dari Identitas Instansi di basis data - benih
    // pg-mem adalah PA Makassar, bukan Donggala yang ditulis mati.
    const teks = (await bacaPdfUji(isi)).map((h) => h.teks).join("\n");
    expect(teks).toContain("PENGADILAN AGAMA MAKASSAR KELAS IA");
    expect(teks).toContain("Makassar, 30 Juni 2026");
    expect(teks).toContain("Mengetahui,");
    expect(teks).toContain("Dr. Ketua Contoh, S.Ag., M.H.");
  });

  it("tanpa ?tanggal=: tanggal tanda tangan hari ini menurut WITA", async () => {
    const jawaban = await panggil(`${DASAR}&dokumen=rekap-minutasi&format=docx`);
    expect(jawaban.status).toBe(200);
    expect(jawaban.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    const dok = bacaZip(await berkas(jawaban)).get("word/document.xml")!.toString("utf8");
    expect(dok).toContain(`Makassar, ${tanggalPanjang(waktuPengadilan().tanggal)}`);
  });

  it("Excel satu dokumen: jenis dan nama berkas .xlsx", async () => {
    const jawaban = await panggil(`${DASAR}&dokumen=status-perkara&format=xlsx`);
    expect(jawaban.status).toBe(200);
    expect(jawaban.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(namaDariDisposition(jawaban.headers.get("content-disposition"))).toMatch(/ - Status Perkara - .*\.xlsx$/);
    expect(bacaZip(await berkas(jawaban)).has("xl/worksheets/sheet1.xml")).toBe(true);
  });

  it("semua (Word): ZIP berisi SELURUH dokumen tersedia, masing-masing DOCX sah, dan KETERANGAN yang tidak", async () => {
    const jawaban = await panggil(`${DASAR}&dokumen=semua&format=docx&tanggal=2026-06-30`);
    expect(jawaban.status).toBe(200);
    expect(jawaban.headers.get("content-type")).toBe("application/zip");
    expect(namaDariDisposition(jawaban.headers.get("content-disposition"))).toBe(
      "Eviden SKP 2026 - Triwulan II - Semua dokumen (Word) - Hakim Contoh Ma'ruf, S.H.I., M.H.zip"
    );
    const arsip = await berkas(jawaban);
    const isi = bacaZip(arsip);
    const tersedia = paketContoh().dokumen.filter((d) => d.tersedia);
    const docx = [...isi.keys()].filter((k) => k.endsWith(".docx")).sort();
    expect(docx).toEqual(
      [
        "Eviden SKP 2026 - Triwulan II - Rekap Minutasi - Hakim Contoh Ma'ruf, S.H.I., M.H.docx",
        "Eviden SKP 2026 - Triwulan II - Rekap Perkara - Hakim Contoh Ma'ruf, S.H.I., M.H.docx",
        "Eviden SKP 2026 - Triwulan II - Status Perkara - Hakim Contoh Ma'ruf, S.H.I., M.H.docx",
      ].sort()
    );
    expect(docx.length).toBe(tersedia.length);
    for (const nama of docx) {
      const dalam = bacaZip(isi.get(nama)!);
      expect(dalam.get("word/document.xml")!.toString("utf8"), nama).toContain("Mengetahui,");
    }
    const keterangan = isi.get("KETERANGAN.txt")!.toString("utf8");
    expect(keterangan).toContain("Laporan Posbakum Triwulan II Tahun 2026: Bukti dukung Posbakum bukan data SIPP");
    expect([...isi.keys()].length).toBe(tersedia.length + 1);
    // Nama ASCII: tanpa penanda UTF-8 (sama dengan arsip lama).
    expect([...penandaZip(arsip).values()].every((p) => p === 0)).toBe(true);
  });

  it("nama hakim dengan tanda kutip melengkung: nama di dalam ZIP tetap ASCII, tanpa huruf terlarang", async () => {
    susun.mockImplementation(() => {
      const paket = paketContoh();
      return { ...paket, orang: { ...paket.orang, nama: 'Nur’aini "Ina" / Ma<ruf>:' } };
    });
    const jawaban = await panggil(`${DASAR}&dokumen=semua&format=pdf`);
    const nama = [...bacaZip(await berkas(jawaban)).keys()].filter((k) => k.endsWith(".pdf"));
    expect(nama.length).toBe(3);
    for (const n of nama) {
      expect(n).not.toMatch(/[\\/:*?"<>|]/);
      expect(n).toContain("Nur'aini 'Ina' - Ma ruf");
    }
  });

  it("unduhan yang berhasil tercatat di jejak audit; yang gagal tidak tercatat sebagai unduhan", async () => {
    await panggil(`${DASAR}&dokumen=semua&format=pdf&tanggal=2026-06-30`);
    await panggil(`${DASAR}&dokumen=posbakum&format=pdf`);
    const baris = await db!
      .prepare("SELECT actor_user_id, entity_id, payload_json FROM audit_logs WHERE action = 'EVIDEN_SKP_UNDUH'")
      .all<{ actor_user_id: string; entity_id: string; payload_json: string }>();
    expect(baris.length).toBe(1);
    expect(baris[0].actor_user_id).toBe("usr-hakim");
    expect(baris[0].entity_id).toBe("hakim:26");
    const isi = JSON.parse(baris[0].payload_json);
    expect(isi).toMatchObject({ peran: "hakim", tahun: 2026, periode: "tw2", dokumen: "semua", format: "pdf", tanggalTandaTangan: "2026-06-30" });
    expect(isi.dokumenIkut).toEqual(["rekap-perkara", "status-perkara", "rekap-minutasi"]);
  });
});
