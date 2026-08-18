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
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MIN_LENGTH = 2;
const NAME_PATTERN = /^[\p{L}\s.'-]+$/u;
const CEDULA_PATTERN = /^\d{3}-\d{7}-\d{1}$/;
const PHONE_PATTERN = /^\+?[\d\s-]{7,15}$/;
@Component({
  selector: 'app-usuarios',
  templateUrl: './usuarios.page.html',
  styleUrls: ['./usuarios.page.scss'],
  standalone: false,
})
export class UsuariosPage implements OnInit {
  users: User[] = [];
  filteredUsers: User[] = [];
  query = '';
  editingId: number | null = null;
  error = '';
  fieldErrors: Record<string, string> = {};
  form: UserForm = this.emptyForm();
  showForm = false;
  private readonly loanService = inject(LoanService);
  private readonly alerts = inject(AlertController);
  ngOnInit() {
    this.load();
  }
  load() {
    this.users = this.loanService.getUsers();
    this.applyFilter();
  }
  onSearch() {
    this.applyFilter();
  }
  private applyFilter(): void {
    const q = this.query.trim().toLowerCase();
    if (!q) {
      this.filteredUsers = this.users;
      return;
    }
    this.filteredUsers = this.users.filter(
      (user) =>
        user.name.toLowerCase().includes(q) ||
        (user.cedula ?? '').toLowerCase().includes(q) ||
        user.identifier.toLowerCase().includes(q),
    );
  }
  openNew() {
    this.editingId = null;
    this.error = '';
    this.fieldErrors = {};
    this.form = this.emptyForm();
    this.showForm = true;
  }
  edit(user: User) {
    this.editingId = user.id;
    this.error = '';
    this.fieldErrors = {};
    this.form = {
      name: user.name,
      cedula: user.cedula ?? '',
      email: user.email,
      password: '',
      phone: user.phone,
      address: user.address ?? '',
      role: user.role,
    };
    this.showForm = true;
  }
  cancel() {
    this.editingId = null;
    this.error = '';
    this.fieldErrors = {};
    this.form = this.emptyForm();
  }
  closeForm() {
    this.showForm = false;
    this.editingId = null;
    this.error = '';
    this.fieldErrors = {};
    this.form = this.emptyForm();
  }
  async save() {
    this.fieldErrors = {};
    const name = this.form.name.trim();
    const cedula = this.form.cedula.trim();
    const email = this.form.email.trim();
    const phone = this.form.phone.trim();
    const address = this.form.address.trim();

    if (name.length < NAME_MIN_LENGTH) {
      this.fieldErrors['name'] = 'El nombre completo es obligatorio.';
    } else if (!NAME_PATTERN.test(name)) {
      this.fieldErrors['name'] = 'El nombre solo puede contener letras, espacios, puntos y apóstrofes.';
    }
    if (!cedula) {
      this.fieldErrors['cedula'] = 'La cédula es obligatoria.';
    } else if (!CEDULA_PATTERN.test(cedula)) {
      this.fieldErrors['cedula'] = 'La cédula debe tener el formato 000-0000000-0.';
    }
    if (!email) {
      this.fieldErrors['email'] = 'El correo es obligatorio.';
    } else if (!EMAIL_PATTERN.test(email)) {
      this.fieldErrors['email'] = 'El correo no es válido.';
    }
    if (!this.editingId && this.form.password.length < 6) {
      this.fieldErrors['password'] = 'La contraseña debe tener al menos 6 caracteres.';
    }
    if (!phone) {
      this.fieldErrors['phone'] = 'El teléfono es obligatorio.';
    } else if (!PHONE_PATTERN.test(phone)) {
      this.fieldErrors['phone'] = 'El teléfono no es válido (ejemplo: 809-000-0000).';
    }
    if (!address) {
      this.fieldErrors['address'] = 'La dirección es obligatoria.';
    }
    if (Object.keys(this.fieldErrors).length > 0) {
      this.error = '';
      return;
    }

    try {
      const wasEditing = this.editingId !== null;
      const payload = {
        name,
        cedula,
        email,
        phone,
        address,
        role: this.form.role,
      };
      if (this.editingId) {
        this.loanService.updateUser(this.editingId, payload);
      } else {
        this.loanService.createUser({ ...payload, password: this.form.password });
      }
      this.closeForm();
      this.load();
      await this.showMessage(
        wasEditing ? 'Cambios guardados' : 'Usuario registrado',
        wasEditing
          ? 'Los datos del usuario fueron actualizados.'
          : 'El usuario fue registrado correctamente.',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible guardar el usuario.';
      // Mapea el error de unicidad del servicio al campo correspondiente
      if (message.includes('cédula')) {
        this.fieldErrors['cedula'] = message;
      } else if (message.includes('correo')) {
        this.fieldErrors['email'] = message;
      } else {
        this.error = message;
      }
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
