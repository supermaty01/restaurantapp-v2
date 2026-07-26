/**
 * Con quién fue alguien, dicho con nombres.
 *
 * Antes era un conteo: «con 2 personas». Ocupa lo mismo que «con Irene y Moni»
 * y no contesta la pregunta que se hace uno al ver la tarjeta, que no es
 * cuántos eran sino quiénes. El conteo sigue existiendo en el DTO porque es
 * otra pregunta —y la que hay que usar cuando los nombres no caben.
 *
 * Se corta en dos y el resto cuenta: tres nombres seguidos ya se leen como una
 * lista y no como una frase, y la tarjeta está para dar ganas de abrir la
 * comida, no para ser la comida.
 */
export function companionsLabel(names: string[], total: number): string | null {
  const listed = names.filter((name) => name.trim().length > 0);

  // Sin nombres pero con gente: una visita de antes de que las RPC los
  // devolvieran, o alguien cuyo nombre se borró. Mejor el conteo que nada.
  if (listed.length === 0) {
    if (total <= 0) return null;
    return total === 1 ? 'con 1 persona' : `con ${total} personas`;
  }

  if (listed.length === 1) return `con ${listed[0]}`;
  if (listed.length === 2) return `con ${listed[0]} y ${listed[1]}`;
  return `con ${listed[0]}, ${listed[1]} y ${listed.length - 2} más`;
}
