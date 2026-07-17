# 00 — Visión y principios

## Qué es

Un diario gastronómico personal: registrar restaurantes, platos y visitas con fotos, valoraciones, etiquetas y mapa. La v2 añade una capa social opcional (amigos, perfiles, feed), sincronización multi-dispositivo y un asistente con IA para consultar y registrar en lenguaje natural.

## Qué NO es

- No es una red social pública tipo TripAdvisor/Google Reviews. El grafo es de amigos, el contenido por defecto es privado.
- No es una app que requiera cuenta. El modo anónimo/local es un ciudadano de primera clase para siempre.
- No es un proyecto con presupuesto: todo servicio externo debe tener plan gratuito suficiente para uso personal + círculo de amigos.

## Principios innegociables

1. **Local-first.** SQLite en el dispositivo es la fuente de verdad para el usuario. Toda pantalla lee de local. La red nunca bloquea la UI.
2. **La nube es opcional y aditiva.** Sin cuenta: la app funciona exactamente como la v1. Con cuenta: se añade sync, social, share por link y asistente IA. Cerrar sesión no borra datos locales.
3. **Cero pérdida de datos.** Toda migración de esquema hace backup automático previo. El importador de backups acepta todos los formatos históricos (v1 incluida). El usuario siempre puede exportar todo a un archivo.
4. **Privacidad por defecto.** Todo contenido nace `privado`. Compartir (con amigos o por link) es una acción explícita por entidad. A la IA solo se envía el mínimo contexto necesario y con consentimiento.
5. **Mantenible por una persona.** Pocas piezas, bien delimitadas. Se prefiere código simple propio sobre dependencias pesadas cuando el problema es pequeño (ej.: sync hecho a mano en vez de un servicio de sync). Tests en las rutas críticas (migraciones, sync, import/export).
6. **Gratis.** Supabase free tier, Cloudflare Workers/R2 free tier, EAS free tier. Si un feature amenaza con salirse del free tier (ej. IA), se limita con cuotas antes que pagar.

## Usuarios objetivo

- **Yo y mi círculo cercano.** Decenas de usuarios, no miles. Esto simplifica decisiones: el feed puede ser una query directa, no hace falta fan-out ni caching agresivo.
- Personas que quieren registrar sin fricción: de ahí el peso del asistente por voz ("estoy en Guadalupe con Irene comiendo chihuahua").

## Métricas de éxito del refactor

- La v1 se puede importar completa (restaurantes, platos, visitas, tags, imágenes) sin pérdida.
- La app abre y funciona en modo avión.
- Un cambio hecho en el dispositivo A aparece en el B sin acción manual.
- El proyecto sigue costando $0/mes.
