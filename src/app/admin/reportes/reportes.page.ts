import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { AlertController, DatetimeCustomEvent } from '@ionic/angular';
import { ChartData, ChartOptions } from 'chart.js';
import {
  InventoryRow,
  RankingRow,
  ReportRow,
  ReportService,
} from '../../Services/report.service';

type ReportKind = 'loans' | 'returns' | 'inventory' | 'topBooks' | 'topUsers';

@Component({
  selector: 'app-reportes',
  templateUrl: './reportes.page.html',
  styleUrls: ['./reportes.page.scss'],
  standalone: false,
})
export class ReportesPage implements OnInit, OnDestroy {
  start = '';
  end = '';
  kind: ReportKind = 'loans';
  dashboard = { books: 0, users: 0, active: 0, overdue: 0, month: 0 };
  rows: ReportRow[] = [];
  inventory: InventoryRow[] = [];
  ranking: RankingRow[] = [];
  loading = false;

  // Gráfico Donut de resumen del sistema
  dashboardChartData: ChartData<'doughnut'> | null = null;
  dashboardChartOptions: ChartOptions<'doughnut'> = this.buildDashboardChartOptions();

  // Gráfico de barras para inventario por categoría
  inventoryChartData: ChartData<'bar'> | null = null;
  inventoryChartOptions: ChartOptions<'bar'> = this.buildInventoryChartOptions();

  // Gráfico de barras horizontales para rankings (Top libros / Top usuarios)
  rankingChartData: ChartData<'bar'> | null = null;
  rankingChartOptions: ChartOptions<'bar'> = this.buildRankingChartOptions();

  // Gráfico Donut para préstamos / devoluciones (A tiempo vs Extemporáneas)
  loansChartData: ChartData<'doughnut'> | null = null;
  loansChartOptions: ChartOptions<'doughnut'> = this.buildLoansChartOptions();

  private readonly themeObserver = new MutationObserver(() => this.refreshChartsTheme());

  readonly reportSelectOptions = {
    cssClass: 'report-select-alert',
  };

  /** True cuando la consulta actual devuelve datos exportables. */
  get hasData(): boolean {
    return this.rows.length > 0 || this.inventory.length > 0 || this.ranking.length > 0;
  }

  /** Mensaje del estado vacío según el tipo de reporte consultado. */
  get emptyMessage(): string {
    switch (this.kind) {
      case 'loans':
        return 'No hay préstamos en el rango seleccionado.';
      case 'returns':
        return 'No hay devoluciones en el rango seleccionado.';
      case 'inventory':
        return 'No hay inventario para el catálogo.';
      case 'topBooks':
        return 'No hay datos para el ranking de libros.';
      case 'topUsers':
        return 'No hay datos para el ranking de usuarios.';
      default:
        return 'No hay datos para los filtros seleccionados.';
    }
  }

  private readonly reports = inject(ReportService);
  private readonly alertController = inject(AlertController);

  ngOnInit() {
    this.refreshChartsTheme();
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    // Rango por defecto: último mes, para que la vista ya traiga datos.
    this.setRange(30);
  }

  ngOnDestroy() {
    this.themeObserver.disconnect();
  }

  load() {
    this.dashboard = { books: 0, users: 0, active: 0, overdue: 0, month: 0 };
    this.rows = [];
    this.inventory = [];
    this.ranking = [];

    this.loadDashboard();

    if (this.kind === 'loans') this.loadLoansReport();
    else if (this.kind === 'returns') this.loadReturnsReport();
    else if (this.kind === 'inventory') this.loadInventory();
    else if (this.kind === 'topBooks') this.loadTopBooks();
    else if (this.kind === 'topUsers') this.loadTopUsers();
  }

  private loadDashboard(): void {
    this.reports.dashboard().subscribe({
      next: (dashboard) => {
        this.dashboard = dashboard;
        this.updateDashboardChart();
      },
      error: (error: unknown) => {
        this.showMessage('No se pudieron cargar los indicadores', this.toMessage(error));
      },
    });
  }

  private loadLoansReport(): void {
    this.loading = true;
    this.reports.loansReport(this.start, this.end).subscribe({
      next: (rows) => {
        this.rows = rows;
        this.updateLoansChart();
        this.loading = false;
      },
      error: (error: unknown) => {
        this.loading = false;
        this.showMessage('No se pudo cargar el reporte de préstamos', this.toMessage(error));
      },
    });
  }

  private loadReturnsReport(): void {
    this.loading = true;
    this.reports.returnsReport(this.start, this.end).subscribe({
      next: (rows) => {
        this.rows = rows;
        this.updateLoansChart();
        this.loading = false;
      },
      error: (error: unknown) => {
        this.loading = false;
        this.showMessage('No se pudo cargar el reporte de devoluciones', this.toMessage(error));
      },
    });
  }

  private loadInventory(): void {
    this.loading = true;
    this.reports.inventory().subscribe({
      next: (rows) => {
        this.inventory = rows;
        this.updateInventoryChart();
        this.loading = false;
      },
      error: (error: unknown) => {
        this.loading = false;
        this.showMessage('No se pudo cargar el inventario', this.toMessage(error));
      },
    });
  }

  private loadTopBooks(): void {
    this.loading = true;
    this.reports.topBooks().subscribe({
      next: (ranking) => {
        this.ranking = ranking;
        this.updateRankingChart();
        this.loading = false;
      },
      error: (error: unknown) => {
        this.loading = false;
        this.showMessage('No se pudo cargar el ranking de libros', this.toMessage(error));
      },
    });
  }

  private loadTopUsers(): void {
    this.loading = true;
    this.reports.topUsers().subscribe({
      next: (ranking) => {
        this.ranking = ranking;
        this.updateRankingChart();
        this.loading = false;
      },
      error: (error: unknown) => {
        this.loading = false;
        this.showMessage('No se pudo cargar el ranking de usuarios', this.toMessage(error));
      },
    });
  }

  private refreshChartsTheme() {
    if (this.dashboard) this.updateDashboardChart();
    if (this.inventory.length) this.updateInventoryChart();
    if (this.ranking.length) this.updateRankingChart();
    if (this.rows.length) this.updateLoansChart();
  }

  private updateDashboardChart() {
    const tokens = this.readTokens();
    this.dashboardChartData = {
      labels: ['Activos', 'Vencidos', 'Del mes'],
      datasets: [
        {
          data: [this.dashboard.active, this.dashboard.overdue, this.dashboard.month],
          backgroundColor: [tokens.teal, tokens.coral, tokens.blue],
          hoverBackgroundColor: [tokens.tealStrong, tokens.coralStrong, tokens.blueStrong],
          borderWidth: 2,
          borderColor: tokens.paper,
        },
      ],
    };
    this.dashboardChartOptions = this.buildDashboardChartOptions();
  }

  private updateInventoryChart() {
    const tokens = this.readTokens();
    this.inventoryChartData = {
      labels: this.inventory.map((row) => row.category),
      datasets: [
        {
          label: 'Ejemplares Totales',
          data: this.inventory.map((row) => row.total),
          backgroundColor: tokens.navy,
          borderRadius: 6,
        },
        {
          label: 'Prestados',
          data: this.inventory.map((row) => row.borrowed),
          backgroundColor: tokens.coral,
          borderRadius: 6,
        },
        {
          label: 'Disponibles',
          data: this.inventory.map((row) => row.available),
          backgroundColor: tokens.teal,
          borderRadius: 6,
        },
      ],
    };
    this.inventoryChartOptions = this.buildInventoryChartOptions();
  }

  private updateRankingChart() {
    const tokens = this.readTokens();
    this.rankingChartData = {
      labels: this.ranking.map((row) => row.label),
      datasets: [
        {
          label: 'Total préstamos',
          data: this.ranking.map((row) => row.total),
          backgroundColor: tokens.teal,
          hoverBackgroundColor: tokens.tealStrong,
          borderRadius: 6,
        },
      ],
    };
    this.rankingChartOptions = this.buildRankingChartOptions();
  }

  private updateLoansChart() {
    const tokens = this.readTokens();
    const late = this.rows.filter((r) => r.lateReturn).length;
    const onTime = this.rows.length - late;
    this.loansChartData = {
      labels: ['A tiempo', 'Extemporáneas / Atrasadas'],
      datasets: [
        {
          data: [onTime, late],
          backgroundColor: [tokens.teal, tokens.coral],
          hoverBackgroundColor: [tokens.tealStrong, tokens.coralStrong],
          borderWidth: 2,
          borderColor: tokens.paper,
        },
      ],
    };
    this.loansChartOptions = this.buildLoansChartOptions();
  }

  private buildDashboardChartOptions(): ChartOptions<'doughnut'> {
    const tokens = this.readTokens();
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: tokens.slate,
            font: { family: 'Figtree, sans-serif', size: 12, weight: 600 },
          },
        },
      },
    };
  }

  private buildInventoryChartOptions(): ChartOptions<'bar'> {
    const tokens = this.readTokens();
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: tokens.slate,
            font: { family: 'Figtree, sans-serif', size: 12, weight: 600 },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: tokens.slate, font: { family: 'Figtree, sans-serif', size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: tokens.border },
          ticks: { color: tokens.slate, font: { family: 'Figtree, sans-serif', size: 11 } },
        },
      },
    };
  }

  private buildRankingChartOptions(): ChartOptions<'bar'> {
    const tokens = this.readTokens();
    return {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: tokens.border },
          ticks: { color: tokens.slate, font: { family: 'Figtree, sans-serif', size: 11 } },
        },
        y: {
          grid: { display: false },
          ticks: { color: tokens.slate, font: { family: 'Figtree, sans-serif', size: 11 } },
        },
      },
    };
  }

  private buildLoansChartOptions(): ChartOptions<'doughnut'> {
    const tokens = this.readTokens();
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: tokens.slate,
            font: { family: 'Figtree, sans-serif', size: 12, weight: 600 },
          },
        },
      },
    };
  }

  private readTokens() {
    const styles = getComputedStyle(document.documentElement);
    const get = (name: string, fallback: string): string =>
      styles.getPropertyValue(name).trim() || fallback;
    return {
      navy: get('--brand-navy', '#0f172a'),
      teal: get('--brand-teal', '#2dd4bf'),
      tealStrong: get('--brand-teal-strong', '#0d9488'),
      slate: get('--brand-slate', '#64748b'),
      border: get('--brand-border', '#e2e8f0'),
      paper: get('--brand-paper', '#ffffff'),
      coral: get('--brand-coral', '#f43f5e'),
      coralStrong: '#e11d48',
      blue: '#3b82f6',
      blueStrong: '#2563eb',
    };
  }

  private toMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private async showMessage(header: string, message: string): Promise<void> {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: [{ text: 'Entendido', role: 'cancel' }],
    });
    await alert.present();
  }

  format(value: Date | string | null | undefined): string {
    return value ? new Date(value).toLocaleDateString('es-ES') : '—';
  }

  /** Establece un rango de fechas terminando hoy y recarga los datos. */
  setRange(days: number): void {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    this.start = this.toIsoDate(start);
    this.end = this.toIsoDate(end);
    this.load();
  }

  onStartChange(event: DatetimeCustomEvent): void {
    this.start = this.toDateOnly(event.detail.value);
    this.load();
  }

  onEndChange(event: DatetimeCustomEvent): void {
    this.end = this.toDateOnly(event.detail.value);
    this.load();
  }

  get reportTitle(): string {
    switch (this.kind) {
      case 'loans':
        return 'Reporte de Préstamos Realizados';
      case 'returns':
        return 'Reporte de Devoluciones Registradas';
      case 'inventory':
        return 'Reporte de Inventario por Categoría';
      case 'topBooks':
        return 'Ranking de Libros Más Prestados';
      case 'topUsers':
        return 'Ranking de Socios Más Activos';
      default:
        return 'Reporte Institucional de Biblioteca';
    }
  }

  exportCsv() {
    if (!this.hasData) return;
    const csv = this.tabularData()
      .map((line) => line.map((value) => this.escape(value)).join(','))
      .join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    link.href = URL.createObjectURL(blob);
    link.download = `reporte-${this.kind}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  exportPdf() {
    if (!this.hasData) return;
    const popup = window.open('', '_blank');

    if (!popup) return;

    const html = this.buildPdfHtml();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    setTimeout(() => {
      popup.print();
    }, 250);
  }

  private buildPdfHtml(): string {
    const today = new Date().toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const rangeInfo =
      this.kind === 'loans' || this.kind === 'returns'
        ? `Rango de fechas: ${this.format(this.start)} al ${this.format(this.end)}`
        : 'Corte de datos: Al día de hoy';

    let tableHtml = '';

    if (this.rows.length) {
      tableHtml = `
        <thead>
          <tr>
            <th style="width: 55px">ID</th>
            <th style="width: 27%">Libro</th>
            <th style="width: 27%">Socio / Usuario</th>
            <th style="width: 12%">Préstamo</th>
            <th style="width: 12%">Vencimiento</th>
            <th style="width: 12%">Devolución</th>
            <th style="width: 10%">Estado</th>
          </tr>
        </thead>
        <tbody>
          ${this.rows
            .map(
              (r) => `
            <tr>
              <td><strong>#${r.loanId}</strong></td>
              <td><strong>${this.safe(r.book)}</strong></td>
              <td>${this.safe(r.user)}</td>
              <td>${this.format(r.loanDate)}</td>
              <td>${this.format(r.dueDate)}</td>
              <td>${this.format(r.returnDate)}</td>
              <td>
                <span class="status-pill ${r.lateReturn ? 'status-pill--late' : 'status-pill--ontime'}">
                  <span class="dot ${r.lateReturn ? 'dot-danger' : 'dot-success'}"></span>
                  ${r.lateReturn ? 'Atrasada' : 'A tiempo'}
                </span>
              </td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      `;
    } else if (this.inventory.length) {
      tableHtml = `
        <thead>
          <tr>
            <th>Categoría</th>
            <th style="text-align:right; width: 20%">Ejemplares Totales</th>
            <th style="text-align:right; width: 20%">Prestados</th>
            <th style="text-align:right; width: 20%">Disponibles</th>
          </tr>
        </thead>
        <tbody>
          ${this.inventory
            .map(
              (i) => `
            <tr>
              <td><strong>${this.safe(i.category)}</strong></td>
              <td style="text-align:right"><strong>${i.total}</strong></td>
              <td style="text-align:right; color:#b91c1c">${i.borrowed}</td>
              <td style="text-align:right; color:#0f766e"><strong>${i.available}</strong></td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      `;
    } else if (this.ranking.length) {
      tableHtml = `
        <thead>
          <tr>
            <th style="width:70px">Posición</th>
            <th>${this.kind === 'topBooks' ? 'Título del Libro' : 'Nombre del Socio'}</th>
            <th style="text-align:right; width: 25%">Total Préstamos</th>
          </tr>
        </thead>
        <tbody>
          ${this.ranking
            .map(
              (rk, index) => `
            <tr>
              <td><strong>#${index + 1}</strong></td>
              <td><strong>${this.safe(rk.label)}</strong></td>
              <td style="text-align:right"><strong>${rk.total}</strong></td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      `;
    }

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Alejandría — ${this.reportTitle}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm 16mm 16mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: 'Figtree', system-ui, -apple-system, sans-serif; color: #0f172a; background: #ffffff; margin: 0; padding: 4px 6px; font-size: 11px; line-height: 1.4; }
    .header-banner {
      background: #0f172a;
      color: #ffffff;
      padding: 16px 20px;
      border-radius: 0;
      border-bottom: 3px solid #0d9488;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
    }
    .brand-title {
      font-family: 'Alegreya', Georgia, serif;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 0.5px;
      margin: 0;
      color: #ffffff;
      text-transform: uppercase;
    }
    .brand-sub {
      font-size: 10px;
      color: #2dd4bf;
      margin-top: 2px;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      font-weight: 700;
    }
    .report-meta {
      text-align: right;
      font-size: 10px;
      color: #94a3b8;
      line-height: 1.4;
    }
    .report-meta strong {
      color: #ffffff;
      display: block;
      font-size: 11px;
      letter-spacing: 0.5px;
    }
    .title-block {
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #cbd5e1;
    }
    .title-block h1 {
      font-family: 'Alegreya', Georgia, serif;
      font-size: 19px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 2px 0;
    }
    .title-block p {
      font-size: 11px;
      color: #64748b;
      margin: 0;
      font-weight: 500;
    }
    .metrics-summary {
      display: flex;
      gap: 10px;
      margin-bottom: 18px;
    }
    .metric-box {
      flex: 1;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 0;
      padding: 8px 12px;
    }
    .metric-box .lbl {
      font-size: 9px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .metric-box .val {
      font-family: 'Alegreya', Georgia, serif;
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 1px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 11px;
      border-radius: 0;
      table-layout: fixed;
    }
    th {
      background: #0f172a;
      color: #ffffff;
      font-weight: 700;
      padding: 8px 10px;
      text-align: left;
      border: 1px solid #0f172a;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-radius: 0;
    }
    td {
      padding: 7px 10px;
      border: 1px solid #e2e8f0;
      color: #334155;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    tr:nth-child(even) td {
      background-color: #f8fafc;
    }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 10px;
      font-weight: 600;
    }
    .status-pill--ontime { color: #0f766e; }
    .status-pill--late { color: #b91c1c; }
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      display: inline-block;
    }
    .dot-success { background: #10b981; }
    .dot-danger { background: #f43f5e; }
    .footer {
      border-top: 1px solid #cbd5e1;
      padding-top: 10px;
      margin-top: 24px;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <div class="header-banner">
    <div>
      <div class="brand-title">ALEJANDRÍA</div>
      <div class="brand-sub">Sistema de Gestión Bibliotecaria</div>
    </div>
    <div class="report-meta">
      <strong>DOCUMENTO OFICIAL DE CONTROL</strong>
      <span>Emitido: ${today}</span>
    </div>
  </div>

  <div class="title-block">
    <h1>${this.reportTitle}</h1>
    <p>${rangeInfo}</p>
  </div>

  <div class="metrics-summary">
    <div class="metric-box">
      <div class="lbl">Catálogo Libros</div>
      <div class="val">${this.dashboard.books}</div>
    </div>
    <div class="metric-box">
      <div class="lbl">Socios Activos</div>
      <div class="val">${this.dashboard.users}</div>
    </div>
    <div class="metric-box">
      <div class="lbl">Préstamos Válidos</div>
      <div class="val">${this.dashboard.active}</div>
    </div>
    <div class="metric-box">
      <div class="lbl">Préstamos Vencidos</div>
      <div class="val" style="color:#b91c1c">${this.dashboard.overdue}</div>
    </div>
  </div>

  <table>
    ${tableHtml}
  </table>

  <div class="footer">
    <span>Alejandría HQ &bull; Reporte Oficial Exportado</span>
    <span>Documento generado para auditoría interna</span>
  </div>
</body>
</html>`;
  }

  private tabularData(): string[][] {
    if (this.rows.length) {
      return [
        ['ID', 'Libro', 'Usuario', 'Préstamo', 'Vencimiento', 'Devolución', 'Extemporánea'],
        ...this.rows.map((row) => [
          String(row.loanId),
          row.book,
          row.user,
          this.format(row.loanDate),
          this.format(row.dueDate),
          this.format(row.returnDate),
          row.lateReturn ? 'Sí' : 'No',
        ]),
      ];
    }

    if (this.inventory.length) {
      return [
        ['Categoría', 'Ejemplares totales', 'Prestados', 'Disponibles'],
        ...this.inventory.map((row) => [
          row.category,
          String(row.total),
          String(row.borrowed),
          String(row.available),
        ]),
      ];
    }

    return [
      ['Nombre', 'Total de préstamos'],
      ...this.ranking.map((row) => [row.label, String(row.total)]),
    ];
  }

  private escape(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
  }

  private safe(value: string): string {
    const element = document.createElement('span');
    element.textContent = value;
    return element.innerHTML;
  }

  private toDateOnly(value: string | string[] | null | undefined): string {
    const text = String(value ?? '').trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? '' : this.toIsoDate(date);
  }

  private toIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
