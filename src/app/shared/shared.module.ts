import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { PageHeaderComponent } from './page-header/page-header.component';

@NgModule({
  imports: [CommonModule, IonicModule],
  declarations: [PageHeaderComponent],
  exports: [PageHeaderComponent],
})
export class SharedModule {}
