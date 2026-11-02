"""Build the compact F21 zone-duration figure from the reviewed zone summary.

The labels are raw zone-code parts. No geographic meaning is inferred from them.
"""
from __future__ import annotations

import csv
import html
import json
from pathlib import Path


SITE = Path(__file__).resolve().parent
PREFIXES = ("INON", "INSE", "INSW")
SUFFIXES = tuple(f"{number:02d}" for number in range(1, 11))
STOPS = ((0, "#f4faf8"), (0.25, "#d2ebe6"), (0.5, "#a7d7cd"),
         (0.75, "#75bdae"), (1, "#4bad9e"))


def color_for_days(days: int) -> str:
    position = min(1.0, max(0.0, days / 190))
    for (left, left_color), (right, right_color) in zip(STOPS, STOPS[1:]):
        if position <= right:
            fraction = (position - left) / (right - left)
            a = [int(left_color[index:index + 2], 16) for index in (1, 3, 5)]
            b = [int(right_color[index:index + 2], 16) for index in (1, 3, 5)]
            return "#" + "".join(f"{round(x + (y - x) * fraction):02x}" for x, y in zip(a, b))
    return STOPS[-1][1]


def build_f21_grid(records: list[dict]) -> tuple[str, dict]:
    by_zone = {str(record["zone"]): record for record in records}
    expected = {prefix + suffix for prefix in PREFIXES for suffix in SUFFIXES}
    if set(by_zone) != expected:
        raise ValueError(f"F21 requires exactly the 30 expected zone codes; missing={sorted(expected - set(by_zone))}")

    def measure(field: str) -> list[list[int]]:
        return [[int(by_zone[prefix + suffix][field]) for prefix in PREFIXES]
                for suffix in SUFFIXES]

    to_90 = measure("days_to_90pct_cy")
    to_last = measure("first_to_last_days")
    details = [[(
        f"Zone1: {prefix + suffix}<br>"
        f"Tickets: {int(by_zone[prefix + suffix]['tickets']):,}<br>"
        f"Recorded CY: {float(by_zone[prefix + suffix]['cy']):,.2f}<br>"
        f"First: {by_zone[prefix + suffix]['first']}<br>"
        f"Last: {by_zone[prefix + suffix]['last']}<br>"
        f"Active dates: {int(by_zone[prefix + suffix]['active_dates'])}<br>"
        f"Days to 90% of zone CY: {int(by_zone[prefix + suffix]['days_to_90pct_cy'])}<br>"
        f"First-to-last: {int(by_zone[prefix + suffix]['first_to_last_days'])} days"
    ) for prefix in PREFIXES] for suffix in SUFFIXES]

    def trace(grid: list[list[int]], name: str, visible: bool) -> dict:
        return {"type": "heatmap", "name": name, "x": PREFIXES, "y": SUFFIXES,
                "z": grid, "zmin": 0, "zmax": 190, "colorscale": STOPS,
                "text": [[str(value) for value in row] for row in grid],
                "texttemplate": "%{text}", "textfont": {"color": "#17324b", "size": 17},
                "xgap": 3, "ygap": 3, "customdata": details, "visible": visible,
                "hovertemplate": "%{customdata}<extra></extra>", "colorbar": {"title": "Days"}}

    spec = {"data": [trace(to_90, "90% of recorded CY", True),
                     trace(to_last, "First to last ticket", False)],
            "layout": {"xaxis": {"title": "Zone code prefix", "side": "top", "type": "category", "fixedrange": True},
                       "yaxis": {"title": "Zone code suffix", "autorange": "reversed", "type": "category", "fixedrange": True},
                       "margin": {"l": 82, "r": 85, "t": 105, "b": 28},
                       "showlegend": False,
                       "hovermode": "closest", "dragmode": False,
                       "updatemenus": [{"type": "buttons", "direction": "right", "x": 0, "y": 1.18,
                                        "xanchor": "left", "yanchor": "top", "showactive": True,
                                        "buttons": [
                                            {"label": "90% of volume", "method": "restyle",
                                             "args": [{"visible": [True, False]}]},
                                            {"label": "First–last ticket", "method": "restyle",
                                             "args": [{"visible": [False, True]}]}
                                        ]}]}}

    svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 760" role="img" '
           'aria-labelledby="title desc">',
           '<title id="title">F21: Days to 90% of recorded volume by debris zone</title>',
           '<desc id="desc">Thirty cells show the exact number of days from the first ticket until each zone reached '
           '90 percent of its own recorded cubic yards. Darker cells mean more days.</desc>',
           '<rect width="820" height="760" fill="white"/>',
           '<g font-family="Arial, sans-serif" fill="#17324b">',
           '<text x="46" y="44" font-size="24" font-weight="700">F21 · Days to 90% of recorded volume</text>',
           '<text x="46" y="70" font-size="15">Each cell is one debris zone. The number is elapsed days from its first ticket.</text>',
           '<text x="46" y="95" font-size="13">Zone code prefix</text>']
    left, top, width, height, gap = 94, 130, 208, 48, 4
    for column, prefix in enumerate(PREFIXES):
        x = left + column * (width + gap)
        svg.append(f'<text x="{x + width / 2}" y="117" text-anchor="middle" font-size="17" '
                   f'font-weight="700">{prefix}</text>')
    for row, suffix in enumerate(SUFFIXES):
        y = top + row * (height + gap)
        svg.append(f'<text x="73" y="{y + height / 2 + 5}" text-anchor="end" font-size="16">{suffix}</text>')
        for column, prefix in enumerate(PREFIXES):
            x = left + column * (width + gap)
            value = to_90[row][column]
            zone = prefix + suffix
            svg.append(f'<g><title>{html.escape(zone)}: {value} days to 90%; '
                       f'{to_last[row][column]} days to last ticket</title>'
                       f'<rect x="{x}" y="{y}" width="{width}" height="{height}" rx="4" '
                       f'fill="{color_for_days(value)}"/>'
                       f'<text x="{x + width / 2}" y="{y + height / 2 + 7}" text-anchor="middle" '
                       f'font-size="20" font-weight="700" fill="#17324b">{value}</text></g>')
    svg.extend(['<text x="46" y="674" font-size="13">Zone = column prefix + row suffix; for example, INON01.</text>',
                '<text x="46" y="698" font-size="13">Darker = longer elapsed time. Open the figure to switch to first-to-last ticket duration.</text>',
                '<text x="46" y="731" font-size="11" fill="#53616d">Source: Pinellas County eGIS ticket extract, '
                'Oct 2, 2024–Apr 10, 2025. Ticket activity is not verified cleanup completion.</text>',
                '</g></svg>'])
    return "\n".join(svg), spec


if __name__ == "__main__":
    with (SITE.parent / "outputs" / "mark-review" / "All-zone-recorded-activity-duration.csv").open(newline="", encoding="utf-8") as handle:
        records = list(csv.DictReader(handle))
    svg, spec = build_f21_grid(records)
    (SITE / "figures" / "F21-zone-duration-grid.svg").write_text(svg, encoding="utf-8")
    values_path = SITE / "data" / "figure-values.json"
    values = json.loads(values_path.read_text(encoding="utf-8"))
    values["F21"] = spec
    values_path.write_text(json.dumps(values, separators=(",", ":"), allow_nan=False), encoding="utf-8")
    print("Updated F21 preview and interactive specification for 30 zones")
