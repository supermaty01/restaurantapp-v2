# 07 — Asistente IA

La pieza más ambiciosa de la v2. Tendrá su propio ciclo de diseño detallado al llegar la fase; este documento fija la arquitectura y el alcance para que las fases anteriores construyan los cimientos correctos.

## Capacidades objetivo

1. **Consultas en lenguaje natural** sobre los datos propios:
   - "¿Cuántas veces comí hamburguesas este año?"
   - "¿Cuántas carbonaras comí en Roma?"
   - "¿Cuándo fue la última vez que comí con Caro?"
2. **Agente de registro conversacional**: "Estoy en Guadalupe con Irene comiendo chihuahua" → resuelve paso a paso (¿existe el restaurante? ¿el plato? ¿quién es Irene?) y **asiste, no ejecuta**: pre-rellena formularios y pide confirmación en cada creación.
3. **Voz**: entrada por speech-to-text para ambos modos (registrar sin teclear es el caso estrella: estás comiendo).

## Insight de arquitectura: RAG puro no basta

Las consultas de ejemplo son mayoritariamente **agregaciones y filtros estructurados** (contar, agrupar por año/ciudad/persona), que un RAG por similitud de embeddings responde mal o no puede responder: "¿cuántas veces?" no es una pregunta de similitud. La búsqueda semántica sí es necesaria para lo difuso ("ese ramen picante", "carbonara" escrita como "pasta a la carbonara").

**Decisión: agente con tools sobre los datos (function calling), con recuperación híbrida:**

- **Tools estructuradas** — consultas parametrizadas sobre SQLite: contar/listar platos y visitas con filtros (texto, tag, rango de fechas, restaurante, zona geográfica, persona). Responden lo agregable con exactitud aritmética (lo calcula SQLite, no el modelo).
- **Tool semántica** — búsqueda por embeddings sobre nombres+comentarios, para resolver términos difusos a entidades concretas ("carbonara" → los 4 platos que encajan), cuyos IDs alimentan a las tools estructuradas.
- El LLM orquesta: "¿cuántas carbonaras en Roma?" → `search_dishes_semantic("carbonara")` → `count_visits(dish_ids, bbox=Roma)` → responde citando las visitas.

Este diseño reduce el trabajo del LLM a **entender la intención y elegir tools** — nunca a calcular ni a recordar datos. Es lo que hace viable usar modelos pequeños (ver abajo).

## Dónde corre cada cosa

**Decisión: orquestación y tools en el dispositivo; el modelo detrás del Worker.**

```
Usuario (texto o voz)
  → App: loop del agente (mensajes + tool calls)
      → Worker /ai/chat → AI Gateway → Workers AI (modelo gratuito)
      ← tool call
      → ejecución LOCAL de la tool contra SQLite
      → resultado de vuelta al modelo (siguiente vuelta del loop)
  → Respuesta / acción de UI (abrir formulario pre-llenado)
```

Motivos: los datos viven en SQLite (funciona sin haber sincronizado), a la nube solo viajan la pregunta y los resultados mínimos de las tools, y el Worker queda simple (proxy + cuota). Consecuencia aceptada: el asistente requiere conexión; sin red se desactiva con mensaje claro.

## Modelo: solo Workers AI gratuito, vía AI Gateway

**Decisión: exclusivamente modelos del catálogo gratuito de Workers AI, siempre a través de AI Gateway. Sin Claude ni proveedores de pago.** Coste objetivo: **$0**, dentro de la cuota diaria de neuronas del free tier.

Ventaja añadida: el binding `AI` del Worker autentica solo — no hay API keys de terceros que rotar ni filtrar.

Roles:

| Función                 | Modelo (Workers AI)                                                                           | Notas                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Chat + function calling | Modelo instruct con soporte de tools del catálogo (familia Llama 3.x/4 o equivalente vigente) | Selección concreta en fase 7a: el catálogo cambia, se elige el mejor **con function calling** disponible ese día |
| Embeddings              | Modelo de embeddings multilingüe del catálogo (familia BGE o equivalente)                     | Debe rendir bien en **español**: los datos están en español                                                      |
| Speech-to-text          | Whisper                                                                                       | Solo como fallback del STT nativo                                                                                |

Uso del **AI Gateway** (no es opcional, es parte del diseño de coste):

- **Caché** de respuestas — repeticiones salen gratis y al instante.
- **Rate limiting** en el borde — primera línea de defensa de la cuota, antes de tocar el modelo.
- **Analytics y logs** — visibilidad real del consumo; sin esto se navega a ciegas.
- **Fallbacks** entre modelos si uno falla o se satura.
- Además, cuota por usuario en `ai_usage` (Supabase) con hard-stop y mensaje claro.

### ⚠️ Riesgo asumido y cómo se mitiga

Los modelos pequeños gratuitos son **notablemente peores en function calling multi-paso** que los modelos frontera. El agente de registro (capacidad 2) es exactamente el caso difícil: varias tools encadenadas con estado. Riesgo real de que alucine argumentos, se salte pasos o entre en bucle.

Mitigaciones, todas de diseño (no de modelo):

1. **Tools mínimas y muy tipadas** — pocas, nombres obvios, argumentos planos, descripciones cortas. Cuantas menos decisiones tenga el modelo, mejor rinde.
2. **La máquina de estados vive en el cliente, no en el prompt.** El flujo de registro (restaurante → plato → persona → visita) lo conduce **código TypeScript determinista**; el LLM solo hace dos cosas por paso: extraer entidades del texto libre y elegir la tool. Si el modelo se pierde, el flujo no.
3. **El humano confirma cada escritura** — un error del modelo es, como máximo, un formulario mal pre-llenado que el usuario corrige. Nunca un dato corrupto.
4. **Validación zod de todo argumento de tool** antes de ejecutarla; argumento inválido → se devuelve el error al modelo para que reintente (con tope de vueltas).
5. **Set de evaluación** (fase 7a) con preguntas y frases reales sobre datos sintéticos, para comparar modelos del catálogo objetivamente y detectar regresiones al cambiar de modelo.
6. **Plan B explícito:** si tras la evaluación ningún modelo gratuito sostiene el agente conversacional (7c), se degrada esa capacidad a un **parser asistido** (extracción de entidades por LLM en una sola llamada — tarea mucho más fácil — y el resto del flujo por UI determinista), manteniendo la consulta en lenguaje natural (7b), que es más fácil y es la que más valor da. **Se prefiere degradar el alcance antes que pagar por un modelo.**

## Embeddings locales

- Volumen pequeño (cientos–pocos miles de filas): **similitud coseno por fuerza bruta en JS** sobre vectores guardados como blob en SQLite. Sin extensiones nativas ni servicios. Si algún día es lento, se optimiza (sqlite-vec).
- Indexación incremental: el `change_log` (¡ya existe por el sync!) marca qué filas re-embeber. Los vectores se calculan vía `POST /ai/embed` en batch, con caché del Gateway.
- pgvector en Supabase queda como espejo opcional (útil si algún feature de servidor necesita búsqueda semántica).
- **Coste $0**: los embeddings solo se recalculan cuando cambia el texto de una fila.

## Agente de registro conversacional

Principios:

- **Human-in-the-loop obligatorio:** el agente jamás escribe en la base de datos. Sus tools de "escritura" son `propose_restaurant(prefill)`, `propose_dish(...)`, `propose_visit(...)`: abren el formulario existente pre-completado; el guardado es el de siempre (misma validación zod, mismo repositorio).
- **Resolución paso a paso con confirmación**, dirigida por la máquina de estados del cliente:
  1. "Estoy en Guadalupe con Irene comiendo chihuahua"
  2. `find_restaurant("Guadalupe")` (+ GPS actual como señal de desambiguación) → ¿existe? → usar / "No encuentro 'Guadalupe', ¿lo creamos?" → formulario pre-llenado (nombre, coordenadas, dirección por Places).
  3. `find_dish("chihuahua", restaurant_id)` → ídem.
  4. `find_person("Irene")` → persona local o amiga; si no existe, proponer crearla.
  5. Proponer la visita (fecha = ahora, restaurante, plato, participante Irene) → confirmar → guardada.
- **Contexto inyectado en el system prompt:** fecha/hora, ubicación actual (con permiso), restaurantes cercanos, personas frecuentes. Reduce vueltas del agente y mejora mucho a los modelos pequeños.
- Conversación efímera (no se sincroniza); se guarda solo el resultado (las entidades creadas).

## Voz

- **STT primario:** reconocimiento nativo del sistema — gratis, rápido, on-device en muchos dispositivos.
- **Fallback:** `POST /ai/transcribe` (Whisper en Workers AI) cuando el nativo no esté disponible.
- UX: micrófono en la pantalla del asistente; el texto transcrito se muestra **editable antes de enviar** (los nombres propios de restaurantes fallan a menudo — el usuario corrige y envía).
- **Fuera de alcance v2:** conversación por voz continua / TTS de respuestas.

## Privacidad

- Opt-in explícito la primera vez, explicando qué sale del dispositivo (la pregunta y los resultados mínimos de tools; nunca la base de datos completa, nunca las fotos en v2).
- La ubicación solo se envía en el modo registro y con el permiso ya concedido al mapa.

## Requisitos que impone a fases anteriores (por esto se planifica ya)

| Requisito                                                               | Fase donde se construye       |
| ----------------------------------------------------------------------- | ----------------------------- |
| `people` + `visit_participants` (para "con Caro")                       | Fase 1 (esquema) y 5 (social) |
| `change_log` reutilizable como cola de indexación                       | Fase 1/3 (sync)               |
| Repositorios de consulta parametrizados y testeados (base de las tools) | Fase 1 (refactor)             |
| Worker con auth + cuotas + AI Gateway                                   | Fase 4                        |
| Formularios invocables con prefill vía parámetros                       | Fase 6 (UI)                   |

**Abierto:** ¿asistente en modo anónimo? Requiere cuota sin identidad (riesgo de abuso del proxy). Propuesta inicial: exigir cuenta.
**Abierto:** modelo concreto de chat y de embeddings — se decide en 7a con el set de evaluación y el catálogo vigente.
