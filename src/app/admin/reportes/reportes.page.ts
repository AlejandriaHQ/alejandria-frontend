import { Component, OnInit, inject } from '@angular/core';
import { ReportRow, ReportService } from '../../Services/report.service';

type ReportKind = 'loans' | 'returns' | 'inventory' | 'topBooks' | 'topUsers';

interface InventoryRow {
  category: string;
  total: number;
  borrowed: number;
  available: number;
}

interface RankingRow {
  label: string;
  total: number;
}

@Component({
  selector: 'app-reportes',
  templateUrl: './reportes.page.html',
  styleUrls: ['./reportes.page.scss'],
  standalone: false,
})
export class ReportesPage implements OnInit {
  start = '';
  end = '';
  kind: ReportKind = 'loans';
  dashboard = { books: 0, users: 0, active: 0, overdue: 0, month: 0 };
  rows: ReportRow[] = [];
  inventory: InventoryRow[] = [];
  ranking: RankingRow[] = [];

  readonly reportSelectOptions = {
    cssClass: 'report-select-alert',
  };

  private readonly reports = inject(ReportService);

  ngOnInit() {
    this.load();
  }

  load() {
    this.dashboard = this.reports.dashboard();
    this.rows = [];
    this.inventory = [];
    this.ranking = [];

    if (this.kind === 'loans') this.rows = this.reports.loansReport(this.start, this.end);
    if (this.kind === 'returns') this.rows = this.reports.returnsReport(this.start, this.end);
    if (this.kind === 'inventory') this.inventory = this.reports.inventory();
    if (this.kind === 'topBooks') this.ranking = this.reports.topBooks();
    if (this.kind === 'topUsers') this.ranking = this.reports.topUsers();
  }

  format(value: Date | string | null | undefined): string {
    return value ? new Date(value).toLocaleDateString('es-ES') : '—';
  }

  exportCsv() {
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
    const popup = window.open('', '_blank');

    if (!popup) return;

    const table = this.tabularData()
      .map(
        (row, index) =>
          `<tr>${row.map((value) => `<${index ? 'td' : 'th'}>${this.safe(value)}</${index ? 'td' : 'th'}>`).join('')}</tr>`,
      )
      .join('');

    popup.document.write(
      `<html><head><title>Reporte</title><style>body{font-family:Arial;padding:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:7px;text-align:left}</style></head><body><h1>Reporte de biblioteca</h1><table>${table}</table></body></html>`,
    );
    popup.document.close();
    popup.focus();
    popup.print();
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
}
