# 16 — Memoria e imágenes

**Estado: diagnosticado, sin arreglar.** Documento de trabajo para la sesión que
lo aborde. Nada de lo de aquí está implementado.

Síntoma observado en dispositivo: la app llega a **1–2 GB** de memoria. No es una
fuga en el sentido clásico —no crece indefinidamente sin tocar nada— sino el
resultado de guardar en memoria imágenes mucho más grandes de lo que se pinta.

---

## 1. El fichero pesa poco; lo que ocupa memoria es otra cosa

`ImagesUploader` pide las fotos con `quality: 0.5` y **nunca las redimensiona**
(verificado: no hay un solo uso de `ImageManipulator` ni de `manipulateAsync` en
todo el repo; el único `resize` que aparece es un `resizeMode` de presentación).

La confusión está en que `quality` es **compresión JPEG**, no tamaño. Una foto de
móvil de 3000×4000:

|                                             |                                   |
| ------------------------------------------- | --------------------------------- |
| Fichero en disco con `quality: 0.5`         | ~1,5 MB                           |
| **La misma imagen decodificada en memoria** | **3000 × 4000 × 4 bytes ≈ 48 MB** |

Los 48 MB no dependen de `quality`: al pintarla hay que descomprimirla a píxeles
en crudo, y ahí la compresión ya no existe. Treinta fotos en una lista son ~1,4
GB, que es exactamente el orden de magnitud que se ve.

Y se pintan en huecos de 64, 150 o 400 píxeles. O sea que el 99% de esos píxeles
se decodifican para no verse nunca.

## 2. Trece cachés sin techo

`grep -rn 'cachePolicy="memory-disk"' --include=*.tsx` → **13 usos**.

`memory-disk` guarda cada imagen mostrada en memoria **y** una segunda copia en
disco, sin límite declarado. Es la política correcta para las fotos remotas del
feed —evita volver a bajarlas— y la equivocada para las locales, que ya están en
disco: para ellas es una copia de una copia.

## 3. Qué hacer, en orden de rentabilidad

1. **Generar una miniatura al guardar.** Es el arreglo de fondo y el que más
   quita: una copia de ~400 px de lado junto al original, y que las listas
   consuman esa. Con `expo-image-manipulator`, en el mismo punto donde hoy se
   copia el fichero a `IMAGES_DIR`. Ojo: hay que generarlas también para las
   fotos que ya existen, así que necesita una pasada de migración perezosa
   (al mostrarse, si no hay miniatura, crearla).
2. **Que las listas no toquen el original.** Es lo que hace que el punto 1 sirva
   de algo. `Thumbnail`, `DishItem`, `RestaurantItem`, la parrilla de Platos y la
   línea de tiempo.
3. **Bajar `cachePolicy` a `disk` en lo local**, dejando `memory-disk` solo para
   lo remoto. Un `expo-image` con la imagen en disco recarga rápido; la copia en
   memoria de algo que ya está en el sistema de ficheros no compra nada.
4. **`recyclingKey` en todas las listas.** Ya está en algunas
   (`FeedCard`, `ImageCarousel`) y falta en otras. Sin él, `expo-image` no
   descarta el bitmap anterior al reciclar la fila y la memoria sube con el
   scroll.

## 4. Cómo medirlo, para no ir a ciegas

Antes de tocar nada, y después:

```bash
adb shell dumpsys meminfo com.supermaty01.restaurantapp | head -20
```

La línea que importa es `TOTAL PSS`. Reproducir siempre igual: abrir Diario →
Platos, desplazar hasta el final de la lista, volver arriba. Es el recorrido que
más bitmaps toca.

Sin esa medida previa, "va más fluido" es una impresión, y este proyecto ya se
gastó una sesión entera en una hipótesis convincente que era falsa (ver el bug
del pie de los paneles en `ESTADO.md`).

## 5. Lo que **no** es el problema

- **No es el visor de imágenes.** Ahí sí quieres el original: es su trabajo.
- **No es `quality`.** Bajarlo a 0,2 reduce el fichero y deja los 48 MB
  decodificados intactos. Es la trampa que hace que este bug parezca arreglado.
- **No son las fotos remotas.** Esas llegan ya del tamaño que subió su dueño, y
  el problema es de decodificado, no de red.
