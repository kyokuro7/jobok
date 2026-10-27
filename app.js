const API = "/api";
const $ = (s) => document.querySelector(s);
const state = { view: "home", page: 1, query: "", type: "", lastItems: [], currentAnime: null };
const copy = {
  home: ["RILIS TERBARU", "Anime terbaru", "Temukan episode terbaru dan anime yang sedang ramai dibicarakan."],
  ongoing: ["SEDANG TAYANG", "Anime ongoing", "Lanjutkan mengikuti anime yang masih berlanjut."],
  upcoming: ["SELESAI TAYANG", "Anime completed", "Jelajahi serial yang sudah selesai tayang."],
  all: ["JELAJAHI KATALOG", "Semua anime", "Cari judul baru untuk masuk ke daftar tontonanmu."],
  search: ["HASIL PENCARIAN", "Hasil pencarian", "Anime yang cocok dengan kata kuncimu."]
};

async function api(path) {
  const response = await fetch(`${API}${path}`, { headers: { Accept: "application/json" } });
  let json;
  try { json = await response.json(); } catch { throw new Error(`Respons API tidak valid (${response.status}).`); }
  if (!response.ok || json.statusCode >= 400 || json.ok === false) {
    throw new Error(json.message || json.error || `Request gagal (${response.status}).`);
  }
  if (json.statusCode && json.statusCode >= 400) throw new Error(json.message || "API mengembalikan error.");
  return json.data;
}
function safe(v, fallback = "") { return v == null || v === "" ? fallback : String(v); }
function esc(v) { return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function slugFromHref(href) { try { const u = new URL(href); return u.pathname.split("/").filter(Boolean).pop() || ""; } catch { return String(href || "").split("/").filter(Boolean).pop() || ""; } }
function toast(msg) { const el = $("#toast"); el.textContent = msg; el.classList.add("show"); setTimeout(() => el.classList.remove("show"), 3000); }
function setStatus(msg = "", error = false) { const el = $("#status"); if (el) { el.textContent = msg; el.classList.toggle("error", error); } }
function setViewNav(view) { document.querySelectorAll(".nav-link").forEach(b => b.classList.toggle("active", b.dataset.view === view)); }
function showSection(which) {
  $("#hero").classList.toggle("hidden", which === "detail" || which === "player");
  $(".quick-stats").classList.toggle("hidden", which === "detail" || which === "player");
  $("#content").classList.toggle("hidden", which !== "content");
  $("#schedule-section").classList.add("hidden");
  $("#detail-section").classList.toggle("hidden", which !== "detail" && which !== "player");
}
function normalizeAnime(a) {
  return { ...a, slug: a.slug || (a.href ? slugFromHref(a.href) : ""), title: a.title || a.seriesName || "Judul tidak tersedia" };
}
function card(raw) {
  const a = normalizeAnime(raw), title = safe(a.title, "Judul tidak tersedia"), poster = safe(a.poster);
  return `<article class="anime-card" tabindex="0" role="button" aria-label="Lihat detail ${esc(title)}" data-slug="${esc(a.slug)}" data-href="${esc(a.href || "")}" ${a.slug ? "" : 'data-disabled="true"'}>
    <div class="poster-wrap">${poster ? `<img src="${esc(poster)}" alt="Poster ${esc(title)}" loading="lazy" onerror="this.remove()">` : `<div class="poster-placeholder">${esc(title)}</div>`}
    ${a.type ? `<span class="poster-badge">${esc(a.type)}</span>` : ""}<div class="poster-overlay"><span>Lihat detail</span><span class="play-mark">↗</span></div></div>
    <div class="anime-title">${esc(title)}</div><div class="anime-meta"><span>${esc(a.status || a.episode || "Anime")}</span><span>${esc(a.type || "")}</span></div></article>`;
}
function renderGrid(items) {
  const grid = $("#anime-grid");
  if (!Array.isArray(items) || !items.length) { grid.innerHTML = '<div class="empty-state"><strong>Belum ada anime ditemukan</strong>Coba kata kunci atau kategori lain.</div>'; return; }
  grid.innerHTML = items.map(card).join("");
  grid.querySelectorAll(".anime-card").forEach(el => {
    const open = () => { if (el.dataset.slug) loadDetail(el.dataset.slug); else if (el.dataset.href) loadEpisode(slugFromHref(el.dataset.href)); };
    el.addEventListener("click", open);
    el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  });
}
function renderPagination(page, hasNext) {
  $("#pagination").innerHTML = `<button class="page-button" data-page="${Math.max(1,page-1)}" ${page <= 1 ? "disabled" : ""}>← Sebelumnya</button><button class="page-button active">${page}</button><button class="page-button" data-page="${page+1}" ${!hasNext ? "disabled" : ""}>Berikutnya →</button>`;
  $("#pagination").querySelectorAll("[data-page]").forEach(b => b.addEventListener("click", () => { state.page = Number(b.dataset.page); loadView(state.view); window.scrollTo({ top: $("#content").offsetTop - 20, behavior: "smooth" }); }));
}
async function loadView(view = state.view) {
  state.view = view; setViewNav(view); showSection("content"); $("#pagination").innerHTML = "";
  const cfg = copy[view] || copy.home;
  $("#section-kicker").textContent = cfg[0]; $("#section-title").innerHTML = `${cfg[1]} <span class="heading-spark">✦</span>`; $("#section-subtitle").textContent = cfg[2];
  $("#refresh-btn").disabled = true; setStatus("Memuat data anime...");
  let path;
  if (view === "home") path = "/home";
  else if (view === "ongoing") path = "/anime?status=ongoing&order=update&page=" + state.page;
  else if (view === "upcoming") path = "/anime?status=completed&order=update&page=" + state.page;
  else if (view === "all") path = `/anime?order=update&page=${state.page}`;
  else path = `/search?q=${encodeURIComponent(state.query)}`;
  try {
    const data = await api(path);
    let items;
    if (view === "home") items = data?.latestRelease?.animeList || [];
    else items = data?.animeList || [];
    if (view === "home") items = items.slice(0, 18);
    if (state.type) items = items.filter(a => !a.type || a.type.toLowerCase() === state.type.toLowerCase());
    state.lastItems = items; renderGrid(items);
    setStatus(`${items.length} item ditampilkan${view === "home" ? " · klik kartu episode untuk menonton" : ""}.`);
    renderPagination(state.page, view !== "search" && items.length > 0);
  } catch (err) { renderGrid([]); setStatus(`${err.message} Periksa koneksi dan endpoint API.`, true); toast("Gagal memuat data dari API."); }
  finally { $("#refresh-btn").disabled = false; }
}
function renderEpisodePlayer(details, slug) {
  const playerUrl = details.streamingUrl;
  const validUrl = (() => { try { const u = new URL(playerUrl); return u.protocol === "https:" || u.protocol === "http:"; } catch { return false; } })();
  const prevSlug = details.prevEpisode?.href ? slugFromHref(details.prevEpisode.href) : "";
  const nextSlug = details.nextEpisode?.href ? slugFromHref(details.nextEpisode.href) : "";
  showSection("player");
  const section = $("#detail-section");
  section.innerHTML = `<button class="detail-back" id="player-back">← Kembali ke anime</button>
    <div class="player-heading"><div class="eyebrow">SEDANG DIPUTAR</div><h2>${esc(details.title || "Episode anime")}</h2><p class="detail-synopsis">${esc(details.seriesName || "AniFams")}</p></div>
    ${validUrl ? `<div class="video-frame-wrap"><iframe class="video-frame" src="${esc(playerUrl)}" title="${esc(details.title || "Pemutar anime")}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>` : `<div class="empty-state"><strong>Sumber player belum tersedia</strong>API tidak mengembalikan streamingUrl yang valid untuk episode ini.</div>`}
    <div class="player-controls">${prevSlug ? `<button class="button button-ghost" id="prev-episode">← Episode sebelumnya</button>` : `<button class="button button-ghost" disabled>← Episode sebelumnya</button>`}<span class="detail-chip">Episode ${esc(details.episodeNumber || "—")}</span>${nextSlug ? `<button class="button button-primary" id="next-episode">Episode berikutnya →</button>` : `<button class="button button-primary" disabled>Episode berikutnya →</button>`}</div>
    <p class="detail-synopsis">Jika player tidak tampil, penyedia embed mungkin membatasi pemutaran dari situs lain.</p>`;
  $("#player-back").addEventListener("click", () => details.seriesSlug ? loadDetail(details.seriesSlug) : loadView("home"));
  if (prevSlug) $("#prev-episode").addEventListener("click", () => loadEpisode(prevSlug));
  if (nextSlug) $("#next-episode").addEventListener("click", () => loadEpisode(nextSlug));
}
async function loadEpisode(slug) {
  if (!slug) return;
  showSection("player"); $("#detail-section").innerHTML = '<div class="empty-state">Memuat episode dan sumber player...</div>'; window.scrollTo({ top: 0, behavior: "smooth" });
  try { const data = await api(`/episode/${encodeURIComponent(slug)}`); const details = data?.details || data; renderEpisodePlayer(details, slug); }
  catch (err) { $("#detail-section").innerHTML = `<button class="detail-back" id="episode-error-back">← Kembali</button><div class="empty-state"><strong>Episode gagal dimuat</strong>${esc(err.message)}</div>`; $("#episode-error-back").addEventListener("click", () => loadView("home")); }
}
async function loadDetail(slug) {
  if (!slug) return; showSection("detail"); setViewNav(""); const section = $("#detail-section"); section.innerHTML = '<div class="empty-state">Memuat detail anime...</div>'; window.scrollTo({ top: 0, behavior: "smooth" });
  try {
    const data = await api(`/anime/${encodeURIComponent(slug)}`); const a = data?.details || data; state.currentAnime = a;
    const episodes = Array.isArray(a.episodeList) ? a.episodeList : [];
    const synopsis = Array.isArray(a.synopsis?.paragraphList) ? a.synopsis.paragraphList.join("\n\n") : (a.synopsis || "Sinopsis belum tersedia.");
    const genres = Array.isArray(a.genres) ? a.genres : [];
    section.innerHTML = `<button class="detail-back" id="detail-back">← Kembali ke katalog</button><div class="detail-hero">${a.poster ? `<img class="detail-poster" src="${esc(a.poster)}" alt="Poster ${esc(a.title)}" onerror="this.style.visibility='hidden'">` : '<div class="detail-poster"></div>'}<div class="detail-info"><div class="eyebrow">DETAIL ANIME</div><h2>${esc(a.title || "Judul tidak tersedia")}</h2><div class="detail-chips">${a.rating ? `<span class="detail-chip">★ ${esc(a.rating)}</span>` : ""}${a.type ? `<span class="detail-chip">${esc(a.type)}</span>` : ""}${a.status ? `<span class="detail-chip">${esc(a.status)}</span>` : ""}<span class="detail-chip">${episodes.length} episode</span></div><p class="detail-synopsis">${esc(synopsis)}</p><div class="genre-list">${genres.map(g => `<span class="genre-link">${esc(g)}</span>`).join("")}</div></div></div><h3 class="episodes-heading">Daftar Episode <span class="heading-spark">✦</span></h3><div class="episode-grid">${episodes.length ? episodes.map(ep => `<button class="episode-card" data-episode-slug="${esc(slugFromHref(ep.href))}"><div class="episode-number">EPISODE ${esc(ep.episode || "—")}</div><div class="episode-title">${esc(ep.title || `Episode ${ep.episode || ""}`)}</div><div class="episode-date">${esc(ep.date || "Tanggal tidak tersedia")}</div></button>`).join("") : '<div class="empty-state">Daftar episode belum tersedia.</div>'}</div>`;
    $("#detail-back").addEventListener("click", () => loadView(state.view));
    section.querySelectorAll("[data-episode-slug]").forEach(b => b.addEventListener("click", () => loadEpisode(b.dataset.episodeSlug)));
  } catch (err) { section.innerHTML = `<button class="detail-back" id="detail-back">← Kembali</button><div class="empty-state"><strong>Detail gagal dimuat</strong>${esc(err.message)}</div>`; $("#detail-back").addEventListener("click", () => loadView(state.view)); }
}
$("#search-form").addEventListener("submit", e => { e.preventDefault(); const q = $("#search-input").value.trim(); if (!q) { toast("Masukkan judul anime yang ingin dicari."); return; } state.query = q; state.page = 1; state.type = ""; $("#type-filter").value = ""; loadView("search"); });
document.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", () => { const view = b.dataset.view; state.page = 1; state.type = ""; $("#type-filter").value = ""; $(".main-nav").classList.remove("open"); loadView(view); }));
$("#type-filter").addEventListener("change", e => { state.type = e.target.value; state.page = 1; loadView(state.view); });
$("#refresh-btn").addEventListener("click", () => loadView(state.view));
$("#mobile-menu").addEventListener("click", () => $(".main-nav").classList.toggle("open"));
loadView("home");
