// @vitest-environment jsdom
/**
 * Layar cetak ALETA ABT dengan sisipan paragraf pertimbangan alat bukti (Fitur 46): tanpa bukti alur cetak tidak berubah;
 * dengan bukti, RTF yang diunduh dan RTF yang dikirim untuk PDF memuat paragraf bukti; kotak "Masukkan paragraf otomatis" mematikannya.
 * Data rekaan.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CetakAletaAbt } from "@/components/portal/cetak-aleta-abt";
import { lupakanTanda } from "@/lib/aleta-abt-tanda-klien";
import { kalimatBaris, type BarisBukti } from "@/lib/bukti-tertulis";

type Panggilan = { url: string; badan: Record<string, unknown> | null };

const DAFTAR = { folder: [{ folder: "f1", label: "Perceraian Gugat", blangko: [{ id: "b1", nama: "Putusan Cerai Uji", rtf: true, arsip: false, hilang: false, ukuran: 1, disunting: false, versi: 1, terbit: 1, adaDraf: false }] }] };
const KTP: BarisBukti = { nm: "Kartu Tanda Penduduk", an: "Fulanah binti Fulan", no: "1234567890123456", tgl: "2020-01-02", oleh: "Dinas Kependudukan", meterai: 0, cocok: 0, manual: null };
const NIKAH: BarisBukti = { nm: "Kutipan Akta Nikah", an: "", no: "123/45/VI/2010", tgl: "2010-06-01", oleh: "KUA Uji", meterai: 0, cocok: 0, manual: null };

const NASKAH = [
  "PUTUSAN",
  "Verstek: Tergugat tidak pernah hadir.",
  kalimatBaris(KTP, "P", 0),
  kalimatBaris(NIKAH, "P", 1),
  "TENTANG PERTIMBANGAN HUKUM",
  "Menimbang, bahwa alat bukti P.7 merupakan keterangan tambahan yang sudah dinilai;",
  "Menimbang, bahwa berdasarkan analisis bukti di atas ditemukan fakta hukum;",
  "MENGADILI",
  "Mengabulkan gugatan Penggugat;",
];
const GRUP = String.raw`{\fs24 \rtlch \ltrch \dbch \af6 \hich \af4 \loch \f4 `;
const alineaRtf = (t: string) => String.raw`\pard \plain \qj \fi720 \fs20 ` + `${GRUP}${t}}${GRUP}\\par }`;
const RTF_UJI = `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Times New Roman;}}\n${NASKAH.map(alineaRtf).join("\n")}\n}`;

const pratinjau = (teks: string[]) => ({
  nama: "Putusan Cerai Uji.rtf",
  kertas: { nama: "F4", lebarMm: 215, tinggiMm: 330 },
  paragraf: teks.map((t, i) => ({ i, teks: t, rata: "kiri", li: 0, fi: 0, tabel: false, awalan: "" })),
  jumlahParagraf: teks.length,
  terpotong: false,
  jumlahTerisi: 4,
  kosong: [] as Array<{ nama: string; sebab: string; status: string }>,
  lolosCetak: true,
  mesinGalat: "",
  ringkasanKeyakinan: { pasti: 4 },
  waktu: { botMs: 120, totalMs: 180 },
});

let panggilan: Panggilan[] = [];
let teksPratinjau = NASKAH;
let rtfServer = RTF_UJI;
let diunduh: Blob[] = [];

function pasangFetch() {
  panggilan = [];
  diunduh = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const badan = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
      panggilan.push({ url: u, badan });
      const jawab = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => (status < 400 ? { ok: true, data } : data) });
      if (u.includes("bagian=hak")) return jawab({ boleh: true, lewat: "hp", sebab: "" });
      if (u.includes("bagian=daftar")) return jawab(DAFTAR);
      if (u.includes("bagian=perkara")) return jawab({ perkara: [{ nomorPerkara: "1/Pdt.G/2026/PA.Uji", perkaraId: "11", jenisPerkara: "Cerai Gugat" }] });
      if (u.includes("bukti-sipp")) return jawab({ P: [], T: [], nikah: null, dokumen: [] });
      if (badan?.tindakan === "pratinjau") return jawab(pratinjau(teksPratinjau));
      if (badan?.tindakan === "rtf") return jawab({ nama: "Putusan Cerai Uji.rtf", rtfBase64: btoa(rtfServer), byte: rtfServer.length });
      if (badan?.tindakan === "pdf" || badan?.tindakan === "salinan") return jawab({ nama: "Putusan Cerai Uji.rtf", pdfBase64: btoa("%PDF-uji"), waktu: { botMs: 1, totalMs: 2, pdfMs: 3 } });
      return jawab({});
    })
  );
}

beforeEach(() => {
  teksPratinjau = NASKAH;
  rtfServer = RTF_UJI;
  lupakanTanda();
  pasangFetch();
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: (b: Blob) => {
        diunduh.push(b);
        return "blob:uji";
      },
      revokeObjectURL: () => undefined,
    })
  );
});

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

async function sampaiPratinjau(awal: string) {
  render(<CetakAletaAbt />);
  await screen.findByLabelText("Cari blangko");
  fireEvent.change(screen.getByLabelText("Nomor perkara"), { target: { value: "1/Pdt.G" } });
  fireEvent.click(screen.getByRole("button", { name: "Cari perkara" }));
  fireEvent.click(await screen.findByText("1/Pdt.G/2026/PA.Uji"));
  fireEvent.click(await screen.findByText("Putusan Cerai Uji"));
  fireEvent.click(screen.getByRole("button", { name: "Pratinjau naskah" }));
  await screen.findByText(awal);
}

const bacaBlob = (b: Blob) =>
  new Promise<string>((selesai, gagal) => {
    const baca = new FileReader();
    baca.onload = () => selesai(new TextDecoder("latin1").decode(baca.result as ArrayBuffer));
    baca.onerror = () => gagal(baca.error);
    baca.readAsArrayBuffer(b);
  });
const rtfDariPdf = () => {
  const p = panggilan.find((x) => x.badan?.tindakan === "pdf" || x.badan?.tindakan === "salinan");
  return typeof p?.badan?.rtfDiperbaikiBase64 === "string" ? atob(p.badan.rtfDiperbaikiBase64) : null;
};

describe("sisipan paragraf bukti di layar cetak", () => {
  it("tanpa bukti di naskah: tidak ada kotak sisipan, RTF dan PDF persis seperti sebelumnya", async () => {
    teksPratinjau = ["PUTUSAN", "Nomor 1/Pdt.G/2026/PA.Uji"];
    await sampaiPratinjau("PUTUSAN");
    expect(screen.queryByText("Masukkan paragraf otomatis ke naskah cetak")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Unduh RTF" }));
    await waitFor(() => expect(diunduh.length).toBe(1));
    expect(await bacaBlob(diunduh[0])).toBe(RTF_UJI);
    fireEvent.click(screen.getByRole("button", { name: "Unduh PDF" }));
    await waitFor(() => expect(panggilan.some((p) => p.badan?.tindakan === "pdf")).toBe(true));
    expect(rtfDariPdf()).toBeNull();
    expect(screen.queryByText(/paragraf pertimbangan alat bukti/)).toBeNull();
  });

  it("dengan bukti pokok: kotak tercentang bawaan, RTF unduhan dan RTF untuk PDF memuat paragraf, satu baris hasil tampil", async () => {
    await sampaiPratinjau("Mengabulkan gugatan Penggugat;");
    const kotak = (await screen.findByRole("checkbox", { name: /Masukkan paragraf otomatis ke naskah cetak/ })) as HTMLInputElement;
    expect(kotak.checked).toBe(true);
    await waitFor(() => expect(document.body.textContent).toMatch(/Akan masuk: P\.1, P\.2/));

    fireEvent.click(screen.getByRole("button", { name: "Unduh RTF" }));
    await waitFor(() => expect(diunduh.length).toBe(1));
    const rtf = await bacaBlob(diunduh[0]);
    expect(rtf.length).toBeGreaterThan(RTF_UJI.length);
    expect(rtf).toMatch(/alat bukti P\.1/);
    expect(rtf).toMatch(/alat bukti P\.2/);
    expect(rtf).not.toMatch(/aleta/i);
    await screen.findByText(/2 paragraf pertimbangan alat bukti ditambahkan ke naskah \(P\.1, P\.2\)/);

    fireEvent.click(screen.getByRole("button", { name: "Unduh PDF SALINAN" }));
    await waitFor(() => expect(panggilan.some((p) => p.badan?.tindakan === "salinan")).toBe(true));
    const untukPdf = rtfDariPdf();
    expect(untukPdf).not.toBeNull();
    expect(untukPdf).toMatch(/alat bukti P\.1/);
    expect(untukPdf?.startsWith("{\\rtf")).toBe(true);
  });

  it("kotak dimatikan: naskah tetap seperti dari server", async () => {
    await sampaiPratinjau("Mengabulkan gugatan Penggugat;");
    const kotak = (await screen.findByRole("checkbox", { name: /Masukkan paragraf otomatis ke naskah cetak/ })) as HTMLInputElement;
    await waitFor(() => expect(document.body.textContent).toMatch(/Akan masuk/));
    fireEvent.click(kotak);
    await waitFor(() => expect(document.body.textContent).toMatch(/Tidak dimasukkan/));
    fireEvent.click(screen.getByRole("button", { name: "Unduh RTF" }));
    await waitFor(() => expect(diunduh.length).toBe(1));
    expect(await bacaBlob(diunduh[0])).toBe(RTF_UJI);
    fireEvent.click(screen.getByRole("button", { name: "Unduh PDF" }));
    await waitFor(() => expect(panggilan.some((p) => p.badan?.tindakan === "pdf")).toBe(true));
    expect(rtfDariPdf()).toBeNull();
  });

  it("naskah dari server tanpa judul pertimbangan: tidak diubah dan alasannya dilaporkan", async () => {
    rtfServer = `{\\rtf1\\ansi\\deff0\n${["PUTUSAN", "Mengabulkan gugatan Penggugat;"].map(alineaRtf).join("\n")}\n}`;
    await sampaiPratinjau("Mengabulkan gugatan Penggugat;");
    await waitFor(() => expect(document.body.textContent).toMatch(/Akan masuk: P\.1, P\.2/));
    fireEvent.click(screen.getByRole("button", { name: "Unduh RTF" }));
    await waitFor(() => expect(diunduh.length).toBe(1));
    expect(await bacaBlob(diunduh[0])).toBe(rtfServer);
    await screen.findByText(/Tidak ada paragraf pertimbangan alat bukti yang ditambahkan.*belum dapat disisip/);
  });
});
