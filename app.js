const FIGS = [
  {id:'F01',cat:'Data quality',title:'Ticket field completeness',img:'F01-field-completeness.png',finding:'Core date, volume, type, and coordinate fields are filled for all 18,278 tickets. Collection address is present for 99.4%.',note:'ZoneName is almost entirely empty, so it should not be used for zone comparisons.'},
  {id:'F02',cat:'Data quality',title:'Ticket quality review flags',img:'F02-quality-flags.png',finding:'The main flag is 114 missing collection addresses. No tickets have invalid numeric coordinates or nonpositive recorded CY.',note:'These checks do not establish that every ticket represents a unique pickup stage.'},
  {id:'F03',cat:'Data quality',title:'Weekly tickets by incident ID',img:'F03-disaster-id-by-week.png',finding:'DisasterID 84 appears on 17,767 tickets; ID 80 appears on 511.',note:'The county must confirm which named incidents the numeric IDs represent.'},
  {id:'F04',cat:'Collection pace',title:'Daily recorded collection volume',img:'F04-daily-volume.png',finding:'November 1, 2024 was the highest recorded day at 19,187.4 cubic yards.',note:'A day with no ticket records does not prove that collection stopped.'},
  {id:'F05',cat:'Collection pace',title:'Weekly recorded collection volume',img:'F05-weekly-volume.png',finding:'The week beginning October 28, 2024 reached 112,592.9 cubic yards, the highest weekly total.',note:'The first and final weeks cover only part of a week.'},
  {id:'F06',cat:'Collection pace',title:'Cumulative recorded volume',img:'F06-cumulative-volume.png',finding:'Recorded volume ends at 644,952.65 cubic yards; 75.0% falls before December 2024.',note:'Flat periods mean no ticket records in this extract, not a verified pause.'},
  {id:'F07',cat:'Collection pace',title:'Daily load ticket count',img:'F07-daily-ticket-count.png',finding:'November 1, 2024 also had the most tickets: 525 recorded loads.',note:'A ticket is a load record, not a unique address or necessarily a unique trip.'},
  {id:'F08',cat:'Load size',title:'Volume per load ticket',img:'F08-load-volume-histogram.png',finding:'The median recorded load is 35.0 cubic yards; the largest recorded value is 88.35.',note:'Large loads should be checked against truck and ticket documentation before calling them errors.'},
  {id:'F09',cat:'Load size',title:'Load volume by debris type',img:'F09-load-volume-by-type.png',finding:'Median loads are 35.0 CY for Vegetative/Woody, 37.7 CY for Construction & Demolition, and 32.3 CY for Veg Park Debris.',note:'Types with fewer than 20 tickets and individual outlier dots are omitted.'},
  {id:'F10',cat:'Debris mix',title:'Total volume by debris type',img:'F10-volume-by-type.png',finding:'Vegetative/Woody leads with 476,239.1 CY, followed by Construction & Demolition at 88,876.9 CY.',note:'Confirm category definitions before combining park debris with general vegetative debris.'},
  {id:'F11',cat:'Debris mix',title:'Type share: volume vs. tickets',img:'F11-type-share-volume-vs-tickets.png',finding:'Vegetative/Woody accounts for 73.8% of cubic yards and 75.3% of tickets.',note:'Ticket share and volume share have different denominators and answer different questions.'},
  {id:'F12',cat:'Debris mix',title:'Weekly volume by debris type',img:'F12-weekly-type-volume.png',finding:'Vegetative/Woody supplies most of the high-volume October and November weeks.',note:'The three largest types are shown separately; other types are grouped.'},
  {id:'F13',cat:'Debris mix',title:'Weekly debris-type composition',img:'F13-weekly-type-share.png',finding:'The mix of recorded types changes after the initial high-volume phase.',note:'Late weeks have small totals, so a large percentage can represent few tickets.'},
  {id:'F14',cat:'Load size',title:'Recorded CY versus capacity × fullness',img:'F14-capacity-versus-recorded.png',finding:'Recorded volume equals listed truck capacity times fullness percentage for all rows.',note:'This is an arithmetic check, not independent validation of physical load size.'},
  {id:'F15',cat:'Spatial patterns',title:'Pickup-ticket density by grid cell',img:'F15-pickup-density-map.png',finding:'All 18,278 tickets have in-range coordinates; their mapped activity forms several clusters.',note:'The point meaning and positional accuracy should be confirmed with the data owner.'},
  {id:'F16',cat:'Spatial patterns',title:'Recorded pickup volume by grid cell',img:'F16-pickup-volume-map.png',finding:'Higher-volume grid cells broadly track the ticket-density clusters.',note:'This maps recorded ticket coordinates, not total debris generated or left to collect.'},
  {id:'F17',cat:'Spatial patterns',title:'Monthly pickup-point footprint',img:'F17-monthly-pickup-footprint.png',finding:'The mapped ticket footprint is widespread in October and November and sparse in later months.',note:'Overlapping points and changing ticket volume affect the visual impression.'},
  {id:'F18',cat:'Spatial patterns',title:'Tickets per collection address',img:'F18-tickets-per-address.png',finding:'Of 11,033 normalized nonblank addresses, 2,890 have at least two tickets.',note:'Address variants are not fully reconciled; multiple tickets may be legitimate loads.'},
  {id:'F19',cat:'Spatial patterns',title:'Time between pickup dates at an address',img:'F19-repeat-address-intervals.png',finding:'There are 1,576 intervals between distinct dates at a normalized address; the median is three days.',note:'Same-day multiple tickets are excluded from the interval calculation.'},
  {id:'F20',cat:'Data quality',title:'Calendar of dates with ticket records',img:'F20-ticket-date-calendar.png',finding:'Tickets appear on 141 of the 191 dates in the observed span; 50 dates have none.',note:'No-record dates do not establish whether crews operated on those days.'}
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

function renderFigureGallery(){
  const cats=['All','Data quality','Collection pace','Load size','Debris mix','Spatial patterns'];
  $('#categoryFilters').innerHTML=cats.map(c=>`<button type="button" data-category="${c}" class="${c===state.category?'active':''}">${c}</button>`).join('');
  $('#categoryFilters').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{state.category=b.dataset.category;renderFigureGallery()}));
  const filtered=FIGS.filter(f=>(state.category==='All'||f.cat===state.category)&&`${f.title} ${f.finding} ${f.note} ${f.id}`.toLowerCase().includes(state.search));
  $('#figureCount').textContent=`Showing ${filtered.length} of 20 figures`;
  $('#figureGrid').innerHTML=filtered.map(f=>`<article class="figure-card" id="figure-${f.id}"><button type="button" class="figure-image" data-open="${f.id}" aria-label="Open ${f.id}: ${f.title}"><img loading="lazy" src="figures/${f.img}" alt="${f.title} visualization"></button><div class="figure-body"><span class="figure-meta">${f.id} · ${f.cat.toUpperCase()}</span><h3>${f.title}</h3><p>${f.finding}</p><p class="figure-note"><strong>Read with care:</strong> ${f.note}</p><button type="button" class="figure-open" data-open="${f.id}">Open & zoom figure ↗</button></div></article>`).join('');
  $('#figureGrid').querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>openModal(b.dataset.open)));
}

let modalScale=1,modalX=0,modalY=0,modalDrag=null;
function modalTransform(){ $('#modalImage').style.transform=`translate(${modalX}px,${modalY}px) scale(${modalScale})`; }
function openModal(id){const f=FIGS.find(x=>x.id===id);if(!f)return;$('#modalIndex').textContent=`${f.id} / 20 · ${f.cat.toUpperCase()}`;$('#modalTitle').textContent=f.title;$('#modalImage').src=`figures/${f.img}`;$('#modalImage').alt=f.title;$('#modalFinding').textContent=f.finding;$('#modalCaveat').textContent=`Read with care: ${f.note}`;$('#imageModal').hidden=false;document.body.style.overflow='hidden';modalScale=1;modalX=0;modalY=0;modalTransform();$('#modalClose').focus()}
function closeModal(){$('#imageModal').hidden=true;document.body.style.overflow='';$('#modalImage').src=''}
function modalZoom(factor){modalScale=Math.max(1,Math.min(8,modalScale*factor));if(modalScale===1){modalX=0;modalY=0}modalTransform()}
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

const mapCanvas=$('#ticketMap'),mapWrap=mapCanvas.parentElement,mapSel=$('#mapSelection');let mapDrag=null;
function mapSize(){const r=mapWrap.getBoundingClientRect(),ratio=window.devicePixelRatio||1;mapCanvas.width=Math.round(r.width*ratio);mapCanvas.height=Math.round(r.height*ratio);return {w:r.width,h:r.height,ratio}}
function mapPos(lon,lat,w,h){const v=state.view;return [(lon-v.lon0)/(v.lon1-v.lon0)*w,(v.lat1-lat)/(v.lat1-v.lat0)*h]}
function geoPos(x,y,w,h){const v=state.view;return [v.lon0+x/w*(v.lon1-v.lon0),v.lat1-y/h*(v.lat1-v.lat0)]}
function renderMap(){if(!DATA)return;const {w,h,ratio}=mapSize(),ctx=mapCanvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);ctx.fillStyle='#007f78';for(const r of visible){const [x,y]=mapPos(r[5],r[4],w,h);if(x>=0&&x<w&&y>=0&&y<h){ctx.globalAlpha=.24;ctx.fillRect(x-1.3,y-1.3,2.6,2.6)}}ctx.globalAlpha=1;ctx.fillStyle='#4a7876';ctx.font='10px DM Sans, Arial';ctx.fillText(`${Math.abs(state.view.lon0).toFixed(2)}°W`,8,h-9);ctx.fillText(`${Math.abs(state.view.lon1).toFixed(2)}°W`,w-48,h-9);ctx.fillText(`${state.view.lat1.toFixed(2)}°N`,8,24);$('#mapStatus').textContent=state.bounds?`Area selected · ${fmt(visible.length)} matching tickets · drag again to refine`: 'Drag on map to select an area · scroll to zoom'}
function localPoint(e){const rect=mapWrap.getBoundingClientRect();return {x:Math.max(0,Math.min(rect.width,e.clientX-rect.left)),y:Math.max(0,Math.min(rect.height,e.clientY-rect.top)),w:rect.width,h:rect.height}}
mapCanvas.addEventListener('pointerdown',e=>{mapDrag=localPoint(e);mapCanvas.setPointerCapture(e.pointerId);mapSel.hidden=false});
mapCanvas.addEventListener('pointermove',e=>{if(!mapDrag)return;const p=localPoint(e),x=Math.min(p.x,mapDrag.x),y=Math.min(p.y,mapDrag.y);Object.assign(mapSel.style,{left:`${x}px`,top:`${y}px`,width:`${Math.abs(p.x-mapDrag.x)}px`,height:`${Math.abs(p.y-mapDrag.y)}px`})});
mapCanvas.addEventListener('pointerup',e=>{if(!mapDrag)return;const p=localPoint(e),d=mapDrag;mapDrag=null;mapSel.hidden=true;if(Math.abs(p.x-d.x)<8||Math.abs(p.y-d.y)<8)return;const [a,b]=geoPos(Math.min(p.x,d.x),Math.max(p.y,d.y),p.w,p.h),[c,f]=geoPos(Math.max(p.x,d.x),Math.min(p.y,d.y),p.w,p.h);state.bounds={lon0:a,lon1:c,lat0:b,lat1:f};update()});
mapCanvas.addEventListener('pointercancel',()=>{mapDrag=null;mapSel.hidden=true});
function zoomMap(factor,px=.5,py=.5){const v=state.view,cLon=v.lon0+px*(v.lon1-v.lon0),cLat=v.lat1-py*(v.lat1-v.lat0),lonSpan=(v.lon1-v.lon0)*factor,latSpan=(v.lat1-v.lat0)*factor;state.view={lon0:cLon-px*lonSpan,lon1:cLon+(1-px)*lonSpan,lat0:cLat-(1-py)*latSpan,lat1:cLat+py*latSpan};renderMap()}
$('#mapZoomIn').addEventListener('click',()=>zoomMap(.72));$('#mapZoomOut').addEventListener('click',()=>zoomMap(1/.72));$('#mapReset').addEventListener('click',()=>{state.view={...ALL_VIEW};renderMap()});
mapCanvas.addEventListener('wheel',e=>{e.preventDefault();const p=localPoint(e);zoomMap(e.deltaY<0?.85:1/.85,p.x/p.w,p.y/p.h)},{passive:false});

function syncDateInputs(){$('#dateFrom').value=dateFromOffset(state.from);$('#dateTo').value=dateFromOffset(state.to)}
$('#dateFrom').addEventListener('change',e=>{state.from=Math.min(offsetFromDate(e.target.value),state.to);syncDateInputs();update()});
$('#dateTo').addEventListener('change',e=>{state.to=Math.max(offsetFromDate(e.target.value),state.from);syncDateInputs();update()});
$('#typeFilter').addEventListener('change',e=>{state.type=e.target.value;update()});
$('#incidentFilter').addEventListener('change',e=>{state.incident=e.target.value;update()});
$('#minVolume').addEventListener('input',e=>{state.minVolume=+e.target.value;$('#minVolumeValue').textContent=`${state.minVolume} CY`;update()});
$('#clearArea').addEventListener('click',()=>{state.bounds=null;update()});
$('#resetDateZoom').addEventListener('click',()=>{state.from=0;state.to=190;syncDateInputs();update()});
$('#resetFilters').addEventListener('click',()=>{Object.assign(state,{from:0,to:190,type:'all',incident:'all',minVolume:0,bounds:null,view:{...ALL_VIEW}});syncDateInputs();$('#typeFilter').value='all';$('#incidentFilter').value='all';$('#minVolume').value=0;$('#minVolumeValue').textContent='0 CY';update()});
window.addEventListener('resize',()=>{if(DATA){renderTrend();renderMap()}});

fetch('data/tickets.json').then(r=>{if(!r.ok)throw new Error(`Data request failed (${r.status})`);return r.json()}).then(data=>{DATA=data;rows=data.rows;$('#typeFilter').innerHTML='<option value="all">All debris types</option>'+data.types.map((t,i)=>`<option value="${i}">${t}</option>`).join('');update()}).catch(err=>{$('#trendChart').innerHTML=`<p class="empty-state">The interactive data could not load. Please reload the page. ${err.message}</p>`;$('#mapStatus').textContent='Interactive data unavailable';console.error(err)});
