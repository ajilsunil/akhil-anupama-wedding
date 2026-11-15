# Athulraj & Aiswarya | Wedding Invitation

An exact, faithful, high-craft reproduction of the wedding invitation website [athulraj-weds-aiswarya.netlify.app](https://athulraj-weds-aiswarya.netlify.app/).

## Features & Craftsmanship

1. **Initial Rendering & Intro Sequence**
   - **Double Hairline Card Frame**: Inset gold border with bespoke SVG corner jewellery (notches, curls, diamonds) that draw on seamlessly.
   - **Interlocked Monogram ("AA")**: Dual entwined letters inside a circular halo with gold foil gradient, glints, and pulse ripple effects.
   - **Ken Burns & Ambient Reveal**: Photographic cover image emerges softly out of the emerald deep green (`#10271F`) background.
   - **Atmospheric Golden Dust Particle Engine**: 2-layer HTML5 Canvas drifting gold motes, light glints, and soft ambient particles.

2. **Interactive Opening Choreography**
   - Triggered on button click, monogram click, scroll down, or swipe up.
   - Expanding radial shockwave and golden bloom flash.
   - Monogram glides and scales smoothly to anchor the header.
   - Split-character typography animations reveal "Athulraj weds Aiswarya", "Together with our families", dates, and venues.
   - Drawn hairline action buttons with shimmer sheens ("Directions", "Save the date", "Add to Google Calendar").

3. **Background Music**
   - Subtle traditional instrumental track (`kalyanam.m4a` / `kalyanam.mp3`) with gentle fade-in upon guest interaction.
   - Interactive rotating audio toggle button with mute state indicator.

4. **Multi-Section Scroll & Page Dots**
   - **Wedding Section**: 25 October 2026 at Chettiyedath Mahavishnu Temple, Vaka, Thrissur.
   - **Reception Section**: 1 November 2026 at Groom's residence, Ezhilode, Kannur, featuring scrim photography window and direction links.
   - **Blessings & Closing**: Arched portrait of the couple with gold gem crest, host family names, "Shower blessings" petal animation effect, and "Share invitation".
   - **Kasavu Trim**: Kerala gold-woven set-mundu border framing the foot of the screen.

## Project Structure

```
├── index.html                           # Main semantic HTML structure & SVG definitions
├── styles.css                           # Complete luxury styling, keyframes, transitions, and layout
├── main.js                              # Orchestration, scroll handling, text splitters, animations
├── particles.js                         # Canvas particle system (gold dust, glints, jasmine petals)
├── touch.js                             # Interactive touch sparkles and golden trail rings
├── music.js                             # Audio controller with smooth fade-in/out and storage memory
├── Athulraj-and-Aiswarya-Wedding.ics   # Calendar event file
├── package.json                         # Project metadata and npm start script
├── server.js                            # Lightweight Node.js local development server
├── audio/                               # Soundtrack files (.m4a, .mp3)
├── photos/                              # Responsive WebP portraits and backdrop imagery
└── src/
    ├── data/wedding.js                  # Wedding content data model
    └── lib/wedding.mjs                  # Calendar utilities and countdown logic
```

## Running the Website Locally

You can run the built-in Node.js server:

```bash
npm start
```
or:
```bash
node server.js
```

Then visit [http://localhost:8080](http://localhost:8080) on your computer, or access it from your phone on the same Wi-Fi using your local IP link (e.g. `http://192.168.30.102:8080`).
