-- `default` pasa a ser un valor guardado, no una copia del ajuste del momento.
--
-- Antes, crear una entrada copiaba el ajuste general en la fila. Eso convierte
-- el ajuste en una sugerencia de una sola vez: cambiarlo despues no movia nada
-- de lo ya escrito. Y todo lo importado de la v1 -- que es casi todo el diario
-- -- se quedo clavado en 'private' porque en la v1 ese campo no existia.
--
-- Se migra 'private' a 'default' y se dejan 'friends' y 'public' donde estan.
-- La asimetria es a proposito: 'friends' o 'public' solo pueden estar ahi
-- porque alguien los eligio a mano, mientras que 'private' es lo que le toco a
-- toda fila que nunca tuvo eleccion -- el default general tambien era privado,
-- asi que el resultado visible no cambia. Lo que cambia es que ahora sigue al
-- ajuste en vez de quedarse fijo.
UPDATE `restaurants` SET `visibility` = 'default' WHERE `visibility` = 'private';--> statement-breakpoint
UPDATE `dishes` SET `visibility` = 'default' WHERE `visibility` = 'private';--> statement-breakpoint
UPDATE `visits` SET `visibility` = 'default' WHERE `visibility` = 'private';
