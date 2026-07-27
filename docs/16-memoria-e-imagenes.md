# 16 — Memoria e imágenes

**Estado: la parte de disco, arreglada. La de RAM, medida y abierta.**

> **Este documento se reescribió entero.** La versión anterior daba por hecho que
> el «1–2 GB» que se veía en el móvil era memoria RAM, y desde ahí construía un
> plan de cuatro puntos encabezado por generar miniaturas de cada foto. Eran
> **dos problemas distintos**, y el más gordo —el que explicaba la cifra— no era
> RAM ni tenía nada que ver con el tamaño de las imágenes.
>
> Lo que deshizo el error fue un dato del autor: _«en R2 y en el zip de copia,
> las imágenes pesan 2 MB como mucho; la app son &lt;200 MB y el contenido otros
> 200»_. Si los ficheros son pequeños y el total es desproporcionado, lo que
> sobra no son fotos grandes: son **copias**.

---

## 1. El disco: copias del diario que nadie borraba

Arreglado. Esto es lo que explicaba el giga o dos.

### 1.1 Los zips de exportación

Cada exportación escribía `restaurantapp_backup_<marca de tiempo>.zip` en el
directorio de documentos. Como el nombre llevaba la hora, **nunca sobrescribía**:
cada copia era un fichero nuevo. Y nada en todo el repo lo borraba — los doce
`deleteAsync` que había apuntaban a temporales, a la base de datos o a
`IMAGES_DIR`, nunca al zip.

Peor: `saveExportInfo` guarda solo `lastExport`, una fila que se sobrescribe. La
app **olvidaba dónde había dejado las anteriores** mientras los ficheros seguían
ahí. Eran basura inalcanzable: el código no sabía que existían y quien usa la app
no las ve sin un explorador de archivos.

**Un zip pesa casi lo que la carpeta de imágenes entera**, y ahí está la trampa
aritmética: un zip no comprime JPEG, porque un JPEG ya viene comprimido. Con 212
MB de fotos, cada exportación son ~200 MB.

O sea que **de 1 a 2 GB son entre cinco y diez exportaciones** — exactamente lo
que hace quien está desarrollando la app y le da a «exportar» unas cuantas veces
para comprobar que funciona.

### 1.2 La copia previa a «la nube manda»

`sync-choice.tsx` hace una copia antes de dejar que la nube pise el diario local,
y hace bien: es la única pantalla capaz de borrar un diario entero. Pero esa
copia **nunca se comparte** —solo se anuncia el nombre en un aviso— así que nacía
directamente huérfana, con el mismo nombre que las de Ajustes y el mismo destino:
quedarse para siempre.

### 1.3 La copia previa a importar

`importData` copia la base de datos y **todas** las imágenes a
`cache/backup_before_import/` antes de tocar nada. Eso sí es caché de verdad, y
sí es un diario entero.

Se borraba solo al empezar la _siguiente_ importación. Y como la migración de la
v1 es una importación, en la práctica se quedaba desde el primer día.

Había un intento de limpiarla: un `setTimeout` de veinticuatro horas al final de
`restoreBackup`. **No se ejecutó nunca.** El temporizador muere con el proceso de
la app, y ninguna app de móvil vive un día seguido. El efecto neto era peor que
no tener nada, porque el código parecía cubrir el caso.

### 1.4 Qué se cambió

- **Dos nombres, dos vidas.** `restaurantapp_backup_` para lo que se exporta y
  `restaurantapp_safety_` para la red de seguridad. Compartir nombre hacía
  imposible barrer uno sin llevarse el otro, que es parte de por qué no se barría
  ninguno.
- **La exportación de Ajustes va a la caché.** Su destino es salir de la app —a
  Drive, a WhatsApp, a donde sea—; quedarse con ella dentro es guardar el diario
  dos veces. En la caché, además, el sistema puede reclamarla cuando aprieta.
- **La de `sync-choice` va a documentos**, con `{ keep: true }`. Esa tiene que
  seguir estando mañana.
- **Se barre antes de escribir la nueva**, no después: si no, hay un momento con
  dos diarios en disco, que en un móvil lleno es la diferencia entre exportar y
  no poder. El barrido mira los **dos** directorios, porque lo que hay que
  recuperar en un móvil que ya lleva meses está en documentos.
- **La copia previa a importar se borra al terminar bien**, y se olvida su fila
  de `lastBackup`. Quien la restaura es el `catch` de esa misma importación
  (`settings/index.tsx`), no un «deshacer» que se ofrezca después: si la
  importación llegó al final, ya no hay a qué volver.
- **Fuera el `setTimeout` de 24 horas**, sustituido por un borrado inmediato tras
  restaurar.

Barrer los zips viejos es seguro, y conviene saber por qué: **ningún camino del
código lee nunca la ruta de un zip** salvo el `shareBackup` inmediato que va
detrás de crearlo, y la pantalla de Ajustes enseña solo la **fecha** de la última
copia, nunca su fichero.

El efecto en una instalación que ya arrastra el problema es que la primera
exportación después de actualizar recupera todo lo acumulado.

Lo sujeta `services/backup/prune.node.test.ts`. La decisión —qué se borra y qué
no— vive en `services/backup/prune.ts`, aparte del servicio y sin nada de Expo
dentro, por el mismo motivo que `push/payload.ts` está aparte de `push.ts`: el
proyecto de tests de Node no tiene un entorno de Expo que resuelva
`expo-file-system`.

---

## 2. La RAM: 1 GB medido, sin arreglar

Esto sigue abierto, y es un problema distinto del anterior.

Medido en el emulador con la app abierta:

```
TOTAL PSS     1.023.077 KB   ≈ 1,0 GB
Native Heap     499.875 KB    (Heap Alloc 814.930 KB)
SwapPss         377.333 KB    ← ya está tirando de swap
```

En React Native los bitmaps decodificados viven en el _native heap_, y ahí está
medio giga. Así que la sospecha apunta a las imágenes, sí — pero **no se ha
demostrado**, y conviene no repetir el error de este documento.

### 2.1 La aritmética de los 48 MB, con una advertencia

El razonamiento de la versión anterior era: `quality: 0.5` es compresión JPEG y
no tamaño, así que una foto de 3000×4000 ocupa 3000 × 4000 × 4 ≈ **48 MB** al
decodificarse, se pinte donde se pinte.

Esa cuenta **solo vale si nadie submuestrea**. Y en Android `expo-image` usa
Glide, que por defecto decodifica al tamaño de la vista. Si eso está pasando, una
foto en un hueco de 64 px no cuesta 48 MB, y generar miniaturas —que es el
arreglo caro: dependencia nueva, migración perezosa para las fotos que ya
existen y tocar cinco componentes— resolvería mucho menos de lo que promete.

**Hay que medirlo antes de construirlo.** Este proyecto ya se gastó una sesión en
una hipótesis convincente que era falsa (el bug del pie de los paneles), y este
documento ya se equivocó una vez por dar por hecho de dónde venía una cifra.

### 2.2 Qué probar, en orden de coste

Del más barato al más caro, midiendo entre uno y otro:

1. **`recyclingKey` donde falta.** Está en siete ficheros y falta en tres listas
   que sí guardan en memoria: `RestaurantDishes`, `RestaurantVisits` y
   `VisitDishes`. Sin él, `expo-image` no suelta el bitmap anterior al reciclar
   la fila. Es un atributo por lista.
2. **`cachePolicy` a `disk` en lo local.** Hay trece usos de `memory-disk`. Para
   una foto remota está bien —evita volver a bajarla—; para una local es una
   copia en memoria de algo que ya está en el sistema de ficheros.
3. **Miniaturas al guardar**, solo si 1 y 2 no bastan. Una copia de ~400 px junto
   al original, con `expo-image-manipulator`, en el mismo punto donde hoy se
   copia el fichero a `IMAGES_DIR`. Necesita una pasada perezosa para las fotos
   que ya existen: al mostrarse, si no hay miniatura, crearla.
4. **Que las listas consuman la miniatura**, que es lo que hace que el 3 sirva de
   algo: `Thumbnail`, `DishItem`, `RestaurantItem`, la parrilla de Platos y la
   línea de tiempo.

---

## 3. Cómo medir, para no ir a ciegas

### Disco

En el móvil: **Ajustes → Aplicaciones → RestaurantApp → Almacenamiento**, y mirar
el reparto. «Datos de usuario» gordo apunta a los zips; «Caché» gordo, a
`backup_before_import` y a Glide. Vaciar la caché y ver cuánto baja: lo que no
baje son los zips.

Con la app conectada, el desglose exacto (no hace falta root):

```bash
adb shell "run-as com.supermaty01.restaurantapp sh -c 'du -sm ./*'"
adb shell "run-as com.supermaty01.restaurantapp sh -c 'du -sm ./files/* ./cache/*'"
```

Referencia del emulador tras el arreglo: `files/images` 212 MB —que es el
contenido de verdad— y `cache/image_manager_disk_cache` 53 MB, que es la caché de
Glide. Ningún zip.

> Ojo con el glob: `adb shell 'du ./*'` lo expande el shell del dispositivo
> contra `/` **antes** de que `run-as` entre en la carpeta de la app. Hay que
> pasarlo dentro de `sh -c`, como arriba.

### RAM

```bash
adb shell dumpsys meminfo com.supermaty01.restaurantapp | head -20
```

La línea que importa es `TOTAL PSS`. Reproducir siempre igual: abrir Diario →
Platos, desplazar hasta el final de la lista, volver arriba. Es el recorrido que
más bitmaps toca.

Y comparar contra una build igual de nueva: medir un APK viejo antes y uno
recién hecho después mezcla el cambio con todo lo demás que haya entrado.

---

## 4. Lo que **no** es el problema

- **No era el tamaño de las imágenes.** 2 MB por fichero está bien. Lo que
  sobraba eran copias del conjunto entero.
- **No es `quality`.** Bajarlo a 0,2 reduce el fichero y deja intacto lo que se
  decodifica. Es la trampa que hace que esto parezca arreglado.
- **No es el visor de imágenes.** Ahí sí quieres el original: es su trabajo.
- **No son las fotos remotas.** Llegan del tamaño que subió su dueño, y
  `remoteImageUri` construye una URL **estable** —sin firma ni marca de tiempo—
  así que cada foto ocupa una entrada de caché y no una por visita. Esto se
  comprobó: era el sospechoso obvio de una caché que crece sin parar, y está
  descartado.
