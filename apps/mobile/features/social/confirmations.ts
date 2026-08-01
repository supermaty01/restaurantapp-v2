import type { DialogRequest } from '@/components/ui/Dialog';

/**
 * Las preguntas que hay que hacer antes de deshacer una relación.
 *
 * Aquí y no en cada pantalla porque quitar a alguien de amigos se puede tocar
 * desde dos sitios —la lista de Amigos y el perfil de la persona— y las dos
 * tienen que preguntar lo mismo. Cuando el texto vivía en la pantalla, una de
 * las dos no preguntaba nada: un botón «Quitar» junto a un nombre, sin red.
 *
 * Lo que las hace merecer una confirmación no es que sean irreversibles —volver
 * a añadir a alguien es fácil— sino que **la otra persona se entera**: la
 * amistad desaparece de su lista sin que ella haya hecho nada. Eso no puede
 * pasar por un roce con el dedo.
 */
export function removeFriendDialog(name: string): DialogRequest {
  return {
    title: `¿Quitar a ${name} de tus amigos?`,
    message:
      'Dejaréis de ver lo que compartís solo con amigos. Podéis volver a añadiros cuando queráis.',
    icon: 'person-remove-outline',
    confirmLabel: 'Quitar',
    cancelLabel: 'Cancelar',
    destructive: true,
  };
}

/**
 * Cancelar una solicitud que enviaste tú.
 *
 * Pregunta más suave a propósito, y no es descuido: no deshace nada que la otra
 * persona tuviera, solo retira algo que aún no había contestado. Usar aquí el
 * mismo aviso rojo que arriba enseñaría a descartarlo sin leer, y entonces el de
 * arriba tampoco se leería.
 */
export function cancelRequestDialog(name: string): DialogRequest {
  return {
    title: `¿Cancelar la solicitud a ${name}?`,
    message: 'Dejará de verla. Puedes volver a enviarla más adelante.',
    icon: 'close-circle-outline',
    confirmLabel: 'Cancelar solicitud',
    cancelLabel: 'Volver',
  };
}
