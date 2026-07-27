/**
 * Lo que comparten la app y el Worker.
 *
 * El paquete existía en `workspaces`, en el README y en los `paths` de
 * TypeScript, y no tenía ni un fichero dentro: `main` apuntaba a un
 * `src/index.ts` inexistente. Como los scripts de la raíz son `--workspaces`,
 * eso hacía que `npm run lint`, `typecheck`, `test` y por tanto `npm run check`
 * fallaran siempre — y como CI no los ejecutaba, nadie se enteró.
 *
 * Lo que le corresponde es esto: el formato del fichero `.restoshare`, que la
 * app escribe y lee y que el Worker guarda como contenido de un enlace
 * compartido. Un formato que cruza dos procesos es justo lo que no debe estar
 * definido dos veces.
 */
export {
  CURRENT_SHARE_VERSION,
  SHARE_FILE_EXTENSION,
  SHARE_FILE_MIME_TYPE,
  parseShareFile,
  shareEntityTypeSchema,
  shareFileSchema,
  shareableDishSchema,
  shareableImageSchema,
  shareableRestaurantSchema,
  shareableTagSchema,
  shareableVisitSchema,
} from './share-file';

export type {
  ShareEntityType,
  ShareFileData,
  ShareableDish,
  ShareableImage,
  ShareableRestaurant,
  ShareableTag,
  ShareableVisit,
} from './share-file';
