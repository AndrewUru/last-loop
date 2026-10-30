# 🚀 Last Loop

![Portada del Proyecto](https://elsaltoweb.es/wp-content/uploads/2026/04/portada.webp)

**Last Loop** es un juego corto de cohetes: eliges uno de diez cohetes legendarios y modernos, lo pilotas y tratas de dejarlo en órbita.

---

## 🕹️ El juego

1. **Elige:** en el hangar escoges un cohete. Cada uno vuela distinto: potencia, combustible y agilidad.
2. **Despega:** mantén pulsado el impulso. Los motores rugen un instante sujetos a la plataforma y el cohete se suelta; después sigue la flecha verde que sale de él.
3. **Orbita:** cuando llegues a la velocidad orbital suelta el motor y planea hasta el anillo verde.

La órbita se consigue con **altura** (pasar el anillo verde, 170 km) y **velocidad lateral** (5 km/s). El HUD muestra las dos barras y una sola instrucción con lo que hay que hacer en cada momento.

### Cohetes y misiones

Cada cohete tiene una misión que solo cuenta si vuelas con ese cohete. Al cumplirla ganas una estrella y se desbloquea el siguiente. Todas terminan en órbita, pero cada una se juega distinto:

| #   | Cohete                 | Año  | Misión                  | Qué hay que hacer                                                   |
| :-- | :--------------------- | :--- | :---------------------- | :------------------------------------------------------------------ |
| 1   | Soyuz                  | 1966 | Primera órbita          | Llegar a la órbita                                                  |
| 2   | Saturno V              | 1967 | Rumbo a la Luna         | Llegar con ≥ 40% de combustible                                     |
| 3   | Transbordador espacial | 1981 | Misión Hubble           | Recoger las 4 piezas del telescopio durante el ascenso              |
| 4   | Energía                | 1987 | Tormenta en Baikonur    | Llegar con ráfagas de viento que desvían el cohete                  |
| 5   | Ariane 5               | 1996 | Carga delicada          | No pasar de 2,0 km/s entre 10 y 35 km (Max-Q): hay que soltar el motor |
| 6   | Falcon 9               | 2010 | Noche en Cabo Cañaveral | Lanzamiento de noche con ≥ 50% de combustible                       |
| 7   | Electron               | 2017 | Slalom                  | Pasar por los 5 anillos                                             |
| 8   | Falcon Heavy           | 2018 | Encendido único         | El motor solo se enciende una vez: no lo sueltes hasta la orden     |
| 9   | SLS                    | 2022 | Campo de escombros      | Esquivar los escombros (cada choque cuesta combustible)             |
| 10  | Starship               | 2023 | Leyenda                 | Pasar por los 6 anillos en menos de 72 s                            |

Los anillos, las piezas y los escombros se colocan a lo largo del ascenso perfecto de cada cohete. Durante el vuelo, bajo el HUD, se ve cómo va la misión, y si llegas a la órbita sin cumplirla te dice qué faltó. El hangar muestra lo que consigue un **vuelo perfecto** con cada cohete y tu mejor marca.

Las misiones se definen en `src/game/data/rockets.js` combinando reglas (`targets`, `hazards`, `maxQ`, `wind`, `night`, `singleBurn`, `maxTime`, `minFuel`), así que es fácil crear nuevas.

### Controles

| Acción          | Teclado               | Móvil              |
| :-------------- | :-------------------- | :----------------- |
| Impulso         | `ESPACIO`, `W` o `↑`  | Mantener `IMPULSO` |
| Girar           | `A` / `D` o `←` / `→` | Botones `◀` `▶`    |
| Volver a hangar | `ESC`                 | Botón _Hangar_     |
| Lanzar / seguir | `ENTER`               | Botón              |

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
│   ├── systems/       # Física de vuelo, fases, predicción, misiones
│   ├── data/          # Los cohetes: estadísticas, datos reales y misiones; arte compartido
│   └── ui/            # HUD de vuelo, controles táctiles y tema visual
└── main.js            # Punto de entrada de Phaser
art/                   # Ilustraciones originales: cohetes, parches, Tierra y torre (no se publican)
public/assets/rockets/ # Cohetes recortados que carga el juego
public/assets/patches/ # Parches de misión, uno por cohete
public/assets/world/   # La Tierra y la torre de lanzamiento
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

La física vive en `systems/FlightModel.js`: la gravedad se desvanece a medida que el cohete gana velocidad lateral, así que "ir de lado lo bastante rápido" es literalmente lo que lo mantiene en órbita.
