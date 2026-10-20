
"use strict";

// =====================================================
// ASTROTRACK — NASA NEAR-EARTH OBJECT EXPLORER
// =====================================================

const NASA_API = "https://api.nasa.gov/neo/rest/v1/feed";
const API_KEY = "Demo-key";

const $ = (selector) => document.querySelector(selector);

const elements = {
  connection: $("#connection-status"),
  updated: $("#updated-time"),
  refresh: $("#refresh-button"),
  range: $("#date-range"),
  search: $("#search-input"),
  hazard: $("#hazard-filter"),
  sort: $("#sort-select"),
  table: $("#asteroid-table"),
  footer: $("#result-footer"),
  chart: $("#distance-chart"),
  export: $("#export-button"),
  dialog: $("#asteroid-dialog"),
  dialogContent: $("#dialog-content"),
  toast: $("#toast")
};

let asteroids = [];
let loading = false;
let toastTimeout;

// Escape text before placing external API values into HTML.
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function number(value, digits = 2) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "N/A";

  return parsed.toLocaleString("en-US", {
    maximumFractionDigits: digits
  });
}

function formatDate(dateString) {
  if (!dateString) return "Unknown";

  const date = new Date(`${dateString}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });
}

function formatDiameter(asteroid) {
  const diameter = asteroid.estimated_diameter?.meters;

  if (!diameter) return "N/A";

  return `${number(diameter.estimated_diameter_min, 0)}–${number(
    diameter.estimated_diameter_max, 0
  )} m`;
}

function getClosestApproach(asteroid) {
  const approaches = asteroid.close_approach_data || [];

  // Use the first approach in the API feed's selected window.
  return approaches[0] || null;
}

function getDistanceKm(asteroid) {
  const approach = getClosestApproach(asteroid);
  return Number(approach?.miss_distance?.kilometers ?? Infinity);
}

function getDistanceLunar(asteroid) {
  const approach = getClosestApproach(asteroid);
  return Number(approach?.miss_distance?.lunar ?? Infinity);
}

function getVelocity(asteroid) {
  const approach = getClosestApproach(asteroid);
  return Number(
    approach?.relative_velocity?.kilometers_per_hour ?? 0
  );
}

function getDiameterMeters(asteroid) {
  return Number(
    asteroid.estimated_diameter?.meters?.estimated_diameter_max ?? 0
  );
}

function getApproachDate(asteroid) {
  return getClosestApproach(asteroid)?.close_approach_date || "9999-12-31";
}

function isHazardous(asteroid) {
  return asteroid.is_potentially_hazardous_asteroid === true;
}

// NASA's feed accepts a maximum seven-day date window.
function getDateWindow(days) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + days - 1);

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
}

async function fetchAsteroids() {
  if (loading) return;

  loading = true;
  elements.refresh.disabled = true;
  elements.refresh.textContent = "↻ Loading...";
  elements.connection.textContent = "Connecting to NASA...";
  elements.table.innerHTML =
    '<tr><td colspan="7" class="loading">Receiving asteroid data...</td></tr>';

  try {
    const days = Number(elements.range.value);
    const { start, end } = getDateWindow(days);

    const url = new URL(NASA_API);
    url.searchParams.set("start_date", start);
    url.searchParams.set("end_date", end);
    url.searchParams.set("api_key", API_KEY);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    let response;

    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" }
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error(
          "NASA API rate limit reached. Wait a little and try again."
        );
      }

      if (response.status === 403) {
        throw new Error(
          "NASA API access was denied. Check the API key or try again later."
        );
      }

      throw new Error(`NASA API returned HTTP ${response.status}.`);
    }

    const data = await response.json();

    if (!data.near_earth_objects) {
      throw new Error("The NASA response did not contain asteroid data.");
    }

    asteroids = Object.values(data.near_earth_objects)
      .flat()
      .filter((asteroid) => getClosestApproach(asteroid));

    elements.connection.textContent = "NASA API connected";
    elements.connection.style.color = "var(--green)";

    elements.updated.textContent = new Date().toLocaleTimeString(
      "en-IN",
      { hour: "2-digit", minute: "2-digit" }
    );

    renderDashboard();
  } catch (error) {
    console.error("Asteroid fetch failed:", error);

    elements.connection.textContent = "NASA API unavailable";
    elements.connection.style.color = "var(--red)";

    elements.table.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="error-state">
            <strong>Could not load asteroid data.</strong>
            <p>${escapeHTML(error.message || "Network error.")}</p>
            <button class="secondary-button" id="retry-button">
              Try again
            </button>
          </div>
        </td>
      </tr>
    `;

    $("#retry-button")?.addEventListener("click", fetchAsteroids);

    elements.chart.innerHTML =
      '<div class="empty-state">Approach chart unavailable until data loads.</div>';

    elements.footer.textContent =
      "No fresh data loaded. Existing API data may be unavailable.";
  } finally {
    loading = false;
    elements.refresh.disabled = false;
    elements.refresh.textContent = "↻ Refresh";
  }
}

function renderDashboard() {
  renderStatistics();
  renderChart();
  renderInsights();
  renderTable();
}

function renderStatistics() {
  const total = asteroids.length;
  const hazardous = asteroids.filter(isHazardous);
  const closest = [...asteroids].sort(
    (a, b) => getDistanceKm(a) - getDistanceKm(b)
  )[0];

  const fastest = [...asteroids].sort(
    (a, b) => getVelocity(b) - getVelocity(a)
  )[0];

  $("#total-count").textContent = number(total, 0);
  $("#hazard-count").textContent = number(hazardous.length, 0);

  $("#closest-distance").textContent = closest
    ? `${number(getDistanceLunar(closest))} LD`
    : "N/A";

  $("#closest-name").textContent = closest
    ? closest.name
    : "No objects found";

  $("#fastest-speed").textContent = fastest
    ? `${number(getVelocity(fastest), 0)} km/h`
    : "N/A";

  $("#fastest-name").textContent = fastest
    ? fastest.name
    : "No objects found";
}

function renderChart() {
  const nearest = [...asteroids]
    .sort((a, b) => getDistanceLunar(a) - getDistanceLunar(b))
    .slice(0, 6);

  if (!nearest.length) {
    elements.chart.innerHTML =
      '<div class="empty-state">No approach data available.</div>';
    return;
  }

  const maxDistance = Math.max(
    ...nearest.map(getDistanceLunar).filter(Number.isFinite),
    0.000001
  );

  elements.chart.innerHTML = nearest.map((asteroid) => {
    const distance = getDistanceLunar(asteroid);
    const percentage = Number.isFinite(distance)
      ? Math.max(2, (distance / maxDistance) * 100)
      : 0;

    return `
      <div class="chart-row">
        <span class="chart-name" title="${escapeHTML(asteroid.name)}">
          ${escapeHTML(asteroid.name)}
        </span>
        <div
          class="chart-track"
          role="img"
          aria-label="${escapeHTML(asteroid.name)}: ${number(distance)} lunar distances"
        >
          <div class="chart-bar" style="width:${percentage}%"></div>
        </div>
        <span class="chart-distance">${number(distance)} LD</span>
      </div>
    `;
  }).join("");
}

function renderInsights() {
  const nearest = [...asteroids].sort(
    (a, b) => getDistanceKm(a) - getDistanceKm(b)
  )[0];

  const fastest = [...asteroids].sort(
    (a, b) => getVelocity(b) - getVelocity(a)
  )[0];

  const hazardous = asteroids.filter(isHazardous).length;

  $("#insight-nearest-title").textContent = nearest
    ? nearest.name
    : "No approach data";

  $("#insight-nearest").textContent = nearest
    ? `${number(getDistanceKm(nearest), 0)} km from Earth, with an approach on ${formatDate(getApproachDate(nearest))}.`
    : "No approach data is available.";

  $("#insight-hazard").textContent =
    `${hazardous} of ${asteroids.length} tracked objects are classified as potentially hazardous in this feed.`;

  $("#insight-speed").textContent = fastest
    ? `${fastest.name} — ${number(getVelocity(fastest), 0)} km/h relative velocity.`
    : "No velocity data is available.";
}

function getFilteredAsteroids() {
  const query = elements.search.value.trim().toLowerCase();
  const hazard = elements.hazard.value;
  const sort = elements.sort.value;

  const filtered = asteroids.filter((asteroid) => {
    const matchesQuery =
      String(asteroid.name || "").toLowerCase().includes(query) ||
      String(asteroid.id || "").includes(query);

    const matchesHazard =
      hazard === "all" ||
      (hazard === "hazardous" && isHazardous(asteroid)) ||
      (hazard === "safe" && !isHazardous(asteroid));

    return matchesQuery && matchesHazard;
  });

  const sorters = {
    distance: (a, b) => getDistanceKm(a) - getDistanceKm(b),
    speed: (a, b) => getVelocity(b) - getVelocity(a),
    size: (a, b) => getDiameterMeters(b) - getDiameterMeters(a),
    date: (a, b) => getApproachDate(a).localeCompare(getApproachDate(b)),
    name: (a, b) => a.name.localeCompare(b.name)
  };

  filtered.sort(sorters[sort] || sorters.distance);

  return filtered;
}

function renderTable() {
  const filtered = getFilteredAsteroids();

  if (!filtered.length) {
    elements.table.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            No asteroids match your search or filters.
            <br />Try another search or choose "All objects".
          </div>
        </td>
      </tr>
    `;
  } else {
    elements.table.innerHTML = filtered.map((asteroid) => {
      const hazard = isHazardous(asteroid);
      const approach = getClosestApproach(asteroid);

      return `
        <tr>
          <td>
            <span class="asteroid-name" title="${escapeHTML(asteroid.name)}">
              ${escapeHTML(asteroid.name)}
            </span>
            <span class="asteroid-id">ID: ${escapeHTML(asteroid.id)}</span>
          </td>
          <td>${formatDiameter(asteroid)}</td>
          <td>${number(getVelocity(asteroid), 0)} km/h</td>
          <td>${number(getDistanceKm(asteroid), 0)} km</td>
          <td>${formatDate(approach?.close_approach_date)}</td>
          <td>
            <span class="status ${hazard ? "danger" : "safe"}">
              ${hazard ? "⚠ Potentially hazardous" : "✓ Not flagged"}
            </span>
          </td>
          <td>
            <button
              class="details-button"
              type="button"
              data-asteroid-id="${escapeHTML(asteroid.id)}"
            >Details ↗</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  elements.footer.textContent =
    `Showing ${filtered.length} of ${asteroids.length} asteroids`;
}

function openAsteroidDetails(id) {
  const asteroid = asteroids.find(
    (item) => String(item.id) === String(id)
  );

  if (!asteroid) {
    showToast("Asteroid details could not be found.");
    return;
  }

  const approach = getClosestApproach(asteroid);
  const hazardous = isHazardous(asteroid);
  const diameter = asteroid.estimated_diameter?.meters;

  elements.dialogContent.innerHTML = `
    <div class="eyebrow">ASTEROID PROFILE</div>
    <h2 class="dialog-title">${escapeHTML(asteroid.name)}</h2>
    <p class="dialog-subtitle">
      NASA/JPL object ID: ${escapeHTML(asteroid.id)}
    </p>

    <p>
      <span class="status ${hazardous ? "danger" : "safe"}">
        ${hazardous ? "⚠ Potentially hazardous" : "✓ Not flagged as potentially hazardous"}
      </span>
    </p>

    <div class="detail-grid">
      <div class="detail-box">
        <span>Minimum diameter</span>
        <strong>${number(diameter?.estimated_diameter_min, 1)} m</strong>
      </div>
      <div class="detail-box">
        <span>Maximum diameter</span>
        <strong>${number(diameter?.estimated_diameter_max, 1)} m</strong>
      </div>
      <div class="detail-box">
        <span>Relative velocity</span>
        <strong>${number(getVelocity(asteroid), 0)} km/h</strong>
      </div>
      <div class="detail-box">
        <span>Miss distance</span>
        <strong>${number(getDistanceKm(asteroid), 0)} km</strong>
      </div>
      <div class="detail-box">
        <span>Lunar distances</span>
        <strong>${number(getDistanceLunar(asteroid))} LD</strong>
      </div>
      <div class="detail-box">
        <span>Closest approach</span>
        <strong>${formatDate(approach?.close_approach_date)}</strong>
      </div>
    </div>

    <p class="dialog-subtitle">
      Orbiting body: ${escapeHTML(approach?.orbiting_body || "Unknown")}
    </p>

    <a
      class="dialog-link"
      href="${escapeHTML(asteroid.nasa_jpl_url || "https://cneos.jpl.nasa.gov/")}"
      target="_blank"
      rel="noopener noreferrer"
    >Open NASA/JPL object record ↗</a>
  `;

  if (typeof elements.dialog.showModal === "function") {
    elements.dialog.showModal();
  } else {
    showToast("Your browser does not support detail dialogs.");
  }
}

function exportCSV() {
  const filtered = getFilteredAsteroids();

  if (!filtered.length) {
    showToast("There are no asteroids to export.");
    return;
  }

  const columns = [
    "id",
    "name",
    "potentially_hazardous",
    "minimum_diameter_m",
    "maximum_diameter_m",
    "velocity_kmh",
    "miss_distance_km",
    "miss_distance_lunar",
    "approach_date",
    "orbiting_body",
    "nasa_jpl_url"
  ];

  function csvCell(value) {
    // Prevent spreadsheet formula injection and quote CSV values.
    let text = String(value ?? "");

    if (/^[\s]*[=+\-@\t\r]/.test(text)) {
      text = "'" + text;
    }

    return '"' + text.replace(/"/g, '""') + '"';
  }

  const rows = filtered.map((asteroid) => {
    const approach = getClosestApproach(asteroid);
    const diameter = asteroid.estimated_diameter?.meters;

    return [
      asteroid.id,
      asteroid.name,
      isHazardous(asteroid),
      diameter?.estimated_diameter_min,
      diameter?.estimated_diameter_max,
      getVelocity(asteroid),
      getDistanceKm(asteroid),
      getDistanceLunar(asteroid),
      approach?.close_approach_date,
      approach?.orbiting_body,
      asteroid.nasa_jpl_url
    ];
  });

  const csv = [
    columns.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(","))
  ].join("\r\n");

  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `asteroid-report-${new Date().toISOString().slice(0, 10)}.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
  showToast(`Exported ${filtered.length} asteroids to CSV.`);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 2800);
}

// Event listeners

elements.refresh.addEventListener("click", fetchAsteroids);

elements.range.addEventListener("change", fetchAsteroids);

elements.search.addEventListener("input", renderTable);

elements.hazard.addEventListener("change", renderTable);

elements.sort.addEventListener("change", renderTable);

elements.export.addEventListener("click", exportCSV);

// Event delegation: works for every dynamically rendered table row.
elements.table.addEventListener("click", (event) => {
  const button = event.target.closest("[data-asteroid-id]");

  if (button) {
    openAsteroidDetails(button.dataset.asteroidId);
  }
});

// Load live NASA data when the page starts.
fetchAsteroids();
