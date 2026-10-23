/**
 * Skrip awal tema: berjalan SINKRON di <head>, sebelum lukis pertama dan
 * sebelum React. Menerapkan pilihan (terang | gelap | sistem) dari salinan di
 * localStorage - kunci yang sama dengan tema-pilihan.ts dan ekstensi - dan
 * TIDAK menulis penyimpanan apa pun: ia hanya membaca dan memasang kelas
 * `dark`, atribut tema terurai, dan atribut salinan untuk jembatan ekstensi.
 *
 * Ditulis sebagai teks ES5 supaya dapat dimasukkan apa adanya ke halaman;
 * ujinya menjalankan teks ini dan membandingkannya dengan tema-pilihan.ts.
 *
 * Urutan: salinan baru ("pilihan|waktu") -> nilai lama portal
 * (portal-terpadu-pa-v2.theme, hanya bila penanda default-gelap ada, seperti
 * sebelumnya) -> gelap. "Sistem" ditanyakan lewat matchMedia di jendela ini.
 */
export const SKRIP_TEMA_AWAL = `(function(){try{
var d=document.documentElement,s=window.localStorage,p="gelap",t=0;
var m=/^(terang|gelap|sistem)\\|(\\d{1,15})$/.exec(s.getItem("aleta-tema-pilihan")||"");
if(m){p=m[1];t=+m[2];}
else if(s.getItem("aleta:theme-default-dark-v1")==="1"){
var r=s.getItem("portal-terpadu-pa-v2")||s.getItem("portal-terpadu-pa-v1");
if(r){var l=JSON.parse(r);if(l&&l.theme==="light")p="terang";}
}
var g=p==="sistem"?(window.matchMedia?window.matchMedia("(prefers-color-scheme: dark)").matches:true):p!=="terang";
if(d.classList.contains("dark")!==g)d.classList.toggle("dark",g);
d.setAttribute("data-aleta-tema",g?"gelap":"terang");
d.setAttribute("data-aleta-tema-salinan",p+"|"+t);
}catch(e){var q=document.documentElement;q.classList.add("dark");q.setAttribute("data-aleta-tema","gelap");q.setAttribute("data-aleta-tema-salinan","gelap|0");}})();`;
