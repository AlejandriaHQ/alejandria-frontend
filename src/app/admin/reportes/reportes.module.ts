import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { SharedModule } from '../../shared/shared.module';
import { ReportesPageRoutingModule } from './reportes-routing.module';
import { ReportesPage } from './reportes.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BaseChartDirective,
    SharedModule,
    ReportesPageRoutingModule,
  ],
  declarations: [ReportesPage],
})
export class ReportesPageModule {}
