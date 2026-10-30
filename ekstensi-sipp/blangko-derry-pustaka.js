"use strict";

/**
 * ============================================================================
 * BLANGKO ABT BY DERRY - PUSTAKA KALIMAT PRIBADI (30 Okt 2026)
 * ============================================================================
 *
 * Hakim dan panitera pengganti menyimpan paragraf yang sering dipakai per jenis perkara, status, dan isian teks. Tersimpan di akun
 * ALETA (server), dapat dibagikan ke golongan peran lain bila pemiliknya memilih. Dua cara pakai:
 *   - OTOMATIS (tanpa membuka apa pun): untuk isian teks yang masih kosong, kalimat yang disimpan untuk isian itu + jenis perkara +
 *     status yang sama diusulkan sebagai SARAN SAMAR di kotaknya (Tab untuk memakai), seperti saran lain;
 *   - SATU KLIK: tombol kecil di kepala kotak teks panjang membuka daftar kalimat yang berlaku; mengklik satu menyisipkannya, dan
 *     "Simpan isi kotak ini" menambahkan isi kotak ke pustaka.
 * Berkas ini hanya pemanggil rute portal /aleta-ecourt/kalimat-pribadi dan pembuat tampilan daftarnya. Menyisipkan ke isian adalah
 * tindakan petugas lewat jalur simpan isian yang sudah ada; berkas ini tidak menulis ke ABT/SIPP.
 */
(function pustakaKalimatModul() {
  if (typeof globalThis === "undefined" || globalThis.aletaPustaka) return;

  const API = "/aleta/api/aleta-ecourt/kalimat-pribadi";
  const TTL_MS = 60 * 1000;
  const GOLONGAN = { hakim: "Hakim", pimpinan: "Ketua / Wakil", panitera: "Panitera", panmud: "Panitera Muda", pp: "Panitera Pengganti", jurusita: "Jurusita", ptsp: "PTSP" };

  const cache = new Map(); // "jenis|status" -> { saat, daftar, golonganBagi }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const potong = (t, n) => (String(t || "").length > n ? `${String(t).slice(0, n - 1)}…` : String(t || ""));
  const kunciKonteks = (k) => `${String((k && k.jenisPerkara) || "").toLowerCase()}|${String((k && k.status) || "").toLowerCase()}`;

  function buka(jawaban) {
    return jawaban && jawaban.data && typeof jawaban.data === "object" ? jawaban.data : jawaban;
  }
  async function panggil(alamat, opsi) {
    try {
      const r = await fetch(alamat, Object.assign({ credentials: "include", cache: "no-store" }, opsi || {}));
      const j = r ? await r.json().catch(() => null) : null;
      if (!r || !r.ok) {
        const e = j && (j.error && j.error.message ? j.error.message : j.message);
        return { ok: false, sebab: e || `Server menjawab ${r ? r.status : "tanpa jawaban"}.` };
      }
      return { ok: true, data: buka(j) };
    } catch (e) {
      return { ok: false, sebab: String((e && e.message) || e) };
    }
  }

  /** Semua kalimat yang berlaku untuk jenis perkara + status itu (untuk isian mana pun); dikelompokkan per isian oleh pemanggil. [] bila gagal. */
  async function muat(konteks, paksa) {
    const kunci = kunciKonteks(konteks);
    const ada = cache.get(kunci);
    if (!paksa && ada && Date.now() - ada.saat < TTL_MS) return ada.daftar;
    const q = new URLSearchParams({ jenis: String((konteks && konteks.jenisPerkara) || ""), status: String((konteks && konteks.status) || ""), semuaKode: "1" });
    const h = await panggil(`${API}?${q.toString()}`);
    const daftar = h.ok && h.data && Array.isArray(h.data.kalimat) ? h.data.kalimat : [];
    cache.set(kunci, { saat: Date.now(), daftar, golonganBagi: h.ok && h.data && Array.isArray(h.data.golonganBagi) ? h.data.golonganBagi : [] });
    return daftar;
  }
  const golonganBagi = (konteks) => {
    const c = cache.get(kunciKonteks(konteks));
    return c && c.golonganBagi.length ? c.golonganBagi : Object.keys(GOLONGAN);
  };
  const lupakan = () => cache.clear();

  /** Kalimat yang dapat disisipkan ke isian itu: yang khusus isian itu, lalu yang untuk semua isian teks. */
  const untukKode = (daftar, kode) => (Array.isArray(daftar) ? daftar : []).filter((k) => !k.kode || k.kode === String(kode));
  /** Usulan otomatis: kalimat yang disimpan KHUSUS untuk isian itu (urutan server = paling cocok dan paling sering dipakai). */
  const usulan = (daftar, kode) => (Array.isArray(daftar) ? daftar : []).find((k) => k.kode === String(kode)) || null;

  async function simpan(data) {
    const h = await panggil(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aksi: "simpan", ...data }) });
    if (h.ok) lupakan();
    return h.ok ? { ok: true, kalimat: h.data && h.data.kalimat } : { ok: false, sebab: h.sebab };
  }
  async function pakai(id) {
    const h = await panggil(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aksi: "pakai", id }) });
    return h.ok;
  }
  async function hapus(id) {
    const h = await panggil(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aksi: "hapus", id }) });
    if (h.ok) lupakan();
    return h.ok ? { ok: true } : { ok: false, sebab: h.sebab };
  }

  const ketCakupan = (k) => [k.kode ? `isian ${k.kode}` : "semua isian teks", k.jenisPerkara || "semua jenis perkara", k.status || "semua status"].join(" · ");

  /**
   * Panel di bawah kepala kotak. `m`: { kode, daftar, saya (id pengguna), jenisPerkara, status, golonganBagi, bolehSimpan, kotakKosong }.
   * Tombol memakai data-bd2 berawalan "ket" supaya sampai ke penyalur aksi kartu isian.
   */
  function htmlPanel(m) {
    const kode = esc(m.kode);
    const baris = untukKode(m.daftar, m.kode)
      .map((k) => {
        const milikSaya = k.pemilikId === m.saya;
        const bagi = (k.dibagikan || []).length ? ` · dibagikan ke ${(k.dibagikan || []).map((g) => GOLONGAN[g] || g).join(", ")}` : "";
        return (
          `<div class="bd-pusbaris"><button type="button" class="bd-pusisip" data-bd2="ketpusisip" data-ket="${kode}" data-id="${esc(k.id)}" title="${esc(k.teks)}">` +
          `<span>${esc(potong(k.judul && k.judul !== k.teks.slice(0, k.judul.length) ? k.judul : k.teks, 140))}</span>` +
          `<small>${esc(ketCakupan(k))}${k.dipakai ? ` · dipakai ${k.dipakai}x` : ""}${milikSaya ? "" : ` · dari ${esc(k.pemilikNama || "akun lain")}`}${esc(bagi)}</small></button>` +
          (milikSaya ? `<button type="button" class="bd-tautankecil" data-bd2="ketpushapus" data-ket="${kode}" data-id="${esc(k.id)}" aria-label="Hapus kalimat ini dari pustaka">hapus</button>` : "") +
          `</div>`
        );
      })
      .join("");
    const bagiKotak = (m.golonganBagi || [])
      .map((g) => `<label class="bd-cek"><input type="checkbox" data-pus-bagi="${esc(g)}"> ${esc(GOLONGAN[g] || g)}</label>`)
      .join("");
    const simpan = m.bolehSimpan
      ? `<details class="bd-pussimpan"${m.kotakKosong ? "" : " open"}><summary>Simpan isi kotak ini ke pustaka</summary>` +
        `<label>Judul (boleh kosong) <input type="text" data-pus-judul maxlength="80" autocomplete="off"></label>` +
        `<label class="bd-cek"><input type="checkbox" data-pus-jenis checked> hanya untuk ${esc(m.jenisPerkara || "jenis perkara ini")}</label>` +
        `<label class="bd-cek"><input type="checkbox" data-pus-status> hanya untuk perkara ${esc(m.status || "dengan status ini")}</label>` +
        `<label class="bd-cek"><input type="checkbox" data-pus-kode checked> hanya untuk isian ini</label>` +
        `<div class="bd-pusbagi"><span class="bd-catat">Bagikan juga ke (boleh kosong):</span> ${bagiKotak}</div>` +
        `<button type="button" class="bd-btn kecil" data-bd2="ketpussimpan" data-ket="${kode}">Simpan ke pustaka</button></details>`
      : "";
    return (
      `<div class="bd-pustaka" data-pustaka="${kode}">` +
      (baris || `<p class="bd-catat">Belum ada kalimat tersimpan untuk isian ini. Ketik di kotak, lalu simpan ke pustaka.</p>`) +
      simpan +
      `<p class="bd-catat">Mengklik kalimat menyisipkannya ke kotak. Kalimat yang khusus isian ini, jenis perkara ini, dan status ini juga muncul sendiri sebagai saran samar (Tab) saat kotak masih kosong.</p></div>`
    );
  }

  globalThis.aletaPustaka = Object.freeze({ API, muat, lupakan, simpan, pakai, hapus, untukKode, usulan, golonganBagi, htmlPanel, GOLONGAN });
})();
