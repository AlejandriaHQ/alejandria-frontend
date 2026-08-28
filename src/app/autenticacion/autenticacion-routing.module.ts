import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AutenticacionPage } from './autenticacion.page';

// Sin ruta de recuperación: el backend no tiene envío de email ni endpoint
// para ello. El cambio de contraseña se hace desde la gestión de usuarios.
const routes: Routes = [
  {
    path: '',
    component: AutenticacionPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AutenticacionPageRoutingModule {}
