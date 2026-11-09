(() => {
  const common = {responsive:true,displaylogo:false,scrollZoom:true};
  const ink = '#1b2930', teal = '#087f77', orange = '#d47b28';
  const format = n => Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const dateLabel = value => new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));

  fetch('data/st-pete-additions.json').then(response => {
    if (!response.ok) throw new Error('HTTP '+response.status);
    return response.json();
  }).then(data => {
    const colors = {
      'Ordinary collection':teal,
      'Citizen drop-off':'#6c65b1',
      'Other special services':'#d68a32',
      'Household hazardous waste':'#b73c5a'
    };
    const totals = data.dates.map((_,i) => data.groups.reduce((sum,g) => sum+data.daily[g][i],0));
    const traces = data.groups.map(group => ({
      type:'bar',name:group,x:data.dates,y:data.daily[group],
      marker:{color:colors[group]},customdata:totals,
      hovertemplate:'<b>%{x|%b %d, %Y}</b><br>'+group+': %{y:,} tickets<br>All groups: %{customdata:,} tickets<extra></extra>'
    }));
    Plotly.newPlot('dailyChart',traces,{
      height:430,barmode:'stack',hovermode:'x unified',
      font:{family:'Arial, sans-serif',size:12,color:ink},
      paper_bgcolor:'#fff',plot_bgcolor:'#fff',
      margin:{t:15,r:20,b:100,l:75},
      legend:{orientation:'h',y:-0.42},
      xaxis:{title:'Local load date',type:'date',dtick:24*60*60*1000,tickformat:'%b %d',tickangle:-45,showgrid:false},
      yaxis:{title:'Recorded tickets',rangemode:'tozero',gridcolor:'#e3eaec'}
    },common);
  }).catch(error => {
    document.getElementById('dailyChart').textContent = 'Daily figure could not load: '+error.message;
  });

  fetch('data/pinellas-five-figures.json').then(response => {
    if (!response.ok) throw new Error('HTTP '+response.status);
    return response.json();
  }).then(data => {
    const rows = data.Q003.daily, marks = data.Q003.milestones;
    Plotly.newPlot('milestoneChart',[
      {type:'scatter',mode:'lines',name:'Cumulative recorded CY',
        x:rows.map(r=>r.date),y:rows.map(r=>r.cumulative_cy),
        customdata:rows.map(r=>r.daily_cy),line:{color:teal,width:3},
        fill:'tozeroy',fillcolor:'rgba(8,127,119,.09)',
        hovertemplate:'%{x|%b %d, %Y}<br>Cumulative: %{y:,.2f} CY<br>On date: %{customdata:,.2f} CY<extra></extra>'},
      {type:'scatter',mode:'markers+text',name:'Volume milestones',
        x:marks.map(m=>m.date),y:marks.map(m=>m.cumulative_cy),
        text:marks.map(m=>m.threshold_pct+'%'),textposition:'top center',
        marker:{color:orange,size:11,line:{color:'#fff',width:1}},
        customdata:marks.map(m=>[m.threshold_pct,m.observed_share_pct]),
        hovertemplate:'%{customdata[0]}% threshold<br>First crossed: %{x|%b %d, %Y}<br>Cumulative: %{y:,.2f} CY<br>Actual extract share: %{customdata[1]:.2f}%<extra></extra>'}
    ],{
      height:440,showlegend:false,
      font:{family:'Arial, sans-serif',size:12,color:ink},
      paper_bgcolor:'#fff',plot_bgcolor:'#fff',
      margin:{t:25,r:40,b:65,l:80},
      xaxis:{title:'Local pickup date',type:'date',tickformat:'%b %d\n%Y',gridcolor:'#edf1f2'},
      yaxis:{title:'Cumulative recorded CY',rangemode:'tozero',gridcolor:'#e3eaec'}
    },common);
    const tbody = document.querySelector('#milestoneTable tbody');
    tbody.replaceChildren();
    for (const mark of marks) {
      const row = document.createElement('tr');
      for (const value of [mark.threshold_pct+'%',dateLabel(mark.date),format(mark.cumulative_cy)+' CY',format(mark.observed_share_pct)+'%']) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.appendChild(cell);
      }
      tbody.appendChild(row);
    }
  }).catch(error => {
    document.getElementById('milestoneChart').textContent = 'Cumulative figure could not load: '+error.message;
  });

  function showFallback(id) {
    document.getElementById(id+'Map').hidden = true;
    document.getElementById(id+'Fallback').hidden = false;
  }

  function addMap(id, groups) {
    const host = document.getElementById(id+'Map');
    if (!window.L || !host) { showFallback(id); return; }
    const map = L.map(host,{preferCanvas:true,scrollWheelZoom:false});
    const esri = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      {maxZoom:19,attribution:'Tiles &copy; Esri; sources: Esri, HERE, Garmin, USGS, OpenStreetMap contributors'}
    );
    const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {maxZoom:19,attribution:'&copy; OpenStreetMap contributors'});
    let loaded = 0, errors = 0, usingOsm = false;
    esri.on('tileload',()=>loaded++);
    esri.on('tileerror',()=>{
      errors++;
      if (errors >= 3 && loaded === 0 && !usingOsm) {
        usingOsm = true;
        map.removeLayer(esri);
        osm.addTo(map);
      }
    });
    osm.on('tileerror',()=>{ if (++errors >= 8 && loaded === 0) showFallback(id); });
    esri.addTo(map);
    for (const group of groups) for (const point of group.points) {
      if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
      const color = id === 'quality'
        ? (group.name === 'GPS field conflict' ? '#17324b' : '#d47b28')
        : point.value >= 1 ? '#ad3f36' : point.value >= .25 ? '#dd8d29' : '#247c87';
      const radius = id === 'quality'
        ? (group.name === 'GPS field conflict' ? 7 : 5)
        : Math.max(5,Math.min(12,Number(point.size || 10)/2));
      const marker = L.circleMarker([point.lat,point.lon],
        {radius,color:'#fff',weight:1,fillColor:color,fillOpacity:.9});
      const popup = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = group.name;
      const detail = document.createElement('div');
      detail.style.whiteSpace = 'pre-line';
      detail.textContent = point.detail;
      popup.append(title,detail);
      marker.bindPopup(popup,{maxWidth:320});
      marker.addTo(map);
    }
    map.fitBounds([[27.59,-82.875],[28.20,-82.59]],{padding:[12,12]});
    L.control.scale({imperial:true,metric:true}).addTo(map);
    setTimeout(()=>map.invalidateSize(),0);
  }

  fetch('data/map-overlays.json').then(response => {
    if (!response.ok) throw new Error('HTTP '+response.status);
    return response.json();
  }).then(data => {
    addMap('quality',data.F25);
    addMap('spread',data.F26);
  }).catch(() => {
    showFallback('quality');
    showFallback('spread');
  });
})();
