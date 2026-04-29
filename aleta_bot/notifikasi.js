const moment = require("moment");
const db = require("./db_config");
const db4 = require("./db_config4");
const db5 = require("./db_config5");
moment.locale('en');

//identitas tiap user
// Fungsi untuk mendapatkan semua nama hakim
const getAllHakim = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT DISTINCT hakim_nama FROM perkara_hakim_pn`; // Query untuk mendapatkan semua nama hakim

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        const hakimNames = result.map(r => r.hakim_nama); // Ambil nama hakim
        resolve(hakimNames);
      }
    });
  });
};

// Fungsi untuk mendapatkan semua nama panitera
const getAllPanitera = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT DISTINCT panitera_nama FROM perkara_panitera_pn`; // Query untuk mendapatkan semua nama panitera

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        const paniteraNames = result.map(r => r.panitera_nama); // Ambil nama panitera
        resolve(paniteraNames);
      }
    });
  });
};

// Fungsi untuk mendapatkan semua nama jurusita
const getAllJurusita = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT DISTINCT jurusita_nama FROM perkara_jurusita`; // Query untuk mendapatkan semua nama jurusita

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        const jurusitaNames = result.map(r => r.jurusita_nama); // Ambil nama jurusita
        resolve(jurusitaNames);
      }
    });
  });
};

const getDataPihakBaru = () => {
  return new Promise((resolve, reject) => {
      let queryPihakP = `SELECT 
      a.perkara_id, 
      a.pihak_id, 
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      a.nomor_perkara, 
      a.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      (CASE 
          WHEN c.proses_terakhir_id = 81 THEN c.tanggal_pendaftaran 
          ELSE d.tgl_akta_cerai 
      END) AS tanggal,
      DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
      CASE DAYNAME(e.tanggal_sidang)
        WHEN 'Monday' THEN 'Senin'
        WHEN 'Tuesday' THEN 'Selasa'
        WHEN 'Wednesday' THEN 'Rabu'
        WHEN 'Thursday' THEN 'Kamis'
        WHEN 'Friday' THEN 'Jumat'
        WHEN 'Saturday' THEN 'Sabtu'
        WHEN 'Sunday' THEN 'Minggu'
        ELSE 'Unknown'
      END AS hari_sidang,
      e.agenda,
      e.ruangan,
			c.petitum_dok
  FROM 
      v_pihak_perkara a
      JOIN pihak b ON b.id = a.pihak_id 
                  AND b.telepon REGEXP '^[0-9]' 
                  AND CHAR_LENGTH(b.telepon) > 8
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
      LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = c.perkara_id
  WHERE 
      c.proses_terakhir_id = 81
      AND a.pihak_ke = 1
      AND a.tanggal_pendaftaran = CURDATE()`;

      let queryPihakT = `SELECT 
      a.perkara_id, 
      a.pihak_id, 
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      a.nomor_perkara, 
      a.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      (CASE 
          WHEN c.proses_terakhir_id = 81 THEN c.tanggal_pendaftaran 
          ELSE d.tgl_akta_cerai 
      END) AS tanggal,
      DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
      CASE DAYNAME(e.tanggal_sidang)
        WHEN 'Monday' THEN 'Senin'
        WHEN 'Tuesday' THEN 'Selasa'
        WHEN 'Wednesday' THEN 'Rabu'
        WHEN 'Thursday' THEN 'Kamis'
        WHEN 'Friday' THEN 'Jumat'
        WHEN 'Saturday' THEN 'Sabtu'
        WHEN 'Sunday' THEN 'Minggu'
        ELSE 'Unknown'
      END AS hari_sidang,
      e.agenda,
      e.ruangan,
			c.petitum_dok
  FROM 
      v_pihak_perkara a
      JOIN pihak b ON b.id = a.pihak_id 
                  AND b.telepon REGEXP '^[0-9]' 
                  AND CHAR_LENGTH(b.telepon) > 8
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
      LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = c.perkara_id
  WHERE 
      c.proses_terakhir_id = 81
      AND a.pihak_ke = 2
      AND a.tanggal_pendaftaran = CURDATE()`;
      
      let queryKuasaP = `SELECT 
      c.perkara_id,
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      c.nomor_perkara, 
      c.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      (CASE 
          WHEN c.proses_terakhir_id = 81 THEN c.tanggal_pendaftaran 
          ELSE d.tgl_akta_cerai 
      END) AS tanggal,
      DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
      CASE DAYNAME(e.tanggal_sidang)
        WHEN 'Monday' THEN 'Senin'
        WHEN 'Tuesday' THEN 'Selasa'
        WHEN 'Wednesday' THEN 'Rabu'
        WHEN 'Thursday' THEN 'Kamis'
        WHEN 'Friday' THEN 'Jumat'
        WHEN 'Saturday' THEN 'Sabtu'
        WHEN 'Sunday' THEN 'Minggu'
        ELSE 'Unknown'
      END AS hari_sidang,
      e.agenda,
      e.ruangan,
      c.petitum_dok
  FROM 
      perkara_pengacara a
      JOIN pihak b ON b.id = a.pengacara_id 
                  AND b.telepon REGEXP '^[0-9]' 
                  AND CHAR_LENGTH(b.telepon) > 8
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = c.perkara_id
      LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = c.perkara_id
      JOIN v_pihak_perkara h ON h.perkara_id = c.perkara_id
  WHERE 
      c.proses_terakhir_id = 81
      AND h.pihak_ke = 1
      AND c.tanggal_pendaftaran = CURDATE()`;
      
      let queryKuasaT = `SELECT 
      c.perkara_id,
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      c.nomor_perkara, 
      c.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      (CASE 
          WHEN c.proses_terakhir_id = 81 THEN c.tanggal_pendaftaran 
          ELSE d.tgl_akta_cerai 
      END) AS tanggal,
      DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
      CASE DAYNAME(e.tanggal_sidang)
        WHEN 'Monday' THEN 'Senin'
        WHEN 'Tuesday' THEN 'Selasa'
        WHEN 'Wednesday' THEN 'Rabu'
        WHEN 'Thursday' THEN 'Kamis'
        WHEN 'Friday' THEN 'Jumat'
        WHEN 'Saturday' THEN 'Sabtu'
        WHEN 'Sunday' THEN 'Minggu'
        ELSE 'Unknown'
      END AS hari_sidang,
      e.agenda,
      e.ruangan,
      c.petitum_dok
  FROM 
      perkara_pengacara a
      JOIN pihak b ON b.id = a.pengacara_id 
                  AND b.telepon REGEXP '^[0-9]' 
                  AND CHAR_LENGTH(b.telepon) > 8
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = c.perkara_id
      LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = c.perkara_id
      JOIN v_pihak_perkara h ON h.perkara_id = c.perkara_id
  WHERE 
      c.proses_terakhir_id = 81
      AND h.pihak_ke = 2
      AND c.tanggal_pendaftaran = CURDATE()`;

      let queryTurutT = `SELECT 
      a.perkara_id, 
      a.pihak_id, 
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      a.nomor_perkara, 
      a.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      (CASE 
          WHEN c.proses_terakhir_id = 81 THEN c.tanggal_pendaftaran 
          ELSE d.tgl_akta_cerai 
      END) AS tanggal,
      DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
      CASE DAYNAME(e.tanggal_sidang)
        WHEN 'Monday' THEN 'Senin'
        WHEN 'Tuesday' THEN 'Selasa'
        WHEN 'Wednesday' THEN 'Rabu'
        WHEN 'Thursday' THEN 'Kamis'
        WHEN 'Friday' THEN 'Jumat'
        WHEN 'Saturday' THEN 'Sabtu'
        WHEN 'Sunday' THEN 'Minggu'
        ELSE 'Unknown'
      END AS hari_sidang,
      e.agenda,
      e.ruangan,
			c.petitum_dok
  FROM 
      v_pihak_perkara a
      JOIN pihak b ON b.id = a.pihak_id 
                  AND b.telepon REGEXP '^[0-9]' 
                  AND CHAR_LENGTH(b.telepon) > 8
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
      LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = c.perkara_id
  WHERE 
      c.proses_terakhir_id = 81
      AND a.pihak_ke = 4
      AND a.tanggal_pendaftaran = CURDATE()`;

      let queryIntervensi = `SELECT 
      a.perkara_id, 
      a.pihak_id, 
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      a.nomor_perkara, 
      a.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      (CASE 
          WHEN c.proses_terakhir_id = 81 THEN c.tanggal_pendaftaran 
          ELSE d.tgl_akta_cerai 
      END) AS tanggal,
      DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
      CASE DAYNAME(e.tanggal_sidang)
        WHEN 'Monday' THEN 'Senin'
        WHEN 'Tuesday' THEN 'Selasa'
        WHEN 'Wednesday' THEN 'Rabu'
        WHEN 'Thursday' THEN 'Kamis'
        WHEN 'Friday' THEN 'Jumat'
        WHEN 'Saturday' THEN 'Sabtu'
        WHEN 'Sunday' THEN 'Minggu'
        ELSE 'Unknown'
      END AS hari_sidang,
      e.agenda,
      e.ruangan,
			c.petitum_dok
  FROM 
      v_pihak_perkara a
      JOIN pihak b ON b.id = a.pihak_id 
                  AND b.telepon REGEXP '^[0-9]' 
                  AND CHAR_LENGTH(b.telepon) > 8
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
      LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = c.perkara_id
  WHERE 
      c.proses_terakhir_id = 81
      AND a.pihak_ke = 3
      AND a.tanggal_pendaftaran = CURDATE()`;

      // Query untuk pihak P
      db.query(queryPihakP, (errP, resultP) => {
          if (errP) {
              reject(errP);
          } else {
              // Query untuk pihak T
              db.query(queryPihakT, (errT, resultT) => {
                  if (errT) {
                      reject(errT);
                  } else {
                      // Query untuk kuasa P
                      db.query(queryKuasaP, (errKuasaP, resultKuasaP) => {
                          if (errKuasaP) {
                              reject(errKuasaP);
                          } else {
                              // Query untuk kuasa T
                              db.query(queryKuasaT, (errKuasaT, resultKuasaT) => {
                                  if (errKuasaT) {
                                      reject(errKuasaT);
                                  } else {
                                      // Query untuk turut T
                                      db.query(queryTurutT, (errTurutT, resultTurutT) => {
                                          if (errTurutT) {
                                              reject(errTurutT);
                                          } else {
                                              // Query untuk intervensi
                                              db.query(queryIntervensi, (errIntervensi, resultIntervensi) => {
                                                  if (errIntervensi) {
                                                      reject(errIntervensi);
                                                  } else {
                                                      resolve({ 
                                                          pihakP: resultP, 
                                                          pihakT: resultT, 
                                                          kuasaP: resultKuasaP, 
                                                          kuasaT: resultKuasaT,
                                                          turutT: resultTurutT,
                                                          intervensi: resultIntervensi
                                                      });
                                                  }
                                              });
                                          }
                                      });
                                  }
                              });
                          }
                      });
                  }
              });
          }
      });
  });
};

const getDataPihakHariSidang = () => {
  return new Promise((resolve, reject) => {
      let querySidangPihakP = `SELECT DISTINCT
      a.perkara_id,
      c.nomor_urut_perkara,
			pp.tahun_pendaftaran, 
      CASE 
          WHEN c.alur_perkara_id = 8 THEN 'GS'
          WHEN c.alur_perkara_id = 15 THEN 'G'
          WHEN c.alur_perkara_id = 16 THEN 'P'
          WHEN c.alur_perkara_id = 125 THEN 'JN'
          ELSE NULL
      END AS alur_status,
      a.pihak_id, 
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      a.nomor_perkara, 
      a.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
      CASE DAYNAME(e.tanggal_sidang)
        WHEN 'Monday' THEN 'Senin'
        WHEN 'Tuesday' THEN 'Selasa'
        WHEN 'Wednesday' THEN 'Rabu'
        WHEN 'Thursday' THEN 'Kamis'
        WHEN 'Friday' THEN 'Jumat'
        WHEN 'Saturday' THEN 'Sabtu'
        WHEN 'Sunday' THEN 'Minggu'
        ELSE 'Unknown'
      END AS hari_sidang,
      e.agenda,
      e.ruangan
  FROM 
      v_pihak_perkara a
      LEFT JOIN v_perkara pp ON pp.perkara_id = a.perkara_id
      JOIN pihak b ON b.id = a.pihak_id 
                  AND b.telepon REGEXP '^[0-9]' 
                  AND CHAR_LENGTH(b.telepon) > 8
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
      LEFT JOIN (
          SELECT 
              perkara_id, 
              MAX(tanggal_sidang) AS tanggal_sidang_terakhir,
              agenda,
              ruangan
          FROM 
              perkara_jadwal_sidang
          GROUP BY 
              perkara_id
      ) AS subq ON c.perkara_id = subq.perkara_id
      LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = subq.perkara_id
      LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
      LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
  WHERE 
      a.pihak_ke = 1
      AND e.tanggal_sidang = CURDATE()
      AND c.alur_perkara_id IN (15, 16, 17)
      AND (
          CASE 
              WHEN c.jenis_perkara_id = 346 AND f.status_putusan_id = 62 AND g.amar_ikrar_talak IS NULL THEN c.proses_terakhir_id < 296 
              ELSE c.proses_terakhir_id < 218 
          END
      )`;

      let querySidangPihakT = `SELECT DISTINCT
      a.perkara_id,
      c.nomor_urut_perkara,
			pp.tahun_pendaftaran, 
      CASE 
          WHEN c.alur_perkara_id = 8 THEN 'GS'
          WHEN c.alur_perkara_id = 15 THEN 'G'
          WHEN c.alur_perkara_id = 16 THEN 'P'
          WHEN c.alur_perkara_id = 125 THEN 'JN'
          ELSE NULL
      END AS alur_status,
      a.pihak_id, 
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      a.nomor_perkara, 
      a.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
      CASE DAYNAME(e.tanggal_sidang)
        WHEN 'Monday' THEN 'Senin'
        WHEN 'Tuesday' THEN 'Selasa'
        WHEN 'Wednesday' THEN 'Rabu'
        WHEN 'Thursday' THEN 'Kamis'
        WHEN 'Friday' THEN 'Jumat'
        WHEN 'Saturday' THEN 'Sabtu'
        WHEN 'Sunday' THEN 'Minggu'
        ELSE 'Unknown'
      END AS hari_sidang,
      e.agenda,
      e.ruangan
  FROM 
      v_pihak_perkara a
      LEFT JOIN v_perkara pp ON pp.perkara_id = a.perkara_id
      JOIN pihak b ON b.id = a.pihak_id 
                  AND b.telepon REGEXP '^[0-9]' 
                  AND CHAR_LENGTH(b.telepon) > 8
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
      LEFT JOIN (
          SELECT 
              perkara_id, 
              MAX(tanggal_sidang) AS tanggal_sidang_terakhir,
              agenda,
              ruangan
          FROM 
              perkara_jadwal_sidang
          GROUP BY 
              perkara_id
      ) AS subq ON c.perkara_id = subq.perkara_id
      LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = subq.perkara_id
      LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
      LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
  WHERE 
      a.pihak_ke = 2
      AND e.tanggal_sidang = CURDATE()
      AND c.alur_perkara_id IN (15, 16, 17)
      AND (
          CASE 
              WHEN c.jenis_perkara_id = 346 AND f.status_putusan_id = 62 AND g.amar_ikrar_talak IS NULL THEN c.proses_terakhir_id < 296 
              ELSE c.proses_terakhir_id < 218 
          END
      )`;
      
      let querySidangKuasaP = `SELECT DISTINCT
      c.perkara_id,
      c.nomor_urut_perkara,
			pp.tahun_pendaftaran, 
      CASE 
          WHEN c.alur_perkara_id = 8 THEN 'GS'
          WHEN c.alur_perkara_id = 15 THEN 'G'
          WHEN c.alur_perkara_id = 16 THEN 'P'
          WHEN c.alur_perkara_id = 125 THEN 'JN'
          ELSE NULL
      END AS alur_status,
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      c.nomor_perkara, 
      c.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
      CASE DAYNAME(e.tanggal_sidang)
        WHEN 'Monday' THEN 'Senin'
        WHEN 'Tuesday' THEN 'Selasa'
        WHEN 'Wednesday' THEN 'Rabu'
        WHEN 'Thursday' THEN 'Kamis'
        WHEN 'Friday' THEN 'Jumat'
        WHEN 'Saturday' THEN 'Sabtu'
        WHEN 'Sunday' THEN 'Minggu'
        ELSE 'Unknown'
      END AS hari_sidang,
      e.agenda,
      e.ruangan
  FROM 
      perkara_pengacara a
      LEFT JOIN v_perkara pp ON pp.perkara_id = a.perkara_id
      JOIN pihak b ON b.id = a.pengacara_id 
                  AND b.telepon REGEXP '^[0-9]' 
                  AND CHAR_LENGTH(b.telepon) > 8
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
      LEFT JOIN (
          SELECT 
              perkara_id, 
              MAX(tanggal_sidang) AS tanggal_sidang_terakhir,
              agenda,
              ruangan
          FROM 
              perkara_jadwal_sidang
          GROUP BY 
              perkara_id
      ) AS subq ON c.perkara_id = subq.perkara_id
      LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = subq.perkara_id
      LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
      LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
      JOIN v_pihak_perkara h ON h.perkara_id = c.perkara_id
  WHERE 
      h.pihak_ke = 1
      AND e.tanggal_sidang = CURDATE()
      AND c.alur_perkara_id IN (15, 16, 17)
      AND (
          CASE 
              WHEN c.jenis_perkara_id = 346 AND f.status_putusan_id = 62 AND g.amar_ikrar_talak IS NULL THEN c.proses_terakhir_id < 296 
              ELSE c.proses_terakhir_id < 218 
          END
      )`;
      
      let querySidangKuasaT = `SELECT DISTINCT
      c.perkara_id,
      c.nomor_urut_perkara,
			pp.tahun_pendaftaran, 
      CASE 
          WHEN c.alur_perkara_id = 8 THEN 'GS'
          WHEN c.alur_perkara_id = 15 THEN 'G'
          WHEN c.alur_perkara_id = 16 THEN 'P'
          WHEN c.alur_perkara_id = 125 THEN 'JN'
          ELSE NULL
      END AS alur_status,
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      c.nomor_perkara, 
      c.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
      CASE DAYNAME(e.tanggal_sidang)
        WHEN 'Monday' THEN 'Senin'
        WHEN 'Tuesday' THEN 'Selasa'
        WHEN 'Wednesday' THEN 'Rabu'
        WHEN 'Thursday' THEN 'Kamis'
        WHEN 'Friday' THEN 'Jumat'
        WHEN 'Saturday' THEN 'Sabtu'
        WHEN 'Sunday' THEN 'Minggu'
        ELSE 'Unknown'
      END AS hari_sidang,
      e.agenda,
      e.ruangan
  FROM 
      perkara_pengacara a
      LEFT JOIN v_perkara pp ON pp.perkara_id = a.perkara_id
      JOIN pihak b ON b.id = a.pengacara_id 
                  AND b.telepon REGEXP '^[0-9]' 
                  AND CHAR_LENGTH(b.telepon) > 8
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
      LEFT JOIN (
          SELECT 
              perkara_id, 
              MAX(tanggal_sidang) AS tanggal_sidang_terakhir,
              agenda,
              ruangan
          FROM 
              perkara_jadwal_sidang
          GROUP BY 
              perkara_id
      ) AS subq ON c.perkara_id = subq.perkara_id
      LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = subq.perkara_id
      LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
      LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
      JOIN v_pihak_perkara h ON h.perkara_id = c.perkara_id
  WHERE 
      h.pihak_ke = 2
      AND e.tanggal_sidang = CURDATE()
      AND c.alur_perkara_id IN (15, 16, 17)
      AND (
          CASE 
              WHEN c.jenis_perkara_id = 346 AND f.status_putusan_id = 62 AND g.amar_ikrar_talak IS NULL THEN c.proses_terakhir_id < 296 
              ELSE c.proses_terakhir_id < 218 
          END
      )`;

      let querySidangTurutT = `SELECT DISTINCT
      a.perkara_id,
      c.nomor_urut_perkara,
			pp.tahun_pendaftaran, 
      CASE 
          WHEN c.alur_perkara_id = 8 THEN 'GS'
          WHEN c.alur_perkara_id = 15 THEN 'G'
          WHEN c.alur_perkara_id = 16 THEN 'P'
          WHEN c.alur_perkara_id = 125 THEN 'JN'
          ELSE NULL
      END AS alur_status,
      a.pihak_id, 
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      a.nomor_perkara, 
      a.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
      CASE DAYNAME(e.tanggal_sidang)
        WHEN 'Monday' THEN 'Senin'
        WHEN 'Tuesday' THEN 'Selasa'
        WHEN 'Wednesday' THEN 'Rabu'
        WHEN 'Thursday' THEN 'Kamis'
        WHEN 'Friday' THEN 'Jumat'
        WHEN 'Saturday' THEN 'Sabtu'
        WHEN 'Sunday' THEN 'Minggu'
        ELSE 'Unknown'
      END AS hari_sidang,
      e.agenda,
      e.ruangan
  FROM 
      v_pihak_perkara a
      LEFT JOIN v_perkara pp ON pp.perkara_id = a.perkara_id
      JOIN pihak b ON b.id = a.pihak_id 
                  AND b.telepon REGEXP '^[0-9]' 
                  AND CHAR_LENGTH(b.telepon) > 8
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
      LEFT JOIN (
          SELECT 
              perkara_id, 
              MAX(tanggal_sidang) AS tanggal_sidang_terakhir,
              agenda,
              ruangan
          FROM 
              perkara_jadwal_sidang
          GROUP BY 
              perkara_id
      ) AS subq ON c.perkara_id = subq.perkara_id
      LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = subq.perkara_id
      LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
      LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
  WHERE 
      a.pihak_ke = 4
      AND e.tanggal_sidang = CURDATE()
      AND c.alur_perkara_id IN (15, 16, 17)
      AND (
          CASE 
              WHEN c.jenis_perkara_id = 346 AND f.status_putusan_id = 62 AND g.amar_ikrar_talak IS NULL THEN c.proses_terakhir_id < 296 
              ELSE c.proses_terakhir_id < 218 
          END
      )`;

      let querySidangIntervensi = `SELECT DISTINCT
      a.perkara_id,
      c.nomor_urut_perkara,
			pp.tahun_pendaftaran, 
      CASE 
          WHEN c.alur_perkara_id = 8 THEN 'GS'
          WHEN c.alur_perkara_id = 15 THEN 'G'
          WHEN c.alur_perkara_id = 16 THEN 'P'
          WHEN c.alur_perkara_id = 125 THEN 'JN'
          ELSE NULL
      END AS alur_status,
      a.pihak_id, 
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      a.nomor_perkara, 
      a.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
      CASE DAYNAME(e.tanggal_sidang)
        WHEN 'Monday' THEN 'Senin'
        WHEN 'Tuesday' THEN 'Selasa'
        WHEN 'Wednesday' THEN 'Rabu'
        WHEN 'Thursday' THEN 'Kamis'
        WHEN 'Friday' THEN 'Jumat'
        WHEN 'Saturday' THEN 'Sabtu'
        WHEN 'Sunday' THEN 'Minggu'
        ELSE 'Unknown'
      END AS hari_sidang,
      e.agenda,
      e.ruangan
  FROM 
      v_pihak_perkara a
      LEFT JOIN v_perkara pp ON pp.perkara_id = a.perkara_id
      JOIN pihak b ON b.id = a.pihak_id 
                  AND b.telepon REGEXP '^[0-9]' 
                  AND CHAR_LENGTH(b.telepon) > 8
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
      LEFT JOIN (
          SELECT 
              perkara_id, 
              MAX(tanggal_sidang) AS tanggal_sidang_terakhir,
              agenda,
              ruangan
          FROM 
              perkara_jadwal_sidang
          GROUP BY 
              perkara_id
      ) AS subq ON c.perkara_id = subq.perkara_id
      LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = subq.perkara_id
      LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
      LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
  WHERE 
      a.pihak_ke = 3
      AND e.tanggal_sidang = CURDATE()
      AND c.alur_perkara_id IN (15, 16, 17)
      AND (
          CASE 
              WHEN c.jenis_perkara_id = 346 AND f.status_putusan_id = 62 AND g.amar_ikrar_talak IS NULL THEN c.proses_terakhir_id < 296 
              ELSE c.proses_terakhir_id < 218 
          END
      )`;

      // Query untuk pihak P
      db.query(querySidangPihakP, (errSidangP, resultSidangP) => {
        if (errSidangP) {
            reject(errSidangP);
        } else {
            // Query untuk pihak T
            db.query(querySidangPihakT, (errSidangT, resultSidangT) => {
                if (errSidangT) {
                    reject(errSidangT);
                } else {
                    // Query untuk kuasa P
                    db.query(querySidangKuasaP, (errSidangKuasaP, resultSidangKuasaP) => {
                        if (errSidangKuasaP) {
                            reject(errSidangKuasaP);
                        } else {
                            // Query untuk kuasa T
                            db.query(querySidangKuasaT, (errSidangKuasaT, resultSidangKuasaT) => {
                                if (errSidangKuasaT) {
                                    reject(errSidangKuasaT);
                                } else {
                                    // Query untuk turut T
                                    db.query(querySidangTurutT, (errTurutT, resultSidangTurutT) => {
                                        if (errTurutT) {
                                            reject(errTurutT);
                                        } else {
                                            // Query untuk intervensi
                                            db.query(querySidangIntervensi, (errIntervensi, resultIntervensi) => {
                                                if (errIntervensi) {
                                                    reject(errIntervensi);
                                                } else {
                                                    resolve({ 
                                                        pihakP: resultSidangP, 
                                                        pihakT: resultSidangT, 
                                                        kuasaP: resultSidangKuasaP, 
                                                        kuasaT: resultSidangKuasaT,
                                                        turutT: resultSidangTurutT,
                                                        intervensi: resultIntervensi
                                                    });
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }
    });
});
};

const getDataPihakSebelumHariSidang = () => {
  return new Promise((resolve, reject) => {
      let queryTigaSidangPihakP = `SELECT DISTINCT
      a.perkara_id, 
      a.pihak_id, 
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      a.nomor_perkara, 
      a.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
      CASE DAYNAME(e.tanggal_sidang)
        WHEN 'Monday' THEN 'Senin'
        WHEN 'Tuesday' THEN 'Selasa'
        WHEN 'Wednesday' THEN 'Rabu'
        WHEN 'Thursday' THEN 'Kamis'
        WHEN 'Friday' THEN 'Jumat'
        WHEN 'Saturday' THEN 'Sabtu'
        WHEN 'Sunday' THEN 'Minggu'
        ELSE 'Unknown'
      END AS hari_sidang,
      e.agenda,
      e.ruangan
  FROM 
      v_pihak_perkara a
      JOIN pihak b ON b.id = a.pihak_id 
                  AND b.telepon REGEXP '^[0-9]' 
                  AND CHAR_LENGTH(b.telepon) > 8
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
      LEFT JOIN (
          SELECT 
              perkara_id, 
              MAX(tanggal_sidang) AS tanggal_sidang_terakhir,
              agenda,
              ruangan
          FROM 
              perkara_jadwal_sidang
          GROUP BY 
              perkara_id
      ) AS subq ON c.perkara_id = subq.perkara_id
      LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = subq.perkara_id
      LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
      LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
  WHERE 
      a.pihak_ke = 1
      AND e.tanggal_sidang = DATE_ADD(CURDATE(), INTERVAL 3 DAY)
      AND c.alur_perkara_id IN (15, 16, 17)
      AND (
          CASE 
              WHEN c.jenis_perkara_id = 346 AND f.status_putusan_id = 62 AND g.amar_ikrar_talak IS NULL THEN c.proses_terakhir_id < 296 
              ELSE c.proses_terakhir_id < 218 
          END
      )`;

      let queryTigaSidangPihakT = `SELECT DISTINCT
      a.perkara_id, 
      a.pihak_id, 
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      a.nomor_perkara, 
      a.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
      CASE DAYNAME(e.tanggal_sidang)
        WHEN 'Monday' THEN 'Senin'
        WHEN 'Tuesday' THEN 'Selasa'
        WHEN 'Wednesday' THEN 'Rabu'
        WHEN 'Thursday' THEN 'Kamis'
        WHEN 'Friday' THEN 'Jumat'
        WHEN 'Saturday' THEN 'Sabtu'
        WHEN 'Sunday' THEN 'Minggu'
        ELSE 'Unknown'
      END AS hari_sidang,
      e.agenda,
      e.ruangan
  FROM 
      v_pihak_perkara a
      JOIN pihak b ON b.id = a.pihak_id 
                  AND b.telepon REGEXP '^[0-9]' 
                  AND CHAR_LENGTH(b.telepon) > 8
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
      LEFT JOIN (
          SELECT 
              perkara_id, 
              MAX(tanggal_sidang) AS tanggal_sidang_terakhir,
              agenda,
              ruangan
          FROM 
              perkara_jadwal_sidang
          GROUP BY 
              perkara_id
      ) AS subq ON c.perkara_id = subq.perkara_id
      LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = subq.perkara_id
      LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
      LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
  WHERE 
      a.pihak_ke = 2
      AND e.tanggal_sidang = DATE_ADD(CURDATE(), INTERVAL 3 DAY)
      AND c.alur_perkara_id IN (15, 16, 17)
      AND (
          CASE 
              WHEN c.jenis_perkara_id = 346 AND f.status_putusan_id = 62 AND g.amar_ikrar_talak IS NULL THEN c.proses_terakhir_id < 296 
              ELSE c.proses_terakhir_id < 218 
          END
      )`;
      
      let queryTigaSidangKuasaP = `SELECT DISTINCT
      c.perkara_id, 
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      c.nomor_perkara, 
      c.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
      CASE DAYNAME(e.tanggal_sidang)
        WHEN 'Monday' THEN 'Senin'
        WHEN 'Tuesday' THEN 'Selasa'
        WHEN 'Wednesday' THEN 'Rabu'
        WHEN 'Thursday' THEN 'Kamis'
        WHEN 'Friday' THEN 'Jumat'
        WHEN 'Saturday' THEN 'Sabtu'
        WHEN 'Sunday' THEN 'Minggu'
        ELSE 'Unknown'
      END AS hari_sidang,
      e.agenda,
      e.ruangan
  FROM 
      perkara_pengacara a
      JOIN pihak b ON b.id = a.pengacara_id 
                  AND b.telepon REGEXP '^[0-9]' 
                  AND CHAR_LENGTH(b.telepon) > 8
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
      LEFT JOIN (
          SELECT 
              perkara_id, 
              MAX(tanggal_sidang) AS tanggal_sidang_terakhir,
              agenda,
              ruangan
          FROM 
              perkara_jadwal_sidang
          GROUP BY 
              perkara_id
      ) AS subq ON c.perkara_id = subq.perkara_id
      LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = subq.perkara_id
      LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
      LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
      JOIN v_pihak_perkara h ON h.perkara_id = c.perkara_id
  WHERE 
      h.pihak_ke = 1
      AND e.tanggal_sidang = DATE_ADD(CURDATE(), INTERVAL 3 DAY)
      AND c.alur_perkara_id IN (15, 16, 17)
      AND (
          CASE 
              WHEN c.jenis_perkara_id = 346 AND f.status_putusan_id = 62 AND g.amar_ikrar_talak IS NULL THEN c.proses_terakhir_id < 296 
              ELSE c.proses_terakhir_id < 218 
          END
      )`;
      
      let queryTigaSidangKuasaT = `SELECT DISTINCT
      c.perkara_id, 
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      c.nomor_perkara, 
      c.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
      CASE DAYNAME(e.tanggal_sidang)
        WHEN 'Monday' THEN 'Senin'
        WHEN 'Tuesday' THEN 'Selasa'
        WHEN 'Wednesday' THEN 'Rabu'
        WHEN 'Thursday' THEN 'Kamis'
        WHEN 'Friday' THEN 'Jumat'
        WHEN 'Saturday' THEN 'Sabtu'
        WHEN 'Sunday' THEN 'Minggu'
        ELSE 'Unknown'
      END AS hari_sidang,
      e.agenda,
      e.ruangan
  FROM 
      perkara_pengacara a
      JOIN pihak b ON b.id = a.pengacara_id 
                  AND b.telepon REGEXP '^[0-9]' 
                  AND CHAR_LENGTH(b.telepon) > 8
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
      LEFT JOIN (
          SELECT 
              perkara_id, 
              MAX(tanggal_sidang) AS tanggal_sidang_terakhir,
              agenda,
              ruangan
          FROM 
              perkara_jadwal_sidang
          GROUP BY 
              perkara_id
      ) AS subq ON c.perkara_id = subq.perkara_id
      LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = subq.perkara_id
      LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
      LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
      JOIN v_pihak_perkara h ON h.perkara_id = c.perkara_id
  WHERE 
      h.pihak_ke = 2
      AND e.tanggal_sidang = DATE_ADD(CURDATE(), INTERVAL 3 DAY)
      AND c.alur_perkara_id IN (15, 16, 17)
      AND (
          CASE 
              WHEN c.jenis_perkara_id = 346 AND f.status_putusan_id = 62 AND g.amar_ikrar_talak IS NULL THEN c.proses_terakhir_id < 296 
              ELSE c.proses_terakhir_id < 218 
          END
      )`;

      let queryTigaSidangTurutT = `SELECT DISTINCT
      a.perkara_id, 
      a.pihak_id, 
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      a.nomor_perkara, 
      a.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
      CASE DAYNAME(e.tanggal_sidang)
        WHEN 'Monday' THEN 'Senin'
        WHEN 'Tuesday' THEN 'Selasa'
        WHEN 'Wednesday' THEN 'Rabu'
        WHEN 'Thursday' THEN 'Kamis'
        WHEN 'Friday' THEN 'Jumat'
        WHEN 'Saturday' THEN 'Sabtu'
        WHEN 'Sunday' THEN 'Minggu'
        ELSE 'Unknown'
      END AS hari_sidang,
      e.agenda,
      e.ruangan
  FROM 
      v_pihak_perkara a
      JOIN pihak b ON b.id = a.pihak_id 
                  AND b.telepon REGEXP '^[0-9]' 
                  AND CHAR_LENGTH(b.telepon) > 8
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
      LEFT JOIN (
          SELECT 
              perkara_id, 
              MAX(tanggal_sidang) AS tanggal_sidang_terakhir,
              agenda,
              ruangan
          FROM 
              perkara_jadwal_sidang
          GROUP BY 
              perkara_id
      ) AS subq ON c.perkara_id = subq.perkara_id
      LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = subq.perkara_id
      LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
      LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
  WHERE 
      a.pihak_ke = 4
      AND e.tanggal_sidang = DATE_ADD(CURDATE(), INTERVAL 3 DAY)
      AND c.alur_perkara_id IN (15, 16, 17)
      AND (
          CASE 
              WHEN c.jenis_perkara_id = 346 AND f.status_putusan_id = 62 AND g.amar_ikrar_talak IS NULL THEN c.proses_terakhir_id < 296 
              ELSE c.proses_terakhir_id < 218 
          END
      )`;

      let queryTigaSidangIntervensi = `SELECT DISTINCT
      a.perkara_id, 
      a.pihak_id, 
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      a.nomor_perkara, 
      a.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
      CASE DAYNAME(e.tanggal_sidang)
        WHEN 'Monday' THEN 'Senin'
        WHEN 'Tuesday' THEN 'Selasa'
        WHEN 'Wednesday' THEN 'Rabu'
        WHEN 'Thursday' THEN 'Kamis'
        WHEN 'Friday' THEN 'Jumat'
        WHEN 'Saturday' THEN 'Sabtu'
        WHEN 'Sunday' THEN 'Minggu'
        ELSE 'Unknown'
      END AS hari_sidang,
      e.agenda,
      e.ruangan
  FROM 
      v_pihak_perkara a
      JOIN pihak b ON b.id = a.pihak_id 
                  AND b.telepon REGEXP '^[0-9]' 
                  AND CHAR_LENGTH(b.telepon) > 8
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
      LEFT JOIN (
          SELECT 
              perkara_id, 
              MAX(tanggal_sidang) AS tanggal_sidang_terakhir,
              agenda,
              ruangan
          FROM 
              perkara_jadwal_sidang
          GROUP BY 
              perkara_id
      ) AS subq ON c.perkara_id = subq.perkara_id
      LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = subq.perkara_id
      LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
      LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
  WHERE 
      a.pihak_ke = 3
      AND e.tanggal_sidang = DATE_ADD(CURDATE(), INTERVAL 3 DAY)
      AND c.alur_perkara_id IN (15, 16, 17)
      AND (
          CASE 
              WHEN c.jenis_perkara_id = 346 AND f.status_putusan_id = 62 AND g.amar_ikrar_talak IS NULL THEN c.proses_terakhir_id < 296 
              ELSE c.proses_terakhir_id < 218 
          END
      )`;

      // Query untuk pihak P
      db.query(queryTigaSidangPihakP, (errTigaSidangP, resultTigaSidangP) => {
          if (errTigaSidangP) {
              reject(errTigaSidangP);
          } else {
              // Query untuk pihak T
              db.query(queryTigaSidangPihakT, (errTigaSidangT, resultTigaSidangT) => {
                  if (errTigaSidangT) {
                      reject(errTigaSidangT);
                  } else {
                      // Query untuk kuasa P
                      db.query(queryTigaSidangKuasaP, (errTigaSidangKuasaP, resultTigaSidangKuasaP) => {
                          if (errTigaSidangKuasaP) {
                              reject(errTigaSidangKuasaP);
                          } else {
                              // Query untuk kuasa T
                              db.query(queryTigaSidangKuasaT, (errTigaSidangKuasaT, resultTigaSidangKuasaT) => {
                                  if (errTigaSidangKuasaT) {
                                      reject(errTigaSidangKuasaT);
                                  } else {
                                      // Tambahkan query untuk turut T
                                      db.query(queryTigaSidangTurutT, (errTurutT, resultTigaSidangTurutT) => {
                                          if (errTurutT) {
                                              reject(errTurutT);
                                          } else {
                                              // Tambahkan query untuk intervensi
                                              db.query(queryTigaSidangIntervensi, (errIntervensi, resultIntervensi) => {
                                                  if (errIntervensi) {
                                                      reject(errIntervensi);
                                                  } else {
                                                      resolve({ 
                                                          pihakP: resultTigaSidangP, 
                                                          pihakT: resultTigaSidangT, 
                                                          kuasaP: resultTigaSidangKuasaP, 
                                                          kuasaT: resultTigaSidangKuasaT,
                                                          turutT: resultTigaSidangTurutT,
                                                          intervensi: resultIntervensi
                                                      });
                                                  }
                                              });
                                          }
                                      });
                                  }
                              });
                          }
                      });
                  }
              });
          }
      });
  });
};

const getDataPutusanPihak = () => {
  return new Promise((resolve, reject) => {
      let queryPutusanPihakP = `SELECT DISTINCT
      a.perkara_id, 
      a.pihak_id, 
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      a.nomor_perkara, 
      a.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      CASE
        WHEN n.jabatan_hakim_nama = 'Hakim Tunggal' THEN 'Hakim Tunggal'
        ELSE 'Majelis Hakim'
      END AS jabatan_hakim,
      DATE_FORMAT(m.tanggal_putusan, '%d-%m-%Y') AS tanggal_putusan,
      CASE DAYNAME(m.tanggal_putusan)
          WHEN 'Monday' THEN 'Senin'
          WHEN 'Tuesday' THEN 'Selasa'
          WHEN 'Wednesday' THEN 'Rabu'
          WHEN 'Thursday' THEN 'Kamis'
          WHEN 'Friday' THEN 'Jumat'
          WHEN 'Saturday' THEN 'Sabtu'
          WHEN 'Sunday' THEN 'Minggu'
          ELSE 'Unknown'
      END AS hari_putusan,
      CASE WHEN m.putusan_verstek = 'Y' THEN 'Verstek' ELSE 'Kontra' END AS putusan_verstek,
      REPLACE(
          REPLACE(
              REPLACE(
                  REPLACE(
                      REPLACE(
                          REPLACE(
                              REPLACE(
                                  REPLACE(
                                      REPLACE(
                                          REPLACE(
                                              REPLACE(
                                                  REPLACE(
                                                      REPLACE(
                                                          REPLACE(

                                                                  m.amar_putusan, '<p>', ''
                                                              ), 
                                                              '</p>', '\n'
                                                          ), 
                                                          '<ol>', ''
                                                      ), 
                                                      '</ol>', ''
                                                  ), 
                                                  '<li>', '- '
                                              ), 
                                              '<li >', '- '
                                          ), 
                                          '</li>', '\n'
                                      ), 
                                      '<strong>', ''
                                  ), 
                                  '</strong>', ''
                              ), 
                              '<em>', ''
                          ), 
                          '</em>', ''
                      ), 
                      '&#39;', ''
                  ), 
                  '<p >', ''
              ), 
              '<p>', ''
          ) AS amar_putusan,
      x.link_dirput,
      m.status_putusan_id,
      v.status_putusan_kode
FROM 
    v_pihak_perkara a
    JOIN pihak b ON b.id = a.pihak_id 
        AND b.telepon REGEXP '^[0-9]' 
        AND CHAR_LENGTH(b.telepon) > 8
    LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
    LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
    LEFT JOIN (
        SELECT 
            perkara_id, 
            MAX(tanggal_sidang) AS tanggal_sidang_terakhir,
            agenda,
            ruangan
        FROM 
            perkara_jadwal_sidang
        GROUP BY 
            perkara_id
    ) AS subq ON c.perkara_id = subq.perkara_id
    LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = subq.perkara_id
    LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
    LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
    JOIN perkara_putusan m ON m.perkara_id = c.perkara_id
    LEFT JOIN perkara_hakim_pn n ON n.perkara_id = c.perkara_id
    LEFT JOIN v_perkara v ON v.perkara_id = c.perkara_id
    LEFT JOIN dirput_dokumen x ON x.perkara_id = c.perkara_id
WHERE 
    a.pihak_ke = 1
    AND m.tanggal_putusan = CURDATE()
    AND c.alur_perkara_id IN (15, 16, 17)
    AND (
        (c.jenis_perkara_id = 346 
        AND f.status_putusan_id = 62 
        AND g.amar_ikrar_talak IS NULL 
        AND c.proses_terakhir_id < 296) 
        OR 
        (c.jenis_perkara_id <> 346 
        OR f.status_putusan_id <> 62 
        OR g.amar_ikrar_talak IS NOT NULL 
        OR c.proses_terakhir_id < 240)
    )`;

      let queryPutusanPihakT = `SELECT DISTINCT
      a.perkara_id, 
      a.pihak_id, 
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      a.nomor_perkara, 
      a.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      CASE
        WHEN n.jabatan_hakim_nama = 'Hakim Tunggal' THEN 'Hakim Tunggal'
        ELSE 'Majelis Hakim'
      END AS jabatan_hakim,
      DATE_FORMAT(m.tanggal_putusan, '%d-%m-%Y') AS tanggal_putusan,
      CASE DAYNAME(m.tanggal_putusan)
          WHEN 'Monday' THEN 'Senin'
          WHEN 'Tuesday' THEN 'Selasa'
          WHEN 'Wednesday' THEN 'Rabu'
          WHEN 'Thursday' THEN 'Kamis'
          WHEN 'Friday' THEN 'Jumat'
          WHEN 'Saturday' THEN 'Sabtu'
          WHEN 'Sunday' THEN 'Minggu'
          ELSE 'Unknown'
      END AS hari_putusan,
      CASE WHEN m.putusan_verstek = 'Y' THEN 'Verstek' ELSE 'Kontra' END AS putusan_verstek,
      REPLACE(
          REPLACE(
              REPLACE(
                  REPLACE(
                      REPLACE(
                          REPLACE(
                              REPLACE(
                                  REPLACE(
                                      REPLACE(
                                          REPLACE(
                                              REPLACE(
                                                  REPLACE(
                                                      REPLACE(
                                                          REPLACE(

                                                                  m.amar_putusan, '<p>', ''
                                                              ), 
                                                              '</p>', '\n'
                                                          ), 
                                                          '<ol>', ''
                                                      ), 
                                                      '</ol>', ''
                                                  ), 
                                                  '<li>', '- '
                                              ), 
                                              '<li >', '- '
                                          ), 
                                          '</li>', '\n'
                                      ), 
                                      '<strong>', ''
                                  ), 
                                  '</strong>', ''
                              ), 
                              '<em>', ''
                          ), 
                          '</em>', ''
                      ), 
                      '&#39;', ''
                  ), 
                  '<p >', ''
              ), 
              '<p>', ''
          ) AS amar_putusan,
      x.link_dirput,
      m.status_putusan_id,
      v.status_putusan_kode
FROM 
    v_pihak_perkara a
    JOIN pihak b ON b.id = a.pihak_id 
        AND b.telepon REGEXP '^[0-9]' 
        AND CHAR_LENGTH(b.telepon) > 8
    LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
    LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
    LEFT JOIN (
        SELECT 
            perkara_id, 
            MAX(tanggal_sidang) AS tanggal_sidang_terakhir,
            agenda,
            ruangan
        FROM 
            perkara_jadwal_sidang
        GROUP BY 
            perkara_id
    ) AS subq ON c.perkara_id = subq.perkara_id
    LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = subq.perkara_id
    LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
    LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
    JOIN perkara_putusan m ON m.perkara_id = c.perkara_id
    LEFT JOIN perkara_hakim_pn n ON n.perkara_id = c.perkara_id
    LEFT JOIN v_perkara v ON v.perkara_id = c.perkara_id
    LEFT JOIN dirput_dokumen x ON x.perkara_id = c.perkara_id
WHERE 
    a.pihak_ke = 2
    AND m.tanggal_putusan = CURDATE()
    AND c.alur_perkara_id IN (15, 16, 17)
    AND (
        (c.jenis_perkara_id = 346 
        AND f.status_putusan_id = 62 
        AND g.amar_ikrar_talak IS NULL 
        AND c.proses_terakhir_id < 296) 
        OR 
        (c.jenis_perkara_id <> 346 
        OR f.status_putusan_id <> 62 
        OR g.amar_ikrar_talak IS NOT NULL 
        OR c.proses_terakhir_id < 240)
    )`;
      
      let queryPutusanKuasaP = `SELECT DISTINCT
      c.perkara_id, 
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      c.nomor_perkara, 
      c.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      CASE
        WHEN n.jabatan_hakim_nama = 'Hakim Tunggal' THEN 'Hakim Tunggal'
        ELSE 'Majelis Hakim'
      END AS jabatan_hakim,
      DATE_FORMAT(m.tanggal_putusan, '%d-%m-%Y') AS tanggal_putusan,
      CASE DAYNAME(m.tanggal_putusan)
          WHEN 'Monday' THEN 'Senin'
          WHEN 'Tuesday' THEN 'Selasa'
          WHEN 'Wednesday' THEN 'Rabu'
          WHEN 'Thursday' THEN 'Kamis'
          WHEN 'Friday' THEN 'Jumat'
          WHEN 'Saturday' THEN 'Sabtu'
          WHEN 'Sunday' THEN 'Minggu'
          ELSE 'Unknown'
      END AS hari_putusan,
      CASE WHEN m.putusan_verstek = 'Y' THEN 'Verstek' ELSE 'Kontra' END AS putusan_verstek,
      REPLACE(
          REPLACE(
              REPLACE(
                  REPLACE(
                      REPLACE(
                          REPLACE(
                              REPLACE(
                                  REPLACE(
                                      REPLACE(
                                          REPLACE(
                                              REPLACE(
                                                  REPLACE(
                                                      REPLACE(
                                                          REPLACE(

                                                                  m.amar_putusan, '<p>', ''
                                                              ), 
                                                              '</p>', '\n'
                                                          ), 
                                                          '<ol>', ''
                                                      ), 
                                                      '</ol>', ''
                                                  ), 
                                                  '<li>', '- '
                                              ), 
                                              '<li >', '- '
                                          ), 
                                          '</li>', '\n'
                                      ), 
                                      '<strong>', ''
                                  ), 
                                  '</strong>', ''
                              ), 
                              '<em>', ''
                          ), 
                          '</em>', ''
                      ), 
                      '&#39;', ''
                  ), 
                  '<p >', ''
              ), 
              '<p>', ''
          ) AS amar_putusan,
      x.link_dirput,
      m.status_putusan_id,
      v.status_putusan_kode
  FROM 
      perkara_pengacara a
      JOIN pihak b ON b.id = a.pengacara_id 
                  AND b.telepon REGEXP '^[0-9]' 
                  AND CHAR_LENGTH(b.telepon) > 8
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
      LEFT JOIN (
          SELECT 
              perkara_id, 
              MAX(tanggal_sidang) AS tanggal_sidang_terakhir,
              agenda,
              ruangan
          FROM 
              perkara_jadwal_sidang
          GROUP BY 
              perkara_id
      ) AS subq ON c.perkara_id = subq.perkara_id
      LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = subq.perkara_id
      LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
      LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
      JOIN v_pihak_perkara h ON h.perkara_id = c.perkara_id
      JOIN perkara_putusan m ON m.perkara_id = c.perkara_id
      LEFT JOIN perkara_hakim_pn n ON n.perkara_id = c.perkara_id
      LEFT JOIN v_perkara v ON v.perkara_id = c.perkara_id
      LEFT JOIN dirput_dokumen x ON x.perkara_id = c.perkara_id
  WHERE 
      h.pihak_ke = 1
      AND m.tanggal_putusan = CURDATE()
      AND c.alur_perkara_id IN (15, 16, 17)
      AND (
          (c.jenis_perkara_id = 346 
          AND f.status_putusan_id = 62 
          AND g.amar_ikrar_talak IS NULL 
          AND c.proses_terakhir_id < 296) 
          OR 
          (c.jenis_perkara_id <> 346 
          OR f.status_putusan_id <> 62 
          OR g.amar_ikrar_talak IS NOT NULL 
          OR c.proses_terakhir_id < 240)
    )`;
      
      let queryPutusanKuasaT = `SELECT DISTINCT
      c.perkara_id, 
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      c.nomor_perkara, 
      c.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      CASE
        WHEN n.jabatan_hakim_nama = 'Hakim Tunggal' THEN 'Hakim Tunggal'
        ELSE 'Majelis Hakim'
      END AS jabatan_hakim,
      DATE_FORMAT(m.tanggal_putusan, '%d-%m-%Y') AS tanggal_putusan,
      CASE DAYNAME(m.tanggal_putusan)
          WHEN 'Monday' THEN 'Senin'
          WHEN 'Tuesday' THEN 'Selasa'
          WHEN 'Wednesday' THEN 'Rabu'
          WHEN 'Thursday' THEN 'Kamis'
          WHEN 'Friday' THEN 'Jumat'
          WHEN 'Saturday' THEN 'Sabtu'
          WHEN 'Sunday' THEN 'Minggu'
          ELSE 'Unknown'
      END AS hari_putusan,
      CASE WHEN m.putusan_verstek = 'Y' THEN 'Verstek' ELSE 'Kontra' END AS putusan_verstek,
      REPLACE(
          REPLACE(
              REPLACE(
                  REPLACE(
                      REPLACE(
                          REPLACE(
                              REPLACE(
                                  REPLACE(
                                      REPLACE(
                                          REPLACE(
                                              REPLACE(
                                                  REPLACE(
                                                      REPLACE(
                                                          REPLACE(

                                                                  m.amar_putusan, '<p>', ''
                                                              ), 
                                                              '</p>', '\n'
                                                          ), 
                                                          '<ol>', ''
                                                      ), 
                                                      '</ol>', ''
                                                  ), 
                                                  '<li>', '- '
                                              ), 
                                              '<li >', '- '
                                          ), 
                                          '</li>', '\n'
                                      ), 
                                      '<strong>', ''
                                  ), 
                                  '</strong>', ''
                              ), 
                              '<em>', ''
                          ), 
                          '</em>', ''
                      ), 
                      '&#39;', ''
                  ), 
                  '<p >', ''
              ), 
              '<p>', ''
          ) AS amar_putusan,
      x.link_dirput,
      m.status_putusan_id,
      v.status_putusan_kode
  FROM 
      perkara_pengacara a
      JOIN pihak b ON b.id = a.pengacara_id 
                  AND b.telepon REGEXP '^[0-9]' 
                  AND CHAR_LENGTH(b.telepon) > 8
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
      LEFT JOIN (
          SELECT 
              perkara_id, 
              MAX(tanggal_sidang) AS tanggal_sidang_terakhir,
              agenda,
              ruangan
          FROM 
              perkara_jadwal_sidang
          GROUP BY 
              perkara_id
      ) AS subq ON c.perkara_id = subq.perkara_id
      LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = subq.perkara_id
      LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
      LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
      JOIN v_pihak_perkara h ON h.perkara_id = c.perkara_id
      JOIN perkara_putusan m ON m.perkara_id = c.perkara_id
      LEFT JOIN perkara_hakim_pn n ON n.perkara_id = c.perkara_id
      LEFT JOIN v_perkara v ON v.perkara_id = c.perkara_id
      LEFT JOIN dirput_dokumen x ON x.perkara_id = c.perkara_id
  WHERE 
      h.pihak_ke = 2
      AND m.tanggal_putusan = CURDATE()
      AND c.alur_perkara_id IN (15, 16, 17)
      AND (
          (c.jenis_perkara_id = 346 
          AND f.status_putusan_id = 62 
          AND g.amar_ikrar_talak IS NULL 
          AND c.proses_terakhir_id < 296) 
          OR 
          (c.jenis_perkara_id <> 346 
          OR f.status_putusan_id <> 62 
          OR g.amar_ikrar_talak IS NOT NULL 
          OR c.proses_terakhir_id < 240)
    )`;

    let queryPutusanTurutT = `SELECT DISTINCT
      a.perkara_id, 
      a.pihak_id, 
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      a.nomor_perkara, 
      a.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      CASE
        WHEN n.jabatan_hakim_nama = 'Hakim Tunggal' THEN 'Hakim Tunggal'
        ELSE 'Majelis Hakim'
      END AS jabatan_hakim,
      DATE_FORMAT(m.tanggal_putusan, '%d-%m-%Y') AS tanggal_putusan,
      CASE DAYNAME(m.tanggal_putusan)
          WHEN 'Monday' THEN 'Senin'
          WHEN 'Tuesday' THEN 'Selasa'
          WHEN 'Wednesday' THEN 'Rabu'
          WHEN 'Thursday' THEN 'Kamis'
          WHEN 'Friday' THEN 'Jumat'
          WHEN 'Saturday' THEN 'Sabtu'
          WHEN 'Sunday' THEN 'Minggu'
          ELSE 'Unknown'
      END AS hari_putusan,
      CASE WHEN m.putusan_verstek = 'Y' THEN 'Verstek' ELSE 'Kontra' END AS putusan_verstek,
      REPLACE(
          REPLACE(
              REPLACE(
                  REPLACE(
                      REPLACE(
                          REPLACE(
                              REPLACE(
                                  REPLACE(
                                      REPLACE(
                                          REPLACE(
                                              REPLACE(
                                                  REPLACE(
                                                      REPLACE(
                                                          REPLACE(

                                                                  m.amar_putusan, '<p>', ''
                                                              ), 
                                                              '</p>', '\n'
                                                          ), 
                                                          '<ol>', ''
                                                      ), 
                                                      '</ol>', ''
                                                  ), 
                                                  '<li>', '- '
                                              ), 
                                              '<li >', '- '
                                          ), 
                                          '</li>', '\n'
                                      ), 
                                      '<strong>', ''
                                  ), 
                                  '</strong>', ''
                              ), 
                              '<em>', ''
                          ), 
                          '</em>', ''
                      ), 
                      '&#39;', ''
                  ), 
                  '<p >', ''
              ), 
              '<p>', ''
          ) AS amar_putusan,
      x.link_dirput,
      m.status_putusan_id,
      v.status_putusan_kode
FROM 
    v_pihak_perkara a
    JOIN pihak b ON b.id = a.pihak_id 
        AND b.telepon REGEXP '^[0-9]' 
        AND CHAR_LENGTH(b.telepon) > 8
    LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
    LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
    LEFT JOIN (
        SELECT 
            perkara_id, 
            MAX(tanggal_sidang) AS tanggal_sidang_terakhir,
            agenda,
            ruangan
        FROM 
            perkara_jadwal_sidang
        GROUP BY 
            perkara_id
    ) AS subq ON c.perkara_id = subq.perkara_id
    LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = subq.perkara_id
    LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
    LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
    JOIN perkara_putusan m ON m.perkara_id = c.perkara_id
    LEFT JOIN perkara_hakim_pn n ON n.perkara_id = c.perkara_id
    LEFT JOIN v_perkara v ON v.perkara_id = c.perkara_id
    LEFT JOIN dirput_dokumen x ON x.perkara_id = c.perkara_id
WHERE 
    a.pihak_ke = 4
    AND m.tanggal_putusan = CURDATE()
    AND c.alur_perkara_id IN (15, 16, 17)
    AND (
        (c.jenis_perkara_id = 346 
        AND f.status_putusan_id = 62 
        AND g.amar_ikrar_talak IS NULL 
        AND c.proses_terakhir_id < 296) 
        OR 
        (c.jenis_perkara_id <> 346 
        OR f.status_putusan_id <> 62 
        OR g.amar_ikrar_talak IS NOT NULL 
        OR c.proses_terakhir_id < 240)
    )`;

      let queryPutusanIntervensi = `SELECT DISTINCT
      a.perkara_id, 
      a.pihak_id, 
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      a.nomor_perkara, 
      a.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      CASE
        WHEN n.jabatan_hakim_nama = 'Hakim Tunggal' THEN 'Hakim Tunggal'
        ELSE 'Majelis Hakim'
      END AS jabatan_hakim,
      DATE_FORMAT(m.tanggal_putusan, '%d-%m-%Y') AS tanggal_putusan,
      CASE DAYNAME(m.tanggal_putusan)
          WHEN 'Monday' THEN 'Senin'
          WHEN 'Tuesday' THEN 'Selasa'
          WHEN 'Wednesday' THEN 'Rabu'
          WHEN 'Thursday' THEN 'Kamis'
          WHEN 'Friday' THEN 'Jumat'
          WHEN 'Saturday' THEN 'Sabtu'
          WHEN 'Sunday' THEN 'Minggu'
          ELSE 'Unknown'
      END AS hari_putusan,
      CASE WHEN m.putusan_verstek = 'Y' THEN 'Verstek' ELSE 'Kontra' END AS putusan_verstek,
      REPLACE(
          REPLACE(
              REPLACE(
                  REPLACE(
                      REPLACE(
                          REPLACE(
                              REPLACE(
                                  REPLACE(
                                      REPLACE(
                                          REPLACE(
                                              REPLACE(
                                                  REPLACE(
                                                      REPLACE(
                                                          REPLACE(

                                                                  m.amar_putusan, '<p>', ''
                                                              ), 
                                                              '</p>', '\n'
                                                          ), 
                                                          '<ol>', ''
                                                      ), 
                                                      '</ol>', ''
                                                  ), 
                                                  '<li>', '- '
                                              ), 
                                              '<li >', '- '
                                          ), 
                                          '</li>', '\n'
                                      ), 
                                      '<strong>', ''
                                  ), 
                                  '</strong>', ''
                              ), 
                              '<em>', ''
                          ), 
                          '</em>', ''
                      ), 
                      '&#39;', ''
                  ), 
                  '<p >', ''
              ), 
              '<p>', ''
          ) AS amar_putusan,
      x.link_dirput,
      m.status_putusan_id,
      v.status_putusan_kode
FROM 
    v_pihak_perkara a
    JOIN pihak b ON b.id = a.pihak_id 
        AND b.telepon REGEXP '^[0-9]' 
        AND CHAR_LENGTH(b.telepon) > 8
    LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
    LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
    LEFT JOIN (
        SELECT 
            perkara_id, 
            MAX(tanggal_sidang) AS tanggal_sidang_terakhir,
            agenda,
            ruangan
        FROM 
            perkara_jadwal_sidang
        GROUP BY 
            perkara_id
    ) AS subq ON c.perkara_id = subq.perkara_id
    LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = subq.perkara_id
    LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
    LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
    JOIN perkara_putusan m ON m.perkara_id = c.perkara_id
    LEFT JOIN perkara_hakim_pn n ON n.perkara_id = c.perkara_id
    LEFT JOIN v_perkara v ON v.perkara_id = c.perkara_id
    LEFT JOIN dirput_dokumen x ON x.perkara_id = c.perkara_id
WHERE 
    a.pihak_ke = 3
    AND m.tanggal_putusan = CURDATE()
    AND c.alur_perkara_id IN (15, 16, 17)
    AND (
        (c.jenis_perkara_id = 346 
        AND f.status_putusan_id = 62 
        AND g.amar_ikrar_talak IS NULL 
        AND c.proses_terakhir_id < 296) 
        OR 
        (c.jenis_perkara_id <> 346 
        OR f.status_putusan_id <> 62 
        OR g.amar_ikrar_talak IS NOT NULL 
        OR c.proses_terakhir_id < 240)
    )`;

      // Query untuk pihak P
      db.query(queryPutusanPihakP, (errPutusanP, resultPutusanP) => {
          if (errPutusanP) {
              reject(errPutusanP);
          } else {
              // Query untuk pihak T
              db.query(queryPutusanPihakT, (errPutusanT, resultPutusanT) => {
                  if (errPutusanT) {
                      reject(errPutusanT);
                  } else {
                      // Query untuk kuasa P
                      db.query(queryPutusanKuasaP, (errPutusanKuasaP, resultPutusanKuasaP) => {
                          if (errPutusanKuasaP) {
                              reject(errPutusanKuasaP);
                          } else {
                              // Query untuk kuasa T
                              db.query(queryPutusanKuasaT, (errPutusanKuasaT, resultPutusanKuasaT) => {
                                  if (errPutusanKuasaT) {
                                      reject(errPutusanKuasaT);
                                  } else {
                                      // Tambahkan query untuk turut T
                                      db.query(queryPutusanTurutT, (errTurutT, resultPutusanTurutT) => {
                                          if (errTurutT) {
                                              reject(errTurutT);
                                          } else {
                                              // Tambahkan query untuk intervensi
                                              db.query(queryPutusanIntervensi, (errIntervensi, resultIntervensi) => {
                                                  if (errIntervensi) {
                                                      reject(errIntervensi);
                                                  } else {
                                                      resolve({ 
                                                          pihakP: resultPutusanP, 
                                                          pihakT: resultPutusanT, 
                                                          kuasaP: resultPutusanKuasaP, 
                                                          kuasaT: resultPutusanKuasaT,
                                                          turutT: resultPutusanTurutT,
                                                          intervensi: resultIntervensi
                                                      });
                                                  }
                                              });
                                          }
                                      });
                                  }
                              });
                          }
                      });
                  }
              });
          }
      });
  });
};

const getDataPihakAktaCerai = () => {
  return new Promise((resolve, reject) => {
      let queryPihakP = `SELECT DISTINCT
      a.perkara_id, 
      a.pihak_id, 
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      a.nomor_perkara, 
      a.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      (CASE 
          WHEN c.proses_terakhir_id = 81 THEN c.tanggal_pendaftaran 
          ELSE d.tgl_akta_cerai 
      END) AS tanggal,
      d.no_seri_akta_cerai,
      DATE_FORMAT(d.tgl_akta_cerai, '%d-%m-%Y') AS tanggal_akta_cerai
FROM 
      v_pihak_perkara a
      JOIN pihak b ON b.id = a.pihak_id 
                  AND b.telepon REGEXP '^[0-9]' 
                  AND CHAR_LENGTH(b.telepon) > 8
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
      LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = c.perkara_id
WHERE 
      c.proses_terakhir_id = 296
      AND a.pihak_ke = 1
      AND d.tgl_penyerahan_akta_cerai IS NULL
      AND d.tgl_akta_cerai = CURDATE();`;

      let queryPihakT = `SELECT DISTINCT
      a.perkara_id, 
      a.pihak_id, 
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      a.nomor_perkara, 
      a.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      (CASE 
          WHEN c.proses_terakhir_id = 81 THEN c.tanggal_pendaftaran 
          ELSE d.tgl_akta_cerai 
      END) AS tanggal,
      d.no_seri_akta_cerai,
      DATE_FORMAT(d.tgl_akta_cerai, '%d-%m-%Y') AS tanggal_akta_cerai
  FROM 
      v_pihak_perkara a
      JOIN pihak b ON b.id = a.pihak_id 
                  AND b.telepon REGEXP '^[0-9]' 
                  AND CHAR_LENGTH(b.telepon) > 8
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
      LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = c.perkara_id
  WHERE 
      c.proses_terakhir_id = 296
      AND a.pihak_ke = 2
      AND d.tgl_penyerahan_akta_cerai_pihak2 IS NULL
      AND d.tgl_akta_cerai = CURDATE();`;

      // Query untuk pihak P
      db.query(queryPihakP, (errP, resultP) => {
          if (errP) {
              reject(errP);
          } else {
              // Query untuk pihak T
              db.query(queryPihakT, (errT, resultT) => {
                  if (errT) {
                      reject(errT);
                  } else {
                      resolve({ pihakP: resultP, pihakT: resultT });
                  }
              });
          }
      });
  });
};

const getDataPihakSisaPanjar = () => {
  return new Promise((resolve, reject) => {
      let sisaPanjarPertama = `SELECT DISTINCT
      a.nomor_perkara, 
      b.tanggal_putusan, 
      v.sisa, 
      x.telepon, 
      y.nama, 
      a.jenis_perkara_nama, 
      REPLACE(a.para_pihak, '<br />', '\n') AS para_pihak, 
      a.nomor_urut_perkara, 
      pp.tahun_pendaftaran, 
      CASE 
          WHEN a.alur_perkara_id = 8 THEN 'GS'
          WHEN a.alur_perkara_id = 15 THEN 'G'
          WHEN a.alur_perkara_id = 16 THEN 'P'
          WHEN a.alur_perkara_id = 125 THEN 'JN'
          ELSE NULL
      END AS alur_status
  FROM perkara_biaya AS v
  LEFT JOIN perkara AS a ON v.perkara_id = a.perkara_id 
  LEFT JOIN perkara_putusan AS b ON v.perkara_id = b.perkara_id 
  LEFT JOIN perkara_ikrar_talak AS c ON a.perkara_id = c.perkara_id
  JOIN v_pihak_perkara AS y ON a.perkara_id = y.perkara_id
  JOIN v_perkara AS pp ON a.perkara_id = pp.perkara_id
  JOIN pihak AS x ON y.pihak_id = x.id
      AND x.telepon REGEXP '^[0-9]'
      AND CHAR_LENGTH(x.telepon) > 8
  WHERE 
      (
        (a.jenis_perkara_id = 346 AND a.tahapan_terakhir_id = 19 AND c.amar_ikrar_talak IS NOT NULL)  
        OR (a.jenis_perkara_id != 346 AND a.tahapan_terakhir_id = 15)
      ) 
      AND (
        CASE 
            WHEN a.jenis_perkara_id = 346 AND b.status_putusan_id = 62 AND c.amar_ikrar_talak IS NULL THEN c.tgl_ikrar_talak 
            ELSE b.tanggal_putusan 
        END = CURDATE()
      )
      AND a.alur_perkara_id IN (15, 16, 17) 
      AND y.pihak_ke = 1
      AND v.sisa > 0;`;

      let sisaPanjarBanding = `SELECT 
      vpb.nomor_perkara, 
      pb.putusan_banding,
      vpb.sisa, 
      p.telepon, 
      vpp.nama,
      perk.jenis_perkara_nama,
      perk.nomor_urut_perkara, 
      pp.tahun_pendaftaran, 
      CASE 
          WHEN perk.alur_perkara_id = 15 THEN 'G'
          WHEN perk.alur_perkara_id = 16 THEN 'P'
          ELSE NULL
      END AS alur_status,
      REPLACE(perk.para_pihak, '<br />', '\n') AS para_pihak
  FROM 
      v_perkara_biaya_banding vpb
  LEFT JOIN 
      perkara_banding pb ON vpb.perkara_id = pb.perkara_id
  LEFT JOIN 
      v_pihak_perkara vpp ON vpb.perkara_id = vpp.perkara_id
  LEFT JOIN 
      perkara perk ON vpb.perkara_id = perk.perkara_id
  JOIN 
      v_perkara AS pp ON vpb.perkara_id = pp.perkara_id
  JOIN 
      pihak p ON vpp.pihak_id = p.id 
            AND p.telepon REGEXP '^[0-9]' 
            AND CHAR_LENGTH(p.telepon) > 8
  WHERE 
      vpb.proses_terakhir_id = 400 
      AND (vpb.alur_perkara_id = 15 OR vpb.alur_perkara_id = 16 OR vpb.alur_perkara_id = 17) 
      AND vpb.sisa > 0
      AND vpp.pihak_ke = 1
      AND pb.putusan_banding = CURDATE();`;

      let sisaPanjarKasasi = `SELECT 
      vpbk.nomor_perkara, 
      pk.putusan_kasasi, 
      vpbk.sisa,
      p.telepon, 
      vpp.nama,
      perk.jenis_perkara_nama,
      perk.nomor_urut_perkara, 
      pp.tahun_pendaftaran, 
      CASE 
          WHEN perk.alur_perkara_id = 15 THEN 'G'
          WHEN perk.alur_perkara_id = 16 THEN 'P'
          ELSE NULL
      END AS alur_status,
      REPLACE(perk.para_pihak, '<br />', '\n') AS para_pihak
  FROM 
      v_perkara_biaya_kasasi vpbk
  LEFT JOIN 
      perkara_kasasi pk ON vpbk.perkara_id = pk.perkara_id
  JOIN 
      v_pihak_perkara vpp ON vpbk.perkara_id = vpp.perkara_id
  JOIN 
      perkara perk ON vpbk.perkara_id = perk.perkara_id
  JOIN 
      v_perkara AS pp ON vpbk.perkara_id = pp.perkara_id
  JOIN 
      pihak p ON vpp.pihak_id = p.id 
              AND p.telepon REGEXP '^[0-9]' 
              AND CHAR_LENGTH(p.telepon) > 8
  WHERE 
      vpbk.proses_terakhir_id = 500 
      AND (vpbk.alur_perkara_id IN (15, 16, 17))
      AND vpbk.sisa > 0
      AND vpp.pihak_ke = 1
      AND pk.putusan_kasasi = CURDATE();`;

      let sisaPanjarPk = `SELECT 
      vpbk.nomor_perkara, 
      pk.putusan_pk, 
      vpbk.sisa,
      p.telepon, 
      vpp.nama,
      perk.jenis_perkara_nama,
      perk.nomor_urut_perkara, 
      pp.tahun_pendaftaran, 
      CASE 
          WHEN perk.alur_perkara_id = 15 THEN 'G'
          WHEN perk.alur_perkara_id = 16 THEN 'P'
          ELSE NULL
      END AS alur_status,
      REPLACE(perk.para_pihak, '<br />', '\n') AS para_pihak
  FROM 
      v_perkara_biaya_pk vpbk
  LEFT JOIN 
      perkara_pk pk ON vpbk.perkara_id = pk.perkara_id
  JOIN 
      v_pihak_perkara vpp ON vpbk.perkara_id = vpp.perkara_id
  JOIN 
      perkara perk ON vpbk.perkara_id = perk.perkara_id
  JOIN 
      v_perkara AS pp ON vpbk.perkara_id = pp.perkara_id
  JOIN 
      pihak p ON vpp.pihak_id = p.id 
              AND p.telepon REGEXP '^[0-9]' 
              AND CHAR_LENGTH(p.telepon) > 8
  WHERE 
      vpbk.proses_terakhir_id = 500 
      AND (vpbk.alur_perkara_id IN (15, 16, 17))
      AND vpbk.sisa > 0
      AND vpp.pihak_ke = 1
      AND pk.putusan_pk = CURDATE();`;

      let sisaPanjarEksekusi = `SELECT 
      vpbk.nomor_perkara, 
      vpbk.sisa,
      p.telepon, 
      vpp.nama,
      perk.jenis_perkara_nama,
      perk.nomor_urut_perkara, 
      pp.tahun_pendaftaran, 
      CASE 
          WHEN perk.alur_perkara_id = 15 THEN 'G'
          WHEN perk.alur_perkara_id = 16 THEN 'P'
          ELSE NULL
      END AS alur_status,
      REPLACE(perk.para_pihak, '<br />', '\n') AS para_pihak
  FROM 
      v_perkara_biaya_eksekusi vpbk
  LEFT JOIN 
      perkara_eksekusi pk ON vpbk.perkara_id = pk.perkara_id
  JOIN 
      v_pihak_perkara vpp ON vpbk.perkara_id = vpp.perkara_id
  JOIN 
      perkara perk ON vpbk.perkara_id = perk.perkara_id
  JOIN 
      v_perkara AS pp ON vpbk.perkara_id = pp.perkara_id
  JOIN 
      pihak p ON vpp.pihak_id = p.id 
              AND p.telepon REGEXP '^[0-9]' 
              AND CHAR_LENGTH(p.telepon) > 8
  WHERE 
      vpbk.proses_terakhir_id = 500 
      AND vpbk.alur_perkara_id IN (15, 16, 17)
      AND vpbk.sisa > 0
      AND vpp.pihak_ke = 1
      AND (pk.pelaksanaan_eksekusi_rill IS NOT NULL 
          OR pk.tanggal_cabut_eks = CURDATE());`;

      // Query untuk sisa panjar pertama
      db.query(sisaPanjarPertama, (errSisaPertama, resultSisaPertama) => {
          if (errSisaPertama) {
              reject(errSisaPertama);
          } else {
              // Query untuk sisa panjar banding
              db.query(sisaPanjarBanding, (errSisaBanding, resultSisaBanding) => {
                  if (errSisaBanding) {
                      reject(errSisaBanding);
                  } else {
                      // Query untuk sisa panjar kasasi
                      db.query(sisaPanjarKasasi, (errSisaKasasi, resultSisaKasasi) => {
                          if (errSisaKasasi) {
                              reject(errSisaKasasi);
                          } else {
                              // Query untuk sisa panjar PK
                              db.query(sisaPanjarPk, (errSisaPk, resultSisaPk) => {
                                  if (errSisaPk) {
                                      reject(errSisaPk);
                                  } else {
                                      // Query untuk sisa panjar eksekusi
                                      db.query(sisaPanjarEksekusi, (errSisaEksekusi, resultSisaEksekusi) => {
                                          if (errSisaEksekusi) {
                                              reject(errSisaEksekusi);
                                          } else {
                                              resolve({ 
                                                  sisaPertama: resultSisaPertama, 
                                                  sisaBanding: resultSisaBanding, 
                                                  sisaKasasi: resultSisaKasasi, 
                                                  sisaPk: resultSisaPk, 
                                                  sisaEksekusi: resultSisaEksekusi 
                                              });
                                          }
                                      });
                                  }
                              });
                          }
                      });
                  }
              });
          }
      });
  });
};

const getDataHabisBiaya = () => {
  return new Promise((resolve, reject) => {
      let querySisa = `SELECT DISTINCT
    a.perkara_id, 
    a.pihak_id,
    c.nomor_urut_perkara,
    CASE 
        WHEN c.alur_perkara_id = 15 THEN 'G'
        WHEN c.alur_perkara_id = 16 THEN 'P'
        ELSE NULL
    END AS alur_status,
    g.tahun_pendaftaran,
    c.proses_terakhir_id,
    CASE
        WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
        ELSE ''
    END AS ecourt,
    a.nama, 
    b.telepon, 
    a.nomor_perkara, 
    a.jenis_perkara_nama,
    REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
		e.tanggal_sidang,
    f.sisa
  FROM 
      v_pihak_perkara a
      JOIN pihak b ON b.id = a.pihak_id 
          AND b.telepon REGEXP '^[0-9]' 
          AND CHAR_LENGTH(b.telepon) > 8
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
      LEFT JOIN (
            SELECT 
                perkara_id, 
                MAX(tanggal_sidang) AS tanggal_sidang_terakhir,
                agenda,
                ruangan
            FROM 
                perkara_jadwal_sidang
            GROUP BY 
                perkara_id
        ) AS subq ON c.perkara_id = subq.perkara_id
      LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = subq.perkara_id
      LEFT JOIN v_perkara_biaya f ON f.perkara_id = a.perkara_id
      LEFT JOIN v_perkara g ON g.perkara_id = a.perkara_id
      LEFT JOIN perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
      LEFT JOIN perkara_putusan AS h ON a.perkara_id = d.perkara_id
      LEFT JOIN perkara_ikrar_talak AS o ON a.perkara_id = o.perkara_id
      LEFT JOIN perkara_verzet AS v ON a.perkara_id = v.perkara_id
  WHERE 
      e.tanggal_sidang = DATE_ADD(CURDATE(), INTERVAL 3 DAY)
      AND (
          CASE 
              WHEN c.jenis_perkara_id = 346 AND h.status_putusan_id = 62 AND o.amar_ikrar_talak IS NULL THEN c.proses_terakhir_id < 290
              WHEN v.perkara_id IS NOT NULL AND v.putusan_verzet IS NOT NULL THEN c.proses_terakhir_id < 270
              ELSE c.proses_terakhir_id < 210
          END
      )
      AND (
          (k.perkara_id IS NOT NULL AND f.sisa < 20000) 
          OR (k.perkara_id IS NULL AND f.sisa < 100001)
      )
      AND a.pihak_ke = 1
      AND c.prodeo = 0
      AND (c.jenis_perkara_id != 346 OR v.putusan_verzet IS NULL);`;

      db.query(querySisa, (errSisa, resultSisa) => {
          if (errSisa) {
              reject(errSisa);
          } else {
              // Hanya mengembalikan hasil dari pihak P
              resolve({ sisaPanjar: resultSisa });
          }
      });
  });
};

const getDataPihakTundaCuti = () => {
  return new Promise((resolve, reject) => {
      let querySidangPihakP = `SELECT DISTINCT
      a.perkara_id, 
      a.pihak_id, 
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      a.nomor_perkara, 
      a.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
      CASE DAYNAME(e.tanggal_sidang)
        WHEN 'Monday' THEN 'Senin'
        WHEN 'Tuesday' THEN 'Selasa'
        WHEN 'Wednesday' THEN 'Rabu'
        WHEN 'Thursday' THEN 'Kamis'
        WHEN 'Friday' THEN 'Jumat'
        WHEN 'Saturday' THEN 'Sabtu'
        WHEN 'Sunday' THEN 'Minggu'
        ELSE 'Unknown'
      END AS hari_sidang,
      e.agenda,
      e.ruangan,
      DATE_FORMAT(DATE_ADD(e.tanggal_sidang, INTERVAL 1 DAY), '%d-%m-%Y') AS tanggal_sidang_cuti,
      CASE DAYNAME(DATE_ADD(e.tanggal_sidang, INTERVAL 1 DAY))
        WHEN 'Monday' THEN 'Senin'
        WHEN 'Tuesday' THEN 'Selasa'
        WHEN 'Wednesday' THEN 'Rabu'
        WHEN 'Thursday' THEN 'Kamis'
        WHEN 'Friday' THEN 'Jumat'
        WHEN 'Saturday' THEN 'Sabtu'
        WHEN 'Sunday' THEN 'Minggu'
        ELSE 'Unknown'
      END AS hari_cuti
  FROM 
      v_pihak_perkara a
      JOIN pihak b ON b.id = a.pihak_id 
                  AND b.telepon REGEXP '^[0-9]' 
                  AND CHAR_LENGTH(b.telepon) > 8
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
      LEFT JOIN (
          SELECT 
              perkara_id, 
              MAX(tanggal_sidang) AS tanggal_sidang_terakhir,
              agenda,
              ruangan
          FROM 
              perkara_jadwal_sidang
          GROUP BY 
              perkara_id
      ) AS subq ON c.perkara_id = subq.perkara_id
      LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = subq.perkara_id
      LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
      LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
  WHERE 
      a.pihak_ke = 1
      AND e.tanggal_sidang = '2024-11-27'
      AND c.alur_perkara_id IN (15, 16, 17)
      AND (
          CASE 
              WHEN c.jenis_perkara_id = 346 AND f.status_putusan_id = 62 AND g.amar_ikrar_talak IS NULL THEN c.proses_terakhir_id < 296 
              ELSE c.proses_terakhir_id < 218 
          END
      )`;

      let querySidangPihakT = `SELECT DISTINCT
      a.perkara_id, 
      a.pihak_id, 
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      a.nomor_perkara, 
      a.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
      CASE DAYNAME(e.tanggal_sidang)
        WHEN 'Monday' THEN 'Senin'
        WHEN 'Tuesday' THEN 'Selasa'
        WHEN 'Wednesday' THEN 'Rabu'
        WHEN 'Thursday' THEN 'Kamis'
        WHEN 'Friday' THEN 'Jumat'
        WHEN 'Saturday' THEN 'Sabtu'
        WHEN 'Sunday' THEN 'Minggu'
        ELSE 'Unknown'
      END AS hari_sidang,
      e.agenda,
      e.ruangan,
      DATE_FORMAT(DATE_ADD(e.tanggal_sidang, INTERVAL 1 DAY), '%d-%m-%Y') AS tanggal_sidang_cuti,
      CASE DAYNAME(DATE_ADD(e.tanggal_sidang, INTERVAL 1 DAY))
        WHEN 'Monday' THEN 'Senin'
        WHEN 'Tuesday' THEN 'Selasa'
        WHEN 'Wednesday' THEN 'Rabu'
        WHEN 'Thursday' THEN 'Kamis'
        WHEN 'Friday' THEN 'Jumat'
        WHEN 'Saturday' THEN 'Sabtu'
        WHEN 'Sunday' THEN 'Minggu'
        ELSE 'Unknown'
      END AS hari_cuti
  FROM 
      v_pihak_perkara a
      JOIN pihak b ON b.id = a.pihak_id 
                  AND b.telepon REGEXP '^[0-9]' 
                  AND CHAR_LENGTH(b.telepon) > 8
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
      LEFT JOIN (
          SELECT 
              perkara_id, 
              MAX(tanggal_sidang) AS tanggal_sidang_terakhir,
              agenda,
              ruangan
          FROM 
              perkara_jadwal_sidang
          GROUP BY 
              perkara_id
      ) AS subq ON c.perkara_id = subq.perkara_id
      LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = subq.perkara_id
      LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
      LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
  WHERE 
      a.pihak_ke = 2
      AND e.tanggal_sidang = '2024-11-27'
      AND c.alur_perkara_id IN (15, 16, 17)
      AND (
          CASE 
              WHEN c.jenis_perkara_id = 346 AND f.status_putusan_id = 62 AND g.amar_ikrar_talak IS NULL THEN c.proses_terakhir_id < 296 
              ELSE c.proses_terakhir_id < 218 
          END
      )`;
      
      let querySidangKuasaP = `SELECT DISTINCT
      c.perkara_id, 
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      c.nomor_perkara, 
      c.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
      CASE DAYNAME(e.tanggal_sidang)
        WHEN 'Monday' THEN 'Senin'
        WHEN 'Tuesday' THEN 'Selasa'
        WHEN 'Wednesday' THEN 'Rabu'
        WHEN 'Thursday' THEN 'Kamis'
        WHEN 'Friday' THEN 'Jumat'
        WHEN 'Saturday' THEN 'Sabtu'
        WHEN 'Sunday' THEN 'Minggu'
        ELSE 'Unknown'
      END AS hari_sidang,
      e.agenda,
      e.ruangan,
      DATE_FORMAT(DATE_ADD(e.tanggal_sidang, INTERVAL 1 DAY), '%d-%m-%Y') AS tanggal_sidang_cuti,
      CASE DAYNAME(DATE_ADD(e.tanggal_sidang, INTERVAL 1 DAY))
        WHEN 'Monday' THEN 'Senin'
        WHEN 'Tuesday' THEN 'Selasa'
        WHEN 'Wednesday' THEN 'Rabu'
        WHEN 'Thursday' THEN 'Kamis'
        WHEN 'Friday' THEN 'Jumat'
        WHEN 'Saturday' THEN 'Sabtu'
        WHEN 'Sunday' THEN 'Minggu'
        ELSE 'Unknown'
      END AS hari_cuti
  FROM 
      perkara_pengacara a
      JOIN pihak b ON b.id = a.pengacara_id 
                  AND b.telepon REGEXP '^[0-9]' 
                  AND CHAR_LENGTH(b.telepon) > 8
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
      LEFT JOIN (
          SELECT 
              perkara_id, 
              MAX(tanggal_sidang) AS tanggal_sidang_terakhir,
              agenda,
              ruangan
          FROM 
              perkara_jadwal_sidang
          GROUP BY 
              perkara_id
      ) AS subq ON c.perkara_id = subq.perkara_id
      LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = subq.perkara_id
      LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
      LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
      JOIN v_pihak_perkara h ON h.perkara_id = c.perkara_id
  WHERE 
      h.pihak_ke = 1
      AND e.tanggal_sidang = '2024-11-27'
      AND c.alur_perkara_id IN (15, 16, 17)
      AND (
          CASE 
              WHEN c.jenis_perkara_id = 346 AND f.status_putusan_id = 62 AND g.amar_ikrar_talak IS NULL THEN c.proses_terakhir_id < 296 
              ELSE c.proses_terakhir_id < 218 
          END
      )`;
      
      let querySidangKuasaT = `SELECT DISTINCT
      c.perkara_id, 
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      c.nomor_perkara, 
      c.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
      CASE DAYNAME(e.tanggal_sidang)
        WHEN 'Monday' THEN 'Senin'
        WHEN 'Tuesday' THEN 'Selasa'
        WHEN 'Wednesday' THEN 'Rabu'
        WHEN 'Thursday' THEN 'Kamis'
        WHEN 'Friday' THEN 'Jumat'
        WHEN 'Saturday' THEN 'Sabtu'
        WHEN 'Sunday' THEN 'Minggu'
        ELSE 'Unknown'
      END AS hari_sidang,
      e.agenda,
      e.ruangan,
      DATE_FORMAT(DATE_ADD(e.tanggal_sidang, INTERVAL 1 DAY), '%d-%m-%Y') AS tanggal_sidang_cuti,
      CASE DAYNAME(DATE_ADD(e.tanggal_sidang, INTERVAL 1 DAY))
        WHEN 'Monday' THEN 'Senin'
        WHEN 'Tuesday' THEN 'Selasa'
        WHEN 'Wednesday' THEN 'Rabu'
        WHEN 'Thursday' THEN 'Kamis'
        WHEN 'Friday' THEN 'Jumat'
        WHEN 'Saturday' THEN 'Sabtu'
        WHEN 'Sunday' THEN 'Minggu'
        ELSE 'Unknown'
      END AS hari_cuti
  FROM 
      perkara_pengacara a
      JOIN pihak b ON b.id = a.pengacara_id 
                  AND b.telepon REGEXP '^[0-9]' 
                  AND CHAR_LENGTH(b.telepon) > 8
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
      LEFT JOIN (
          SELECT 
              perkara_id, 
              MAX(tanggal_sidang) AS tanggal_sidang_terakhir,
              agenda,
              ruangan
          FROM 
              perkara_jadwal_sidang
          GROUP BY 
              perkara_id
      ) AS subq ON c.perkara_id = subq.perkara_id
      LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = subq.perkara_id
      LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
      LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
      JOIN v_pihak_perkara h ON h.perkara_id = c.perkara_id
  WHERE 
      h.pihak_ke = 2
      AND e.tanggal_sidang = '2024-11-27'
      AND c.alur_perkara_id IN (15, 16, 17)
      AND (
          CASE 
              WHEN c.jenis_perkara_id = 346 AND f.status_putusan_id = 62 AND g.amar_ikrar_talak IS NULL THEN c.proses_terakhir_id < 296 
              ELSE c.proses_terakhir_id < 218 
          END
      )`;

      let querySidangTurutT = `SELECT DISTINCT
      a.perkara_id, 
      a.pihak_id, 
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      a.nomor_perkara, 
      a.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
      CASE DAYNAME(e.tanggal_sidang)
        WHEN 'Monday' THEN 'Senin'
        WHEN 'Tuesday' THEN 'Selasa'
        WHEN 'Wednesday' THEN 'Rabu'
        WHEN 'Thursday' THEN 'Kamis'
        WHEN 'Friday' THEN 'Jumat'
        WHEN 'Saturday' THEN 'Sabtu'
        WHEN 'Sunday' THEN 'Minggu'
        ELSE 'Unknown'
      END AS hari_sidang,
      e.agenda,
      e.ruangan,
      DATE_FORMAT(DATE_ADD(e.tanggal_sidang, INTERVAL 1 DAY), '%d-%m-%Y') AS tanggal_sidang_cuti,
      CASE DAYNAME(DATE_ADD(e.tanggal_sidang, INTERVAL 1 DAY))
        WHEN 'Monday' THEN 'Senin'
        WHEN 'Tuesday' THEN 'Selasa'
        WHEN 'Wednesday' THEN 'Rabu'
        WHEN 'Thursday' THEN 'Kamis'
        WHEN 'Friday' THEN 'Jumat'
        WHEN 'Saturday' THEN 'Sabtu'
        WHEN 'Sunday' THEN 'Minggu'
        ELSE 'Unknown'
      END AS hari_cuti
  FROM 
      v_pihak_perkara a
      JOIN pihak b ON b.id = a.pihak_id 
                  AND b.telepon REGEXP '^[0-9]' 
                  AND CHAR_LENGTH(b.telepon) > 8
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
      LEFT JOIN (
          SELECT 
              perkara_id, 
              MAX(tanggal_sidang) AS tanggal_sidang_terakhir,
              agenda,
              ruangan
          FROM 
              perkara_jadwal_sidang
          GROUP BY 
              perkara_id
      ) AS subq ON c.perkara_id = subq.perkara_id
      LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = subq.perkara_id
      LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
      LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
  WHERE 
      a.pihak_ke = 4
      AND e.tanggal_sidang = '2024-11-27'
      AND c.alur_perkara_id IN (15, 16, 17)
      AND (
          CASE 
              WHEN c.jenis_perkara_id = 346 AND f.status_putusan_id = 62 AND g.amar_ikrar_talak IS NULL THEN c.proses_terakhir_id < 296 
              ELSE c.proses_terakhir_id < 218 
          END
      )`;

      let querySidangIntervensi = `SELECT DISTINCT
      a.perkara_id, 
      a.pihak_id, 
      c.proses_terakhir_id, 
      a.nama, 
      b.telepon, 
      a.nomor_perkara, 
      a.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
      CASE DAYNAME(e.tanggal_sidang)
        WHEN 'Monday' THEN 'Senin'
        WHEN 'Tuesday' THEN 'Selasa'
        WHEN 'Wednesday' THEN 'Rabu'
        WHEN 'Thursday' THEN 'Kamis'
        WHEN 'Friday' THEN 'Jumat'
        WHEN 'Saturday' THEN 'Sabtu'
        WHEN 'Sunday' THEN 'Minggu'
        ELSE 'Unknown'
      END AS hari_sidang,
      e.agenda,
      e.ruangan,
      DATE_FORMAT(DATE_ADD(e.tanggal_sidang, INTERVAL 1 DAY), '%d-%m-%Y') AS tanggal_sidang_cuti,
      CASE DAYNAME(DATE_ADD(e.tanggal_sidang, INTERVAL 1 DAY))
        WHEN 'Monday' THEN 'Senin'
        WHEN 'Tuesday' THEN 'Selasa'
        WHEN 'Wednesday' THEN 'Rabu'
        WHEN 'Thursday' THEN 'Kamis'
        WHEN 'Friday' THEN 'Jumat'
        WHEN 'Saturday' THEN 'Sabtu'
        WHEN 'Sunday' THEN 'Minggu'
        ELSE 'Unknown'
      END AS hari_cuti
  FROM 
      v_pihak_perkara a
      JOIN pihak b ON b.id = a.pihak_id 
                  AND b.telepon REGEXP '^[0-9]' 
                  AND CHAR_LENGTH(b.telepon) > 8
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
      LEFT JOIN (
          SELECT 
              perkara_id, 
              MAX(tanggal_sidang) AS tanggal_sidang_terakhir,
              agenda,
              ruangan
          FROM 
              perkara_jadwal_sidang
          GROUP BY 
              perkara_id
      ) AS subq ON c.perkara_id = subq.perkara_id
      LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = subq.perkara_id
      LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
      LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
  WHERE 
      a.pihak_ke = 3
      AND e.tanggal_sidang = '2024-11-27'
      AND c.alur_perkara_id IN (15, 16, 17)
      AND (
          CASE 
              WHEN c.jenis_perkara_id = 346 AND f.status_putusan_id = 62 AND g.amar_ikrar_talak IS NULL THEN c.proses_terakhir_id < 296 
              ELSE c.proses_terakhir_id < 218 
          END
      )`;

      // Query untuk pihak P
      db.query(querySidangPihakP, (errSidangP, resultSidangP) => {
        if (errSidangP) {
            reject(errSidangP);
        } else {
            // Query untuk pihak T
            db.query(querySidangPihakT, (errSidangT, resultSidangT) => {
                if (errSidangT) {
                    reject(errSidangT);
                } else {
                    // Query untuk kuasa P
                    db.query(querySidangKuasaP, (errSidangKuasaP, resultSidangKuasaP) => {
                        if (errSidangKuasaP) {
                            reject(errSidangKuasaP);
                        } else {
                            // Query untuk kuasa T
                            db.query(querySidangKuasaT, (errSidangKuasaT, resultSidangKuasaT) => {
                                if (errSidangKuasaT) {
                                    reject(errSidangKuasaT);
                                } else {
                                    // Query untuk turut T
                                    db.query(querySidangTurutT, (errTurutT, resultSidangTurutT) => {
                                        if (errTurutT) {
                                            reject(errTurutT);
                                        } else {
                                            // Query untuk intervensi
                                            db.query(querySidangIntervensi, (errIntervensi, resultIntervensi) => {
                                                if (errIntervensi) {
                                                    reject(errIntervensi);
                                                } else {
                                                    resolve({ 
                                                        pihakP: resultSidangP, 
                                                        pihakT: resultSidangT, 
                                                        kuasaP: resultSidangKuasaP, 
                                                        kuasaT: resultSidangKuasaT,
                                                        turutT: resultSidangTurutT,
                                                        intervensi: resultIntervensi
                                                    });
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }
    });
});
};

//FUNGSI TIAP DATA >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
const getDataPenahanan = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT
        tanggal_akhir,
        id,
        nomor_perkara,
        tanggal_putusan
      FROM
        (
          SELECT
            MAX(sampai) as tanggal_akhir,
            penahanan_terdakwa.perkara_id as id
          FROM
            penahanan_terdakwa
          GROUP BY
            penahanan_terdakwa.perkara_id
          ORDER BY
            penahanan_terdakwa.perkara_id DESC
        ) AS custom
        LEFT JOIN perkara ON custom.id = perkara.perkara_id
        LEFT JOIN perkara_putusan ON custom.id = perkara_putusan.perkara_id
      WHERE
        tanggal_akhir >= CURDATE()
        AND tanggal_akhir <= DATE_ADD(CURDATE(),INTERVAL 15 DAY)
        AND tanggal_putusan IS NULL`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. No Perkara: ${
                r.nomor_perkara
              }\nTanggal Penahanan Terakhir: ${moment(r.tanggal_akhir).format(
                "DD-MM-YYYY"
              )}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataBA = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT nomor_perkara,tanggal_sidang,agenda,panitera_nama FROM perkara LEFT JOIN perkara_jadwal_sidang ON perkara.perkara_id=perkara_jadwal_sidang.perkara_id LEFT JOIN perkara_panitera_pn ON perkara.perkara_id=perkara_panitera_pn.perkara_id WHERE (alur_perkara_id=15 OR alur_perkara_id =16 OR alur_perkara_id=17) AND (YEAR(tanggal_sidang)=YEAR(NOW()) AND tanggal_sidang < CURDATE() AND edoc_bas IS NULL) AND perkara_panitera_pn.aktif = 'Y' ORDER BY tanggal_sidang DESC`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nTanggal Sidang : ${moment(
                r.tanggal_sidang
              ).format("DD-MM-YYYY")}\nagenda : ${r.agenda}\nPP : ${
                r.panitera_nama
              }`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataPutusanBelumMinut = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT nomor_perkara,tanggal_putusan,panitera_nama FROM perkara LEFT JOIN perkara_putusan ON perkara.perkara_id=perkara_putusan.perkara_id LEFT JOIN perkara_panitera_pn ON perkara.perkara_id=perkara_panitera_pn.perkara_id WHERE tanggal_putusan IS NOT NULL AND tanggal_minutasi IS NULL AND perkara_panitera_pn.aktif = 'Y' ORDER BY tanggal_putusan DESC`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nTanggal Putusan : ${moment(
                r.tanggal_putusan
              ).format("DD-MM-YYYY")}\nPP : ${r.panitera_nama}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataBelumBhtPidana = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT nomor_perkara, v_perkara_detil.tanggal_putusan,v_perkara_detil.tanggal_minutasi,panitera_nama FROM v_perkara_detil  LEFT JOIN perkara_putusan ON v_perkara_detil.perkara_id=perkara_putusan.perkara_id LEFT JOIN perkara_panitera_pn ON v_perkara_detil.perkara_id=perkara_panitera_pn.perkara_id WHERE v_perkara_detil.tanggal_putusan IS NOT NULL AND v_perkara_detil.tanggal_minutasi IS NOT NULL AND perkara_putusan.tanggal_bht IS NULL AND permohonan_banding IS NULL AND permohonan_kasasi IS NULL AND YEAR(v_perkara_detil.tanggal_putusan)>=2019 AND (((alur_perkara_id = 111 OR alur_perkara_id = 112 OR alur_perkara_id = 113 OR alur_perkara_id = 118) AND v_perkara_detil.tanggal_minutasi <= CURDATE())) AND perkara_panitera_pn.aktif = 'Y' ORDER BY tanggal_putusan DESC`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nTanggal Putusan : ${moment(
                r.tanggal_putusan
              ).format("DD-MM-YYYY")}\nTanggal Minutasi : ${moment(
                r.tanggal_minutasi
              ).format("DD-MM-YYYY")}\nPP : ${r.panitera_nama}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataBelumBhtPerdata = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT nomor_perkara, v_perkara_detil.tanggal_putusan,v_perkara_detil.tanggal_minutasi,panitera_nama FROM v_perkara_detil  LEFT JOIN perkara_putusan ON v_perkara_detil.perkara_id=perkara_putusan.perkara_id LEFT JOIN perkara_panitera_pn ON v_perkara_detil.perkara_id=perkara_panitera_pn.perkara_id WHERE v_perkara_detil.tanggal_putusan IS NOT NULL AND v_perkara_detil.tanggal_minutasi IS NOT NULL AND perkara_putusan.tanggal_bht IS NULL AND permohonan_banding IS NULL AND permohonan_kasasi IS NULL AND YEAR(v_perkara_detil.tanggal_putusan)>=2019  AND (((alur_perkara_id = 1 OR alur_perkara_id = 2 OR alur_perkara_id = 8 OR alur_perkara_id = 7) AND v_perkara_detil.tanggal_minutasi <= CURDATE())) AND perkara_panitera_pn.aktif = 'Y' ORDER BY v_perkara_detil.tanggal_putusan DESC`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nTanggal Putusan : ${moment(
                r.tanggal_putusan
              ).format("DD-MM-YYYY")}\nTanggal Minutasi : ${moment(
                r.tanggal_minutasi
              ).format("DD-MM-YYYY")}\nPP : ${r.panitera_nama}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataBelumSerahHukum = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT id, perkara.nomor_perkara, tanggal_putusan, tanggal_minutasi, tanggal_bht FROM perkara LEFT JOIN perkara_putusan ON perkara.perkara_id=perkara_putusan.perkara_id LEFT JOIN arsip ON perkara.perkara_id=arsip.perkara_id WHERE id IS NULL AND tanggal_bht IS NOT NULL AND YEAR(tanggal_bht) >=2024 ORDER BY tanggal_bht DESC`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nTanggal Putusan : ${moment(
                r.tanggal_putusan
              ).format("DD-MM-YYYY")}\nTanggal Minutasi : ${moment(
                r.tanggal_minutasi
              ).format("DD-MM-YYYY")}\nTanggal BHT : ${moment(
                r.tanggal_bht
              ).format("DD-MM-YYYY")}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataTundaJadwalSidang = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT tanggal_terakhir, nomor_perkara, panitera_nama FROM (SELECT MAX(tanggal_sidang) AS tanggal_terakhir, perkara_id FROM perkara_jadwal_sidang GROUP BY perkara_id) as jadwal_sidang LEFT JOIN perkara ON jadwal_sidang.perkara_id=perkara.perkara_id LEFT JOIN perkara_panitera_pn ON perkara.perkara_id=perkara_panitera_pn.perkara_id LEFT JOIN perkara_putusan ON perkara.perkara_id=perkara_putusan.perkara_id LEFT JOIN perkara_mediasi ON perkara.perkara_id=perkara_mediasi.perkara_id WHERE tanggal_putusan IS NULL AND (mediasi_id IS NULL OR hasil_mediasi IS NOT NULL) AND tanggal_terakhir <= CURDATE() AND perkara_panitera_pn.aktif = 'Y' ORDER BY tanggal_terakhir DESC`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${
                r.nomor_perkara
              }\nTanggal Sidang Terakhir : ${moment(r.tanggal_terakhir).format(
                "DD-MM-YYYY"
              )}\nPP : ${r.panitera_nama}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataSaksiTidakLengkapLama = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT nomor_perkara, panitera_nama FROM (SELECT DISTINCT(perkara_id) FROM perkara_jadwal_sidang WHERE agenda LIKE '%saksi%' AND alasan_ditunda NOT LIKE '%saksi%' AND dihadiri_oleh!=4 AND tanggal_sidang <= CURDATE()) as pemeriksaan_saksi LEFT JOIN perkara ON pemeriksaan_saksi.perkara_id=perkara.perkara_id LEFT JOIN perkara_pihak5 ON perkara.perkara_id=perkara_pihak5.perkara_id LEFT JOIN perkara_panitera_pn ON perkara.perkara_id=perkara_panitera_pn.perkara_id WHERE perkara_pihak5.perkara_id IS NULL AND YEAR(perkara.tanggal_pendaftaran)>=2022 AND perkara_panitera_pn.aktif = 'Y' ORDER BY perkara.perkara_id DESC`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nPP : ${r.panitera_nama}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataSaksiTidakLengkap = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT nomor_perkara, panitera_nama 
    FROM (
        SELECT DISTINCT(perkara_id) 
        FROM perkara_jadwal_sidang 
        WHERE agenda LIKE '%saksi%' 
        AND alasan_ditunda NOT LIKE '%saksi%' 
        AND dihadiri_oleh!=4 
        AND tanggal_sidang <= CURDATE()
    ) AS pemeriksaan_saksi 
    LEFT JOIN perkara ON pemeriksaan_saksi.perkara_id=perkara.perkara_id 
    LEFT JOIN perkara_pihak5 ON perkara.perkara_id=perkara_pihak5.perkara_id 
    LEFT JOIN perkara_panitera_pn ON perkara.perkara_id=perkara_panitera_pn.perkara_id 
    LEFT JOIN perkara_putusan ON perkara.perkara_id=perkara_putusan.perkara_id AND perkara_putusan.status_putusan_id = 67
    WHERE perkara_pihak5.perkara_id IS NULL 
    AND YEAR(perkara.tanggal_pendaftaran)>=2022 
    AND perkara_panitera_pn.aktif = 'Y' 
    AND perkara_putusan.perkara_id IS NULL
    ORDER BY perkara.perkara_id DESC
    `;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nPP : ${r.panitera_nama}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

// const getDataPutusanBelumBeritahu = () => {
//   return new Promise((resolve, reject) => {
//     let query = `SELECT nomor_perkara, tanggal_putusan, panitera_nama FROM perkara LEFT JOIN perkara_putusan_pemberitahuan_putusan ON perkara.perkara_id=perkara_putusan_pemberitahuan_putusan.perkara_id LEFT JOIN perkara_putusan ON perkara.perkara_id=perkara_putusan.perkara_id LEFT JOIN perkara_panitera_pn ON perkara.perkara_id=perkara_panitera_pn.perkara_id WHERE tanggal_putusan IS NOT NULL AND (alur_perkara_id=1 OR alur_perkara_id=2 OR alur_perkara_id=8 OR alur_perkara_id=111 OR alur_perkara_id=112 OR alur_perkara_id=113 OR alur_perkara_id=118) AND perkara_putusan_pemberitahuan_putusan.perkara_id IS NULL  AND YEAR(tanggal_putusan)>='2019' ORDER BY perkara.perkara_id DESC`;

//     db.query(query, (err, result) => {
//       if (err) {
//         reject(err);
//       } else {
//         let responseMessage;
//         if (result.length != 0) {
//           let resultArray = [];
//           result.forEach((r, index) => {
//             resultArray.push(
//               `${index + 1}. ${r.nomor_perkara}\nTanggal Putusan : ${moment(
//                 r.tanggal_putusan
//               ).format("DD-MM-YYYY")}\nPP : ${r.panitera_nama}`
//             );
//           });
//           responseMessage = resultArray.join("\n\n");
//         } else {
//           responseMessage = `Tidak ada data`;
//         }
//         resolve(responseMessage);
//       }
//     });
//   });
// };

const getDataPutusanBelumBeritahuNew = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT perkara.perkara_id, alur_perkara_id,nomor_perkara, nama, pihak,perkara_putusan_pemberitahuan_putusan.pihak_id as pihak_pemb, tanggal_pemberitahuan_putusan, tanggal_putusan,status_putusan_id FROM perkara LEFT JOIN perkara_putusan_pemberitahuan_putusan ON perkara.perkara_id=perkara_putusan_pemberitahuan_putusan.perkara_id LEFT JOIN perkara_putusan ON perkara.perkara_id=perkara_putusan.perkara_id LEFT JOIN pihak ON perkara_putusan_pemberitahuan_putusan.pihak_id=pihak.id WHERE alur_perkara_id !=114 AND tanggal_putusan is not null AND year(tanggal_putusan) >= 2024 AND tanggal_pemberitahuan_putusan is null ORDER BY perkara.perkara_id DESC`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            let pihak_jenis;
            if (
              r.alur_perkara_id == 1 ||
              r.alur_perkara_id == 8 ||
              r.alur_perkara_id == 15
            ) {
              pihak_jenis = r.pihak == 1 ? "Penggugat" : "Tergugat";
              if (r.status_putusan_id != 28) {
                resultArray.push(
                  `${index + 1}. ${r.nomor_perkara}\nTanggal Putusan : ${moment(
                    r.tanggal_putusan
                  ).format(
                    "DD-MM-YYYY"
                  )}\nPihak Yang Belum Diberitahukan : ${pihak_jenis}`
                );
              }
            } else if (
              r.alur_perkara_id == 111 ||
              r.alur_perkara_id == 112 ||
              r.alur_perkara_id == 113 ||
              r.alur_perkara_id == 118 ||
              r.alur_perkara_id == 122
            ) {
              pihak_jenis = r.pihak == 1 ? "Penuntut Umum" : "Terdakwa";
              resultArray.push(
                `${index + 1}. ${r.nomor_perkara}\nPihak Yang Belum Diberitahukan : ${pihak_jenis}`
              );
            } else if (r.alur_perkara_id == 119 || r.alur_perkara_id == 16) {
              pihak_jenis = r.pihak == 1 ? "Pemohon" : "Termohon";
              resultArray.push(
                `${index + 1}. ${r.nomor_perkara}\nPihak Yang Belum Diberitahukan : ${pihak_jenis}`
              );
            } else {
              pihak_jenis = "Pemohon";
              resultArray.push(
                `${index + 1}. ${r.nomor_perkara}\nPihak Yang Belum Diberitahukan : ${pihak_jenis}`
              );
            }
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataPemberitahuanPutusanBelum = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT 
        a.perkara_id,
        a.nomor_perkara,
        a.jenis_perkara_nama,
        a.tanggal_putusan,
        a.status_putusan_kode,
        CASE 
            WHEN b.dihadiri_oleh = 4 THEN 'tidak ada hadir' 
            WHEN b.dihadiri_oleh = 3 THEN 'Pihak Kedua saja' 
            WHEN b.dihadiri_oleh = 2 THEN 'Pihak Pertama saja' 
            ELSE 'semua' 
        END AS dihadiri_oleh,
        c.jurusita_nama,
        a.alur_perkara_id,
        h.pihak,
        g.status_putusan_id,
        d.perkara_id AS delegasi
    FROM 
        v_perkara a
    JOIN 
        perkara_jadwal_sidang b ON a.perkara_id = b.perkara_id 
        AND b.tanggal_sidang = a.tanggal_putusan 
        AND b.dihadiri_oleh IS NOT NULL 
    JOIN 
        perkara_putusan g ON a.perkara_id = g.perkara_id
    JOIN 
        perkara_putusan_pemberitahuan_putusan h ON a.perkara_id = h.perkara_id
    JOIN 
        perkara_jurusita c ON a.perkara_id = c.perkara_id
    LEFT JOIN 
        delegasi_keluar d ON a.perkara_id = d.perkara_id
    WHERE
        YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE())
        AND a.tanggal_putusan > DATE_SUB(CURDATE(), INTERVAL 3 YEAR) 
        AND b.dihadiri_oleh > 1
        AND (
            CASE 
                WHEN b.dihadiri_oleh = 4 THEN (
                    SELECT MAX(a1.tanggal_pemberitahuan_putusan) 
                    FROM perkara_putusan_pemberitahuan_putusan a1 
                    WHERE a1.perkara_id = a.perkara_id
                ) 
                WHEN b.dihadiri_oleh = 3 THEN (
                    SELECT MAX(a2.tanggal_pemberitahuan_putusan) 
                    FROM perkara_putusan_pemberitahuan_putusan a2 
                    WHERE a2.perkara_id = a.perkara_id AND a2.pihak = 1
                )
                WHEN b.dihadiri_oleh = 2 THEN (
                    SELECT MAX(a3.tanggal_pemberitahuan_putusan) 
                    FROM perkara_putusan_pemberitahuan_putusan a3 
                    WHERE a3.perkara_id = a.perkara_id AND a3.pihak = 2
                )
                ELSE NULL 
            END
        ) IS NULL
        AND a.tanggal_putusan IS NOT NULL 
        AND (
            SELECT MAX(d.tanggal_transaksi) 
            FROM perkara_biaya d 
            WHERE d.kategori_id = 6 
            AND d.perkara_id = a.perkara_id
        ) IS NOT NULL 
    ORDER BY 
          c.jurusita_nama DESC;`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            let pihak_jenis;
            if (r.alur_perkara_id == 1 || r.alur_perkara_id == 8 || r.alur_perkara_id == 15) {
              pihak_jenis = r.pihak == 1 ? "Penggugat" : "Tergugat";
              if (r.status_putusan_id != 28) {
                resultArray.push(
                  `${index + 1}. ${r.nomor_perkara}\ntanggal putusan : ${moment(r.tanggal_putusan).format("DD-MM-YYYY")}\npihak yang belum diberitahukan : ${pihak_jenis}\nJS : ${r.jurusita_nama}`
                );
              }
            } else if (
              r.alur_perkara_id == 111 ||
              r.alur_perkara_id == 112 ||
              r.alur_perkara_id == 113 ||
              r.alur_perkara_id == 118 ||
              r.alur_perkara_id == 122
            ) {
              pihak_jenis = r.pihak == 1 ? "Penuntut Umum" : "Terdakwa";
              resultArray.push(
                `${index + 1}. ${r.nomor_perkara}\npihak yang belum diberitahukan : ${pihak_jenis}`
              );
            } else if (r.alur_perkara_id == 119 || r.alur_perkara_id == 16) {
              pihak_jenis = r.pihak == 1 ? "Pemohon" : "Termohon";
              resultArray.push(
                `${index + 1}. ${r.nomor_perkara}\npihak yang belum diberitahukan : ${pihak_jenis}`
              );
            } else {
              pihak_jenis = "Pemohon";
              resultArray.push(
                `${index + 1}. ${r.nomor_perkara}\npihak yang belum diberitahukan : ${pihak_jenis}`
              );
            }
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataJadwalSidangPidana = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT nomor_perkara, agenda, panitera_nama FROM perkara LEFT JOIN perkara_jadwal_sidang ON perkara.perkara_id=perkara_jadwal_sidang.perkara_id LEFT JOIN perkara_panitera_pn ON perkara.perkara_id=perkara_panitera_pn.perkara_id WHERE tanggal_sidang = CURDATE() AND (alur_perkara_id=111 OR alur_perkara_id=112 OR alur_perkara_id=118) AND perkara_panitera_pn.aktif = 'Y' ORDER BY perkara.perkara_id DESC`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nAgenda : ${r.agenda}\nPP : ${r.panitera_nama}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataJadwalSidangPerdatalama = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT nomor_perkara, agenda, panitera_nama FROM perkara LEFT JOIN perkara_jadwal_sidang ON perkara.perkara_id=perkara_jadwal_sidang.perkara_id LEFT JOIN perkara_panitera_pn ON perkara.perkara_id=perkara_panitera_pn.perkara_id WHERE tanggal_sidang = CURDATE() AND (alur_perkara_id=15 OR alur_perkara_id=16 OR alur_perkara_id=17) AND perkara_panitera_pn.aktif = 'Y' ORDER BY perkara.perkara_id DESC`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nagenda : ${r.agenda}\nPP : ${r.panitera_nama}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataJadwalSidangPerdata = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT DISTINCT
    a.perkara_id,
		b.tanggal_sidang,
    a.nomor_perkara,
    b.agenda,
    c.panitera_nama,
    a.tanggal_pendaftaran,
    a.jenis_perkara_nama,
    REPLACE(a.para_pihak, '<br />', '\n') AS para_pihak,
    a.tahapan_terakhir_id,
    a.tahapan_terakhir_text,
    a.proses_terakhir_id,
    a.proses_terakhir_text,
    n.majelis_hakim_kode,
    n.majelis_hakim_text,
    m.jurusita_nama,
    CASE
        WHEN f.jabatan_hakim_nama = 'Hakim Tunggal' THEN 'T'
        ELSE 'KM'
    END AS jabatan_hakim,
    CASE
        WHEN a.proses_terakhir_id < 210 THEN
            DATEDIFF(CURDATE(), a.tanggal_pendaftaran) - IFNULL(
                (SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0
            )
        ELSE
            DATEDIFF(d.tanggal_putusan, a.tanggal_pendaftaran) - IFNULL(
                (SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0
            )
    END + 1 AS durasi,
    CASE
        WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
        ELSE ''
    END AS ghaib,
    CASE
        WHEN a.prodeo = 1 THEN ' (_Prodeo_)'
        ELSE ''
    END AS prodeo,
    CASE
        WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
        ELSE ''
    END AS ecourt
FROM 
    perkara AS a
LEFT JOIN 
    (SELECT perkara_id, MAX(tanggal_sidang) AS tanggal_sidang_terakhir FROM perkara_jadwal_sidang GROUP BY perkara_id) AS subq 
    ON a.perkara_id = subq.perkara_id
LEFT JOIN 
    perkara_jadwal_sidang AS b 
    ON a.perkara_id = b.perkara_id AND b.tanggal_sidang = subq.tanggal_sidang_terakhir
LEFT JOIN 
    perkara_panitera_pn AS c 
    ON a.perkara_id = c.perkara_id
LEFT JOIN 
    perkara_putusan AS d 
    ON a.perkara_id = d.perkara_id
LEFT JOIN 
    perkara_hakim_pn AS f 
    ON a.perkara_id = f.perkara_id
LEFT JOIN 
    perkara_pelaksanaan_relaas AS g 
    ON a.perkara_id = g.perkara_id
LEFT JOIN 
    (SELECT perkara_id FROM perkara_efiling_id) AS h 
    ON a.perkara_id = h.perkara_id
LEFT JOIN 
    (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i 
    ON a.perkara_id = i.perkara_id
LEFT JOIN 
    perkara_pihak2 AS j 
    ON a.perkara_id = j.perkara_id
LEFT JOIN 
    perkara_efiling_id AS k 
    ON a.perkara_id = k.perkara_id
LEFT JOIN 
    perkara_pengacara AS l 
    ON a.perkara_id = l.perkara_id
LEFT JOIN 
    perkara_jurusita AS m 
    ON a.perkara_id = m.perkara_id
LEFT JOIN 
    perkara_penetapan AS n 
    ON a.perkara_id = n.perkara_id
LEFT JOIN 
    perkara_ikrar_talak AS o
    ON a.perkara_id = o.perkara_id
LEFT JOIN 
    v_pihak_perkara AS x 
    ON a.perkara_id = x.perkara_id
LEFT JOIN 
    pihak AS w 
    ON x.pihak_id = w.id
LEFT JOIN (
    SELECT
        a.pihak_id,
        MAX(CASE WHEN a.pihak_ke = 1 THEN CONCAT('+62', SUBSTRING(b.telepon, 2)) ELSE NULL END) AS teleponPenggugat,
        MAX(CASE WHEN a.pihak_ke = 2 THEN CONCAT('+62', SUBSTRING(b.telepon, 2)) ELSE NULL END) AS teleponTergugat
    FROM v_pihak_perkara AS a
    JOIN pihak AS b ON a.pihak_id = b.id 
                    AND b.telepon REGEXP '^[0-9]' 
                    AND CHAR_LENGTH(b.telepon) > 8
    GROUP BY a.pihak_id
) AS telepons ON x.pihak_id = telepons.pihak_id
LEFT JOIN (
    SELECT
        perk.perkara_id,
        CASE
            WHEN datarelaas.tanggal_relaas IS NULL OR datarelaas.tanggal_relaas = '' THEN
            CASE
                WHEN perkarapihak.pihakke = 1 THEN '(Belum Dipanggil P)'
                WHEN perkarapihak.pihakke = 2 THEN '(Belum Dipanggil T)'
                WHEN perkarapihak.pihakke IN (1,2) THEN '(Belum Dipanggil PT)'
                WHEN perkarapihak.pihakke IN (1,2,4) THEN '(Belum Dipanggil PT & Turut T)'
                WHEN perkarapihak.pihakke = 4 THEN '(Belum Dipanggil Turut Tergugat)'
                ELSE '(Sudah Dipanggil dan Diupload)'
            END
        WHEN datarelaas.doc_relaas IS NULL OR datarelaas.doc_relaas = '' THEN
            CASE
                WHEN perkarapihak.pihakke = 1 THEN '(Belum Diupload P)'
                WHEN perkarapihak.pihakke = 2 THEN '(Belum Diupload T)'
                WHEN perkarapihak.pihakke IN (1,2) THEN '(Belum Diupload PT)'
                WHEN perkarapihak.pihakke IN (1,2,4) THEN '(Belum Diupload PT & Turut T)'
                WHEN perkarapihak.pihakke = 4 THEN '(Belum Diupload Turut Tergugat)'
                ELSE '(Sudah Dipanggil dan Diupload)'
            END
        ELSE '(Sudah Dipanggil dan Diupload)'
        END AS panggilan_status
    FROM
        perkara AS perk
        JOIN perkara_jadwal_sidang AS sidang ON sidang.perkara_id = perk.perkara_id
        JOIN (
            SELECT
                p1.perkara_id,
                p1.pihak_id,
                p1.nama,
                1 AS pihakke,
                'pihak p' AS ketpihak,
                '' AS pengacara_pihak_id
            FROM
                perkara_pihak1 AS p1
                JOIN perkara ON perkara.perkara_id = p1.perkara_id
            WHERE
                alur_perkara_id < 111
            UNION
            SELECT
                p2.perkara_id,
                p2.pihak_id,
                p2.nama,
                2 AS pihakke,
                'pihak t' AS ketpihak,
                '' AS pengacara_pihak_id
            FROM
                perkara_pihak2 AS p2
                JOIN perkara ON perkara.perkara_id = p2.perkara_id
            WHERE
                alur_perkara_id < 111
                AND (
                    status_penahanan_id IS NULL
                    OR status_penahanan_id = 0
                )
                AND (
                    jenis_tahanan_id = 0
                    OR jenis_tahanan_id IS NULL
                )
            UNION
            SELECT
                p3.perkara_id,
                p3.pihak_id,
                p3.nama,
                3 AS pihakke,
                'intervensi' AS ketpihak,
                '' AS pengacara_pihak_id
            FROM
                perkara_pihak3 AS p3
            UNION
            SELECT
                p4.perkara_id,
                p4.pihak_id,
                p4.nama,
                4 AS pihakke,
                'turut' AS ketpihak,
                '' AS pengacara_pihak_id
            FROM
                perkara_pihak4 AS p4
            UNION
            SELECT
                p5.perkara_id,
                p5.pengacara_id,
                p5.nama,
                p5.pihak_ke AS pihakke,
                'pengacara' AS ketpihak,
                p5.pihak_id AS pengacara_pihak_id
            FROM
                perkara_pengacara AS p5
        ) AS perkarapihak 
        ON perkarapihak.perkara_id = perk.perkara_id
        LEFT JOIN perkara_pelaksanaan_relaas AS datarelaas 
        ON datarelaas.pihak_id = perkarapihak.pihak_id
        AND datarelaas.perkara_id = perk.perkara_id
        AND datarelaas.sidang_id = sidang.id
        LEFT JOIN (
            SELECT
                perkara.perkara_id AS perkara_id,
                perkara_jadwal_sidang.urutan AS urutan,
                perkara_jadwal_sidang.dihadiri_oleh
            FROM
                perkara
                JOIN perkara_jadwal_sidang ON (
                    perkara_jadwal_sidang.perkara_id = perkara.perkara_id
                )
        ) AS jadwalsidang 
        ON (
            jadwalsidang.perkara_id = perk.perkara_id
            AND jadwalsidang.urutan = sidang.urutan - 1
        )
        LEFT JOIN perkara_penetapan_hari_sidang AS phs 
        ON (
            phs.perkara_id = perk.perkara_id
            AND phs.jadwalsidang_id = sidang.id
        )
        JOIN alur_perkara AS alur 
        ON alur.id = perk.alur_perkara_id
    WHERE
        YEAR(perk.tanggal_pendaftaran) = YEAR(CURDATE())
        AND perk.alur_perkara_id < 111
        AND perkarapihak.pihak_id NOT IN (
            SELECT
                pp.pihak_id
            FROM
                perkara_pelaksanaan_relaas
                JOIN perkara_pengacara AS pp 
                ON pp.pengacara_id = perkara_pelaksanaan_relaas.pihak_id
                AND pp.perkara_id = perkara_pelaksanaan_relaas.perkara_id
                JOIN perkara ON pp.perkara_id = perkara.perkara_id
            WHERE
                perk.alur_perkara_id < 111
                AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
                AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
                AND (
                    perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL
                    OR perkara_pelaksanaan_relaas.tanggal_relaas <> ''
                )
                AND (
                    perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL
                    OR perkara_pelaksanaan_relaas.doc_relaas <> ''
                )
            UNION
            SELECT
                ppb.pengacara_id
            FROM
                perkara_pelaksanaan_relaas
                JOIN perkara_pengacara AS ppb 
                ON ppb.pihak_id = perkara_pelaksanaan_relaas.pihak_id
                AND ppb.perkara_id = perkara_pelaksanaan_relaas.perkara_id
                JOIN perkara ON ppb.perkara_id = perkara.perkara_id
            WHERE
                perk.alur_perkara_id < 111
                AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
                AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
                AND (
                    perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL
                    OR perkara_pelaksanaan_relaas.tanggal_relaas <> ''
                )
                AND (
                    perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL
                    OR perkara_pelaksanaan_relaas.doc_relaas <> ''
                )
        )
        AND (
            (
                datarelaas.tanggal_relaas IS NULL
                OR datarelaas.tanggal_relaas = ''
            )
            OR (
                datarelaas.doc_relaas IS NULL
                OR datarelaas.doc_relaas = ''
            )
        )
        AND(
            perk.alur_perkara_id >= 1
            AND perk.alur_perkara_id <= 17
        )
        AND (
            (jadwalsidang.dihadiri_oleh <> 1)
            AND (
                jadwalsidang.dihadiri_oleh = 2
                AND (
                    perkarapihak.pihakke = 2
                    OR perkarapihak.pihakke = 4
                )
            )
            OR (
                jadwalsidang.dihadiri_oleh = 3
                AND perkarapihak.pihakke = 1
            )
            OR (
                jadwalsidang.dihadiri_oleh = 4
                OR jadwalsidang.dihadiri_oleh IS NULL
            )
        )
) AS doc_relaas_status 
ON a.perkara_id = doc_relaas_status.perkara_id
WHERE 
    b.tanggal_sidang = CURDATE()
    AND a.alur_perkara_id IN (15, 16, 17)
    AND c.aktif = 'Y'
    AND f.aktif = 'Y'
    AND m.aktif = 'Y'
    AND (
        CASE 
            WHEN a.jenis_perkara_id = 346 AND d.status_putusan_id = 62 AND o.amar_ikrar_talak IS NULL THEN a.proses_terakhir_id < 296
            ELSE a.proses_terakhir_id < 218 
        END
    )
ORDER BY 
    CASE
        WHEN b.alasan_ditunda LIKE '%putusan%' OR b.alasan_ditunda LIKE '%penetapan%' OR b.alasan_ditunda LIKE '%musyawarah%' THEN 1
        ELSE 2
    END,
    a.alur_perkara_id,
    n.majelis_hakim_kode,
		a.jenis_perkara_id DESC,
		b.urutan DESC,
    c.panitera_nama,
    a.nomor_perkara, 
    ecourt, 
    ghaib, 
    prodeo DESC;`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `*${index + 1}. ${r.nomor_perkara}* ${r.ecourt}${r.ghaib}${r.prodeo} (${r.durasi} Hari)\nMajelis Hakim : *${r.majelis_hakim_kode}*\nTanggal Sidang : ${moment(r.tanggal_sidang).format("DD-MM-YYYY")}\nAgenda : ${r.agenda}\nPP : ${r.panitera_nama}\nJS : ${r.jurusita_nama}\n*PARA PIHAK :*\n${r.para_pihak}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataJadwalMediasi = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT nomor_perkara, nama_mediator, panitera_nama FROM perkara LEFT JOIN perkara_mediasi ON perkara.perkara_id=perkara_mediasi.perkara_id  LEFT JOIN perkara_mediator ON perkara.perkara_id=perkara_mediator.perkara_id LEFT JOIN perkara_jadwal_mediasi ON perkara_mediasi.mediasi_id=perkara_jadwal_mediasi.mediasi_id LEFT JOIN perkara_panitera_pn ON perkara.perkara_id=perkara_panitera_pn.perkara_id WHERE tanggal_mediasi = CURDATE() AND perkara_panitera_pn.aktif = 'Y' ORDER BY perkara.perkara_id DESC`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nNama Mediator : ${r.nama_mediator}\nPP : ${r.panitera_nama}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataJadwalMediasiBesok = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT nomor_perkara, nama_mediator, panitera_nama FROM perkara LEFT JOIN perkara_mediasi ON perkara.perkara_id=perkara_mediasi.perkara_id  LEFT JOIN perkara_mediator ON perkara.perkara_id=perkara_mediator.perkara_id LEFT JOIN perkara_jadwal_mediasi ON perkara_mediasi.mediasi_id=perkara_jadwal_mediasi.mediasi_id LEFT JOIN perkara_panitera_pn ON perkara.perkara_id=perkara_panitera_pn.perkara_id WHERE tanggal_mediasi = DATE_ADD(CURDATE(), INTERVAL 1 DAY) AND perkara_panitera_pn.aktif = 'Y' ORDER BY perkara.perkara_id DESC`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nNama Mediator : ${r.nama_mediator}\nPP : ${r.panitera_nama}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataSisaPanjarPnLama = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT nomor_perkara, tanggal_putusan, sisa FROM v_perkara_biaya LEFT JOIN perkara_putusan ON v_perkara_biaya.perkara_id=perkara_putusan.perkara_id WHERE tahapan_terakhir_id=15 AND (alur_perkara_id = 15 OR alur_perkara_id = 16 OR alur_perkara_id = 17) AND sisa > 0 ORDER BY v_perkara_biaya.perkara_id DESC`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nTanggal Putusan : ${moment(
                r.tanggal_putusan
              ).format("DD-MM-YYYY")}\nSisa Panjar : ${r.sisa.toLocaleString()}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataSisaPanjarPn = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT a.nomor_perkara, b.tanggal_putusan, v.sisa 
    FROM perkara_biaya AS v
    LEFT JOIN perkara AS a ON v.perkara_id = a.perkara_id 
    LEFT JOIN perkara_putusan AS b ON v.perkara_id = b.perkara_id 
    LEFT JOIN perkara_ikrar_talak AS c ON a.perkara_id = c.perkara_id
    WHERE 
        ((a.jenis_perkara_id = 346 AND a.tahapan_terakhir_id = 19 AND c.amar_ikrar_talak IS NOT NULL) 
        OR (a.jenis_perkara_id != 346 AND a.tahapan_terakhir_id = 15)) 
        AND (a.alur_perkara_id = 15 OR a.alur_perkara_id = 16 OR a.alur_perkara_id = 17) 
        AND v.sisa > 0 
    ORDER BY a.perkara_id DESC;
    `;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nTanggal Putusan : ${moment(
                r.tanggal_putusan
              ).format("DD-MM-YYYY")}\nSisa Panjar : ${r.sisa.toLocaleString()}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataSisaPanjarBanding = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT nomor_perkara, putusan_banding, sisa FROM v_perkara_biaya_banding LEFT JOIN perkara_banding ON v_perkara_biaya_banding.perkara_id=perkara_banding.perkara_id WHERE proses_terakhir_id=400 AND (v_perkara_biaya_banding.alur_perkara_id = 15 OR v_perkara_biaya_banding.alur_perkara_id = 16 OR v_perkara_biaya_banding.alur_perkara_id = 17) AND sisa > 0 ORDER BY v_perkara_biaya_banding.perkara_id DESC`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nTanggal putusan : ${moment(
                r.putusan_banding
              ).format("DD-MM-YYYY")}\nSisa Panjar : ${r.sisa.toLocaleString()}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataSisaPanjarKasasi = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT nomor_perkara, putusan_kasasi, sisa FROM v_perkara_biaya_kasasi LEFT JOIN perkara_kasasi ON v_perkara_biaya_kasasi.perkara_id=perkara_kasasi.perkara_id WHERE proses_terakhir_id=500 AND (v_perkara_biaya_kasasi.alur_perkara_id = 15 OR v_perkara_biaya_kasasi.alur_perkara_id = 16 OR v_perkara_biaya_kasasi.alur_perkara_id = 17) AND sisa > 0 ORDER BY v_perkara_biaya_kasasi.perkara_id DESC`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nTanggal Putusan : ${moment(
                r.putusan_kasasi
              ).format("DD-MM-YYYY")}\nSisa Panjar : ${r.sisa.toLocaleString()}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataCourtCalendar = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT           
    A.tanggal_pendaftaran, 
    A.nomor_perkara, 
    A.proses_terakhir_text,
    A.para_pihak, 
    
    (SELECT panitera_nama 
    FROM perkara_panitera_pn 
    LEFT JOIN panitera_pn  ON panitera_pn.id = perkara_panitera_pn.panitera_id
    WHERE perkara_panitera_pn.perkara_id= A.perkara_id AND perkara_panitera_pn.aktif='Y' ORDER BY perkara_panitera_pn.urutan ASC) AS paniteraku,
    (SELECT GROUP_CONCAT(DISTINCT hkpn.nama_gelar ORDER BY hk.id ASC SEPARATOR '<br>') AS nama_hakim 
    FROM perkara_hakim_pn AS hk
    LEFT JOIN hakim_pn AS hkpn ON hkpn.id = hk.hakim_id
    WHERE hk.perkara_id= A.perkara_id AND hk.aktif='Y' ORDER BY hk.urutan ASC) AS majelis_hakim
          FROM perkara as A
          LEFT JOIN perkara_hakim_pn as B ON B.perkara_id=A.perkara_id
          LEFT JOIN perkara_jadwal_sidang as C ON C.perkara_id=A.perkara_id
          LEFT JOIN perkara_panitera_pn as D ON D.perkara_id=A.perkara_id
          WHERE A.alur_perkara_id NOT IN (15,16,17) 
          AND A.perkara_id NOT IN (SELECT perkara_id FROM perkara_court_calendar 
                                   WHERE (rencana_agenda LIKE '%putus%' OR rencana_agenda LIKE '%penetapan%' OR rencana_agenda LIKE '%cabut%' OR rencana_agenda LIKE '%gugur%' OR rencana_agenda LIKE '%akta perdamaian%' OR rencana_agenda LIKE '%P U T U S%'))
          AND B.aktif = 'Y'   
          AND D.aktif = 'Y'
          AND C.tanggal_sidang IS NOT NULL                
          AND A.perkara_id NOT IN (SELECT perkara_id FROM perkara_mediasi
                                   WHERE dimulai_mediasi IS NOT NULL 
                       AND hasil_mediasi IS NULL)
          AND YEAR(A.tanggal_pendaftaran) = 2022
          GROUP BY A.perkara_id
          ORDER BY A.perkara_id DESC`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nPP : ${r.paniteraku}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

// GANTI alur_perkara_id dengan id 15 dan 16
const getStatistik = async () => {
  let querySisaTahunLalu = `SELECT COUNT(perkara.perkara_id) as jumlah_sisa FROM perkara LEFT JOIN perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id WHERE alur_perkara_id != 114 and YEAR(tanggal_pendaftaran) < YEAR(CURDATE()) AND (tanggal_putusan IS NULL OR YEAR(tanggal_putusan) = YEAR(CURDATE()))`;
  let queryMasukTahunIni = `SELECT COUNT(perkara.perkara_id) as jumlah_masuk FROM perkara LEFT JOIN       perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id WHERE alur_perkara_id != 114 and YEAR(tanggal_pendaftaran) = YEAR(CURDATE()) `;
  let queryPutusTahunIni = `SELECT COUNT(perkara.perkara_id) as jumlah_putus FROM perkara LEFT JOIN perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id WHERE alur_perkara_id != 114 AND YEAR(tanggal_putusan) = YEAR(CURDATE()) AND tanggal_putusan IS NOT NULL`;

  let jmlSisaTahunLalu = () => {
    return new Promise((resolve, reject) => {
      db.query(querySisaTahunLalu, async (err, result) => {
        if (err) {
          reject(err);
        } else {
          let jml = result;
          resolve(jml);
        }
      });
    });
  };

  let jmlMasukTahunIni = () => {
    return new Promise((resolve, reject) => {
      db.query(queryMasukTahunIni, async (err, result) => {
        if (err) {
          reject(err);
        } else {
          let jml = result;
          resolve(jml);
        }
      });
    });
  };

  let jmlPutusTahunIni = () => {
    return new Promise((resolve, reject) => {
      db.query(queryPutusTahunIni, async (err, result) => {
        if (err) {
          reject(err);
        } else {
          let jml = result;
          resolve(jml);
        }
      });
    });
  };

  let sisaTahunLalu = jmlSisaTahunLalu();
  let numberSisaTahunLalu = await sisaTahunLalu;
  let masukTahunIni = jmlMasukTahunIni();
  let numberMasukTahunIni = await masukTahunIni;
  let putusTahunIni = jmlPutusTahunIni();
  let numberPutusTahunIni = await putusTahunIni;
  let sisaTahunIni =
    numberSisaTahunLalu[0].jumlah_sisa +
    numberMasukTahunIni[0].jumlah_masuk -
    numberPutusTahunIni[0].jumlah_putus;
  let rasioPerkara =
    (numberPutusTahunIni[0].jumlah_putus /
      (numberSisaTahunLalu[0].jumlah_sisa +
        numberMasukTahunIni[0].jumlah_masuk)) *
    100;

  let rasioDisplay = rasioPerkara.toFixed(2);

  let message = `Jumlah sisa tahun lalu : ${numberSisaTahunLalu[0].jumlah_sisa}, \nJumlah masuk tahun ini : ${numberMasukTahunIni[0].jumlah_masuk} \nJumlah putus tahun ini : ${numberPutusTahunIni[0].jumlah_putus} \nSisa Tahun ini : ${sisaTahunIni} \n*Rasio Penanganan Perkara Tahun Ini : ${rasioDisplay}%*`;

  return message;
};

const getStatistikDetail = async () => {
  let querySisaTahunLalu = `SELECT COUNT(perkara.perkara_id) as jumlah_sisa FROM perkara LEFT JOIN perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id WHERE alur_perkara_id != 114 and YEAR(tanggal_pendaftaran) < YEAR(CURDATE()) AND (tanggal_putusan IS NULL OR YEAR(tanggal_putusan) = YEAR(CURDATE()))`;
  let queryMasukTahunIni = `SELECT COUNT(perkara.perkara_id) as jumlah_masuk FROM perkara LEFT JOIN perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id WHERE alur_perkara_id != 114 and YEAR(tanggal_pendaftaran) = YEAR(CURDATE()) `;
  let queryPutusTahunIni = `SELECT 
                              COUNT(perkara.perkara_id) as jumlah_putus,
                              SUM(CASE WHEN jenis_perkara_id = 347 THEN 1 ELSE 0 END) as jumlah_putus_cerai_gugat,
                              SUM(CASE WHEN jenis_perkara_id = 346 THEN 1 ELSE 0 END) as jumlah_putus_cerai_talak,
                              SUM(CASE WHEN jenis_perkara_id = 362 THEN 1 ELSE 0 END) as jumlah_putus_dispensasi_kawin,
                              SUM(CASE WHEN jenis_perkara_id = 360 THEN 1 ELSE 0 END) as jumlah_putus_itsbat_nikah,
                              SUM(CASE WHEN jenis_perkara_id = 348 THEN 1 ELSE 0 END) as jumlah_putus_harta_bersama,
                              SUM(CASE WHEN jenis_perkara_id = 371 THEN 1 ELSE 0 END) as jumlah_putus_penetapan_ahli_waris,
                              SUM(CASE WHEN jenis_perkara_id = 349 THEN 1 ELSE 0 END) as jumlah_putus_hadhanah,
                              SUM(CASE WHEN jenis_perkara_id = 364 THEN 1 ELSE 0 END) as jumlah_putus_kewarisan,
                              SUM(CASE WHEN jenis_perkara_id = 341 THEN 1 ELSE 0 END) as jumlah_putus_izin_poligami,
                              SUM(CASE WHEN jenis_perkara_id = 354 THEN 1 ELSE 0 END) as jumlah_putus_perwalian,
                              SUM(CASE WHEN jenis_perkara_id = 367 THEN 1 ELSE 0 END) as jumlah_putus_wakaf,
                              SUM(CASE WHEN jenis_perkara_id = 363 THEN 1 ELSE 0 END) as jumlah_putus_wali_adhol,
                              SUM(CASE WHEN jenis_perkara_id = 358 THEN 1 ELSE 0 END) as jumlah_putus_asal_usul_anak,
                              SUM(CASE WHEN jenis_perkara_id = 352 THEN 1 ELSE 0 END) as jumlah_putus_pengesahan_anak,
                              SUM(CASE WHEN jenis_perkara_id = 344 THEN 1 ELSE 0 END) as jumlah_putus_pembatalan_pernikahan,
                              SUM(CASE WHEN jenis_perkara_id = 369 THEN 1 ELSE 0 END) as jumlah_putus_lain_lain
                            FROM perkara
                            LEFT JOIN perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id 
                            WHERE alur_perkara_id != 114 AND YEAR(tanggal_putusan) = YEAR(CURDATE()) AND tanggal_putusan IS NOT NULL`;

  let jmlSisaTahunLalu = () => {
    return new Promise((resolve, reject) => {
      db.query(querySisaTahunLalu, async (err, result) => {
        if (err) {
          reject(err);
        } else {
          let jml = result;
          resolve(jml);
        }
      });
    });
  };

  let jmlMasukTahunIni = () => {
    return new Promise((resolve, reject) => {
      db.query(queryMasukTahunIni, async (err, result) => {
        if (err) {
          reject(err);
        } else {
          let jml = result;
          resolve(jml);
        }
      });
    });
  };

  let jmlPutusTahunIni = () => {
    return new Promise((resolve, reject) => {
      db.query(queryPutusTahunIni, async (err, result) => {
        if (err) {
          reject(err);
        } else {
          let jml = result;
          resolve(jml);
        }
      });
    });
  };

  let sisaTahunLalu = jmlSisaTahunLalu();
  let numberSisaTahunLalu = await sisaTahunLalu;
  let masukTahunIni = jmlMasukTahunIni();
  let numberMasukTahunIni = await masukTahunIni;
  let putusTahunIni = jmlPutusTahunIni();
  let numberPutusTahunIni = await putusTahunIni;

  let jumlahPutusCeraiGugat =
    numberPutusTahunIni[0].jumlah_putus_cerai_gugat || 0;
  let jumlahPutusCeraiTalak =
    numberPutusTahunIni[0].jumlah_putus_cerai_talak || 0;
  let jumlahPutusDispensasiKawin =
    numberPutusTahunIni[0].jumlah_putus_dispensasi_kawin || 0;
  let jumlahPutusItsbatNikah =
    numberPutusTahunIni[0].jumlah_putus_itsbat_nikah || 0;
  let jumlahPutusHartaBersama =
    numberPutusTahunIni[0].jumlah_putus_harta_bersama || 0;
  let jumlahPutusPenetapanAhliWaris =
    numberPutusTahunIni[0].jumlah_putus_penetapan_ahli_waris || 0;
  let jumlahPutusHadhanah = numberPutusTahunIni[0].jumlah_putus_hadhanah || 0;
  let jumlahPutusKewarisan = numberPutusTahunIni[0].jumlah_putus_kewarisan || 0;
  let jumlahPutusIzinPoligami =
    numberPutusTahunIni[0].jumlah_putus_izin_poligami || 0;
  let jumlahPutusPerwalian = numberPutusTahunIni[0].jumlah_putus_perwalian || 0;
  let jumlahPutusWakaf = numberPutusTahunIni[0].jumlah_putus_wakaf || 0;
  let jumlahPutusWaliAdhol =
    numberPutusTahunIni[0].jumlah_putus_wali_adhol || 0;
  let jumlahPutusAsalUsulAnak =
    numberPutusTahunIni[0].jumlah_putus_asal_usul_anak || 0;
  let jumlahPutusPengesahanAnak =
    numberPutusTahunIni[0].jumlah_putus_pengesahan_anak || 0;
  let jumlahPutusPembatalanPernikahan =
    numberPutusTahunIni[0].jumlah_putus_pembatalan_pernikahan || 0;
  let jumlahPutusLainLain = numberPutusTahunIni[0].jumlah_putus_lain_lain || 0;

  let sisaTahunIni =
    numberSisaTahunLalu[0].jumlah_sisa +
    numberMasukTahunIni[0].jumlah_masuk -
    numberPutusTahunIni[0].jumlah_putus;

  let rasioPerkara =
    (numberPutusTahunIni[0].jumlah_putus /
      (numberSisaTahunLalu[0].jumlah_sisa +
        numberMasukTahunIni[0].jumlah_masuk)) *
    100;

  let rasioDisplay = rasioPerkara.toFixed(2);

  let message = `\n*Jumlah sisa tahun lalu : ${numberSisaTahunLalu[0].jumlah_sisa}*, \n*Jumlah masuk : ${numberMasukTahunIni[0].jumlah_masuk}* \n*Jumlah putus : ${numberPutusTahunIni[0].jumlah_putus}* \n\nJumlah putus Cerai Gugat : ${jumlahPutusCeraiGugat} \nJumlah putus Cerai Talak : ${jumlahPutusCeraiTalak} \nJumlah putus Dispensasi Kawin : ${jumlahPutusDispensasiKawin} \nJumlah putus Itsbat Nikah : ${jumlahPutusItsbatNikah} \nJumlah putus Harta Bersama : ${jumlahPutusHartaBersama} \nJumlah putus Penetapan Ahli Waris : ${jumlahPutusPenetapanAhliWaris} \nJumlah putus Hadhanah : ${jumlahPutusHadhanah} \nJumlah putus Kewarisan : ${jumlahPutusKewarisan} \nJumlah putus Izin Poligami : ${jumlahPutusIzinPoligami} \nJumlah putus Perwalian : ${jumlahPutusPerwalian} \nJumlah putus Wakaf : ${jumlahPutusWakaf} \nJumlah putus Wali Adhol : ${jumlahPutusWaliAdhol} \nJumlah putus Asal Usul Anak : ${jumlahPutusAsalUsulAnak} \nJumlah putus Pengesahan Anak : ${jumlahPutusPengesahanAnak} \nJumlah putus Pembatalan Pernikahan : ${jumlahPutusPembatalanPernikahan} \nJumlah putus Lain-Lain : ${jumlahPutusLainLain} \n\n*Sisa : ${sisaTahunIni}* \n*Rasio Penanganan Perkara  : ${rasioDisplay}%*`;

  return message;
};

const getBelumBhtBanding = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT nomor_perkara, putusan_banding, pemberitahuan_putusan_banding from v_perkara_detil join perkara_putusan on v_perkara_detil.perkara_id=perkara_putusan.perkara_id where pemberitahuan_putusan_banding IS NOT NULL AND tanggal_bht is null and permohonan_kasasi IS NULL AND year(pemberitahuan_putusan_banding)>=2021`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${
                r.nomor_perkara
              }\nTanggal Putusan Banding : ${moment(r.putusan_banding).format(
                "DD-MM-YYYY"
              )}\nTanggal Pemberitahuan putusan Banding : ${moment(
                r.pemberitahuan_putusan_banding
              ).format("DD-MM-YYYY")}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getBelumBhtKasasi = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT nomor_perkara, putusan_kasasi, pemberitahuan_putusan_kasasi from v_perkara_detil join perkara_putusan on v_perkara_detil.perkara_id=perkara_putusan.perkara_id where pemberitahuan_putusan_kasasi IS NOT NULL AND tanggal_bht is null AND year(pemberitahuan_putusan_kasasi)>=2021`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${
                r.nomor_perkara
              }\nTanggal Putusan Kasasi : ${moment(r.putusan_kasasi).format(
                "DD-MM-YYYY"
              )}\nTanggal Pemberitahuan Putusan Kasasi : ${moment(
                r.pemberitahuan_putusan_kasasi
              ).format("DD-MM-YYYY")}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getBelumPanggilan = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT
    perk.nomor_perkara,
    perk.perkara_id,
    perk.alur_perkara_id,
    perk.jenis_perkara_nama,
    alur.nama AS nama_alur,
    CASE
        WHEN k.perkara_id IS NOT NULL THEN " (*E-Court*)" 
        ELSE ""
    END AS ecourt,
    CASE
        WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
        ELSE ''
    END AS ghaib,
    CASE
        WHEN perk.prodeo = 1 THEN ' (_Prodeo_)'
        ELSE ''
    END AS prodeo,
    (
        SELECT
            GROUP_CONCAT(
                DISTINCT hkpn.nama_gelar
                ORDER BY
                    hk.id ASC SEPARATOR ' \n'
            ) AS nama_hakim
        FROM
            perkara_hakim_pn AS hk
            JOIN hakim_pn AS hkpn ON hkpn.id = hk.hakim_id
        WHERE
            hk.perkara_id = perk.perkara_id
            AND hk.aktif = 'Y'
        ORDER BY
            hk.urutan ASC
    ) AS majelis_hakim,
    (
        SELECT
            GROUP_CONCAT(
                DISTINCT pp.nama
                ORDER BY
                    ppp.id ASC SEPARATOR '<br>'
            ) AS nama_js
        FROM
            perkara_panitera_pn AS ppp
            JOIN panitera_pn AS pp ON pp.id = ppp.panitera_id
        WHERE
            ppp.perkara_id = perk.perkara_id
            AND ppp.aktif = 'Y'
        ORDER BY
            ppp.urutan ASC
    ) AS panitera_nama,
    (
        SELECT
            GROUP_CONCAT(
                DISTINCT jspn.nama
                ORDER BY
                    pjs.id ASC SEPARATOR '<br>'
            ) AS nama_js
        FROM
            perkara_jurusita AS pjs
            JOIN jurusita AS jspn ON jspn.id = pjs.jurusita_id
        WHERE
            pjs.perkara_id = perk.perkara_id
            AND pjs.aktif = 'Y'
        ORDER BY
            pjs.urutan ASC
    ) AS jurusita,
    sidang.id AS sidang_id,
    DATE_FORMAT(sidang.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
    sidang.agenda,
    perkarapihak.pihak_id,
    perkarapihak.nama AS nama_pihak,
    perkarapihak.pihakke,
    perkarapihak.ketpihak,
    perkarapihak.pengacara_pihak_id,
    datarelaas.id AS relaas_id,
    DATE_FORMAT(datarelaas.tanggal_relaas, '%d-%m-%Y') AS tanggal_relaas,
    datarelaas.doc_relaas,
    sidang.urutan,
    jadwalsidang.urutan AS urutan_sebelumnya,
    jadwalsidang.dihadiri_oleh AS status_kehadiran_sebelumnya,
    (
        CASE
            WHEN(phs.tahapan_id = 12) THEN 'Y'
            ELSE 'T'
        END
    ) AS sidang_pertama
  FROM
    perkara AS perk
    JOIN perkara_jadwal_sidang AS sidang ON sidang.perkara_id = perk.perkara_id
    JOIN (
        SELECT
            p1.perkara_id,
            p1.pihak_id,
            p1.nama,
            1 AS pihakke,
            'pihak p' AS ketpihak,
            '' AS pengacara_pihak_id
        FROM
            perkara_pihak1 AS p1
            JOIN perkara ON perkara.perkara_id = p1.perkara_id
        WHERE
            alur_perkara_id < 111
        UNION
        SELECT
            p2.perkara_id,
            p2.pihak_id,
            p2.nama,
            2 AS pihakke,
            'pihak t' AS ketpihak,
            '' AS pengacara_pihak_id
        FROM
            perkara_pihak2 AS p2
            JOIN perkara ON perkara.perkara_id = p2.perkara_id
        WHERE
            alur_perkara_id < 111
            AND (
                status_penahanan_id IS NULL
                OR status_penahanan_id = 0
            )
            AND (
                jenis_tahanan_id = 0
                OR jenis_tahanan_id IS NULL
            )
        UNION
        SELECT
            p3.perkara_id,
            p3.pihak_id,
            p3.nama,
            3 AS pihakke,
            'intervensi' AS ketpihak,
            '' AS pengacara_pihak_id
        FROM
            perkara_pihak3 AS p3
        UNION
        SELECT
            p4.perkara_id,
            p4.pihak_id,
            p4.nama,
            4 AS pihakke,
            'turut' AS ketpihak,
            '' AS pengacara_pihak_id
        FROM
            perkara_pihak4 AS p4
        UNION
        SELECT
            p5.perkara_id,
            p5.pengacara_id,
            p5.nama,
            p5.pihak_ke AS pihhkke,
            'pengacara' AS ketpihak,
            p5.pihak_id AS pengacara_pihak_id
        FROM
            perkara_pengacara AS p5
    ) AS perkarapihak ON perkarapihak.perkara_id = perk.perkara_id
    LEFT JOIN perkara_pelaksanaan_relaas AS datarelaas ON datarelaas.pihak_id = perkarapihak.pihak_id
    AND datarelaas.perkara_id = perk.perkara_id
    AND datarelaas.sidang_id = sidang.id
    LEFT JOIN 
      perkara_efiling_id AS k ON perk.perkara_id = k.perkara_id
    LEFT JOIN 
      (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i 
      ON perk.perkara_id = i.perkara_id
    LEFT JOIN (
        SELECT
            perkara.perkara_id AS perkara_id,
            perkara_jadwal_sidang.urutan AS urutan,
            perkara_jadwal_sidang.dihadiri_oleh
        FROM
            perkara
            JOIN perkara_jadwal_sidang ON (
                perkara_jadwal_sidang.perkara_id = perkara.perkara_id
            )
    ) AS jadwalsidang ON (
        jadwalsidang.perkara_id = perk.perkara_id
        AND jadwalsidang.urutan = sidang.urutan - 1
    )
    LEFT JOIN perkara_penetapan_hari_sidang AS phs ON (
        phs.perkara_id = perk.perkara_id
        AND phs.jadwalsidang_id = sidang.id
    )
    JOIN alur_perkara AS alur ON alur.id = perk.alur_perkara_id
    LEFT JOIN perkara_putusan AS q ON perk.perkara_id = q.perkara_id
  WHERE
    YEAR(perk.tanggal_pendaftaran) = YEAR(CURDATE())
    AND perk.alur_perkara_id < 111
    AND perkarapihak.pihak_id NOT IN (
        SELECT
            pp.pihak_id
        FROM
            perkara_pelaksanaan_relaas
            JOIN perkara_pengacara AS pp ON pp.pengacara_id = perkara_pelaksanaan_relaas.pihak_id
            AND pp.perkara_id = perkara_pelaksanaan_relaas.perkara_id
            JOIN perkara ON pp.perkara_id = perkara.perkara_id
        WHERE
            perk.alur_perkara_id < 111
            AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
            AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
            AND (
                perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL
                OR perkara_pelaksanaan_relaas.tanggal_relaas <> ''
            )
            AND (
                perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL
                OR perkara_pelaksanaan_relaas.doc_relaas <> ''
            )
        UNION
        SELECT
            ppb.pengacara_id
        FROM
            perkara_pelaksanaan_relaas
            JOIN perkara_pengacara AS ppb ON ppb.pihak_id = perkara_pelaksanaan_relaas.pihak_id
            AND ppb.perkara_id = perkara_pelaksanaan_relaas.perkara_id
            JOIN perkara ON ppb.perkara_id = perkara.perkara_id
        WHERE
            perk.alur_perkara_id < 111
            AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
            AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
            AND (
                perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL
                OR perkara_pelaksanaan_relaas.tanggal_relaas <> ''
            )
            AND (
                perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL
                OR perkara_pelaksanaan_relaas.doc_relaas <> ''
            )
    )
    AND (
        (
            datarelaas.tanggal_relaas IS NULL
            OR datarelaas.tanggal_relaas = ''
        )
        OR (
            datarelaas.doc_relaas IS NULL
            OR datarelaas.doc_relaas = ''
        )
    )
    AND(
        perk.alur_perkara_id >= 1
        AND perk.alur_perkara_id <= 17
    )
    AND (
        (jadwalsidang.dihadiri_oleh <> 1)
        AND (
            jadwalsidang.dihadiri_oleh = 2
            AND (
                perkarapihak.pihakke = 2
                OR perkarapihak.pihakke = 4
            )
        )
        OR (
            jadwalsidang.dihadiri_oleh = 3
            AND perkarapihak.pihakke = 1
        )
        OR (
            jadwalsidang.dihadiri_oleh = 4
            OR jadwalsidang.dihadiri_oleh IS NULL
        )
    )
    AND sidang.agenda NOT LIKE '%elektronik%'
    AND sidang.agenda NOT LIKE '%putusan%'
    AND sidang.agenda NOT LIKE '%penetapan%'
    ORDER BY jurusita ASC, q.amar_putusan IS NULL DESC, sidang.tanggal_sidang ASC, perk.perkara_id DESC`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
       } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
           result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nTanggal Sidang : ${r.tanggal_sidang}\nNama Pihak : ${r.nama_pihak}\n*Jurusita : ${r.jurusita}*`
                    );
                  });
            responseMessage = resultArray.join("\n\n");
          } else {
            responseMessage = `Tidak ada data`;
                }
        resolve(responseMessage);
      }
    });
  });
};

const getBelumPanggilanHariSidang = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT
    perk.nomor_perkara,
    perk.perkara_id,
    perk.alur_perkara_id,
    perk.jenis_perkara_nama,
    alur.nama AS nama_alur,
    CASE
        WHEN k.perkara_id IS NOT NULL THEN " (*E-Court*)" 
        ELSE ""
    END AS ecourt,
    CASE
        WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
        ELSE ''
    END AS ghaib,
    CASE
        WHEN perk.prodeo = 1 THEN ' (_Prodeo_)'
        ELSE ''
    END AS prodeo,
    (
        SELECT
            GROUP_CONCAT(
                DISTINCT hkpn.nama_gelar
                ORDER BY
                    hk.id ASC SEPARATOR ' \n'
            ) AS nama_hakim
        FROM
            perkara_hakim_pn AS hk
            JOIN hakim_pn AS hkpn ON hkpn.id = hk.hakim_id
        WHERE
            hk.perkara_id = perk.perkara_id
            AND hk.aktif = 'Y'
        ORDER BY
            hk.urutan ASC
    ) AS majelis_hakim,
    (
        SELECT
            GROUP_CONCAT(
                DISTINCT pp.nama
                ORDER BY
                    ppp.id ASC SEPARATOR '<br>'
            ) AS nama_js
        FROM
            perkara_panitera_pn AS ppp
            JOIN panitera_pn AS pp ON pp.id = ppp.panitera_id
        WHERE
            ppp.perkara_id = perk.perkara_id
            AND ppp.aktif = 'Y'
        ORDER BY
            ppp.urutan ASC
    ) AS panitera_nama,
    (
        SELECT
            GROUP_CONCAT(
                DISTINCT jspn.nama
                ORDER BY
                    pjs.id ASC SEPARATOR '<br>'
            ) AS nama_js
        FROM
            perkara_jurusita AS pjs
            JOIN jurusita AS jspn ON jspn.id = pjs.jurusita_id
        WHERE
            pjs.perkara_id = perk.perkara_id
            AND pjs.aktif = 'Y'
        ORDER BY
            pjs.urutan ASC
    ) AS jurusita,
    sidang.id AS sidang_id,
    DATE_FORMAT(sidang.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
    sidang.agenda,
    perkarapihak.pihak_id,
    perkarapihak.nama AS nama_pihak,
    perkarapihak.pihakke,
    perkarapihak.ketpihak,
    perkarapihak.pengacara_pihak_id,
    datarelaas.id AS relaas_id,
    DATE_FORMAT(datarelaas.tanggal_relaas, '%d-%m-%Y') AS tanggal_relaas,
    datarelaas.doc_relaas,
    sidang.urutan,
    jadwalsidang.urutan AS urutan_sebelumnya,
    jadwalsidang.dihadiri_oleh AS status_kehadiran_sebelumnya,
    (
        CASE
            WHEN(phs.tahapan_id = 12) THEN 'Y'
            ELSE 'T'
        END
    ) AS sidang_pertama
  FROM
    perkara AS perk
    JOIN perkara_jadwal_sidang AS sidang ON sidang.perkara_id = perk.perkara_id
    JOIN (
        SELECT
            p1.perkara_id,
            p1.pihak_id,
            p1.nama,
            1 AS pihakke,
            'pihak p' AS ketpihak,
            '' AS pengacara_pihak_id
        FROM
            perkara_pihak1 AS p1
            JOIN perkara ON perkara.perkara_id = p1.perkara_id
        WHERE
            alur_perkara_id < 111
        UNION
        SELECT
            p2.perkara_id,
            p2.pihak_id,
            p2.nama,
            2 AS pihakke,
            'pihak t' AS ketpihak,
            '' AS pengacara_pihak_id
        FROM
            perkara_pihak2 AS p2
            JOIN perkara ON perkara.perkara_id = p2.perkara_id
        WHERE
            alur_perkara_id < 111
            AND (
                status_penahanan_id IS NULL
                OR status_penahanan_id = 0
            )
            AND (
                jenis_tahanan_id = 0
                OR jenis_tahanan_id IS NULL
            )
        UNION
        SELECT
            p3.perkara_id,
            p3.pihak_id,
            p3.nama,
            3 AS pihakke,
            'intervensi' AS ketpihak,
            '' AS pengacara_pihak_id
        FROM
            perkara_pihak3 AS p3
        UNION
        SELECT
            p4.perkara_id,
            p4.pihak_id,
            p4.nama,
            4 AS pihakke,
            'turut' AS ketpihak,
            '' AS pengacara_pihak_id
        FROM
            perkara_pihak4 AS p4
        UNION
        SELECT
            p5.perkara_id,
            p5.pengacara_id,
            p5.nama,
            p5.pihak_ke AS pihhkke,
            'pengacara' AS ketpihak,
            p5.pihak_id AS pengacara_pihak_id
        FROM
            perkara_pengacara AS p5
    ) AS perkarapihak ON perkarapihak.perkara_id = perk.perkara_id
    LEFT JOIN perkara_pelaksanaan_relaas AS datarelaas ON datarelaas.pihak_id = perkarapihak.pihak_id
    AND datarelaas.perkara_id = perk.perkara_id
    AND datarelaas.sidang_id = sidang.id
    LEFT JOIN 
      perkara_efiling_id AS k ON perk.perkara_id = k.perkara_id
    LEFT JOIN 
      (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i 
      ON perk.perkara_id = i.perkara_id
    LEFT JOIN (
        SELECT
            perkara.perkara_id AS perkara_id,
            perkara_jadwal_sidang.urutan AS urutan,
            perkara_jadwal_sidang.dihadiri_oleh
        FROM
            perkara
            JOIN perkara_jadwal_sidang ON (
                perkara_jadwal_sidang.perkara_id = perkara.perkara_id
            )
    ) AS jadwalsidang ON (
        jadwalsidang.perkara_id = perk.perkara_id
        AND jadwalsidang.urutan = sidang.urutan - 1
    )
    LEFT JOIN perkara_penetapan_hari_sidang AS phs ON (
        phs.perkara_id = perk.perkara_id
        AND phs.jadwalsidang_id = sidang.id
    )
    JOIN alur_perkara AS alur ON alur.id = perk.alur_perkara_id
  WHERE
    YEAR(perk.tanggal_pendaftaran) = YEAR(CURDATE())
    AND perk.alur_perkara_id < 111
    AND perkarapihak.pihak_id NOT IN (
        SELECT
            pp.pihak_id
        FROM
            perkara_pelaksanaan_relaas
            JOIN perkara_pengacara AS pp ON pp.pengacara_id = perkara_pelaksanaan_relaas.pihak_id
            AND pp.perkara_id = perkara_pelaksanaan_relaas.perkara_id
            JOIN perkara ON pp.perkara_id = perkara.perkara_id
        WHERE
            perk.alur_perkara_id < 111
            AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
            AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
            AND (
                perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL
                OR perkara_pelaksanaan_relaas.tanggal_relaas <> ''
            )
            AND (
                perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL
                OR perkara_pelaksanaan_relaas.doc_relaas <> ''
            )
        UNION
        SELECT
            ppb.pengacara_id
        FROM
            perkara_pelaksanaan_relaas
            JOIN perkara_pengacara AS ppb ON ppb.pihak_id = perkara_pelaksanaan_relaas.pihak_id
            AND ppb.perkara_id = perkara_pelaksanaan_relaas.perkara_id
            JOIN perkara ON ppb.perkara_id = perkara.perkara_id
        WHERE
            perk.alur_perkara_id < 111
            AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
            AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
            AND (
                perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL
                OR perkara_pelaksanaan_relaas.tanggal_relaas <> ''
            )
            AND (
                perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL
                OR perkara_pelaksanaan_relaas.doc_relaas <> ''
            )
    )
    AND (
        (
            datarelaas.tanggal_relaas IS NULL
            OR datarelaas.tanggal_relaas = ''
        )
        OR (
            datarelaas.doc_relaas IS NULL
            OR datarelaas.doc_relaas = ''
        )
    )
    AND(
        perk.alur_perkara_id >= 1
        AND perk.alur_perkara_id <= 17
    )
    AND (
        (jadwalsidang.dihadiri_oleh <> 1)
        AND (
            jadwalsidang.dihadiri_oleh = 2
            AND (
                perkarapihak.pihakke = 2
                OR perkarapihak.pihakke = 4
            )
        )
        OR (
            jadwalsidang.dihadiri_oleh = 3
            AND perkarapihak.pihakke = 1
        )
        OR (
            jadwalsidang.dihadiri_oleh = 4
            OR jadwalsidang.dihadiri_oleh IS NULL
        )
    )
  AND sidang.tanggal_sidang = CURDATE()
  AND sidang.agenda NOT LIKE '%elektronik%'
  AND sidang.agenda NOT LIKE '%putusan%'
  AND sidang.agenda NOT LIKE '%penetapan%'
  ORDER BY
    perk.perkara_id DESC,
    sidang.tanggal_sidang ASC`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
       } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
           result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nTanggal Sidang : ${r.tanggal_sidang}\nNama Pihak : ${r.nama_pihak}\n*Jurusita : ${r.jurusita}*`
                    );
                  });
            responseMessage = resultArray.join("\n\n");
          } else {
            responseMessage = `Tidak ada data`;
                }
        resolve(responseMessage);
      }
    });
  });
};

const getBelumPanggilanSebelumHariSidang = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT
    perk.nomor_perkara,
    perk.perkara_id,
    perk.alur_perkara_id,
    perk.jenis_perkara_nama,
    alur.nama AS nama_alur,
    CASE
        WHEN k.perkara_id IS NOT NULL THEN " (*E-Court*)" 
        ELSE ""
    END AS ecourt,
    CASE
        WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
        ELSE ''
    END AS ghaib,
    CASE
        WHEN perk.prodeo = 1 THEN ' (_Prodeo_)'
        ELSE ''
    END AS prodeo,
    (
        SELECT
            GROUP_CONCAT(
                DISTINCT hkpn.nama_gelar
                ORDER BY
                    hk.id ASC SEPARATOR ' \n'
            ) AS nama_hakim
        FROM
            perkara_hakim_pn AS hk
            JOIN hakim_pn AS hkpn ON hkpn.id = hk.hakim_id
        WHERE
            hk.perkara_id = perk.perkara_id
            AND hk.aktif = 'Y'
        ORDER BY
            hk.urutan ASC
    ) AS majelis_hakim,
    (
        SELECT
            GROUP_CONCAT(
                DISTINCT pp.nama
                ORDER BY
                    ppp.id ASC SEPARATOR '<br>'
            ) AS nama_js
        FROM
            perkara_panitera_pn AS ppp
            JOIN panitera_pn AS pp ON pp.id = ppp.panitera_id
        WHERE
            ppp.perkara_id = perk.perkara_id
            AND ppp.aktif = 'Y'
        ORDER BY
            ppp.urutan ASC
    ) AS panitera_nama,
    (
        SELECT
            GROUP_CONCAT(
                DISTINCT jspn.nama
                ORDER BY
                    pjs.id ASC SEPARATOR '<br>'
            ) AS nama_js
        FROM
            perkara_jurusita AS pjs
            JOIN jurusita AS jspn ON jspn.id = pjs.jurusita_id
        WHERE
            pjs.perkara_id = perk.perkara_id
            AND pjs.aktif = 'Y'
        ORDER BY
            pjs.urutan ASC
    ) AS jurusita,
    sidang.id AS sidang_id,
    DATE_FORMAT(sidang.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
    sidang.agenda,
    perkarapihak.pihak_id,
    perkarapihak.nama AS nama_pihak,
    perkarapihak.pihakke,
    perkarapihak.ketpihak,
    perkarapihak.pengacara_pihak_id,
    datarelaas.id AS relaas_id,
    DATE_FORMAT(datarelaas.tanggal_relaas, '%d-%m-%Y') AS tanggal_relaas,
    datarelaas.doc_relaas,
    sidang.urutan,
    jadwalsidang.urutan AS urutan_sebelumnya,
    jadwalsidang.dihadiri_oleh AS status_kehadiran_sebelumnya,
    (
        CASE
            WHEN(phs.tahapan_id = 12) THEN 'Y'
            ELSE 'T'
        END
    ) AS sidang_pertama
  FROM
    perkara AS perk
    JOIN perkara_jadwal_sidang AS sidang ON sidang.perkara_id = perk.perkara_id
    JOIN (
        SELECT
            p1.perkara_id,
            p1.pihak_id,
            p1.nama,
            1 AS pihakke,
            'pihak p' AS ketpihak,
            '' AS pengacara_pihak_id
        FROM
            perkara_pihak1 AS p1
            JOIN perkara ON perkara.perkara_id = p1.perkara_id
        WHERE
            alur_perkara_id < 111
        UNION
        SELECT
            p2.perkara_id,
            p2.pihak_id,
            p2.nama,
            2 AS pihakke,
            'pihak t' AS ketpihak,
            '' AS pengacara_pihak_id
        FROM
            perkara_pihak2 AS p2
            JOIN perkara ON perkara.perkara_id = p2.perkara_id
        WHERE
            alur_perkara_id < 111
            AND (
                status_penahanan_id IS NULL
                OR status_penahanan_id = 0
            )
            AND (
                jenis_tahanan_id = 0
                OR jenis_tahanan_id IS NULL
            )
        UNION
        SELECT
            p3.perkara_id,
            p3.pihak_id,
            p3.nama,
            3 AS pihakke,
            'intervensi' AS ketpihak,
            '' AS pengacara_pihak_id
        FROM
            perkara_pihak3 AS p3
        UNION
        SELECT
            p4.perkara_id,
            p4.pihak_id,
            p4.nama,
            4 AS pihakke,
            'turut' AS ketpihak,
            '' AS pengacara_pihak_id
        FROM
            perkara_pihak4 AS p4
        UNION
        SELECT
            p5.perkara_id,
            p5.pengacara_id,
            p5.nama,
            p5.pihak_ke AS pihhkke,
            'pengacara' AS ketpihak,
            p5.pihak_id AS pengacara_pihak_id
        FROM
            perkara_pengacara AS p5
    ) AS perkarapihak ON perkarapihak.perkara_id = perk.perkara_id
    LEFT JOIN perkara_pelaksanaan_relaas AS datarelaas ON datarelaas.pihak_id = perkarapihak.pihak_id
    AND datarelaas.perkara_id = perk.perkara_id
    AND datarelaas.sidang_id = sidang.id
    LEFT JOIN 
      perkara_efiling_id AS k ON perk.perkara_id = k.perkara_id
    LEFT JOIN 
      (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i 
      ON perk.perkara_id = i.perkara_id
    LEFT JOIN (
        SELECT
            perkara.perkara_id AS perkara_id,
            perkara_jadwal_sidang.urutan AS urutan,
            perkara_jadwal_sidang.dihadiri_oleh
        FROM
            perkara
            JOIN perkara_jadwal_sidang ON (
                perkara_jadwal_sidang.perkara_id = perkara.perkara_id
            )
    ) AS jadwalsidang ON (
        jadwalsidang.perkara_id = perk.perkara_id
        AND jadwalsidang.urutan = sidang.urutan - 1
    )
    LEFT JOIN perkara_penetapan_hari_sidang AS phs ON (
        phs.perkara_id = perk.perkara_id
        AND phs.jadwalsidang_id = sidang.id
    )
    JOIN alur_perkara AS alur ON alur.id = perk.alur_perkara_id
  WHERE
    YEAR(perk.tanggal_pendaftaran) = YEAR(CURDATE())
    AND perk.alur_perkara_id < 111
    AND perkarapihak.pihak_id NOT IN (
        SELECT
            pp.pihak_id
        FROM
            perkara_pelaksanaan_relaas
            JOIN perkara_pengacara AS pp ON pp.pengacara_id = perkara_pelaksanaan_relaas.pihak_id
            AND pp.perkara_id = perkara_pelaksanaan_relaas.perkara_id
            JOIN perkara ON pp.perkara_id = perkara.perkara_id
        WHERE
            perk.alur_perkara_id < 111
            AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
            AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
            AND (
                perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL
                OR perkara_pelaksanaan_relaas.tanggal_relaas <> ''
            )
            AND (
                perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL
                OR perkara_pelaksanaan_relaas.doc_relaas <> ''
            )
        UNION
        SELECT
            ppb.pengacara_id
        FROM
            perkara_pelaksanaan_relaas
            JOIN perkara_pengacara AS ppb ON ppb.pihak_id = perkara_pelaksanaan_relaas.pihak_id
            AND ppb.perkara_id = perkara_pelaksanaan_relaas.perkara_id
            JOIN perkara ON ppb.perkara_id = perkara.perkara_id
        WHERE
            perk.alur_perkara_id < 111
            AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
            AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
            AND (
                perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL
                OR perkara_pelaksanaan_relaas.tanggal_relaas <> ''
            )
            AND (
                perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL
                OR perkara_pelaksanaan_relaas.doc_relaas <> ''
            )
    )
    AND (
        (
            datarelaas.tanggal_relaas IS NULL
            OR datarelaas.tanggal_relaas = ''
        )
        OR (
            datarelaas.doc_relaas IS NULL
            OR datarelaas.doc_relaas = ''
        )
    )
    AND(
        perk.alur_perkara_id >= 1
        AND perk.alur_perkara_id <= 17
    )
    AND (
        (jadwalsidang.dihadiri_oleh <> 1)
        AND (
            jadwalsidang.dihadiri_oleh = 2
            AND (
                perkarapihak.pihakke = 2
                OR perkarapihak.pihakke = 4
            )
        )
        OR (
            jadwalsidang.dihadiri_oleh = 3
            AND perkarapihak.pihakke = 1
        )
        OR (
            jadwalsidang.dihadiri_oleh = 4
            OR jadwalsidang.dihadiri_oleh IS NULL
        )
    )
  AND sidang.tanggal_sidang = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
  AND sidang.agenda NOT LIKE '%elektronik%'
  AND sidang.agenda NOT LIKE '%putusan%'
  AND sidang.agenda NOT LIKE '%penetapan%'
  ORDER BY
    perk.perkara_id DESC`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
       } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
           result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nTanggal Sidang : ${r.tanggal_sidang}\nNama Pihak : ${r.nama_pihak}\n*Jurusita : ${r.jurusita}*`
                    );
                  });
            responseMessage = resultArray.join("\n\n");
          } else {
            responseMessage = `Tidak ada data`;
                }
        resolve(responseMessage);
      }
    });
  });
};

const getBelumPanggilanSidangPertama = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT
    perk.nomor_perkara,
    perk.perkara_id,
    perk.alur_perkara_id,
    perk.jenis_perkara_nama,
    alur.nama AS nama_alur,
    (
        SELECT
            GROUP_CONCAT(
                DISTINCT hkpn.nama_gelar
                ORDER BY
                    hk.id ASC SEPARATOR ' \n'
            ) AS nama_hakim
        FROM
            perkara_hakim_pn AS hk
            JOIN hakim_pn AS hkpn ON hkpn.id = hk.hakim_id
        WHERE
            hk.perkara_id = perk.perkara_id
            AND hk.aktif = 'Y'
        ORDER BY
            hk.urutan ASC
    ) AS majelis_hakim,
    (
        SELECT
            GROUP_CONCAT(
                DISTINCT pp.nama
                ORDER BY
                    ppp.id ASC SEPARATOR '<br>'
            ) AS nama_js
        FROM
            perkara_panitera_pn AS ppp
            JOIN panitera_pn AS pp ON pp.id = ppp.panitera_id
        WHERE
            ppp.perkara_id = perk.perkara_id
            AND ppp.aktif = 'Y'
        ORDER BY
            ppp.urutan ASC
    ) AS panitera_nama,
    (
        SELECT
            GROUP_CONCAT(
                DISTINCT jspn.nama
                ORDER BY
                    pjs.id ASC SEPARATOR '<br>'
            ) AS nama_js
        FROM
            perkara_jurusita AS pjs
            JOIN jurusita AS jspn ON jspn.id = pjs.jurusita_id
        WHERE
            pjs.perkara_id = perk.perkara_id
            AND pjs.aktif = 'Y'
        ORDER BY
            pjs.urutan ASC
    ) AS jurusita,
    sidang.id AS sidang_id,
    DATE_FORMAT(sidang.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
    sidang.agenda,
    perkarapihak.pihak_id,
    perkarapihak.nama AS nama_pihak,
    perkarapihak.pihakke,
    perkarapihak.ketpihak,
    perkarapihak.pengacara_pihak_id,
    datarelaas.id AS relaas_id,
    DATE_FORMAT(datarelaas.tanggal_relaas, '%d-%m-%Y') AS tanggal_relaas,
    datarelaas.doc_relaas,
    sidang.urutan,
    jadwalsidang.urutan AS urutan_sebelumnya,
    jadwalsidang.dihadiri_oleh AS status_kehadiran_sebelumnya,
    (
        CASE
            WHEN(phs.tahapan_id = 12) THEN 'Y'
            ELSE 'T'
        END
    ) AS sidang_pertama
  FROM
    perkara AS perk
    JOIN perkara_jadwal_sidang AS sidang ON sidang.perkara_id = perk.perkara_id
    JOIN (
        SELECT
            p1.perkara_id,
            p1.pihak_id,
            p1.nama,
            1 AS pihakke,
            'pihak p' AS ketpihak,
            '' AS pengacara_pihak_id
        FROM
            perkara_pihak1 AS p1
            JOIN perkara ON perkara.perkara_id = p1.perkara_id
        WHERE
            alur_perkara_id < 111
        UNION
        SELECT
            p2.perkara_id,
            p2.pihak_id,
            p2.nama,
            2 AS pihakke,
            'pihak t' AS ketpihak,
            '' AS pengacara_pihak_id
        FROM
            perkara_pihak2 AS p2
            JOIN perkara ON perkara.perkara_id = p2.perkara_id
        WHERE
            alur_perkara_id < 111
            AND (
                status_penahanan_id IS NULL
                OR status_penahanan_id = 0
            )
            AND (
                jenis_tahanan_id = 0
                OR jenis_tahanan_id IS NULL
            )
        UNION
        SELECT
            p3.perkara_id,
            p3.pihak_id,
            p3.nama,
            3 AS pihakke,
            'intervensi' AS ketpihak,
            '' AS pengacara_pihak_id
        FROM
            perkara_pihak3 AS p3
        UNION
        SELECT
            p4.perkara_id,
            p4.pihak_id,
            p4.nama,
            4 AS pihakke,
            'turut' AS ketpihak,
            '' AS pengacara_pihak_id
        FROM
            perkara_pihak4 AS p4
        UNION
        SELECT
            p5.perkara_id,
            p5.pengacara_id,
            p5.nama,
            p5.pihak_ke AS pihhkke,
            'pengacara' AS ketpihak,
            p5.pihak_id AS pengacara_pihak_id
        FROM
            perkara_pengacara AS p5
    ) AS perkarapihak ON perkarapihak.perkara_id = perk.perkara_id
    LEFT JOIN perkara_pelaksanaan_relaas AS datarelaas ON datarelaas.pihak_id = perkarapihak.pihak_id
    AND datarelaas.perkara_id = perk.perkara_id
    AND datarelaas.sidang_id = sidang.id
    LEFT JOIN (
        SELECT
            perkara.perkara_id AS perkara_id,
            perkara_jadwal_sidang.urutan AS urutan,
            perkara_jadwal_sidang.dihadiri_oleh
        FROM
            perkara
            JOIN perkara_jadwal_sidang ON (
                perkara_jadwal_sidang.perkara_id = perkara.perkara_id
            )
    ) AS jadwalsidang ON (
        jadwalsidang.perkara_id = perk.perkara_id
        AND jadwalsidang.urutan = sidang.urutan - 1
    )
    LEFT JOIN perkara_penetapan_hari_sidang AS phs ON (
        phs.perkara_id = perk.perkara_id
        AND phs.jadwalsidang_id = sidang.id
    )
    JOIN alur_perkara AS alur ON alur.id = perk.alur_perkara_id
  WHERE
    YEAR(perk.tanggal_pendaftaran) = YEAR(CURDATE())
    AND perk.alur_perkara_id < 111
    AND perkarapihak.pihak_id NOT IN (
        SELECT
            pp.pihak_id
        FROM
            perkara_pelaksanaan_relaas
            JOIN perkara_pengacara AS pp ON pp.pengacara_id = perkara_pelaksanaan_relaas.pihak_id
            AND pp.perkara_id = perkara_pelaksanaan_relaas.perkara_id
            JOIN perkara ON pp.perkara_id = perkara.perkara_id
        WHERE
            perk.alur_perkara_id < 111
            AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
            AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
            AND (
                perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL
                OR perkara_pelaksanaan_relaas.tanggal_relaas <> ''
            )
            AND (
                perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL
                OR perkara_pelaksanaan_relaas.doc_relaas <> ''
            )
        UNION
        SELECT
            ppb.pengacara_id
        FROM
            perkara_pelaksanaan_relaas
            JOIN perkara_pengacara AS ppb ON ppb.pihak_id = perkara_pelaksanaan_relaas.pihak_id
            AND ppb.perkara_id = perkara_pelaksanaan_relaas.perkara_id
            JOIN perkara ON ppb.perkara_id = perkara.perkara_id
        WHERE
            perk.alur_perkara_id < 111
            AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
            AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
            AND (
                perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL
                OR perkara_pelaksanaan_relaas.tanggal_relaas <> ''
            )
            AND (
                perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL
                OR perkara_pelaksanaan_relaas.doc_relaas <> ''
            )
    )
    AND (
        (
            datarelaas.tanggal_relaas IS NULL
            OR datarelaas.tanggal_relaas = ''
        )
        OR (
            datarelaas.doc_relaas IS NULL
            OR datarelaas.doc_relaas = ''
        )
    )
    AND(
        perk.alur_perkara_id >= 1
        AND perk.alur_perkara_id <= 17
    )
    AND (
        (jadwalsidang.dihadiri_oleh <> 1)
        AND (
            jadwalsidang.dihadiri_oleh = 2
            AND (
                perkarapihak.pihakke = 2
                OR perkarapihak.pihakke = 4
            )
        )
        OR (
            jadwalsidang.dihadiri_oleh = 3
            AND perkarapihak.pihakke = 1
        )
        OR (
            jadwalsidang.dihadiri_oleh = 4
            OR jadwalsidang.dihadiri_oleh IS NULL
        )
    )
    AND DATEDIFF(CURRENT_DATE, sidang.tanggal_sidang) >= -5
    AND sidang.urutan = 1
    AND sidang.agenda NOT LIKE '%elektronik%'
    AND sidang.agenda NOT LIKE '%putusan%'
    AND sidang.agenda NOT LIKE '%penetapan%'
  ORDER BY
    perk.perkara_id DESC,
    sidang.tanggal_sidang ASC`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nTanggal Sidang : ${r.tanggal_sidang}\nNama Pihak : ${r.nama_pihak}\n*Jurusita : ${r.jurusita}*\nPanitera : ${r.panitera_nama}`
                    );
                  });
            responseMessage = resultArray.join("\n\n");
          } else {
            responseMessage = `Tidak ada data`;
                }
        resolve(responseMessage);
      }
    });
  });
};

const getPanggilanTidakPatut = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT
    perk.perkara_id,
		perk.nomor_perkara,
    perk.jenis_perkara_nama,
    CASE
        WHEN k.perkara_id IS NOT NULL THEN " (E-Court)" 
        ELSE ""
    END AS ecourt,
    CASE
        WHEN i.perkara_id IS NOT NULL THEN ' (Ghaib)'
        ELSE ''
    END AS ghaib,
    CASE
        WHEN perk.prodeo = 1 THEN ' (Prodeo)'
        ELSE ''
    END AS prodeo,
    (
        SELECT
            GROUP_CONCAT(
                DISTINCT hkpn.nama_gelar
                ORDER BY
                    hk.id ASC SEPARATOR ' \n'
            ) AS nama_hakim
        FROM
            perkara_hakim_pn AS hk
            JOIN hakim_pn AS hkpn ON hkpn.id = hk.hakim_id
        WHERE
            hk.perkara_id = perk.perkara_id
            AND hk.aktif = 'Y'
        ORDER BY
            hk.urutan ASC
    ) AS majelis_hakim,
    (
        SELECT
            GROUP_CONCAT(
                DISTINCT pp.nama
                ORDER BY
                    ppp.id ASC SEPARATOR '<br>'
            ) AS nama_js
        FROM
            perkara_panitera_pn AS ppp
            JOIN panitera_pn AS pp ON pp.id = ppp.panitera_id
        WHERE
            ppp.perkara_id = perk.perkara_id
            AND ppp.aktif = 'Y'
        ORDER BY
            ppp.urutan ASC
    ) AS panitera_nama,
    (
        SELECT
            GROUP_CONCAT(
                DISTINCT jspn.nama
                ORDER BY
                    pjs.id ASC SEPARATOR '<br>'
            ) AS nama_js
        FROM
            perkara_jurusita AS pjs
            JOIN jurusita AS jspn ON jspn.id = pjs.jurusita_id
        WHERE
            pjs.perkara_id = perk.perkara_id
            AND pjs.aktif = 'Y'
        ORDER BY
            pjs.urutan ASC
    ) AS jurusita,
    perkarapihak.nama AS nama_pihak,
		sidang.agenda,
		DATE_FORMAT(sidang.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
    DATE_FORMAT(datarelaas.tanggal_relaas, '%d-%m-%Y') AS tanggal_relaas,
    DATEDIFF(sidang.tanggal_sidang, datarelaas.tanggal_relaas) AS durasi,
    datarelaas.doc_relaas,
		perkarapihak.pihakke,
    perkarapihak.ketpihak,
    sidang.urutan,
    jadwalsidang.urutan AS urutan_sebelumnya,
    jadwalsidang.dihadiri_oleh AS status_kehadiran_sebelumnya,
    (
        CASE
            WHEN(phs.tahapan_id = 12) THEN 'Y'
            ELSE 'T'
        END
    ) AS sidang_pertama,
		perkarapihak.pihak_id,
		perkarapihak.pengacara_pihak_id,
		sidang.id AS sidang_id,
		datarelaas.id AS relaas_id
  FROM
    perkara AS perk
    JOIN perkara_jadwal_sidang AS sidang ON sidang.perkara_id = perk.perkara_id
    JOIN (
        SELECT
            p1.perkara_id,
            p1.pihak_id,
            p1.nama,
            1 AS pihakke,
            'pihak p' AS ketpihak,
            '' AS pengacara_pihak_id
        FROM
            perkara_pihak1 AS p1
            JOIN perkara ON perkara.perkara_id = p1.perkara_id
        WHERE
            alur_perkara_id < 111
        UNION
        SELECT
            p2.perkara_id,
            p2.pihak_id,
            p2.nama,
            2 AS pihakke,
            'pihak t' AS ketpihak,
            '' AS pengacara_pihak_id
        FROM
            perkara_pihak2 AS p2
            JOIN perkara ON perkara.perkara_id = p2.perkara_id
        WHERE
            alur_perkara_id < 111
            AND (
                status_penahanan_id IS NULL
                OR status_penahanan_id = 0
            )
            AND (
                jenis_tahanan_id = 0
                OR jenis_tahanan_id IS NULL
            )
        UNION
        SELECT
            p3.perkara_id,
            p3.pihak_id,
            p3.nama,
            3 AS pihakke,
            'intervensi' AS ketpihak,
            '' AS pengacara_pihak_id
        FROM
            perkara_pihak3 AS p3
        UNION
        SELECT
            p4.perkara_id,
            p4.pihak_id,
            p4.nama,
            4 AS pihakke,
            'turut' AS ketpihak,
            '' AS pengacara_pihak_id
        FROM
            perkara_pihak4 AS p4
        UNION
        SELECT
            p5.perkara_id,
            p5.pengacara_id,
            p5.nama,
            p5.pihak_ke AS pihhkke,
            'pengacara' AS ketpihak,
            p5.pihak_id AS pengacara_pihak_id
        FROM
            perkara_pengacara AS p5
    ) AS perkarapihak ON perkarapihak.perkara_id = perk.perkara_id
    LEFT JOIN perkara_pelaksanaan_relaas AS datarelaas ON datarelaas.pihak_id = perkarapihak.pihak_id
    AND datarelaas.perkara_id = perk.perkara_id
    AND datarelaas.sidang_id = sidang.id
    LEFT JOIN 
      perkara_efiling_id AS k ON perk.perkara_id = k.perkara_id
    LEFT JOIN 
      (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i 
      ON perk.perkara_id = i.perkara_id
    LEFT JOIN (
        SELECT
            perkara.perkara_id AS perkara_id,
            perkara_jadwal_sidang.urutan AS urutan,
            perkara_jadwal_sidang.dihadiri_oleh
        FROM
            perkara
            JOIN perkara_jadwal_sidang ON (
                perkara_jadwal_sidang.perkara_id = perkara.perkara_id
            )
    ) AS jadwalsidang ON (
        jadwalsidang.perkara_id = perk.perkara_id
        AND jadwalsidang.urutan = sidang.urutan - 1
    )
    LEFT JOIN perkara_penetapan_hari_sidang AS phs ON (
        phs.perkara_id = perk.perkara_id
        AND phs.jadwalsidang_id = sidang.id
    )
    JOIN alur_perkara AS alur ON alur.id = perk.alur_perkara_id
    LEFT JOIN perkara_putusan AS q ON perk.perkara_id = q.perkara_id
  WHERE
    YEAR(perk.tanggal_pendaftaran) = YEAR(CURDATE())
    AND perk.alur_perkara_id < 111
    AND (
        perk.alur_perkara_id >= 1
        AND perk.alur_perkara_id <= 17
    )
    AND (
        (jadwalsidang.dihadiri_oleh <> 1)
        AND (
            jadwalsidang.dihadiri_oleh = 2
            AND (
                perkarapihak.pihakke = 2
                OR perkarapihak.pihakke = 4
            )
        )
        OR (
            jadwalsidang.dihadiri_oleh = 3
            AND perkarapihak.pihakke = 1
        )
        OR (
            jadwalsidang.dihadiri_oleh = 4
            OR jadwalsidang.dihadiri_oleh IS NULL
        )
    )
    AND (
        (
            perk.jenis_perkara_id IN (346, 347) AND k.perkara_id IS NULL
            AND datarelaas.tanggal_relaas >= DATE_ADD(sidang.tanggal_sidang, INTERVAL -3 DAY)
        )
        OR (
            perk.jenis_perkara_id NOT IN (346, 347) AND k.perkara_id IS NULL
            AND datarelaas.tanggal_relaas >= (
                CASE
                    WHEN WEEKDAY(sidang.tanggal_sidang) = 0 THEN DATE_ADD(sidang.tanggal_sidang, INTERVAL -5 DAY)
                    WHEN WEEKDAY(sidang.tanggal_sidang) = 1 THEN DATE_ADD(sidang.tanggal_sidang, INTERVAL -5 DAY)
                    WHEN WEEKDAY(sidang.tanggal_sidang) = 2 THEN DATE_ADD(sidang.tanggal_sidang, INTERVAL -3 DAY)
                    WHEN WEEKDAY(sidang.tanggal_sidang) = 3 THEN DATE_ADD(sidang.tanggal_sidang, INTERVAL -3 DAY)
                    WHEN WEEKDAY(sidang.tanggal_sidang) = 4 THEN DATE_ADD(sidang.tanggal_sidang, INTERVAL -3 DAY)
                    WHEN WEEKDAY(sidang.tanggal_sidang) = 5 THEN DATE_ADD(sidang.tanggal_sidang, INTERVAL -4 DAY)
                    WHEN WEEKDAY(sidang.tanggal_sidang) = 6 THEN DATE_ADD(sidang.tanggal_sidang, INTERVAL -4 DAY)
                END
            )
        )
        OR (
            k.perkara_id IS NOT NULL AND datarelaas.no_resi_pos IS NOT NULL AND datarelaas.ket_temu = 'S'
            AND datarelaas.tanggal_jursit_pos >= DATE_ADD(sidang.tanggal_sidang, INTERVAL -6 DAY)
        )
				OR (
            k.perkara_id IS NOT NULL AND datarelaas.ket_temu = 'E'
            AND datarelaas.tanggal_relaas >= DATE_ADD(sidang.tanggal_sidang, INTERVAL -3 DAY)
        )
    )
  ORDER BY jurusita ASC, sidang.tanggal_sidang ASC, perk.perkara_id DESC`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara} (${r.durasi} hari)\nTanggal Relaas : ${r.tanggal_relaas}\nTanggal Sidang : ${r.tanggal_sidang}\n*Jurusita : ${r.jurusita}*`
                    );
                  });
            responseMessage = resultArray.join("\n\n");
          } else {
            responseMessage = `Tidak ada data`;
                }
        resolve(responseMessage);
      }
    });
  });
};

const getPanggilanPosTidakPatut = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT
    perk.perkara_id,
		perk.nomor_perkara,
    perk.jenis_perkara_nama,
    CASE
        WHEN k.perkara_id IS NOT NULL THEN " (E-Court)" 
        ELSE ""
    END AS ecourt,
    CASE
        WHEN i.perkara_id IS NOT NULL THEN ' (Ghaib)'
        ELSE ''
    END AS ghaib,
    CASE
        WHEN perk.prodeo = 1 THEN ' (Prodeo)'
        ELSE ''
    END AS prodeo,
    (
        SELECT
            GROUP_CONCAT(
                DISTINCT hkpn.nama_gelar
                ORDER BY
                    hk.id ASC SEPARATOR ' \n'
            ) AS nama_hakim
        FROM
            perkara_hakim_pn AS hk
            JOIN hakim_pn AS hkpn ON hkpn.id = hk.hakim_id
        WHERE
            hk.perkara_id = perk.perkara_id
            AND hk.aktif = 'Y'
        ORDER BY
            hk.urutan ASC
    ) AS majelis_hakim,
    (
        SELECT
            GROUP_CONCAT(
                DISTINCT pp.nama
                ORDER BY
                    ppp.id ASC SEPARATOR '<br>'
            ) AS nama_js
        FROM
            perkara_panitera_pn AS ppp
            JOIN panitera_pn AS pp ON pp.id = ppp.panitera_id
        WHERE
            ppp.perkara_id = perk.perkara_id
            AND ppp.aktif = 'Y'
        ORDER BY
            ppp.urutan ASC
    ) AS panitera_nama,
    (
        SELECT
            GROUP_CONCAT(
                DISTINCT jspn.nama
                ORDER BY
                    pjs.id ASC SEPARATOR '<br>'
            ) AS nama_js
        FROM
            perkara_jurusita AS pjs
            JOIN jurusita AS jspn ON jspn.id = pjs.jurusita_id
        WHERE
            pjs.perkara_id = perk.perkara_id
            AND pjs.aktif = 'Y'
        ORDER BY
            pjs.urutan ASC
    ) AS jurusita,
    perkarapihak.nama AS nama_pihak,
		sidang.agenda,
		DATE_FORMAT(datarelaas.tanggal_jursit_pos, '%d-%m-%Y') AS tanggal_jurusita_ke_pos,
		DATE_FORMAT(sidang.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
    DATE_FORMAT(datarelaas.tanggal_relaas, '%d-%m-%Y') AS tanggal_relaas,
    DATEDIFF(sidang.tanggal_sidang, datarelaas.tanggal_relaas) AS durasi,
    datarelaas.doc_relaas,
    datarelaas.no_resi_pos,
		perkarapihak.pihakke,
    perkarapihak.ketpihak,
    sidang.urutan,
    jadwalsidang.urutan AS urutan_sebelumnya,
    jadwalsidang.dihadiri_oleh AS status_kehadiran_sebelumnya,
    (
        CASE
            WHEN(phs.tahapan_id = 12) THEN 'Y'
            ELSE 'T'
        END
    ) AS sidang_pertama,
		perkarapihak.pihak_id,
		perkarapihak.pengacara_pihak_id,
		sidang.id AS sidang_id,
		datarelaas.id AS relaas_id
  FROM
    perkara AS perk
    JOIN perkara_jadwal_sidang AS sidang ON sidang.perkara_id = perk.perkara_id
    JOIN (
        SELECT
            p1.perkara_id,
            p1.pihak_id,
            p1.nama,
            1 AS pihakke,
            'pihak p' AS ketpihak,
            '' AS pengacara_pihak_id
        FROM
            perkara_pihak1 AS p1
            JOIN perkara ON perkara.perkara_id = p1.perkara_id
        WHERE
            alur_perkara_id < 111
        UNION
        SELECT
            p2.perkara_id,
            p2.pihak_id,
            p2.nama,
            2 AS pihakke,
            'pihak t' AS ketpihak,
            '' AS pengacara_pihak_id
        FROM
            perkara_pihak2 AS p2
            JOIN perkara ON perkara.perkara_id = p2.perkara_id
        WHERE
            alur_perkara_id < 111
            AND (
                status_penahanan_id IS NULL
                OR status_penahanan_id = 0
            )
            AND (
                jenis_tahanan_id = 0
                OR jenis_tahanan_id IS NULL
            )
        UNION
        SELECT
            p3.perkara_id,
            p3.pihak_id,
            p3.nama,
            3 AS pihakke,
            'intervensi' AS ketpihak,
            '' AS pengacara_pihak_id
        FROM
            perkara_pihak3 AS p3
        UNION
        SELECT
            p4.perkara_id,
            p4.pihak_id,
            p4.nama,
            4 AS pihakke,
            'turut' AS ketpihak,
            '' AS pengacara_pihak_id
        FROM
            perkara_pihak4 AS p4
        UNION
        SELECT
            p5.perkara_id,
            p5.pengacara_id,
            p5.nama,
            p5.pihak_ke AS pihhkke,
            'pengacara' AS ketpihak,
            p5.pihak_id AS pengacara_pihak_id
        FROM
            perkara_pengacara AS p5
    ) AS perkarapihak ON perkarapihak.perkara_id = perk.perkara_id
    LEFT JOIN perkara_pelaksanaan_relaas AS datarelaas ON datarelaas.pihak_id = perkarapihak.pihak_id
    AND datarelaas.perkara_id = perk.perkara_id
    AND datarelaas.sidang_id = sidang.id
    LEFT JOIN 
      perkara_efiling_id AS k ON perk.perkara_id = k.perkara_id
    LEFT JOIN 
      (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i 
      ON perk.perkara_id = i.perkara_id
    LEFT JOIN (
        SELECT
            perkara.perkara_id AS perkara_id,
            perkara_jadwal_sidang.urutan AS urutan,
            perkara_jadwal_sidang.dihadiri_oleh
        FROM
            perkara
            JOIN perkara_jadwal_sidang ON (
                perkara_jadwal_sidang.perkara_id = perkara.perkara_id
            )
    ) AS jadwalsidang ON (
        jadwalsidang.perkara_id = perk.perkara_id
        AND jadwalsidang.urutan = sidang.urutan - 1
    )
    LEFT JOIN perkara_penetapan_hari_sidang AS phs ON (
        phs.perkara_id = perk.perkara_id
        AND phs.jadwalsidang_id = sidang.id
    )
    JOIN alur_perkara AS alur ON alur.id = perk.alur_perkara_id
    LEFT JOIN perkara_putusan AS q ON perk.perkara_id = q.perkara_id
  WHERE
    YEAR(perk.tanggal_pendaftaran) = YEAR(CURDATE())
    AND perk.alur_perkara_id < 111
    AND (
        perk.alur_perkara_id >= 1
        AND perk.alur_perkara_id <= 17
    )
    AND (
        (jadwalsidang.dihadiri_oleh <> 1)
        AND (
            jadwalsidang.dihadiri_oleh = 2
            AND (
                perkarapihak.pihakke = 2
                OR perkarapihak.pihakke = 4
            )
        )
        OR (
            jadwalsidang.dihadiri_oleh = 3
            AND perkarapihak.pihakke = 1
        )
        OR (
            jadwalsidang.dihadiri_oleh = 4
            OR jadwalsidang.dihadiri_oleh IS NULL
        )
    )
    AND (
            k.perkara_id IS NOT NULL AND datarelaas.no_resi_pos IS NOT NULL AND datarelaas.ket_temu = 'S'
            AND datarelaas.tanggal_relaas >= DATE_ADD(sidang.tanggal_sidang, INTERVAL -3 DAY)
        )
  ORDER BY jurusita ASC, sidang.tanggal_sidang ASC, perk.perkara_id DESC`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara} (${r.durasi} hari)\nNo Resi Pos : *${r.no_resi_pos}*\nTanggal Relaas : ${r.tanggal_relaas}\nTanggal Sidang : ${r.tanggal_sidang}\nTanggal Jurusita Ke Pos : ${r.tanggal_jurusita_ke_pos}\n*Jurusita : ${r.jurusita}*`
                    );
                  });
            responseMessage = resultArray.join("\n\n");
          } else {
            responseMessage = `Tidak ada data`;
                }
        resolve(responseMessage);
      }
    });
  });
};

const getBelumEdocCourtCalendar = () => {
  return new Promise((resolve, reject) => {
    let date = new Date();
    let year = date.getFullYear();
    let query = `SELECT A.nomor_perkara, A.perkara_id, A.proses_terakhir_text, A.para_pihak FROM perkara AS A LEFT JOIN perkara_putusan AS C ON C.perkara_id=A.perkara_id LEFT JOIN perkara_edoc_calendar AS F ON F.perkara_id=A.perkara_id LEFT JOIN perkara_jadwal_sidang AS H ON H.perkara_id=A.perkara_id WHERE  YEAR(A.tanggal_pendaftaran) = ${year} AND C.tanggal_minutasi IS NULL AND H.dihadiri_oleh='1' AND TIMESTAMPDIFF(DAY,H.tanggal_sidang,NOW())>'0' AND (F.edoc_calender IS NULL OR F.edoc_calender = '') AND A.alur_perkara_id NOT IN (15,16,17) GROUP BY A.perkara_id ORDER BY A.tanggal_pendaftaran DESC`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(`${index + 1}. ${r.nomor_perkara}`);
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataBanding = () => {
  let query = `SELECT nomor_perkara_pn, permohonan_banding,  alur_perkara_id FROM v_perkara_banding WHERE pengiriman_berkas_banding IS NULL AND tanggal_cabut IS NULL`;

  return new Promise((resolve, reject) => {
    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            let jangka_waktu = 0;
            if (r.alur_perkara_id == 111) {
              jangka_waktu = 14;
            } else if (
              r.alur_perkara_id == 15 ||
              r.alur_perkara_id == 16 ||
              r.alur_perkara_id == 17
            ) {
              jangka_waktu = 30;
            }
            let tanggal_kirim = moment(r.permohonan_banding).add(
              jangka_waktu,
              "d"
            );
            resultArray.push(
              `${index + 1}. ${
                r.nomor_perkara_pn
              }\nTanggal Banding : ${moment(r.permohonan_banding).format(
                "DD-MM-YYYY"
              )}\nTanggal Terakhir Pengiriman = ${moment(tanggal_kirim).format(
                "DD-MM-YYYY"
              )}`
            );
          });
          responseMessage = resultArray.join(`\n\n`);
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataKasasi = () => {
  let query = `SELECT nomor_perkara_pn, permohonan_kasasi, alur_perkara_id FROM perkara_kasasi WHERE pengiriman_berkas_kasasi IS NULL AND tanggal_cabut IS NULL AND tidak_memenuhi_syarat IS NULL AND YEAR(permohonan_kasasi)>2021`;

  return new Promise((resolve, reject) => {
    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            let tanggal_kirim;
            if (r.alur_perkara_id == 1 || r.alur_perkara_id == 1) {
              tanggal_kirim = moment(r.permohonan_kasasi).add(65, "d");
            } else {
              tanggal_kirim = moment(r.permohonan_kasasi).add(30, "d");
            }
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara_pn}\nTanggal Kasasi : ${moment(
                r.permohonan_kasasi
              ).format("DD-MM-YYYY")}\nTanggal Terakhir Pengiriman = ${moment(
                tanggal_kirim
              ).format("DD-MM-YYYY")}`
            );
          });
          responseMessage = resultArray.join(`\n\n`);
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataPK = () => {
  let query = `SELECT nomor_perkara_pn, permohonan_pk, alur_perkara_id, pendapat_hakim, penyerahan_kontra_pk FROM perkara_pk WHERE pengiriman_berkas_pk IS NULL AND tanggal_cabut IS NULL AND tidak_memenuhi_syarat IS NULL`;

  return new Promise((resolve, reject) => {
    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        //
        console.log(result);
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            let tanggal_kirim;
            if (r.alur_perkara_id == 111) {
              if (r.pendapat_hakim == null) {
                tanggal_kirim = "Pendapat Hakim belum diisi";
              } else {
                tanggal_kirim = `tanggal terakhir pengiriman = ${moment(
                  moment(r.pendapat_hakim).add(30, "d")
                ).format("DD-MM-YYYY")}`;
              }
            } else if (r.alur_perkara_id == 15 || r.alur_perkara_id == 16) {
              if (r.penyerahan_kontra_pk == null) {
                tanggal_kirim = "Kontra memori PK belum diterima";
              } else {
                tanggal_kirim = `tanggal terakhir pengiriman = ${moment(
                  moment(r.penyerahan_kontra_pk).add(30, "d")
                ).format("DD-MM-YYYY")}`;
              }
            }

            resultArray.push(
              `${index + 1}. ${r.nomor_perkara_pn}\nTanggal PK : ${moment(
                r.permohonan_pk
              ).format("DD-MM-YYYY")}, ${tanggal_kirim}`
            );
          });
          responseMessage = resultArray.join(`\n\n`);
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataEdocPetitum = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT nomor_perkara, petitum_dok, tanggal_pendaftaran FROM perkara WHERE YEAR(tanggal_pendaftaran)= YEAR(CURDATE()) AND (alur_perkara_id =15 OR alur_perkara_id =16 OR alur_perkara_id =17) AND petitum_dok = " "`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${
                r.nomor_perkara
              }, Tanggal Pendaftaran : ${moment(r.tanggal_pendaftaran).format(
                "DD-MM-YYYY"
              )}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataEdocDakwaan = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT nomor_perkara, petitum_dok, tanggal_pendaftaran FROM perkara WHERE YEAR(tanggal_pendaftaran)=2022 AND (alur_perkara_id =111 OR alur_perkara_id =112 OR alur_perkara_id =113 OR alur_perkara_id =118 ) AND dakwaan_dok = " "`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${
                r.nomor_perkara
              }, Tanggal Pendaftaran : ${moment(r.tanggal_pendaftaran).format(
                "DD-MM-YYYY"
              )}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataEdocAnonimisasi = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT nomor_perkara, tanggal_putusan FROM perkara_putusan LEFT JOIN perkara ON perkara_putusan.perkara_id = perkara.perkara_id WHERE YEAR(tanggal_putusan)=YEAR(CURDATE()) AND tanggal_putusan IS NOT NULL AND (jenis_perkara_nama = "Perceraian" OR jenis_perkara_nama = "Permohonan Pengangkatan Anak" OR jenis_perkara_nama = "Wasiat" OR jenis_perkara_nama = "Kejahatan Terhadap Kesusilaan" OR jenis_perkara_nama = "Kekerasan Dalam Rumah Tangga" OR jenis_perkara_nama = "Dispensasi Kawin" OR jenis_perkara_nama = "Cerai Gugat" OR jenis_perkara_nama = "Cerai Talak" OR alur_perkara_id =118 OR alur_perkara_id =15 OR alur_perkara_id =16 OR alur_perkara_id =17) AND amar_putusan_anonimisasi_dok IS NULL`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. Nomor perkara : ${r.nomor_perkara}\nTanggal putusan : ${moment(r.tanggal_putusan).format("DD-MM-YYYY")}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataEdocPutusan = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT nomor_perkara, tanggal_putusan, jenis_perkara_nama FROM perkara_putusan LEFT JOIN perkara ON perkara_putusan.perkara_id = perkara.perkara_id WHERE YEAR(tanggal_putusan)=YEAR(CURDATE()) AND tanggal_putusan IS NOT NULL AND amar_putusan_dok IS NULL`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. Nomor perkara : ${r.nomor_perkara}\nTanggal putusan : ${moment(r.tanggal_putusan).format("DD-MM-YYYY")}\nJenis perkara : ${r.jenis_perkara_nama}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataEdocAktaCerai = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT nomor_perkara, tgl_akta_cerai, jenis_perkara_nama
    FROM perkara_akta_cerai 
    JOIN perkara ON perkara.perkara_id = perkara_akta_cerai.perkara_id 
    WHERE tgl_akta_cerai BETWEEN DATE_SUB(CURDATE(), INTERVAL 3 YEAR) AND CURDATE()
    AND (alur_perkara_id = 15 OR alur_perkara_id = 16 OR alur_perkara_id = 17) 
    AND (akta_cerai_dok IS NULL OR akta_cerai_dok = '')
    ORDER BY 
      CASE 
        WHEN YEAR(tgl_akta_cerai) = YEAR(CURDATE()) THEN 0
        ELSE 1
      END, 
      tgl_akta_cerai DESC;`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. Nomor perkara : ${r.nomor_perkara}\nTanggal Akta Cerai : ${moment(r.tgl_akta_cerai).format("DD-MM-YYYY")}\nJenis perkara : ${r.jenis_perkara_nama}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataUploadPutusan = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT nomor_perkara,
    hakim_nama,
    CASE
      WHEN jabatan_hakim_nama = "Hakim Tunggal" THEN "T" ELSE "KM" 
    END AS jabatan_hakim,
    panitera_nama
    FROM perkara_putusan 
    LEFT JOIN perkara ON perkara_putusan.perkara_id = perkara.perkara_id 
    LEFT JOIN perkara_jadwal_sidang ON perkara_jadwal_sidang.perkara_id = perkara.perkara_id
    LEFT JOIN perkara_hakim_pn ON perkara.perkara_id = perkara_hakim_pn.perkara_id
    LEFT JOIN perkara_panitera_pn ON perkara.perkara_id = perkara_panitera_pn.perkara_id
    WHERE YEAR(tanggal_putusan) = YEAR(CURDATE()) 
    AND tanggal_putusan IS NULL 
    AND amar_putusan IS NULL 
    AND (
    (perkara_jadwal_sidang.alasan_ditunda LIKE '%Putusan%' OR 
      perkara_jadwal_sidang.alasan_ditunda LIKE '%verstek%' OR 
      perkara_jadwal_sidang.alasan_ditunda LIKE '%Putus%' OR 
      perkara_jadwal_sidang.alasan_ditunda LIKE '%Cabut%' OR 
      perkara_jadwal_sidang.alasan_ditunda LIKE '%Gugur%' OR 
      perkara_jadwal_sidang.alasan_ditunda LIKE '%Penetapan%') 
        OR 
    (perkara_jadwal_sidang.keterangan LIKE '%Putusan%' OR 
      perkara_jadwal_sidang.keterangan LIKE '%verstek%' OR 
      perkara_jadwal_sidang.keterangan LIKE '%Putus%' OR 
      perkara_jadwal_sidang.keterangan LIKE '%Cabut%' OR 
      perkara_jadwal_sidang.keterangan LIKE '%Gugur%' OR 
      perkara_jadwal_sidang.keterangan LIKE '%Penetapan%')
    );`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nHakim : ${r.hakim_nama}(${r.jabatan_hakim})\nPP : ${r.panitera_nama}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataBelumDelegasi = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT delegasi_masuk.id, nomor_perkara, tgl_relaas, delegasi_masuk.diinput_tanggal,delegasi_proses_masuk.jurusita_nama, delegasi_masuk.pn_asal_text FROM delegasi_masuk LEFT JOIN delegasi_proses_masuk ON delegasi_masuk.id=delegasi_proses_masuk.delegasi_id WHERE YEAR(delegasi_masuk.diinput_tanggal) = YEAR(CURDATE()) AND (tgl_relaas IS NULL OR tgl_relaas = "")  ORDER BY delegasi_masuk.id DESC`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;

        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nTanggal masuk : ${moment(
                r.diinput_tanggal
              ).format("DD-MM-YYYY")}\nPA Delegasi : ${r.pn_asal_text}\nJS : ${r.jurusita_nama}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataBelumDelegasiKeluar = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT a.nomor_perkara, b.alamat, d.jurusita_nama
    FROM perkara AS a 
    LEFT JOIN perkara_pihak2 AS b ON a.perkara_id = b.perkara_id 
    LEFT JOIN perkara_jurusita AS d ON a.perkara_id = d.perkara_id
    LEFT JOIN perkara_pihak1 AS e ON a.perkara_id = e.perkara_id 
    LEFT JOIN perkara_efiling_id AS f ON a.perkara_id = f.perkara_id
    WHERE b.alamat NOT LIKE '%Morowali%' AND b.alamat NOT LIKE '%Morowali Utara%' AND b.alamat not like '%Bungku%'
    AND YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE())
    AND a.perkara_id NOT IN (SELECT perkara_id FROM delegasi_keluar) 
    AND a.perkara_id NOT IN (SELECT perkara_id FROM perkara_efiling_id)
    ORDER BY d.jurusita_nama DESC;`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;

        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJS : ${r.jurusita_nama}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataPublikasi = () => {
  let query = `SELECT nomor_perkara, tanggal_pendaftaran, jenis_perkara_nama, jenis_perkara_id, pihak_dipublikasikan FROM perkara WHERE ((jenis_perkara_id IN (64,65,63,83,88,98,130,200,293,354,248,364,366,367,369,340) AND pihak_dipublikasikan='Y') OR (jenis_perkara_id NOT IN (64,65,63,83,88,98,130,200,293,354,248,340,341,342,343,344,345,346,347,348,349,350,351,352,353,354,355,356,357,358,359,360,361,362,363,365) AND pihak_dipublikasikan='T' AND alur_perkara_id !=118) OR (alur_perkara_id=118 AND pihak_dipublikasikan='Y')) AND YEAR(tanggal_pendaftaran)>=2022 ORDER BY jenis_perkara_id DESC;`;

  return new Promise((resolve, reject) => {
    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${
                r.nomor_perkara
              }\nTanggal Pendaftaran : ${moment(r.tanggal_pendaftaran).format(
                "DD-MM-YYYY"
              )}\nJenis Perkara : ${r.jenis_perkara_nama}`
            );
          });
          responseMessage = resultArray.join(`\n\n`);
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataPublikasiTahunBerjalan = () => {
  let query = `SELECT nomor_perkara, tanggal_pendaftaran, jenis_perkara_nama FROM perkara WHERE ((jenis_perkara_id IN (64,65,63,83,88,98,130,200,293,354,248) AND pihak_dipublikasikan='Y') OR (jenis_perkara_id NOT IN (64,65,63,83,88,98,130,200,293,354,248) AND pihak_dipublikasikan='T' AND alur_perkara_id !=118) OR (alur_perkara_id=118 AND pihak_dipublikasikan='Y')) AND YEAR(tanggal_pendaftaran) = YEAR(CURDATE())`;

  return new Promise((resolve, reject) => {
    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${
                r.nomor_perkara
              }\nTanggal Pendaftaran : ${moment(r.tanggal_pendaftaran).format(
                "DD-MM-YYYY"
              )}\nJenis Perkara : ${r.jenis_perkara_nama}`
            );
          });
          responseMessage = resultArray.join(`\n\n`);
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataCeraiAnakBelum = () => {
  let query = `SELECT a.nomor_perkara, a.tanggal_pendaftaran, a.jenis_perkara_text
  FROM perkara a LEFT JOIN perkara_anak_pihak b ON a.perkara_id=b.perkara_id
  WHERE YEAR(a.tanggal_pendaftaran)=year(curdate()) AND (a.posita LIKE '%telah dikaruniai%' OR a.posita LIKE '%telah di karuniai%')
  AND (a.jenis_perkara_id=346 OR a.jenis_perkara_id=347) AND b.perkara_id IS NULL`;

  return new Promise((resolve, reject) => {
    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_text}`
            );
          });
          responseMessage = resultArray.join(`\n\n`);
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataVerstek = () => {
  let query = `SELECT a.perkara_id, nomor_perkara, DATE_FORMAT(tanggal_putusan, '%d-%m-%Y') as tanggal_putusan, hakim_nama, panitera_nama FROM perkara a JOIN perkara_panitera_pn b ON a.perkara_id=b.perkara_id JOIN perkara_hakim_pn as c ON a.perkara_id=c.perkara_id JOIN perkara_putusan as d ON a.perkara_id=d.perkara_id WHERE LOCATE('verstek',amar_putusan)>0 AND (jabatan_hakim_id IN (1, 3)) AND (alur_perkara_id=15 OR alur_perkara_id=16) AND YEAR(tanggal_pendaftaran) = YEAR(CURDATE()) AND tanggal_putusan IS NOT NULL AND putusan_verstek='T'`;

  return new Promise((resolve, reject) => {
    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nTanggal Putusan : ${r.tanggal_putusan}\nKM : ${r.hakim_nama}\nPP : ${r.panitera_nama}`
            );
          });
          responseMessage = resultArray.join(`\n\n`);
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};
// getDataVerstek().then((res) => console.log(res));

const getDataJadwalBesok = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT DISTINCT
    a.perkara_id,
		b.tanggal_sidang,
    a.nomor_perkara,
    b.agenda,
    c.panitera_nama,
    a.tanggal_pendaftaran,
    a.jenis_perkara_nama,
    a.para_pihak,
    a.tahapan_terakhir_id,
    a.tahapan_terakhir_text,
    a.proses_terakhir_id,
    a.proses_terakhir_text,
    n.majelis_hakim_kode,
    n.majelis_hakim_text,
    m.jurusita_nama,
    CASE
        WHEN f.jabatan_hakim_nama = 'Hakim Tunggal' THEN 'T'
        ELSE 'KM'
    END AS jabatan_hakim,
    CASE
        WHEN a.proses_terakhir_id < 210 THEN
            DATEDIFF(CURDATE(), a.tanggal_pendaftaran) - IFNULL(
                (SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0
            )
        ELSE
            DATEDIFF(d.tanggal_putusan, a.tanggal_pendaftaran) - IFNULL(
                (SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0
            )
    END + 1 AS durasi,
    CASE
        WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
        ELSE ''
    END AS ghaib,
    CASE
        WHEN a.prodeo = 1 THEN ' (_Prodeo_)'
        ELSE ''
    END AS prodeo,
    CASE
        WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
        ELSE ''
    END AS ecourt
FROM 
    perkara AS a
LEFT JOIN 
    (SELECT perkara_id, MAX(tanggal_sidang) AS tanggal_sidang_terakhir FROM perkara_jadwal_sidang GROUP BY perkara_id) AS subq 
    ON a.perkara_id = subq.perkara_id
LEFT JOIN 
    perkara_jadwal_sidang AS b 
    ON a.perkara_id = b.perkara_id AND b.tanggal_sidang = subq.tanggal_sidang_terakhir
LEFT JOIN 
    perkara_panitera_pn AS c 
    ON a.perkara_id = c.perkara_id
LEFT JOIN 
    perkara_putusan AS d 
    ON a.perkara_id = d.perkara_id
LEFT JOIN 
    perkara_hakim_pn AS f 
    ON a.perkara_id = f.perkara_id
LEFT JOIN 
    perkara_pelaksanaan_relaas AS g 
    ON a.perkara_id = g.perkara_id
LEFT JOIN 
    (SELECT perkara_id FROM perkara_efiling_id) AS h 
    ON a.perkara_id = h.perkara_id
LEFT JOIN 
    (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i 
    ON a.perkara_id = i.perkara_id
LEFT JOIN 
    perkara_pihak2 AS j 
    ON a.perkara_id = j.perkara_id
LEFT JOIN 
    perkara_efiling_id AS k 
    ON a.perkara_id = k.perkara_id
LEFT JOIN 
    perkara_pengacara AS l 
    ON a.perkara_id = l.perkara_id
LEFT JOIN 
    perkara_jurusita AS m 
    ON a.perkara_id = m.perkara_id
LEFT JOIN 
    perkara_penetapan AS n 
    ON a.perkara_id = n.perkara_id
LEFT JOIN 
    perkara_ikrar_talak AS o
    ON a.perkara_id = o.perkara_id
LEFT JOIN 
    v_pihak_perkara AS x 
    ON a.perkara_id = x.perkara_id
LEFT JOIN 
    pihak AS w 
    ON x.pihak_id = w.id
LEFT JOIN (
    SELECT
        a.pihak_id,
        MAX(CASE WHEN a.pihak_ke = 1 THEN CONCAT('+62', SUBSTRING(b.telepon, 2)) ELSE NULL END) AS teleponPenggugat,
        MAX(CASE WHEN a.pihak_ke = 2 THEN CONCAT('+62', SUBSTRING(b.telepon, 2)) ELSE NULL END) AS teleponTergugat
    FROM v_pihak_perkara AS a
    JOIN pihak AS b ON a.pihak_id = b.id 
                    AND b.telepon REGEXP '^[0-9]' 
                    AND CHAR_LENGTH(b.telepon) > 8
    GROUP BY a.pihak_id
) AS telepons ON x.pihak_id = telepons.pihak_id
LEFT JOIN (
    SELECT
        perk.perkara_id,
        CASE
            WHEN datarelaas.tanggal_relaas IS NULL OR datarelaas.tanggal_relaas = '' THEN
            CASE
                WHEN perkarapihak.pihakke = 1 THEN '(Belum Dipanggil P)'
                WHEN perkarapihak.pihakke = 2 THEN '(Belum Dipanggil T)'
                WHEN perkarapihak.pihakke IN (1,2) THEN '(Belum Dipanggil PT)'
                WHEN perkarapihak.pihakke IN (1,2,4) THEN '(Belum Dipanggil PT & Turut T)'
                WHEN perkarapihak.pihakke = 4 THEN '(Belum Dipanggil Turut Tergugat)'
                ELSE '(Sudah Dipanggil dan Diupload)'
            END
        WHEN datarelaas.doc_relaas IS NULL OR datarelaas.doc_relaas = '' THEN
            CASE
                WHEN perkarapihak.pihakke = 1 THEN '(Belum Diupload P)'
                WHEN perkarapihak.pihakke = 2 THEN '(Belum Diupload T)'
                WHEN perkarapihak.pihakke IN (1,2) THEN '(Belum Diupload PT)'
                WHEN perkarapihak.pihakke IN (1,2,4) THEN '(Belum Diupload PT & Turut T)'
                WHEN perkarapihak.pihakke = 4 THEN '(Belum Diupload Turut Tergugat)'
                ELSE '(Sudah Dipanggil dan Diupload)'
            END
        ELSE '(Sudah Dipanggil dan Diupload)'
        END AS panggilan_status
    FROM
        perkara AS perk
        JOIN perkara_jadwal_sidang AS sidang ON sidang.perkara_id = perk.perkara_id
        JOIN (
            SELECT
                p1.perkara_id,
                p1.pihak_id,
                p1.nama,
                1 AS pihakke,
                'pihak p' AS ketpihak,
                '' AS pengacara_pihak_id
            FROM
                perkara_pihak1 AS p1
                JOIN perkara ON perkara.perkara_id = p1.perkara_id
            WHERE
                alur_perkara_id < 111
            UNION
            SELECT
                p2.perkara_id,
                p2.pihak_id,
                p2.nama,
                2 AS pihakke,
                'pihak t' AS ketpihak,
                '' AS pengacara_pihak_id
            FROM
                perkara_pihak2 AS p2
                JOIN perkara ON perkara.perkara_id = p2.perkara_id
            WHERE
                alur_perkara_id < 111
                AND (
                    status_penahanan_id IS NULL
                    OR status_penahanan_id = 0
                )
                AND (
                    jenis_tahanan_id = 0
                    OR jenis_tahanan_id IS NULL
                )
            UNION
            SELECT
                p3.perkara_id,
                p3.pihak_id,
                p3.nama,
                3 AS pihakke,
                'intervensi' AS ketpihak,
                '' AS pengacara_pihak_id
            FROM
                perkara_pihak3 AS p3
            UNION
            SELECT
                p4.perkara_id,
                p4.pihak_id,
                p4.nama,
                4 AS pihakke,
                'turut' AS ketpihak,
                '' AS pengacara_pihak_id
            FROM
                perkara_pihak4 AS p4
            UNION
            SELECT
                p5.perkara_id,
                p5.pengacara_id,
                p5.nama,
                p5.pihak_ke AS pihakke,
                'pengacara' AS ketpihak,
                p5.pihak_id AS pengacara_pihak_id
            FROM
                perkara_pengacara AS p5
        ) AS perkarapihak 
        ON perkarapihak.perkara_id = perk.perkara_id
        LEFT JOIN perkara_pelaksanaan_relaas AS datarelaas 
        ON datarelaas.pihak_id = perkarapihak.pihak_id
        AND datarelaas.perkara_id = perk.perkara_id
        AND datarelaas.sidang_id = sidang.id
        LEFT JOIN (
            SELECT
                perkara.perkara_id AS perkara_id,
                perkara_jadwal_sidang.urutan AS urutan,
                perkara_jadwal_sidang.dihadiri_oleh
            FROM
                perkara
                JOIN perkara_jadwal_sidang ON (
                    perkara_jadwal_sidang.perkara_id = perkara.perkara_id
                )
        ) AS jadwalsidang 
        ON (
            jadwalsidang.perkara_id = perk.perkara_id
            AND jadwalsidang.urutan = sidang.urutan - 1
        )
        LEFT JOIN perkara_penetapan_hari_sidang AS phs 
        ON (
            phs.perkara_id = perk.perkara_id
            AND phs.jadwalsidang_id = sidang.id
        )
        JOIN alur_perkara AS alur 
        ON alur.id = perk.alur_perkara_id
    WHERE
        YEAR(perk.tanggal_pendaftaran) = YEAR(CURDATE())
        AND perk.alur_perkara_id < 111
        AND perkarapihak.pihak_id NOT IN (
            SELECT
                pp.pihak_id
            FROM
                perkara_pelaksanaan_relaas
                JOIN perkara_pengacara AS pp 
                ON pp.pengacara_id = perkara_pelaksanaan_relaas.pihak_id
                AND pp.perkara_id = perkara_pelaksanaan_relaas.perkara_id
                JOIN perkara ON pp.perkara_id = perkara.perkara_id
            WHERE
                perk.alur_perkara_id < 111
                AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
                AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
                AND (
                    perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL
                    OR perkara_pelaksanaan_relaas.tanggal_relaas <> ''
                )
                AND (
                    perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL
                    OR perkara_pelaksanaan_relaas.doc_relaas <> ''
                )
            UNION
            SELECT
                ppb.pengacara_id
            FROM
                perkara_pelaksanaan_relaas
                JOIN perkara_pengacara AS ppb 
                ON ppb.pihak_id = perkara_pelaksanaan_relaas.pihak_id
                AND ppb.perkara_id = perkara_pelaksanaan_relaas.perkara_id
                JOIN perkara ON ppb.perkara_id = perkara.perkara_id
            WHERE
                perk.alur_perkara_id < 111
                AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
                AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
                AND (
                    perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL
                    OR perkara_pelaksanaan_relaas.tanggal_relaas <> ''
                )
                AND (
                    perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL
                    OR perkara_pelaksanaan_relaas.doc_relaas <> ''
                )
        )
        AND (
            (
                datarelaas.tanggal_relaas IS NULL
                OR datarelaas.tanggal_relaas = ''
            )
            OR (
                datarelaas.doc_relaas IS NULL
                OR datarelaas.doc_relaas = ''
            )
        )
        AND(
            perk.alur_perkara_id >= 1
            AND perk.alur_perkara_id <= 17
        )
        AND (
            (jadwalsidang.dihadiri_oleh <> 1)
            AND (
                jadwalsidang.dihadiri_oleh = 2
                AND (
                    perkarapihak.pihakke = 2
                    OR perkarapihak.pihakke = 4
                )
            )
            OR (
                jadwalsidang.dihadiri_oleh = 3
                AND perkarapihak.pihakke = 1
            )
            OR (
                jadwalsidang.dihadiri_oleh = 4
                OR jadwalsidang.dihadiri_oleh IS NULL
            )
        )
) AS doc_relaas_status 
ON a.perkara_id = doc_relaas_status.perkara_id
WHERE 
    b.tanggal_sidang = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
    AND a.alur_perkara_id IN (15, 16, 17)
    AND c.aktif = 'Y'
    AND f.aktif = 'Y'
    AND m.aktif = 'Y'
    AND (
        CASE 
            WHEN a.jenis_perkara_id = 346 AND d.status_putusan_id = 62 AND o.amar_ikrar_talak IS NULL THEN a.proses_terakhir_id < 296
            ELSE a.proses_terakhir_id < 218 
        END
    )
ORDER BY 
    CASE
        WHEN b.alasan_ditunda LIKE '%putusan%' OR b.alasan_ditunda LIKE '%penetapan%' OR b.alasan_ditunda LIKE '%musyawarah%' THEN 1
        ELSE 2
    END,
    a.alur_perkara_id,
		n.majelis_hakim_kode,
		a.jenis_perkara_id DESC,
		b.urutan DESC,
    c.panitera_nama, 
    a.nomor_perkara, 
    ecourt, 
    ghaib, 
    prodeo DESC;`;
      
    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `*${index + 1}. ${r.nomor_perkara} ${r.ecourt}${r.ghaib}${r.prodeo}(${r.durasi} Hari)*\nJenis Perkara : ${r.jenis_perkara_nama}\nAgenda : ${r.agenda}\nMajelis Hakim : ${r.majelis_hakim_kode}\nPP : ${r.panitera_nama}\nJS : ${r.jurusita_nama}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataJadwalBesokPanitera = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT DISTINCT
    a.perkara_id,
		b.tanggal_sidang,
    a.nomor_perkara,
    IFNULL(doc_relaas_status.panggilan_status, '') AS panggilan_status,
    b.agenda,
    c.panitera_nama,
    a.tanggal_pendaftaran,
    a.jenis_perkara_nama,
    a.para_pihak,
    a.tahapan_terakhir_id,
    a.tahapan_terakhir_text,
    a.proses_terakhir_id,
    a.proses_terakhir_text,
    n.majelis_hakim_kode,
    n.majelis_hakim_text,
    m.jurusita_nama,
    CASE
        WHEN f.jabatan_hakim_nama = 'Hakim Tunggal' THEN 'T'
        ELSE 'KM'
    END AS jabatan_hakim,
    CASE
        WHEN a.proses_terakhir_id < 210 THEN
            DATEDIFF(CURDATE(), a.tanggal_pendaftaran) - IFNULL(
                (SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0
            )
        ELSE
            DATEDIFF(d.tanggal_putusan, a.tanggal_pendaftaran) - IFNULL(
                (SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0
            )
    END + 1 AS durasi,
    CASE
        WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
        ELSE ''
    END AS ghaib,
    CASE
        WHEN a.prodeo = 1 THEN ' (_Prodeo_)'
        ELSE ''
    END AS prodeo,
    CASE
        WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
        ELSE ''
    END AS ecourt
FROM 
    perkara AS a
LEFT JOIN 
    (SELECT perkara_id, MAX(tanggal_sidang) AS tanggal_sidang_terakhir FROM perkara_jadwal_sidang GROUP BY perkara_id) AS subq 
    ON a.perkara_id = subq.perkara_id
LEFT JOIN 
    perkara_jadwal_sidang AS b 
    ON a.perkara_id = b.perkara_id AND b.tanggal_sidang = subq.tanggal_sidang_terakhir
LEFT JOIN 
    perkara_panitera_pn AS c 
    ON a.perkara_id = c.perkara_id
LEFT JOIN 
    perkara_putusan AS d 
    ON a.perkara_id = d.perkara_id
LEFT JOIN 
    perkara_hakim_pn AS f 
    ON a.perkara_id = f.perkara_id
LEFT JOIN 
    perkara_pelaksanaan_relaas AS g 
    ON a.perkara_id = g.perkara_id
LEFT JOIN 
    (SELECT perkara_id FROM perkara_efiling_id) AS h 
    ON a.perkara_id = h.perkara_id
LEFT JOIN 
    (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i 
    ON a.perkara_id = i.perkara_id
LEFT JOIN 
    perkara_pihak2 AS j 
    ON a.perkara_id = j.perkara_id
LEFT JOIN 
    perkara_efiling_id AS k 
    ON a.perkara_id = k.perkara_id
LEFT JOIN 
    perkara_pengacara AS l 
    ON a.perkara_id = l.perkara_id
LEFT JOIN 
    perkara_jurusita AS m 
    ON a.perkara_id = m.perkara_id
LEFT JOIN 
    perkara_penetapan AS n 
    ON a.perkara_id = n.perkara_id
LEFT JOIN 
    perkara_ikrar_talak AS o
    ON a.perkara_id = o.perkara_id
LEFT JOIN 
    v_pihak_perkara AS x 
    ON a.perkara_id = x.perkara_id
LEFT JOIN 
    pihak AS w 
    ON x.pihak_id = w.id
LEFT JOIN (
    SELECT
        a.pihak_id,
        MAX(CASE WHEN a.pihak_ke = 1 THEN CONCAT('+62', SUBSTRING(b.telepon, 2)) ELSE NULL END) AS teleponPenggugat,
        MAX(CASE WHEN a.pihak_ke = 2 THEN CONCAT('+62', SUBSTRING(b.telepon, 2)) ELSE NULL END) AS teleponTergugat
    FROM v_pihak_perkara AS a
    JOIN pihak AS b ON a.pihak_id = b.id 
                    AND b.telepon REGEXP '^[0-9]' 
                    AND CHAR_LENGTH(b.telepon) > 8
    GROUP BY a.pihak_id
) AS telepons ON x.pihak_id = telepons.pihak_id
LEFT JOIN (
    SELECT
        perk.perkara_id,
        CASE
            WHEN datarelaas.tanggal_relaas IS NULL OR datarelaas.tanggal_relaas = '' THEN
            CASE
                WHEN perkarapihak.pihakke = 1 THEN '(Belum Dipanggil P)'
                WHEN perkarapihak.pihakke = 2 THEN '(Belum Dipanggil T)'
                WHEN perkarapihak.pihakke IN (1,2) THEN '(Belum Dipanggil PT)'
                WHEN perkarapihak.pihakke IN (1,2,4) THEN '(Belum Dipanggil PT & Turut T)'
                WHEN perkarapihak.pihakke = 4 THEN '(Belum Dipanggil Turut Tergugat)'
                ELSE '(Sudah Dipanggil dan Diupload)'
            END
        WHEN datarelaas.doc_relaas IS NULL OR datarelaas.doc_relaas = '' THEN
            CASE
                WHEN perkarapihak.pihakke = 1 THEN '(Belum Diupload P)'
                WHEN perkarapihak.pihakke = 2 THEN '(Belum Diupload T)'
                WHEN perkarapihak.pihakke IN (1,2) THEN '(Belum Diupload PT)'
                WHEN perkarapihak.pihakke IN (1,2,4) THEN '(Belum Diupload PT & Turut T)'
                WHEN perkarapihak.pihakke = 4 THEN '(Belum Diupload Turut Tergugat)'
                ELSE '(Sudah Dipanggil dan Diupload)'
            END
        ELSE '(Sudah Dipanggil dan Diupload)'
        END AS panggilan_status
    FROM
        perkara AS perk
        JOIN perkara_jadwal_sidang AS sidang ON sidang.perkara_id = perk.perkara_id
        JOIN (
            SELECT
                p1.perkara_id,
                p1.pihak_id,
                p1.nama,
                1 AS pihakke,
                'pihak p' AS ketpihak,
                '' AS pengacara_pihak_id
            FROM
                perkara_pihak1 AS p1
                JOIN perkara ON perkara.perkara_id = p1.perkara_id
            WHERE
                alur_perkara_id < 111
            UNION
            SELECT
                p2.perkara_id,
                p2.pihak_id,
                p2.nama,
                2 AS pihakke,
                'pihak t' AS ketpihak,
                '' AS pengacara_pihak_id
            FROM
                perkara_pihak2 AS p2
                JOIN perkara ON perkara.perkara_id = p2.perkara_id
            WHERE
                alur_perkara_id < 111
                AND (
                    status_penahanan_id IS NULL
                    OR status_penahanan_id = 0
                )
                AND (
                    jenis_tahanan_id = 0
                    OR jenis_tahanan_id IS NULL
                )
            UNION
            SELECT
                p3.perkara_id,
                p3.pihak_id,
                p3.nama,
                3 AS pihakke,
                'intervensi' AS ketpihak,
                '' AS pengacara_pihak_id
            FROM
                perkara_pihak3 AS p3
            UNION
            SELECT
                p4.perkara_id,
                p4.pihak_id,
                p4.nama,
                4 AS pihakke,
                'turut' AS ketpihak,
                '' AS pengacara_pihak_id
            FROM
                perkara_pihak4 AS p4
            UNION
            SELECT
                p5.perkara_id,
                p5.pengacara_id,
                p5.nama,
                p5.pihak_ke AS pihakke,
                'pengacara' AS ketpihak,
                p5.pihak_id AS pengacara_pihak_id
            FROM
                perkara_pengacara AS p5
        ) AS perkarapihak 
        ON perkarapihak.perkara_id = perk.perkara_id
        LEFT JOIN perkara_pelaksanaan_relaas AS datarelaas 
        ON datarelaas.pihak_id = perkarapihak.pihak_id
        AND datarelaas.perkara_id = perk.perkara_id
        AND datarelaas.sidang_id = sidang.id
        LEFT JOIN (
            SELECT
                perkara.perkara_id AS perkara_id,
                perkara_jadwal_sidang.urutan AS urutan,
                perkara_jadwal_sidang.dihadiri_oleh
            FROM
                perkara
                JOIN perkara_jadwal_sidang ON (
                    perkara_jadwal_sidang.perkara_id = perkara.perkara_id
                )
        ) AS jadwalsidang 
        ON (
            jadwalsidang.perkara_id = perk.perkara_id
            AND jadwalsidang.urutan = sidang.urutan - 1
        )
        LEFT JOIN perkara_penetapan_hari_sidang AS phs 
        ON (
            phs.perkara_id = perk.perkara_id
            AND phs.jadwalsidang_id = sidang.id
        )
        JOIN alur_perkara AS alur 
        ON alur.id = perk.alur_perkara_id
    WHERE
        YEAR(perk.tanggal_pendaftaran) = YEAR(CURDATE())
        AND perk.alur_perkara_id < 111
        AND perkarapihak.pihak_id NOT IN (
            SELECT
                pp.pihak_id
            FROM
                perkara_pelaksanaan_relaas
                JOIN perkara_pengacara AS pp 
                ON pp.pengacara_id = perkara_pelaksanaan_relaas.pihak_id
                AND pp.perkara_id = perkara_pelaksanaan_relaas.perkara_id
                JOIN perkara ON pp.perkara_id = perkara.perkara_id
            WHERE
                perk.alur_perkara_id < 111
                AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
                AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
                AND (
                    perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL
                    OR perkara_pelaksanaan_relaas.tanggal_relaas <> ''
                )
                AND (
                    perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL
                    OR perkara_pelaksanaan_relaas.doc_relaas <> ''
                )
            UNION
            SELECT
                ppb.pengacara_id
            FROM
                perkara_pelaksanaan_relaas
                JOIN perkara_pengacara AS ppb 
                ON ppb.pihak_id = perkara_pelaksanaan_relaas.pihak_id
                AND ppb.perkara_id = perkara_pelaksanaan_relaas.perkara_id
                JOIN perkara ON ppb.perkara_id = perkara.perkara_id
            WHERE
                perk.alur_perkara_id < 111
                AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
                AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
                AND (
                    perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL
                    OR perkara_pelaksanaan_relaas.tanggal_relaas <> ''
                )
                AND (
                    perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL
                    OR perkara_pelaksanaan_relaas.doc_relaas <> ''
                )
        )
        AND (
            (
                datarelaas.tanggal_relaas IS NULL
                OR datarelaas.tanggal_relaas = ''
            )
            OR (
                datarelaas.doc_relaas IS NULL
                OR datarelaas.doc_relaas = ''
            )
        )
        AND(
            perk.alur_perkara_id >= 1
            AND perk.alur_perkara_id <= 17
        )
        AND (
            (jadwalsidang.dihadiri_oleh <> 1)
            AND (
                jadwalsidang.dihadiri_oleh = 2
                AND (
                    perkarapihak.pihakke = 2
                    OR perkarapihak.pihakke = 4
                )
            )
            OR (
                jadwalsidang.dihadiri_oleh = 3
                AND perkarapihak.pihakke = 1
            )
            OR (
                jadwalsidang.dihadiri_oleh = 4
                OR jadwalsidang.dihadiri_oleh IS NULL
            )
        )
) AS doc_relaas_status 
ON a.perkara_id = doc_relaas_status.perkara_id
WHERE  
      b.tanggal_sidang = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
      AND a.alur_perkara_id IN (15, 16, 17)
      AND c.aktif = 'Y'
      AND f.aktif = 'Y'
      AND m.aktif = 'Y'
      AND (CASE 
            WHEN a.jenis_perkara_id = 346 AND d.status_putusan_id = 62 THEN a.proses_terakhir_id < 296 
            ELSE a.proses_terakhir_id < 220 END)
  GROUP BY
      a.nomor_perkara,
      b.agenda,
      c.panitera_nama,
      a.perkara_id,
      a.tanggal_pendaftaran,
      a.jenis_perkara_nama,
      a.para_pihak,
      a.tahapan_terakhir_id,
      a.tahapan_terakhir_text,
      a.proses_terakhir_id,
      a.proses_terakhir_text
  ORDER BY
      CASE
        WHEN b.alasan_ditunda LIKE '%putusan%' OR b.alasan_ditunda LIKE '%penetapan%' OR b.alasan_ditunda LIKE '%musyawarah%' THEN 1
        ELSE 2
      END,
      a.alur_perkara_id, 
      c.panitera_nama, 
      a.nomor_perkara, 
      ecourt, 
      ghaib, 
      prodeo DESC;`;

    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara} ${r.ecourt}${r.ghaib}${r.prodeo}(${r.durasi} Hari)\nJenis Perkara : ${r.jenis_perkara_nama}\nAgenda : ${r.agenda}\nMajelis Hakim : ${r.majelis_hakim_kode}\nPP : ${r.panitera_nama}\nJS : ${r.jurusita_nama}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataTundaMediasi = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT 
    b.perkara_id,
    b.nomor_perkara,
    b.jenis_perkara_nama,
    a.tanggal_sidang,
    (CASE 
        WHEN d.mediator_text IS NOT NULL THEN CONCAT('BELUM INPUT TUNDA/HASIL MEDIASI (Mediator: ', d.mediator_text, ')') 
        ELSE 'BELUM INPUT MEDIATOR' 
    END) AS mediator,
    c.panitera_nama
    FROM 
        perkara_jadwal_sidang AS a
    JOIN 
        perkara AS b ON a.perkara_id = b.perkara_id
    JOIN
        perkara_panitera_pn AS c ON a.perkara_id = c.perkara_id
    LEFT JOIN 
        perkara_mediasi AS d ON a.perkara_id = d.perkara_id
    LEFT JOIN 
        perkara_mediator AS e ON a.perkara_id = e.perkara_id
    WHERE 
      a.tanggal_sidang >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
      AND IFNULL((SELECT MAX(e.tanggal_mediasi) FROM perkara_jadwal_mediasi e WHERE e.mediasi_id = d.mediasi_id), CURDATE()) <= CURDATE()
      AND d.tgl_laporan_mediator IS NULL 
      AND a.alasan_ditunda LIKE '%medi%'
      AND b.tahapan_terakhir_id < 15;`;
    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nStatus : ${r.mediator}\nJenis Perkara : ${r.jenis_perkara_nama}\nTanggal Sidang : ${moment(r.tanggal_sidang).format("DD-MM-YYYY")}\n*PP : ${r.panitera_nama}*`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataDirput = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT DISTINCT(nomor_perkara),tanggal_putusan,link_dirput,dokumen_ref_id
      FROM perkara
      LEFT JOIN perkara_putusan ON perkara.perkara_id=perkara_putusan.perkara_id
      LEFT JOIN dirput_dokumen ON perkara.perkara_id=dirput_dokumen.perkara_id
      WHERE (alur_perkara_id=1 OR alur_perkara_id =2 OR alur_perkara_id=8 OR alur_perkara_id=15 OR alur_perkara_id =16 OR alur_perkara_id=17 OR alur_perkara_id=111 OR alur_perkara_id=112 OR alur_perkara_id=118 OR alur_perkara_id=119 OR alur_perkara_id=120 OR alur_perkara_id=121 OR alur_perkara_id=122 OR alur_perkara_id=125) AND (tanggal_putusan IS NOT NULL AND link_dirput IS NULL AND (dokumen_ref_id BETWEEN 88 AND 100) AND YEAR(tanggal_putusan)= YEAR(CURDATE()))
      ORDER BY tanggal_putusan DESC`;
    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. No Perkara : *${r.nomor_perkara}*\ntanggal putusan : ${moment(r.tanggal_putusan).format("DD-MM-YYYY")}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataNomorKontakPihak1 = () => {
  return new Promise((resolve, reject) => {
    let query = `
        SELECT a.nama, 
        CONCAT('+62', SUBSTRING(b.telepon, 2)) AS telepon
    FROM v_pihak_perkara AS a
    JOIN pihak AS b ON a.pihak_id = b.id 
                AND b.telepon REGEXP '^[0-9]' 
                AND CHAR_LENGTH(b.telepon) > 8
    WHERE (CASE WHEN a.pihak_ke = 1 THEN 'Pihak1' 
            WHEN a.pihak_ke = 2 THEN 'Pihak2' 
        END) = 'Pihak1'
    ORDER BY a.tanggal_pendaftaran DESC, 
          a.nomor_perkara, 
          a.urutan, 
          a.pihak_ke;`;

    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.telepon}`
            );
          });
          responseMessage = resultArray.join('\n\n');
        } else {
          responseMessage = 'Tidak ada data';
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataNomorKontakPihak2 = () => {
  return new Promise((resolve, reject) => {
    let query = `
        SELECT a.nama, 
        CONCAT('+62', SUBSTRING(b.telepon, 2)) AS telepon
    FROM v_pihak_perkara AS a
    JOIN pihak AS b ON a.pihak_id = b.id 
                AND b.telepon REGEXP '^[0-9]' 
                AND CHAR_LENGTH(b.telepon) > 8
    WHERE (CASE WHEN a.pihak_ke = 1 THEN 'Pihak1' 
            WHEN a.pihak_ke = 2 THEN 'Pihak2' 
        END) = 'Pihak2'
    ORDER BY a.tanggal_pendaftaran DESC, 
          a.nomor_perkara, 
          a.urutan, 
          a.pihak_ke`;

    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.telepon}`
            );
          });
          responseMessage = resultArray.join('\n\n');
        } else {
          responseMessage = 'Tidak ada data';
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataPutusHariIni = () => {
  return new Promise((resolve, reject) => {
    let query = `
      SELECT
        a.perkara_id,
        a.amar_putusan,
        a.status_putusan_id,
        CASE WHEN a.putusan_verstek = 'Y' THEN 'Verstek' ELSE 'Kontra' END AS putusan_verstek,
        b.nomor_perkara,
        b.jenis_perkara_nama,
        c.jurusita_nama,
        CASE 
          WHEN a.status_putusan_id = '62' THEN 'Kabul'
          WHEN a.status_putusan_id = '63' THEN 'Tolak'
          WHEN a.status_putusan_id = '64' THEN 'Niet/NO'
          WHEN a.status_putusan_id = '65' THEN 'Digugurkan'
          WHEN a.status_putusan_id = '93' THEN 'Gugur'
          WHEN a.status_putusan_id = '66' THEN 'Coret'
          WHEN a.status_putusan_id = '67' THEN 'Cabut'
          WHEN a.status_putusan_id = '85' THEN 'Damai'
          ELSE 'Unknown'
        END AS jenis_putusan
      FROM 
        perkara_putusan AS a
      JOIN 
        perkara AS b ON a.perkara_id = b.perkara_id
      JOIN 
        perkara_jurusita AS c ON a.perkara_id = c.perkara_id
      WHERE 
        a.tanggal_putusan = CURDATE()
      ORDER BY 
        c.jurusita_nama;`;

    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Putusan : ${r.jenis_putusan}(${r.putusan_verstek})\nJS : ${r.jurusita_nama}`
            );
          });
          responseMessage = resultArray.join('\n\n');
        } else {
          responseMessage = 'Tidak ada data';
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataPutusJurusita = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT
        a.perkara_id,
        CASE 
          WHEN d.dihadiri_oleh = 2 THEN b.pihak2_text 
          WHEN d.dihadiri_oleh = 3 THEN b.pihak1_text 
          WHEN d.dihadiri_oleh = 4 THEN CONCAT(b.pihak1_text, ' AND ', b.pihak2_text) 
        END AS pihak_yang_dipanggil,
        a.amar_putusan,
        a.status_putusan_id,
        CASE WHEN a.putusan_verstek = 'Y' THEN 'Verstek' ELSE '-' END AS putusan_verstek,
        b.nomor_perkara,
        b.jenis_perkara_nama,
        c.jurusita_nama,
        CASE 
          WHEN a.status_putusan_id = '62' THEN 'Kabul'
          WHEN a.status_putusan_id = '63' THEN 'Tolak'
          WHEN a.status_putusan_id = '64' THEN 'Niet/NO'
          WHEN a.status_putusan_id = '65' THEN 'Digugurkan'
          WHEN a.status_putusan_id = '93' THEN 'Gugur'
          WHEN a.status_putusan_id = '66' THEN 'Coret'
          WHEN a.status_putusan_id = '67' THEN 'Cabut'
          WHEN a.status_putusan_id = '85' THEN 'Damai'
          ELSE 'Unknown'
        END AS jenis_putusan
      FROM 
        perkara_putusan AS a
      JOIN 
        perkara AS b ON a.perkara_id = b.perkara_id
      JOIN 
        perkara_jurusita AS c ON a.perkara_id = c.perkara_id
      JOIN
        perkara_jadwal_sidang AS d ON a.perkara_id = d.perkara_id
      WHERE 
        a.tanggal_putusan = CURDATE() AND d.dihadiri_oleh <> 1
      ORDER BY 
        c.jurusita_nama;`;

    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. No Perkara: ${r.nomor_perkara}\nJenis Putusan: ${r.jenis_putusan}(${r.putusan_verstek})\nPihak PBT: ${r.pihak_yang_dipanggil}\n*JS: ${r.jurusita_nama}*`
            );
          });
          responseMessage = resultArray.join('\n\n');
        } else {
          responseMessage = 'Tidak ada data';
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataTundaJurusita = () => {
  return new Promise((resolve, reject) => {
    let query = `
      SELECT
        a.alasan_ditunda,
        (SELECT MAX(tanggal_sidang) FROM perkara_jadwal_sidang WHERE perkara_id = a.perkara_id) AS tanggal_tundaan,
        b.perkara_id,
        b.nomor_perkara,
        b.jenis_perkara_nama,
        c.jurusita_nama,
        CASE 
          WHEN a.dihadiri_oleh = 2 THEN b.pihak2_text 
          WHEN a.dihadiri_oleh = 3 THEN b.pihak1_text 
          WHEN a.dihadiri_oleh = 4 THEN CONCAT(b.pihak1_text, ' AND ', b.pihak2_text) 
        END AS pihak_yang_dipanggil
      FROM 
        perkara_jadwal_sidang AS a
      JOIN 
        perkara AS b ON a.perkara_id = b.perkara_id
      JOIN 
        perkara_jurusita AS c ON a.perkara_id = c.perkara_id
      WHERE 
        a.tanggal_sidang = CURDATE() AND a.ditunda = 'Y' AND a.dihadiri_oleh <> 1
      GROUP BY
        a.perkara_id
      ORDER BY 
        c.jurusita_nama;`;

    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. No Perkara: ${r.nomor_perkara}\nTanggal Sidang : ${moment(r.tanggal_tundaan).format("DD-MM-YYYY")}\nPihak Dipanggil: ${r.pihak_yang_dipanggil}\n*JS: ${r.jurusita_nama}*`
            );
          });
          responseMessage = resultArray.join('\n\n');
        } else {
          responseMessage = 'Tidak ada data';
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataPutusLebih30Hari = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT
    a.perkara_id,
    a.nomor_perkara,
    a.jenis_perkara_nama,
    b.hakim_nama,
    CASE
        WHEN b.jabatan_hakim_nama = 'Hakim Tunggal' THEN 'T' ELSE 'KM' 
    END AS jabatan_hakim,
    CASE
        WHEN a.proses_terakhir_id < 210 THEN DATEDIFF(CURDATE(), a.tanggal_pendaftaran) - IFNULL((SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0)
        ELSE DATEDIFF(f.tanggal_putusan, a.tanggal_pendaftaran) - IFNULL((SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0)
    END + 1 AS durasi,
    c.panitera_nama,
    d.jurusita_nama
    FROM 
        perkara AS a
    JOIN 
        perkara_hakim_pn AS b ON a.perkara_id = b.perkara_id
    JOIN 
        perkara_panitera_pn AS c ON a.perkara_id = c.perkara_id
    JOIN 
        perkara_jurusita AS d ON a.perkara_id = d.perkara_id
    JOIN 
        perkara_putusan AS f ON a.perkara_id = f.perkara_id
    WHERE 
        YEAR(f.tanggal_putusan) = YEAR(CURDATE()) AND b.aktif = "Y" AND a.prodeo = 0
    GROUP BY
        a.perkara_id, a.nomor_perkara, a.jenis_perkara_nama, 
        CASE
            WHEN b.jabatan_hakim_nama = 'Hakim Tunggal' THEN 'T' ELSE 'KM' 
        END,
        c.panitera_nama,
        d.jurusita_nama
    HAVING
        durasi > 90
    ORDER BY 
        durasi DESC;`;

    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}(${r.durasi} hari)\nJenis Perkara : ${r.jenis_perkara_nama}\nHakim : ${r.hakim_nama} (${r.jabatan_hakim})\nPP : ${r.panitera_nama}\nJS : ${r.jurusita_nama}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataSidangLebih30Hari = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT 
    a.nomor_perkara,
    b.agenda,
    c.panitera_nama,
    a.perkara_id,
    a.tanggal_pendaftaran,
    a.jenis_perkara_nama,
    a.para_pihak,
    a.tahapan_terakhir_id,
    a.tahapan_terakhir_text,
    a.proses_terakhir_id,
    a.proses_terakhir_text,
    f.hakim_nama,
    h.jurusita_nama,
    CASE
        WHEN f.jabatan_hakim_nama = 'Hakim Tunggal' THEN 'T' ELSE 'KM' 
    END AS jabatan_hakim,
    CASE
        WHEN a.proses_terakhir_id < 210 THEN DATEDIFF(CURDATE(), a.tanggal_pendaftaran) - IFNULL((SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0)
        ELSE DATEDIFF(d.tanggal_putusan, a.tanggal_pendaftaran) - IFNULL((SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0)
    END + 1 AS durasi 
    FROM 
        perkara AS a
    LEFT JOIN 
        perkara_jadwal_sidang AS b ON a.perkara_id = b.perkara_id
    LEFT JOIN 
        perkara_panitera_pn AS c ON a.perkara_id = c.perkara_id
    LEFT JOIN 
        perkara_putusan AS d ON a.perkara_id = d.perkara_id 
    LEFT JOIN
        perkara_hakim_pn AS f ON a.perkara_id = f.perkara_id
    LEFT JOIN
        perkara_jurusita AS h ON a.perkara_id = h.perkara_id
    WHERE  
        YEAR(b.tanggal_sidang) = YEAR(CURDATE()) 
        AND a.alur_perkara_id IN (15, 16, 17)
        AND c.aktif = 'Y'
        AND f.aktif = 'Y'
        AND d.tanggal_putusan IS NULL
        AND a.prodeo = 0
    GROUP BY
        a.nomor_perkara,
        c.panitera_nama,
        a.perkara_id,
        a.tanggal_pendaftaran,
        a.jenis_perkara_nama,
        a.para_pihak,
        a.tahapan_terakhir_id,
        a.tahapan_terakhir_text,
        a.proses_terakhir_id,
        a.proses_terakhir_text
    HAVING
        durasi > 90
    ORDER BY f.hakim_nama DESC;`;

    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}(${r.durasi} hari)\nJenis Perkara : ${r.jenis_perkara_nama}\nHakim : ${r.hakim_nama} (${r.jabatan_hakim})\nPP : ${r.panitera_nama}\nJS : ${r.jurusita_nama}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataLupaTunda = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT nomor_perkara, jenis_perkara_nama, tanggal_sidang, panitera_nama
    FROM perkara
    LEFT JOIN perkara_jadwal_sidang ON perkara.perkara_id = perkara_jadwal_sidang.perkara_id
    LEFT JOIN perkara_panitera_pn ON perkara.perkara_id = perkara_panitera_pn.perkara_id
    WHERE DATE(tanggal_sidang) = CURDATE()
        AND alasan_ditunda IS NULL 
        AND perkara_jadwal_sidang.keterangan IS NULL
    ORDER BY nomor_perkara DESC;`;

    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama}\nPP : ${r.panitera_nama}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataAktaCeraiTerbit = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT a.perkara_id,a.nomor_perkara, a.jenis_perkara_nama,
    (case when a.jenis_perkara_id=346 then b.tgl_ikrar_talak ELSE a.tanggal_bht END) AS tanggal
    FROM v_perkara a
    LEFT JOIN perkara_ikrar_talak b ON a.perkara_id=b.perkara_id AND b.status_penetapan_ikrar_talak_id=1
    LEFT JOIN perkara_akta_cerai c ON a.perkara_id=c.perkara_id
    WHERE (a.jenis_perkara_id=346 OR a.jenis_perkara_id=347) AND status_putusan_id=62 
    AND (a.tahapan_terakhir_id=15 OR a.tahapan_terakhir_id=18)
    AND (case when a.jenis_perkara_id=346 then b.tgl_ikrar_talak ELSE a.tanggal_bht END) IS NOT NULL 
    AND a.tanggal_bht<=CURDATE() AND c.tgl_akta_cerai IS NULL 
    AND a.tanggal_putusan > DATE_SUB(CURDATE(), INTERVAL 1 YEAR)`;

    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama}\nTanggal Terbit : ${moment(r.tanggal).format("DD-MM-YYYY")}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

const getBhtPerceraian = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT a.perkara_id, a.nomor_perkara, a.jenis_perkara_nama,
    @pbt := (CASE 
      WHEN b.dihadiri_oleh = 4 THEN (SELECT MAX(a1.tanggal_pemberitahuan_putusan) FROM perkara_putusan_pemberitahuan_putusan a1 WHERE a1.perkara_id = a.perkara_id) 
      WHEN b.dihadiri_oleh = 3 THEN (SELECT MAX(a2.tanggal_pemberitahuan_putusan) FROM perkara_putusan_pemberitahuan_putusan a2 WHERE a2.perkara_id = a.perkara_id AND a2.pihak=1)
      WHEN b.dihadiri_oleh = 2 THEN (SELECT MAX(a3.tanggal_pemberitahuan_putusan) FROM perkara_putusan_pemberitahuan_putusan a3 WHERE a3.perkara_id = a.perkara_id AND a3.pihak=2)
      WHEN b.dihadiri_oleh = 1 THEN a.tanggal_putusan
      ELSE NULL END) AS pbt,
    (DATE_SUB(@pbt, INTERVAL -15 DAY)) AS bht
    FROM v_perkara a
    JOIN perkara_jadwal_sidang b ON a.perkara_id = b.perkara_id AND b.tanggal_sidang = a.tanggal_putusan AND b.dihadiri_oleh IS NOT NULL 
    WHERE a.tanggal_bht IS NULL AND a.tahapan_terakhir_id = 15 AND a.status_putusan_id = 62 
    AND (a.jenis_perkara_id = 346 OR a.jenis_perkara_id = 347)
    AND (CASE 
      WHEN b.dihadiri_oleh = 4 THEN (SELECT MAX(a1.tanggal_pemberitahuan_putusan) FROM perkara_putusan_pemberitahuan_putusan a1 WHERE a1.perkara_id = a.perkara_id) 
      WHEN b.dihadiri_oleh = 3 THEN (SELECT MAX(a2.tanggal_pemberitahuan_putusan) FROM perkara_putusan_pemberitahuan_putusan a2 WHERE a2.perkara_id = a.perkara_id AND a2.pihak=1)
      WHEN b.dihadiri_oleh = 2 THEN (SELECT MAX(a3.tanggal_pemberitahuan_putusan) FROM perkara_putusan_pemberitahuan_putusan a3 WHERE a3.perkara_id = a.perkara_id AND a3.pihak=2)
      WHEN b.dihadiri_oleh = 1 THEN a.tanggal_putusan
      ELSE NULL END) < DATE_SUB(CURDATE(), INTERVAL 15 DAY) 
    ORDER BY a.alur_perkara_id, a.tanggal_putusan DESC;`;

    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            // Pastikan r.pbt dan r.bht tidak undefined
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama}\nPBT : ${moment(r.pbt).format("DD-MM-YYYY")}\nBHT : ${moment(r.bht).format("DD-MM-YYYY")}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataKuaCerai = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT 
    a.nomor_perkara,
    b.nama AS nama_penggugat,
    b.alamat AS alamat_penggugat,
    (SELECT nomor_indentitas FROM pihak WHERE id = b.pihak_id AND b.urutan = 1) AS ktp_penggugat,
    (SELECT nomor_indentitas FROM pihak WHERE id = d.pihak_id AND d.urutan = 1) AS ktp_tergugat,
    (CASE WHEN (SELECT jenis_kelamin FROM pihak WHERE id = b.pihak_id AND b.urutan = 1) = 'P' THEN 'Janda' ELSE 'Duda' END) AS status_penggugat,
    (CASE WHEN (SELECT jenis_kelamin FROM pihak WHERE id = d.pihak_id AND d.urutan = 1) = 'P' THEN 'Janda' ELSE 'Duda' END) AS status_tergugat,
    (SELECT tanggal_lahir FROM pihak WHERE id = b.pihak_id AND b.urutan = 1) AS tanggal_lahir_penggugat,
    (SELECT tanggal_lahir FROM pihak WHERE id = d.pihak_id AND d.urutan = 1) AS tanggal_lahir_tergugat,
    FLOOR(DATEDIFF(CURDATE(), (SELECT tanggal_lahir FROM pihak WHERE id = b.pihak_id AND b.urutan = 1))/365.25) AS umur_penggugat,
    FLOOR(DATEDIFF(CURDATE(), (SELECT tanggal_lahir FROM pihak WHERE id = d.pihak_id AND d.urutan = 1))/365.25) AS umur_tergugat,
    d.nama AS nama_tergugat,
    d.alamat AS alamat_tergugat,
    CASE 
        WHEN b.alamat LIKE '%Bungku Tengah%' THEN 'KUA Bungku Tengah'
        WHEN b.alamat LIKE '%Bungku Barat%' THEN 'KUA Bungku Barat'
        WHEN b.alamat LIKE '%Bungku Timur%' THEN 'KUA Bungku Timur'
        WHEN b.alamat LIKE '%Bumi Raya%' THEN 'KUA Bumi Raya'
        WHEN b.alamat LIKE '%Wita Ponda%' OR b.alamat LIKE '%Witaponda%' THEN 'KUA Wita Ponda'
        WHEN b.alamat LIKE '%Bahodopi%' THEN 'KUA Bahodopi'
        WHEN b.alamat LIKE '%Bungku Pesisir%' THEN 'KUA Bungku Pesisir'
        WHEN b.alamat LIKE '%Bungku Selatan%' THEN 'KUA Bungku Selatan'
        WHEN b.alamat LIKE '%Menui%' THEN 'KUA Menui'
        WHEN b.alamat LIKE '%Bungku Utara%' THEN 'KUA Bungku Utara'
        WHEN b.alamat LIKE '%Lembo%' THEN 'KUA Lembo'
        WHEN b.alamat LIKE '%Lembo Raya%' THEN 'KUA Lembo Raya'
        WHEN b.alamat LIKE '%Petasia%' THEN 'KUA Petasia'
        WHEN b.alamat LIKE '%Petasia Barat%' THEN 'KUA Petasia Barat'
        WHEN b.alamat LIKE '%Petasia Timur%' THEN 'KUA Petasia Timur'
        WHEN b.alamat LIKE '%Soyojaya%' THEN 'KUA Soyojaya'
        WHEN b.alamat LIKE '%Mori Atas%' THEN 'KUA Mori Atas'
        WHEN b.alamat LIKE '%Mori Utara%' THEN 'KUA Mori Utara'
        WHEN b.alamat LIKE '%Mamosalato%' THEN 'KUA Mamosalato'
        ELSE 'Diluar Wilayah KUA' 
    END AS wilayah_kua,
    CASE
        WHEN b.alamat LIKE '%Bungku Tengah%' OR b.alamat LIKE '%Bungku Barat%' OR b.alamat LIKE '%Bungku Timur%' OR b.alamat LIKE '%Bumi Raya%' OR b.alamat LIKE '%Wita Ponda%' OR b.alamat LIKE '%Witaponda%' OR b.alamat LIKE '%Bahodopi%' OR b.alamat LIKE '%Bungku Pesisir%' OR b.alamat LIKE '%Bungku Selatan%' OR b.alamat LIKE '%Menui%' THEN 'Morowali'
        WHEN b.alamat LIKE '%Bungku Utara%' OR b.alamat LIKE '%Lembo%' OR b.alamat LIKE '%Lembo Raya%' OR b.alamat LIKE '%Petasia%' OR b.alamat LIKE '%Petasia Barat%' OR b.alamat LIKE '%Petasia Timur%' OR b.alamat LIKE '%Soyojaya%' OR b.alamat LIKE '%Mori Atas%' OR b.alamat LIKE '%Mori Utara%' OR b.alamat LIKE '%Mamosalato%' THEN 'Morowali Utara'
        ELSE 'Diluar Wilayah KUA'
    END AS wilayah_kabupaten
    FROM 
        perkara AS a
    LEFT JOIN 
        perkara_pihak1 AS b ON a.perkara_id = b.perkara_id
    LEFT JOIN 
        pihak AS c ON b.pihak_id = c.id
    LEFT JOIN 
        perkara_pihak2 AS d ON a.perkara_id = d.perkara_id
    LEFT JOIN 
        perkara_putusan AS e ON a.perkara_id = e.perkara_id
    WHERE
        a.jenis_perkara_id IN (346, 347) AND
        e.status_putusan_id = 62 AND
        YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE()) 
    ORDER BY 
        wilayah_kabupaten DESC,
        wilayah_kua DESC;`;

    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nNama : ${r.nama_penggugat}\nUmur : ${r.umur_penggugat}\nStatus : ${r.status_penggugat}\nNIK : ${r.ktp_penggugat}\n\nNama : ${r.nama_tergugat}\nUmur : ${r.umur_tergugat}\nStatus : ${r.status_tergugat}\nNIK : ${r.ktp_tergugat}\n\nWilayah KUA : ${r.wilayah_kua}\nWilayah Kabupaten : ${r.wilayah_kabupaten}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataCapilCerai = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT 
    a.nomor_perkara,
    b.nama AS nama_penggugat,
    b.alamat AS alamat_penggugat,
    IF((SELECT nomor_indentitas FROM pihak WHERE id = b.pihak_id AND b.urutan = 1) = '', '-', (SELECT nomor_indentitas FROM pihak WHERE id = b.pihak_id AND b.urutan = 1)) AS ktp_penggugat,
    IF((SELECT nomor_indentitas FROM pihak WHERE id = d.pihak_id AND d.urutan = 1) = '', '-', (SELECT nomor_indentitas FROM pihak WHERE id = d.pihak_id AND d.urutan = 1)) AS ktp_tergugat,
    (CASE WHEN (SELECT jenis_kelamin FROM pihak WHERE id = b.pihak_id AND b.urutan = 1) = 'P' THEN 'Janda' ELSE 'Duda' END) AS status_penggugat,
    (CASE WHEN (SELECT jenis_kelamin FROM pihak WHERE id = d.pihak_id AND d.urutan = 1) = 'P' THEN 'Janda' ELSE 'Duda' END) AS status_tergugat,
    (SELECT tanggal_lahir FROM pihak WHERE id = b.pihak_id AND b.urutan = 1) AS tanggal_lahir_penggugat,
    (SELECT tanggal_lahir FROM pihak WHERE id = d.pihak_id AND d.urutan = 1) AS tanggal_lahir_tergugat,
    FLOOR(DATEDIFF(CURDATE(), (SELECT tanggal_lahir FROM pihak WHERE id = b.pihak_id AND b.urutan = 1))/365.25) AS umur_penggugat,
    FLOOR(DATEDIFF(CURDATE(), (SELECT tanggal_lahir FROM pihak WHERE id = d.pihak_id AND d.urutan = 1))/365.25) AS umur_tergugat,
    d.nama AS nama_tergugat,
    d.alamat AS alamat_tergugat,
    CASE 
        WHEN b.alamat LIKE '%Bungku Tengah%' THEN 'Bungku Tengah'
        WHEN b.alamat LIKE '%Bungku Barat%' THEN 'Bungku Barat'
        WHEN b.alamat LIKE '%Bungku Timur%' THEN 'Bungku Timur'
        WHEN b.alamat LIKE '%Bumi Raya%' THEN 'Bumi Raya'
        WHEN b.alamat LIKE '%Wita Ponda%' OR b.alamat LIKE '%Witaponda%' THEN 'Wita Ponda'
        WHEN b.alamat LIKE '%Bahodopi%' THEN 'Bahodopi'
        WHEN b.alamat LIKE '%Bungku Pesisir%' THEN 'Bungku Pesisir'
        WHEN b.alamat LIKE '%Bungku Selatan%' THEN 'Bungku Selatan'
        WHEN b.alamat LIKE '%Menui%' THEN 'Menui'
        WHEN b.alamat LIKE '%Bungku Utara%' THEN 'Bungku Utara'
        WHEN b.alamat LIKE '%Lembo%' THEN 'Lembo'
        WHEN b.alamat LIKE '%Lembo Raya%' THEN 'Lembo Raya'
        WHEN b.alamat LIKE '%Petasia%' THEN 'Petasia'
        WHEN b.alamat LIKE '%Petasia Barat%' THEN 'Petasia Barat'
        WHEN b.alamat LIKE '%Petasia Timur%' THEN 'Petasia Timur'
        WHEN b.alamat LIKE '%Soyojaya%' OR b.alamat LIKE '%Soyo Jaya%' THEN 'Soyojaya'
        WHEN b.alamat LIKE '%Mori Atas%' THEN 'Mori Atas'
        WHEN b.alamat LIKE '%Mori Utara%' THEN 'Mori Utara'
        WHEN b.alamat LIKE '%Mamosalato%' THEN 'Mamosalato'
        ELSE 'Wilayah Diluar Morowali Dan Morowali Utara' 
    END AS wilayah_kecamatan_penggugat,
    CASE
        WHEN b.alamat LIKE '%Bungku Tengah%' OR b.alamat LIKE '%Bungku Barat%' OR b.alamat LIKE '%Bungku Timur%' OR b.alamat LIKE '%Bumi Raya%' OR b.alamat LIKE '%Wita Ponda%' OR b.alamat LIKE '%Witaponda%' OR b.alamat LIKE '%Bahodopi%' OR b.alamat LIKE '%Bungku Pesisir%' OR b.alamat LIKE '%Bungku Selatan%' OR b.alamat LIKE '%Menui%' THEN 'Morowali'
        WHEN b.alamat LIKE '%Bungku Utara%' OR b.alamat LIKE '%Lembo%' OR b.alamat LIKE '%Lembo Raya%' OR b.alamat LIKE '%Petasia%' OR b.alamat LIKE '%Petasia Barat%' OR b.alamat LIKE '%Petasia Timur%' OR b.alamat LIKE '%Soyojaya%' OR b.alamat LIKE '%Soyo Jaya%' OR b.alamat LIKE '%Mori Atas%' OR b.alamat LIKE '%Mori Utara%' OR b.alamat LIKE '%Mamosalato%' THEN 'Morowali Utara'
        ELSE 'Wilayah Diluar Morowali Dan Morowali Utara'
    END AS wilayah_kabupaten_penggugat,
    CASE 
        WHEN d.alamat LIKE '%Bungku Tengah%' THEN 'Bungku Tengah'
        WHEN d.alamat LIKE '%Bungku Barat%' THEN 'Bungku Barat'
        WHEN d.alamat LIKE '%Bungku Timur%' THEN 'Bungku Timur'
        WHEN d.alamat LIKE '%Bumi Raya%' THEN 'Bumi Raya'
        WHEN d.alamat LIKE '%Wita Ponda%' OR d.alamat LIKE '%Witaponda%' THEN 'Wita Ponda'
        WHEN d.alamat LIKE '%Bahodopi%' THEN 'Bahodopi'
        WHEN d.alamat LIKE '%Bungku Pesisir%' THEN 'Bungku Pesisir'
        WHEN d.alamat LIKE '%Bungku Selatan%' THEN 'Bungku Selatan'
        WHEN d.alamat LIKE '%Menui%' THEN 'Menui'
        WHEN d.alamat LIKE '%Bungku Utara%' THEN 'Bungku Utara'
        WHEN d.alamat LIKE '%Lembo%' THEN 'Lembo'
        WHEN d.alamat LIKE '%Lembo Raya%' THEN 'Lembo Raya'
        WHEN d.alamat LIKE '%Petasia%' THEN 'Petasia'
        WHEN d.alamat LIKE '%Petasia Barat%' THEN 'Petasia Barat'
        WHEN d.alamat LIKE '%Petasia Timur%' THEN 'Petasia Timur'
        WHEN d.alamat LIKE '%Soyojaya%' OR d.alamat LIKE '%Soyo Jaya%' THEN 'Soyojaya'
        WHEN d.alamat LIKE '%Mori Atas%' THEN 'Mori Atas'
        WHEN d.alamat LIKE '%Mori Utara%' THEN 'Mori Utara'
        WHEN d.alamat LIKE '%Mamosalato%' THEN 'Mamosalato'
        ELSE 'Wilayah Diluar Morowali Dan Morowali Utara' 
    END AS wilayah_kecamatan_tergugat,
    CASE
        WHEN d.alamat LIKE '%Bungku Tengah%' OR d.alamat LIKE '%Bungku Barat%' OR d.alamat LIKE '%Bungku Timur%' OR d.alamat LIKE '%Bumi Raya%' OR d.alamat LIKE '%Wita Ponda%' OR d.alamat LIKE '%Witaponda%' OR d.alamat LIKE '%Bahodopi%' OR d.alamat LIKE '%Bungku Pesisir%' OR d.alamat LIKE '%Bungku Selatan%' OR d.alamat LIKE '%Menui%' THEN 'Morowali'
        WHEN d.alamat LIKE '%Bungku Utara%' OR d.alamat LIKE '%Lembo%' OR d.alamat LIKE '%Lembo Raya%' OR d.alamat LIKE '%Petasia%' OR d.alamat LIKE '%Petasia Barat%' OR d.alamat LIKE '%Petasia Timur%' OR d.alamat LIKE '%Soyojaya%' OR d.alamat LIKE '%Soyo Jaya%' OR d.alamat LIKE '%Mori Atas%' OR d.alamat LIKE '%Mori Utara%' OR d.alamat LIKE '%Mamosalato%' THEN 'Morowali Utara'
        ELSE 'Wilayah Diluar Morowali Dan Morowali Utara'
    END AS wilayah_kabupaten_tergugat,
    CASE 
        WHEN b.alamat LIKE '%Lanona%' THEN 'Desa Lanona'
        WHEN b.alamat LIKE '%Bahomante%' THEN 'Desa Bahomante'
        WHEN b.alamat LIKE '%Bahomohoni%' THEN 'Desa Bahomohoni'
        WHEN b.alamat LIKE '%Bente%' THEN 'Desa Bente'
        WHEN b.alamat LIKE '%Bahomoleo%' THEN 'Desa Bahomoleo'
        WHEN b.alamat LIKE '%Ipi%' THEN 'Desa Ipi'
        WHEN b.alamat LIKE '%Bahoruru%' THEN 'Desa Bahoruru'
        WHEN b.alamat LIKE '%Bungi%' THEN 'Desa Bungi'
        WHEN b.alamat LIKE '%Marsaoleh%' THEN 'Desa Marsaoleh'
        WHEN b.alamat LIKE '%Matano%' THEN 'Desa Matano'
        WHEN b.alamat LIKE '%Tofoiso%' THEN 'Desa Tofoiso'
        WHEN b.alamat LIKE '%Lamberea%' THEN 'Desa Lamberea'
        WHEN b.alamat LIKE '%Matansala%' THEN 'Desa Matansala'
        WHEN b.alamat LIKE '%Mendui%' THEN 'Desa Mendui'
        WHEN b.alamat LIKE '%Sakita%' THEN 'Desa Sakita'
        WHEN b.alamat LIKE '%Tofuti%' THEN 'Desa Tofuti'
        WHEN b.alamat LIKE '%Bahontobungku%' THEN 'Desa Bahontobungku'
        WHEN b.alamat LIKE '%Tudua%' THEN 'Desa Tudua'
        WHEN b.alamat LIKE '%Pungkuelu%' THEN 'Desa Pungkuelu'
        WHEN b.alamat LIKE '%Lahuafu%' THEN 'Desa Lahuafu'
        WHEN b.alamat LIKE '%Unsongi%' THEN 'Desa Unsongi'
        WHEN b.alamat LIKE '%Nambo%' THEN 'Desa Nambo'
        WHEN b.alamat LIKE '%Laroue%' THEN 'Desa Laroue'
        WHEN b.alamat LIKE '%Geresa%' THEN 'Desa Geresa'
        WHEN b.alamat LIKE '%Kolono%' THEN 'Desa Kolono'
        WHEN b.alamat LIKE '%Ululere%' THEN 'Desa Ululere'
        WHEN b.alamat LIKE '%Bahomoahi%' THEN 'Desa Bahomoahi'
        WHEN b.alamat LIKE '%Bahomotofe%' THEN 'Desa Bahomotofe'
        WHEN b.alamat LIKE '%Onepute Jaya%' THEN 'Desa Onepute Jaya'
        WHEN b.alamat LIKE '%Bahoea Reko Reko%' THEN 'Desa Bahoea Reko Reko'
        WHEN b.alamat LIKE '%Wosu%' THEN 'Desa Wosu'
        WHEN b.alamat LIKE '%Larobenu%' THEN 'Desa Larobenu'
        WHEN b.alamat LIKE '%Umpanga%' THEN 'Desa Umpanga'
        WHEN b.alamat LIKE '%Topogaro%' THEN 'Desa Topogaro'
        WHEN b.alamat LIKE '%Tondo%' THEN 'Desa Tondo'
        WHEN b.alamat LIKE '%Ambunu%' THEN 'Desa Ambunu'
        WHEN b.alamat LIKE '%Uedago%' THEN 'Desa Uedago'
        WHEN b.alamat LIKE '%Wata%' THEN 'Desa Wata'
        WHEN b.alamat LIKE '%Marga Mulya%' THEN 'Desa Marga Mulya'
        WHEN b.alamat LIKE '%Parilangke%' THEN 'Desa Parilangke'
        WHEN b.alamat LIKE '%Bohonsuai%' THEN 'Desa Bohonsuai'
        WHEN b.alamat LIKE '%Samarenda%' THEN 'Desa Samarenda'
        WHEN b.alamat LIKE '%Atananga%' THEN 'Desa Atananga'
        WHEN b.alamat LIKE '%Pebatae%' THEN 'Desa Pebatae'
        WHEN b.alamat LIKE '%Pebotoa%' THEN 'Desa Pebotoa'
        WHEN b.alamat LIKE '%Umbele%' THEN 'Desa Umbele'
        WHEN b.alamat LIKE '%Karaupa%' THEN 'Desa Karaupa'
        WHEN b.alamat LIKE '%Lasampi%' THEN 'Desa Lasampi'
        WHEN b.alamat LIKE '%Beringin Jaya%' THEN 'Desa Beringin Jaya'
        WHEN b.alamat LIKE '%Harapan Jaya%' THEN 'Desa Harapan Jaya'
        WHEN b.alamat LIKE '%Lambelu%' THEN 'Desa Lambelu'
        WHEN b.alamat LIKE '%Limbo Makmur%' THEN 'Desa Limbo Makmur'
        WHEN b.alamat LIKE '%Sampeantaba%' THEN 'Desa Sampeantaba'
        WHEN b.alamat LIKE '%Emea%' THEN 'Desa Emea'
        WHEN b.alamat LIKE '%Ungkaya%' THEN 'Desa Ungkaya'
        WHEN b.alamat LIKE '%Moahino%' THEN 'Desa Moahino'
        WHEN b.alamat LIKE '%Solonsa Jaya%' THEN 'Desa Solonsa Jaya'
        WHEN b.alamat LIKE '%Solonsa%' THEN 'Desa Solonsa'
        WHEN b.alamat LIKE '%Puntari Makmur%' THEN 'Desa Puntari Makmur'
        WHEN b.alamat LIKE '%Lantula Jaya%' THEN 'Desa Lantula Jaya'
        WHEN b.alamat LIKE '%Bumi Harapan%' THEN 'Desa Bumi Harapan'
        WHEN b.alamat LIKE '%Bete-Bete%' THEN 'Desa Bete-Bete'
        WHEN b.alamat LIKE '%Padabaho%' THEN 'Desa Padabaho'
        WHEN b.alamat LIKE '%Makarti Jaya%' THEN 'Desa Makarti Jaya'
        WHEN b.alamat LIKE '%Labota%' THEN 'Desa Labota'
        WHEN b.alamat LIKE '%Fatufia%' THEN 'Desa Fatufia'
        WHEN b.alamat LIKE '%Keurea%' THEN 'Desa Keurea'
        WHEN b.alamat LIKE '%Bahomakmur%' THEN 'Desa Bahomakmur'
        WHEN b.alamat LIKE '%Bahodopi%' THEN 'Desa Bahodopi'
        WHEN b.alamat LIKE '%Lalampu%' THEN 'Desa Lalampu'
        WHEN b.alamat LIKE '%Siumbatu%' THEN 'Desa Siumbatu'
        WHEN b.alamat LIKE '%Dampala%' THEN 'Desa Dampala'
        WHEN b.alamat LIKE '%Le-Le%' THEN 'Desa Le-Le'
        WHEN b.alamat LIKE '%One ete%' THEN 'Desa One ete'
        WHEN b.alamat LIKE '%Puungkueu%' THEN 'Desa Puungkueu'
        WHEN b.alamat LIKE '%Tangofa%' THEN 'Desa Tangofa'
        WHEN b.alamat LIKE '%Tanda Oleo%' THEN 'Desa Tanda Oleo'
        WHEN b.alamat LIKE '%Lafeu%' THEN 'Desa Lafeu'
        WHEN b.alamat LIKE '%Torete%' THEN 'Desa Torete'
        WHEN b.alamat LIKE '%Buleleng%' THEN 'Desa Buleleng'
        WHEN b.alamat LIKE '%Laroenai%' THEN 'Desa Laroenai'
        WHEN b.alamat LIKE '%Sambalagi%' THEN 'Desa Sambalagi'
        WHEN b.alamat LIKE '%Wereea%' THEN 'Desa Wereea'
        WHEN b.alamat LIKE '%Buajangka%' THEN 'Desa Buajangka'
        WHEN b.alamat LIKE '%Bakal%' THEN 'Desa Bakal'
        WHEN b.alamat LIKE '%Paku%' THEN 'Desa Paku'
        WHEN b.alamat LIKE '%Kuburu%' THEN 'Desa Kuburu'
        WHEN b.alamat LIKE '%Buton%' THEN 'Desa Buton'
        WHEN b.alamat LIKE '%Jawi-Jawi%' THEN 'Desa Jawi-Jawi'
        WHEN b.alamat LIKE '%Lakumbulo%' THEN 'Desa Lakumbulo'
        WHEN b.alamat LIKE '%Kaleroang%' THEN 'Desa Kaleroang'
        WHEN b.alamat LIKE '%Bungingkela%' THEN 'Desa Bungingkela'
        WHEN b.alamat LIKE '%Powaru%' THEN 'Desa Powaru'
        WHEN b.alamat LIKE '%Poo%' THEN 'Desa Poo'
        WHEN b.alamat LIKE '%Waru-Waru%' THEN 'Desa Waru-Waru'
        WHEN b.alamat LIKE '%Pada Bale%' THEN 'Desa Pada Bale'
        WHEN b.alamat LIKE '%Pado-Pado%' THEN 'Desa Pado-Pado'
        WHEN b.alamat LIKE '%Pulau Bapa%' THEN 'Desa Pulau Bapa'
        WHEN b.alamat LIKE '%Lamontoli%' THEN 'Desa Lamontoli'
        WHEN b.alamat LIKE '%Lalemo%' THEN 'Desa Lalemo'
        WHEN b.alamat LIKE '%Pulau Dua Darat%' THEN 'Desa Pulau Dua Darat'
        WHEN b.alamat LIKE '%Bungintende%' THEN 'Desa Bungintende'
        WHEN b.alamat LIKE '%Saenoa%' THEN 'Desa Saenoa'
        WHEN b.alamat LIKE '%Buelemo%' THEN 'Desa Buelemo'
        WHEN b.alamat LIKE '%Panimbawang%' THEN 'Desa Panimbawang'
        WHEN b.alamat LIKE '%Umbele Butong%' THEN 'Desa Umbele Butong'
        WHEN b.alamat LIKE '%Umbele Lama%' THEN 'Desa Umbele Lama'
        WHEN b.alamat LIKE '%Polewali%' THEN 'Desa Polewali'
        WHEN b.alamat LIKE '%Pulau Dua%' THEN 'Desa Pulau Dua'
        WHEN b.alamat LIKE '%Buranga%' THEN 'Desa Buranga'
        WHEN b.alamat LIKE '%Kofalagadi%' THEN 'Desa Kofalagadi'
        WHEN b.alamat LIKE '%Tafagapi%' THEN 'Desa Tafagapi'
        WHEN b.alamat LIKE '%Terebino%' THEN 'Desa Terebino'
        WHEN b.alamat LIKE '%Ulunipa%' THEN 'Desa Ulunipa'
        WHEN b.alamat LIKE '%Torukuno%' THEN 'Desa Torukuno'
        WHEN b.alamat LIKE '%Matarape%' THEN 'Desa Matarape'
        WHEN b.alamat LIKE '%Molore%' THEN 'Desa Molore'
        WHEN b.alamat LIKE '%Pulau Tiga%' THEN 'Desa Pulau Tiga'
        WHEN b.alamat LIKE '%Wowongkolono%' THEN 'Desa Wowongkolono'
        WHEN b.alamat LIKE '%Padei Darat%' THEN 'Desa Padei Darat'
        WHEN b.alamat LIKE '%Padei Laut%' THEN 'Desa Padei Laut'
        WHEN b.alamat LIKE '%Ulunambo%' THEN 'Desa Ulunambo'
        WHEN b.alamat LIKE '%Torebino%' THEN 'Desa Torebino'
        WHEN b.alamat LIKE '%Uliunipa%' THEN 'Desa Uliunipa'
        WHEN b.alamat LIKE '%Kopalagadi%' THEN 'Desa Kopalagadi'
        WHEN b.alamat LIKE '%Padalaa%' THEN 'Desa Padalaa'
        WHEN b.alamat LIKE '%Samarengga%' THEN 'Desa Samarengga'
        WHEN b.alamat LIKE '%Morompaitonga%' THEN 'Desa Morompaitonga'
        WHEN b.alamat LIKE '%Ngopoesa%' THEN 'Desa Ngopoesa'
        WHEN b.alamat LIKE '%Matano (Menui)%' THEN 'Desa Matano (Menui)'
        WHEN b.alamat LIKE '%Mbokiita%' THEN 'Desa Mbokiita'
        WHEN b.alamat LIKE '%Masadian%' THEN 'Desa Masadian'
        WHEN b.alamat LIKE '%Ngapaea%' THEN 'Desa Ngapaea'
        WHEN b.alamat LIKE '%Pulau Tiga%' THEN 'Desa Pulau Tiga'
        WHEN b.alamat LIKE '%Pulau Tengah%' THEN 'Desa Pulau Tengah'
        WHEN b.alamat LIKE '%Tanona%' THEN 'Desa Tanona'
        WHEN b.alamat LIKE '%Tanjung Harapan%' THEN 'Desa Tanjung Harapan'
        WHEN b.alamat LIKE '%Tanjung Tiram%' THEN 'Desa Tanjung Tiram'
        WHEN b.alamat LIKE '%Lombokita%' THEN 'Desa Lombokita'
        WHEN b.alamat LIKE '%Bunta%' THEN 'Desa Bunta'
        WHEN b.alamat LIKE '%Tompira%' THEN 'Desa Tompira'
        WHEN b.alamat LIKE '%Bungintimbe%' THEN 'Desa Bungintimbe'
        WHEN b.alamat LIKE '%Towara%' THEN 'Desa Towara'
        WHEN b.alamat LIKE '%Molino%' THEN 'Desa Molino'
        WHEN b.alamat LIKE '%Mohoni%' THEN 'Desa Mohoni'
        WHEN b.alamat LIKE '%Ungkea%' THEN 'Desa Ungkea'
        WHEN b.alamat LIKE '%Bimor Jaya%' THEN 'Desa Bimor Jaya'
        WHEN b.alamat LIKE '%Molores%' THEN 'Desa Molores'
        WHEN b.alamat LIKE '%Keuno%' THEN 'Desa Keuno'
        WHEN b.alamat LIKE '%Towara Pantai%' THEN 'Desa Towara Pantai'
        WHEN b.alamat LIKE '%Peboa%' THEN 'Desa Peboa'
        WHEN b.alamat LIKE '%Kolonodale%' THEN 'Desa Kolonodale'
        WHEN b.alamat LIKE '%Bahontula%' THEN 'Desa Bahontula'
        WHEN b.alamat LIKE '%Bahoue%' THEN 'Desa Bahoue'
        WHEN b.alamat LIKE '%Ganda Ganda%' THEN 'Desa Ganda Ganda'
        WHEN b.alamat LIKE '%Koya*%' THEN 'Desa Koya*'
        WHEN b.alamat LIKE '%Gililana*%' THEN 'Desa Gililana*'
        WHEN b.alamat LIKE '%Tanauge*%' THEN 'Desa Tanauge*'
        WHEN b.alamat LIKE '%Korololaki%' THEN 'Desa Korololaki'
        WHEN b.alamat LIKE '%Korololama%' THEN 'Desa Korololama'
        WHEN b.alamat LIKE '%Koromatantu%' THEN 'Desa Koromatantu'
        WHEN b.alamat LIKE '%Beteleme%' THEN 'Desa Beteleme'
        WHEN b.alamat LIKE '%Uluanso%' THEN 'Desa Uluanso'
        WHEN b.alamat LIKE '%Mora%' THEN 'Desa Mora'
        WHEN b.alamat LIKE '%Waraa%' THEN 'Desa Waraa'
        WHEN b.alamat LIKE '%Tingkeao%' THEN 'Desa Tingkeao'
        WHEN b.alamat LIKE '%Wawopada%' THEN 'Desa Wawopada'
        WHEN b.alamat LIKE '%Korowalelo%' THEN 'Desa Korowalelo'
        WHEN b.alamat LIKE '%Tinompo%' THEN 'Desa Tinompo'
        WHEN b.alamat LIKE '%Kumpi%' THEN 'Desa Kumpi'
        WHEN b.alamat LIKE '%Korompeeli%' THEN 'Desa Korompeeli'
        WHEN b.alamat LIKE '%Lemboroma%' THEN 'Desa Lemboroma'
        WHEN b.alamat LIKE '%Korowou%' THEN 'Desa Korowou'
        WHEN b.alamat LIKE '%Lembobaru%' THEN 'Desa Lembobaru'
        WHEN b.alamat LIKE '%Korobonde%' THEN 'Desa Korobonde'
        WHEN b.alamat LIKE '%Tiu%' THEN 'Desa Tiu'
        WHEN b.alamat LIKE '%Tontowea%' THEN 'Desa Tontowea'
        WHEN b.alamat LIKE '%Togo Mulyo%' THEN 'Desa Togo Mulyo'
        WHEN b.alamat LIKE '%Maralee%' THEN 'Desa Maralee'
        WHEN b.alamat LIKE '%Mondowe%' THEN 'Desa Mondowe'
        WHEN b.alamat LIKE '%Sampalowo%' THEN 'Desa Sampalowo'
        WHEN b.alamat LIKE '%Moleono%' THEN 'Desa Moleono'
        WHEN b.alamat LIKE '%Onepute%' THEN 'Desa Onepute'
        WHEN b.alamat LIKE '%Ulu Laa%' THEN 'Desa Ulu Laa'
        WHEN b.alamat LIKE '%Tadaku Jaya%' THEN 'Desa Tadaku Jaya'
        WHEN b.alamat LIKE '%Dolupo Karya%' THEN 'Desa Dolupo Karya'
        WHEN b.alamat LIKE '%Poona%' THEN 'Desa Poona'
        WHEN b.alamat LIKE '%Petumbea%' THEN 'Desa Petumbea'
        WHEN b.alamat LIKE '%Ronta%' THEN 'Desa Ronta'
        WHEN b.alamat LIKE '%Pontangoa%' THEN 'Desa Pontangoa'
        WHEN b.alamat LIKE '%Jamor Jaya%' THEN 'Desa Jamor Jaya'
        WHEN b.alamat LIKE '%Paawaru%' THEN 'Desa Paawaru'
        WHEN b.alamat LIKE '%Lembobelala%' THEN 'Desa Lembobelala'
        WHEN b.alamat LIKE '%Bintangor Mukti%' THEN 'Desa Bintangor Mukti'
        WHEN b.alamat LIKE '%Mandula%' THEN 'Desa Mandula'
        WHEN b.alamat LIKE '%Tomata%' THEN 'Desa Tomata'
        WHEN b.alamat LIKE '%Londi%' THEN 'Desa Londi'
        WHEN b.alamat LIKE '%Taende%' THEN 'Desa Taende'
        WHEN b.alamat LIKE '%Ensa%' THEN 'Desa Ensa'
        WHEN b.alamat LIKE '%Kolaka%' THEN 'Desa Kolaka'
        WHEN b.alamat LIKE '%Peonea%' THEN 'Desa Peonea'
        WHEN b.alamat LIKE '%Lanumor%' THEN 'Desa Lanumor'
        WHEN b.alamat LIKE '%Gontara%' THEN 'Desa Gontara'
        WHEN b.alamat LIKE '%Lee%' THEN 'Desa Lee'
        WHEN b.alamat LIKE '%Saemba%' THEN 'Desa Saemba'
        WHEN b.alamat LIKE '%Kasingoli%' THEN 'Desa Kasingoli'
        WHEN b.alamat LIKE '%Tomui Karya%' THEN 'Desa Tomui Karya'
        WHEN b.alamat LIKE '%Saemba Walati%' THEN 'Desa Saemba Walati'
        WHEN b.alamat LIKE '%Pambarea%' THEN 'Desa Pambarea'
        WHEN b.alamat LIKE '%Era%' THEN 'Desa Era'
        WHEN b.alamat LIKE '%Peleru%' THEN 'Desa Peleru'
        WHEN b.alamat LIKE '%Tamonjengi%' THEN 'Desa Tamonjengi'
        WHEN b.alamat LIKE '%Mayumba%' THEN 'Desa Mayumba'
        WHEN b.alamat LIKE '%Tiwaa%' THEN 'Desa Tiwaa'
        WHEN b.alamat LIKE '%Lembontonara%' THEN 'Desa Lembontonara'
        WHEN b.alamat LIKE '%Tabarano%' THEN 'Desa Tabarano'
        WHEN b.alamat LIKE '%Wawondula%' THEN 'Desa Wawondula'
        WHEN b.alamat LIKE '%Lembah Sumara%' THEN 'Desa Lembah Sumara'
        WHEN b.alamat LIKE '%Sumara Jaya%' THEN 'Desa Sumara Jaya'
        WHEN b.alamat LIKE '%Tambayoli%' THEN 'Desa Tambayoli'
        WHEN b.alamat LIKE '%Malino%' THEN 'Desa Malino'
        WHEN b.alamat LIKE '%Panca Makmur%' THEN 'Desa Panca Makmur'
        WHEN b.alamat LIKE '%Tamainusi%' THEN 'Desa Tamainusi'
        WHEN b.alamat LIKE '%Bau%' THEN 'Desa Bau'
        WHEN b.alamat LIKE '%Malino Jaya%' THEN 'Desa Malino Jaya'
        WHEN b.alamat LIKE '%Toddopoli Uebangke%' THEN 'Desa Toddopoli Uebangke'
        WHEN b.alamat LIKE '%Tandoyondo%' THEN 'Desa Tandoyondo'
        WHEN b.alamat LIKE '%Baturube%' THEN 'Desa Baturube'
        WHEN b.alamat LIKE '%Posangke%' THEN 'Desa Posangke'
        WHEN b.alamat LIKE '%Taronggo%' THEN 'Desa Taronggo'
        WHEN b.alamat LIKE '%Ueruru%' THEN 'Desa Ueruru'
        WHEN b.alamat LIKE '%Uewajo%' THEN 'Desa Uewajo'
        WHEN b.alamat LIKE '%Tirongan Bawah%' THEN 'Desa Tirongan Bawah'
        WHEN b.alamat LIKE '%Tirongan Atas%' THEN 'Desa Tirongan Atas'
        WHEN b.alamat LIKE '%Siliti%' THEN 'Desa Siliti'
        WHEN b.alamat LIKE '%Lemo%' THEN 'Desa Lemo'
        WHEN b.alamat LIKE '%Salubiro%' THEN 'Desa Salubiro'
        WHEN b.alamat LIKE '%Uemasi%' THEN 'Desa Uemasi'
        WHEN b.alamat LIKE '%Opo%' THEN 'Desa Opo'
        WHEN b.alamat LIKE '%Tanakuraya%' THEN 'Desa Tanakuraya'
        WHEN b.alamat LIKE '%Tambarobone%' THEN 'Desa Tambarobone'
        WHEN b.alamat LIKE '%Woomparigi%' THEN 'Desa Woomparigi'
        WHEN b.alamat LIKE '%Boba%' THEN 'Desa Boba'
        WHEN b.alamat LIKE '%Kalombang%' THEN 'Desa Kalombang'
        WHEN b.alamat LIKE '%Tokonanaka%' THEN 'Desa Tokonanaka'
        WHEN b.alamat LIKE '%Matube%' THEN 'Desa Matube'
        WHEN b.alamat LIKE '%Lemowalia%' THEN 'Desa Lemowalia'
        WHEN b.alamat LIKE '%Uempanapa%' THEN 'Desa Uempanapa'
        WHEN b.alamat LIKE '%Tokala Atas%' THEN 'Desa Tokala Atas'
        WHEN b.alamat LIKE '%Pokeang%' THEN 'Desa Pokeang'
        WHEN b.alamat LIKE '%Pandauke%' THEN 'Desa Pandauke'
        WHEN b.alamat LIKE '%Kolo Bawah%' THEN 'Desa Kolo Bawah'
        WHEN b.alamat LIKE '%Kolo Atas%' THEN 'Desa Kolo Atas'
        WHEN b.alamat LIKE '%Momo%' THEN 'Desa Momo'
        WHEN b.alamat LIKE '%Tananagaya%' THEN 'Desa Tananagaya'
        WHEN b.alamat LIKE '%Uepakatu%' THEN 'Desa Uepakatu'
        WHEN b.alamat LIKE '%Lijo%' THEN 'Desa Lijo'
        WHEN b.alamat LIKE '%Tanasumpu%' THEN 'Desa Tanasumpu'
        WHEN b.alamat LIKE '%Parangisi%' THEN 'Desa Parangisi'
        WHEN b.alamat LIKE '%Girimulya%' THEN 'Desa Girimulya'
        WHEN b.alamat LIKE '%Winangobino%' THEN 'Desa Winangobino'
        WHEN b.alamat LIKE '%Tambale%' THEN 'Desa Tambale'
        WHEN b.alamat LIKE '%Sea%' THEN 'Desa Sea'
        WHEN b.alamat LIKE '%Menyoe%' THEN 'Desa Menyoe'
        ELSE 'Wilayah Diluar Morowali Dan Morowali Utara'
    END AS wilayah_desa_penggugat,
    CASE 
        WHEN d.alamat LIKE '%Lanona%' THEN 'Desa Lanona'
        WHEN d.alamat LIKE '%Bahomante%' THEN 'Desa Bahomante'
        WHEN d.alamat LIKE '%Bahomohoni%' THEN 'Desa Bahomohoni'
        WHEN d.alamat LIKE '%Bente%' THEN 'Desa Bente'
        WHEN d.alamat LIKE '%Bahomoleo%' THEN 'Desa Bahomoleo'
        WHEN d.alamat LIKE '%Ipi%' THEN 'Desa Ipi'
        WHEN d.alamat LIKE '%Bahoruru%' THEN 'Desa Bahoruru'
        WHEN d.alamat LIKE '%Bungi%' THEN 'Desa Bungi'
        WHEN d.alamat LIKE '%Marsaoleh%' THEN 'Desa Marsaoleh'
        WHEN d.alamat LIKE '%Matano%' THEN 'Desa Matano'
        WHEN d.alamat LIKE '%Tofoiso%' THEN 'Desa Tofoiso'
        WHEN d.alamat LIKE '%Lamberea%' THEN 'Desa Lamberea'
        WHEN d.alamat LIKE '%Matansala%' THEN 'Desa Matansala'
        WHEN d.alamat LIKE '%Mendui%' THEN 'Desa Mendui'
        WHEN d.alamat LIKE '%Sakita%' THEN 'Desa Sakita'
        WHEN d.alamat LIKE '%Tofuti%' THEN 'Desa Tofuti'
        WHEN d.alamat LIKE '%Bahontobungku%' THEN 'Desa Bahontobungku'
        WHEN d.alamat LIKE '%Tudua%' THEN 'Desa Tudua'
        WHEN d.alamat LIKE '%Pungkuelu%' THEN 'Desa Pungkuelu'
        WHEN d.alamat LIKE '%Lahuafu%' THEN 'Desa Lahuafu'
        WHEN d.alamat LIKE '%Unsongi%' THEN 'Desa Unsongi'
        WHEN d.alamat LIKE '%Nambo%' THEN 'Desa Nambo'
        WHEN d.alamat LIKE '%Laroue%' THEN 'Desa Laroue'
        WHEN d.alamat LIKE '%Geresa%' THEN 'Desa Geresa'
        WHEN d.alamat LIKE '%Kolono%' THEN 'Desa Kolono'
        WHEN d.alamat LIKE '%Ululere%' THEN 'Desa Ululere'
        WHEN d.alamat LIKE '%Bahomoahi%' THEN 'Desa Bahomoahi'
        WHEN d.alamat LIKE '%Bahomotofe%' THEN 'Desa Bahomotofe'
        WHEN d.alamat LIKE '%Onepute Jaya%' THEN 'Desa Onepute Jaya'
        WHEN d.alamat LIKE '%Bahoea Reko Reko%' THEN 'Desa Bahoea Reko Reko'
        WHEN d.alamat LIKE '%Wosu%' THEN 'Desa Wosu'
        WHEN d.alamat LIKE '%Larobenu%' THEN 'Desa Larobenu'
        WHEN d.alamat LIKE '%Umpanga%' THEN 'Desa Umpanga'
        WHEN d.alamat LIKE '%Topogaro%' THEN 'Desa Topogaro'
        WHEN d.alamat LIKE '%Tondo%' THEN 'Desa Tondo'
        WHEN d.alamat LIKE '%Ambunu%' THEN 'Desa Ambunu'
        WHEN d.alamat LIKE '%Uedago%' THEN 'Desa Uedago'
        WHEN d.alamat LIKE '%Wata%' THEN 'Desa Wata'
        WHEN d.alamat LIKE '%Marga Mulya%' THEN 'Desa Marga Mulya'
        WHEN d.alamat LIKE '%Parilangke%' THEN 'Desa Parilangke'
        WHEN d.alamat LIKE '%Bohonsuai%' THEN 'Desa Bohonsuai'
        WHEN d.alamat LIKE '%Samarenda%' THEN 'Desa Samarenda'
        WHEN d.alamat LIKE '%Atananga%' THEN 'Desa Atananga'
        WHEN d.alamat LIKE '%Pebatae%' THEN 'Desa Pebatae'
        WHEN d.alamat LIKE '%Pebotoa%' THEN 'Desa Pebotoa'
        WHEN d.alamat LIKE '%Umbele%' THEN 'Desa Umbele'
        WHEN d.alamat LIKE '%Karaupa%' THEN 'Desa Karaupa'
        WHEN d.alamat LIKE '%Lasampi%' THEN 'Desa Lasampi'
        WHEN d.alamat LIKE '%Beringin Jaya%' THEN 'Desa Beringin Jaya'
        WHEN d.alamat LIKE '%Harapan Jaya%' THEN 'Desa Harapan Jaya'
        WHEN d.alamat LIKE '%Lambelu%' THEN 'Desa Lambelu'
        WHEN d.alamat LIKE '%Limbo Makmur%' THEN 'Desa Limbo Makmur'
        WHEN d.alamat LIKE '%Sampeantaba%' THEN 'Desa Sampeantaba'
        WHEN d.alamat LIKE '%Emea%' THEN 'Desa Emea'
        WHEN d.alamat LIKE '%Ungkaya%' THEN 'Desa Ungkaya'
        WHEN d.alamat LIKE '%Moahino%' THEN 'Desa Moahino'
        WHEN d.alamat LIKE '%Solonsa Jaya%' THEN 'Desa Solonsa Jaya'
        WHEN d.alamat LIKE '%Solonsa%' THEN 'Desa Solonsa'
        WHEN d.alamat LIKE '%Puntari Makmur%' THEN 'Desa Puntari Makmur'
        WHEN d.alamat LIKE '%Lantula Jaya%' THEN 'Desa Lantula Jaya'
        WHEN d.alamat LIKE '%Bumi Harapan%' THEN 'Desa Bumi Harapan'
        WHEN d.alamat LIKE '%Bete-Bete%' THEN 'Desa Bete-Bete'
        WHEN d.alamat LIKE '%Padabaho%' THEN 'Desa Padabaho'
        WHEN d.alamat LIKE '%Makarti Jaya%' THEN 'Desa Makarti Jaya'
        WHEN d.alamat LIKE '%Labota%' THEN 'Desa Labota'
        WHEN d.alamat LIKE '%Fatufia%' THEN 'Desa Fatufia'
        WHEN d.alamat LIKE '%Keurea%' THEN 'Desa Keurea'
        WHEN d.alamat LIKE '%Bahomakmur%' THEN 'Desa Bahomakmur'
        WHEN d.alamat LIKE '%Bahodopi%' THEN 'Desa Bahodopi'
        WHEN d.alamat LIKE '%Lalampu%' THEN 'Desa Lalampu'
        WHEN d.alamat LIKE '%Siumbatu%' THEN 'Desa Siumbatu'
        WHEN d.alamat LIKE '%Dampala%' THEN 'Desa Dampala'
        WHEN d.alamat LIKE '%Le-Le%' THEN 'Desa Le-Le'
        WHEN d.alamat LIKE '%One ete%' THEN 'Desa One ete'
        WHEN d.alamat LIKE '%Puungkueu%' THEN 'Desa Puungkueu'
        WHEN d.alamat LIKE '%Tangofa%' THEN 'Desa Tangofa'
        WHEN d.alamat LIKE '%Tanda Oleo%' THEN 'Desa Tanda Oleo'
        WHEN d.alamat LIKE '%Lafeu%' THEN 'Desa Lafeu'
        WHEN d.alamat LIKE '%Torete%' THEN 'Desa Torete'
        WHEN d.alamat LIKE '%Buleleng%' THEN 'Desa Buleleng'
        WHEN d.alamat LIKE '%Laroenai%' THEN 'Desa Laroenai'
        WHEN d.alamat LIKE '%Sambalagi%' THEN 'Desa Sambalagi'
        WHEN d.alamat LIKE '%Wereea%' THEN 'Desa Wereea'
        WHEN d.alamat LIKE '%Buajangka%' THEN 'Desa Buajangka'
        WHEN d.alamat LIKE '%Bakal%' THEN 'Desa Bakal'
        WHEN d.alamat LIKE '%Paku%' THEN 'Desa Paku'
        WHEN d.alamat LIKE '%Kuburu%' THEN 'Desa Kuburu'
        WHEN d.alamat LIKE '%Buton%' THEN 'Desa Buton'
        WHEN d.alamat LIKE '%Jawi-Jawi%' THEN 'Desa Jawi-Jawi'
        WHEN d.alamat LIKE '%Lakumbulo%' THEN 'Desa Lakumbulo'
        WHEN d.alamat LIKE '%Kaleroang%' THEN 'Desa Kaleroang'
        WHEN d.alamat LIKE '%Bungingkela%' THEN 'Desa Bungingkela'
        WHEN d.alamat LIKE '%Powaru%' THEN 'Desa Powaru'
        WHEN d.alamat LIKE '%Poo%' THEN 'Desa Poo'
        WHEN d.alamat LIKE '%Waru-Waru%' THEN 'Desa Waru-Waru'
        WHEN d.alamat LIKE '%Pada Bale%' THEN 'Desa Pada Bale'
        WHEN d.alamat LIKE '%Pado-Pado%' THEN 'Desa Pado-Pado'
        WHEN d.alamat LIKE '%Pulau Bapa%' THEN 'Desa Pulau Bapa'
        WHEN d.alamat LIKE '%Lamontoli%' THEN 'Desa Lamontoli'
        WHEN d.alamat LIKE '%Lalemo%' THEN 'Desa Lalemo'
        WHEN d.alamat LIKE '%Pulau Dua Darat%' THEN 'Desa Pulau Dua Darat'
        WHEN d.alamat LIKE '%Bungintende%' THEN 'Desa Bungintende'
        WHEN d.alamat LIKE '%Saenoa%' THEN 'Desa Saenoa'
        WHEN d.alamat LIKE '%Buelemo%' THEN 'Desa Buelemo'
        WHEN d.alamat LIKE '%Panimbawang%' THEN 'Desa Panimbawang'
        WHEN d.alamat LIKE '%Umbele Butong%' THEN 'Desa Umbele Butong'
        WHEN d.alamat LIKE '%Umbele Lama%' THEN 'Desa Umbele Lama'
        WHEN d.alamat LIKE '%Polewali%' THEN 'Desa Polewali'
        WHEN d.alamat LIKE '%Pulau Dua%' THEN 'Desa Pulau Dua'
        WHEN d.alamat LIKE '%Buranga%' THEN 'Desa Buranga'
        WHEN d.alamat LIKE '%Kofalagadi%' THEN 'Desa Kofalagadi'
        WHEN d.alamat LIKE '%Tafagapi%' THEN 'Desa Tafagapi'
        WHEN d.alamat LIKE '%Terebino%' THEN 'Desa Terebino'
        WHEN d.alamat LIKE '%Ulunipa%' THEN 'Desa Ulunipa'
        WHEN d.alamat LIKE '%Torukuno%' THEN 'Desa Torukuno'
        WHEN d.alamat LIKE '%Matarape%' THEN 'Desa Matarape'
        WHEN d.alamat LIKE '%Molore%' THEN 'Desa Molore'
        WHEN d.alamat LIKE '%Pulau Tiga%' THEN 'Desa Pulau Tiga'
        WHEN d.alamat LIKE '%Wowongkolono%' THEN 'Desa Wowongkolono'
        WHEN d.alamat LIKE '%Padei Darat%' THEN 'Desa Padei Darat'
        WHEN d.alamat LIKE '%Padei Laut%' THEN 'Desa Padei Laut'
        WHEN d.alamat LIKE '%Ulunambo%' THEN 'Desa Ulunambo'
        WHEN d.alamat LIKE '%Torebino%' THEN 'Desa Torebino'
        WHEN d.alamat LIKE '%Uliunipa%' THEN 'Desa Uliunipa'
        WHEN d.alamat LIKE '%Kopalagadi%' THEN 'Desa Kopalagadi'
        WHEN d.alamat LIKE '%Padalaa%' THEN 'Desa Padalaa'
        WHEN d.alamat LIKE '%Samarengga%' THEN 'Desa Samarengga'
        WHEN d.alamat LIKE '%Morompaitonga%' THEN 'Desa Morompaitonga'
        WHEN d.alamat LIKE '%Ngopoesa%' THEN 'Desa Ngopoesa'
        WHEN d.alamat LIKE '%Matano (Menui)%' THEN 'Desa Matano (Menui)'
        WHEN d.alamat LIKE '%Mbokiita%' THEN 'Desa Mbokiita'
        WHEN d.alamat LIKE '%Masadian%' THEN 'Desa Masadian'
        WHEN d.alamat LIKE '%Ngapaea%' THEN 'Desa Ngapaea'
        WHEN d.alamat LIKE '%Pulau Tiga%' THEN 'Desa Pulau Tiga'
        WHEN d.alamat LIKE '%Pulau Tengah%' THEN 'Desa Pulau Tengah'
        WHEN d.alamat LIKE '%Tanona%' THEN 'Desa Tanona'
        WHEN d.alamat LIKE '%Tanjung Harapan%' THEN 'Desa Tanjung Harapan'
        WHEN d.alamat LIKE '%Tanjung Tiram%' THEN 'Desa Tanjung Tiram'
        WHEN d.alamat LIKE '%Lombokita%' THEN 'Desa Lombokita'
        WHEN d.alamat LIKE '%Bunta%' THEN 'Desa Bunta'
        WHEN d.alamat LIKE '%Tompira%' THEN 'Desa Tompira'
        WHEN d.alamat LIKE '%Bungintimbe%' THEN 'Desa Bungintimbe'
        WHEN d.alamat LIKE '%Towara%' THEN 'Desa Towara'
        WHEN d.alamat LIKE '%Molino%' THEN 'Desa Molino'
        WHEN d.alamat LIKE '%Mohoni%' THEN 'Desa Mohoni'
        WHEN d.alamat LIKE '%Ungkea%' THEN 'Desa Ungkea'
        WHEN d.alamat LIKE '%Bimor Jaya%' THEN 'Desa Bimor Jaya'
        WHEN d.alamat LIKE '%Molores%' THEN 'Desa Molores'
        WHEN d.alamat LIKE '%Keuno%' THEN 'Desa Keuno'
        WHEN d.alamat LIKE '%Towara Pantai%' THEN 'Desa Towara Pantai'
        WHEN d.alamat LIKE '%Peboa%' THEN 'Desa Peboa'
        WHEN d.alamat LIKE '%Kolonodale%' THEN 'Desa Kolonodale'
        WHEN d.alamat LIKE '%Bahontula%' THEN 'Desa Bahontula'
        WHEN d.alamat LIKE '%Bahoue%' THEN 'Desa Bahoue'
        WHEN d.alamat LIKE '%Ganda Ganda%' THEN 'Desa Ganda Ganda'
        WHEN d.alamat LIKE '%Koya*%' THEN 'Desa Koya*'
        WHEN d.alamat LIKE '%Gililana*%' THEN 'Desa Gililana*'
        WHEN d.alamat LIKE '%Tanauge*%' THEN 'Desa Tanauge*'
        WHEN d.alamat LIKE '%Korololaki%' THEN 'Desa Korololaki'
        WHEN d.alamat LIKE '%Korololama%' THEN 'Desa Korololama'
        WHEN d.alamat LIKE '%Koromatantu%' THEN 'Desa Koromatantu'
        WHEN d.alamat LIKE '%Beteleme%' THEN 'Desa Beteleme'
        WHEN d.alamat LIKE '%Uluanso%' THEN 'Desa Uluanso'
        WHEN d.alamat LIKE '%Mora%' THEN 'Desa Mora'
        WHEN d.alamat LIKE '%Waraa%' THEN 'Desa Waraa'
        WHEN d.alamat LIKE '%Tingkeao%' THEN 'Desa Tingkeao'
        WHEN d.alamat LIKE '%Wawopada%' THEN 'Desa Wawopada'
        WHEN d.alamat LIKE '%Korowalelo%' THEN 'Desa Korowalelo'
        WHEN d.alamat LIKE '%Tinompo%' THEN 'Desa Tinompo'
        WHEN d.alamat LIKE '%Kumpi%' THEN 'Desa Kumpi'
        WHEN d.alamat LIKE '%Korompeeli%' THEN 'Desa Korompeeli'
        WHEN d.alamat LIKE '%Lemboroma%' THEN 'Desa Lemboroma'
        WHEN d.alamat LIKE '%Korowou%' THEN 'Desa Korowou'
        WHEN d.alamat LIKE '%Lembobaru%' THEN 'Desa Lembobaru'
        WHEN d.alamat LIKE '%Korobonde%' THEN 'Desa Korobonde'
        WHEN d.alamat LIKE '%Tiu%' THEN 'Desa Tiu'
        WHEN d.alamat LIKE '%Tontowea%' THEN 'Desa Tontowea'
        WHEN d.alamat LIKE '%Togo Mulyo%' THEN 'Desa Togo Mulyo'
        WHEN d.alamat LIKE '%Maralee%' THEN 'Desa Maralee'
        WHEN d.alamat LIKE '%Mondowe%' THEN 'Desa Mondowe'
        WHEN d.alamat LIKE '%Sampalowo%' THEN 'Desa Sampalowo'
        WHEN d.alamat LIKE '%Moleono%' THEN 'Desa Moleono'
        WHEN d.alamat LIKE '%Onepute%' THEN 'Desa Onepute'
        WHEN d.alamat LIKE '%Ulu Laa%' THEN 'Desa Ulu Laa'
        WHEN d.alamat LIKE '%Tadaku Jaya%' THEN 'Desa Tadaku Jaya'
        WHEN d.alamat LIKE '%Dolupo Karya%' THEN 'Desa Dolupo Karya'
        WHEN d.alamat LIKE '%Poona%' THEN 'Desa Poona'
        WHEN d.alamat LIKE '%Petumbea%' THEN 'Desa Petumbea'
        WHEN d.alamat LIKE '%Ronta%' THEN 'Desa Ronta'
        WHEN d.alamat LIKE '%Pontangoa%' THEN 'Desa Pontangoa'
        WHEN d.alamat LIKE '%Jamor Jaya%' THEN 'Desa Jamor Jaya'
        WHEN d.alamat LIKE '%Paawaru%' THEN 'Desa Paawaru'
        WHEN d.alamat LIKE '%Lembobelala%' THEN 'Desa Lembobelala'
        WHEN d.alamat LIKE '%Bintangor Mukti%' THEN 'Desa Bintangor Mukti'
        WHEN d.alamat LIKE '%Mandula%' THEN 'Desa Mandula'
        WHEN d.alamat LIKE '%Tomata%' THEN 'Desa Tomata'
        WHEN d.alamat LIKE '%Londi%' THEN 'Desa Londi'
        WHEN d.alamat LIKE '%Taende%' THEN 'Desa Taende'
        WHEN d.alamat LIKE '%Ensa%' THEN 'Desa Ensa'
        WHEN d.alamat LIKE '%Kolaka%' THEN 'Desa Kolaka'
        WHEN d.alamat LIKE '%Peonea%' THEN 'Desa Peonea'
        WHEN d.alamat LIKE '%Lanumor%' THEN 'Desa Lanumor'
        WHEN d.alamat LIKE '%Gontara%' THEN 'Desa Gontara'
        WHEN d.alamat LIKE '%Lee%' THEN 'Desa Lee'
        WHEN d.alamat LIKE '%Saemba%' THEN 'Desa Saemba'
        WHEN d.alamat LIKE '%Kasingoli%' THEN 'Desa Kasingoli'
        WHEN d.alamat LIKE '%Tomui Karya%' THEN 'Desa Tomui Karya'
        WHEN d.alamat LIKE '%Saemba Walati%' THEN 'Desa Saemba Walati'
        WHEN d.alamat LIKE '%Pambarea%' THEN 'Desa Pambarea'
        WHEN d.alamat LIKE '%Era%' THEN 'Desa Era'
        WHEN d.alamat LIKE '%Peleru%' THEN 'Desa Peleru'
        WHEN d.alamat LIKE '%Tamonjengi%' THEN 'Desa Tamonjengi'
        WHEN d.alamat LIKE '%Mayumba%' THEN 'Desa Mayumba'
        WHEN d.alamat LIKE '%Tiwaa%' THEN 'Desa Tiwaa'
        WHEN d.alamat LIKE '%Lembontonara%' THEN 'Desa Lembontonara'
        WHEN d.alamat LIKE '%Tabarano%' THEN 'Desa Tabarano'
        WHEN d.alamat LIKE '%Wawondula%' THEN 'Desa Wawondula'
        WHEN d.alamat LIKE '%Lembah Sumara%' THEN 'Desa Lembah Sumara'
        WHEN d.alamat LIKE '%Sumara Jaya%' THEN 'Desa Sumara Jaya'
        WHEN d.alamat LIKE '%Tambayoli%' THEN 'Desa Tambayoli'
        WHEN d.alamat LIKE '%Malino%' THEN 'Desa Malino'
        WHEN d.alamat LIKE '%Panca Makmur%' THEN 'Desa Panca Makmur'
        WHEN d.alamat LIKE '%Tamainusi%' THEN 'Desa Tamainusi'
        WHEN d.alamat LIKE '%Bau%' THEN 'Desa Bau'
        WHEN d.alamat LIKE '%Malino Jaya%' THEN 'Desa Malino Jaya'
        WHEN d.alamat LIKE '%Toddopoli Uebangke%' THEN 'Desa Toddopoli Uebangke'
        WHEN d.alamat LIKE '%Tandoyondo%' THEN 'Desa Tandoyondo'
        WHEN d.alamat LIKE '%Baturube%' THEN 'Desa Baturube'
        WHEN d.alamat LIKE '%Posangke%' THEN 'Desa Posangke'
        WHEN d.alamat LIKE '%Taronggo%' THEN 'Desa Taronggo'
        WHEN d.alamat LIKE '%Ueruru%' THEN 'Desa Ueruru'
        WHEN d.alamat LIKE '%Uewajo%' THEN 'Desa Uewajo'
        WHEN d.alamat LIKE '%Tirongan Bawah%' THEN 'Desa Tirongan Bawah'
        WHEN d.alamat LIKE '%Tirongan Atas%' THEN 'Desa Tirongan Atas'
        WHEN d.alamat LIKE '%Siliti%' THEN 'Desa Siliti'
        WHEN d.alamat LIKE '%Lemo%' THEN 'Desa Lemo'
        WHEN d.alamat LIKE '%Salubiro%' THEN 'Desa Salubiro'
        WHEN d.alamat LIKE '%Uemasi%' THEN 'Desa Uemasi'
        WHEN d.alamat LIKE '%Opo%' THEN 'Desa Opo'
        WHEN d.alamat LIKE '%Tanakuraya%' THEN 'Desa Tanakuraya'
        WHEN d.alamat LIKE '%Tambarobone%' THEN 'Desa Tambarobone'
        WHEN d.alamat LIKE '%Woomparigi%' THEN 'Desa Woomparigi'
        WHEN d.alamat LIKE '%Boba%' THEN 'Desa Boba'
        WHEN d.alamat LIKE '%Kalombang%' THEN 'Desa Kalombang'
        WHEN d.alamat LIKE '%Tokonanaka%' THEN 'Desa Tokonanaka'
        WHEN d.alamat LIKE '%Matube%' THEN 'Desa Matube'
        WHEN d.alamat LIKE '%Lemowalia%' THEN 'Desa Lemowalia'
        WHEN d.alamat LIKE '%Uempanapa%' THEN 'Desa Uempanapa'
        WHEN d.alamat LIKE '%Tokala Atas%' THEN 'Desa Tokala Atas'
        WHEN d.alamat LIKE '%Pokeang%' THEN 'Desa Pokeang'
        WHEN d.alamat LIKE '%Pandauke%' THEN 'Desa Pandauke'
        WHEN d.alamat LIKE '%Kolo Bawah%' THEN 'Desa Kolo Bawah'
        WHEN d.alamat LIKE '%Kolo Atas%' THEN 'Desa Kolo Atas'
        WHEN d.alamat LIKE '%Momo%' THEN 'Desa Momo'
        WHEN d.alamat LIKE '%Tananagaya%' THEN 'Desa Tananagaya'
        WHEN d.alamat LIKE '%Uepakatu%' THEN 'Desa Uepakatu'
        WHEN d.alamat LIKE '%Lijo%' THEN 'Desa Lijo'
        WHEN d.alamat LIKE '%Tanasumpu%' THEN 'Desa Tanasumpu'
        WHEN d.alamat LIKE '%Parangisi%' THEN 'Desa Parangisi'
        WHEN d.alamat LIKE '%Girimulya%' THEN 'Desa Girimulya'
        WHEN d.alamat LIKE '%Winangobino%' THEN 'Desa Winangobino'
        WHEN d.alamat LIKE '%Tambale%' THEN 'Desa Tambale'
        WHEN d.alamat LIKE '%Sea%' THEN 'Desa Sea'
        WHEN d.alamat LIKE '%Menyoe%' THEN 'Desa Menyoe'
        ELSE 'Wilayah Diluar Morowali Dan Morowali Utara'
    END AS wilayah_desa_tergugat
    FROM 
        perkara AS a
    LEFT JOIN 
        perkara_pihak1 AS b ON a.perkara_id = b.perkara_id
    LEFT JOIN 
        pihak AS c ON b.pihak_id = c.id
    LEFT JOIN 
        perkara_pihak2 AS d ON a.perkara_id = d.perkara_id
    LEFT JOIN 
        perkara_putusan AS e ON a.perkara_id = e.perkara_id
    WHERE
        a.jenis_perkara_id IN (346, 347) AND
        e.status_putusan_id = 62 AND
        YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE())
    ORDER BY 
        wilayah_kabupaten_penggugat ASC,
        wilayah_kabupaten_tergugat ASC,
        wilayah_kecamatan_penggugat ASC,
        wilayah_desa_penggugat ASC,
        wilayah_desa_tergugat ASC;`;

    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nNama : ${r.nama_penggugat}\nUmur : ${r.umur_penggugat}\nStatus : ${r.status_penggugat}\nNIK : ${r.ktp_penggugat}\nDomisili : ${r.wilayah_desa_penggugat}\n\nNama : ${r.nama_tergugat}\nUmur : ${r.umur_tergugat}\nStatus : ${r.status_tergugat}\nNIK : ${r.ktp_tergugat}\nDomisili : ${r.wilayah_desa_tergugat}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataDaftarEcourt = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT 
        nomor_perkara, 
        jenis_perkara_nama,
        CASE
            WHEN MAX(perkara_pengacara.nama) IS NOT NULL THEN "Pengguna Terdaftar"
            ELSE "Pengguna Lainnya"
        END AS jenis_pihak,
        CASE 
      WHEN alur_perkara_id = 15 THEN "Gugatan"
      WHEN alur_perkara_id = 16 THEN "Permohon"
      ELSE "Pidana/Jinayah"
      END AS jenis_alur
    FROM 
        perkara
    LEFT JOIN 
        perkara_efiling_id ON perkara.perkara_id = perkara_efiling_id.perkara_id
    LEFT JOIN 
        perkara_pengacara ON perkara.perkara_id = perkara_pengacara.perkara_id AND perkara_pengacara.pihak_ke = 1
    WHERE 
        perkara_efiling_id.perkara_id IS NOT NULL 
        AND YEAR(tanggal_pendaftaran) = YEAR(CURDATE())
    GROUP BY 
        nomor_perkara
    ORDER BY
        jenis_alur, perkara.perkara_id DESC;`;

    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama}\nAlur Perkara : ${r.jenis_alur}\nStatus Pihak : ${r.jenis_pihak}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataDaftarProdeo = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT 
      nomor_perkara, 
      jenis_perkara_nama,
      CASE 
        WHEN alur_perkara_id = 15 THEN "Gugatan"
        WHEN alur_perkara_id = 16 THEN "Permohon"
        ELSE "Pidana/Jinayah"
      END AS jenis_alur
    FROM 
        perkara
    WHERE 
        prodeo = 1
        AND YEAR(tanggal_pendaftaran) = YEAR(CURDATE())
    GROUP BY 
        nomor_perkara
    ORDER BY
        jenis_alur, perkara_id DESC;`;

    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama}\nAlur Perkara : ${r.jenis_alur}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataDaftarGhaib = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT 
      nomor_perkara, 
      jenis_perkara_nama,
      ghaib
    FROM 
      perkara
    LEFT JOIN
      perkara_pihak2 ON perkara.perkara_id = perkara_pihak2.perkara_id
    WHERE 
      ghaib = 1
      AND YEAR(tanggal_pendaftaran) = YEAR(CURDATE())
    GROUP BY 
      nomor_perkara
    ORDER BY
      perkara.perkara_id DESC;`;

    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataDaftarMediasi = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT 
    nomor_perkara, 
    jenis_perkara_nama,
    mediator_text,
      CASE
          WHEN hasil_mediasi = 'Y1' THEN 'Berhasil Kesepakatan Damai'
          WHEN hasil_mediasi = 'Y2' THEN 'Berhasil Dengan Pencabutan'
          WHEN hasil_mediasi = 'S' THEN 'Berhasil Sebagian'
          WHEN hasil_mediasi = 'D' THEN 'Tidak Dapat Dilaksanakan'
          ELSE 'Tidak Berhasil'
      END AS mediasi_hasil,
      CASE
          WHEN status_mediator = 'H' THEN 'H'
          ELSE 'NH'
      END AS mediator_status
  FROM 
      perkara
  LEFT JOIN
      perkara_mediasi ON perkara.perkara_id = perkara_mediasi.perkara_id
  WHERE 
      perkara_mediasi.perkara_id IS NOT NULL 
      AND YEAR(keputusan_mediasi) = YEAR(CURDATE())
  ORDER BY
      CASE 
          WHEN hasil_mediasi = 'Y1' THEN 1
          WHEN hasil_mediasi = 'Y2' THEN 2
          WHEN hasil_mediasi = 'S' THEN 3
          WHEN hasil_mediasi = 'D' THEN 4
          ELSE 5
      END,
      mediator_text,
      perkara.perkara_id ASC;`;

    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama}\nMediator : ${r.mediator_text} (${r.mediator_status})\nHasil Mediasi : ${r.mediasi_hasil}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataDaftarPenetapan = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT 
    nomor_perkara, 
    jenis_perkara_nama,
      CASE
          WHEN penetapan_majelis_hakim IS NULL THEN 'Belum PMH'
          WHEN penetapan_panitera_pengganti IS NULL THEN 'Belum Penunjukan PP'
          WHEN penetapan_jurusita IS NULL THEN 'Belum Penunjukan JS'
          WHEN penetapan_hari_sidang IS NULL THEN 'Belum PHS'
      END AS belum_penetapan
  FROM 
      perkara
  LEFT JOIN
      perkara_penetapan ON perkara.perkara_id = perkara_penetapan.perkara_id
  WHERE
      YEAR(tanggal_pendaftaran) >= 2019 
			AND (penetapan_majelis_hakim IS NULL
      OR penetapan_panitera_pengganti IS NULL
      OR penetapan_jurusita IS NULL
      OR penetapan_hari_sidang IS NULL)
  ORDER BY
      perkara.perkara_id ASC;`;

    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\n*Status : ${r.belum_penetapan}*`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataDaftarSidkel = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT 
    p.perkara_id,
		p.nomor_perkara, 
    p.jenis_perkara_nama,
    pjs.ruangan
  FROM 
      perkara p
  LEFT JOIN
      perkara_jadwal_sidang pjs ON p.perkara_id = pjs.perkara_id
  WHERE
      YEAR(p.tanggal_pendaftaran) = YEAR(CURDATE())
      AND (pjs.sidang_keliling = 'Y' 
          OR (pjs.ruangan NOT LIKE '%Ruang Sidang 1%' AND pjs.ruangan NOT LIKE '%Ruang Sidang 2%'))
  ORDER BY
      pjs.tanggal_sidang,
      pjs.ruangan,
      p.nomor_perkara DESC;`;

    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama}\nTempat Sidkel : ${r.ruangan}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataMeteraiRedaksiPsp = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT 
    nomor_perkara,
      CASE 
          WHEN uraian LIKE '%Meterai%' THEN 'Belum Keluar Biaya Meterai'
          WHEN uraian LIKE '%Redaksi%' THEN 'Belum Keluar Biaya Redaksi'
          WHEN uraian LIKE '%Pengembalian Sisa Panjar%' THEN 'Belum Keluar Pengembalian Sisa Panjar'
      END AS status_biaya
    FROM perkara 
    LEFT JOIN perkara_jadwal_sidang ON perkara_jadwal_sidang.perkara_id = perkara.perkara_id
    LEFT JOIN perkara_biaya ON perkara_biaya.perkara_id = perkara.perkara_id
    WHERE YEAR(tanggal_sidang) = YEAR(CURDATE()) 
      AND (
          (perkara_jadwal_sidang.alasan_ditunda LIKE '%Putusan%' OR 
          perkara_jadwal_sidang.alasan_ditunda LIKE '%verstek%' OR 
          perkara_jadwal_sidang.alasan_ditunda LIKE '%Putus%' OR 
          perkara_jadwal_sidang.alasan_ditunda LIKE '%Cabut%' OR 
          perkara_jadwal_sidang.alasan_ditunda LIKE '%Gugur%' OR 
          perkara_jadwal_sidang.alasan_ditunda LIKE '%Penetapan%') 
          OR 
          (perkara_jadwal_sidang.keterangan LIKE '%Putusan%' OR 
          perkara_jadwal_sidang.keterangan LIKE '%verstek%' OR 
          perkara_jadwal_sidang.keterangan LIKE '%Putus%' OR 
          perkara_jadwal_sidang.keterangan LIKE '%Cabut%' OR 
          perkara_jadwal_sidang.keterangan LIKE '%Gugur%' OR 
          perkara_jadwal_sidang.keterangan LIKE '%Penetapan%')
      )
      AND ((uraian NOT LIKE '%Meterai%' OR uraian IS NULL)
      AND (uraian NOT LIKE '%Redaksi%' OR uraian IS NULL)
      AND (uraian NOT LIKE '%Pengembalian Sisa Panjar%' OR uraian IS NULL))
      AND (uraian IS NULL OR uraian = '');`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nStatus Biaya : ${r.status_biaya}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataBelumInputAlamat = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT
      nomor_perkara,
      perkara_pihak1.nama AS nama_pihak1,
      perkara_pihak1.alamat AS alamat_pihak1,
      perkara_pihak2.nama AS nama_pihak2,
      perkara_pihak2.alamat AS alamat_pihak2
  FROM
      perkara
  LEFT JOIN
      perkara_pihak1 ON perkara.perkara_id = perkara_pihak1.perkara_id
  LEFT JOIN
      perkara_pihak2 ON perkara.perkara_id = perkara_pihak2.perkara_id
  LEFT JOIN
      pihak ON perkara_pihak1.pihak_id = pihak.id
  WHERE
      YEAR(perkara.tanggal_pendaftaran) >= YEAR(CURDATE())
      AND (kelurahan IS NULL
      OR kecamatan IS NULL
      OR kabupaten IS NULL)
  ORDER BY
      perkara.perkara_id DESC,
      alur_perkara_id ASC;`;

    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataNoHpEmailParaPihak = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT a.nomor_perkara, 
    a.nama,
    b.nomor_indentitas,
    CONCAT('+62', SUBSTRING(b.telepon, 2)) AS telepon,
    CASE WHEN a.pihak_ke = 1 THEN 'Penggugat'
        WHEN a.pihak_ke = 2 THEN 'Tergugat'
        ELSE 'Pihak Lainnya' END AS jenisPihak,
    b.email
    FROM v_pihak_perkara AS a
    JOIN pihak AS b ON a.pihak_id = b.id 
                AND b.telepon REGEXP '^[0-9]' 
                AND CHAR_LENGTH(b.telepon) > 8
    WHERE YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE())
    ORDER BY a.tanggal_pendaftaran DESC, 
          a.nomor_perkara, 
          a.urutan, 
          a.pihak_ke;`;

    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nNama : ${r.nama} (${r.jenisPihak})\nNo. Identitas : ${r.nomor_indentitas}\nNo. Handphone : ${r.telepon}\nEmail : ${r.email}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataJumlahMediasi = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT 
    SUM(CASE WHEN hasil_mediasi = 'Y1' THEN 1 ELSE 0 END) AS 'Berhasil Kesepakatan Damai',
    SUM(CASE WHEN hasil_mediasi = 'Y2' THEN 1 ELSE 0 END) AS 'Berhasil Dengan Pencabutan',
    SUM(CASE WHEN hasil_mediasi = 'S' THEN 1 ELSE 0 END) AS 'Berhasil Sebagian',
    SUM(CASE WHEN hasil_mediasi = 'D' THEN 1 ELSE 0 END) AS 'Tidak Dapat Dilaksanakan',
    SUM(CASE WHEN hasil_mediasi NOT IN ('Y1', 'Y2', 'S', 'D') THEN 1 ELSE 0 END) AS 'Tidak Berhasil'
    FROM 
        perkara
    LEFT JOIN
        perkara_mediasi ON perkara.perkara_id = perkara_mediasi.perkara_id
    WHERE 
        perkara_mediasi.perkara_id IS NOT NULL 
        AND YEAR(keputusan_mediasi) = YEAR(CURDATE());`;

    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = result.map((r) => {
            return `Rekapitulasi berdasarkan hasil mediasi tahun ini : \nBerhasil Kesepakatan Damai : ${r['Berhasil Kesepakatan Damai']}\nBerhasil Dengan Pencabutan : ${r['Berhasil Dengan Pencabutan']}\nBerhasil Sebagian : ${r['Berhasil Sebagian']}\nTidak Dapat Dilaksanakan : ${r['Tidak Dapat Dilaksanakan']}\nTidak Berhasil : ${r['Tidak Berhasil']}`;
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataJumlahMediasiHakim = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT 
      CASE
          WHEN hasil_mediasi = "Y1" THEN "Berhasil Kesepakatan Damai"
          WHEN hasil_mediasi = "Y2" THEN "Berhasil Dengan Pencabutan"
          WHEN hasil_mediasi = "S" THEN "Berhasil Sebagian"
          WHEN hasil_mediasi = "D" THEN "Tidak Dapat Dilaksanakan"
          ELSE "Tidak Berhasil"
      END AS mediasi_hasil,
      mediator_text,
      SUM(CASE WHEN hasil_mediasi = "Y1" THEN 1 ELSE 0 END) AS 'Berhasil Kesepakatan Damai',
      SUM(CASE WHEN hasil_mediasi = "Y2" THEN 1 ELSE 0 END) AS 'Berhasil Dengan Pencabutan',
      SUM(CASE WHEN hasil_mediasi = "S" THEN 1 ELSE 0 END) AS 'Berhasil Sebagian',
      SUM(CASE WHEN hasil_mediasi = "D" THEN 1 ELSE 0 END) AS 'Tidak Dapat Dilaksanakan',
      SUM(CASE WHEN hasil_mediasi NOT IN ("Y1", "Y2", "S", "D") THEN 1 ELSE 0 END) AS 'Tidak Berhasil'
  FROM 
      perkara
  LEFT JOIN
      perkara_mediasi ON perkara.perkara_id = perkara_mediasi.perkara_id
  WHERE 
      perkara_mediasi.perkara_id IS NOT NULL 
      AND YEAR(keputusan_mediasi) = YEAR(CURDATE())
  GROUP BY 
      mediasi_hasil,
      mediator_text
  ORDER BY
      CASE mediasi_hasil
          WHEN 'Berhasil Kesepakatan Damai' THEN 1
          WHEN 'Berhasil Dengan Pencabutan' THEN 2
          WHEN 'Berhasil Sebagian' THEN 3
          WHEN 'Tidak Dapat Dilaksanakan' THEN 4
          ELSE 5
      END,
      mediator_text;`;

    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = result.map((r) => {
            return `Mediator: ${r.mediator_text}\nRekapitulasi berdasarkan hasil mediasi tahun ini :\nBerhasil Kesepakatan Damai : ${r['Berhasil Kesepakatan Damai']}\nBerhasil Dengan Pencabutan : ${r['Berhasil Dengan Pencabutan']}\nBerhasil Sebagian : ${r['Berhasil Sebagian']}\nTidak Dapat Dilaksanakan : ${r['Tidak Dapat Dilaksanakan']}\nTidak Berhasil : ${r['Tidak Berhasil']}`;
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

const getTotalPenerimaanPerkaraSemuaHakim = () => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT 
      TRIM(SUBSTRING_INDEX(perkara_hakim_pn.hakim_nama, ',', 1)) AS hakim_nama,
      COUNT(CASE 
          WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
              AND perkara.alur_perkara_id != 114 
              AND perkara_hakim_pn.aktif = 'Y'
          THEN perkara.perkara_id 
      END) AS jumlah_masuk,

      COUNT(CASE 
          WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
              AND perkara.alur_perkara_id != 114 
              AND perkara_hakim_pn.aktif = 'Y'
              AND perkara_hakim_pn.jabatan_hakim_id = 1
          THEN perkara.perkara_id 
      END) AS jumlah_ketua_majelis,

      COUNT(CASE 
          WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
              AND perkara.alur_perkara_id != 114 
              AND perkara_hakim_pn.aktif = 'Y'
              AND perkara_hakim_pn.jabatan_hakim_id = 3
          THEN perkara.perkara_id 
      END) AS jumlah_hakim_tunggal,

      COUNT(CASE 
          WHEN YEAR(perkara_putusan.tanggal_putusan) = YEAR(CURDATE()) 
              AND perkara_putusan.tanggal_putusan IS NOT NULL 
              AND perkara.alur_perkara_id != 114 
              AND perkara_hakim_pn.aktif = 'Y'
          THEN perkara.perkara_id 
      END) AS jumlah_putus,

      COUNT(CASE 
          WHEN YEAR(perkara_putusan.tanggal_putusan) = YEAR(CURDATE()) 
              AND perkara_putusan.tanggal_putusan IS NOT NULL 
              AND perkara.alur_perkara_id != 114 
              AND perkara_hakim_pn.aktif = 'Y'
              AND perkara_putusan.putusan_verstek = 'Y'
          THEN perkara.perkara_id 
      END) AS jumlah_putus_verstek,

      COUNT(CASE 
          WHEN YEAR(perkara_putusan.tanggal_putusan) = YEAR(CURDATE()) 
              AND perkara_putusan.tanggal_putusan IS NOT NULL 
              AND perkara.alur_perkara_id != 114 
              AND perkara_hakim_pn.aktif = 'Y'
              AND perkara_putusan.putusan_verstek = 'T'
          THEN perkara.perkara_id 
      END) AS jumlah_putus_contra,

      COUNT(CASE 
          WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE())
              AND perkara.alur_perkara_id != 114 
          THEN perkara.perkara_id
      END) AS total_perkara_masuk,

      CASE
          WHEN (SELECT COUNT(*)
                FROM perkara
                WHERE YEAR(tanggal_pendaftaran) = YEAR(CURDATE())
                  AND alur_perkara_id != 114
              ) = 0 THEN 0
          ELSE 
              (COUNT(CASE 
                  WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
                      AND perkara.alur_perkara_id != 114 
                      AND perkara_hakim_pn.aktif = 'Y'
                  THEN perkara.perkara_id 
              END) * 100.0 / (SELECT COUNT(*)
                              FROM perkara
                              WHERE YEAR(tanggal_pendaftaran) = YEAR(CURDATE())
                                AND alur_perkara_id != 114
                            )) 
      END AS persentase_masuk
    FROM perkara
    LEFT JOIN perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id
    LEFT JOIN perkara_hakim_pn ON perkara_hakim_pn.perkara_id = perkara.perkara_id
    WHERE YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
      AND perkara_hakim_pn.aktif = 'Y'
    GROUP BY TRIM(SUBSTRING_INDEX(perkara_hakim_pn.hakim_nama, ',', 1))
    ORDER BY persentase_masuk DESC;`;

          db.query(query, (err, result) => {
            if (err) {
              reject(err);
            } else {
              if (result.length != 0) {
                const messages = result.map((r, index) => {
                  return `*-YM ${r.hakim_nama}-*\n- Perkara Ditangani : ${r.jumlah_masuk}\n          - Ketua Majelis : ${r.jumlah_ketua_majelis}\n          - Hakim Tunggal : ${r.jumlah_hakim_tunggal}\n- Perkara Putus : ${r.jumlah_putus} (${r.jumlah_putus_verstek} verstek) (${r.jumlah_putus_contra} contra/kabul)\n- Total Perkara Masuk di PA : ${r.total_perkara_masuk}\n- Persentase : ${r.persentase_masuk}%`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk hakim`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching penerimaan perkara hakim data:", error);
      reject(error);
    }
  });
};

const getTotalPenerimaanPerkaraSemuaPanitera = () => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT 
      TRIM(SUBSTRING_INDEX(perkara_panitera_pn.panitera_nama, ',', 1)) AS panitera_nama,
      COUNT(CASE 
          WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
              AND perkara.alur_perkara_id != 114 
              AND perkara_panitera_pn.aktif = 'Y'
          THEN perkara.perkara_id 
      END) AS jumlah_masuk,

      (SELECT COUNT(*)
      FROM perkara
      WHERE YEAR(tanggal_pendaftaran) = YEAR(CURDATE())
        AND alur_perkara_id != 114
      ) AS total_perkara_masuk,

      COUNT(CASE 
          WHEN YEAR(perkara_putusan.tanggal_putusan) = YEAR(CURDATE()) 
              AND perkara_putusan.tanggal_putusan IS NOT NULL 
              AND perkara.alur_perkara_id != 114 
              AND perkara_panitera_pn.aktif = 'Y'
          THEN perkara.perkara_id 
      END) AS jumlah_putus,

      -- Menghitung persentase masuk
      CASE
          WHEN (SELECT COUNT(*)
                FROM perkara
                WHERE YEAR(tanggal_pendaftaran) = YEAR(CURDATE())
                  AND alur_perkara_id != 114
              ) = 0 THEN 0
          ELSE 
              (COUNT(CASE 
                  WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
                      AND perkara.alur_perkara_id != 114 
                      AND perkara_panitera_pn.aktif = 'Y'
                  THEN perkara.perkara_id 
              END) * 100.0 / (SELECT COUNT(*)
                              FROM perkara
                              WHERE YEAR(tanggal_pendaftaran) = YEAR(CURDATE())
                                AND alur_perkara_id != 114
                            )) 
          END AS persentase_masuk
      FROM perkara
      LEFT JOIN perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id
      LEFT JOIN perkara_panitera_pn ON perkara_panitera_pn.perkara_id = perkara.perkara_id
      WHERE YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE())
        AND perkara_panitera_pn.aktif = 'Y'
      GROUP BY TRIM(SUBSTRING_INDEX(perkara_panitera_pn.panitera_nama, ',', 1))
      ORDER BY persentase_masuk DESC;`;

          db.query(query, (err, result) => {
            if (err) {
              reject(err);
            } else {
              if (result.length != 0) {
                const messages = result.map((r, index) => {
                  return `*-${r.panitera_nama}-*\n- Perkara Ditangani : ${r.jumlah_masuk}\n- Perkara Putus : ${r.jumlah_putus}\n- Total Perkara Masuk di PA : ${r.total_perkara_masuk}\n- Persentase : ${r.persentase_masuk}%`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk panitera`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching penerimaan perkara panitera data:", error);
      reject(error);
    }
  });
};

const getTotalPenerimaanPerkaraSemuaJurusita = () => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT 
      TRIM(SUBSTRING_INDEX(perkara_jurusita.jurusita_nama, ',', 1)) AS jurusita_nama,
      COUNT(CASE 
          WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
              AND perkara.alur_perkara_id != 114 
              AND perkara_jurusita.aktif = 'Y'
          THEN perkara.perkara_id 
      END) AS jumlah_masuk,

      (SELECT COUNT(*)
      FROM perkara
      WHERE YEAR(tanggal_pendaftaran) = YEAR(CURDATE())
        AND alur_perkara_id != 114
      ) AS total_perkara_masuk,

      COUNT(CASE 
          WHEN YEAR(perkara_putusan.tanggal_putusan) = YEAR(CURDATE()) 
              AND perkara_putusan.tanggal_putusan IS NOT NULL 
              AND perkara.alur_perkara_id != 114 
              AND perkara_jurusita.aktif = 'Y'
          THEN perkara.perkara_id 
      END) AS jumlah_putus,

      -- Menghitung persentase masuk
      CASE
          WHEN (SELECT COUNT(*)
                FROM perkara
                WHERE YEAR(tanggal_pendaftaran) = YEAR(CURDATE())
                  AND alur_perkara_id != 114
              ) = 0 THEN 0
          ELSE 
              (COUNT(CASE 
                  WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
                      AND perkara.alur_perkara_id != 114 
                      AND perkara_jurusita.aktif = 'Y'
                  THEN perkara.perkara_id 
              END) * 100.0 / (SELECT COUNT(*)
                              FROM perkara
                              WHERE YEAR(tanggal_pendaftaran) = YEAR(CURDATE())
                                AND alur_perkara_id != 114
                            )) 
      END AS persentase_masuk
    FROM perkara
    LEFT JOIN perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id
    LEFT JOIN perkara_jurusita ON perkara_jurusita.perkara_id = perkara.perkara_id
    WHERE YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE())
      AND perkara_jurusita.aktif = 'Y'
    GROUP BY TRIM(SUBSTRING_INDEX(perkara_jurusita.jurusita_nama, ',', 1))
    ORDER BY persentase_masuk DESC;`;

          db.query(query, (err, result) => {
            if (err) {
              reject(err);
            } else {
              if (result.length != 0) {
                const messages = result.map((r, index) => {
                  return `*-${r.jurusita_nama}-*\n- Perkara Ditangani : ${r.jumlah_masuk}\n- Perkara Putus : ${r.jumlah_putus}\n- Total Perkara Masuk di PA : ${r.total_perkara_masuk}\n- Persentase : ${r.persentase_masuk}%`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk jurusita`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching penerimaan perkara jurusita data:", error);
      reject(error);
    }
  });
};

const getTotalPenerimaanPerkaraSemuaHakimLengkap = () => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT 
      TRIM(SUBSTRING_INDEX(perkara_hakim_pn.hakim_nama, ',', 1)) AS hakim_nama,

      -- Menghitung jumlah perkara masuk
      COUNT(DISTINCT CASE 
          WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
              AND perkara.alur_perkara_id != 114 
              AND perkara_hakim_pn.aktif = 'Y'
          THEN perkara.perkara_id 
      END) AS jumlah_masuk,

      -- Menghitung jumlah ketua majelis
      COUNT(DISTINCT CASE 
          WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
              AND perkara.alur_perkara_id != 114 
              AND perkara_hakim_pn.aktif = 'Y'
              AND perkara_hakim_pn.jabatan_hakim_id = 1
          THEN perkara.perkara_id 
      END) AS jumlah_ketua_majelis,

      -- Menghitung jumlah hakim tunggal
      COUNT(DISTINCT CASE 
          WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
              AND perkara.alur_perkara_id != 114 
              AND perkara_hakim_pn.aktif = 'Y'
              AND perkara_hakim_pn.jabatan_hakim_id = 3
          THEN perkara.perkara_id 
      END) AS jumlah_hakim_tunggal,

      -- Menghitung jumlah putusan
      COUNT(DISTINCT CASE 
          WHEN YEAR(perkara_putusan.tanggal_putusan) = YEAR(CURDATE()) 
              AND perkara_putusan.tanggal_putusan IS NOT NULL 
              AND perkara.alur_perkara_id != 114 
              AND perkara_hakim_pn.aktif = 'Y'
          THEN perkara.perkara_id 
      END) AS jumlah_putus,

      COUNT(CASE 
          WHEN YEAR(perkara_putusan.tanggal_putusan) = YEAR(CURDATE()) 
              AND perkara_putusan.tanggal_putusan IS NOT NULL 
              AND perkara.alur_perkara_id != 114 
              AND perkara_hakim_pn.aktif = 'Y'
              AND perkara_putusan.putusan_verstek = 'Y'
          THEN perkara.perkara_id 
      END) AS jumlah_putus_verstek,

      COUNT(CASE 
          WHEN YEAR(perkara_putusan.tanggal_putusan) = YEAR(CURDATE()) 
              AND perkara_putusan.tanggal_putusan IS NOT NULL 
              AND perkara.alur_perkara_id != 114 
              AND perkara_hakim_pn.aktif = 'Y'
              AND perkara_putusan.putusan_verstek = 'T'
          THEN perkara.perkara_id 
      END) AS jumlah_putus_contra,

      -- Menghitung total perkara masuk
      (SELECT COUNT(DISTINCT perkara.perkara_id)
      FROM perkara
      WHERE YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
        AND perkara.alur_perkara_id != 114) AS total_perkara_masuk,

      -- Penambahan jumlah berdasarkan jenis_perkara_id
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 347 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_cerai_gugat,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 346 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_cerai_talak,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 362 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_dispensasi_kawin,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 360 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_itsbat_nikah,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 348 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_harta_bersama,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 371 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_penetapan_ahli_waris,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 349 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_hadhanah,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 364 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_kewarisan,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 341 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_izin_poligami,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 354 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_perwalian,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 367 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_wakaf,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 363 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_wali_adhol,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 358 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_asal_usul_anak,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 352 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_pengesahan_anak,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 344 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_pembatalan_pernikahan,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 370 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_ekonomi_syariah,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 369 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_lain_lain,

      -- Menambahkan perhitungan e-Court berdasarkan nomor_perkara
      COUNT(DISTINCT CASE 
          WHEN perkara_efiling_id.perkara_id IS NOT NULL 
              AND YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE())
          THEN perkara.perkara_id 
          ELSE NULL 
      END) AS perkara_ecourt,

      -- Perhitungan Prodeo
      COUNT(DISTINCT CASE 
          WHEN perkara.prodeo = 1 
              AND YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE())
          THEN perkara.perkara_id 
          ELSE NULL 
      END) AS perkara_prodeo,

      -- Perhitungan Ghaib
      COUNT(DISTINCT CASE 
          WHEN perkara_pihak2.ghaib = 1 
              AND YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE())
          THEN perkara.perkara_id 
          ELSE NULL 
      END) AS perkara_ghaib,

      -- Perhitungan Sidang Keliling Per Ruangan
      COUNT(DISTINCT CASE 
          WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
              AND (perkara_jadwal_sidang.sidang_keliling = 'Y' 
                    OR (perkara_jadwal_sidang.ruangan NOT LIKE '%Ruang Sidang 1%' 
                        AND perkara_jadwal_sidang.ruangan NOT LIKE '%Ruang Sidang 2%'))
          THEN perkara_jadwal_sidang.ruangan
          ELSE NULL 
      END) AS jumlah_ruangan_sidkel,

      -- Perhitungan Sidang Keliling
      COUNT(DISTINCT CASE 
          WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
              AND (perkara_jadwal_sidang.sidang_keliling = 'Y' 
                    OR (perkara_jadwal_sidang.ruangan NOT LIKE '%Ruang Sidang 1%' 
                        AND perkara_jadwal_sidang.ruangan NOT LIKE '%Ruang Sidang 2%'))
          THEN perkara.perkara_id 
          ELSE NULL 
      END) AS perkara_sidkel,

      -- Perhitungan persentase perkara masuk
      CASE
          WHEN (SELECT COUNT(DISTINCT perkara.perkara_id)
                FROM perkara
                WHERE YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE())
                  AND perkara.alur_perkara_id != 114
              ) = 0 THEN 0
          ELSE 
              (COUNT(DISTINCT CASE 
                  WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
                      AND perkara.alur_perkara_id != 114 
                      AND perkara_hakim_pn.aktif = 'Y'
                  THEN perkara.perkara_id 
              END) * 100.0 / (SELECT COUNT(DISTINCT perkara.perkara_id)
                              FROM perkara
                              WHERE YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE())
                                AND perkara.alur_perkara_id != 114
                            )) 
      END AS persentase_masuk
  FROM perkara
  LEFT JOIN perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id
  LEFT JOIN perkara_hakim_pn ON perkara_hakim_pn.perkara_id = perkara.perkara_id
  LEFT JOIN perkara_efiling_id ON perkara.perkara_id = perkara_efiling_id.perkara_id
  LEFT JOIN perkara_pihak2 ON perkara.perkara_id = perkara_pihak2.perkara_id
  LEFT JOIN perkara_jadwal_sidang ON perkara.perkara_id = perkara_jadwal_sidang.perkara_id
  LEFT JOIN user_hakim ON user_hakim.hakim_id = perkara_hakim_pn.hakim_id
  LEFT JOIN sys_users ON sys_users.userid = user_hakim.userid
  WHERE YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
    AND perkara_hakim_pn.aktif = 'Y'
		AND sys_users.block = 0
  GROUP BY TRIM(SUBSTRING_INDEX(perkara_hakim_pn.hakim_nama, ',', 1))
  HAVING jumlah_masuk > 0 
      OR jumlah_ketua_majelis > 0 
      OR jumlah_hakim_tunggal > 0 
      OR jumlah_putus > 0 
      OR total_perkara_masuk > 0
      OR jumlah_masuk_cerai_gugat > 0
      OR jumlah_masuk_cerai_talak > 0
      OR jumlah_masuk_dispensasi_kawin > 0
      OR jumlah_masuk_itsbat_nikah > 0
      OR jumlah_masuk_harta_bersama > 0
      OR jumlah_masuk_penetapan_ahli_waris > 0
      OR jumlah_masuk_hadhanah > 0
      OR jumlah_masuk_kewarisan > 0
      OR jumlah_masuk_izin_poligami > 0
      OR jumlah_masuk_perwalian > 0
      OR jumlah_masuk_wakaf > 0
      OR jumlah_masuk_wali_adhol > 0
      OR jumlah_masuk_asal_usul_anak > 0
      OR jumlah_masuk_pengesahan_anak > 0
      OR jumlah_masuk_pembatalan_pernikahan > 0
      OR jumlah_masuk_lain_lain > 0
      OR perkara_ecourt > 0
      OR perkara_prodeo > 0
      OR perkara_ghaib > 0
      OR jumlah_ruangan_sidkel > 0
  ORDER BY persentase_masuk DESC;`;

  db.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          if (result.length !== 0) {
            const messages = result.map((r, index) => {
              let message = `*-YM ${r.hakim_nama}-*\n- Total Perkara Masuk di PA : ${r.total_perkara_masuk}\n`;

              // Cek setiap metrik sebelum menambahkannya ke pesan
              if (r.jumlah_masuk > 0) {
                message += `- Perkara Ditangani : ${r.jumlah_masuk}\n`;
              }
              if (r.jumlah_ketua_majelis > 0) {
                message += `          - Ketua Majelis : ${r.jumlah_ketua_majelis}\n`;
              }
              if (r.jumlah_hakim_tunggal > 0) {
                message += `          - Hakim Tunggal : ${r.jumlah_hakim_tunggal} Perkara\n`;
              }
              if (r.perkara_ecourt > 0) {
                message += `- Perkara E-Court : ${r.perkara_ecourt} Perkara\n`;
              }
              if (r.perkara_prodeo > 0) {
                message += `- Perkara Prodeo : ${r.perkara_prodeo} Perkara\n`;
              }
              if (r.perkara_ghaib > 0) {
                message += `- Perkara Ghaib : ${r.perkara_ghaib} Perkara\n`;
              }
              if (r.jumlah_ruangan_sidkel > 0) {
                message += `- Sidkel : ${r.jumlah_ruangan_sidkel} kali (${r.perkara_sidkel} perkara)\n`;
              }
              if (r.jumlah_putus > 0) {
                message += `- Perkara Putus : ${r.jumlah_putus} Perkara (${r.jumlah_putus_verstek} verstek) (${r.jumlah_putus_contra} contra/kabul)\n`;
              }
              if (r.persentase_masuk) {
                message += `- Persentase : ${r.persentase_masuk}%\n`;
              }

              // Rincian perkara yang ditangani
              message += `\nPerkara Yang Ditangani:\n`;
              if (r.jumlah_masuk_cerai_gugat > 0) {
                message += `Cerai Gugat: ${r.jumlah_masuk_cerai_gugat} Perkara\n`;
              }
              if (r.jumlah_masuk_cerai_talak > 0) {
                message += `Cerai Talak: ${r.jumlah_masuk_cerai_talak} Perkara\n`;
              }
              if (r.jumlah_masuk_dispensasi_kawin > 0) {
                message += `Dispensasi Nikah: ${r.jumlah_masuk_dispensasi_kawin} Perkara\n`;
              }
              if (r.jumlah_masuk_itsbat_nikah > 0) {
                message += `Itsbat Nikah: ${r.jumlah_masuk_itsbat_nikah} Perkara\n`;
              }
              if (r.jumlah_masuk_harta_bersama > 0) {
                message += `Harta Bersama: ${r.jumlah_masuk_harta_bersama} Perkara\n`;
              }
              if (r.jumlah_masuk_penetapan_ahli_waris > 0) {
                message += `Penetapan Ahli Waris: ${r.jumlah_masuk_penetapan_ahli_waris} Perkara\n`;
              }
              if (r.jumlah_masuk_kewarisan > 0) {
                message += `Kewarisan: ${r.jumlah_masuk_kewarisan} Perkara\n`;
              }
              if (r.jumlah_masuk_ekonomi_syariah > 0) {
                message += `Ekonomi Syariah: ${r.jumlah_masuk_ekonomi_syariah} Perkara\n`;
              }
              if (r.jumlah_masuk_hadhanah > 0) {
                message += `Hak Asuh Anak: ${r.jumlah_masuk_hadhanah} Perkara\n`;
              }
              if (r.jumlah_masuk_izin_poligami > 0) {
                message += `Izin Poligami: ${r.jumlah_masuk_izin_poligami} Perkara\n`;
              }
              if (r.jumlah_masuk_perwalian > 0) {
                message += `Perwalian: ${r.jumlah_masuk_perwalian} Perkara\n`;
              }
              if (r.jumlah_masuk_wakaf > 0) {
                message += `Wakaf: ${r.jumlah_masuk_wakaf} Perkara\n`;
              }
              if (r.jumlah_masuk_wali_adhol > 0) {
                message += `Wali Adhol: ${r.jumlah_masuk_wali_adhol} Perkara\n`;
              }
              if (r.jumlah_masuk_asal_usul_anak > 0) {
                message += `Asal Usul Anak: ${r.jumlah_masuk_asal_usul_anak} Perkara\n`;
              }
              if (r.jumlah_masuk_pengesahan_anak > 0) {
                message += `Pengesahan Anak: ${r.jumlah_masuk_pengesahan_anak} Perkara\n`;
              }
              if (r.jumlah_masuk_pembatalan_pernikahan > 0) {
                message += `Pembatalan Pernikahan: ${r.jumlah_masuk_pembatalan_pernikahan} Perkara\n`;
              }

              return message.trim();
            });

            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk penerimaan hakim lengkap`);
          }
        }
      });
    } catch (err) {
      reject(err);
    }
  });
};

const getTotalPenerimaanPerkaraSemuaHakimLengkapAll = () => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT 
      TRIM(SUBSTRING_INDEX(perkara_hakim_pn.hakim_nama, ',', 1)) AS hakim_nama,

      -- Menghitung jumlah perkara masuk
      COUNT(DISTINCT CASE 
          WHEN perkara.alur_perkara_id != 114 
              AND perkara_hakim_pn.aktif = 'Y'
          THEN perkara.perkara_id 
      END) AS jumlah_masuk,

      -- Menghitung jumlah ketua majelis
      COUNT(DISTINCT CASE 
          WHEN perkara.alur_perkara_id != 114 
              AND perkara_hakim_pn.aktif = 'Y'
              AND perkara_hakim_pn.jabatan_hakim_id = 1
          THEN perkara.perkara_id 
      END) AS jumlah_ketua_majelis,

      -- Menghitung jumlah hakim tunggal
      COUNT(DISTINCT CASE 
          WHEN perkara.alur_perkara_id != 114 
              AND perkara_hakim_pn.aktif = 'Y'
              AND perkara_hakim_pn.jabatan_hakim_id = 3
          THEN perkara.perkara_id 
      END) AS jumlah_hakim_tunggal,

      -- Menghitung jumlah putusan
      COUNT(DISTINCT CASE 
          WHEN perkara_putusan.tanggal_putusan IS NOT NULL 
              AND perkara.alur_perkara_id != 114 
              AND perkara_hakim_pn.aktif = 'Y'
          THEN perkara.perkara_id 
      END) AS jumlah_putus,

      COUNT(CASE 
          WHEN YEAR(perkara_putusan.tanggal_putusan) = YEAR(CURDATE()) 
              AND perkara_putusan.tanggal_putusan IS NOT NULL 
              AND perkara.alur_perkara_id != 114 
              AND perkara_hakim_pn.aktif = 'Y'
              AND perkara_putusan.putusan_verstek = 'Y'
          THEN perkara.perkara_id 
      END) AS jumlah_putus_verstek,

      COUNT(CASE 
          WHEN YEAR(perkara_putusan.tanggal_putusan) = YEAR(CURDATE()) 
              AND perkara_putusan.tanggal_putusan IS NOT NULL 
              AND perkara.alur_perkara_id != 114 
              AND perkara_hakim_pn.aktif = 'Y'
              AND perkara_putusan.putusan_verstek = 'T'
          THEN perkara.perkara_id 
      END) AS jumlah_putus_contra,

      -- Menghitung total perkara masuk
      (SELECT COUNT(DISTINCT perkara.perkara_id)
      FROM perkara
      WHERE perkara.alur_perkara_id != 114) AS total_perkara_masuk,

      -- Penambahan jumlah berdasarkan jenis_perkara_id
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 347 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_cerai_gugat,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 346 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_cerai_talak,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 362 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_dispensasi_kawin,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 360 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_itsbat_nikah,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 348 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_harta_bersama,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 371 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_penetapan_ahli_waris,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 349 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_hadhanah,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 364 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_kewarisan,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 341 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_izin_poligami,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 354 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_perwalian,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 367 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_wakaf,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 363 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_wali_adhol,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 358 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_asal_usul_anak,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 352 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_pengesahan_anak,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 344 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_pembatalan_pernikahan,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 370 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_ekonomi_syariah,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 369 
          THEN perkara.perkara_id ELSE NULL END) AS jumlah_masuk_lain_lain,

      -- Menambahkan perhitungan e-Court berdasarkan nomor_perkara
      COUNT(DISTINCT CASE 
          WHEN perkara_efiling_id.perkara_id IS NOT NULL 
          THEN perkara.perkara_id 
          ELSE NULL 
      END) AS perkara_ecourt,

      -- Perhitungan Prodeo
      COUNT(DISTINCT CASE 
          WHEN perkara.prodeo = 1 
          THEN perkara.perkara_id 
          ELSE NULL 
      END) AS perkara_prodeo,

      -- Perhitungan Ghaib
      COUNT(DISTINCT CASE 
          WHEN perkara_pihak2.ghaib = 1 
          THEN perkara.perkara_id 
          ELSE NULL 
      END) AS perkara_ghaib,

      -- Perhitungan Sidang Keliling Per Ruangan
      COUNT(DISTINCT CASE 
          WHEN (perkara_jadwal_sidang.sidang_keliling = 'Y' 
                    OR (perkara_jadwal_sidang.ruangan NOT LIKE '%Ruang Sidang 1%' 
                        AND perkara_jadwal_sidang.ruangan NOT LIKE '%Ruang Sidang 2%'))
          THEN perkara_jadwal_sidang.ruangan
          ELSE NULL 
      END) AS jumlah_ruangan_sidkel,

      -- Perhitungan Sidang Keliling
      COUNT(DISTINCT CASE 
          WHEN (perkara_jadwal_sidang.sidang_keliling = 'Y' 
                    OR (perkara_jadwal_sidang.ruangan NOT LIKE '%Ruang Sidang 1%' 
                        AND perkara_jadwal_sidang.ruangan NOT LIKE '%Ruang Sidang 2%'))
          THEN perkara.perkara_id 
          ELSE NULL 
      END) AS perkara_sidkel,

      -- Perhitungan persentase perkara masuk
      CASE
          WHEN (SELECT COUNT(DISTINCT perkara.perkara_id)
                FROM perkara
                WHERE perkara.alur_perkara_id != 114
              ) = 0 THEN 0
          ELSE 
              (COUNT(DISTINCT CASE 
                  WHEN perkara.alur_perkara_id != 114 
                      AND perkara_hakim_pn.aktif = 'Y'
                  THEN perkara.perkara_id 
              END) * 100.0 / (SELECT COUNT(DISTINCT perkara.perkara_id)
                              FROM perkara
                              WHERE perkara.alur_perkara_id != 114
                            )) 
      END AS persentase_masuk
  FROM perkara
  LEFT JOIN perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id
  LEFT JOIN perkara_hakim_pn ON perkara_hakim_pn.perkara_id = perkara.perkara_id
  LEFT JOIN perkara_efiling_id ON perkara.perkara_id = perkara_efiling_id.perkara_id
  LEFT JOIN perkara_pihak2 ON perkara.perkara_id = perkara_pihak2.perkara_id
  LEFT JOIN perkara_jadwal_sidang ON perkara.perkara_id = perkara_jadwal_sidang.perkara_id
  LEFT JOIN user_hakim ON user_hakim.hakim_id = perkara_hakim_pn.hakim_id
  LEFT JOIN sys_users ON sys_users.userid = user_hakim.userid
  WHERE perkara_hakim_pn.aktif = 'Y'
  GROUP BY TRIM(SUBSTRING_INDEX(perkara_hakim_pn.hakim_nama, ',', 1))
  HAVING jumlah_masuk > 0 
      OR jumlah_ketua_majelis > 0 
      OR jumlah_hakim_tunggal > 0 
      OR jumlah_putus > 0 
      OR total_perkara_masuk > 0
      OR jumlah_masuk_cerai_gugat > 0
      OR jumlah_masuk_cerai_talak > 0
      OR jumlah_masuk_dispensasi_kawin > 0
      OR jumlah_masuk_itsbat_nikah > 0
      OR jumlah_masuk_harta_bersama > 0
      OR jumlah_masuk_penetapan_ahli_waris > 0
      OR jumlah_masuk_hadhanah > 0
      OR jumlah_masuk_kewarisan > 0
      OR jumlah_masuk_izin_poligami > 0
      OR jumlah_masuk_perwalian > 0
      OR jumlah_masuk_wakaf > 0
      OR jumlah_masuk_wali_adhol > 0
      OR jumlah_masuk_asal_usul_anak > 0
      OR jumlah_masuk_pengesahan_anak > 0
      OR jumlah_masuk_pembatalan_pernikahan > 0
      OR jumlah_masuk_lain_lain > 0
      OR perkara_ecourt > 0
      OR perkara_prodeo > 0
      OR perkara_ghaib > 0
      OR jumlah_ruangan_sidkel > 0
  ORDER BY persentase_masuk DESC;`;

  db.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          if (result.length !== 0) {
            const messages = result.map((r, index) => {
              let message = `*-YM ${r.hakim_nama}-*\n- Total Perkara Masuk di PA : ${r.total_perkara_masuk}\n`;

              // Cek setiap metrik sebelum menambahkannya ke pesan
              if (r.jumlah_masuk > 0) {
                message += `- Perkara Ditangani : ${r.jumlah_masuk}\n`;
              }
              if (r.jumlah_ketua_majelis > 0) {
                message += `          - Ketua Majelis : ${r.jumlah_ketua_majelis}\n`;
              }
              if (r.jumlah_hakim_tunggal > 0) {
                message += `          - Hakim Tunggal : ${r.jumlah_hakim_tunggal} Perkara\n`;
              }
              if (r.perkara_ecourt > 0) {
                message += `- Perkara E-Court : ${r.perkara_ecourt} Perkara\n`;
              }
              if (r.perkara_prodeo > 0) {
                message += `- Perkara Prodeo : ${r.perkara_prodeo} Perkara\n`;
              }
              if (r.perkara_ghaib > 0) {
                message += `- Perkara Ghaib : ${r.perkara_ghaib} Perkara\n`;
              }
              if (r.jumlah_ruangan_sidkel > 0) {
                message += `- Sidkel : ${r.jumlah_ruangan_sidkel} kali (${r.perkara_sidkel} perkara)\n`;
              }
              if (r.jumlah_putus > 0) {
                message += `- Perkara Putus : ${r.jumlah_putus} Perkara (${r.jumlah_putus_verstek} verstek) (${r.jumlah_putus_contra} contra/kabul)\n`;
              }
              if (r.persentase_masuk) {
                message += `- Persentase : ${r.persentase_masuk}%\n`;
              }

              // Rincian perkara yang ditangani
              message += `\nPerkara Yang Ditangani:\n`;
              if (r.jumlah_masuk_cerai_gugat > 0) {
                message += `Cerai Gugat: ${r.jumlah_masuk_cerai_gugat} Perkara\n`;
              }
              if (r.jumlah_masuk_cerai_talak > 0) {
                message += `Cerai Talak: ${r.jumlah_masuk_cerai_talak} Perkara\n`;
              }
              if (r.jumlah_masuk_dispensasi_kawin > 0) {
                message += `Dispensasi Nikah: ${r.jumlah_masuk_dispensasi_kawin} Perkara\n`;
              }
              if (r.jumlah_masuk_itsbat_nikah > 0) {
                message += `Itsbat Nikah: ${r.jumlah_masuk_itsbat_nikah} Perkara\n`;
              }
              if (r.jumlah_masuk_harta_bersama > 0) {
                message += `Harta Bersama: ${r.jumlah_masuk_harta_bersama} Perkara\n`;
              }
              if (r.jumlah_masuk_penetapan_ahli_waris > 0) {
                message += `Penetapan Ahli Waris: ${r.jumlah_masuk_penetapan_ahli_waris} Perkara\n`;
              }
              if (r.jumlah_masuk_kewarisan > 0) {
                message += `Kewarisan: ${r.jumlah_masuk_kewarisan} Perkara\n`;
              }
              if (r.jumlah_masuk_ekonomi_syariah > 0) {
                message += `Ekonomi Syariah: ${r.jumlah_masuk_ekonomi_syariah} Perkara\n`;
              }
              if (r.jumlah_masuk_hadhanah > 0) {
                message += `Hak Asuh Anak: ${r.jumlah_masuk_hadhanah} Perkara\n`;
              }
              if (r.jumlah_masuk_izin_poligami > 0) {
                message += `Izin Poligami: ${r.jumlah_masuk_izin_poligami} Perkara\n`;
              }
              if (r.jumlah_masuk_perwalian > 0) {
                message += `Perwalian: ${r.jumlah_masuk_perwalian} Perkara\n`;
              }
              if (r.jumlah_masuk_wakaf > 0) {
                message += `Wakaf: ${r.jumlah_masuk_wakaf} Perkara\n`;
              }
              if (r.jumlah_masuk_wali_adhol > 0) {
                message += `Wali Adhol: ${r.jumlah_masuk_wali_adhol} Perkara\n`;
              }
              if (r.jumlah_masuk_asal_usul_anak > 0) {
                message += `Asal Usul Anak: ${r.jumlah_masuk_asal_usul_anak} Perkara\n`;
              }
              if (r.jumlah_masuk_pengesahan_anak > 0) {
                message += `Pengesahan Anak: ${r.jumlah_masuk_pengesahan_anak} Perkara\n`;
              }
              if (r.jumlah_masuk_pembatalan_pernikahan > 0) {
                message += `Pembatalan Pernikahan: ${r.jumlah_masuk_pembatalan_pernikahan} Perkara\n`;
              }

              return message.trim();
            });

            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk penerimaan hakim lengkap`);
          }
        }
      });
    } catch (err) {
      reject(err);
    }
  });
};

const getTotalPenerimaanPerkaraSemuaPaniteraLengkap = () => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT 
      TRIM(SUBSTRING_INDEX(perkara_panitera_pn.panitera_nama, ',', 1)) AS panitera_nama,
      COUNT(DISTINCT CASE 
          WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
              AND perkara.alur_perkara_id != 114 
              AND perkara_panitera_pn.aktif = 'Y'
          THEN perkara.perkara_id 
      END) AS jumlah_masuk,

      -- Menghitung total perkara masuk
      (SELECT COUNT(DISTINCT perkara.perkara_id)
      FROM perkara
      WHERE YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
        AND perkara.alur_perkara_id != 114
      ) AS total_perkara_masuk,

      COUNT(DISTINCT CASE 
          WHEN YEAR(perkara_putusan.tanggal_putusan) = YEAR(CURDATE()) 
              AND perkara_putusan.tanggal_putusan IS NOT NULL 
              AND perkara.alur_perkara_id != 114 
              AND perkara_panitera_pn.aktif = 'Y'
          THEN perkara.perkara_id 
      END) AS jumlah_putus,

      -- Penambahan jumlah berdasarkan jenis_perkara_id
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 347 
          THEN perkara.perkara_id END) AS jumlah_masuk_cerai_gugat,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 346 
          THEN perkara.perkara_id END) AS jumlah_masuk_cerai_talak,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 362 
          THEN perkara.perkara_id END) AS jumlah_masuk_dispensasi_kawin,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 360 
          THEN perkara.perkara_id END) AS jumlah_masuk_itsbat_nikah,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 348 
          THEN perkara.perkara_id END) AS jumlah_masuk_harta_bersama,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 371 
          THEN perkara.perkara_id END) AS jumlah_masuk_penetapan_ahli_waris,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 349 
          THEN perkara.perkara_id END) AS jumlah_masuk_hadhanah,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 364 
          THEN perkara.perkara_id END) AS jumlah_masuk_kewarisan,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 341 
          THEN perkara.perkara_id END) AS jumlah_masuk_izin_poligami,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 354 
          THEN perkara.perkara_id END) AS jumlah_masuk_perwalian,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 367 
          THEN perkara.perkara_id END) AS jumlah_masuk_wakaf,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 363 
          THEN perkara.perkara_id END) AS jumlah_masuk_wali_adhol,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 358 
          THEN perkara.perkara_id END) AS jumlah_masuk_asal_usul_anak,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 352 
          THEN perkara.perkara_id END) AS jumlah_masuk_pengesahan_anak,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 344 
          THEN perkara.perkara_id END) AS jumlah_masuk_pembatalan_pernikahan,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 370 
          THEN perkara.perkara_id END) AS jumlah_ekonomi_syariah,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 369 
          THEN perkara.perkara_id END) AS jumlah_masuk_lain_lain,

      -- Menambahkan perhitungan e-Court berdasarkan nomor_perkara
      COUNT(DISTINCT CASE 
          WHEN perkara_efiling_id.perkara_id IS NOT NULL 
              AND YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE())
          THEN perkara.perkara_id 
          ELSE NULL 
      END) AS perkara_ecourt,

      -- Perhitungan Prodeo
      COUNT(DISTINCT CASE 
          WHEN perkara.prodeo = 1 
              AND YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE())
          THEN perkara.perkara_id 
          ELSE NULL 
      END) AS perkara_prodeo,

      -- Perhitungan Ghaib
      COUNT(DISTINCT CASE 
          WHEN perkara_pihak2.ghaib = 1 
              AND YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE())
          THEN perkara.perkara_id 
          ELSE NULL 
      END) AS perkara_ghaib,

      -- Perhitungan Sidang Keliling Per Ruangan
      COUNT(DISTINCT CASE 
          WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
              AND (perkara_jadwal_sidang.sidang_keliling = 'Y' 
                  OR (perkara_jadwal_sidang.ruangan NOT LIKE '%Ruang Sidang 1%' 
                      AND perkara_jadwal_sidang.ruangan NOT LIKE '%Ruang Sidang 2%'))
          THEN perkara_jadwal_sidang.ruangan
          ELSE NULL 
      END) AS jumlah_ruangan_sidkel,

      -- Perhitungan Sidang Keliling
      COUNT(DISTINCT CASE 
          WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
              AND (perkara_jadwal_sidang.sidang_keliling = 'Y' 
                  OR (perkara_jadwal_sidang.ruangan NOT LIKE '%Ruang Sidang 1%' 
                      AND perkara_jadwal_sidang.ruangan NOT LIKE '%Ruang Sidang 2%'))
          THEN perkara.perkara_id 
          ELSE NULL 
      END) AS perkara_sidkel,

      -- Menghitung persentase masuk
      CASE
          WHEN (SELECT COUNT(DISTINCT perkara.perkara_id)
                FROM perkara
                WHERE YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE())
                  AND perkara.alur_perkara_id != 114
              ) = 0 THEN 0
          ELSE 
              (COUNT(DISTINCT CASE 
                  WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
                      AND perkara.alur_perkara_id != 114 
                      AND perkara_panitera_pn.aktif = 'Y'
                  THEN perkara.perkara_id 
              END) * 100.0 / (SELECT COUNT(DISTINCT perkara.perkara_id)
                              FROM perkara
                              WHERE YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE())
                                AND perkara.alur_perkara_id != 114
                            )) 
      END AS persentase_masuk
    FROM perkara
    LEFT JOIN perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id
    LEFT JOIN perkara_panitera_pn ON perkara_panitera_pn.perkara_id = perkara.perkara_id
    LEFT JOIN perkara_efiling_id ON perkara.perkara_id = perkara_efiling_id.perkara_id
    LEFT JOIN perkara_pihak2 ON perkara.perkara_id = perkara_pihak2.perkara_id
    LEFT JOIN perkara_jadwal_sidang ON perkara.perkara_id = perkara_jadwal_sidang.perkara_id
		LEFT JOIN user_panitera ON user_panitera.panitera_id = perkara_panitera_pn.panitera_id
		LEFT JOIN sys_users ON sys_users.userid = user_panitera.userid
    WHERE YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
          AND perkara_panitera_pn.aktif = 'Y'
					AND sys_users.block = 0
    GROUP BY TRIM(SUBSTRING_INDEX(perkara_panitera_pn.panitera_nama, ',', 1))
    HAVING jumlah_masuk > 0 
      OR jumlah_putus > 0 
      OR total_perkara_masuk > 0
      OR jumlah_masuk_cerai_gugat > 0
      OR jumlah_masuk_cerai_talak > 0
      OR jumlah_masuk_dispensasi_kawin > 0
      OR jumlah_masuk_itsbat_nikah > 0
      OR jumlah_masuk_harta_bersama > 0
      OR jumlah_masuk_penetapan_ahli_waris > 0
      OR jumlah_masuk_hadhanah > 0
      OR jumlah_masuk_kewarisan > 0
      OR jumlah_masuk_izin_poligami > 0
      OR jumlah_masuk_perwalian > 0
      OR jumlah_masuk_wakaf > 0
      OR jumlah_masuk_wali_adhol > 0
      OR jumlah_masuk_asal_usul_anak > 0
      OR jumlah_masuk_pengesahan_anak > 0
      OR jumlah_masuk_pembatalan_pernikahan > 0
      OR jumlah_masuk_lain_lain > 0
      OR perkara_ecourt > 0
      OR perkara_prodeo > 0
      OR perkara_ghaib > 0
      OR jumlah_ruangan_sidkel > 0
    ORDER BY persentase_masuk DESC;`;

          db.query(query, (err, result) => {
            if (err) {
              reject(err);
            } else {
              if (result.length != 0) {
                const messages = result.map((r, index) => {
                  return `*-${r.panitera_nama}-*\n- Perkara Ditangani : ${r.jumlah_masuk}\n- Perkara Putus : ${r.jumlah_putus}\n- Total Perkara Masuk di PA : ${r.total_perkara_masuk}\n- Persentase : ${r.persentase_masuk}%`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk panitera`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching penerimaan perkara panitera data:", error);
      reject(error);
    }
  });
};

const getTotalPenerimaanPerkaraSemuaPaniteraLengkapAll = () => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT 
      TRIM(SUBSTRING_INDEX(perkara_panitera_pn.panitera_nama, ',', 1)) AS panitera_nama,
      COUNT(DISTINCT CASE 
          WHEN perkara.alur_perkara_id != 114 
              AND perkara_panitera_pn.aktif = 'Y'
          THEN perkara.perkara_id 
      END) AS jumlah_masuk,

      -- Menghitung total perkara masuk
      (SELECT COUNT(DISTINCT perkara.perkara_id)
      FROM perkara
      WHERE perkara.alur_perkara_id != 114
      ) AS total_perkara_masuk,

      COUNT(DISTINCT CASE 
          WHEN perkara_putusan.tanggal_putusan IS NOT NULL 
              AND perkara.alur_perkara_id != 114 
              AND perkara_panitera_pn.aktif = 'Y'
          THEN perkara.perkara_id 
      END) AS jumlah_putus,

      -- Penambahan jumlah berdasarkan jenis_perkara_id
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 347 
          THEN perkara.perkara_id END) AS jumlah_masuk_cerai_gugat,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 346 
          THEN perkara.perkara_id END) AS jumlah_masuk_cerai_talak,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 362 
          THEN perkara.perkara_id END) AS jumlah_masuk_dispensasi_kawin,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 360 
          THEN perkara.perkara_id END) AS jumlah_masuk_itsbat_nikah,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 348 
          THEN perkara.perkara_id END) AS jumlah_masuk_harta_bersama,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 371 
          THEN perkara.perkara_id END) AS jumlah_masuk_penetapan_ahli_waris,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 349 
          THEN perkara.perkara_id END) AS jumlah_masuk_hadhanah,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 364 
          THEN perkara.perkara_id END) AS jumlah_masuk_kewarisan,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 341 
          THEN perkara.perkara_id END) AS jumlah_masuk_izin_poligami,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 354 
          THEN perkara.perkara_id END) AS jumlah_masuk_perwalian,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 367 
          THEN perkara.perkara_id END) AS jumlah_masuk_wakaf,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 363 
          THEN perkara.perkara_id END) AS jumlah_masuk_wali_adhol,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 358 
          THEN perkara.perkara_id END) AS jumlah_masuk_asal_usul_anak,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 352 
          THEN perkara.perkara_id END) AS jumlah_masuk_pengesahan_anak,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 344 
          THEN perkara.perkara_id END) AS jumlah_masuk_pembatalan_pernikahan,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 370 
          THEN perkara.perkara_id END) AS jumlah_ekonomi_syariah,
      COUNT(DISTINCT CASE WHEN perkara.jenis_perkara_id = 369 
          THEN perkara.perkara_id END) AS jumlah_masuk_lain_lain,

      -- Menambahkan perhitungan e-Court berdasarkan nomor_perkara
      COUNT(DISTINCT CASE 
          WHEN perkara_efiling_id.perkara_id IS NOT NULL 
          THEN perkara.perkara_id 
          ELSE NULL 
      END) AS perkara_ecourt,

      -- Perhitungan Prodeo
      COUNT(DISTINCT CASE 
          WHEN perkara.prodeo = 1 
          THEN perkara.perkara_id 
          ELSE NULL 
      END) AS perkara_prodeo,

      -- Perhitungan Ghaib
      COUNT(DISTINCT CASE 
          WHEN perkara_pihak2.ghaib = 1 
          THEN perkara.perkara_id 
          ELSE NULL 
      END) AS perkara_ghaib,

      -- Perhitungan Sidang Keliling Per Ruangan
      COUNT(DISTINCT CASE 
          WHEN (perkara_jadwal_sidang.sidang_keliling = 'Y' 
                  OR (perkara_jadwal_sidang.ruangan NOT LIKE '%Ruang Sidang 1%' 
                      AND perkara_jadwal_sidang.ruangan NOT LIKE '%Ruang Sidang 2%'))
          THEN perkara_jadwal_sidang.ruangan
          ELSE NULL 
      END) AS jumlah_ruangan_sidkel,

      -- Perhitungan Sidang Keliling
      COUNT(DISTINCT CASE 
          WHEN (perkara_jadwal_sidang.sidang_keliling = 'Y' 
                  OR (perkara_jadwal_sidang.ruangan NOT LIKE '%Ruang Sidang 1%' 
                      AND perkara_jadwal_sidang.ruangan NOT LIKE '%Ruang Sidang 2%'))
          THEN perkara.perkara_id 
          ELSE NULL 
      END) AS perkara_sidkel,

      -- Menghitung persentase masuk
      CASE
          WHEN (SELECT COUNT(DISTINCT perkara.perkara_id)
                FROM perkara
                WHERE perkara.alur_perkara_id != 114
              ) = 0 THEN 0
          ELSE 
              (COUNT(DISTINCT CASE 
                  WHEN perkara.alur_perkara_id != 114 
                      AND perkara_panitera_pn.aktif = 'Y'
                  THEN perkara.perkara_id 
              END) * 100.0 / (SELECT COUNT(DISTINCT perkara.perkara_id)
                              FROM perkara
                              WHERE perkara.alur_perkara_id != 114
                            )) 
      END AS persentase_masuk
    FROM perkara
    LEFT JOIN perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id
    LEFT JOIN perkara_panitera_pn ON perkara_panitera_pn.perkara_id = perkara.perkara_id
    LEFT JOIN perkara_efiling_id ON perkara.perkara_id = perkara_efiling_id.perkara_id
    LEFT JOIN perkara_pihak2 ON perkara.perkara_id = perkara_pihak2.perkara_id
    LEFT JOIN perkara_jadwal_sidang ON perkara.perkara_id = perkara_jadwal_sidang.perkara_id
		LEFT JOIN user_panitera ON user_panitera.panitera_id = perkara_panitera_pn.panitera_id
		LEFT JOIN sys_users ON sys_users.userid = user_panitera.userid
    WHERE perkara_panitera_pn.aktif = 'Y'
    GROUP BY TRIM(SUBSTRING_INDEX(perkara_panitera_pn.panitera_nama, ',', 1))
    HAVING jumlah_masuk > 0 
      OR jumlah_putus > 0 
      OR total_perkara_masuk > 0
      OR jumlah_masuk_cerai_gugat > 0
      OR jumlah_masuk_cerai_talak > 0
      OR jumlah_masuk_dispensasi_kawin > 0
      OR jumlah_masuk_itsbat_nikah > 0
      OR jumlah_masuk_harta_bersama > 0
      OR jumlah_masuk_penetapan_ahli_waris > 0
      OR jumlah_masuk_hadhanah > 0
      OR jumlah_masuk_kewarisan > 0
      OR jumlah_masuk_izin_poligami > 0
      OR jumlah_masuk_perwalian > 0
      OR jumlah_masuk_wakaf > 0
      OR jumlah_masuk_wali_adhol > 0
      OR jumlah_masuk_asal_usul_anak > 0
      OR jumlah_masuk_pengesahan_anak > 0
      OR jumlah_masuk_pembatalan_pernikahan > 0
      OR jumlah_masuk_lain_lain > 0
      OR perkara_ecourt > 0
      OR perkara_prodeo > 0
      OR perkara_ghaib > 0
      OR jumlah_ruangan_sidkel > 0
    ORDER BY persentase_masuk DESC;`;

          db.query(query, (err, result) => {
            if (err) {
              reject(err);
            } else {
              if (result.length != 0) {
                const messages = result.map((r, index) => {
                  return `*-${r.panitera_nama}-*\n- Perkara Ditangani : ${r.jumlah_masuk}\n- Perkara Putus : ${r.jumlah_putus}\n- Total Perkara Masuk di PA : ${r.total_perkara_masuk}\n- Persentase : ${r.persentase_masuk}%`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk panitera`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching penerimaan perkara panitera data:", error);
      reject(error);
    }
  });
};

const getTotalPenerimaanPerkaraSemuaJurusitaLengkap = () => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT 
      TRIM(SUBSTRING_INDEX(perkara_jurusita.jurusita_nama, ',', 1)) AS jurusita_nama,
      COUNT(DISTINCT CASE 
          WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
              AND perkara.alur_perkara_id != 114 
              AND perkara_jurusita.aktif = 'Y'
          THEN perkara.perkara_id 
      END) AS jumlah_masuk,

      -- Menghitung total perkara masuk
      (SELECT COUNT(DISTINCT perkara_id)
      FROM perkara
      WHERE YEAR(tanggal_pendaftaran) = YEAR(CURDATE()) 
        AND alur_perkara_id != 114
      ) AS total_perkara_masuk,

      -- Menambahkan perhitungan e-Court berdasarkan nomor_perkara
      COUNT(DISTINCT CASE 
          WHEN perkara_efiling_id.perkara_id IS NOT NULL 
              AND YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE())
          THEN perkara.perkara_id 
          ELSE NULL 
      END) AS perkara_ecourt,

      -- Perhitungan Prodeo
      COUNT(DISTINCT CASE 
          WHEN perkara.prodeo = 1 
              AND YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE())
          THEN perkara.perkara_id 
          ELSE NULL 
      END) AS perkara_prodeo,

      -- Perhitungan Ghaib
      COUNT(DISTINCT CASE 
          WHEN perkara_pihak2.ghaib = 1 
              AND YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE())
          THEN perkara.perkara_id 
          ELSE NULL 
      END) AS perkara_ghaib,

      COUNT(DISTINCT CASE
          WHEN YEAR(perkara_putusan.tanggal_putusan) = YEAR(CURDATE()) 
              AND perkara_putusan.tanggal_putusan IS NOT NULL 
              AND perkara.alur_perkara_id != 114 
              AND perkara_jurusita.aktif = 'Y'
          THEN perkara.perkara_id 
      END) AS jumlah_putus,

      -- Menghitung persentase masuk
      CASE
          WHEN (SELECT COUNT(DISTINCT perkara_id)
                FROM perkara
                WHERE YEAR(tanggal_pendaftaran) = YEAR(CURDATE())
                  AND alur_perkara_id != 114
              ) = 0 THEN 0
          ELSE 
              (COUNT(DISTINCT CASE 
                  WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
                      AND perkara.alur_perkara_id != 114 
                      AND perkara_jurusita.aktif = 'Y'
                  THEN perkara.perkara_id 
              END) * 100.0 / 
              (SELECT COUNT(DISTINCT perkara_id)
                FROM perkara
                WHERE YEAR(tanggal_pendaftaran) = YEAR(CURDATE())
                  AND alur_perkara_id != 114
              )) 
      END AS persentase_masuk
    FROM perkara
    LEFT JOIN perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id
    LEFT JOIN perkara_jurusita ON perkara_jurusita.perkara_id = perkara.perkara_id
    LEFT JOIN perkara_efiling_id ON perkara.perkara_id = perkara_efiling_id.perkara_id
    LEFT JOIN perkara_pihak2 ON perkara.perkara_id = perkara_pihak2.perkara_id
    LEFT JOIN perkara_jadwal_sidang ON perkara.perkara_id = perkara_jadwal_sidang.perkara_id
		LEFT JOIN user_jurusita ON user_jurusita.jurusita_id = perkara_jurusita.jurusita_id
		LEFT JOIN sys_users ON sys_users.userid = user_jurusita.userid
    WHERE YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE())
      AND perkara_jurusita.aktif = 'Y'
			AND sys_users.block = 0
    GROUP BY TRIM(SUBSTRING_INDEX(perkara_jurusita.jurusita_nama, ',', 1))
    ORDER BY persentase_masuk DESC;`;

          db.query(query, (err, result) => {
            if (err) {
              reject(err);
            } else {
              if (result.length != 0) {
                const messages = result.map((r, index) => {
                  return `*-${r.jurusita_nama}-*\n- Perkara Ditangani : ${r.jumlah_masuk}\n- Perkara Putus : ${r.jumlah_putus}\n- Total Perkara Masuk di PA : ${r.total_perkara_masuk}\n- Persentase : ${r.persentase_masuk}%`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk jurusita`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching penerimaan perkara jurusita data:", error);
      reject(error);
    }
  });
};

const getTotalPenerimaanPerkaraSemuaJurusitaLengkapAll = () => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT 
      TRIM(SUBSTRING_INDEX(perkara_jurusita.jurusita_nama, ',', 1)) AS jurusita_nama,
      COUNT(DISTINCT CASE 
          WHEN perkara.alur_perkara_id != 114 
              AND perkara_jurusita.aktif = 'Y'
          THEN perkara.perkara_id 
      END) AS jumlah_masuk,

      -- Menghitung total perkara masuk
      (SELECT COUNT(DISTINCT perkara_id)
      FROM perkara
      WHERE alur_perkara_id != 114
      ) AS total_perkara_masuk,

      -- Menambahkan perhitungan e-Court berdasarkan nomor_perkara
      COUNT(DISTINCT CASE 
          WHEN perkara_efiling_id.perkara_id IS NOT NULL 
          THEN perkara.perkara_id 
          ELSE NULL 
      END) AS perkara_ecourt,

      -- Perhitungan Prodeo
      COUNT(DISTINCT CASE 
          WHEN perkara.prodeo = 1 
          THEN perkara.perkara_id 
          ELSE NULL 
      END) AS perkara_prodeo,

      -- Perhitungan Ghaib
      COUNT(DISTINCT CASE 
          WHEN perkara_pihak2.ghaib = 1
          THEN perkara.perkara_id 
          ELSE NULL 
      END) AS perkara_ghaib,

      COUNT(DISTINCT CASE
          WHEN perkara_putusan.tanggal_putusan IS NOT NULL 
              AND perkara.alur_perkara_id != 114 
              AND perkara_jurusita.aktif = 'Y'
          THEN perkara.perkara_id 
      END) AS jumlah_putus,

      -- Menghitung persentase masuk
      CASE
          WHEN (SELECT COUNT(DISTINCT perkara_id)
                FROM perkara
                WHERE alur_perkara_id != 114
              ) = 0 THEN 0
          ELSE 
              (COUNT(DISTINCT CASE 
                  WHEN perkara.alur_perkara_id != 114 
                      AND perkara_jurusita.aktif = 'Y'
                  THEN perkara.perkara_id 
              END) * 100.0 / 
              (SELECT COUNT(DISTINCT perkara_id)
                FROM perkara
                WHERE alur_perkara_id != 114
              )) 
      END AS persentase_masuk
    FROM perkara
    LEFT JOIN perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id
    LEFT JOIN perkara_jurusita ON perkara_jurusita.perkara_id = perkara.perkara_id
    LEFT JOIN perkara_efiling_id ON perkara.perkara_id = perkara_efiling_id.perkara_id
    LEFT JOIN perkara_pihak2 ON perkara.perkara_id = perkara_pihak2.perkara_id
    LEFT JOIN perkara_jadwal_sidang ON perkara.perkara_id = perkara_jadwal_sidang.perkara_id
		LEFT JOIN user_jurusita ON user_jurusita.jurusita_id = perkara_jurusita.jurusita_id
		LEFT JOIN sys_users ON sys_users.userid = user_jurusita.userid
    WHERE perkara_jurusita.aktif = 'Y'
    GROUP BY TRIM(SUBSTRING_INDEX(perkara_jurusita.jurusita_nama, ',', 1))
    ORDER BY persentase_masuk DESC;`;

          db.query(query, (err, result) => {
            if (err) {
              reject(err);
            } else {
              if (result.length != 0) {
                const messages = result.map((r, index) => {
                  return `*-${r.jurusita_nama}-*\n- Perkara Ditangani : ${r.jumlah_masuk}\n- Perkara Putus : ${r.jumlah_putus}\n- Total Perkara Masuk di PA : ${r.total_perkara_masuk}\n- Persentase : ${r.persentase_masuk}%`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk jurusita`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching penerimaan perkara jurusita data:", error);
      reject(error);
    }
  });
};

const getTotalPenerimaanMediasiSemuaHakim = () => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT 
      TRIM(SUBSTRING_INDEX(perkara_mediator.nama_mediator, ',', 1)) AS mediator_name,
      SUM(CASE WHEN perkara_mediasi.hasil_mediasi = 'Y1' THEN 1 ELSE 0 END) AS 'Berhasil_Kesepakatan_Damai',
      SUM(CASE WHEN perkara_mediasi.hasil_mediasi = 'Y2' THEN 1 ELSE 0 END) AS 'Berhasil_Dengan_Pencabutan',
      SUM(CASE WHEN perkara_mediasi.hasil_mediasi = 'S' THEN 1 ELSE 0 END) AS 'Berhasil_Sebagian',
      SUM(CASE WHEN perkara_mediasi.hasil_mediasi = 'D' THEN 1 ELSE 0 END) AS 'Tidak_Dapat_Dilaksanakan',
      SUM(CASE WHEN perkara_mediasi.hasil_mediasi NOT IN ('Y1', 'Y2', 'S', 'D') THEN 1 ELSE 0 END) AS 'Tidak_Berhasil',
      COUNT(*) AS total_mediasi,
      ROUND(
          (
              SUM(CASE WHEN perkara_mediasi.hasil_mediasi = 'Y1' THEN 1 ELSE 0 END) + 
              SUM(CASE WHEN perkara_mediasi.hasil_mediasi = 'Y2' THEN 1 ELSE 0 END) + 
              0.5 * SUM(CASE WHEN perkara_mediasi.hasil_mediasi = 'S' THEN 1 ELSE 0 END)
          ) * 100.0 / COUNT(*), 2
      ) AS persentase_berhasil
    FROM 
        perkara
    LEFT JOIN
        perkara_mediasi ON perkara.perkara_id = perkara_mediasi.perkara_id
    LEFT JOIN
        perkara_mediator ON perkara.perkara_id = perkara_mediator.perkara_id
    LEFT JOIN
        mediator ON mediator.id = perkara_mediator.mediator_id
    LEFT JOIN
        user_hakim ON user_hakim.hakim_id = mediator.hakim_id 
    LEFT JOIN
        sys_users ON sys_users.userid = user_hakim.userid
    WHERE 
        perkara_mediasi.perkara_id IS NOT NULL 
        AND YEAR(keputusan_mediasi) = YEAR(CURDATE())
        AND perkara_mediator.aktif = 'Y'
        AND sys_users.block = 0
    GROUP BY 
        mediator_name
    ORDER BY
        persentase_berhasil DESC;`;

        db.query(query, (err, result) => {
            if (err) {
              reject(err);
            } else {
              if (result.length != 0) {
                const messages = result.map((r, index) => {
                return `*-YM ${r.mediator_name}-*\n- Mediasi Ditangani : ${r.total_mediasi}\n- Persentase Keberhasilan : ${r.persentase_berhasil}%\n- Status Laporan Mediator :\n          - Kesepakatan Damai : ${r.Berhasil_Kesepakatan_Damai}\n          - Pencabutan : ${r.Berhasil_Dengan_Pencabutan}\n          - Berhasil Sebagian : ${r.Berhasil_Sebagian}\n          - Tidak Dapat Dilaksanakan : ${r.Tidak_Dapat_Dilaksanakan}\n          - Tidak Berhasil : ${r.Tidak_Berhasil}`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk jurusita`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching penerimaan perkara jurusita data:", error);
      reject(error);
    }
  });
};

const getTotalPenerimaanMediasiSemuaHakimAll = () => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT 
      TRIM(SUBSTRING_INDEX(perkara_mediator.nama_mediator, ',', 1)) AS mediator_name,
      SUM(CASE WHEN perkara_mediasi.hasil_mediasi = 'Y1' THEN 1 ELSE 0 END) AS 'Berhasil_Kesepakatan_Damai',
      SUM(CASE WHEN perkara_mediasi.hasil_mediasi = 'Y2' THEN 1 ELSE 0 END) AS 'Berhasil_Dengan_Pencabutan',
      SUM(CASE WHEN perkara_mediasi.hasil_mediasi = 'S' THEN 1 ELSE 0 END) AS 'Berhasil_Sebagian',
      SUM(CASE WHEN perkara_mediasi.hasil_mediasi = 'D' THEN 1 ELSE 0 END) AS 'Tidak_Dapat_Dilaksanakan',
      SUM(CASE WHEN perkara_mediasi.hasil_mediasi NOT IN ('Y1', 'Y2', 'S', 'D') THEN 1 ELSE 0 END) AS 'Tidak_Berhasil',
      COUNT(*) AS total_mediasi,
      ROUND(
          (
              SUM(CASE WHEN perkara_mediasi.hasil_mediasi = 'Y1' THEN 1 ELSE 0 END) + 
              SUM(CASE WHEN perkara_mediasi.hasil_mediasi = 'Y2' THEN 1 ELSE 0 END) + 
              0.5 * SUM(CASE WHEN perkara_mediasi.hasil_mediasi = 'S' THEN 1 ELSE 0 END)
          ) * 100.0 / COUNT(*), 2
      ) AS persentase_berhasil
    FROM 
        perkara
    LEFT JOIN
        perkara_mediasi ON perkara.perkara_id = perkara_mediasi.perkara_id
    LEFT JOIN
        perkara_mediator ON perkara.perkara_id = perkara_mediator.perkara_id
    LEFT JOIN
        mediator ON mediator.id = perkara_mediator.mediator_id
    LEFT JOIN
        user_hakim ON user_hakim.hakim_id = mediator.hakim_id 
    LEFT JOIN
        sys_users ON sys_users.userid = user_hakim.userid
    WHERE 
        perkara_mediasi.perkara_id IS NOT NULL         
        AND perkara_mediator.aktif = 'Y'
    GROUP BY 
        mediator_name
    ORDER BY
        persentase_berhasil DESC;`;

        db.query(query, (err, result) => {
            if (err) {
              reject(err);
            } else {
              if (result.length != 0) {
                const messages = result.map((r, index) => {
                return `*-YM ${r.mediator_name}-*\n- Mediasi Ditangani : ${r.total_mediasi}\n- Persentase Keberhasilan : ${r.persentase_berhasil}%\n- Status Laporan Mediator :\n          - Kesepakatan Damai : ${r.Berhasil_Kesepakatan_Damai}\n          - Pencabutan : ${r.Berhasil_Dengan_Pencabutan}\n          - Berhasil Sebagian : ${r.Berhasil_Sebagian}\n          - Tidak Dapat Dilaksanakan : ${r.Tidak_Dapat_Dilaksanakan}\n          - Tidak Berhasil : ${r.Tidak_Berhasil}`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk jurusita`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching penerimaan perkara jurusita data:", error);
      reject(error);
    }
  });
};

const getDataJumlahAlasanCerai = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT 
        SUM(CASE faktor_perceraian_id WHEN 1 THEN 1 ELSE 0 END) AS zina,
        SUM(CASE faktor_perceraian_id WHEN 2 THEN 1 ELSE 0 END) AS mabuk,
        SUM(CASE faktor_perceraian_id WHEN 3 THEN 1 ELSE 0 END) AS madat,
        SUM(CASE faktor_perceraian_id WHEN 4 THEN 1 ELSE 0 END) AS judi,
        SUM(CASE WHEN faktor_perceraian_id IN (5,18) THEN 1 ELSE 0 END) AS meninggalkan,
        SUM(CASE WHEN faktor_perceraian_id IN (6,20) THEN 1 ELSE 0 END) AS dihukum,
        SUM(CASE WHEN faktor_perceraian_id IN (7,25,26) THEN 1 ELSE 0 END) AS kdrt,
        SUM(CASE WHEN faktor_perceraian_id IN (8,21) THEN 1 ELSE 0 END) AS cacat,
        SUM(CASE WHEN faktor_perceraian_id IN (9,24) THEN 1 ELSE 0 END) AS perselisihan,
        SUM(CASE WHEN faktor_perceraian_id IN (10,19) THEN 1 ELSE 0 END) AS kawin_paksa,
        SUM(CASE faktor_perceraian_id WHEN 11 THEN 1 ELSE 0 END) AS murtad,
        SUM(CASE faktor_perceraian_id WHEN 12 THEN 1 ELSE 0 END) AS ekonomi,
        SUM(CASE WHEN faktor_perceraian_id IN (13,15) THEN 1 ELSE 0 END) AS poligami, 
        SUM(CASE WHEN faktor_perceraian_id IN (16,17,22,23) THEN 1 ELSE 0 END) AS lain
      FROM perkara_akta_cerai  
      WHERE
        YEAR(tgl_akta_cerai) = YEAR(CURRENT_DATE());`;

    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = result.map((r) => {
            return `Rekapitulasi berdasarkan alasan cerai tahun ini :\nAlasan Zina : ${r.zina}\nAlasan Mabuk : ${r.mabuk}\nAlasan Madat : ${r.madat}\nAlasan Judi : ${r.judi}\nAlasan Meninggalkan 2 Tahun : ${r.meninggalkan}\nAlasan Dihukum : ${r.dihukum}\nAlasan KDRT : ${r.kdrt}\nAlasan Cacat : ${r.cacat}\nAlasan Perselisihan : ${r.perselisihan}\nAlasan Kawin Paksa : ${r.kawin_paksa}\nAlasan Murtad : ${r.murtad}\nAlasan Ekonomi : ${r.ekonomi}\nAlasan Poligami : ${r.poligami}\nAlasan Lain : ${r.lain}`;
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataKodeJabatan = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT 
      hakim.kode AS kode_hakim, 
      hakim.nama_gelar AS nama_gelar_hakim 
  FROM hakim_pn AS hakim 
  WHERE hakim.aktif = "Y"

  UNION

  SELECT 
      panitera.kode AS kode_panitera, 
      panitera.nama_gelar AS nama_gelar_panitera 
  FROM panitera_pn AS panitera 
  WHERE panitera.aktif = "Y"

  ORDER BY 1 ASC;`;

    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = result.map((r) => {
            // Memisahkan hasil untuk kode_hakim dan kode_panitera
            const kodeHakim = r.kode_hakim ? `Kode Hakim : *${r.kode_hakim}* : ${r.nama_gelar_hakim}` : '';
            const kodePanitera = r.kode_panitera ? `Kode Panitera : *${r.kode_panitera}* : ${r.nama_gelar_panitera}` : '';
            return `${kodeHakim}\n${kodePanitera}`.trim(); // Menghapus baris kosong
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataBelumValidasi = () => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT 
      rvp.tanggal AS tanggal_terakhir_proses,
      rvjp.nama_proses AS nama_proses,
      COALESCE(rvp.diinput_oleh, 'Belum diinput') AS status_input
    FROM register_validasi_proses rvp
    LEFT JOIN register_validasi_jenis_proses rvjp 
        ON rvp.id_jenis_proses = rvjp.id
    WHERE YEAR(rvp.tanggal) = YEAR(CURDATE())
    AND rvp.tanggal NOT IN (SELECT DISTINCT tanggal FROM register_validasi)
    ORDER BY rvp.tanggal DESC;`;

      db5.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          if (result.length != 0) {
            const messages = result.map((r, index) => {
              const tanggalFormatted = new Date(r.tanggal_terakhir_proses)
                .toLocaleDateString('id-ID');
              return `Nama Proses : *${r.nama_proses}*\nPejabat Validator : ${r.status_input}\nTanggal : ${tanggalFormatted}`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk Belum Validasi`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching Belum Validasi data:", error);
      reject(error);
    }
  });
};

//KODE UNTUK PENILIAAN SIPP

//KINERJA
//WAKTU PUTUSAN
const getDataKriteriaWaktuPutus = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT DISTINCT
    a.nomor_perkara,
    a.jenis_perkara_nama,
    REPLACE(n.majelis_hakim_text, '</br>', ' | ') AS majelis_hakim_text,
    c.panitera_nama,
    m.jurusita_nama,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    
    -- Hitung durasi dengan pengecualian untuk perkara ghaib
    CASE
      WHEN a.proses_terakhir_id < 210 THEN
        DATEDIFF(CURDATE(), a.tanggal_pendaftaran) 
      ELSE
        DATEDIFF(d.tanggal_putusan, a.tanggal_pendaftaran)
    END 
    - IFNULL((SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0) 
    - CASE
        WHEN i.perkara_id IS NOT NULL THEN 120  -- Jika perkara ghaib, kurangi 120 hari
        ELSE 0
      END
    + 1 AS durasi,
    
    -- Penilaian berdasarkan durasi
    CASE
      WHEN 
        (CASE
          WHEN a.proses_terakhir_id < 210 THEN DATEDIFF(CURDATE(), a.tanggal_pendaftaran)
          ELSE DATEDIFF(d.tanggal_putusan, a.tanggal_pendaftaran)
        END
        - IFNULL((SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0)
        - CASE WHEN i.perkara_id IS NOT NULL THEN 120 ELSE 0 END + 1
      ) <= 90 THEN 5
      WHEN 
        (CASE
          WHEN a.proses_terakhir_id < 210 THEN DATEDIFF(CURDATE(), a.tanggal_pendaftaran)
          ELSE DATEDIFF(d.tanggal_putusan, a.tanggal_pendaftaran)
        END
        - IFNULL((SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0)
        - CASE WHEN i.perkara_id IS NOT NULL THEN 120 ELSE 0 END + 1
      ) BETWEEN 91 AND 120 THEN 3
      WHEN 
        (CASE
          WHEN a.proses_terakhir_id < 210 THEN DATEDIFF(CURDATE(), a.tanggal_pendaftaran)
          ELSE DATEDIFF(d.tanggal_putusan, a.tanggal_pendaftaran)
        END
        - IFNULL((SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0)
        - CASE WHEN i.perkara_id IS NOT NULL THEN 120 ELSE 0 END + 1
      ) BETWEEN 121 AND 150 THEN 1
      ELSE 0
    END AS nilai

  FROM perkara a
  LEFT JOIN perkara_panitera_pn AS c ON a.perkara_id = c.perkara_id
  LEFT JOIN perkara_putusan AS d ON a.perkara_id = d.perkara_id
  LEFT JOIN perkara_hakim_pn AS f ON a.perkara_id = f.perkara_id
  LEFT JOIN perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
  LEFT JOIN perkara_jurusita AS m ON a.perkara_id = m.perkara_id
  LEFT JOIN perkara_penetapan AS n ON a.perkara_id = n.perkara_id
  WHERE YEAR(d.tanggal_putusan) = YEAR(CURDATE()) AND c.aktif = 'Y' AND f.aktif = 'Y' AND m.aktif = 'Y'
  ORDER BY nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`;

  //PERKARA DIBAWAH NILAI 5 YANG TELAH DI FILTER
  let queryFilter = `SELECT DISTINCT
    a.nomor_perkara,
    a.jenis_perkara_nama,
    REPLACE(n.majelis_hakim_text, '</br>', ' | ') AS majelis_hakim_text,
    c.panitera_nama,
    m.jurusita_nama,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    
    -- Hitung durasi dengan pengecualian untuk perkara ghaib
    CASE
      WHEN a.proses_terakhir_id < 210 THEN
        DATEDIFF(CURDATE(), a.tanggal_pendaftaran) 
      ELSE
        DATEDIFF(d.tanggal_putusan, a.tanggal_pendaftaran)
    END 
    - IFNULL((SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0) 
    - CASE
        WHEN i.perkara_id IS NOT NULL THEN 120  -- Jika perkara ghaib, kurangi 120 hari
        ELSE 0
      END
    + 1 AS durasi,
    
    -- Penilaian berdasarkan durasi
    CASE
      WHEN 
        (CASE
          WHEN a.proses_terakhir_id < 210 THEN DATEDIFF(CURDATE(), a.tanggal_pendaftaran)
          ELSE DATEDIFF(d.tanggal_putusan, a.tanggal_pendaftaran)
        END
        - IFNULL((SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0)
        - CASE WHEN i.perkara_id IS NOT NULL THEN 120 ELSE 0 END + 1
      ) <= 90 THEN 5
      WHEN 
        (CASE
          WHEN a.proses_terakhir_id < 210 THEN DATEDIFF(CURDATE(), a.tanggal_pendaftaran)
          ELSE DATEDIFF(d.tanggal_putusan, a.tanggal_pendaftaran)
        END
        - IFNULL((SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0)
        - CASE WHEN i.perkara_id IS NOT NULL THEN 120 ELSE 0 END + 1
      ) BETWEEN 91 AND 120 THEN 3
      WHEN 
        (CASE
          WHEN a.proses_terakhir_id < 210 THEN DATEDIFF(CURDATE(), a.tanggal_pendaftaran)
          ELSE DATEDIFF(d.tanggal_putusan, a.tanggal_pendaftaran)
        END
        - IFNULL((SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0)
        - CASE WHEN i.perkara_id IS NOT NULL THEN 120 ELSE 0 END + 1
      ) BETWEEN 121 AND 150 THEN 1
      ELSE 0
    END AS nilai

  FROM perkara a
  LEFT JOIN perkara_panitera_pn AS c ON a.perkara_id = c.perkara_id
  LEFT JOIN perkara_putusan AS d ON a.perkara_id = d.perkara_id
  LEFT JOIN perkara_hakim_pn AS f ON a.perkara_id = f.perkara_id
  LEFT JOIN perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
  LEFT JOIN perkara_jurusita AS m ON a.perkara_id = m.perkara_id
  LEFT JOIN perkara_penetapan AS n ON a.perkara_id = n.perkara_id
  WHERE YEAR(d.tanggal_putusan) = YEAR(CURDATE()) 
    AND c.aktif = 'Y' 
    AND f.aktif = 'Y' 
    AND m.aktif = 'Y'
    AND (
      -- Kondisi untuk menampilkan hanya nilai selain 5
      CASE
        WHEN 
          (CASE
            WHEN a.proses_terakhir_id < 210 THEN DATEDIFF(CURDATE(), a.tanggal_pendaftaran)
            ELSE DATEDIFF(d.tanggal_putusan, a.tanggal_pendaftaran)
          END
          - IFNULL((SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0)
          - CASE WHEN i.perkara_id IS NOT NULL THEN 120 ELSE 0 END + 1
        ) <= 90 THEN 5
        WHEN 
          (CASE
            WHEN a.proses_terakhir_id < 210 THEN DATEDIFF(CURDATE(), a.tanggal_pendaftaran)
            ELSE DATEDIFF(d.tanggal_putusan, a.tanggal_pendaftaran)
          END
          - IFNULL((SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0)
          - CASE WHEN i.perkara_id IS NOT NULL THEN 120 ELSE 0 END + 1
        ) BETWEEN 91 AND 120 THEN 3
        WHEN 
          (CASE
            WHEN a.proses_terakhir_id < 210 THEN DATEDIFF(CURDATE(), a.tanggal_pendaftaran)
            ELSE DATEDIFF(d.tanggal_putusan, a.tanggal_pendaftaran)
          END
          - IFNULL((SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0)
          - CASE WHEN i.perkara_id IS NOT NULL THEN 120 ELSE 0 END + 1
        ) BETWEEN 121 AND 150 THEN 1
        ELSE 0
      END <> 5
    )
  ORDER BY nilai ASC;`;

    db.query(queryFilter, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama} ${r.ecourt} ${r.ghaib}\n${r.majelis_hakim_text}\nPP : ${r.panitera_nama}\nJurusita : ${r.jurusita_nama}\nDurasi : ${r.durasi}\nNilai : ${r.nilai}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

//WAKTU MINUTASI
const getDataMinutasiBerkasPerkara = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT DISTINCT
    a.nomor_perkara,
    a.jenis_perkara_nama,
    REPLACE(n.majelis_hakim_text, '</br>', ' | ') AS majelis_hakim_text,
    c.panitera_nama,
    m.jurusita_nama,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    CASE 
        WHEN DATEDIFF(d.tanggal_minutasi, d.tanggal_putusan) = 0 
        THEN 'Hari ini' 
        ELSE CONCAT(DATEDIFF(d.tanggal_minutasi, d.tanggal_putusan), ' hari')
    END AS durasi,
    CASE
      WHEN DATEDIFF(d.tanggal_minutasi, d.tanggal_putusan) <= 1 THEN 5 
      WHEN DATEDIFF(d.tanggal_minutasi, d.tanggal_putusan) BETWEEN 2 AND 5 THEN 3 
      WHEN DATEDIFF(d.tanggal_minutasi, d.tanggal_putusan) BETWEEN 6 AND 9 THEN 2 
      WHEN DATEDIFF(d.tanggal_minutasi, d.tanggal_putusan) BETWEEN 10 AND 14 THEN 1
      ELSE 0
    END AS nilai
  FROM perkara a
  LEFT JOIN perkara_panitera_pn AS c ON a.perkara_id = c.perkara_id
  LEFT JOIN perkara_putusan AS d ON a.perkara_id = d.perkara_id
  LEFT JOIN perkara_hakim_pn AS f ON a.perkara_id = f.perkara_id
  LEFT JOIN perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
  LEFT JOIN perkara_jurusita AS m ON a.perkara_id = m.perkara_id
  LEFT JOIN perkara_penetapan AS n ON a.perkara_id = n.perkara_id
  WHERE YEAR(d.tanggal_putusan) = YEAR(CURDATE()) 
    AND c.aktif = 'Y' 
    AND f.aktif = 'Y' 
    AND m.aktif = 'Y'
  ORDER BY nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`;

  //PERKARA DIBAWAH NILAI 5 YANG TELAH DI FILTER
  let queryFilter = `SELECT DISTINCT
    a.nomor_perkara,
    a.jenis_perkara_nama,
    REPLACE(n.majelis_hakim_text, '</br>', ' | ') AS majelis_hakim_text,
    c.panitera_nama,
    m.jurusita_nama,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    CASE 
        WHEN DATEDIFF(d.tanggal_minutasi, d.tanggal_putusan) = 0 
        THEN 'Hari ini' 
        ELSE CONCAT(DATEDIFF(d.tanggal_minutasi, d.tanggal_putusan), ' hari')
    END AS durasi,
    CASE
      WHEN DATEDIFF(d.tanggal_minutasi, d.tanggal_putusan) <= 1 THEN 5 
      WHEN DATEDIFF(d.tanggal_minutasi, d.tanggal_putusan) BETWEEN 2 AND 5 THEN 3 
      WHEN DATEDIFF(d.tanggal_minutasi, d.tanggal_putusan) BETWEEN 6 AND 9 THEN 2 
      WHEN DATEDIFF(d.tanggal_minutasi, d.tanggal_putusan) BETWEEN 10 AND 14 THEN 1
      ELSE 0
    END AS nilai
  FROM perkara a
  LEFT JOIN perkara_panitera_pn AS c ON a.perkara_id = c.perkara_id
  LEFT JOIN perkara_putusan AS d ON a.perkara_id = d.perkara_id
  LEFT JOIN perkara_hakim_pn AS f ON a.perkara_id = f.perkara_id
  LEFT JOIN perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
  LEFT JOIN perkara_jurusita AS m ON a.perkara_id = m.perkara_id
  LEFT JOIN perkara_penetapan AS n ON a.perkara_id = n.perkara_id
  WHERE YEAR(d.tanggal_putusan) = YEAR(CURDATE()) 
    AND c.aktif = 'Y' 
    AND f.aktif = 'Y' 
    AND m.aktif = 'Y'
    AND CASE
          WHEN DATEDIFF(d.tanggal_minutasi, d.tanggal_putusan) <= 1 THEN 5 
          WHEN DATEDIFF(d.tanggal_minutasi, d.tanggal_putusan) BETWEEN 2 AND 5 THEN 3 
          WHEN DATEDIFF(d.tanggal_minutasi, d.tanggal_putusan) BETWEEN 6 AND 9 THEN 2 
          WHEN DATEDIFF(d.tanggal_minutasi, d.tanggal_putusan) BETWEEN 10 AND 14 THEN 1
          ELSE 0
        END != 5
  ORDER BY nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`

    db.query(queryFilter, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama} ${r.ecourt} ${r.ghaib}\nMajelis Hakim :${r.majelis_hakim_text}\nPP : ${r.panitera_nama}\nJurusita : ${r.jurusita_nama}\nDurasi : ${r.durasi}\nNilai : ${r.nilai}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

//WAKTU UPLOAD
const getDataUploadPublikasiPutusan = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT DISTINCT
    a.nomor_perkara,
    a.jenis_perkara_nama,
    REPLACE(n.majelis_hakim_text, '</br>', ' | ') AS majelis_hakim_text,
    c.panitera_nama,
    m.jurusita_nama,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    r.link_dirput,
    CASE 
        WHEN DATEDIFF(r.updated_date, d.tanggal_putusan) = 0 
        THEN 'Hari ini' 
        ELSE CONCAT(DATEDIFF(r.updated_date, d.tanggal_putusan), ' hari')
    END AS durasi,
    CASE
      WHEN DATEDIFF(r.updated_date, d.tanggal_putusan) <= 1 THEN 5
      WHEN DATEDIFF(r.updated_date, d.tanggal_putusan) BETWEEN 2 AND 5 THEN 3
      WHEN DATEDIFF(r.updated_date, d.tanggal_putusan) BETWEEN 6 AND 9 THEN 2
      WHEN DATEDIFF(r.updated_date, d.tanggal_putusan) BETWEEN 10 AND 14 THEN 1
      ELSE 0
    END AS nilai
  FROM perkara a
  LEFT JOIN perkara_panitera_pn AS c ON a.perkara_id = c.perkara_id
  LEFT JOIN perkara_putusan AS d ON a.perkara_id = d.perkara_id
  LEFT JOIN perkara_hakim_pn AS f ON a.perkara_id = f.perkara_id
  LEFT JOIN perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
  LEFT JOIN perkara_jurusita AS m ON a.perkara_id = m.perkara_id
  LEFT JOIN perkara_penetapan AS n ON a.perkara_id = n.perkara_id
  LEFT JOIN dirput_dokumen AS r ON a.perkara_id = r.perkara_id
  WHERE YEAR(d.tanggal_putusan) = YEAR(CURDATE()) 
    AND c.aktif = 'Y' 
    AND f.aktif = 'Y' 
    AND m.aktif = 'Y'
  ORDER BY nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`;

  //PERKARA DIBAWAH NILAI 5 YANG TELAH DI FILTER queryFilter
    let queryFilter = `SELECT DISTINCT
    a.nomor_perkara,
    a.jenis_perkara_nama,
    REPLACE(n.majelis_hakim_text, '</br>', ' | ') AS majelis_hakim_text,
    c.panitera_nama,
    m.jurusita_nama,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    r.link_dirput,
    CASE 
        WHEN DATEDIFF(r.updated_date, d.tanggal_putusan) = 0 
        THEN 'Hari ini' 
        ELSE CONCAT(DATEDIFF(r.updated_date, d.tanggal_putusan), ' hari')
    END AS durasi,
    CASE
      WHEN DATEDIFF(r.updated_date, d.tanggal_putusan) <= 1 THEN 5
      WHEN DATEDIFF(r.updated_date, d.tanggal_putusan) BETWEEN 2 AND 5 THEN 3
      WHEN DATEDIFF(r.updated_date, d.tanggal_putusan) BETWEEN 6 AND 9 THEN 2
      WHEN DATEDIFF(r.updated_date, d.tanggal_putusan) BETWEEN 10 AND 14 THEN 1
      ELSE 0
    END AS nilai
  FROM perkara a
  LEFT JOIN perkara_panitera_pn AS c ON a.perkara_id = c.perkara_id
  LEFT JOIN perkara_putusan AS d ON a.perkara_id = d.perkara_id
  LEFT JOIN perkara_hakim_pn AS f ON a.perkara_id = f.perkara_id
  LEFT JOIN perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
  LEFT JOIN perkara_jurusita AS m ON a.perkara_id = m.perkara_id
  LEFT JOIN perkara_penetapan AS n ON a.perkara_id = n.perkara_id
  LEFT JOIN dirput_dokumen AS r ON a.perkara_id = r.perkara_id
  WHERE YEAR(d.tanggal_putusan) = YEAR(CURDATE()) 
    AND c.aktif = 'Y' 
    AND f.aktif = 'Y' 
    AND m.aktif = 'Y'
		AND CASE
          WHEN DATEDIFF(r.updated_date, d.tanggal_putusan) <= 1 THEN 5
					WHEN DATEDIFF(r.updated_date, d.tanggal_putusan) BETWEEN 2 AND 5 THEN 3
					WHEN DATEDIFF(r.updated_date, d.tanggal_putusan) BETWEEN 6 AND 9 THEN 2
					WHEN DATEDIFF(r.updated_date, d.tanggal_putusan) BETWEEN 10 AND 14 THEN 1
          ELSE 0
        END != 5
  ORDER BY nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`
    db.query(queryFilter, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama} ${r.ecourt} ${r.ghaib}\nMajelis Hakim :${r.majelis_hakim_text}\nPP : ${r.panitera_nama}\nJurusita : ${r.jurusita_nama}\nDurasi : ${r.durasi}\nNilai : ${r.nilai}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};


//KEPATUHAN
// I. INPUT DATA SIPP
//PENDAFTARAN PERKARA
const getDataPendaftaranPerkara = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT DISTINCT
    a.nomor_perkara,
    a.jenis_perkara_nama,
    q.diinput_oleh,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    CASE 
        WHEN DATEDIFF(q.diinput_tanggal, q.tanggal) = 0 
        THEN 'Hari ini' 
        ELSE CONCAT(DATEDIFF(q.diinput_tanggal, q.tanggal), ' hari')
    END AS durasi,
    CASE
      WHEN DATEDIFF(q.diinput_tanggal, q.tanggal) = 0 THEN 5
      WHEN DATEDIFF(q.diinput_tanggal, q.tanggal) = 1 THEN 3
      WHEN DATEDIFF(q.diinput_tanggal, q.tanggal) = 2 THEN 2
      WHEN DATEDIFF(q.diinput_tanggal, q.tanggal) = 3 THEN 1
      ELSE 0
    END AS nilai
  FROM perkara a
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_panitera_pn
      GROUP BY perkara_id
  ) AS c ON a.perkara_id = c.perkara_id
  LEFT JOIN perkara_putusan AS d ON a.perkara_id = d.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_penetapan_hari_sidang
      GROUP BY perkara_id
  ) AS t ON a.perkara_id = t.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_hakim_pn
      GROUP BY perkara_id
  ) AS f ON a.perkara_id = f.perkara_id
  LEFT JOIN perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_jurusita
      GROUP BY perkara_id
  ) AS m ON a.perkara_id = m.perkara_id
  LEFT JOIN perkara_penetapan AS n ON a.perkara_id = n.perkara_id
  LEFT JOIN dirput_dokumen AS r ON a.perkara_id = r.perkara_id
  LEFT JOIN perkara_proses AS q ON a.perkara_id = q.perkara_id
  WHERE YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE()) 
    AND q.tahapan_id = 10
    AND q.proses_id = 10
    AND DATEDIFF(q.diinput_tanggal, a.tanggal_pendaftaran) >= 0 
  ORDER BY nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`;

    //PERKARA DIBAWAH NILAI 5 YANG TELAH DI FILTER
    let queryFilter = `SELECT DISTINCT
    a.nomor_perkara,
    a.jenis_perkara_nama,
    q.diinput_oleh,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    CASE 
        WHEN DATEDIFF(q.diinput_tanggal, q.tanggal) = 0 
        THEN 'Hari ini' 
        ELSE CONCAT(DATEDIFF(q.diinput_tanggal, q.tanggal), ' hari')
    END AS durasi,
    CASE
      WHEN DATEDIFF(q.diinput_tanggal, q.tanggal) = 0 THEN 5
      WHEN DATEDIFF(q.diinput_tanggal, q.tanggal) = 1 THEN 3
      WHEN DATEDIFF(q.diinput_tanggal, q.tanggal) = 2 THEN 2
      WHEN DATEDIFF(q.diinput_tanggal, q.tanggal) = 3 THEN 1
      ELSE 0
    END AS nilai
  FROM perkara a
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_panitera_pn
      GROUP BY perkara_id
  ) AS c ON a.perkara_id = c.perkara_id
  LEFT JOIN perkara_putusan AS d ON a.perkara_id = d.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_penetapan_hari_sidang
      GROUP BY perkara_id
  ) AS t ON a.perkara_id = t.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_hakim_pn
      GROUP BY perkara_id
  ) AS f ON a.perkara_id = f.perkara_id
  LEFT JOIN perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_jurusita
      GROUP BY perkara_id
  ) AS m ON a.perkara_id = m.perkara_id
  LEFT JOIN perkara_penetapan AS n ON a.perkara_id = n.perkara_id
  LEFT JOIN dirput_dokumen AS r ON a.perkara_id = r.perkara_id
  LEFT JOIN perkara_proses AS q ON a.perkara_id = q.perkara_id
  WHERE YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE()) 
    AND q.tahapan_id = 10
    AND q.proses_id = 10
    AND DATEDIFF(q.diinput_tanggal, a.tanggal_pendaftaran) >= 0 
    AND (
        CASE
          WHEN DATEDIFF(q.diinput_tanggal, q.tanggal) = 0 THEN 5
          WHEN DATEDIFF(q.diinput_tanggal, q.tanggal) = 1 THEN 3
          WHEN DATEDIFF(q.diinput_tanggal, q.tanggal) = 2 THEN 2
          WHEN DATEDIFF(q.diinput_tanggal, q.tanggal) = 3 THEN 1
          ELSE 0
        END
    ) <> 5
  ORDER BY nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`

    db.query(queryFilter, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama} ${r.ecourt} ${r.ghaib}\nDiinput oleh : ${r.diinput_oleh}\nDurasi : ${r.durasi}\nNilai : ${r.nilai}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

//PENETAPAN MAJELIS HAKIM (PMH)
const getDataPenetapanMajelisHakim = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT DISTINCT
    a.nomor_perkara,
    a.jenis_perkara_nama,
    q.diinput_oleh,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    CASE 
        WHEN DATEDIFF(f.tanggal_penetapan, a.tanggal_pendaftaran) = 0 
        THEN 'Hari ini' 
        ELSE CONCAT(DATEDIFF(f.tanggal_penetapan, a.tanggal_pendaftaran), ' hari')
    END AS durasi,
    CASE
      WHEN DATEDIFF(f.tanggal_penetapan, a.tanggal_pendaftaran) = 0 THEN 5
      WHEN DATEDIFF(f.tanggal_penetapan, a.tanggal_pendaftaran) = 1 THEN 3
      WHEN DATEDIFF(f.tanggal_penetapan, a.tanggal_pendaftaran) = 2 THEN 2
      WHEN DATEDIFF(f.tanggal_penetapan, a.tanggal_pendaftaran) = 3 THEN 1
      ELSE 0
    END AS nilai
  FROM perkara a
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_panitera_pn
      GROUP BY perkara_id
  ) AS c ON a.perkara_id = c.perkara_id
  LEFT JOIN perkara_putusan AS d ON a.perkara_id = d.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_penetapan_hari_sidang
      GROUP BY perkara_id
  ) AS t ON a.perkara_id = t.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_hakim_pn
      GROUP BY perkara_id
  ) AS f ON a.perkara_id = f.perkara_id
  LEFT JOIN perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_jurusita
      GROUP BY perkara_id
  ) AS m ON a.perkara_id = m.perkara_id
  LEFT JOIN perkara_penetapan AS n ON a.perkara_id = n.perkara_id
  LEFT JOIN dirput_dokumen AS r ON a.perkara_id = r.perkara_id
  LEFT JOIN perkara_proses AS q ON a.perkara_id = q.perkara_id
  WHERE YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE()) 
    AND q.tahapan_id = 12
		AND q.proses_id = 20
    AND DATEDIFF(f.tanggal_penetapan, a.tanggal_pendaftaran) >= 0
  ORDER BY nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`;

    //PERKARA DIBAWAH NILAI 5 YANG TELAH DI FILTER
    let queryFilter = `SELECT DISTINCT
    a.nomor_perkara,
    a.jenis_perkara_nama,
    q.diinput_oleh,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    CASE 
        WHEN DATEDIFF(f.tanggal_penetapan, a.tanggal_pendaftaran) = 0 
        THEN 'Hari ini' 
        ELSE CONCAT(DATEDIFF(f.tanggal_penetapan, a.tanggal_pendaftaran), ' hari')
    END AS durasi,
    CASE
      WHEN DATEDIFF(f.tanggal_penetapan, a.tanggal_pendaftaran) = 0 THEN 5
      WHEN DATEDIFF(f.tanggal_penetapan, a.tanggal_pendaftaran) = 1 THEN 3
      WHEN DATEDIFF(f.tanggal_penetapan, a.tanggal_pendaftaran) = 2 THEN 2
      WHEN DATEDIFF(f.tanggal_penetapan, a.tanggal_pendaftaran) = 3 THEN 1
      ELSE 0
    END AS nilai
  FROM perkara a
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_panitera_pn
      GROUP BY perkara_id
  ) AS c ON a.perkara_id = c.perkara_id
  LEFT JOIN perkara_putusan AS d ON a.perkara_id = d.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_penetapan_hari_sidang
      GROUP BY perkara_id
  ) AS t ON a.perkara_id = t.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_hakim_pn
      GROUP BY perkara_id
  ) AS f ON a.perkara_id = f.perkara_id
  LEFT JOIN perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_jurusita
      GROUP BY perkara_id
  ) AS m ON a.perkara_id = m.perkara_id
  LEFT JOIN perkara_penetapan AS n ON a.perkara_id = n.perkara_id
  LEFT JOIN dirput_dokumen AS r ON a.perkara_id = r.perkara_id
  LEFT JOIN perkara_proses AS q ON a.perkara_id = q.perkara_id
  WHERE YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE()) 
    AND q.tahapan_id = 12
		AND q.proses_id = 20
    AND DATEDIFF(f.tanggal_penetapan, a.tanggal_pendaftaran) >= 0
		AND (
      CASE
        WHEN DATEDIFF(f.tanggal_penetapan, a.tanggal_pendaftaran) = 0 THEN 5
				WHEN DATEDIFF(f.tanggal_penetapan, a.tanggal_pendaftaran) = 1 THEN 3
				WHEN DATEDIFF(f.tanggal_penetapan, a.tanggal_pendaftaran) = 2 THEN 2
				WHEN DATEDIFF(f.tanggal_penetapan, a.tanggal_pendaftaran) = 3 THEN 1
        ELSE 0
      END
		) <> 5
  ORDER BY nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`

    db.query(queryFilter, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama} ${r.ecourt} ${r.ghaib}\nDiinput oleh : ${r.diinput_oleh}\nDurasi : ${r.durasi}\nNilai : ${r.nilai}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

//PENGIMPUTAN PENETAPAN MAJELIS HAKIM (PMH)
const getDataPengimputanPenetapanMajelisHakim = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT DISTINCT
    a.nomor_perkara,
    a.jenis_perkara_nama,
    q.diinput_oleh,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    CASE 
        WHEN DATEDIFF(q.diinput_tanggal, f.tanggal_penetapan) = 0 
        THEN 'Hari ini' 
        ELSE CONCAT(DATEDIFF(q.diinput_tanggal, f.tanggal_penetapan), ' hari')
    END AS durasi,
    CASE
      WHEN DATEDIFF(q.diinput_tanggal, f.tanggal_penetapan) = 0 THEN 5
      WHEN DATEDIFF(q.diinput_tanggal, f.tanggal_penetapan) = 1 THEN 3
      WHEN DATEDIFF(q.diinput_tanggal, f.tanggal_penetapan) = 2 THEN 2
      WHEN DATEDIFF(q.diinput_tanggal, f.tanggal_penetapan) = 3 THEN 1
      ELSE 0
    END AS nilai
  FROM perkara a
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_panitera_pn
      GROUP BY perkara_id
  ) AS c ON a.perkara_id = c.perkara_id
  LEFT JOIN perkara_putusan AS d ON a.perkara_id = d.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_penetapan_hari_sidang
      GROUP BY perkara_id
  ) AS t ON a.perkara_id = t.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_hakim_pn
      GROUP BY perkara_id
  ) AS f ON a.perkara_id = f.perkara_id
  LEFT JOIN perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_jurusita
      GROUP BY perkara_id
  ) AS m ON a.perkara_id = m.perkara_id
  LEFT JOIN perkara_penetapan AS n ON a.perkara_id = n.perkara_id
  LEFT JOIN dirput_dokumen AS r ON a.perkara_id = r.perkara_id
  LEFT JOIN perkara_proses AS q ON a.perkara_id = q.perkara_id
  WHERE YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE()) 
    AND q.tahapan_id = 12
		AND q.proses_id = 20
    AND DATEDIFF(q.diinput_tanggal, f.tanggal_penetapan) >= 0
  ORDER BY nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`;

  //PERKARA DIBAWAH NILAI 5 YANG TELAH DI FILTER
  let queryFilter = `SELECT DISTINCT
    a.nomor_perkara,
    a.jenis_perkara_nama,
    q.diinput_oleh,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    CASE 
        WHEN DATEDIFF(q.diinput_tanggal, f.tanggal_penetapan) = 0 
        THEN 'Hari ini' 
        ELSE CONCAT(DATEDIFF(q.diinput_tanggal, f.tanggal_penetapan), ' hari')
    END AS durasi,
    CASE
      WHEN DATEDIFF(q.diinput_tanggal, f.tanggal_penetapan) = 0 THEN 5
      WHEN DATEDIFF(q.diinput_tanggal, f.tanggal_penetapan) = 1 THEN 3
      WHEN DATEDIFF(q.diinput_tanggal, f.tanggal_penetapan) = 2 THEN 2
      WHEN DATEDIFF(q.diinput_tanggal, f.tanggal_penetapan) = 3 THEN 1
      ELSE 0
    END AS nilai
  FROM perkara a
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_panitera_pn
      GROUP BY perkara_id
  ) AS c ON a.perkara_id = c.perkara_id
  LEFT JOIN perkara_putusan AS d ON a.perkara_id = d.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_penetapan_hari_sidang
      GROUP BY perkara_id
  ) AS t ON a.perkara_id = t.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_hakim_pn
      GROUP BY perkara_id
  ) AS f ON a.perkara_id = f.perkara_id
  LEFT JOIN perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_jurusita
      GROUP BY perkara_id
  ) AS m ON a.perkara_id = m.perkara_id
  LEFT JOIN perkara_penetapan AS n ON a.perkara_id = n.perkara_id
  LEFT JOIN dirput_dokumen AS r ON a.perkara_id = r.perkara_id
  LEFT JOIN perkara_proses AS q ON a.perkara_id = q.perkara_id
  WHERE YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE()) 
    AND q.tahapan_id = 12
		AND q.proses_id = 20
    AND DATEDIFF(q.diinput_tanggal, f.tanggal_penetapan) >= 0
		AND (
			CASE
				WHEN DATEDIFF(q.diinput_tanggal, f.tanggal_penetapan) = 0 THEN 5
				WHEN DATEDIFF(q.diinput_tanggal, f.tanggal_penetapan) = 1 THEN 3
				WHEN DATEDIFF(q.diinput_tanggal, f.tanggal_penetapan) = 2 THEN 2
				WHEN DATEDIFF(q.diinput_tanggal, f.tanggal_penetapan) = 3 THEN 1
				ELSE 0
      END
		) <> 5
  ORDER BY nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`

    db.query(queryFilter, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama} ${r.ecourt} ${r.ghaib}\nDiinput oleh : ${r.diinput_oleh}\nDurasi : ${r.durasi}\nNilai : ${r.nilai}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

//PENUNJUKKAN PP
const getDataPenunjukkanPp = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT DISTINCT
    a.nomor_perkara,
    a.jenis_perkara_nama,
    q.diinput_oleh,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    CASE 
        WHEN DATEDIFF(c.tanggal_penetapan, f.tanggal_penetapan) = 0 
        THEN 'Hari ini' 
        ELSE CONCAT(DATEDIFF(c.tanggal_penetapan, f.tanggal_penetapan), ' hari')
    END AS durasi,
    CASE
      WHEN DATEDIFF(c.tanggal_penetapan, f.tanggal_penetapan) = 0 THEN 5
      WHEN DATEDIFF(c.tanggal_penetapan, f.tanggal_penetapan) = 1 THEN 3
      WHEN DATEDIFF(c.tanggal_penetapan, f.tanggal_penetapan) = 2 THEN 2
      WHEN DATEDIFF(c.tanggal_penetapan, f.tanggal_penetapan) = 3 THEN 1
      ELSE 0
    END AS nilai
  FROM perkara a
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_panitera_pn
      GROUP BY perkara_id
  ) AS c ON a.perkara_id = c.perkara_id
  LEFT JOIN perkara_putusan AS d ON a.perkara_id = d.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_penetapan_hari_sidang
      GROUP BY perkara_id
  ) AS t ON a.perkara_id = t.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_hakim_pn
      GROUP BY perkara_id
  ) AS f ON a.perkara_id = f.perkara_id
  LEFT JOIN perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_jurusita
      GROUP BY perkara_id
  ) AS m ON a.perkara_id = m.perkara_id
  LEFT JOIN perkara_penetapan AS n ON a.perkara_id = n.perkara_id
  LEFT JOIN dirput_dokumen AS r ON a.perkara_id = r.perkara_id
  LEFT JOIN perkara_proses AS q ON a.perkara_id = q.perkara_id
  WHERE YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE()) 
    AND q.tahapan_id = 12
		AND q.proses_id = 30
    AND DATEDIFF(c.tanggal_penetapan, f.tanggal_penetapan) >= 0
  ORDER BY nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`;

    //PERKARA DIBAWAH NILAI 5 YANG TELAH DI FILTER
    let queryFilter = `SELECT DISTINCT
    a.nomor_perkara,
    a.jenis_perkara_nama,
    q.diinput_oleh,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    CASE 
        WHEN DATEDIFF(c.tanggal_penetapan, f.tanggal_penetapan) = 0 
        THEN 'Hari ini' 
        ELSE CONCAT(DATEDIFF(c.tanggal_penetapan, f.tanggal_penetapan), ' hari')
    END AS durasi,
    CASE
      WHEN DATEDIFF(c.tanggal_penetapan, f.tanggal_penetapan) = 0 THEN 5
      WHEN DATEDIFF(c.tanggal_penetapan, f.tanggal_penetapan) = 1 THEN 3
      WHEN DATEDIFF(c.tanggal_penetapan, f.tanggal_penetapan) = 2 THEN 2
      WHEN DATEDIFF(c.tanggal_penetapan, f.tanggal_penetapan) = 3 THEN 1
      ELSE 0
    END AS nilai
  FROM perkara a
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_panitera_pn
      GROUP BY perkara_id
  ) AS c ON a.perkara_id = c.perkara_id
  LEFT JOIN perkara_putusan AS d ON a.perkara_id = d.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_penetapan_hari_sidang
      GROUP BY perkara_id
  ) AS t ON a.perkara_id = t.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_hakim_pn
      GROUP BY perkara_id
  ) AS f ON a.perkara_id = f.perkara_id
  LEFT JOIN perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_jurusita
      GROUP BY perkara_id
  ) AS m ON a.perkara_id = m.perkara_id
  LEFT JOIN perkara_penetapan AS n ON a.perkara_id = n.perkara_id
  LEFT JOIN dirput_dokumen AS r ON a.perkara_id = r.perkara_id
  LEFT JOIN perkara_proses AS q ON a.perkara_id = q.perkara_id
  WHERE YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE()) 
    AND q.tahapan_id = 12
    AND q.proses_id = 30
    AND DATEDIFF(c.tanggal_penetapan, f.tanggal_penetapan) >= 0
    AND (
        CASE
          WHEN DATEDIFF(c.tanggal_penetapan, f.tanggal_penetapan) = 0 THEN 5
          WHEN DATEDIFF(c.tanggal_penetapan, f.tanggal_penetapan) = 1 THEN 3
          WHEN DATEDIFF(c.tanggal_penetapan, f.tanggal_penetapan) = 2 THEN 2
          WHEN DATEDIFF(c.tanggal_penetapan, f.tanggal_penetapan) = 3 THEN 1
          ELSE 0
        END
    ) <> 5
  ORDER BY nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`

    db.query(queryFilter, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama} ${r.ecourt} ${r.ghaib}\nDiinput oleh : ${r.diinput_oleh}\nDurasi : ${r.durasi}\nNilai : ${r.nilai}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

//PENGIMPUTAN PENETAPAN PANITERA PENGGANTI/PP (PPP)
const getDataPengimputanPenunjukkanPp = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT DISTINCT
    a.nomor_perkara,
    a.jenis_perkara_nama,
    q.diinput_oleh,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    CASE 
        WHEN DATEDIFF(q.diinput_tanggal, c.tanggal_penetapan) = 0 
        THEN 'Hari ini' 
        ELSE CONCAT(DATEDIFF(q.diinput_tanggal, c.tanggal_penetapan), ' hari')
    END AS durasi,
    CASE
      WHEN DATEDIFF(q.diinput_tanggal, c.tanggal_penetapan) = 0 THEN 5
      WHEN DATEDIFF(q.diinput_tanggal, c.tanggal_penetapan) = 1 THEN 3
      WHEN DATEDIFF(q.diinput_tanggal, c.tanggal_penetapan) = 2 THEN 2
      WHEN DATEDIFF(q.diinput_tanggal, c.tanggal_penetapan) = 3 THEN 1
      ELSE 0
    END AS nilai
  FROM perkara a
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_panitera_pn
      GROUP BY perkara_id
  ) AS c ON a.perkara_id = c.perkara_id
  LEFT JOIN perkara_putusan AS d ON a.perkara_id = d.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_penetapan_hari_sidang
      GROUP BY perkara_id
  ) AS t ON a.perkara_id = t.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_hakim_pn
      GROUP BY perkara_id
  ) AS f ON a.perkara_id = f.perkara_id
  LEFT JOIN perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_jurusita
      GROUP BY perkara_id
  ) AS m ON a.perkara_id = m.perkara_id
  LEFT JOIN perkara_penetapan AS n ON a.perkara_id = n.perkara_id
  LEFT JOIN dirput_dokumen AS r ON a.perkara_id = r.perkara_id
  LEFT JOIN perkara_proses AS q ON a.perkara_id = q.perkara_id
  WHERE YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE()) 
    AND q.tahapan_id = 12
		AND q.proses_id = 30
    AND DATEDIFF(q.diinput_tanggal, c.tanggal_penetapan) >= 0
  ORDER BY nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`;

    //PERKARA DIBAWAH NILAI 5 YANG TELAH DI FILTER
    let queryFilter = `SELECT DISTINCT
    a.nomor_perkara,
    a.jenis_perkara_nama,
    q.diinput_oleh,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    CASE 
        WHEN DATEDIFF(q.diinput_tanggal, c.tanggal_penetapan) = 0 
        THEN 'Hari ini' 
        ELSE CONCAT(DATEDIFF(q.diinput_tanggal, c.tanggal_penetapan), ' hari')
    END AS durasi,
    CASE
      WHEN DATEDIFF(q.diinput_tanggal, c.tanggal_penetapan) = 0 THEN 5
      WHEN DATEDIFF(q.diinput_tanggal, c.tanggal_penetapan) = 1 THEN 3
      WHEN DATEDIFF(q.diinput_tanggal, c.tanggal_penetapan) = 2 THEN 2
      WHEN DATEDIFF(q.diinput_tanggal, c.tanggal_penetapan) = 3 THEN 1
      ELSE 0
    END AS nilai
  FROM perkara a
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_panitera_pn
      GROUP BY perkara_id
  ) AS c ON a.perkara_id = c.perkara_id
  LEFT JOIN perkara_putusan AS d ON a.perkara_id = d.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_penetapan_hari_sidang
      GROUP BY perkara_id
  ) AS t ON a.perkara_id = t.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_hakim_pn
      GROUP BY perkara_id
  ) AS f ON a.perkara_id = f.perkara_id
  LEFT JOIN perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_jurusita
      GROUP BY perkara_id
  ) AS m ON a.perkara_id = m.perkara_id
  LEFT JOIN perkara_penetapan AS n ON a.perkara_id = n.perkara_id
  LEFT JOIN dirput_dokumen AS r ON a.perkara_id = r.perkara_id
  LEFT JOIN perkara_proses AS q ON a.perkara_id = q.perkara_id
  WHERE YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE()) 
    AND q.tahapan_id = 12
    AND q.proses_id = 30
    AND DATEDIFF(q.diinput_tanggal, c.tanggal_penetapan) >= 0
    AND (
        CASE
          WHEN DATEDIFF(q.diinput_tanggal, c.tanggal_penetapan) = 0 THEN 5
          WHEN DATEDIFF(q.diinput_tanggal, c.tanggal_penetapan) = 1 THEN 3
          WHEN DATEDIFF(q.diinput_tanggal, c.tanggal_penetapan) = 2 THEN 2
          WHEN DATEDIFF(q.diinput_tanggal, c.tanggal_penetapan) = 3 THEN 1
          ELSE 0
        END
    ) <> 5
  ORDER BY nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`

    db.query(queryFilter, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama} ${r.ecourt} ${r.ghaib}\nDiinput oleh : ${r.diinput_oleh}\nDurasi : ${r.durasi}\nNilai : ${r.nilai}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

//PENUNJUKKAN JURUSITA
const getDataPenunjukkanJurusita = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT DISTINCT
    a.nomor_perkara,
    a.jenis_perkara_nama,
    q.diinput_oleh,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    CASE 
        WHEN DATEDIFF(m.tanggal_penetapan, f.tanggal_penetapan) = 0 
        THEN 'Hari ini' 
        ELSE CONCAT(DATEDIFF(m.tanggal_penetapan, f.tanggal_penetapan), ' hari')
    END AS durasi,
    CASE
      WHEN DATEDIFF(m.tanggal_penetapan, f.tanggal_penetapan) = 0 THEN 5
      WHEN DATEDIFF(m.tanggal_penetapan, f.tanggal_penetapan) = 1 THEN 3
      WHEN DATEDIFF(m.tanggal_penetapan, f.tanggal_penetapan) = 2 THEN 2
      WHEN DATEDIFF(m.tanggal_penetapan, f.tanggal_penetapan) = 3 THEN 1
      ELSE 0
    END AS nilai
  FROM perkara a
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_panitera_pn
      GROUP BY perkara_id
  ) AS c ON a.perkara_id = c.perkara_id
  LEFT JOIN perkara_putusan AS d ON a.perkara_id = d.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_penetapan_hari_sidang
      GROUP BY perkara_id
  ) AS t ON a.perkara_id = t.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_hakim_pn
      GROUP BY perkara_id
  ) AS f ON a.perkara_id = f.perkara_id
  LEFT JOIN perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_jurusita
      GROUP BY perkara_id
  ) AS m ON a.perkara_id = m.perkara_id
  LEFT JOIN perkara_penetapan AS n ON a.perkara_id = n.perkara_id
  LEFT JOIN dirput_dokumen AS r ON a.perkara_id = r.perkara_id
  LEFT JOIN perkara_proses AS q ON a.perkara_id = q.perkara_id
  WHERE YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE()) 
    AND q.tahapan_id = 12
		AND q.proses_id = 40
    AND DATEDIFF(m.tanggal_penetapan, f.tanggal_penetapan) >= 0
  ORDER BY nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`;

    //PERKARA DIBAWAH NILAI 5 YANG TELAH DI FILTER
    let queryFilter = `SELECT DISTINCT
    a.nomor_perkara,
    a.jenis_perkara_nama,
    q.diinput_oleh,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    CASE 
        WHEN DATEDIFF(m.tanggal_penetapan, f.tanggal_penetapan) = 0 
        THEN 'Hari ini' 
        ELSE CONCAT(DATEDIFF(m.tanggal_penetapan, f.tanggal_penetapan), ' hari')
    END AS durasi,
    CASE
      WHEN DATEDIFF(m.tanggal_penetapan, f.tanggal_penetapan) = 0 THEN 5
      WHEN DATEDIFF(m.tanggal_penetapan, f.tanggal_penetapan) = 1 THEN 3
      WHEN DATEDIFF(m.tanggal_penetapan, f.tanggal_penetapan) = 2 THEN 2
      WHEN DATEDIFF(m.tanggal_penetapan, f.tanggal_penetapan) = 3 THEN 1
      ELSE 0
    END AS nilai
  FROM perkara a
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_panitera_pn
      GROUP BY perkara_id
  ) AS c ON a.perkara_id = c.perkara_id
  LEFT JOIN perkara_putusan AS d ON a.perkara_id = d.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_penetapan_hari_sidang
      GROUP BY perkara_id
  ) AS t ON a.perkara_id = t.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_hakim_pn
      GROUP BY perkara_id
  ) AS f ON a.perkara_id = f.perkara_id
  LEFT JOIN perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_jurusita
      GROUP BY perkara_id
  ) AS m ON a.perkara_id = m.perkara_id
  LEFT JOIN perkara_penetapan AS n ON a.perkara_id = n.perkara_id
  LEFT JOIN dirput_dokumen AS r ON a.perkara_id = r.perkara_id
  LEFT JOIN perkara_proses AS q ON a.perkara_id = q.perkara_id
  WHERE YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE()) 
    AND q.tahapan_id = 12
    AND q.proses_id = 40
    AND DATEDIFF(m.tanggal_penetapan, f.tanggal_penetapan) >= 0
    AND (
        CASE
          WHEN DATEDIFF(m.tanggal_penetapan, f.tanggal_penetapan) = 0 THEN 5
          WHEN DATEDIFF(m.tanggal_penetapan, f.tanggal_penetapan) = 1 THEN 3
          WHEN DATEDIFF(m.tanggal_penetapan, f.tanggal_penetapan) = 2 THEN 2
          WHEN DATEDIFF(m.tanggal_penetapan, f.tanggal_penetapan) = 3 THEN 1
          ELSE 0
        END
    ) <> 5
  ORDER BY nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`

    db.query(queryFilter, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama} ${r.ecourt} ${r.ghaib}\nDiinput oleh : ${r.diinput_oleh}\nDurasi : ${r.durasi}\nNilai : ${r.nilai}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

//PENGIMPUTAN PENETAPAN JURUSITA (PJS)
const getDataPengimputanPenunjukkanJurusita = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT DISTINCT
    a.nomor_perkara,
    a.jenis_perkara_nama,
    q.diinput_oleh,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    CASE 
        WHEN DATEDIFF(q.diinput_tanggal, m.tanggal_penetapan) = 0 
        THEN 'Hari ini' 
        ELSE CONCAT(DATEDIFF(q.diinput_tanggal, m.tanggal_penetapan), ' hari')
    END AS durasi,
    CASE
      WHEN DATEDIFF(q.diinput_tanggal, m.tanggal_penetapan) = 0 THEN 5
      WHEN DATEDIFF(q.diinput_tanggal, m.tanggal_penetapan) = 1 THEN 3
      WHEN DATEDIFF(q.diinput_tanggal, m.tanggal_penetapan) = 2 THEN 2
      WHEN DATEDIFF(q.diinput_tanggal, m.tanggal_penetapan) = 3 THEN 1
      ELSE 0
    END AS nilai
  FROM perkara a
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_panitera_pn
      GROUP BY perkara_id
  ) AS c ON a.perkara_id = c.perkara_id
  LEFT JOIN perkara_putusan AS d ON a.perkara_id = d.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_penetapan_hari_sidang
      GROUP BY perkara_id
  ) AS t ON a.perkara_id = t.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_hakim_pn
      GROUP BY perkara_id
  ) AS f ON a.perkara_id = f.perkara_id
  LEFT JOIN perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_jurusita
      GROUP BY perkara_id
  ) AS m ON a.perkara_id = m.perkara_id
  LEFT JOIN perkara_penetapan AS n ON a.perkara_id = n.perkara_id
  LEFT JOIN dirput_dokumen AS r ON a.perkara_id = r.perkara_id
  LEFT JOIN perkara_proses AS q ON a.perkara_id = q.perkara_id
  WHERE YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE()) 
    AND q.tahapan_id = 12
		AND q.proses_id = 40
    AND DATEDIFF(q.diinput_tanggal, m.tanggal_penetapan) >= 0
  ORDER BY nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`;

    //PERKARA DIBAWAH NILAI 5 YANG TELAH DI FILTER
    let queryFilter = `SELECT DISTINCT
    a.nomor_perkara,
    a.jenis_perkara_nama,
    q.diinput_oleh,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    CASE 
        WHEN DATEDIFF(q.diinput_tanggal, m.tanggal_penetapan) = 0 
        THEN 'Hari ini' 
        ELSE CONCAT(DATEDIFF(q.diinput_tanggal, m.tanggal_penetapan), ' hari')
    END AS durasi,
    CASE
      WHEN DATEDIFF(q.diinput_tanggal, m.tanggal_penetapan) = 0 THEN 5
      WHEN DATEDIFF(q.diinput_tanggal, m.tanggal_penetapan) = 1 THEN 3
      WHEN DATEDIFF(q.diinput_tanggal, m.tanggal_penetapan) = 2 THEN 2
      WHEN DATEDIFF(q.diinput_tanggal, m.tanggal_penetapan) = 3 THEN 1
      ELSE 0
    END AS nilai
  FROM perkara a
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_panitera_pn
      GROUP BY perkara_id
  ) AS c ON a.perkara_id = c.perkara_id
  LEFT JOIN perkara_putusan AS d ON a.perkara_id = d.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_penetapan_hari_sidang
      GROUP BY perkara_id
  ) AS t ON a.perkara_id = t.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_hakim_pn
      GROUP BY perkara_id
  ) AS f ON a.perkara_id = f.perkara_id
  LEFT JOIN perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_jurusita
      GROUP BY perkara_id
  ) AS m ON a.perkara_id = m.perkara_id
  LEFT JOIN perkara_penetapan AS n ON a.perkara_id = n.perkara_id
  LEFT JOIN dirput_dokumen AS r ON a.perkara_id = r.perkara_id
  LEFT JOIN perkara_proses AS q ON a.perkara_id = q.perkara_id
  WHERE YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE()) 
    AND q.tahapan_id = 12
    AND q.proses_id = 40
    AND DATEDIFF(q.diinput_tanggal, m.tanggal_penetapan) >= 0
    AND (
        CASE
          WHEN DATEDIFF(q.diinput_tanggal, m.tanggal_penetapan) = 0 THEN 5
          WHEN DATEDIFF(q.diinput_tanggal, m.tanggal_penetapan) = 1 THEN 3
          WHEN DATEDIFF(q.diinput_tanggal, m.tanggal_penetapan) = 2 THEN 2
          WHEN DATEDIFF(q.diinput_tanggal, m.tanggal_penetapan) = 3 THEN 1
          ELSE 0
        END
    ) <> 5
  ORDER BY nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`

    db.query(queryFilter, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama} ${r.ecourt} ${r.ghaib}\nDiinput oleh : ${r.diinput_oleh}\nDurasi : ${r.durasi}\nNilai : ${r.nilai}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

//PENUNJUKKAN PENETAPAN HARI SIDANG (PHS)
const getDataPenetapanHariSidang = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT DISTINCT
    a.nomor_perkara,
    a.jenis_perkara_nama,
    q.diinput_oleh,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    CASE 
        WHEN DATEDIFF(t.tanggal_penetapan, f.tanggal_penetapan) = 0 
        THEN 'Hari ini' 
        ELSE CONCAT(DATEDIFF(t.tanggal_penetapan, f.tanggal_penetapan), ' hari')
    END AS durasi,
    CASE
      WHEN DATEDIFF(t.tanggal_penetapan, f.tanggal_penetapan) = 0 THEN 5
      WHEN DATEDIFF(t.tanggal_penetapan, f.tanggal_penetapan) = 1 THEN 3
      WHEN DATEDIFF(t.tanggal_penetapan, f.tanggal_penetapan) = 2 THEN 2
      WHEN DATEDIFF(t.tanggal_penetapan, f.tanggal_penetapan) = 3 THEN 1
      ELSE 0
    END AS nilai
  FROM perkara a
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_panitera_pn
      GROUP BY perkara_id
  ) AS c ON a.perkara_id = c.perkara_id
  LEFT JOIN perkara_putusan AS d ON a.perkara_id = d.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_penetapan_hari_sidang
      GROUP BY perkara_id
  ) AS t ON a.perkara_id = t.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_hakim_pn
      GROUP BY perkara_id
  ) AS f ON a.perkara_id = f.perkara_id
  LEFT JOIN perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_jurusita
      GROUP BY perkara_id
  ) AS m ON a.perkara_id = m.perkara_id
  LEFT JOIN perkara_penetapan AS n ON a.perkara_id = n.perkara_id
  LEFT JOIN dirput_dokumen AS r ON a.perkara_id = r.perkara_id
  LEFT JOIN perkara_proses AS q ON a.perkara_id = q.perkara_id
  WHERE YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE()) 
    AND q.tahapan_id = 12
		AND q.proses_id = 80
    AND DATEDIFF(t.tanggal_penetapan, f.tanggal_penetapan) >= 0
  ORDER BY nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`;

    //PERKARA DIBAWAH NILAI 5 YANG TELAH DI FILTER
    let queryFilter = `SELECT DISTINCT
    a.nomor_perkara,
    a.jenis_perkara_nama,
    q.diinput_oleh,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    CASE 
        WHEN DATEDIFF(t.tanggal_penetapan, f.tanggal_penetapan) = 0 
        THEN 'Hari ini' 
        ELSE CONCAT(DATEDIFF(t.tanggal_penetapan, f.tanggal_penetapan), ' hari')
    END AS durasi,
    CASE
      WHEN DATEDIFF(t.tanggal_penetapan, f.tanggal_penetapan) = 0 THEN 5
      WHEN DATEDIFF(t.tanggal_penetapan, f.tanggal_penetapan) = 1 THEN 3
      WHEN DATEDIFF(t.tanggal_penetapan, f.tanggal_penetapan) = 2 THEN 2
      WHEN DATEDIFF(t.tanggal_penetapan, f.tanggal_penetapan) = 3 THEN 1
      ELSE 0
    END AS nilai
  FROM perkara a
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_panitera_pn
      GROUP BY perkara_id
  ) AS c ON a.perkara_id = c.perkara_id
  LEFT JOIN perkara_putusan AS d ON a.perkara_id = d.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_penetapan_hari_sidang
      GROUP BY perkara_id
  ) AS t ON a.perkara_id = t.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_hakim_pn
      GROUP BY perkara_id
  ) AS f ON a.perkara_id = f.perkara_id
  LEFT JOIN perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_jurusita
      GROUP BY perkara_id
  ) AS m ON a.perkara_id = m.perkara_id
  LEFT JOIN perkara_penetapan AS n ON a.perkara_id = n.perkara_id
  LEFT JOIN dirput_dokumen AS r ON a.perkara_id = r.perkara_id
  LEFT JOIN perkara_proses AS q ON a.perkara_id = q.perkara_id
  WHERE YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE()) 
    AND q.tahapan_id = 12
    AND q.proses_id = 80
    AND DATEDIFF(t.tanggal_penetapan, f.tanggal_penetapan) >= 0
    AND (
        CASE
          WHEN DATEDIFF(t.tanggal_penetapan, f.tanggal_penetapan) = 0 THEN 5
          WHEN DATEDIFF(t.tanggal_penetapan, f.tanggal_penetapan) = 1 THEN 3
          WHEN DATEDIFF(t.tanggal_penetapan, f.tanggal_penetapan) = 2 THEN 2
          WHEN DATEDIFF(t.tanggal_penetapan, f.tanggal_penetapan) = 3 THEN 1
          ELSE 0
        END
    ) <> 5
  ORDER BY nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`

    db.query(queryFilter, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama} ${r.ecourt} ${r.ghaib}\nDiinput oleh : ${r.diinput_oleh}\nDurasi : ${r.durasi}\nNilai : ${r.nilai}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

//PENGIMPUTAN PENETAPAN HARI SIDANG (PHS)
const getDataPengimputanPenetapanHariSidang = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT DISTINCT
    a.nomor_perkara,
    a.jenis_perkara_nama,
    q.diinput_oleh,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    CASE 
        WHEN DATEDIFF(q.diinput_tanggal, t.tanggal_penetapan) = 0 
        THEN 'Hari ini' 
        ELSE CONCAT(DATEDIFF(q.diinput_tanggal, t.tanggal_penetapan), ' hari')
    END AS durasi,
    CASE
      WHEN DATEDIFF(q.diinput_tanggal, t.tanggal_penetapan) = 0 THEN 5
      WHEN DATEDIFF(q.diinput_tanggal, t.tanggal_penetapan) = 1 THEN 3
      WHEN DATEDIFF(q.diinput_tanggal, t.tanggal_penetapan) = 2 THEN 2
      WHEN DATEDIFF(q.diinput_tanggal, t.tanggal_penetapan) = 3 THEN 1
      ELSE 0
    END AS nilai
  FROM perkara a
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_panitera_pn
      GROUP BY perkara_id
  ) AS c ON a.perkara_id = c.perkara_id
  LEFT JOIN perkara_putusan AS d ON a.perkara_id = d.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_penetapan_hari_sidang
      GROUP BY perkara_id
  ) AS t ON a.perkara_id = t.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_hakim_pn
      GROUP BY perkara_id
  ) AS f ON a.perkara_id = f.perkara_id
  LEFT JOIN perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_jurusita
      GROUP BY perkara_id
  ) AS m ON a.perkara_id = m.perkara_id
  LEFT JOIN perkara_penetapan AS n ON a.perkara_id = n.perkara_id
  LEFT JOIN dirput_dokumen AS r ON a.perkara_id = r.perkara_id
  LEFT JOIN perkara_proses AS q ON a.perkara_id = q.perkara_id
  WHERE YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE()) 
    AND q.tahapan_id = 12
		AND q.proses_id = 80
    AND DATEDIFF(q.diinput_tanggal, t.tanggal_penetapan) >= 0
  ORDER BY nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`;

    //PERKARA DIBAWAH NILAI 5 YANG TELAH DI FILTER
    let queryFilter = `SELECT DISTINCT
    a.nomor_perkara,
    a.jenis_perkara_nama,
    q.diinput_oleh,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    CASE 
        WHEN DATEDIFF(q.diinput_tanggal, t.tanggal_penetapan) = 0 
        THEN 'Hari ini' 
        ELSE CONCAT(DATEDIFF(q.diinput_tanggal, t.tanggal_penetapan), ' hari')
    END AS durasi,
    CASE
      WHEN DATEDIFF(q.diinput_tanggal, t.tanggal_penetapan) = 0 THEN 5
      WHEN DATEDIFF(q.diinput_tanggal, t.tanggal_penetapan) = 1 THEN 3
      WHEN DATEDIFF(q.diinput_tanggal, t.tanggal_penetapan) = 2 THEN 2
      WHEN DATEDIFF(q.diinput_tanggal, t.tanggal_penetapan) = 3 THEN 1
      ELSE 0
    END AS nilai
  FROM perkara a
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_panitera_pn
      GROUP BY perkara_id
  ) AS c ON a.perkara_id = c.perkara_id
  LEFT JOIN perkara_putusan AS d ON a.perkara_id = d.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_penetapan_hari_sidang
      GROUP BY perkara_id
  ) AS t ON a.perkara_id = t.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_hakim_pn
      GROUP BY perkara_id
  ) AS f ON a.perkara_id = f.perkara_id
  LEFT JOIN perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
  LEFT JOIN (
      SELECT perkara_id, MIN(tanggal_penetapan) AS tanggal_penetapan
      FROM perkara_jurusita
      GROUP BY perkara_id
  ) AS m ON a.perkara_id = m.perkara_id
  LEFT JOIN perkara_penetapan AS n ON a.perkara_id = n.perkara_id
  LEFT JOIN dirput_dokumen AS r ON a.perkara_id = r.perkara_id
  LEFT JOIN perkara_proses AS q ON a.perkara_id = q.perkara_id
  WHERE YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE()) 
    AND q.tahapan_id = 12
    AND q.proses_id = 80
    AND DATEDIFF(q.diinput_tanggal, t.tanggal_penetapan) >= 0
    AND (
        CASE
          WHEN DATEDIFF(q.diinput_tanggal, t.tanggal_penetapan) = 0 THEN 5
          WHEN DATEDIFF(q.diinput_tanggal, t.tanggal_penetapan) = 1 THEN 3
          WHEN DATEDIFF(q.diinput_tanggal, t.tanggal_penetapan) = 2 THEN 2
          WHEN DATEDIFF(q.diinput_tanggal, t.tanggal_penetapan) = 3 THEN 1
          ELSE 0
        END
    ) <> 5
  ORDER BY nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`

    db.query(queryFilter, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama} ${r.ecourt} ${r.ghaib}\nDiinput oleh : ${r.diinput_oleh}\nDurasi : ${r.durasi}\nNilai : ${r.nilai}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

//PENGISIAN DATA RELAAS (KEPATUHAN)
const getDataPengisianDataRelaas = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT
    perk.nomor_perkara,
    perk.jenis_perkara_nama,
    CASE
        WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)' 
        ELSE ''
    END AS ecourt,
    CASE
        WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
        ELSE ''
    END AS ghaib,
    CASE
        WHEN perk.prodeo = 1 THEN ' (_Prodeo_)'
        ELSE ''
    END AS prodeo,
    (
        SELECT
            GROUP_CONCAT(DISTINCT hkpn.nama_gelar ORDER BY hk.id ASC SEPARATOR ' \n') AS nama_hakim
        FROM
            perkara_hakim_pn AS hk
        JOIN hakim_pn AS hkpn ON hkpn.id = hk.hakim_id
        WHERE
            hk.perkara_id = perk.perkara_id
            AND hk.aktif = 'Y'
        ORDER BY hk.urutan ASC
    ) AS majelis_hakim,
    (
        SELECT
            GROUP_CONCAT(DISTINCT pp.nama ORDER BY ppp.id ASC SEPARATOR '<br>') AS nama_js
        FROM
            perkara_panitera_pn AS ppp
        JOIN panitera_pn AS pp ON pp.id = ppp.panitera_id
        WHERE
            ppp.perkara_id = perk.perkara_id
            AND ppp.aktif = 'Y'
        ORDER BY ppp.urutan ASC
    ) AS panitera_nama,
    (
        SELECT
            GROUP_CONCAT(DISTINCT jspn.nama ORDER BY pjs.id ASC SEPARATOR '<br>') AS nama_js
        FROM
            perkara_jurusita AS pjs
        JOIN jurusita AS jspn ON jspn.id = pjs.jurusita_id
        WHERE
            pjs.perkara_id = perk.perkara_id
            AND pjs.aktif = 'Y'
        ORDER BY pjs.urutan ASC
    ) AS jurusita,
    sidang.id AS sidang_id,
    DATE_FORMAT(sidang.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
    sidang.agenda,
    perkarapihak.nama AS nama_pihak,
    perkarapihak.ketpihak,
    perkarapihak.pengacara_pihak_id,
    datarelaas.id AS relaas_id,
    DATE_FORMAT(datarelaas.tanggal_relaas, '%d-%m-%Y') AS tanggal_relaas,
    datarelaas.doc_relaas,
    sidang.urutan,
    jadwalsidang.urutan AS urutan_sebelumnya,
    jadwalsidang.dihadiri_oleh AS status_kehadiran_sebelumnya,
    CASE
        WHEN phs.tahapan_id = 12 THEN 'Y'
        ELSE 'T'
    END AS sidang_pertama,

    -- Durasi antara tanggal relaas dan tanggal sidang
    CASE
        WHEN datarelaas.tanggal_relaas IS NOT NULL THEN
            DATEDIFF(sidang.tanggal_sidang, datarelaas.tanggal_relaas)
        ELSE NULL
    END AS durasi,

    -- Perhitungan Skor Relaas
    CASE
        WHEN datarelaas.tanggal_relaas IS NOT NULL THEN
            CASE
                WHEN DATEDIFF(sidang.tanggal_sidang, datarelaas.tanggal_relaas) >= 3 THEN 5 -- 5 - 0
                WHEN DATEDIFF(sidang.tanggal_sidang, datarelaas.tanggal_relaas) = 2 THEN 2 -- 5 - 3
                WHEN DATEDIFF(sidang.tanggal_sidang, datarelaas.tanggal_relaas) = 1 THEN 1 -- 5 - 4
                WHEN DATEDIFF(sidang.tanggal_sidang, datarelaas.tanggal_relaas) = 0 THEN 0 -- 5 - 5
            END
        ELSE -5 -- Jika tidak ada data relaas
    END AS nilai

  FROM
      perkara AS perk
  JOIN perkara_jadwal_sidang AS sidang ON sidang.perkara_id = perk.perkara_id
  JOIN (
      SELECT
          p1.perkara_id,
          p1.pihak_id,
          p1.nama,
          1 AS pihakke,
          'pihak p' AS ketpihak,
          '' AS pengacara_pihak_id
      FROM perkara_pihak1 AS p1
      JOIN perkara ON perkara.perkara_id = p1.perkara_id
      WHERE alur_perkara_id < 111
      UNION
      SELECT
          p2.perkara_id,
          p2.pihak_id,
          p2.nama,
          2 AS pihakke,
          'pihak t' AS ketpihak,
          '' AS pengacara_pihak_id
      FROM perkara_pihak2 AS p2
      JOIN perkara ON perkara.perkara_id = p2.perkara_id
      WHERE alur_perkara_id < 111
      AND (status_penahanan_id IS NULL OR status_penahanan_id = 0)
      AND (jenis_tahanan_id = 0 OR jenis_tahanan_id IS NULL)
      UNION
      SELECT
          p3.perkara_id,
          p3.pihak_id,
          p3.nama,
          3 AS pihakke,
          'intervensi' AS ketpihak,
          '' AS pengacara_pihak_id
      FROM perkara_pihak3 AS p3
      UNION
      SELECT
          p4.perkara_id,
          p4.pihak_id,
          p4.nama,
          4 AS pihakke,
          'turut' AS ketpihak,
          '' AS pengacara_pihak_id
      FROM perkara_pihak4 AS p4
      UNION
      SELECT
          p5.perkara_id,
          p5.pengacara_id,
          p5.nama,
          p5.pihak_ke AS pihhkke,
          'pengacara' AS ketpihak,
          p5.pihak_id AS pengacara_pihak_id
      FROM perkara_pengacara AS p5
  ) AS perkarapihak ON perkarapihak.perkara_id = perk.perkara_id
  LEFT JOIN perkara_pelaksanaan_relaas AS datarelaas ON datarelaas.pihak_id = perkarapihak.pihak_id
  AND datarelaas.perkara_id = perk.perkara_id
  AND datarelaas.sidang_id = sidang.id
  LEFT JOIN perkara_efiling_id AS k ON perk.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON perk.perkara_id = i.perkara_id
  LEFT JOIN (
      SELECT
          perkara.perkara_id AS perkara_id,
          perkara_jadwal_sidang.urutan AS urutan,
          perkara_jadwal_sidang.dihadiri_oleh
      FROM perkara
      JOIN perkara_jadwal_sidang ON perkara_jadwal_sidang.perkara_id = perkara.perkara_id
  ) AS jadwalsidang ON jadwalsidang.perkara_id = perk.perkara_id
  AND jadwalsidang.urutan = sidang.urutan - 1
  LEFT JOIN perkara_penetapan_hari_sidang AS phs ON phs.perkara_id = perk.perkara_id
  AND phs.jadwalsidang_id = sidang.id
  JOIN alur_perkara AS alur ON alur.id = perk.alur_perkara_id
  LEFT JOIN perkara_putusan AS q ON perk.perkara_id = q.perkara_id
  WHERE
      YEAR(perk.tanggal_pendaftaran) = YEAR(CURDATE())
      AND perk.alur_perkara_id < 111
  GROUP BY
      sidang.id,
      perkarapihak.pihak_id
  ORDER BY
      nilai ASC, perk.alur_perkara_id ASC, perk.perkara_id ASC, tanggal_sidang ASC;`;

    //PERKARA DIBAWAH NILAI 5 YANG TELAH DI FILTER (-5 APABILA BELUM UPLOAD RELAAS)
    let queryFilter = `SELECT
    perk.nomor_perkara,
    perk.jenis_perkara_nama,
    CASE
        WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)' 
        ELSE ''
    END AS ecourt,
    CASE
        WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
        ELSE ''
    END AS ghaib,
    CASE
        WHEN perk.prodeo = 1 THEN ' (_Prodeo_)'
        ELSE ''
    END AS prodeo,
    (
        SELECT
            GROUP_CONCAT(DISTINCT hkpn.nama_gelar ORDER BY hk.id ASC SEPARATOR ' \n') AS nama_hakim
        FROM
            perkara_hakim_pn AS hk
        JOIN hakim_pn AS hkpn ON hkpn.id = hk.hakim_id
        WHERE
            hk.perkara_id = perk.perkara_id
            AND hk.aktif = 'Y'
        ORDER BY hk.urutan ASC
    ) AS majelis_hakim,
    (
        SELECT
            GROUP_CONCAT(DISTINCT pp.nama ORDER BY ppp.id ASC SEPARATOR '<br>') AS nama_js
        FROM
            perkara_panitera_pn AS ppp
        JOIN panitera_pn AS pp ON pp.id = ppp.panitera_id
        WHERE
            ppp.perkara_id = perk.perkara_id
            AND ppp.aktif = 'Y'
        ORDER BY ppp.urutan ASC
    ) AS panitera_nama,
    (
        SELECT
            GROUP_CONCAT(DISTINCT jspn.nama ORDER BY pjs.id ASC SEPARATOR '<br>') AS nama_js
        FROM
            perkara_jurusita AS pjs
        JOIN jurusita AS jspn ON jspn.id = pjs.jurusita_id
        WHERE
            pjs.perkara_id = perk.perkara_id
            AND pjs.aktif = 'Y'
        ORDER BY pjs.urutan ASC
    ) AS jurusita,
    sidang.id AS sidang_id,
    DATE_FORMAT(sidang.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
    sidang.agenda,
    perkarapihak.nama AS nama_pihak,
    perkarapihak.ketpihak,
    perkarapihak.pengacara_pihak_id,
    datarelaas.id AS relaas_id,
    DATE_FORMAT(datarelaas.tanggal_relaas, '%d-%m-%Y') AS tanggal_relaas,
    datarelaas.doc_relaas,
    sidang.urutan,
    jadwalsidang.urutan AS urutan_sebelumnya,
    jadwalsidang.dihadiri_oleh AS status_kehadiran_sebelumnya,
    CASE
        WHEN phs.tahapan_id = 12 THEN 'Y'
        ELSE 'T'
    END AS sidang_pertama,

    -- Durasi antara tanggal relaas dan tanggal sidang
    CASE
        WHEN datarelaas.tanggal_relaas IS NOT NULL THEN
            DATEDIFF(sidang.tanggal_sidang, datarelaas.tanggal_relaas)
        ELSE NULL
    END AS durasi,

    -- Perhitungan Skor Relaas
    CASE
        WHEN datarelaas.tanggal_relaas IS NOT NULL THEN
            CASE
                WHEN DATEDIFF(sidang.tanggal_sidang, datarelaas.tanggal_relaas) >= 3 THEN 5 -- 5 - 0
                WHEN DATEDIFF(sidang.tanggal_sidang, datarelaas.tanggal_relaas) = 2 THEN 2 -- 5 - 3
                WHEN DATEDIFF(sidang.tanggal_sidang, datarelaas.tanggal_relaas) = 1 THEN 1 -- 5 - 4
                WHEN DATEDIFF(sidang.tanggal_sidang, datarelaas.tanggal_relaas) = 0 THEN 0 -- 5 - 5
            END
        ELSE -5 -- Jika tidak ada data relaas
    END AS nilai

  FROM
      perkara AS perk
  JOIN perkara_jadwal_sidang AS sidang ON sidang.perkara_id = perk.perkara_id
  JOIN (
      SELECT
          p1.perkara_id,
          p1.pihak_id,
          p1.nama,
          1 AS pihakke,
          'pihak p' AS ketpihak,
          '' AS pengacara_pihak_id
      FROM perkara_pihak1 AS p1
      JOIN perkara ON perkara.perkara_id = p1.perkara_id
      WHERE alur_perkara_id < 111
      UNION
      SELECT
          p2.perkara_id,
          p2.pihak_id,
          p2.nama,
          2 AS pihakke,
          'pihak t' AS ketpihak,
          '' AS pengacara_pihak_id
      FROM perkara_pihak2 AS p2
      JOIN perkara ON perkara.perkara_id = p2.perkara_id
      WHERE alur_perkara_id < 111
      AND (status_penahanan_id IS NULL OR status_penahanan_id = 0)
      AND (jenis_tahanan_id = 0 OR jenis_tahanan_id IS NULL)
      UNION
      SELECT
          p3.perkara_id,
          p3.pihak_id,
          p3.nama,
          3 AS pihakke,
          'intervensi' AS ketpihak,
          '' AS pengacara_pihak_id
      FROM perkara_pihak3 AS p3
      UNION
      SELECT
          p4.perkara_id,
          p4.pihak_id,
          p4.nama,
          4 AS pihakke,
          'turut' AS ketpihak,
          '' AS pengacara_pihak_id
      FROM perkara_pihak4 AS p4
      UNION
      SELECT
          p5.perkara_id,
          p5.pengacara_id,
          p5.nama,
          p5.pihak_ke AS pihhkke,
          'pengacara' AS ketpihak,
          p5.pihak_id AS pengacara_pihak_id
      FROM perkara_pengacara AS p5
  ) AS perkarapihak ON perkarapihak.perkara_id = perk.perkara_id
  LEFT JOIN perkara_pelaksanaan_relaas AS datarelaas ON datarelaas.pihak_id = perkarapihak.pihak_id
  AND datarelaas.perkara_id = perk.perkara_id
  AND datarelaas.sidang_id = sidang.id
  LEFT JOIN perkara_efiling_id AS k ON perk.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON perk.perkara_id = i.perkara_id
  LEFT JOIN (
      SELECT
          perkara.perkara_id AS perkara_id,
          perkara_jadwal_sidang.urutan AS urutan,
          perkara_jadwal_sidang.dihadiri_oleh
      FROM perkara
      JOIN perkara_jadwal_sidang ON perkara_jadwal_sidang.perkara_id = perkara.perkara_id
  ) AS jadwalsidang ON jadwalsidang.perkara_id = perk.perkara_id
  AND jadwalsidang.urutan = sidang.urutan - 1
  LEFT JOIN perkara_penetapan_hari_sidang AS phs ON phs.perkara_id = perk.perkara_id
  AND phs.jadwalsidang_id = sidang.id
  JOIN alur_perkara AS alur ON alur.id = perk.alur_perkara_id
  LEFT JOIN perkara_putusan AS q ON perk.perkara_id = q.perkara_id
  WHERE
      YEAR(perk.tanggal_pendaftaran) = YEAR(CURDATE())
      AND perk.alur_perkara_id < 111
      AND (
          CASE
              WHEN datarelaas.tanggal_relaas IS NOT NULL THEN
                  CASE
                      WHEN DATEDIFF(sidang.tanggal_sidang, datarelaas.tanggal_relaas) >= 3 THEN 5
                      WHEN DATEDIFF(sidang.tanggal_sidang, datarelaas.tanggal_relaas) = 2 THEN 2
                      WHEN DATEDIFF(sidang.tanggal_sidang, datarelaas.tanggal_relaas) = 1 THEN 1
                      WHEN DATEDIFF(sidang.tanggal_sidang, datarelaas.tanggal_relaas) = 0 THEN 0
                  END
              ELSE -5
          END
      ) <> 5
  GROUP BY
      sidang.id,
      perkarapihak.pihak_id
  ORDER BY
      nilai ASC, perk.alur_perkara_id ASC, perk.perkara_id ASC, tanggal_sidang ASC;`

    db.query(queryFilter, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama} ${r.ecourt} ${r.ghaib}\nJurusita : ${r.jurusita}\nDurasi : ${r.durasi}\nNilai : ${r.nilai}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

//PENGISIAN DATA MEDIASI
const getDataMediasi = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT 
    nomor_perkara, 
    jenis_perkara_nama,
    perkara_mediator.nama_mediator,
    CASE
        WHEN hasil_mediasi = 'Y1' THEN 'Berhasil Kesepakatan Damai'
        WHEN hasil_mediasi = 'Y2' THEN 'Berhasil Dengan Pencabutan'
        WHEN hasil_mediasi = 'S' THEN 'Berhasil Sebagian'
        WHEN hasil_mediasi = 'D' THEN 'Tidak Dapat Dilaksanakan'
        ELSE 'Tidak Berhasil'
    END AS mediasi_hasil,
    CASE
        WHEN perkara_mediasi.status_mediator = 'H' THEN 'H'
        ELSE 'NH'
    END AS mediator_status,
    CASE
        WHEN hasil_mediasi IS NOT NULL THEN 5
        ELSE 0
    END AS nilai
  FROM 
      perkara
  LEFT JOIN
      perkara_mediasi ON perkara.perkara_id = perkara_mediasi.perkara_id
  LEFT JOIN
      perkara_mediator ON perkara.perkara_id = perkara_mediator.perkara_id
  WHERE 
      perkara_mediasi.perkara_id IS NOT NULL 
      AND YEAR(keputusan_mediasi) = YEAR(CURDATE())
  ORDER BY
      nilai ASC,
      CASE 
          WHEN hasil_mediasi = 'Y1' THEN 1
          WHEN hasil_mediasi = 'Y2' THEN 2
          WHEN hasil_mediasi = 'S' THEN 3
          WHEN hasil_mediasi = 'D' THEN 4
          ELSE 5
      END,
      mediator_text ASC,
      perkara.perkara_id ASC;`;

    //PERKARA DIBAWAH NILAI 5 YANG TELAH DI FILTER
    let queryFilter = `SELECT 
    nomor_perkara, 
    jenis_perkara_nama,
    perkara_mediator.nama_mediator,
    CASE
        WHEN hasil_mediasi = 'Y1' THEN 'Berhasil Kesepakatan Damai'
        WHEN hasil_mediasi = 'Y2' THEN 'Berhasil Dengan Pencabutan'
        WHEN hasil_mediasi = 'S' THEN 'Berhasil Sebagian'
        WHEN hasil_mediasi = 'D' THEN 'Tidak Dapat Dilaksanakan'
        ELSE 'Tidak Berhasil'
    END AS mediasi_hasil,
    CASE
        WHEN perkara_mediasi.status_mediator = 'H' THEN 'H'
        ELSE 'NH'
    END AS mediator_status,
    CASE
        WHEN hasil_mediasi IS NOT NULL THEN 5
        ELSE 0
    END AS nilai
  FROM 
      perkara
  LEFT JOIN
      perkara_mediasi ON perkara.perkara_id = perkara_mediasi.perkara_id
  LEFT JOIN
      perkara_mediator ON perkara.perkara_id = perkara_mediator.perkara_id
  WHERE 
      perkara_mediasi.perkara_id IS NOT NULL 
      AND YEAR(keputusan_mediasi) = YEAR(CURDATE())
      AND (
          CASE
              WHEN hasil_mediasi IS NOT NULL THEN 5
              ELSE 0
          END
      ) <> 5
  ORDER BY
      nilai ASC,
      CASE 
          WHEN hasil_mediasi = 'Y1' THEN 1
          WHEN hasil_mediasi = 'Y2' THEN 2
          WHEN hasil_mediasi = 'S' THEN 3
          WHEN hasil_mediasi = 'D' THEN 4
          ELSE 5
      END,
      mediator_text ASC,
      perkara.perkara_id ASC;`

    db.query(queryFilter, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama}\nMediator : ${r.nama_mediator}\nHasil Mediasi : ${r.mediasi_hasil}\nNilai : ${r.nilai}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

//PENGISIAN KEPATUHAN DATA SAKSI DAN KELENGKAPAN KOLOM DATA SAKSI (JENIS IDENTITAS, NOMOR IDENTITAS DAN NOMOR HP) **perlu diperbaiki
const getDataKepatuhanDataSaksi = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT
    perkara.nomor_perkara,
    perkara.jenis_perkara_nama,
    perkara_putusan.status_putusan_id,
    perkara_panitera_pn.panitera_nama,
    CASE 
        -- Jika ada data saksi dan lengkap isian (jenis_indentitas, nomor_indentitas, telepon), nilai = 5
        WHEN pihak.jenis_indentitas IS NOT NULL 
            AND pihak.nomor_indentitas IS NOT NULL 
            AND pihak.telepon IS NOT NULL THEN 5
        -- Jika ada data saksi dan isian ada 2 dari 3, nilai = 3
        WHEN (pihak.jenis_indentitas IS NOT NULL AND pihak.nomor_indentitas IS NOT NULL)
            OR (pihak.jenis_indentitas IS NOT NULL AND pihak.telepon IS NOT NULL)
            OR (pihak.nomor_indentitas IS NOT NULL AND pihak.telepon IS NOT NULL) THEN 3
        -- Jika ada data saksi dan isian ada 1 dari 3, nilai = 2
        WHEN (pihak.jenis_indentitas IS NOT NULL) 
            OR (pihak.nomor_indentitas IS NOT NULL) 
            OR (pihak.telepon IS NOT NULL) THEN 2
        -- Jika ada data saksi tetapi isian ada 0 dari 3, nilai = 1
        WHEN pihak.jenis_indentitas IS NULL 
            AND pihak.nomor_indentitas IS NULL 
            AND pihak.telepon IS NULL THEN 1
        -- Jika tidak ada data saksi, nilai = 0
        ELSE 0
    END AS nilai,
    -- Menampilkan apa saja yang tidak diisi, dengan tanda kurung hanya jika ada
    CASE 
        WHEN pihak.jenis_indentitas IS NULL OR pihak.nomor_indentitas IS NULL OR pihak.telepon IS NULL THEN
            CONCAT('(', 
                CONCAT_WS(', ', 
                    CASE WHEN pihak.jenis_indentitas IS NULL THEN 'Jenis indentitas' END,
                    CASE WHEN pihak.nomor_indentitas IS NULL THEN 'Nomor indentitas' END,
                    CASE WHEN pihak.telepon IS NULL THEN 'Nomor Telepon' END
                ), 
            ')')
        ELSE ''
    END AS keterangan
  FROM 
      perkara
  LEFT JOIN
      perkara_pihak5 ON perkara.perkara_id = perkara_pihak5.perkara_id
  LEFT JOIN
      pihak ON perkara_pihak5.pihak_id = pihak.id
  LEFT JOIN
      perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id
  LEFT JOIN
      perkara_panitera_pn ON perkara.perkara_id = perkara_panitera_pn.perkara_id
  WHERE 
      YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE())
      AND perkara_putusan.status_putusan_id NOT IN (65, 67, 93) -- Cabut/gugur/digugurkan tidak dihitung
  ORDER BY
      nilai ASC, perkara.alur_perkara_id ASC, perkara.perkara_id ASC;`;

    //PERKARA DIBAWAH NILAI 5 YANG TELAH DI FILTER
    let queryFilter = `SELECT
    perkara.nomor_perkara,
    perkara.jenis_perkara_nama,
    perkara_putusan.status_putusan_id,
    perkara_panitera_pn.panitera_nama,
    CASE 
        -- Jika ada data saksi dan lengkap isian (jenis_indentitas, nomor_indentitas, telepon), nilai = 5
        WHEN pihak.jenis_indentitas IS NOT NULL 
            AND pihak.nomor_indentitas IS NOT NULL 
            AND pihak.telepon IS NOT NULL THEN 5
        -- Jika ada data saksi dan isian ada 2 dari 3, nilai = 3
        WHEN (pihak.jenis_indentitas IS NOT NULL AND pihak.nomor_indentitas IS NOT NULL)
            OR (pihak.jenis_indentitas IS NOT NULL AND pihak.telepon IS NOT NULL)
            OR (pihak.nomor_indentitas IS NOT NULL AND pihak.telepon IS NOT NULL) THEN 3
        -- Jika ada data saksi dan isian ada 1 dari 3, nilai = 2
        WHEN (pihak.jenis_indentitas IS NOT NULL) 
            OR (pihak.nomor_indentitas IS NOT NULL) 
            OR (pihak.telepon IS NOT NULL) THEN 2
        -- Jika ada data saksi tetapi isian ada 0 dari 3, nilai = 1
        WHEN pihak.jenis_indentitas IS NULL 
            AND pihak.nomor_indentitas IS NULL 
            AND pihak.telepon IS NULL THEN 1
        -- Jika tidak ada data saksi, nilai = 0
        ELSE 0
    END AS nilai,
    -- Menampilkan apa saja yang tidak diisi, dengan tanda kurung
    CONCAT('(', 
        CONCAT_WS(', ', 
            CASE WHEN pihak.jenis_indentitas IS NULL THEN 'Jenis indentitas' END,
            CASE WHEN pihak.nomor_indentitas IS NULL THEN 'Nomor indentitas' END,
            CASE WHEN pihak.telepon IS NULL THEN 'Nomor Telepon' END
        ), 
    ')') AS keterangan
  FROM 
      perkara
  LEFT JOIN
      perkara_pihak5 ON perkara.perkara_id = perkara_pihak5.perkara_id
  LEFT JOIN
      pihak ON perkara_pihak5.pihak_id = pihak.id
  LEFT JOIN
      perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id
  LEFT JOIN
      perkara_panitera_pn ON perkara.perkara_id = perkara_panitera_pn.perkara_id
  WHERE 
      YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE())
      AND perkara_putusan.status_putusan_id NOT IN (65, 67, 93) -- Cabut/gugur/digugurkan tidak dihitung
      AND (
          CASE 
              -- Menambahkan kondisi untuk nilai bukan 0
              WHEN pihak.jenis_indentitas IS NOT NULL 
                  AND pihak.nomor_indentitas IS NOT NULL 
                  AND pihak.telepon IS NOT NULL THEN 5
              WHEN (pihak.jenis_indentitas IS NOT NULL AND pihak.nomor_indentitas IS NOT NULL)
                  OR (pihak.jenis_indentitas IS NOT NULL AND pihak.telepon IS NOT NULL)
                  OR (pihak.nomor_indentitas IS NOT NULL AND pihak.telepon IS NOT NULL) THEN 3
              WHEN (pihak.jenis_indentitas IS NOT NULL) 
                  OR (pihak.nomor_indentitas IS NOT NULL) 
                  OR (pihak.telepon IS NOT NULL) THEN 2
              WHEN pihak.jenis_indentitas IS NULL 
                  AND pihak.nomor_indentitas IS NULL 
                  AND pihak.telepon IS NULL THEN 1
              ELSE 0
          END
      ) <> 5
  ORDER BY
      nilai ASC, perkara.alur_perkara_id ASC, perkara.perkara_id ASC;`

    db.query(queryFilter, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama}\nPanitera : ${r.panitera_nama}\nNilai : ${r.nilai} : ${r.keterangan}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

//PEMBERITAHUAN PUTUSAN/PENETAPAN
const getDataPemberitahuanPutusanPenetapan = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT DISTINCT
    a.perkara_id,
    a.nomor_perkara,
    a.jenis_perkara_nama,
    a.tanggal_putusan,
    a.status_putusan_kode,
    c.jurusita_nama,
    a.alur_perkara_id,
    h.pihak,
    g.status_putusan_id,
    d.perkara_id AS delegasi,
		
		-- Durasi Pelaksanaan PBT
    DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) AS durasi_pelaksanaan_pbt,

    -- Durasi Penginputan SIPP
    DATEDIFF(p.diinput_tanggal, h.tanggal_pemberitahuan_putusan) AS durasi_penginputan_sipp,
    
    -- Nilai untuk Waktu Pelaksanaan PBT
    CASE 
        WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) <= 3 THEN 5
        WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) = 4 THEN 3
        WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) = 5 THEN 2
        WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) = 6 THEN 1
        ELSE 0
    END AS nilai_waktu_pbt,

    -- Nilai untuk Penginputan SIPP (berdasarkan proses_id = 218)
    CASE 
        WHEN DATEDIFF(p.diinput_tanggal, h.tanggal_pemberitahuan_putusan) = 0 THEN 5
        WHEN DATEDIFF(p.diinput_tanggal, h.tanggal_pemberitahuan_putusan) = 1 THEN 3
        WHEN DATEDIFF(p.diinput_tanggal, h.tanggal_pemberitahuan_putusan) = 2 THEN 2
        WHEN DATEDIFF(p.diinput_tanggal, h.tanggal_pemberitahuan_putusan) = 3 THEN 1
        ELSE 0
    END AS nilai_penginputan_sipp,

    -- Total nilai (gabungan 50% PBT, 50% SIPP, atau 100% PBT jika penginputan SIPP tidak ada)
    CASE 
        WHEN p.diinput_tanggal IS NULL THEN 
            -- Jika penginputan SIPP belum terakomodir, nilai 100% dari waktu pelaksanaan PBT
            CASE 
                WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) <= 3 THEN 5
                WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) = 4 THEN 3
                WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) = 5 THEN 2
                WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) = 6 THEN 1
                ELSE 0
            END
        ELSE 
            -- Jika ada, bobot 50% masing-masing
            (0.5 * 
                CASE 
                    WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) <= 3 THEN 5
                    WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) = 4 THEN 3
                    WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) = 5 THEN 2
                    WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) = 6 THEN 1
                    ELSE 0
                END
            ) + 
            (0.5 * 
                CASE 
                    WHEN DATEDIFF(p.diinput_tanggal, h.tanggal_pemberitahuan_putusan) = 0 THEN 5
                    WHEN DATEDIFF(p.diinput_tanggal, h.tanggal_pemberitahuan_putusan) = 1 THEN 3
                    WHEN DATEDIFF(p.diinput_tanggal, h.tanggal_pemberitahuan_putusan) = 2 THEN 2
                    WHEN DATEDIFF(p.diinput_tanggal, h.tanggal_pemberitahuan_putusan) = 3 THEN 1
                    ELSE 0
                END
            )
    END AS nilai

    FROM 
        v_perkara a
    JOIN 
        perkara_jadwal_sidang b ON a.perkara_id = b.perkara_id 
        AND b.tanggal_sidang = a.tanggal_putusan 
        AND b.dihadiri_oleh IS NOT NULL 
    JOIN 
        perkara_putusan g ON a.perkara_id = g.perkara_id
    JOIN 
        perkara_putusan_pemberitahuan_putusan h ON a.perkara_id = h.perkara_id
    JOIN 
        perkara_jurusita c ON a.perkara_id = c.perkara_id
    LEFT JOIN 
        delegasi_keluar d ON a.perkara_id = d.perkara_id
    LEFT JOIN 
        perkara_proses p ON a.perkara_id = p.perkara_id AND p.proses_id = 218
    WHERE
        YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE())
        AND a.tanggal_putusan > DATE_SUB(CURDATE(), INTERVAL 3 YEAR) 
        AND b.dihadiri_oleh > 1
        AND a.tanggal_putusan IS NOT NULL
        AND c.aktif = 'Y'
    ORDER BY 
        nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`;

    //PERKARA DIBAWAH NILAI 5 YANG TELAH DI FILTER
    let queryFilter = `SELECT DISTINCT
    a.perkara_id,
    a.nomor_perkara,
    a.jenis_perkara_nama,
    a.tanggal_putusan,
    a.status_putusan_kode,
    c.jurusita_nama,
    a.alur_perkara_id,
    h.pihak,
    g.status_putusan_id,
    d.perkara_id AS delegasi,
    
    -- Durasi Pelaksanaan PBT
    DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) AS durasi_pelaksanaan_pbt,

    -- Durasi Penginputan SIPP
    DATEDIFF(p.diinput_tanggal, h.tanggal_pemberitahuan_putusan) AS durasi_penginputan_sipp,

    -- Nilai untuk Waktu Pelaksanaan PBT
    CASE 
        WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) <= 3 THEN 5
        WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) = 4 THEN 3
        WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) = 5 THEN 2
        WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) = 6 THEN 1
        ELSE 0
    END AS nilai_waktu_pbt,

    -- Nilai untuk Penginputan SIPP
    CASE 
        WHEN DATEDIFF(p.diinput_tanggal, h.tanggal_pemberitahuan_putusan) = 0 THEN 5
        WHEN DATEDIFF(p.diinput_tanggal, h.tanggal_pemberitahuan_putusan) = 1 THEN 3
        WHEN DATEDIFF(p.diinput_tanggal, h.tanggal_pemberitahuan_putusan) = 2 THEN 2
        WHEN DATEDIFF(p.diinput_tanggal, h.tanggal_pemberitahuan_putusan) = 3 THEN 1
        ELSE 0
    END AS nilai_penginputan_sipp,

    -- Total nilai
    CASE 
        WHEN p.diinput_tanggal IS NULL THEN 
            CASE 
                WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) <= 3 THEN 5
                WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) = 4 THEN 3
                WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) = 5 THEN 2
                WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) = 6 THEN 1
                ELSE 0
            END
        ELSE 
            (0.5 * 
                CASE 
                    WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) <= 3 THEN 5
                    WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) = 4 THEN 3
                    WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) = 5 THEN 2
                    WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) = 6 THEN 1
                    ELSE 0
                END
            ) + 
            (0.5 * 
                CASE 
                    WHEN DATEDIFF(p.diinput_tanggal, h.tanggal_pemberitahuan_putusan) = 0 THEN 5
                    WHEN DATEDIFF(p.diinput_tanggal, h.tanggal_pemberitahuan_putusan) = 1 THEN 3
                    WHEN DATEDIFF(p.diinput_tanggal, h.tanggal_pemberitahuan_putusan) = 2 THEN 2
                    WHEN DATEDIFF(p.diinput_tanggal, h.tanggal_pemberitahuan_putusan) = 3 THEN 1
                    ELSE 0
                END
            )
    END AS nilai

  FROM 
      v_perkara a
  JOIN 
      perkara_jadwal_sidang b ON a.perkara_id = b.perkara_id 
      AND b.tanggal_sidang = a.tanggal_putusan 
      AND b.dihadiri_oleh IS NOT NULL 
  JOIN 
      perkara_putusan g ON a.perkara_id = g.perkara_id
  JOIN 
      perkara_putusan_pemberitahuan_putusan h ON a.perkara_id = h.perkara_id
  JOIN 
      perkara_jurusita c ON a.perkara_id = c.perkara_id
  LEFT JOIN 
      delegasi_keluar d ON a.perkara_id = d.perkara_id
  LEFT JOIN 
      perkara_proses p ON a.perkara_id = p.perkara_id AND p.proses_id = 218
  WHERE
      YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE())
      AND a.tanggal_putusan > DATE_SUB(CURDATE(), INTERVAL 3 YEAR) 
      AND b.dihadiri_oleh > 1
      AND a.tanggal_putusan IS NOT NULL
      AND c.aktif = 'Y'
      AND (
          (p.diinput_tanggal IS NULL AND 
              CASE 
                  WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) <= 3 THEN 5
                  WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) = 4 THEN 3
                  WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) = 5 THEN 2
                  WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) = 6 THEN 1
                  ELSE 0
              END <> 5
          )
          OR 
          (p.diinput_tanggal IS NOT NULL AND 
              (0.5 * 
                  CASE 
                      WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) <= 3 THEN 5
                      WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) = 4 THEN 3
                      WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) = 5 THEN 2
                      WHEN DATEDIFF(h.tanggal_pemberitahuan_putusan, a.tanggal_putusan) = 6 THEN 1
                      ELSE 0
                  END + 
                  0.5 * 
                  CASE 
                      WHEN DATEDIFF(p.diinput_tanggal, h.tanggal_pemberitahuan_putusan) = 0 THEN 5
                      WHEN DATEDIFF(p.diinput_tanggal, h.tanggal_pemberitahuan_putusan) = 1 THEN 3
                      WHEN DATEDIFF(p.diinput_tanggal, h.tanggal_pemberitahuan_putusan) = 2 THEN 2
                      WHEN DATEDIFF(p.diinput_tanggal, h.tanggal_pemberitahuan_putusan) = 3 THEN 1
                      ELSE 0
                  END
              ) <> 5)
      )

  ORDER BY 
      nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`
    db.query(queryFilter, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama}\nJS : ${r.jurusita_nama}\nNilai : ${r.nilai}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

//PENGISIAN BHT
const getDataPengisianBht = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT 
    a.perkara_id, 
    a.nomor_perkara, 
    a.jenis_perkara_nama,
		a.status_putusan_kode,
    CASE 
        WHEN b.dihadiri_oleh = 4 THEN (SELECT MAX(ppp1.tanggal_pemberitahuan_putusan) 
                                      FROM perkara_putusan_pemberitahuan_putusan ppp1 
                                      WHERE ppp1.perkara_id = a.perkara_id) 
        WHEN b.dihadiri_oleh = 3 THEN (SELECT MAX(ppp2.tanggal_pemberitahuan_putusan) 
                                      FROM perkara_putusan_pemberitahuan_putusan ppp2 
                                      WHERE ppp2.perkara_id = a.perkara_id AND ppp2.pihak = 1)
        WHEN b.dihadiri_oleh = 2 THEN (SELECT MAX(ppp3.tanggal_pemberitahuan_putusan) 
                                      FROM perkara_putusan_pemberitahuan_putusan ppp3 
                                      WHERE ppp3.perkara_id = a.perkara_id AND ppp3.pihak = 2)
        WHEN b.dihadiri_oleh = 1 OR a.status_putusan_id IN(65,66,67) THEN a.tanggal_putusan
        ELSE NULL 
    END AS pbt,

    -- Menambahkan 15 hari dari pbt untuk menghasilkan bht
    DATE_ADD(CASE 
        WHEN b.dihadiri_oleh = 4 THEN (SELECT MAX(ppp1.tanggal_pemberitahuan_putusan) 
                                      FROM perkara_putusan_pemberitahuan_putusan ppp1 
                                      WHERE ppp1.perkara_id = a.perkara_id) 
        WHEN b.dihadiri_oleh = 3 THEN (SELECT MAX(ppp2.tanggal_pemberitahuan_putusan) 
                                      FROM perkara_putusan_pemberitahuan_putusan ppp2 
                                      WHERE ppp2.perkara_id = a.perkara_id AND ppp2.pihak = 1)
        WHEN b.dihadiri_oleh = 2 THEN (SELECT MAX(ppp3.tanggal_pemberitahuan_putusan) 
                                      FROM perkara_putusan_pemberitahuan_putusan ppp3 
                                      WHERE ppp3.perkara_id = a.perkara_id AND ppp3.pihak = 2)
        WHEN b.dihadiri_oleh = 1 OR a.status_putusan_id IN(65,66,67) THEN a.tanggal_putusan
        ELSE NULL 
    END, INTERVAL 15 DAY) AS bht,

    -- Kepatuhan pengisian BHT
    CASE
        WHEN a.tanggal_bht IS NOT NULL THEN 5
        ELSE 0
    END AS nilai

  FROM 
      v_perkara a
  JOIN 
      perkara_jadwal_sidang b ON a.perkara_id = b.perkara_id 
                              AND b.tanggal_sidang = a.tanggal_putusan 
                              AND b.dihadiri_oleh IS NOT NULL 
  WHERE 
      a.tahapan_terakhir_id = 15 
      AND YEAR(a.tanggal_putusan) = YEAR(CURDATE())
      AND CASE 
          WHEN b.dihadiri_oleh = 4 THEN (SELECT MAX(ppp1.tanggal_pemberitahuan_putusan) 
                                        FROM perkara_putusan_pemberitahuan_putusan ppp1 
                                        WHERE ppp1.perkara_id = a.perkara_id) 
          WHEN b.dihadiri_oleh = 3 THEN (SELECT MAX(ppp2.tanggal_pemberitahuan_putusan) 
                                        FROM perkara_putusan_pemberitahuan_putusan ppp2 
                                        WHERE ppp2.perkara_id = a.perkara_id AND ppp2.pihak = 1)
          WHEN b.dihadiri_oleh = 2 THEN (SELECT MAX(ppp3.tanggal_pemberitahuan_putusan) 
                                        FROM perkara_putusan_pemberitahuan_putusan ppp3 
                                        WHERE ppp3.perkara_id = a.perkara_id AND ppp3.pihak = 2)
          WHEN b.dihadiri_oleh = 1 OR a.status_putusan_id IN(65,66,67) THEN a.tanggal_putusan
          ELSE NULL 
      END < DATE_SUB(CURDATE(), INTERVAL 15 DAY)
      
  ORDER BY 
      nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`;

    //PERKARA DIBAWAH NILAI 5 YANG TELAH DI FILTER
    let queryFilter = `SELECT 
    a.perkara_id, 
    a.nomor_perkara, 
    a.jenis_perkara_nama,
    a.status_putusan_kode,
    CASE 
        WHEN b.dihadiri_oleh = 4 THEN (SELECT MAX(ppp1.tanggal_pemberitahuan_putusan) 
                                      FROM perkara_putusan_pemberitahuan_putusan ppp1 
                                      WHERE ppp1.perkara_id = a.perkara_id) 
        WHEN b.dihadiri_oleh = 3 THEN (SELECT MAX(ppp2.tanggal_pemberitahuan_putusan) 
                                      FROM perkara_putusan_pemberitahuan_putusan ppp2 
                                      WHERE ppp2.perkara_id = a.perkara_id AND ppp2.pihak = 1)
        WHEN b.dihadiri_oleh = 2 THEN (SELECT MAX(ppp3.tanggal_pemberitahuan_putusan) 
                                      FROM perkara_putusan_pemberitahuan_putusan ppp3 
                                      WHERE ppp3.perkara_id = a.perkara_id AND ppp3.pihak = 2)
        WHEN b.dihadiri_oleh = 1 OR a.status_putusan_id IN(65,66,67) THEN a.tanggal_putusan
        ELSE NULL 
    END AS pbt,

    -- Menambahkan 15 hari dari pbt untuk menghasilkan bht
    DATE_ADD(CASE 
        WHEN b.dihadiri_oleh = 4 THEN (SELECT MAX(ppp1.tanggal_pemberitahuan_putusan) 
                                      FROM perkara_putusan_pemberitahuan_putusan ppp1 
                                      WHERE ppp1.perkara_id = a.perkara_id) 
        WHEN b.dihadiri_oleh = 3 THEN (SELECT MAX(ppp2.tanggal_pemberitahuan_putusan) 
                                      FROM perkara_putusan_pemberitahuan_putusan ppp2 
                                      WHERE ppp2.perkara_id = a.perkara_id AND ppp2.pihak = 1)
        WHEN b.dihadiri_oleh = 2 THEN (SELECT MAX(ppp3.tanggal_pemberitahuan_putusan) 
                                      FROM perkara_putusan_pemberitahuan_putusan ppp3 
                                      WHERE ppp3.perkara_id = a.perkara_id AND ppp3.pihak = 2)
        WHEN b.dihadiri_oleh = 1 OR a.status_putusan_id IN(65,66,67) THEN a.tanggal_putusan
        ELSE NULL 
    END, INTERVAL 15 DAY) AS bht,

    -- Kepatuhan pengisian BHT
    CASE
        WHEN a.tanggal_bht IS NOT NULL THEN 5
        ELSE 0
    END AS nilai

  FROM 
      v_perkara a
  JOIN 
      perkara_jadwal_sidang b ON a.perkara_id = b.perkara_id 
                              AND b.tanggal_sidang = a.tanggal_putusan 
                              AND b.dihadiri_oleh IS NOT NULL 
  WHERE 
      a.tahapan_terakhir_id = 15 
      AND YEAR(a.tanggal_putusan) = YEAR(CURDATE())
      AND CASE 
          WHEN b.dihadiri_oleh = 4 THEN (SELECT MAX(ppp1.tanggal_pemberitahuan_putusan) 
                                        FROM perkara_putusan_pemberitahuan_putusan ppp1 
                                        WHERE ppp1.perkara_id = a.perkara_id) 
          WHEN b.dihadiri_oleh = 3 THEN (SELECT MAX(ppp2.tanggal_pemberitahuan_putusan) 
                                        FROM perkara_putusan_pemberitahuan_putusan ppp2 
                                        WHERE ppp2.perkara_id = a.perkara_id AND ppp2.pihak = 1)
          WHEN b.dihadiri_oleh = 2 THEN (SELECT MAX(ppp3.tanggal_pemberitahuan_putusan) 
                                        FROM perkara_putusan_pemberitahuan_putusan ppp3 
                                        WHERE ppp3.perkara_id = a.perkara_id AND ppp3.pihak = 2)
          WHEN b.dihadiri_oleh = 1 OR a.status_putusan_id IN(65,66,67) THEN a.tanggal_putusan
          ELSE NULL 
      END < DATE_SUB(CURDATE(), INTERVAL 15 DAY)
      AND CASE
        WHEN a.tanggal_bht IS NOT NULL THEN 5
        ELSE 0
      END != 5 -- Tidak termasuk nilai 5
      
  ORDER BY 
      nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`

    db.query(queryFilter, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama}\nPutusan : ${r.status_putusan_kode}\nTanggal PBT : ${r.pbt}\nTanggal BHT : ${r.bht}\nNilai : ${r.nilai}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

//PENCATATAN SISA PANJAR BIAYA PERKARA
const getDataPencatatanSisaPanjarBiaya = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT DISTINCT
    a.nomor_perkara,
    a.jenis_perkara_nama,
    u.diinput_oleh,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    CASE 
        WHEN DATEDIFF(u.diinput_tanggal, u.tanggal_transaksi) = 0 
        THEN 'Hari ini' 
        ELSE CONCAT(DATEDIFF(u.diinput_tanggal, u.tanggal_transaksi), ' hari')
    END AS durasi,
    CASE
      WHEN DATEDIFF(u.diinput_tanggal, u.tanggal_transaksi) = 0 THEN 5
      WHEN DATEDIFF(u.diinput_tanggal, u.tanggal_transaksi) = 1 THEN 3
      WHEN DATEDIFF(u.diinput_tanggal, u.tanggal_transaksi) = 2 THEN 2
      WHEN DATEDIFF(u.diinput_tanggal, u.tanggal_transaksi) = 3 THEN 1
      ELSE 0
    END AS nilai
  FROM perkara a
  LEFT JOIN perkara_putusan AS d ON a.perkara_id = d.perkara_id
  LEFT JOIN perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
  LEFT JOIN perkara_biaya AS u ON a.perkara_id = u.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
  LEFT JOIN perkara_proses AS q ON a.perkara_id = q.perkara_id
  WHERE YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE()) 
    AND q.tahapan_id = 15
    AND q.proses_id = 220
    AND DATEDIFF(u.diinput_tanggal, u.tanggal_transaksi) >= 0
    AND u.kategori_id = 2
  ORDER BY nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`;
  
    //PERKARA DIBAWAH NILAI 5 YANG TELAH DI FILTER
    let queryFilter = `SELECT DISTINCT
    a.nomor_perkara,
    a.jenis_perkara_nama,
    u.diinput_oleh,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    CASE 
        WHEN DATEDIFF(u.diinput_tanggal, u.tanggal_transaksi) = 0 
        THEN 'Hari ini' 
        ELSE CONCAT(DATEDIFF(u.diinput_tanggal, u.tanggal_transaksi), ' hari')
    END AS durasi,
    CASE
      WHEN DATEDIFF(u.diinput_tanggal, u.tanggal_transaksi) = 0 THEN 5
      WHEN DATEDIFF(u.diinput_tanggal, u.tanggal_transaksi) = 1 THEN 3
      WHEN DATEDIFF(u.diinput_tanggal, u.tanggal_transaksi) = 2 THEN 2
      WHEN DATEDIFF(u.diinput_tanggal, u.tanggal_transaksi) = 3 THEN 1
      ELSE 0
    END AS nilai
  FROM perkara a
  LEFT JOIN perkara_putusan AS d ON a.perkara_id = d.perkara_id
  LEFT JOIN perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
  LEFT JOIN perkara_biaya AS u ON a.perkara_id = u.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
  LEFT JOIN perkara_proses AS q ON a.perkara_id = q.perkara_id
  WHERE YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE()) 
    AND q.tahapan_id = 15
    AND q.proses_id = 220
    AND DATEDIFF(u.diinput_tanggal, u.tanggal_transaksi) >= 0
    AND u.kategori_id = 2
    AND CASE
      WHEN DATEDIFF(u.diinput_tanggal, u.tanggal_transaksi) = 0 THEN 5
      WHEN DATEDIFF(u.diinput_tanggal, u.tanggal_transaksi) = 1 THEN 3
      WHEN DATEDIFF(u.diinput_tanggal, u.tanggal_transaksi) = 2 THEN 2
      WHEN DATEDIFF(u.diinput_tanggal, u.tanggal_transaksi) = 3 THEN 1
      ELSE 0
    END != 5 -- Mengecualikan nilai 5
  ORDER BY nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`

    db.query(queryFilter, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama} ${r.ecourt} ${r.ghaib}\nDiinput oleh : ${r.diinput_oleh}\nDurasi : ${r.durasi}\nNilai : ${r.nilai}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

//PENGIPUTAN DATA ARSIP (PERLU DICEK KEMBALI)
const getDataPengisianDataArsip = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT 
    a.perkara_id, 
    a.nomor_perkara, 
    a.jenis_perkara_nama,
		a.status_putusan_kode,
    CASE 
        WHEN b.dihadiri_oleh = 4 THEN (SELECT MAX(ppp1.tanggal_pemberitahuan_putusan) 
                                      FROM perkara_putusan_pemberitahuan_putusan ppp1 
                                      WHERE ppp1.perkara_id = a.perkara_id) 
        WHEN b.dihadiri_oleh = 3 THEN (SELECT MAX(ppp2.tanggal_pemberitahuan_putusan) 
                                      FROM perkara_putusan_pemberitahuan_putusan ppp2 
                                      WHERE ppp2.perkara_id = a.perkara_id AND ppp2.pihak = 1)
        WHEN b.dihadiri_oleh = 2 THEN (SELECT MAX(ppp3.tanggal_pemberitahuan_putusan) 
                                      FROM perkara_putusan_pemberitahuan_putusan ppp3 
                                      WHERE ppp3.perkara_id = a.perkara_id AND ppp3.pihak = 2)
        WHEN b.dihadiri_oleh = 1 OR a.status_putusan_id IN(65,66,67) THEN a.tanggal_putusan
        ELSE NULL 
    END AS pbt,

    -- Menambahkan 15 hari dari pbt untuk menghasilkan bht
    DATE_ADD(CASE 
        WHEN b.dihadiri_oleh = 4 THEN (SELECT MAX(ppp1.tanggal_pemberitahuan_putusan) 
                                      FROM perkara_putusan_pemberitahuan_putusan ppp1 
                                      WHERE ppp1.perkara_id = a.perkara_id) 
        WHEN b.dihadiri_oleh = 3 THEN (SELECT MAX(ppp2.tanggal_pemberitahuan_putusan) 
                                      FROM perkara_putusan_pemberitahuan_putusan ppp2 
                                      WHERE ppp2.perkara_id = a.perkara_id AND ppp2.pihak = 1)
        WHEN b.dihadiri_oleh = 2 THEN (SELECT MAX(ppp3.tanggal_pemberitahuan_putusan) 
                                      FROM perkara_putusan_pemberitahuan_putusan ppp3 
                                      WHERE ppp3.perkara_id = a.perkara_id AND ppp3.pihak = 2)
        WHEN b.dihadiri_oleh = 1 OR a.status_putusan_id IN(65,66,67) THEN a.tanggal_putusan
        ELSE NULL 
    END, INTERVAL 15 DAY) AS bht,

    -- Kepatuhan pengisian BHT
    CASE
        WHEN a.tanggal_bht IS NOT NULL THEN 5
        ELSE 0
    END AS nilai

  FROM 
      v_perkara a
  JOIN 
      perkara_jadwal_sidang b ON a.perkara_id = b.perkara_id 
                              AND b.tanggal_sidang = a.tanggal_putusan 
                              AND b.dihadiri_oleh IS NOT NULL 
  WHERE 
      a.tahapan_terakhir_id = 15 
      AND YEAR(a.tanggal_putusan) = YEAR(CURDATE())
      AND CASE 
          WHEN b.dihadiri_oleh = 4 THEN (SELECT MAX(ppp1.tanggal_pemberitahuan_putusan) 
                                        FROM perkara_putusan_pemberitahuan_putusan ppp1 
                                        WHERE ppp1.perkara_id = a.perkara_id) 
          WHEN b.dihadiri_oleh = 3 THEN (SELECT MAX(ppp2.tanggal_pemberitahuan_putusan) 
                                        FROM perkara_putusan_pemberitahuan_putusan ppp2 
                                        WHERE ppp2.perkara_id = a.perkara_id AND ppp2.pihak = 1)
          WHEN b.dihadiri_oleh = 2 THEN (SELECT MAX(ppp3.tanggal_pemberitahuan_putusan) 
                                        FROM perkara_putusan_pemberitahuan_putusan ppp3 
                                        WHERE ppp3.perkara_id = a.perkara_id AND ppp3.pihak = 2)
          WHEN b.dihadiri_oleh = 1 OR a.status_putusan_id IN(65,66,67) THEN a.tanggal_putusan
          ELSE NULL 
      END < DATE_SUB(CURDATE(), INTERVAL 15 DAY)
      
  ORDER BY 
      nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`;

    //PERKARA DIBAWAH NILAI 5 YANG TELAH DI FILTER
    let queryFilter = `SELECT 
    a.perkara_id, 
    a.nomor_perkara, 
    a.jenis_perkara_nama,
    a.status_putusan_kode,
    CASE 
        WHEN b.dihadiri_oleh = 4 THEN (SELECT MAX(ppp1.tanggal_pemberitahuan_putusan) 
                                      FROM perkara_putusan_pemberitahuan_putusan ppp1 
                                      WHERE ppp1.perkara_id = a.perkara_id) 
        WHEN b.dihadiri_oleh = 3 THEN (SELECT MAX(ppp2.tanggal_pemberitahuan_putusan) 
                                      FROM perkara_putusan_pemberitahuan_putusan ppp2 
                                      WHERE ppp2.perkara_id = a.perkara_id AND ppp2.pihak = 1)
        WHEN b.dihadiri_oleh = 2 THEN (SELECT MAX(ppp3.tanggal_pemberitahuan_putusan) 
                                      FROM perkara_putusan_pemberitahuan_putusan ppp3 
                                      WHERE ppp3.perkara_id = a.perkara_id AND ppp3.pihak = 2)
        WHEN b.dihadiri_oleh = 1 OR a.status_putusan_id IN(65,66,67) THEN a.tanggal_putusan
        ELSE NULL 
    END AS pbt,

    -- Menambahkan 15 hari dari pbt untuk menghasilkan bht
    DATE_ADD(CASE 
        WHEN b.dihadiri_oleh = 4 THEN (SELECT MAX(ppp1.tanggal_pemberitahuan_putusan) 
                                      FROM perkara_putusan_pemberitahuan_putusan ppp1 
                                      WHERE ppp1.perkara_id = a.perkara_id) 
        WHEN b.dihadiri_oleh = 3 THEN (SELECT MAX(ppp2.tanggal_pemberitahuan_putusan) 
                                      FROM perkara_putusan_pemberitahuan_putusan ppp2 
                                      WHERE ppp2.perkara_id = a.perkara_id AND ppp2.pihak = 1)
        WHEN b.dihadiri_oleh = 2 THEN (SELECT MAX(ppp3.tanggal_pemberitahuan_putusan) 
                                      FROM perkara_putusan_pemberitahuan_putusan ppp3 
                                      WHERE ppp3.perkara_id = a.perkara_id AND ppp3.pihak = 2)
        WHEN b.dihadiri_oleh = 1 OR a.status_putusan_id IN(65,66,67) THEN a.tanggal_putusan
        ELSE NULL 
    END, INTERVAL 15 DAY) AS bht,

    -- Kepatuhan pengisian BHT
    CASE
        WHEN a.tanggal_bht IS NOT NULL THEN 5
        ELSE 0
    END AS nilai

  FROM 
      v_perkara a
  JOIN 
      perkara_jadwal_sidang b ON a.perkara_id = b.perkara_id 
                              AND b.tanggal_sidang = a.tanggal_putusan 
                              AND b.dihadiri_oleh IS NOT NULL 
  WHERE 
      a.tahapan_terakhir_id = 15 
      AND YEAR(a.tanggal_putusan) = YEAR(CURDATE())
      AND CASE 
          WHEN b.dihadiri_oleh = 4 THEN (SELECT MAX(ppp1.tanggal_pemberitahuan_putusan) 
                                        FROM perkara_putusan_pemberitahuan_putusan ppp1 
                                        WHERE ppp1.perkara_id = a.perkara_id) 
          WHEN b.dihadiri_oleh = 3 THEN (SELECT MAX(ppp2.tanggal_pemberitahuan_putusan) 
                                        FROM perkara_putusan_pemberitahuan_putusan ppp2 
                                        WHERE ppp2.perkara_id = a.perkara_id AND ppp2.pihak = 1)
          WHEN b.dihadiri_oleh = 2 THEN (SELECT MAX(ppp3.tanggal_pemberitahuan_putusan) 
                                        FROM perkara_putusan_pemberitahuan_putusan ppp3 
                                        WHERE ppp3.perkara_id = a.perkara_id AND ppp3.pihak = 2)
          WHEN b.dihadiri_oleh = 1 OR a.status_putusan_id IN(65,66,67) THEN a.tanggal_putusan
          ELSE NULL 
      END < DATE_SUB(CURDATE(), INTERVAL 15 DAY)
      AND CASE
          WHEN a.tanggal_bht IS NOT NULL THEN 5
          ELSE 0
      END != 5 -- Mengecualikan nilai yang sama dengan 5

  ORDER BY 
      nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`

    db.query(queryFilter, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

//PELAKSANAAN PENERIMAAN PANGGILAN / PEMBERITAHUAN DELEGASI
const getDataPenerimaanDelegasi = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT 
    a.perkara_id, 
    a.nomor_perkara, 
    a.jenis_perkara_nama,
		a.status_putusan_kode,
    CASE 
        WHEN b.dihadiri_oleh = 4 THEN (SELECT MAX(ppp1.tanggal_pemberitahuan_putusan) 
                                      FROM perkara_putusan_pemberitahuan_putusan ppp1 
                                      WHERE ppp1.perkara_id = a.perkara_id) 
        WHEN b.dihadiri_oleh = 3 THEN (SELECT MAX(ppp2.tanggal_pemberitahuan_putusan) 
                                      FROM perkara_putusan_pemberitahuan_putusan ppp2 
                                      WHERE ppp2.perkara_id = a.perkara_id AND ppp2.pihak = 1)
        WHEN b.dihadiri_oleh = 2 THEN (SELECT MAX(ppp3.tanggal_pemberitahuan_putusan) 
                                      FROM perkara_putusan_pemberitahuan_putusan ppp3 
                                      WHERE ppp3.perkara_id = a.perkara_id AND ppp3.pihak = 2)
        WHEN b.dihadiri_oleh = 1 OR a.status_putusan_id IN(65,66,67) THEN a.tanggal_putusan
        ELSE NULL 
    END AS pbt,

    -- Menambahkan 15 hari dari pbt untuk menghasilkan bht
    DATE_ADD(CASE 
        WHEN b.dihadiri_oleh = 4 THEN (SELECT MAX(ppp1.tanggal_pemberitahuan_putusan) 
                                      FROM perkara_putusan_pemberitahuan_putusan ppp1 
                                      WHERE ppp1.perkara_id = a.perkara_id) 
        WHEN b.dihadiri_oleh = 3 THEN (SELECT MAX(ppp2.tanggal_pemberitahuan_putusan) 
                                      FROM perkara_putusan_pemberitahuan_putusan ppp2 
                                      WHERE ppp2.perkara_id = a.perkara_id AND ppp2.pihak = 1)
        WHEN b.dihadiri_oleh = 2 THEN (SELECT MAX(ppp3.tanggal_pemberitahuan_putusan) 
                                      FROM perkara_putusan_pemberitahuan_putusan ppp3 
                                      WHERE ppp3.perkara_id = a.perkara_id AND ppp3.pihak = 2)
        WHEN b.dihadiri_oleh = 1 OR a.status_putusan_id IN(65,66,67) THEN a.tanggal_putusan
        ELSE NULL 
    END, INTERVAL 15 DAY) AS bht,

    -- Kepatuhan pengisian BHT
    CASE
        WHEN a.tanggal_bht IS NOT NULL THEN 5
        ELSE 0
    END AS nilai

  FROM 
      v_perkara a
  JOIN 
      perkara_jadwal_sidang b ON a.perkara_id = b.perkara_id 
                              AND b.tanggal_sidang = a.tanggal_putusan 
                              AND b.dihadiri_oleh IS NOT NULL 
  WHERE 
      a.tahapan_terakhir_id = 15 
      AND YEAR(a.tanggal_putusan) = YEAR(CURDATE())
      AND CASE 
          WHEN b.dihadiri_oleh = 4 THEN (SELECT MAX(ppp1.tanggal_pemberitahuan_putusan) 
                                        FROM perkara_putusan_pemberitahuan_putusan ppp1 
                                        WHERE ppp1.perkara_id = a.perkara_id) 
          WHEN b.dihadiri_oleh = 3 THEN (SELECT MAX(ppp2.tanggal_pemberitahuan_putusan) 
                                        FROM perkara_putusan_pemberitahuan_putusan ppp2 
                                        WHERE ppp2.perkara_id = a.perkara_id AND ppp2.pihak = 1)
          WHEN b.dihadiri_oleh = 2 THEN (SELECT MAX(ppp3.tanggal_pemberitahuan_putusan) 
                                        FROM perkara_putusan_pemberitahuan_putusan ppp3 
                                        WHERE ppp3.perkara_id = a.perkara_id AND ppp3.pihak = 2)
          WHEN b.dihadiri_oleh = 1 OR a.status_putusan_id IN(65,66,67) THEN a.tanggal_putusan
          ELSE NULL 
      END < DATE_SUB(CURDATE(), INTERVAL 15 DAY)
      
  ORDER BY 
      nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`;

    //PERKARA DIBAWAH NILAI 5 YANG TELAH DI FILTER
    let queryFilter = `SELECT 
    a.perkara_id, 
    a.nomor_perkara, 
    a.jenis_perkara_nama,
    a.status_putusan_kode,
      CASE 
          WHEN b.dihadiri_oleh = 4 THEN (SELECT MAX(ppp1.tanggal_pemberitahuan_putusan) 
                                        FROM perkara_putusan_pemberitahuan_putusan ppp1 
                                        WHERE ppp1.perkara_id = a.perkara_id) 
          WHEN b.dihadiri_oleh = 3 THEN (SELECT MAX(ppp2.tanggal_pemberitahuan_putusan) 
                                        FROM perkara_putusan_pemberitahuan_putusan ppp2 
                                        WHERE ppp2.perkara_id = a.perkara_id AND ppp2.pihak = 1)
          WHEN b.dihadiri_oleh = 2 THEN (SELECT MAX(ppp3.tanggal_pemberitahuan_putusan) 
                                        FROM perkara_putusan_pemberitahuan_putusan ppp3 
                                        WHERE ppp3.perkara_id = a.perkara_id AND ppp3.pihak = 2)
          WHEN b.dihadiri_oleh = 1 OR a.status_putusan_id IN(65,66,67) THEN a.tanggal_putusan
          ELSE NULL 
      END AS pbt,

      -- Menambahkan 15 hari dari pbt untuk menghasilkan bht
      DATE_ADD(CASE 
          WHEN b.dihadiri_oleh = 4 THEN (SELECT MAX(ppp1.tanggal_pemberitahuan_putusan) 
                                        FROM perkara_putusan_pemberitahuan_putusan ppp1 
                                        WHERE ppp1.perkara_id = a.perkara_id) 
          WHEN b.dihadiri_oleh = 3 THEN (SELECT MAX(ppp2.tanggal_pemberitahuan_putusan) 
                                        FROM perkara_putusan_pemberitahuan_putusan ppp2 
                                        WHERE ppp2.perkara_id = a.perkara_id AND ppp2.pihak = 1)
          WHEN b.dihadiri_oleh = 2 THEN (SELECT MAX(ppp3.tanggal_pemberitahuan_putusan) 
                                        FROM perkara_putusan_pemberitahuan_putusan ppp3 
                                        WHERE ppp3.perkara_id = a.perkara_id AND ppp3.pihak = 2)
          WHEN b.dihadiri_oleh = 1 OR a.status_putusan_id IN(65,66,67) THEN a.tanggal_putusan
          ELSE NULL 
      END, INTERVAL 15 DAY) AS bht,

      -- Kepatuhan pengisian BHT
      CASE
          WHEN a.tanggal_bht IS NOT NULL THEN 5
          ELSE 0
      END AS nilai

    FROM 
        v_perkara a
    JOIN 
        perkara_jadwal_sidang b ON a.perkara_id = b.perkara_id 
                                AND b.tanggal_sidang = a.tanggal_putusan 
                                AND b.dihadiri_oleh IS NOT NULL 
    WHERE 
        a.tahapan_terakhir_id = 15 
        AND YEAR(a.tanggal_putusan) = YEAR(CURDATE())
        AND CASE 
            WHEN b.dihadiri_oleh = 4 THEN (SELECT MAX(ppp1.tanggal_pemberitahuan_putusan) 
                                          FROM perkara_putusan_pemberitahuan_putusan ppp1 
                                          WHERE ppp1.perkara_id = a.perkara_id) 
            WHEN b.dihadiri_oleh = 3 THEN (SELECT MAX(ppp2.tanggal_pemberitahuan_putusan) 
                                          FROM perkara_putusan_pemberitahuan_putusan ppp2 
                                          WHERE ppp2.perkara_id = a.perkara_id AND ppp2.pihak = 1)
            WHEN b.dihadiri_oleh = 2 THEN (SELECT MAX(ppp3.tanggal_pemberitahuan_putusan) 
                                          FROM perkara_putusan_pemberitahuan_putusan ppp3 
                                          WHERE ppp3.perkara_id = a.perkara_id AND ppp3.pihak = 2)
            WHEN b.dihadiri_oleh = 1 OR a.status_putusan_id IN(65,66,67) THEN a.tanggal_putusan
            ELSE NULL 
        END < DATE_SUB(CURDATE(), INTERVAL 15 DAY)
        -- Mengecualikan nilai 5
        AND (CASE
              WHEN a.tanggal_bht IS NOT NULL THEN 5
              ELSE 0
            END) != 5
        
    ORDER BY 
        nilai ASC, a.alur_perkara_id ASC, a.perkara_id ASC;`

    db.query(queryFilter, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJS : ${r.jurusita_nama}\nNilai : ${r.nilai}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

// II. KELENGKAPAN DOKUMEN
//E-DOKUMEN PETITUM/TUNTUTAN
const getDataEdocPetitumTuntutan = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT 
    nomor_perkara,
    jenis_perkara_nama,
    tanggal_pendaftaran,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    CASE 
        WHEN petitum_dok IS NOT NULL AND petitum_dok <> '' THEN 5
        ELSE 0
    END AS nilai
  FROM 
      perkara
      LEFT JOIN perkara_efiling_id AS k ON perkara.perkara_id = k.perkara_id
      LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON perkara.perkara_id = i.perkara_id
  WHERE 
      YEAR(tanggal_pendaftaran) = YEAR(CURDATE()) 
      AND (alur_perkara_id = 15 OR alur_perkara_id = 16 OR alur_perkara_id = 17)
  ORDER BY
      nilai ASC, alur_perkara_id ASC, perkara.perkara_id ASC;`;

    //PERKARA DIBAWAH NILAI 5 YANG TELAH DI FILTER
    let queryFilter = `SELECT 
    nomor_perkara,
    jenis_perkara_nama,
    tanggal_pendaftaran,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    CASE 
        WHEN petitum_dok IS NOT NULL AND petitum_dok <> '' THEN 5
        ELSE 0
    END AS nilai
  FROM 
      perkara
      LEFT JOIN perkara_efiling_id AS k ON perkara.perkara_id = k.perkara_id
      LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON perkara.perkara_id = i.perkara_id
  WHERE 
      YEAR(tanggal_pendaftaran) = YEAR(CURDATE()) 
      AND (alur_perkara_id = 15 OR alur_perkara_id = 16 OR alur_perkara_id = 17)
      -- Mengecualikan nilai 5
      AND (CASE 
              WHEN petitum_dok IS NOT NULL AND petitum_dok <> '' THEN 5
              ELSE 0
          END) != 5
  ORDER BY
      nilai ASC, alur_perkara_id ASC, perkara.perkara_id ASC;`

    db.query(queryFilter, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama} ${r.ecourt} ${r.ghaib}\nTanggal Pendaftaran : ${moment(r.tanggal_pendaftaran).format("DD-MM-YYYY")}\nNilai : ${r.nilai}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

//E-DOKUMEN RELAAS
const getDataEdocRelaas = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT
    perk.nomor_perkara,
    perk.jenis_perkara_nama,
    CASE
        WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)' 
        ELSE ''
    END AS ecourt,
    CASE
        WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
        ELSE ''
    END AS ghaib,
    CASE
        WHEN perk.prodeo = 1 THEN ' (_Prodeo_)'
        ELSE ''
    END AS prodeo,
    (
        SELECT
            GROUP_CONCAT(DISTINCT hkpn.nama_gelar ORDER BY hk.id ASC SEPARATOR ' \n') AS nama_hakim
        FROM
            perkara_hakim_pn AS hk
        JOIN hakim_pn AS hkpn ON hkpn.id = hk.hakim_id
        WHERE
            hk.perkara_id = perk.perkara_id
            AND hk.aktif = 'Y'
        ORDER BY hk.urutan ASC
    ) AS majelis_hakim,
    (
        SELECT
            GROUP_CONCAT(DISTINCT pp.nama ORDER BY ppp.id ASC SEPARATOR '<br>') AS nama_js
        FROM
            perkara_panitera_pn AS ppp
        JOIN panitera_pn AS pp ON pp.id = ppp.panitera_id
        WHERE
            ppp.perkara_id = perk.perkara_id
            AND ppp.aktif = 'Y'
        ORDER BY ppp.urutan ASC
    ) AS panitera_nama,
    (
        SELECT
            GROUP_CONCAT(DISTINCT jspn.nama ORDER BY pjs.id ASC SEPARATOR '<br>') AS nama_js
        FROM
            perkara_jurusita AS pjs
        JOIN jurusita AS jspn ON jspn.id = pjs.jurusita_id
        WHERE
            pjs.perkara_id = perk.perkara_id
            AND pjs.aktif = 'Y'
        ORDER BY pjs.urutan ASC
    ) AS jurusita,

    -- Daftar agenda sidang yang tidak memiliki relaas
    (
        SELECT
            CONCAT('Agenda Sidang: ', GROUP_CONCAT(CONCAT('ke-', sidang.urutan) SEPARATOR ', ')) AS agenda_sidang 
        FROM
            perkara_jadwal_sidang AS sidang
        WHERE
            sidang.perkara_id = perk.perkara_id
            AND sidang.id NOT IN (
                SELECT
                    r.sidang_id
                FROM
                    perkara_pelaksanaan_relaas AS r
                WHERE
                    r.perkara_id = perk.perkara_id
                    AND r.doc_relaas IS NOT NULL
            )
    ) AS agenda_sidang_tanpa_relaas,
    
    -- Perhitungan kelengkapan relaas per nomor_perkara
    CASE
        WHEN total_relaas.jumlah_doc = total_relaas.total_relaas THEN 5 -- Lengkap 100%
        WHEN total_relaas.jumlah_doc >= 0.71 * total_relaas.total_relaas THEN 3 -- Lengkap 71%-99%
        WHEN total_relaas.jumlah_doc >= 0.41 * total_relaas.total_relaas THEN 2 -- Lengkap 41%-70%
        WHEN total_relaas.jumlah_doc >= 0.01 * total_relaas.total_relaas THEN 1 -- Lengkap 1%-40%
        ELSE 0 -- Tidak Ada
    END AS nilai
  FROM
      perkara AS perk
  JOIN perkara_jadwal_sidang AS sidang ON sidang.perkara_id = perk.perkara_id
  JOIN (
      SELECT
          p1.perkara_id,
          p1.pihak_id,
          p1.nama,
          1 AS pihakke,
          'pihak p' AS ketpihak,
          '' AS pengacara_pihak_id
      FROM perkara_pihak1 AS p1
      JOIN perkara ON perkara.perkara_id = p1.perkara_id
      UNION
      SELECT
          p2.perkara_id,
          p2.pihak_id,
          p2.nama,
          2 AS pihakke,
          'pihak t' AS ketpihak,
          '' AS pengacara_pihak_id
      FROM perkara_pihak2 AS p2
      JOIN perkara ON perkara.perkara_id = p2.perkara_id
  ) AS perkarapihak ON perkarapihak.perkara_id = perk.perkara_id
  LEFT JOIN perkara_pelaksanaan_relaas AS datarelaas ON datarelaas.pihak_id = perkarapihak.pihak_id
  AND datarelaas.perkara_id = perk.perkara_id
  AND datarelaas.sidang_id = sidang.id
  LEFT JOIN perkara_efiling_id AS k ON perk.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON perk.perkara_id = i.perkara_id
  LEFT JOIN (
      SELECT
          perkara_id,
          COUNT(doc_relaas) AS jumlah_doc,
          (SELECT COUNT(*) FROM perkara_pelaksanaan_relaas WHERE perkara_id = r.perkara_id) AS total_relaas
      FROM perkara_pelaksanaan_relaas AS r
      GROUP BY perkara_id
  ) AS total_relaas ON total_relaas.perkara_id = perk.perkara_id
  WHERE
      YEAR(perk.tanggal_pendaftaran) = YEAR(CURDATE())
  GROUP BY
      perk.perkara_id
  ORDER BY
      nilai ASC, perk.alur_perkara_id ASC, perk.perkara_id ASC;`;

    //PERKARA DIBAWAH NILAI 5 YANG TELAH DI FILTER
    let queryFilter = `SELECT
    perk.nomor_perkara,
    perk.jenis_perkara_nama,
    CASE
        WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)' 
        ELSE ''
    END AS ecourt,
    CASE
        WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
        ELSE ''
    END AS ghaib,
    CASE
        WHEN perk.prodeo = 1 THEN ' (_Prodeo_)'
        ELSE ''
    END AS prodeo,
    (
        SELECT
            GROUP_CONCAT(DISTINCT hkpn.nama_gelar ORDER BY hk.id ASC SEPARATOR ' \n') AS nama_hakim
        FROM
            perkara_hakim_pn AS hk
        JOIN hakim_pn AS hkpn ON hkpn.id = hk.hakim_id
        WHERE
            hk.perkara_id = perk.perkara_id
            AND hk.aktif = 'Y'
        ORDER BY hk.urutan ASC
    ) AS majelis_hakim,
    (
        SELECT
            GROUP_CONCAT(DISTINCT pp.nama ORDER BY ppp.id ASC SEPARATOR '<br>') AS nama_js
        FROM
            perkara_panitera_pn AS ppp
        JOIN panitera_pn AS pp ON pp.id = ppp.panitera_id
        WHERE
            ppp.perkara_id = perk.perkara_id
            AND ppp.aktif = 'Y'
        ORDER BY ppp.urutan ASC
    ) AS panitera_nama,
    (
        SELECT
            GROUP_CONCAT(DISTINCT jspn.nama ORDER BY pjs.id ASC SEPARATOR '<br>') AS nama_js
        FROM
            perkara_jurusita AS pjs
        JOIN jurusita AS jspn ON jspn.id = pjs.jurusita_id
        WHERE
            pjs.perkara_id = perk.perkara_id
            AND pjs.aktif = 'Y'
        ORDER BY pjs.urutan ASC
    ) AS jurusita,

		-- Daftar agenda sidang yang tidak memiliki relaas
    (
        SELECT
            CONCAT('Agenda Sidang: ', GROUP_CONCAT(CONCAT('ke-', sidang.urutan) SEPARATOR ', ')) AS agenda_sidang 
        FROM
            perkara_jadwal_sidang AS sidang
        WHERE
            sidang.perkara_id = perk.perkara_id
            AND sidang.id NOT IN (
                SELECT
                    r.sidang_id
                FROM
                    perkara_pelaksanaan_relaas AS r
                WHERE
                    r.perkara_id = perk.perkara_id
                    AND r.doc_relaas IS NOT NULL
            )
    ) AS agenda_sidang_tanpa_relaas,
		
    -- Perhitungan kelengkapan relaas per nomor_perkara
    CASE
        WHEN total_relaas.jumlah_doc = total_relaas.total_relaas THEN 5 -- Lengkap 100%
        WHEN total_relaas.jumlah_doc >= 0.71 * total_relaas.total_relaas THEN 3 -- Lengkap 71%-99%
        WHEN total_relaas.jumlah_doc >= 0.41 * total_relaas.total_relaas THEN 2 -- Lengkap 41%-70%
        WHEN total_relaas.jumlah_doc >= 0.01 * total_relaas.total_relaas THEN 1 -- Lengkap 1%-40%
        ELSE 0 -- Tidak Ada
    END AS nilai

  FROM
      perkara AS perk
  JOIN perkara_jadwal_sidang AS sidang ON sidang.perkara_id = perk.perkara_id
  JOIN (
      SELECT
          p1.perkara_id,
          p1.pihak_id,
          p1.nama,
          1 AS pihakke,
          'pihak p' AS ketpihak,
          '' AS pengacara_pihak_id
      FROM perkara_pihak1 AS p1
      JOIN perkara ON perkara.perkara_id = p1.perkara_id
      UNION
      SELECT
          p2.perkara_id,
          p2.pihak_id,
          p2.nama,
          2 AS pihakke,
          'pihak t' AS ketpihak,
          '' AS pengacara_pihak_id
      FROM perkara_pihak2 AS p2
      JOIN perkara ON perkara.perkara_id = p2.perkara_id
  ) AS perkarapihak ON perkarapihak.perkara_id = perk.perkara_id
  LEFT JOIN perkara_pelaksanaan_relaas AS datarelaas ON datarelaas.pihak_id = perkarapihak.pihak_id
  AND datarelaas.perkara_id = perk.perkara_id
  AND datarelaas.sidang_id = sidang.id
  LEFT JOIN perkara_efiling_id AS k ON perk.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON perk.perkara_id = i.perkara_id
  LEFT JOIN (
      SELECT
          perkara_id,
          COUNT(doc_relaas) AS jumlah_doc,
          (SELECT COUNT(*) FROM perkara_pelaksanaan_relaas WHERE perkara_id = r.perkara_id) AS total_relaas
      FROM perkara_pelaksanaan_relaas AS r
      GROUP BY perkara_id
  ) AS total_relaas ON total_relaas.perkara_id = perk.perkara_id
  WHERE
      YEAR(perk.tanggal_pendaftaran) = YEAR(CURDATE())
      AND (
          CASE
              WHEN total_relaas.jumlah_doc = total_relaas.total_relaas THEN 5
              WHEN total_relaas.jumlah_doc >= 0.71 * total_relaas.total_relaas THEN 3
              WHEN total_relaas.jumlah_doc >= 0.41 * total_relaas.total_relaas THEN 2
              WHEN total_relaas.jumlah_doc >= 0.01 * total_relaas.total_relaas THEN 1
              ELSE 0
          END
      ) != 5 -- Mengecualikan baris dengan nilai 5
  GROUP BY
      perk.perkara_id
  ORDER BY
      nilai ASC, perk.alur_perkara_id ASC, perk.perkara_id ASC;`

    db.query(queryFilter, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama} ${r.ecourt} ${r.ghaib}\nNilai : ${r.nilai}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

//E-DOKUMEN BAS (masih perlu diperbaiki)
const getDataEdocBas = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT DISTINCT 
    perkara.perkara_id, 
    perkara.nomor_perkara,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    MAX(perkara_jadwal_sidang.diperbaharui_tanggal) AS diperbaharui_tanggal_terakhir, -- Update terakhir berdasarkan tanggal input
    perkara_jadwal_sidang.tanggal_sidang,
    perkara_jadwal_sidang.agenda,
    perkara_panitera_pn.panitera_nama,
    perkara_jadwal_sidang.edoc_bas,
    perkara_jadwal_sidang.diperbaharui_oleh,
    DATEDIFF(MAX(perkara_jadwal_sidang.diperbaharui_tanggal), perkara_jadwal_sidang.tanggal_sidang) AS durasi, -- Durasi antara tanggal sidang dan update terakhir
    CASE
        WHEN DATEDIFF(MAX(perkara_jadwal_sidang.diperbaharui_tanggal), perkara_jadwal_sidang.tanggal_sidang) = 0 THEN 5
        WHEN DATEDIFF(MAX(perkara_jadwal_sidang.diperbaharui_tanggal), perkara_jadwal_sidang.tanggal_sidang) = 1 THEN 4
        WHEN DATEDIFF(MAX(perkara_jadwal_sidang.diperbaharui_tanggal), perkara_jadwal_sidang.tanggal_sidang) = 2 THEN 3
        WHEN DATEDIFF(MAX(perkara_jadwal_sidang.diperbaharui_tanggal), perkara_jadwal_sidang.tanggal_sidang) = 3 THEN 2
        WHEN DATEDIFF(MAX(perkara_jadwal_sidang.diperbaharui_tanggal), perkara_jadwal_sidang.tanggal_sidang) = 4 THEN 1
        ELSE 0
    END AS nilai -- Nilai sesuai dengan kriteria kelengkapan
  FROM perkara
  LEFT JOIN perkara_jadwal_sidang 
      ON perkara.perkara_id = perkara_jadwal_sidang.perkara_id
  LEFT JOIN perkara_panitera_pn 
      ON perkara.perkara_id = perkara_panitera_pn.perkara_id
  LEFT JOIN perkara_hakim_pn 
      ON perkara.perkara_id = perkara_hakim_pn.perkara_id
  LEFT JOIN perkara_efiling_id AS k ON perkara.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON perkara.perkara_id = i.perkara_id
  WHERE (alur_perkara_id IN (15, 16, 17))
    AND YEAR(perkara.tanggal_pendaftaran) = YEAR(NOW())
    AND perkara_jadwal_sidang.tanggal_sidang < CURDATE()
    AND perkara_panitera_pn.aktif = 'Y'
		AND proses_terakhir_id <= 220
  GROUP BY perkara.perkara_id, perkara.nomor_perkara, perkara_jadwal_sidang.tanggal_sidang, perkara_jadwal_sidang.agenda, perkara_panitera_pn.panitera_nama, perkara_jadwal_sidang.edoc_bas, perkara_jadwal_sidang.diperbaharui_oleh
  ORDER BY nilai ASC, perkara.alur_perkara_id ASC, perkara.perkara_id ASC;`;

    //PERKARA DIBAWAH NILAI 5 YANG TELAH DI FILTER
    let queryFilter = `SELECT DISTINCT 
    perkara.perkara_id, 
    perkara.nomor_perkara,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    MAX(perkara_jadwal_sidang.diperbaharui_tanggal) AS diperbaharui_tanggal_terakhir, -- Update terakhir berdasarkan tanggal input
    perkara_jadwal_sidang.tanggal_sidang,
    perkara_jadwal_sidang.agenda,
    perkara_panitera_pn.panitera_nama,
    perkara_jadwal_sidang.edoc_bas,
    perkara_jadwal_sidang.diperbaharui_oleh,
    DATEDIFF(MAX(perkara_jadwal_sidang.diperbaharui_tanggal), perkara_jadwal_sidang.tanggal_sidang) AS durasi, -- Durasi antara tanggal sidang dan update terakhir
    CASE
        WHEN DATEDIFF(MAX(perkara_jadwal_sidang.diperbaharui_tanggal), perkara_jadwal_sidang.tanggal_sidang) = 0 THEN 5
        WHEN DATEDIFF(MAX(perkara_jadwal_sidang.diperbaharui_tanggal), perkara_jadwal_sidang.tanggal_sidang) = 1 THEN 4
        WHEN DATEDIFF(MAX(perkara_jadwal_sidang.diperbaharui_tanggal), perkara_jadwal_sidang.tanggal_sidang) = 2 THEN 3
        WHEN DATEDIFF(MAX(perkara_jadwal_sidang.diperbaharui_tanggal), perkara_jadwal_sidang.tanggal_sidang) = 3 THEN 2
        WHEN DATEDIFF(MAX(perkara_jadwal_sidang.diperbaharui_tanggal), perkara_jadwal_sidang.tanggal_sidang) = 4 THEN 1
        ELSE 0
    END AS nilai -- Nilai sesuai dengan kriteria kelengkapan
  FROM perkara
  LEFT JOIN perkara_jadwal_sidang 
      ON perkara.perkara_id = perkara_jadwal_sidang.perkara_id
  LEFT JOIN perkara_panitera_pn 
      ON perkara.perkara_id = perkara_panitera_pn.perkara_id
  LEFT JOIN perkara_hakim_pn 
      ON perkara.perkara_id = perkara_hakim_pn.perkara_id
  LEFT JOIN perkara_efiling_id AS k 
      ON perkara.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i 
      ON perkara.perkara_id = i.perkara_id
  WHERE (alur_perkara_id IN (15, 16, 17))
    AND YEAR(perkara.tanggal_pendaftaran) = YEAR(NOW())
    AND perkara_jadwal_sidang.tanggal_sidang < CURDATE()
    AND perkara_panitera_pn.aktif = 'Y'
    AND proses_terakhir_id <= 220
  GROUP BY perkara.perkara_id, perkara.nomor_perkara, perkara_jadwal_sidang.tanggal_sidang, perkara_jadwal_sidang.agenda, perkara_panitera_pn.panitera_nama, perkara_jadwal_sidang.edoc_bas, perkara_jadwal_sidang.diperbaharui_oleh
  HAVING 
      CASE
          WHEN DATEDIFF(MAX(perkara_jadwal_sidang.diperbaharui_tanggal), perkara_jadwal_sidang.tanggal_sidang) = 0 THEN 5
          WHEN DATEDIFF(MAX(perkara_jadwal_sidang.diperbaharui_tanggal), perkara_jadwal_sidang.tanggal_sidang) = 1 THEN 4
          WHEN DATEDIFF(MAX(perkara_jadwal_sidang.diperbaharui_tanggal), perkara_jadwal_sidang.tanggal_sidang) = 2 THEN 3
          WHEN DATEDIFF(MAX(perkara_jadwal_sidang.diperbaharui_tanggal), perkara_jadwal_sidang.tanggal_sidang) = 3 THEN 2
          WHEN DATEDIFF(MAX(perkara_jadwal_sidang.diperbaharui_tanggal), perkara_jadwal_sidang.tanggal_sidang) = 4 THEN 1
          ELSE 0
      END <> 5
  ORDER BY nilai ASC, perkara.alur_perkara_id ASC, perkara.perkara_id ASC;`

    db.query(queryFilter, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama} ${r.ecourt} ${r.ghaib}\nDiinput oleh : ${r.diinput_oleh}\nDurasi : ${r.durasi}\nNilai : ${r.nilai}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

//E-DOKUMEN AKTA CERAI (AC) (ganti datediff 1 ke 0 apabila ternyata hari yang sama bht dihitung 5)
const getDataEdocAc = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT 
    perkara.nomor_perkara,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    tgl_akta_cerai, 
    perkara.jenis_perkara_nama,  
    v_perkara.tanggal_bht,
    DATEDIFF(tgl_akta_cerai, v_perkara.tanggal_bht) AS durasi,
    CASE
        WHEN DATEDIFF(tgl_akta_cerai, v_perkara.tanggal_bht) = 0 THEN 5
        WHEN DATEDIFF(tgl_akta_cerai, v_perkara.tanggal_bht) = 1 THEN 5
        WHEN DATEDIFF(tgl_akta_cerai, v_perkara.tanggal_bht) = 2 THEN 4
        WHEN DATEDIFF(tgl_akta_cerai, v_perkara.tanggal_bht) = 3 THEN 3
        WHEN DATEDIFF(tgl_akta_cerai, v_perkara.tanggal_bht) = 4 THEN 2
        WHEN DATEDIFF(tgl_akta_cerai, v_perkara.tanggal_bht) IN (5, 6) THEN 1
        ELSE 0 -- Jika lebih dari 6 hari atau belum ada data akta cerai
    END AS nilai
  FROM 
      perkara_akta_cerai 
  JOIN 
      perkara ON perkara.perkara_id = perkara_akta_cerai.perkara_id
  JOIN 
      v_perkara ON perkara.perkara_id = v_perkara.perkara_id
  LEFT JOIN perkara_efiling_id AS k 
      ON perkara.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i 
      ON perkara.perkara_id = i.perkara_id
  WHERE 
      tgl_akta_cerai BETWEEN DATE_SUB(CURDATE(), INTERVAL 3 YEAR) AND CURDATE()
      AND (perkara.alur_perkara_id = 15 OR perkara.alur_perkara_id = 16 OR perkara.alur_perkara_id = 17)
  ORDER BY 
      CASE 
          WHEN YEAR(tgl_akta_cerai) = YEAR(CURDATE()) THEN 0
          ELSE 1
      END, 
      nilai ASC, perkara.alur_perkara_id ASC, perkara.perkara_id ASC;`;

    //PERKARA DIBAWAH NILAI 5 YANG TELAH DI FILTER
    let queryFilter = `SELECT 
    perkara.nomor_perkara,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    tgl_akta_cerai, 
    perkara.jenis_perkara_nama,  
    v_perkara.tanggal_bht,
    DATEDIFF(tgl_akta_cerai, v_perkara.tanggal_bht) AS durasi,
    CASE
        WHEN DATEDIFF(tgl_akta_cerai, v_perkara.tanggal_bht) = 0 THEN 5
        WHEN DATEDIFF(tgl_akta_cerai, v_perkara.tanggal_bht) = 1 THEN 5
        WHEN DATEDIFF(tgl_akta_cerai, v_perkara.tanggal_bht) = 2 THEN 4
        WHEN DATEDIFF(tgl_akta_cerai, v_perkara.tanggal_bht) = 3 THEN 3
        WHEN DATEDIFF(tgl_akta_cerai, v_perkara.tanggal_bht) = 4 THEN 2
        WHEN DATEDIFF(tgl_akta_cerai, v_perkara.tanggal_bht) IN (5, 6) THEN 1
        ELSE 0 -- Jika lebih dari 6 hari atau belum ada data akta cerai
    END AS nilai
  FROM 
      perkara_akta_cerai 
  JOIN 
      perkara ON perkara.perkara_id = perkara_akta_cerai.perkara_id
  JOIN 
      v_perkara ON perkara.perkara_id = v_perkara.perkara_id
  LEFT JOIN perkara_efiling_id AS k 
      ON perkara.perkara_id = k.perkara_id
  LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i 
      ON perkara.perkara_id = i.perkara_id
  WHERE 
      tgl_akta_cerai BETWEEN DATE_SUB(CURDATE(), INTERVAL 3 YEAR) AND CURDATE()
      AND (perkara.alur_perkara_id = 15 OR perkara.alur_perkara_id = 16 OR perkara.alur_perkara_id = 17)
      AND DATEDIFF(tgl_akta_cerai, v_perkara.tanggal_bht) NOT IN (0, 1) -- Menghindari nilai 5
  ORDER BY 
      CASE 
          WHEN YEAR(tgl_akta_cerai) = YEAR(CURDATE()) THEN 0
          ELSE 1
      END, 
      nilai ASC, perkara.alur_perkara_id ASC, perkara.perkara_id ASC;`

    db.query(queryFilter, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama} ${r.ecourt} ${r.ghaib}\nDiinput oleh : ${r.diinput_oleh}\nTanggal BHT : ${r.tanggal_bht}\nTanggal AC Terbit : ${r.tgl_akta_cerai}\nDurasi : ${r.durasi}\nNilai : ${r.nilai}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

// III. KESESUAIAN (NILAI PENGURANG)
//DATA AGENDA SIDANG TERAKHIR (PERKARA PUTUS), TANGGAL PUTUSAN DAN TANGGAL SIDANG (masih perlu diperbaiki)
const getDataAgendaSidangTerakhir = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT DISTINCT
    a.perkara_id, 
    a.nomor_perkara, 
    a.jenis_perkara_nama,
		CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    (
        SELECT
            GROUP_CONCAT(DISTINCT hkpn.nama_gelar ORDER BY hk.id ASC SEPARATOR ' \n') AS nama_hakim
        FROM
            perkara_hakim_pn AS hk
        JOIN hakim_pn AS hkpn ON hkpn.id = hk.hakim_id
        WHERE
            hk.perkara_id = a.perkara_id
            AND hk.aktif = 'Y'
        ORDER BY hk.urutan ASC
    ) AS majelis_hakim,
    DATE_FORMAT(subq.tanggal_sidang_terakhir, '%d-%m-%Y') AS tanggal_sidang,
    DATE_FORMAT(m.tanggal_putusan, '%d-%m-%Y') AS tanggal_putusan,
    o.status_putusan_kode,
    DATEDIFF(m.tanggal_putusan, subq.tanggal_sidang_terakhir) AS durasi,
    CASE
        WHEN v.perkara_id IS NOT NULL THEN 0  -- Perkara verzet langsung diberi nilai 0
        WHEN DATEDIFF(m.tanggal_putusan, subq.tanggal_sidang_terakhir) = 0 THEN 0
        WHEN DATEDIFF(m.tanggal_putusan, subq.tanggal_sidang_terakhir) BETWEEN 1 AND 3 THEN -1
        WHEN DATEDIFF(m.tanggal_putusan, subq.tanggal_sidang_terakhir) = 4 THEN -2
        WHEN DATEDIFF(m.tanggal_putusan, subq.tanggal_sidang_terakhir) = 5 THEN -3
        WHEN DATEDIFF(m.tanggal_putusan, subq.tanggal_sidang_terakhir) >= 6 THEN -5
        ELSE NULL
    END AS nilai
  FROM 
      v_pihak_perkara a
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
      LEFT JOIN (
          SELECT 
              perkara_id, 
              MAX(tanggal_sidang) AS tanggal_sidang_terakhir
          FROM 
              perkara_jadwal_sidang
          GROUP BY 
              perkara_id
      ) AS subq ON c.perkara_id = subq.perkara_id
      LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
      LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
      JOIN perkara_putusan m ON m.perkara_id = c.perkara_id
      LEFT JOIN perkara_verzet v ON v.perkara_id = c.perkara_id
      LEFT JOIN perkara_hakim_pn n ON n.perkara_id = c.perkara_id
      LEFT JOIN v_perkara o ON o.perkara_id = c.perkara_id
      LEFT JOIN
        perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
      LEFT JOIN 
        (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
  WHERE 
      YEAR(m.tanggal_putusan) = YEAR(CURDATE())
      AND c.alur_perkara_id IN (15, 16, 17)
      AND (
          (c.jenis_perkara_id <> 346)  -- Mengabaikan talak kabul
          OR (c.jenis_perkara_id = 346 AND f.status_putusan_id <> 62)  -- Termasuk talak kabul yang tidak sesuai syarat
      )
      AND (v.tanggal_pendaftaran_verzet IS NULL OR v.tanggal_pendaftaran_verzet IS NOT NULL);
  ORDER BY
      nilai ASC, c.alur_perkara_id ASC, c.perkara_id ASC;`;

    //PERKARA DIBAWAH NILAI 0 YANG TELAH DI FILTER (YANG MINUS)
    let queryFilter = `SELECT DISTINCT
    a.perkara_id, 
    a.nomor_perkara, 
    a.jenis_perkara_nama,
		CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    (
        SELECT
            GROUP_CONCAT(DISTINCT hkpn.nama_gelar ORDER BY hk.id ASC SEPARATOR ' \n') AS nama_hakim
        FROM
            perkara_hakim_pn AS hk
        JOIN hakim_pn AS hkpn ON hkpn.id = hk.hakim_id
        WHERE
            hk.perkara_id = a.perkara_id
            AND hk.aktif = 'Y'
        ORDER BY hk.urutan ASC
    ) AS majelis_hakim,
    DATE_FORMAT(subq.tanggal_sidang_terakhir, '%d-%m-%Y') AS tanggal_sidang,
    DATE_FORMAT(m.tanggal_putusan, '%d-%m-%Y') AS tanggal_putusan,
    o.status_putusan_kode,
    DATEDIFF(m.tanggal_putusan, subq.tanggal_sidang_terakhir) AS durasi,
    CASE
        WHEN v.perkara_id IS NOT NULL THEN 0  -- Perkara verzet langsung diberi nilai 0
        WHEN DATEDIFF(m.tanggal_putusan, subq.tanggal_sidang_terakhir) = 0 THEN 0
        WHEN DATEDIFF(m.tanggal_putusan, subq.tanggal_sidang_terakhir) BETWEEN 1 AND 3 THEN -1
        WHEN DATEDIFF(m.tanggal_putusan, subq.tanggal_sidang_terakhir) = 4 THEN -2
        WHEN DATEDIFF(m.tanggal_putusan, subq.tanggal_sidang_terakhir) = 5 THEN -3
        WHEN DATEDIFF(m.tanggal_putusan, subq.tanggal_sidang_terakhir) >= 6 THEN -5
        ELSE NULL
    END AS nilai
    FROM 
        v_pihak_perkara a
        LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
        LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
        LEFT JOIN (
            SELECT 
                perkara_id, 
                MAX(tanggal_sidang) AS tanggal_sidang_terakhir
            FROM 
                perkara_jadwal_sidang
            GROUP BY 
                perkara_id
        ) AS subq ON c.perkara_id = subq.perkara_id
        LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
        LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
        JOIN perkara_putusan m ON m.perkara_id = c.perkara_id
        LEFT JOIN perkara_verzet v ON v.perkara_id = c.perkara_id
        LEFT JOIN perkara_hakim_pn n ON n.perkara_id = c.perkara_id
        LEFT JOIN v_perkara o ON o.perkara_id = c.perkara_id
        LEFT JOIN
          perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
        LEFT JOIN 
          (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
    WHERE 
        YEAR(m.tanggal_putusan) = YEAR(CURDATE())
        AND c.alur_perkara_id IN (15, 16, 17)
        AND (
            (c.jenis_perkara_id <> 346)  -- Mengabaikan talak kabul
            OR (c.jenis_perkara_id = 346 AND f.status_putusan_id <> 62)  -- Termasuk talak kabul yang tidak sesuai syarat
        )
        AND (v.tanggal_pendaftaran_verzet IS NULL OR v.tanggal_pendaftaran_verzet IS NOT NULL)
    HAVING 
        nilai < 0
    ORDER BY
        nilai ASC, c.alur_perkara_id ASC, c.perkara_id ASC;`

    db.query(queryFilter, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama} ${r.ecourt} ${r.ghaib}\nHakim : ${r.majelis_hakim}\nTanggal Sidang : ${moment(r.tanggal_sidang).format("DD-MM-YYYY")}\nTanggal Putusan : ${moment(r.tanggal_putusan).format("DD-MM-YYYY")}\n\nDurasi : ${r.durasi}\nNilai : ${r.nilai}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

//DATA PERMOHONAN PANGGILAN DELEGASI (TABAYUN) (ada yang minus durasinya berarti petugas tabayun salah menginput tanggal sidang di menu delegasi)
const getDataPermohonanPanggilanDelegasi = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT DISTINCT
    dk.id,
    dk.nomor_perkara,
    dk.tgl_resi,
    dk.tgl_delegasi,
    dk.tgl_sidang,
    dp.tgl_relaas,
    dp.jurusita_nama,
    CASE 
        WHEN dk.tgl_sidang = dk.tgl_delegasi THEN 'Hari Ini'
        ELSE CONCAT((DATEDIFF(dk.tgl_sidang, dk.tgl_delegasi)), ' hari')
    END AS durasi,
    CASE 
        WHEN DATEDIFF(dk.tgl_sidang, dk.tgl_delegasi) >= 6 THEN 0
        WHEN DATEDIFF(dk.tgl_sidang, dk.tgl_delegasi) = 5 THEN -1
        WHEN DATEDIFF(dk.tgl_sidang, dk.tgl_delegasi) = 4 THEN -2
        WHEN DATEDIFF(dk.tgl_sidang, dk.tgl_delegasi) = 3 THEN -3
        WHEN DATEDIFF(dk.tgl_sidang, dk.tgl_delegasi) <= 2 THEN -5
    END AS nilai
  FROM 
      delegasi_keluar dk 
  LEFT JOIN 
      delegasi_proses_keluar dp ON dk.id = dp.delegasi_id 
  LEFT JOIN 
      delegasi_file_keluar df ON dk.id = df.delegasi_id
  LEFT JOIN
      perkara_jadwal_sidang pjs ON dk.perkara_id = pjs.perkara_id
  WHERE 
      YEAR(dk.tgl_delegasi) = YEAR(CURDATE())
      AND dk.id_jenis_delegasi = 1
  ORDER BY 
      nilai ASC, dk.perkara_id ASC, dk.tgl_delegasi ASC;`;

    //PERKARA DIBAWAH NILAI 0 YANG TELAH DI FILTER (YANG MINUS)
    let queryFilter = `SELECT DISTINCT
    dk.id,
    dk.nomor_perkara,
    dk.tgl_resi,
    dk.tgl_delegasi,
    dk.tgl_sidang,
    dp.tgl_relaas,
    dp.jurusita_nama,
    CASE 
        WHEN dk.tgl_sidang = dk.tgl_delegasi THEN 'Hari Ini'
        ELSE CONCAT((DATEDIFF(dk.tgl_sidang, dk.tgl_delegasi)), ' hari')
    END AS durasi,
    CASE 
        WHEN DATEDIFF(dk.tgl_sidang, dk.tgl_delegasi) >= 6 THEN 0
        WHEN DATEDIFF(dk.tgl_sidang, dk.tgl_delegasi) = 5 THEN -1
        WHEN DATEDIFF(dk.tgl_sidang, dk.tgl_delegasi) = 4 THEN -2
        WHEN DATEDIFF(dk.tgl_sidang, dk.tgl_delegasi) = 3 THEN -3
        WHEN DATEDIFF(dk.tgl_sidang, dk.tgl_delegasi) <= 2 THEN -5
    END AS nilai
  FROM 
      delegasi_keluar dk 
  LEFT JOIN 
      delegasi_proses_keluar dp ON dk.id = dp.delegasi_id 
  LEFT JOIN 
      delegasi_file_keluar df ON dk.id = df.delegasi_id
  LEFT JOIN
      perkara_jadwal_sidang pjs ON dk.perkara_id = pjs.perkara_id
  WHERE 
      YEAR(dk.tgl_delegasi) = YEAR(CURDATE())
      AND dk.id_jenis_delegasi = 1
      AND (
          CASE 
              WHEN DATEDIFF(dk.tgl_sidang, dk.tgl_delegasi) >= 6 THEN 0
              WHEN DATEDIFF(dk.tgl_sidang, dk.tgl_delegasi) = 5 THEN -1
              WHEN DATEDIFF(dk.tgl_sidang, dk.tgl_delegasi) = 4 THEN -2
              WHEN DATEDIFF(dk.tgl_sidang, dk.tgl_delegasi) = 3 THEN -3
              WHEN DATEDIFF(dk.tgl_sidang, dk.tgl_delegasi) <= 2 THEN -5
          END <> 0  -- Menghindari nilai 0
      )
  ORDER BY 
      nilai ASC, dk.perkara_id ASC, dk.tgl_delegasi ASC;`

    db.query(queryFilter, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nTanggal Diproses : ${r.tgl_delegasi}\nTanggal Sidang : ${r.tgl_sidang}\nDurasi : ${r.durasi}\nNilai : ${r.nilai}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};

//DATA PENGISIAN JENIS PUTUSAN (VERSTEK/CONTRA)
const getDataPengisianJenisPutusanVerstekContra = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT 
    a.perkara_id, 
    nomor_perkara,
		CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    tanggal_putusan, 
    hakim_nama, 
    panitera_nama, 
    CASE 
        WHEN LOCATE('verstek', amar_putusan) > 0 AND putusan_verstek = 'T' THEN -5 
        ELSE 0
    END AS nilai
  FROM 
      perkara a 
  JOIN 
      perkara_panitera_pn b ON a.perkara_id = b.perkara_id 
  JOIN 
      perkara_hakim_pn c ON a.perkara_id = c.perkara_id 
  JOIN 
      perkara_putusan d ON a.perkara_id = d.perkara_id
  LEFT JOIN
      perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
  LEFT JOIN 
      (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
  WHERE 
      (jabatan_hakim_id IN (1, 3)) 
      AND (alur_perkara_id = 15 OR alur_perkara_id = 16) 
      AND YEAR(tanggal_pendaftaran) >= 2024 
      AND tanggal_putusan IS NOT NULL
  ORDER BY
      nilai ASC, alur_perkara_id ASC, a.perkara_id ASC;`;
    
    //PERKARA DIBAWAH NILAI 0 YANG TELAH DI FILTER (YANG MINUS)
    let queryFilter = `SELECT 
    a.perkara_id, 
    nomor_perkara,
    CASE
      WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
      ELSE ''
    END AS ghaib,
    CASE
      WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
      ELSE ''
    END AS ecourt,
    tanggal_putusan, 
    hakim_nama, 
    panitera_nama, 
    CASE 
        WHEN LOCATE('verstek', amar_putusan) > 0 AND putusan_verstek = 'T' THEN -5 
        ELSE 0
    END AS nilai
  FROM 
      perkara a 
  JOIN 
      perkara_panitera_pn b ON a.perkara_id = b.perkara_id 
  JOIN 
      perkara_hakim_pn c ON a.perkara_id = c.perkara_id 
  JOIN 
      perkara_putusan d ON a.perkara_id = d.perkara_id
  LEFT JOIN
      perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
  LEFT JOIN 
      (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
  WHERE 
      (jabatan_hakim_id IN (1, 3)) 
      AND (alur_perkara_id = 15 OR alur_perkara_id = 16) 
      AND YEAR(tanggal_pendaftaran) >= 2024 
      AND tanggal_putusan IS NOT NULL
      AND (
          CASE 
              WHEN LOCATE('verstek', amar_putusan) > 0 AND putusan_verstek = 'T' THEN -5 
              ELSE 0
          END <> 0  -- Menghindari nilai 0
      )
  ORDER BY
      nilai ASC, alur_perkara_id ASC, a.perkara_id ASC;
`

    db.query(queryFilter, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length !== 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama} ${r.ecourt} ${r.ghaib}\nHakim : ${r.hakim_nama}\nTanggal Pendaftaran : ${moment(r.tanggal_putusan).format("DD-MM-YYYY")}\nNilai : ${r.nilai}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = "Tidak ada data";
        }
        resolve(responseMessage);
      }
    });
  });
};


//PENILAIAN TRIWULAN BADILAG (YANG BISA DI DETEKSI)
//PERSEN PERKARA E-COURT TRIWULAN
const getDataTriwulanEcourt = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT 
    COUNT(A.perkara_id) AS total_perkara,
    SUM(CASE WHEN C.nomor_perkara IS NOT NULL THEN 1 ELSE 0 END) AS ecourt,
    ROUND(
        (SUM(CASE WHEN C.nomor_perkara IS NOT NULL THEN 1 ELSE 0 END) / COUNT(A.perkara_id) * 100), 2
    ) AS persen,
    ROUND(
        LEAST(
            (SUM(CASE WHEN C.nomor_perkara IS NOT NULL THEN 1 ELSE 0 END) / COUNT(A.perkara_id) * 100) * 0.1,
            5
        ), 2
    ) AS bobot,
    (CASE 
        WHEN QUARTER(A.tanggal_pendaftaran) = 1 THEN 'Triwulan I'
        WHEN QUARTER(A.tanggal_pendaftaran) = 2 THEN 'Triwulan II'
        WHEN QUARTER(A.tanggal_pendaftaran) = 3 THEN 'Triwulan III'
        WHEN QUARTER(A.tanggal_pendaftaran) = 4 THEN 'Triwulan IV'
    END) AS periode
  FROM 
      perkara AS A
  LEFT JOIN 
      perkara_efiling_id AS B ON A.perkara_id = B.perkara_id
  LEFT JOIN 
      perkara_efiling AS C ON B.efiling_id = C.efiling_id
  WHERE 
      YEAR(A.tanggal_pendaftaran) = YEAR(NOW())
  GROUP BY 
      QUARTER(A.tanggal_pendaftaran)

  UNION ALL

  SELECT 
      COUNT(A.perkara_id) AS total_perkara,
      SUM(CASE WHEN C.nomor_perkara IS NOT NULL THEN 1 ELSE 0 END) AS ecourt,
      ROUND(
          (SUM(CASE WHEN C.nomor_perkara IS NOT NULL THEN 1 ELSE 0 END) / COUNT(A.perkara_id) * 100), 2
      ) AS persen_total,
      ROUND(
          LEAST(
              (SUM(CASE WHEN C.nomor_perkara IS NOT NULL THEN 1 ELSE 0 END) / COUNT(A.perkara_id) * 100) * 0.1,
              5
          ), 2
      ) AS bobot_total,
      CONCAT('Tahun ', YEAR(NOW())) AS periode
  FROM 
      perkara AS A
  LEFT JOIN 
      perkara_efiling_id AS B ON A.perkara_id = B.perkara_id
  LEFT JOIN 
      perkara_efiling AS C ON B.efiling_id = C.efiling_id
  WHERE 
      YEAR(A.tanggal_pendaftaran) = YEAR(NOW());`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        if (result.length != 0) {
          const messages = result.map((r, index) => {
            return `${r.periode}\nTotal Perkara : ${r.total_perkara}\nE-Court : ${r.ecourt} (${r.persen}%)\nBobot : ${r.bobot}`;
          });
          resolve(messages.join("\n\n"));
        } else {
          resolve('Tidak ada data');
          console.log(`Tidak ada data Triwulan E-Court`);
        }
      }
    });
  });
};

//PERSEN KEBERHASILAN MEDIASI TRIWULAN
const getDataTriwulanMediasi = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT 
    COUNT(*) AS total_mediasi,
    ROUND(
        (
            SUM(CASE WHEN hasil_mediasi = 'Y1' THEN 1 ELSE 0 END) + 
            SUM(CASE WHEN hasil_mediasi = 'Y2' THEN 1 ELSE 0 END) + 
            0.5 * SUM(CASE WHEN hasil_mediasi = 'S' THEN 1 ELSE 0 END)
        ) * 100.0 / COUNT(*), 2
    ) AS persentase_berhasil,
    ROUND(
        LEAST(
            (
                (
                    SUM(CASE WHEN hasil_mediasi = 'Y1' THEN 1 ELSE 0 END) + 
                    SUM(CASE WHEN hasil_mediasi = 'Y2' THEN 1 ELSE 0 END) + 
                    0.5 * SUM(CASE WHEN hasil_mediasi = 'S' THEN 1 ELSE 0 END)
                ) * 10.0 / (COUNT(*) * 1)
            ) * 1, 
            10
        ), 2
    ) AS bobot,
    CASE 
        WHEN QUARTER(perkara.tanggal_pendaftaran) = 1 THEN 'Triwulan I'
        WHEN QUARTER(perkara.tanggal_pendaftaran) = 2 THEN 'Triwulan II'
        WHEN QUARTER(perkara.tanggal_pendaftaran) = 3 THEN 'Triwulan III'
        WHEN QUARTER(perkara.tanggal_pendaftaran) = 4 THEN 'Triwulan IV'
    END AS periode
  FROM 
      perkara
  LEFT JOIN
      perkara_mediasi ON perkara.perkara_id = perkara_mediasi.perkara_id
  LEFT JOIN
      perkara_mediator ON perkara.perkara_id = perkara_mediator.perkara_id
  WHERE 
      perkara_mediasi.perkara_id IS NOT NULL 
      AND YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE())
      AND perkara_mediator.aktif = 'Y'
  GROUP BY 
      QUARTER(perkara.tanggal_pendaftaran)

  UNION ALL

  SELECT 
      COUNT(*) AS total_mediasi,
      ROUND(
          (
              SUM(CASE WHEN hasil_mediasi = 'Y1' THEN 1 ELSE 0 END) + 
              SUM(CASE WHEN hasil_mediasi = 'Y2' THEN 1 ELSE 0 END) + 
              0.5 * SUM(CASE WHEN hasil_mediasi = 'S' THEN 1 ELSE 0 END)
          ) * 100.0 / COUNT(*), 2
      ) AS persentase_berhasil_total,
      ROUND(
          LEAST(
              (
                  (
                      SUM(CASE WHEN hasil_mediasi = 'Y1' THEN 1 ELSE 0 END) + 
                      SUM(CASE WHEN hasil_mediasi = 'Y2' THEN 1 ELSE 0 END) + 
                      0.5 * SUM(CASE WHEN hasil_mediasi = 'S' THEN 1 ELSE 0 END)
                  ) * 10.0 / (COUNT(*) * 1)
              ) * 0.1, 
              10
          ), 2
      ) AS bobot_total,
      CONCAT('Tahun ', YEAR(NOW())) AS periode
  FROM 
      perkara
  LEFT JOIN
      perkara_mediasi ON perkara.perkara_id = perkara_mediasi.perkara_id
  LEFT JOIN
      perkara_mediator ON perkara.perkara_id = perkara_mediator.perkara_id
  WHERE 
      perkara_mediasi.perkara_id IS NOT NULL 
      AND YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE())
      AND perkara_mediator.aktif = 'Y';`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        if (result.length != 0) {
          const messages = result.map((r, index) => {
            return `${r.periode}\nTotal Mediasi : ${r.total_mediasi}\nKeberhasilan Mediasi : (${r.persentase_berhasil}%)\nBobot : ${r.bobot}`;
          });
          resolve(messages.join("\n\n"));
        } else {
          resolve('Tidak ada data');
          console.log(`Tidak ada data Triwulan Mediasi`);
        }
      }
    });
  });
};

//KODE UNTUK TIAP USER HAKIM, PANITERA SIDANG DAN JURUSITA
const getDataJadwalSidangPerdataHakim = (namaHakim) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT DISTINCT
      a.perkara_id,
      b.tanggal_sidang,
      a.nomor_perkara,
      b.agenda,
      c.panitera_nama,
      a.tanggal_pendaftaran,
      a.jenis_perkara_nama,
      a.para_pihak,
      a.tahapan_terakhir_id,
      a.tahapan_terakhir_text,
      a.proses_terakhir_id,
      a.proses_terakhir_text,
      n.majelis_hakim_kode,
      n.majelis_hakim_text,
      m.jurusita_nama,
      CASE
          WHEN f.jabatan_hakim_nama = 'Hakim Tunggal' THEN 'T'
          ELSE 'KM'
      END AS jabatan_hakim,
      CASE
          WHEN a.proses_terakhir_id < 210 THEN
              DATEDIFF(CURDATE(), a.tanggal_pendaftaran) - IFNULL(
                  (SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0
              )
          ELSE
              DATEDIFF(d.tanggal_putusan, a.tanggal_pendaftaran) - IFNULL(
                  (SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0
              )
      END + 1 AS durasi,
      CASE
          WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
          ELSE ''
      END AS ghaib,
      CASE
          WHEN a.prodeo = 1 THEN ' (_Prodeo_)'
          ELSE ''
      END AS prodeo,
      CASE
          WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
          ELSE ''
      END AS ecourt
  FROM 
      perkara AS a
  LEFT JOIN 
      (SELECT perkara_id, MAX(tanggal_sidang) AS tanggal_sidang_terakhir FROM perkara_jadwal_sidang GROUP BY perkara_id) AS subq 
      ON a.perkara_id = subq.perkara_id
  LEFT JOIN 
      perkara_jadwal_sidang AS b 
      ON a.perkara_id = b.perkara_id AND b.tanggal_sidang = subq.tanggal_sidang_terakhir
  LEFT JOIN 
      perkara_panitera_pn AS c 
      ON a.perkara_id = c.perkara_id
  LEFT JOIN 
      perkara_putusan AS d 
      ON a.perkara_id = d.perkara_id
  LEFT JOIN 
      perkara_hakim_pn AS f 
      ON a.perkara_id = f.perkara_id
  LEFT JOIN 
      perkara_pelaksanaan_relaas AS g 
      ON a.perkara_id = g.perkara_id
  LEFT JOIN 
      (SELECT perkara_id FROM perkara_efiling_id) AS h 
      ON a.perkara_id = h.perkara_id
  LEFT JOIN 
      (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i 
      ON a.perkara_id = i.perkara_id
  LEFT JOIN 
      perkara_pihak2 AS j 
      ON a.perkara_id = j.perkara_id
  LEFT JOIN 
      perkara_efiling_id AS k 
      ON a.perkara_id = k.perkara_id
  LEFT JOIN 
      perkara_pengacara AS l 
      ON a.perkara_id = l.perkara_id
  LEFT JOIN 
      perkara_jurusita AS m 
      ON a.perkara_id = m.perkara_id
  LEFT JOIN 
      perkara_penetapan AS n 
      ON a.perkara_id = n.perkara_id
  LEFT JOIN 
      perkara_ikrar_talak AS o
      ON a.perkara_id = o.perkara_id
  LEFT JOIN 
      v_pihak_perkara AS x 
      ON a.perkara_id = x.perkara_id
  LEFT JOIN 
      pihak AS w 
      ON x.pihak_id = w.id
  LEFT JOIN (
      SELECT
          a.pihak_id,
          MAX(CASE WHEN a.pihak_ke = 1 THEN CONCAT('+62', SUBSTRING(b.telepon, 2)) ELSE NULL END) AS teleponPenggugat,
          MAX(CASE WHEN a.pihak_ke = 2 THEN CONCAT('+62', SUBSTRING(b.telepon, 2)) ELSE NULL END) AS teleponTergugat
      FROM v_pihak_perkara AS a
      JOIN pihak AS b ON a.pihak_id = b.id 
                      AND b.telepon REGEXP '^[0-9]' 
                      AND CHAR_LENGTH(b.telepon) > 8
      GROUP BY a.pihak_id
  ) AS telepons ON x.pihak_id = telepons.pihak_id
  LEFT JOIN (
      SELECT
          perk.perkara_id,
          CASE
              WHEN datarelaas.tanggal_relaas IS NULL OR datarelaas.tanggal_relaas = '' THEN
              CASE
                  WHEN perkarapihak.pihakke = 1 THEN '(Belum Dipanggil P)'
                  WHEN perkarapihak.pihakke = 2 THEN '(Belum Dipanggil T)'
                  WHEN perkarapihak.pihakke IN (1,2) THEN '(Belum Dipanggil PT)'
                  WHEN perkarapihak.pihakke IN (1,2,4) THEN '(Belum Dipanggil PT & Turut T)'
                  WHEN perkarapihak.pihakke = 4 THEN '(Belum Dipanggil Turut Tergugat)'
                  ELSE '(Sudah Dipanggil dan Diupload)'
              END
          WHEN datarelaas.doc_relaas IS NULL OR datarelaas.doc_relaas = '' THEN
              CASE
                  WHEN perkarapihak.pihakke = 1 THEN '(Belum Diupload P)'
                  WHEN perkarapihak.pihakke = 2 THEN '(Belum Diupload T)'
                  WHEN perkarapihak.pihakke IN (1,2) THEN '(Belum Diupload PT)'
                  WHEN perkarapihak.pihakke IN (1,2,4) THEN '(Belum Diupload PT & Turut T)'
                  WHEN perkarapihak.pihakke = 4 THEN '(Belum Diupload Turut Tergugat)'
                  ELSE '(Sudah Dipanggil dan Diupload)'
              END
          ELSE '(Sudah Dipanggil dan Diupload)'
          END AS panggilan_status
      FROM
          perkara AS perk
          JOIN perkara_jadwal_sidang AS sidang ON sidang.perkara_id = perk.perkara_id
          JOIN (
              SELECT
                  p1.perkara_id,
                  p1.pihak_id,
                  p1.nama,
                  1 AS pihakke,
                  'pihak p' AS ketpihak,
                  '' AS pengacara_pihak_id
              FROM
                  perkara_pihak1 AS p1
                  JOIN perkara ON perkara.perkara_id = p1.perkara_id
              WHERE
                  alur_perkara_id < 111
              UNION
              SELECT
                  p2.perkara_id,
                  p2.pihak_id,
                  p2.nama,
                  2 AS pihakke,
                  'pihak t' AS ketpihak,
                  '' AS pengacara_pihak_id
              FROM
                  perkara_pihak2 AS p2
                  JOIN perkara ON perkara.perkara_id = p2.perkara_id
              WHERE
                  alur_perkara_id < 111
                  AND (
                      status_penahanan_id IS NULL
                      OR status_penahanan_id = 0
                  )
                  AND (
                      jenis_tahanan_id = 0
                      OR jenis_tahanan_id IS NULL
                  )
              UNION
              SELECT
                  p3.perkara_id,
                  p3.pihak_id,
                  p3.nama,
                  3 AS pihakke,
                  'intervensi' AS ketpihak,
                  '' AS pengacara_pihak_id
              FROM
                  perkara_pihak3 AS p3
              UNION
              SELECT
                  p4.perkara_id,
                  p4.pihak_id,
                  p4.nama,
                  4 AS pihakke,
                  'turut' AS ketpihak,
                  '' AS pengacara_pihak_id
              FROM
                  perkara_pihak4 AS p4
              UNION
              SELECT
                  p5.perkara_id,
                  p5.pengacara_id,
                  p5.nama,
                  p5.pihak_ke AS pihakke,
                  'pengacara' AS ketpihak,
                  p5.pihak_id AS pengacara_pihak_id
              FROM
                  perkara_pengacara AS p5
          ) AS perkarapihak 
          ON perkarapihak.perkara_id = perk.perkara_id
          LEFT JOIN perkara_pelaksanaan_relaas AS datarelaas 
          ON datarelaas.pihak_id = perkarapihak.pihak_id
          AND datarelaas.perkara_id = perk.perkara_id
          AND datarelaas.sidang_id = sidang.id
          LEFT JOIN (
              SELECT
                  perkara.perkara_id AS perkara_id,
                  perkara_jadwal_sidang.urutan AS urutan,
                  perkara_jadwal_sidang.dihadiri_oleh
              FROM
                  perkara
                  JOIN perkara_jadwal_sidang ON (
                      perkara_jadwal_sidang.perkara_id = perkara.perkara_id
                  )
          ) AS jadwalsidang 
          ON (
              jadwalsidang.perkara_id = perk.perkara_id
              AND jadwalsidang.urutan = sidang.urutan - 1
          )
          LEFT JOIN perkara_penetapan_hari_sidang AS phs 
          ON (
              phs.perkara_id = perk.perkara_id
              AND phs.jadwalsidang_id = sidang.id
          )
          JOIN alur_perkara AS alur 
          ON alur.id = perk.alur_perkara_id
      WHERE
          YEAR(perk.tanggal_pendaftaran) = YEAR(CURDATE())
          AND perk.alur_perkara_id < 111
          AND perkarapihak.pihak_id NOT IN (
              SELECT
                  pp.pihak_id
              FROM
                  perkara_pelaksanaan_relaas
                  JOIN perkara_pengacara AS pp 
                  ON pp.pengacara_id = perkara_pelaksanaan_relaas.pihak_id
                  AND pp.perkara_id = perkara_pelaksanaan_relaas.perkara_id
                  JOIN perkara ON pp.perkara_id = perkara.perkara_id
              WHERE
                  perk.alur_perkara_id < 111
                  AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
                  AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
                  AND (
                      perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL
                      OR perkara_pelaksanaan_relaas.tanggal_relaas <> ''
                  )
                  AND (
                      perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL
                      OR perkara_pelaksanaan_relaas.doc_relaas <> ''
                  )
              UNION
              SELECT
                  ppb.pengacara_id
              FROM
                  perkara_pelaksanaan_relaas
                  JOIN perkara_pengacara AS ppb 
                  ON ppb.pihak_id = perkara_pelaksanaan_relaas.pihak_id
                  AND ppb.perkara_id = perkara_pelaksanaan_relaas.perkara_id
                  JOIN perkara ON ppb.perkara_id = perkara.perkara_id
              WHERE
                  perk.alur_perkara_id < 111
                  AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
                  AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
                  AND (
                      perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL
                      OR perkara_pelaksanaan_relaas.tanggal_relaas <> ''
                  )
                  AND (
                      perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL
                      OR perkara_pelaksanaan_relaas.doc_relaas <> ''
                  )
          )
          AND (
              (
                  datarelaas.tanggal_relaas IS NULL
                  OR datarelaas.tanggal_relaas = ''
              )
              OR (
                  datarelaas.doc_relaas IS NULL
                  OR datarelaas.doc_relaas = ''
              )
          )
          AND(
              perk.alur_perkara_id >= 1
              AND perk.alur_perkara_id <= 17
          )
          AND (
              (jadwalsidang.dihadiri_oleh <> 1)
              AND (
                  jadwalsidang.dihadiri_oleh = 2
                  AND (
                      perkarapihak.pihakke = 2
                      OR perkarapihak.pihakke = 4
                  )
              )
              OR (
                  jadwalsidang.dihadiri_oleh = 3
                  AND perkarapihak.pihakke = 1
              )
              OR (
                  jadwalsidang.dihadiri_oleh = 4
                  OR jadwalsidang.dihadiri_oleh IS NULL
              )
          )
  ) AS doc_relaas_status 
  ON a.perkara_id = doc_relaas_status.perkara_id
  WHERE
      b.tanggal_sidang = CURDATE()
      AND f.hakim_nama LIKE '%${namaHakim}%'
      AND a.alur_perkara_id IN (15, 16, 17)
      AND c.aktif = 'Y'
      AND f.aktif = 'Y'
      AND m.aktif = 'Y'
      AND (
          CASE 
              WHEN a.jenis_perkara_id = 346 AND d.status_putusan_id = 62 AND o.amar_ikrar_talak IS NULL THEN a.proses_terakhir_id < 296 
              ELSE a.proses_terakhir_id < 218 
          END
      )
  ORDER BY 
      CASE
        WHEN b.alasan_ditunda LIKE '%putusan%' OR b.alasan_ditunda LIKE '%penetapan%' OR b.alasan_ditunda LIKE '%musyawarah%' THEN 1
        ELSE 2
      END,
      a.alur_perkara_id,
      a.jenis_perkara_id DESC,
		  b.urutan DESC, 
      c.panitera_nama, 
      a.nomor_perkara, 
      ecourt, 
      ghaib, 
      prodeo DESC;`;

      db.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          if (result.length != 0) {
            const messages = result.map((r, index) => {
              return `*${index + 1}. ${r.nomor_perkara}* ${r.ecourt}${r.ghaib}${r.prodeo} (${r.durasi} Hari)\nMajelis Hakim : *${r.majelis_hakim_kode}*\nJenis Perkara : ${r.jenis_perkara_nama}\nAgenda : ${r.agenda}\nPP : ${r.panitera_nama}\nJS : ${r.jurusita_nama}`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk hakim: ${namaHakim}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching jadwal sidang hakim data:", error);
      reject(error);
    }
  });
};

const getDataJadwalMediasiHakim = (namaHakim) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT 
      p.nomor_perkara, 
      pmtr.nama_mediator, 
      pp.panitera_nama, 
      pj.tanggal_mediasi, 
      pj.urutan,
      p.jenis_perkara_nama
  FROM 
      perkara p
  LEFT JOIN 
      perkara_mediasi pm ON p.perkara_id = pm.perkara_id
  LEFT JOIN 
      perkara_mediator pmtr ON p.perkara_id = pmtr.perkara_id
  LEFT JOIN 
      perkara_jadwal_mediasi pj ON pm.mediasi_id = pj.mediasi_id
  LEFT JOIN 
      perkara_panitera_pn pp ON p.perkara_id = pp.perkara_id
  LEFT JOIN 
      (
          SELECT 
              pm.mediasi_id,
              MAX(pj.tanggal_mediasi) AS tanggal_mediasi
          FROM 
              perkara_jadwal_mediasi pj
          JOIN 
              perkara_mediasi pm ON pj.mediasi_id = pm.mediasi_id
          GROUP BY 
              pm.mediasi_id
      ) pj_max ON pm.mediasi_id = pj_max.mediasi_id AND pj.tanggal_mediasi = pj_max.tanggal_mediasi
  WHERE 
      pj.tanggal_mediasi = CURDATE() 
      AND pp.aktif = 'Y' 
      AND pmtr.nama_mediator LIKE '%${namaHakim}%'
  ORDER BY 
      p.perkara_id DESC;`;

            db.query(query, (err, result) => {
              if (err) {
                reject(err);
              } else {
                if (result.length != 0) {
                  const messages = result.map((r, index) => {
                    return  `${index + 1}. ${r.nomor_perkara} (Ke-${r.urutan})\nTanggal Mediasi : ${moment(r.tanggal_mediasi).format("DD-MM-YYYY")}\nJenis Perkara : ${r.jenis_perkara_nama}\nPP : ${r.panitera_nama}`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk hakim: ${namaHakim}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching jadwal mediasi hakim data:", error);
      reject(error);
    }
  });
};

const getDataJadwalBesokHakim = (namaHakim) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT DISTINCT
      a.perkara_id,
      b.tanggal_sidang,
      a.nomor_perkara,
      b.agenda,
      c.panitera_nama,
      a.tanggal_pendaftaran,
      a.jenis_perkara_nama,
      a.para_pihak,
      a.tahapan_terakhir_id,
      a.tahapan_terakhir_text,
      a.proses_terakhir_id,
      a.proses_terakhir_text,
      n.majelis_hakim_kode,
      n.majelis_hakim_text,
      m.jurusita_nama,
      CASE
          WHEN f.jabatan_hakim_nama = 'Hakim Tunggal' THEN 'T'
          ELSE 'KM'
      END AS jabatan_hakim,
      CASE
          WHEN a.proses_terakhir_id < 210 THEN
              DATEDIFF(CURDATE(), a.tanggal_pendaftaran) - IFNULL(
                  (SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0
              )
          ELSE
              DATEDIFF(d.tanggal_putusan, a.tanggal_pendaftaran) - IFNULL(
                  (SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0
              )
      END + 1 AS durasi,
      CASE
          WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
          ELSE ''
      END AS ghaib,
      CASE
          WHEN a.prodeo = 1 THEN ' (_Prodeo_)'
          ELSE ''
      END AS prodeo,
      CASE
          WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
          ELSE ''
      END AS ecourt
  FROM 
      perkara AS a
  LEFT JOIN 
      (SELECT perkara_id, MAX(tanggal_sidang) AS tanggal_sidang_terakhir FROM perkara_jadwal_sidang GROUP BY perkara_id) AS subq 
      ON a.perkara_id = subq.perkara_id
  LEFT JOIN 
      perkara_jadwal_sidang AS b 
      ON a.perkara_id = b.perkara_id AND b.tanggal_sidang = subq.tanggal_sidang_terakhir
  LEFT JOIN 
      perkara_panitera_pn AS c 
      ON a.perkara_id = c.perkara_id
  LEFT JOIN 
      perkara_putusan AS d 
      ON a.perkara_id = d.perkara_id
  LEFT JOIN 
      perkara_hakim_pn AS f 
      ON a.perkara_id = f.perkara_id
  LEFT JOIN 
      perkara_pelaksanaan_relaas AS g 
      ON a.perkara_id = g.perkara_id
  LEFT JOIN 
      (SELECT perkara_id FROM perkara_efiling_id) AS h 
      ON a.perkara_id = h.perkara_id
  LEFT JOIN 
      (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i 
      ON a.perkara_id = i.perkara_id
  LEFT JOIN 
      perkara_pihak2 AS j 
      ON a.perkara_id = j.perkara_id
  LEFT JOIN 
      perkara_efiling_id AS k 
      ON a.perkara_id = k.perkara_id
  LEFT JOIN 
      perkara_pengacara AS l 
      ON a.perkara_id = l.perkara_id
  LEFT JOIN 
      perkara_jurusita AS m 
      ON a.perkara_id = m.perkara_id
  LEFT JOIN 
      perkara_penetapan AS n 
      ON a.perkara_id = n.perkara_id
  LEFT JOIN 
      perkara_ikrar_talak AS o
      ON a.perkara_id = o.perkara_id
  LEFT JOIN 
      v_pihak_perkara AS x 
      ON a.perkara_id = x.perkara_id
  LEFT JOIN 
      pihak AS w 
      ON x.pihak_id = w.id
  LEFT JOIN (
      SELECT
          a.pihak_id,
          MAX(CASE WHEN a.pihak_ke = 1 THEN CONCAT('+62', SUBSTRING(b.telepon, 2)) ELSE NULL END) AS teleponPenggugat,
          MAX(CASE WHEN a.pihak_ke = 2 THEN CONCAT('+62', SUBSTRING(b.telepon, 2)) ELSE NULL END) AS teleponTergugat
      FROM v_pihak_perkara AS a
      JOIN pihak AS b ON a.pihak_id = b.id 
                      AND b.telepon REGEXP '^[0-9]' 
                      AND CHAR_LENGTH(b.telepon) > 8
      GROUP BY a.pihak_id
  ) AS telepons ON x.pihak_id = telepons.pihak_id
  LEFT JOIN (
      SELECT
          perk.perkara_id,
          CASE
              WHEN datarelaas.tanggal_relaas IS NULL OR datarelaas.tanggal_relaas = '' THEN
              CASE
                  WHEN perkarapihak.pihakke = 1 THEN '(Belum Dipanggil P)'
                  WHEN perkarapihak.pihakke = 2 THEN '(Belum Dipanggil T)'
                  WHEN perkarapihak.pihakke IN (1,2) THEN '(Belum Dipanggil PT)'
                  WHEN perkarapihak.pihakke IN (1,2,4) THEN '(Belum Dipanggil PT & Turut T)'
                  WHEN perkarapihak.pihakke = 4 THEN '(Belum Dipanggil Turut Tergugat)'
                  ELSE '(Sudah Dipanggil dan Diupload)'
              END
          WHEN datarelaas.doc_relaas IS NULL OR datarelaas.doc_relaas = '' THEN
              CASE
                  WHEN perkarapihak.pihakke = 1 THEN '(Belum Diupload P)'
                  WHEN perkarapihak.pihakke = 2 THEN '(Belum Diupload T)'
                  WHEN perkarapihak.pihakke IN (1,2) THEN '(Belum Diupload PT)'
                  WHEN perkarapihak.pihakke IN (1,2,4) THEN '(Belum Diupload PT & Turut T)'
                  WHEN perkarapihak.pihakke = 4 THEN '(Belum Diupload Turut Tergugat)'
                  ELSE '(Sudah Dipanggil dan Diupload)'
              END
          ELSE '(Sudah Dipanggil dan Diupload)'
          END AS panggilan_status
      FROM
          perkara AS perk
          JOIN perkara_jadwal_sidang AS sidang ON sidang.perkara_id = perk.perkara_id
          JOIN (
              SELECT
                  p1.perkara_id,
                  p1.pihak_id,
                  p1.nama,
                  1 AS pihakke,
                  'pihak p' AS ketpihak,
                  '' AS pengacara_pihak_id
              FROM
                  perkara_pihak1 AS p1
                  JOIN perkara ON perkara.perkara_id = p1.perkara_id
              WHERE
                  alur_perkara_id < 111
              UNION
              SELECT
                  p2.perkara_id,
                  p2.pihak_id,
                  p2.nama,
                  2 AS pihakke,
                  'pihak t' AS ketpihak,
                  '' AS pengacara_pihak_id
              FROM
                  perkara_pihak2 AS p2
                  JOIN perkara ON perkara.perkara_id = p2.perkara_id
              WHERE
                  alur_perkara_id < 111
                  AND (
                      status_penahanan_id IS NULL
                      OR status_penahanan_id = 0
                  )
                  AND (
                      jenis_tahanan_id = 0
                      OR jenis_tahanan_id IS NULL
                  )
              UNION
              SELECT
                  p3.perkara_id,
                  p3.pihak_id,
                  p3.nama,
                  3 AS pihakke,
                  'intervensi' AS ketpihak,
                  '' AS pengacara_pihak_id
              FROM
                  perkara_pihak3 AS p3
              UNION
              SELECT
                  p4.perkara_id,
                  p4.pihak_id,
                  p4.nama,
                  4 AS pihakke,
                  'turut' AS ketpihak,
                  '' AS pengacara_pihak_id
              FROM
                  perkara_pihak4 AS p4
              UNION
              SELECT
                  p5.perkara_id,
                  p5.pengacara_id,
                  p5.nama,
                  p5.pihak_ke AS pihakke,
                  'pengacara' AS ketpihak,
                  p5.pihak_id AS pengacara_pihak_id
              FROM
                  perkara_pengacara AS p5
          ) AS perkarapihak 
          ON perkarapihak.perkara_id = perk.perkara_id
          LEFT JOIN perkara_pelaksanaan_relaas AS datarelaas 
          ON datarelaas.pihak_id = perkarapihak.pihak_id
          AND datarelaas.perkara_id = perk.perkara_id
          AND datarelaas.sidang_id = sidang.id
          LEFT JOIN (
              SELECT
                  perkara.perkara_id AS perkara_id,
                  perkara_jadwal_sidang.urutan AS urutan,
                  perkara_jadwal_sidang.dihadiri_oleh
              FROM
                  perkara
                  JOIN perkara_jadwal_sidang ON (
                      perkara_jadwal_sidang.perkara_id = perkara.perkara_id
                  )
          ) AS jadwalsidang 
          ON (
              jadwalsidang.perkara_id = perk.perkara_id
              AND jadwalsidang.urutan = sidang.urutan - 1
          )
          LEFT JOIN perkara_penetapan_hari_sidang AS phs 
          ON (
              phs.perkara_id = perk.perkara_id
              AND phs.jadwalsidang_id = sidang.id
          )
          JOIN alur_perkara AS alur 
          ON alur.id = perk.alur_perkara_id
      WHERE
          YEAR(perk.tanggal_pendaftaran) = YEAR(CURDATE())
          AND perk.alur_perkara_id < 111
          AND perkarapihak.pihak_id NOT IN (
              SELECT
                  pp.pihak_id
              FROM
                  perkara_pelaksanaan_relaas
                  JOIN perkara_pengacara AS pp 
                  ON pp.pengacara_id = perkara_pelaksanaan_relaas.pihak_id
                  AND pp.perkara_id = perkara_pelaksanaan_relaas.perkara_id
                  JOIN perkara ON pp.perkara_id = perkara.perkara_id
              WHERE
                  perk.alur_perkara_id < 111
                  AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
                  AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
                  AND (
                      perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL
                      OR perkara_pelaksanaan_relaas.tanggal_relaas <> ''
                  )
                  AND (
                      perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL
                      OR perkara_pelaksanaan_relaas.doc_relaas <> ''
                  )
              UNION
              SELECT
                  ppb.pengacara_id
              FROM
                  perkara_pelaksanaan_relaas
                  JOIN perkara_pengacara AS ppb 
                  ON ppb.pihak_id = perkara_pelaksanaan_relaas.pihak_id
                  AND ppb.perkara_id = perkara_pelaksanaan_relaas.perkara_id
                  JOIN perkara ON ppb.perkara_id = perkara.perkara_id
              WHERE
                  perk.alur_perkara_id < 111
                  AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
                  AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
                  AND (
                      perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL
                      OR perkara_pelaksanaan_relaas.tanggal_relaas <> ''
                  )
                  AND (
                      perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL
                      OR perkara_pelaksanaan_relaas.doc_relaas <> ''
                  )
          )
          AND (
              (
                  datarelaas.tanggal_relaas IS NULL
                  OR datarelaas.tanggal_relaas = ''
              )
              OR (
                  datarelaas.doc_relaas IS NULL
                  OR datarelaas.doc_relaas = ''
              )
          )
          AND(
              perk.alur_perkara_id >= 1
              AND perk.alur_perkara_id <= 17
          )
          AND (
              (jadwalsidang.dihadiri_oleh <> 1)
              AND (
                  jadwalsidang.dihadiri_oleh = 2
                  AND (
                      perkarapihak.pihakke = 2
                      OR perkarapihak.pihakke = 4
                  )
              )
              OR (
                  jadwalsidang.dihadiri_oleh = 3
                  AND perkarapihak.pihakke = 1
              )
              OR (
                  jadwalsidang.dihadiri_oleh = 4
                  OR jadwalsidang.dihadiri_oleh IS NULL
              )
          )
  ) AS doc_relaas_status 
  ON a.perkara_id = doc_relaas_status.perkara_id
  WHERE  
      b.tanggal_sidang = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
      AND a.alur_perkara_id IN (15, 16, 17)
      AND c.aktif = 'Y'
      AND f.aktif = 'Y'
      AND m.aktif = 'Y'
      AND f.hakim_nama LIKE '%${namaHakim}%'
      AND (
          CASE 
              WHEN a.jenis_perkara_id = 346 AND d.status_putusan_id = 62 AND o.amar_ikrar_talak IS NULL THEN a.proses_terakhir_id < 296 
              ELSE a.proses_terakhir_id < 218 
          END
      )
  ORDER BY
      CASE
        WHEN b.alasan_ditunda LIKE '%putusan%' OR b.alasan_ditunda LIKE '%penetapan%' OR b.alasan_ditunda LIKE '%musyawarah%' THEN 1
        ELSE 2
      END,
      a.alur_perkara_id,
      a.jenis_perkara_id DESC,
      b.urutan DESC,
      c.panitera_nama, 
      a.nomor_perkara, 
      ecourt, 
      ghaib, 
      prodeo DESC;`;

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        if (result.length != 0) {
          const messages = result.map((r, index) => {
            return `*${index + 1}. ${r.nomor_perkara} ${r.ecourt}${r.ghaib}${r.prodeo} (${r.durasi} Hari)*\nMajelis Hakim : *${r.majelis_hakim_kode}*\nJenis Perkara : ${r.jenis_perkara_nama}\nAgenda : ${r.agenda}\nPP : ${r.panitera_nama}\nJS : ${r.jurusita_nama}`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk hakim: ${namaHakim}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching jadwal sidang besok hakim data:", error);
      reject(error);
    }
  });
};

const getDataJadwalMediasiBesokHakim = (namaHakim) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT 
      p.nomor_perkara, 
      pmtr.nama_mediator, 
      pp.panitera_nama, 
      pj.tanggal_mediasi, 
      pj.urutan,
      p.jenis_perkara_nama
  FROM 
      perkara p
  LEFT JOIN 
      perkara_mediasi pm ON p.perkara_id = pm.perkara_id
  LEFT JOIN 
      perkara_mediator pmtr ON p.perkara_id = pmtr.perkara_id
  LEFT JOIN 
      perkara_jadwal_mediasi pj ON pm.mediasi_id = pj.mediasi_id
  LEFT JOIN 
      perkara_panitera_pn pp ON p.perkara_id = pp.perkara_id
  LEFT JOIN 
      (
          SELECT 
              pm.mediasi_id,
              MAX(pj.tanggal_mediasi) AS tanggal_mediasi
          FROM 
              perkara_jadwal_mediasi pj
          JOIN 
              perkara_mediasi pm ON pj.mediasi_id = pm.mediasi_id
          GROUP BY 
              pm.mediasi_id
      ) pj_max ON pm.mediasi_id = pj_max.mediasi_id AND pj.tanggal_mediasi = pj_max.tanggal_mediasi
  WHERE 
      pj.tanggal_mediasi = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
      AND pp.aktif = 'Y' 
      AND pmtr.nama_mediator LIKE '%${namaHakim}%'
  ORDER BY 
      p.perkara_id DESC;`;

            db.query(query, (err, result) => {
              if (err) {
                reject(err);
              } else {
                if (result.length != 0) {
                  const messages = result.map((r, index) => {
                    return `*${index + 1}. ${r.nomor_perkara} (Ke-${r.urutan})*\nTanggal Mediasi : ${moment(r.tanggal_mediasi).format("DD-MM-YYYY")}\nJenis Perkara : ${r.jenis_perkara_nama}\nPP : ${r.panitera_nama}`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk hakim: ${namaHakim}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching jadwal mediasi besok data:", error);
      reject(error);
    }
  });
};

const getDataBASHakim = (namaHakim) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT DISTINCT nomor_perkara,tanggal_sidang,agenda,panitera_nama,hakim_nama FROM perkara LEFT JOIN perkara_jadwal_sidang ON perkara.perkara_id=perkara_jadwal_sidang.perkara_id LEFT JOIN perkara_panitera_pn ON perkara.perkara_id=perkara_panitera_pn.perkara_id LEFT JOIN perkara_hakim_pn ON perkara.perkara_id=perkara_hakim_pn.perkara_id WHERE (alur_perkara_id=15 OR alur_perkara_id =16 OR alur_perkara_id=17) AND (YEAR(tanggal_sidang)=YEAR(NOW()) AND tanggal_sidang < CURDATE() AND edoc_bas IS NULL) AND perkara_panitera_pn.aktif = 'Y' AND hakim_nama LIKE '%${namaHakim}%' ORDER BY tanggal_sidang DESC`;

      db.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          if (result.length != 0) {
            const messages = result.map((r, index) => {
              return `${index + 1}. ${r.nomor_perkara}\nTanggal Sidang : ${moment(r.tanggal_sidang).format("DD-MM-YYYY")}\nAgenda : ${r.agenda}\nPP : ${r.panitera_nama}`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk hakim: ${namaHakim}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching BAS hakim data:", error);
      reject(error);
    }
  });
};

const getDataEdocAnonimisasiHakim = (namaHakim) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT nomor_perkara, tanggal_putusan FROM perkara_putusan LEFT JOIN perkara ON perkara_putusan.perkara_id = perkara.perkara_id LEFT JOIN perkara_hakim_pn on perkara_hakim_pn.perkara_id = perkara.perkara_id WHERE YEAR(tanggal_putusan)=YEAR(CURDATE()) AND tanggal_putusan IS NOT NULL AND (jenis_perkara_nama = "Perceraian" OR jenis_perkara_nama = "Permohonan Pengangkatan Anak" OR jenis_perkara_nama = "Wasiat" OR jenis_perkara_nama = "Kejahatan Terhadap Kesusilaan" OR jenis_perkara_nama = "Kekerasan Dalam Rumah Tangga" OR jenis_perkara_nama = "Dispensasi Kawin" OR jenis_perkara_nama = "Cerai Gugat" OR jenis_perkara_nama = "Cerai Talak" OR alur_perkara_id =118 OR alur_perkara_id =15 OR alur_perkara_id =16 OR alur_perkara_id =17) AND amar_putusan_anonimisasi_dok IS NULL AND hakim_nama LIKE '%${namaHakim}%'`;

          db.query(query, (err, result) => {
            if (err) {
              reject(err);
            } else {
              if (result.length != 0) {
                const messages = result.map((r, index) => {
                  return `${index + 1}. Nomor perkara : ${r.nomor_perkara}\nTanggal putusan : ${moment(r.tanggal_putusan).format("DD-MM-YYYY")}`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk hakim: ${namaHakim}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching anonim putusan hakim data:", error);
      reject(error);
    }
  });
};

const getDataUploadPutusanHakim = (namaHakim) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT nomor_perkara,
      hakim_nama,
      CASE
        WHEN jabatan_hakim_nama = "Hakim Tunggal" THEN "T" ELSE "KM" 
      END AS jabatan_hakim,
      panitera_nama
      FROM perkara_putusan 
      LEFT JOIN perkara ON perkara_putusan.perkara_id = perkara.perkara_id 
      LEFT JOIN perkara_jadwal_sidang ON perkara_jadwal_sidang.perkara_id = perkara.perkara_id
      LEFT JOIN perkara_hakim_pn ON perkara.perkara_id = perkara_hakim_pn.perkara_id
      LEFT JOIN perkara_panitera_pn ON perkara.perkara_id = perkara_panitera_pn.perkara_id
      WHERE YEAR(tanggal_putusan) = YEAR(CURDATE())
      AND hakim_nama LIKE '%${namaHakim}%'
      AND tanggal_putusan IS NULL 
      AND amar_putusan IS NULL 
      AND (
      (perkara_jadwal_sidang.alasan_ditunda LIKE '%Putusan%' OR 
        perkara_jadwal_sidang.alasan_ditunda LIKE '%verstek%' OR 
        perkara_jadwal_sidang.alasan_ditunda LIKE '%Putus%' OR 
        perkara_jadwal_sidang.alasan_ditunda LIKE '%Cabut%' OR 
        perkara_jadwal_sidang.alasan_ditunda LIKE '%Gugur%' OR 
        perkara_jadwal_sidang.alasan_ditunda LIKE '%Penetapan%') 
          OR 
      (perkara_jadwal_sidang.keterangan LIKE '%Putusan%' OR 
        perkara_jadwal_sidang.keterangan LIKE '%verstek%' OR 
        perkara_jadwal_sidang.keterangan LIKE '%Putus%' OR 
        perkara_jadwal_sidang.keterangan LIKE '%Cabut%' OR 
        perkara_jadwal_sidang.keterangan LIKE '%Gugur%' OR 
        perkara_jadwal_sidang.keterangan LIKE '%Penetapan%'));`;

        db.query(query, (err, result) => {
          if (err) {
            reject(err);
          } else {
            if (result.length != 0) {
              const messages = result.map((r, index) => {
                return `${index + 1}. ${r.nomor_perkara}\nHakim : ${r.hakim_nama} (${r.jabatan_hakim})\nPP : ${r.panitera_nama}`;
              });
              resolve(messages.join("\n\n"));
            } else {
              resolve('Tidak ada data');
              console.log(`Tidak ada data untuk hakim: ${namaHakim}`);
            }
          }
        });
      } catch (error) {
        console.error("Error fetching upload putusan hakim data:", error);
        reject(error);
      }
    });
  };

const getDataLupaTundaHakim = (namaHakim) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT nomor_perkara, jenis_perkara_nama, tanggal_sidang, panitera_nama
      FROM perkara
      LEFT JOIN perkara_jadwal_sidang ON perkara.perkara_id = perkara_jadwal_sidang.perkara_id
      LEFT JOIN perkara_panitera_pn ON perkara.perkara_id = perkara_panitera_pn.perkara_id
      LEFT JOIN perkara_hakim_pn ON perkara.perkara_id = perkara_hakim_pn.perkara_id
      WHERE DATE(tanggal_sidang) = CURDATE()
          AND alasan_ditunda IS NULL 
          AND perkara_jadwal_sidang.keterangan IS NULL
          AND hakim_nama LIKE '%${namaHakim}%'
      ORDER BY nomor_perkara DESC;`;

            db.query(query, (err, result) => {
              if (err) {
                reject(err);
              } else {
                if (result.length != 0) {
                  const messages = result.map((r, index) => {
                    return `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama}\nPP : ${r.panitera_nama}`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk hakim: ${namaHakim}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching lupa tunda hakim data:", error);
      reject(error);
    }
  });
};

const getDataPutusanBelumMinutHakim = (namaHakim) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT nomor_perkara,tanggal_putusan,panitera_nama, majelis_hakim_kode FROM perkara LEFT JOIN perkara_putusan ON perkara.perkara_id=perkara_putusan.perkara_id LEFT JOIN perkara_panitera_pn ON perkara.perkara_id=perkara_panitera_pn.perkara_id LEFT JOIN perkara_hakim_pn ON perkara_hakim_pn.perkara_id=perkara.perkara_id LEFT JOIN perkara_penetapan ON perkara_penetapan.perkara_id = perkara.perkara_id WHERE tanggal_putusan IS NOT NULL AND tanggal_minutasi IS NULL AND perkara_panitera_pn.aktif = 'Y' AND hakim_nama LIKE '%${namaHakim}%' ORDER BY tanggal_putusan DESC`;

          db.query(query, (err, result) => {
            if (err) {
              reject(err);
            } else {
              if (result.length != 0) {
                const messages = result.map((r, index) => {
                  return `${index + 1}. ${r.nomor_perkara}\nTanggal Putusan : ${moment(r.tanggal_putusan).format("DD-MM-YYYY")}\nPP : ${r.panitera_nama}`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk hakim: ${namaHakim}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching belum minut hakim data:", error);
      reject(error);
    }
  });
};

const getDataPerkaraAktifHakim = (namaHakim) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT DISTINCT
      b.tanggal_sidang,
      a.nomor_perkara,
      b.agenda,
      c.panitera_nama,
      a.perkara_id,
      a.tanggal_pendaftaran,
      a.jenis_perkara_nama,
      a.para_pihak,
      a.tahapan_terakhir_id,
      a.tahapan_terakhir_text,
      a.proses_terakhir_id,
      a.proses_terakhir_text,
      f.hakim_nama,
      n.majelis_hakim_kode,
      m.jurusita_nama,
      CASE
          WHEN f.jabatan_hakim_nama = 'Hakim Tunggal' THEN 'T'
          ELSE 'KM'
      END AS jabatan_hakim,
      CASE
          WHEN a.proses_terakhir_id < 210 THEN
              DATEDIFF(CURDATE(), a.tanggal_pendaftaran) - IFNULL(
                  (SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0
              )
          ELSE
              DATEDIFF(d.tanggal_putusan, a.tanggal_pendaftaran) - IFNULL(
                  (SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0
              )
      END + 1 AS durasi,
      CASE
          WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
          ELSE ''
      END AS ghaib,
      CASE
          WHEN a.prodeo = 1 THEN ' (_Prodeo_)'
          ELSE ''
      END AS prodeo,
      CASE
          WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
          ELSE ''
      END AS ecourt
  FROM 
      perkara AS a
  LEFT JOIN 
      (SELECT perkara_id, MAX(tanggal_sidang) AS tanggal_sidang_terakhir FROM perkara_jadwal_sidang GROUP BY perkara_id) AS subq 
      ON a.perkara_id = subq.perkara_id
  LEFT JOIN 
      perkara_jadwal_sidang AS b 
      ON a.perkara_id = b.perkara_id AND b.tanggal_sidang = subq.tanggal_sidang_terakhir
  LEFT JOIN 
      perkara_panitera_pn AS c 
      ON a.perkara_id = c.perkara_id
  LEFT JOIN 
      perkara_putusan AS d 
      ON a.perkara_id = d.perkara_id
  LEFT JOIN 
      perkara_hakim_pn AS f 
      ON a.perkara_id = f.perkara_id
  LEFT JOIN 
      perkara_pelaksanaan_relaas AS g 
      ON a.perkara_id = g.perkara_id
  LEFT JOIN 
      (SELECT perkara_id FROM perkara_efiling_id) AS h 
      ON a.perkara_id = h.perkara_id
  LEFT JOIN 
      (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i 
      ON a.perkara_id = i.perkara_id
  LEFT JOIN 
      perkara_pihak2 AS j 
      ON a.perkara_id = j.perkara_id
  LEFT JOIN 
      perkara_efiling_id AS k 
      ON a.perkara_id = k.perkara_id
  LEFT JOIN 
      perkara_pengacara AS l 
      ON a.perkara_id = l.perkara_id
  LEFT JOIN 
      perkara_jurusita AS m 
      ON a.perkara_id = m.perkara_id
  LEFT JOIN 
      perkara_penetapan AS n 
      ON a.perkara_id = n.perkara_id
  LEFT JOIN 
      perkara_ikrar_talak AS o
      ON a.perkara_id = o.perkara_id
  LEFT JOIN 
      v_pihak_perkara AS x 
      ON a.perkara_id = x.perkara_id
  LEFT JOIN 
      pihak AS w 
      ON x.pihak_id = w.id
  LEFT JOIN (
      SELECT
          a.pihak_id,
          MAX(CASE WHEN a.pihak_ke = 1 THEN CONCAT('+62', SUBSTRING(b.telepon, 2)) ELSE NULL END) AS teleponPenggugat,
          MAX(CASE WHEN a.pihak_ke = 2 THEN CONCAT('+62', SUBSTRING(b.telepon, 2)) ELSE NULL END) AS teleponTergugat
      FROM v_pihak_perkara AS a
      JOIN pihak AS b ON a.pihak_id = b.id 
                      AND b.telepon REGEXP '^[0-9]' 
                      AND CHAR_LENGTH(b.telepon) > 8
      GROUP BY a.pihak_id
  ) AS telepons ON x.pihak_id = telepons.pihak_id
  LEFT JOIN (
      SELECT
          perk.perkara_id,
          CASE
              WHEN datarelaas.tanggal_relaas IS NULL OR datarelaas.tanggal_relaas = '' THEN
              CASE
                  WHEN perkarapihak.pihakke = 1 THEN '(Belum Dipanggil P)'
                  WHEN perkarapihak.pihakke = 2 THEN '(Belum Dipanggil T)'
                  WHEN perkarapihak.pihakke IN (1,2) THEN '(Belum Dipanggil PT)'
                  WHEN perkarapihak.pihakke IN (1,2,4) THEN '(Belum Dipanggil PT & Turut T)'
                  WHEN perkarapihak.pihakke = 4 THEN '(Belum Dipanggil Turut Tergugat)'
                  ELSE '(Sudah Dipanggil dan Diupload)'
              END
          WHEN datarelaas.doc_relaas IS NULL OR datarelaas.doc_relaas = '' THEN
              CASE
                  WHEN perkarapihak.pihakke = 1 THEN '(Belum Diupload P)'
                  WHEN perkarapihak.pihakke = 2 THEN '(Belum Diupload T)'
                  WHEN perkarapihak.pihakke IN (1,2) THEN '(Belum Diupload PT)'
                  WHEN perkarapihak.pihakke IN (1,2,4) THEN '(Belum Diupload PT & Turut T)'
                  WHEN perkarapihak.pihakke = 4 THEN '(Belum Diupload Turut Tergugat)'
                  ELSE '(Sudah Dipanggil dan Diupload)'
              END
          ELSE '(Sudah Dipanggil dan Diupload)'
          END AS panggilan_status
      FROM
          perkara AS perk
          JOIN perkara_jadwal_sidang AS sidang ON sidang.perkara_id = perk.perkara_id
          JOIN (
              SELECT
                  p1.perkara_id,
                  p1.pihak_id,
                  p1.nama,
                  1 AS pihakke,
                  'pihak p' AS ketpihak,
                  '' AS pengacara_pihak_id
              FROM
                  perkara_pihak1 AS p1
                  JOIN perkara ON perkara.perkara_id = p1.perkara_id
              WHERE
                  alur_perkara_id < 111
              UNION
              SELECT
                  p2.perkara_id,
                  p2.pihak_id,
                  p2.nama,
                  2 AS pihakke,
                  'pihak t' AS ketpihak,
                  '' AS pengacara_pihak_id
              FROM
                  perkara_pihak2 AS p2
                  JOIN perkara ON perkara.perkara_id = p2.perkara_id
              WHERE
                  alur_perkara_id < 111
                  AND (
                      status_penahanan_id IS NULL
                      OR status_penahanan_id = 0
                  )
                  AND (
                      jenis_tahanan_id = 0
                      OR jenis_tahanan_id IS NULL
                  )
              UNION
              SELECT
                  p3.perkara_id,
                  p3.pihak_id,
                  p3.nama,
                  3 AS pihakke,
                  'intervensi' AS ketpihak,
                  '' AS pengacara_pihak_id
              FROM
                  perkara_pihak3 AS p3
              UNION
              SELECT
                  p4.perkara_id,
                  p4.pihak_id,
                  p4.nama,
                  4 AS pihakke,
                  'turut' AS ketpihak,
                  '' AS pengacara_pihak_id
              FROM
                  perkara_pihak4 AS p4
              UNION
              SELECT
                  p5.perkara_id,
                  p5.pengacara_id,
                  p5.nama,
                  p5.pihak_ke AS pihakke,
                  'pengacara' AS ketpihak,
                  p5.pihak_id AS pengacara_pihak_id
              FROM
                  perkara_pengacara AS p5
          ) AS perkarapihak 
          ON perkarapihak.perkara_id = perk.perkara_id
          LEFT JOIN perkara_pelaksanaan_relaas AS datarelaas 
          ON datarelaas.pihak_id = perkarapihak.pihak_id
          AND datarelaas.perkara_id = perk.perkara_id
          AND datarelaas.sidang_id = sidang.id
          LEFT JOIN (
              SELECT
                  perkara.perkara_id AS perkara_id,
                  perkara_jadwal_sidang.urutan AS urutan,
                  perkara_jadwal_sidang.dihadiri_oleh
              FROM
                  perkara
                  JOIN perkara_jadwal_sidang ON (
                      perkara_jadwal_sidang.perkara_id = perkara.perkara_id
                  )
          ) AS jadwalsidang 
          ON (
              jadwalsidang.perkara_id = perk.perkara_id
              AND jadwalsidang.urutan = sidang.urutan - 1
          )
          LEFT JOIN perkara_penetapan_hari_sidang AS phs 
          ON (
              phs.perkara_id = perk.perkara_id
              AND phs.jadwalsidang_id = sidang.id
          )
          JOIN alur_perkara AS alur 
          ON alur.id = perk.alur_perkara_id
      WHERE
          YEAR(perk.tanggal_pendaftaran) = YEAR(CURDATE())
          AND perk.alur_perkara_id < 111
          AND perkarapihak.pihak_id NOT IN (
              SELECT
                  pp.pihak_id
              FROM
                  perkara_pelaksanaan_relaas
                  JOIN perkara_pengacara AS pp 
                  ON pp.pengacara_id = perkara_pelaksanaan_relaas.pihak_id
                  AND pp.perkara_id = perkara_pelaksanaan_relaas.perkara_id
                  JOIN perkara ON pp.perkara_id = perkara.perkara_id
              WHERE
                  perk.alur_perkara_id < 111
                  AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
                  AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
                  AND (
                      perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL
                      OR perkara_pelaksanaan_relaas.tanggal_relaas <> ''
                  )
                  AND (
                      perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL
                      OR perkara_pelaksanaan_relaas.doc_relaas <> ''
                  )
              UNION
              SELECT
                  ppb.pengacara_id
              FROM
                  perkara_pelaksanaan_relaas
                  JOIN perkara_pengacara AS ppb 
                  ON ppb.pihak_id = perkara_pelaksanaan_relaas.pihak_id
                  AND ppb.perkara_id = perkara_pelaksanaan_relaas.perkara_id
                  JOIN perkara ON ppb.perkara_id = perkara.perkara_id
              WHERE
                  perk.alur_perkara_id < 111
                  AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
                  AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
                  AND (
                      perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL
                      OR perkara_pelaksanaan_relaas.tanggal_relaas <> ''
                  )
                  AND (
                      perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL
                      OR perkara_pelaksanaan_relaas.doc_relaas <> ''
                  )
          )
          AND (
              (
                  datarelaas.tanggal_relaas IS NULL
                  OR datarelaas.tanggal_relaas = ''
              )
              OR (
                  datarelaas.doc_relaas IS NULL
                  OR datarelaas.doc_relaas = ''
              )
          )
          AND(
              perk.alur_perkara_id >= 1
              AND perk.alur_perkara_id <= 17
          )
          AND (
              (jadwalsidang.dihadiri_oleh <> 1)
              AND (
                  jadwalsidang.dihadiri_oleh = 2
                  AND (
                      perkarapihak.pihakke = 2
                      OR perkarapihak.pihakke = 4
                  )
              )
              OR (
                  jadwalsidang.dihadiri_oleh = 3
                  AND perkarapihak.pihakke = 1
              )
              OR (
                  jadwalsidang.dihadiri_oleh = 4
                  OR jadwalsidang.dihadiri_oleh IS NULL
              )
          )
  ) AS doc_relaas_status 
  ON a.perkara_id = doc_relaas_status.perkara_id
      WHERE  
          YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE())
          AND f.hakim_nama LIKE '%${namaHakim}%'
          AND a.alur_perkara_id IN (15, 16, 17)
          AND c.aktif = 'Y'
          AND f.aktif = 'Y'
          AND m.aktif = 'Y'
          AND (
              CASE 
                  WHEN a.jenis_perkara_id = 346 AND d.status_putusan_id = 62 AND o.amar_ikrar_talak IS NOT NULL THEN a.proses_terakhir_id < 296 
                  ELSE a.proses_terakhir_id < 218 
              END
          )
      ORDER BY 
          b.tanggal_sidang,
          c.panitera_nama, 
          a.alur_perkara_id,
          a.nomor_perkara, 
          ecourt, 
          ghaib, 
          prodeo DESC;`;

      db.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          if (result.length != 0) {
            const messages = result.map((r, index) => {
              return `${index + 1}. ${r.nomor_perkara}* ${r.ecourt}${r.ghaib}${r.prodeo} (${r.durasi} Hari)\nMajelis Hakim : ${r.majelis_hakim_kode}\nTanggal Sidang : ${moment(r.tanggal_sidang).format("DD-MM-YYYY")}\nAgenda : ${r.agenda}\nPP : ${r.panitera_nama}\nJS : ${r.jurusita_nama}`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk hakim: ${namaHakim}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching perkara aktif hakim data:", error);
      reject(error);
    }
  });
};

const getDataMediasiAktifHakim = (namaHakim) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT 
          p.nomor_perkara,
          p.jenis_perkara_nama,
          pmed.nama_mediator, 
          ppn.panitera_nama, 
          pj.tanggal_mediasi
      FROM perkara p
      LEFT JOIN perkara_mediasi pm ON p.perkara_id = pm.perkara_id  
      LEFT JOIN perkara_mediator pmed ON p.perkara_id = pmed.perkara_id 
      LEFT JOIN (
          SELECT 
               pm.mediasi_id,
              MAX(pj.tanggal_mediasi) AS tanggal_mediasi
           FROM perkara_jadwal_mediasi pj
          JOIN perkara_mediasi pm ON pj.mediasi_id = pm.mediasi_id
          GROUP BY pm.mediasi_id
      ) pj ON pm.mediasi_id = pj.mediasi_id 
      LEFT JOIN perkara_panitera_pn ppn ON p.perkara_id = ppn.perkara_id 
      WHERE YEAR(pj.tanggal_mediasi) = YEAR(CURDATE()) 
      AND ppn.aktif = 'Y' 
      AND pmed.aktif = 'Y'
      AND pm.tgl_laporan_mediator IS NULL
      AND pmed.nama_mediator LIKE '%${namaHakim}%'
      ORDER BY p.nomor_perkara DESC;`;

      db.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          if (result.length != 0) {
            const messages = result.map((r, index) => {
              return `${index + 1}. ${r.nomor_perkara}*\nTanggal Mediasi : ${moment(r.tanggal_mediasi).format("DD-MM-YYYY")}\nJenis Perkara : ${r.jenis_perkara_nama}\nPanitera: ${r.panitera_nama}`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk hakim: ${namaHakim}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching mediasi aktif hakim data:", error);
      reject(error);
    }
  });
};

const getTotalPenerimaanPerkaraHakim = (namaHakim) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT 
            COUNT(CASE 
              WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
                  AND perkara.alur_perkara_id != 114 
                  AND perkara_hakim_pn.hakim_nama LIKE '%${namaHakim}%'
                  AND perkara_hakim_pn.aktif = 'Y'
              THEN perkara.perkara_id 
            END) AS jumlah_masuk,

            COUNT(CASE 
                WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
                    AND perkara.alur_perkara_id != 114 
                    AND perkara_hakim_pn.hakim_nama LIKE '%${namaHakim}%'
                    AND perkara_hakim_pn.aktif = 'Y'
                    AND perkara_hakim_pn.jabatan_hakim_id = 1
                THEN perkara.perkara_id 
            END) AS jumlah_ketua_majelis,

            COUNT(CASE 
                WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
                    AND perkara.alur_perkara_id != 114 
                    AND perkara_hakim_pn.hakim_nama LIKE '%${namaHakim}%'
                    AND perkara_hakim_pn.aktif = 'Y'
                    AND perkara_hakim_pn.jabatan_hakim_id = 3
                THEN perkara.perkara_id 
            END) AS jumlah_hakim_tunggal,

            (SELECT COUNT(*)
            FROM perkara
            WHERE YEAR(tanggal_pendaftaran) = YEAR(CURDATE())
              AND alur_perkara_id != 114
            ) AS total_perkara_masuk,

            COUNT(CASE 
                WHEN YEAR(perkara_putusan.tanggal_putusan) = YEAR(CURDATE()) 
                    AND perkara_putusan.tanggal_putusan IS NOT NULL 
                    AND perkara.alur_perkara_id != 114 
                    AND perkara_hakim_pn.hakim_nama LIKE '%${namaHakim}%'
                    AND perkara_hakim_pn.aktif = 'Y'
                THEN perkara.perkara_id 
            END) AS jumlah_putus,

            COUNT(CASE 
                WHEN YEAR(perkara_putusan.tanggal_putusan) = YEAR(CURDATE()) 
                    AND perkara_putusan.tanggal_putusan IS NOT NULL 
                    AND perkara.alur_perkara_id != 114
                    AND perkara_hakim_pn.hakim_nama LIKE '%${namaHakim}%' 
                    AND perkara_hakim_pn.aktif = 'Y'
                    AND perkara_putusan.putusan_verstek = 'Y'
                THEN perkara.perkara_id 
            END) AS jumlah_putus_verstek,

            COUNT(CASE 
                WHEN YEAR(perkara_putusan.tanggal_putusan) = YEAR(CURDATE()) 
                    AND perkara_putusan.tanggal_putusan IS NOT NULL 
                    AND perkara.alur_perkara_id != 114
                    AND perkara_hakim_pn.hakim_nama LIKE '%${namaHakim}%'
                    AND perkara_hakim_pn.aktif = 'Y'
                    AND perkara_putusan.putusan_verstek = 'T'
                THEN perkara.perkara_id 
            END) AS jumlah_putus_contra,

            -- Menambahkan kolom persentase
            CASE
                WHEN COUNT(CASE 
                    WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
                        AND perkara.alur_perkara_id != 114 
                        AND perkara_hakim_pn.hakim_nama LIKE '%${namaHakim}%'
                        AND perkara_hakim_pn.aktif = 'Y'
                    THEN perkara.perkara_id 
                END) = 0 THEN 0
                ELSE 
                    (COUNT(CASE 
                        WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
                            AND perkara.alur_perkara_id != 114 
                            AND perkara_hakim_pn.hakim_nama LIKE '%${namaHakim}%'
                            AND perkara_hakim_pn.aktif = 'Y'
                        THEN perkara.perkara_id 
                    END) * 100.0 / (SELECT COUNT(*)
                                    FROM perkara
                                    WHERE YEAR(tanggal_pendaftaran) = YEAR(CURDATE())
                                      AND alur_perkara_id != 114
                                  )) 
            END AS persentase_masuk
          FROM perkara
          LEFT JOIN perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id
          LEFT JOIN perkara_hakim_pn ON perkara_hakim_pn.perkara_id = perkara.perkara_id
          WHERE perkara_hakim_pn.aktif = 'Y';`;

          db.query(query, (err, result) => {
            if (err) {
              reject(err);
            } else {
              if (result.length != 0) {
                const messages = result.map((r, index) => {
                  return `- Perkara Ditangani : ${r.jumlah_masuk}\n          - Ketua Majelis : ${r.jumlah_ketua_majelis}\n          - Hakim Tunggal : ${r.jumlah_hakim_tunggal}\n- Perkara Putus : ${r.jumlah_putus}\n- Total Perkara Masuk di PA : ${r.total_perkara_masuk}\n- Persentase : ${r.persentase_masuk}%`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk hakim: ${namaHakim}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching penerimaan perkara hakim data:", error);
      reject(error);
    }
  });
};

const getTotalPenerimaanMediasiHakim = (namaHakim) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT 
    perkara_mediator.nama_mediator,
    SUM(CASE WHEN hasil_mediasi = 'Y1' THEN 1 ELSE 0 END) AS 'Berhasil_Kesepakatan_Damai',
    SUM(CASE WHEN hasil_mediasi = 'Y2' THEN 1 ELSE 0 END) AS 'Berhasil_Dengan_Pencabutan',
    SUM(CASE WHEN hasil_mediasi = 'S' THEN 1 ELSE 0 END) AS 'Berhasil_Sebagian',
    SUM(CASE WHEN hasil_mediasi = 'D' THEN 1 ELSE 0 END) AS 'Tidak_Dapat_Dilaksanakan',
    SUM(CASE WHEN hasil_mediasi NOT IN ('Y1', 'Y2', 'S', 'D') THEN 1 ELSE 0 END) AS 'Tidak_Berhasil',
    COUNT(*) AS total_mediasi,
    ROUND(
        (
            SUM(CASE WHEN hasil_mediasi = 'Y1' THEN 1 ELSE 0 END) + 
            SUM(CASE WHEN hasil_mediasi = 'Y2' THEN 1 ELSE 0 END) + 
            0.5 * SUM(CASE WHEN hasil_mediasi = 'S' THEN 1 ELSE 0 END)
        ) * 100.0 / COUNT(*), 2
    ) AS persentase_berhasil
  FROM 
      perkara
  LEFT JOIN
      perkara_mediasi ON perkara.perkara_id = perkara_mediasi.perkara_id
  LEFT JOIN
      perkara_mediator ON perkara.perkara_id = perkara_mediator.perkara_id
  WHERE 
      perkara_mediasi.perkara_id IS NOT NULL 
      AND YEAR(keputusan_mediasi) = YEAR(CURDATE())
      AND perkara_mediator.aktif = 'Y'
      AND perkara_mediator.nama_mediator LIKE '%${namaHakim}%'
  GROUP BY 
      perkara_mediator.nama_mediator
  ORDER BY
      persentase_berhasil DESC;`;

        db.query(query, (err, result) => {
          if (err) {
            reject(err);
          } else {
            if (result.length != 0) {
              const messages = result.map((r, index) => {
                return `- Mediasi Ditangani : ${r.total_mediasi}\n- Persentase Keberhasilan : ${r.persentase_berhasil}%\n- Status Laporan Mediator :\n          - Kesepakatan Damai : ${r.Berhasil_Kesepakatan_Damai}\n          - Pencabutan : ${r.Berhasil_Dengan_Pencabutan}\n          - Berhasil Sebagian : ${r.Berhasil_Sebagian}\n          - Tidak Dapat Dilaksanakan : ${r.Tidak_Dapat_Dilaksanakan}\n          - Tidak Berhasil : ${r.Tidak_Berhasil}`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk hakim: ${namaHakim}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching penerimaan mediasi hakim data:", error);
      reject(error);
    }
  });
};

const getBelumPanggilanHakimHariIni = (namaHakim) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT DISTINCT
            perk.nomor_perkara,
            perk.perkara_id,
            perk.alur_perkara_id,
            perk.jenis_perkara_nama,
            alur.nama AS nama_alur,
            CASE WHEN k.perkara_id IS NOT NULL THEN " (*E-Court*)" ELSE "" END AS ecourt,
            CASE WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)' ELSE '' END AS ghaib,
            CASE WHEN perk.prodeo = 1 THEN ' (_Prodeo_)' ELSE '' END AS prodeo,
            (
              SELECT GROUP_CONCAT(DISTINCT hkpn.nama_gelar ORDER BY hk.id ASC SEPARATOR ' \n') AS nama_hakim
              FROM perkara_hakim_pn AS hk
              JOIN hakim_pn AS hkpn ON hkpn.id = hk.hakim_id
              WHERE hk.perkara_id = perk.perkara_id AND hk.aktif = 'Y'
              ORDER BY hk.urutan ASC
            ) AS majelis_hakim,
            (
              SELECT GROUP_CONCAT(DISTINCT pp.nama ORDER BY ppp.id ASC SEPARATOR '<br>') AS nama_js
              FROM perkara_panitera_pn AS ppp
              JOIN panitera_pn AS pp ON pp.id = ppp.panitera_id
              WHERE ppp.perkara_id = perk.perkara_id AND ppp.aktif = 'Y'
              ORDER BY ppp.urutan ASC
            ) AS panitera_nama,
            (
              SELECT GROUP_CONCAT(DISTINCT jspn.nama ORDER BY pjs.id ASC SEPARATOR '<br>') AS nama_js
              FROM perkara_jurusita AS pjs
              JOIN jurusita AS jspn ON jspn.id = pjs.jurusita_id
              WHERE pjs.perkara_id = perk.perkara_id AND pjs.aktif = 'Y'
              ORDER BY pjs.urutan ASC
            ) AS jurusita,
            sidang.id AS sidang_id,
            DATE_FORMAT(sidang.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
            sidang.agenda,
            perkarapihak.pihak_id,
            perkarapihak.nama AS nama_pihak,
            perkarapihak.pihakke,
            perkarapihak.ketpihak,
            perkarapihak.pengacara_pihak_id,
            datarelaas.id AS relaas_id,
            DATE_FORMAT(datarelaas.tanggal_relaas, '%d-%m-%Y') AS tanggal_relaas,
            datarelaas.doc_relaas,
            sidang.urutan,
            jadwalsidang.urutan AS urutan_sebelumnya,
            jadwalsidang.dihadiri_oleh AS status_kehadiran_sebelumnya,
            (CASE WHEN(phs.tahapan_id = 12) THEN 'Y' ELSE 'T' END) AS sidang_pertama
          FROM perkara AS perk
					JOIN perkara_hakim_pn AS h ON h.perkara_id = perk.perkara_id
          JOIN perkara_jadwal_sidang AS sidang ON sidang.perkara_id = perk.perkara_id
          JOIN (
            SELECT p1.perkara_id, p1.pihak_id, p1.nama, 1 AS pihakke, 'pihak p' AS ketpihak, '' AS pengacara_pihak_id
            FROM perkara_pihak1 AS p1 JOIN perkara ON perkara.perkara_id = p1.perkara_id WHERE alur_perkara_id < 111
            UNION
            SELECT p2.perkara_id, p2.pihak_id, p2.nama, 2 AS pihakke, 'pihak t' AS ketpihak, '' AS pengacara_pihak_id
            FROM perkara_pihak2 AS p2 JOIN perkara ON perkara.perkara_id = p2.perkara_id WHERE alur_perkara_id < 111
              AND (status_penahanan_id IS NULL OR status_penahanan_id = 0)
              AND (jenis_tahanan_id = 0 OR jenis_tahanan_id IS NULL)
            UNION
            SELECT p3.perkara_id, p3.pihak_id, p3.nama, 3 AS pihakke, 'intervensi' AS ketpihak, '' AS pengacara_pihak_id
            FROM perkara_pihak3 AS p3
            UNION
            SELECT p4.perkara_id, p4.pihak_id, p4.nama, 4 AS pihakke, 'turut' AS ketpihak, '' AS pengacara_pihak_id
            FROM perkara_pihak4 AS p4
            UNION
            SELECT p5.perkara_id, p5.pengacara_id, p5.nama, p5.pihak_ke AS pihakke, 'pengacara' AS ketpihak, p5.pihak_id AS pengacara_pihak_id
            FROM perkara_pengacara AS p5
          ) AS perkarapihak ON perkarapihak.perkara_id = perk.perkara_id
          LEFT JOIN perkara_pelaksanaan_relaas AS datarelaas ON datarelaas.pihak_id = perkarapihak.pihak_id
            AND datarelaas.perkara_id = perk.perkara_id AND datarelaas.sidang_id = sidang.id
          LEFT JOIN (
            SELECT perkara.perkara_id AS perkara_id, perkara_jadwal_sidang.urutan AS urutan, perkara_jadwal_sidang.dihadiri_oleh
            FROM perkara JOIN perkara_jadwal_sidang ON (perkara_jadwal_sidang.perkara_id = perkara.perkara_id)
          ) AS jadwalsidang ON (jadwalsidang.perkara_id = perk.perkara_id AND jadwalsidang.urutan = sidang.urutan - 1)
          LEFT JOIN perkara_penetapan_hari_sidang AS phs ON (phs.perkara_id = perk.perkara_id AND phs.jadwalsidang_id = sidang.id)
          JOIN alur_perkara AS alur ON alur.id = perk.alur_perkara_id
          LEFT JOIN perkara_efiling_id AS k ON perk.perkara_id = k.perkara_id
          LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON perk.perkara_id = i.perkara_id
          LEFT JOIN perkara_jurusita AS m ON perk.perkara_id = m.perkara_id
          WHERE h.hakim_nama LIKE '%${namaHakim}%' AND YEAR(perk.tanggal_pendaftaran) = YEAR(CURDATE())
            AND perk.alur_perkara_id < 111
            AND perkarapihak.pihak_id NOT IN (
              SELECT pp.pihak_id
              FROM perkara_pelaksanaan_relaas
              JOIN perkara_pengacara AS pp ON pp.pengacara_id = perkara_pelaksanaan_relaas.pihak_id
                AND pp.perkara_id = perkara_pelaksanaan_relaas.perkara_id
              JOIN perkara ON pp.perkara_id = perkara.perkara_id
              WHERE perk.alur_perkara_id < 111 AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
                AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
                AND (perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.tanggal_relaas <> '')
                AND (perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.doc_relaas <> '')
              UNION
              SELECT ppb.pengacara_id
              FROM perkara_pelaksanaan_relaas
              JOIN perkara_pengacara AS ppb ON ppb.pihak_id = perkara_pelaksanaan_relaas.pihak_id
                AND ppb.perkara_id = perkara_pelaksanaan_relaas.perkara_id
              JOIN perkara ON ppb.perkara_id = perkara.perkara_id
              WHERE perk.alur_perkara_id < 111 AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
                AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
                AND (perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.tanggal_relaas <> '')
                AND (perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.doc_relaas <> '')
            )
            AND (
              (datarelaas.tanggal_relaas IS NULL OR datarelaas.tanggal_relaas = '')
              OR (datarelaas.doc_relaas IS NULL OR datarelaas.doc_relaas = '')
            )
            AND (perk.alur_perkara_id >= 1 AND perk.alur_perkara_id <= 17)
            AND (
              (jadwalsidang.dihadiri_oleh <> 1)
              AND (jadwalsidang.dihadiri_oleh = 2 AND (perkarapihak.pihakke = 2 OR perkarapihak.pihakke = 4))
              OR (jadwalsidang.dihadiri_oleh = 3 AND perkarapihak.pihakke = 1)
              OR (jadwalsidang.dihadiri_oleh = 4 OR jadwalsidang.dihadiri_oleh IS NULL)
            )
            AND sidang.tanggal_sidang = CURDATE()
            AND sidang.agenda NOT LIKE '%elektronik%'
            AND sidang.agenda NOT LIKE '%putusan%'
            AND sidang.agenda NOT LIKE '%penetapan%'
          ORDER BY perk.perkara_id DESC, sidang.tanggal_sidang ASC`;

          db.query(query, (err, result) => {
            if (err) {
              reject(err);
            } else {
              if (result.length != 0) {
                const messages = result.map((r, index) => {
                  return `${index + 1}. ${r.nomor_perkara} ${r.ecourt}${r.ghaib}${r.prodeo}\nNama Pihak : ${r.nama_pihak} ${r.ketpihak}\n*Jurusita : ${r.jurusita}*`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk hakim: ${namaHakim}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching belum panggilan hari ini hakim data:", error);
      reject(error);
    }
  });
};

const getDataJadwalSidangPerdataPanitera = (namaPanitera) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT DISTINCT
            a.perkara_id,
            b.tanggal_sidang,
            a.nomor_perkara,
            b.agenda,
            c.panitera_nama,
            a.tanggal_pendaftaran,
            a.jenis_perkara_nama,
            a.para_pihak,
            a.tahapan_terakhir_id,
            a.tahapan_terakhir_text,
            a.proses_terakhir_id,
            a.proses_terakhir_text,
            n.majelis_hakim_kode,
            n.majelis_hakim_text,
            m.jurusita_nama,
            CASE WHEN f.jabatan_hakim_nama = 'Hakim Tunggal' THEN 'T' ELSE 'KM' END AS jabatan_hakim,
            CASE
                WHEN a.proses_terakhir_id < 210 THEN DATEDIFF(CURDATE(), a.tanggal_pendaftaran) - IFNULL((SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0)
                ELSE DATEDIFF(d.tanggal_putusan, a.tanggal_pendaftaran) - IFNULL((SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0)
            END + 1 AS durasi,
            CASE WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)' ELSE '' END AS ghaib,
            CASE WHEN a.prodeo = 1 THEN ' (_Prodeo_)' ELSE '' END AS prodeo,
            CASE WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)' ELSE '' END AS ecourt
          FROM 
            perkara AS a
          LEFT JOIN (SELECT perkara_id, MAX(tanggal_sidang) AS tanggal_sidang_terakhir FROM perkara_jadwal_sidang GROUP BY perkara_id) AS subq ON a.perkara_id = subq.perkara_id
          LEFT JOIN perkara_jadwal_sidang AS b ON a.perkara_id = b.perkara_id AND b.tanggal_sidang = subq.tanggal_sidang_terakhir
          LEFT JOIN perkara_panitera_pn AS c ON a.perkara_id = c.perkara_id
          LEFT JOIN perkara_putusan AS d ON a.perkara_id = d.perkara_id
          LEFT JOIN perkara_hakim_pn AS f ON a.perkara_id = f.perkara_id
          LEFT JOIN perkara_pelaksanaan_relaas AS g ON a.perkara_id = g.perkara_id
          LEFT JOIN (SELECT perkara_id FROM perkara_efiling_id) AS h ON a.perkara_id = h.perkara_id
          LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
          LEFT JOIN perkara_pihak2 AS j ON a.perkara_id = j.perkara_id
          LEFT JOIN perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
          LEFT JOIN perkara_pengacara AS l ON a.perkara_id = l.perkara_id
          LEFT JOIN perkara_jurusita AS m ON a.perkara_id = m.perkara_id
          LEFT JOIN perkara_penetapan AS n ON a.perkara_id = n.perkara_id
          LEFT JOIN perkara_ikrar_talak AS o ON a.perkara_id = o.perkara_id
          LEFT JOIN v_pihak_perkara AS x ON a.perkara_id = x.perkara_id
          LEFT JOIN pihak AS w ON x.pihak_id = w.id
          LEFT JOIN (
              SELECT a.pihak_id,
              MAX(CASE WHEN a.pihak_ke = 1 THEN CONCAT('+62', SUBSTRING(b.telepon, 2)) ELSE NULL END) AS teleponPenggugat,
              MAX(CASE WHEN a.pihak_ke = 2 THEN CONCAT('+62', SUBSTRING(b.telepon, 2)) ELSE NULL END) AS teleponTergugat
              FROM v_pihak_perkara AS a
              JOIN pihak AS b ON a.pihak_id = b.id AND b.telepon REGEXP '^[0-9]' AND CHAR_LENGTH(b.telepon) > 8
              GROUP BY a.pihak_id
          ) AS telepons ON x.pihak_id = telepons.pihak_id
          LEFT JOIN (
              SELECT perk.perkara_id,
              CASE
                  WHEN datarelaas.tanggal_relaas IS NULL OR datarelaas.tanggal_relaas = '' THEN
                  CASE
                      WHEN perkarapihak.pihakke = 1 THEN '(Belum Dipanggil P)'
                      WHEN perkarapihak.pihakke = 2 THEN '(Belum Dipanggil T)'
                      WHEN perkarapihak.pihakke IN (1,2) THEN '(Belum Dipanggil PT)'
                      WHEN perkarapihak.pihakke IN (1,2,4) THEN '(Belum Dipanggil PT & Turut T)'
                      WHEN perkarapihak.pihakke = 4 THEN '(Belum Dipanggil Turut Tergugat)'
                      ELSE '(Sudah Dipanggil dan Diupload)'
                  END
              WHEN datarelaas.doc_relaas IS NULL OR datarelaas.doc_relaas = '' THEN
                  CASE
                      WHEN perkarapihak.pihakke = 1 THEN '(Belum Diupload P)'
                      WHEN perkarapihak.pihakke = 2 THEN '(Belum Diupload T)'
                      WHEN perkarapihak.pihakke IN (1,2) THEN '(Belum Diupload PT)'
                      WHEN perkarapihak.pihakke IN (1,2,4) THEN '(Belum Diupload PT & Turut T)'
                      WHEN perkarapihak.pihakke = 4 THEN '(Belum Diupload Turut Tergugat)'
                      ELSE '(Sudah Dipanggil dan Diupload)'
                  END
              ELSE '(Sudah Dipanggil dan Diupload)'
              END AS panggilan_status
              FROM perkara AS perk
              JOIN perkara_jadwal_sidang AS sidang ON sidang.perkara_id = perk.perkara_id
              JOIN (
                  SELECT p1.perkara_id, p1.pihak_id, p1.nama, 1 AS pihakke, 'pihak p' AS ketpihak, '' AS pengacara_pihak_id
                  FROM perkara_pihak1 AS p1
                  JOIN perkara ON perkara.perkara_id = p1.perkara_id WHERE alur_perkara_id < 111
                  UNION
                  SELECT p2.perkara_id, p2.pihak_id, p2.nama, 2 AS pihakke, 'pihak t' AS ketpihak, '' AS pengacara_pihak_id
                  FROM perkara_pihak2 AS p2
                  JOIN perkara ON perkara.perkara_id = p2.perkara_id
                  WHERE alur_perkara_id < 111 AND (status_penahanan_id IS NULL OR status_penahanan_id = 0) AND (jenis_tahanan_id = 0 OR jenis_tahanan_id IS NULL)
                  UNION
                  SELECT p3.perkara_id, p3.pihak_id, p3.nama, 3 AS pihakke, 'intervensi' AS ketpihak, '' AS pengacara_pihak_id
                  FROM perkara_pihak3 AS p3
                  UNION
                  SELECT p4.perkara_id, p4.pihak_id, p4.nama, 4 AS pihakke, 'turut' AS ketpihak, '' AS pengacara_pihak_id
                  FROM perkara_pihak4 AS p4
                  UNION
                  SELECT p5.perkara_id, p5.pengacara_id, p5.nama, p5.pihak_ke AS pihakke, 'pengacara' AS ketpihak, p5.pihak_id AS pengacara_pihak_id
                  FROM perkara_pengacara AS p5
              ) AS perkarapihak ON perkarapihak.perkara_id = perk.perkara_id
              LEFT JOIN perkara_pelaksanaan_relaas AS datarelaas ON datarelaas.pihak_id = perkarapihak.pihak_id AND datarelaas.perkara_id = perk.perkara_id AND datarelaas.sidang_id = sidang.id
              LEFT JOIN (
                  SELECT perkara.perkara_id AS perkara_id, perkara_jadwal_sidang.urutan AS urutan, perkara_jadwal_sidang.dihadiri_oleh
                  FROM perkara
                  JOIN perkara_jadwal_sidang ON (perkara_jadwal_sidang.perkara_id = perkara.perkara_id)
              ) AS jadwalsidang ON (jadwalsidang.perkara_id = perk.perkara_id AND jadwalsidang.urutan = sidang.urutan - 1)
              LEFT JOIN perkara_penetapan_hari_sidang AS phs ON (phs.perkara_id = perk.perkara_id AND phs.jadwalsidang_id = sidang.id)
              JOIN alur_perkara AS alur ON alur.id = perk.alur_perkara_id
              WHERE YEAR(perk.tanggal_pendaftaran) = YEAR(CURDATE()) AND perk.alur_perkara_id < 111 AND perkarapihak.pihak_id NOT IN (
                  SELECT pp.pihak_id
                  FROM perkara_pelaksanaan_relaas
                  JOIN perkara_pengacara AS pp ON pp.pengacara_id = perkara_pelaksanaan_relaas.pihak_id AND pp.perkara_id = perkara_pelaksanaan_relaas.perkara_id
                  JOIN perkara ON pp.perkara_id = perkara.perkara_id
                  WHERE perk.alur_perkara_id < 111 AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
                  AND (perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.tanggal_relaas <> '')
                  AND (perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.doc_relaas <> '')
                  UNION
                  SELECT ppb.pengacara_id
                  FROM perkara_pelaksanaan_relaas
                  JOIN perkara_pengacara AS ppb ON ppb.pihak_id = perkara_pelaksanaan_relaas.pihak_id AND ppb.perkara_id = perkara_pelaksanaan_relaas.perkara_id
                  JOIN perkara ON ppb.perkara_id = perkara.perkara_id
                  WHERE perk.alur_perkara_id < 111 AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
                  AND (perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.tanggal_relaas <> '')
                  AND (perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.doc_relaas <> '')
              )
              AND ((datarelaas.tanggal_relaas IS NULL OR datarelaas.tanggal_relaas = '') OR (datarelaas.doc_relaas IS NULL OR datarelaas.doc_relaas = ''))
              AND (perk.alur_perkara_id >= 1 AND perk.alur_perkara_id <= 17)
              AND ((jadwalsidang.dihadiri_oleh <> 1) AND (jadwalsidang.dihadiri_oleh = 2 AND (perkarapihak.pihakke = 2 OR perkarapihak.pihakke = 4)) OR (jadwalsidang.dihadiri_oleh = 3 AND perkarapihak.pihakke = 1) OR (jadwalsidang.dihadiri_oleh = 4 OR jadwalsidang.dihadiri_oleh IS NULL))
          ) AS doc_relaas_status 
          ON a.perkara_id = doc_relaas_status.perkara_id
          WHERE b.tanggal_sidang = CURDATE() AND c.panitera_nama LIKE '%${namaPanitera}%' AND a.alur_perkara_id IN (15, 16, 17) AND c.aktif = 'Y' AND f.aktif = 'Y' AND m.aktif = 'Y'
          AND (CASE WHEN a.jenis_perkara_id = 346 AND d.status_putusan_id = 62 AND o.amar_ikrar_talak IS NULL THEN a.proses_terakhir_id < 296 ELSE a.proses_terakhir_id < 218 END)
          ORDER BY CASE WHEN b.alasan_ditunda LIKE '%putusan%' OR b.alasan_ditunda LIKE '%penetapan%' OR b.alasan_ditunda LIKE '%musyawarah%' THEN 1 ELSE 2 END, a.alur_perkara_id, f.hakim_nama, a.jenis_perkara_id DESC, b.urutan DESC, a.nomor_perkara, ecourt, ghaib, prodeo DESC;`;

          db.query(query, (err, result) => {
            if (err) {
              reject(err);
            } else {
              if (result.length != 0) {
                const messages = result.map((r, index) => {
                  return `*${index + 1}. ${r.nomor_perkara}* ${r.ecourt}${r.ghaib}${r.prodeo} (${r.durasi} Hari)\nMajelis Hakim : *${r.majelis_hakim_kode}*\nJenis Perkara : ${r.jenis_perkara_nama}\nAgenda : ${r.agenda}\nJS : ${r.jurusita_nama}`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk panitera: ${namaPanitera}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching jadwal sidang panitera data:", error);
      reject(error);
    }
  });
};

const getDataAntrianSidangHakim = (namaHakim) => {
  return new Promise((resolve, reject) => {
    try {
      const antrianQuery = `
        SELECT perkara_id, majelis_hakim_kode, pihak_1, pihak_2
        FROM antrian_sidang
        WHERE (pihak_1 IS NOT NULL OR pihak_2 IS NOT NULL)
      `;

      db4.query(antrianQuery, (err, antrianResults) => {
        if (err) {
          console.error("[DB4 Error]", err);
          return reject(err);
        }

        if (antrianResults.length === 0) {
          return resolve("Tidak ada data");
        }

        const perkaraIds = antrianResults.map(r => r.perkara_id);
        const placeholders = perkaraIds.map(() => "?").join(",");
        const detailQuery = `
          SELECT
            p.perkara_id,
            p.nomor_perkara,
            pp.majelis_hakim_text,
            pjs.agenda,
            CASE WHEN p.proses_terakhir_id < 210 THEN DATEDIFF(CURDATE(), p.tanggal_pendaftaran) - IFNULL((SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = p.perkara_id), 0) ELSE DATEDIFF(d.tanggal_putusan, p.tanggal_pendaftaran) - IFNULL((SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = p.perkara_id), 0) END + 1 AS durasi,
            CASE WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)' ELSE '' END AS ghaib,
            CASE WHEN p.prodeo = 1 THEN ' (_Prodeo_)' ELSE '' END AS prodeo
          FROM perkara p
          JOIN perkara_penetapan pp ON p.perkara_id = pp.perkara_id
          LEFT JOIN (
            SELECT perkara_id, MAX(tanggal_sidang) AS tanggal_sidang_terakhir
            FROM perkara_jadwal_sidang GROUP BY perkara_id
          ) AS subq ON p.perkara_id = subq.perkara_id
          LEFT JOIN perkara_jadwal_sidang pjs ON p.perkara_id = pjs.perkara_id AND pjs.tanggal_sidang = subq.tanggal_sidang_terakhir
          LEFT JOIN (
            SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1
          ) AS i ON p.perkara_id = i.perkara_id
          LEFT JOIN perkara_putusan d ON p.perkara_id = d.perkara_id
          WHERE p.perkara_id IN (${placeholders}) AND pp.majelis_hakim_text LIKE ?
        `;

        db.query(detailQuery, [...perkaraIds, `%${namaHakim}%`], (err2, result) => {
          if (err2) {
            console.error(`[DB Error Hakim - ${namaHakim}]`, err2);
            return reject(err2);
          }

          if (result.length === 0) {
            return resolve("Tidak ada data");
          }

          const messages = result.map((r, index) => {
            return `${index + 1}. ${r.nomor_perkara}${r.ghaib || ''}${r.prodeo || ''} (${r.durasi} hari)\nAgenda : ${r.agenda}`;
          });

          resolve(messages.join("\n\n"));
        });
      });

    } catch (error) {
      console.error(`Error in getDataAntrianSidangHakim:`, error);
      reject(error);
    }
  });
};

const getDataAntrianSidangPanitera = (namaPanitera) => {
  return new Promise((resolve, reject) => {
    try {
      const antrianQuery = `
        SELECT perkara_id, majelis_hakim_kode, pihak_1, pihak_2
        FROM antrian_sidang
        WHERE (pihak_1 IS NOT NULL OR pihak_2 IS NOT NULL)
      `;

      db4.query(antrianQuery, (err, antrianResults) => {
        if (err) {
          console.error("[DB4 Error]", err);
          return reject(err);
        }

        if (antrianResults.length === 0) {
          return resolve("Tidak ada data");
        }

        const perkaraIds = antrianResults.map(r => r.perkara_id);
        const placeholders = perkaraIds.map(() => "?").join(",");
        const detailQuery = `
          SELECT
            p.perkara_id,
            p.nomor_perkara,
            pp.panitera_pengganti_text,
            pjs.agenda,
            CASE WHEN p.proses_terakhir_id < 210 THEN DATEDIFF(CURDATE(), p.tanggal_pendaftaran) - IFNULL((SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = p.perkara_id), 0) ELSE DATEDIFF(d.tanggal_putusan, p.tanggal_pendaftaran) - IFNULL((SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = p.perkara_id), 0) END + 1 AS durasi,
            CASE WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)' ELSE '' END AS ghaib,
            CASE WHEN p.prodeo = 1 THEN ' (_Prodeo_)' ELSE '' END AS prodeo
          FROM perkara p
          JOIN perkara_penetapan pp ON p.perkara_id = pp.perkara_id
          LEFT JOIN (
            SELECT perkara_id, MAX(tanggal_sidang) AS tanggal_sidang_terakhir
            FROM perkara_jadwal_sidang GROUP BY perkara_id
          ) AS subq ON p.perkara_id = subq.perkara_id
          LEFT JOIN perkara_jadwal_sidang pjs ON p.perkara_id = pjs.perkara_id AND pjs.tanggal_sidang = subq.tanggal_sidang_terakhir
          LEFT JOIN (
            SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1
          ) AS i ON p.perkara_id = i.perkara_id
          LEFT JOIN perkara_putusan d ON p.perkara_id = d.perkara_id
          WHERE p.perkara_id IN (${placeholders}) AND pp.panitera_pengganti_text LIKE ?
        `;

        db.query(detailQuery, [...perkaraIds, `%${namaPanitera}%`], (err2, result) => {
          if (err2) {
            console.error(`[DB Error Panitera - ${namaPanitera}]`, err2);
            return reject(err2);
          }

          if (result.length === 0) {
            return resolve("Tidak ada data");
          }

          const messages = result.map((r, index) => {
            return `${index + 1}. ${r.nomor_perkara}${r.ghaib || ''}${r.prodeo || ''} (${r.durasi} hari)\nAgenda : ${r.agenda}`;
          });

          resolve(messages.join("\n\n"));
        });
      });

    } catch (error) {
      console.error(`Error in getDataAntrianSidangPanitera:`, error);
      reject(error);
    }
  });
};

const getDataPerkaraAktifPanitera = (namaPanitera) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT DISTINCT
            b.tanggal_sidang,
            a.nomor_perkara,
            b.agenda,
            c.panitera_nama,
            a.perkara_id,
            a.tanggal_pendaftaran,
            a.jenis_perkara_nama,
            a.para_pihak,
            a.tahapan_terakhir_id,
            a.tahapan_terakhir_text,
            a.proses_terakhir_id,
            a.proses_terakhir_text,
            f.hakim_nama,
            n.majelis_hakim_kode,
            m.jurusita_nama,
            CASE WHEN f.jabatan_hakim_nama = 'Hakim Tunggal' THEN 'T' ELSE 'KM' END AS jabatan_hakim,
            CASE WHEN a.proses_terakhir_id < 210 THEN DATEDIFF(CURDATE(), a.tanggal_pendaftaran) - IFNULL((SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0) ELSE DATEDIFF(d.tanggal_putusan, a.tanggal_pendaftaran) - IFNULL((SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0) END + 1 AS durasi,
            CASE WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)' ELSE '' END AS ghaib,
            CASE WHEN a.prodeo = 1 THEN ' (_Prodeo_)' ELSE '' END AS prodeo,
            CASE WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)' ELSE '' END AS ecourt
          FROM 
            perkara AS a
          LEFT JOIN (SELECT perkara_id, MAX(tanggal_sidang) AS tanggal_sidang_terakhir FROM perkara_jadwal_sidang GROUP BY perkara_id) AS subq ON a.perkara_id = subq.perkara_id
          LEFT JOIN perkara_jadwal_sidang AS b ON a.perkara_id = b.perkara_id AND b.tanggal_sidang = subq.tanggal_sidang_terakhir
          LEFT JOIN perkara_panitera_pn AS c ON a.perkara_id = c.perkara_id
          LEFT JOIN perkara_putusan AS d ON a.perkara_id = d.perkara_id
          LEFT JOIN perkara_hakim_pn AS f ON a.perkara_id = f.perkara_id
          LEFT JOIN perkara_pelaksanaan_relaas AS g ON a.perkara_id = g.perkara_id
          LEFT JOIN (SELECT perkara_id FROM perkara_efiling_id) AS h ON a.perkara_id = h.perkara_id
          LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
          LEFT JOIN perkara_pihak2 AS j ON a.perkara_id = j.perkara_id
          LEFT JOIN perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
          LEFT JOIN perkara_pengacara AS l ON a.perkara_id = l.perkara_id
          LEFT JOIN perkara_jurusita AS m ON a.perkara_id = m.perkara_id
          LEFT JOIN perkara_penetapan AS n ON a.perkara_id = n.perkara_id
          LEFT JOIN perkara_ikrar_talak AS o ON a.perkara_id = o.perkara_id
          LEFT JOIN v_pihak_perkara AS x ON a.perkara_id = x.perkara_id
          LEFT JOIN pihak AS w ON x.pihak_id = w.id
          LEFT JOIN (
            SELECT a.pihak_id,
              MAX(CASE WHEN a.pihak_ke = 1 THEN CONCAT('+62', SUBSTRING(b.telepon, 2)) ELSE NULL END) AS teleponPenggugat,
              MAX(CASE WHEN a.pihak_ke = 2 THEN CONCAT('+62', SUBSTRING(b.telepon, 2)) ELSE NULL END) AS teleponTergugat
            FROM v_pihak_perkara AS a
            JOIN pihak AS b ON a.pihak_id = b.id AND b.telepon REGEXP '^[0-9]' AND CHAR_LENGTH(b.telepon) > 8
            GROUP BY a.pihak_id
          ) AS telepons ON x.pihak_id = telepons.pihak_id
          LEFT JOIN (
            SELECT perk.perkara_id,
              CASE WHEN datarelaas.tanggal_relaas IS NULL OR datarelaas.tanggal_relaas = '' THEN
                CASE WHEN perkarapihak.pihakke = 1 THEN '(Belum Dipanggil P)'
                     WHEN perkarapihak.pihakke = 2 THEN '(Belum Dipanggil T)'
                     WHEN perkarapihak.pihakke IN (1,2) THEN '(Belum Dipanggil PT)'
                     WHEN perkarapihak.pihakke IN (1,2,4) THEN '(Belum Dipanggil PT & Turut T)'
                     WHEN perkarapihak.pihakke = 4 THEN '(Belum Dipanggil Turut Tergugat)'
                     ELSE '(Sudah Dipanggil dan Diupload)' END
              WHEN datarelaas.doc_relaas IS NULL OR datarelaas.doc_relaas = '' THEN
                CASE WHEN perkarapihak.pihakke = 1 THEN '(Belum Diupload P)'
                     WHEN perkarapihak.pihakke = 2 THEN '(Belum Diupload T)'
                     WHEN perkarapihak.pihakke IN (1,2) THEN '(Belum Diupload PT)'
                     WHEN perkarapihak.pihakke IN (1,2,4) THEN '(Belum Diupload PT & Turut T)'
                     WHEN perkarapihak.pihakke = 4 THEN '(Belum Diupload Turut Tergugat)'
                     ELSE '(Sudah Dipanggil dan Diupload)' END
              ELSE '(Sudah Dipanggil dan Diupload)' END AS panggilan_status
            FROM perkara AS perk
            JOIN perkara_jadwal_sidang AS sidang ON sidang.perkara_id = perk.perkara_id
            JOIN (
              SELECT p1.perkara_id, p1.pihak_id, p1.nama, 1 AS pihakke, 'pihak p' AS ketpihak, '' AS pengacara_pihak_id
              FROM perkara_pihak1 AS p1
              JOIN perkara ON perkara.perkara_id = p1.perkara_id WHERE alur_perkara_id < 111
              UNION
              SELECT p2.perkara_id, p2.pihak_id, p2.nama, 2 AS pihakke, 'pihak t' AS ketpihak, '' AS pengacara_pihak_id
              FROM perkara_pihak2 AS p2
              JOIN perkara ON perkara.perkara_id = p2.perkara_id
              WHERE alur_perkara_id < 111 AND (status_penahanan_id IS NULL OR status_penahanan_id = 0) AND (jenis_tahanan_id = 0 OR jenis_tahanan_id IS NULL)
              UNION
              SELECT p3.perkara_id, p3.pihak_id, p3.nama, 3 AS pihakke, 'intervensi' AS ketpihak, '' AS pengacara_pihak_id
              FROM perkara_pihak3 AS p3
              UNION
              SELECT p4.perkara_id, p4.pihak_id, p4.nama, 4 AS pihakke, 'turut' AS ketpihak, '' AS pengacara_pihak_id
              FROM perkara_pihak4 AS p4
              UNION
              SELECT p5.perkara_id, p5.pengacara_id, p5.nama, p5.pihak_ke AS pihakke, 'pengacara' AS ketpihak, p5.pihak_id AS pengacara_pihak_id
              FROM perkara_pengacara AS p5
            ) AS perkarapihak ON perkarapihak.perkara_id = perk.perkara_id
            LEFT JOIN perkara_pelaksanaan_relaas AS datarelaas ON datarelaas.pihak_id = perkarapihak.pihak_id AND datarelaas.perkara_id = perk.perkara_id AND datarelaas.sidang_id = sidang.id
            LEFT JOIN (
              SELECT perkara.perkara_id AS perkara_id, perkara_jadwal_sidang.urutan AS urutan, perkara_jadwal_sidang.dihadiri_oleh
              FROM perkara JOIN perkara_jadwal_sidang ON (perkara_jadwal_sidang.perkara_id = perkara.perkara_id)
            ) AS jadwalsidang ON (jadwalsidang.perkara_id = perk.perkara_id AND jadwalsidang.urutan = sidang.urutan - 1)
            LEFT JOIN perkara_penetapan_hari_sidang AS phs ON (phs.perkara_id = perk.perkara_id AND phs.jadwalsidang_id = sidang.id)
            JOIN alur_perkara AS alur ON alur.id = perk.alur_perkara_id
            WHERE YEAR(perk.tanggal_pendaftaran) = YEAR(CURDATE()) AND perk.alur_perkara_id < 111 AND perkarapihak.pihak_id NOT IN (
              SELECT pp.pihak_id
              FROM perkara_pelaksanaan_relaas
              JOIN perkara_pengacara AS pp ON pp.pengacara_id = perkara_pelaksanaan_relaas.pihak_id AND pp.perkara_id = perkara_pelaksanaan_relaas.perkara_id
              JOIN perkara ON pp.perkara_id = perkara.perkara_id
              WHERE perk.alur_perkara_id < 111 AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
              AND (perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.tanggal_relaas <> '')
              AND (perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.doc_relaas <> '')
              UNION
              SELECT ppb.pengacara_id
              FROM perkara_pelaksanaan_relaas
              JOIN perkara_pengacara AS ppb ON ppb.pihak_id = perkara_pelaksanaan_relaas.pihak_id AND ppb.perkara_id = perkara_pelaksanaan_relaas.perkara_id
              JOIN perkara ON ppb.perkara_id = perkara.perkara_id
              WHERE perk.alur_perkara_id < 111 AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
              AND (perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.tanggal_relaas <> '')
              AND (perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.doc_relaas <> '')
            )
            AND ((datarelaas.tanggal_relaas IS NULL OR datarelaas.tanggal_relaas = '') OR (datarelaas.doc_relaas IS NULL OR datarelaas.doc_relaas = ''))
            AND (perk.alur_perkara_id >= 1 AND perk.alur_perkara_id <= 17)
            AND ((jadwalsidang.dihadiri_oleh <> 1) AND (jadwalsidang.dihadiri_oleh = 2 AND (perkarapihak.pihakke = 2 OR perkarapihak.pihakke = 4)) OR (jadwalsidang.dihadiri_oleh = 3 AND perkarapihak.pihakke = 1) OR (jadwalsidang.dihadiri_oleh = 4 OR jadwalsidang.dihadiri_oleh IS NULL))
          ) AS doc_relaas_status 
          ON a.perkara_id = doc_relaas_status.perkara_id
          WHERE YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE()) AND c.panitera_nama LIKE '%${namaPanitera}%' AND a.alur_perkara_id IN (15, 16, 17) AND c.aktif = 'Y' AND f.aktif = 'Y' AND m.aktif = 'Y'
          AND (CASE WHEN a.jenis_perkara_id = 346 AND d.status_putusan_id = 62 AND o.amar_ikrar_talak IS NULL THEN a.proses_terakhir_id < 296 ELSE a.proses_terakhir_id < 218 END)
          ORDER BY b.tanggal_sidang, n.majelis_hakim_kode, a.nomor_perkara, a.alur_perkara_id, ecourt, ghaib, prodeo DESC;`;

          db.query(query, (err, result) => {
            if (err) {
              reject(err);
            } else {
              if (result.length != 0) {
                const messages = result.map((r, index) => {
                  return `*${index + 1}. ${r.nomor_perkara}*${r.ecourt}${r.ghaib}${r.prodeo} (${r.durasi} Hari)\nMajelis Hakim : ${r.majelis_hakim_kode}\nTanggal Sidang : ${moment(r.tanggal_sidang).format("DD-MM-YYYY")}\nAgenda : ${r.agenda}\nJS : ${r.jurusita_nama}`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk panitera: ${namaPanitera}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching perkara aktif panitera data:", error);
      reject(error);
    }
  });
};

const getTotalPenerimaanPerkaraPanitera = (namaPanitera) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT 
            COUNT(CASE 
                WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
                    AND perkara.alur_perkara_id != 114 
                    AND perkara_panitera_pn.panitera_nama LIKE '%${namaPanitera}%'
                    AND perkara_panitera_pn.aktif = 'Y'
                THEN perkara.perkara_id 
            END) AS jumlah_masuk,

            (SELECT COUNT(*)
            FROM perkara
            WHERE YEAR(tanggal_pendaftaran) = YEAR(CURDATE())
              AND alur_perkara_id != 114
            ) AS total_perkara_masuk,

            COUNT(CASE 
                WHEN YEAR(perkara_putusan.tanggal_putusan) = YEAR(CURDATE()) 
                    AND perkara_putusan.tanggal_putusan IS NOT NULL 
                    AND perkara.alur_perkara_id != 114 
                    AND perkara_panitera_pn.panitera_nama LIKE '%${namaPanitera}%'
                    AND perkara_panitera_pn.aktif = 'Y'
                THEN perkara.perkara_id 
            END) AS jumlah_putus,

            -- Menambahkan kolom persentase
            CASE
                WHEN COUNT(CASE 
                    WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
                        AND perkara.alur_perkara_id != 114 
                        AND perkara_panitera_pn.panitera_nama LIKE '%${namaPanitera}%'
                        AND perkara_panitera_pn.aktif = 'Y'
                    THEN perkara.perkara_id 
                END) = 0 THEN 0
                ELSE 
                    (COUNT(CASE 
                        WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
                            AND perkara.alur_perkara_id != 114 
                            AND perkara_panitera_pn.panitera_nama LIKE '%${namaPanitera}%'
                            AND perkara_panitera_pn.aktif = 'Y'
                        THEN perkara.perkara_id 
                    END) * 100.0 / (SELECT COUNT(*)
                                    FROM perkara
                                    WHERE YEAR(tanggal_pendaftaran) = YEAR(CURDATE())
                                      AND alur_perkara_id != 114
                                  )) 
            END AS persentase_masuk
          FROM perkara
          LEFT JOIN perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id
          LEFT JOIN perkara_panitera_pn ON perkara_panitera_pn.perkara_id = perkara.perkara_id
          WHERE perkara_panitera_pn.aktif = 'Y';`;

          db.query(query, (err, result) => {
            if (err) {
              reject(err);
            } else {
              if (result.length != 0) {
                const messages = result.map((r, index) => {
                  return `- Perkara Ditangani : ${r.jumlah_masuk}\n- Perkara Putus : ${r.jumlah_putus}\n- Total Perkara Masuk di PA : ${r.total_perkara_masuk}\n- Persentase : ${r.persentase_masuk}%`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk panitera: ${namaPanitera}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching penerimaan perkara panitera data:", error);
      reject(error);
    }
  });
};

const getDataJadwalBesokPaniteraNew = (namaPanitera) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT DISTINCT
            a.perkara_id,
            b.tanggal_sidang,
            a.nomor_perkara,
            b.agenda,
            c.panitera_nama,
            a.tanggal_pendaftaran,
            a.jenis_perkara_nama,
            a.para_pihak,
            a.tahapan_terakhir_id,
            a.tahapan_terakhir_text,
            a.proses_terakhir_id,
            a.proses_terakhir_text,
            n.majelis_hakim_kode,
            n.majelis_hakim_text,
            m.jurusita_nama,
            CASE WHEN f.jabatan_hakim_nama = 'Hakim Tunggal' THEN 'T' ELSE 'KM' END AS jabatan_hakim,
            CASE WHEN a.proses_terakhir_id < 210 THEN
                DATEDIFF(CURDATE(), a.tanggal_pendaftaran) - IFNULL((SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0)
              ELSE
                DATEDIFF(d.tanggal_putusan, a.tanggal_pendaftaran) - IFNULL((SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0)
            END + 1 AS durasi,
            CASE WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)' ELSE '' END AS ghaib,
            CASE WHEN a.prodeo = 1 THEN ' (_Prodeo_)' ELSE '' END AS prodeo,
            CASE WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)' ELSE '' END AS ecourt
          FROM 
            perkara AS a
          LEFT JOIN (SELECT perkara_id, MAX(tanggal_sidang) AS tanggal_sidang_terakhir FROM perkara_jadwal_sidang GROUP BY perkara_id) AS subq ON a.perkara_id = subq.perkara_id
          LEFT JOIN perkara_jadwal_sidang AS b ON a.perkara_id = b.perkara_id AND b.tanggal_sidang = subq.tanggal_sidang_terakhir
          LEFT JOIN perkara_panitera_pn AS c ON a.perkara_id = c.perkara_id
          LEFT JOIN perkara_putusan AS d ON a.perkara_id = d.perkara_id
          LEFT JOIN perkara_hakim_pn AS f ON a.perkara_id = f.perkara_id
          LEFT JOIN perkara_pelaksanaan_relaas AS g ON a.perkara_id = g.perkara_id
          LEFT JOIN (SELECT perkara_id FROM perkara_efiling_id) AS h ON a.perkara_id = h.perkara_id
          LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON a.perkara_id = i.perkara_id
          LEFT JOIN perkara_pihak2 AS j ON a.perkara_id = j.perkara_id
          LEFT JOIN perkara_efiling_id AS k ON a.perkara_id = k.perkara_id
          LEFT JOIN perkara_pengacara AS l ON a.perkara_id = l.perkara_id
          LEFT JOIN perkara_jurusita AS m ON a.perkara_id = m.perkara_id
          LEFT JOIN perkara_penetapan AS n ON a.perkara_id = n.perkara_id
          LEFT JOIN perkara_ikrar_talak AS o ON a.perkara_id = o.perkara_id
          LEFT JOIN v_pihak_perkara AS x ON a.perkara_id = x.perkara_id
          LEFT JOIN pihak AS w ON x.pihak_id = w.id
          LEFT JOIN (
            SELECT a.pihak_id,
              MAX(CASE WHEN a.pihak_ke = 1 THEN CONCAT('+62', SUBSTRING(b.telepon, 2)) ELSE NULL END) AS teleponPenggugat,
              MAX(CASE WHEN a.pihak_ke = 2 THEN CONCAT('+62', SUBSTRING(b.telepon, 2)) ELSE NULL END) AS teleponTergugat
            FROM v_pihak_perkara AS a
            JOIN pihak AS b ON a.pihak_id = b.id AND b.telepon REGEXP '^[0-9]' AND CHAR_LENGTH(b.telepon) > 8
            GROUP BY a.pihak_id
          ) AS telepons ON x.pihak_id = telepons.pihak_id
          LEFT JOIN (
            SELECT perk.perkara_id,
              CASE
                WHEN datarelaas.tanggal_relaas IS NULL OR datarelaas.tanggal_relaas = '' THEN
                  CASE
                    WHEN perkarapihak.pihakke = 1 THEN '(Belum Dipanggil P)'
                    WHEN perkarapihak.pihakke = 2 THEN '(Belum Dipanggil T)'
                    WHEN perkarapihak.pihakke IN (1,2) THEN '(Belum Dipanggil PT)'
                    WHEN perkarapihak.pihakke IN (1,2,4) THEN '(Belum Dipanggil PT & Turut T)'
                    WHEN perkarapihak.pihakke = 4 THEN '(Belum Dipanggil Turut Tergugat)'
                    ELSE '(Sudah Dipanggil dan Diupload)'
                  END
                WHEN datarelaas.doc_relaas IS NULL OR datarelaas.doc_relaas = '' THEN
                  CASE
                    WHEN perkarapihak.pihakke = 1 THEN '(Belum Diupload P)'
                    WHEN perkarapihak.pihakke = 2 THEN '(Belum Diupload T)'
                    WHEN perkarapihak.pihakke IN (1,2) THEN '(Belum Diupload PT)'
                    WHEN perkarapihak.pihakke IN (1,2,4) THEN '(Belum Diupload PT & Turut T)'
                    WHEN perkarapihak.pihakke = 4 THEN '(Belum Diupload Turut Tergugat)'
                    ELSE '(Sudah Dipanggil dan Diupload)'
                  END
                ELSE '(Sudah Dipanggil dan Diupload)'
              END AS panggilan_status
            FROM perkara AS perk
            JOIN perkara_jadwal_sidang AS sidang ON sidang.perkara_id = perk.perkara_id
            JOIN (
              SELECT p1.perkara_id, p1.pihak_id, p1.nama, 1 AS pihakke, 'pihak p' AS ketpihak, '' AS pengacara_pihak_id
              FROM perkara_pihak1 AS p1
              JOIN perkara ON perkara.perkara_id = p1.perkara_id WHERE alur_perkara_id < 111
              UNION
              SELECT p2.perkara_id, p2.pihak_id, p2.nama, 2 AS pihakke, 'pihak t' AS ketpihak, '' AS pengacara_pihak_id
              FROM perkara_pihak2 AS p2
              JOIN perkara ON perkara.perkara_id = p2.perkara_id
              WHERE alur_perkara_id < 111 AND (status_penahanan_id IS NULL OR status_penahanan_id = 0) AND (jenis_tahanan_id = 0 OR jenis_tahanan_id IS NULL)
              UNION
              SELECT p3.perkara_id, p3.pihak_id, p3.nama, 3 AS pihakke, 'intervensi' AS ketpihak, '' AS pengacara_pihak_id
              FROM perkara_pihak3 AS p3
              UNION
              SELECT p4.perkara_id, p4.pihak_id, p4.nama, 4 AS pihakke, 'turut' AS ketpihak, '' AS pengacara_pihak_id
              FROM perkara_pihak4 AS p4
              UNION
              SELECT p5.perkara_id, p5.pengacara_id, p5.nama, p5.pihak_ke AS pihakke, 'pengacara' AS ketpihak, p5.pihak_id AS pengacara_pihak_id
              FROM perkara_pengacara AS p5
            ) AS perkarapihak ON perkarapihak.perkara_id = perk.perkara_id
            LEFT JOIN perkara_pelaksanaan_relaas AS datarelaas ON datarelaas.pihak_id = perkarapihak.pihak_id AND datarelaas.perkara_id = perk.perkara_id AND datarelaas.sidang_id = sidang.id
            LEFT JOIN (
              SELECT perkara.perkara_id AS perkara_id, perkara_jadwal_sidang.urutan AS urutan, perkara_jadwal_sidang.dihadiri_oleh
              FROM perkara
              JOIN perkara_jadwal_sidang ON (perkara_jadwal_sidang.perkara_id = perkara.perkara_id)
            ) AS jadwalsidang ON (jadwalsidang.perkara_id = perk.perkara_id AND jadwalsidang.urutan = sidang.urutan - 1)
            LEFT JOIN perkara_penetapan_hari_sidang AS phs ON (phs.perkara_id = perk.perkara_id AND phs.jadwalsidang_id = sidang.id)
            JOIN alur_perkara AS alur ON alur.id = perk.alur_perkara_id
            WHERE YEAR(perk.tanggal_pendaftaran) = YEAR(CURDATE()) AND perk.alur_perkara_id < 111 AND perkarapihak.pihak_id NOT IN (
              SELECT pp.pihak_id
              FROM perkara_pelaksanaan_relaas
              JOIN perkara_pengacara AS pp ON pp.pengacara_id = perkara_pelaksanaan_relaas.pihak_id AND pp.perkara_id = perkara_pelaksanaan_relaas.perkara_id
              JOIN perkara ON pp.perkara_id = perkara.perkara_id
              WHERE perk.alur_perkara_id < 111 AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
              AND (perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.tanggal_relaas <> '')
              AND (perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.doc_relaas <> '')
              UNION
              SELECT ppb.pengacara_id
              FROM perkara_pelaksanaan_relaas
              JOIN perkara_pengacara AS ppb ON ppb.pihak_id = perkara_pelaksanaan_relaas.pihak_id AND ppb.perkara_id = perkara_pelaksanaan_relaas.perkara_id
              JOIN perkara ON ppb.perkara_id = perkara.perkara_id
              WHERE perk.alur_perkara_id < 111 AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
              AND (perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.tanggal_relaas <> '')
              AND (perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.doc_relaas <> '')
            )
            AND ((datarelaas.tanggal_relaas IS NULL OR datarelaas.tanggal_relaas = '') OR (datarelaas.doc_relaas IS NULL OR datarelaas.doc_relaas = ''))
            AND (perk.alur_perkara_id >= 1 AND perk.alur_perkara_id <= 17)
            AND ((jadwalsidang.dihadiri_oleh <> 1) AND (jadwalsidang.dihadiri_oleh = 2 AND (perkarapihak.pihakke = 2 OR perkarapihak.pihakke = 4)) OR (jadwalsidang.dihadiri_oleh = 3 AND perkarapihak.pihakke = 1) OR (jadwalsidang.dihadiri_oleh = 4 OR jadwalsidang.dihadiri_oleh IS NULL))
          ) AS doc_relaas_status 
          ON a.perkara_id = doc_relaas_status.perkara_id
          WHERE  
            b.tanggal_sidang = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
            AND c.panitera_nama LIKE '%${namaPanitera}%'
            AND a.alur_perkara_id IN (15, 16, 17)
            AND c.aktif = 'Y'
            AND f.aktif = 'Y'
            AND m.aktif = 'Y'
            AND (
              CASE 
                WHEN a.jenis_perkara_id = 346 AND d.status_putusan_id = 62 AND o.amar_ikrar_talak IS NOT NULL THEN a.proses_terakhir_id < 296 
                ELSE a.proses_terakhir_id < 218 
              END
            )
          ORDER BY
            CASE
              WHEN b.alasan_ditunda LIKE '%putusan%' OR b.alasan_ditunda LIKE '%penetapan%' OR b.alasan_ditunda LIKE '%musyawarah%' THEN 1
              ELSE 2
            END,
            a.alur_perkara_id,
            a.jenis_perkara_id DESC,
            b.urutan DESC,
            f.hakim_nama, 
            a.nomor_perkara, 
            ecourt, 
            ghaib, 
            prodeo DESC;`;

            db.query(query, (err, result) => {
              if (err) {
                reject(err);
              } else {
                if (result.length != 0) {
                  const messages = result.map((r, index) => {
                    return `*${index + 1}. ${r.nomor_perkara}* ${r.ecourt}${r.ghaib}${r.prodeo} (${r.durasi} Hari)\nMajelis Hakim : *${r.majelis_hakim_kode}*\nJenis Perkara : ${r.jenis_perkara_nama}\nAgenda : ${r.agenda}\nJS : ${r.jurusita_nama}`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk panitera: ${namaPanitera}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching jadwal sidang besok panitera data:", error);
      reject(error);
    }
  });
};

const getDataTundaMediasiPanitera = (namaPanitera) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT 
            b.perkara_id,
            b.nomor_perkara,
            b.jenis_perkara_nama,
            a.tanggal_sidang,
            (CASE 
                WHEN d.mediator_text IS NOT NULL THEN CONCAT('BELUM INPUT TUNDA/HASIL MEDIASI (Mediator: ', d.mediator_text, ')') 
                ELSE 'BELUM INPUT MEDIATOR' 
            END) AS mediator,
            c.panitera_nama
          FROM 
            perkara_jadwal_sidang AS a
          JOIN 
            perkara AS b ON a.perkara_id = b.perkara_id
          JOIN
            perkara_panitera_pn AS c ON a.perkara_id = c.perkara_id
          LEFT JOIN 
            perkara_mediasi AS d ON a.perkara_id = d.perkara_id
          LEFT JOIN 
            perkara_mediator AS e ON a.perkara_id = e.perkara_id
          WHERE 
            a.tanggal_sidang >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
            AND IFNULL((SELECT MAX(e.tanggal_mediasi) FROM perkara_jadwal_mediasi e WHERE e.mediasi_id = d.mediasi_id), CURDATE()) <= CURDATE()
            AND d.tgl_laporan_mediator IS NULL 
            AND a.alasan_ditunda LIKE '%medi%'
            AND b.tahapan_terakhir_id < 15
            AND c.panitera_nama LIKE '%${namaPanitera}%';`;

            db.query(query, (err, result) => {
              if (err) {
                reject(err);
              } else {
                if (result.length != 0) {
                  const messages = result.map((r, index) => {
                    return `${index + 1}. ${r.nomor_perkara}\n*Status : ${r.mediator}*\nJenis Perkara : ${r.jenis_perkara_nama}\nTanggal Sidang : ${moment(r.tanggal_sidang).format("DD-MM-YYYY")}`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk panitera: ${namaPanitera}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching tunda mediasi panitera data:", error);
      reject(error);
    }
  });
};

const getDataBASPanitera = (namaPanitera) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT nomor_perkara, tanggal_sidang, agenda, hakim_nama 
      FROM perkara 
      LEFT JOIN perkara_jadwal_sidang ON perkara.perkara_id = perkara_jadwal_sidang.perkara_id 
      LEFT JOIN perkara_panitera_pn ON perkara.perkara_id = perkara_panitera_pn.perkara_id 
      LEFT JOIN perkara_hakim_pn ON perkara.perkara_id = perkara_hakim_pn.perkara_id 
      WHERE (alur_perkara_id = 15 OR alur_perkara_id = 16 OR alur_perkara_id = 17) 
      AND (YEAR(tanggal_sidang) = YEAR(NOW()) AND tanggal_sidang < CURDATE() AND edoc_bas IS NULL) 
      AND perkara_panitera_pn.aktif = 'Y' 
      AND panitera_nama LIKE '%${namaPanitera}%' 
      ORDER BY tanggal_sidang DESC`;

      db.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          if (result.length !== 0) {
            const messages = result.map((r, index) => {
              return `${index + 1}. ${r.nomor_perkara}\nTanggal Sidang : ${moment(r.tanggal_sidang).format("DD-MM-YYYY")}\nAgenda : ${r.agenda}\nMajelis Hakim : ${r.hakim_nama}`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk panitera: ${namaPanitera}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching BAS panitera data:", error);
      reject(error);
    }
  });
};

const getDataLupaTundaPanitera = (namaPanitera) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT nomor_perkara, jenis_perkara_nama, tanggal_sidang, majelis_hakim_kode
          FROM perkara
          LEFT JOIN perkara_jadwal_sidang ON perkara.perkara_id = perkara_jadwal_sidang.perkara_id
          LEFT JOIN perkara_panitera_pn ON perkara.perkara_id = perkara_panitera_pn.perkara_id
          LEFT JOIN perkara_hakim_pn ON perkara.perkara_id = perkara_hakim_pn.perkara_id
          LEFT JOIN perkara_penetapan ON perkara_penetapan.perkara_id = perkara.perkara_id
          WHERE DATE(tanggal_sidang) = CURDATE()
              AND alasan_ditunda IS NULL 
              AND perkara_jadwal_sidang.keterangan IS NULL
              AND panitera_nama LIKE '%${namaPanitera}%'
          ORDER BY nomor_perkara DESC;`;

          db.query(query, (err, result) => {
            if (err) {
              reject(err);
            } else {
              if (result.length != 0) {
                const messages = result.map((r, index) => {
                  return `${index + 1}. ${r.nomor_perkara}\nJenis Perkara : ${r.jenis_perkara_nama}\nMajelis Hakim : ${r.majelis_hakim_kode}`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk panitera: ${namaPanitera}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching lupa tunda panitera data:", error);
      reject(error);
    }
  });
};

const getDataPutusanBelumMinutPanitera = (namaPanitera) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT nomor_perkara, tanggal_putusan, majelis_hakim_kode 
          FROM perkara 
          LEFT JOIN perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id 
          LEFT JOIN perkara_panitera_pn ON perkara.perkara_id = perkara_panitera_pn.perkara_id 
          LEFT JOIN perkara_hakim_pn ON perkara_hakim_pn.perkara_id = perkara.perkara_id 
          LEFT JOIN perkara_penetapan ON perkara_penetapan.perkara_id = perkara.perkara_id 
          WHERE tanggal_putusan IS NOT NULL 
          AND tanggal_minutasi IS NULL 
          AND perkara_panitera_pn.aktif = 'Y' 
          AND panitera_nama LIKE '%${namaPanitera}%' 
          ORDER BY tanggal_putusan DESC`;

          db.query(query, (err, result) => {
            if (err) {
              reject(err);
            } else {
              if (result.length != 0) {
                const messages = result.map((r, index) => {
                  return `${index + 1}. ${r.nomor_perkara}\nTanggal Putusan : ${moment(r.tanggal_putusan).format("DD-MM-YYYY")}\nMajelis Hakim : ${r.majelis_hakim_kode}`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk panitera: ${namaPanitera}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching putusan belum minut panitera data:", error);
      reject(error);
    }
  });
};

const getBelumPanggilanPaniteraHariIni = (namaPanitera) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT DISTINCT
            perk.nomor_perkara,
            perk.perkara_id,
            perk.alur_perkara_id,
            perk.jenis_perkara_nama,
            alur.nama AS nama_alur,
            CASE WHEN k.perkara_id IS NOT NULL THEN " (*E-Court*)" ELSE "" END AS ecourt,
            CASE WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)' ELSE '' END AS ghaib,
            CASE WHEN perk.prodeo = 1 THEN ' (_Prodeo_)' ELSE '' END AS prodeo,
            (
              SELECT GROUP_CONCAT(DISTINCT hkpn.nama_gelar ORDER BY hk.id ASC SEPARATOR ' \n') AS nama_hakim
              FROM perkara_hakim_pn AS hk
              JOIN hakim_pn AS hkpn ON hkpn.id = hk.hakim_id
              WHERE hk.perkara_id = perk.perkara_id AND hk.aktif = 'Y'
              ORDER BY hk.urutan ASC
            ) AS majelis_hakim,
            (
              SELECT GROUP_CONCAT(DISTINCT pp.nama ORDER BY ppp.id ASC SEPARATOR '<br>') AS nama_js
              FROM perkara_panitera_pn AS ppp
              JOIN panitera_pn AS pp ON pp.id = ppp.panitera_id
              WHERE ppp.perkara_id = perk.perkara_id AND ppp.aktif = 'Y'
              ORDER BY ppp.urutan ASC
            ) AS panitera_nama,
            (
              SELECT GROUP_CONCAT(DISTINCT jspn.nama ORDER BY pjs.id ASC SEPARATOR '<br>') AS nama_js
              FROM perkara_jurusita AS pjs
              JOIN jurusita AS jspn ON jspn.id = pjs.jurusita_id
              WHERE pjs.perkara_id = perk.perkara_id AND pjs.aktif = 'Y'
              ORDER BY pjs.urutan ASC
            ) AS jurusita,
            sidang.id AS sidang_id,
            DATE_FORMAT(sidang.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
            sidang.agenda,
            perkarapihak.pihak_id,
            perkarapihak.nama AS nama_pihak,
            perkarapihak.pihakke,
            perkarapihak.ketpihak,
            perkarapihak.pengacara_pihak_id,
            datarelaas.id AS relaas_id,
            DATE_FORMAT(datarelaas.tanggal_relaas, '%d-%m-%Y') AS tanggal_relaas,
            datarelaas.doc_relaas,
            sidang.urutan,
            jadwalsidang.urutan AS urutan_sebelumnya,
            jadwalsidang.dihadiri_oleh AS status_kehadiran_sebelumnya,
            (CASE WHEN(phs.tahapan_id = 12) THEN 'Y' ELSE 'T' END) AS sidang_pertama
          FROM perkara AS perk
					JOIN perkara_panitera_pn AS p ON p.perkara_id = perk.perkara_id
          JOIN perkara_jadwal_sidang AS sidang ON sidang.perkara_id = perk.perkara_id
          JOIN (
            SELECT p1.perkara_id, p1.pihak_id, p1.nama, 1 AS pihakke, 'pihak p' AS ketpihak, '' AS pengacara_pihak_id
            FROM perkara_pihak1 AS p1 JOIN perkara ON perkara.perkara_id = p1.perkara_id WHERE alur_perkara_id < 111
            UNION
            SELECT p2.perkara_id, p2.pihak_id, p2.nama, 2 AS pihakke, 'pihak t' AS ketpihak, '' AS pengacara_pihak_id
            FROM perkara_pihak2 AS p2 JOIN perkara ON perkara.perkara_id = p2.perkara_id WHERE alur_perkara_id < 111
              AND (status_penahanan_id IS NULL OR status_penahanan_id = 0)
              AND (jenis_tahanan_id = 0 OR jenis_tahanan_id IS NULL)
            UNION
            SELECT p3.perkara_id, p3.pihak_id, p3.nama, 3 AS pihakke, 'intervensi' AS ketpihak, '' AS pengacara_pihak_id
            FROM perkara_pihak3 AS p3
            UNION
            SELECT p4.perkara_id, p4.pihak_id, p4.nama, 4 AS pihakke, 'turut' AS ketpihak, '' AS pengacara_pihak_id
            FROM perkara_pihak4 AS p4
            UNION
            SELECT p5.perkara_id, p5.pengacara_id, p5.nama, p5.pihak_ke AS pihakke, 'pengacara' AS ketpihak, p5.pihak_id AS pengacara_pihak_id
            FROM perkara_pengacara AS p5
          ) AS perkarapihak ON perkarapihak.perkara_id = perk.perkara_id
          LEFT JOIN perkara_pelaksanaan_relaas AS datarelaas ON datarelaas.pihak_id = perkarapihak.pihak_id
            AND datarelaas.perkara_id = perk.perkara_id AND datarelaas.sidang_id = sidang.id
          LEFT JOIN (
            SELECT perkara.perkara_id AS perkara_id, perkara_jadwal_sidang.urutan AS urutan, perkara_jadwal_sidang.dihadiri_oleh
            FROM perkara JOIN perkara_jadwal_sidang ON (perkara_jadwal_sidang.perkara_id = perkara.perkara_id)
          ) AS jadwalsidang ON (jadwalsidang.perkara_id = perk.perkara_id AND jadwalsidang.urutan = sidang.urutan - 1)
          LEFT JOIN perkara_penetapan_hari_sidang AS phs ON (phs.perkara_id = perk.perkara_id AND phs.jadwalsidang_id = sidang.id)
          JOIN alur_perkara AS alur ON alur.id = perk.alur_perkara_id
          LEFT JOIN perkara_efiling_id AS k ON perk.perkara_id = k.perkara_id
          LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON perk.perkara_id = i.perkara_id
          LEFT JOIN perkara_jurusita AS m ON perk.perkara_id = m.perkara_id
          WHERE p.panitera_nama LIKE '%${namaPanitera}%' AND YEAR(perk.tanggal_pendaftaran) = YEAR(CURDATE())
            AND perk.alur_perkara_id < 111
            AND perkarapihak.pihak_id NOT IN (
              SELECT pp.pihak_id
              FROM perkara_pelaksanaan_relaas
              JOIN perkara_pengacara AS pp ON pp.pengacara_id = perkara_pelaksanaan_relaas.pihak_id
                AND pp.perkara_id = perkara_pelaksanaan_relaas.perkara_id
              JOIN perkara ON pp.perkara_id = perkara.perkara_id
              WHERE perk.alur_perkara_id < 111 AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
                AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
                AND (perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.tanggal_relaas <> '')
                AND (perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.doc_relaas <> '')
              UNION
              SELECT ppb.pengacara_id
              FROM perkara_pelaksanaan_relaas
              JOIN perkara_pengacara AS ppb ON ppb.pihak_id = perkara_pelaksanaan_relaas.pihak_id
                AND ppb.perkara_id = perkara_pelaksanaan_relaas.perkara_id
              JOIN perkara ON ppb.perkara_id = perkara.perkara_id
              WHERE perk.alur_perkara_id < 111 AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
                AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
                AND (perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.tanggal_relaas <> '')
                AND (perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.doc_relaas <> '')
            )
            AND (
              (datarelaas.tanggal_relaas IS NULL OR datarelaas.tanggal_relaas = '')
              OR (datarelaas.doc_relaas IS NULL OR datarelaas.doc_relaas = '')
            )
            AND (perk.alur_perkara_id >= 1 AND perk.alur_perkara_id <= 17)
            AND (
              (jadwalsidang.dihadiri_oleh <> 1)
              AND (jadwalsidang.dihadiri_oleh = 2 AND (perkarapihak.pihakke = 2 OR perkarapihak.pihakke = 4))
              OR (jadwalsidang.dihadiri_oleh = 3 AND perkarapihak.pihakke = 1)
              OR (jadwalsidang.dihadiri_oleh = 4 OR jadwalsidang.dihadiri_oleh IS NULL)
            )
            AND sidang.tanggal_sidang = CURDATE()
            AND sidang.agenda NOT LIKE '%elektronik%'
            AND sidang.agenda NOT LIKE '%putusan%'
            AND sidang.agenda NOT LIKE '%penetapan%'
          ORDER BY perk.perkara_id DESC, sidang.tanggal_sidang ASC`;

          db.query(query, (err, result) => {
            if (err) {
              reject(err);
            } else {
              if (result.length != 0) {
                const messages = result.map((r, index) => {
                  return `${index + 1}. ${r.nomor_perkara} ${r.ecourt}${r.ghaib}${r.prodeo}\nTanggal Sidang : ${r.tanggal_sidang}\nNama Pihak : ${r.nama_pihak} ${r.ketpihak}\n*Jurusita : ${r.jurusita}*`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk panitera: ${namaPanitera}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching belum panggilan panitera data:", error);
      reject(error);
    }
  });
};

const getDataPerkaraAktifJurusita = (namaJurusita) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT DISTINCT
            perk.nomor_perkara,
            perk.perkara_id,
            perk.alur_perkara_id,
            perk.jenis_perkara_nama,
            alur.nama AS nama_alur,
            CASE WHEN k.perkara_id IS NOT NULL THEN " (*E-Court*)" ELSE "" END AS ecourt,
            CASE WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)' ELSE '' END AS ghaib,
            CASE WHEN perk.prodeo = 1 THEN ' (_Prodeo_)' ELSE '' END AS prodeo,
            (
              SELECT GROUP_CONCAT(DISTINCT hkpn.nama_gelar ORDER BY hk.id ASC SEPARATOR ' \n') AS nama_hakim
              FROM perkara_hakim_pn AS hk
              JOIN hakim_pn AS hkpn ON hkpn.id = hk.hakim_id
              WHERE hk.perkara_id = perk.perkara_id AND hk.aktif = 'Y'
              ORDER BY hk.urutan ASC
            ) AS majelis_hakim,
            (
              SELECT GROUP_CONCAT(DISTINCT pp.nama ORDER BY ppp.id ASC SEPARATOR '<br>') AS nama_js
              FROM perkara_panitera_pn AS ppp
              JOIN panitera_pn AS pp ON pp.id = ppp.panitera_id
              WHERE ppp.perkara_id = perk.perkara_id AND ppp.aktif = 'Y'
              ORDER BY ppp.urutan ASC
            ) AS panitera_nama,
            (
              SELECT GROUP_CONCAT(DISTINCT jspn.nama ORDER BY pjs.id ASC SEPARATOR '<br>') AS nama_js
              FROM perkara_jurusita AS pjs
              JOIN jurusita AS jspn ON jspn.id = pjs.jurusita_id
              WHERE pjs.perkara_id = perk.perkara_id AND pjs.aktif = 'Y'
              ORDER BY pjs.urutan ASC
            ) AS jurusita,
            sidang.id AS sidang_id,
            DATE_FORMAT(sidang.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
            sidang.agenda,
            perkarapihak.pihak_id,
            perkarapihak.nama AS nama_pihak,
            perkarapihak.pihakke,
            perkarapihak.ketpihak,
            perkarapihak.pengacara_pihak_id,
            datarelaas.id AS relaas_id,
            DATE_FORMAT(datarelaas.tanggal_relaas, '%d-%m-%Y') AS tanggal_relaas,
            datarelaas.doc_relaas,
            sidang.urutan,
            jadwalsidang.urutan AS urutan_sebelumnya,
            jadwalsidang.dihadiri_oleh AS status_kehadiran_sebelumnya,
            (CASE WHEN(phs.tahapan_id = 12) THEN 'Y' ELSE 'T' END) AS sidang_pertama
          FROM perkara AS perk
          JOIN perkara_jadwal_sidang AS sidang ON sidang.perkara_id = perk.perkara_id
          JOIN (
            SELECT p1.perkara_id, p1.pihak_id, p1.nama, 1 AS pihakke, 'pihak p' AS ketpihak, '' AS pengacara_pihak_id
            FROM perkara_pihak1 AS p1 JOIN perkara ON perkara.perkara_id = p1.perkara_id WHERE alur_perkara_id < 111
            UNION
            SELECT p2.perkara_id, p2.pihak_id, p2.nama, 2 AS pihakke, 'pihak t' AS ketpihak, '' AS pengacara_pihak_id
            FROM perkara_pihak2 AS p2 JOIN perkara ON perkara.perkara_id = p2.perkara_id
            WHERE alur_perkara_id < 111 AND (status_penahanan_id IS NULL OR status_penahanan_id = 0) AND (jenis_tahanan_id = 0 OR jenis_tahanan_id IS NULL)
            UNION
            SELECT p3.perkara_id, p3.pihak_id, p3.nama, 3 AS pihakke, 'intervensi' AS ketpihak, '' AS pengacara_pihak_id
            FROM perkara_pihak3 AS p3
            UNION
            SELECT p4.perkara_id, p4.pihak_id, p4.nama, 4 AS pihakke, 'turut' AS ketpihak, '' AS pengacara_pihak_id
            FROM perkara_pihak4 AS p4
            UNION
            SELECT p5.perkara_id, p5.pengacara_id, p5.nama, p5.pihak_ke AS pihakke, 'pengacara' AS ketpihak, p5.pihak_id AS pengacara_pihak_id
            FROM perkara_pengacara AS p5
          ) AS perkarapihak ON perkarapihak.perkara_id = perk.perkara_id
          LEFT JOIN perkara_pelaksanaan_relaas AS datarelaas ON datarelaas.pihak_id = perkarapihak.pihak_id AND datarelaas.perkara_id = perk.perkara_id AND datarelaas.sidang_id = sidang.id
          LEFT JOIN (
            SELECT perkara.perkara_id AS perkara_id, perkara_jadwal_sidang.urutan AS urutan, perkara_jadwal_sidang.dihadiri_oleh
            FROM perkara JOIN perkara_jadwal_sidang ON (perkara_jadwal_sidang.perkara_id = perkara.perkara_id)
          ) AS jadwalsidang ON (jadwalsidang.perkara_id = perk.perkara_id AND jadwalsidang.urutan = sidang.urutan - 1)
          LEFT JOIN perkara_penetapan_hari_sidang AS phs ON (phs.perkara_id = perk.perkara_id AND phs.jadwalsidang_id = sidang.id)
          JOIN alur_perkara AS alur ON alur.id = perk.alur_perkara_id
          LEFT JOIN perkara_efiling_id AS k ON perk.perkara_id = k.perkara_id
          LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON perk.perkara_id = i.perkara_id
          LEFT JOIN perkara_jurusita AS m ON perk.perkara_id = m.perkara_id
          LEFT JOIN perkara_putusan AS q ON perk.perkara_id = q.perkara_id
          WHERE m.jurusita_nama LIKE '%${namaJurusita}%' AND YEAR(perk.tanggal_pendaftaran) = YEAR(CURDATE()) AND perk.alur_perkara_id < 111
          AND perkarapihak.pihak_id NOT IN (
            SELECT pp.pihak_id
            FROM perkara_pelaksanaan_relaas
            JOIN perkara_pengacara AS pp ON pp.pengacara_id = perkara_pelaksanaan_relaas.pihak_id AND pp.perkara_id = perkara_pelaksanaan_relaas.perkara_id
            JOIN perkara ON pp.perkara_id = perkara.perkara_id
            WHERE perk.alur_perkara_id < 111 AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
            AND (perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.tanggal_relaas <> '')
            AND (perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.doc_relaas <> '')
            UNION
            SELECT ppb.pengacara_id
            FROM perkara_pelaksanaan_relaas
            JOIN perkara_pengacara AS ppb ON ppb.pihak_id = perkara_pelaksanaan_relaas.pihak_id AND ppb.perkara_id = perkara_pelaksanaan_relaas.perkara_id
            JOIN perkara ON ppb.perkara_id = perkara.perkara_id
            WHERE perk.alur_perkara_id < 111 AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
            AND (perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.tanggal_relaas <> '')
            AND (perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.doc_relaas <> '')
          )
          AND ((datarelaas.tanggal_relaas IS NULL OR datarelaas.tanggal_relaas = '') OR (datarelaas.doc_relaas IS NULL OR datarelaas.doc_relaas = ''))
          AND (perk.alur_perkara_id >= 1 AND perk.alur_perkara_id <= 17)
          AND ((jadwalsidang.dihadiri_oleh <> 1) AND (jadwalsidang.dihadiri_oleh = 2 AND (perkarapihak.pihakke = 2 OR perkarapihak.pihakke = 4)) OR (jadwalsidang.dihadiri_oleh = 3 AND perkarapihak.pihakke = 1) OR (jadwalsidang.dihadiri_oleh = 4 OR jadwalsidang.dihadiri_oleh IS NULL))
          ORDER BY q.amar_putusan IS NULL DESC, sidang.tanggal_sidang ASC, perk.perkara_id DESC`;

          db.query(query, (err, result) => {
            if (err) {
              reject(err);
            } else {
              if (result.length != 0) {
                const messages = result.map((r, index) => {
                  return `${index + 1}. ${r.nomor_perkara} ${r.ecourt}${r.ghaib}${r.prodeo}\nTanggal Sidang : ${r.tanggal_sidang}\nNama Pihak : ${r.nama_pihak} ${r.ketpihak}\n*Jurusita : ${r.jurusita}*`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk jurusita: ${namaJurusita}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching perkara aktif jurusita data:", error);
      reject(error);
    }
  });
};

const getTotalPenerimaanPerkaraJurusita = (namaJurusita) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT 
            COUNT(CASE 
                WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
                    AND perkara.alur_perkara_id != 114 
                    AND perkara_jurusita.jurusita_nama LIKE '%${namaJurusita}%'
                    AND perkara_jurusita.aktif = 'Y'
                THEN perkara.perkara_id 
            END) AS jumlah_masuk,

            (SELECT COUNT(*)
            FROM perkara
            WHERE YEAR(tanggal_pendaftaran) = YEAR(CURDATE())
              AND alur_perkara_id != 114
            ) AS total_perkara_masuk,

            COUNT(CASE 
                WHEN YEAR(perkara_putusan.tanggal_putusan) = YEAR(CURDATE()) 
                    AND perkara_putusan.tanggal_putusan IS NOT NULL 
                    AND perkara.alur_perkara_id != 114 
                    AND perkara_jurusita.jurusita_nama LIKE '%${namaJurusita}%'
                    AND perkara_jurusita.aktif = 'Y'
                THEN perkara.perkara_id 
            END) AS jumlah_putus,

            -- Menambahkan kolom persentase
            CASE
                WHEN COUNT(CASE 
                    WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
                        AND perkara.alur_perkara_id != 114 
                        AND perkara_jurusita.jurusita_nama LIKE '%${namaJurusita}%'
                        AND perkara_jurusita.aktif = 'Y'
                    THEN perkara.perkara_id 
                END) = 0 THEN 0
                ELSE 
                    (COUNT(CASE 
                        WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
                            AND perkara.alur_perkara_id != 114 
                            AND perkara_jurusita.jurusita_nama LIKE '%${namaJurusita}%'
                            AND perkara_jurusita.aktif = 'Y'
                        THEN perkara.perkara_id 
                    END) * 100.0 / (SELECT COUNT(*)
                                    FROM perkara
                                    WHERE YEAR(tanggal_pendaftaran) = YEAR(CURDATE())
                                      AND alur_perkara_id != 114
                                  )) 
            END AS persentase_masuk
          FROM perkara
          LEFT JOIN perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id
          LEFT JOIN perkara_jurusita ON perkara_jurusita.perkara_id = perkara.perkara_id
          WHERE perkara_jurusita.aktif = 'Y';`;

          db.query(query, (err, result) => {
            if (err) {
              reject(err);
            } else {
              if (result.length != 0) {
                const messages = result.map((r, index) => {
                  return `- Perkara Ditangani : ${r.jumlah_masuk}\n- Perkara Putus : ${r.jumlah_putus}\n- Total Perkara Masuk di PA : ${r.total_perkara_masuk}\n- Persentase : ${r.persentase_masuk}%`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk jurusita: ${namaJurusita}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching penerimaan perkara jurusita data:", error);
      reject(error);
    }
  });
};

const getBelumPanggilanJurusita = (namaJurusita) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT DISTINCT
            perk.nomor_perkara,
            perk.perkara_id,
            perk.alur_perkara_id,
            perk.jenis_perkara_nama,
            alur.nama AS nama_alur,
            CASE WHEN k.perkara_id IS NOT NULL THEN " (*E-Court*)" ELSE "" END AS ecourt,
            CASE WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)' ELSE '' END AS ghaib,
            CASE WHEN perk.prodeo = 1 THEN ' (_Prodeo_)' ELSE '' END AS prodeo,
            (
              SELECT GROUP_CONCAT(DISTINCT hkpn.nama_gelar ORDER BY hk.id ASC SEPARATOR ' \n') AS nama_hakim
              FROM perkara_hakim_pn AS hk
              JOIN hakim_pn AS hkpn ON hkpn.id = hk.hakim_id
              WHERE hk.perkara_id = perk.perkara_id AND hk.aktif = 'Y'
              ORDER BY hk.urutan ASC
            ) AS majelis_hakim,
            (
              SELECT GROUP_CONCAT(DISTINCT pp.nama ORDER BY ppp.id ASC SEPARATOR '<br>') AS nama_js
              FROM perkara_panitera_pn AS ppp
              JOIN panitera_pn AS pp ON pp.id = ppp.panitera_id
              WHERE ppp.perkara_id = perk.perkara_id AND ppp.aktif = 'Y'
              ORDER BY ppp.urutan ASC
            ) AS panitera_nama,
            (
              SELECT GROUP_CONCAT(DISTINCT jspn.nama ORDER BY pjs.id ASC SEPARATOR '<br>') AS nama_js
              FROM perkara_jurusita AS pjs
              JOIN jurusita AS jspn ON jspn.id = pjs.jurusita_id
              WHERE pjs.perkara_id = perk.perkara_id AND pjs.aktif = 'Y'
              ORDER BY pjs.urutan ASC
            ) AS jurusita,
            sidang.id AS sidang_id,
            DATE_FORMAT(sidang.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
            sidang.agenda,
            perkarapihak.pihak_id,
            perkarapihak.nama AS nama_pihak,
            perkarapihak.pihakke,
            perkarapihak.ketpihak,
            perkarapihak.pengacara_pihak_id,
            datarelaas.id AS relaas_id,
            DATE_FORMAT(datarelaas.tanggal_relaas, '%d-%m-%Y') AS tanggal_relaas,
            datarelaas.doc_relaas,
            sidang.urutan,
            jadwalsidang.urutan AS urutan_sebelumnya,
            jadwalsidang.dihadiri_oleh AS status_kehadiran_sebelumnya,
            (CASE WHEN(phs.tahapan_id = 12) THEN 'Y' ELSE 'T' END) AS sidang_pertama
          FROM perkara AS perk
          JOIN perkara_jadwal_sidang AS sidang ON sidang.perkara_id = perk.perkara_id
          JOIN (
            SELECT p1.perkara_id, p1.pihak_id, p1.nama, 1 AS pihakke, 'pihak p' AS ketpihak, '' AS pengacara_pihak_id
            FROM perkara_pihak1 AS p1 JOIN perkara ON perkara.perkara_id = p1.perkara_id WHERE alur_perkara_id < 111
            UNION
            SELECT p2.perkara_id, p2.pihak_id, p2.nama, 2 AS pihakke, 'pihak t' AS ketpihak, '' AS pengacara_pihak_id
            FROM perkara_pihak2 AS p2 JOIN perkara ON perkara.perkara_id = p2.perkara_id
            WHERE alur_perkara_id < 111 AND (status_penahanan_id IS NULL OR status_penahanan_id = 0) AND (jenis_tahanan_id = 0 OR jenis_tahanan_id IS NULL)
            UNION
            SELECT p3.perkara_id, p3.pihak_id, p3.nama, 3 AS pihakke, 'intervensi' AS ketpihak, '' AS pengacara_pihak_id
            FROM perkara_pihak3 AS p3
            UNION
            SELECT p4.perkara_id, p4.pihak_id, p4.nama, 4 AS pihakke, 'turut' AS ketpihak, '' AS pengacara_pihak_id
            FROM perkara_pihak4 AS p4
            UNION
            SELECT p5.perkara_id, p5.pengacara_id, p5.nama, p5.pihak_ke AS pihakke, 'pengacara' AS ketpihak, p5.pihak_id AS pengacara_pihak_id
            FROM perkara_pengacara AS p5
          ) AS perkarapihak ON perkarapihak.perkara_id = perk.perkara_id
          LEFT JOIN perkara_pelaksanaan_relaas AS datarelaas ON datarelaas.pihak_id = perkarapihak.pihak_id AND datarelaas.perkara_id = perk.perkara_id AND datarelaas.sidang_id = sidang.id
          LEFT JOIN (
            SELECT perkara.perkara_id AS perkara_id, perkara_jadwal_sidang.urutan AS urutan, perkara_jadwal_sidang.dihadiri_oleh
            FROM perkara JOIN perkara_jadwal_sidang ON (perkara_jadwal_sidang.perkara_id = perkara.perkara_id)
          ) AS jadwalsidang ON (jadwalsidang.perkara_id = perk.perkara_id AND jadwalsidang.urutan = sidang.urutan - 1)
          LEFT JOIN perkara_penetapan_hari_sidang AS phs ON (phs.perkara_id = perk.perkara_id AND phs.jadwalsidang_id = sidang.id)
          JOIN alur_perkara AS alur ON alur.id = perk.alur_perkara_id
          LEFT JOIN perkara_efiling_id AS k ON perk.perkara_id = k.perkara_id
          LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON perk.perkara_id = i.perkara_id
          LEFT JOIN perkara_jurusita AS m ON perk.perkara_id = m.perkara_id
          LEFT JOIN perkara_putusan AS q ON perk.perkara_id = q.perkara_id
          WHERE m.jurusita_nama LIKE '%${namaJurusita}%' AND YEAR(perk.tanggal_pendaftaran) = YEAR(CURDATE()) AND perk.alur_perkara_id < 111
          AND perkarapihak.pihak_id NOT IN (
            SELECT pp.pihak_id
            FROM perkara_pelaksanaan_relaas
            JOIN perkara_pengacara AS pp ON pp.pengacara_id = perkara_pelaksanaan_relaas.pihak_id AND pp.perkara_id = perkara_pelaksanaan_relaas.perkara_id
            JOIN perkara ON pp.perkara_id = perkara.perkara_id
            WHERE perk.alur_perkara_id < 111 AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
            AND (perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.tanggal_relaas <> '')
            AND (perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.doc_relaas <> '')
            UNION
            SELECT ppb.pengacara_id
            FROM perkara_pelaksanaan_relaas
            JOIN perkara_pengacara AS ppb ON ppb.pihak_id = perkara_pelaksanaan_relaas.pihak_id AND ppb.perkara_id = perkara_pelaksanaan_relaas.perkara_id
            JOIN perkara ON ppb.perkara_id = perkara.perkara_id
            WHERE perk.alur_perkara_id < 111 AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
            AND (perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.tanggal_relaas <> '')
            AND (perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.doc_relaas <> '')
          )
          AND ((datarelaas.tanggal_relaas IS NULL OR datarelaas.tanggal_relaas = '') OR (datarelaas.doc_relaas IS NULL OR datarelaas.doc_relaas = ''))
          AND (perk.alur_perkara_id >= 1 AND perk.alur_perkara_id <= 17)
          AND ((jadwalsidang.dihadiri_oleh <> 1) AND (jadwalsidang.dihadiri_oleh = 2 AND (perkarapihak.pihakke = 2 OR perkarapihak.pihakke = 4)) OR (jadwalsidang.dihadiri_oleh = 3 AND perkarapihak.pihakke = 1) OR (jadwalsidang.dihadiri_oleh = 4 OR jadwalsidang.dihadiri_oleh IS NULL))
          AND sidang.agenda NOT LIKE '%elektronik%'
          AND sidang.agenda NOT LIKE '%putusan%'
          AND sidang.agenda NOT LIKE '%penetapan%'
          ORDER BY q.amar_putusan IS NULL DESC, sidang.tanggal_sidang ASC, perk.perkara_id DESC`;

          db.query(query, (err, result) => {
            if (err) {
              reject(err);
            } else {
              if (result.length != 0) {
                const messages = result.map((r, index) => {
                  return `${index + 1}. ${r.nomor_perkara} ${r.ecourt}${r.ghaib}${r.prodeo}\nTanggal Sidang : ${r.tanggal_sidang}\nNama Pihak : ${r.nama_pihak} ${r.ketpihak}\n*Jurusita : ${r.jurusita}*`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk jurusita: ${namaJurusita}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching belum panggilan jurusita data:", error);
      reject(error);
    }
  });
};

const getBelumPanggilanPengingatJurusita = (namaJurusita) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT DISTINCT 
      perk.perkara_id,
      perk.nomor_perkara,
      perk.jenis_perkara_nama,
      CASE WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)' ELSE '' END AS ecourt,
      CASE WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)' ELSE '' END AS ghaib,
      CASE WHEN perk.prodeo = 1 THEN ' (_Prodeo_)' ELSE '' END AS prodeo,
      (
          SELECT GROUP_CONCAT(DISTINCT hkpn.nama_gelar ORDER BY hk.id ASC SEPARATOR ' \n') AS nama_hakim
          FROM perkara_hakim_pn AS hk
          JOIN hakim_pn AS hkpn ON hkpn.id = hk.hakim_id
          WHERE hk.perkara_id = perk.perkara_id AND hk.aktif = 'Y'
          ORDER BY hk.urutan ASC
      ) AS majelis_hakim,
      (
          SELECT GROUP_CONCAT(DISTINCT pp.nama ORDER BY ppp.id ASC SEPARATOR '<br>') AS nama_js
          FROM perkara_panitera_pn AS ppp
          JOIN panitera_pn AS pp ON pp.id = ppp.panitera_id
          WHERE ppp.perkara_id = perk.perkara_id AND ppp.aktif = 'Y'
          ORDER BY ppp.urutan ASC
      ) AS panitera_nama,
      (
          SELECT GROUP_CONCAT(DISTINCT jspn.nama ORDER BY pjs.id ASC SEPARATOR '<br>') AS nama_js
          FROM perkara_jurusita AS pjs
          JOIN jurusita AS jspn ON jspn.id = pjs.jurusita_id
          WHERE pjs.perkara_id = perk.perkara_id AND pjs.aktif = 'Y'
          ORDER BY pjs.urutan ASC
      ) AS jurusita,
      perkarapihak.nama AS nama_pihak,
      sidang.agenda,
      DATE_FORMAT(sidang.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
      DATE_FORMAT(datarelaas.tanggal_relaas, '%d-%m-%Y') AS tanggal_relaas,
      datarelaas.doc_relaas,
      perkarapihak.pihakke,
      perkarapihak.ketpihak,
      sidang.urutan,
      jadwalsidang.urutan AS urutan_sebelumnya,
      jadwalsidang.dihadiri_oleh AS status_kehadiran_sebelumnya,
      (CASE WHEN (phs.tahapan_id = 12) THEN 'Y' ELSE 'T' END) AS sidang_pertama,
      CASE WHEN k.perkara_id IS NOT NULL AND b.email IS NULL AND b.telepon IS NULL AND datarelaas.tanggal_jursit_pos IS NULL THEN ' (SURAT TERCATAT)'
      WHEN k.perkara_id IS NOT NULL AND (b.email IS NOT NULL OR b.telepon IS NOT NULL) THEN ' (PANGGILAN ELEKTRONIK)'
      ELSE ''
      END AS panggilan_ecourt,
      perkarapihak.pihak_id,
      perkarapihak.pengacara_pihak_id,
      sidang.id AS sidang_id,
      datarelaas.id AS relaas_id
  FROM 
      perkara AS perk
  JOIN 
      perkara_jadwal_sidang AS sidang ON sidang.perkara_id = perk.perkara_id
  JOIN (
      SELECT 
          p1.perkara_id, p1.pihak_id, p1.nama, 1 AS pihakke, 'pihak p' AS ketpihak, '' AS pengacara_pihak_id
      FROM 
          perkara_pihak1 AS p1 
      JOIN 
          perkara ON perkara.perkara_id = p1.perkara_id 
      WHERE 
          alur_perkara_id < 111
      UNION
      SELECT 
          p2.perkara_id, p2.pihak_id, p2.nama, 2 AS pihakke, 'pihak t' AS ketpihak, '' AS pengacara_pihak_id
      FROM 
          perkara_pihak2 AS p2 
      JOIN 
          perkara ON perkara.perkara_id = p2.perkara_id
      WHERE 
          alur_perkara_id < 111 
          AND (status_penahanan_id IS NULL OR status_penahanan_id = 0) 
          AND (jenis_tahanan_id = 0 OR jenis_tahanan_id IS NULL)
      UNION
      SELECT 
          p3.perkara_id, p3.pihak_id, p3.nama, 3 AS pihakke, 'intervensi' AS ketpihak, '' AS pengacara_pihak_id
      FROM 
          perkara_pihak3 AS p3
      UNION
      SELECT 
          p4.perkara_id, p4.pihak_id, p4.nama, 4 AS pihakke, 'turut' AS ketpihak, '' AS pengacara_pihak_id
      FROM 
          perkara_pihak4 AS p4
      UNION
      SELECT 
          p5.perkara_id, p5.pengacara_id, p5.nama, p5.pihak_ke AS pihakke, 'pengacara' AS ketpihak, p5.pihak_id AS pengacara_pihak_id
      FROM 
          perkara_pengacara AS p5
  ) AS perkarapihak ON perkarapihak.perkara_id = perk.perkara_id
  LEFT JOIN 
      perkara_pelaksanaan_relaas AS datarelaas ON datarelaas.pihak_id = perkarapihak.pihak_id 
      AND datarelaas.perkara_id = perk.perkara_id 
      AND datarelaas.sidang_id = sidang.id
  LEFT JOIN (
      SELECT 
          perkara.perkara_id AS perkara_id, 
          perkara_jadwal_sidang.urutan AS urutan, 
          perkara_jadwal_sidang.dihadiri_oleh
      FROM 
          perkara 
      JOIN 
          perkara_jadwal_sidang ON (perkara_jadwal_sidang.perkara_id = perkara.perkara_id)
  ) AS jadwalsidang ON (jadwalsidang.perkara_id = perk.perkara_id AND jadwalsidang.urutan = sidang.urutan - 1)
  LEFT JOIN 
      perkara_penetapan_hari_sidang AS phs ON (phs.perkara_id = perk.perkara_id AND phs.jadwalsidang_id = sidang.id)
  JOIN 
      alur_perkara AS alur ON alur.id = perk.alur_perkara_id
  LEFT JOIN 
      perkara_efiling_id AS k ON perk.perkara_id = k.perkara_id
  LEFT JOIN (
      SELECT 
          perkara_id 
      FROM 
          perkara_pihak2 
      WHERE 
          ghaib = 1
  ) AS i ON perk.perkara_id = i.perkara_id
  LEFT JOIN 
      perkara_jurusita AS m ON perk.perkara_id = m.perkara_id
  LEFT JOIN 
      perkara_putusan AS q ON perk.perkara_id = q.perkara_id
  LEFT JOIN 
      v_pihak_perkara AS v ON perk.perkara_id = v.perkara_id
  JOIN 
      pihak b ON b.id = v.pihak_id AND b.telepon REGEXP '^[0-9]' AND CHAR_LENGTH(b.telepon) > 8
  WHERE YEAR(perk.tanggal_pendaftaran) = YEAR(CURDATE()) 
    AND perk.alur_perkara_id < 111 
    AND m.jurusita_nama LIKE '%${namaJurusita}%'
    AND perkarapihak.pihak_id NOT IN (
      SELECT pp.pihak_id
      FROM perkara_pelaksanaan_relaas
      JOIN perkara_pengacara AS pp ON pp.pengacara_id = perkara_pelaksanaan_relaas.pihak_id AND pp.perkara_id = perkara_pelaksanaan_relaas.perkara_id
      JOIN perkara ON pp.perkara_id = perkara.perkara_id
      WHERE m.jurusita_nama LIKE '%${namaJurusita}%' 
        AND perk.alur_perkara_id < 111 
        AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id 
        AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
        AND (perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.tanggal_relaas <> '')
        AND (perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.doc_relaas <> '')
      UNION
      SELECT ppb.pengacara_id
      FROM perkara_pelaksanaan_relaas
      JOIN perkara_pengacara AS ppb ON ppb.pihak_id = perkara_pelaksanaan_relaas.pihak_id AND ppb.perkara_id = perkara_pelaksanaan_relaas.perkara_id
      JOIN perkara ON ppb.perkara_id = perkara.perkara_id
      WHERE perk.alur_perkara_id < 111 
        AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id 
        AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
        AND (perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.tanggal_relaas <> '')
        AND (perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.doc_relaas <> '')
    )
    AND ((datarelaas.tanggal_relaas IS NULL OR datarelaas.tanggal_relaas = '') 
    OR (datarelaas.doc_relaas IS NULL OR datarelaas.doc_relaas = ''))
    AND (perk.alur_perkara_id >= 1 AND perk.alur_perkara_id <= 17)
    AND ((jadwalsidang.dihadiri_oleh <> 1) 
    AND (jadwalsidang.dihadiri_oleh = 2 AND (perkarapihak.pihakke = 2 OR perkarapihak.pihakke = 4)) 
    OR (jadwalsidang.dihadiri_oleh = 3 AND perkarapihak.pihakke = 1) 
    OR (jadwalsidang.dihadiri_oleh = 4 OR jadwalsidang.dihadiri_oleh IS NULL))
    AND sidang.tanggal_sidang = (
      CASE
        WHEN perk.jenis_perkara_id IN (346, 347) AND k.perkara_id IS NULL THEN DATE_ADD(CURDATE(), INTERVAL 5 DAY)
        WHEN perk.jenis_perkara_id NOT IN (346, 347) AND k.perkara_id IS NULL THEN 
          DATE_ADD(
            CURDATE(),
            INTERVAL (
              CASE
                WHEN DAYOFWEEK(CURDATE()) = 6 THEN 7
                WHEN DAYOFWEEK(CURDATE()) = 7 THEN 6
                ELSE 5
              END
            ) DAY
          )
        WHEN k.perkara_id IS NOT NULL AND b.email IS NULL AND b.telepon IS NULL
          AND datarelaas.tanggal_jursit_pos IS NULL THEN DATE_ADD(CURDATE(), INTERVAL 6 DAY)
        WHEN k.perkara_id IS NOT NULL AND (b.email IS NOT NULL OR b.telepon IS NOT NULL)
          THEN DATE_ADD(CURDATE(), INTERVAL 3 DAY)
        ELSE NULL
      END
    )
    AND sidang.agenda NOT LIKE '%elektronik%'
    AND sidang.agenda NOT LIKE '%putusan%'
    AND sidang.agenda NOT LIKE '%penetapan%'
  ORDER BY q.amar_putusan IS NULL DESC, sidang.tanggal_sidang ASC, perk.perkara_id DESC;`;

      db.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          if (result.length != 0) {
            const messages = result.map((r, index) => {
              return `${index + 1}. ${r.nomor_perkara} ${r.ecourt}${r.ghaib}${r.prodeo}\nTanggal Sidang : ${r.tanggal_sidang}${r.panggilan_ecourt}\nJenis Perkara : ${r.jenis_perkara_nama}\nNama Pihak : ${r.nama_pihak} (${r.ketpihak})`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk jurusita: ${namaJurusita}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching belum panggilan jurusita data:", error);
      reject(error);
    }
  });
};

const getBelumPanggilanJurusitaHariIni = (namaJurusita) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT DISTINCT
            perk.nomor_perkara,
            perk.perkara_id,
            perk.alur_perkara_id,
            perk.jenis_perkara_nama,
            alur.nama AS nama_alur,
            CASE WHEN k.perkara_id IS NOT NULL THEN " (*E-Court*)" ELSE "" END AS ecourt,
            CASE WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)' ELSE '' END AS ghaib,
            CASE WHEN perk.prodeo = 1 THEN ' (_Prodeo_)' ELSE '' END AS prodeo,
            (
              SELECT GROUP_CONCAT(DISTINCT hkpn.nama_gelar ORDER BY hk.id ASC SEPARATOR ' \n') AS nama_hakim
              FROM perkara_hakim_pn AS hk
              JOIN hakim_pn AS hkpn ON hkpn.id = hk.hakim_id
              WHERE hk.perkara_id = perk.perkara_id AND hk.aktif = 'Y'
              ORDER BY hk.urutan ASC
            ) AS majelis_hakim,
            (
              SELECT GROUP_CONCAT(DISTINCT pp.nama ORDER BY ppp.id ASC SEPARATOR '<br>') AS nama_js
              FROM perkara_panitera_pn AS ppp
              JOIN panitera_pn AS pp ON pp.id = ppp.panitera_id
              WHERE ppp.perkara_id = perk.perkara_id AND ppp.aktif = 'Y'
              ORDER BY ppp.urutan ASC
            ) AS panitera_nama,
            (
              SELECT GROUP_CONCAT(DISTINCT jspn.nama ORDER BY pjs.id ASC SEPARATOR '<br>') AS nama_js
              FROM perkara_jurusita AS pjs
              JOIN jurusita AS jspn ON jspn.id = pjs.jurusita_id
              WHERE pjs.perkara_id = perk.perkara_id AND pjs.aktif = 'Y'
              ORDER BY pjs.urutan ASC
            ) AS jurusita,
            sidang.id AS sidang_id,
            DATE_FORMAT(sidang.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
            sidang.agenda,
            perkarapihak.pihak_id,
            perkarapihak.nama AS nama_pihak,
            perkarapihak.pihakke,
            perkarapihak.ketpihak,
            perkarapihak.pengacara_pihak_id,
            datarelaas.id AS relaas_id,
            DATE_FORMAT(datarelaas.tanggal_relaas, '%d-%m-%Y') AS tanggal_relaas,
            datarelaas.doc_relaas,
            sidang.urutan,
            jadwalsidang.urutan AS urutan_sebelumnya,
            jadwalsidang.dihadiri_oleh AS status_kehadiran_sebelumnya,
            (CASE WHEN(phs.tahapan_id = 12) THEN 'Y' ELSE 'T' END) AS sidang_pertama
          FROM perkara AS perk
          JOIN perkara_hakim_pn AS h ON h.perkara_id = perk.perkara_id
          JOIN perkara_panitera_pn AS p ON p.perkara_id = perk.perkara_id
          JOIN perkara_jadwal_sidang AS sidang ON sidang.perkara_id = perk.perkara_id
          JOIN (
            SELECT p1.perkara_id, p1.pihak_id, p1.nama, 1 AS pihakke, 'pihak p' AS ketpihak, '' AS pengacara_pihak_id
            FROM perkara_pihak1 AS p1 JOIN perkara ON perkara.perkara_id = p1.perkara_id WHERE alur_perkara_id < 111
            UNION
            SELECT p2.perkara_id, p2.pihak_id, p2.nama, 2 AS pihakke, 'pihak t' AS ketpihak, '' AS pengacara_pihak_id
            FROM perkara_pihak2 AS p2 JOIN perkara ON perkara.perkara_id = p2.perkara_id WHERE alur_perkara_id < 111
              AND (status_penahanan_id IS NULL OR status_penahanan_id = 0)
              AND (jenis_tahanan_id = 0 OR jenis_tahanan_id IS NULL)
            UNION
            SELECT p3.perkara_id, p3.pihak_id, p3.nama, 3 AS pihakke, 'intervensi' AS ketpihak, '' AS pengacara_pihak_id
            FROM perkara_pihak3 AS p3
            UNION
            SELECT p4.perkara_id, p4.pihak_id, p4.nama, 4 AS pihakke, 'turut' AS ketpihak, '' AS pengacara_pihak_id
            FROM perkara_pihak4 AS p4
            UNION
            SELECT p5.perkara_id, p5.pengacara_id, p5.nama, p5.pihak_ke AS pihakke, 'pengacara' AS ketpihak, p5.pihak_id AS pengacara_pihak_id
            FROM perkara_pengacara AS p5
          ) AS perkarapihak ON perkarapihak.perkara_id = perk.perkara_id
          LEFT JOIN perkara_pelaksanaan_relaas AS datarelaas ON datarelaas.pihak_id = perkarapihak.pihak_id
            AND datarelaas.perkara_id = perk.perkara_id AND datarelaas.sidang_id = sidang.id
          LEFT JOIN (
            SELECT perkara.perkara_id AS perkara_id, perkara_jadwal_sidang.urutan AS urutan, perkara_jadwal_sidang.dihadiri_oleh
            FROM perkara JOIN perkara_jadwal_sidang ON (perkara_jadwal_sidang.perkara_id = perkara.perkara_id)
          ) AS jadwalsidang ON (jadwalsidang.perkara_id = perk.perkara_id AND jadwalsidang.urutan = sidang.urutan - 1)
          LEFT JOIN perkara_penetapan_hari_sidang AS phs ON (phs.perkara_id = perk.perkara_id AND phs.jadwalsidang_id = sidang.id)
          JOIN alur_perkara AS alur ON alur.id = perk.alur_perkara_id
          LEFT JOIN perkara_efiling_id AS k ON perk.perkara_id = k.perkara_id
          LEFT JOIN (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i ON perk.perkara_id = i.perkara_id
          LEFT JOIN perkara_jurusita AS m ON perk.perkara_id = m.perkara_id
          WHERE m.jurusita_nama LIKE '%${namaJurusita}%' AND YEAR(perk.tanggal_pendaftaran) = YEAR(CURDATE())
            AND perk.alur_perkara_id < 111
            AND perkarapihak.pihak_id NOT IN (
              SELECT pp.pihak_id
              FROM perkara_pelaksanaan_relaas
              JOIN perkara_pengacara AS pp ON pp.pengacara_id = perkara_pelaksanaan_relaas.pihak_id
                AND pp.perkara_id = perkara_pelaksanaan_relaas.perkara_id
              JOIN perkara ON pp.perkara_id = perkara.perkara_id
              WHERE perk.alur_perkara_id < 111 AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
                AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
                AND (perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.tanggal_relaas <> '')
                AND (perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.doc_relaas <> '')
              UNION
              SELECT ppb.pengacara_id
              FROM perkara_pelaksanaan_relaas
              JOIN perkara_pengacara AS ppb ON ppb.pihak_id = perkara_pelaksanaan_relaas.pihak_id
                AND ppb.perkara_id = perkara_pelaksanaan_relaas.perkara_id
              JOIN perkara ON ppb.perkara_id = perkara.perkara_id
              WHERE perk.alur_perkara_id < 111 AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
                AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
                AND (perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.tanggal_relaas <> '')
                AND (perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL OR perkara_pelaksanaan_relaas.doc_relaas <> '')
            )
            AND (
              (datarelaas.tanggal_relaas IS NULL OR datarelaas.tanggal_relaas = '')
              OR (datarelaas.doc_relaas IS NULL OR datarelaas.doc_relaas = '')
            )
            AND (perk.alur_perkara_id >= 1 AND perk.alur_perkara_id <= 17)
            AND (
              (jadwalsidang.dihadiri_oleh <> 1)
              AND (jadwalsidang.dihadiri_oleh = 2 AND (perkarapihak.pihakke = 2 OR perkarapihak.pihakke = 4))
              OR (jadwalsidang.dihadiri_oleh = 3 AND perkarapihak.pihakke = 1)
              OR (jadwalsidang.dihadiri_oleh = 4 OR jadwalsidang.dihadiri_oleh IS NULL)
            )
            AND sidang.tanggal_sidang = CURDATE()
            AND sidang.agenda NOT LIKE '%elektronik%'
            AND sidang.agenda NOT LIKE '%putusan%'
            AND sidang.agenda NOT LIKE '%penetapan%'
          ORDER BY perk.perkara_id DESC, sidang.tanggal_sidang ASC`;

          db.query(query, (err, result) => {
            if (err) {
              reject(err);
            } else {
              if (result.length != 0) {
                const messages = result.map((r, index) => {
                  return `${index + 1}. ${r.nomor_perkara} ${r.ecourt}${r.ghaib}${r.prodeo}\nNama Pihak : ${r.nama_pihak} (${r.ketpihak})\nPanitera/PP : ${r.panitera_nama}`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk jurusita: ${namaJurusita}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching belum panggilan hari ini jurusita data:", error);
      reject(error);
    }
  });
};

const getDataBelumDelegasiJurusita = (namaJurusita) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT delegasi_masuk.id, nomor_perkara, tgl_relaas, delegasi_masuk.diinput_tanggal, delegasi_proses_masuk.jurusita_nama, delegasi_masuk.pn_asal_text
      FROM delegasi_masuk 
      LEFT JOIN delegasi_proses_masuk ON delegasi_masuk.id = delegasi_proses_masuk.delegasi_id 
      WHERE YEAR(delegasi_masuk.diinput_tanggal) >= 2022 
      AND (tgl_relaas IS NULL OR tgl_relaas = "") 
      AND delegasi_proses_masuk.jurusita_nama LIKE '%${namaJurusita}%' 
      ORDER BY delegasi_masuk.id DESC`;

      db.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          if (result.length != 0) {
            const messages = result.map((r, index) => {
              return `${index + 1}. ${r.nomor_perkara}\nTanggal masuk : ${moment(r.diinput_tanggal).format("DD-MM-YYYY")}\nPA Delegasi : ${r.pn_asal_text}\nJS : ${r.jurusita_nama}`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk jurusita: ${namaJurusita}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching belum delegasi masuk jurusita data:", error);
      reject(error);
    }
  });
};

const getDataBelumDelegasiKeluarJurusita = (namaJurusita) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT a.nomor_perkara, b.alamat, d.jurusita_nama
      FROM perkara AS a 
      LEFT JOIN perkara_pihak2 AS b ON a.perkara_id = b.perkara_id 
      LEFT JOIN perkara_jurusita AS d ON a.perkara_id = d.perkara_id
      LEFT JOIN perkara_pihak1 AS e ON a.perkara_id = e.perkara_id 
      LEFT JOIN perkara_efiling_id AS f ON a.perkara_id = f.perkara_id
      WHERE b.alamat NOT LIKE '%Morowali%' 
        AND b.alamat NOT LIKE '%Morowali Utara%' 
        AND b.alamat NOT LIKE '%Bungku%'
        AND YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE())
        AND a.perkara_id NOT IN (SELECT perkara_id FROM delegasi_keluar) 
        AND a.perkara_id NOT IN (SELECT perkara_id FROM perkara_efiling_id)
        AND d.jurusita_nama LIKE '%${namaJurusita}%'
      ORDER BY d.jurusita_nama DESC;`;

      db.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          if (result.length != 0) {
            const messages = result.map((r, index) => {
              return `${index + 1}. ${r.nomor_perkara}\nJS : ${r.jurusita_nama} Alamat : ${r.alamat}`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk jurusita: ${namaJurusita}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching belum delegasi keluar jurusita data:", error);
      reject(error);
    }
  });
};

const getDataPutusanBelumBeritahuNewJurusita = (namaJurusita) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT 
      perkara.perkara_id, 
      alur_perkara_id,
      nomor_perkara, 
      pihak.nama, 
      perkara_putusan_pemberitahuan_putusan.pihak_id AS pihak_pemb, 
      tanggal_pemberitahuan_putusan, 
      tanggal_putusan,
      status_putusan_id, 
      perkara_jurusita.jurusita_nama
  FROM 
      perkara
  LEFT JOIN 
      perkara_putusan_pemberitahuan_putusan ON perkara.perkara_id = perkara_putusan_pemberitahuan_putusan.perkara_id
  LEFT JOIN 
      perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id
  LEFT JOIN 
      pihak ON perkara_putusan_pemberitahuan_putusan.pihak_id = pihak.id
  LEFT JOIN 
      perkara_jurusita ON perkara_jurusita.perkara_id = perkara.perkara_id
  WHERE 
      perkara_jurusita.jurusita_nama LIKE '%${namaJurusita}%'
      AND alur_perkara_id != 114 
      AND tanggal_putusan IS NOT NULL 
      AND YEAR(tanggal_putusan) >= 2024 
      AND tanggal_pemberitahuan_putusan IS NULL
  ORDER BY 
      perkara.perkara_id DESC;`;

      db.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          if (result.length != 0) {
            const messages = result.map((r, index) => {
              let pihak_jenis;
              if (r.alur_perkara_id == 1 || r.alur_perkara_id == 8 || r.alur_perkara_id == 15) {
                pihak_jenis = r.pihak == 1 ? "Penggugat" : "Tergugat";
                if (r.status_putusan_id != 28) {
                  return `${index + 1}. ${r.nomor_perkara}\nTanggal Putusan : ${moment(r.tanggal_putusan).format("DD-MM-YYYY")}\nPihak Yang Belum Diberitahukan : ${pihak_jenis}`;
                }
              } else if (r.alur_perkara_id == 111 || r.alur_perkara_id == 112 || r.alur_perkara_id == 113 || r.alur_perkara_id == 118 || r.alur_perkara_id == 122) {
                pihak_jenis = r.pihak == 1 ? "Penuntut Umum" : "Terdakwa";
                return `${index + 1}. ${r.nomor_perkara}\nPihak Yang Belum Diberitahukan : ${pihak_jenis}`;
              } else if (r.alur_perkara_id == 119 || r.alur_perkara_id == 16) {
                pihak_jenis = r.pihak == 1 ? "Pemohon" : "Termohon";
                return `${index + 1}. ${r.nomor_perkara}\nPihak Yang Belum Diberitahukan : ${pihak_jenis}`;
              } else {
                pihak_jenis = "Pemohon";
                return `${index + 1}. ${r.nomor_perkara}\nPihak Yang Belum Diberitahukan : ${pihak_jenis}`;
              }
            }).filter(Boolean);
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk jurusita: ${namaJurusita}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching belum putusan pemberitahuan new jurusita data:", error);
      reject(error);
    }
  });
};

const getDataPemberitahuanPutusanBelumJurusita = (namaJurusita) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT 
      a.perkara_id,
      a.nomor_perkara,
      a.jenis_perkara_nama,
      a.tanggal_putusan,
      a.status_putusan_kode,
      CASE 
          WHEN b.dihadiri_oleh = 4 THEN 'tidak ada hadir' 
          WHEN b.dihadiri_oleh = 3 THEN 'Pihak Kedua saja' 
          WHEN b.dihadiri_oleh = 2 THEN 'Pihak Pertama saja' 
          ELSE 'semua' 
      END AS dihadiri_oleh,
      c.jurusita_nama,
      a.alur_perkara_id,
      h.pihak,
      g.status_putusan_id,
      d.perkara_id AS delegasi
  FROM 
      v_perkara a
  JOIN 
      perkara_jadwal_sidang b ON a.perkara_id = b.perkara_id 
      AND b.tanggal_sidang = a.tanggal_putusan 
      AND b.dihadiri_oleh IS NOT NULL 
  JOIN 
      perkara_putusan g ON a.perkara_id = g.perkara_id
  JOIN 
      perkara_putusan_pemberitahuan_putusan h ON a.perkara_id = h.perkara_id
  JOIN 
      perkara_jurusita c ON a.perkara_id = c.perkara_id
  LEFT JOIN 
      delegasi_keluar d ON a.perkara_id = d.perkara_id
  WHERE
      YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE())
      AND a.tanggal_putusan > DATE_SUB(CURDATE(), INTERVAL 3 YEAR) 
      AND b.dihadiri_oleh > 1
      AND c.jurusita_nama LIKE '%${namaJurusita}%'
      AND (
          CASE 
              WHEN b.dihadiri_oleh = 4 THEN (
                  SELECT MAX(a1.tanggal_pemberitahuan_putusan) 
                  FROM perkara_putusan_pemberitahuan_putusan a1 
                  WHERE a1.perkara_id = a.perkara_id
              ) 
              WHEN b.dihadiri_oleh = 3 THEN (
                  SELECT MAX(a2.tanggal_pemberitahuan_putusan) 
                  FROM perkara_putusan_pemberitahuan_putusan a2 
                  WHERE a2.perkara_id = a.perkara_id AND a2.pihak = 1
              )
              WHEN b.dihadiri_oleh = 2 THEN (
                  SELECT MAX(a3.tanggal_pemberitahuan_putusan) 
                  FROM perkara_putusan_pemberitahuan_putusan a3 
                  WHERE a3.perkara_id = a.perkara_id AND a3.pihak = 2
              )
              ELSE NULL 
          END
      ) IS NULL
      AND a.tanggal_putusan IS NOT NULL 
      AND (
          SELECT MAX(d.tanggal_transaksi) 
          FROM perkara_biaya d 
          WHERE d.kategori_id = 6 
          AND d.perkara_id = a.perkara_id
      ) IS NOT NULL 
  ORDER BY 
      d.perkara_id DESC;`;

      db.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          if (result.length != 0) {
            const messages = result.map((r, index) => {
              let pihak_jenis;
              if (r.alur_perkara_id == 1 || r.alur_perkara_id == 8 || r.alur_perkara_id == 15) {
                pihak_jenis = r.pihak == 1 ? "Penggugat" : "Tergugat";
                if (r.status_putusan_id != 28) {
                  return `${index + 1}. ${r.nomor_perkara}\ntanggal putusan : ${moment(r.tanggal_putusan).format("DD-MM-YYYY")}\npihak yang belum diberitahukan : ${pihak_jenis}\nJS : ${r.jurusita_nama}`;
                }
              } else if (
                r.alur_perkara_id == 111 ||
                r.alur_perkara_id == 112 ||
                r.alur_perkara_id == 113 ||
                r.alur_perkara_id == 118 ||
                r.alur_perkara_id == 122
              ) {
                pihak_jenis = r.pihak == 1 ? "Penuntut Umum" : "Terdakwa";
                return `${index + 1}. ${r.nomor_perkara}\npihak yang belum diberitahukan : ${pihak_jenis}`;
              } else if (r.alur_perkara_id == 119 || r.alur_perkara_id == 16) {
                pihak_jenis = r.pihak == 1 ? "Pemohon" : "Termohon";
                return `${index + 1}. ${r.nomor_perkara}\npihak yang belum diberitahukan : ${pihak_jenis}`;
              } else {
                pihak_jenis = "Pemohon";
                return `${index + 1}. ${r.nomor_perkara}\npihak yang belum diberitahukan : ${pihak_jenis}`;
              }
            }).filter(Boolean);
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk jurusita: ${namaJurusita}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching belum putusan pemberitahuan jurusita data:", error);
      reject(error);
    }
  });
};

const getDataPutusJurusitaNew = (namaJurusita) => {
  return new Promise((resolve, reject) => {
    try {
      let query = `SELECT DISTINCT
      a.perkara_id,
      CASE 
        WHEN d.dihadiri_oleh = 2 THEN b.pihak2_text 
        WHEN d.dihadiri_oleh = 3 THEN b.pihak1_text 
        WHEN d.dihadiri_oleh = 4 THEN CONCAT(b.pihak1_text, ' AND ', b.pihak2_text) 
      END AS pihak_yang_dipanggil,
      a.amar_putusan,
      a.status_putusan_id,
      CASE WHEN a.putusan_verstek = 'Y' THEN 'Verstek' ELSE '-' END AS putusan_verstek,
      b.nomor_perkara,
      b.jenis_perkara_nama,
      c.jurusita_nama,
      CASE 
        WHEN a.status_putusan_id = '62' THEN 'Kabul'
        WHEN a.status_putusan_id = '63' THEN 'Tolak'
        WHEN a.status_putusan_id = '64' THEN 'Niet/NO'
        WHEN a.status_putusan_id = '65' THEN 'Digugurkan'
        WHEN a.status_putusan_id = '93' THEN 'Gugur'
        WHEN a.status_putusan_id = '66' THEN 'Coret'
        WHEN a.status_putusan_id = '67' THEN 'Cabut'
        WHEN a.status_putusan_id = '85' THEN 'Damai'
        ELSE 'Unknown'
      END AS jenis_putusan
      FROM 
        perkara_putusan AS a
      JOIN 
        perkara AS b ON a.perkara_id = b.perkara_id
      JOIN 
        perkara_jurusita AS c ON a.perkara_id = c.perkara_id
      JOIN
        perkara_jadwal_sidang AS d ON a.perkara_id = d.perkara_id
      WHERE 
        a.tanggal_putusan = CURDATE() AND d.dihadiri_oleh <> 1 AND c.jurusita_nama LIKE '%${namaJurusita}%'
      ORDER BY 
        b.alur_perkara_id,
        b.perkara_id ASC;`;

        db.query(query, (err, result) => {
          if (err) {
            reject(err);
          } else {
            if (result.length != 0) {
              const messages = result.map((r, index) => {
                return `${index + 1}. No Perkara: ${r.nomor_perkara}\nJenis Putusan: ${r.jenis_putusan} (${r.putusan_verstek})\nPihak PBT: ${r.pihak_yang_dipanggil}`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk jurusita: ${namaJurusita}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching putus jurusita new data:", error);
      reject(error);
    }
  });
};

const getDataTundaJurusitaNew = (namaJurusita) => {
  return new Promise((resolve, reject) => {
    try {
      let query =  `SELECT DISTINCT
      a.alasan_ditunda,
      (SELECT MAX(tanggal_sidang) FROM perkara_jadwal_sidang WHERE perkara_id = a.perkara_id) AS tanggal_tundaan,
      b.perkara_id,
      b.nomor_perkara,
      b.jenis_perkara_nama,
      c.jurusita_nama,
      CASE 
        WHEN a.dihadiri_oleh = 2 THEN b.pihak2_text 
        WHEN a.dihadiri_oleh = 3 THEN b.pihak1_text 
        WHEN a.dihadiri_oleh = 4 AND b.alur_perkara_id = 15 THEN CONCAT(b.pihak1_text, ' dan ', b.pihak2_text)
				WHEN a.dihadiri_oleh = 4 AND b.alur_perkara_id = 16 THEN b.pihak1_text
      END AS pihak_yang_dipanggil,
      CASE 
        WHEN a.dihadiri_oleh = 2 THEN 'Pihak T' 
        WHEN a.dihadiri_oleh = 3 THEN 'Pihak P' 
        WHEN a.dihadiri_oleh = 4 AND b.alur_perkara_id = 15 THEN CONCAT('Pihak P', ' dan ', 'Pihak T')
				WHEN a.dihadiri_oleh = 4 AND b.alur_perkara_id = 16 THEN 'Pihak Para P' 
      END AS keterangan_pihak
      FROM 
        perkara_jadwal_sidang AS a
      JOIN 
        perkara AS b ON a.perkara_id = b.perkara_id
      JOIN 
        perkara_jurusita AS c ON a.perkara_id = c.perkara_id
      WHERE 
        a.tanggal_sidang = CURDATE()
        AND a.ditunda = 'Y' 
        AND a.dihadiri_oleh <> 1 
        AND c.jurusita_nama LIKE '%${namaJurusita}%'
      GROUP BY
        a.perkara_id
      ORDER BY 
        b.alur_perkara_id,
        b.perkara_id ASC;`;

        db.query(query, (err, result) => {
          if (err) {
            reject(err);
          } else {
            if (result.length != 0) {
              const messages = result.map((r, index) => {
                return `${index + 1}. No Perkara: ${r.nomor_perkara}\nTanggal Sidang : ${moment(r.tanggal_tundaan).format("DD-MM-YYYY")}\nPihak Dipanggil: ${r.pihak_yang_dipanggil} (${r.keterangan_pihak})`;
            });
            resolve(messages.join("\n\n"));
          } else {
            resolve('Tidak ada data');
            console.log(`Tidak ada data untuk jurusita: ${namaJurusita}`);
          }
        }
      });
    } catch (error) {
      console.error("Error fetching tunda jurusita new data:", error);
      reject(error);
    }
  });
};

module.exports = {
  getDataPenahanan,
  getDataBA,
  getDataPutusanBelumMinut,
  getDataBelumBhtPidana,
  getDataBelumBhtPerdata,
  getDataBelumSerahHukum,
  getDataTundaJadwalSidang,
  getDataSaksiTidakLengkap,
  getDataSaksiTidakLengkapLama,
  getDataPutusanBelumBeritahuNew,
  getDataJadwalSidangPidana,
  getDataJadwalSidangPerdata,
  getDataJadwalMediasi,
  getDataJadwalMediasiBesok,
  getDataSisaPanjarPn,
  getDataSisaPanjarBanding,
  getDataSisaPanjarKasasi,
  getDataCourtCalendar,
  getStatistik,
  getBelumBhtBanding,
  getBelumBhtKasasi,
  getBelumPanggilan,
  getBelumPanggilanHariSidang,
  getBelumPanggilanSidangPertama,
  getPanggilanTidakPatut,
  getPanggilanPosTidakPatut,
  getBelumPanggilanSebelumHariSidang,
  getBelumEdocCourtCalendar,
  getDataBanding,
  getDataKasasi,
  getDataPK,
  getDataEdocPetitum,
  getDataEdocDakwaan,
  getDataEdocAnonimisasi,
  getDataEdocPutusan,
  getDataEdocAktaCerai,
  getDataBelumDelegasi,
  getDataPublikasi,
  getDataPublikasiTahunBerjalan,
  getDataVerstek,
  getStatistikDetail,
  getDataJadwalBesok,
  getDataTundaMediasi,
  getDataDirput,
  getDataNomorKontakPihak1,
  getDataNomorKontakPihak2,
  getDataPutusHariIni,
  getDataPutusJurusita,
  getDataTundaJurusita,
  getDataUploadPutusan,
  getDataJadwalSidangPerdatalama,
  getDataSisaPanjarPnLama,
  getDataJadwalBesokPanitera,
  getDataPutusLebih30Hari,
  getDataSidangLebih30Hari,
  getDataPemberitahuanPutusanBelum,
  getDataBelumDelegasiKeluar,
  getDataCeraiAnakBelum,
  getDataLupaTunda,
  getDataAktaCeraiTerbit,
  getBhtPerceraian,
  getDataKuaCerai,
  getDataDaftarEcourt,
  getDataJumlahAlasanCerai,
  getDataDaftarProdeo,
  getDataDaftarGhaib,
  getDataDaftarSidkel,
  getDataDaftarPenetapan,
  getDataDaftarMediasi,
  getDataJumlahMediasi,
  getDataJumlahMediasiHakim,
  getTotalPenerimaanPerkaraSemuaHakim,
  getTotalPenerimaanPerkaraSemuaPanitera,
  getTotalPenerimaanPerkaraSemuaJurusita,
  getTotalPenerimaanPerkaraSemuaHakimLengkap,
  getTotalPenerimaanPerkaraSemuaPaniteraLengkap,
  getTotalPenerimaanPerkaraSemuaJurusitaLengkap,
  getTotalPenerimaanMediasiSemuaHakim,
  getTotalPenerimaanPerkaraSemuaHakimLengkapAll,
  getTotalPenerimaanPerkaraSemuaPaniteraLengkapAll,
  getTotalPenerimaanPerkaraSemuaJurusitaLengkapAll,
  getTotalPenerimaanMediasiSemuaHakimAll,
  getDataMeteraiRedaksiPsp,
  getDataCapilCerai,
  getDataBelumInputAlamat,
  getDataNoHpEmailParaPihak,
  getDataKodeJabatan,
  getDataBelumValidasi,
  //KODE TIAP USER HAKIM, PP, JS
  getDataJadwalSidangPerdataHakim,
  getDataJadwalMediasiHakim,
  getDataJadwalBesokHakim,
  getDataJadwalMediasiBesokHakim,
  getDataBASHakim,
  getDataEdocAnonimisasiHakim,
  getDataUploadPutusanHakim,
  getDataLupaTundaHakim,
  getDataPutusanBelumMinutHakim,
  getDataPerkaraAktifHakim,
  getDataMediasiAktifHakim,
  getTotalPenerimaanPerkaraHakim,
  getTotalPenerimaanMediasiHakim,
  getBelumPanggilanHakimHariIni,
  getDataJadwalSidangPerdataPanitera,
  getDataPerkaraAktifPanitera,
  getTotalPenerimaanPerkaraPanitera,
  getDataJadwalBesokPaniteraNew,
  getDataTundaMediasiPanitera,
  getDataBASPanitera,
  getDataLupaTundaPanitera,
  getDataPutusanBelumMinutPanitera,
  getBelumPanggilanPaniteraHariIni,
  getDataPerkaraAktifJurusita,
  getTotalPenerimaanPerkaraJurusita,
  getBelumPanggilanJurusita,
  getBelumPanggilanPengingatJurusita,
  getBelumPanggilanJurusitaHariIni,
  getDataBelumDelegasiJurusita,
  getDataBelumDelegasiKeluarJurusita,
  getDataPutusanBelumBeritahuNewJurusita,
  getDataPemberitahuanPutusanBelumJurusita,
  getDataPutusJurusitaNew,
  getDataTundaJurusitaNew,
  getDataAntrianSidangHakim,
  getDataAntrianSidangPanitera,
  //KODE SIPP
  getDataKriteriaWaktuPutus,
  getDataMinutasiBerkasPerkara,
  getDataUploadPublikasiPutusan,
  getDataPendaftaranPerkara,
  getDataPenetapanMajelisHakim,
  getDataPengimputanPenetapanMajelisHakim,
  getDataPenunjukkanPp,
  getDataPengimputanPenunjukkanPp,
  getDataPenunjukkanJurusita,
  getDataPengimputanPenunjukkanJurusita,
  getDataPenetapanHariSidang,
  getDataPengimputanPenetapanHariSidang,
  getDataPengisianDataRelaas,
  getDataMediasi,
  getDataKepatuhanDataSaksi,
  getDataPemberitahuanPutusanPenetapan,
  getDataPengisianBht,
  getDataPencatatanSisaPanjarBiaya,
  getDataPengisianDataArsip,
  getDataPenerimaanDelegasi,
  getDataEdocPetitumTuntutan,
  getDataEdocRelaas,
  getDataEdocBas,
  getDataEdocAc,
  getDataAgendaSidangTerakhir,
  getDataPermohonanPanggilanDelegasi,
  getDataPengisianJenisPutusanVerstekContra,
  //KODE TRIWULAN
  getDataTriwulanEcourt,
  getDataTriwulanMediasi,
  //KODE PIHAK
  getDataPihakTundaCuti,
  getDataPihakBaru,
  getDataPihakAktaCerai,
  getDataHabisBiaya,
  getDataPihakHariSidang,
  getDataPihakSebelumHariSidang,
  getDataPutusanPihak,
  getDataPihakSisaPanjar
};
