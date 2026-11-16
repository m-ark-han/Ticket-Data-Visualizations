(() => {
  const host = document.getElementById('zoneTimingMap');
  if (!host) return;
  const color = n => n < 50 ? '#d6e9d5' : n < 70 ? '#84c9bd' : n < 90 ? '#218c91' : n < 110 ? '#e6a15d' : '#ad4e31';
  const number = n => Number(n).toLocaleString('en-US',{maximumFractionDigits:2});
  fetch('data/pinellas-zone-timing.geojson').then(r => {if (!r.ok) throw Error(`HTTP ${r.status}`); return r.json()}).then(data => {
    const map = L.map(host,{scrollWheelZoom:false});
    const base = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles &copy; Esri; sources: Esri, HERE, Garmin, USGS, OpenStreetMap contributors'}).addTo(map);
    const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'});
    let errors = 0, loaded = 0;
    base.on('tileload',()=>loaded++).on('tileerror',()=>{if (++errors >= 3 && loaded === 0 && map.hasLayer(base)){map.removeLayer(base);osm.addTo(map)}});
    const shapes = L.geoJSON(data,{style:f=>({color:'#35434b',weight:1.2,fillColor:color(f.properties.days_to_90pct_recorded_cy),fillOpacity:.76}),onEachFeature:(f,layer)=>{
      const p=f.properties;
      layer.bindTooltip(`${p.zone} · ${p.LOCATION}: ${p.days_to_90pct_recorded_cy} days`,{sticky:true});
      layer.bindPopup(`<strong>${p.zone} · ${p.LOCATION}</strong><br>Days to 90% of recorded CY: <strong>${p.days_to_90pct_recorded_cy}</strong><br>First-to-last ticket days: ${p.first_to_last_ticket_days}<br>First ticket: ${p.first_ticket}<br>Last ticket: ${p.last_ticket}<br>Tickets: ${number(p.tickets)}<br>Recorded CY: ${number(p.recorded_cy)}`);
      layer.on('mouseover',()=>layer.setStyle({weight:3})).on('mouseout',()=>shapes.resetStyle(layer));
    }}).addTo(map);
    map.fitBounds(shapes.getBounds().pad(.04));
    const tbody=document.getElementById('zoneTimingRows');
    if(tbody) for(const f of data.features.slice().sort((a,b)=>b.properties.days_to_90pct_recorded_cy-a.properties.days_to_90pct_recorded_cy)){
      const p=f.properties,tr=document.createElement('tr');
      for(const v of [p.zone,p.LOCATION,p.tickets,number(p.recorded_cy),p.first_ticket,p.days_to_90pct_recorded_cy,p.last_ticket,p.first_to_last_ticket_days]){const td=document.createElement('td');td.textContent=v;tr.appendChild(td)}
      tr.addEventListener('click',()=>{map.fitBounds(L.geoJSON(f).getBounds().pad(.2));shapes.eachLayer(layer=>{if(layer.feature.properties.zone===p.zone)layer.openPopup()})});
      tbody.appendChild(tr);
    }
  }).catch(error=>{host.textContent='Map data could not load: '+error.message});
})();
