(() => {
  const body = document.getElementById('neighborhoodTimes');
  const count = document.getElementById('neighborhoodTableCount');
  const chart = document.getElementById('neighborhoodTimeline');
  const scope = document.getElementById('timelineScope');
  if (!body || !count || !chart || !scope) return;

  function drawTimeline(allAreas, selection) {
    const areas = selection === 'all' ? allAreas : allAreas.slice(0, 12);
    const lineX = [], lineY = [];
    for (const area of areas) {
      lineX.push(area.first, area.last, null);
      lineY.push(area.name, area.name, null);
    }
    const custom = areas.map(area => [
      area.first, area.last, area.span_days, area.active_dates,
      area.longest_gap_days, area.tickets
    ]);
    const hover = '<b>%{y}</b><br>First ticket: %{customdata[0]}<br>Last ticket: %{customdata[1]}<br>Inclusive span: %{customdata[2]} days<br>Dates with tickets: %{customdata[3]}<br>Longest gap: %{customdata[4]} days<br>Tickets: %{customdata[5]}<extra></extra>';
    Plotly.react(chart, [
      {type:'scatter',mode:'lines',x:lineX,y:lineY,hoverinfo:'skip',showlegend:false,
        line:{color:'#76b5ae',width:8}},
      {type:'scatter',mode:'markers',name:'First recorded ticket',
        x:areas.map(a=>a.first),y:areas.map(a=>a.name),customdata:custom,
        marker:{color:'#087f77',size:10},hovertemplate:hover},
      {type:'scatter',mode:'markers',name:'Last recorded ticket',
        x:areas.map(a=>a.last),y:areas.map(a=>a.name),customdata:custom,
        marker:{color:'#c66a28',size:10},hovertemplate:hover}
    ],{
      height:selection === 'all' ? 1510 : 670,
      margin:{t:20,r:30,b:90,l:310},
      font:{family:'Arial, sans-serif',size:12,color:'#1b2930'},
      paper_bgcolor:'#fff',plot_bgcolor:'#fff',
      xaxis:{type:'date',title:'Local ticket date, October 2024',
        range:['2024-10-02','2024-10-24'],dtick:2*24*60*60*1000,
        tickformat:'%b %d',tickangle:-45,gridcolor:'#e5ebec'},
      yaxis:{categoryorder:'array',categoryarray:areas.map(a=>a.name).reverse(),
        tickfont:{size:selection === 'all' ? 10 : 11},showgrid:false},
      legend:{orientation:'h',x:0,y:-0.18},
      hoverlabel:{align:'left'}
    },{responsive:true,displaylogo:false,scrollZoom:true});
  }

  fetch('data/st-pete-additions.json')
    .then(response => {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(data => {
      const areas = [...data.neighborhoods].sort((a, b) =>
        b.span_days - a.span_days || b.tickets - a.tickets || a.name.localeCompare(b.name)
      );
      drawTimeline(areas, scope.value);
      scope.addEventListener('change', () => drawTimeline(areas, scope.value));
      body.replaceChildren();
      for (const area of areas) {
        const row = document.createElement('tr');
        const values = [
          area.name, area.first, area.last, area.span_days,
          area.active_dates, area.longest_gap_days, area.tickets, 'Not available'
        ];
        values.forEach((value, index) => {
          const cell = document.createElement(index === 0 ? 'th' : 'td');
          if (index === 0) cell.scope = 'row';
          if (index >= 3 && index <= 6) cell.className = 'num';
          cell.textContent = value;
          row.appendChild(cell);
        });
        body.appendChild(row);
      }
      count.textContent = areas.length + ' neighborhoods with matched tickets are shown. Of 1,923 eligible ordinary-collection tickets, 1,743 matched one neighborhood polygon and 180 matched none.';
    })
    .catch(error => {
      body.firstElementChild.firstElementChild.textContent =
        'Neighborhood records could not load: ' + error.message;
      count.textContent = '';
    });
})();
