/**
 * Decodifica el payload de un JWT sin verificar la firma.
 *
 * Solo usamos los claims (role, identifier, exp) que el backend inyecta en el
 * access token. La integridad la garantiza el servidor al validar la firma en
 * cada request; aquí solo leemos la info de sesión para la UI.
 *
 * @param token Token JWT (parte payload).
 * @returns Objeto con los claims, o null si el token no es decodificable.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const base64Url = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64Url.padEnd(base64Url.length + ((4 - (base64Url.length % 4)) % 4), '=');
    const decoded = atob(padded);
    const utf8 = decodeURIComponent(
      Array.prototype.map
        .call(decoded, (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(utf8);
  } catch {
    return null;
  }
}
