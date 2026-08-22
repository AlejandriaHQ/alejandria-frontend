import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ChartData, ChartOptions } from 'chart.js';

const LOAN_MONTHS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

const LOANS_RETURNED = [32, 27, 41, 36, 44, 50, 58, 43, 48, 41, 37, 47];

const LOANS_IN_PROGRESS = [14, 12, 17, 16, 23, 24, 31, 19, 23, 19, 17, 21];

interface BrandTokens {
  navy: string;
  teal: string;
  tealStrong: string;
  slate: string;
  border: string;
  paper: string;
}

@Component({
  selector: 'app-landing',
  templateUrl: './landing.page.html',
  styleUrls: ['./landing.page.scss'],
  standalone: false,
})
export class LandingPage implements OnInit, OnDestroy {
  private readonly router = inject(Router);

  readonly peakMonth: string;

  readonly peakTotal: number;

  loanChartData: ChartData<'bar'> = this.buildChartData();

  loanChartOptions: ChartOptions<'bar'> = this.buildChartOptions();

  private readonly themeObserver = new MutationObserver(() => this.refreshChartTheme());

  constructor() {
    const totals = LOANS_RETURNED.map((value, index) => value + LOANS_IN_PROGRESS[index]);
    const peakIndex = totals.indexOf(Math.max(...totals));
    this.peakMonth = LOAN_MONTHS[peakIndex];
    this.peakTotal = totals[peakIndex];
  }

  ngOnInit(): void {
    this.refreshChartTheme();
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  }

  ngOnDestroy(): void {
    this.themeObserver.disconnect();
  }

  goToLogin(): void {
    this.router.navigate(['/autenticacion']);
  }

  scrollToFeatures(): void {
    document.getElementById('caracteristicas')?.scrollIntoView({ behavior: 'smooth' });
  }

  private refreshChartTheme(): void {
    this.loanChartData = this.buildChartData();
    this.loanChartOptions = this.buildChartOptions();
  }

  private buildChartData(): ChartData<'bar'> {
    const tokens = this.readTokens();
    return {
      labels: [...LOAN_MONTHS],
      datasets: [
        {
          label: 'Devueltos',
          data: [...LOANS_RETURNED],
          backgroundColor: tokens.teal,
          hoverBackgroundColor: tokens.tealStrong,
          borderRadius: 4,
          borderSkipped: false,
          maxBarThickness: 22,
        },
        {
          label: 'En curso',
          data: [...LOANS_IN_PROGRESS],
          backgroundColor: tokens.navy,
          hoverBackgroundColor: tokens.slate,
          borderRadius: { topLeft: 6, topRight: 6 },
          borderSkipped: false,
          maxBarThickness: 22,
        },
      ],
    };
  }

  private buildChartOptions(): ChartOptions<'bar'> {
    const tokens = this.readTokens();
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 650 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 7,
            boxHeight: 7,
            padding: 16,
            color: tokens.slate,
            font: { family: 'Inter, sans-serif', size: 12, weight: 600 },
          },
        },
        tooltip: {
          backgroundColor: tokens.navy,
          titleColor: tokens.paper,
          bodyColor: tokens.paper,
          padding: 12,
          cornerRadius: 10,
          displayColors: true,
          boxPadding: 4,
          titleFont: { family: 'Manrope, sans-serif', size: 13, weight: 700 },
          bodyFont: { family: 'Inter, sans-serif', size: 12 },
          callbacks: {
            label: (item) => `${item.dataset.label ?? ''}: ${item.parsed.y} préstamos`,
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: tokens.slate,
            font: { family: 'Inter, sans-serif', size: 11 },
            maxRotation: 0,
          },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: tokens.border, drawTicks: false },
          border: { display: false },
          ticks: {
            color: tokens.slate,
            font: { family: 'Inter, sans-serif', size: 11 },
            stepSize: 20,
            padding: 8,
          },
        },
      },
    };
  }

  private readTokens(): BrandTokens {
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
    };
  }
}