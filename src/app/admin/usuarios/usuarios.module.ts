import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { UsuariosPageRoutingModule } from './usuarios-routing.module';
import { UsuariosPage } from './usuarios.page';
@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, SharedModule, UsuariosPageRoutingModule],
  declarations: [UsuariosPage],
})
export class UsuariosPageModule {}
