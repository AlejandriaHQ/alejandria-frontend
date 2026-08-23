import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonicModule } from '@ionic/angular';

import { BaseChartDirective } from 'ng2-charts';

import { LandingPageRoutingModule } from './landing-routing.module';

import { LandingPage } from './landing.page';

@NgModule({
  imports: [CommonModule, IonicModule, BaseChartDirective, LandingPageRoutingModule],
  declarations: [LandingPage],
})
export class LandingPageModule {}
