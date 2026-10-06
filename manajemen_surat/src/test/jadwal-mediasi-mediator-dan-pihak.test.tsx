import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GatewayJadwalMediasi } from "@/server/modules/aleta-bot/whatsapp-gateway-client";

/**
 * ============================================================================
 * JADWAL MEDIASI: SEBUTAN MEDIATOR DAN PARA PIHAK - DIGAMBAR, DIBACA, DIKLIK
 * ============================================================================
 *
 * Permintaan pengguna 27 September 2026:
 *
 *   butir 7  status mediator H ditulis "Mediator Hakim", selainnya "Mediator
 *            Non Hakim". Tangkapan layarnya menulis huruf "H" mentah, dan chip
 *            saringan untuk perkara berstatus H menghitung "0 Hakim mediator,
 *            1 Mediator non-hakim" - aturan lama menguji /hakim/i atas sandi
 *            yang hanya berisi huruf H.
 *   butir 8  di bawah nomor perkara, nama pihak lengkap BERSUSUN - pihak
 *            pertama dulu, lalu pihak kedua - bukan satu baris "A lawan B"
 *            yang dipotong elipsis.
 *
 * Tidak satu pun uji di sini menyisir teks sumber. Rute portal
 * /api/aleta-ecourt/jadwal-mediasi dijalankan SUNGGUHAN (hanya jembatan bot,
 * kewenangan, dan basis data yang dipalsukan), sehingga ruas baru yang
 * dibuang rute akan terlihat di sini sebagai sebutan yang keliru.
 *
 * Nama orang dan nomor perkara di sini karangan; sandi statusnya sandi SIPP
 * sungguhan (H, N, H,H, kosong - terukur di sipp_donggala).
 */

const keadaan: { mediasi: GatewayJadwalMediasi[] } = { mediasi: [] };

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({
  pastikanKapabilitas: async () => ({ name: "Penguji" }),
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (galat: unknown) => {
    throw galat;
  },
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", async (asli) => {
  const mod = await asli<typeof import("@/server/modules/aleta-bot/whatsapp-gateway-client")>();
  return {
    ...mod,
    getGatewayJadwalMediasi: async () => ({
      ok: true,
      data: {
        ok: true,
        dari: "2026-09-28",
        sampai: "2026-09-28",
        terbaca: true,
        alasan: "",
        mediasi: keadaan.mediasi,
      },
    }),
  };
});

import { AletaEcourtMediasi } from "@/components/portal/aleta-ecourt-mediasi";

function mediasi(sebagian: Partial<GatewayJadwalMediasi> & { nomorPerkara: string }): GatewayJadwalMediasi {
  return {
    mediasiId: sebagian.nomorPerkara,
    perkaraId: sebagian.nomorPerkara,
    jenisPerkara: "Cerai Gugat",
    tanggal: "2026-09-28",
    jam: "09:00",
    sampaiJam: "",
    tempat: "Ruang mediasi",
    dihadiri: "",
    ditunda: false,
    mediator: "",
    statusMediator: "",
    jenisMediasi: "",
    nomorSk: "",
    penetapanMediator: "",
    laporanMediator: "",
    selesai: false,
    hasil: "",
    hasilTeks: "",
    lamaHari: null,
    tenggatPerma: "",
    sisaHariTenggat: null,
    lewatTenggang: false,
    pihak: { penggugat: [], tergugat: [] },
    ...sebagian,
  };
}

const NAMA_PENGGUGAT_A = "Zahra Novita Rahmadani Ointu binti Yusuf Karim Ointu";
const NAMA_TERGUGAT_A = "Mohammad Rizal Pratama Lamasituju bin Abdul Hamid";

const DATA: GatewayJadwalMediasi[] = [
  // Cerai gugat, mediator hakim - baris tangkapan layar pengguna.
  mediasi({
    nomorPerkara: "501/Pdt.G/2026/PA.Dgl",
    alurPerkaraId: 15,
    jenisPerkaraId: 347,
    mediator: "Himawan Contoh, S.H.I., M.H.",
    statusMediator: "H",
    penetapanMediator: "2026-08-26",
    nomorSk: "501/Pdt.G/2026/PA.Dgl",
    pihak: { penggugat: [NAMA_PENGGUGAT_A], tergugat: [NAMA_TERGUGAT_A] },
  }),
  // Cerai TALAK: alur gugatan (15), nomor /Pdt.G/, tetapi Pemohon/Termohon.
  mediasi({
    nomorPerkara: "502/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Cerai Talak",
    alurPerkaraId: 15,
    jenisPerkaraId: 346,
    mediator: "Herlina Contoh, S.H., M.H.",
    statusMediator: "N",
    pihak: { penggugat: ["Andi Saputra bin Ahmad"], tergugat: ["Siti Rahma binti Umar"] },
  }),
  // Status kosong, harta bersama bertergugat dua dan turut tergugat.
  mediasi({
    nomorPerkara: "503/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Harta Bersama",
    alurPerkaraId: 15,
    jenisPerkaraId: 348,
    mediator: "Akbar Contoh, S.H.I",
    statusMediator: "",
    pihak: {
      penggugat: ["Nurhayati binti Lasa"],
      tergugat: ["Salbi bin Lasa", "Indah binti Lasa"],
      turutTergugat: ["Intan binti Lasa"],
    },
  }),
  // Dua mediator hakim, dirangkai SIPP dengan <br/>.
  mediasi({
    nomorPerkara: "504/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Kewarisan",
    alurPerkaraId: 15,
    jenisPerkaraId: 364,
    mediator: "Mohamad Contoh, S.Ag.,M.H.<br/>Mazidah Contoh, S.Ag., M.H.",
    statusMediator: "H,H",
    pihak: { penggugat: ["Rahmat bin Sulaiman"], tergugat: ["Hasan bin Sulaiman"] },
  }),
  // Mediator belum ada sama sekali.
  mediasi({
    nomorPerkara: "505/Pdt.G/2026/PA.Dgl",
    pihak: { penggugat: ["Wati binti Karim"], tergugat: ["Anwar bin Latif"] },
  }),
  // Bot LAMA: tanpa alur/jenis_perkara_id - sebutannya turun ke nama jenis.
  mediasi({
    nomorPerkara: "506/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Cerai Talak",
    mediator: "Idris Contoh, S.H.I., M.H.",
    statusMediator: "H",
    pihak: { penggugat: ["Yusran bin Daeng"], tergugat: ["Marni binti Laode"] },
  }),
  // Isbat nikah beralur GUGATAN (79 perkara nyata di sipp_donggala): namanya
  // berpola permohonan, tetapi nomornya berkata Penggugat. Hanya jalan NOMOR
  // yang benar di sini - kasus ini yang menggigit bila alur/jenis dibuang.
  mediasi({
    nomorPerkara: "507/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah",
    alurPerkaraId: 15,
    jenisPerkaraId: 360,
    mediator: "Faisal Contoh, S.H., M.H.",
    statusMediator: "N",
    pihak: { penggugat: ["Hasnah binti Lamba"], tergugat: ["Rusdin bin Lamba"] },
  }),
];

async function jalankanRute(alamat: string) {
  const mod = await import("@/app/api/aleta-ecourt/jadwal-mediasi/route");
  const permintaan = { nextUrl: new URL(alamat, "http://uji.local") };
  return mod.GET(permintaan as unknown as Parameters<typeof mod.GET>[0]);
}

function pasangFetch(data: GatewayJadwalMediasi[]) {
  keadaan.mediasi = data;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (alamat: string) => {
      const url = String(alamat);
      if (url.includes("/api/aleta-ecourt/jadwal-mediasi")) return jalankanRute(url);
      // Rincian memuat kehadiran - kosong cukup.
      return { ok: true, status: 200, json: async () => ({ data: { baris: [] } }) } as unknown as Response;
    })
  );
}

async function gambar(data: GatewayJadwalMediasi[] = DATA) {
  pasangFetch(data);
  render(createElement(AletaEcourtMediasi));
  // Tenggat panjang: pemanggilan pertama mengimpor rute portal sungguhan, dan
  // pada mesin yang sibuk itu melewati satu detik bawaan waitFor.
  await waitFor(() => expect(screen.getByText(data[0].nomorPerkara)).toBeTruthy(), {
    timeout: 20_000,
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Baris tabel yang memuat nomor perkara ini. */
function barisPerkara(nomor: string): HTMLElement {
  const sel = screen.getAllByText(nomor).find((el) => el.closest("tr"));
  expect(sel, `baris ${nomor} tidak tergambar`).toBeTruthy();
  return sel!.closest("tr") as HTMLElement;
}

/** Sel kolom Mediator (kolom ke-4) pada baris perkara ini. */
function selMediator(nomor: string): HTMLElement {
  return barisPerkara(nomor).querySelectorAll("td")[3] as HTMLElement;
}

/** Nomor perkara pada baris tabel, dalam URUTAN TAMPIL. */
function nomorTampil(): string[] {
  const hasil: string[] = [];
  for (const tr of document.querySelectorAll("tbody tr")) {
    // Sel ketiga (Perkara & Para Pihak) diawali nomor perkaranya; baris
    // rincian yang terbuka hanya bersel satu dan terlewati sendiri.
    const sel = tr.querySelectorAll("td")[2];
    const nomor = DATA.find((x) => sel?.textContent?.startsWith(x.nomorPerkara));
    if (nomor) hasil.push(nomor.nomorPerkara);
  }
  return hasil;
}

/** Kotak saringan berlabel ini, atau null bila tidak tergambar. */
function cariChip(label: string): HTMLElement | null {
  const span = screen
    .queryAllByText(label, { exact: true })
    .find((el) => el.tagName === "SPAN" && el.parentElement?.tagName === "BUTTON");
  return (span?.parentElement as HTMLElement) ?? null;
}

function chip(label: string): HTMLElement {
  const tombol = cariChip(label);
  expect(tombol, `kotak saringan "${label}" tidak tergambar`).toBeTruthy();
  return tombol!;
}

function jumlahChip(label: string): number {
  return Number(chip(label).querySelector(".tabular-nums")?.textContent);
}

describe("butir 7 - sebutan mediator", () => {
  it("status H tertulis Mediator Hakim di sel - bukan huruf H mentah", async () => {
    await gambar();
    const sel = selMediator("501/Pdt.G/2026/PA.Dgl");
    expect(within(sel).getByText("Himawan Contoh, S.H.I., M.H.")).toBeTruthy();
    expect(within(sel).getByText("Mediator Hakim")).toBeTruthy();
    // Tidak ada satu elemen pun di layar yang isinya huruf sandi mentah.
    for (const sandi of ["H", "N", "H,H"]) {
      expect(screen.queryByText(sandi, { exact: true }), `sandi ${sandi} tergambar mentah`).toBeNull();
    }
  });

  it("status N tertulis Mediator Non Hakim", async () => {
    await gambar();
    expect(within(selMediator("502/Pdt.G/2026/PA.Dgl")).getByText("Mediator Non Hakim")).toBeTruthy();
  });

  it("status kosong tertulis belum tercatat - tidak dianggap Non Hakim", async () => {
    await gambar();
    const sel = selMediator("503/Pdt.G/2026/PA.Dgl");
    expect(within(sel).getByText("Status mediator belum tercatat")).toBeTruthy();
    expect(within(sel).queryByText("Mediator Non Hakim")).toBeNull();
  });

  it("dua mediator: nama dipecah tanpa <br/> mentah, masing-masing bersebutan", async () => {
    await gambar();
    const sel = selMediator("504/Pdt.G/2026/PA.Dgl");
    expect(within(sel).getByText("Mohamad Contoh, S.Ag.,M.H.")).toBeTruthy();
    expect(within(sel).getByText("Mazidah Contoh, S.Ag., M.H.")).toBeTruthy();
    expect(within(sel).getAllByText("Mediator Hakim")).toHaveLength(2);
    expect(document.body.textContent).not.toContain("<br");
  });

  it("chip menghitung dengan sebutan yang SAMA - H masuk Hakim, bukan Non Hakim", async () => {
    await gambar();
    // 501, 504 (H,H), 506 berstatus H; 502 dan 507 N; 503 kosong; 505 tanpa
    // mediator.
    expect(jumlahChip("Mediator Hakim")).toBe(3);
    expect(jumlahChip("Mediator Non Hakim")).toBe(2);
    expect(jumlahChip("Status mediator belum tercatat")).toBe(1);
    expect(jumlahChip("Mediator belum ada")).toBe(1);
  });

  it("chip Mediator Hakim menyaring tepat baris berstatus H", async () => {
    await gambar();
    fireEvent.click(chip("Mediator Hakim"));
    expect(nomorTampil()).toEqual([
      "501/Pdt.G/2026/PA.Dgl",
      "504/Pdt.G/2026/PA.Dgl",
      "506/Pdt.G/2026/PA.Dgl",
    ]);
  });

  it("chip Mediator Non Hakim tidak menelan status kosong maupun H", async () => {
    await gambar();
    fireEvent.click(chip("Mediator Non Hakim"));
    expect(nomorTampil()).toEqual(["502/Pdt.G/2026/PA.Dgl", "507/Pdt.G/2026/PA.Dgl"]);
  });

  it("chip status kosong disembunyikan selama tidak ada barisnya", async () => {
    await gambar(DATA.filter((x) => x.statusMediator !== "" || !x.mediator));
    expect(cariChip("Status mediator belum tercatat")).toBeNull();
    // Chip yang lain tetap ada seperti sebelumnya.
    expect(jumlahChip("Mediator Non Hakim")).toBe(2);
  });

  it("saring cepat mengenali sebutan yang tertulis, bukan sandi", async () => {
    await gambar();
    const kotak = screen.getByPlaceholderText(/Saring di dalam hasil/);
    fireEvent.change(kotak, { target: { value: "non hakim" } });
    expect(nomorTampil()).toEqual(["502/Pdt.G/2026/PA.Dgl", "507/Pdt.G/2026/PA.Dgl"]);
    fireEvent.change(kotak, { target: { value: "Mazidah" } });
    expect(nomorTampil()).toEqual(["504/Pdt.G/2026/PA.Dgl"]);
  });

  it("rincian menulis status mediator sebagai sebutan", async () => {
    await gambar();
    const tombol = within(barisPerkara("501/Pdt.G/2026/PA.Dgl")).getByRole("button", { name: /Rincian/ });
    await act(async () => {
      fireEvent.click(tombol);
    });
    const judul = await screen.findByText("Status mediator");
    expect(judul.nextElementSibling?.textContent).toBe("Mediator Hakim");
  });

  it("urut kolom Mediator memakai nama, bukan tanda <br/>", async () => {
    await gambar();
    fireEvent.click(screen.getByRole("button", { name: /^Mediator/ }));
    const urutan = nomorTampil();
    expect(urutan.length).toBe(DATA.length);
    // Akbar, Faisal, Herlina, Himawan, Idris, Mohamad - menurut abjad nama.
    // Baris tanpa mediator dilewati: letak nilai kosong urusan urutkan().
    expect(urutan.filter((n) => n !== "505/Pdt.G/2026/PA.Dgl")).toEqual([
      "503/Pdt.G/2026/PA.Dgl",
      "507/Pdt.G/2026/PA.Dgl",
      "502/Pdt.G/2026/PA.Dgl",
      "501/Pdt.G/2026/PA.Dgl",
      "506/Pdt.G/2026/PA.Dgl",
      "504/Pdt.G/2026/PA.Dgl",
    ]);
  });
});

describe("butir 8 - para pihak bersusun di bawah nomor perkara", () => {
  function sisi(nomor: string, kunci: string): HTMLElement | null {
    return barisPerkara(nomor).querySelector(`[data-sisi="${kunci}"]`);
  }

  it("pihak pertama dulu, lalu pihak kedua - nama UTUH, tanpa elipsis", async () => {
    await gambar();
    const tr = barisPerkara("501/Pdt.G/2026/PA.Dgl");
    const pertama = sisi("501/Pdt.G/2026/PA.Dgl", "pihak-pertama")!;
    const kedua = sisi("501/Pdt.G/2026/PA.Dgl", "pihak-kedua")!;
    expect(pertama.textContent).toBe(`Penggugat: ${NAMA_PENGGUGAT_A}`);
    expect(kedua.textContent).toBe(`Tergugat: ${NAMA_TERGUGAT_A}`);
    // Bersusun: pihak pertama mendahului pihak kedua di dokumen.
    expect(pertama.compareDocumentPosition(kedua) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Tidak ada lagi baris "A lawan B", dan tidak ada yang dipotong elipsis.
    expect(tr.textContent).not.toContain(" lawan ");
    expect(pertama.closest(".truncate")).toBeNull();
    expect(kedua.closest(".truncate")).toBeNull();
  });

  it("dua arah: nama penggugat tidak pernah di baris Tergugat, dan sebaliknya", async () => {
    await gambar();
    const pertama = sisi("501/Pdt.G/2026/PA.Dgl", "pihak-pertama")!.textContent || "";
    const kedua = sisi("501/Pdt.G/2026/PA.Dgl", "pihak-kedua")!.textContent || "";
    expect(pertama).not.toContain(NAMA_TERGUGAT_A);
    expect(pertama).not.toContain("Tergugat");
    expect(kedua).not.toContain(NAMA_PENGGUGAT_A);
    expect(kedua).not.toContain("Penggugat");
  });

  it("cerai talak bersebutan Pemohon/Termohon walau alurnya gugatan dan nomornya /Pdt.G/", async () => {
    await gambar();
    expect(sisi("502/Pdt.G/2026/PA.Dgl", "pihak-pertama")!.textContent).toBe(
      "Pemohon: Andi Saputra bin Ahmad"
    );
    expect(sisi("502/Pdt.G/2026/PA.Dgl", "pihak-kedua")!.textContent).toBe(
      "Termohon: Siti Rahma binti Umar"
    );
  });

  it("NOMOR mengalahkan kata: isbat nikah beralur gugatan bersebutan Penggugat/Tergugat", async () => {
    // Nama jenisnya berpola permohonan; hanya alur_perkara_id 15 dari bot
    // yang menyatakan gugatan. Uji ini merah bila layar berhenti meneruskan
    // alurPerkaraId/jenisPerkaraId ke sebutanPihakPerkara.
    await gambar();
    expect(sisi("507/Pdt.G/2026/PA.Dgl", "pihak-pertama")!.textContent).toBe("Penggugat: Hasnah binti Lamba");
    expect(sisi("507/Pdt.G/2026/PA.Dgl", "pihak-kedua")!.textContent).toBe("Tergugat: Rusdin bin Lamba");
  });

  it("bot lama tanpa jenis_perkara_id: sebutan turun ke nama jenis perkara", async () => {
    await gambar();
    expect(sisi("506/Pdt.G/2026/PA.Dgl", "pihak-pertama")!.textContent).toBe("Pemohon: Yusran bin Daeng");
  });

  it("pihak lebih dari satu per sisi disebut semua; turut tergugat bersebutan sendiri", async () => {
    await gambar();
    expect(sisi("503/Pdt.G/2026/PA.Dgl", "pihak-kedua")!.textContent).toBe(
      "Tergugat: Salbi bin Lasa; Indah binti Lasa"
    );
    // 6 Okt 2026 (butir 23): disingkat "Turut T", sama dengan Jadwal Sidang.
    expect(sisi("503/Pdt.G/2026/PA.Dgl", "turut")!.textContent).toBe("Turut T: Intan binti Lasa");
  });

  it("saring cepat dan pencarian lanjutan tetap menemukan tiap pihak, termasuk turut tergugat", async () => {
    await gambar();
    const kotak = screen.getByPlaceholderText(/Saring di dalam hasil/);
    fireEvent.change(kotak, { target: { value: "Intan binti" } });
    expect(nomorTampil()).toEqual(["503/Pdt.G/2026/PA.Dgl"]);
    fireEvent.change(kotak, { target: { value: "Rizal Pratama" } });
    expect(nomorTampil()).toEqual(["501/Pdt.G/2026/PA.Dgl"]);
  });

  it("urut kolom Perkara tetap menurut nomor", async () => {
    await gambar([...DATA].reverse());
    fireEvent.click(screen.getByRole("button", { name: /^Perkara/ }));
    expect(nomorTampil()).toEqual(DATA.map((x) => x.nomorPerkara));
  });
});
