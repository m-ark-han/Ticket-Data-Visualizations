(() => {
  const $ = id => document.getElementById(id);
  const fmt = n => Number(n).toLocaleString('en-US');
  const colors = {
    'Ordinary collection': '#087f77',
    'Citizen drop-off': '#6c65b1',
    'Other special services': '#d68a32',
    'Household hazardous waste': '#b73c5a'
  };
  const siteColors = {
    '7TH AND 22ND DMS': '#267d87',
    'GFL - LARGO FDS': '#699f58',
    'NXGEN ENVIRONMENTAL': '#ad82bc',
    'RAYTHEON DMS': '#cf8b31',
    'MISSING': '#b7c1c5'
  };
  const common = {responsive:true,displaylogo:false,scrollZoom:true,modeBarButtonsToRemove:['sendDataToCloud','toImage']};
  const baseLayout = {
    font:{family:'Arial, sans-serif',size:12,color:'#1b2930'},
    paper_bgcolor:'#fff',plot_bgcolor:'#fff',
    margin:{t:15,r:25,b:65,l:70},
    legend:{orientation:'h',y:-0.24},
    hoverlabel:{align:'left'},
    hovermode:'closest'
  };

  function dailyFigure(data) {
    const totals = data.dates.map((_,i) => data.groups.reduce((sum,g) => sum + data.daily[g][i],0));
    const traces = data.groups.map(group => ({
      type:'bar',name:group,x:data.dates,y:data.daily[group],marker:{color:colors[group]},
      customdata:totals,
      hovertemplate:`<b>%{x|%b %d, %Y}</b><br>${group}: %{y:,} tickets<br>All groups: %{customdata:,} tickets<extra></extra>`
    }));
    Plotly.newPlot($('dailyChart'),traces,{
      ...baseLayout,height:430,barmode:'stack',hovermode:'x unified',
      xaxis:{title:'Local load date',type:'date',dtick:24*60*60*1000,tickformat:'%b %d',tickangle:-45,showgrid:false},
      yaxis:{title:'Recorded tickets',rangemode:'tozero',gridcolor:'#e3eaec'},
      margin:{t:15,r:20,b:95,l:75},legend:{orientation:'h',y:-0.42}
    },common);
    const peak = Math.max(...totals), index = totals.indexOf(peak);
    const breakdown = data.groups.filter(g => data.daily[g][index]).map(g => `${g}: ${fmt(data.daily[g][index])}`).join(' · ');
    $('dailyFinding').textContent = `Peak: ${fmt(peak)} tickets on ${data.dates[index]} (${breakdown}). The mix shows which activities account for that daily total.`;
  }

  function neighborhoodFigure(data, scope) {
    const names = scope === 'all' ? data.neighborhoods.map(n => n.name) : data.selected_neighborhoods;
    const byName = new Map(data.neighborhoods.map(n => [n.name,n]));
    const blankX=[],blankY=[];
    const buckets = [
      {name:'1 ticket',test:n=>n===1,color:'#9bd2cc',x:[],y:[],custom:[]},
      {name:'2–4 tickets',test:n=>n>=2&&n<=4,color:'#60b2aa',x:[],y:[],custom:[]},
      {name:'5–9 tickets',test:n=>n>=5&&n<=9,color:'#2a8d84',x:[],y:[],custom:[]},
      {name:'10+ tickets',test:n=>n>=10,color:'#00645d',x:[],y:[],custom:[]}
    ];
    for (const name of names) {
      const area = byName.get(name);
      data.dates.forEach((date,i) => {
        blankX.push(date); blankY.push(name);
        const count = area.daily[i];
        if (!count) return;
        const bucket = buckets.find(b=>b.test(count));
        bucket.x.push(date);bucket.y.push(name);
        bucket.custom.push([count,area.tickets,area.span_days,area.active_dates,area.longest_gap_days]);
      });
    }
    const traces=[{
      type:'scatter',mode:'markers',x:blankX,y:blankY,hoverinfo:'skip',showlegend:false,
      marker:{symbol:'square',size:19,color:'#eef2f3',line:{color:'#fff',width:1}}
    },...buckets.map(bucket=>({
      type:'scatter',mode:'markers',name:bucket.name,x:bucket.x,y:bucket.y,customdata:bucket.custom,
      marker:{symbol:'square',size:19,color:bucket.color,line:{color:'#fff',width:1}},
      hovertemplate:'<b>%{y}</b><br>%{x|%b %d, %Y}: %{customdata[0]} ticket(s)<br>Area total: %{customdata[1]} tickets<br>First-to-last: %{customdata[2]} days<br>Active dates: %{customdata[3]}<br>Longest internal gap: %{customdata[4]} days<extra></extra>'
    }))];
    Plotly.newPlot($('neighborhoodChart'),traces,{
      ...baseLayout,height:scope==='all'?1120:540,
      margin:{t:15,r:20,b:88,l:Math.min(window.innerWidth*0.38,320)},
      xaxis:{title:'October 2024 · local ticket date',type:'date',dtick:24*60*60*1000,tickformat:'%b %d',tickangle:-45,showgrid:false},
      yaxis:{categoryorder:'array',categoryarray:names.slice().reverse(),showgrid:false,tickfont:{size:scope==='all'?10:11}},
      legend:{orientation:'h',y:-0.13},hovermode:'closest'
    },common);
  }

  function siteFigure(data) {
    const traces = data.site_labels.map(site => ({
      type:'bar',orientation:'h',name:site,marker:{color:siteColors[site]||'#3d83a2'},
      y:data.groups,
      x:data.groups.map(group => {
        const count = data.receiving_sites[group][site]||0;
        return 100*count/data.group_totals[group];
      }),
      customdata:data.groups.map(group => [data.receiving_sites[group][site]||0,data.group_totals[group]]),
      hovertemplate:`<b>%{y}</b><br>${site}<br>%{customdata[0]:,} of %{customdata[1]:,} tickets<br>%{x:.1f}% of group<extra></extra>`
    }));
    Plotly.newPlot($('siteChart'),traces,{
      ...baseLayout,height:440,barmode:'stack',
      margin:{t:15,r:20,b:115,l:205},
      xaxis:{title:'Share of tickets in activity group (%)',range:[0,100],ticksuffix:'%',gridcolor:'#e3eaec'},
      yaxis:{categoryorder:'array',categoryarray:data.groups.slice().reverse()},
      legend:{orientation:'h',y:-0.4}
    },common);
    const missing = data.groups.reduce((sum,g)=>sum+(data.receiving_sites[g].MISSING||0),0);
    $('siteFinding').textContent = `${fmt(missing)} of ${fmt(data.ticket_count)} tickets have the “MISSING” site label. Other special services account for ${fmt(data.receiving_sites['Other special services'].MISSING||0)} of them; household hazardous waste accounts for ${fmt(data.receiving_sites['Household hazardous waste'].MISSING||0)}.`;
  }

  fetch('data/st-pete-additions.json').then(response=>{
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }).then(data=>{
    $('retrievalNote').textContent = `Public-layer snapshot retrieved ${new Date(data.retrieved_utc).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'America/New_York'})} Eastern. Drag a chart to zoom; double-click to reset. Hover or tap a mark for exact counts.`;
    dailyFigure(data);
    neighborhoodFigure(data,'selected');
    $('areaScope').addEventListener('change',event=>neighborhoodFigure(data,event.target.value));
    const shore=data.neighborhoods.find(n=>n.name==='SHORE ACRES CIVIC ASSN');
    const coquina=data.neighborhoods.find(n=>n.name==='COQUINA KEY PROPERTY OWNERS ASSN');
    $('neighborhoodFinding').textContent = `Shore Acres and Coquina Key each span ${shore.span_days} days from first to last ticket, but Shore Acres has ${shore.active_dates} active dates and Coquina Key has ${coquina.active_dates}. Their longest internal gaps are ${shore.longest_gap_days} and ${coquina.longest_gap_days} days, respectively.`;
    siteFigure(data);
  }).catch(error=>{
    $('retrievalNote').textContent = `The figure data could not load: ${error.message}`;
  });
})();
