import type { DialogRequest } from '@/components/ui/Dialog';

/**
 * Las preguntas de las acciones sociales, escritas una sola vez.
 *
 * Quitar a alguien de amigos y quitarse de una etiqueta se hacen desde más de
 * una pantalla, y las dos son un botón pequeño al lado de otros que no hacen
 * nada parecido: se tocan por error. Ninguna se puede deshacer sola —volver a
 * ser amigos exige que la otra persona acepte, y recuperar el acceso a una
 * visita exige que quien te etiquetó se entere—, así que las dos preguntan.
 *
 * Aquí y no en cada pantalla porque una confirmación que cada sitio redacta a su
 * manera acaba diciendo cosas distintas sobre lo mismo, y porque olvidarla en un
 * sitio es la forma normal de que esto vuelva a pasar.
 */
export function removeFriendDialog(name: string): DialogRequest {
  return {
    title: `¿Quitar a ${name} de tus amigos?`,
    message:
      'Dejaréis de veros lo que compartís solo con amigos. Volver a serlo exige una solicitud nueva y que la acepte.',
    icon: 'person-remove-outline',
    confirmLabel: 'Quitar',
    cancelLabel: 'Cancelar',
    destructive: true,
  };
}

export function cancelRequestDialog(name: string): DialogRequest {
  return {
    title: `¿Cancelar la solicitud a ${name}?`,
    message: 'No se le avisará. Podrás volver a enviarla cuando quieras.',
    icon: 'close-circle-outline',
    confirmLabel: 'Cancelar solicitud',
    cancelLabel: 'Dejarla',
  };
}

export function removeTagDialog(): DialogRequest {
  return {
    title: '¿Quitarte de esta visita?',
    message:
      'Dejará de aparecerte y perderás el acceso a ella. No se borra nada del diario de quien te etiquetó, y podrás pedirle que vuelva a etiquetarte.',
    icon: 'person-remove-outline',
    confirmLabel: 'Quitarme',
    cancelLabel: 'Cancelar',
    destructive: true,
  };
}
