// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BarisPil,
  KartuSidang,
  KepalaLajurMediasi,
  KepalaLajurSidang,
  KotakCariBerpil,
  MenuTitik,
  PanelSaringan,
  PilihanAntarmuka,
  PitaBawahKartu,
  SegmenPilihan,
  SegmenTundaPutus,
  SidangBerikutnya,
  TindakLanjutPutusan,
  TitikTahap,
  type UrutanLajur,
} from "@/components/portal/jadwal-sidang-baru";
import { keadaanSegmen, tahapDariAgenda, type Saran } from "@/lib/jadwal-baru";

afterEach(() => cleanup());

/** 4 Nov 2026 - perilaku bagian-bagian tampilan baru. Data rekaan; tidak ada panggilan jaringan. */

function Cari({ saran, onPilih, onEnter }: { saran: Saran[]; onPilih: (s: Saran) => void; onEnter: () => void }) {
  const [v, setV] = useState("");
  return (
    <KotakCariBerpil
      nilai={v}
      onUbah={setV}
      onEnter={onEnter}
      saran={saran}
      medanLabel={(m) => ({ hakim: "Hakim", ruang: "Ruang" })[m as "hakim" | "ruang"] ?? m}
      onPilihSaran={onPilih}
      placeholder="Cari"
      ariaLabel="Cari perkara"
      kakiTanpaTeks="Ketik apa saja"
      kakiDenganTeks={(t) => `Enter = cari "${t}" ke SIPP`}
    />
  );
}

describe("kotak cari berpil", () => {
  const saran: Saran[] = [
    { medan: "hakim", nilai: "Hakim Satu", jumlah: 2 },
    { medan: "ruang", nilai: "Ruang 1", jumlah: 5 },
    { medan: "tag", nilai: "belum-bas", teks: "Belum ada BAS", jumlah: 3 },
  ];

  it("fokus membuka saran dengan jumlahnya; memilih saran memanggil pemilih dan menutup saran", () => {
    const onPilih = vi.fn();
    render(<Cari saran={saran} onPilih={onPilih} onEnter={() => undefined} />);
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.focus(screen.getByRole("searchbox", { name: "Cari perkara" }));
    const daftar = screen.getByRole("listbox", { name: "Saran pencarian" });
    const pilihan = within(daftar).getAllByRole("option");
    expect(pilihan).toHaveLength(3);
    expect(pilihan[0].textContent).toContain("Hakim");
    expect(pilihan[0].textContent).toContain("Hakim Satu");
    expect(pilihan[0].textContent).toContain("2");
    expect(pilihan[2].textContent).toContain("Tag");
    expect(pilihan[2].textContent).toContain("Belum ada BAS");
    fireEvent.click(pilihan[1]);
    expect(onPilih).toHaveBeenCalledWith(saran[1]);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("Enter tanpa saran yang disorot = cari ke SIPP; dengan panah + Enter = memilih saran", () => {
    const onPilih = vi.fn();
    const onEnter = vi.fn();
    render(<Cari saran={saran} onPilih={onPilih} onEnter={onEnter} />);
    const kotak = screen.getByRole("searchbox", { name: "Cari perkara" });
    fireEvent.focus(kotak);
    fireEvent.keyDown(kotak, { key: "Enter" });
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(onPilih).not.toHaveBeenCalled();

    fireEvent.focus(kotak);
    fireEvent.keyDown(kotak, { key: "ArrowDown" });
    fireEvent.keyDown(kotak, { key: "ArrowDown" });
    fireEvent.keyDown(kotak, { key: "Enter" });
    expect(onPilih).toHaveBeenCalledWith(saran[1]);
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it("Esc menutup saran tanpa memilih apa pun", () => {
    const onPilih = vi.fn();
    render(<Cari saran={saran} onPilih={onPilih} onEnter={() => undefined} />);
    const kotak = screen.getByRole("searchbox", { name: "Cari perkara" });
    fireEvent.focus(kotak);
    expect(screen.getByRole("listbox")).toBeTruthy();
    fireEvent.keyDown(kotak, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onPilih).not.toHaveBeenCalled();
  });

  it("kaki saran menyebut Enter = cari ke SIPP dengan teks yang diketik; tanpa saran ada keterangan kosong", () => {
    render(<Cari saran={[]} onPilih={() => undefined} onEnter={() => undefined} />);
    const kotak = screen.getByRole("searchbox", { name: "Cari perkara" });
    fireEvent.focus(kotak);
    expect(screen.getByText("Ketik apa saja")).toBeTruthy();
    fireEvent.change(kotak, { target: { value: "xyz" } });
    expect(screen.getByText('Enter = cari "xyz" ke SIPP')).toBeTruthy();
    expect(screen.getByText(/Tidak ada yang cocok/)).toBeTruthy();
  });
});

describe("baris pil", () => {
  it("melepas satu pil, melepas semua hanya bila lebih dari satu, dan kosong tidak digambar", () => {
    const lepas = vi.fn();
    const lepasSemua = vi.fn();
    const { container, rerender } = render(
      <BarisPil pil={[{ label: "Hakim", nilai: "Hakim Satu" }]} onLepas={lepas} onLepasSemua={lepasSemua} />
    );
    expect(screen.queryByText("Lepaskan semua")).toBeNull();
    fireEvent.click(screen.getByText(/Hakim: Hakim Satu/));
    expect(lepas).toHaveBeenCalledWith(0);
    rerender(
      <BarisPil
        pil={[
          { label: "Hakim", nilai: "Hakim Satu" },
          { label: "Ruang", nilai: "Ruang 1" },
        ]}
        onLepas={lepas}
        onLepasSemua={lepasSemua}
      />
    );
    fireEvent.click(screen.getByText("Lepaskan semua"));
    expect(lepasSemua).toHaveBeenCalledTimes(1);
    rerender(<BarisPil pil={[]} onLepas={lepas} onLepasSemua={lepasSemua} />);
    expect(container.querySelector("[data-baris-pil]")).toBeNull();
  });
});

describe("kepala lajur dapat diurutkan", () => {
  it("menekan kepala memanggil pengurut dengan kunci lajurnya, dan menandai arah", () => {
    const tekan = vi.fn();
    const { rerender } = render(<KepalaLajurSidang urutan={null} onTekan={tekan} adaSiap />);
    fireEvent.click(screen.getByRole("button", { name: /Waktu/ }));
    fireEvent.click(screen.getByRole("button", { name: /Perkara/ }));
    fireEvent.click(screen.getByRole("button", { name: /Agenda/ }));
    fireEvent.click(screen.getByRole("button", { name: /Majelis/ }));
    fireEvent.click(screen.getByRole("button", { name: /Putusan/ }));
    fireEvent.click(screen.getByRole("button", { name: /Siap/ }));
    expect(tekan.mock.calls.map((c) => c[0])).toEqual(["antrian", "perkara", "agenda", "majelis", "putusan", "siap"]);
    const naik: UrutanLajur = { kunci: "agenda", arah: "naik" };
    rerender(<KepalaLajurSidang urutan={naik} onTekan={tekan} />);
    expect(screen.getByRole("button", { name: /Agenda/ }).getAttribute("aria-sort")).toBe("ascending");
    expect(screen.getByRole("button", { name: /Perkara/ }).getAttribute("aria-sort")).toBe("none");
    expect(screen.queryByRole("button", { name: /Siap/ })).toBeNull();
    rerender(<KepalaLajurSidang urutan={{ kunci: "agenda", arah: "turun" }} onTekan={tekan} />);
    expect(screen.getByRole("button", { name: /Agenda/ }).getAttribute("aria-sort")).toBe("descending");
  });

  it("kepala lajur Mediasi memakai kunci yang dikenal pengurut lama", () => {
    const tekan = vi.fn();
    render(<KepalaLajurMediasi urutan={null} onTekan={tekan} />);
    for (const nama of [/Waktu/, /Perkara/, /Mediator/, /Tempat/, /Tenggang/, /Hasil/]) fireEvent.click(screen.getByRole("button", { name: nama }));
    expect(tekan.mock.calls.map((c) => c[0])).toEqual(["waktu", "perkara", "mediator", "tempat", "tenggang", "hasil"]);
  });
});

describe("segmen Tunda | Putus di pita bawah kartu", () => {
  const dasar = { boleh: true, sidangSelesai: false, ditunda: false, sampaiPendek: "", putus: false, amar: "", ikrar: false, ikrarSelesai: false };
  const pasang = (k: ReturnType<typeof keadaanSegmen>, o: Partial<{ tundaTekan: boolean; putusTekan: boolean; perlu: boolean }> = {}) => {
    const onTunda = vi.fn();
    const onPutus = vi.fn();
    render(
      <SegmenTundaPutus
        keadaan={k}
        nomorPerkara="12/Pdt.G/2026/PA.Xxx"
        tundaTekan={o.tundaTekan ?? false}
        putusTekan={o.putusTekan ?? false}
        perlu={o.perlu}
        onTunda={onTunda}
        onPutus={onPutus}
        judulTunda="Tunda sidang"
        judulPutus="Catat putusan"
      />
    );
    return { onTunda, onPutus };
  };

  it("dua tombol memanggil pemicu catat yang sudah ada", () => {
    const { onTunda, onPutus } = pasang(keadaanSegmen(dasar));
    fireEvent.click(screen.getByRole("button", { name: "Tunda sidang 12/Pdt.G/2026/PA.Xxx" }));
    fireEvent.click(screen.getByRole("button", { name: "Catat putusan 12/Pdt.G/2026/PA.Xxx" }));
    expect(onTunda).toHaveBeenCalledTimes(1);
    expect(onPutus).toHaveBeenCalledTimes(1);
  });

  it("sidang yang hasilnya sudah tercatat: tampil sebagai tulisan sorotan, bukan tombol (tak ada penundaan kedua)", () => {
    pasang(keadaanSegmen({ ...dasar, ditunda: true, sampaiPendek: "10 Nov", sidangSelesai: true }));
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByText("Ditunda 10 Nov")).toBeTruthy();
  });

  it("tanpa izin dan tanpa hasil tidak menggambar apa pun", () => {
    const { container } = render(
      <SegmenTundaPutus
        keadaan={keadaanSegmen({ ...dasar, boleh: false })}
        nomorPerkara="1/x"
        tundaTekan={false}
        putusTekan={false}
        onTunda={() => undefined}
        onPutus={() => undefined}
        judulTunda=""
        judulPutus=""
      />
    );
    expect(container.querySelector("[data-tombol-tunda-putus]")).toBeNull();
  });

  it("tombol yang sedang terbuka (pencatat tampil) ditandai aria-pressed", () => {
    pasang(keadaanSegmen(dasar), { putusTekan: true });
    expect(screen.getByRole("button", { name: /Catat putusan/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /Tunda sidang/ }).getAttribute("aria-pressed")).toBe("false");
  });
});

describe("kartu sidang berlajur", () => {
  const kartu = (keadaan: "selesai" | "berjalan" | "diskors" | "perlu" | "", pitaPerlu = false) =>
    render(
      <KartuSidang
        keadaan={keadaan}
        ariaLabel="12/Pdt.G/2026/PA.Xxx"
        data-kunci-waktu="2026-11-03|12"
        waktu={<span>waktu-isi</span>}
        perkara={<span>perkara-isi</span>}
        agenda={<span>agenda-isi</span>}
        majelis={<span>majelis-isi</span>}
        aksi={<button type="button">Panggil</button>}
        pita={<PitaBawahKartu perlu={pitaPerlu} kanan={<button type="button">Rincian</button>}><span>tengah</span></PitaBawahKartu>}
        bawah={<div>area-bawah</div>}
      />
    );

  it("lima lajur + pita bawah + area bawah, dan atribut penggulir ruang tetap ada", () => {
    const { container } = kartu("");
    const artikel = screen.getByRole("article", { name: "12/Pdt.G/2026/PA.Xxx" });
    expect(artikel.getAttribute("data-kunci-waktu")).toBe("2026-11-03|12");
    for (const t of ["waktu-isi", "perkara-isi", "agenda-isi", "majelis-isi", "tengah", "area-bawah"]) expect(screen.getByText(t)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Panggil" })).toBeTruthy();
    expect(container.querySelector("[data-pita-bawah]")).not.toBeNull();
  });

  it("lebar lajur TETAP (kolom diberi lebar eksplisit, bukan menurut isi)", () => {
    const { container } = kartu("");
    const kisi = container.querySelector("article > div") as HTMLElement;
    expect(kisi.className).toContain("lg:grid-cols-[8.5rem_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.3fr)_11rem]");
  });

  it("garis kiri menurut keadaan; pita merah dengan seruan hanya bila hasil perlu dicatat", () => {
    const a = kartu("berjalan");
    expect(screen.getByRole("article").className).toContain("border-l-sky-500");
    a.unmount();
    const b = kartu("perlu", true);
    expect(screen.getByRole("article").className).toContain("border-l-rose-500");
    expect(screen.getByText("Catat hasil sidang:")).toBeTruthy();
    b.unmount();
    kartu("selesai", false);
    expect(screen.getByRole("article").className).toContain("border-l-emerald-500");
    expect(screen.queryByText("Catat hasil sidang:")).toBeNull();
  });
});

describe("isi lajur", () => {
  it("titik proses: jumlah titik = jumlah tahap dan posisi sekarang ditandai", () => {
    const { container } = render(<TitikTahap tahap={tahapDariAgenda("Jawaban Tergugat")} />);
    expect(container.querySelectorAll("i")).toHaveLength(5);
    expect(screen.getByText("Jawab-menjawab")).toBeTruthy();
    expect(container.querySelector("[data-tahap-sidang]")?.getAttribute("title")).toContain("Pemeriksaan → Mediasi → Jawab-menjawab");
  });

  it("sidang berikutnya: tundaan dan rencana CC terpisah, peringatan bila tanggal beda", () => {
    const { rerender, container } = render(
      <SidangBerikutnya
        tunda={{ tanggal: "10 Nov", agenda: "Jawaban", judul: "Tundaan" }}
        cc={{ tanggal: "17 Nov", agenda: "Pembuktian" }}
        beda
      />
    );
    expect(screen.getByText("Ditunda")).toBeTruthy();
    expect(screen.getByText("Rencana CC")).toBeTruthy();
    expect(screen.getByText("10 Nov")).toBeTruthy();
    expect(screen.getByText("17 Nov")).toBeTruthy();
    expect(screen.getByText(/Tanggal tunda berbeda dari Court Calendar/)).toBeTruthy();
    rerender(<SidangBerikutnya tunda={null} cc={{ tanggal: "17 Nov", agenda: "" }} beda={false} />);
    expect(screen.queryByText("Ditunda")).toBeNull();
    expect(screen.getByText("Rencana CC")).toBeTruthy();
    expect(screen.queryByText(/berbeda/)).toBeNull();
    rerender(<SidangBerikutnya tunda={null} cc={null} beda={false} />);
    expect(screen.getByText("Sidang berikutnya belum dijadwalkan")).toBeTruthy();
    expect(container.querySelector("[data-sidang-berikutnya]")).toBeNull();
  });

  it("tindak lanjut: Minutasi dan Unggah ✓/✗; BHT hanya bila ada sumbernya", () => {
    const format = (iso: string) => iso;
    const { rerender } = render(
      <TindakLanjutPutusan minutasi={false} unggah judulMinutasi="sebab" bht={null} tampilBht formatTanggal={format} />
    );
    expect(screen.getByText("Minutasi ✗")).toBeTruthy();
    expect(screen.getByText("Unggah ✓")).toBeTruthy();
    expect(screen.getByText("Minutasi ✗").getAttribute("title")).toBe("sebab");
    expect(screen.queryByText(/BHT/)).toBeNull();
    rerender(<TindakLanjutPutusan minutasi unggah={false} bht={{ iso: "2026-11-17", sumber: "perkiraan" }} tampilBht formatTanggal={format} />);
    expect(screen.getByText("Minutasi ✓")).toBeTruthy();
    expect(screen.getByText("Unggah ✗")).toBeTruthy();
    expect(screen.getByText(/Perkiraan BHT 2026-11-17/)).toBeTruthy();
    rerender(<TindakLanjutPutusan minutasi unggah bht={{ iso: "2026-11-17", sumber: "sipp" }} tampilBht={false} formatTanggal={format} />);
    expect(screen.queryByText(/BHT/)).toBeNull();
  });
});

describe("pilihan tampilan, menu, dan panel saringan", () => {
  it("pilihan lama/baru memanggil pemilih dengan nilai yang benar dan menandai yang aktif", () => {
    const pilih = vi.fn();
    render(<PilihanAntarmuka nilai="baru" onPilih={pilih} nama="Jadwal Sidang" />);
    expect(screen.getByRole("button", { name: "Tampilan baru" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Tampilan lama" }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Tampilan lama" }));
    expect(pilih).toHaveBeenCalledWith("lama");
  });

  it("segmen Saya | Semua", () => {
    const pilih = vi.fn();
    render(
      <SegmenPilihan
        label="Perkara saya atau semua"
        nilai={"saya" as "saya" | "semua"}
        onPilih={pilih}
        pilihan={[
          { nilai: "saya", label: "Saya" },
          { nilai: "semua", label: "Semua" },
        ]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Semua" }));
    expect(pilih).toHaveBeenCalledWith("semua");
  });

  it("menu titik membuka isi, menutup saat Esc atau saat di luar ditekan, dan item bertanda menutupnya", () => {
    render(
      <div>
        <MenuTitik label="Menu lain">
          <button type="button" data-tutup-menu="">
            Isi menu
          </button>
        </MenuTitik>
        <p>di luar</p>
      </div>
    );
    expect(screen.queryByText("Isi menu")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Menu lain" }));
    expect(screen.getByText("Isi menu")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Isi menu")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Menu lain" }));
    fireEvent.mouseDown(screen.getByText("di luar"));
    expect(screen.queryByText("Isi menu")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Menu lain" }));
    fireEvent.click(screen.getByText("Isi menu"));
    expect(screen.queryByText("Isi menu")).toBeNull();
  });

  it("panel saringan menulis pil, menyimpan dengan nama, memakai dan menghapus saringan tersimpan", () => {
    const alih = vi.fn();
    const simpan = vi.fn();
    const pakai = vi.fn();
    const hapus = vi.fn();
    const rentang = vi.fn();
    render(
      <PanelSaringan
        daftar={[
          { kunci: "ruang", label: "Ruang", nilai: [["Ruang 1", 5], ["Ruang 2", 2]] },
          { kunci: "hakim", label: "Hakim", nilai: [] },
        ]}
        pil={[{ medan: "ruang", nilai: "Ruang 1" }]}
        onAlih={alih}
        onRentangJam={rentang}
        tersimpan={[{ nama: "Pagi ruang 1" }]}
        onSimpan={simpan}
        onPakai={pakai}
        onHapus={hapus}
        onLepasSemua={() => undefined}
        onTutup={() => undefined}
      />
    );
    // medan tanpa nilai tidak digambar
    expect(screen.queryByText("Hakim")).toBeNull();
    const ruang1 = screen.getByRole("button", { name: /Ruang 1/ });
    expect(ruang1.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /Ruang 2/ }));
    expect(alih).toHaveBeenCalledWith("ruang", "Ruang 2");

    const tombolSimpan = screen.getByRole("button", { name: "Simpan saringan" }) as HTMLButtonElement;
    expect(tombolSimpan.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Nama saringan yang akan disimpan"), { target: { value: "  Saringan baru " } });
    expect(tombolSimpan.disabled).toBe(false);
    fireEvent.click(tombolSimpan);
    expect(simpan).toHaveBeenCalledWith("Saringan baru");

    fireEvent.click(screen.getByRole("button", { name: "Pagi ruang 1" }));
    expect(pakai).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByRole("button", { name: "Hapus saringan Pagi ruang 1" }));
    expect(hapus).toHaveBeenCalledWith(0);

    fireEvent.change(screen.getByLabelText("Jam dari"), { target: { value: "09:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Pakai" }));
    expect(rentang).toHaveBeenCalledWith("09:30", "16:00");
  });
});
