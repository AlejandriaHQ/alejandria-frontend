# Sistema de diseño de Alejandría

Guía rápida de cómo se ve y cómo se construye la interfaz. Léela antes de crear pantallas nuevas, sobre todo si vas a agregar colores o componentes.

## Colores

La paleta de Alejandría sale del logo (el faro sobre el libro). Los tonos que se usan:

| Uso | Color |
|---|---|
| Fondo de la app | `#F1F5F9` |
| Tarjetas y superficies | blanco `#FFFFFF` |
| Texto y headers | navy `#0F172A` |
| Acciones / "Disponible" | teal `#2DD4BF` |
| Texto secundario y bordes | slate `#64748B` / `#E2E8F0` |
| Errores | `#BA1A1A` |

Toda la paleta está definida en `src/theme/variables.scss` como variables (`--brand-*`) y también mapeada a los colores de Ionic. No pongas hex sueltos en los componentes, usa esas variables. Para íconos o texto sobre blanco el teal se oscurece a `#0D9488`.

Cosas que ya quedan aplicadas y conviene respetar:

- Botones principales (agregar, guardar, iniciar sesión): navy sólido, forma pill.
- Badges: "Disponible" en teal, "Prestado" en slate.
- Las tarjetas no usan sombra pesada, usan borde fino. El fondo `#F1F5F9` da el contraste necesario.

## Tipografía

- Manrope para títulos y headers de página.
- Inter para el cuerpo.
- JetBrains Mono para ISBN, códigos y etiquetas técnicas. Hay una clase `.text-mono` en `global.scss` para eso.

Las fuentes se cargan en `index.html`.

## Layout

El contenido va centrado en un contenedor de máx. 1440px. En móvil se usa una sola columna con márgenes de 16px; en desktop hay más aire (32px). El espaciado se maneja en pasos de 4px.

## Header de las páginas

No escribas un header a mano. Usa el componente `app-page-header` (está en `src/app/shared/page-header`). Le pasas el título y, si la pantalla no es raíz, la ruta para el botón atrás:

```html
<app-page-header titulo="Catálogo" rutaAtras="/admin"></app-page-header>
```

El slot `end` sirve para acciones (por ejemplo, el botón de cerrar sesión).

## Modales

Los formularios y los detalles van en `ion-modal`, no inline. El catálogo ya lo hace así (nuevo/editar libro y detalle). Sombra suave y borde fino.

## Checklist rápida

- Colores con variables, no hex.
- Header con `app-page-header`.
- CTAs navy pill, badges con los colores de arriba.
- `npm run format` antes de commitear.
