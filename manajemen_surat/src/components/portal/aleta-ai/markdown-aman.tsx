"use client";

import { Fragment, type ReactNode } from "react";

/**
 * Markdown aman untuk jawaban ALETA Ai.
 *
 * Tidak memakai dangerouslySetInnerHTML: teks mentah (termasuk tag HTML) selalu
 * ditulis sebagai teks, dan tautan hanya boleh http/https/mailto. Yang dikenali:
 * judul, daftar (bertingkat satu lapis), tabel, kutipan, garis, blok kode, dan
 * tebal/miring/kode/tautan di dalam baris. Blok kode yang belum ditutup (jawaban
 * masih mengalir) tetap ditampilkan sebagai kode.
 */

type Blok =
  | { jenis: "judul"; tingkat: number; teks: string }
  | { jenis: "paragraf"; teks: string }
  | { jenis: "kode"; bahasa: string; isi: string }
  | { jenis: "daftar"; berurut: boolean; butir: { teks: string; anak: string[] }[] }
  | { jenis: "tabel"; kepala: string[]; baris: string[][] }
  | { jenis: "kutipan"; teks: string }
  | { jenis: "garis" };

const POLA_TABEL_PEMISAH = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function pecahBarisTabel(baris: string): string[] {
  let isi = baris.trim();
  if (isi.startsWith("|")) isi = isi.slice(1);
  if (isi.endsWith("|")) isi = isi.slice(0, -1);
  return isi.split("|").map((sel) => sel.trim());
}

export function uraiMarkdown(sumber: string): Blok[] {
  const baris = sumber.replace(/\r\n?/g, "\n").split("\n");
  const hasil: Blok[] = [];
  let i = 0;
  while (i < baris.length) {
    const b = baris[i];
    if (!b.trim()) {
      i += 1;
      continue;
    }
    const pagar = /^\s*(```|~~~)\s*([\w+-]*)\s*$/.exec(b);
    if (pagar) {
      const penutup = pagar[1];
      const isi: string[] = [];
      i += 1;
      while (i < baris.length && !baris[i].trim().startsWith(penutup)) {
        isi.push(baris[i]);
        i += 1;
      }
      i += 1;
      hasil.push({ jenis: "kode", bahasa: pagar[2], isi: isi.join("\n") });
      continue;
    }
    const judul = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(b);
    if (judul) {
      hasil.push({ jenis: "judul", tingkat: judul[1].length, teks: judul[2] });
      i += 1;
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(b)) {
      hasil.push({ jenis: "garis" });
      i += 1;
      continue;
    }
    if (b.includes("|") && i + 1 < baris.length && POLA_TABEL_PEMISAH.test(baris[i + 1]) && baris[i + 1].includes("-")) {
      const kepala = pecahBarisTabel(b);
      const isi: string[][] = [];
      i += 2;
      while (i < baris.length && baris[i].trim() && baris[i].includes("|")) {
        isi.push(pecahBarisTabel(baris[i]));
        i += 1;
      }
      hasil.push({ jenis: "tabel", kepala, baris: isi });
      continue;
    }
    if (/^\s*>\s?/.test(b)) {
      const isi: string[] = [];
      while (i < baris.length && /^\s*>\s?/.test(baris[i])) {
        isi.push(baris[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      hasil.push({ jenis: "kutipan", teks: isi.join("\n") });
      continue;
    }
    const butirPertama = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(b);
    if (butirPertama) {
      const berurut = /\d/.test(butirPertama[2]);
      const butir: { teks: string; anak: string[] }[] = [];
      while (i < baris.length) {
        const m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(baris[i]);
        if (!m) break;
        if (m[1].length >= 2 && butir.length) {
          butir[butir.length - 1].anak.push(m[3]);
        } else {
          butir.push({ teks: m[3], anak: [] });
        }
        i += 1;
      }
      hasil.push({ jenis: "daftar", berurut, butir });
      continue;
    }
    const para: string[] = [b];
    i += 1;
    while (
      i < baris.length &&
      baris[i].trim() &&
      !/^\s*(```|~~~)/.test(baris[i]) &&
      !/^#{1,6}\s/.test(baris[i]) &&
      !/^\s*([-*+]|\d+[.)])\s+/.test(baris[i]) &&
      !/^\s*>/.test(baris[i])
    ) {
      para.push(baris[i]);
      i += 1;
    }
    hasil.push({ jenis: "paragraf", teks: para.join("\n") });
  }
  return hasil;
}

function tautanAman(href: string): string | null {
  const bersih = href.trim();
  return /^(https?:\/\/|mailto:)/i.test(bersih) ? bersih : null;
}

const POLA_INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+?\*\*|__[^_\n]+?__)|(\*[^*\n]+?\*|_[^_\n]+?_)|(\[[^\]\n]+\]\([^)\s]+\))/;

function inline(teks: string, kunci = "i"): ReactNode[] {
  const keluar: ReactNode[] = [];
  let sisa = teks;
  let n = 0;
  while (sisa) {
    const cocok = POLA_INLINE.exec(sisa);
    if (!cocok) {
      keluar.push(sisa);
      break;
    }
    if (cocok.index > 0) keluar.push(sisa.slice(0, cocok.index));
    const token = cocok[0];
    const k = `${kunci}-${n++}`;
    if (cocok[1]) {
      keluar.push(
        <code key={k} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">
          {token.slice(1, -1)}
        </code>
      );
    } else if (cocok[2]) {
      keluar.push(<strong key={k}>{inline(token.slice(2, -2), k)}</strong>);
    } else if (cocok[3]) {
      keluar.push(<em key={k}>{inline(token.slice(1, -1), k)}</em>);
    } else {
      const m = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      const href = m ? tautanAman(m[2]) : null;
      if (m && href) {
        keluar.push(
          <a key={k} href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline underline-offset-2">
            {m[1]}
          </a>
        );
      } else {
        keluar.push(m ? m[1] : token);
      }
    }
    sisa = sisa.slice(cocok.index + token.length);
  }
  return keluar;
}

function barisBerjeda(teks: string, kunci: string): ReactNode {
  const bagian = teks.split("\n");
  return bagian.map((b, idx) => (
    <Fragment key={`${kunci}-${idx}`}>
      {idx > 0 ? <br /> : null}
      {inline(b, `${kunci}-${idx}`)}
    </Fragment>
  ));
}

const KELAS_JUDUL: Record<number, string> = {
  1: "mt-5 text-xl font-semibold",
  2: "mt-5 text-lg font-semibold",
  3: "mt-4 text-base font-semibold",
  4: "mt-3 text-base font-semibold",
  5: "mt-3 text-sm font-semibold",
  6: "mt-3 text-sm font-semibold",
};

export function MarkdownAman({ teks }: { teks: string }) {
  const blok = uraiMarkdown(teks);
  return (
    <div className="space-y-3 break-words text-[0.95rem] leading-7 text-foreground" data-testid="markdown-aman">
      {blok.map((b, idx) => {
        const k = `b${idx}`;
        switch (b.jenis) {
          case "judul": {
            const Tag = `h${Math.min(6, b.tingkat + 1)}` as "h2";
            return (
              <Tag key={k} className={KELAS_JUDUL[b.tingkat] ?? KELAS_JUDUL[6]}>
                {inline(b.teks, k)}
              </Tag>
            );
          }
          case "paragraf":
            return <p key={k}>{barisBerjeda(b.teks, k)}</p>;
          case "kode":
            return (
              <pre key={k} className="overflow-x-auto rounded-xl border border-border/70 bg-muted/60 p-3 font-mono text-[0.82rem] leading-6" tabIndex={0}>
                <code>{b.isi}</code>
              </pre>
            );
          case "daftar": {
            const Tag = b.berurut ? "ol" : "ul";
            return (
              <Tag key={k} className={`${b.berurut ? "list-decimal" : "list-disc"} space-y-1 pl-6 marker:text-muted-foreground`}>
                {b.butir.map((butir, j) => (
                  <li key={`${k}-${j}`}>
                    {inline(butir.teks, `${k}-${j}`)}
                    {butir.anak.length ? (
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {butir.anak.map((a, m) => (
                          <li key={`${k}-${j}-${m}`}>{inline(a, `${k}-${j}-${m}`)}</li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </Tag>
            );
          }
          case "tabel":
            return (
              <div key={k} className="overflow-x-auto rounded-xl border border-border/70">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-muted/60">
                    <tr>
                      {b.kepala.map((h, j) => (
                        <th key={`${k}-h${j}`} scope="col" className="border-b border-border/70 px-3 py-2 font-semibold">
                          {inline(h, `${k}-h${j}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.baris.map((baris, r) => (
                      <tr key={`${k}-r${r}`} className="odd:bg-card/40">
                        {baris.map((sel, c) => (
                          <td key={`${k}-r${r}c${c}`} className="border-t border-border/50 px-3 py-2 align-top">
                            {inline(sel, `${k}-r${r}c${c}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "kutipan":
            return (
              <blockquote key={k} className="border-l-4 border-primary/40 pl-4 text-muted-foreground">
                {barisBerjeda(b.teks, k)}
              </blockquote>
            );
          case "garis":
            return <hr key={k} className="border-border/70" />;
          default:
            return null;
        }
      })}
    </div>
  );
}
