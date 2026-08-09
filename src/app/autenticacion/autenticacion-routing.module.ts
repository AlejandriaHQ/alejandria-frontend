import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AutenticacionPage } from './autenticacion.page';

const routes: Routes = [
  {
    path: '',
    component: AutenticacionPage
  },
  {
    path: 'recuperar-contrasena',
    loadChildren: () =>
      import('./recuperar-contrasena/recuperar-contrasena.module')
        .then(m => m.RecuperarContrasenaPageModule)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AutenticacionPageRoutingModule {}