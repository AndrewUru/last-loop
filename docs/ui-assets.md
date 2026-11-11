# Assets de interfaz: consola NASA retro

Las imágenes que necesita la interfaz para badges, botones y el HUD de vuelo.
Genera cada una, guárdala con el nombre exacto y déjala en `incoming/ui/`
(cualquier tamaño, PNG con transparencia). Yo la recorto, la escalo y la
integro en el juego.

Los prompts están en inglés porque los generadores de imágenes los siguen
mejor.

## Reglas para todas las imágenes

- **Sin texto, números ni letras.** El juego dibuja todas las etiquetas con
  Phaser, así se pueden cambiar y redimensionar. Además, los generadores
  escriben mal las palabras.
- **Fondo transparente** (PNG).
- **Vista frontal y luz plana.** Sin perspectiva y sin sombra fuera de la
  forma; las sombras las pone el juego.
- **La misma paleta en todo:** metal gris oliva o gunmetal algo gastado,
  baquelita oscura, ámbar `#ffb347` y verde fósforo `#73f7c0` para las luces,
  y franja amarilla y negra de peligro solo en el botón de separar.
- **Los paneles y botones se estiran** (nine-slice): pon el detalle
  (remaches, biseles, tornillos) en las esquinas y los bordes, y deja el
  centro liso y uniforme. El margen de cada tabla es hasta dónde puede llegar
  el detalle de las esquinas hacia dentro.

Texto de estilo para añadir al final de cada prompt:

> 1960s–70s NASA mission control console hardware, brushed and slightly worn
> painted metal, bakelite, small rivets and screws, subtle wear on the edges,
> flat front orthographic view, even studio lighting, crisp game UI asset,
> isolated on transparent background, no text, no letters, no numbers

## 1. Paneles (nine-slice)

| Archivo | Tamaño | Margen | Dónde se usa |
|---|---|---|---|
| `panel-hud.png` | 600 × 130 | 24 px | HUD de vuelo arriba: título, texto y las 3 barras |
| `panel-large.png` | 512 × 512 | 32 px | Panel lateral del hangar y pantallas de resultado o briefing |
| `panel-card.png` | 512 × 256 | 24 px | Ficha del cohete en el hangar |
| `panel-radio.png` | 512 × 128 | 24 px | Franja de subtítulos de Mission Control |

Prompts:

- **panel-hud:** "wide horizontal instrument panel plate, dark gunmetal with a
  raised bevelled frame, four corner screws, recessed flat dark centre area"
- **panel-large:** "square console panel, dark olive-grey painted steel, thick
  bevelled border, rivets along the edges, flat dark recessed centre"
- **panel-card:** "rectangular equipment faceplate, dark metal, thin bevelled
  edge, corner screws, flat dark centre"
- **panel-radio:** "long narrow radio transceiver faceplate, dark bakelite with
  a small speaker grille on the left end only, flat dark centre"

## 2. Botones (tres estados cada uno)

Cada botón necesita tres archivos: `-idle` (normal), `-pressed` (hundido y más
oscuro) y `-disabled` (apagado y desvaído). Por ejemplo,
`btn-primary-idle.png`.

| Nombre base | Tamaño | Margen | Dónde se usa |
|---|---|---|---|
| `btn-primary` | 360 × 96 | 28 px | LANZAR y acciones principales (ámbar iluminado) |
| `btn-secondary` | 360 × 96 | 28 px | Volver, reintentar, menús (gris apagado) |
| `btn-danger` | 256 × 96 | 28 px | SEPARAR (rojo con borde de peligro) |
| `btn-round-blue` / `-amber` / `-red` | 256 × 256 | no se estira | Controles táctiles: ◀ ▶ (azul), IMPULSO (ámbar), SEPARAR (rojo) |

Prompts:

- **btn-primary:** "chunky rectangular illuminated push button, amber
  translucent backlit cap set in a metal bezel, glowing softly"
- **btn-secondary:** "chunky rectangular push button, matte dark grey cap in a
  metal bezel, unlit"
- **btn-danger:** "rectangular red guarded push button inside a metal bezel
  with a yellow and black hazard stripe border"
- **btn-round:** "large round arcade-style push button, metal ring bezel,
  convex cap", más el color: "blue", "amber" o "red"

Para el estado pulsado añade "pressed in, cap sunk into the bezel, slightly
darker". Para el desactivado añade "unlit, desaturated, dusty".

## 3. Instrumentos del HUD

| Archivo | Tamaño | Dónde se usa |
|---|---|---|
| `bar-frame.png` | 256 × 32 (margen 12 px) | Marco de las barras de altitud, velocidad y combustible |
| `bar-fill.png` | 256 × 24 (margen 8 px) | Relleno luminoso de la barra (el juego le da el color) |
| `lamp-off.png` / `lamp-on.png` | 64 × 64 | Piloto de aviso (etapa vacía, poco combustible, Max-Q) |
| `gauge-dial.png` | 256 × 256 | Esfera de reloj, sin aguja ni números |
| `gauge-needle.png` | 32 × 128 | Aguja, con el pivote abajo en el centro |

Prompts:

- **bar-frame:** "long thin recessed metal slot for a bar gauge, bevelled
  edge, dark inside"
- **bar-fill:** "long thin glowing white light strip, soft bloom, rounded
  ends". Tiene que ser blanca, para que el juego la tiña de verde, cian o
  ámbar.
- **lamp:** "small round indicator lamp in a chrome bezel", y para `-off`
  "unlit dark glass" o para `-on` "lit glowing amber glass"
- **gauge-dial:** "round analogue aircraft gauge face, black with tick marks
  only, chrome bezel, no numbers"
- **gauge-needle:** "single white gauge needle, vertical, flat"

## 4. Badges y rango del piloto

Los parches de misión (`public/assets/patches/`) ya están. Los badges los
enmarcan, y las insignias acompañan al rango.

| Archivo | Tamaño | Dónde se usa |
|---|---|---|
| `badge-frame.png` | 320 × 320 | Aro metálico alrededor del parche redondo |
| `badge-locked.png` | 320 × 320 | Parche tapado de una misión aún no completada |
| `rank-cadete.png` | 256 × 256 | Insignia de rango: 0 misiones |
| `rank-piloto.png` | 256 × 256 | 1 misión |
| `rank-comandante.png` | 256 × 256 | 3 misiones |
| `rank-veterano.png` | 256 × 256 | 6 misiones |
| `rank-leyenda.png` | 256 × 256 | Todas las misiones |

Prompts:

- **badge-frame:** "circular embroidered patch border ring with a thin metal
  outer bezel, empty transparent centre"
- **badge-locked:** "round embroidered patch, dark grey fabric, a small
  padlock in the centre, faded"
- **insignias de rango:** "retro space-agency enamel pin insignia, gold and
  navy, shield shape", con más detalle en cada rango:
  - cadete: "one small star"
  - piloto: "wings and one star"
  - comandante: "wings and three stars"
  - veterano: "wings, three stars and a laurel wreath"
  - leyenda: "gold wings, five stars, laurel wreath, a small rocket at the
    centre, shining"

## 5. Opcional

- `scanlines.png`, 256 × 256, repetible: líneas de CRT muy suaves sobre fondo
  transparente, para poner encima del HUD y de la franja de radio.
- **Fuente:** para que el texto también parezca de consola, elige una fuente
  gratuita como **Share Tech Mono** o **VT323** (Google Fonts) y la cargo.

## Orden recomendado

1. `panel-hud`, `bar-frame`, `bar-fill` y `btn-round-*` (la pantalla de vuelo).
2. `btn-primary`, `btn-secondary`, `btn-danger` y `panel-large` (hangar y menús).
3. Badges e insignias de rango.
4. El resto.

Puedes mandarlas por tandas: lo que llegue lo integro, y lo que falte
conserva el aspecto actual.
