import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

import { authGuard } from './guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'autenticacion',
    pathMatch: 'full',
  },
  {
    path: 'autenticacion',
    loadChildren: () =>
      import('./autenticacion/autenticacion.module').then((m) => m.AutenticacionPageModule),
  },
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.module').then((m) => m.AdminPageModule),
    canActivate: [authGuard],
  },
  {
    path: 'usuario',
    loadChildren: () => import('./usuario/usuario.module').then((m) => m.UsuarioPageModule),
    canActivate: [authGuard],
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      preloadingStrategy: PreloadAllModules,
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
