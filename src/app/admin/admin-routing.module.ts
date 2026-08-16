import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AdminPage } from './admin.page';

const routes: Routes = [
  {
    path: '',
    component: AdminPage,
  },
  {
    path: 'catalogo',
    loadChildren: () => import('./catalogo/catalogo.module').then((m) => m.CatalogoPageModule),
  },
  {
    path: 'prestamos',
    loadChildren: () => import('./prestamos/prestamos.module').then((m) => m.PrestamosPageModule),
  },
  { path: 'usuarios', loadChildren: () => import('./usuarios/usuarios.module').then((m) => m.UsuariosPageModule) },
  { path: 'reportes', loadChildren: () => import('./reportes/reportes.module').then((m) => m.ReportesPageModule) },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminPageRoutingModule {}
