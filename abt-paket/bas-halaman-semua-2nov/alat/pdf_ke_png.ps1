# pdf_ke_png.ps1 <pdf> <folder png> <awalan> [halaman,halaman,...] [lebar] : render halaman PDF ke PNG lewat Windows.Data.Pdf
param([string]$Pdf, [string]$Out, [string]$Awalan, [string]$Halaman = '', [int]$Lebar = 700)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime]
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, $tipe) { $t = $asTask.MakeGenericMethod($tipe).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }
$asTaskAksi = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' })[0]
function AwaitAksi($op) { $t = $asTaskAksi.Invoke($null, @($op)); $t.Wait(-1) | Out-Null }
New-Item -ItemType Directory -Force $Out | Out-Null
$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync((Resolve-Path $Pdf).Path)) ([Windows.Storage.StorageFile])
$doc = Await ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
$daftar = if ($Halaman) { $Halaman.Split(',') | ForEach-Object { [int]$_ } } else { 1..$doc.PageCount }
foreach ($n in $daftar) {
  $page = $doc.GetPage($n - 1)
  $opt = New-Object Windows.Data.Pdf.PdfPageRenderOptions
  $opt.DestinationWidth = $Lebar
  $ms = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
  AwaitAksi ($page.RenderToStreamAsync($ms, $opt))
  $ms.Seek(0)
  $net = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($ms)
  $berkas = Join-Path (Resolve-Path $Out).Path ("{0}-h{1}.png" -f $Awalan, $n)
  $fs = [System.IO.File]::Create($berkas)
  $net.CopyTo($fs); $fs.Close(); $net.Close()
  $page.Dispose()
  Write-Output $berkas
}
