# DebrisInsight: Pinellas ticket visualizations

A static GitHub Pages site for Mark's DebrisInsight visualization and insight discovery work. The gallery presents nine priority figures, including four maps, and an interactive explorer for 18,278 public Pinellas County debris ticket records. The earlier figures remain in `figures/` for reference but are no longer in the priority gallery.

## Use

Open the published site or run a local static server in this directory. The explorer loads `data/tickets.json`; opening `index.html` directly as a `file://` page may block that request.

The explorer can filter by date, debris type, incident ID, minimum load volume, and a drawn map region. Dragging across the timeline narrows the date range. Select any of the nine figures for an interactive chart: hover or tap a mark to read its exact plotted values, drag to zoom, and use the chart controls to reset or download it. The original full-resolution image remains available in the viewer. Each gallery card and its detail tab shows the question ID it addresses. Ranbir workbook questions use `Q` IDs; the additional Mark questions use `M` IDs.

The priority gallery includes F05 (weekly CY), F16 (pickup-volume map), F21 (zone activity duration), F24 (contractor footprint map), F25 (missing-address and internal GPS-field quality map), F26 (repeated-address coordinate-spread candidate map), F27 (recorded CY and ticket participation by contractor label), F28 (weekly distinct truck IDs with tickets), and F29 (listed capacity distribution among unique truck IDs). F22 and F23 destination-label figures remain in `figures/` and the exact-value JSON but are outside the nine-figure selection.

Only two values occur in `Contractor`: DRC and PINELLAS COUNTY. The extract does not contain a separate subcontractor field. F28 counts distinct truck IDs present on at least one ticket in a week, not all deployed or available trucks. F29 counts each unique truck ID once; capacity is listed, not measured payload. F26 uses 90th-percentile distance from each repeated address label's median ticket coordinate. Spread can reflect broad roads or parks; identifying a true address/GPS mismatch requires authoritative address or parcel geometry. The address-level review files remain outside this public repository.

## Data source and limits

Source: [Pinellas County eGIS Debris Ticket Locations](https://pinellas-egis.maps.arcgis.com/home/item.html?id=fb652dddee454f97929d7fe73ec25d12#data), extracted October 12, 2026. Recorded CY sum: 644,952.65. Dates are converted to America/New_York before daily grouping. The interactive JSON includes only date offset, debris type, disaster ID, volume, and coordinates; it omits addresses, ticket IDs, truck IDs, and names. It is generated from the full CSV with `prepare_data.py` in the parent workspace.

The figures describe recorded ticket activity. They do not establish total debris generated, remaining debris, or whether every row is a distinct original pickup. Empty dates are dates with no records in this extract. Numeric disaster IDs require agency confirmation before assigning storm names. Interactive values are derived from the same source CSV and grouping rules as the PNG figures. Hover values for histogram bins and map cells are aggregated plotted values, not individual ticket records.

## Update

1. Refresh the public ticket extract in the parent workspace.
2. Regenerate the 20 PNGs with `build-debris-figures.py` in the parent workspace.
3. Run `python prepare_data.py`, `python build_figure_values.py`, `python build_mark_followups.py`, then `python build_priority_figures.py` here. Copy the original 20 updated PNGs into `figures/`; the follow-up script writes F21–F23, and the priority script writes F24–F29 and their exact-value specifications. The final script also writes local aggregate/review outputs to `../outputs/mark-priority/`.
4. Review all findings and totals in `app.js` and `index.html` before publishing.

This is a buildless site. GitHub Pages can publish the repository root of `main`; `.nojekyll` keeps static paths unchanged. The interactive charts use the bundled Plotly cartesian library; its MIT license is included in `PLOTLY-LICENSE.txt`.
