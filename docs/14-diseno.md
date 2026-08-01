# 14 · Sistema de diseño

Referencia de la capa visual. El código la cita como `docs/14`.

La estructura salió del proyecto de Claude Design **«RestaurantApp Refresh»**, usado solo como referencia: cambió mucho para dar sitio a la mitad social, y el mockup deja sin especificar la mayor parte de las pantallas.

## La idea

Papel y cocina. Fondos cálidos en lugar de blancos y grises, un único acento que marca lo accionable, y una serif con carácter para lo que se mira frente a una sans para lo que se lee.

Un diario gastronómico se compone de fotos de comida, y esas fotos ya traen todo el color que una pantalla puede soportar. La interfaz se aparta: superficies neutras cálidas, un solo acento, y color saturado únicamente donde lo pone el usuario (etiquetas, valoraciones).

### La paleta anterior, y por qué se cambió

La primera versión («Clay») era **terracota `#C0623D` sobre crema `#F7F1E8`** con Newsreader y Plus Jakarta Sans. Es, casi exactamente, la identidad de Claude Code: el mismo coral sobre el mismo papel y un par tipográfico del mismo gusto. Se cambió por eso — una app propia no puede parecer la herramienta con la que se escribió.

Lo nuevo sale entero **del logo**, que es lo único de la app que ya era suyo: el trazo cacao es la tinta, la lechuga es el color de acción, la corteza del pan son las valoraciones, la carne es el rojo destructivo, y el verde pálido del fondo del icono, aclarado hasta ser papel, es el lienzo.

Consecuencias que conviene saber antes de tocar nada:

- **`primary` y `sage` comparten familia de tono.** El logo solo tiene un tono saturado. Lo que los separa es la forma —relleno de botón frente a tinte de pastilla— y la luminosidad, no el matiz.
- **`onPrimary` no es blanco en oscuro.** El primario de modo oscuro tiene que leerse _como texto_ sobre el lienzo, así que es un verde claro, y encima de él el blanco da 3,1:1. Un `#fff` escrito a mano sobre `bg-primary` está mal; se lee de `colors.onPrimary`.
- **`tokens.node.test.ts` mide los contrastes** y no deja que la próxima paleta baje del listón que cumplía la anterior.
- **Los neutros del modo oscuro no llevan tinte.** El primer intento los tiñó hacia el verde del logo, como el lienzo del modo claro, y cada tarjeta salió marrón: en oscuro hay mucha más superficie por la que un tinte se acumula. El color lo pone el acento y nada más.

## Color

La paleta vive **una sola vez** en [`lib/design/tokens.ts`](../apps/mobile/lib/design/tokens.ts) y se expone de dos formas:

- Como **variables CSS** en `global.css`, que es lo que consumen las clases de NativeWind. Por eso `bg-surface` es correcto en claro y en oscuro, y **ningún elemento necesita un gemelo `dark:`**.
- Como **objeto TypeScript**, para las APIs que reciben un color en crudo: iconos, `StatusBar`, el mapa, `ActivityIndicator`.

`tokens.node.test.ts` falla si las dos se desincronizan, porque nada en ejecución lo notaría: la pantalla simplemente saldría a medio tematizar.

| Token                      | Uso                                                  |
| -------------------------- | ---------------------------------------------------- |
| `canvas`                   | Fondo de la aplicación                               |
| `surface` / `surfaceAlt`   | Tarjetas, campos, hojas / barra de pestañas          |
| `sunken`                   | Superficie hundida: pistas, campos deshabilitados    |
| `line` / `lineStrong`      | Filetes y separadores                                |
| `ink` / `Muted` / `Subtle` | Texto primario, secundario, terciario                |
| `primary`                  | El único acento: acciones, enlaces, pestaña activa   |
| `accent`                   | Valoraciones                                         |
| `sage`                     | Categorías, estados positivos                        |
| `danger`                   | Acciones destructivas                                |
| `inverse` / `onInverse`    | El bloque invertido (el contador oscuro sobre claro) |

### Colores que elige el usuario

Las etiquetas llevan un color arbitrario. Se pintan como píldora teñida —el color como texto sobre un lavado de sí mismo— y el texto se ajusta contra la superficie real hasta alcanzar WCAG AA ([`lib/design/colour.ts`](../apps/mobile/lib/design/colour.ts)).

El ajuste camina sobre **luminancia percibida, no sobre luminosidad HSL**. No son lo mismo, y suponerlo fue un bug real: `#FFFF99` bajado al 38 % de luminosidad sigue siendo un `#C2C200` luminoso, 1,9:1 contra blanco.

La dirección depende del tema: oscurecer es lo correcto sobre papel y hace desaparecer la etiqueta sobre una píldora oscura.

## Tipografía

- **Fraunces** (serif) para lo editorial: titulares, cifras, nombres de sitio. Es de contraste alto y formas deliberadamente raras — lo contrario de discreta, que es el punto: esto es un cuaderno de comidas, no un panel de control.
- **Manrope** para todo lo que se lee de corrido. Geométrica pero de aperturas cerradas, así que aguanta los tamaños pequeños de una lista sin competir con la serif.

Ambas son paquetes de solo assets (`@expo-google-fonts/*`), sin código nativo, así que no añaden riesgo en las actualizaciones de Expo — la preocupación central de [docs/11](11-dependencias.md).

La escala vive en `tokens.ts` y se aplica con el componente [`Txt`](../apps/mobile/components/ui/Txt.tsx). Cada tamaño lleva su interlineado y su tracking, porque las dos familias quieren tratamientos opuestos: la serif pide interlineado cerrado en grande, la sans pide aire y tracking negativo en pequeño.

Escribir `text-[15px]` a mano está desaconsejado: así es como una pantalla acaba con cuatro tamaños casi iguales.

## Profundidad y movimiento

El mockup es plano. Se lee limpio pero inerte, así que la implementación añade:

- **Sombras cálidas** (`elevation.low/medium/high`), teñidas con el marrón de la tinta en lugar de negro, para que calienten la superficie de debajo en vez de agrisarla. Android solo respeta `elevation` y la pinta neutra; las dos plataformas quedan cerca pero no idénticas, a propósito.
- **`PressableScale`**: lo pulsable se hunde con un muelle. `active:opacity-80` es la versión barata y se lee como un parpadeo.
- **`FadeInUp`**: entrada escalonada, para que una pantalla llegue en vez de aparecer. Los retardos se topan a los primeros elementos; si no, una lista larga pasa un segundo visible montándose.
- **`Skeleton`**: la silueta de lo que va a haber. Un spinner centrado dice que la app está ocupada; un esqueleto dice qué va a salir, y la pantalla no da un salto al llegar.

## Componentes

Todo en [`components/ui/`](../apps/mobile/components/ui/):

| Componente              | Para qué                                                                          |
| ----------------------- | --------------------------------------------------------------------------------- |
| `Screen`                | Marco de página: lienzo y márgenes. `tabBar` reserva hueco para la barra flotante |
| `Txt`                   | Texto con la escala aplicada                                                      |
| `Card`                  | Superficie elevada; se hunde al pulsarla si es accionable                         |
| `Button` / `IconButton` | Acciones                                                                          |
| `Chip`                  | Píldoras de estado y categoría                                                    |
| `Avatar`                | Foto o iniciales sobre un color derivado del nombre                               |
| `Thumbnail`             | Imagen cuadrada con relleno cálido cuando no hay foto                             |
| `EmptyState`            | Lo que se ve cuando una lista está vacía                                          |
| `ListHeader`            | Cabecera compartida de las tres colecciones                                       |
| `Fab`                   | Botón flotante de acción                                                          |
| `SegmentedTabs`         | Cambio de contenido dentro de una pantalla                                        |
| `Sheet`                 | Hoja inferior, compartida por crear y filtrar                                     |
| `FilterSheet`           | Filtros y orden, con recuento de resultados en vivo                               |
| `DetailScaffold`        | Marco de las pantallas de detalle                                                 |
| `FormScaffold`          | Marco de los formularios, con acción fija                                         |
| `FloatingTabBar`        | Navegación principal                                                              |
| `Skeleton`              | Carga                                                                             |

### Dos decisiones que conviene recordar

**Las miniaturas siempre dibujan algo.** La mayoría de entradas de un diario real no tienen foto. Una columna de cuadros grises vacíos se lee como un fallo de carga, no como «aún sin imagen», así que el hueco se rellena con un degradado cálido derivado del nombre — estable, para que un sitio no cambie de color entre sesiones.

**La barra de pestañas flota.** La barra por defecto es una franja de ancho completo que clava la app al borde inferior y hace que toda lista termine en una banda. Flotando y redondeada, el lienzo corre por debajo. A cambio, las pantallas de pestaña deben reservar hueco (`tabBar` en `Screen`, o `pb-28`), y el FAB sube a `bottom-[104px]`.

## Arquitectura de información

**Inicio · Diario · ➕ · Feed · Perfil.**

### Por qué así

El diagnóstico de la estructura anterior, que tenía «demasiadas secciones»:

- **Etiquetas como destino era el error de fondo.** Una etiqueta es una _dimensión de filtrado_, no una colección que se navega. Por eso su pantalla se sentía inútil: era un CRUD sin contexto. Ha vuelto a ser un filtro; la pantalla que queda sirve para _mantenerlas_ (cuántas cosas etiqueta cada una, cuáles no usas).
- **Visitas, Lugares y Platos son la misma maquinaria** sobre el mismo diario, y se alterna entre ellas constantemente. Estaban repartidas en tres sitios, uno de los cuales ni siquiera era pestaña. Ahora son hermanas dentro de **Diario**, tras un control segmentado: cambiar cuesta un toque en vez de un viaje por la barra.
- **Duplicación sin valor:** Mapa y Visitas se alcanzaban desde dos sitios cada uno.
- **Perfil era un cajón de sastre** con tres trabajos sin relación. Ahora solo cuenta, amigos y ajustes.
- **Crear estaba disperso:** un FAB por lista más accesos rápidos en Inicio, así que «añadir algo» empezaba por decidir dónde estar.

### Las piezas

| Pestaña    | Contiene                                         |
| ---------- | ------------------------------------------------ |
| **Inicio** | Saludo, buscador, contadores y visitas recientes |
| **Diario** | Visitas · Lugares · Platos, con sus filtros      |
| **➕**     | Acción, no destino: abre una hoja para registrar |
| **Feed**   | Actividad de tus amigos                          |
| **Perfil** | Tu cuenta, amigos y ajustes                      |

**El mapa** es un modo de vista de Lugares, que es donde encaja tanto crear un restaurante desde el mapa como buscarlos por zona.

**El buscador de Inicio** busca en todo el diario y es el hueco del asistente (docs/07). La búsqueda en lenguaje natural es el mismo trabajo, no una función aparte: «¿cuántas hamburguesas comí este año?» es una consulta. Hoy lleva un placeholder que dice qué podrá hacer, sin fingir que ya funciona.

### Detalles y formularios

Las pantallas de detalle comparten `DetailScaffold`: foto, título, acciones y cuerpo. Las acciones son botones de icono discretos — v1 usaba círculos rellenos en azul, terracota y rojo, tres botones saturados compitiendo con la foto, y el más llamativo era Eliminar.

Los formularios comparten `FormScaffold`: campos agrupados por lo que respondes («Dónde y cuándo», «Qué comiste», «Con quién») y la acción en un pie fijo. v1 dejaba Guardar al final del scroll.

### Visitas: línea de tiempo

Las visitas abren agrupadas por mes con cabeceras fijadas, al estilo de una galería de fotos. Una lista plana de unos cientos de entradas no da ninguna sensación de _cuándo_; por mes se navega por memoria, que es como se busca una comida.

**Pendiente:** v1 permitía deslizar entre pestañas mediante `material-top-tabs` anclado abajo. SDK 56 prohibió declarar navegadores de react-navigation a mano, así que sigue sin estar.
