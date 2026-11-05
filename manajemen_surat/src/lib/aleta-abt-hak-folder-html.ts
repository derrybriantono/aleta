import { NAMA_TINGKAT, golonganBerhak, labelGolongan, type Matriks, type TingkatHak } from "@/lib/aleta-abt-hak-folder";

/**
 * Berkas HTML matriks hak per folder untuk disetujui pemilik (Tahap 6). Berdiri sendiri: tanpa skrip luar, tanpa gambar, terang dan gelap
 * mengikuti perangkat, di HP tiap folder menjadi kartu (tanpa geser mendatar). Tidak memuat data pihak.
 */

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const SINGKAT: Record<TingkatHak, string> = { bebas: "Boleh", ditunjuk: "Bila ditunjuk", validasi: "Validasi", tidak: "-" };

export type MetaMatriksHtml = { sumber: string; dibuat: string; catatan?: string[] };

export function matriksKeHtml(m: Matriks, meta: MetaMatriksHtml): string {
  const kolom = golonganBerhak(m);
  const ragu = m.baris.filter((b) => b.ragu.length > 0);
  const sel = (t: TingkatHak) => `<td class="t-${t}">${esc(SINGKAT[t])}</td>`;
  const tabel = m.baris
    .map(
      (b) =>
        `<tr${b.ragu.length ? ' class="ragu"' : ""}><th scope="row">${esc(b.folder)}${b.arsip ? ' <span class="lencana">arsip</span>' : ""}${b.ragu.length ? ' <span class="lencana kuning">ragu</span>' : ""}<small>${esc(b.tahapan)}; ${esc(b.jenis)}; ${esc(b.penunjukan)}</small></th>${kolom.map((g) => sel(b.hak[g])).join("")}</tr>`
    )
    .join("\n");
  const kartu = m.baris
    .map((b) => {
      const isi = kolom
        .filter((g) => b.hak[g] !== "tidak")
        .map((g) => `<li class="t-${b.hak[g]}"><b>${esc(labelGolongan(g))}</b> ${esc(NAMA_TINGKAT[b.hak[g]])}</li>`)
        .join("");
      return `<article class="kartu${b.ragu.length ? " ragu" : ""}"><h3>${esc(b.folder)}${b.arsip ? ' <span class="lencana">arsip</span>' : ""}${b.ragu.length ? ' <span class="lencana kuning">ragu</span>' : ""}</h3><p>${esc(b.tahapan)}; ${esc(b.jenis)}; ${esc(b.penunjukan)}</p><ul>${isi || "<li>Tidak ada peran yang diberi.</li>"}</ul></article>`;
    })
    .join("\n");
  const daftarRagu = ragu
    .map((b) => `<li><b>${esc(b.folder)}</b><ul>${b.ragu.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></li>`)
    .join("");
  const catatan = (meta.catatan ?? []).map((c) => `<li>${esc(c)}</li>`).join("");
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Matriks hak folder blangko</title>
<style>
:root{--bg:#f3f6f4;--fg:#14251b;--kartu:#fff;--garis:#cfdcd2;--muted:#586b5e;--hijau:#1b6b44;--kuning:#8a6100;--merah:#b3261e}
@media (prefers-color-scheme:dark){:root{--bg:#0e2119;--fg:#e4efe7;--kartu:#13301f;--garis:#2c5139;--muted:#a3bcab;--hijau:#5fd09a;--kuning:#f0c75e;--merah:#ff8a80}}
*{box-sizing:border-box}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:15px/1.5 "IBM Plex Sans",system-ui,"Segoe UI",Arial,sans-serif;overflow-wrap:anywhere}
main{max-width:1200px;margin:0 auto}
h1{font-size:1.4rem;margin:.2rem 0}h2{font-size:1.1rem;margin:1.6rem 0 .5rem}h3{font-size:1rem;margin:0}
.ringkas{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.ringkas div{background:var(--kartu);border:1px solid var(--garis);border-radius:12px;padding:8px 12px}
.ringkas b{font-size:1.3rem;display:block}
.lencana{font-size:.72rem;border:1px solid var(--garis);border-radius:999px;padding:1px 8px;color:var(--muted);font-weight:400}
.lencana.kuning{color:var(--kuning);border-color:var(--kuning)}
small{display:block;color:var(--muted);font-weight:400}
table{border-collapse:collapse;width:100%;background:var(--kartu);border:1px solid var(--garis);display:none}
th,td{border-bottom:1px solid var(--garis);padding:6px 8px;text-align:left;vertical-align:top}
thead th{position:sticky;top:0;background:var(--kartu);font-size:.8rem}
td{font-size:.82rem;text-align:center}
.t-bebas{color:var(--hijau);font-weight:600}.t-ditunjuk{color:var(--kuning);font-weight:600}.t-validasi{color:var(--muted)}.t-tidak{color:var(--muted);opacity:.6}
tr.ragu th{border-left:4px solid var(--kuning)}
.kartu{background:var(--kartu);border:1px solid var(--garis);border-radius:12px;padding:10px 12px;margin:8px 0}
.kartu.ragu{border-left:4px solid var(--kuning)}.kartu p{margin:.2rem 0;color:var(--muted);font-size:.85rem}.kartu ul{margin:.3rem 0 0;padding-left:1.1rem}
.persetujuan{background:var(--kartu);border:1px solid var(--kuning);border-radius:12px;padding:10px 12px}
@media (min-width:900px){table{display:table}.kartu{display:none}}
</style>
</head>
<body>
<main>
<h1>Matriks hak folder blangko ALETA ABT</h1>
<p>Untuk disetujui pemilik. <b>Belum berlaku</b> sebelum disetujui; Blangko ABT by Derry Briantono yang dipakai petugas tidak berubah.</p>
<div class="ringkas"><div><b>${m.jumlahFolder}</b>folder</div><div><b>${m.jumlahRagu}</b>folder ragu</div><div><b>${kolom.length}</b>peran yang diberi hak</div></div>
<p>Sumber: ${esc(meta.sumber)}. Dibuat ${esc(meta.dibuat)}. Sidik matriks: <code>${esc(m.sidik)}</code>.</p>
<section class="persetujuan"><b>Cara membaca.</b> "Boleh": peran itu membuka folder. "Bila ditunjuk": hanya bila ditunjuk di perkara itu (mengikuti ABT). "Validasi": hanya memvalidasi BAS. "-": tidak diberi. Tahapan, jenis, dan penunjukan meniru logika ABT; Super Admin melewati pemeriksaan tahapan tetapi melihat peringatan bila blangko di luar tahapan.${catatan ? `<ul>${catatan}</ul>` : ""}</section>
<h2>Folder yang ragu (${ragu.length})</h2>
${ragu.length ? `<ul>${daftarRagu}</ul>` : "<p>Tidak ada.</p>"}
<h2>Seluruh folder</h2>
<table><thead><tr><th>Folder</th>${kolom.map((g) => `<th>${esc(labelGolongan(g))}</th>`).join("")}</tr></thead><tbody>
${tabel}
</tbody></table>
<div>${kartu}</div>
<h2>Peran ALETA tanpa padanan di ABT</h2>
<p>${m.tanpaPadananAbt.length ? m.tanpaPadananAbt.map((g) => esc(labelGolongan(g))).join(", ") : "Tidak ada."}. Peran ini tidak punya grup di ABT, sehingga tidak diberi hak atas folder mana pun sampai pemilik memutuskan lain.</p>
</main>
</body>
</html>
`;
}
