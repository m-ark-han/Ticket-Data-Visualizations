# DebrisInsight: Pinellas ticket visualizations

A static GitHub Pages site for Mark's DebrisInsight visualization and insight discovery work. It presents 23 figures and an interactive explorer for 18,278 public Pinellas County debris ticket records.

## Use

Open the published site or run a local static server in this directory. The explorer loads `data/tickets.json`; opening `index.html` directly as a `file://` page may block that request.

The explorer can filter by date, debris type, incident ID, minimum load volume, and a drawn map region. Dragging across the timeline narrows the date range. Select any of the 23 figures for an interactive chart: hover or tap a mark to read its exact plotted values, drag to zoom, and use the chart controls to reset or download it. The original full-resolution image remains available in the viewer. Box plots show exact quartiles, median, and spread; map cells show exact center coordinates and the aggregated ticket count or volume. The F19 histogram shows the exact number of intervals for each day value.

F21 compares ticket activity duration across all 30 `Zone1` debris zones. F22 sums recorded CY by `DisposalSite` label, and F23 compares zone–destination-label pairs. These figures do not verify clearance, site arrival, or final disposal. The page's follow-up review also summarizes low-record weeks and addresses with 10 or more tickets; the full address-level review file is kept outside this public repository.

## Data source and limits

Source: [Pinellas County eGIS Debris Ticket Locations](https://pinellas-egis.maps.arcgis.com/home/item.html?id=fb652dddee454f97929d7fe73ec25d12#data), extracted October 12, 2026. Recorded CY sum: 644,952.65. Dates are converted to America/New_York before daily grouping. The interactive JSON includes only date offset, debris type, disaster ID, volume, and coordinates; it omits addresses, ticket IDs, truck IDs, and names. It is generated from the full CSV with `prepare_data.py` in the parent workspace.

The figures describe recorded ticket activity. They do not establish total debris generated, remaining debris, or whether every row is a distinct original pickup. Empty dates are dates with no records in this extract. Numeric disaster IDs require agency confirmation before assigning storm names. Interactive values are derived from the same source CSV and grouping rules as the PNG figures. Hover values for histogram bins and map cells are aggregated plotted values, not individual ticket records.

## Update

1. Refresh the public ticket extract in the parent workspace.
2. Regenerate the 20 PNGs with `build-debris-figures.py` in the parent workspace.
3. Run `python prepare_data.py`, `python build_figure_values.py`, then `python build_mark_followups.py` here. Copy the original 20 updated PNGs into `figures/`; the follow-up script writes F21–F23 and merges their exact-value specifications.
4. Review all findings and totals in `app.js` and `index.html` before publishing.

This is a buildless site. GitHub Pages can publish the repository root of `main`; `.nojekyll` keeps static paths unchanged. The interactive charts use the bundled Plotly cartesian library; its MIT license is included in `PLOTLY-LICENSE.txt`.
