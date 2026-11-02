# DebrisInsight: Pinellas ticket visualizations

A static GitHub Pages site for Mark's DebrisInsight visualization and insight discovery work. The gallery presents nine priority figures, including four maps, and an interactive explorer for 18,278 public Pinellas County debris ticket records. The earlier figures remain in `figures/` for reference but are no longer in the priority gallery.

## Use

Open the published site or run a local static server in this directory. The explorer loads `data/tickets.json`; opening `index.html` directly as a `file://` page may block that request.

The explorer can filter by date, debris type, incident ID, minimum load volume, and a drawn map region. Dragging across the timeline narrows the date range. The four geographic figures (F16, F24, F25, F26) open as interactive OpenStreetMap street maps with exact-value point popups; F24 switches contractor layers at one geographic scale. Their gallery previews also show the street map. The other five figures open as interactive Plotly charts with their original full-resolution images available. Each gallery card and its detail tab shows the question ID it addresses. Ranbir workbook questions use `Q` IDs; the additional Mark questions use `M` IDs.

The priority gallery includes F05 (weekly CY), F16 (pickup-volume map), F21 (a 30-cell zone-duration grid with exact day counts and a switch between 90%-of-volume and last-ticket spans), F24 (contractor footprint map), F25 (missing-address and internal GPS-field quality map), F26 (repeated-address coordinate-spread candidate map), F27 (recorded CY and ticket participation by contractor label), F28 (weekly distinct truck IDs with tickets), and F29 (listed capacity distribution among unique truck IDs). F22 and F23 destination-label figures remain in `figures/` and the exact-value JSON but are outside the nine-figure selection.

The [question guide](question-guide.html) maps the 16 Ranbir questions answered by figures to their IDs and describes the 34 questions that still need a new figure. It links archived figure images without adding them back to the nine-figure gallery. Q032, Q035, and Q025 are labeled partial in the gallery because their present figures do not fully answer those questions.

The [five question follow-up figures](pinellas-followups.html) answer Q003 (cumulative CY milestones), Q004 (largest-date CY contribution), Q009 (weekly ticket-count and mean-load components), Q026 (anonymous normalized-address CY concentration), and Q053 (ticket-count versus CY ranks across 30 Zone1 debris zones). Each interactive figure shows its question ID, interpretation, exact hover values, and a downloadable aggregate CSV. `build_question_figures.py` regenerates the public `data/pinellas-five-figures.json` and five CSVs from the reviewed local ticket CSV; raw addresses and ticket IDs are not published.

The [original county dashboard figures](county-dashboard.html) page preserves screenshots of the county's four chart widgets and zone-status map, plus the visible status table, captured November 2, 2026. The figures are stored in `figures/county-dashboard/`, including full dashboard screenshots for context. The sand chart and two estimate charts use separate county layers; they are presented as original county figures rather than results from our pickup-ticket extract. Each image links back to the live [county dashboard](https://pinellas-egis.maps.arcgis.com/apps/dashboards/cc0cb850528c4b1b8ee669ec79feb341).

The [St. Petersburg retrospective figures](st-petersburg.html) page adds three interactive charts for a separate 6,694-ticket city snapshot: daily ticket mix, neighborhood activity dates, and recorded receiving-site labels. Their aggregates and downloadable CSVs are in `data/st-pete-*`. `build_st_pete_additions.py` retrieves the public static ticket layer and the city's 89-polygon Neighborhood Associations layer, verifies source IDs and draft reconciliation counts, and writes only aggregates to this repository. The daily chart groups local `LoadDate` (matching the draft's 1,179-ticket peak); the neighborhood grid groups local `TicketDate` (matching its neighborhood windows). No raw ticket identifiers, addresses, or individual coordinates are published.

Only two values occur in `Contractor`: DRC and PINELLAS COUNTY. The extract does not contain a separate subcontractor field. F28 counts distinct truck IDs present on at least one ticket in a week, not all deployed or available trucks. F29 counts each unique truck ID once; capacity is listed, not measured payload. F26 uses 90th-percentile distance from each repeated address label's median ticket coordinate. Spread can reflect broad roads or parks; identifying a true address/GPS mismatch requires authoritative address or parcel geometry. The address-level review files remain outside this public repository.

## Data source and limits

Source: [Pinellas County eGIS Debris Ticket Locations](https://pinellas-egis.maps.arcgis.com/home/item.html?id=fb652dddee454f97929d7fe73ec25d12#data), extracted October 12, 2026. Recorded CY sum: 644,952.65. Dates are converted to America/New_York before daily grouping. The interactive JSON includes only date offset, debris type, disaster ID, volume, and coordinates; it omits addresses, ticket IDs, truck IDs, and names. It is generated from the full CSV with `prepare_data.py` in the parent workspace.

The figures describe recorded ticket activity. They do not establish total debris generated, remaining debris, or whether every row is a distinct original pickup. Empty dates are dates with no records in this extract. Numeric disaster IDs require agency confirmation before assigning storm names. Interactive values are derived from the same source CSV and grouping rules as the PNG figures. Hover values for histogram bins and map cells are aggregated plotted values, not individual ticket records.

Map overlays are extracted from `data/figure-values.json` with `node build_map_overlays.js`. The site ships Leaflet 1.9.4 locally (see `LEAFLET-LICENSE.txt`) and requests standard OpenStreetMap raster tiles only during interactive viewing. An internet connection is required for street tiles; the plotted values are hosted in this repository. Map previews load when scrolled into view, and OpenStreetMap attribution is shown on the maps.

## Update

1. Refresh the public ticket extract in the parent workspace.
2. Regenerate the 20 PNGs with `build-debris-figures.py` in the parent workspace.
3. Run `python prepare_data.py`, `python build_figure_values.py`, `python build_mark_followups.py`, then `python build_priority_figures.py` here. Copy the original 20 updated PNGs into `figures/`; the follow-up script writes the F21 SVG grid and F22–F23 PNGs, while the priority script writes F24–F29 and their exact-value specifications. The final script also writes local aggregate/review outputs to `../outputs/mark-priority/`. To rebuild only F21 from the saved reviewed zone summary, run `python build_f21_grid.py`.
4. Review all findings and totals in `app.js` and `index.html` before publishing.

This is a buildless site. GitHub Pages can publish the repository root of `main`; `.nojekyll` keeps static paths unchanged. The interactive charts use the bundled Plotly cartesian library; its MIT license is included in `PLOTLY-LICENSE.txt`.
