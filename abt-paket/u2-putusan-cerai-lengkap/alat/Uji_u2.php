<?php defined('BASEPATH') OR exit('No direct script access allowed');
/*
 * PENGUJI SEMENTARA (hanya CLI) paket abt-riwayat-sidang - sama dengan Uji_cdeh (meniru views/abt/preview.php),
 * ditambah puncak memori & jumlah kueri. Disalin ke application/controllers saat uji dan DIHAPUS sesudahnya.
 */
class Uji_u2 extends CI_Controller {
	public function render() {
		if (!is_cli()) { show_404(); return; }
		$tugas = json_decode(file_get_contents(getenv('UJI_U2_TUGAS')), TRUE);
		$this->load->helper('abt');
		$this->load->model('abt/Abt_model');
		$_GET['d'] = isset($tugas['sidang']) ? $tugas['sidang'] : '';
		$berkas = getcwd() . '/' . $tugas['rtf'];
		$Template = str_replace("\n", '', file_get_contents($berkas));
		$Template = str_replace('\hich\af1\dbch\af31505\loch\f0 ', '', $Template);
		$Template = str_replace('\hich\af1\dbch\af31505\loch\f1 ', '', $Template);
		$t0 = microtime(TRUE);
		$hasil = $this->Abt_model->variabel_library($Template, $tugas['perkara_id']);
		file_put_contents($tugas['keluar'], $hasil);
		$nq = isset($this->Abt_model->dbsipp->queries) ? count($this->Abt_model->dbsipp->queries) : -1;
		echo "OK " . strlen($hasil) . " puncak_mem=" . memory_get_peak_usage(TRUE) . " kueri_sipp=" . $nq . " detik=" . round(microtime(TRUE) - $t0, 1) . "\n";
	}

	public function menu() {
		if (!is_cli()) { show_404(); return; }
		$this->load->helper('abt');
		$this->load->model('abt/Abt_model');
		chdir(FCPATH);
		foreach ($this->Abt_model->daftar_menu_blangko('derry_briantono') as $m) {
			echo $m['nama'] . " | " . $m['direktori'] . " | berkas=" . $m['jml_berkas'] . "
";
		}
	}
}
