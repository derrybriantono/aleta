// Membuat replika statis beranda ABT: gaya (customStyle.css, bootstrap.css) dan skrip beranda.php
// disalin apa adanya dari salinan ABT lokal; hanya markup menu yang disusun dari data contoh.
// Dipakai tangkapan Playwright; tidak menyentuh ABT sungguhan.
import fs from "node:fs";

const ABT = "D:/satker asal/Website PA Bungku/xampp/htdocs/aps_badilag";
const css = fs.readFileSync(`${ABT}/assets/abt/css/customStyle.css`, "utf8");
const bootstrap = fs.readFileSync(`${ABT}/assets/abt/css/bootstrap.css`, "utf8");
const beranda = fs.readFileSync(`${ABT}/application/views/abt/beranda.php`, "utf8");
const gayaBeranda = beranda.slice(beranda.indexOf("<style>") + 7, beranda.indexOf("</style>"));

const mentah = beranda.slice(beranda.indexOf("<script>", beranda.indexOf("window.onscroll") - 20) + 8, beranda.lastIndexOf("</script>"));
const skrip = mentah
  .replace(/<\?php\s*if\(\$dir\)\{[\s\S]*?\?>/, "{")
  .replace("acc[<?php echo $key;?>]", "acc[8]")
  .replace(/<\?php\s*\}\s*\?>/, "}");
if (skrip.includes("<?php")) throw new Error("sisa php di skrip");

const grup = ["Gugatan & Permohonan", "Cerai Gugat", "Cerai Talak", "Itsbat Nikah", "Harta Bersama", "Hadhanah", "Waris", "Ekonomi Syariah", "Blangko Derry (Daftar s.d. Produk)", "Penetapan", "Eksekusi", "Lain-lain"];
const jenis = ["CG", "CT", "IN", "HB", "HA", "WR", "ES", "DP", "PK", "VR"];
let menu = "";
grup.forEach((g, i) => {
  menu += `<button class="accordion">${g}</button>\n<div class="panel">\n`;
  const n = i === 8 ? 64 : 4;
  for (let k = 0; k < n; k++) {
    const nama = i === 8 ? `${jenis[Math.floor(k / 2) % jenis.length]} - ${k % 2 ? "BAS" : "Putusan"} ${Math.floor(k / 20) + 1}` : `${g.split(" ")[0]} ${k + 1}`;
    menu += `<a ${i === 8 && k === 40 ? 'class="active" ' : ""}title="(3 Blangko)" href="#m${i}-${k}">${nama}</a>\n`;
  }
  menu += "</div>\n";
});

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Blangko Tambahan SIPP</title>
<style>${bootstrap}</style><style>${css}</style><style>${gayaBeranda}</style></head>
<body>
<div id="header" style="height:110px;background:#006640;color:#fff;padding:30px 40px;font-size:22px">Blangko Tambahan SIPP (replika beranda ABT)</div>
<div id="nav">
<div id="navbar" class="pricing_inner_w3ls navbar">
${menu}</div>
</div>
<div class="pricing " id="pricing"><div class="pring_agile_its w3-agile">
<div class="col-md-4 pricing_inner_w3ls"><div class="pricing-top satu"><h3>Daftar blangko</h3></div>
<div class="pricing-bottom" style="height:1400px;padding:20px">Konten kanan (replika)</div></div>
</div><div class="clearfix"></div></div>
<script>${skrip}</script>
</body></html>`;
fs.writeFileSync(new URL("./replika-beranda-abt.html", import.meta.url), html);
console.log("ok", html.length);
