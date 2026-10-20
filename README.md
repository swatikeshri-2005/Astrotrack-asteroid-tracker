
# AstroTrack — Near-Earth Asteroid Tracker

AstroTrack is a web-based dashboard for exploring near-Earth asteroids using NASA's Near Earth Object Web Service (NeoWs).

## Features

- Live asteroid data from NASA NeoWs
- Dashboard with tracked-object statistics
- Closest-approach distance and velocity insights
- Asteroid search, filtering, and sorting
- Asteroid details
- CSV export
- Responsive dark-themed interface

## Tech Stack

- HTML5
- CSS3
- JavaScript
- NASA NeoWs API

## Run Locally

1. Clone this repository.
2. Open the project folder in VS Code.
3. Open the terminal in the project directory.
4. Run:

   ```bash
   python -m http.server 8000
   ```

5. Open http://localhost:8000 in your browser.

## NASA API

AstroTrack uses NASA's NeoWs API.

For local development, configure the API key in `script.js` according to the project's configuration. Never commit a private API key to a public repository.

API documentation: https://api.nasa.gov/

## Disclaimer

Asteroid hazard classifications are scientific assessments and do not mean an object is predicted to impact Earth.
