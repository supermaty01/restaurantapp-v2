# 14 · Sistema de diseño «Clay»

Referencia de la capa visual. El código la cita como `docs/14`.

El punto de partida fue el proyecto de Claude Design **«RestaurantApp Refresh»**, pero solo como referencia de estilo: la estructura cambió mucho para dar sitio a la mitad social, y el mockup deja sin especificar la mayor parte de las pantallas. Todo lo que no estaba definido se ha decidido aquí.

## La idea

Papel y arcilla. Fondos cálidos en lugar de blancos y grises, un único acento (terracota) que marca lo accionable, y una serif editorial para lo que se mira frente a una sans para lo que se lee.

Un diario gastronómico se compone de fotos de comida, y esas fotos ya traen todo el color que una pantalla puede soportar. La interfaz se aparta: superficies neutras cálidas, un solo acento, y color saturado únicamente donde lo pone el usuario (etiquetas, valoraciones).

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

- **Newsreader** (serif) para lo editorial: titulares, cifras, nombres de sitio.
- **Plus Jakarta Sans** para todo lo que se lee de corrido.

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
| `FloatingTabBar`        | Navegación principal                                                              |
| `Skeleton`              | Carga                                                                             |

### Dos decisiones que conviene recordar

**Las miniaturas siempre dibujan algo.** La mayoría de entradas de un diario real no tienen foto. Una columna de cuadros grises vacíos se lee como un fallo de carga, no como «aún sin imagen», así que el hueco se rellena con un degradado cálido derivado del nombre — estable, para que un sitio no cambie de color entre sesiones.

**La barra de pestañas flota.** La barra por defecto es una franja de ancho completo que clava la app al borde inferior y hace que toda lista termine en una banda. Flotando y redondeada, el lienzo corre por debajo. A cambio, las pantallas de pestaña deben reservar hueco (`tabBar` en `Screen`, o `pb-28`), y el FAB sube a `bottom-[104px]`.

## Arquitectura de información

Cinco pestañas: **Inicio · Feed · Lugares · Platos · Perfil**.

v1 tenía cuatro listas al mismo nivel —Restaurantes, Platos, Visitas, Etiquetas— lo que daba el mismo peso a una dimensión de navegación (etiquetas) que a las colecciones, y no dejaba sitio para la mitad social. Visitas y Etiquetas son ahora pantallas completas a un toque, desde Inicio y Perfil.

**Pendiente:** v1 permitía deslizar entre pestañas mediante `material-top-tabs` anclado abajo. SDK 56 prohibió declarar navegadores de react-navigation a mano, así que sigue sin estar.
