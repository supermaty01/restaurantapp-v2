-- Una persona etiquetada puede apuntar a una cuenta real.
--
-- Aditivo a proposito: la columna nace nula y "Irene" -- alguien sin cuenta --
-- sigue siendo una fila valida. Etiquetar a quien no usa la app es el caso
-- normal, no la excepcion, asi que vincular una cuenta es informacion extra
-- sobre la persona, no un requisito para que exista.
ALTER TABLE `people` ADD `linked_account_uuid` text;--> statement-breakpoint
ALTER TABLE `people` ADD `username` text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `people_linked_account_idx` ON `people` (`linked_account_uuid`);
