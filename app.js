const FIGS = [
  {id:'F05',q:'Q001 · Q006',cat:'Pace',title:'Weekly recorded collection volume',img:'F05-weekly-volume.png',finding:'Answers Q001 and Q006: the peak week beginning October 28, 2024 reached 112,592.90 CY. Three complete late-February/March weeks have no ticket records.',note:'No-record weeks do not prove that crews were idle.'},
  {id:'F16',q:'Q016',cat:'Maps',title:'Pickup volume by map cell',img:'F16-pickup-volume-map.png',finding:'Answers Q016: this map shows where recorded ticket CY is concentrated.',note:'Ticket coordinates do not measure remaining debris.'},
  {id:'F24',q:'M01',cat:'Maps',title:'Contractor pickup footprint',img:'F24-contractor-footprint-map.png',finding:'Switch between DRC and PINELLAS COUNTY ticket CY on the same street map and scale.',note:'The file has no separate subcontractor field.'},
  {id:'F25',q:'Q032 · Q035 (partial)',cat:'Maps',title:'Missing address and GPS-field flags',img:'F25-location-quality-map.png',finding:'Partial evidence for Q032 and Q035: 114 tickets have blank collection addresses; one GPS text coordinate differs from numeric Lat/Lng.',note:'New figures are still needed for affected CY and GPS precision. These flags are not confirmed wrong locations.'},
  {id:'F26',q:'Q030',cat:'Maps',title:'Coordinate spread under repeated addresses',img:'F26-address-spread-candidates-map.png',finding:'Answers Q030: fifteen repeated address labels have pickup points spread more than 1 km at the 90th percentile.',note:'Broad road or park labels can legitimately cover many points. Q045 needs authoritative address geometry.'},
  {id:'F27',q:'M01',cat:'Contractors',title:'Volume and participation by contractor label',img:'F27-contractor-volume.png',finding:'DRC has 608,886.10 CY on 14,799 tickets; PINELLAS COUNTY has 36,066.55 CY on 3,479.',note:'These are ticket labels, not a verified subcontractor roster or productivity comparison.'},
  {id:'F28',q:'M02',cat:'Trucks',title:'Weekly truck IDs with tickets',img:'F28-weekly-active-trucks.png',finding:'The busiest observed week has 142 distinct truck IDs with ticket records.',note:'This counts recorded activity, not every truck deployed or available.'},
  {id:'F29',q:'M03',cat:'Trucks',title:'Listed capacity of unique trucks',img:'F29-truck-capacity-distribution.png',finding:'The tickets identify 283 distinct truck IDs: 183 under DRC and 100 under PINELLAS COUNTY.',note:'Each ID is counted once; capacity is a listed value, not measured payload.'},
  {id:'F21',q:'M04 · Q025 (partial)',cat:'Areas',title:'Recorded activity duration by debris zone',img:'F21-zone-activity-duration.png',finding:'Partial evidence for Q025: across 30 debris zones, first ticket to 90% of each zone’s CY ranges from 32 to 122 days. Q025 still needs duration at each location.',note:'This measures ticket activity, not verified cleanup completion or city boundaries.'}
];

const $ = (s) => document.querySelector(s);
const fmt = (n, digits=0) => Number(n).toLocaleString('en-US',{maximumFractionDigits:digits,minimumFractionDigits:digits});
const START = new Date('2024-10-02T12:00:00Z');
const dateFromOffset = (n) => new Date(START.getTime()+n*86400000).toISOString().slice(0,10);
const offsetFromDate = (s) => Math.round((new Date(`${s}T12:00:00Z`)-START)/86400000);
const tooltip = $('#tooltip');
let DATA = null, rows = [], visible = [];
const ALL_VIEW = {lon0:-82.875,lon1:-82.59,lat0:27.59,lat1:28.20};
const state = {from:0,to:190,type:'all',incident:'all',minVolume:0,bounds:null,view:{...ALL_VIEW},category:'All',search:''};
const PINELLAS_BOUNDS=[[27.59,-82.875],[28.20,-82.59]];
const MAP_IDS=new Set(['F16','F24','F25','F26']);
const previewMaps=new Map();
let mapOverlaysPromise=null,previewObserver=null,figureMap=null,activeFigureId=null;
const mapOverlays=()=>mapOverlaysPromise||(mapOverlaysPromise=fetch('data/map-overlays.json?v=basemap-1').then(r=>{if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()}));
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const osmTiles=()=>L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'});
function mapColor(id,value){
  if(id==='F25')return '#d47b28';
  if(id==='F26')return value>=1?'#ad3f36':value>=.25?'#dd8d29':'#247c87';
  return value>=5000?'#9b2f31':value>=1000?'#d46b29':value>=100?'#e9a93b':'#178b88';
}
function addFigurePoints(map,id,group,{preview=false}={}){
  const layer=L.layerGroup();
  for(const p of group.points){
    if(!Number.isFinite(p.lat)||!Number.isFinite(p.lon))continue;
    const color=id==='F25'&&group.name==='GPS field conflict'?'#17324b':mapColor(id,p.value);
    const radius=id==='F25'?(group.name==='GPS field conflict'?7:4.5):id==='F26'?Math.max(4,Math.min(11,Number(p.size||10)/2)):id==='F16'?6:5;
    const marker=L.circleMarker([p.lat,p.lon],{radius:preview?Math.max(2.5,radius*.7):radius,color:'#fff',weight:preview?.5:1,fillColor:color,fillOpacity:preview?.77:.84,interactive:!preview});
    if(!preview){
      const detail=escapeHtml(p.detail).replace(/\n/g,'<br>');
      marker.bindPopup(`<strong>${escapeHtml(group.name)}</strong><br>${detail}`,{maxWidth:320});
      marker.on('click',()=>{$('#pointReadout').textContent=p.detail.replace(/\n/g,' · ')});
    }
    layer.addLayer(marker);
  }
  layer.addTo(map);
  return layer;
}
async function initPreviewMaps(){
  if(previewObserver)previewObserver.disconnect();
  for(const map of previewMaps.values())map.remove();
  previewMaps.clear();
  if(!window.L)return;
  previewObserver=new IntersectionObserver(async entries=>{
    for(const entry of entries){
      if(!entry.isIntersecting)continue;
      previewObserver.unobserve(entry.target);
      const host=entry.target.querySelector('[data-map-preview]'),id=host.dataset.mapPreview;
      try{
        const overlays=await mapOverlays();
        if(!host.isConnected)return;
        host.hidden=false;
        const map=L.map(host,{zoomControl:false,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,boxZoom:false,keyboard:false,touchZoom:false,preferCanvas:true});
        previewMaps.set(host,map);
        osmTiles().addTo(map);
        map.fitBounds(PINELLAS_BOUNDS,{padding:[4,4]});
        addFigurePoints(map,id,overlays[id][0],{preview:true});
        host.parentElement.querySelector('img').hidden=true;
        setTimeout(()=>map.invalidateSize(),0);
      }catch(error){console.error('Map preview unavailable',error)}
    }
  },{rootMargin:'100px'});
  document.querySelectorAll('[data-map-preview]').forEach(el=>previewObserver.observe(el.parentElement));
}

function renderFigureGallery(){
  if(previewObserver)previewObserver.disconnect();
  for(const map of previewMaps.values())map.remove();
  previewMaps.clear();
  const cats=['All',...new Set(FIGS.map(f=>f.cat))];
  $('#categoryFilters').innerHTML=cats.map(c=>`<button type="button" data-category="${c}" class="${c===state.category?'active':''}">${c}</button>`).join('');
  $('#categoryFilters').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{state.category=b.dataset.category;renderFigureGallery()}));
  const filtered=FIGS.filter(f=>(state.category==='All'||f.cat===state.category)&&`${f.title} ${f.finding} ${f.note} ${f.id} ${f.q}`.toLowerCase().includes(state.search));
  $('#figureCount').textContent=`Showing ${filtered.length} of ${FIGS.length} figures`;
  $('#figureGrid').innerHTML=filtered.map(f=>`<article class="figure-card" id="figure-${f.id}"><button type="button" class="figure-image" data-open="${f.id}" aria-label="Open interactive ${f.id}: ${f.title}">${MAP_IDS.has(f.id)?`<div class="map-preview" data-map-preview="${f.id}" hidden></div>`:''}<img loading="lazy" src="figures/${f.img}" alt="${f.title} visualization"></button><div class="figure-body"><span class="figure-meta">${f.id} · ${f.cat.toUpperCase()} · QUESTION ${f.q}</span><h3>${f.title}</h3><p>${f.finding}</p><p class="figure-note"><strong>Read with care:</strong> ${f.note}</p><button type="button" class="figure-open" data-open="${f.id}">${MAP_IDS.has(f.id)?'Open street map ↗':'Explore exact values ↗'}</button>${MAP_IDS.has(f.id)?'<a class="map-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>':''}</div></article>`).join('');
  $('#figureGrid').querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>openModal(b.dataset.open)));
  initPreviewMaps();
}

let modalScale=1,modalX=0,modalY=0,modalDrag=null,figureValuesPromise=null,figureDetailsPromise=null,modalRequest=0,modalView='interactive';
function modalTransform(){ $('#modalImage').style.transform=`translate(${modalX}px,${modalY}px) scale(${modalScale})`; }
function showModalView(view){
  modalView=view;
  const interactive=view==='interactive';
  const image=view==='image';
  $('#interactiveViewport').hidden=!interactive;
  $('#modalViewport').hidden=!image;
  $('#modalInfoViewport').hidden=view!=='info';
  $('#modalInteractive').classList.toggle('selected',interactive);
  $('#modalOriginal').classList.toggle('selected',image);
  $('#modalInfo').classList.toggle('selected',view==='info');
  for(const [id,active] of [['#modalInteractive',interactive],['#modalOriginal',image],['#modalInfo',view==='info']])$(id).setAttribute('aria-pressed',String(active));
  for(const id of ['#modalZoomOut','#modalZoomIn','#modalReset'])$(id).hidden=!image;
  if(interactive&&$('#interactiveChart').data)Plotly.Plots.resize($('#interactiveChart'));
  if(interactive&&figureMap)setTimeout(()=>figureMap.invalidateSize(),0);
}
async function renderFigureMap(id,request){
  if(!window.L)throw Error('Leaflet map library did not load');
  const overlays=await mapOverlays();
  if(request!==modalRequest||$('#imageModal').hidden)return;
  $('#interactiveChart').hidden=true;
  const host=$('#leafletMap');host.hidden=false;
  const controls=$('#mapLayerControls');controls.hidden=false;
  figureMap=L.map(host,{preferCanvas:true,scrollWheelZoom:true});
  osmTiles().addTo(figureMap);
  figureMap.fitBounds(PINELLAS_BOUNDS,{padding:[12,12]});
  L.control.scale({imperial:false}).addTo(figureMap);
  let shown=[];
  const showGroups=indexes=>{
    for(const layer of shown)figureMap.removeLayer(layer);
    shown=indexes.map(i=>addFigurePoints(figureMap,id,overlays[id][i]));
    controls.querySelectorAll('[data-group]').forEach(b=>b.setAttribute('aria-pressed',String(indexes.includes(Number(b.dataset.group)))));
  };
  if(id==='F24'){
    controls.innerHTML='<span>Contractor:</span> <button type="button" data-group="0" aria-pressed="true">DRC</button> <button type="button" data-group="1" aria-pressed="false">PINELLAS COUNTY</button><span class="map-key">Cell CY: <i class="key-low"></i>&lt;100 <i class="key-minor"></i>100–999 <i class="key-mid"></i>1,000–4,999 <i class="key-high"></i>5,000+</span>';
    controls.querySelectorAll('[data-group]').forEach(b=>b.addEventListener('click',()=>showGroups([Number(b.dataset.group)])));
    showGroups([0]);
  }else{
    showGroups(overlays[id].map((_,i)=>i));
    controls.innerHTML=id==='F25'?'<span class="map-key"><i class="key-missing"></i> Blank address <i class="key-conflict"></i> GPS text / numeric conflict</span>':'<span class="map-key">'+(id==='F26'?'<i class="key-low"></i> under 0.25 km <i class="key-mid"></i> 0.25–1 km <i class="key-high"></i> 1+ km spread':'Cell CY: <i class="key-low"></i> &lt;100 <i class="key-minor"></i> 100–999 <i class="key-mid"></i> 1,000–4,999 <i class="key-high"></i> 5,000+')+'</span>';
  }
  $('#pointReadout').textContent=id==='F16'||id==='F24'?'Each circle marks an aggregated cell center. Click a circle for its exact center coordinates and recorded CY.':id==='F26'?'Color shows 90th percentile coordinate spread; circle size shows ticket count. Click a point for exact values.':'Click a point for its exact plotted coordinates and values.';
  $('.interaction-help').textContent='Drag to pan; scroll or use +/− to zoom. Open Question & finding for interpretation. Map data are recorded ticket locations.';
  setTimeout(()=>figureMap?.invalidateSize(),0);
}
async function openModal(id){
  const f=FIGS.find(x=>x.id===id);if(!f)return;
  const request=++modalRequest;
  activeFigureId=id;
  if(figureMap){figureMap.remove();figureMap=null}
  $('#leafletMap').hidden=true;$('#mapLayerControls').hidden=true;
  $('#interactiveChart').hidden=MAP_IDS.has(id);
  $('#modalOriginal').hidden=MAP_IDS.has(id);
  $('#modalInteractive').textContent=MAP_IDS.has(id)?'Map & values':'Exact values';
  $('.interaction-help').textContent='Hover or tap a mark to see its exact values. Drag over a region to zoom; double-click the chart to reset.';
  $('#modalIndex').textContent=`${f.id} / ${FIGS.length} · ${f.cat.toUpperCase()} · QUESTION ${f.q}`;
  $('#modalTitle').textContent=f.title;
  $('#modalImage').src=`figures/${f.img}`;
  $('#modalImage').alt=f.title;
  $('#modalQuestion').textContent=`${f.q}: Loading…`;
  $('#modalVariables').textContent='Loading…';
  $('#modalInterpretation').textContent='Loading…';
  $('#imageModal').hidden=false;document.body.style.overflow='hidden';$('#top').style.visibility='hidden';
  modalScale=1;modalX=0;modalY=0;modalTransform();
  showModalView('interactive');
  $('#pointReadout').textContent='Loading exact values…';
  $('#modalClose').focus();
  if(!figureDetailsPromise)figureDetailsPromise=fetch('data/figure-details.json?v=questions-1').then(r=>{if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()});
  figureDetailsPromise.then(details=>{
    if(request!==modalRequest||$('#imageModal').hidden)return;
    const d=details[id];
    if(!d)throw Error(`Missing details for ${id}`);
    $('#modalQuestion').textContent=d.question;
    $('#modalVariables').textContent=d.variables;
    $('#modalInterpretation').textContent=d.interpretation;
  }).catch(error=>{
    if(request!==modalRequest)return;
    $('#modalQuestion').textContent=f.q;
    $('#modalVariables').textContent='Details could not load.';
    $('#modalInterpretation').textContent=f.finding;
    figureDetailsPromise=null;
    console.error('Could not load figure details',error);
  });
  try{
    if(MAP_IDS.has(id)){
      await renderFigureMap(id,request);
      return;
    }
    if(!figureValuesPromise)figureValuesPromise=fetch('data/figure-values.json?v=priority-3').then(r=>{if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()});
    const specs=await figureValuesPromise;
    if(request!==modalRequest||$('#imageModal').hidden)return;
    const chart=$('#interactiveChart');
    if(chart.data)Plotly.purge(chart);
    await Plotly.newPlot(chart,specs[id].data,specs[id].layout,{responsive:true,displaylogo:false,scrollZoom:true,modeBarButtonsToRemove:['sendDataToCloud']});
    if(request!==modalRequest)return;
    $('#pointReadout').textContent='Hover or tap a bar, point, or cell to read its exact X and Y values.';
    const update=e=>{
      const p=e.points?.[0];if(!p)return;
      let label=p.customdata||p.text;
      if(!label&&typeof p.pointNumber==='number')label=p.data?.text?.[p.pointNumber];
      if(!label&&Array.isArray(p.pointNumber))label=p.data?.text?.[p.pointNumber[1]]?.[p.pointNumber[0]];
      if(!label&&p.data?.type==='box')label=p.data.hovertemplate;
      $('#pointReadout').textContent=String(label||`X: ${p.x} · Y: ${p.y}`).replace(/<br\s*\/?\s*>/gi,' · ').replace(/<[^>]*>/g,'').replace(/%\{[^}]+\}/g,'').trim();
    };
    chart.on('plotly_hover',update);chart.on('plotly_click',update);
  }catch(error){
    if(request!==modalRequest)return;
    $('#pointReadout').textContent=MAP_IDS.has(id)?'Street map could not load. Check the connection and reload.':'Exact values could not load. The original image is available.';
    if(modalView==='interactive'&&!MAP_IDS.has(id))showModalView('image');
    figureValuesPromise=null;
    console.error('Could not load interactive figure',error);
  }
}
function closeModal(){++modalRequest;$('#imageModal').hidden=true;document.body.style.overflow='';$('#top').style.visibility='';$('#modalImage').src='';if(figureMap){figureMap.remove();figureMap=null}if($('#interactiveChart').data)Plotly.purge($('#interactiveChart'))}
function modalZoom(factor){modalScale=Math.max(1,Math.min(8,modalScale*factor));if(modalScale===1){modalX=0;modalY=0}modalTransform()}
$('#modalInteractive').addEventListener('click',()=>showModalView('interactive'));
$('#modalOriginal').addEventListener('click',()=>showModalView('image'));
$('#modalInfo').addEventListener('click',()=>showModalView('info'));
$('#modalClose').addEventListener('click',closeModal);$('#modalZoomIn').addEventListener('click',()=>modalZoom(1.35));$('#modalZoomOut').addEventListener('click',()=>modalZoom(1/1.35));$('#modalReset').addEventListener('click',()=>{modalScale=1;modalX=modalY=0;modalTransform()});
$('#imageModal').addEventListener('click',e=>{if(e.target===$('#imageModal'))closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#imageModal').hidden)closeModal()});
$('#modalViewport').addEventListener('wheel',e=>{e.preventDefault();modalZoom(e.deltaY<0?1.15:1/1.15)},{passive:false});
$('#modalViewport').addEventListener('pointerdown',e=>{if(modalScale<=1)return;modalDrag={x:e.clientX,y:e.clientY,tx:modalX,ty:modalY};e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.classList.add('grabbing')});
$('#modalViewport').addEventListener('pointermove',e=>{if(!modalDrag)return;modalX=modalDrag.tx+e.clientX-modalDrag.x;modalY=modalDrag.ty+e.clientY-modalDrag.y;modalTransform()});
$('#modalViewport').addEventListener('pointerup',e=>{modalDrag=null;e.currentTarget.classList.remove('grabbing')});
$('#figureSearch').addEventListener('input',e=>{state.search=e.target.value.trim().toLowerCase();renderFigureGallery()});
renderFigureGallery();
if(location.hash.startsWith('#figure-'))setTimeout(()=>document.querySelector(location.hash)?.scrollIntoView(),150);

function setTooltip(html,x,y){tooltip.innerHTML=html;tooltip.style.left=`${Math.min(window.innerWidth-180,x+12)}px`;tooltip.style.top=`${Math.max(5,y-48)}px`;tooltip.hidden=false}
function hideTooltip(){tooltip.hidden=true}
function matches(r){return r[0]>=state.from&&r[0]<=state.to&&(state.type==='all'||String(r[1])===state.type)&&(state.incident==='all'||String(r[2])===state.incident)&&r[3]>=state.minVolume&&(!state.bounds||(r[5]>=state.bounds.lon0&&r[5]<=state.bounds.lon1&&r[4]>=state.bounds.lat0&&r[4]<=state.bounds.lat1))}
function update(){if(!DATA)return;visible=rows.filter(matches);const cy=visible.reduce((s,r)=>s+r[3],0);$('#filteredTickets').textContent=fmt(visible.length);$('#filteredVolume').textContent=fmt(cy,2);$('#filteredMean').textContent=visible.length?fmt(cy/visible.length,1):'0';$('#clearArea').disabled=!state.bounds;renderTrend();renderMap();renderTypeMix()}

function renderTrend(){
  const host=$('#trendChart'),width=Math.max(360,host.clientWidth),height=255,margin={l:46,r:12,t:12,b:35};
  const span=Math.max(1,state.to-state.from+1),bars=Array(span).fill(0),counts=Array(span).fill(0);
  for(const r of visible){let i=r[0]-state.from;if(i>=0&&i<span){bars[i]+=r[3];counts[i]++}}
  const peak=Math.max(1,...bars),iw=width-margin.l-margin.r,ih=height-margin.t-margin.b;
  const barW=iw/span,points=bars.map((v,i)=>{let h=v/peak*ih;return `<rect x="${(margin.l+i*barW).toFixed(2)}" y="${(margin.t+ih-h).toFixed(2)}" width="${Math.max(.7,barW-.4).toFixed(2)}" height="${h.toFixed(2)}" fill="#02877c" opacity=".83"/>`}).join('');
  const ticks=[0,.25,.5,.75,1].map(p=>{const y=margin.t+ih*(1-p);return `<line x1="${margin.l}" x2="${width-margin.r}" y1="${y}" y2="${y}" stroke="#e8eeee"/><text x="${margin.l-7}" y="${y+3}" text-anchor="end" fill="#809298" font-size="10">${peak*p>=1000?`${(peak*p/1000).toFixed(0)}k`:Math.round(peak*p)}</text>`}).join('');
  const d0=dateFromOffset(state.from),d1=dateFromOffset(state.to),dm=dateFromOffset(state.from+Math.floor((span-1)/2));
  host.innerHTML=`<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="presentation">${ticks}${points}<line x1="${margin.l}" x2="${width-margin.r}" y1="${margin.t+ih}" y2="${margin.t+ih}" stroke="#aac0bf"/><text x="${margin.l}" y="${height-11}" fill="#84979d" font-size="10">${d0}</text><text x="${width/2}" y="${height-11}" text-anchor="middle" fill="#84979d" font-size="10">${dm}</text><text x="${width-margin.r}" y="${height-11}" text-anchor="end" fill="#84979d" font-size="10">${d1}</text><rect class="trend-brush" x="0" y="0" width="0" height="0" fill="#30ad9b55" stroke="#04897f" visibility="hidden"/><line class="hover-line" x1="0" x2="0" y1="${margin.t}" y2="${margin.t+ih}" stroke="#103e4d" stroke-dasharray="3 3" visibility="hidden"/><rect class="chart-hit" x="${margin.l}" y="${margin.t}" width="${iw}" height="${ih}" fill="transparent"/></svg>`;
  const svg=host.querySelector('svg'),hit=host.querySelector('.chart-hit'),brush=host.querySelector('.trend-brush'),hover=host.querySelector('.hover-line');let drag=null;
  const xAt=e=>{const rect=svg.getBoundingClientRect();return Math.max(margin.l,Math.min(width-margin.r,(e.clientX-rect.left)*width/rect.width))};
  const dayAt=x=>Math.max(0,Math.min(span-1,Math.floor((x-margin.l)/iw*span)));
  hit.addEventListener('pointerdown',e=>{drag=xAt(e);hit.setPointerCapture(e.pointerId);brush.setAttribute('visibility','visible')});
  hit.addEventListener('pointermove',e=>{const x=xAt(e),i=dayAt(x);hover.setAttribute('x1',x);hover.setAttribute('x2',x);hover.setAttribute('visibility','visible');setTooltip(`<strong>${dateFromOffset(state.from+i)}</strong><br>${fmt(counts[i])} tickets · ${fmt(bars[i],1)} CY`,e.clientX,e.clientY);if(drag!==null){brush.setAttribute('x',Math.min(drag,x));brush.setAttribute('y',margin.t);brush.setAttribute('width',Math.abs(x-drag));brush.setAttribute('height',ih)}});
  hit.addEventListener('pointerleave',()=>{if(drag===null){hideTooltip();hover.setAttribute('visibility','hidden')}});
  hit.addEventListener('pointerup',e=>{if(drag===null)return;const end=xAt(e),start=drag,lo=dayAt(Math.min(start,end)),hi=dayAt(Math.max(start,end));drag=null;hideTooltip();if(hi-lo>=1&&Math.abs(end-start)>3){const oldFrom=state.from;state.from=oldFrom+lo;state.to=oldFrom+hi;syncDateInputs();update()}else{brush.setAttribute('visibility','hidden')}});
  hit.addEventListener('pointercancel',()=>{drag=null;brush.setAttribute('visibility','hidden');hideTooltip()});
}

function renderTypeMix(){const sums=Array(DATA.types.length).fill(0),counts=Array(DATA.types.length).fill(0);for(const r of visible){sums[r[1]]+=r[3];counts[r[1]]++}const total=sums.reduce((a,b)=>a+b,0);const order=sums.map((v,i)=>i).sort((a,b)=>sums[b]-sums[a]);$('#typeBreakdown').innerHTML=visible.length?order.filter(i=>counts[i]).map(i=>{const pct=total?100*sums[i]/total:0;return `<button class="type-row" type="button" data-type="${i}" title="Filter to ${DATA.types[i]}"><span class="type-row-top"><span class="type-name">${DATA.types[i]}</span><span class="type-value">${fmt(pct,1)}%</span></span><span class="type-meter"><i style="width:${pct}%"></i></span></button>`}).join(''):'<p class="empty-state">No tickets match these filters.</p>';$('#typeBreakdown').querySelectorAll('[data-type]').forEach(b=>b.addEventListener('click',()=>{state.type=b.dataset.type;$('#typeFilter').value=state.type;update()}))}

const mapCanvas=$('#ticketMap'),mapWrap=mapCanvas.parentElement,mapSel=$('#mapSelection');let mapDrag=null,explorerMap=null,panMode=false;
function initExplorerMap(){
  if(!window.L){$('#mapStatus').textContent='Street map library unavailable. Reload the page.';return}
  explorerMap=L.map('explorerBasemap',{zoomControl:false,preferCanvas:true,scrollWheelZoom:true,dragging:false});
  osmTiles().addTo(explorerMap);
  explorerMap.fitBounds(PINELLAS_BOUNDS);
  explorerMap.on('move zoom resize',()=>renderMap());
  explorerMap.invalidateSize();
  renderMap();
}
const explorerObserver=new IntersectionObserver(entries=>{
  if(entries.some(e=>e.isIntersecting)){
    explorerObserver.disconnect();
    initExplorerMap();
  }
},{rootMargin:'100px'});
explorerObserver.observe(mapWrap);
function mapSize(){const r=mapWrap.getBoundingClientRect(),ratio=window.devicePixelRatio||1;mapCanvas.width=Math.round(r.width*ratio);mapCanvas.height=Math.round(r.height*ratio);return {w:r.width,h:r.height,ratio}}
function mapPos(lon,lat){const p=explorerMap.latLngToContainerPoint([lat,lon]);return [p.x,p.y]}
function geoPos(x,y){const p=explorerMap.containerPointToLatLng([x,y]);return [p.lng,p.lat]}
function renderMap(){if(!DATA||!explorerMap)return;const {w,h,ratio}=mapSize(),ctx=mapCanvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);ctx.fillStyle='#007f78';ctx.globalAlpha=.48;for(const r of visible){const [x,y]=mapPos(r[5],r[4]);if(x>=0&&x<w&&y>=0&&y<h)ctx.fillRect(x-1.3,y-1.3,2.6,2.6)}ctx.globalAlpha=1;$('#mapStatus').textContent=state.bounds?`Area selected · ${fmt(visible.length)} matching tickets · drag again to refine`:(panMode?'Drag to pan the street map · scroll to zoom':'Drag to select an area · choose Pan map to move the street map')}
function localPoint(e){const rect=mapWrap.getBoundingClientRect();return {x:Math.max(0,Math.min(rect.width,e.clientX-rect.left)),y:Math.max(0,Math.min(rect.height,e.clientY-rect.top)),w:rect.width,h:rect.height}}
mapCanvas.addEventListener('pointerdown',e=>{mapDrag=localPoint(e);mapCanvas.setPointerCapture(e.pointerId);mapSel.hidden=false});
mapCanvas.addEventListener('pointermove',e=>{if(!mapDrag)return;const p=localPoint(e),x=Math.min(p.x,mapDrag.x),y=Math.min(p.y,mapDrag.y);Object.assign(mapSel.style,{left:`${x}px`,top:`${y}px`,width:`${Math.abs(p.x-mapDrag.x)}px`,height:`${Math.abs(p.y-mapDrag.y)}px`})});
mapCanvas.addEventListener('pointerup',e=>{if(!mapDrag)return;const p=localPoint(e),d=mapDrag;mapDrag=null;mapSel.hidden=true;if(Math.abs(p.x-d.x)<8||Math.abs(p.y-d.y)<8)return;const [a,b]=geoPos(Math.min(p.x,d.x),Math.max(p.y,d.y)),[c,f]=geoPos(Math.max(p.x,d.x),Math.min(p.y,d.y));state.bounds={lon0:a,lon1:c,lat0:b,lat1:f};update()});
mapCanvas.addEventListener('pointercancel',()=>{mapDrag=null;mapSel.hidden=true});
$('#mapMode').addEventListener('click',()=>{panMode=!panMode;mapCanvas.style.pointerEvents=panMode?'none':'auto';explorerMap?.dragging[panMode?'enable':'disable']();$('#mapMode').textContent=panMode?'Select area':'Pan map';$('#mapMode').setAttribute('aria-pressed',String(panMode));renderMap()});
$('#mapZoomIn').addEventListener('click',()=>explorerMap?.zoomIn());$('#mapZoomOut').addEventListener('click',()=>explorerMap?.zoomOut());$('#mapReset').addEventListener('click',()=>explorerMap?.fitBounds(PINELLAS_BOUNDS));
mapCanvas.addEventListener('wheel',e=>{if(!explorerMap)return;e.preventDefault();const p=localPoint(e);explorerMap.setZoomAround([p.x,p.y],explorerMap.getZoom()+(e.deltaY<0?1:-1))},{passive:false});

function syncDateInputs(){$('#dateFrom').value=dateFromOffset(state.from);$('#dateTo').value=dateFromOffset(state.to)}
$('#dateFrom').addEventListener('change',e=>{state.from=Math.min(offsetFromDate(e.target.value),state.to);syncDateInputs();update()});
$('#dateTo').addEventListener('change',e=>{state.to=Math.max(offsetFromDate(e.target.value),state.from);syncDateInputs();update()});
$('#typeFilter').addEventListener('change',e=>{state.type=e.target.value;update()});
$('#incidentFilter').addEventListener('change',e=>{state.incident=e.target.value;update()});
$('#minVolume').addEventListener('input',e=>{state.minVolume=+e.target.value;$('#minVolumeValue').textContent=`${state.minVolume} CY`;update()});
$('#clearArea').addEventListener('click',()=>{state.bounds=null;update()});
$('#resetDateZoom').addEventListener('click',()=>{state.from=0;state.to=190;syncDateInputs();update()});
$('#resetFilters').addEventListener('click',()=>{Object.assign(state,{from:0,to:190,type:'all',incident:'all',minVolume:0,bounds:null,view:{...ALL_VIEW}});syncDateInputs();$('#typeFilter').value='all';$('#incidentFilter').value='all';$('#minVolume').value=0;$('#minVolumeValue').textContent='0 CY';explorerMap?.fitBounds(PINELLAS_BOUNDS);update()});
window.addEventListener('resize',()=>{if(DATA){renderTrend();explorerMap?.invalidateSize();renderMap()}});

fetch('data/tickets.json').then(r=>{if(!r.ok)throw new Error(`Data request failed (${r.status})`);return r.json()}).then(data=>{DATA=data;rows=data.rows;$('#typeFilter').innerHTML='<option value="all">All debris types</option>'+data.types.map((t,i)=>`<option value="${i}">${t}</option>`).join('');update()}).catch(err=>{$('#trendChart').innerHTML=`<p class="empty-state">The interactive data could not load. Please reload the page. ${err.message}</p>`;$('#mapStatus').textContent='Interactive data unavailable';console.error(err)});
