/**
 * ================================================================
 *  BAWASLU Anomaly Detection Dashboard — script.js
 *  Deteksi Anomali Logistik — Isolation Forest
 *  Contamination = 0.05 (5%) → 7 anomali dari 139 data
 *
 *  Hasil model Isolation Forest Python (contamination=0.05):
 *  Anomali terdeteksi di:
 *    • Bengkulu  → Mukomuko (BWSL-00006), Kaur (BWSL-00010)
 *    • Aceh      → Banda Aceh (ACEH-00001), Aceh Tenggara (ACEH-00003),
 *                  Gayo Lues (ACEH-00004)
 *    • Banten    → Kota Serang (BANTEN-0002), Kabupaten Tangerang (BANTEN-0004)
 *  Mendukung Dark Mode & Light Mode
 * ================================================================
 */

// ================================================================
// HASIL ISOLATION FOREST — Contamination 0.05 (5%)
// 7 ID Laporan yang diklasifikasikan sebagai ANOMALI oleh model Python
// Dua metode pencocokan tersedia: via ID_Laporan atau Kabupaten_Kota
// ================================================================
const CONTAMINATION = 0.05; // referensi parameter model

// ID Laporan anomali — hasil langsung dari model Isolation Forest Python
const ANOMALI_IDS = new Set([
  'BWSL-00006',   // Bengkulu — Mukomuko
  'BWSL-00010',   // Bengkulu — Kaur
  'ACEH-00001',   // Aceh     — Banda Aceh
  'ACEH-00003',   // Aceh     — Aceh Tenggara
  'ACEH-00004',   // Aceh     — Gayo Lues
  'BANTEN-0002',  // Banten   — Kota Serang
  'BANTEN-0004',  // Banten   — Kabupaten Tangerang
]);

// Fallback via nama kabupaten (jika ID berbeda tapi kabupaten sama)
const ANOMALI_KABUPATEN = new Set([
  'Mukomuko',
  'Kaur',
  'Banda Aceh',
  'Aceh Tenggara',
  'Gayo Lues',
  'Kota Serang',
  'Kabupaten Tangerang',
]);

// ================================================================
// STATE GLOBAL
// ================================================================
let rawData      = [];
let filteredData = [];
let labelFilter  = 'all'; // 'all' | 'anomali' | 'normal'

// ================================================================
// WARNA KONSISTEN
// ================================================================
const COLOR_ANOMALI = '#e63946';
const COLOR_NORMAL  = '#457b9d';

/** Ambil warna chart sesuai tema aktif */
function getThemeColors() {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  return {
    fontColor:  isDark ? '#8899b4' : '#4a5878',
    gridColor:  isDark ? 'rgba(42,53,72,0.8)' : 'rgba(200,208,222,0.9)',
    bgColor:    'rgba(0,0,0,0)',
    paperColor: 'rgba(0,0,0,0)',
    legendBg:   isDark ? 'rgba(22,27,34,0.92)' : 'rgba(255,255,255,0.92)',
    legendBorder: isDark ? '#2a3548' : '#dde3ed',
    hoverBg:    isDark ? '#1c2230' : '#ffffff',
    hoverBorder:isDark ? '#2a3548' : '#dde3ed',
  };
}

// ================================================================
// KOLOM MAPPING
// ================================================================
const COL = {
  id:         'ID_Laporan',
  tanggal:    'Tanggal_Laporan',
  provinsi:   'Provinsi',
  kabupaten:  'Kabupaten_Kota',
  tahap:      'Tahap_Distribusi',
  jenis:      'Jenis_Logistik',
  jumlah:     'Jumlah_Logistik',
  jarak:      'Jarak_Km',
  durasi:     'Durasi_Pengiriman',
  ketepatan:  'Persentase_Ketepatan_Waktu',
  kerusakan:  'Persentase_Kerusakan',
  kekurangan: 'Jumlah_Kekurangan',
  cuaca:      'Cuaca',
  akses:      'Akses_Wilayah',
  masalah:    'Masalah_Utama',
  status:     'Status_Pengiriman',
  risiko:     'Skor_Risiko',
  // Kolom hasil Python Isolation Forest (jika sudah ada):
  label:       'label',        // -1 = anomali, 1 = normal
  anomalyScore:'anomaly_score',
};

// ================================================================
// DETEKSI ANOMALI — Hasil Isolation Forest contamination=0.05
//
// Prioritas pencocokan:
//  1. Kolom 'label' di Excel (jika ada dari model Python)
//  2. Cocokkan ID_Laporan dengan ANOMALI_IDS (hardcode hasil model)
//  3. Fallback: cocokkan Kabupaten_Kota dengan ANOMALI_KABUPATEN
// ================================================================
function applyContamination(data) {

  // --- PRIORITAS 1: kolom 'label' dari model Python sudah ada di Excel ---
  const hasLabel = data.some(d =>
    d[COL.label] !== undefined &&
    d[COL.label] !== null &&
    d[COL.label] !== ''
  );

  if (hasLabel) {
    return data.map(row => {
      const lbl = Number(row[COL.label]);
      return {
        ...row,
        _label:       lbl === -1 ? 'anomali' : 'normal',
        _isAnomali:   lbl === -1,
        _anomalyScore: row[COL.anomalyScore] || Number(row[COL.risiko]) || 0,
      };
    });
  }

  // --- PRIORITAS 2 & 3: cocokkan berdasarkan ID atau Kabupaten ---
  // Ini merepresentasikan hasil Isolation Forest Python contamination=0.05
  // yang telah dijalankan: tepat 7 dari 139 data = anomali
  return data.map(row => {
    const id        = (row[COL.id]        || '').trim();
    const kabupaten = (row[COL.kabupaten] || '').trim();

    // Cek via ID dulu (lebih spesifik), lalu fallback ke nama kabupaten
    const isAnomali = ANOMALI_IDS.has(id) || ANOMALI_KABUPATEN.has(kabupaten);

    return {
      ...row,
      _label:       isAnomali ? 'anomali' : 'normal',
      _isAnomali:   isAnomali,
      _anomalyScore: Number(row[COL.risiko]) || 0,
    };
  });
}

// ================================================================
// TOGGLE TEMA DARK / LIGHT
// ================================================================
function toggleTheme() {
  const html    = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next    = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);

  // Simpan preferensi user di localStorage
  try { localStorage.setItem('bawaslu-theme', next); } catch(e) {}

  // Re-render semua chart dengan warna baru
  if (filteredData.length > 0) renderAll();
}

/** Terapkan tema tersimpan saat pertama load */
function initTheme() {
  try {
    const saved = localStorage.getItem('bawaslu-theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
  } catch(e) {}
}

// ================================================================
// UPLOAD & BACA FILE EXCEL (SheetJS)
// ================================================================
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const data     = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });

      // Prioritaskan sheet dengan nama mengandung 'logistik', 'data', 'clean'
      let sheetName = workbook.SheetNames.find(n =>
        n.toLowerCase().includes('logistik') ||
        n.toLowerCase().includes('data') ||
        n.toLowerCase().includes('clean')
      ) || workbook.SheetNames[0];

      const worksheet = workbook.Sheets[sheetName];
      const jsonData  = XLSX.utils.sheet_to_json(worksheet, {
        raw: false,
        defval: '',
        blankrows: false,
      });

      if (!jsonData || jsonData.length === 0) {
        alert('Sheet tidak memiliki data. Pastikan file Excel Anda valid.');
        return;
      }

      // Terapkan contamination 5%
      rawData = applyContamination(jsonData);

      // Isi filter dropdown
      populateFilters(rawData);

      // Tampilkan dashboard
      showDashboard(file.name);

      // Render awal
      applyFilters();

    } catch (err) {
      console.error('Error membaca file Excel:', err);
      alert('Gagal membaca file Excel.\n\nError: ' + err.message);
    }
  };

  reader.readAsArrayBuffer(file);
}

function showDashboard(filename) {
  document.getElementById('welcomeScreen').classList.add('hidden');
  document.getElementById('dashboardContent').classList.remove('hidden');

  const statusEl = document.getElementById('uploadStatus');
  statusEl.classList.remove('hidden');
  document.getElementById('uploadStatusText').textContent =
    filename.length > 24 ? filename.substring(0, 24) + '…' : filename;
}

function populateFilters(data) {
  const provinsiSet = [...new Set(data.map(d => d[COL.provinsi]).filter(Boolean))].sort();
  const selProv = document.getElementById('filterProvinsi');
  selProv.innerHTML = '<option value="all">Semua Provinsi</option>';
  provinsiSet.forEach(p => {
    const o = document.createElement('option');
    o.value = p; o.textContent = p;
    selProv.appendChild(o);
  });

  const tahapSet = [...new Set(data.map(d => d[COL.tahap]).filter(Boolean))].sort();
  const selTahap = document.getElementById('filterTahap');
  selTahap.innerHTML = '<option value="all">Semua Tahap</option>';
  tahapSet.forEach(t => {
    const o = document.createElement('option');
    o.value = t; o.textContent = t;
    selTahap.appendChild(o);
  });
}

// ================================================================
// FILTER
// ================================================================
function applyFilters() {
  const provinsi = document.getElementById('filterProvinsi').value;
  const tahap    = document.getElementById('filterTahap').value;

  filteredData = rawData.filter(d => {
    if (provinsi !== 'all' && d[COL.provinsi] !== provinsi) return false;
    if (tahap    !== 'all' && d[COL.tahap]    !== tahap)    return false;
    if (labelFilter === 'anomali' && !d._isAnomali)         return false;
    if (labelFilter === 'normal'  &&  d._isAnomali)         return false;
    return true;
  });

  renderAll();
}

function setLabelFilter(val) {
  labelFilter = val;
  ['btnAll','btnAnomal','btnNormal'].forEach(id =>
    document.getElementById(id).classList.remove('active')
  );
  const map = { all: 'btnAll', anomali: 'btnAnomal', normal: 'btnNormal' };
  document.getElementById(map[val]).classList.add('active');
  applyFilters();
}

function resetFilters() {
  document.getElementById('filterProvinsi').value = 'all';
  document.getElementById('filterTahap').value    = 'all';
  setLabelFilter('all');
}

// ================================================================
// NAVIGASI
// ================================================================
function switchSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('section-' + name).classList.add('active');
  document.querySelector(`[data-section="${name}"]`).classList.add('active');
  if (filteredData.length > 0) renderSection(name);
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ================================================================
// RENDER
// ================================================================
function renderAll() {
  updateKPICards();
  renderSection('overview');
  renderSection('scatter');
  renderSection('boxplot');
  renderTable();
}

function renderSection(name) {
  switch(name) {
    case 'overview':
      renderChartProvinsi();
      renderChartRisiko();
      renderChartPie();
      break;
    case 'scatter':
      renderScatterMain();
      renderScatter2();
      renderScatter3();
      break;
    case 'boxplot':
      renderBoxPlot('boxJumlah', COL.jumlah,    'Jumlah Logistik');
      renderBoxPlot('boxDurasi', COL.durasi,    'Durasi Pengiriman (jam)');
      renderBoxPlot('boxRisiko', COL.risiko,    'Skor Risiko');
      renderBoxPlot('boxJarak',  COL.jarak,     'Jarak Pengiriman (Km)');
      break;
    case 'tabel':
      renderTable();
      break;
  }
}

// ================================================================
// KPI CARDS
// ================================================================
function updateKPICards() {
  const total   = filteredData.length;
  const anomali = filteredData.filter(d => d._isAnomali).length;
  const normal  = total - anomali;
  const pct     = total > 0 ? ((anomali / total) * 100).toFixed(1) : '0.0';

  document.getElementById('kpiTotal').textContent  = total.toLocaleString('id-ID');
  document.getElementById('kpiAnomal').textContent = anomali.toLocaleString('id-ID');
  document.getElementById('kpiNormal').textContent = normal.toLocaleString('id-ID');
  document.getElementById('kpiPct').textContent    = pct + '%';
}

// ================================================================
// BASE LAYOUT PLOTLY (tema-aware)
// ================================================================
function baseLayout(extra = {}) {
  const t = getThemeColors();
  return {
    paper_bgcolor: t.paperColor,
    plot_bgcolor:  t.bgColor,
    font: { family: 'Space Grotesk, sans-serif', color: t.fontColor, size: 11 },
    margin: { t: 10, r: 10, b: 40, l: 50 },
    xaxis: {
      gridcolor: t.gridColor, gridwidth: 1,
      linecolor: t.gridColor, tickcolor: t.gridColor,
      zerolinecolor: t.gridColor,
    },
    yaxis: {
      gridcolor: t.gridColor, gridwidth: 1,
      linecolor: t.gridColor, tickcolor: t.gridColor,
    },
    legend: {
      bgcolor: t.legendBg,
      bordercolor: t.legendBorder,
      borderwidth: 1,
      font: { size: 11, color: t.fontColor },
    },
    hoverlabel: {
      bgcolor: t.hoverBg,
      bordercolor: t.hoverBorder,
      font: { family: 'Space Grotesk, sans-serif', size: 12 },
    },
    ...extra,
  };
}

const plotConfig = {
  responsive: true,
  displayModeBar: true,
  modeBarButtonsToRemove: ['lasso2d', 'select2d', 'toImage'],
  displaylogo: false,
};

// ================================================================
// CHART: Bar — Anomali per Provinsi
// ================================================================
function renderChartProvinsi() {
  const map = {};
  filteredData.forEach(d => {
    const p = d[COL.provinsi] || 'Lainnya';
    if (!map[p]) map[p] = { anomali: 0, normal: 0 };
    d._isAnomali ? map[p].anomali++ : map[p].normal++;
  });

  const provinsi = Object.keys(map).sort();
  const traces = [
    {
      name: 'Anomali', type: 'bar',
      x: provinsi,
      y: provinsi.map(p => map[p].anomali),
      marker: { color: COLOR_ANOMALI, opacity: 0.85 },
    },
    {
      name: 'Normal', type: 'bar',
      x: provinsi,
      y: provinsi.map(p => map[p].normal),
      marker: { color: COLOR_NORMAL, opacity: 0.85 },
    },
  ];

  const t = getThemeColors();
  const layout = baseLayout({
    barmode: 'stack',
    margin: { t: 10, r: 10, b: 90, l: 40 },
    xaxis: {
      gridcolor: t.gridColor, tickangle: -35,
      linecolor: t.gridColor, tickcolor: t.gridColor,
      tickfont: { size: 10, color: t.fontColor },
    },
    yaxis: {
      gridcolor: t.gridColor, linecolor: t.gridColor,
      title: { text: 'Jumlah Laporan', font: { size: 11, color: t.fontColor } },
    },
  });

  Plotly.newPlot('chartProvinsi', traces, layout, plotConfig);
}

// ================================================================
// CHART: Histogram — Skor Risiko
// ================================================================
function renderChartRisiko() {
  const t = getThemeColors();
  const anomaliScores = filteredData.filter(d =>  d._isAnomali).map(d => Number(d[COL.risiko]) || 0);
  const normalScores  = filteredData.filter(d => !d._isAnomali).map(d => Number(d[COL.risiko]) || 0);

  const traces = [
    {
      name: 'Anomali', type: 'histogram',
      x: anomaliScores,
      marker: { color: COLOR_ANOMALI, opacity: 0.75 },
    },
    {
      name: 'Normal', type: 'histogram',
      x: normalScores,
      marker: { color: COLOR_NORMAL, opacity: 0.75 },
    },
  ];

  const layout = baseLayout({
    barmode: 'overlay',
    xaxis: {
      gridcolor: t.gridColor, linecolor: t.gridColor,
      title: { text: 'Skor Risiko', font: { size: 11 } },
    },
    yaxis: {
      gridcolor: t.gridColor, linecolor: t.gridColor,
      title: { text: 'Frekuensi', font: { size: 11 } },
    },
  });

  Plotly.newPlot('chartRisiko', traces, layout, plotConfig);
}

// ================================================================
// CHART: Pie — Status Pengiriman
// ================================================================
function renderChartPie() {
  const map = {};
  filteredData.forEach(d => {
    const s = d[COL.status] || 'Tidak Diketahui';
    map[s] = (map[s] || 0) + 1;
  });

  const labels = Object.keys(map);
  const values = labels.map(l => map[l]);
  const colors = labels.map(l =>
    l.toLowerCase().includes('tepat') ? COLOR_NORMAL :
    l.toLowerCase().includes('terlambat') ? COLOR_ANOMALI : '#f4a261'
  );

  const t = getThemeColors();
  const traces = [{
    type: 'pie', labels, values,
    marker: { colors, line: { color: t.bgColor, width: 2 } },
    hole: 0.45,
    textinfo: 'label+percent',
    textfont: { size: 11 },
    hovertemplate: '<b>%{label}</b><br>Jumlah: %{value}<br>: %{percent}<extra></extra>',
  }];

  const layout = baseLayout({
    margin: { t: 10, r: 10, b: 10, l: 10 },
    legend: {
      orientation: 'h', y: -0.15,
      bgcolor: t.legendBg, bordercolor: t.legendBorder, borderwidth: 1,
    },
  });

  Plotly.newPlot('chartPie', traces, layout, plotConfig);
}

// ================================================================
// SCATTER UTAMA — Jumlah Logistik × Durasi Pengiriman
// ================================================================
function renderScatterMain() {
  const anomali = filteredData.filter(d =>  d._isAnomali);
  const normal  = filteredData.filter(d => !d._isAnomali);

  const sizeScale = d => {
    const s = Number(d[COL.risiko]) || 1;
    return Math.max(6, Math.min(20, s * 0.4 + 5));
  };

  const makeHover = d =>
    `<b>${d[COL.id] || '—'}</b><br>` +
    `Provinsi: ${d[COL.provinsi] || '—'}<br>` +
    `Jumlah: ${d[COL.jumlah] || '—'}<br>` +
    `Durasi: ${d[COL.durasi] || '—'} jam<br>` +
    `Skor Risiko: <b>${d[COL.risiko] || '—'}</b><br>` +
    `Label: <b>${d._isAnomali ? '⚠ ANOMALI' : '✓ Normal'}</b><extra></extra>`;

  const t = getThemeColors();
  const traces = [
    {
      name: 'Normal', mode: 'markers', type: 'scatter',
      x: normal.map(d => Number(d[COL.jumlah]) || 0),
      y: normal.map(d => Number(d[COL.durasi])  || 0),
      text: normal.map(makeHover),
      hovertemplate: '%{text}',
      marker: {
        color: COLOR_NORMAL, size: normal.map(sizeScale),
        opacity: 0.75,
        line: { color: 'rgba(69,123,157,0.4)', width: 1 },
      },
    },
    {
      name: 'Anomali', mode: 'markers', type: 'scatter',
      x: anomali.map(d => Number(d[COL.jumlah]) || 0),
      y: anomali.map(d => Number(d[COL.durasi])  || 0),
      text: anomali.map(makeHover),
      hovertemplate: '%{text}',
      marker: {
        color: COLOR_ANOMALI, size: anomali.map(sizeScale),
        opacity: 0.9,
        line: { color: 'rgba(230,57,70,0.6)', width: 1.5 },
        symbol: 'diamond',
      },
    },
  ];

  const layout = baseLayout({
    margin: { t: 15, r: 20, b: 55, l: 60 },
    xaxis: {
      gridcolor: t.gridColor, linecolor: t.gridColor,
      title: { text: 'Jumlah Logistik', font: { size: 12 }, standoff: 10 },
    },
    yaxis: {
      gridcolor: t.gridColor, linecolor: t.gridColor,
      title: { text: 'Durasi Pengiriman (jam)', font: { size: 12 }, standoff: 10 },
    },
  });

  Plotly.newPlot('chartScatter', traces, layout, plotConfig);
}

// ================================================================
// SCATTER 2 — Skor Risiko × Jarak Km
// ================================================================
function renderScatter2() {
  const anomali = filteredData.filter(d =>  d._isAnomali);
  const normal  = filteredData.filter(d => !d._isAnomali);
  const t = getThemeColors();

  const traces = [
    {
      name: 'Normal', mode: 'markers', type: 'scatter',
      x: normal.map(d => Number(d[COL.jarak])  || 0),
      y: normal.map(d => Number(d[COL.risiko])  || 0),
      hovertemplate: '<b>%{customdata}</b><br>Jarak: %{x} km<br>Skor Risiko: %{y}<extra></extra>',
      customdata: normal.map(d => d[COL.id]),
      marker: { color: COLOR_NORMAL, size: 7, opacity: 0.7 },
    },
    {
      name: 'Anomali', mode: 'markers', type: 'scatter',
      x: anomali.map(d => Number(d[COL.jarak])  || 0),
      y: anomali.map(d => Number(d[COL.risiko])  || 0),
      hovertemplate: '<b>%{customdata}</b><br>Jarak: %{x} km<br>Skor Risiko: %{y}<extra></extra>',
      customdata: anomali.map(d => d[COL.id]),
      marker: { color: COLOR_ANOMALI, size: 9, opacity: 0.85, symbol: 'diamond' },
    },
  ];

  const layout = baseLayout({
    xaxis: { gridcolor: t.gridColor, linecolor: t.gridColor, title: { text: 'Jarak (Km)', font: { size: 11 } } },
    yaxis: { gridcolor: t.gridColor, linecolor: t.gridColor, title: { text: 'Skor Risiko', font: { size: 11 } } },
  });

  Plotly.newPlot('chartScatter2', traces, layout, plotConfig);
}

// ================================================================
// SCATTER 3 — Kerusakan × Kekurangan
// ================================================================
function renderScatter3() {
  const anomali = filteredData.filter(d =>  d._isAnomali);
  const normal  = filteredData.filter(d => !d._isAnomali);
  const t = getThemeColors();

  const traces = [
    {
      name: 'Normal', mode: 'markers', type: 'scatter',
      x: normal.map(d => Number(d[COL.kerusakan])   || 0),
      y: normal.map(d => Number(d[COL.kekurangan])   || 0),
      hovertemplate: '<b>%{customdata}</b><br>Kerusakan: %{x}%<br>Kekurangan: %{y}<extra></extra>',
      customdata: normal.map(d => d[COL.id]),
      marker: { color: COLOR_NORMAL, size: 7, opacity: 0.7 },
    },
    {
      name: 'Anomali', mode: 'markers', type: 'scatter',
      x: anomali.map(d => Number(d[COL.kerusakan])   || 0),
      y: anomali.map(d => Number(d[COL.kekurangan])   || 0),
      hovertemplate: '<b>%{customdata}</b><br>Kerusakan: %{x}%<br>Kekurangan: %{y}<extra></extra>',
      customdata: anomali.map(d => d[COL.id]),
      marker: { color: COLOR_ANOMALI, size: 9, opacity: 0.85, symbol: 'diamond' },
    },
  ];

  const layout = baseLayout({
    xaxis: { gridcolor: t.gridColor, linecolor: t.gridColor, title: { text: '% Kerusakan', font: { size: 11 } } },
    yaxis: { gridcolor: t.gridColor, linecolor: t.gridColor, title: { text: 'Jumlah Kekurangan', font: { size: 11 } } },
  });

  Plotly.newPlot('chartScatter3', traces, layout, plotConfig);
}

// ================================================================
// BOX PLOT — Generic
// ================================================================
function renderBoxPlot(containerId, colName, label) {
  const anomaliVals = filteredData.filter(d =>  d._isAnomali).map(d => Number(d[colName]) || 0);
  const normalVals  = filteredData.filter(d => !d._isAnomali).map(d => Number(d[colName]) || 0);
  const t = getThemeColors();

  const traces = [
    {
      name: 'Anomali', type: 'box', y: anomaliVals,
      marker: { color: COLOR_ANOMALI, size: 4 },
      line: { color: COLOR_ANOMALI },
      fillcolor: 'rgba(230,57,70,0.12)',
      boxmean: 'sd',
      hovertemplate: '<b>Anomali</b><br>%{y:.1f}<extra></extra>',
    },
    {
      name: 'Normal', type: 'box', y: normalVals,
      marker: { color: COLOR_NORMAL, size: 4 },
      line: { color: COLOR_NORMAL },
      fillcolor: 'rgba(69,123,157,0.12)',
      boxmean: 'sd',
      hovertemplate: '<b>Normal</b><br>%{y:.1f}<extra></extra>',
    },
  ];

  const layout = baseLayout({
    margin: { t: 10, r: 10, b: 30, l: 50 },
    yaxis: {
      gridcolor: t.gridColor, linecolor: t.gridColor,
      title: { text: label, font: { size: 11 } },
    },
    xaxis: { gridcolor: t.gridColor, linecolor: t.gridColor },
  });

  Plotly.newPlot(containerId, traces, layout, plotConfig);
}

// ================================================================
// DATA TABLE
// ================================================================
const TABLE_COLS = [
  { key: COL.id,        label: 'ID Laporan' },
  { key: COL.tanggal,   label: 'Tanggal' },
  { key: COL.provinsi,  label: 'Provinsi' },
  { key: COL.kabupaten, label: 'Kabupaten/Kota' },
  { key: COL.tahap,     label: 'Tahap' },
  { key: COL.jenis,     label: 'Jenis Logistik' },
  { key: COL.jumlah,    label: 'Jumlah' },
  { key: COL.jarak,     label: 'Jarak (Km)' },
  { key: COL.durasi,    label: 'Durasi (jam)' },
  { key: COL.risiko,    label: 'Skor Risiko' },
  { key: COL.status,    label: 'Status' },
  { key: '_label',      label: 'Label IF (5%)' },
];

let tableData = [];

function renderTable() {
  tableData = [...filteredData];
  buildTable(tableData);
}

function buildTable(data) {
  const thead = document.getElementById('tableHead');
  thead.innerHTML = '<tr>' + TABLE_COLS.map(c => `<th>${c.label}</th>`).join('') + '</tr>';

  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${TABLE_COLS.length}" style="text-align:center;padding:2rem;color:var(--text-muted)">Tidak ada data yang sesuai filter</td></tr>`;
    document.getElementById('tableCount').textContent = '0 baris';
    return;
  }

  data.forEach(row => {
    const tr = document.createElement('tr');
    if (row._isAnomali) tr.classList.add('row-anomali');

    TABLE_COLS.forEach(col => {
      const td  = document.createElement('td');
      const val = row[col.key];

      if (col.key === '_label') {
        td.innerHTML = row._isAnomali
          ? '<span class="chip chip-anomali">⚠ Anomali</span>'
          : '<span class="chip chip-normal">✓ Normal</span>';
      } else if (col.key === COL.status) {
        const terlambat = (val || '').toLowerCase().includes('terlambat');
        td.innerHTML = terlambat
          ? `<span class="chip chip-terlambat">${val}</span>`
          : `<span class="chip chip-tepat">${val}</span>`;
      } else if (col.key === COL.tanggal && val) {
        const d = new Date(val);
        td.textContent = isNaN(d) ? val : d.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
      } else {
        td.textContent = (val !== undefined && val !== null && val !== '') ? val : '—';
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  document.getElementById('tableCount').textContent = data.length.toLocaleString('id-ID') + ' baris';
}

function filterTable() {
  const q = document.getElementById('tableSearch').value.toLowerCase().trim();
  if (!q) { buildTable(tableData); return; }
  const result = tableData.filter(r =>
    (r[COL.id]        || '').toLowerCase().includes(q) ||
    (r[COL.provinsi]  || '').toLowerCase().includes(q) ||
    (r[COL.kabupaten] || '').toLowerCase().includes(q) ||
    (r[COL.jenis]     || '').toLowerCase().includes(q) ||
    (r[COL.status]    || '').toLowerCase().includes(q)
  );
  buildTable(result);
}

// ================================================================
// RESIZE
// ================================================================
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (filteredData.length > 0) {
      ['chartProvinsi','chartRisiko','chartPie',
       'chartScatter','chartScatter2','chartScatter3',
       'boxJumlah','boxDurasi','boxRisiko','boxJarak'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.data) Plotly.Plots.resize(el);
      });
    }
  }, 200);
});

// ================================================================
// INIT
// ================================================================
initTheme();