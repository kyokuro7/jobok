const API = "https://api.rexxgraph.my.id";
const $ = (s) => document.querySelector(s);
const state = { view: "home", page: 1, query: "", type: "", scheduleDay: "Senin", schedule: {}, lastItems: [], loading: false };
const DAYS = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];
const copy = {
  home: ["PILIHAN UNTUKMU","Anime yang sedang tayang","Ikuti cerita yang sedang berlanjut minggu ini."],
  ongoing: ["UPDATE TERBARU","Anime sedang tayang","Temukan anime yang sedang berjalan."],
  upcoming: ["SEGERA HADIR","Anime mendatang","Lihat judul yang akan segera tayang."],
  all: ["JELAJAHI KATALOG","Semua anime","Cari judul baru untuk masuk ke daftar tontonanmu."],
  search: ["HASIL PENCARIAN","Hasil pencarian","Anime yang cocok dengan kata kuncimu."]
};

async function api(path) {
  const response = await fetch(`${API}${path}`, { headers: { "Accept": "application/json" } });
  let json;
  try { json = await response.json(); } catch { throw new Error(`Respons API tidak valid (${response.status}).`); }
  if (!response.ok || json.ok === false) throw new Error(json.error || `Request gagal (${response.status}).`);
  return json.data;
}
function safe(value, fallback = "") { return value == null || value === "" ? fallback : String(value); }
function esc(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function slugifyGenre(name) { return String(name).toLowerCase().trim().replace(/&/g,"and").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""); }
function showToast(message) { const el=$("#toast"); el.textContent=message; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),2600); }
function setStatus(message="", error=false) { const el=$("#status"); el.textContent=message; el.classList.toggle("error",error); }
function setViewNav(view) { document.querySelectorAll(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.view===view)); }
function showSection(which) {
  $("#hero").classList.toggle("hidden", which==="detail");
  $(".quick-stats").classList.toggle("hidden", which==="detail");
  $("#content").classList.toggle("hidden", which!=="content");
  $("#schedule-section").classList.toggle("hidden", which!=="schedule");
  $("#detail-section").classList.toggle("hidden", which!=="detail");
}
function card(anime) {
  const title=safe(anime.title,"Judul tidak tersedia"), poster=safe(anime.poster), score=anime.score;
  return `<article class="anime-card" tabindex="0" role="button" aria-label="Lihat detail ${esc(title)}" data-slug="${esc(anime.slug||"")}" ${anime.slug ? "" : 'data-disabled="true"'}>
    <div class="poster-wrap">${poster?`<img src="${esc(poster)}" alt="Poster ${esc(title)}" loading="lazy" onerror="this.remove();this.parentElement.insertAdjacentHTML('afterbegin','<div class=&quot;poster-placeholder&quot;>${esc(title).replace(/'/g,"&#39;")}</div>')">`:`<div class="poster-placeholder">${esc(title)}</div>`}
      ${anime.type?`<span class="poster-badge">${esc(anime.type)}</span>`:""}${score!=null?`<span class="score-badge">★ ${esc(score)}</span>`:""}
      <div class="poster-overlay"><span>Lihat detail</span><span class="play-mark">↗</span></div></div>
    <div class="anime-title">${esc(title)}</div><div class="anime-meta"><span>${anime.episode!=null?`Ep. ${esc(anime.episode)}`:"Anime"}</span><span>${esc(anime.type||"")}</span></div>
  </article>`;
}
function renderGrid(items, {append=false}={}) {
  const grid=$("#anime-grid");
  if(!append) grid.innerHTML="";
  if(!Array.isArray(items)||!items.length) {
    if(!append) grid.innerHTML='<div class="empty-state"><strong>Belum ada anime ditemukan</strong>Coba kata kunci atau kategori lain.</div>';
    return;
  }
  grid.insertAdjacentHTML("beforeend",items.map(card).join(""));
  grid.querySelectorAll(".anime-card").forEach(el=>{
    const open=()=>{if(el.dataset.slug) loadDetail(el.dataset.slug);};
    el.addEventListener("click",open);
    el.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}});
  });
}
function renderPagination(page, hasNext=true) {
  $("#pagination").innerHTML=`<button class="page-button" data-page="${Math.max(1,page-1)}" ${page<=1?"disabled":""}>← Sebelumnya</button><button class="page-button active">${page}</button><button class="page-button" data-page="${page+1}" ${!hasNext?"disabled":""}>Berikutnya →</button>`;
  $("#pagination").querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>{state.page=Number(b.dataset.page);loadView(state.view);window.scrollTo({top:$("#content").offsetTop-20,behavior:"smooth"});}));
}
async function loadView(view=state.view) {
  state.view=view; state.page=state.page||1; state.query=state.query||"";
  setViewNav(view); showSection("content"); $("#pagination").innerHTML=""; $("#type-filter").value=state.type;
  const cfg=copy[view]||copy.home; $("#section-kicker").textContent=cfg[0];$("#section-title").innerHTML=`${cfg[1]} <span class="heading-spark">✦</span>`;$("#section-subtitle").textContent=cfg[2];
  $("#refresh-btn").disabled=true; setStatus("Memuat data anime...");
  let path="";
  if(view==="home"||view==="ongoing") path="/ongoing";
  else if(view==="upcoming") path="/upcoming";
  else if(view==="all") path=`/anime?page=${state.page}`;
  else if(view==="search") path=`/search?q=${encodeURIComponent(state.query)}`;
  try {
    let data=await api(path);
    let items=Array.isArray(data)?data:(data?.results||[]);
    if(view==="home") items=items.slice(0,15);
    if(state.type) items=items.filter(a=>!a.type||a.type===state.type);
    state.lastItems=items;
    renderGrid(items);
    const suffix=state.type?` · filter ${state.type}`:"";
    setStatus(`${items.length} anime ditampilkan${suffix}.`);
    renderPagination(state.page, view==="all" ? items.length>0 : false);
  } catch(err) {
    renderGrid([]);setStatus(`${err.message} Pastikan koneksi internet tersedia dan API dapat diakses.`,true);
    showToast("Gagal memuat data dari API.");
  } finally { $("#refresh-btn").disabled=false; }
}
async function loadSchedule(day=state.scheduleDay) {
  state.view="schedule";state.scheduleDay=day;setViewNav("schedule");showSection("schedule");
  $("#day-tabs").innerHTML=DAYS.map(d=>`<button class="day-tab ${d===day?"active":""}" data-day="${d}">${d}</button>`).join("");
  $("#day-tabs").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>loadSchedule(b.dataset.day)));
  $("#schedule-list").innerHTML='<div class="empty-state">Memuat jadwal...</div>';
  try {
    if(!Object.keys(state.schedule).length) state.schedule=await api("/schedule");
    const key=Object.keys(state.schedule).find(k=>k.toLowerCase()===day.toLowerCase());
    const items=key?state.schedule[key]:[];
    $("#schedule-list").innerHTML=items.length?items.map(a=>`<article class="schedule-row" ${a.slug?`data-slug="${esc(a.slug)}"`:""}><div class="schedule-time">${esc(a.time||"—")}</div>${a.poster?`<img class="schedule-poster" src="${esc(a.poster)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`:'<div class="schedule-poster"></div>'}<div><div class="schedule-name">${esc(a.title||"Judul tidak tersedia")}</div><div class="schedule-sub">${a.episode!=null?`Episode ${esc(a.episode)} · `:""}${a.score!=null?`★ ${esc(a.score)} · `:""}${esc(a.type||"Anime")}</div></div><div class="schedule-arrow">↗</div></article>`).join(''):'<div class="empty-state"><strong>Tidak ada jadwal yang tersedia</strong>Data untuk hari ini belum tersedia di API.</div>';
    $("#schedule-list").querySelectorAll("[data-slug]").forEach(el=>el.addEventListener("click",()=>loadDetail(el.dataset.slug)));
  } catch(err) { $("#schedule-list").innerHTML=`<div class="empty-state"><strong>Jadwal gagal dimuat</strong>${esc(err.message)}</div>`; }
}
async function loadDetail(slug) {
  if(!slug)return; showSection("detail");setViewNav("");
  const section=$("#detail-section");section.innerHTML='<div class="empty-state">Memuat detail anime...</div>';
  window.scrollTo({top:0,behavior:"smooth"});
  try {
    const a=await api(`/anime/${encodeURIComponent(slug)}`);
    const genres=Array.isArray(a.genres)?a.genres:[];
    const episodes=Array.isArray(a.episodes)?a.episodes:[];
    section.innerHTML=`<button class="detail-back" id="detail-back">← Kembali ke katalog</button><div class="detail-hero">${a.poster?`<img class="detail-poster" src="${esc(a.poster)}" alt="Poster ${esc(a.title)}" onerror="this.style.visibility='hidden'">`:'<div class="detail-poster"></div>'}<div class="detail-info"><div class="eyebrow">DETAIL ANIME</div><h2>${esc(a.title||"Judul tidak tersedia")}</h2><div class="detail-chips">${a.score!=null?`<span class="detail-chip">★ ${esc(a.score)}</span>`:""}${a.type?`<span class="detail-chip">${esc(a.type)}</span>`:""}<span class="detail-chip">${episodes.length} episode terdaftar</span></div><p class="detail-synopsis">${esc(a.synopsis||"Sinopsis belum tersedia dari API.")}</p><div class="genre-list">${genres.map(g=>`<button class="genre-link" data-genre="${esc(slugifyGenre(g))}">${esc(g)}</button>`).join("")}</div>${a.url?`<a class="button button-ghost" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">Buka halaman sumber ↗</a>`:""}</div></div><h3 class="episodes-heading">Daftar Episode <span class="heading-spark">✦</span></h3><div class="episode-grid">${episodes.length?episodes.map(ep=>`<button class="episode-card" data-episode="${esc(ep.number)}" data-anime="${esc(a.slug||slug)}"><div class="episode-number">EPISODE ${esc(ep.number??"—")}</div><div class="episode-title">${esc(ep.title||`Episode ${ep.number??""}`)}</div><div class="episode-date">${esc(ep.date||"Tanggal belum tersedia")}</div></button>`).join(""):'<div class="empty-state">Daftar episode belum tersedia.</div>'}</div><p class="detail-synopsis">Info ini berasal dari metadata API. Pemutaran video langsung tidak tersedia pada endpoint yang didokumentasikan.</p>`;
    $("#detail-back").addEventListener("click",()=>loadView(state.view==="search"?"search":state.view));
    section.querySelectorAll("[data-genre]").forEach(b=>b.addEventListener("click",()=>loadGenre(b.dataset.genre)));
    section.querySelectorAll("[data-episode]").forEach(b=>b.addEventListener("click",()=>loadEpisodeInfo(b.dataset.anime,b.dataset.episode)));
  } catch(err) {section.innerHTML=`<button class="detail-back" id="detail-back">← Kembali</button><div class="empty-state"><strong>Detail gagal dimuat</strong>${esc(err.message)}</div>`;$("#detail-back").addEventListener("click",()=>loadView(state.view));}
}
async function loadEpisodeInfo(slug,n) {
  try {
    const ep=await api(`/anime/${encodeURIComponent(slug)}/episode/${encodeURIComponent(n)}`);
    const link=ep.url?`<br><br><a href="${esc(ep.url)}" target="_blank" rel="noopener noreferrer" style="color:#c4b5fd">Buka halaman episode sumber ↗</a>`:"";
    showToast(`${ep.title||`Episode ${n}`} — API hanya menyediakan info episode, bukan URL video.${link?" Buka halaman sumber untuk lanjut.":""}`);
  } catch(err) {showToast(`Info episode gagal dimuat: ${err.message}`);}
}
async function loadGenre(genre) {
  state.view="search";state.query="";
  showSection("content");$("#section-kicker").textContent="JELAJAHI GENRE";$("#section-title").innerHTML=`Genre: ${esc(genre.replace(/-/g," "))} <span class="heading-spark">✦</span>`;$("#section-subtitle").textContent="Anime berdasarkan genre yang dipilih.";
  setStatus("Memuat genre...");$("#pagination").innerHTML="";
  try {const data=await api(`/genre/${encodeURIComponent(genre)}`);const items=Array.isArray(data)?data:[];state.lastItems=items;renderGrid(items);setStatus(`${items.length} anime ditemukan.`);}
  catch(err){renderGrid([]);setStatus(err.message,true);}
}
$("#search-form").addEventListener("submit",e=>{e.preventDefault();const q=$("#search-input").value.trim();if(!q){showToast("Masukkan judul anime yang ingin dicari.");return;}state.query=q;state.page=1;state.type="";$("#type-filter").value="";loadView("search");});
document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>{const view=b.dataset.view;state.page=1;state.type="";if($("#type-filter"))$("#type-filter").value="";$("#main-nav")?.classList.remove("open");$(".main-nav").classList.remove("open");if(view==="schedule")loadSchedule();else loadView(view);}));
$("#type-filter").addEventListener("change",e=>{state.type=e.target.value;state.page=1;loadView(state.view);});
$("#refresh-btn").addEventListener("click",()=>{state.schedule={};if(state.view==="schedule")loadSchedule();else loadView(state.view);});
$("#mobile-menu").addEventListener("click",()=>$(".main-nav").classList.toggle("open"));
loadView("home");
