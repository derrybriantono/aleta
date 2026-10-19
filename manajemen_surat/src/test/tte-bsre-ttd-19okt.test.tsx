/**
 * ============================================================================
 * TTE BSrE DI HALAMAN TANDA TANGAN PEJABAT - 19 OKTOBER 2026
 * ============================================================================
 *
 * Tombol "Passphrase TTE" dipindah dari panel ekstensi ke pengaturan Tanda
 * tangan pejabat. Yang dijaga:
 *   - status sambungan BSrE ditulis jujur (belum tersambung / tersambung /
 *     tidak terbaca);
 *   - per pejabat: cara tanda tangan (gambar disahkan bawaan / TTE BSrE
 *     nonaktif selama belum tersambung) + identitas sertifikat (NIK/ID);
 *   - PASSPHRASE TIDAK DISIMPAN: tidak ada kolom, tidak ada isian, badan yang
 *     memuatnya ditolak, dan keterangannya tertulis di halaman;
 *   - hak: Admin mengatur; pejabat hanya melihat miliknya sendiri.
 */
import { createRequire } from "node:module";
import path from "node:path";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { KETERANGAN_PASSPHRASE, bentukBarisTte, nikBsreSah, petaTteSaya, type BarisTteMentah } from "@/lib/tte-bsre";

const { AletaEcourtTte } = await import("@/components/portal/aleta-ecourt-tte");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const BARIS: BarisTteMentah[] = [
  { id: 7, namaPejabat: "HIMAWAN TATURA WIJAYA, S.H.I., M.H.", jabatan: "Hakim", disahkan: true, penggunaId: "usr-himawan", caraTtd: "gambar", nikBsre: "" },
  { id: 33, namaPejabat: "MUNIFA, S.H.", jabatan: "Panitera Muda Hukum", disahkan: true, penggunaId: "usr-munifa", caraTtd: "gambar", nikBsre: "7201123456780001" },
  { id: 5, namaPejabat: "", jabatan: "", disahkan: false, penggunaId: "", caraTtd: "gambar", nikBsre: "" },
  { id: 12, namaPejabat: "SUDARMIN", jabatan: "Wakil Ketua", disahkan: false, penggunaId: "", caraTtd: "gambar", nikBsre: "" },
];

describe("penyaring hak (murni)", () => {
  it("admin melihat semua yang bernama; yang tanpa nama tidak tampil", () => {
    const hasil = petaTteSaya(BARIS, { admin: true, penggunaId: "usr-super" });
    expect(hasil.map((b) => b.id)).toEqual([7, 33, 12]);
  });

  it("pejabat biasa hanya melihat baris yang ditautkan ke akunnya", () => {
    expect(petaTteSaya(BARIS, { admin: false, penggunaId: "usr-munifa" }).map((b) => b.id)).toEqual([33]);
    expect(petaTteSaya(BARIS, { admin: false, penggunaId: "usr-orang-lain" })).toEqual([]);
    expect(petaTteSaya(BARIS, { admin: false, penggunaId: "" })).toEqual([]);
  });

  it("NIK hanya dikirim ke admin dan pemiliknya", () => {
    const m = BARIS[1];
    expect(bentukBarisTte(m, { admin: false, penggunaId: "usr-munifa" }).nikBsre).toBe("7201123456780001");
    expect(bentukBarisTte(m, { admin: true, penggunaId: "usr-super" }).nikBsre).toBe("7201123456780001");
    expect(bentukBarisTte(m, { admin: false, penggunaId: "usr-lain" }).nikBsre).toBe("");
  });

  it("bentuk baris tidak punya tempat untuk passphrase", () => {
    const b = bentukBarisTte({ ...BARIS[1], passphrase: "rahasia" } as BarisTteMentah, { admin: true, penggunaId: "x" });
    expect(Object.keys(b).join(",")).not.toMatch(/pass|sandi/i);
    expect(JSON.stringify(b)).not.toContain("rahasia");
  });

  it("NIK/ID BSrE: kosong sah; 5-32 huruf/angka/titik/garis sah; sisanya tidak", () => {
    expect(nikBsreSah("")).toBe(true);
    expect(nikBsreSah("7201123456780001")).toBe(true);
    expect(nikBsreSah("abc")).toBe(false);
    expect(nikBsreSah("a b c d e")).toBe(false);
    expect(nikBsreSah("x".repeat(33))).toBe(false);
  });
});

function jawab(badan: unknown, status = 200) {
  return new Response(JSON.stringify(badan), { status, headers: { "Content-Type": "application/json" } });
}

function pasangFetch(get: () => Response, post?: (badan: Record<string, unknown>) => Response) {
  const kiriman: Array<Record<string, unknown>> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_alamat: string, opsi?: RequestInit) => {
      if (opsi?.method === "POST") {
        const badan = JSON.parse(String(opsi.body)) as Record<string, unknown>;
        kiriman.push(badan);
        return post ? post(badan) : jawab({ ok: true });
      }
      return get();
    })
  );
  return kiriman;
}

const GET_ADMIN = (statusBsre = "belum") => () =>
  jawab({
    ok: true,
    data: {
      admin: true,
      statusBsre,
      baris: [7, 33, 12].map((id) => bentukBarisTte(BARIS.find((b) => b.id === id)!, { admin: true, penggunaId: "usr-super" })),
    },
  });

describe("layar - admin", () => {
  it("menulis status BSrE jujur dan keterangan passphrase yang diminta pengguna", async () => {
    pasangFetch(GET_ADMIN("belum"));
    render(<AletaEcourtTte />);
    await screen.findByText(/TTE \(Tanda Tangan Elektronik tersertifikasi BSrE\)/);
    expect((await screen.findByTestId("status-bsre")).textContent).toBe(
      "BSrE belum tersambung; dokumen memakai gambar tanda tangan yang disahkan."
    );
    expect(screen.getByTestId("keterangan-passphrase").textContent).toBe(
      "Passphrase diminta kepada pejabat setiap kali menandatangani dan tidak disimpan."
    );
    expect(KETERANGAN_PASSPHRASE).toBe("Passphrase diminta kepada pejabat setiap kali menandatangani dan tidak disimpan.");
    expect(document.body.textContent).toContain("bukan di panel petugas");
  });

  it("per pejabat: pilihan cara; TTE BSrE nonaktif selama belum tersambung; kolom NIK/ID; TIDAK ada kolom passphrase", async () => {
    pasangFetch(GET_ADMIN("belum"));
    render(<AletaEcourtTte />);
    await screen.findByTestId("tte-baris-7");
    expect(screen.getAllByTestId(/^tte-baris-/)).toHaveLength(3);
    const pilih = screen.getByLabelText("Cara tanda tangan MUNIFA, S.H.") as HTMLSelectElement;
    expect(pilih.value).toBe("gambar");
    const opsiTte = Array.from(pilih.options).find((o) => o.value === "tte")!;
    expect(opsiTte.disabled).toBe(true);
    expect(Array.from(pilih.options).find((o) => o.value === "gambar")!.textContent).toMatch(/Gambar tanda tangan disahkan/);
    expect((screen.getByLabelText("NIK atau ID pengguna BSrE MUNIFA, S.H.") as HTMLInputElement).value).toBe("7201123456780001");
    expect(document.querySelector('input[type="password"]')).toBeNull();
    // Tidak ada isian bernama passphrase/sandi (keterangan "bukan passphrase" pada label NIK sah).
    for (const el of Array.from(document.querySelectorAll("input, textarea"))) {
      expect(`${el.getAttribute("aria-label") ?? ""} ${el.getAttribute("placeholder") ?? ""} ${el.getAttribute("name") ?? ""} ${el.getAttribute("type") ?? ""}`).not.toMatch(/passphrase|sandi|password/i);
    }
  });

  it("BSrE tersambung: opsi TTE BSrE aktif", async () => {
    pasangFetch(GET_ADMIN("tersambung"));
    render(<AletaEcourtTte />);
    const pilih = (await screen.findByLabelText("Cara tanda tangan MUNIFA, S.H.")) as HTMLSelectElement;
    expect(Array.from(pilih.options).find((o) => o.value === "tte")!.disabled).toBe(false);
    expect((await screen.findByTestId("status-bsre")).textContent).toBe("BSrE tersambung.");
  });

  it("status tidak terbaca ditulis sebagai tidak terbaca, bukan 'belum tersambung'", async () => {
    pasangFetch(GET_ADMIN("tidak-terbaca"));
    render(<AletaEcourtTte />);
    await waitFor(() => expect(screen.getByTestId("status-bsre").textContent).toMatch(/tidak terbaca/));
  });

  it("menyimpan NIK mengirim HANYA id, caraTtd, nikBsre - tanpa passphrase", async () => {
    const kiriman = pasangFetch(GET_ADMIN("tersambung"));
    render(<AletaEcourtTte />);
    const nik = (await screen.findByLabelText("NIK atau ID pengguna BSrE HIMAWAN TATURA WIJAYA, S.H.I., M.H.")) as HTMLInputElement;
    fireEvent.change(nik, { target: { value: "7201000000000009" } });
    fireEvent.change(screen.getByLabelText("Cara tanda tangan HIMAWAN TATURA WIJAYA, S.H.I., M.H."), { target: { value: "tte" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Simpan pengaturan TTE" })[0]);
    await waitFor(() => expect(kiriman).toHaveLength(1));
    expect(kiriman[0]).toEqual({ id: 7, caraTtd: "tte", nikBsre: "7201000000000009" });
    expect(Object.keys(kiriman[0]).join(",")).not.toMatch(/pass|sandi/i);
  });

  it("penolakan server dikalimatkan (tte_belum_tersambung)", async () => {
    pasangFetch(GET_ADMIN("tersambung"), () => jawab({ ok: false, error: "tte_belum_tersambung", status: 400 }, 400));
    render(<AletaEcourtTte />);
    fireEvent.change(await screen.findByLabelText("NIK atau ID pengguna BSrE MUNIFA, S.H."), { target: { value: "7201123456780002" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Simpan pengaturan TTE" })[1]);
    await screen.findByText("BSrE belum tersambung - cara TTE belum dapat dipilih.");
  });

  it("NIK tidak sah mengunci tombol simpan", async () => {
    pasangFetch(GET_ADMIN("belum"));
    render(<AletaEcourtTte />);
    fireEvent.change(await screen.findByLabelText("NIK atau ID pengguna BSrE MUNIFA, S.H."), { target: { value: "ab" } });
    const tombol = screen.getAllByRole("button", { name: "Simpan pengaturan TTE" })[1] as HTMLButtonElement;
    expect(tombol.disabled).toBe(true);
    expect(document.body.textContent).toContain("tidak sah");
  });
});

describe("layar - pejabat (mode saya)", () => {
  const GET_SAYA = () =>
    jawab({
      ok: true,
      data: {
        admin: false,
        statusBsre: "belum",
        baris: [bentukBarisTte(BARIS[1], { admin: false, penggunaId: "usr-munifa" })],
      },
    });

  it("melihat pengaturan sendiri, tanpa bisa mengubah", async () => {
    pasangFetch(GET_SAYA);
    render(<AletaEcourtTte mode="saya" />);
    await screen.findByText("TTE saya");
    expect(screen.getAllByTestId(/^tte-baris-/)).toHaveLength(1);
    expect((screen.getByLabelText("Cara tanda tangan MUNIFA, S.H.") as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText("NIK atau ID pengguna BSrE MUNIFA, S.H.") as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Simpan pengaturan TTE" })).toBeNull();
    expect(screen.getByTestId("keterangan-passphrase").textContent).toBe(KETERANGAN_PASSPHRASE);
  });

  it("pejabat tanpa tanda tangan tertaut tidak melihat kartu apa pun", async () => {
    pasangFetch(() => jawab({ ok: true, data: { admin: false, statusBsre: "belum", baris: [] } }));
    const { container } = render(<AletaEcourtTte mode="saya" />);
    await waitFor(() => expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1));
    await new Promise((r) => setTimeout(r, 20));
    expect(container.querySelector('[data-testid="kartu-tte"]')).toBeNull();
  });
});

// ─── Penjaga sisi server: layanan bot ───────────────────────────────────────

const require_ = createRequire(import.meta.url);
const akarBot = path.resolve(process.cwd(), "../aleta_bot");
const jalurBot = (r: string) => require_.resolve(path.join(akarBot, r));
type Modul = { filename: string; loaded: boolean; exports: unknown };
const ModulKelas = require_("module") as unknown as new (id: string) => Modul;
const dipasang: string[] = [];
function pasang(relatif: string, isi: unknown) {
  const jalur = jalurBot(relatif);
  const m = new ModulKelas(jalur);
  m.filename = jalur;
  m.loaded = true;
  m.exports = isi;
  (require_.cache as Record<string, unknown>)[jalur] = m;
  dipasang.push(jalur);
}
afterEach(() => {
  for (const j of dipasang.splice(0)) delete (require_.cache as Record<string, unknown>)[j];
  delete (require_.cache as Record<string, unknown>)[jalurBot("services/tandaTanganService.js")];
});

function layananDenganDb() {
  const kueri: Array<{ sql: string; params: unknown[] }> = [];
  pasang("bot_db_config.js", {
    query: (sql: string, params: unknown[], cb: (g: unknown, h: unknown) => void) => {
      kueri.push({ sql, params });
      if (/information_schema/i.test(sql)) return cb(null, [{ n: 1 }]);
      if (/^\s*UPDATE/i.test(sql)) return cb(null, { affectedRows: 1 });
      return cb(null, []);
    },
  });
  pasang("services/botDbService.js", { pastikanUtc: () => null });
  const svc = require_(jalurBot("services/tandaTanganService.js")) as {
    aturTte: (id: number, p: Record<string, unknown>) => Promise<{ ok: boolean; alasan?: string; caraTtd?: string }>;
    daftar: () => Promise<{ baris: Array<Record<string, unknown>> }>;
  };
  return { svc, kueri };
}

describe("layanan bot - aturTte", () => {
  it("TTE ditolak selama BSrE belum tersambung; gambar selalu boleh", async () => {
    const { svc, kueri } = layananDenganDb();
    expect(await svc.aturTte(7, { caraTtd: "tte", nikBsre: "7201123456780001", tteTersedia: () => false })).toMatchObject({ ok: false, alasan: "tte_belum_tersambung" });
    expect(kueri.some((k) => /^\s*UPDATE/i.test(k.sql))).toBe(false);
    expect(await svc.aturTte(7, { caraTtd: "gambar", nikBsre: "7201123456780001" })).toMatchObject({ ok: true, caraTtd: "gambar" });
  });

  it("TTE tersambung tetap menuntut NIK/ID; lalu tersimpan", async () => {
    const { svc, kueri } = layananDenganDb();
    expect(await svc.aturTte(7, { caraTtd: "tte", nikBsre: "", tteTersedia: () => true })).toMatchObject({ ok: false, alasan: "nik_bsre_kosong" });
    expect(await svc.aturTte(7, { caraTtd: "tte", nikBsre: "7201123456780001", tteTersedia: () => true })).toMatchObject({ ok: true, caraTtd: "tte" });
    const ubah = kueri.find((k) => /^\s*UPDATE/i.test(k.sql))!;
    expect(ubah.sql).toMatch(/cara_ttd/);
    expect(ubah.params).toEqual(["tte", "7201123456780001", 7]);
  });

  it("passphrase DITOLAK (bukan diabaikan) dan tidak ada kolom/UPDATE untuknya", async () => {
    const { svc, kueri } = layananDenganDb();
    expect(await svc.aturTte(7, { caraTtd: "gambar", nikBsre: "", passphrase: "rahasia" })).toMatchObject({ ok: false, alasan: "passphrase_tidak_disimpan" });
    expect(kueri.some((k) => /^\s*UPDATE/i.test(k.sql))).toBe(false);
    expect(kueri.some((k) => JSON.stringify(k.params).includes("rahasia"))).toBe(false);
  });

  it("tabel tidak memiliki kolom bernama passphrase/sandi", async () => {
    const { kueri, svc } = layananDenganDb();
    await svc.daftar();
    const buat = kueri.find((k) => /CREATE TABLE/i.test(k.sql))!;
    expect(buat.sql).toMatch(/cara_ttd/);
    expect(buat.sql).toMatch(/nik_bsre/);
    expect(buat.sql.replace(/--[^\n]*/g, "")).not.toMatch(/passphrase|sandi/i);
  });

  it("nilai di luar bentuk ditolak", async () => {
    const { svc } = layananDenganDb();
    expect(await svc.aturTte(7, { caraTtd: "lain" })).toMatchObject({ ok: false, alasan: "cara_ttd_tidak_dikenal" });
    expect(await svc.aturTte(7, { caraTtd: "gambar", nikBsre: "a b" })).toMatchObject({ ok: false, alasan: "nik_bsre_tidak_sah" });
    expect(await svc.aturTte(0, { caraTtd: "gambar" })).toMatchObject({ ok: false, alasan: "id_tidak_sah" });
  });
});

describe("rute portal - passphrase ditolak, hak dijaga", () => {
  it("POST menolak badan berisi passphrase sebelum menghubungi bot", async () => {
    const klien = vi.fn();
    vi.resetModules();
    vi.doMock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
    vi.doMock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr-super" }));
    vi.doMock("@/server/modules/akses/hak-peran", () => ({ pastikanAksi: async () => ({ id: "usr-super", name: "SUPER" }) }));
    vi.doMock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
      getGatewayTteStatus: klien,
      getGatewayTandaTangan: klien,
      kirimTandaTanganTte: klien,
    }));
    vi.doMock("@/server/shared/audit", () => ({ appendAuditLog: vi.fn() }));
    vi.doMock("@/server/shared/ids", () => ({ nextPrefixedId: async () => "adt-1" }));
    vi.doMock("@/server/modules/organization/service", () => ({ requireActorUser: async () => ({ id: "usr-super" }) }));
    const { POST } = await import("@/app/api/aleta-ecourt/tanda-tangan/tte/route");
    const r = await POST(
      new Request("http://localhost/api/aleta-ecourt/tanda-tangan/tte", {
        method: "POST",
        body: JSON.stringify({ id: 7, caraTtd: "gambar", nikBsre: "", passphrase: "rahasia" }),
      }) as never
    );
    expect(r.status).toBe(400);
    expect(((await r.json()) as { alasan: string }).alasan).toBe("passphrase_tidak_disimpan");
    expect(klien).not.toHaveBeenCalled();
    vi.doUnmock("@/server/db/client");
    vi.doUnmock("@/server/shared/auth");
    vi.doUnmock("@/server/modules/akses/hak-peran");
    vi.doUnmock("@/server/modules/aleta-bot/whatsapp-gateway-client");
    vi.doUnmock("@/server/shared/audit");
    vi.doUnmock("@/server/shared/ids");
    vi.doUnmock("@/server/modules/organization/service");
  });
});
