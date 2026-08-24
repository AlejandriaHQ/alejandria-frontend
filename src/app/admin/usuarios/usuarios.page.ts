import { Component, OnInit, inject } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { UserService } from '../../Services/user.service';
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
const MENSAJE_GENERICO = 'No se pudo completar la operación. Revise los datos enviados.';
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
  loading = false;
  /** Página actual de la lista de usuarios (paginación del backend). */
  currentPage = 1;
  /** Total de páginas disponibles según el backend. */
  maxPages = 1;
  hasPrevious = false;
  hasNext = false;
  editingId: number | null = null;
  error = '';
  fieldErrors: Record<string, string> = {};
  form: UserForm = this.emptyForm();
  showForm = false;
  private readonly userService = inject(UserService);
  private readonly alerts = inject(AlertController);
  ngOnInit() {
    this.load();
  }

  /**
   * Carga la lista de usuarios con la paginación del backend.
   *
   * Se usa `searchUsers` (en vez de `getUsers`) para conservar los metadatos de
   * paginación. La búsqueda se delega al servidor con el filtro actual; al pedir
   * una página fuera de rango (p. ej. tras borrar el último de una página) se
   * regresa a la última página válida.
   */
  load(page: number = 1) {
    this.loading = true;
    this.userService.searchUsers(this.query, page).subscribe({
      next: (result) => {
        // Si la página pedida queda vacía por haber eliminado registros de una
        // página avanzada, salta a la última página válida.
        if (result.users.length === 0 && result.currentPage > 1 && result.maxPages > 0) {
          this.load(result.maxPages);
          return;
        }
        this.users = result.users;
        this.filteredUsers = result.users;
        this.currentPage = result.currentPage;
        this.maxPages = result.maxPages;
        this.hasPrevious = result.previous;
        this.hasNext = result.next;
        this.error = '';
        this.loading = false;
      },
      error: (error: unknown) => {
        this.loading = false;
        this.error = this.toMessage(error);
      },
    });
  }

  /** Al escribir en el buscador se reinicia la búsqueda a la página 1. */
  onSearch() {
    this.load(1);
  }

  /** Navega a una página concreta si está dentro del rango. */
  goToPage(page: number) {
    if (page < 1 || page > this.maxPages) {
      return;
    }
    this.load(page);
  }

  nextPage() {
    this.goToPage(this.currentPage + 1);
  }

  previousPage() {
    this.goToPage(this.currentPage - 1);
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
      this.fieldErrors['name'] =
        'El nombre solo puede contener letras, espacios, puntos y apóstrofes.';
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
    // Al crear la contraseña es obligatoria; al editar es opcional (vacía = conservar
    // la actual) pero, si se escribe una nueva, debe cumplir el mínimo.
    if (this.form.password && this.form.password.length < 6) {
      this.fieldErrors['password'] = 'La contraseña debe tener al menos 6 caracteres.';
    } else if (!this.editingId && !this.form.password) {
      this.fieldErrors['password'] = 'La contraseña es obligatoria.';
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

    const wasEditing = this.editingId !== null;
    const baseData = { name, cedula, email, phone, address, role: this.form.role };

    const request$ = this.editingId
      ? this.userService.updateUser(this.editingId, {
          ...baseData,
          // Al editar solo se envía password si el admin escribió una nueva;
          // si quedó vacía el backend conserva la contraseña existente.
          ...(this.form.password ? { password: this.form.password } : {}),
        })
      : this.userService.createUser({ ...baseData, password: this.form.password });

    request$.subscribe({
      next: () => {
        this.closeForm();
        this.load(this.currentPage);
        this.showMessage(
          wasEditing ? 'Cambios guardados' : 'Usuario registrado',
          wasEditing
            ? 'Los datos del usuario fueron actualizados.'
            : 'El usuario fue registrado correctamente.',
        );
      },
      error: (error: unknown) => this.handleSaveError(error),
    });
  }
  async remove(user: User) {
    const alert = await this.alerts.create({
      header: 'Eliminar usuario',
      message: `¿Eliminar definitivamente a ${user.name}? Si tiene préstamos asociados, no será posible y se mostrará un aviso.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          handler: () => {
            this.userService.deleteUser(user.id).subscribe({
              next: () => {
                this.cancel();
                this.load(this.currentPage);
                this.showMessage('Usuario eliminado', 'Usuario eliminado definitivamente.');
              },
              error: (error: unknown) => {
                const message = this.toMessage(error);
                if (message.includes('prestamos')) {
                  this.showMessage(
                    'No se puede eliminar',
                    `${user.name} tiene préstamos asociados. No es posible eliminarlo.`,
                  );
                } else {
                  this.showMessage('No se pudo eliminar', message);
                }
              },
            });
          },
        },
      ],
    });
    await alert.present();
  }
  async reactivate(_user: User) {
    const alert = await this.alerts.create({
      header: 'Activar usuario',
      message:
        'La reactivación de usuarios requiere soporte del backend (aún no hay un endpoint para alternar la baja de un usuario).',
      buttons: [{ text: 'Entendido', role: 'cancel' }],
    });
    await alert.present();
  }
  private handleSaveError(error: unknown): void {
    const message = this.toMessage(error);
    // Mensaje genérico del backend (anti-enumeración) para email/cédula en uso.
    if (message.includes('No se pudo completar la operación')) {
      if (message.includes('cedula')) {
        this.fieldErrors['cedula'] = MENSAJE_GENERICO;
      } else if (message.includes('email') || message.includes('correo')) {
        this.fieldErrors['email'] = MENSAJE_GENERICO;
      } else {
        this.error = MENSAJE_GENERICO;
      }
      return;
    }
    // Errores específicos del serializer (formato de cédula, contraseña corta, ...).
    if (message.includes('cédula') || message.includes('cedula')) {
      this.fieldErrors['cedula'] = this.stripFieldPrefix(message);
    } else if (message.includes('contraseña') || message.includes('password')) {
      this.fieldErrors['password'] = this.stripFieldPrefix(message);
    } else if (message.includes('correo') || message.includes('email')) {
      this.fieldErrors['email'] = this.stripFieldPrefix(message);
    } else {
      this.error = message;
    }
  }
  private stripFieldPrefix(message: string): string {
    // El backend puede devolver "campo: mensaje"; se quita el prefijo "campo: ".
    const index = message.indexOf(': ');
    return index > -1 && index < 40 ? message.slice(index + 2) : message;
  }
  private toMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Ocurrió un error inesperado';
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
