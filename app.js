const $=s=>document.querySelector(s);const KEY='favEats.v1';
let places=JSON.parse(localStorage.getItem(KEY)||'[]');let here=null;let map,layer;
const save=()=>localStorage.setItem(KEY,JSON.stringify(places));
const esc=s=>(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const toast=m=>{const t=$('#toast');t.textContent=m;t.style.display='block';setTimeout(()=>t.style.display='none',2500)};
const dist=(a,b,c,d)=>{const R=6371e3,r=Math.PI/180,x=(c-a)*r,y=(d-b)*r,h=Math.sin(x/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
const days=d=>Math.floor((Date.now()-new Date(d))/864e5);
const last=p=>p.visits.length?p.visits[p.visits.length-1].date:p.created;
const fmtD=d=>new Date(d).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
const nice=s=>(s||'').replace(/_/g,' ').replace(/;/g,', ');
function getPos(){return new Promise((res,rej)=>navigator.geolocation?navigator.geolocation.getCurrentPosition(p=>{here={lat:p.coords.latitude,lon:p.coords.longitude};res(here)},rej,{enableHighAccuracy:true,timeout:15000,maximumAge:30000}):rej(new Error('No GPS')))}
async function overpass(lat,lon,r){
 const q=`[out:json][timeout:20];nwr(around:${r},${lat},${lon})[amenity~"^(restaurant|cafe|bar|pub|fast_food|ice_cream|food_court)$"][name];out center tags;`;
 for(const u of['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter']){
  try{const r2=await fetch(u,{method:'POST',body:'data='+encodeURIComponent(q)});if(!r2.ok)continue;const j=await r2.json();
   return j.elements.map(e=>{const t=e.tags,la=e.lat??e.center.lat,lo=e.lon??e.center.lon;
    const addr=[[t['addr:housenumber'],t['addr:street']].filter(Boolean).join(' '),t['addr:city']].filter(Boolean).join(', ');
    return{osm:e.type+'/'+e.id,name:t.name,lat:la,lon:lo,cuisine:t.cuisine||t.amenity,addr,d:dist(lat,lon,la,lo)}}).sort((a,b)=>a.d-b.d)}catch(e){}}
 throw new Error('Could not reach the map service');}
function findExisting(c){return places.find(p=>(c.osm&&p.osm===c.osm)||(p.name.toLowerCase()===c.name.toLowerCase()&&(!c.lat||!p.lat||dist(p.lat,p.lon,c.lat,c.lon)<150)))}
function open(h){$('#sheet').innerHTML=h;$('#modal').classList.add('show')}
function close(){$('#modal').classList.remove('show')}
$('#modal').onclick=e=>{if(e.target.id==='modal')close()};
async function remember(){
 open('<h2>Finding where you are...</h2><p class="muted">Looking for restaurants around you.</p>');
 try{const p=await getPos();const list=await overpass(p.lat,p.lon,150);showPicks(list,p)}
 catch(e){open(`<h2>Hmm</h2><p>${esc(e.message||'Location not available')}. You can still type the name.</p>${manualForm()}`);bindManual(here)}}
function showPicks(list,p){
 window._picks=list;
 open(`<h2>Are you eating here?</h2>${list.length?'':'<p class="muted">No restaurants found right around you.</p>'}
 ${list.map((c,i)=>`<button class="pick" data-i="${i}"><b>${esc(c.name)}</b>${findExisting(c)?' ⭐':''}<br><span class="muted">${Math.round(c.d)} m · ${esc(nice(c.cuisine))}${c.addr?' · '+esc(c.addr):''}</span></button>`).join('')}
 <h2>Not listed?</h2>${manualForm()}<button style="width:100%;margin-top:8px" onclick="close()">Cancel</button>`);
 document.querySelectorAll('.pick').forEach(b=>b.onclick=()=>editVisit(list[b.dataset.i]));bindManual(p)}
const manualForm=()=>`<div class="row"><input id="mName" placeholder="Restaurant name" style="flex:1"><button class="pri" id="mGo">Next</button></div>`;
function bindManual(p){const b=$('#mGo');if(b)b.onclick=()=>{const n=$('#mName').value.trim();if(!n)return;editVisit({name:n,lat:p?.lat,lon:p?.lon,cuisine:'',addr:''})}}
function editVisit(c,existingId){
 const ex=existingId?places.find(p=>p.id===existingId):findExisting(c);let rating=ex?.rating||0,photo=null;
 open(`<h2>${esc(c.name||ex.name)}</h2>${ex?`<p class="muted">Welcome back! Visit number ${ex.visits.length+1}. Last time: ${fmtD(last(ex))}</p>`:''}
 <div class="stars" id="stars">${[1,2,3,4,5].map(i=>`<span data-s="${i}">★</span>`).join('')}</div>
 <p><input id="eCuis" placeholder="Cuisine (Italian, sushi...)" value="${esc(nice(ex?.cuisine||c.cuisine))}"></p>
 <p><textarea id="eNotes" rows="3" placeholder="What we ordered, who was with us"></textarea></p>
 <p><label class="muted">Add a photo (optional)</label><input type="file" id="ePhoto" accept="image/*" capture="environment"></p>
 <div class="row"><button class="pri" id="eSave" style="flex:2">❤️ Save it</button><button onclick="close()" style="flex:1">Cancel</button></div>`);
 const paint=()=>document.querySelectorAll('#stars span').forEach(s=>s.classList.toggle('on',s.dataset.s<=rating));paint();
 document.querySelectorAll('#stars span').forEach(s=>s.onclick=()=>{rating=+s.dataset.s;paint()});
 $('#ePhoto').onchange=async e=>{photo=await shrink(e.target.files[0])};
 $('#eSave').onclick=()=>{const v={date:new Date().toISOString(),notes:$('#eNotes').value.trim(),rating};
  let p=ex;if(!p){p={id:Date.now().toString(36),osm:c.osm||null,name:c.name,lat:c.lat??null,lon:c.lon??null,addr:c.addr||'',cuisine:'',created:v.date,visits:[]};places.push(p)}
  p.cuisine=$('#eCuis').value.trim();if(rating)p.rating=rating;if(photo)p.photo=photo;p.visits.push(v);save();close();toast('Saved! '+p.name);render()}}
function shrink(f){return new Promise(r=>{if(!f)return r(null);const img=new Image();img.onload=()=>{const m=480,s=Math.min(1,m/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=img.width*s;c.height=img.height*s;c.getContext('2d').drawImage(img,0,0,c.width,c.height);r(c.toDataURL('image/jpeg',.7))};img.src=URL.createObjectURL(f)})}
function card(p,hl){const d=here&&p.lat?dist(here.lat,here.lon,p.lat,p.lon):null;
 return `<div class="card place ${hl?'hl':''}" data-id="${p.id}">${p.photo?`<img src="${p.photo}" alt="">`:''}<div style="flex:1"><b style="font-size:18px">${esc(p.name)}</b> ${'★'.repeat(p.rating||0)}<br>
 <span class="muted">${esc(nice(p.cuisine))}${p.cuisine?' · ':''}${p.visits.length} visit${p.visits.length==1?'':'s'} · last ${fmtD(last(p))} (${days(last(p))} days ago)${d!=null?' · '+(d<1000?Math.round(d)+' m':(d/1609).toFixed(1)+' mi'):''}</span></div></div>`}
function bindCards(root){root.querySelectorAll('.place').forEach(e=>e.onclick=()=>detail(e.dataset.id))}
function links(p){const dest=p.lat?`${p.lat},${p.lon}`:encodeURIComponent(p.name+' '+p.addr);const q=encodeURIComponent(p.name+' '+(p.addr||'Wellington FL'));
 return `<div class="row"><a href="https://www.google.com/maps/dir/?api=1&destination=${dest}" target="_blank"><button>Google Maps</button></a><a href="https://maps.apple.com/?daddr=${dest}&q=${encodeURIComponent(p.name)}" target="_blank"><button>Apple Maps</button></a>
 <a href="https://www.google.com/search?q=${q}+menu" target="_blank"><button>Menu</button></a><a href="https://www.google.com/search?q=${q}+reservations" target="_blank"><button>Reserve</button></a></div>`}
function detail(id){const p=places.find(x=>x.id===id);
 open(`${p.photo?`<img src="${p.photo}" style="width:100%;border-radius:14px">`:''}<h2>${esc(p.name)} ${'★'.repeat(p.rating||0)}</h2><p class="muted">${esc(p.addr)} ${esc(nice(p.cuisine))}</p>${links(p)}
 <h2>Visits (${p.visits.length})</h2>${p.visits.slice().reverse().map(v=>`<div class="card"><b>${fmtD(v.date)}</b> ${'★'.repeat(v.rating||0)}<br>${esc(v.notes)||'<span class="muted">No notes</span>'}</div>`).join('')}
 <div class="row"><button class="pri" id="dAgain">We're here again</button><button id="dShare">Share</button><button id="dDel">Delete</button><button onclick="close()">Close</button></div>`);
 $('#dAgain').onclick=()=>editVisit(p,p.id);
 $('#dShare').onclick=()=>{const s={n:p.name,a:p.addr,c:p.cuisine,la:p.lat,lo:p.lon,r:p.rating};const url=location.origin+location.pathname+'#share='+encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(s)))));
  if(navigator.share)navigator.share({title:p.name,text:`Try ${p.name}!`,url}).catch(()=>{});else{navigator.clipboard?.writeText(url);toast('Link copied')}};
 $('#dDel').onclick=()=>{if(confirm('Delete '+p.name+'?')){places=places.filter(x=>x.id!==id);save();close();render()}}}
function render(){
 const loved=places.filter(p=>(p.rating||0)>=4&&days(last(p))>=60).sort((a,b)=>b.rating-a.rating||days(last(b))-days(last(a)));
 $('#stale').innerHTML=loved.map(p=>card(p,1)).join('')||'<p class="muted">Nothing yet. Rate places 4 or 5 stars and they will show up here when it has been a while.</p>';
 $('#recent').innerHTML=places.slice().sort((a,b)=>new Date(last(b))-new Date(last(a))).slice(0,5).map(p=>card(p)).join('')||'<p class="muted">Tap the big button next time you are out eating.</p>';
 const cs=[...new Set(places.map(p=>nice(p.cuisine)).filter(Boolean))].sort(),cv=$('#cuis').value;
 $('#cuis').innerHTML='<option value="">All cuisines</option>'+cs.map(c=>`<option ${c===cv?'selected':''}>${esc(c)}</option>`).join('');
 const q=$('#q').value.toLowerCase(),so=$('#sort').value;
 let L=places.filter(p=>(!cv||nice(p.cuisine)===cv)&&(!q||(p.name+' '+p.cuisine+' '+p.addr+' '+p.visits.map(v=>v.notes).join(' ')).toLowerCase().includes(q)));
 const D=p=>here&&p.lat?dist(here.lat,here.lon,p.lat,p.lon):1e9;
 L.sort({rating:(a,b)=>(b.rating||0)-(a.rating||0),last:(a,b)=>new Date(last(b))-new Date(last(a)),dist:(a,b)=>D(a)-D(b),count:(a,b)=>b.visits.length-a.visits.length}[so]);
 $('#list').innerHTML=L.map(p=>card(p)).join('')||'<p class="muted">No places found.</p>';
 bindCards(document);if(map)drawMap()}
function drawMap(){layer.clearLayers();const pts=[];places.filter(p=>p.lat).forEach(p=>{pts.push([p.lat,p.lon]);L.marker([p.lat,p.lon]).addTo(layer).bindPopup(`<b>${esc(p.name)}</b> ${'★'.repeat(p.rating||0)}<br>${p.visits.length} visits<br><a href="#" onclick="detail('${p.id}');return false">Open</a>`)});
 if(pts.length)map.fitBounds(pts,{padding:[40,40],maxZoom:16});else map.setView(here?[here.lat,here.lon]:[26.65,-80.2],12)}
function show(v){document.querySelectorAll('main>section').forEach(s=>s.hidden=s.id!=='v-'+v);document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
 if(v==='map'){if(!map){map=L.map('map');L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);layer=L.layerGroup().addTo(map)}setTimeout(()=>{map.invalidateSize();drawMap()},50)}
 if(v==='list'&&!here)getPos().then(render).catch(()=>{})}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>show(b.dataset.v));
$('#remember').onclick=remember;$('#q').oninput=render;$('#sort').onchange=render;$('#cuis').onchange=render;
$('#manualAdd').onclick=()=>{open('<h2>Add a place</h2>'+manualForm());bindManual(null)};
$('#exp').onclick=()=>{const b=new Blob([JSON.stringify({app:'favorite-eats',version:1,exported:new Date().toISOString(),places},null,1)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='favorite-eats-'+new Date().toISOString().slice(0,10)+'.json';a.click();toast('Exported '+places.length+' places')};
$('#impB').onclick=()=>$('#imp').click();
$('#imp').onchange=async e=>{try{const j=JSON.parse(await e.target.files[0].text());let n=0,m=0;for(const p of j.places||[]){const ex=places.find(x=>x.id===p.id)||findExisting(p);
 if(ex){const ds=new Set(ex.visits.map(v=>v.date));p.visits.forEach(v=>{if(!ds.has(v.date))ex.visits.push(v)});ex.visits.sort((a,b)=>new Date(a.date)-new Date(b.date));ex.rating=Math.max(ex.rating||0,p.rating||0);ex.photo=ex.photo||p.photo;m++}else{places.push(p);n++}}
 save();render();toast(`Imported: ${n} new, ${m} merged`)}catch(err){toast('That file did not work')}e.target.value=''};
function checkShare(){const m=location.hash.match(/share=([^&]+)/);if(!m)return;try{const s=JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));history.replaceState(null,'',location.pathname);
 const c={name:s.n,addr:s.a,cuisine:s.c,lat:s.la,lon:s.lo};const ex=findExisting(c);
 open(`<h2>Shared with you: ${esc(s.n)}</h2><p class="muted">${esc(s.a)} ${esc(nice(s.c))} ${'★'.repeat(s.r||0)}</p>${links(c)}<div class="row" style="margin-top:10px">${ex?'<p>Already on your list.</p>':'<button class="pri" id="sAdd">Add to my list</button>'}<button onclick="close()">Close</button></div>`);
 const b=$('#sAdd');if(b)b.onclick=()=>{places.push({id:Date.now().toString(36),osm:null,name:s.n,lat:s.la,lon:s.lo,addr:s.a||'',cuisine:s.c||'',rating:0,created:new Date().toISOString(),visits:[],wishlist:true});save();close();render();toast('Added')}}catch(e){}}
async function nearbyCheck(){if(sessionStorage.nb)return;sessionStorage.nb=1;try{const p=await getPos();render();
 const saved=places.filter(x=>x.lat&&dist(p.lat,p.lon,x.lat,x.lon)<100).sort((a,b)=>dist(p.lat,p.lon,a.lat,a.lon)-dist(p.lat,p.lon,b.lat,b.lon))[0];
 let name=saved?.name,cand=saved;if(!saved){const l=await overpass(p.lat,p.lon,100);if(l[0]){cand=l[0];name=l[0].name}}
 if(name){$('#nearbyPrompt').innerHTML=`<div class="card hl"><b>Are you eating at ${esc(name)}?</b><div class="row" style="margin-top:8px"><button class="pri" id="nbYes">Yes, save it</button><button id="nbNo">No</button></div></div>`;
  $('#nbYes').onclick=()=>{saved?editVisit(saved,saved.id):editVisit(cand);$('#nearbyPrompt').innerHTML=''};$('#nbNo').onclick=()=>$('#nearbyPrompt').innerHTML=''}}catch(e){}}
window.close=close;window.detail=detail;
render();checkShare();nearbyCheck();
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
