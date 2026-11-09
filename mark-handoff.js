(() => {
  const body = document.getElementById('neighborhoodTimes');
  const count = document.getElementById('neighborhoodTableCount');
  if (!body || !count) return;

  fetch('data/st-pete-additions.json')
    .then(response => {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(data => {
      const areas = [...data.neighborhoods].sort((a, b) =>
        b.span_days - a.span_days || b.tickets - a.tickets || a.name.localeCompare(b.name)
      );
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
