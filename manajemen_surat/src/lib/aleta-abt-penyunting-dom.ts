import type { ParagrafLayar } from "@/lib/aleta-abt-penyunting-tipe";
import type { BagianTeks } from "@/lib/aleta-abt-rtf";

/**
 * ============================================================================
 * LAYAR PENYUNTING BLANGKO: DOKUMEN YANG BISA DIKETIK (ALETA ABT Tahap 3, 5 Nov 2026)
 * ============================================================================
 *
 * Tiap paragraf blangko menjadi satu blok yang bisa diketik; isian tampil sebagai tanda bernama (nomornya tidak terlihat,
 * tidak perlu diketik), gambar/kotak/bidang tampil sebagai tanda terkunci. Dibangun langsung di DOM (bukan lewat React) karena
 * peramban sendiri yang mengelola isi bidang yang bisa diketik; React hanya memegang bar tombol di atasnya.
 *
 *   teks paragraf yang dikirim ke server = teks blok dengan tanda isian -> #NNNN#, tanda terkunci -> U+FFFC, Enter -> U+2029.
 *   Yang tidak diubah tidak dikirim; server menambal bita hanya untuk aksara yang berubah.
 */

const AKSARA_KOTAK = "￼";
const PEMISAH = " ";

export type InfoIsian = Record<string, { nama: string; bersyarat: boolean }>;

export type OpsiPenyunting = {
  dapatDisunting: boolean;
  isian: InfoIsian;
  /** Dipanggil tiap ada perubahan: jumlah paragraf yang berubah + dihapus. */
  saatUbah: (jumlah: number) => void;
};

export type PenyuntingDom = {
  /** Suntingan dan penghapusan sejak dibuka. */
  ambil(): { suntingan: Array<{ i: number; teks: string }>; hapus: number[] };
  jumlahUbah(): number;
  /** Sisipkan tanda isian di tempat kursor terakhir; false bila belum ada tempat. */
  sisipIsian(no: string): boolean;
  hancurkan(): void;
};

export function teksAsalParagraf(bagian: BagianTeks[]): string {
  return bagian.map((b) => (b.j === "teks" ? b.t : b.j === "isian" ? `#${b.r ?? b.no}#` : AKSARA_KOTAK)).join("");
}

/** Teks logis sebuah blok (atau simpul mana pun) seperti yang akan dikirim ke server. */
export function teksDariSimpul(simpul: Node): string {
  let h = "";
  const jalan = (n: Node) => {
    n.childNodes.forEach((a) => {
      if (a.nodeType === 3) {
        h += (a.nodeValue ?? "").replace(/​/g, "");
        return;
      }
      if (a.nodeType !== 1) return;
      const e = a as HTMLElement;
      if (e.dataset?.no !== undefined) h += `#${e.dataset.raw || e.dataset.no}#`;
      else if (e.dataset?.kotak !== undefined) h += AKSARA_KOTAK;
      else if (e.tagName === "BR") {
        if (e.nextSibling) h += "\n";
      } else jalan(e);
    });
  };
  jalan(simpul);
  return h;
}

const KELAS_ISIAN =
  "mx-0.5 inline-block rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0 align-baseline text-[0.92em] font-medium text-primary select-none";
const KELAS_BERSYARAT = "border-dashed";
const KELAS_KOTAK = "mx-0.5 inline-block rounded-md border border-dashed border-border bg-muted px-1.5 py-0 align-baseline text-[0.85em] text-muted-foreground select-none";

function buatIsian(no: string, raw: string, info: InfoIsian): HTMLElement {
  const e = document.createElement("span");
  const i = info[no];
  e.className = `${KELAS_ISIAN}${i?.bersyarat ? ` ${KELAS_BERSYARAT}` : ""}`;
  e.setAttribute("contenteditable", "false");
  e.dataset.no = no;
  e.dataset.raw = raw;
  e.textContent = i?.nama ?? `Isian ${no}`;
  if (i?.bersyarat) e.title = "Isian ini bisa kosong atau berganti menurut keadaan perkara.";
  return e;
}

function buatKotak(label: string): HTMLElement {
  const e = document.createElement("span");
  e.className = KELAS_KOTAK;
  e.setAttribute("contenteditable", "false");
  e.dataset.kotak = "1";
  e.textContent = `Terkunci: ${label}`;
  e.title = "Bagian ini tidak dapat diubah di sini agar letaknya tidak bergeser.";
  return e;
}

function isiBlok(blok: HTMLElement, bagian: BagianTeks[], info: InfoIsian) {
  blok.replaceChildren();
  for (const b of bagian) {
    if (b.j === "isian") blok.appendChild(buatIsian(b.no, b.r ?? b.no, info));
    else if (b.j === "kotak") blok.appendChild(buatKotak(b.label));
    else {
      const s = document.createElement("span");
      if (b.g & 1) s.style.fontWeight = "700";
      if (b.g & 2) s.style.fontStyle = "italic";
      if (b.g & 4) s.style.textDecoration = "underline";
      s.textContent = b.t;
      blok.appendChild(s);
    }
  }
}

const px = (twips: number) => Math.max(0, Math.round((twips / 20) * 1.3));

/** Bangun dokumen di dalam `akar` (dikosongkan dulu). */
export function pasangPenyunting(akar: HTMLElement, paragraf: ParagrafLayar[], opsi: OpsiPenyunting): PenyuntingDom {
  akar.replaceChildren();
  const asal = new Map<number, string>();
  const grup = new Map<number, HTMLElement>();
  const berubah = new Set<number>();
  const dihapus = new Set<number>();
  const tabel = new Set<number>();
  let blokTerakhir: HTMLElement | null = null;
  let rentangTerakhir: Range | null = null;

  const lapor = () => opsi.saatUbah(berubah.size + dihapus.size);
  const teksGrup = (g: HTMLElement) => {
    const bloks = Array.from(g.querySelectorAll<HTMLElement>("[data-blok]"));
    return bloks.map((b) => teksDariSimpul(b)).join(PEMISAH);
  };
  const periksa = (g: HTMLElement) => {
    const i = Number(g.dataset.i);
    if (teksGrup(g) !== asal.get(i)) berubah.add(i);
    else berubah.delete(i);
    lapor();
  };

  const simpanRentang = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    const blok = (r.startContainer.nodeType === 1 ? (r.startContainer as HTMLElement) : r.startContainer.parentElement)?.closest<HTMLElement>("[data-blok]");
    if (blok && akar.contains(blok)) {
      blokTerakhir = blok;
      rentangTerakhir = r.cloneRange();
    }
  };

  const sisipTeks = (teks: string) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    r.deleteContents();
    const t = document.createTextNode(teks);
    r.insertNode(t);
    r.setStartAfter(t);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  };

  for (const p of paragraf) {
    asal.set(p.i, teksAsalParagraf(p.bagian));
    if (p.tabel) tabel.add(p.i);
    const g = document.createElement("div");
    g.dataset.i = String(p.i);
    g.className = "group relative rounded-md px-1 py-0.5 focus-within:bg-accent/40";
    const ada = p.bagian.some((b) => b.j === "kotak");
    const terkunci = !opsi.dapatDisunting || Boolean(p.terkunci);
    if (p.tabel) {
      const t = document.createElement("div");
      t.className = "mb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground";
      t.textContent = "Sel tabel";
      g.appendChild(t);
    }
    const baris = document.createElement("div");
    baris.className = "flex items-start gap-2";
    if (p.awalan) {
      const n = document.createElement("span");
      n.className = "shrink-0 select-none text-muted-foreground";
      n.textContent = p.awalan;
      baris.appendChild(n);
    }
    const blok = document.createElement("div");
    blok.dataset.blok = "1";
    blok.className = "min-h-[1.5em] min-w-0 whitespace-pre-wrap break-words outline-none";
    blok.style.textAlign = p.rata === "tengah" ? "center" : p.rata === "kanan" ? "right" : p.rata === "rata" ? "justify" : "left";
    if (p.li > 0) blok.style.paddingLeft = `min(${px(p.li)}px, 12vw)`;
    if (p.fi > 0) blok.style.textIndent = `min(${px(p.fi)}px, 8vw)`;
    isiBlok(blok, p.bagian, opsi.isian);
    if (terkunci) {
      blok.setAttribute("contenteditable", "false");
      blok.classList.add("text-muted-foreground");
      if (p.terkunci) blok.title = p.terkunci;
    } else {
      blok.setAttribute("contenteditable", "true");
      blok.spellcheck = true;
      blok.setAttribute("role", "textbox");
      blok.setAttribute("aria-multiline", "true");
      blok.setAttribute("aria-label", `Paragraf ${p.i + 1}`);
    }
    // Enter menaruh blok baru sesudah blok ini; satu kolom supaya tampil di bawahnya, bukan di sampingnya.
    const kolom = document.createElement("div");
    kolom.className = "min-w-0 flex-1 space-y-2";
    kolom.dataset.kolom = "";
    kolom.appendChild(blok);
    baris.appendChild(kolom);
    g.appendChild(baris);
    if (p.terkunci) {
      const c = document.createElement("div");
      c.className = "mt-0.5 text-xs text-muted-foreground";
      c.textContent = `Terkunci: ${p.terkunci}`;
      g.appendChild(c);
    }
    if (!terkunci && !p.tabel && !ada) {
      const h = document.createElement("button");
      h.type = "button";
      h.className = "absolute -top-2 right-1 hidden rounded-md border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground shadow-sm hover:text-destructive group-focus-within:block";
      h.textContent = "Hapus paragraf";
      h.dataset.hapus = "1";
      g.appendChild(h);
    }
    akar.appendChild(g);
    grup.set(p.i, g);
  }

  const bukaGrup = (e: Event) => (e.target as HTMLElement).closest<HTMLElement>("[data-i]");

  const saatKlik = (e: Event) => {
    const t = e.target as HTMLElement;
    if (t.dataset?.hapus === undefined) return;
    const g = bukaGrup(e);
    if (!g) return;
    const i = Number(g.dataset.i);
    if (dihapus.has(i)) {
      dihapus.delete(i);
      g.classList.remove("opacity-50", "line-through");
      t.textContent = "Hapus paragraf";
    } else {
      dihapus.add(i);
      berubah.delete(i);
      g.classList.add("opacity-50", "line-through");
      t.textContent = "Batalkan hapus";
      // Pulihkan teks asal agar tidak terkirim sebagai suntingan.
      const blok = g.querySelector<HTMLElement>("[data-blok]");
      const p = paragraf.find((x) => x.i === i);
      if (blok && p) {
        g.querySelectorAll("[data-baru]").forEach((x) => x.remove());
        isiBlok(blok, p.bagian, opsi.isian);
      }
    }
    lapor();
  };

  const saatMasuk = (e: Event) => {
    const g = bukaGrup(e);
    if (g) periksa(g);
  };

  const saatTekan = (e: KeyboardEvent) => {
    const blok = (e.target as HTMLElement).closest<HTMLElement>("[data-blok]");
    const g = blok?.closest<HTMLElement>("[data-i]");
    if (!blok || !g || blok.getAttribute("contenteditable") !== "true") return;
    const i = Number(g.dataset.i);
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        sisipTeks("\n");
        periksa(g);
        return;
      }
      if (tabel.has(i)) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const r = sel.getRangeAt(0);
      r.deleteContents();
      const sisa = document.createRange();
      sisa.setStart(r.endContainer, r.endOffset);
      sisa.setEndAfter(blok.lastChild ?? blok);
      const isi = sisa.extractContents();
      const baru = blok.cloneNode(false) as HTMLElement;
      baru.dataset.baru = "1";
      baru.removeAttribute("title");
      baru.appendChild(isi);
      blok.after(baru);
      // Peramban meninggalkan blok kosong tanpa tempat kursor: beri satu simpul teks kosong.
      if (!blok.firstChild) blok.appendChild(document.createTextNode(""));
      if (!baru.firstChild) baru.appendChild(document.createTextNode(""));
      baru.focus();
      const r2 = document.createRange();
      r2.setStart(baru, 0);
      r2.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r2);
      periksa(g);
      return;
    }
    if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      sisipTeks("\t");
      periksa(g);
      return;
    }
    if (e.key === "Backspace" && blok.dataset.baru === "1") {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return;
      const r = sel.getRangeAt(0);
      const awal = document.createRange();
      awal.setStart(blok, 0);
      awal.setEnd(r.startContainer, r.startOffset);
      if (awal.toString() === "" && !awal.cloneContents().querySelector("[data-no],[data-kotak]")) {
        const sebelum = blok.previousElementSibling as HTMLElement | null;
        if (!sebelum || !("blok" in sebelum.dataset)) return;
        e.preventDefault();
        const titik = document.createTextNode("");
        sebelum.appendChild(titik);
        while (blok.firstChild) sebelum.appendChild(blok.firstChild);
        blok.remove();
        sebelum.focus();
        const r2 = document.createRange();
        r2.setStart(titik, 0);
        r2.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r2);
        periksa(g);
      }
    }
  };

  const saatTempel = (e: ClipboardEvent) => {
    const blok = (e.target as HTMLElement).closest<HTMLElement>("[data-blok]");
    const g = blok?.closest<HTMLElement>("[data-i]");
    if (!blok || !g || blok.getAttribute("contenteditable") !== "true") return;
    e.preventDefault();
    const teks = (e.clipboardData?.getData("text/plain") ?? "").replace(/\r\n?/g, "\n");
    if (!teks) return;
    sisipTeks(teks);
    periksa(g);
  };

  const cegah = (e: Event) => {
    if ((e.target as HTMLElement).closest("[data-blok]")) e.preventDefault();
  };

  akar.addEventListener("click", saatKlik);
  akar.addEventListener("input", saatMasuk);
  akar.addEventListener("keydown", saatTekan);
  akar.addEventListener("paste", saatTempel);
  akar.addEventListener("drop", cegah);
  akar.addEventListener("dragstart", cegah);
  akar.addEventListener("keyup", simpanRentang);
  akar.addEventListener("mouseup", simpanRentang);
  akar.addEventListener("focusout", simpanRentang);
  akar.addEventListener("touchend", simpanRentang);

  return {
    ambil() {
      const suntingan = [...berubah]
        .filter((i) => !dihapus.has(i))
        .sort((a, b) => a - b)
        .map((i) => ({ i, teks: teksGrup(grup.get(i) as HTMLElement) }));
      return { suntingan, hapus: [...dihapus].sort((a, b) => a - b) };
    },
    jumlahUbah: () => berubah.size + dihapus.size,
    sisipIsian(no: string) {
      if (!opsi.dapatDisunting) return false;
      const blok = blokTerakhir && akar.contains(blokTerakhir) && blokTerakhir.getAttribute("contenteditable") === "true" ? blokTerakhir : null;
      if (!blok) return false;
      const chip = buatIsian(no, no, opsi.isian);
      const r = rentangTerakhir && blok.contains(rentangTerakhir.startContainer) ? rentangTerakhir.cloneRange() : null;
      if (r) {
        r.deleteContents();
        r.insertNode(chip);
      } else blok.appendChild(chip);
      const sel = window.getSelection();
      if (sel) {
        const r2 = document.createRange();
        r2.setStartAfter(chip);
        r2.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r2);
        rentangTerakhir = r2.cloneRange();
      }
      blokTerakhir = blok;
      const g = blok.closest<HTMLElement>("[data-i]");
      if (g) periksa(g);
      return true;
    },
    hancurkan() {
      akar.removeEventListener("click", saatKlik);
      akar.removeEventListener("input", saatMasuk);
      akar.removeEventListener("keydown", saatTekan);
      akar.removeEventListener("paste", saatTempel);
      akar.removeEventListener("drop", cegah);
      akar.removeEventListener("dragstart", cegah);
      akar.removeEventListener("keyup", simpanRentang);
      akar.removeEventListener("mouseup", simpanRentang);
      akar.removeEventListener("focusout", simpanRentang);
      akar.removeEventListener("touchend", simpanRentang);
      akar.replaceChildren();
    },
  };
}
