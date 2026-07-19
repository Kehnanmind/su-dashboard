import { useEffect, useMemo, useRef, useState } from "react";
import "./LeaderboardPage.css";

const METRICS = [
  { value: "during_followers_gained", label: "Followers gained" },
  { value: "viewer_growth_pct", label: "Viewer growth" },
  { value: "during_total_hours_streamed", label: "Hours streamed" },
  { value: "during_weighted_average_viewers", label: "Average viewers" },
  { value: "during_total_hours_watched", label: "Hours watched" },
  { value: "during_peak_viewers", label: "Peak viewers" },
];

const PRE_SU_STREAM_BUCKETS = ["<2", "<5", "<10", "<15", ">15"];
const SIZE_TIER_ORDER = [
  "Micro (<50)",
  "Small (50-199)",
  "Medium (200-999)",
  "Large (1,000-4,999)",
  "Very Large (5,000+)",
  "No pre-SU baseline",
];

const GROUP_COLORS = {
  Student: "#36d17a",
  "Club Director": "#f59e0b",
  Professor: "#9b5cff",
  "Campus Police": "#4f9eff",
  "Guidance Counselor": "#ec4899",
  Janitor: "#a3e635",
  Librarian: "#22d3ee",
};

function valueOf(row, ...keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return null;
}

function numberOf(row, ...keys) {
  const number = Number(valueOf(row, ...keys));
  return Number.isFinite(number) ? number : 0;
}

function streamerName(row) {
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

function preAverageViewers(row) {
  const number = Number(valueOf(row, "pre_weighted_average_viewers", "pre_average_viewers"));
  return Number.isFinite(number) ? number : null;
}

function duringAverageViewers(row) {
  return numberOf(
    row,
    "during_weighted_average_viewers",
    "during_average_viewers",
    "rolling_average_viewers",
    "average_viewers"
  );
}

function duringPeakViewers(row) {
  return numberOf(row, "during_peak_viewers", "rolling_peak_viewers", "peak_viewers");
}

function averageViewerChange(row) {
  const preAverage = preAverageViewers(row);
  if (!Number.isFinite(preAverage) || preAverage <= 0) return null;
  return duringAverageViewers(row) - preAverage;
}

function metricHasValue(row, metricKey) {
  if (metricKey === "viewer_growth_pct") {
    return valueOf(row, "viewer_growth_pct") !== null;
  }

  return true;
}

function percentileRank(value, sortedValues) {
  if (!Number.isFinite(value) || sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return 100;

  let count = 0;
  for (const current of sortedValues) {
    if (current <= value) {
      count += 1;
    }
  }

  return ((count - 1) / (sortedValues.length - 1)) * 100;
}

function metricNumber(row, metricKey) {
  const aliases = {
    during_followers_gained: [
      "during_followers_gained",
      "rolling_followers_gained",
      "followers_gained",
    ],
    during_total_hours_streamed: [
      "during_total_hours_streamed",
      "rolling_hours_streamed",
      "hours_streamed",
    ],
    during_weighted_average_viewers: [
      "during_weighted_average_viewers",
      "during_average_viewers",
      "rolling_average_viewers",
      "average_viewers",
    ],
    during_total_hours_watched: [
      "during_total_hours_watched",
      "rolling_hours_watched",
      "hours_watched",
    ],
    during_peak_viewers: [
      "during_peak_viewers",
      "rolling_peak_viewers",
      "peak_viewers",
    ],
    pre_weighted_average_viewers: [
      "pre_weighted_average_viewers",
      "pre_average_viewers",
    ],
    viewer_growth_pct: ["viewer_growth_pct"],
  };

  return numberOf(row, ...(aliases[metricKey] || [metricKey]));
}

function getStreamBucket(value) {
  if (value < 2) return "<2";
  if (value < 5) return "<5";
  if (value < 10) return "<10";
  if (value < 15) return "<15";
  return ">15";
}

function MultiSelect({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
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
    <div className="lb-multi-select" ref={wrapperRef}>
      <button type="button" onClick={() => setOpen((current) => !current)}>
        <span>
          <small>{label}</small>
          <strong>{text}</strong>
        </span>
        <span>⌄</span>
      </button>

      {open && (
        <div className="lb-multi-menu">
          <div className="lb-multi-actions">
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
              <span
                className="lb-group-dot"
                style={{ background: GROUP_COLORS[option] || "#8b98a8" }}
              />
              {option}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function SortHeader({ column, sortKey, direction, onSort, children }) {
  const indicator = sortKey === column ? (direction === "asc" ? " ↑" : " ↓") : "";

  return (
    <th onClick={() => onSort(column)}>
      {children}{indicator}
    </th>
  );
}

export default function LeaderboardPage({ streamers, groups }) {
  const [selectedGroups, setSelectedGroups] = useState(groups);
  const [selectedPreSuStreams, setSelectedPreSuStreams] = useState(PRE_SU_STREAM_BUCKETS);
  const [selectedSizeTiers, setSelectedSizeTiers] = useState([]);
  const [sizeTiersInitialized, setSizeTiersInitialized] = useState(false);
  const [metric, setMetric] = useState("during_followers_gained");
  const [marathon, setMarathon] = useState("all");
  const [sortKey, setSortKey] = useState("during_followers_gained");
  const [sortDirection, setSortDirection] = useState("desc");

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

  const filteredRows = useMemo(() => {
    return streamers.filter((row) => {
      const preSuStreams = numberOf(row, "pre_broadcasts");
      const sizeTier = valueOf(row, "size_tier");
      const matchesPreSuStreams = selectedPreSuStreams.includes(getStreamBucket(preSuStreams));
      const matchesSizeTier = selectedSizeTiers.includes(sizeTier);
      const matchesMarathon =
        marathon === "all" ||
        (marathon === "yes" && Boolean(row.is_marathon)) ||
        (marathon === "no" && !row.is_marathon);

      return (
        selectedGroups.includes(row.group) &&
        matchesPreSuStreams &&
        matchesSizeTier &&
        matchesMarathon
      );
    });
  }, [streamers, selectedGroups, selectedPreSuStreams, selectedSizeTiers, marathon]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const aValue =
        sortKey === "streamer" || sortKey === "size_tier"
          ? String(valueOf(a, sortKey, sortKey === "streamer" ? "display_name" : "") || "").toLowerCase()
          : metricNumber(a, sortKey);
      const bValue =
        sortKey === "streamer" || sortKey === "size_tier"
          ? String(valueOf(b, sortKey, sortKey === "streamer" ? "display_name" : "") || "").toLowerCase()
          : metricNumber(b, sortKey);

      if (typeof aValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    });
  }, [filteredRows, sortKey, sortDirection]);

  const comparableMetricRows = useMemo(
    () => filteredRows.filter((row) => metricHasValue(row, metric)),
    [filteredRows, metric]
  );

  const topRows = useMemo(
    () => [...comparableMetricRows].sort((a, b) => metricNumber(b, metric) - metricNumber(a, metric)).slice(0, 10),
    [comparableMetricRows, metric]
  );

  const bottomRows = useMemo(
    () => [...comparableMetricRows].sort((a, b) => metricNumber(a, metric) - metricNumber(b, metric)).slice(0, 10),
    [comparableMetricRows, metric]
  );

  const breakoutWinners = useMemo(() => {
    const followerValues = filteredRows
      .map((row) => numberOf(row, "during_followers_gained"))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);
    const growthValues = filteredRows
      .map((row) => Number(valueOf(row, "viewer_growth_pct")))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);
    const averageChangeValues = filteredRows
      .map((row) => averageViewerChange(row))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);

    return filteredRows
      .map((row) => {
        const growthValue = Number(valueOf(row, "viewer_growth_pct"));
        const preAverage = preAverageViewers(row);
        const duringAverage = duringAverageViewers(row);
        const avgViewerChange = averageViewerChange(row);
        const followersGained = numberOf(row, "during_followers_gained");
        const viewerGrowthScore = percentileRank(growthValue, growthValues);
        const followerScore = percentileRank(followersGained, followerValues);
        const avgViewerChangeScore = percentileRank(avgViewerChange, averageChangeValues);

        return {
          row,
          breakoutScore: (viewerGrowthScore + followerScore + avgViewerChangeScore) / 3,
          viewerGrowth: Number.isFinite(growthValue) ? growthValue : null,
          preAverage,
          duringAverage,
          avgViewerChange,
          followersGained,
          peakViewers: duringPeakViewers(row),
          hoursStreamed: numberOf(row, "during_total_hours_streamed"),
        };
      })
      .sort((a, b) => b.breakoutScore - a.breakoutScore)
      .slice(0, 3);
  }, [filteredRows]);

  const maximumTopValue = Math.max(...topRows.map((row) => Math.abs(metricNumber(row, metric))), 1);
  const maximumBottomValue = Math.max(...bottomRows.map((row) => Math.abs(metricNumber(row, metric))), 1);
  const metricLabel = METRICS.find((item) => item.value === metric)?.label || "Selected metric";
  const omittedMetricCount = filteredRows.length - comparableMetricRows.length;
  const usesSignedMetricBars = metric === "viewer_growth_pct";

  function changeSort(column) {
    if (column === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(column);
      setSortDirection("desc");
    }
  }

  function reset() {
    setSelectedGroups(groups);
    setSelectedPreSuStreams(PRE_SU_STREAM_BUCKETS);
    setSelectedSizeTiers(availableSizeTiers);
    setMetric("during_followers_gained");
    setMarathon("all");
    setSortKey("during_followers_gained");
    setSortDirection("desc");
  }

  return (
    <section className="leaderboard-page">
      <header className="lb-page-heading">
        <h2>Leaderboard</h2>
        <p>Compare who broke out the most, who led the field, and who lagged behind.</p>
      </header>

      <article className="lb-panel lb-controls-panel">
        <div className="lb-panel-heading">
          <div>
            <h3>Filters</h3>
            <span>Filter the field, then compare the best and worst performers in that slice.</span>
          </div>
        </div>

        <div className="lb-filter-grid">
          <MultiSelect
            label="Group"
            options={groups}
            selected={selectedGroups}
            onChange={setSelectedGroups}
          />

          <MultiSelect
            label="Pre-SU streams"
            options={PRE_SU_STREAM_BUCKETS}
            selected={selectedPreSuStreams}
            onChange={setSelectedPreSuStreams}
          />

          <MultiSelect
            label="Streamer size"
            options={availableSizeTiers}
            selected={selectedSizeTiers}
            onChange={setSelectedSizeTiers}
          />

          <label className="lb-select-control">
            <small>Marathon</small>
            <select value={marathon} onChange={(event) => setMarathon(event.target.value)}>
              <option value="all">All streamers</option>
              <option value="yes">Marathon only</option>
              <option value="no">Exclude marathon</option>
            </select>
          </label>

          <button className="lb-reset lb-reset-inline" type="button" onClick={reset}>Reset filters</button>
        </div>
      </article>

      <article className="lb-panel">
        <div className="lb-panel-heading">
          <h3>Breakout winners</h3>
          <span>Based on viewer growth, followers gained, and change in average viewers versus pre-SU. This section does not use the ranking metric.</span>
        </div>

        <div className="lb-winners-grid">
          {breakoutWinners.map((item, index) => (
            <article className="lb-winner-card" key={item.row.streamer}>
              <div className="lb-winner-topline">
                <span className="lb-winner-rank">#{index + 1}</span>
              </div>

              <h4>{streamerName(item.row)}</h4>
              <p className="lb-winner-meta">
                {item.row.group || "Unknown group"}
                {valueOf(item.row, "size_tier") ? ` · ${valueOf(item.row, "size_tier")}` : ""}
              </p>

              <dl className="lb-winner-stats">
                <div>
                  <dt>Pre-SU avg viewers</dt>
                  <dd>{item.preAverage == null ? "No baseline" : formatNumber(item.preAverage)}</dd>
                </div>
                <div>
                  <dt>SU avg viewers</dt>
                  <dd>{formatNumber(item.duringAverage)}</dd>
                </div>
                <div>
                  <dt>Viewer growth</dt>
                  <dd>{formatPercent(item.viewerGrowth)}</dd>
                </div>
                <div>
                  <dt>Followers gained</dt>
                  <dd>{formatCompactWithMillionPrecision(item.followersGained)}</dd>
                </div>
                <div>
                  <dt>Hours streamed</dt>
                  <dd>{formatNumber(item.hoursStreamed, 1)}</dd>
                </div>
              </dl>
            </article>
          ))}

          {!breakoutWinners.length && (
            <div className="lb-empty-state">
              <h3>No breakout winners to show</h3>
              <p>Try widening the current filters.</p>
            </div>
          )}
        </div>
      </article>

      <article className="lb-panel lb-ranking-panel">
        <div className="lb-panel-heading lb-panel-heading-split">
          <div>
            <h3>Rank the field</h3>
            <span>This ranking metric drives the top 10, bottom 10, and full table sorting.</span>
          </div>

          <label className="lb-select-control lb-select-control-prominent">
            <small>Leaderboard is ranked by</small>
            <select
              value={metric}
              onChange={(event) => {
                setMetric(event.target.value);
                setSortKey(event.target.value);
                setSortDirection("desc");
              }}
            >
              {METRICS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        <section className="lb-compare-grid">
        <article className="lb-compare-card">
          <div className="lb-panel-heading">
            <h3>Top 10 by {metricLabel}</h3>
            <span>Best performers in the current filtered field</span>
          </div>

          <div className="lb-bars">
            {topRows.map((row, index) => {
              const value = metricNumber(row, metric);

              return (
                <div className="lb-bar-row" key={`top-${row.streamer}`}>
                  <span className="lb-rank">{index + 1}</span>
                  <div className="lb-bar-name">
                    <strong>{streamerName(row)}</strong>
                    <small>{row.group}</small>
                  </div>
                  <div className={`lb-track ${usesSignedMetricBars ? "lb-track-signed" : ""}`}>
                    {usesSignedMetricBars && <span className="lb-track-zero" />}
                    <div
                      className={`lb-fill ${usesSignedMetricBars ? `lb-fill-signed ${value < 0 ? "lb-fill-negative" : "lb-fill-positive"}` : ""}`}
                      style={
                        usesSignedMetricBars
                          ? {
                              width: `${Math.max((Math.abs(value) / maximumTopValue) * 50, Math.abs(value) > 0 ? 2 : 0)}%`,
                              left: value < 0
                                ? `${50 - Math.max((Math.abs(value) / maximumTopValue) * 50, Math.abs(value) > 0 ? 2 : 0)}%`
                                : "50%",
                            }
                          : {
                              width: `${Math.max((Math.abs(value) / maximumTopValue) * 100, 2)}%`,
                              background: GROUP_COLORS[row.group] || "#8b98a8",
                            }
                      }
                    />
                  </div>
                  <strong className="lb-value">
                    {metric.includes("pct") ? formatPercent(value) : formatCompact(value)}
                  </strong>
                </div>
              );
            })}

            {!topRows.length && (
              <div className="lb-empty-state lb-empty-state-compact">
                <h3>No top 10 to show</h3>
                <p>Nothing matches the current selection.</p>
              </div>
            )}
          </div>
        </article>

        <article className="lb-compare-card">
          <div className="lb-panel-heading">
            <h3>Bottom 10 by {metricLabel}</h3>
            <span>
              Lowest performers in the same field
              {metric === "viewer_growth_pct" && omittedMetricCount > 0
                ? ` · ${formatNumber(omittedMetricCount)} with no baseline omitted`
                : ""}
            </span>
          </div>

          <div className="lb-bars lb-bars-bottom">
            {bottomRows.map((row, index) => {
              const value = metricNumber(row, metric);

              return (
                <div className="lb-bar-row" key={`bottom-${row.streamer}`}>
                  <span className="lb-rank">{index + 1}</span>
                  <div className="lb-bar-name">
                    <strong>{streamerName(row)}</strong>
                    <small>{row.group}</small>
                  </div>
                  <div className={`lb-track lb-track-bottom ${usesSignedMetricBars ? "lb-track-signed" : ""}`}>
                    {usesSignedMetricBars && <span className="lb-track-zero" />}
                    <div
                      className={`lb-fill lb-fill-bottom ${usesSignedMetricBars ? `lb-fill-signed ${value < 0 ? "lb-fill-negative" : "lb-fill-positive"}` : ""}`}
                      style={
                        usesSignedMetricBars
                          ? {
                              width: `${Math.max((Math.abs(value) / maximumBottomValue) * 50, Math.abs(value) > 0 ? 2 : 0)}%`,
                              left: value < 0
                                ? `${50 - Math.max((Math.abs(value) / maximumBottomValue) * 50, Math.abs(value) > 0 ? 2 : 0)}%`
                                : "50%",
                            }
                          : {
                              width: `${Math.max((Math.abs(value) / maximumBottomValue) * 100, 2)}%`,
                            }
                      }
                    />
                  </div>
                  <strong className="lb-value">
                    {metric.includes("pct") ? formatPercent(value) : formatCompact(value)}
                  </strong>
                </div>
              );
            })}

            {!bottomRows.length && (
              <div className="lb-empty-state lb-empty-state-compact">
                <h3>No bottom 10 to show</h3>
                <p>Nothing matches the current selection.</p>
              </div>
            )}
          </div>
        </article>
        </section>
      </article>

      <article className="lb-panel">
        <div className="lb-panel-heading">
          <h3>Full ranking</h3>
          <span>Reference table for deeper inspection · showing {formatNumber(sortedRows.length)} streamers</span>
        </div>

        <div className="lb-table-wrapper">
          <table className="lb-table">
            <thead>
              <tr>
                <th>Rank</th>
                <SortHeader column="streamer" sortKey={sortKey} direction={sortDirection} onSort={changeSort}>Streamer</SortHeader>
                <th>Group</th>
                <SortHeader column="size_tier" sortKey={sortKey} direction={sortDirection} onSort={changeSort}>Streamer size</SortHeader>
                <SortHeader column="pre_weighted_average_viewers" sortKey={sortKey} direction={sortDirection} onSort={changeSort}>Pre-SU avg viewers</SortHeader>
                <SortHeader column="during_weighted_average_viewers" sortKey={sortKey} direction={sortDirection} onSort={changeSort}>SU avg viewers</SortHeader>
                <SortHeader column="viewer_growth_pct" sortKey={sortKey} direction={sortDirection} onSort={changeSort}>Viewer growth</SortHeader>
                <SortHeader column="during_total_hours_streamed" sortKey={sortKey} direction={sortDirection} onSort={changeSort}>Hours streamed</SortHeader>
                <SortHeader column="during_followers_gained" sortKey={sortKey} direction={sortDirection} onSort={changeSort}>Followers gained</SortHeader>
                <SortHeader column="during_total_hours_watched" sortKey={sortKey} direction={sortDirection} onSort={changeSort}>Hours watched</SortHeader>
                <th>
                  <span className="lb-marathon-header">
                    Marathon
                    <span className="lb-info-trigger" aria-label="Marathon definition" role="img">
                      ?
                      <span className="lb-info-tooltip" role="tooltip">
                        A marathon streamer is someone who streamed at least 80% of all possible hours during SU.
                      </span>
                    </span>
                  </span>
                </th>
              </tr>
            </thead>

            <tbody>
              {sortedRows.map((row, index) => (
                <tr key={row.streamer}>
                  <td>{index + 1}</td>
                  <td className="lb-streamer-name">
                    {streamerName(row)}
                    <small>@{row.streamer}</small>
                  </td>
                  <td style={{ color: GROUP_COLORS[row.group] || "#8b98a8" }}>{row.group}</td>
                  <td>{valueOf(row, "size_tier") || "—"}</td>
                  <td>
                    {valueOf(row, "pre_weighted_average_viewers", "pre_average_viewers") == null
                      ? "No baseline"
                      : formatNumber(numberOf(row, "pre_weighted_average_viewers", "pre_average_viewers"))}
                  </td>
                  <td>{formatNumber(numberOf(row, "during_weighted_average_viewers", "during_average_viewers", "rolling_average_viewers", "average_viewers"))}</td>
                  <td>{formatPercent(valueOf(row, "viewer_growth_pct"))}</td>
                  <td>{formatNumber(numberOf(row, "during_total_hours_streamed"), 1)}</td>
                  <td>{formatNumber(numberOf(row, "during_followers_gained"))}</td>
                  <td>{formatCompact(numberOf(row, "during_total_hours_watched"))}</td>
                  <td>{row.is_marathon ? <span className="lb-marathon">Marathon</span> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
