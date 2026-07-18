import { useMemo, useState } from "react";
import "./LeaderboardPage.css";

const METRICS = [
  { value: "during_followers_gained", label: "Followers gained" },
  { value: "viewer_growth_pct", label: "Viewer growth" },
  { value: "during_total_hours_streamed", label: "Hours streamed" },
  { value: "during_weighted_average_viewers", label: "Average viewers" },
  { value: "during_total_hours_watched", label: "Hours watched" },
  { value: "during_peak_viewers", label: "Peak viewers" },
  { value: "follower_uplift_absolute", label: "Follower uplift" },
  { value: "during_followers_per_hour", label: "Followers per hour" },
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
  Control: "#8b98a8",
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

function formatPercent(value) {
  if (value === null || value === undefined || value === "") {
    return "No baseline";
  }
  const number = Number(value);
  if (!Number.isFinite(number)) return "No baseline";
  return `${number >= 0 ? "+" : ""}${number.toFixed(1)}%`;
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
    <div className="lb-multi-select">
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
  const [metric, setMetric] = useState("during_followers_gained");
  const [marathon, setMarathon] = useState("all");
  const [search, setSearch] = useState("");
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

  useMemo(() => {
    if (!availableSizeTiers.length) return;
    if (selectedSizeTiers.length === 0) {
      setSelectedSizeTiers(availableSizeTiers);
    }
  }, [availableSizeTiers, selectedSizeTiers.length]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

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
        matchesMarathon &&
        (!query ||
          streamerName(row).toLowerCase().includes(query) ||
          String(row.streamer || "").toLowerCase().includes(query))
      );
    });
  }, [streamers, selectedGroups, selectedPreSuStreams, selectedSizeTiers, marathon, search]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const aValue = sortKey === "streamer" ? streamerName(a).toLowerCase() : numberOf(a, sortKey);
      const bValue = sortKey === "streamer" ? streamerName(b).toLowerCase() : numberOf(b, sortKey);

      if (typeof aValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    });
  }, [filteredRows, sortKey, sortDirection]);

  const topRows = [...filteredRows]
    .sort((a, b) => numberOf(b, metric) - numberOf(a, metric))
    .slice(0, 10);

  const totals = filteredRows.reduce(
    (result, row) => {
      result.followers += numberOf(row, "during_followers_gained");
      result.hours += numberOf(row, "during_total_hours_streamed");
      result.watchHours += numberOf(row, "during_total_hours_watched");
      return result;
    },
    { followers: 0, hours: 0, watchHours: 0 }
  );

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
    setSearch("");
    setSortKey("during_followers_gained");
    setSortDirection("desc");
  }

  return (
    <section className="leaderboard-page">
      <header className="lb-page-heading">
        <h2>Leaderboard</h2>
        <p>Rank streamers by event performance, growth and efficiency metrics.</p>
      </header>

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
          <small>Ranking metric</small>
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

        <label className="lb-select-control">
          <small>Marathon</small>
          <select value={marathon} onChange={(event) => setMarathon(event.target.value)}>
            <option value="all">All streamers</option>
            <option value="yes">Marathon only</option>
            <option value="no">Exclude marathon</option>
          </select>
        </label>

        <label className="lb-search-control">
          <small>Streamer</small>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search..."
          />
        </label>

        <button className="lb-reset" type="button" onClick={reset}>Reset filters</button>
      </div>

      <div className="lb-kpis">
        <article><span>Streamers ranked</span><strong>{formatNumber(filteredRows.length)}</strong></article>
        <article><span>Followers gained</span><strong>{formatCompactWhole(totals.followers)}</strong></article>
        <article><span>Hours streamed</span><strong>{formatCompact(totals.hours)}</strong></article>
        <article><span>Hours watched</span><strong>{formatCompact(totals.watchHours)}</strong></article>
      </div>

      <article className="lb-panel">
        <div className="lb-panel-heading">
          <h3>Top 10 by {METRICS.find((item) => item.value === metric)?.label}</h3>
          <span>Uses the filters above</span>
        </div>

        <div className="lb-bars">
          {topRows.map((row, index) => {
            const value = numberOf(row, metric);
            const maximum = Math.max(...topRows.map((item) => numberOf(item, metric)), 1);

            return (
              <div className="lb-bar-row" key={row.streamer}>
                <span className="lb-rank">{index + 1}</span>
                <div className="lb-bar-name">
                  <strong>{streamerName(row)}</strong>
                  <small>{row.group}</small>
                </div>
                <div className="lb-track">
                  <div
                    className="lb-fill"
                    style={{
                      width: `${Math.max((value / maximum) * 100, 2)}%`,
                      background: GROUP_COLORS[row.group] || "#8b98a8",
                    }}
                  />
                </div>
                <strong className="lb-value">
                  {metric.includes("pct") ? formatPercent(value) : formatCompact(value)}
                </strong>
              </div>
            );
          })}
        </div>
      </article>

      <article className="lb-panel">
        <div className="lb-panel-heading">
          <h3>Full ranking</h3>
          <span>Showing {formatNumber(sortedRows.length)} streamers · click headings to sort</span>
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
                <th>Marathon</th>
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
                  <td>{formatNumber(numberOf(row, "during_weighted_average_viewers", "during_average_viewers"))}</td>
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
