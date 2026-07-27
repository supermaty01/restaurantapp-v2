import { z } from 'zod';

/**
 * Lo que tiene que cumplir un correo y una contraseña antes de salir a la red.
 *
 * La pantalla de cuenta era la única de la app que no validaba nada: un
 * formulario vacío llegaba hasta Supabase, que contestaba `missing email or
 * phone`, en inglés y sobre un campo que la persona ya veía vacío. Comprobarlo
 * aquí ahorra el viaje además de la traducción.
 *
 * **El mínimo de seis es el de Supabase**, no una regla nuestra: por eso vale
 * igual para entrar que para registrarse. Una cuenta con una contraseña más
 * corta no puede existir, así que exigirlo al iniciar sesión no deja a nadie
 * fuera y avisa antes de gastar un intento.
 */
export const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .nonempty('Escribe tu correo')
    .email('Ese correo no tiene un formato válido'),
  password: z.string().min(6, 'La contraseña tiene que tener al menos 6 caracteres'),
});

export type Credentials = z.infer<typeof credentialsSchema>;
