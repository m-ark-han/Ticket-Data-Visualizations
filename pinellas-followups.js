(() => {
  const $ = id => document.getElementById(id);
  const num = (value,digits=0) => Number(value).toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});
  const ordinal = n => `${n}${n%100>=11&&n%100<=13?'th':({1:'st',2:'nd',3:'rd'}[n%10]||'th')}`;
  const shortDate = date => new Date(`${date}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  const config = {responsive:true,displaylogo:false,scrollZoom:true,modeBarButtonsToRemove:['sendDataToCloud','toImage']};
  const base = {font:{family:'Arial, sans-serif',size:12,color:'#1b2930'},paper_bgcolor:'#fff',plot_bgcolor:'#fff',margin:{t:20,r:45,b:65,l:80},hoverlabel:{align:'left'}};
  const teal='#087f77',orange='#d47b28',navy='#17324b',purple='#7765a8';

  function milestones(data) {
    const rows=data.Q003.daily, marks=data.Q003.milestones;
    Plotly.newPlot($('milestoneChart'),[
      {type:'scatter',mode:'lines',name:'Cumulative recorded CY',x:rows.map(r=>r.date),y:rows.map(r=>r.cumulative_cy),
       customdata:rows.map(r=>r.daily_cy),line:{color:teal,width:3},fill:'tozeroy',fillcolor:'rgba(8,127,119,.09)',
       hovertemplate:'%{x|%b %d, %Y}<br>Cumulative: %{y:,.2f} CY<br>On date: %{customdata:,.2f} CY<extra></extra>'},
      {type:'scatter',mode:'markers+text',name:'Volume milestones',x:marks.map(m=>m.date),y:marks.map(m=>m.cumulative_cy),
       text:marks.map(m=>`${m.threshold_pct}%`),textposition:'top center',marker:{color:orange,size:11,line:{color:'#fff',width:1}},
       customdata:marks.map(m=>[m.threshold_pct,m.observed_share_pct]),
       hovertemplate:'%{customdata[0]}% threshold<br>First crossed: %{x|%b %d, %Y}<br>Cumulative: %{y:,.2f} CY<br>Actual extract share: %{customdata[1]:.2f}%<extra></extra>'}
    ],{...base,height:440,showlegend:false,xaxis:{title:'Local pickup date',type:'date',tickformat:'%b %d\n%Y',gridcolor:'#edf1f2'},yaxis:{title:'Cumulative recorded CY',rangemode:'tozero',gridcolor:'#e3eaec'}},config);
    $('milestoneTable').querySelector('tbody').innerHTML=marks.map(m=>`<tr><td>${m.threshold_pct}%</td><td>${shortDate(m.date)}</td><td>${num(m.cumulative_cy,2)} CY</td><td>${num(m.observed_share_pct,2)}%</td></tr>`).join('');
    const halfway=marks.find(m=>m.threshold_pct===50),ninety=marks.find(m=>m.threshold_pct===90);
    $('milestoneFinding').textContent=`Recorded CY first crossed 50% of this extract on ${shortDate(halfway.date)} and 90% on ${shortDate(ninety.date)}. The line includes zero-record dates without adding volume on them.`;
  }

  function rankedDays(data) {
    const rows=data.Q004.ranked_days;
    const custom=rows.map(r=>[r.date,r.tickets,r.share_pct,r.cumulative_share_pct]);
    Plotly.newPlot($('rankedDaysChart'),[
      {type:'bar',name:'CY on date',x:rows.map(r=>r.rank),y:rows.map(r=>r.cy),customdata:custom,marker:{color:teal},
       hovertemplate:'Rank %{x} · %{customdata[0]}<br>%{y:,.2f} CY<br>%{customdata[1]:,} tickets<br>%{customdata[2]:.3f}% of all CY<extra></extra>'},
      {type:'scatter',mode:'lines',name:'Cumulative share',x:rows.map(r=>r.rank),y:rows.map(r=>r.cumulative_share_pct),yaxis:'y2',
       customdata:custom,line:{color:orange,width:3},
       hovertemplate:'Top %{x} dates through %{customdata[0]}<br>Cumulative: %{y:.2f}% of all CY<extra></extra>'}
    ],{...base,height:440,hovermode:'x unified',legend:{orientation:'h',y:-0.25},margin:{t:20,r:75,b:75,l:80},
       xaxis:{title:'Date rank by recorded CY (highest first)',rangemode:'tozero',gridcolor:'#edf1f2'},
       yaxis:{title:'CY on one date',rangemode:'tozero',gridcolor:'#e3eaec'},
       yaxis2:{title:'Cumulative share (%)',overlaying:'y',side:'right',range:[0,100],tickmode:'array',tickvals:[0,25,50,75,100],ticktext:['0%','25%','50%','75%','100%'],showgrid:false}},config);
    $('rankedDaysFinding').textContent=`The largest recorded day was ${shortDate(rows[0].date)} with ${num(rows[0].cy,2)} CY across ${num(rows[0].tickets)} tickets. The top 10 of ${rows.length} active dates contributed ${num(rows[9].cumulative_share_pct,2)}% of all recorded CY.`;
  }

  function weekly(data) {
    const rows=data.Q009.weeks, dates=rows.map(r=>r.week_start);
    const details=rows.map(r=>[r.tickets,r.cy,r.mean_cy_per_ticket]);
    const hover='Week of %{x|%b %d, %Y}<br>Recorded CY: %{customdata[1]:,.2f}<br>Tickets: %{customdata[0]:,}<br>Mean CY/ticket: %{customdata[2]:.2f}<extra></extra>';
    Plotly.newPlot($('weeklyComponentsChart'),[
      {type:'bar',name:'Total recorded CY',x:dates,y:rows.map(r=>r.cy),customdata:details,marker:{color:teal},yaxis:'y',hovertemplate:hover},
      {type:'bar',name:'Tickets',x:dates,y:rows.map(r=>r.tickets),customdata:details,marker:{color:purple},yaxis:'y2',hovertemplate:hover},
      {type:'scatter',mode:'lines+markers',name:'Mean CY per ticket',x:dates,y:rows.map(r=>r.mean_cy_per_ticket),customdata:details,
       line:{color:orange,width:2},marker:{size:5},yaxis:'y3',hovertemplate:hover}
    ],{...base,height:660,showlegend:false,margin:{t:35,r:25,b:75,l:100},hovermode:'x unified',
       xaxis:{title:'Monday-start week',anchor:'y3',type:'date',tickformat:'%b %d\n%Y',tickangle:-35,gridcolor:'#edf1f2'},
       yaxis:{title:'Total CY',domain:[.69,1],rangemode:'tozero',gridcolor:'#e3eaec'},
       yaxis2:{title:'Tickets',domain:[.35,.65],rangemode:'tozero',gridcolor:'#e3eaec'},
       yaxis3:{title:'Mean CY/ticket',domain:[0,.31],rangemode:'tozero',gridcolor:'#e3eaec'},
       annotations:[
         {xref:'paper',yref:'paper',x:.01,y:.98,text:'Total recorded CY',showarrow:false,xanchor:'left',font:{size:11,color:navy},bgcolor:'#ffffffd9'},
         {xref:'paper',yref:'paper',x:.01,y:.63,text:'Ticket count',showarrow:false,xanchor:'left',font:{size:11,color:navy},bgcolor:'#ffffffd9'},
         {xref:'paper',yref:'paper',x:.01,y:.29,text:'Mean CY per ticket',showarrow:false,xanchor:'left',font:{size:11,color:navy},bgcolor:'#ffffffd9'}
       ]},config);
    const peak=rows.reduce((best,row)=>row.cy>best.cy?row:best,rows[0]);
    const previous=rows[rows.indexOf(peak)-1];
    $('weeklyFinding').textContent=`The peak week began ${shortDate(peak.week_start)}: ${num(peak.cy,2)} CY from ${num(peak.tickets)} tickets at ${num(peak.mean_cy_per_ticket,2)} CY per ticket. The preceding week had ${num(previous.tickets)} tickets at ${num(previous.mean_cy_per_ticket,2)} CY per ticket, so both components rose.`;
  }

  function concentration(data) {
    const q=data.Q026,rows=q.locations;
    const points=rows.map(r=>[r.rank,r.tickets,r.cy]);
    const markers=[1,5,10].map(p=>({pct:p,...q.top_shares[String(p)]}));
    const markerRows=markers.map(m=>rows[m.location_labels-1]);
    Plotly.newPlot($('addressConcentrationChart'),[
      {type:'scatter',mode:'lines',name:'Ranked address labels',x:rows.map(r=>r.location_share_pct),y:rows.map(r=>r.cumulative_share_pct),
       customdata:points,line:{color:teal,width:3},
       hovertemplate:'Top %{customdata[0]:,} labels (%{x:.2f}%)<br>Cumulative CY share: %{y:.2f}%<br>Label at this rank: %{customdata[1]} tickets, %{customdata[2]:,.2f} CY<extra></extra>'},
      {type:'scatter',mode:'lines',name:'Equal-share reference',x:[0,100],y:[0,100],line:{color:'#aebbc0',dash:'dash',width:1},hoverinfo:'skip'},
      {type:'scatter',mode:'markers+text',name:'Top 1%, 5%, 10%',x:markerRows.map(r=>r.location_share_pct),
       y:markerRows.map(r=>r.cumulative_share_pct),text:markers.map(m=>`Top ${m.pct}%`),textposition:'top right',
       marker:{color:orange,size:10},customdata:markers.map(m=>m.location_labels),
       hovertemplate:'Top %{customdata:,} labels (%{x:.2f}%)<br>%{y:.2f}% of addressed CY<extra></extra>'}
    ],{...base,height:450,hovermode:'closest',legend:{orientation:'h',y:-.25},margin:{t:35,r:60,b:75,l:75},
       xaxis:{title:'Top-ranked address labels (% of all nonblank labels)',range:[0,100],ticksuffix:'%',gridcolor:'#edf1f2'},
       yaxis:{title:'Cumulative share of addressed CY',range:[0,100],ticksuffix:'%',gridcolor:'#e3eaec'}},config);
    $('addressFinding').textContent=`The top ${num(q.top_shares['1'].location_labels)} of ${num(q.location_labels)} nonblank normalized address labels (about 1%) account for ${num(q.top_shares['1'].share_of_addressed_cy_pct,2)}% of CY tied to a nonblank address. ${num(q.excluded_missing_address_tickets)} tickets with blank addresses (${num(q.excluded_missing_address_cy,2)} CY) are outside this ranking.`;
  }

  function zones(data) {
    const rows=data.Q053.zones;
    const lineX=[],lineY=[];
    rows.forEach(r=>{lineX.push(r.ticket_rank,r.cy_rank,null);lineY.push(r.zone,r.zone,null)});
    const custom=rows.map(r=>[r.tickets,r.cy,r.ticket_rank,r.cy_rank]);
    Plotly.newPlot($('zoneRanksChart'),[
      {type:'scatter',mode:'lines',x:lineX,y:lineY,showlegend:false,hoverinfo:'skip',line:{color:'#b6c7cb',width:2}},
      {type:'scatter',mode:'markers',name:'Ticket-count rank',x:rows.map(r=>r.ticket_rank),y:rows.map(r=>r.zone),customdata:custom,
       marker:{color:teal,size:10},hovertemplate:'%{y}<br>Ticket rank: %{customdata[2]} · %{customdata[0]:,} tickets<br>CY rank: %{customdata[3]} · %{customdata[1]:,.2f} CY<extra></extra>'},
      {type:'scatter',mode:'markers',name:'Recorded-CY rank',x:rows.map(r=>r.cy_rank),y:rows.map(r=>r.zone),customdata:custom,
       marker:{color:orange,size:10},hovertemplate:'%{y}<br>CY rank: %{customdata[3]} · %{customdata[1]:,.2f} CY<br>Ticket rank: %{customdata[2]} · %{customdata[0]:,} tickets<extra></extra>'}
    ],{...base,height:850,hovermode:'closest',legend:{orientation:'h',y:-.09},margin:{t:15,r:30,b:65,l:220},
       xaxis:{title:'Zone rank (1 = highest)',range:[0,31],dtick:2,gridcolor:'#edf1f2'},
       yaxis:{categoryorder:'array',categoryarray:rows.map(r=>r.zone).reverse(),tickfont:{size:11},showgrid:false}},config);
    const largest=rows[0];
    $('zoneFinding').textContent=`The largest rank difference is ${largest.zone}: ${num(largest.tickets)} tickets rank ${ordinal(largest.ticket_rank)}, while ${num(largest.cy,2)} CY ranks ${ordinal(largest.cy_rank)} among the 30 zones. Ticket count and volume highlight different parts of the same recorded activity.`;
  }

  fetch('data/pinellas-five-figures.json').then(response=>{
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }).then(data=>{
    $('dataStatus').textContent=`The ${num(data.ticket_count)} tickets sum to ${num(data.total_cy,2)} CY.`;
    milestones(data);rankedDays(data);weekly(data);concentration(data);zones(data);
  }).catch(error=>{$('dataStatus').textContent=`The figure data could not load: ${error.message}`;});
})();
