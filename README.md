# 🚀 Last Loop

![Portada del Proyecto](https://elsaltoweb.es/wp-content/uploads/2026/04/portada.webp)

**Last Loop** es un juego corto de cohetes: construyes un cohete con unas pocas piezas, lo pilotas y tratas de dejarlo en órbita.

---

## 🕹️ El juego

1. **Construye:** en el hangar eliges cuántos tanques, motores y extras lleva tu cohete con los botones `−` / `+`. Las piezas se apilan solas.
2. **Despega:** mantén pulsado el impulso y sigue la flecha verde que sale del cohete.
3. **Orbita:** cuando llegues a la velocidad orbital suelta el motor y planea hasta el anillo verde.

La órbita se consigue con **altura** (pasar el anillo verde, 170 km) y **velocidad lateral** (5 km/s). El HUD muestra las dos barras y una sola instrucción con lo que hay que hacer en cada momento.

### Misiones

Las misiones se cumplen en orden y desbloquean piezas nuevas:

| Misión         | Objetivo                              | Desbloquea                 |
| :------------- | :------------------------------------ | :------------------------- |
| Primera órbita | Llegar a la órbita                    | Ojiva, anillo de control   |
| Ahorrador      | Llegar con ≥ 35% de combustible       | Boosters laterales         |
| Exprés         | Llegar en menos de 68 s               | —                          |
| Carga pesada   | Llegar con 7 piezas o más             | —                          |

El hangar incluye una **predicción de vuelo**: simula tu diseño con un piloto perfecto y te dice si puede llegar a la órbita y con cuánto combustible.

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
│   ├── scenes/        # Portada (Boot), hangar (Build) y vuelo (Flight)
│   ├── systems/       # Física de vuelo, fases, predicción, misiones
│   ├── data/          # Piezas y reglas de apilado del cohete
│   ├── entities/      # Dibujo de cada pieza
│   └── ui/            # HUD de vuelo, controles táctiles y tema visual
└── main.js            # Punto de entrada de Phaser
```

La física vive en `systems/FlightModel.js`: la gravedad se desvanece a medida que el cohete gana velocidad lateral, así que "ir de lado lo bastante rápido" es literalmente lo que lo mantiene en órbita.
