// Construit un site statique autonome du carnet d'adresses (dossier carnet-site/).
// Aucun serveur ni base de données : à envoyer tel quel sur n'importe quel hébergement (Hostinger, etc.).
// Utilisation : npm run carnet:site
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { createSeed } = await import(join(root, "src/lib/seed.ts"));
const { PLACE_FILTERS } = await import(join(root, "src/lib/content.ts"));
const out = join(root, "carnet-site");

const places = createSeed().places.map((p) => ({
  n: p.name, k: p.kind, a: p.area, t: p.note, c: p.categories, r: p.recommendedBy,
  e: p.clubEventLabel, d: p.clubEventDate, u: p.url, i: p.image, ip: p.imagePosition,
  ph: p.phone, ad: p.address, h: p.hours, g: p.tags, b: p.badge,
}));

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "img"), { recursive: true });
const images = new Set(["monogramme-clair.png", "logotype-clair.png", ...places.map((p) => p.i).filter(Boolean)]);
for (const f of images) copyFileSync(join(root, "public/img", f), join(out, "img", f));
for (const f of ["favicon.ico", "icon.png", "apple-icon.png"]) {
  try {
    copyFileSync(join(root, "src/app", f), join(out, f));
  } catch {
    /* facultatif */
  }
}

const json = (v) => JSON.stringify(v).replace(/</g, "\\u003c");

const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Carnet d’adresses · Nomad Club</title>
<meta name="description" content="Le carnet d’adresses du Nomad Club à Marrakech : les lieux du club et l’annuaire pratique (santé, beauté, urgences, services).">
<meta name="theme-color" content="#0b0b0b">
<link rel="icon" href="icon.png">
<link rel="apple-touch-icon" href="apple-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
<style>
:root{--bg:#0b0b0b;--s1:#111;--line:rgba(226,226,226,.13);--line2:rgba(226,226,226,.26);--tx:#f3f3f3;--tx2:#dedede;--muted:#c3c3c3;--accent:#d3d3d3;--fill:rgba(243,243,243,.06);--fill2:rgba(243,243,243,.1);--gold:linear-gradient(135deg,#ededed 0%,#d5d5d5 36%,#b6b6b6 68%,#e2e2e2 100%);--ink:#111;--serif:"Playfair Display",Didot,Georgia,serif;--sans:"Albert Sans","Helvetica Neue",Arial,system-ui,sans-serif;--gut:clamp(16px,4vw,56px);color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--tx);font:16px/1.55 var(--sans);-webkit-font-smoothing:antialiased}
a{color:inherit}
.ic{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;flex:none}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
header{position:sticky;top:0;z-index:5;background:rgba(11,11,11,.88);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
.bar{max-width:1240px;margin:0 auto;padding:14px var(--gut);display:flex;align-items:center;gap:14px}
.bar img{height:34px;width:auto}
.bar span{font:600 12px var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
main{max-width:1240px;margin:0 auto;padding:36px var(--gut) 64px}
.eyebrow{font:600 12px var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
h1{margin:8px 0 6px;font:500 clamp(34px,5vw,52px)/1.08 var(--serif)}
.sub{margin:0;color:var(--tx2);max-width:640px}
.search{display:flex;align-items:center;gap:10px;height:52px;padding:0 18px;border-radius:999px;background:var(--fill);box-shadow:inset 0 0 0 1px var(--line2);margin:26px 0 12px}
.search:focus-within{box-shadow:inset 0 0 0 1.5px var(--accent)}
.search .ic{width:20px;height:20px;color:var(--muted)}
.search input{flex:1;min-width:0;border:0;background:none;color:var(--tx);font:500 16px var(--sans);outline:none;height:100%}
.chips{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding:2px}
.chips::-webkit-scrollbar{display:none}
.chip{appearance:none;border:0;height:42px;padding:0 18px;border-radius:999px;background:var(--fill);color:var(--tx2);font:600 14.5px var(--sans);white-space:nowrap;box-shadow:inset 0 0 0 1px var(--line);cursor:pointer;flex:none}
.chip.on{background:var(--gold);color:var(--ink);box-shadow:none}
.chip small{opacity:.7;margin-left:4px;font-weight:600}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;margin-top:24px}
.card{border-radius:26px;overflow:hidden;background:var(--s1);box-shadow:inset 0 0 0 1px var(--line);display:flex;flex-direction:column;animation:pop .45s cubic-bezier(.16,1,.3,1) both}
@keyframes pop{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.ph{position:relative;height:190px;background:#1a1a1a;overflow:hidden}
.ph img{width:100%;height:100%;object-fit:cover;filter:grayscale(1);display:block}
.ph .k{position:absolute;top:14px;left:14px;padding:5px 12px;border-radius:999px;background:rgba(17,17,17,.55);backdrop-filter:blur(10px);font:600 12.5px var(--sans)}
.ph.noimg{display:flex;align-items:flex-end;padding:18px}
.ph.noimg .mono{position:absolute;right:-20px;top:-10px;height:200px;opacity:.08}
.ph.noimg b{font:italic 400 32px/1.1 var(--serif)}
.body{padding:18px 20px 20px;display:flex;flex-direction:column;gap:8px;flex:1}
.top{display:flex;align-items:center;justify-content:space-between;gap:10px}
.kind{font:600 12px var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.badge{flex:none;font:600 11.5px var(--sans);padding:4px 10px;border-radius:999px;background:var(--fill);color:var(--tx2);box-shadow:inset 0 0 0 1px var(--line2)}
.badge.top{background:var(--gold);color:var(--ink);box-shadow:none}
h3{margin:0;font:500 23px/1.15 var(--serif)}
.where{display:flex;align-items:center;gap:6px;font-size:14.5px;color:var(--muted)}
.body p{margin:0;color:var(--tx2)}
.info{list-style:none;margin:4px 0 0;padding:12px 0 0;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:8px}
.info li{display:flex;gap:9px;font-size:14.5px;color:var(--tx2);line-height:1.35}
.info .ic{margin-top:2px;color:var(--muted)}
.info a{text-decoration:none;color:var(--tx);overflow-wrap:anywhere}
.info a:hover{text-decoration:underline}
.was{display:flex;gap:10px;font-size:14px;color:var(--tx2);padding:10px 12px;border-radius:14px;background:var(--fill)}
.rec{font-size:14.5px;color:var(--tx2);margin-top:auto;padding-top:6px}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:auto;padding-top:8px}
.tags span{font-size:12px;padding:3px 9px;border-radius:999px;background:var(--fill);color:var(--muted)}
.empty{margin:40px 0;text-align:center;color:var(--muted)}
footer{border-top:1px solid var(--line);color:var(--muted);font-size:13.5px;text-align:center;padding:24px var(--gut)}
@media (max-width:640px){.grid{grid-template-columns:1fr;gap:16px}.chips{margin:0 -16px;padding:2px 16px}main{padding-top:24px}}
</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
<symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></symbol>
<symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></symbol>
<symbol id="i-phone" viewBox="0 0 24 24"><path d="M5 4h3.5l1.8 4.5-2.3 1.4a11 11 0 0 0 6.1 6.1l1.4-2.3L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z"/></symbol>
<symbol id="i-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5s1.1-6.1 3.5-8.5z"/></symbol>
<symbol id="i-ticket" viewBox="0 0 24 24"><path d="M3.5 8.5V6a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1v2.5a2.5 2.5 0 0 0 0 5V18a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-4.5a2.5 2.5 0 0 0 0-5z"/></symbol>
<symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></symbol>
</svg>
<header><div class="bar"><img src="img/logotype-clair.png" alt="Nomad Club"><span>Carnet d’adresses</span></div></header>
<main>
  <div class="eyebrow">Marrakech</div>
  <h1>Le carnet du club</h1>
  <p class="sub">Les lieux où le club est allé, et l’annuaire pratique de Marrakech : santé, beauté, urgences, services.</p>
  <label class="search"><svg class="ic"><use href="#i-search"/></svg><span class="sr">Chercher une adresse</span><input id="q" type="search" autocomplete="off" placeholder="Chercher : pédiatre, rooftop, Guéliz…"></label>
  <div class="chips" id="chips" role="tablist" aria-label="Filtrer le carnet"></div>
  <div id="list"></div>
</main>
<footer>Nomad Club · Marrakech</footer>
<script>
const PLACES=${json(places)};
const FILTERS=${json(PLACE_FILTERS)};
const MONTHS=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const BADGES={top:"Coup de cœur",new:"Nouveau",exclusive:"Exclusif"};
const norm=s=>s.normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase();
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const ic=n=>'<svg class="ic"><use href="#i-'+n+'"/></svg>';
const day=ymd=>{const[y,m,d]=ymd.split("-").map(Number);return(d===1?"1er":d)+" "+MONTHS[m-1]+" "+y};
const INDEX=PLACES.map(p=>norm([p.n,p.k,p.a,p.t,p.ad||"",...p.g].join(" ")));
const inF=(p,k)=>k==="tout"||(k==="club"?!!p.r:p.c.includes(k));
const params=new URLSearchParams(location.search);
let cat=FILTERS.some(f=>f.key===params.get("filtre"))?params.get("filtre"):"tout";
const qEl=document.getElementById("q"),chipsEl=document.getElementById("chips"),listEl=document.getElementById("list");

function info(p){
  const li=[];
  if(p.ph)li.push('<li>'+ic("phone")+'<a href="tel:'+esc(p.ph.split("/")[0].replace(/[^\\d+]/g,""))+'">'+esc(p.ph)+'</a></li>');
  if(p.ad)li.push('<li>'+ic("pin")+'<a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(p.n+", "+p.ad+", Marrakech")+'">'+esc(p.ad)+'</a></li>');
  if(p.h)li.push('<li>'+ic("clock")+'<span>'+esc(p.h)+'</span></li>');
  if(p.u)li.push('<li>'+ic("globe")+'<a target="_blank" rel="noopener" href="'+esc(p.u)+'">'+esc(p.u.replace(/^https?:\\/\\//,""))+'</a></li>');
  return li.length?'<ul class="info">'+li.join("")+'</ul>':"";
}
function card(p,i){
  const delay=' style="animation-delay:'+Math.min(i,12)*0.04+'s"';
  const badge=p.b?'<span class="badge '+p.b+'">'+BADGES[p.b]+'</span>':"";
  const where='<div class="where">'+ic("pin")+esc(p.a)+'</div><p>'+esc(p.t)+'</p>';
  if(!p.i&&!p.r){
    return '<article class="card"'+delay+'><div class="body"><div class="top"><span class="kind">'+esc(p.k)+'</span>'+badge+'</div><h3>'+esc(p.n)+'</h3>'+where+info(p)+
      (p.g.length?'<div class="tags">'+p.g.map(t=>'<span>'+esc(t)+'</span>').join("")+'</div>':"")+'</div></article>';
  }
  const ph=p.i?'<div class="ph"><img loading="lazy" src="img/'+esc(p.i)+'" alt="'+esc(p.n)+'" style="object-position:'+esc(p.ip||"50% 50%")+'"><span class="k">'+esc(p.k)+'</span></div>'
    :'<div class="ph noimg"><img class="mono" src="img/monogramme-clair.png" alt=""><b>'+esc(p.n)+'</b><span class="k">'+esc(p.k)+'</span></div>';
  return '<article class="card"'+delay+'>'+ph+'<div class="body"><h3>'+esc(p.n)+'</h3>'+where+info(p)+
    (p.e?'<div class="was">'+ic("ticket")+'<span>Le club y était : '+esc(p.e)+(p.d?", "+day(p.d):"")+'</span></div>':"")+
    (p.r?'<div class="rec">Recommandé par '+esc(p.r)+'</div>':"")+'</div></article>';
}
function render(){
  const terms=norm(qEl.value).split(/\\s+/).filter(Boolean);
  const found=PLACES.filter((_,i)=>terms.every(t=>INDEX[i].includes(t)));
  chipsEl.innerHTML=FILTERS.map(f=>{
    const n=found.filter(p=>inF(p,f.key)).length;
    if(!n&&f.key!=="tout"&&f.key!==cat)return"";
    return '<button class="chip'+(cat===f.key?" on":"")+'" role="tab" aria-selected="'+(cat===f.key)+'" data-k="'+f.key+'">'+esc(f.label)+'<small>'+n+'</small></button>';
  }).join("");
  const list=found.filter(p=>inF(p,cat));
  listEl.innerHTML=list.length?'<div class="grid">'+list.map(card).join("")+'</div>':'<p class="empty">Aucune adresse ne correspond. Essaie un autre mot.</p>';
}
chipsEl.addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;
  cat=b.dataset.k;
  try{history.replaceState(null,"",cat==="tout"?location.pathname:"?filtre="+cat)}catch(_){}
  render();
});
qEl.addEventListener("input",render);
render();
</script>
</body>
</html>
`;

writeFileSync(join(out, "index.html"), html);
console.log(`carnet-site/ prêt : ${places.length} adresses, ${images.size} images.`);
