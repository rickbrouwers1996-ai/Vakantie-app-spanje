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
    return `https://www.google.com/maps?saddr=${origin}&daddr=${rest}&dirflg=w&output=embed`;
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

  // ---------------- trains ----------------
  function allTrains() {
    const trains = [];
    DATA.days.forEach((d) => {
      (d.stops || []).forEach((s) => {
        if (s.transit && /^trein/i.test(s.name.trim())) {
          trains.push({ date: d.date, time: s.time, name: s.name, detail: s.detail });
        }
      });
    });
    return trains.sort((a, b) => a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date));
  }

  function parseStopDateTime(dateStr, timeStr) {
    const clean = timeStr.replace(/[^\d:]/g, "");
    const [h, m] = clean.split(":").map(Number);
    const dt = new Date(dateStr + "T00:00:00");
    dt.setHours(h || 0, m || 0, 0, 0);
    return dt;
  }

  function describeCountdown(dt) {
    const diffMs = dt - new Date();
    if (diffMs <= 0) return null;
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < 60) return `over ${diffMin} min`;
    const diffH = diffMs / 3600000;
    if (diffH < 24) {
      const h = Math.floor(diffH);
      const m = Math.round((diffH - h) * 60);
      return m > 0 ? `over ${h}u ${m}m` : `over ${h} uur`;
    }
    const diffDays = Math.ceil(diffH / 24);
    return `over ${diffDays} ${diffDays === 1 ? "dag" : "dagen"}`;
  }

  function trainsSection() {
    const trains = allTrains();
    if (!trains.length) return "";
    const today = todayLocalISO();
    let nextMarked = false;
    const rows = trains.map((t) => {
      const dt = parseStopDateTime(t.date, t.time);
      const isPast = t.date < today || (t.date === today && dt < new Date());
      const countdown = isPast ? null : describeCountdown(dt);
      const isNext = !isPast && !nextMarked;
      if (isNext) nextMarked = true;
      const title = t.name.replace(/^trein\s*/i, "");
      return `
        <a href="#/dag/${t.date}" class="train-row ${isPast ? "is-past" : ""} ${isNext ? "is-next" : ""}">
          <div class="train-date">
            <div class="train-date-num">${dayNum(t.date)}</div>
            <div class="train-date-mon">${esc(shortMonth(t.date))}</div>
          </div>
          <div class="train-main">
            <div class="train-name">🚆 ${esc(title)}</div>
            <div class="train-detail">${esc(t.time)} · ${esc(t.detail)}</div>
          </div>
          ${isPast ? `<div class="train-badge is-past">✓</div>` : isNext && countdown ? `<div class="train-badge is-next">${esc(countdown)}</div>` : ""}
        </a>`;
    }).join("");
    return `
      <section class="section">
        <div class="section-title">Treinen</div>
        <p class="section-desc">${trains.length} geboekte treinen tussen de steden.</p>
        ${rows}
      </section>`;
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
      ${trainsSection()}
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
        ${c.foodGuide ? `<a href="#/eten/${c.id}" class="hotel-food-link">🍽️ Eten &amp; drinken bij dit hotel →</a>` : ""}
      </section>` : ""}

      <section class="section" style="padding-top:0;">
        <div class="day-group-label">Dagen</div>
        ${days.map(dayRow).join("")}
      </section>
    `;
  }

  function foodGuideSection(fg) {
    const groups = [
      { key: "breakfast", label: "Ontbijt — bakkerijen", img: "images/breakfast.png", items: fg.breakfast },
      { key: "bar", label: "Borrelen in de buurt", img: "images/bar.png", items: fg.bar },
      { key: "dinner", label: "Diner in de buurt", img: "images/dinner.png", items: fg.dinner },
    ];
    return groups.filter((g) => g.items && g.items.length).map((g) => `
      <div class="food-group">
        <div class="food-group-head">
          <img class="food-group-img" src="${g.img}" alt="" loading="lazy" />
          <div class="food-group-label">${esc(g.label)}</div>
          <div class="food-group-count">${g.items.length}</div>
        </div>
        <div class="food-scroll">
          ${g.items.map((it) => `
            <a class="food-card" href="${mapsOpenUrl([it.name + ", " + it.area])}" target="_blank" rel="noopener">
              <div class="food-card-name">${esc(it.name)}</div>
              <div class="food-card-area">${esc(it.area)}</div>
              <div class="food-card-note">${esc(it.note)}</div>
              <div class="food-card-link">Open in Maps ↗</div>
            </a>
          `).join("")}
        </div>
      </div>
    `).join("");
  }

  function viewEten(focusCityId) {
    const cities = [...DATA.cities].sort((a, b) => a.order - b.order).filter((c) => c.foodGuide);
    return `
      ${header({ title: "Eten & drinken", sub: "Ontbijt, borrel en diner rond elk hotel", plain: true })}
      <section class="section" style="padding-top:18px;">
        <p class="section-desc">Check openingstijden vooraf — vooral bakkerijen sluiten vaak vroeg in de middag.</p>
      </section>
      ${cities.map((c) => `
        <section class="section eten-city-section" id="stad-${c.id}" style="padding-top:6px;">
          <div class="eten-city-head">
            <div class="section-title" style="margin-bottom:0;">${esc(c.name)}</div>
            ${c.hotel ? `<div class="eten-city-hotel">🏨 ${esc(c.hotel.name)}</div>` : ""}
          </div>
          ${foodGuideSection(c.foodGuide)}
        </section>
      `).join("")}
    `;
  }

  function viewHighlights() {
    const cities = [...DATA.cities].sort((a, b) => a.order - b.order);
    return `
      ${header({ title: "Highlights", sub: `${DATA.highlights.length} bezienswaardigheden met achtergrondverhaal`, plain: true })}
      <section class="section" style="padding-top:18px;">
        <p class="section-desc">Een paar weetjes bij elke grote stop onderweg.</p>
      </section>
      ${cities.map((c) => {
        const items = DATA.highlights.filter((h) => h.city === c.id);
        if (!items.length) return "";
        return `
        <section class="section" style="padding-top:6px;">
          <div class="section-title">${esc(c.name)}</div>
          ${items.map(highlightCard).join("")}
        </section>`;
      }).join("")}
    `;
  }

  function highlightCard(h) {
    const img = h.photo || `images/highlights/${h.id}.png`;
    const day = dayById(h.date);
    return `
      <a class="highlight-card" href="#/highlight/${h.id}">
        <img class="highlight-card-img" src="${img}" alt="" loading="lazy" />
        <div class="highlight-card-body">
          <div class="highlight-card-name">${esc(h.name)}</div>
          <ul class="highlight-card-facts">
            ${h.facts.slice(0, 2).map((f) => `<li>${esc(f)}</li>`).join("")}
          </ul>
          <div class="highlight-card-day">${day ? `Bezocht op ${esc(day.weekday.toLowerCase())} ${dayNum(h.date)} ${esc(shortMonth(h.date))}` : ""} · Meer weetjes →</div>
        </div>
      </a>
    `;
  }

  function viewHighlightDetail(id) {
    const h = DATA.highlights.find((x) => x.id === id);
    if (!h) return viewNotFound();
    const city = cityById(h.city);
    const day = dayById(h.date);
    const img = h.photo || `images/highlights/${h.id}.png`;
    return `
      ${header({ title: h.name, sub: city ? city.name : "", back: "#/highlights" })}
      <section class="section" style="padding-top:18px;">
        <img class="hero-photo" src="${img}" alt="" />
        <div class="hl-meta-row">
          ${city ? `<span class="hl-chip">${esc(city.name)}</span>` : ""}
          ${day ? `<a href="#/dag/${h.date}" class="hl-chip hl-chip-link">${esc(day.weekday)} ${dayNum(h.date)} ${esc(shortMonth(h.date))} →</a>` : ""}
        </div>
      </section>
      <section class="section" style="padding-top:4px;">
        <div class="info-card hl-tip-card">
          <div class="hl-tip-top">
            <h3>💡 Tip</h3>
            <span class="hl-duration">⏱ ${esc(h.duration)}</span>
          </div>
          <p>${esc(h.tip)}</p>
        </div>
      </section>
      <section class="section" style="padding-top:4px;">
        <div class="section-title">Weetjes</div>
        <ul class="hl-facts-list">
          ${h.facts.map((f) => `<li>${esc(f)}</li>`).join("")}
        </ul>
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

      <p class="footnote">Check actuele reistijden en openingstijden in Google Maps.</p>
      ${notesSection(date)}
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
      ${notesSection(d.date)}
    `;
  }

  // ---------------- personal notes (localStorage) ----------------
  function notesKey(date) {
    return `spanje2026-note-${date}`;
  }

  function notesSection(date) {
    let saved = "";
    try {
      saved = localStorage.getItem(notesKey(date)) || "";
    } catch (e) { /* localStorage unavailable */ }
    return `
      <section class="section">
        <div class="section-title">Mijn aantekeningen</div>
        <textarea class="notes-input" data-note-date="${date}" placeholder="Typ hier je eigen aantekeningen voor deze dag — tips, herinneringen, wat dan ook.">${esc(saved)}</textarea>
      </section>`;
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

  function viewNotFound() {
    return `${header({ title: "Niet gevonden", back: "#/" })}<div class="empty-state">Deze pagina bestaat niet.</div>`;
  }

  // ---------------- search ----------------
  function viewZoeken() {
    return `
      ${header({ title: "Zoeken", plain: true })}
      <section class="section" style="padding-top:18px;">
        <input type="search" class="search-input" id="search-input" placeholder="Zoek op highlight, eten of dag…" autocomplete="off" />
      </section>
      <section class="section" id="search-results" style="padding-top:0;">
        <p class="section-desc">Typ om te zoeken door highlights, eten &amp; drinken en dagen.</p>
      </section>
    `;
  }

  function normalizeSearch(s) {
    return String(s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function searchAll(query) {
    const q = normalizeSearch(query.trim());
    if (!q) return null;
    const highlights = DATA.highlights.filter((h) => {
      const city = cityById(h.city);
      const haystack = normalizeSearch([h.name, city ? city.name : "", h.tip, h.facts.join(" ")].join(" "));
      return haystack.includes(q);
    });
    const food = [];
    DATA.cities.forEach((c) => {
      if (!c.foodGuide) return;
      ["breakfast", "bar", "dinner"].forEach((key) => {
        (c.foodGuide[key] || []).forEach((item) => {
          if (normalizeSearch(item.name).includes(q) || normalizeSearch(item.area).includes(q)) {
            food.push({ ...item, cityName: c.name });
          }
        });
      });
    });
    const days = allDaysOrdered().filter((d) => {
      const city = cityById(d.city);
      return normalizeSearch(d.title).includes(q) || (city && normalizeSearch(city.name).includes(q));
    });
    return { highlights, food, days };
  }

  function searchResultRow(href, title, sub, opts) {
    const external = opts && opts.external;
    return `
      <a href="${href}" class="search-result" ${external ? 'target="_blank" rel="noopener"' : ""}>
        <div class="search-result-main">
          <div class="search-result-title">${esc(title)}</div>
          <div class="search-result-sub">${esc(sub)}</div>
        </div>
        <div class="search-result-chevron">${external ? "↗" : "›"}</div>
      </a>`;
  }

  function renderSearchResults(query) {
    const container = document.getElementById("search-results");
    if (!container) return;
    const result = searchAll(query);
    if (!result) {
      container.innerHTML = `<p class="section-desc">Typ om te zoeken door highlights, eten &amp; drinken en dagen.</p>`;
      return;
    }
    const { highlights, food, days } = result;
    if (!highlights.length && !food.length && !days.length) {
      container.innerHTML = `<p class="section-desc">Niets gevonden.</p>`;
      return;
    }
    container.innerHTML = `
      ${days.length ? `
        <div class="search-group">
          <div class="search-group-label">Dagen</div>
          ${days.map((d) => {
            const city = cityById(d.city);
            return searchResultRow(`#/dag/${d.date}`, d.title, `${d.weekday} · ${city ? city.name : ""}`);
          }).join("")}
        </div>` : ""}
      ${highlights.length ? `
        <div class="search-group">
          <div class="search-group-label">Highlights</div>
          ${highlights.map((h) => {
            const city = cityById(h.city);
            return searchResultRow(`#/highlight/${h.id}`, h.name, city ? city.name : "");
          }).join("")}
        </div>` : ""}
      ${food.length ? `
        <div class="search-group">
          <div class="search-group-label">Eten &amp; drinken</div>
          ${food.map((it) => searchResultRow(
            mapsOpenUrl([it.name + ", " + it.area]), it.name, `${it.area} · ${it.cityName}`, { external: true }
          )).join("")}
        </div>` : ""}
    `;
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
      case "eten":
        html = viewEten(arg);
        break;
      case "highlights":
        html = viewHighlights();
        break;
      case "highlight":
        html = viewHighlightDetail(arg);
        tabRoute = "highlights";
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
      case "zoeken":
        html = viewZoeken();
        break;
      default:
        html = viewNotFound();
    }
    app.innerHTML = html;
    if (seg === "eten" && arg) {
      const target = document.getElementById(`stad-${arg}`);
      if (target) {
        target.scrollIntoView({ block: "start" });
      } else {
        window.scrollTo(0, 0);
      }
    } else {
      window.scrollTo(0, 0);
    }
    updateTabbar(tabRoute);

    const searchInput = document.getElementById("search-input");
    if (searchInput) {
      searchInput.addEventListener("input", () => renderSearchResults(searchInput.value));
    }
    const notesEl = document.querySelector(".notes-input");
    if (notesEl) {
      notesEl.addEventListener("input", () => {
        try {
          localStorage.setItem(notesKey(notesEl.dataset.noteDate), notesEl.value);
        } catch (e) { /* localStorage unavailable */ }
      });
    }
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
