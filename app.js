import {loadGardenState,saveGardenState} from './storage.js';
const STORE='mon-jardin-v1';
const WEATHER_PREF='mon-jardin-weather-enabled';
const today=()=>new Date().toISOString().slice(0,10);
const shift=(n)=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
const uid=()=>crypto.randomUUID();
const seeds=()=>({plants:[
 {id:'olivier',name:'Olivier bonsaï',common:'Olivier',botanical:'Olea europaea',category:'Bonsaï',location:'Terrasse',environment:'Extérieur',health:'Bonne santé',objective:'Faire épaissir le tronc et obtenir une silhouette harmonieuse.',notes:'Installé dans un pot en terre cuite.',emoji:'🌳',photos:[],observations:[{id:uid(),date:shift(-2),text:'Nouvelles pousses vigoureuses après la taille.'}]},
 {id:'glycine',name:'Glycine',common:'Glycine de Chine',botanical:'Wisteria sinensis',category:'Plante grimpante',location:'Extérieur',environment:'Extérieur',health:'Très bonne santé',objective:'Obtenir une floraison régulière.',notes:'Conduite sur un support.',emoji:'🪻',photos:[],observations:[{id:uid(),date:shift(-5),text:'Quelques nouveaux boutons sont visibles.'}]},
 {id:'lotus',name:'Lotus',common:'Lotus sacré',botanical:'Nelumbo nucifera',category:'Plante aquatique',location:'Jardin',environment:'Extérieur',health:'À surveiller',objective:'Obtenir une floraison abondante chaque été.',notes:'Cultivé dans le bassin.',emoji:'🪷',photos:[],observations:[]}
],tasks:[
 {id:uid(),plantId:'olivier',title:'Contrôle de la ligature',type:'Ligature',date:today(),notes:'Vérifier que le fil ne marque pas le tronc.',status:'todo'},
 {id:uid(),plantId:'glycine',title:'Taille saisonnière',type:'Taille',date:shift(3),notes:'Raccourcir les pousses secondaires.',status:'todo'},
 {id:uid(),plantId:'lotus',title:'Préparation hivernage',type:'Hivernage',date:shift(7),notes:'Surveiller la baisse des températures.',status:'todo'}
],history:[],categories:['Bonsaï','Arbre','Arbuste','Plante méditerranéenne','Plante tropicale','Plante aquatique','Plante d’intérieur','Orchidée','Cactus / succulente','Plante grimpante','Vivace','Annuelle','Autre'],locations:['Terrasse','Jardin','Extérieur','Intérieur','Salon','Bassin','Serre']});
let state=JSON.parse(localStorage.getItem(STORE)||'null')||seeds(); let view='dashboard',selected=null,modal=null,filter={q:'',category:'',location:'',health:''},calDate=new Date(),tab='aperçu';
let weather={status:'idle',data:null,error:null,coords:null};
const save=()=>{localStorage.setItem(STORE,JSON.stringify(state));saveGardenState(state).catch(()=>{});};
const dayLabel=()=>new Intl.DateTimeFormat('fr-FR',{weekday:'long'}).format(new Date()).replace(/^./,m=>m.toUpperCase());
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=d=>new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short'}).format(new Date(d+'T12:00'));
const plant=id=>state.plants.find(p=>p.id===id);
function icon(n){return ({dashboard:'⌂',plants:'♧',calendar:'▦',journal:'☷',backup:'⇩'})[n]}
function shell(content){document.querySelector('#app').innerHTML=`<div class="app"><aside class="sidebar"><div class="brand"><span class="brand-mark">♧</span> Mon Jardin</div><nav class="nav">${nav()}</nav><div class="sidebar-footer">Votre carnet de jardinage<br>Les données restent sur cet appareil</div></aside><main class="main"><header class="topbar"><div class="search"><span>⌕</span><input id="globalSearch" placeholder="Rechercher une plante…" value="${esc(filter.q)}"></div><div class="top-actions"><button class="btn secondary" data-view="backup">⇩ Sauvegarder</button><button class="btn primary" data-action="newPlant">＋ Ajouter une plante</button></div></header>${content}</main><nav class="mobile-nav">${nav()}</nav></div>${modal?renderModal():''}`;bind()}
function nav(){return [['dashboard','Accueil'],['plants','Mes plantes'],['calendar','Calendrier'],['journal','Journal'],['backup','Sauvegarde']].map(([v,l])=>`<button class="${view===v?'active':''}" data-view="${v}"><span>${icon(v)}</span>${l}</button>`).join('')}
function stat(icon,n,label){return `<div class="stat"><span class="stat-icon">${icon}</span><div><strong>${n}</strong><small>${label}</small></div></div>`}
const monthNames=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
function monthOptions(current='',allowAny=true){
  return (allowAny?'<option value="">Toute l’année</option>':'')+monthNames.map((m,i)=>`<option value="${i+1}" ${String(i+1)===String(current)?'selected':''}>${m}</option>`).join('');
}
function recurrenceLabel(t){
  const n=Math.max(1,Number(t.interval)||1);
  if(t.recurrence==='days')return n===1?'Tous les jours':`Tous les ${n} jours`;
  if(t.recurrence==='months')return n===1?'Tous les mois':`Tous les ${n} mois`;
  if(t.recurrence==='yearly')return 'Tous les ans';
  return '';
}
function monthInSeason(month,start,end){
  start=Number(start);end=Number(end);
  if(!start||!end)return true;
  return start<=end ? month>=start&&month<=end : month>=start||month<=end;
}
function adjustToSeason(date,start,end){
  if(!start||!end)return date;
  let guard=0;
  while(!monthInSeason(date.getMonth()+1,start,end)&&guard<370){date.setDate(date.getDate()+1);guard++;}
  return date;
}
function nextTaskDate(t,from=today()){
  if(!t.recurrence||t.recurrence==='none')return null;
  const d=new Date(from+'T12:00'),n=Math.max(1,Number(t.interval)||1);
  if(t.recurrence==='days')d.setDate(d.getDate()+n);
  if(t.recurrence==='months')d.setMonth(d.getMonth()+n);
  if(t.recurrence==='yearly')d.setFullYear(d.getFullYear()+1);
  adjustToSeason(d,t.seasonStart,t.seasonEnd);
  return d.toISOString().slice(0,10);
}
function weatherCodeInfo(code){
  if(code===0)return ['☀️','Dégagé'];
  if([1,2].includes(code))return ['🌤️','Peu nuageux'];
  if(code===3)return ['☁️','Couvert'];
  if([45,48].includes(code))return ['🌫️','Brouillard'];
  if([51,53,55,56,57].includes(code))return ['🌦️','Bruine'];
  if([61,63,65,66,67,80,81,82].includes(code))return ['🌧️','Pluie'];
  if([71,73,75,77,85,86].includes(code))return ['🌨️','Neige'];
  if([95,96,99].includes(code))return ['⛈️','Orage'];
  return ['🌦️','Variable'];
}
function render(){if(view==='plant')return renderPlant();const pages={dashboard:dashboard,plants:plantsPage,calendar:calendarPage,journal:journalPage,backup:backupPage};shell(pages[view]())}
function weatherCard(){
  if(weather.status==='loading')return '<div class="card weather-card"><div class="card-head"><h2>🌦️ Météo du jardin</h2></div><div class="empty">Chargement de la météo…</div></div>';
  if(weather.status==='error')return '<div class="card weather-card"><div class="card-head"><h2>🌦️ Météo du jardin</h2></div><p class="subtitle">'+esc(weather.error||'Météo indisponible.')+'</p><button class="btn secondary" data-action="weather">Réessayer</button></div>';
  if(!weather.data)return '<div class="card weather-card"><div class="card-head"><h2>🌦️ Météo du jardin</h2></div><p>Active la météo pour voir les prévisions sur 7 jours et les alertes adaptées aux seuils de tes plantes.</p><button class="btn primary" data-action="weather">Activer la météo</button></div>';
  const d=weather.data,alerts=weatherAlerts(d),advice=weatherAdvice(d),now=weatherCodeInfo(d.current.weather_code);
  const forecast=d.daily.time.map((date,i)=>{
    const info=weatherCodeInfo(d.daily.weather_code[i]);
    const day=new Intl.DateTimeFormat('fr-FR',{weekday:'short'}).format(new Date(date+'T12:00'));
    return '<div class="forecast-day"><strong>'+esc(day)+'</strong><span class="forecast-icon">'+info[0]+'</span><span>'+Math.round(d.daily.temperature_2m_min[i])+'° / '+Math.round(d.daily.temperature_2m_max[i])+'°</span><small>💧 '+Math.round(d.daily.precipitation_probability_max[i]||0)+'%</small></div>';
  }).join('');
  return '<div class="card weather-card"><div class="card-head"><h2>🌦️ Météo du jardin</h2><button class="tiny ghost" data-action="weather">Actualiser</button></div><div class="weather-main"><strong>'+Math.round(d.current.temperature_2m)+'°C</strong><span>'+now[0]+' '+now[1]+' · aujourd’hui '+Math.round(d.daily.temperature_2m_min[0])+'° / '+Math.round(d.daily.temperature_2m_max[0])+'°</span></div><div class="forecast-strip">'+forecast+'</div>'+(alerts.length?'<div class="weather-alerts">'+alerts.map(a=>'<div class="weather-alert '+a.level+'">'+esc(a.text)+'</div>').join('')+'</div>':'<div class="weather-ok">✅ Aucun seuil météo de tes plantes n’est dépassé dans les 3 prochains jours.</div>')+(advice.length?'<div class="weather-advice">'+advice.map(x=>'<div>'+esc(x)+'</div>').join('')+'</div>':'')+'</div>';
}
function weatherAlerts(d){
  const min=Math.min(...d.daily.temperature_2m_min.slice(0,3));
  const max=Math.max(...d.daily.temperature_2m_max.slice(0,3));
  return state.plants.flatMap(p=>{
    const out=[];
    const cold=Number(p.coldThreshold),heat=Number(p.heatThreshold);
    if(Number.isFinite(cold)&&p.coldThreshold!==''&&min<cold)out.push({level:'cold',text:`❄️ ${p.name} : ${Math.round(min)}°C prévus dans les 3 jours, sous ton seuil de ${cold}°C.`});
    if(Number.isFinite(heat)&&p.heatThreshold!==''&&max>heat)out.push({level:'heat',text:`☀️ ${p.name} : jusqu’à ${Math.round(max)}°C prévus, au-dessus de ton seuil de ${heat}°C.`});
    return out;
  }).slice(0,6);
}
function weatherAdvice(d){
  const out=[],rain=Math.max(...d.daily.precipitation_probability_max.slice(0,3)),max=Math.max(...d.daily.temperature_2m_max.slice(0,3));
  if(rain>=70)out.push('🌧️ Pluie probable : vérifie l’humidité du substrat avant les arrosages extérieurs.');
  if(max>=30)out.push('☀️ Forte chaleur : surveille en priorité les petits pots et les plantes en plein soleil.');
  return out;
}
async function loadWeather(){
  if(!navigator.geolocation){weather={status:'error',data:null,error:'La localisation n’est pas disponible sur cet appareil.'};return render();}
  weather={...weather,status:'loading',error:null};render();
  navigator.geolocation.getCurrentPosition(async pos=>{
    try{
      const {latitude,longitude}=pos.coords;
      const url=`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=7`;
      const response=await fetch(url);
      if(!response.ok)throw new Error('Service météo indisponible');
      weather={status:'ready',data:await response.json(),error:null,coords:{latitude,longitude}};
    }catch(e){weather={status:'error',data:null,error:'Impossible de récupérer la météo pour le moment.'};}
    render();
  },()=>{weather={status:'error',data:null,error:'Autorise la localisation pour afficher la météo de ton jardin.'};render();},{enableHighAccuracy:false,timeout:10000,maximumAge:3600000});
}
function dashboard(){const pending=state.tasks.filter(t=>t.status==='todo').sort((a,b)=>a.date.localeCompare(b.date)),tod=pending.filter(t=>t.date<=today()),week=pending.filter(t=>t.date>today()&&t.date<=shift(7)),watch=state.plants.filter(p=>['À surveiller','Problème'].includes(p.health));return `<section class="content"><div class="title-row"><div><div class="eyebrow">${dayLabel()} · ${new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric'}).format(new Date())}</div><h1>Bonjour, votre jardin vous attend.</h1><p class="subtitle">Voici l’essentiel pour prendre soin de vos plantes aujourd’hui.</p></div></div><div class="stats">${stat('♧',state.plants.length,'plantes au total')}${stat('✓',tod.length,'à faire aujourd’hui')}${stat('◷',week.length,'cette semaine')}${stat('!',watch.length,'à surveiller')}</div><div class="dashboard">${weatherCard()}<div class="card"><div class="card-head"><h2>À faire aujourd’hui</h2><span class="count">${tod.length} tâche${tod.length>1?'s':''}</span></div>${tod.length?tod.map(taskRow).join(''):'<div class="empty">Tout est fait pour aujourd’hui 🌿</div>'}</div><div class="card"><div class="card-head"><h2>Cette semaine</h2><button class="tiny ghost" data-view="calendar">Voir le calendrier</button></div>${week.length?week.map(taskRow).join(''):'<div class="empty">Aucun entretien prévu.</div>'}</div><div class="card"><div class="card-head"><h2>Plantes à surveiller</h2></div>${watch.length?watch.map(p=>`<div class="observ"><strong>${esc(p.name)}</strong><span>🟠 ${esc(p.health)} · ${esc(p.location)}</span></div>`).join(''):'<div class="empty">Aucune alerte.</div>'}</div><div class="card"><div class="card-head"><h2>Dernières observations</h2></div>${allObservations().slice(0,3).map(o=>`<div class="observ"><strong>${esc(o.plant.name)}</strong>${esc(o.text)}<br><span>${fmt(o.date)}</span></div>`).join('')||'<div class="empty">Aucune observation.</div>'}</div></div></section>`}
function taskRow(t){
  const p=plant(t.plantId),rec=recurrenceLabel(t);
  const season=t.seasonStart&&t.seasonEnd?` · ${monthNames[Number(t.seasonStart)-1]} → ${monthNames[Number(t.seasonEnd)-1]}`:'';
  return `<div class="task"><div class="datebox"><strong>${new Date(t.date+'T12:00').getDate()}</strong><small>${new Intl.DateTimeFormat('fr-FR',{month:'short'}).format(new Date(t.date+'T12:00'))}</small></div><div><div class="task-title">${esc(t.title)}</div><div class="task-meta">${esc(p?.name||'Plante supprimée')} · ${esc(t.type)}${rec?' · 🔁 '+esc(rec)+esc(season):''}</div></div><div class="task-actions"><button class="tiny" data-done="${t.id}">✓ Fait</button><button class="tiny ghost" data-postpone="${t.id}">Reporter</button><button class="tiny ghost" data-ignore="${t.id}">Ignorer</button></div></div>`;
}
function plantsPage(){let ps=state.plants.filter(p=>(p.name+' '+p.common+' '+p.botanical).toLowerCase().includes(filter.q.toLowerCase())&&(!filter.category||p.category===filter.category)&&(!filter.location||p.location===filter.location)&&(!filter.health||p.health===filter.health));return `<section class="content"><div class="title-row"><div><div class="eyebrow">Votre collection</div><h1>Mes plantes</h1><p class="subtitle">${ps.length} plante${ps.length>1?'s':''} dans votre jardin</p></div></div><div class="filters"><select data-filter="category"><option value="">Toutes les catégories</option>${options(state.categories,filter.category)}</select><select data-filter="location"><option value="">Tous les emplacements</option>${options(state.locations,filter.location)}</select><select data-filter="health"><option value="">Tous les états</option>${options(['Très bonne santé','Bonne santé','À surveiller','Problème','Dormance / hivernage'],filter.health)}</select></div><div class="plant-grid">${ps.map(plantCard).join('')||'<div class="empty">Aucune plante ne correspond à ces filtres.</div>'}</div></section>`}
function plantCard(p){return `<article class="plant-card" data-plant="${p.id}"><div class="plant-image">${p.mainPhoto?`<img src="${p.mainPhoto}" alt="${esc(p.name)}">`:p.emoji||'🌿'}</div><div class="plant-info"><h3>${esc(p.name)}</h3><div class="subtitle">${esc(p.botanical||p.common||'Nom botanique non renseigné')}</div><div class="tags"><span class="tag">${esc(p.category)}</span><span class="tag">⌖ ${esc(p.location)}</span></div><div class="health">${healthDot(p.health)} ${esc(p.health)}</div></div></article>`}
function healthDot(h){return h==='Problème'?'🔴':h==='À surveiller'?'🟠':h==='Dormance / hivernage'?'⚫':'🟢'}
function calendarPage(){const y=calDate.getFullYear(),m=calDate.getMonth(),first=new Date(y,m,1),start=(first.getDay()+6)%7,last=new Date(y,m+1,0).getDate(),prev=new Date(y,m,0).getDate();let cells='';for(let i=0;i<42;i++){let day=i-start+1,month=m,year=y,muted='';if(day<1){day=prev+day;month=m-1;muted='muted'}if(day>last){day-=last;month=m+1;muted='muted'}const date=new Date(year,month,day),key=date.toISOString().slice(0,10),events=state.tasks.filter(t=>t.date===key&&t.status==='todo');cells+=`<div class="day ${muted} ${key===today()?'today':''}"><span class="daynum">${day}</span>${events.map(e=>`<div class="event" title="${esc(e.title)}">${esc(plant(e.plantId)?.name)} · ${esc(e.title)}</div>`).join('')}</div>`}return `<section class="content"><div class="title-row"><div><div class="eyebrow">Tous les entretiens</div><h1>Calendrier</h1></div><button class="btn primary" data-action="newTask">＋ Programmer</button></div><div class="card"><div class="calendar-head"><button class="btn secondary" data-cal="-1">‹</button><h2>${new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric'}).format(calDate)}</h2><button class="btn secondary" data-cal="1">›</button></div><div class="cal-grid">${['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d=>`<div class="weekday">${d}</div>`).join('')}${cells}</div></div></section>`}
function allObservations(){return state.plants.flatMap(p=>(p.observations||[]).map(o=>({...o,plant:p}))).sort((a,b)=>b.date.localeCompare(a.date))}
function journalPage(){const entries=[...state.history.map(h=>({...h,plant:plant(h.plantId)})),...allObservations().map(o=>({id:o.id,date:o.date,title:'Observation',details:o.text,plant:o.plant}))].sort((a,b)=>b.date.localeCompare(a.date));return `<section class="content"><div class="title-row"><div><div class="eyebrow">La mémoire du jardin</div><h1>Journal</h1><p class="subtitle">Toutes vos actions et observations, au même endroit.</p></div></div><div class="card">${entries.map(e=>`<div class="task"><div class="datebox"><strong>${new Date(e.date+'T12:00').getDate()}</strong><small>${new Intl.DateTimeFormat('fr-FR',{month:'short'}).format(new Date(e.date+'T12:00'))}</small></div><div><div class="task-title">${esc(e.plant?.name||'Plante supprimée')} · ${esc(e.title)}</div><div class="task-meta">${esc(e.details||'')}</div></div></div>`).join('')||'<div class="empty">Le journal est encore vide.</div>'}</div></section>`}
function backupPage(){return `<section class="content"><div class="title-row"><div><div class="eyebrow">Vos données</div><h1>Sauvegarde</h1><p class="subtitle">Gardez une copie de votre jardin, photos comprises.</p></div></div><div class="dashboard"><div class="card"><div class="card-head"><h2>Exporter une sauvegarde</h2></div><p>Télécharge un fichier complet au format JSON. Conservez-le dans un endroit sûr.</p><button class="btn primary" data-action="export">⇩ Télécharger la sauvegarde</button></div><div class="card"><div class="card-head"><h2>Restaurer</h2></div><p>Remplace les données actuelles par celles d’une sauvegarde précédente.</p><label class="btn secondary">↑ Choisir un fichier<input id="importFile" type="file" accept="application/json" hidden></label></div><div class="card"><div class="card-head"><h2>Liste des plantes</h2></div><p>Export simple au format CSV, lisible avec Excel.</p><button class="btn secondary" data-action="csv">⇩ Exporter en CSV</button></div></div></section>`}
function renderPlant(){
  const p=plant(selected);if(!p){view='plants';return render()}
  const tasks=state.tasks.filter(t=>t.plantId===p.id&&t.status==='todo'),hist=state.history.filter(h=>h.plantId===p.id).sort((a,b)=>b.date.localeCompare(a.date));
  const timeline=[...(p.photos||[])].filter(ph=>ph.date).sort((a,b)=>a.date.localeCompare(b.date));
  let body;
  if(tab==='photos'){
    body=`<div class="gallery">${(p.photos||[]).map((ph,i)=>`<div class="gallery-item" data-photo="${i}"><img src="${ph.data}" alt="Photo ${esc(p.name)}"></div>`).join('')||'<div class="empty">Aucune photo pour le moment.</div>'}</div>`;
  }else if(tab==='timeline'){
    body=timeline.length?`<div class="timeline">${timeline.map(ph=>{const i=(p.photos||[]).findIndex(x=>x.id===ph.id);return `<article class="timeline-item"><div class="timeline-date">${fmt(ph.date)}</div><button class="timeline-photo" data-photo="${i}"><img src="${ph.data}" alt="${esc(ph.type||'Évolution')}"></button><div class="timeline-copy"><strong>${esc(ph.type||'Photo')}</strong><span>${esc(ph.comment||'')}</span></div></article>`}).join('')}</div>`:'<div class="empty">Ajoute plusieurs photos datées pour visualiser l’évolution de cette plante.</div>';
  }else if(tab==='historique'){
    body=hist.map(e=>`<div class="observ"><strong>${fmt(e.date)} · ${esc(e.title)}</strong>${esc(e.details)}</div>`).join('')||'<div class="empty">Aucun historique.</div>';
  }else{
    body=`<div class="dashboard"><div class="card"><div class="card-head"><h2>Objectif</h2></div><p>${esc(p.objective||'Aucun objectif défini.')}</p></div><div class="card"><div class="card-head"><h2>Entretiens à venir</h2><button class="tiny" data-action="newTask">＋ Ajouter</button></div>${tasks.map(taskRow).join('')||'<div class="empty">Aucun entretien prévu.</div>'}</div><div class="card"><div class="card-head"><h2>Observations</h2><button class="tiny" data-action="newObservation">＋ Ajouter</button></div>${(p.observations||[]).sort((a,b)=>b.date.localeCompare(a.date)).map(o=>`<div class="observ"><strong>${fmt(o.date)}</strong>${esc(o.text)}</div>`).join('')||'<div class="empty">Aucune observation.</div>'}</div></div>`;
  }
  shell(`<section class="content"><button class="btn secondary" data-view="plants">← Toutes les plantes</button><div class="detail-hero" style="margin-top:22px"><div class="detail-photo">${p.mainPhoto?`<img src="${p.mainPhoto}" alt="${esc(p.name)}">`:p.emoji||'🌿'}</div><div><div class="eyebrow">${esc(p.category)}</div><div class="title-row"><div><h1>${esc(p.name)}</h1><p class="subtitle"><i>${esc(p.botanical||'')}</i></p></div><div><button class="btn secondary" data-action="editPlant">Modifier</button> <button class="btn danger" data-action="deletePlant">Supprimer</button></div></div><div class="health">${healthDot(p.health)} ${esc(p.health)}</div><div class="detail-meta"><div class="meta"><small>Emplacement</small><strong>${esc(p.location)}</strong></div><div class="meta"><small>Milieu</small><strong>${esc(p.environment||'Non renseigné')}</strong></div><div class="meta"><small>Exposition</small><strong>${esc(p.exposure||'Non renseignée')}</strong></div><div class="meta"><small>Substrat</small><strong>${esc(p.substrate||'Non renseigné')}</strong></div><div class="meta"><small>Dernier rempotage</small><strong>${esc(p.lastRepotDate?fmt(p.lastRepotDate):'Non renseigné')}</strong></div><div class="meta"><small>Seuils météo</small><strong>${esc((p.coldThreshold!==''&&p.coldThreshold!=null?'❄️ '+p.coldThreshold+'°C':'—')+' · '+(p.heatThreshold!==''&&p.heatThreshold!=null?'☀️ '+p.heatThreshold+'°C':'—'))}</strong></div></div><p>${esc(p.notes||'')}</p><button class="btn primary" data-action="addPhoto">▣ Ajouter une photo</button> <button class="btn secondary" data-action="newObservation">＋ Observation</button></div></div><div class="tabs">${[['aperçu','Aperçu'],['photos',`Photos (${(p.photos||[]).length})`],['timeline','Évolution'],['historique','Historique']].map(([t,l])=>`<button class="${tab===t?'active':''}" data-tab="${t}">${l}</button>`).join('')}</div>${body}</section>`);
}
function options(list,current=''){return list.map(x=>`<option ${x===current?'selected':''}>${esc(x)}</option>`).join('')}
function renderModal(){if(modal.type==='plant')return plantModal(modal.data);if(modal.type==='task')return taskModal();if(modal.type==='observation')return observationModal();if(modal.type==='photo')return photoModal();if(modal.type==='viewPhoto')return `<div class="modal-backdrop" data-close><div class="modal" style="padding:10px"><img src="${modal.data}" alt="Photo agrandie" style="display:block;width:100%;max-height:85vh;object-fit:contain;border-radius:14px"></div></div>`;return ''}
function plantModal(p={}){return `<div class="modal-backdrop"><form class="modal" id="plantForm"><div class="modal-head"><div><div class="eyebrow">${p.id?'Modification':'Nouvelle fiche'}</div><h2>${p.id?'Modifier la plante':'Ajouter une plante'}</h2></div><button class="close" type="button" data-close>×</button></div><input name="id" value="${esc(p.id||'')}" hidden><div class="form-grid"><div class="field"><label>Nom de la plante *</label><input name="name" required value="${esc(p.name||'')}"></div><div class="field"><label>Nom commun</label><input name="common" value="${esc(p.common||'')}"></div><div class="field"><label>Nom botanique</label><input name="botanical" value="${esc(p.botanical||'')}"></div><div class="field"><label>Catégorie *</label><input name="category" list="categories" required value="${esc(p.category||'')}"><datalist id="categories">${options(state.categories)}</datalist></div><div class="field"><label>Emplacement *</label><input name="location" list="locations" required value="${esc(p.location||'')}"><datalist id="locations">${options(state.locations)}</datalist></div><div class="field"><label>Intérieur / extérieur</label><select name="environment">${options(['Extérieur','Intérieur','Serre'],p.environment)}</select></div><div class="field"><label>État de santé</label><select name="health">${options(['Très bonne santé','Bonne santé','À surveiller','Problème','Dormance / hivernage'],p.health||'Bonne santé')}</select></div><div class="field"><label>Exposition</label><input name="exposure" placeholder="Ex. plein soleil" value="${esc(p.exposure||'')}"></div><div class="field"><label>Substrat</label><input name="substrate" placeholder="Ex. akadama / pouzzolane" value="${esc(p.substrate||'')}"></div><div class="field"><label>Dernier rempotage</label><input name="lastRepotDate" type="date" value="${esc(p.lastRepotDate||'')}"></div><div class="field"><label>Dimensions du pot</label><input name="potSize" placeholder="Ex. 30 × 20 cm" value="${esc(p.potSize||'')}"></div><div class="field"><label>Seuil froid (°C)</label><input name="coldThreshold" type="number" step="1" placeholder="Facultatif" value="${esc(p.coldThreshold??'')}"></div><div class="field"><label>Seuil chaleur (°C)</label><input name="heatThreshold" type="number" step="1" placeholder="Facultatif" value="${esc(p.heatThreshold??'')}"></div><div class="field full"><label>Objectif</label><textarea name="objective">${esc(p.objective||'')}</textarea></div><div class="field full"><label>Commentaires libres</label><textarea name="notes">${esc(p.notes||'')}</textarea></div><div class="field full"><label>Photo principale</label><input name="photo" type="file" accept="image/*"></div></div><div class="form-actions"><button class="btn secondary" type="button" data-close>Annuler</button><button class="btn primary">Enregistrer la plante</button></div></form></div>`}
function taskModal(){return `<div class="modal-backdrop"><form class="modal" id="taskForm"><div class="modal-head"><div><div class="eyebrow">Entretien</div><h2>Programmer un entretien</h2></div><button class="close" type="button" data-close>×</button></div><div class="form-grid"><div class="field"><label>Plante *</label><select name="plantId" required>${state.plants.map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${esc(p.name)}</option>`)}</select></div><div class="field"><label>Type</label><input name="type" value="Arrosage" required></div><div class="field full"><label>Intitulé *</label><input name="title" placeholder="Ex. Vérifier la ligature" required></div><div class="field"><label>Première échéance *</label><input name="date" type="date" value="${today()}" required></div><div class="field"><label>Récurrence</label><select name="recurrence"><option value="none">Ponctuel</option><option value="days">Tous les X jours</option><option value="months">Tous les X mois</option><option value="yearly">Tous les ans</option></select></div><div class="field"><label>Intervalle</label><input name="interval" type="number" min="1" value="1"><small class="field-help">Ex. 30 + “jours” = tous les 30 jours.</small></div><div class="field"><label>Période active — début</label><select name="seasonStart">${monthOptions()}</select></div><div class="field"><label>Période active — fin</label><select name="seasonEnd">${monthOptions()}</select></div><div class="field full"><label>Notes</label><textarea name="notes"></textarea></div></div><div class="form-actions"><button class="btn secondary" type="button" data-close>Annuler</button><button class="btn primary">Programmer</button></div></form></div>`}
function observationModal(){return `<div class="modal-backdrop"><form class="modal" id="observationForm"><div class="modal-head"><h2>Ajouter une observation</h2><button class="close" type="button" data-close>×</button></div><div class="form-grid"><div class="field"><label>Date</label><input name="date" type="date" value="${today()}" required></div><div class="field full"><label>Votre observation *</label><textarea name="text" placeholder="Ex. Apparition de nouvelles feuilles…" required></textarea></div><div class="field full"><label>Photo facultative</label><input name="photo" type="file" accept="image/*"></div></div><div class="form-actions"><button class="btn secondary" type="button" data-close>Annuler</button><button class="btn primary">Ajouter</button></div></form></div>`}
function photoModal(){return `<div class="modal-backdrop"><form class="modal" id="photoForm"><div class="modal-head"><h2>Ajouter une photo</h2><button class="close" type="button" data-close>×</button></div><div class="form-grid"><div class="field"><label>Date</label><input name="date" type="date" value="${today()}" required></div><div class="field"><label>Type de photo</label><select name="type">${options(['Vue générale','Feuillage','Fleur','Tronc','Racines','Problème','Après taille','Avant rempotage','Après rempotage'])}</select></div><div class="field full"><label>Image *</label><input name="photo" type="file" accept="image/*" required></div><div class="field full"><label>Commentaire</label><textarea name="comment"></textarea></div></div><div class="form-actions"><button class="btn primary">Ajouter à la galerie</button></div></form></div>`}
async function fileData(file){return file?await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)}):null}
function toast(msg){const d=document.createElement('div');d.className='toast';d.textContent=msg;document.body.append(d);setTimeout(()=>d.remove(),2600)}
function download(name,content,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href)}
function bind(){document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;selected=null;render()});document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>action(b.dataset.action));document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{modal=null;render()});document.querySelectorAll('[data-plant]').forEach(b=>b.onclick=()=>{selected=b.dataset.plant;view='plant';tab='aperçu';render()});document.querySelectorAll('[data-photo]').forEach(b=>b.onclick=()=>{modal={type:'viewPhoto',data:plant(selected).photos[Number(b.dataset.photo)].data};render()});document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render()});document.querySelectorAll('[data-filter]').forEach(s=>s.onchange=()=>{filter[s.dataset.filter]=s.value;render()});const gs=document.querySelector('#globalSearch');gs.oninput=e=>{filter.q=e.target.value;if(view!=='plants')view='plants';render();const next=document.querySelector('#globalSearch');next.focus();next.setSelectionRange(next.value.length,next.value.length)};document.querySelectorAll('[data-done]').forEach(b=>b.onclick=()=>done(b.dataset.done));document.querySelectorAll('[data-postpone]').forEach(b=>b.onclick=()=>postpone(b.dataset.postpone));document.querySelectorAll('[data-ignore]').forEach(b=>b.onclick=()=>ignore(b.dataset.ignore));document.querySelectorAll('[data-cal]').forEach(b=>b.onclick=()=>{calDate.setMonth(calDate.getMonth()+Number(b.dataset.cal));render()});document.querySelector('#plantForm')?.addEventListener('submit',submitPlant);document.querySelector('#taskForm')?.addEventListener('submit',submitTask);document.querySelector('#observationForm')?.addEventListener('submit',submitObservation);document.querySelector('#photoForm')?.addEventListener('submit',submitPhoto);const imp=document.querySelector('#importFile');if(imp)imp.onchange=importBackup}
function action(a){if(a==='weather'){localStorage.setItem(WEATHER_PREF,'1');loadWeather();return}if(a==='newPlant')modal={type:'plant',data:{}};if(a==='editPlant')modal={type:'plant',data:plant(selected)};if(a==='newTask')modal={type:'task'};if(a==='newObservation'){if(!selected)return toast('Ouvrez d’abord une plante.');modal={type:'observation'}}if(a==='addPhoto')modal={type:'photo'};if(a==='deletePlant'&&confirm('Supprimer cette plante et ses données ?')){state.plants=state.plants.filter(p=>p.id!==selected);state.tasks=state.tasks.filter(t=>t.plantId!==selected);save();view='plants';selected=null;toast('Plante supprimée.')}if(a==='export')download(`mon-jardin-sauvegarde-${today()}.json`,JSON.stringify(state,null,2),'application/json');if(a==='csv'){const rows=[['Nom','Nom botanique','Catégorie','Emplacement','État'],...state.plants.map(p=>[p.name,p.botanical,p.category,p.location,p.health])];download(`mes-plantes-${today()}.csv`,rows.map(r=>r.map(x=>`"${String(x||'').replaceAll('"','""')}"`).join(';')).join('\n'),'text/csv;charset=utf-8')}render()}
async function submitPlant(e){e.preventDefault();const f=new FormData(e.target),id=f.get('id')||uid(),old=plant(id)||{},photo=await fileData(f.get('photo'));const p={...old,id,name:f.get('name'),common:f.get('common'),botanical:f.get('botanical'),category:f.get('category'),location:f.get('location'),environment:f.get('environment'),health:f.get('health'),exposure:f.get('exposure'),substrate:f.get('substrate'),lastRepotDate:f.get('lastRepotDate'),potSize:f.get('potSize'),coldThreshold:f.get('coldThreshold'),heatThreshold:f.get('heatThreshold'),objective:f.get('objective'),notes:f.get('notes'),emoji:old.emoji||'🌿',photos:old.photos||[],observations:old.observations||[]};if(photo)p.mainPhoto=photo;if(old.id)state.plants=state.plants.map(x=>x.id===id?p:x);else state.plants.push(p);if(!state.categories.includes(p.category))state.categories.push(p.category);if(!state.locations.includes(p.location))state.locations.push(p.location);save();modal=null;selected=id;view='plant';toast('Plante enregistrée.');render()}
function submitTask(e){
  e.preventDefault();const f=new FormData(e.target);
  const recurrence=f.get('recurrence')||'none',seasonStart=f.get('seasonStart')||'',seasonEnd=f.get('seasonEnd')||'';
  if((seasonStart&&!seasonEnd)||(!seasonStart&&seasonEnd))return alert('Pour une période saisonnière, renseigne le mois de début et le mois de fin.');
  state.tasks.push({id:uid(),plantId:f.get('plantId'),type:f.get('type'),title:f.get('title'),date:f.get('date'),notes:f.get('notes'),status:'todo',recurrence,interval:Math.max(1,Number(f.get('interval'))||1),seasonStart,seasonEnd});
  save();modal=null;toast(recurrence==='none'?'Entretien programmé.':'Entretien récurrent programmé.');render();
}
async function submitObservation(e){e.preventDefault();const f=new FormData(e.target),p=plant(selected),photo=await fileData(f.get('photo')),o={id:uid(),date:f.get('date'),text:f.get('text')};p.observations.push(o);if(photo)p.photos.push({id:uid(),date:o.date,type:'Observation',comment:o.text,data:photo});save();modal=null;toast('Observation ajoutée au journal.');render()}
async function submitPhoto(e){e.preventDefault();const f=new FormData(e.target),data=await fileData(f.get('photo')),p=plant(selected);p.photos.push({id:uid(),date:f.get('date'),type:f.get('type'),comment:f.get('comment'),data});if(!p.mainPhoto)p.mainPhoto=data;state.history.push({id:uid(),plantId:p.id,date:f.get('date'),title:'Photo',details:f.get('comment')||f.get('type')});save();modal=null;tab='photos';toast('Photo ajoutée.');render()}
function done(id){
  const t=state.tasks.find(x=>x.id===id);if(!t)return;
  state.history.push({id:uid(),plantId:t.plantId,date:today(),title:t.type,details:t.title+(t.notes?' — '+t.notes:'')});
  const next=nextTaskDate(t,today());
  if(next){t.lastDone=today();t.date=next;t.status='todo';save();toast('Entretien enregistré · prochain rappel '+fmt(next)+'.');}
  else{t.status='done';save();toast('Entretien ajouté à l’historique.');}
  render();
}
function ignore(id){
  const t=state.tasks.find(x=>x.id===id);if(!t)return;
  const next=nextTaskDate(t,t.date||today());
  if(next){t.date=next;t.status='todo';save();toast('Cette occurrence est ignorée · prochaine échéance '+fmt(next)+'.');}
  else{t.status='ignored';save();toast('Rappel ignoré.');}
  render();
}
function postpone(id){const n=prompt('Reporter de combien de jours ? (1, 3 ou 7)','1');if(!n)return;const t=state.tasks.find(x=>x.id===id),d=new Date(t.date+'T12:00');d.setDate(d.getDate()+Number(n));t.date=d.toISOString().slice(0,10);save();toast(`Rappel reporté de ${n} jour(s).`);render()}
async function importBackup(e){try{const data=JSON.parse(await e.target.files[0].text());if(!Array.isArray(data.plants)||!Array.isArray(data.tasks))throw Error();if(confirm('Remplacer toutes les données actuelles ?')){state=data;save();toast('Sauvegarde restaurée.');render()}}catch{alert('Ce fichier de sauvegarde n’est pas valide.')}}
async function bootstrap(){
  try{
    const dbState=await loadGardenState();
    if(dbState&&Array.isArray(dbState.plants)){state=dbState;}
    else await saveGardenState(state);
  }catch(e){console.warn('Stockage IndexedDB indisponible, utilisation du stockage local.',e);}
  render();
  if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
  if(localStorage.getItem(WEATHER_PREF)==='1')loadWeather();
}
bootstrap();
