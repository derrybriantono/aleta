// Ukuran JJ2 (18 Okt 2026): tanya-jawab jawab-menjawab otomatis, daftar bukti, surat keterangan KUA.
// Hanya SELECT atas salinan lokal (aleta_bot, aps_badilag, sipp_donggala). Berkas e-Court (PDF) TIDAK ada di laptop:
// yang terukur hanya metadata arsip (jenis, judul, pengunggah, agenda, tanggal unggah) dan kebiasaan petugas di ABT.
// Isi surat (ukuran "rapi", daftar bukti, nomor KUA) baru dapat diukur di server - rencananya ada di keluaran.
//
//   node scripts/isi-sipp-abt/ukur-tanyajawab-bukti.cjs docs/isi-sipp-abt/UKURAN-JAWAB-MENJAWAB.json
//
// Menambahkan kunci "JJ2" ke berkas JSON keluaran (kunci JJ lama tidak diubah).
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const akar = path.resolve(__dirname, "..", "..");
const mysql = createRequire(path.join(akar, "aleta_bot", "package.json"))("mysql");
const J = require(path.join(akar, "aleta_bot", "services", "jawabMenjawabEcourtService.js"));
const B = require(path.join(akar, "aleta_bot", "services", "buktiEcourtService.js"));

// Aturan sidang tujuan dibaca dari ekstensi (satu sumber): blok murni di blangko-derry-isian.js.
const sumber = fs.readFileSync(path.join(akar, "ekstensi-sipp", "blangko-derry-isian.js"), "utf8").replace(/\r\n/g, "\n");
const a = sumber.indexOf("const TJ_JAWAB_MENJAWAB");
const b = sumber.indexOf("// F4.2: saran draf H-7", a);
const { sidangTujuanJm, agendaMemuatPeran } = new Function("S", `${sumber.slice(a, b)}\nreturn { sidangTujuanJm, agendaMemuatPeran };`)({});

function kueri(db, sql) {
  const kon = mysql.createConnection({ host: "127.0.0.1", user: "root", database: db, typeCast: (f) => f.string() });
  return new Promise((ok, gagal) => kon.query(sql, (e, r) => (kon.end(), e ? gagal(e) : ok(r))));
}
const persen = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : null);
const PERAN_TJ = ["jawaban", "replik", "duplik"];

(async () => {
  const dok = await kueri("aleta_bot", "select nomor_perkara, jenis_dokumen, judul_dokumen, peran_pengunggah, agenda, date(diunggah_pada) unggah from aleta_bot_ecourt_documents");
  const hasil = {};

  // A. Metadata arsip -----------------------------------------------------------------------------------------------
  const penuntut = (p) => (/turut/i.test(p) ? "" : /tergugat|termohon/i.test(p) ? "0047" : /penggugat|pemohon/i.test(p) ? "0046" : "");
  const perPerkara = new Map(); // nomor -> peran -> [doc]
  const tujuan = { jawaban: "0047", replik: "0046", duplik: "0047" };
  let agendaCocok = { jawaban: [0, 0], replik: [0, 0], duplik: [0, 0] };
  for (const d of dok) {
    const k = J.kenaliJenis({ jenis: d.jenis_dokumen, judul: d.judul_dokumen, pengunggah: d.peran_pengunggah, penuntutKode: penuntut(d.peran_pengunggah) });
    if (!PERAN_TJ.includes(k.peran) || k.turut || k.rekonvensiDuplik || k.pihak !== tujuan[k.peran]) continue;
    if (!perPerkara.has(d.nomor_perkara)) perPerkara.set(d.nomor_perkara, {});
    const m = perPerkara.get(d.nomor_perkara);
    (m[k.peran] = m[k.peran] || []).push({ ...d, ragu: k.ragu });
    agendaCocok[k.peran][1] += 1;
    if (agendaMemuatPeran(k.peran, d.agenda)) agendaCocok[k.peran][0] += 1;
  }
  const A = { perkaraDenganBerkasTanyaJawab: perPerkara.size, perPeran: {}, agendaDokumenMemuatPeran: {} };
  for (const p of PERAN_TJ) {
    const punya = [...perPerkara.values()].filter((m) => m[p]);
    const tepatSatu = punya.filter((m) => m[p].length === 1);
    A.perPeran[p] = { perkara: punya.length, tepatSatuBerkas: tepatSatu.length, lebihDariSatu: punya.length - tepatSatu.length, jenisJudulBertentangan: punya.filter((m) => m[p].some((x) => x.ragu)).length };
    A.agendaDokumenMemuatPeran[p] = { cocok: agendaCocok[p][0], dari: agendaCocok[p][1], persen: persen(agendaCocok[p][0], agendaCocok[p][1]) };
  }
  const judulDaftar = dok.filter((d) => B.RE_JUDUL_DAFTAR.test(d.judul_dokumen));
  A.bukti = {
    berkasBerjudulDaftarAtauAlatBukti: judulDaftar.length,
    perkaraDenganBerkasDaftarBukti: new Set(judulDaftar.map((d) => d.nomor_perkara)).size,
    berkasBerjudulDokumenBukti: dok.filter((d) => /^dokumen bukti$/i.test(d.judul_dokumen.trim())).length,
    berkasBukti_pengunggahKosong: dok.filter((d) => /bukti/i.test(d.judul_dokumen) && !d.peran_pengunggah).length,
    berkasKesimpulanBerjudulDaftarBukti: dok.filter((d) => /^kesimpulan/i.test(d.jenis_dokumen) && B.RE_JUDUL_DAFTAR.test(d.judul_dokumen)).length,
    catatan: "Berkas bukti di arsip hampir semuanya 'Dokumen Bukti' dengan pengunggah kosong (bukti yang menyertai pendaftaran): nomor P/T hanya dapat dibaca dari ISI berkas daftar bukti, bukan metadata.",
  };
  hasil.A_metadata = A;

  // B. Sidang tujuan atas jadwal SIPP lokal ------------------------------------------------------------------------
  const nomorAda = [...perPerkara.keys()];
  const per = nomorAda.length ? await kueri("sipp_donggala", `select perkara_id, nomor_perkara from perkara where nomor_perkara in (${nomorAda.map((n) => mysql.escape(n)).join(",")})`) : [];
  const idDariNomor = Object.fromEntries(per.map((r) => [r.nomor_perkara, r.perkara_id]));
  const idList = Object.values(idDariNomor);
  const sidangSemua = idList.length ? await kueri("sipp_donggala", `select id, perkara_id, urutan, date(tanggal_sidang) tanggal, agenda from perkara_jadwal_sidang where perkara_id in (${idList.join(",")}) order by perkara_id, tanggal_sidang, urutan`) : [];
  const sidangPerkara = new Map();
  for (const s of sidangSemua) (sidangPerkara.get(s.perkara_id) || sidangPerkara.set(s.perkara_id, []).get(s.perkara_id)).push({ sidangId: s.id, tanggal: s.tanggal, urutan: Number(s.urutan), agenda: s.agenda });
  const Bk = { berkasDinilai: 0, tanpaJadwalSipp: 0, sidangTujuanDitemukan: 0, tanpaSidangBeragendaCocok: 0, tanggalUnggahMelewatiSidangTerakhir: 0, tujuanSamaDenganSidangDiaturDokumen: null };
  for (const [nomor, m] of perPerkara) {
    for (const p of PERAN_TJ) {
      if (!m[p] || m[p].length !== 1) continue;
      Bk.berkasDinilai += 1;
      const daftar = sidangPerkara.get(idDariNomor[nomor]) || [];
      if (!daftar.length) {
        Bk.tanpaJadwalSipp += 1;
        continue;
      }
      const cocok = daftar.filter((s) => agendaMemuatPeran(p, s.agenda));
      if (!cocok.length) {
        Bk.tanpaSidangBeragendaCocok += 1;
        continue;
      }
      const t = sidangTujuanJm(p, m[p][0].unggah, daftar);
      if (t) Bk.sidangTujuanDitemukan += 1;
      else Bk.tanggalUnggahMelewatiSidangTerakhir += 1;
    }
  }
  Bk.persenDitemukanDariDinilai = persen(Bk.sidangTujuanDitemukan, Bk.berkasDinilai);
  hasil.B_sidangTujuanAtasMetadata = Bk;

  // C. Kebiasaan petugas: sidang yang diisi tanya-jawab jawaban/replik/duplik di ABT vs aturan agenda ---------------
  const grup = await kueri("aps_badilag", "select perkara_id, sidang_id, pihak_id, count(*) n from abt_keterangan_terdakwa group by perkara_id, sidang_id, pihak_id");
  const perk = [...new Set(grup.map((g) => g.perkara_id))];
  const p2 = perk.length ? await kueri("sipp_donggala", `select perkara_id, id from perkara_pihak2 where perkara_id in (${perk.join(",")})`) : [];
  const p2Per = new Map();
  for (const r of p2) (p2Per.get(r.perkara_id) || p2Per.set(r.perkara_id, new Set()).get(r.perkara_id)).add(String(r.id));
  const sidangAbt = perk.length ? await kueri("sipp_donggala", `select id, perkara_id, urutan, date(tanggal_sidang) tanggal, agenda from perkara_jadwal_sidang where perkara_id in (${perk.join(",")}) order by perkara_id, tanggal_sidang, urutan`) : [];
  const sidangAbtPer = new Map();
  for (const s of sidangAbt) (sidangAbtPer.get(s.perkara_id) || sidangAbtPer.set(s.perkara_id, []).get(s.perkara_id)).push({ sidangId: s.id, tanggal: s.tanggal, urutan: Number(s.urutan), agenda: s.agenda });
  const C = { kelompokPetugas: 0, bukanTanyaJawabPihak: 0, perPeran: { jawaban: { kelompok: 0, agendaSidangMemuatPeran: 0, tujuanTanpaTanggalSamaDenganPetugas: 0, agendaLain: [] }, replik: { kelompok: 0, agendaSidangMemuatPeran: 0, tujuanTanpaTanggalSamaDenganPetugas: 0, agendaLain: [] }, duplik: { kelompok: 0, agendaSidangMemuatPeran: 0, tujuanTanpaTanggalSamaDenganPetugas: 0, agendaLain: [] } } };
  for (const g of grup) {
    C.kelompokPetugas += 1;
    const ids = p2Per.get(g.perkara_id) || new Set();
    let peran = "";
    for (const id of ids) {
      if (String(g.pihak_id) === id) peran = "jawaban";
      else if (String(g.pihak_id) === `11${id}`) peran = "replik";
      else if (String(g.pihak_id) === `22${id}`) peran = "duplik";
    }
    if (!peran) {
      C.bukanTanyaJawabPihak += 1;
      continue;
    }
    const daftar = sidangAbtPer.get(g.perkara_id) || [];
    const s = daftar.find((x) => String(x.sidangId) === String(g.sidang_id));
    const c = C.perPeran[peran];
    c.kelompok += 1;
    if (s && agendaMemuatPeran(peran, s.agenda)) c.agendaSidangMemuatPeran += 1;
    else if (c.agendaLain.length < 12) c.agendaLain.push(s ? s.agenda : "(sidang tidak ditemukan)");
    const t = sidangTujuanJm(peran, "", daftar);
    if (t && s && String(t.sidangId) === String(s.sidangId)) c.tujuanTanpaTanggalSamaDenganPetugas += 1;
  }
  for (const p of PERAN_TJ) C.perPeran[p].persenAgendaMemuatPeran = persen(C.perPeran[p].agendaSidangMemuatPeran, C.perPeran[p].kelompok);
  // Irisan: perkara yang punya berkas tertulis di arsip DAN tanya-jawab ketikan petugas - satu-satunya pembanding langsung sidang tujuan.
  const nomorDariId = Object.fromEntries(Object.entries(idDariNomor).map(([n, i]) => [String(i), n]));
  C.irisanArsipDanPetugas = [];
  for (const g of grup) {
    const nomor = nomorDariId[String(g.perkara_id)];
    if (!nomor || !perPerkara.has(nomor)) continue;
    const ids = p2Per.get(g.perkara_id) || new Set();
    let peran = "";
    for (const id of ids) {
      if (String(g.pihak_id) === id) peran = "jawaban";
      else if (String(g.pihak_id) === `11${id}`) peran = "replik";
      else if (String(g.pihak_id) === `22${id}`) peran = "duplik";
    }
    if (!peran || !perPerkara.get(nomor)[peran]) continue;
    const daftar = sidangAbtPer.get(g.perkara_id) || [];
    const s = daftar.find((x) => String(x.sidangId) === String(g.sidang_id));
    const unggah = perPerkara.get(nomor)[peran][0].unggah;
    const t = sidangTujuanJm(peran, unggah, daftar);
    C.irisanArsipDanPetugas.push({ nomor, peran, sidangPetugas: s ? `${s.tanggal} ${String(s.agenda).trim()}` : "(tidak ditemukan)", unggahBerkas: unggah, sidangTujuanKami: t ? `${t.tanggal} ${String(t.agenda).trim()}` : null, sama: Boolean(t && s && String(t.sidangId) === String(s.sidangId)) });
  }
  C.irisanSama = C.irisanArsipDanPetugas.filter((x) => x.sama).length;
  C.temuan =
    "Tanya-jawab LISAN yang diketik petugas hampir selalu pada sidang beragenda umum (Upaya Damai, Sidang kedua, laporan mediasi): agenda sidangnya memuat kata jawaban/replik/duplik hanya pada sebagian kecil kelompok. Karena itu aturan 'agenda memuat peran' HANYA dipakai untuk berkas TERTULIS di e-Court (agenda berkasnya memuat peran pada hampir semua berkas, bagian A); sidang beragenda umum tidak ditulis otomatis dan jatuh ke tombol Salin. Tidak ada perkara yang punya berkas tertulis di arsip DAN tanya-jawab ketikan petugas (irisan 0), sehingga sidang tujuan belum dapat dibandingkan langsung dengan pilihan petugas.";
  C.catatan = "Kelompok = (perkara, sidang, pihak) di abt_keterangan_terdakwa; pihak_id jawaban = perkara_pihak2.id, replik = '11'+id, duplik = '22'+id (Abt_model::GetIdPerkaraPihak). Agenda sidang dari perkara_jadwal_sidang SIPP lokal.";
  hasil.C_kebiasaanPetugasTanyaJawab = C;

  // D. Isian petugas variabel bukti / KUA / sita / HB ---------------------------------------------------------------
  const kodeBaru = [654, 9164, 9283, 9470, 9488, 9489, 9492, 9493, 9951, 9952];
  const teks = await kueri("aps_badilag", `select no_var, count(*) n from abt_data_teks where no_var in (${kodeBaru.join(",")}) group by no_var`);
  const tgl = await kueri("aps_badilag", "select no_var, count(*) n from abt_data_tanggal where no_var = 655 group by no_var");
  hasil.D_isianPetugas = { barisDitemukan: [...teks, ...tgl].map((r) => ({ no_var: r.no_var, baris: Number(r.n) })), catatan: "Kosong: variabel-variabel ini baru dibuat (paket 18 Okt) dan belum ada isian petugas di salinan lokal, sehingga bentuk nomor/tanggal KUA, daftar bukti, tanggapan sita, dan objek harta bersama tidak dapat dibandingkan dengan kebiasaan petugas di laptop." };

  // Rencana ukur Senin ---------------------------------------------------------------------------------------------
  hasil.rencanaSenin = [
    "1. Tanya-jawab (no. 74): jalankan isi-gugatan (bukti=1) atas 30 perkara e-Court yang SUDAH punya tanya-jawab jawaban/replik/duplik ketikan petugas di ABT; bandingkan tanyaJawab[].baris dengan baris petugas (mirip >= 0,8 per butir) dan catat: berapa berkas rapi, berapa tidak rapi + alasannya, berapa sidang tujuan sama dengan sidang yang diisi petugas.",
    "2. Ukuran rapi: ambil 50 berkas jawaban/replik/duplik acak, nilai manual 'rapi' oleh satu hakim/panitera; hitung salah-rapi (dianggap rapi tapi kacau) - target 0 dari 50 sebelum saklar tetap menyala; salah-tidak-rapi boleh (jatuh ke Salin).",
    "3. Bukti (no. 75a): untuk perkara berarsip daftar bukti, bandingkan butir P.n/T.n hasil baca dengan isian petugas di 9955/9957/9470/9488/9492 (jenis dan nomor/tanggal); catat butir yang tak terbaca dan yang salah jenis.",
    "4. KUA (no. 71): atas perkara itsbat, bandingkan nomor/tanggal dari posita, dari daftar bukti, dan dari OCR dengan isian petugas 0654/0655 (cocok persis); bila posita >= 95% cocok persis atas >= 20 perkara, naikkan tingkatnya dari ragu ke cukup.",
    "5. Sita/HB (75b, 75c): periksa 9164 dan 9283 atas semua perkara berjawaban yang menyebut sita atau rekonvensi harta bersama; bila ragu-nya tinggi, biarkan ragu.",
    "6. Bila Senin ternyata ada tanya-jawab yang salah ditulis: matikan saklar 'Tanya-jawab jawab-menjawab otomatis' di popup ekstensi/Widget (per akun); baris yang sudah ditulis dapat disunting/dihapus petugas di penyunting tanya-jawab ABT biasa.",
  ];

  const keluar = process.argv[2];
  if (keluar) {
    let lama = {};
    try {
      lama = JSON.parse(fs.readFileSync(keluar, "utf8"));
    } catch {
      lama = {};
    }
    lama.JJ2 = { dibuat: new Date().toISOString().slice(0, 10), sumber: "salinan lokal aleta_bot / aps_badilag / sipp_donggala (hanya SELECT); berkas PDF e-Court tidak ada di laptop", ...hasil };
    fs.writeFileSync(keluar, `${JSON.stringify(lama, null, 2)}\n`);
  }
  console.log(JSON.stringify(hasil, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
