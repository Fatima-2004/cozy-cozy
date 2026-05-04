# ✨ Starry Picnic

> A cozy 5-chapter adventure following **Sunny** 🌟 and **Luna** 💫 — two little stars going on the perfect picnic.

---

## 🎮 How to Play

Open `index.html` in your browser. In a Codespace, right-click the file → **Open with Live Server** (or use the VS Code Live Server extension).

### Chapters

| # | Scene | How to play |
|---|-------|-------------|
| 1 | 🛒 **The Cozy Market** | Click each item on the shelves to add it to the cart |
| 2 | 🥪 **The Kitchen** | Click ingredients in the correct order to build the sandwich |
| 3 | 🧺 **Packing Up** | Click scattered items to toss them into the picnic basket |
| 4 | 🚗 **Road Trip** | Sit back and enjoy the ride — the stars drive themselves! |
| 5 | 🌌 **Under the Stars** | Click stars to draw constellations and enjoy the ending |

---

## 🗂️ Project Structure

```
starry-picnic/
├── index.html      ← the entire game (self-contained)
└── README.md
```

Everything lives in one HTML file — no build step, no dependencies, no install.

---

## 🛠️ Extending the Game

The game is structured as a simple **scene state machine**. Each scene has:

- `updateXxx()` — handles input and logic each frame
- `drawXxx()` — renders the scene to the canvas

To add a new scene:
1. Add its name to the `transitionTo('yourScene')` calls
2. Write `updateYourScene()` and `drawYourScene()`
3. Add both to the `switch` blocks in `loop()`

### Ideas for expansion
- 🎵 Web Audio API ambient sounds (crickets, rustling leaves)
- 🌧️ Weather changes during the drive
- 📷 A "polaroid" ending screen the player can screenshot
- 🍰 More sandwich ingredients with drag-and-drop
- 🏡 A "choose your picnic spot" branching level

---

## 🎨 Design Notes

- **Palette**: Deep indigo night sky, warm gold, soft lavender, cream
- **Font**: [Baloo 2](https://fonts.google.com/specimen/Baloo+2) via Google Fonts
- **Rendering**: HTML5 Canvas 2D — no libraries, no framework
- **Scale**: Responsive — fills up to 860px wide, 16:10 aspect ratio

---

Made with cozy intentions ✨