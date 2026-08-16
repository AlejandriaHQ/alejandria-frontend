import { Component, OnInit, inject } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { LoanService } from '../../Services/loan.service';
import { User, UserRole } from '../../models/usuario.model';

type UserForm = {
  name: string;
  cedula: string;
  email: string;
  phone: string;
  address: string;
  role: UserRole;
};
@Component({
  selector: 'app-usuarios',
  templateUrl: './usuarios.page.html',
  styleUrls: ['./usuarios.page.scss'],
  standalone: false,
})
export class UsuariosPage implements OnInit {
  users: User[] = [];
  editingId: number | null = null;
  error = '';
  form: UserForm = this.emptyForm();
  private readonly loanService = inject(LoanService);
  private readonly alerts = inject(AlertController);
  ngOnInit() {
    this.load();
  }
  load() {
    this.users = this.loanService.getUsers();
  }
  edit(user: User) {
    this.editingId = user.id;
    this.error = '';
    this.form = {
      name: user.name,
      cedula: user.cedula ?? '',
      email: user.email,
      phone: user.phone,
      address: user.address ?? '',
      role: user.role,
    };
  }
  cancel() {
    this.editingId = null;
    this.error = '';
    this.form = this.emptyForm();
  }
  save() {
    if (!this.form.name || !this.form.cedula || !this.form.email) {
      this.error = 'Nombre, cédula y correo son obligatorios.';
      return;
    }
    try {
      if (this.editingId) this.loanService.updateUser(this.editingId, this.form);
      else this.loanService.createUser(this.form);
      this.cancel();
      this.load();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No fue posible guardar el usuario.';
    }
  }
  async remove(user: User) {
    const alert = await this.alerts.create({
      header: 'Desactivar o eliminar',
      message: `¿Procesar a ${user.name}? Si tiene préstamos se desactivará para conservar el historial.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Confirmar',
          handler: () => {
            this.loanService.removeUser(user.id);
            this.cancel();
            this.load();
          },
        },
      ],
    });
    await alert.present();
  }
  private emptyForm(): UserForm {
    return { name: '', cedula: '', email: '', phone: '', address: '', role: 'user' };
  }
}
