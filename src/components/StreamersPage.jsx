import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./StreamersPage.css";

const GROUP_COLORS = {
  Student: "#36d17a",
  "Club Director": "#f59e0b",
  Professor: "#9b5cff",
  "Campus Police": "#4f9eff",
  "Guidance Counselor": "#ec4899",
  Janitor: "#a3e635",
  Librarian: "#22d3ee",
};

const SIZE_TIER_ORDER = [
  "Micro (<50)",
  "Small (50-199)",
  "Medium (200-999)",
  "Large (1,000-4,999)",
  "Very Large (5,000+)",
  "No pre-SU baseline",
];

const DRAWER_METRIC_LABELS = {
  followers_gained: "Followers Gained",
  average_viewers: "Average Viewers",
  hours_streamed: "Hours Streamed",
  hours_watched: "Hours Watched",
};

function valueOf(row, ...keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }
  return null;
}

function numberOf(row, ...keys) {
  const value = valueOf(row, ...keys);
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function nameOf(row) {
  return valueOf(row, "display_name", "streamer") || "Unknown";
}

function formatNumber(value, decimals = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";

  const clampedDecimals = Math.max(0, Math.min(decimals, 2));
  return number.toLocaleString(undefined, {
    minimumFractionDigits: clampedDecimals,
    maximumFractionDigits: clampedDecimals,
  });
}

function formatCompact(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";

  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(number);
}

function formatCompactWhole(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";

  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 0,
  }).format(number);
}

function formatCompactWithMillionPrecision(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";

  if (Math.abs(number) >= 1_000_000) {
    return new Intl.NumberFormat(undefined, {
      notation: "compact",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(number);
  }

  return formatCompactWhole(number);
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") {
    return "No baseline";
  }

  const number = Number(value);
  if (!Number.isFinite(number)) return "No baseline";

  return `${number >= 0 ? "+" : ""}${number.toFixed(1)}%`;
}

function formatTooltipValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  const decimals = Number.isInteger(number) ? 0 : 2;
  return formatNumber(number, decimals);
}

function MultiSelect({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (!event.target.closest(".streamers-multi-select")) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  function toggle(option) {
    onChange(
      selected.includes(option)
        ? selected.filter((item) => item !== option)
        : [...selected, option]
    );
  }

  const text =
    selected.length === options.length
      ? `All (${options.length})`
      : selected.length === 0
        ? "None"
        : selected.length === 1
          ? selected[0]
          : `${selected.length} selected`;

  return (
    <div className="streamers-multi-select">
      <button type="button" onClick={() => setOpen((current) => !current)}>
        <span>
          <small>{label}</small>
          <strong>{text}</strong>
        </span>
        <span>⌄</span>
      </button>

      {open && (
        <div className="streamers-multi-menu">
          <div className="streamers-multi-actions">
            <button type="button" onClick={() => onChange(options)}>All</button>
            <button type="button" onClick={() => onChange([])}>Clear</button>
          </div>

          {options.map((option) => (
            <label key={option}>
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() => toggle(option)}
              />
              {option}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function StreamersPage({ streamers = [], groups = [], streamerDaily = [], eventStreams = [] }) {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("All");
  const [selectedSizeTiers, setSelectedSizeTiers] = useState([]);
  const [sizeTiersInitialized, setSizeTiersInitialized] = useState(false);
  const [sortKey, setSortKey] = useState("during_followers_gained");
  const [sortDirection, setSortDirection] = useState("desc");
  const [selectedStreamer, setSelectedStreamer] = useState(null);
  const [chartMetric, setChartMetric] = useState("average_viewers");

  const availableSizeTiers = useMemo(() => {
    const found = [
      ...new Set(streamers.map((row) => valueOf(row, "size_tier")).filter(Boolean)),
    ];

    return [
      ...SIZE_TIER_ORDER.filter((tier) => found.includes(tier)),
      ...found.filter((tier) => !SIZE_TIER_ORDER.includes(tier)),
    ];
  }, [streamers]);

  useEffect(() => {
    if (sizeTiersInitialized || !availableSizeTiers.length) return;
    setSelectedSizeTiers(availableSizeTiers);
    setSizeTiersInitialized(true);
  }, [availableSizeTiers, sizeTiersInitialized]);

  useEffect(() => {
    if (!selectedStreamer) return;
    setChartMetric("average_viewers");
  }, [selectedStreamer]);

  const rows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return streamers
      .filter((row) => {
        const searchMatches =
          !normalizedSearch ||
          nameOf(row).toLowerCase().includes(normalizedSearch) ||
          String(row.streamer || "").toLowerCase().includes(normalizedSearch);

        const groupMatches = group === "All" || row.group === group;

        const sizeTier = valueOf(row, "size_tier");

        return (
          searchMatches &&
          groupMatches &&
          selectedSizeTiers.includes(sizeTier)
        );
      })
      .sort((a, b) => {
        if (sortKey === "display_name") {
          const comparison = nameOf(a).localeCompare(nameOf(b));
          return sortDirection === "asc" ? comparison : -comparison;
        }

        if (sortKey === "pre_weighted_average_viewers") {
          const difference =
            numberOf(a, "pre_weighted_average_viewers", "pre_average_viewers") -
            numberOf(b, "pre_weighted_average_viewers", "pre_average_viewers");
          return sortDirection === "asc" ? difference : -difference;
        }

        if (sortKey === "during_weighted_average_viewers") {
          const difference =
            numberOf(a, "during_weighted_average_viewers", "during_average_viewers") -
            numberOf(b, "during_weighted_average_viewers", "during_average_viewers");
          return sortDirection === "asc" ? difference : -difference;
        }

        if (sortKey === "pre_total_hours_streamed") {
          const difference =
            numberOf(a, "pre_total_hours_streamed", "pre_hours_streamed") -
            numberOf(b, "pre_total_hours_streamed", "pre_hours_streamed");
          return sortDirection === "asc" ? difference : -difference;
        }

        const difference = numberOf(a, sortKey) - numberOf(b, sortKey);
        return sortDirection === "asc" ? difference : -difference;
      });
  }, [
    streamers,
    search,
    group,
    selectedSizeTiers,
    sortKey,
    sortDirection,
  ]);

  const summary = useMemo(() => {
    return rows.reduce(
      (totals, row) => {
        totals.streamers += 1;
        totals.followers += numberOf(row, "during_followers_gained");
        totals.hours += numberOf(row, "during_total_hours_streamed");
        totals.watchHours += numberOf(row, "during_total_hours_watched");
        return totals;
      },
      { streamers: 0, followers: 0, hours: 0, watchHours: 0 }
    );
  }, [rows]);

  function resetFilters() {
    setSearch("");
    setGroup("All");
    setSelectedSizeTiers(availableSizeTiers);
    setSortKey("during_followers_gained");
    setSortDirection("desc");
    setSelectedStreamer(null);
  }

  function changeSort(nextKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(nextKey === "display_name" ? "asc" : "desc");
  }

  function sortMark(key) {
    if (sortKey !== key) return "";
    return sortDirection === "asc" ? " ↑" : " ↓";
  }

  const drawerStreamer = selectedStreamer;
  const drawerHandle = valueOf(drawerStreamer, "streamer", "display_name");
  const drawerTwitchUrl = drawerHandle
    ? `https://www.twitch.tv/${encodeURIComponent(drawerHandle)}`
    : null;

  const drawerDailyData = useMemo(() => {
    if (!drawerStreamer) return [];

    const dailyRows = (streamerDaily || []).filter(
      (row) => row.streamer === drawerStreamer.streamer || row.display_name === drawerStreamer.display_name
    );

    return dailyRows
      .map((row) => ({
        day: valueOf(row, "event_day", "stream_date") || "",
        followers_gained: numberOf(row, "followers_gained"),
        average_viewers: numberOf(row, "average_viewers"),
        peak_viewers: numberOf(row, "peak_viewers", "daily_peak_viewers"),
        hours_streamed: numberOf(row, "hours_streamed"),
        hours_watched: numberOf(row, "hours_watched"),
      }))
      .sort((a, b) => String(a.day).localeCompare(String(b.day)));
  }, [drawerStreamer]);

  const drawerBestDay = useMemo(() => {
    if (!drawerStreamer) return null;

    const dayRows = (drawerDailyData || []).filter((row) => row.day);
    if (!dayRows.length) return null;

    const averageValues = dayRows.map((row) => numberOf(row, "average_viewers"));
    const peakValues = dayRows.map((row) => numberOf(row, "peak_viewers"));
    const followerValues = dayRows.map((row) => numberOf(row, "followers_gained"));

    const averageMin = Math.min(...averageValues);
    const averageMax = Math.max(...averageValues);
    const peakMin = Math.min(...peakValues);
    const peakMax = Math.max(...peakValues);
    const followersMin = Math.min(...followerValues);
    const followersMax = Math.max(...followerValues);

    const hoursValues = dayRows.map((row) => numberOf(row, "hours_streamed"));
    const hoursMin = Math.min(...hoursValues);
    const hoursMax = Math.max(...hoursValues);

    const normalize = (value, min, max) => {
      if (max <= min) return 0;
      return (value - min) / (max - min);
    };

    const normalizeLog = (value, min, max) => {
      const logValue = Math.log1p(Math.max(0, value));
      const logMin = Math.log1p(Math.max(0, min));
      const logMax = Math.log1p(Math.max(0, max));
      return normalize(logValue, logMin, logMax);
    };

    const DAY_SCORE_WEIGHTS = {
      average_viewers: 0.6,
      peak_viewers: 0.2,
      followers_gained: 0.15,
      hours_streamed: 0.05,
    };

    const scoreForDay = (row) =>
      DAY_SCORE_WEIGHTS.average_viewers *
        normalize(numberOf(row, "average_viewers"), averageMin, averageMax) +
      DAY_SCORE_WEIGHTS.peak_viewers *
        normalizeLog(numberOf(row, "peak_viewers"), peakMin, peakMax) +
      DAY_SCORE_WEIGHTS.followers_gained *
        normalizeLog(numberOf(row, "followers_gained"), followersMin, followersMax) +
      DAY_SCORE_WEIGHTS.hours_streamed *
        normalize(numberOf(row, "hours_streamed"), hoursMin, hoursMax);

    return [...dayRows].sort(
      (a, b) =>
        scoreForDay(b) - scoreForDay(a) ||
        numberOf(b, "average_viewers") - numberOf(a, "average_viewers") ||
        numberOf(b, "peak_viewers") - numberOf(a, "peak_viewers") ||
        numberOf(b, "followers_gained") - numberOf(a, "followers_gained")
    )[0];
  }, [drawerDailyData, drawerStreamer]);

  const drawerComparisonRows = [
    {
      label: "Avg viewers",
      pre: numberOf(drawerStreamer, "pre_weighted_average_viewers", "pre_average_viewers"),
      during: numberOf(drawerStreamer, "during_weighted_average_viewers", "during_average_viewers"),
    },
    {
      label: "Peak viewers",
      pre: numberOf(drawerStreamer, "pre_peak_viewers"),
      during: numberOf(drawerStreamer, "during_peak_viewers"),
    },
    {
      label: "Followers gained",
      pre: numberOf(drawerStreamer, "pre_followers_gained"),
      during: numberOf(drawerStreamer, "during_followers_gained"),
    },
  ];

  return (
    <section className="streamers-page">
      <header className="streamers-page-heading">
        <div>
          <h2>Streamers</h2>
          <p>
            Browse every participant and compare their observable pre-event and
            event performance.
          </p>
        </div>
      </header>

      <section className="streamers-filter-bar">
        <label className="streamers-control streamers-search">
          <small>Streamer</small>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or handle..."
          />
        </label>

        <label className="streamers-control">
          <small>Group</small>
          <select value={group} onChange={(event) => setGroup(event.target.value)}>
            <option value="All">All groups</option>
            {groups.map((groupName) => (
              <option key={groupName} value={groupName}>
                {groupName}
              </option>
            ))}
          </select>
        </label>

        <MultiSelect
          label="Streamer size"
          options={availableSizeTiers}
          selected={selectedSizeTiers}
          onChange={setSelectedSizeTiers}
        />

        <button type="button" className="streamers-reset" onClick={resetFilters}>
          Reset filters
        </button>
      </section>

      <section className="streamers-kpis">
        <article>
          <span>Streamers shown</span>
          <strong>{formatNumber(summary.streamers)}</strong>
        </article>
        <article>
          <span>Followers gained</span>
          <strong>{formatCompactWithMillionPrecision(summary.followers)}</strong>
        </article>
        <article>
          <span>Hours streamed</span>
          <strong>{formatCompact(summary.hours)}</strong>
        </article>
        <article>
          <span>Hours watched</span>
          <strong>{formatCompact(summary.watchHours)}</strong>
        </article>
      </section>

      <section className="streamers-table-panel">
        <div className="streamers-table-heading">
          <div>
            <h3>Streamer directory</h3>
            <span>
              {formatNumber(rows.length)} results · Click a heading to sort
            </span>
          </div>
        </div>

        <div className="streamers-table-wrap">
          <table className="streamers-table">
            <thead>
              <tr>
                <th onClick={() => changeSort("display_name")}>
                  Streamer{sortMark("display_name")}
                </th>
                <th>Group</th>
                <th onClick={() => changeSort("pre_weighted_average_viewers")}>
                  Pre-SU (30d) avg viewers
                  {sortMark("pre_weighted_average_viewers")}
                </th>
                <th onClick={() => changeSort("during_weighted_average_viewers")}>
                  During-SU avg viewers
                  {sortMark("during_weighted_average_viewers")}
                </th>
                <th onClick={() => changeSort("viewer_growth_pct")}>
                  Viewer growth{sortMark("viewer_growth_pct")}
                </th>
                <th onClick={() => changeSort("pre_total_hours_streamed")}>
                  Pre-SU (30d) hours streamed
                  {sortMark("pre_total_hours_streamed")}
                </th>
                <th onClick={() => changeSort("during_total_hours_streamed")}>
                  During-SU hours streamed{sortMark("during_total_hours_streamed")}
                </th>
                <th onClick={() => changeSort("during_followers_gained")}>
                  Followers gained{sortMark("during_followers_gained")}
                </th>
                <th onClick={() => changeSort("during_total_hours_watched")}>
                  Hours watched{sortMark("during_total_hours_watched")}
                </th>
                <th onClick={() => changeSort("during_peak_viewers")}>
                  Peak viewers{sortMark("during_peak_viewers")}
                </th>
                <th>
                  <span className="streamers-marathon-header">
                    Marathon
                    <span className="streamers-info-trigger" aria-label="Marathon definition" role="img">
                      ?
                      <span className="streamers-info-tooltip" role="tooltip">
                        A marathon streamer is someone who streamed at least 80% of all possible hours during SU.
                      </span>
                    </span>
                  </span>
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const preAverage = valueOf(
                  row,
                  "pre_weighted_average_viewers",
                  "pre_average_viewers"
                );

                return (
                  <tr
                    key={row.streamer || nameOf(row)}
                    onClick={() => setSelectedStreamer(row)}
                    className={
                      drawerStreamer && drawerStreamer.streamer === row.streamer
                        ? "streamers-row-active"
                        : ""
                    }
                  >
                    <td className="streamers-name">
                      <strong>{nameOf(row)}</strong>
                      {row.streamer && <small>@{row.streamer}</small>}
                    </td>

                    <td>
                      <span
                        className="streamers-group"
                        style={{
                          color: GROUP_COLORS[row.group] || "#a9b7c4",
                        }}
                      >
                        <i
                          style={{
                            background: GROUP_COLORS[row.group] || "#a9b7c4",
                          }}
                        />
                        {row.group || "—"}
                      </span>
                    </td>

                    <td>
                      {preAverage == null
                        ? "No baseline"
                        : formatNumber(Number(preAverage))}
                    </td>

                    <td>
                      {formatNumber(
                        numberOf(
                          row,
                          "during_weighted_average_viewers",
                          "during_average_viewers"
                        )
                      )}
                    </td>

                    <td>{formatPercent(valueOf(row, "viewer_growth_pct"))}</td>

                    <td>
                      {formatNumber(
                        numberOf(
                          row,
                          "pre_total_hours_streamed",
                          "pre_hours_streamed"
                        ),
                        1
                      )}
                    </td>

                    <td>
                      {formatNumber(
                        numberOf(row, "during_total_hours_streamed"),
                        1
                      )}
                    </td>

                    <td>
                      {formatNumber(
                        numberOf(row, "during_followers_gained")
                      )}
                    </td>

                    <td>
                      {formatCompact(
                        numberOf(row, "during_total_hours_watched")
                      )}
                    </td>

                    <td>
                      {formatNumber(numberOf(row, "during_peak_viewers"))}
                    </td>

                    <td>
                      {row.is_marathon ? (
                        <span className="streamers-marathon">Marathon</span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td className="streamers-empty" colSpan="11">
                    No streamers match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {drawerStreamer && (
        <div className="streamers-drawer-backdrop" onClick={() => setSelectedStreamer(null)}>
          <aside className="streamers-drawer" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="streamers-drawer-close" onClick={() => setSelectedStreamer(null)}>
              ×
            </button>

            <div className="streamers-drawer-header">
              <div>
                <h3>{nameOf(drawerStreamer)}</h3>
                <p>{drawerStreamer.group || "Unknown group"}</p>
              </div>
              <div className="streamers-drawer-header-actions">
                {drawerStreamer.is_marathon ? (
                  <span className="streamers-drawer-badge marathon">Marathon</span>
                ) : null}
                {drawerTwitchUrl ? (
                  <a href={drawerTwitchUrl} target="_blank" rel="noreferrer">
                    Twitch
                  </a>
                ) : null}
              </div>
            </div>

            <div className="streamers-drawer-summary">
              <article>
                <span>Viewer growth</span>
                <strong>{formatPercent(valueOf(drawerStreamer, "viewer_growth_pct"))}</strong>
              </article>
              <article>
                <span>No pre-SU baseline</span>
                <strong>{numberOf(drawerStreamer, "pre_broadcasts") === 0 ? "Yes" : "No"}</strong>
              </article>
              <article>
                <span>Pre-SU (30d) hours streamed</span>
                <strong>
                  {formatNumber(
                    numberOf(
                      drawerStreamer,
                      "pre_total_hours_streamed",
                      "pre_hours_streamed"
                    ),
                    1
                  )}
                </strong>
              </article>
              <article>
                <span>During-SU hours streamed</span>
                <strong>
                  {formatNumber(
                    numberOf(
                      drawerStreamer,
                      "during_total_hours_streamed",
                      "during_hours_streamed"
                    ),
                    1
                  )}
                </strong>
              </article>
            </div>

            <div className="streamers-drawer-section">
              <div className="streamers-drawer-section-title">
                <h4>Pre-SU vs SU</h4>
              </div>
              <div className="streamers-drawer-comparison">
                <div className="streamers-drawer-comparison-header">
                  <span>Metric</span>
                  <span>Pre-SU (30d)</span>
                  <span>SU</span>
                  <span>% Change</span>
                </div>
                {drawerComparisonRows.map((row) => {
                  const change = row.pre === 0 ? (row.during > 0 ? 100 : 0) : ((row.during - row.pre) / row.pre) * 100;

                  return (
                    <div key={row.label} className="streamers-drawer-comparison-row">
                      <span>{row.label}</span>
                      <strong>{formatNumber(row.pre)}</strong>
                      <strong>{formatNumber(row.during)}</strong>
                      <em>{Number.isFinite(change) ? `${change >= 0 ? "+" : ""}${change.toFixed(1)}%` : "—"}</em>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="streamers-drawer-section">
              <div className="streamers-drawer-section-title">
                <h4>Daily performance</h4>
                <select value={chartMetric} onChange={(event) => setChartMetric(event.target.value)}>
                  <option value="followers_gained">Followers gained</option>
                  <option value="average_viewers">Average viewers</option>
                  <option value="hours_streamed">Hours streamed</option>
                  <option value="hours_watched">Hours watched</option>
                </select>
              </div>
              <div className="streamers-drawer-chart">
                <ResponsiveContainer width="100%" height="200">
                  <LineChart data={drawerDailyData}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis dataKey="day" stroke="var(--text-secondary)" tick={{ fontSize: 11 }} />
                    <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value) => [
                        chartMetric === "followers_gained"
                          ? formatNumber(value)
                          : formatTooltipValue(value),
                        DRAWER_METRIC_LABELS[chartMetric] || chartMetric,
                      ]}
                      contentStyle={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        borderRadius: "6px",
                      }}
                      labelStyle={{
                        color: "var(--text-primary)",
                        fontWeight: 700,
                      }}
                      itemStyle={{ color: "var(--text-secondary)" }}
                    />
                    <Line
                      type="monotone"
                      dataKey={chartMetric}
                      name={DRAWER_METRIC_LABELS[chartMetric] || chartMetric}
                      stroke="var(--accent-gold)"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {drawerBestDay ? (
              <div className="streamers-drawer-section">
                <div className="streamers-drawer-section-title">
                  <h4>Best day</h4>
                </div>
                <div className="streamers-drawer-best-stream">
                  <div>
                    <strong>{drawerBestDay.day || "—"}</strong>
                    <span>{formatNumber(numberOf(drawerBestDay, "hours_streamed"), 1)} hours</span>
                  </div>
                  <div>
                    <strong>{formatNumber(numberOf(drawerBestDay, "average_viewers"))}</strong>
                    <span>Avg viewers</span>
                  </div>
                  <div>
                    <strong>{formatNumber(numberOf(drawerBestDay, "peak_viewers"))}</strong>
                    <span>Peak viewers</span>
                  </div>
                  <div>
                    <strong>{formatNumber(numberOf(drawerBestDay, "followers_gained"))}</strong>
                    <span>Followers gained</span>
                  </div>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      )}
    </section>
  );
}

export default StreamersPage;
