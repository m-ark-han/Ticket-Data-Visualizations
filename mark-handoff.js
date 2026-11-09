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
})();
