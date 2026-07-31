-- La moneda pasa a vivir en el plato.
--
-- Hasta aqui el precio era un numero sin unidad y la app lo pintaba siempre en
-- pesos colombianos, que era la unica moneda escrita en el codigo. Un diario de
-- comidas viaja: el mismo cuaderno tiene un menu del dia en Madrid y un
-- corrientazo en Bogota, y con una sola moneda global la mitad de los precios
-- estaban mal etiquetados.
--
-- ── El relleno de lo que ya hay ──────────────────────────────────────────────
-- La app solo se ha usado en Colombia y en Europa, y las dos escalas no se
-- solapan: un plato de menos de 1000 no existe en pesos -- el cafe mas barato
-- pasa de 2000 -- y uno de mas de 1000 no existe en euros. Asi que el propio
-- numero dice de donde viene, y esa es toda la informacion que hay. Es una
-- suposicion, y por eso se deja escrita aqui: cualquier fila que quede mal
-- etiquetada se corrige a mano, plato a plato, que es como se corrige un dato
-- que solo su autor conoce.
--
-- El limite exacto (1000) va a pesos: en euros es un plato que no existe, en
-- pesos es una propina.
ALTER TABLE `dishes` ADD `currency` text;--> statement-breakpoint
UPDATE `dishes` SET `currency` = CASE WHEN `price` < 1000 THEN 'EUR' ELSE 'COP' END WHERE `price` IS NOT NULL;--> statement-breakpoint
-- Precio y moneda van juntos o no van. Una moneda sin precio es una etiqueta
-- sobre nada, y un precio sin moneda es un numero que no significa nada.
UPDATE `dishes` SET `currency` = NULL WHERE `price` IS NULL;
