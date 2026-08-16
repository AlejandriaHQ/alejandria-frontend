import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { ReportesPageRoutingModule } from './reportes-routing.module';
import { ReportesPage } from './reportes.page';
@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, SharedModule, ReportesPageRoutingModule],
  declarations: [ReportesPage],
})
export class ReportesPageModule {}
