import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AletaEcourtTipeKeluaran, PERAN_PEMBERI_PERINTAH } from "@/components/portal/aleta-ecourt-tipe-keluaran";
import { personas } from "@/lib/mock-data";
import { type UserPersona } from "@/lib/types";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { PERAN_PENGACC } from "@/server/modules/aleta-ecourt/bas-acc";
import { bacaAdmin, pastikanBenih, usul } from "@/server/modules/aleta-ecourt/tipe-keluaran";

/**
 * ============================================================================
 * LAYAR PENGATURAN TIPE KELUARAN - ISINYA DARI MODUL SUNGGUHAN
 * ============================================================================
 *
 * Jawaban GET yang disuapkan ke layar TIDAK diketik tangan: basis data pg-mem
 * berbenih diisi dua usulan lewat usul() sungguhan, lalu bacaAdmin() - fungsi
 * yang sama yang dijawab rute - menghasilkan isinya. Bila bentuk jawaban
 * modul berubah, layar ini ikut diuji atas bentuk barunya.
 *
 * Yang dijaga:
 *   - bawaan tampil TERKUNCI (tanpa tombol sunting/hapus), hanya matikan dan
 *     ganti;
 *   - tambahan 'usulan' menampilkan tombol Sahkan HANYA untuk Super Admin;
 *   - daftar 'deteksi' bertanda "butuh ukur" dan tombol Sahkan-nya MATI;
 *   - formulir usul memvalidasi langsung dengan validasi.ts;
 *   - atas perintah kalimat BAS hanya menawarkan ketua/wakil ketua/hakim;
 *   - tidak ada tombol hapus di mana pun.
 */

let jawabanGet: Record<string, unknown> = {};
let portal: { currentUser: UserPersona | null; users: UserPersona[] } = { currentUser: null, users: [] };
const ambilan = vi.fn();

vi.mock("@/lib/app-state", () => ({ usePortal: () => portal }));

const orang = (id: string) => personas.find((p) => p.id === id)!;

beforeAll(async () => {
  const db: AletaDatabase = await createAletaDatabase({ useInMemory: true, seed: true });
  try {
    await pastikanBenih(db);
    const u1 = await usul(db, "usr-admin", { daftar: "bas.kehadiran.bunyi", nilai: "hadir melalui telekonferensi", alasan: "sidang daring" });
    const u2 = await usul(db, "usr-admin", {
      daftar: "putusan.alasan.ciri",
      kunci: "perselisihan terus-menerus",
      nilai: "bentrok",
      data: { kata: ["bentrok"] },
      alasan: "kata yang sering dipakai saksi",
    });
    for (const u of [u1, u2]) if (!u.ok) throw new Error(`usulan benih uji gagal: ${u.alasan.join("; ")}`);
    for (const g of ["bas", "putusan", "bersama"]) jawabanGet[g] = await bacaAdmin(db, g);
  } finally {
    await db.close();
  }
}, 120_000);

afterAll(() => {
  jawabanGet = {};
});

beforeEach(() => {
  ambilan.mockReset();
  ambilan.mockImplementation((alamat: string, opsi?: RequestInit) => {
    if (opsi?.method === "POST") {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, butir: {} }) } as unknown as Response);
    }
    const g = new URL(String(alamat), "http://localhost").searchParams.get("golongan") ?? "";
    return Promise.resolve({ ok: true, status: 200, json: async () => jawabanGet[g] } as unknown as Response);
  });
  vi.stubGlobal("fetch", ambilan);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function sebagai(id: string) {
  portal = { currentUser: orang(id), users: personas };
}

async function kartu(daftar: string) {
  return within(await screen.findByTestId(`daftar-${daftar}`));
}

async function butirBernilai(daftar: string, nilai: string) {
  const k = await kartu(daftar);
  const teks = k.getByText(nilai);
  const li = teks.closest("li");
  if (!li) throw new Error(`butir ${nilai} tidak ditemukan`);
  return within(li as HTMLElement);
}

// ============================================================================
describe("bawaan tampil terkunci", () => {
  it("baris bawaan bertanda 'bawaan terkunci', dapat dimatikan/diganti, dan TIDAK ada tombol sunting atau hapus", async () => {
    sebagai("usr-super");
    render(<AletaEcourtTipeKeluaran />);
    const b = await butirBernilai("bas.kehadiran.bunyi", "hadir secara pribadi");
    expect(b.getByText(/bawaan terkunci/)).toBeInTheDocument();
    expect(b.getByRole("button", { name: "Matikan" })).toBeInTheDocument();
    expect(b.queryByRole("button", { name: /sunting|ubah|edit/i })).toBeNull();
    expect(b.queryByRole("button", { name: /Sahkan/ })).toBeNull();
    // Tidak satu pun tombol hapus di seluruh layar.
    expect(screen.queryAllByRole("button", { name: /hapus|delete/i })).toHaveLength(0);
  });
});

// ============================================================================
describe("tombol sahkan hanya untuk Super Admin", () => {
  it("Super Admin melihat Sahkan pada usulan; Admin tidak (tetapi tetap dapat menolak)", async () => {
    sebagai("usr-super");
    const { unmount } = render(<AletaEcourtTipeKeluaran />);
    let u = await butirBernilai("bas.kehadiran.bunyi", "hadir melalui telekonferensi");
    expect(u.getByText("usulan")).toBeInTheDocument();
    expect(u.getByRole("button", { name: "Sahkan" })).toBeEnabled();
    unmount();

    sebagai("usr-admin");
    render(<AletaEcourtTipeKeluaran />);
    u = await butirBernilai("bas.kehadiran.bunyi", "hadir melalui telekonferensi");
    expect(u.queryByRole("button", { name: "Sahkan" })).toBeNull();
    expect(u.getByRole("button", { name: "Tolak" })).toBeInTheDocument();
  });

  it("atas perintah kalimat BAS hanya menawarkan ketua, wakil ketua, dan hakim yang aktif", async () => {
    sebagai("usr-super");
    render(<AletaEcourtTipeKeluaran />);
    const u = await butirBernilai("bas.kehadiran.bunyi", "hadir melalui telekonferensi");
    await userEvent.click(u.getByRole("button", { name: "Sahkan" }));
    const pilih = (await screen.findByLabelText("Atas perintah")) as HTMLSelectElement;
    const ditawarkan = [...pilih.options].map((o) => o.value).filter(Boolean).sort();
    const harapan = personas
      .filter((p) => p.isActive && [p.roleId, ...(p.additionalRoleIds ?? [])].some((r) => (PERAN_PENGACC as string[]).includes(r)))
      .map((p) => p.id)
      .sort();
    expect(harapan.length).toBeGreaterThan(0);
    expect(ditawarkan).toEqual(harapan);
    expect(ditawarkan).not.toContain("usr-panitera");
    // Tombol kirim mati sampai pemberi perintah dipilih.
    expect(screen.getByRole("button", { name: "Kirim sahkan" })).toBeDisabled();
  });

  it("peran pemberi perintah di layar = PERAN_PENGACC peladen", () => {
    expect([...PERAN_PEMBERI_PERINTAH]).toEqual([...PERAN_PENGACC]);
  });
});

// ============================================================================
describe("daftar deteksi tidak dapat disahkan", () => {
  it("putusan.alasan.ciri bertanda 'butuh ukur' dan tombol Sahkan usulannya mati, bahkan untuk Super Admin", async () => {
    sebagai("usr-super");
    render(<AletaEcourtTipeKeluaran />);
    await userEvent.click(screen.getByRole("tab", { name: "Putusan" }));
    const k = await kartu("putusan.alasan.ciri");
    expect(k.getByText("butuh ukur")).toBeInTheDocument();
    const u = await butirBernilai("putusan.alasan.ciri", "bentrok");
    expect(u.getByRole("button", { name: "Sahkan" })).toBeDisabled();
    // Daftar 'tulis' di tab yang sama tidak bertanda.
    expect((await kartu("putusan.medan-borang")).queryByText("butuh ukur")).toBeNull();
  });
});

// ============================================================================
describe("formulir usul memvalidasi langsung", () => {
  it("nilai berpenanda '${' ditolak sebelum dikirim; nilai sah membuka tombol Usulkan dan mengirim POST 'usul'", async () => {
    sebagai("usr-admin");
    render(<AletaEcourtTipeKeluaran />);
    const k = await kartu("bas.kehadiran.bunyi");
    await userEvent.click(k.getByRole("button", { name: /Usulkan tambahan/ }));
    const nilai = k.getByLabelText("Nilai");
    await userEvent.type(nilai, "hadir ${{x}");
    expect(k.getByLabelText("Pemeriksaan isian")).toBeInTheDocument();
    expect(k.getByRole("button", { name: "Usulkan" })).toBeDisabled();

    await userEvent.clear(nilai);
    await userEvent.type(nilai, "hadir didampingi penerjemah");
    await waitFor(() => expect(k.queryByLabelText("Pemeriksaan isian")).toBeNull());
    await userEvent.click(k.getByRole("button", { name: "Usulkan" }));
    await waitFor(() => expect(ambilan.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === "POST")).toBe(true));
    const kiriman = ambilan.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "POST")!;
    expect(JSON.parse(String((kiriman[1] as RequestInit).body))).toMatchObject({
      tindakan: "usul",
      daftar: "bas.kehadiran.bunyi",
      nilai: "hadir didampingi penerjemah",
    });
  });
});
