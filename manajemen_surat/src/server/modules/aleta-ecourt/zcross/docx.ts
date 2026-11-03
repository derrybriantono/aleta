import { keEmu, type RencanaZ } from "./geometri";
import { bacaZip, entriBaru, isiEntri, tulisZip, type EntriZip } from "./zip";
import { atribut, cari, dekodeEntitas, enkodeEntitas, leluhur, semuaKeturunan, uraiXml, type SimpulXml } from "./xml-mini";

/**
 * Z CROSS OTOMATIS - LINTASAN 2 UNTUK DOCX (word/document.xml): sama dengan rtf.ts tetapi bentuknya wp:anchor (garis Z = satu bentuk
 * bebas wps:wsp, tanggal = kotak teks) dan nomor halaman bagian berikutnya lewat w:pgNumType w:start di w:sectPr bagian itu.
 * Nama bentuk "zcross-*" menandai buatan modul ini (diganti, bukan ditumpuk, pada penyesuaian ulang).
 */
export const BERKAS_DOKUMEN = "word/document.xml";

export type ParagrafDocx = { indeks: number; simpul: SimpulXml; teks: string; punyaSectPr: SimpulXml | null };
export type SeksiDocx = { sectPr: SimpulXml; paragrafIndeks: number | null };

const TUJUAN_LEWATI = new Set(["w:txbxContent", "w:drawing", "w:pict", "mc:AlternateContent", "w:instrText", "w:delText", "w:del", "mc:Fallback"]);

export function paragrafDocx(x: string, akar: SimpulXml): ParagrafDocx[] {
  const hasil: ParagrafDocx[] = [];
  semuaKeturunan(akar, (n) => {
    if (n.nama === "w:txbxContent") return false;
    if (n.nama === "w:p") {
      let teks = "";
      const kumpul = (s: SimpulXml) => {
        for (const a of s.anak) {
          if (TUJUAN_LEWATI.has(a.nama)) continue;
          if (a.nama === "w:t") teks += dekodeEntitas(x.slice(a.awalIsi, a.akhirIsi));
          else if (a.nama === "w:tab" || a.nama === "w:br" || a.nama === "w:noBreakHyphen") teks += a.nama === "w:noBreakHyphen" ? "-" : " ";
          else kumpul(a);
        }
      };
      kumpul(n);
      const ppr = n.anak.find((a) => a.nama === "w:pPr");
      const sp = ppr?.anak.find((a) => a.nama === "w:sectPr") ?? null;
      hasil.push({ indeks: hasil.length, simpul: n, teks, punyaSectPr: sp });
      return true;
    }
  });
  return hasil;
}

export function seksiDocx(akar: SimpulXml, paragraf: ParagrafDocx[]): SeksiDocx[] {
  const hasil: SeksiDocx[] = [];
  for (const p of paragraf) if (p.punyaSectPr) hasil.push({ sectPr: p.punyaSectPr, paragrafIndeks: p.indeks });
  const body = cari(akar, "w:body")[0];
  const akhir = body?.anak.filter((a) => a.nama === "w:sectPr").pop();
  if (akhir) hasil.push({ sectPr: akhir, paragrafIndeks: null });
  return hasil;
}

/** Run (w:r) terdekat di atas simpul, bukan di dalam bentuk lain. */
function runInduk(n: SimpulXml): SimpulXml | null {
  for (let p: SimpulXml | null = n; p; p = p.induk) if (p.nama === "w:r") return p;
  return null;
}

/** Run-run di paragraf yang memuat bentuk (drawing / pict / AlternateContent). */
function runBentuk(p: SimpulXml): SimpulXml[] {
  const hasil = new Set<SimpulXml>();
  const telusur = (s: SimpulXml) => {
    for (const a of s.anak) {
      if (a.nama === "w:txbxContent") continue;
      if (a.nama === "w:r") {
        let ada = false;
        semuaKeturunan(a, (c) => {
          if (c.nama === "w:drawing" || c.nama === "w:pict" || c.nama === "mc:AlternateContent") ada = true;
        });
        if (ada) hasil.add(a);
        continue;
      }
      telusur(a);
    }
  };
  telusur(p);
  return [...hasil];
}

const adalahZ = (potong: string): boolean => /zcross-|SC\s*Z|(?:name|id)="FreeForm/.test(potong);
const adalahScZ = (potong: string): boolean => /zcross-|SC\s*Z/.test(potong);
const bermaknaDocx = (t: string): boolean => /\p{L}{2,}/u.test(t);
const tampakDocx = (t: string): boolean => /\S/.test(t);

/** Sama dengan JangkarRtf (rtf.ts): indeks = paragraf ukur, teksIndeks = paragraf bertulisan tampak terakhir, akhirIndeks = pemilik tanda terakhir. */
export type JangkarDocx = { indeks: number; teksIndeks: number; akhirIndeks: number; via: "bentuk" | "ujung-daftar"; pemilik: number[] };

/** SEMUA tempat Z (urut naik) - aturan sama dengan cariSemuaJangkarRtf. */
export function cariSemuaJangkarDocx(x: string, paragraf: ParagrafDocx[]): JangkarDocx[] {
  const tanda = paragraf
    .map((p) => {
      const rb = runBentuk(p.simpul).map((r) => x.slice(r.awal, r.akhir));
      return { i: p.indeks, z: rb.some(adalahZ), sc: rb.some(adalahScZ) };
    })
    .filter((t) => t.z);
  const hasil: JangkarDocx[] = [];
  let k = tanda.length - 1;
  while (k >= 0) {
    const akhir = tanda[k].i;
    let t = akhir;
    while (t > 0 && !tampakDocx(paragraf[t].teks)) t -= 1;
    let u = t;
    while (u > 0 && !bermaknaDocx(paragraf[u].teks)) u -= 1;
    const kelompok: typeof tanda = [];
    while (k >= 0 && tanda[k].i >= t) {
      kelompok.push(tanda[k]);
      k -= 1;
    }
    if (!tampakDocx(paragraf[t].teks) || !bermaknaDocx(paragraf[u].teks)) continue;
    if (!kelompok.some((g) => g.sc) && !/(?:berikut(?:\s+ini)?|berupa)\s*:\s*$/i.test(paragraf[u].teks)) continue;
    if (leluhur(paragraf[t].simpul, "w:tc")) continue; // bentuk di sel tabel letaknya relatif terhadap sel
    hasil.push({ indeks: u, teksIndeks: t, akhirIndeks: akhir, via: "bentuk", pemilik: kelompok.map((g) => g.i).sort((a, b) => a - b) });
  }
  return hasil.reverse();
}

export function cariJangkarDocx(x: string, paragraf: ParagrafDocx[]): JangkarDocx | null {
  const semua = cariSemuaJangkarDocx(x, paragraf);
  if (semua.length) return semua[semua.length - 1];
  for (let i = paragraf.length - 1; i >= 0; i -= 1) if (/(?:berikut|berupa)\s*:\s*$/i.test(paragraf[i].teks)) return { indeks: i, teksIndeks: i, akhirIndeks: i, via: "ujung-daftar", pemilik: [] };
  return null;
}

export type PembersihanDocx = { xml: string; labelTanggal: string | null; labelPerJangkar: Array<string | null>; jumlahBentukDibuang: number };

const teksLabel = (isi: string): string => dekodeEntitas(isi.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

export function bersihkanZDocx(sumber: string): PembersihanDocx {
  const akar = uraiXml(sumber);
  const paragraf = paragrafDocx(sumber, akar);
  const semua = cariSemuaJangkarDocx(sumber, paragraf);
  const buang: Array<[number, number]> = [];
  const labelPerJangkar: Array<string | null> = [];
  // Z gambar tangan lama berupa garis lurus (DrawingML garis/penghubung lurus, VML jenis 20/32) di paragraf-paragraf pemilik tanda Z ikut
  // dibuang (keputusan 87; DOC lama yang diubah Word ke DOCX menaruh garisnya di paragraf tetangga kotak "SC Z").
  const RE_GARIS = /prst="(?:line|straightConnector1)"|<v:line\b|o:spt="(?:20|32)"|type="#_x0000_t(?:20|32)"/;
  const diJangkar = new Set<number>();
  for (const j of semua) {
    let label: string | null = null;
    // seluruh paragraf kelompok: paragraf ukur s.d. pemilik tanda terakhir (isian kosong "..." di antaranya ikut diperiksa)
    const jendela: number[] = [];
    for (let i = j.indeks; i <= j.akhirIndeks; i += 1) jendela.push(i);
    const adaTanda = jendela.some((i) => runBentuk(paragraf[i].simpul).some((r) => adalahZ(sumber.slice(r.awal, r.akhir))));
    for (const i of jendela) {
      diJangkar.add(i);
      for (const r of runBentuk(paragraf[i].simpul)) {
        const potong = sumber.slice(r.awal, r.akhir);
        const garisLama = adaTanda && RE_GARIS.test(potong) && !/<w:txbxContent/.test(potong);
        if (!adalahZ(potong) && !garisLama) continue;
        buang.push([r.awal, r.akhir]);
        const m = /<w:txbxContent[^>]*>([\s\S]*?)<\/w:txbxContent>/.exec(potong);
        // label yang dipakai ulang: tulisan terpanjang ("SC Z 1x" + tanggal), bukan kotak tanda kedua
        if (m && (!label || teksLabel(m[1]).length > teksLabel(label).length)) label = m[1];
      }
    }
    labelPerJangkar.push(label);
  }
  for (const p of paragraf) {
    if (diJangkar.has(p.indeks)) continue;
    for (const r of runBentuk(p.simpul)) if (/zcross-/.test(sumber.slice(r.awal, r.akhir))) buang.push([r.awal, r.akhir]);
  }
  let xml = sumber;
  const unik = [...new Map(buang.map((r) => [r[0], r] as const)).values()];
  for (const [a, b] of unik.sort((x, y) => y[0] - x[0])) xml = xml.slice(0, a) + xml.slice(b);
  return { xml, labelTanggal: labelPerJangkar.find((l) => l) ?? null, labelPerJangkar, jumlahBentukDibuang: unik.length };
}

const NS = 'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"';

function idDocPrBerikut(x: string): number {
  let maks = 1000;
  for (const m of x.matchAll(/<wp:docPr\b[^>]*\bid="(\d+)"/g)) maks = Math.max(maks, Number(m[1]));
  return maks + 1;
}

function jangkarXml(id: number, nama: string, xPt: number, yPt: number, wPt: number, hPt: number, isi: string, urut: number): string {
  const x = keEmu(xPt);
  const y = keEmu(yPt);
  const w = keEmu(wPt);
  const h = Math.max(keEmu(hPt), 1);
  return (
    `<w:r><w:drawing><wp:anchor ${NS} distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="${251658240 + urut}" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">` +
    `<wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>${x}</wp:posOffset></wp:positionH>` +
    `<wp:positionV relativeFrom="page"><wp:posOffset>${y}</wp:posOffset></wp:positionV>` +
    `<wp:extent cx="${w}" cy="${h}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>` +
    `<wp:docPr id="${id}" name="${nama}"/><wp:cNvGraphicFramePr/>` +
    `<a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">${isi}</a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`
  );
}

export function bentukGarisZDocx(r: RencanaZ, id: number): string {
  const w = keEmu(r.bawah.x2 - r.bawah.x1);
  const h = Math.max(keEmu(r.bawah.y - r.atas.y), 1);
  const xa = Math.max(0, Math.min(w, keEmu(r.atas.x1 - r.bawah.x1)));
  const isi =
    `<wps:wsp><wps:cNvSpPr/><wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>` +
    `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/><a:pathLst><a:path w="${w}" h="${h}" fill="none">` +
    `<a:moveTo><a:pt x="${xa}" y="0"/></a:moveTo><a:lnTo><a:pt x="${w}" y="0"/></a:lnTo><a:lnTo><a:pt x="0" y="${h}"/></a:lnTo><a:lnTo><a:pt x="${w}" y="${h}"/></a:lnTo>` +
    `</a:path></a:pathLst></a:custGeom><a:noFill/><a:ln w="9525"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln></wps:spPr><wps:bodyPr/></wps:wsp>`;
  return jangkarXml(id, "zcross-garis", r.bawah.x1, r.atas.y, r.bawah.x2 - r.bawah.x1, r.bawah.y - r.atas.y, isi, 1);
}

export function bentukTanggalDocx(r: RencanaZ, id: number, label: string | null, tanggal: string): string {
  const w = keEmu(r.tanggal.lebar);
  const h = keEmu(r.tanggal.tinggi);
  // 3 Nov (keputusan 59): label baru = "SC Z 1x" di atas tanggal (sama dengan kotak "SC Z" blangko)
  const parLabel = (t: string) => `<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:t xml:space="preserve">${enkodeEntitas(t)}</w:t></w:r></w:p>`;
  const isiTeks = label ?? `${parLabel("SC Z 1x")}${parLabel(tanggal)}`;
  const isi =
    `<wps:wsp><wps:cNvSpPr txBox="1"/><wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></wps:spPr>` +
    `<wps:txbx><w:txbxContent>${isiTeks}</w:txbxContent></wps:txbx><wps:bodyPr rot="0" vert="horz" wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t" anchorCtr="0"><a:noAutofit/></wps:bodyPr></wps:wsp>`;
  return jangkarXml(id, "zcross-tanggal", r.tanggal.x, r.tanggal.y, r.tanggal.lebar, r.tanggal.tinggi, isi, 2);
}

// ----------------------------------------------------------------------------
// Jarak huruf
// ----------------------------------------------------------------------------
const URUTAN_SESUDAH_SPACING = ["w:w", "w:kern", "w:position", "w:sz", "w:szCs", "w:highlight", "w:u", "w:effect", "w:bdr", "w:shd", "w:fitText", "w:vertAlign", "w:rtl", "w:cs", "w:em", "w:lang", "w:eastAsianLayout", "w:specVanish", "w:oMath"];

/** Memasang <w:spacing w:val="-N"/> pada tiap run bertulisan di paragraf (N dalam twip per huruf). */
export function rapatkanParagrafDocx(x: string, p: SimpulXml, twipPerHuruf: number): string {
  const n = Math.max(1, Math.min(40, Math.round(twipPerHuruf)));
  const spasi = `<w:spacing w:val="-${n}"/>`;
  const edit: Array<{ dari: number; sampai: number; teks: string }> = [];
  const telusur = (s: SimpulXml) => {
    for (const a of s.anak) {
      if (TUJUAN_LEWATI.has(a.nama)) continue;
      if (a.nama === "w:r") {
        if (!a.anak.some((c) => c.nama === "w:t")) continue;
        const rpr = a.anak.find((c) => c.nama === "w:rPr");
        if (!rpr) {
          edit.push({ dari: a.awalIsi, sampai: a.awalIsi, teks: `<w:rPr>${spasi}</w:rPr>` });
        } else if (rpr.tertutupSendiri) {
          edit.push({ dari: rpr.awal, sampai: rpr.akhir, teks: `<w:rPr>${spasi}</w:rPr>` });
        } else {
          const lama = rpr.anak.find((c) => c.nama === "w:spacing");
          if (lama) edit.push({ dari: lama.awal, sampai: lama.akhir, teks: spasi });
          else {
            const sesudah = rpr.anak.find((c) => URUTAN_SESUDAH_SPACING.includes(c.nama));
            const pos = sesudah ? sesudah.awal : rpr.akhirIsi;
            edit.push({ dari: pos, sampai: pos, teks: spasi });
          }
        }
        continue;
      }
      telusur(a);
    }
  };
  telusur(p);
  let hasil = x;
  for (const e of edit.sort((a, b) => b.dari - a.dari)) hasil = hasil.slice(0, e.dari) + e.teks + hasil.slice(e.sampai);
  return hasil;
}

// ----------------------------------------------------------------------------
// Seksi: ganti halaman + nomor halaman
// ----------------------------------------------------------------------------
const SESUDAH_PGNUMTYPE = ["w:cols", "w:formProt", "w:vAlign", "w:noEndnote", "w:titlePg", "w:textDirection", "w:bidi", "w:rtlGutter", "w:docGrid", "w:printerSettings", "w:sectPrChange"];
const SESUDAH_TYPE = ["w:pgSz", "w:pgMar", "w:paperSrc", "w:pgBorders", "w:lnNumType", "w:pgNumType", ...SESUDAH_PGNUMTYPE];

/** Menulis ulang sebuah <w:sectPr>: jenis pemisah "nextPage" dan nomor halaman awal (null = tidak diubah). */
export function ubahSectPr(x: string, sp: SimpulXml, p: { nomorAwal: number | null; halamanBaru: boolean }): string {
  let isi = sp.tertutupSendiri ? "" : x.slice(sp.awalIsi, sp.akhirIsi);
  const tag = x.slice(sp.awal, sp.awalIsi);
  const anak = sp.anak;
  const edit: Array<{ dari: number; sampai: number; teks: string }> = [];
  const lokal = (n: SimpulXml) => ({ dari: n.awal - sp.awalIsi, sampai: n.akhir - sp.awalIsi });
  if (p.halamanBaru) {
    const t = anak.find((c) => c.nama === "w:type");
    if (t) {
      const v = atribut(t, "w:val");
      if (v !== "nextPage" && v !== null) edit.push({ ...lokal(t), teks: `<w:type w:val="nextPage"/>` });
    }
  }
  if (p.nomorAwal != null) {
    const lama = anak.find((c) => c.nama === "w:pgNumType");
    const baru = `<w:pgNumType w:start="${p.nomorAwal}"/>`;
    if (lama) edit.push({ ...lokal(lama), teks: baru });
    else {
      const sesudah = anak.find((c) => SESUDAH_PGNUMTYPE.includes(c.nama));
      const pos = sesudah ? sesudah.awal - sp.awalIsi : isi.length;
      edit.push({ dari: pos, sampai: pos, teks: baru });
    }
  }
  for (const e of edit.sort((a, b) => b.dari - a.dari)) isi = isi.slice(0, e.dari) + e.teks + isi.slice(e.sampai);
  void SESUDAH_TYPE;
  return `${tag.replace(/\/>$/, ">")}${isi}</w:sectPr>`;
}

export type SeksiHasil = "dipakai" | "disisipkan" | "tanpa-bagian-berikut";

/** Teks apa pun (bukan spasi) di paragraf dari indeks `dari` sampai `sampai` (inklusif)? */
const adaTeks = (paragraf: ParagrafDocx[], dari: number, sampai: number): boolean => paragraf.slice(dari, sampai + 1).some((q) => q.teks.trim().length > 0);

export type MasukanTulisDocx = { rencana: RencanaZ; labelTanggal: string | null; tanggal: string; nomorBerikut: number | null };

/**
 * Menulis Z ke document.xml yang sudah dibersihkan: bentuk di paragraf jangkar (sesudah teksnya) + ganti halaman + nomor halaman.
 */
export function tulisZDocx(x: string, jangkarIndeks: number, m: MasukanTulisDocx): { xml: string; seksi: SeksiHasil; nomorDitulis: number | null } {
  const h = tulisBanyakZDocx(x, [{ teksIndeks: jangkarIndeks, akhirIndeks: jangkarIndeks, rencana: m.rencana, labelTanggal: m.labelTanggal, tanggal: m.tanggal, nomorBerikut: m.nomorBerikut }]);
  return { xml: h.xml, seksi: h.per[0].seksi, nomorDitulis: h.per[0].nomorDitulis };
}

/** Satu tempat Z (sama dengan TulisZ di rtf.ts); rencana null = garis & tanggal tidak digambar, ganti halaman & nomor tetap. */
export type TulisZDocx = { teksIndeks: number; akhirIndeks: number; rencana: RencanaZ | null; labelTanggal: string | null; tanggal: string; nomorBerikut: number | null };

/**
 * Menulis beberapa Z ke document.xml yang sudah dibersihkan: bentuk di paragraf TEKS (sesudah tulisannya) + ganti halaman + nomor halaman
 * dihitung sesudah paragraf terakhir kelompok tanda Z (isian kosong "..." tidak lagi dipindah ke halaman sendiri - 3 Nov).
 */
export function tulisBanyakZDocx(x: string, daftar: ReadonlyArray<TulisZDocx>): { xml: string; per: Array<{ seksi: SeksiHasil; nomorDitulis: number | null }> } {
  const akar = uraiXml(x);
  const paragraf = paragrafDocx(x, akar);
  const seksi = seksiDocx(akar, paragraf);
  let id = idDocPrBerikut(x);
  const edit: Array<{ dari: number; sampai: number; teks: string }> = [];
  const per: Array<{ seksi: SeksiHasil; nomorDitulis: number | null }> = [];
  for (const m of daftar) {
    const p = paragraf[m.teksIndeks];
    const pa = paragraf[Math.max(m.teksIndeks, m.akhirIndeks)];
    if (!p || !pa) throw new Error("Paragraf jangkar tidak ditemukan.");
    let hasilSeksi: SeksiHasil = "tanpa-bagian-berikut";
    // seksi tempat paragraf terakhir kelompok berada
    const j = seksi.findIndex((s) => s.paragrafIndeks == null || s.paragrafIndeks >= pa.indeks);
    const sek = j >= 0 ? seksi[j] : null;
    if (sek) {
      const akhirSeksi = sek.paragrafIndeks ?? paragraf.length - 1;
      const teksSesudah = adaTeks(paragraf, pa.indeks + 1, akhirSeksi);
      const berikut = seksi[j + 1];
      if (!teksSesudah && sek.paragrafIndeks != null && berikut) {
        hasilSeksi = "dipakai";
        edit.push({ dari: berikut.sectPr.awal, sampai: berikut.sectPr.akhir, teks: ubahSectPr(x, berikut.sectPr, { nomorAwal: m.nomorBerikut, halamanBaru: true }) });
      } else if (teksSesudah) {
        hasilSeksi = "disisipkan";
        // bagian pertama (sampai paragraf terakhir kelompok) memakai salinan sectPr asal; bagian sesudahnya = sectPr asal + halaman baru + nomor
        const salinan = x.slice(sek.sectPr.awal, sek.sectPr.akhir);
        const pPr = pa.simpul.anak.find((a) => a.nama === "w:pPr");
        if (pPr && !pPr.tertutupSendiri) {
          const pc = pPr.anak.find((a) => a.nama === "w:pPrChange");
          const pos = pc ? pc.awal : pPr.akhirIsi;
          edit.push({ dari: pos, sampai: pos, teks: salinan });
        } else if (pPr) edit.push({ dari: pPr.awal, sampai: pPr.akhir, teks: `<w:pPr>${salinan}</w:pPr>` });
        else edit.push({ dari: pa.simpul.awalIsi, sampai: pa.simpul.awalIsi, teks: `<w:pPr>${salinan}</w:pPr>` });
        edit.push({ dari: sek.sectPr.awal, sampai: sek.sectPr.akhir, teks: ubahSectPr(x, sek.sectPr, { nomorAwal: m.nomorBerikut, halamanBaru: true }) });
      }
    }
    if (m.rencana) {
      const bentuk = bentukGarisZDocx(m.rencana, id) + bentukTanggalDocx(m.rencana, id + 1, m.labelTanggal, m.tanggal);
      id += 2;
      // bentuk: sesudah run bertulisan terakhir pada paragraf teks
      let posBentuk = p.simpul.akhirIsi;
      let terakhir: SimpulXml | null = null;
      semuaKeturunan(p.simpul, (n) => {
        if (TUJUAN_LEWATI.has(n.nama)) return false;
        if (n.nama === "w:t") {
          const r = runInduk(n);
          if (r && !leluhur(r, "mc:AlternateContent")) terakhir = r;
        }
      });
      const tr = terakhir as SimpulXml | null;
      if (tr) posBentuk = tr.akhir;
      else {
        const ppr = p.simpul.anak.find((a) => a.nama === "w:pPr");
        if (ppr) posBentuk = ppr.akhir;
        else posBentuk = p.simpul.awalIsi;
      }
      edit.push({ dari: posBentuk, sampai: posBentuk, teks: bentuk });
    }
    per.push({ seksi: hasilSeksi, nomorDitulis: hasilSeksi === "tanpa-bagian-berikut" ? null : m.nomorBerikut });
  }
  // satu sectPr hanya boleh diubah sekali (dua Z di satu bagian tanpa pemisah: ubahan kedua atas sectPr yang sama dilewati - tidak merusak XML)
  const sudah = new Set<string>();
  const aman = edit.filter((e) => {
    if (e.sampai === e.dari) return true;
    const kunci = `${e.dari}:${e.sampai}`;
    if (sudah.has(kunci)) return false;
    sudah.add(kunci);
    return true;
  });
  aman.sort((a, b) => b.dari - a.dari);
  let hasil = x;
  for (const e of aman) hasil = hasil.slice(0, e.dari) + e.teks + hasil.slice(e.sampai);
  return { xml: hasil, per };
}

// ----------------------------------------------------------------------------
// Berkas DOCX
// ----------------------------------------------------------------------------
export type BerkasDocx = { entri: EntriZip[]; xml: string };

export function bukaDocx(bita: Uint8Array): BerkasDocx {
  const entri = bacaZip(bita);
  const dok = entri.find((e) => e.nama === BERKAS_DOKUMEN);
  if (!dok) throw new Error("DOCX tanpa word/document.xml.");
  return { entri, xml: new TextDecoder("utf-8").decode(isiEntri(dok)) };
}

export function simpanDocx(b: BerkasDocx, xmlBaru: string): Uint8Array {
  const entri = b.entri.map((e) => (e.nama === BERKAS_DOKUMEN ? entriBaru(e.nama, new TextEncoder().encode(xmlBaru), e) : e));
  return tulisZip(entri);
}

/** Tanggal pertama "tanggal 12 Agustus 2026" di paragraf naskah. */
export function tanggalDariParagraf(teks: string[]): string | null {
  const bulan = "Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember";
  const re = new RegExp(`tanggal\\s+(\\d{1,2}\\s+(?:${bulan})\\s+\\d{4})`, "i");
  for (const t of teks) {
    const m = re.exec(t);
    if (m) return m[1].replace(/\s+/g, " ");
  }
  return null;
}
