/**
 * ============================================================================
 * PERINGATAN SISA BLANGKO SEBELUM UNDUH / UNGGAH DI PORTAL (17 Okt 2026)
 * ============================================================================
 *
 * Pasangan antarmuka dari src/lib/deteksi-sisa-blangko.ts. Dipanggil sebelum
 * naskah putusan, BAS, atau relaas diunduh (tanganiUnduhan) atau diunggah dari
 * portal. Bila naskah bersih -- atau tidak terbaca (PDF tanpa teks, .doc biner)
 * -- tidak ada dialog dan alur lama berjalan persis seperti biasa.
 *
 * TIDAK MENAHAN: petugas selalu boleh lanjut. Pilihannya "Unduh daftar masalah
 * (.txt) lalu lanjut", "Lanjut saja", atau "Batal".
 *
 * Dialog dibangun dengan DOM biasa (bukan komponen React) supaya dapat dipanggil
 * dari pustaka murni seperti unduh-berkas.ts tanpa memasang pohon React baru.
 */
import {
  jenisNaskahDariAlamat,
  jenisNaskahDariNama,
  letakTemuan,
  NAMA_NASKAH,
  periksaBita,
  ringkasJenis,
  susunDaftarTxt,
  type JenisNaskah,
  type Paragraf,
  type Temuan,
} from "@/lib/deteksi-sisa-blangko";

export type PilihanSisa = "lanjut" | "batal";

export type OpsiTinjau = {
  nama?: string;
  jenis?: JenisNaskah | "";
  /** Alamat unduh/unggah, dipakai menebak jenis naskah bila `jenis` kosong. */
  alamat?: string;
  aksi: "unduh" | "unggah";
  /** Pembaca PDF (bita -> paragraf). Tanpa ini PDF dilewati. */
  bacaPdf?: (bita: Uint8Array) => Promise<Paragraf[]>;
};

const INGAT_MS = 3 * 60 * 1000;
const ingatan = new Map<string, number>();

function bersihkanNamaTxt(nama?: string): string {
  const batang =
    String(nama || "naskah")
      .replace(/\.[A-Za-z0-9]{2,5}$/, "")
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_")
      .trim()
      .slice(0, 120) || "naskah";
  return `Daftar masalah - ${batang}.txt`;
}

function simpanTxt(nama: string, isi: string): void {
  const blob = new Blob([`﻿${isi}`], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nama;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function buat<K extends keyof HTMLElementTagNameMap>(tag: K, gaya?: string, teks?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (gaya) e.style.cssText = gaya;
  if (teks != null) e.textContent = teks;
  return e;
}

/** Dialog peringatan. Pulang "lanjut" atau "batal". */
export function tampilkanDialogSisa(
  temuan: Temuan[],
  o: { nama?: string; jenis?: JenisNaskah | ""; aksi: "unduh" | "unggah"; terpotong?: number }
): Promise<PilihanSisa> {
  return new Promise((selesai) => {
    if (typeof document === "undefined" || !document.body) return selesai("lanjut");
    const aksi = o.aksi === "unggah" ? "diunggah" : "diunduh";
    const sebelumFokus = document.activeElement as HTMLElement | null;
    const tabir = buat(
      "div",
      "position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px;"
    );
    tabir.setAttribute("role", "dialog");
    tabir.setAttribute("aria-modal", "true");
    tabir.setAttribute("aria-label", "Naskah masih memuat sisa blangko");
    const kotak = buat(
      "div",
      "background:hsl(var(--card));color:hsl(var(--card-foreground));border:1px solid hsl(var(--border));border-radius:12px;max-width:640px;width:100%;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,.35);overflow:hidden;font-size:14px;line-height:1.5;"
    );
    const kepala = buat("div", "padding:16px 20px 8px;");
    kepala.appendChild(buat("div", "font-size:17px;font-weight:700;color:#c2410c;", "Naskah ini masih memuat sisa blangko"));
    const jenisTeks = o.jenis && NAMA_NASKAH[o.jenis] ? NAMA_NASKAH[o.jenis] : "naskah";
    kepala.appendChild(
      buat(
        "div",
        "margin-top:4px;opacity:.85;",
        `Ditemukan ${temuan.length}${o.terpotong ? "+" : ""} hal pada ${jenisTeks}${o.nama ? ` "${o.nama}"` : ""} yang sebaiknya diperbaiki sebelum ${aksi}.`
      )
    );
    const ringkas = buat("div", "display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;");
    for (const r of ringkasJenis(temuan)) {
      ringkas.appendChild(buat("span", "background:#fef3c7;color:#92400e;border-radius:999px;padding:2px 10px;font-size:12px;", `${r.label}: ${r.jumlah}`));
    }
    kepala.appendChild(ringkas);
    const isi = buat("div", "padding:8px 20px;overflow:auto;flex:1;");
    const daftar = buat("ol", "margin:0;padding-left:20px;");
    const tampil = temuan.slice(0, 12);
    for (const t of tampil) {
      const li = buat("li", "margin:0 0 8px;");
      li.appendChild(buat("div", "font-weight:600;font-size:13px;", `${t.label} - ${letakTemuan(t)}`));
      const k = buat("div", "font-size:13px;opacity:.9;word-break:break-word;");
      k.appendChild(document.createTextNode(t.sebelum ? `${t.sebelum} ` : ""));
      k.appendChild(buat("mark", "background:#fecaca;color:#7f1d1d;padding:0 2px;border-radius:3px;", t.cocok));
      k.appendChild(document.createTextNode(t.sesudah ? ` ${t.sesudah}` : ""));
      li.appendChild(k);
      daftar.appendChild(li);
    }
    isi.appendChild(daftar);
    if (temuan.length > tampil.length) {
      isi.appendChild(buat("div", "font-size:13px;opacity:.7;", `Dan ${temuan.length - tampil.length}${o.terpotong ? "+" : ""} lainnya - lengkapnya ada di daftar masalah (.txt).`));
    }
    const kaki = buat("div", "padding:12px 20px 16px;border-top:1px solid hsl(var(--border));display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;");
    const gayaTombol = "border-radius:8px;padding:8px 14px;font:inherit;cursor:pointer;border:1px solid hsl(var(--border));background:transparent;color:inherit;";
    const bUnduh = buat("button", `${gayaTombol}background:#1d4ed8;border-color:#1d4ed8;color:#fff;font-weight:600;`, "Unduh daftar masalah (.txt) lalu lanjut");
    const bLanjut = buat("button", gayaTombol, "Lanjut saja");
    const bBatal = buat("button", gayaTombol, "Batal");
    for (const b of [bUnduh, bLanjut, bBatal]) b.type = "button";

    let selesaiSudah = false;
    const tombolKeyboard = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        tutup("batal");
      }
    };
    const tutup = (pilihan: PilihanSisa) => {
      if (selesaiSudah) return;
      selesaiSudah = true;
      document.removeEventListener("keydown", tombolKeyboard, true);
      tabir.remove();
      try {
        sebelumFokus?.focus();
      } catch {
        /* fokus tidak wajib */
      }
      selesai(pilihan);
    };
    document.addEventListener("keydown", tombolKeyboard, true);
    bBatal.addEventListener("click", () => tutup("batal"));
    bLanjut.addEventListener("click", () => tutup("lanjut"));
    bUnduh.addEventListener("click", () => {
      try {
        simpanTxt(bersihkanNamaTxt(o.nama), susunDaftarTxt(temuan, o));
      } catch {
        /* gagal menyimpan daftar tidak boleh menahan */
      }
      tutup("lanjut");
    });
    kaki.appendChild(bBatal);
    kaki.appendChild(bLanjut);
    kaki.appendChild(bUnduh);
    kotak.appendChild(kepala);
    kotak.appendChild(isi);
    kotak.appendChild(kaki);
    tabir.appendChild(kotak);
    document.body.appendChild(tabir);
    try {
      bUnduh.focus();
    } catch {
      /* fokus tidak wajib */
    }
  });
}

/**
 * Pembaca PDF di peramban (pdfjs yang sudah dipakai pratinjau): satu paragraf per
 * baris teks, halaman sebenarnya. Dimuat hanya bila ada PDF yang perlu diperiksa.
 */
export async function bacaPdfPeramban(bita: Uint8Array, batasHalaman = 120): Promise<Paragraf[]> {
  const { loadPdfJsModule } = await import("@/lib/pdfjs-client");
  const pdfjs = await loadPdfJsModule();
  const dok = await pdfjs.getDocument({ data: bita.slice() }).promise;
  const hasil: Paragraf[] = [];
  const jumlah = Math.min(dok.numPages, batasHalaman);
  for (let h = 1; h <= jumlah; h += 1) {
    const halaman = await dok.getPage(h);
    const isi = await halaman.getTextContent();
    let baris = "";
    const tutupBaris = () => {
      if (/\S/.test(baris)) hasil.push({ teks: baris.trim(), merah: [], halaman: h, nomor: hasil.length + 1 });
      baris = "";
    };
    for (const it of isi.items) {
      if (!("str" in it)) continue;
      baris += it.str;
      if (it.hasEOL) tutupBaris();
    }
    tutupBaris();
  }
  return hasil;
}

/**
 * Periksa lalu (bila ada temuan) tanyakan petugas. Tidak pernah melempar: gagal
 * memeriksa berarti lanjut seperti biasa.
 */
export async function tinjauSisaBlangko(sumber: Blob | Uint8Array | ArrayBuffer, opsi: OpsiTinjau): Promise<{ lanjut: boolean; temuan: Temuan[] }> {
  try {
    const jenis = opsi.jenis || jenisNaskahDariAlamat(opsi.alamat) || jenisNaskahDariNama(opsi.nama);
    if (!jenis) return { lanjut: true, temuan: [] };
    const bita =
      sumber instanceof Uint8Array ? sumber : sumber instanceof ArrayBuffer ? new Uint8Array(sumber) : new Uint8Array(await sumber.arrayBuffer());
    const kunci = `${jenis}|${opsi.nama || ""}|${bita.length}`;
    const w = ingatan.get(kunci);
    if (w && Date.now() - w < INGAT_MS) return { lanjut: true, temuan: [] };
    const h = await periksaBita(bita, opsi.nama, { bacaPdf: opsi.bacaPdf ?? bacaPdfPeramban });
    if (!h.dibaca || !h.hasil || !h.hasil.temuan.length) return { lanjut: true, temuan: [] };
    const pilihan = await tampilkanDialogSisa(h.hasil.temuan, { nama: opsi.nama, jenis, aksi: opsi.aksi, terpotong: h.hasil.terpotong });
    if (pilihan === "lanjut") ingatan.set(kunci, Date.now());
    return { lanjut: pilihan === "lanjut", temuan: h.hasil.temuan };
  } catch {
    return { lanjut: true, temuan: [] };
  }
}
