# 🚀 Last Loop

![Last Loop: un cohete despegando al amanecer](docs/images/last-loop-cover.webp)

**Last Loop** es un arcade de cohetes: eliges uno de diez cohetes legendarios, mantienes pulsado el impulso y lo guías hasta la órbita. Algunas misiones continúan hacia una órbita alta o rumbo a la Luna. Los controles principales son impulso, izquierda, derecha y separación de etapas.

---

## 🕹️ Cómo se juega

1. **Elige** un cohete en el hangar. Cada uno vuela distinto: potencia, combustible y agilidad.
2. **Despega:** mantén pulsado el impulso. Los motores rugen un instante sujetos a la plataforma y el cohete se suelta.
3. **Sigue la flecha verde** que sale del cohete. Si te desvías se vuelve amarilla y el HUD te dice hacia dónde girar.
4. **Separa cada etapa** con `S` o el botón táctil cuando se agote su combustible. La siguiente etapa tiene su propio depósito.
5. **Suelta el motor** cuando el HUD lo indique. Para la primera órbita, el cohete planea hasta el **anillo verde**.
6. **Completa las fases:** algunas misiones terminan en la primera órbita; otras piden subir más o acelerar rumbo a la Luna. Sigue el nuevo objetivo del HUD.

### La regla de la órbita

La ventana orbital empieza a **170 km**, con una velocidad lateral de referencia de **6 km/s** y una trayectoria casi horizontal. Hay que mantener la ventana orbital durante un segundo y medio. El HUD muestra altitud, velocidad, combustible y la instrucción del momento.

La línea de puntos marca adónde irías si soltaras el motor ahora: **verde** si te quedas arriba y **roja** si acabarías cayendo.

### Cómo se pierde

- **Te estrellas:** soltaste el motor demasiado pronto o giraste demasiado bajo.
- **Te pierdes en el espacio:** subiste recto sin ganar velocidad lateral.
- **Te quedas sin combustible** antes de llegar a la velocidad orbital.

### Sensación arcade

- **Despegue con fuerza:** sujeción en la plataforma, vibración de la cámara y una nube de humo que se extiende por el suelo. El cohete deja atrás la torre en pocos segundos.
- **Llamas según el combustible:** queroseno naranja con humo oscuro, hidrógeno casi invisible con vapor blanco, sólidos cegadores con humo espeso y metano limpio con borde azul.
- **Velocidad:** líneas de aire que se inclinan con el viento, estrellas que pasan a distintas profundidades y un cono de vapor con estampido al superar 1 km/s.
- **Nubes:** cúmulos en el horizonte y una capa que atraviesas a 4 km. Con tormenta, cumulonimbos y relámpagos; de noche, nubes en azul grisáceo.
- **Del horizonte plano al planeta:** en la plataforma el suelo es plano y, al subir, se curva hasta convertirse en la Tierra vista desde el espacio.

---

## 🛬 Entrenamiento de aterrizaje

Desde el botón **ATERRIZAR / PRACTICAR ATERRIZAJE** del hangar puedes practicar la recuperación de la primera etapa del Falcon 9, incluso antes de desbloquearlo en la campaña orbital. Tiene su propia progresión: tierra firme, viento cruzado y barcaza móvil. No altera los desbloqueos de cohetes.

- Comienzas a 600 m, descendiendo, con combustible para 22, 20 o 18 segundos de motor según el nivel.
- Usa los mismos controles de impulso y giro que en el vuelo, o los botones táctiles.
- Aterriza con ambas patas dentro de la plataforma, velocidad vertical ≤ 4 m/s, lateral ≤ 3 m/s e inclinación ≤ 10°.
- Recibes hasta 1.000 puntos: precisión (400), suavidad (400) y combustible (200). La mejor puntuación se guarda en este navegador cuando el almacenamiento está disponible.
- El entrenamiento se pausa al perder el foco. ENTER comienza, continúa o reinicia; ESC vuelve al hangar.

La física está en `src/game/systems/LandingModel.js` y la escena en `src/game/scenes/LandingScene.js`. Se integra con pasos fijos de 1/120 s y conserva el intento al redimensionar la ventana. El propulsor se dibuja como una primera etapa con patas, sin reutilizar la ilustración del cohete completo.

Pruebas de física: `npm test`.

---

## 🌍 Cohetes y misiones

Cada cohete tiene una misión que solo cuenta si vuelas con ese cohete. Al cumplir todas sus fases y retos ganas una estrella y se desbloquea el siguiente. Todas empiezan por alcanzar la órbita:

| #   | Cohete                 | Año  | Misión                  | Qué hay que hacer                                                      |
| :-- | :--------------------- | :--- | :---------------------- | :--------------------------------------------------------------------- |
| 1   | Soyuz                  | 1966 | Primera órbita          | Llegar a la órbita                                                     |
| 2   | Saturno V              | 1967 | Rumbo a la Luna         | Tras alcanzar la órbita, acelerar hasta 10 km/s rumbo a la Luna |
| 3   | Transbordador espacial | 1981 | Misión Hubble           | Recoger las 4 piezas y subir a 300 km |
| 4   | Energía                | 1987 | Tormenta en Baikonur    | Volar con ráfagas de viento y subir a 280 km |
| 5   | Ariane 5               | 1996 | Carga delicada          | No pasar de 2,0 km/s entre 10 y 35 km (Max-Q) y subir a 340 km |
| 6   | Falcon 9               | 2010 | Noche en Cabo Cañaveral | Volar de noche hasta 260 km y terminar con ≥ 12% de combustible |
| 7   | Electron               | 2017 | Slalom                  | Pasar por los 5 anillos                                                |
| 8   | Falcon Heavy           | 2018 | Encendido único         | Un encendido por etapa durante el ascenso; después, subir a 360 km |
| 9   | SLS                    | 2022 | Campo de escombros      | Evitar los escombros y acelerar hasta 10,5 km/s rumbo a la Luna |
| 10  | Starship               | 2023 | Leyenda                 | Pasar por los 6 anillos y subir a 300 km en menos de 170 s |

Los anillos, las piezas y los escombros se colocan a lo largo del ascenso perfecto de cada cohete, alternando lados para que haya que corregir el rumbo. Durante el vuelo, bajo el HUD, se ve cómo va la misión. Si llegas a la órbita sin cumplirla, la pantalla final te dice qué faltó.

**Récords:** el hangar muestra para cada cohete lo que consigue un **vuelo perfecto** (tiempo y combustible sobrante) y **tu mejor marca**, para que siempre haya algo que mejorar aunque la misión ya esté cumplida.

## 🎮 Controles

| Acción          | Teclado               | Móvil              |
| :-------------- | :-------------------- | :----------------- |
| Impulso         | `ESPACIO`, `W` o `↑`  | Mantener `IMPULSO` |
| Girar           | `A` / `D` o `←` / `→` | Botones `◀` `▶`    |
| Separar etapa   | `S`                   | Botón de separación |
| Volver a hangar | `ESC`                 | Botón _Hangar_     |
| Lanzar / seguir | `ENTER`               | Botón              |

En el móvil se puede girar e impulsar a la vez con dos dedos.

---

## 🛠️ Stack tecnológico

- **Motor:** [Phaser 3](https://phaser.io/)
- **Build:** [Vite](https://vitejs.dev/)
- **Lenguaje:** JavaScript (ES Modules)

## 🚀 Instalación y uso local

La IA de Control de Misión es opcional: requiere `ANTHROPIC_API_KEY` en `.env` y funciona solo en el servidor de desarrollo, desde este ordenador. El build estático y `npm run preview` utilizan las comunicaciones locales; no incluyen un servidor de IA.

Requiere **Node.js** v18 o superior.

| Acción                    | Comando           |
| :------------------------ | :---------------- |
| **Instalar dependencias** | `npm install`     |
| **Iniciar desarrollo**    | `npm run dev`     |
| **Generar build**         | `npm run build`   |
| **Previsualizar build**   | `npm run preview` |

## 📂 Estructura del proyecto

```text
src/
├── game/
│   ├── scenes/        # Portada (Boot), hangar (Hangar) y vuelo (Flight)
│   │   └── flight/    # Partes del vuelo: cámara, escape, nubes, velocidad, misión, entorno
│   ├── systems/       # Física de vuelo, fases, predicción del vuelo perfecto, misiones
│   ├── data/          # Los cohetes (estadísticas, datos reales, misiones) y el arte compartido
│   └── ui/            # HUD de vuelo, controles táctiles y tema visual
└── main.js            # Punto de entrada de Phaser
art/                   # Ilustraciones originales: cohetes, parches, Tierra, torre y nubes (no se publican)
public/assets/rockets/ # Cohetes recortados que carga el juego
public/assets/patches/ # Parches de misión, uno por cohete
public/assets/world/   # La Tierra, la torre de lanzamiento y las nubes
tools/                 # Script para preparar las ilustraciones
```

### Añadir o cambiar un cohete

1. Guarda la ilustración original en `art/rockets/` (PNG con fondo transparente, morro hacia arriba) y su parche de misión en `art/patches/`.
2. Prepáralos para el juego (necesita Python con Pillow):
   ```bash
   python tools/prepare_art.py "art/rockets/Mi cohete.png" public/assets/rockets/mi-cohete.png --height 768
   python tools/prepare_art.py "art/patches/Mi parche.png" public/assets/patches/mi-cohete.webp --box 320
   ```
   El script recorta el margen transparente y reduce la imagen (a 768 px de alto, o dentro de un cuadrado de 320 px).
3. Añádelo a la lista de `src/game/data/rockets.js` con el mismo `id`. El orden de la lista es el orden de desbloqueo.

Las misiones se definen en el mismo archivo combinando reglas (`targets`, `hazards`, `maxQ`, `wind`, `night`, `singleBurn`, `maxTime`, `minFuel`), así que es fácil crear nuevas.

### Ajustar el vuelo

- **Física:** `systems/FlightModel.js` (`FLIGHT_WORLD`). La gravedad se desvanece a medida que el cohete gana velocidad lateral, así que "ir de lado lo bastante rápido" es literalmente lo que lo mantiene en órbita.
- **Tiempo de simulación:** `systems/FlightSimulator.js` integra a 1/120 s y acumula el tiempo entre fotogramas. Las pausas largas del navegador se limitan a 250 ms por actualización para evitar saltos al volver.
- **Aspecto:** `scenes/flight/FlightSceneConstants.js`. Ahí se ajusta cuánto se exagera la subida cerca del suelo, cuándo desaparece la plataforma, cuándo se curva el horizonte y cómo encuadra la cámara.
- **Nubes:** las capas y la altitud a la que se atraviesan están al principio de `scenes/flight/FlightSceneClouds.js`.
