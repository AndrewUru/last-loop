# 🚀 Last Loop

![Portada del Proyecto](./assets/portada.png)

**Last Loop** es un prototipo de constructor de cohetes con lanzamiento orbital simplificado. Diseña naves modulares en un hangar de alta precisión, valida su física y pon a prueba tu ingeniería en una simulación de vuelo arcade.

---

## 🕹️ El Juego

El loop principal ha evolucionado de la supervivencia hacia la **ingeniería y simulación**:

1. **Diseño:** Construcción por grid con sistema de _snap_ y piezas modulares.
2. **Validación:** Análisis en tiempo real de masa, empuje y estabilidad.
3. **Lanzamiento:** Vuelo arcade con física orbital simplificada para alcanzar la órbita.

## ✨ Características Principales

### 🏗️ Hangar de Construcción

- **Grid Inteligente:** Colocación por _drag & drop_, recolocación de piezas y selección/borrado.
- **Métricas en Vivo:** Cálculo automático de masa total, empuje y **Centro de Masa (CoM)** visible.
- **Validación:** Feedback visual de errores en el grid y comprobación de condiciones mínimas de despegue.

### 🛰️ Simulación de Vuelo

- **Vuelo Arcade:** Pilotaje simplificado orientado a la experiencia de usuario.
- **Simulación Orbital:** Comportamiento físico basado en el rendimiento de tu diseño.
- **Resultados:** Pantalla de análisis de misión (éxito/fallo y rendimiento).

---

## 🛠️ Stack Tecnológico

- **Motor:** [Phaser 3](https://phaser.io/)
- **Herramientas de Build:** [Vite](https://vitejs.dev/)
- **Lenguaje:** JavaScript (ES Modules)

---

## 🚀 Instalación y Uso Local

### Pre-requisitos

- **Node.js** v18 o superior.

### Comandos rápidos

| Acción                    | Comando           |
| :------------------------ | :---------------- |
| **Instalar dependencias** | `npm install`     |
| **Iniciar desarrollo**    | `npm run dev`     |
| **Generar Build**         | `npm run build`   |
| **Previsualizar Build**   | `npm run preview` |

---

## 📂 Estructura del Proyecto

```text
src/
├── game/
│   ├── scenes/        # Lógica de cada estado (Boot, Build, Flight, Result)
│   ├── systems/       # Motores de cálculo (Física, Validación, Estadísticas)
│   └── data/          # Definición de piezas (parts.js)
├── assets/            # Sprites, sonidos y portadas
└── main.js            # Punto de entrada de Phaser
```
