import { Component, OnInit, inject } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { LoanService } from '../../Services/loan.service';
import { User, UserRole } from '../../models/usuario.model';

type UserForm = {
  name: string;
  cedula: string;
  email: string;
  password: string;
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
      password: '',
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
    if (!this.editingId && this.form.password.length < 6) {
      this.error = 'La contraseña debe tener al menos 6 caracteres.';
      return;
    }
    try {
      if (this.editingId) {
        this.loanService.updateUser(this.editingId, {
          name: this.form.name,
          cedula: this.form.cedula,
          email: this.form.email,
          phone: this.form.phone,
          address: this.form.address,
          role: this.form.role,
        });
      } else {
        this.loanService.createUser(this.form);
      }
      this.cancel();
      this.load();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No fue posible guardar el usuario.';
    }
  }
  async remove(user: User) {
    const hasLoans = this.loanService.getLoansByUser(user.id).length > 0;
    const alert = await this.alerts.create({
      header: 'Desactivar o eliminar',
      message: hasLoans
        ? `${user.name} tiene préstamos asociados y se desactivará (conservando su historial).`
        : `${user.name} no tiene préstamos y se eliminará definitivamente.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Confirmar',
          handler: async () => {
            const result = this.loanService.removeUser(user.id);
            this.cancel();
            this.load();
            if (result === 'deleted') {
              await this.showMessage('Usuario eliminado', 'Usuario eliminado definitivamente.');
            } else if (result === 'deactivated') {
              await this.showMessage(
                'Usuario desactivado',
                'Usuario desactivado; su historial se conserva.',
              );
            }
          },
        },
      ],
    });
    await alert.present();
  }
  async reactivate(user: User) {
    const alert = await this.alerts.create({
      header: 'Activar usuario',
      message: `¿Reactivar a ${user.name}? Podrá iniciar sesión nuevamente.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Activar',
          handler: () => {
            this.loanService.reactivateUser(user.id);
            this.load();
          },
        },
      ],
    });
    await alert.present();
  }
  private async showMessage(header: string, message: string) {
    const alert = await this.alerts.create({
      header,
      message,
      buttons: [{ text: 'Entendido', role: 'cancel' }],
    });
    await alert.present();
  }
  private emptyForm(): UserForm {
    return { name: '', cedula: '', email: '', password: '', phone: '', address: '', role: 'user' };
  }
}
