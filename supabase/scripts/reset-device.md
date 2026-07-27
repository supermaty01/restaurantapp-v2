# Empezar de cero en el móvil

El espejo de Postgres y el SQLite del teléfono son **dos copias de lo mismo**.
Vaciar solo una no sirve de nada:

- Si vacías la nube y no el móvil, el siguiente sync la vuelve a llenar desde el
  teléfono, que sigue teniendo su bitácora de cambios.
- Si vacías el móvil y no la nube, el siguiente _pull_ se lo trae todo de vuelta.

Así que van juntos, y en este orden.

## 0. La copia de seguridad

Ajustes → copia de seguridad, y **sácala del teléfono**. Es un ZIP con la base
de datos entera y las fotos; es lo único que te deja volver atrás si te
arrepientes a mitad.

## 1. El móvil

La forma limpia, porque borra la base, las fotos, las preferencias y los
cursores de sync de una vez:

```bash
adb shell pm clear com.supermaty01.restaurantapp
```

Deja la app como recién instalada, sin desinstalarla, así que **no hace falta
volver a pelearse con la firma del APK**.

Si prefieres hacerlo desde el teléfono: Ajustes de Android → Aplicaciones →
RestaurantApp → Almacenamiento → Borrar datos.

> Los cursores de sync (`sync_cursor_*` en `app_settings`) importan más de lo
> que parece. Si sobrevivieran, el móvil creería que ya está al día y no se
> traería nada. `pm clear` se los lleva; borrar filas a mano, no.

## 2. La nube

`reset-account.sql`, en el SQL Editor de Supabase. Ejecuta primero el recuento
y mira los números antes de borrar.

## 3. Las fotos en R2

`pm clear` y el SQL no tocan R2: los objetos siguen ahí, huérfanos. Desde el
panel de Cloudflare → R2 → tu bucket, borra el prefijo `<tu-uuid>/`.

No es urgente —nadie puede llegar a ellos sin la fila que los nombra— pero
ocupan y cuentan para la cuota.

## 4. Volver a entrar

Abre la app, inicia sesión y **no importes nada todavía**: comprueba primero
que ves un diario vacío en los dos lados. Si aparece algo, es que quedó una de
las tres copias sin limpiar, y es mejor saberlo antes de empezar a escribir
encima.
