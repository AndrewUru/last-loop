# 🚀 Last Loop

![Portada del Proyecto](https://elsaltoweb.es/wp-content/uploads/2026/04/portada.webp)

**Last Loop** es un juego corto de cohetes: eliges uno de diez cohetes legendarios y modernos, lo pilotas y tratas de dejarlo en órbita.

---

## 🕹️ El juego

1. **Elige:** en el hangar escoges un cohete. Cada uno vuela distinto: potencia, combustible y agilidad.
2. **Despega:** mantén pulsado el impulso. Los motores rugen un instante sujetos a la plataforma y el cohete se suelta; después sigue la flecha verde que sale de él.
3. **Orbita:** cuando llegues a la velocidad orbital suelta el motor y planea hasta el anillo verde.

La órbita se consigue con **altura** (pasar el anillo verde, 170 km) y **velocidad lateral** (5 km/s). El HUD muestra las dos barras y una sola instrucción con lo que hay que hacer en cada momento.

### Cohetes y retos

Cada cohete tiene un reto que solo cuenta si vuelas con ese cohete. Al cumplirlo ganas una estrella y se desbloquea el siguiente:

| #   | Cohete                 | Año  | Reto                 | Objetivo                          |
| :-- | :--------------------- | :--- | :------------------- | :-------------------------------- |
| 1   | Soyuz                  | 1966 | Primera órbita       | Llegar a la órbita                |
| 2   | Saturno V              | 1967 | Rumbo a la Luna      | ≥ 40% de combustible              |
| 3   | Transbordador espacial | 1981 | Exprés               | Menos de 76 s                     |
| 4   | Energía                | 1987 | Carga pesada         | ≥ 45% de combustible              |
| 5   | Ariane 5               | 1996 | Lanzamiento perfecto | Menos de 80 s y ≥ 38% combustible |
| 6   | Falcon 9               | 2010 | Reutilizable         | ≥ 52% de combustible              |
| 7   | Electron               | 2017 | Pequeño y veloz      | Menos de 70 s                     |
| 8   | Falcon Heavy           | 2018 | Rumbo a Marte        | Menos de 71 s y ≥ 58% combustible |
| 9   | SLS                    | 2022 | Artemis              | Menos de 82 s y ≥ 50% combustible |
| 10  | Starship               | 2023 | Leyenda              | Menos de 66 s y ≥ 60% combustible |

El hangar muestra lo que consigue un **vuelo perfecto** con cada cohete (un piloto automático que sigue la flecha) y tu mejor marca, para saber cuánto te falta.

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
│   ├── systems/       # Física de vuelo, fases, predicción, retos
│   ├── data/          # Los cohetes: estadísticas, datos reales y retos
│   └── ui/            # HUD de vuelo, controles táctiles y tema visual
└── main.js            # Punto de entrada de Phaser
art/rockets/           # Ilustraciones originales (no se publican)
public/assets/rockets/ # Ilustraciones recortadas que carga el juego
tools/                 # Script para preparar las ilustraciones
```

### Añadir o cambiar un cohete

1. Guarda la ilustración original en `art/rockets/` (PNG con fondo transparente, morro hacia arriba).
2. Prepárala para el juego (necesita Python con Pillow):
   ```bash
   python tools/prepare_rocket_art.py "art/rockets/Mi cohete.png" mi-cohete
   ```
   Recorta el margen transparente y la reduce a 768 px de alto en `public/assets/rockets/mi-cohete.png`.
3. Añádelo a la lista de `src/game/data/rockets.js` con el mismo `id`. El orden de la lista es el orden de desbloqueo.

La física vive en `systems/FlightModel.js`: la gravedad se desvanece a medida que el cohete gana velocidad lateral, así que "ir de lado lo bastante rápido" es literalmente lo que lo mantiene en órbita.
