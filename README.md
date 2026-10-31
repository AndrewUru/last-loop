# 🚀 Last Loop

![Portada del Proyecto](https://elsaltoweb.es/wp-content/uploads/2026/04/portada.webp)

**Last Loop** es un arcade de cohetes de vuelos cortos: eliges uno de diez cohetes legendarios, mantienes pulsado el impulso y lo guías hasta la órbita en poco más de un minuto. Sin menús de ingeniería ni decenas de teclas: impulso, izquierda y derecha.

---

## 🕹️ Cómo se juega

1. **Elige** un cohete en el hangar. Cada uno vuela distinto: potencia, combustible y agilidad.
2. **Despega:** mantén pulsado el impulso. Los motores rugen un instante sujetos a la plataforma y el cohete se suelta.
3. **Sigue la flecha verde** que sale del cohete. Si te desvías se vuelve amarilla y el HUD te dice hacia dónde girar.
4. **Suelta el motor** cuando el HUD diga _¡Suelta el motor!_: ya tienes velocidad orbital. El cohete planea hasta el **anillo verde**.
5. **¡En órbita!** La cámara se aleja para enseñarte el planeta entero.

### La regla de la órbita

Hay que pasar el anillo verde (**170 km**) yendo de lado a **5 km/s** y casi en horizontal, y mantenerlo un segundo y medio. El HUD lo resume en tres barras (altitud, velocidad y combustible) y una sola instrucción con lo que toca hacer en cada momento.

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

## 🌍 Cohetes y misiones

Cada cohete tiene una misión que solo cuenta si vuelas con ese cohete. Al cumplirla ganas una estrella y se desbloquea el siguiente. Todas terminan en órbita, pero cada una se juega distinto:

| #   | Cohete                 | Año  | Misión                  | Qué hay que hacer                                                      |
| :-- | :--------------------- | :--- | :---------------------- | :--------------------------------------------------------------------- |
| 1   | Soyuz                  | 1966 | Primera órbita          | Llegar a la órbita                                                     |
| 2   | Saturno V              | 1967 | Rumbo a la Luna         | Llegar con ≥ 40% de combustible                                        |
| 3   | Transbordador espacial | 1981 | Misión Hubble           | Recoger las 4 piezas del telescopio durante el ascenso                 |
| 4   | Energía                | 1987 | Tormenta en Baikonur    | Llegar con ráfagas de viento que desvían el cohete                     |
| 5   | Ariane 5               | 1996 | Carga delicada          | No pasar de 2,0 km/s entre 10 y 35 km (Max-Q): hay que soltar el motor |
| 6   | Falcon 9               | 2010 | Noche en Cabo Cañaveral | Lanzamiento de noche con ≥ 50% de combustible                          |
| 7   | Electron               | 2017 | Slalom                  | Pasar por los 5 anillos                                                |
| 8   | Falcon Heavy           | 2018 | Encendido único         | El motor solo se enciende una vez: no lo sueltes hasta la orden        |
| 9   | SLS                    | 2022 | Campo de escombros      | Esquivar los escombros: cada choque cuesta combustible y anula la misión |
| 10  | Starship               | 2023 | Leyenda                 | Pasar por los 6 anillos en menos de 72 s                               |

Los anillos, las piezas y los escombros se colocan a lo largo del ascenso perfecto de cada cohete, alternando lados para que haya que corregir el rumbo. Durante el vuelo, bajo el HUD, se ve cómo va la misión. Si llegas a la órbita sin cumplirla, la pantalla final te dice qué faltó.

**Récords:** el hangar muestra para cada cohete lo que consigue un **vuelo perfecto** (tiempo y combustible sobrante) y **tu mejor marca**, para que siempre haya algo que mejorar aunque la misión ya esté cumplida.

## 🎮 Controles

| Acción          | Teclado               | Móvil              |
| :-------------- | :-------------------- | :----------------- |
| Impulso         | `ESPACIO`, `W` o `↑`  | Mantener `IMPULSO` |
| Girar           | `A` / `D` o `←` / `→` | Botones `◀` `▶`    |
| Volver a hangar | `ESC`                 | Botón _Hangar_     |
| Lanzar / seguir | `ENTER`               | Botón              |

En el móvil se puede girar e impulsar a la vez con dos dedos.

---

## 🛠️ Stack tecnológico

- **Motor:** [Phaser 3](https://phaser.io/)
- **Build:** [Vite](https://vitejs.dev/)
- **Lenguaje:** JavaScript (ES Modules)

## 🚀 Instalación y uso local

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
- **Aspecto:** `scenes/flight/FlightSceneConstants.js`. Ahí se ajusta cuánto se exagera la subida cerca del suelo, cuándo desaparece la plataforma, cuándo se curva el horizonte y cómo encuadra la cámara.
- **Nubes:** las capas y la altitud a la que se atraviesan están al principio de `scenes/flight/FlightSceneClouds.js`.
