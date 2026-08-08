(() => {
  "use strict";

  const app = document.getElementById("app");
  const tabbar = document.getElementById("tabbar");
  let DATA = null;

  const MONTHS_NL = ["januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"];

  // ---------------- utils ----------------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  const qs = (sel, root = document) => root.querySelector(sel);

  function todayLocalISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function dayNum(dateStr) {
    return parseInt(dateStr.slice(8, 10), 10);
  }

  function shortMonth(dateStr) {
    const m = parseInt(dateStr.slice(5, 7), 10) - 1;
    return MONTHS_NL[m].slice(0, 3);
  }

  function cityById(id) {
    return DATA.cities.find((c) => c.id === id);
  }

  function dayById(date) {
    if (date === DATA.departure.date) return DATA.departure;
    return DATA.days.find((d) => d.date === date);
  }

  function allDaysOrdered() {
    return [...DATA.days, DATA.departure].sort((a, b) => a.date.localeCompare(b.date));
  }

  // ---------------- google maps helpers ----------------
  function routePlaces(stops) {
    const places = (stops || [])
      .filter((s) => !s.transit && s.place)
      .map((s) => s.place);
    // dedupe consecutive duplicates
    return places.filter((p, i) => i === 0 || p !== places[i - 1]);
  }

  function mapsEmbedUrl(places) {
    if (!places.length) return null;
    if (places.length === 1) {
      return `https://www.google.com/maps?q=${encodeURIComponent(places[0])}&output=embed`;
    }
    const origin = encodeURIComponent(places[0]);
    const rest = places.slice(1).map(encodeURIComponent).join("+to:");
    return `https://www.google.com/maps?saddr=${origin}&daddr=${rest}&output=embed`;
  }

  function mapsOpenUrl(places) {
    if (!places.length) return "#";
    if (places.length === 1) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(places[0])}`;
    }
    const origin = places[0];
    const destination = places[places.length - 1];
    const waypoints = places.slice(1, -1);
    let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=walking`;
    if (waypoints.length) url += `&waypoints=${encodeURIComponent(waypoints.join("|"))}`;
    return url;
  }

  // ---------------- header ----------------
  function header({ title, sub, back, plain }) {
    return `
      <header class="page-header ${plain ? "plain" : ""}">
        <div class="header-row">
          ${back ? `<a href="${back}" class="back-btn">‹</a>` : ""}
          <div>
            <div class="header-title">${esc(title)}</div>
            ${sub ? `<div class="header-sub">${esc(sub)}</div>` : ""}
          </div>
        </div>
      </header>`;
  }

  // ---------------- trip status ----------------
  function tripStatus() {
    const today = todayLocalISO();
    const { startDate, endDate } = DATA.meta;
    if (today < startDate) {
      const diffDays = Math.round((new Date(startDate) - new Date(today)) / 86400000);
      return { phase: "before", text: `Nog ${diffDays} ${diffDays === 1 ? "dag" : "dagen"} tot vertrek` };
    }
    if (today > endDate) {
      return { phase: "after", text: "Reis afgelopen — hopelijk een topvakantie gehad" };
    }
    const d = dayById(today);
    if (d) {
      return { phase: "during", text: `Vandaag: ${d.title}`, date: today };
    }
    return { phase: "during", text: "Onderweg vandaag", date: today };
  }

  // ---------------- views ----------------
  function viewHome() {
    const status = tripStatus();
    const cities = [...DATA.cities].sort((a, b) => a.order - b.order);
    return `
      <section class="hero">
        <div class="hero-eyebrow">${esc(DATA.meta.dateRangeLabel)}</div>
        <h1 class="hero-title">${esc(DATA.meta.title)}</h1>
        <p class="hero-subtitle">${esc(DATA.meta.subtitle)}</p>
        <a href="${status.date ? "#/dag/" + status.date : "#/dagen"}" class="status-pill">
          <span class="dot"></span>${esc(status.text)}
        </a>
        <div class="stat-grid">
          <div class="stat-card"><div class="stat-num">${DATA.meta.stats.days}</div><div class="stat-label">dagen</div></div>
          <div class="stat-card"><div class="stat-num">${DATA.meta.stats.cities}</div><div class="stat-label">steden</div></div>
          <div class="stat-card"><div class="stat-num">${DATA.meta.stats.hotels}</div><div class="stat-label">hotels</div></div>
          <div class="stat-card"><div class="stat-num">${DATA.meta.stats.freeMoments}</div><div class="stat-label">gratis momenten</div></div>
        </div>
      </section>
      <section class="section">
        <div class="section-title">De reis in één oogopslag</div>
        <p class="section-desc">${esc(DATA.meta.routeIntro)}</p>
        ${cities.map(cityCard).join("")}
      </section>
      <p class="footnote">${esc(DATA.meta.pricesCheckedNote)}</p>
    `;
  }

  function cityCard(c) {
    return `
      <a href="#/stad/${c.id}" class="city-card">
        <span class="city-nights">${c.nights} nachten</span>
        <div class="city-card-top">
          <span class="city-order">${c.order}</span>
          <div>
            <p class="city-name">${esc(c.name)}</p>
            <div class="city-dates">${esc(c.dateRangeLabel)}</div>
          </div>
        </div>
        <div class="city-highlights">${esc(c.highlightsSummary)}</div>
        <span class="city-note">${esc(c.note)}</span>
      </a>`;
  }

  function viewCity(id) {
    const c = cityById(id);
    if (!c) return viewNotFound();
    const days = c.days.map(dayById);
    const h = c.hotel;
    const hotelMapUrl = h ? mapsOpenUrl([h.place]) : null;
    return `
      ${header({ title: c.name, sub: `${c.nights} nachten`, back: "#/" })}
      <section class="section" style="padding-top:18px;">
        <p class="section-desc">${esc(c.description)}</p>
      </section>

      ${h ? `
      <section class="section" style="padding-top:0;">
        <div class="section-title">Hotel</div>
        <a class="hotel-card" href="${hotelMapUrl}" target="_blank" rel="noopener">
          <div class="hotel-card-icon">🏨</div>
          <div class="hotel-card-body">
            <div class="hotel-card-name">${esc(h.name)}</div>
            <div class="hotel-card-area">${esc(h.neighborhood)}</div>
          </div>
          <div class="hotel-card-chevron">↗</div>
        </a>
        ${h.note ? `<p class="hotel-note">${esc(h.note)}</p>` : ""}
      </section>` : ""}

      ${c.foodGuide ? foodGuideSection(c.foodGuide) : ""}

      <section class="section" style="padding-top:0;">
        <div class="day-group-label">Dagen</div>
        ${days.map(dayRow).join("")}
      </section>
    `;
  }

  function foodGuideSection(fg) {
    const groups = [
      { key: "breakfast", label: "Ontbijt bij het hotel", img: "images/breakfast.png", items: fg.breakfast },
      { key: "bar", label: "Borrelen in de buurt", img: "images/bar.png", items: fg.bar },
      { key: "dinner", label: "Diner in de buurt", img: "images/dinner.png", items: fg.dinner },
    ];
    return `
      <section class="section" style="padding-top:0;">
        <div class="section-title">Eten &amp; drinken rond het hotel</div>
        <p class="section-desc">Sfeerbeelden per categorie — geen foto's van de zaken zelf, wel echte adressen op basis van lokale aanbevelingen.</p>
        ${groups.filter((g) => g.items && g.items.length).map((g) => `
          <div class="food-group">
            <div class="food-group-head">
              <img class="food-group-img" src="${g.img}" alt="" loading="lazy" />
              <div class="food-group-label">${esc(g.label)}</div>
            </div>
            ${g.items.map((it) => `
              <a class="food-item" href="${mapsOpenUrl([it.name + ", " + it.area])}" target="_blank" rel="noopener">
                <div class="food-item-main">
                  <div class="food-item-name">${esc(it.name)}</div>
                  <div class="food-item-area">${esc(it.area)}</div>
                  <div class="food-item-note">${esc(it.note)}</div>
                </div>
                <div class="food-item-chevron">↗</div>
              </a>
            `).join("")}
          </div>
        `).join("")}
      </section>
    `;
  }

  function dayRow(d) {
    const today = todayLocalISO();
    const isToday = d.date === today;
    const city = cityById(d.city);
    return `
      <a href="#/dag/${d.date}" class="day-row ${isToday ? "is-today" : ""}">
        <div class="day-date-block">
          <div class="day-date-num">${dayNum(d.date)}</div>
          <div class="day-date-dow">${shortMonth(d.date)}</div>
        </div>
        <div class="day-row-main">
          <div class="day-row-title">${esc(d.title)}${isToday ? '<span class="today-badge">Vandaag</span>' : ""}</div>
          <div class="day-row-sub">${esc(d.weekday)} · ${esc(city ? city.name : "")}</div>
        </div>
        <div class="day-row-chevron">›</div>
      </a>`;
  }

  function viewDaysList() {
    const cities = [...DATA.cities].sort((a, b) => a.order - b.order);
    return `
      ${header({ title: "Alle dagen", sub: DATA.meta.dateRangeLabel, plain: true })}
      <section class="section" style="padding-top:18px;">
        ${cities.map((c) => `
          <div class="day-group-label">${esc(c.name)}</div>
          ${c.days.map((date) => dayRow(dayById(date))).join("")}
        `).join("")}
        <div class="day-group-label">Vertrek</div>
        ${departureRow()}
      </section>
    `;
  }

  function departureRow() {
    const d = DATA.departure;
    const today = todayLocalISO();
    const isToday = d.date === today;
    return `
      <a href="#/vertrek" class="day-row ${isToday ? "is-today" : ""}">
        <div class="day-date-block">
          <div class="day-date-num">${dayNum(d.date)}</div>
          <div class="day-date-dow">${shortMonth(d.date)}</div>
        </div>
        <div class="day-row-main">
          <div class="day-row-title">${esc(d.title)}${isToday ? '<span class="today-badge">Vandaag</span>' : ""}</div>
          <div class="day-row-sub">${esc(d.weekday)} · Málaga (AGP)</div>
        </div>
        <div class="day-row-chevron">›</div>
      </a>`;
  }

  function stopHtml(s, isLast) {
    return `
      <div class="stop ${s.transit ? "is-transit" : ""} ${s.hotel ? "is-hotel" : ""}">
        <div class="stop-rail">
          <div class="stop-dot"></div>
          ${isLast ? "" : '<div class="stop-line"></div>'}
        </div>
        <div class="stop-body">
          <div class="stop-time">${s.hotel ? "🏨 Hotel" : esc(s.time)}</div>
          <div class="stop-name">${esc(s.name)}</div>
          ${s.detail ? `<div class="stop-detail">${esc(s.detail)}</div>` : ""}
          ${s.transit ? '<div class="stop-transit-tag">Onderweg tussen steden</div>' : ""}
        </div>
      </div>`;
  }

  function viewDay(date) {
    const d = dayById(date);
    if (!d) return viewNotFound();
    if (d === DATA.departure) return viewDeparture();
    const city = cityById(d.city);
    const places = routePlaces(d.stops);
    const embed = mapsEmbedUrl(places);
    const openUrl = mapsOpenUrl(places);

    return `
      <header class="page-header">
        <div class="header-row">
          <a href="#/stad/${d.city}" class="back-btn">‹</a>
          <div>
            <div class="header-title">${esc(d.displayDate)}</div>
            <div class="header-sub">${esc(city ? city.name : "")} · ${esc(d.title)}</div>
          </div>
        </div>
        <div class="day-hero-meta">
          <span class="meta-chip">📍 ${esc(d.distance)}</span>
        </div>
      </header>

      <div class="timeline">
        ${d.stops.map((s, i) => stopHtml(s, i === d.stops.length - 1)).join("")}
      </div>

      ${places.length >= 1 ? `
      <div class="map-card">
        <div class="map-card-head">Route van vandaag</div>
        <div class="map-card-sub">Google Maps · ${esc(d.distance)}</div>
        <iframe class="map-embed" src="${embed}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
        <div class="map-actions">
          <a class="btn primary" href="${openUrl}" target="_blank" rel="noopener">Open route in Google Maps</a>
        </div>
        <div class="map-card-sub" style="padding-top:0;">Laadt de kaart hierboven niet? De knop opent de route altijd, ook offline gepland.</div>
      </div>` : ""}

      ${d.dinnerTip ? `
      <div class="dinner-tip-card">
        <img class="dinner-tip-img" src="images/dinner.png" alt="" loading="lazy" />
        <div class="dinner-tip-body">
          <div class="dinner-tip-kicker">Etentip voor vanavond</div>
          <div class="dinner-tip-name">${esc(d.dinnerTip.name)}</div>
          <div class="dinner-tip-area">${esc(d.dinnerTip.area)}</div>
          <div class="dinner-tip-note">${esc(d.dinnerTip.note)}</div>
          <a class="dinner-tip-link" href="${mapsOpenUrl([d.dinnerTip.name + ", " + d.dinnerTip.area])}" target="_blank" rel="noopener">Open in Google Maps ↗</a>
        </div>
      </div>` : ""}

      <p class="footnote">Kaart is een indicatie op basis van de genoemde plekken — check actuele reistijden in Google Maps zelf. Restaurant- en baradressen zijn aanbevelingen op basis van recente lokale bronnen, geen persoonlijke bezoeken — check openingstijden vooraf.</p>
    `;
  }

  function viewDeparture() {
    const d = DATA.departure;
    return `
      ${header({ title: d.displayDate, sub: "Vertrekdag · Málaga (AGP)", back: "#/stad/malaga" })}
      <section class="section" style="padding-top:18px;">
        <p class="section-desc">${esc(d.intro)}</p>
        ${d.scenarios.map((sc) => `
          <div class="scenario-card">
            <div class="scenario-top">
              <div class="scenario-name">${esc(sc.name)}</div>
              <div class="scenario-time">${esc(sc.timeLabel)}</div>
            </div>
            <div class="scenario-note">${esc(sc.note)}</div>
            <ol class="scenario-steps">
              ${sc.steps.map((st) => `<li>${esc(st)}</li>`).join("")}
            </ol>
          </div>
        `).join("")}
      </section>
      <p class="footnote">${esc(d.footnote)}</p>
    `;
  }

  function viewTickets() {
    const t = DATA.tickets;
    return `
      ${header({ title: "Tickets", sub: t.note, plain: true })}
      <section class="section" style="padding-top:18px;">
        ${t.rows.map((r) => `
          <div class="ticket-row">
            <div class="ticket-row-top">
              <div class="ticket-name">${esc(r.name)}</div>
              <div class="ticket-price">${esc(r.price)}</div>
            </div>
            <div class="ticket-meta ${/GRATIS|altijd/.test(r.free) ? "ticket-free" : ""}">${esc(r.free)}</div>
            <div class="ticket-meta">Boeken: ${esc(r.booking)}</div>
            <div class="ticket-site">${esc(r.site)}</div>
          </div>
        `).join("")}
      </section>
      <p class="footnote">${esc(t.footnote)}</p>

      <section class="section">
        <div class="section-title">Wat wanneer boeken</div>
        <p class="section-desc">${esc(DATA.booking.note)}</p>
        ${DATA.booking.items.map((b) => `
          <div class="booking-row ${b.done ? "is-done" : ""}">
            <div class="booking-check">${b.done ? "✓" : ""}</div>
            <div>
              <div class="booking-name">${esc(b.name)}</div>
              <div class="booking-when">${esc(b.when)}</div>
              <div class="booking-note">${esc(b.note)}</div>
            </div>
          </div>
        `).join("")}
      </section>
      <p class="footnote">${esc(DATA.booking.footnote)}</p>
    `;
  }

  function viewTips() {
    const w = DATA.warnings;
    return `
      ${header({ title: "Let op", sub: w.note, plain: true })}
      <section class="section" style="padding-top:18px;">
        ${w.items.map((it) => `
          <div class="warning-card">
            <h3>${esc(it.title)}</h3>
            <p>${esc(it.text)}</p>
          </div>
        `).join("")}
        <p class="section-desc" style="text-align:center; font-weight:700; margin-top:10px;">${esc(w.closing)}</p>
      </section>
    `;
  }

  function viewNotFound() {
    return `${header({ title: "Niet gevonden", back: "#/" })}<div class="empty-state">Deze pagina bestaat niet.</div>`;
  }

  // ---------------- router ----------------
  function parseRoute() {
    const hash = location.hash.replace(/^#\/?/, "");
    const [seg, arg] = hash.split("/");
    return { seg: seg || "", arg };
  }

  function render() {
    const { seg, arg } = parseRoute();
    let html = "";
    let tabRoute = seg;
    switch (seg) {
      case "":
        html = viewHome();
        tabRoute = "";
        break;
      case "stad":
        html = viewCity(arg);
        tabRoute = "dagen";
        break;
      case "dagen":
        html = viewDaysList();
        break;
      case "dag":
        html = viewDay(arg);
        tabRoute = "dagen";
        break;
      case "vertrek":
        html = viewDeparture();
        tabRoute = "dagen";
        break;
      case "tickets":
        html = viewTickets();
        break;
      case "tips":
        html = viewTips();
        break;
      default:
        html = viewNotFound();
    }
    app.innerHTML = html;
    window.scrollTo(0, 0);
    updateTabbar(tabRoute);
  }

  function updateTabbar(route) {
    tabbar.querySelectorAll(".tab").forEach((t) => {
      t.classList.toggle("is-active", t.dataset.route === route);
    });
  }

  // ---------------- boot ----------------
  function boot() {
    fetch("data/trip.json")
      .then((r) => r.json())
      .then((data) => {
        DATA = data;
        window.addEventListener("hashchange", render);
        render();
      })
      .catch((err) => {
        app.innerHTML = `<div class="empty-state">Kon reisdata niet laden.<br>${esc(err.message)}</div>`;
      });
  }

  document.addEventListener("DOMContentLoaded", boot);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
