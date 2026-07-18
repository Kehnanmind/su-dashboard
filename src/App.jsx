import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./App.css";
import LeaderboardPage from "./components/LeaderboardPage";
import StreamersPage from "./components/StreamersPage";
import DailyPerformancePage from "./components/DailyPerformancePage";

const GROUP_ORDER = [
  "Student",
  "Club Director",
  "Professor",
  "Campus Police",
  "Guidance Counselor",
  "Janitor",
  "Librarian",
  "Control",
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

const METRIC_OPTIONS = [
  { value: "during_followers_gained", label: "Followers gained" },
  { value: "during_total_hours_streamed", label: "Hours streamed" },
  { value: "during_weighted_average_viewers", label: "Avg viewers" },
  { value: "during_total_hours_watched", label: "Hours watched" },
  { value: "during_peak_viewers", label: "Peak viewers" },
];

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

function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "No baseline";
  return `${number >= 0 ? "+" : ""}${number.toFixed(1)}%`;
}

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  allLabel = "All",
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () =>
      document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const selectedLabel =
    selected.length === options.length
      ? `${allLabel} (${options.length})`
      : selected.length === 0
        ? "None"
        : selected.length === 1
          ? selected[0]
          : `${selected.length} selected`;

  function toggleOption(option) {
    if (selected.includes(option)) {
      onChange(selected.filter((item) => item !== option));
    } else {
      onChange([...selected, option]);
    }
  }

  return (
    <div className="dropdown" ref={wrapperRef}>
      <button
        className="dropdown-trigger"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          <small>{label}</small>
          <strong>{selectedLabel}</strong>
        </span>
        <span className="chevron">⌄</span>
      </button>

      {open && (
        <div className="dropdown-menu">
          <div className="dropdown-actions">
            <button type="button" onClick={() => onChange(options)}>
              Select all
            </button>
            <button type="button" onClick={() => onChange([])}>
              Clear
            </button>
          </div>

          {options.map((option) => (
            <label className="dropdown-option" key={option}>
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() => toggleOption(option)}
              />
              <span
                className="option-dot"
                style={{
                  background: GROUP_COLORS[option] || "#8b98a8",
                }}
              />
              {option}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function SingleSelectDropdown({ label, value, options, onChange }) {
  return (
    <label className="single-select">
      <small>{label}</small>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function KpiCard({ icon, label, value, note, accent }) {
  return (
    <article className="kpi-card">
      <div className="kpi-icon" style={{ color: accent }}>
        {icon}
      </div>
      <div className="kpi-content">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip">
      {label !== undefined && <strong>{label}</strong>}
      {payload.map((entry) => (
        <div key={`${entry.dataKey}-${entry.name}`}>
          <span
            className="tooltip-dot"
            style={{ background: entry.color }}
          />
          {entry.name}: {formatNumber(entry.value)}
        </div>
      ))}
    </div>
  );
}


function ScatterTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="chart-tooltip scatter-tooltip">
      <strong>{point.streamer}</strong>
      <div>{point.group}</div>
      <div>Hours streamed: {formatNumber(point.hours, 1)}</div>
      <div>Followers gained: {formatNumber(point.followers, 0)}</div>
    </div>
  );
}

function App() {
  const [summary, setSummary] = useState([]);
  const [daily, setDaily] = useState([]);
  const [streamerDaily, setStreamerDaily] = useState([]);
  const [eventStreams, setEventStreams] = useState([]);
  const [groupSummary, setGroupSummary] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [selectedSizeTiers, setSelectedSizeTiers] = useState([]);
  const [selectedDays, setSelectedDays] = useState([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [metric, setMetric] = useState("during_followers_gained");
  const [activeView, setActiveView] = useState("overview");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activePage, setActivePage] = useState("overview");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const paths = [
          "/data/json/streamer_summary.json",
          "/data/json/event_daily_summary.json",
          "/data/json/streamer_daily_summary.json",
          "/data/json/event_streams.json",
          "/data/json/group_summary.json",
          "/data/json/dashboard_metadata.json",
        ];

        const responses = await Promise.all(paths.map((path) => fetch(path)));

        for (const response of responses) {
          if (!response.ok) {
            throw new Error(
              `Could not load ${response.url}. HTTP ${response.status}`
            );
          }
        }

        const [summaryData, dailyData, streamerDailyData, eventStreamsData, groupData, metadataData] = await Promise.all(
          responses.map((response) => response.json())
        );

        const lastModified =
          responses[5].headers.get("last-modified") ||
          responses[0].headers.get("last-modified") ||
          "";

        setSummary(Array.isArray(summaryData) ? summaryData : []);
        setDaily(Array.isArray(dailyData) ? dailyData : []);
        setStreamerDaily(Array.isArray(streamerDailyData) ? streamerDailyData : []);
        setEventStreams(Array.isArray(eventStreamsData) ? eventStreamsData : []);
        setGroupSummary(Array.isArray(groupData) ? groupData : []);
        setMetadata(metadataData || null);
        setUpdatedAt(
          lastModified
            ? new Date(lastModified).toLocaleString(undefined, {
                timeZone: "America/Chicago",
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              }) + " CT"
            : ""
        );

        const groups = GROUP_ORDER.filter((group) =>
          summaryData.some((row) => row.group === group)
        );

        const extraGroups = [
          ...new Set(summaryData.map((row) => row.group).filter(Boolean)),
        ].filter((group) => !groups.includes(group));

        setSelectedGroups([...groups, ...extraGroups]);

        const sizeTierOrder = metadataData?.filters?.size_tiers || [];
        const matchedSizeTiers = sizeTierOrder.filter((tier) =>
          summaryData.some((row) => row.size_tier === tier)
        );
        const extraSizeTiers = [
          ...new Set(summaryData.map((row) => row.size_tier).filter(Boolean)),
        ].filter((tier) => !matchedSizeTiers.includes(tier));

        setSelectedSizeTiers([...matchedSizeTiers, ...extraSizeTiers]);

        const days = [
          ...new Set(
            dailyData
              .map((row) => valueOf(row, "event_day", "stream_date"))
              .filter(Boolean)
          ),
        ].sort((a, b) => String(a).localeCompare(String(b), undefined, {
          numeric: true,
        }));

        setSelectedDays(days);
      } catch (loadError) {
        console.error(loadError);
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const availableGroups = useMemo(() => {
    const found = [
      ...new Set(summary.map((row) => row.group).filter(Boolean)),
    ];

    return [
      ...GROUP_ORDER.filter((group) => found.includes(group)),
      ...found.filter((group) => !GROUP_ORDER.includes(group)),
    ];
  }, [summary]);

  const availableDays = useMemo(() => {
    return [
      ...new Set(
        daily
          .map((row) => valueOf(row, "event_day", "stream_date"))
          .filter(Boolean)
      ),
    ].sort((a, b) =>
      String(a).localeCompare(String(b), undefined, { numeric: true })
    );
  }, [daily]);

  const availableSizeTiers = useMemo(() => {
    const found = [
      ...new Set(summary.map((row) => valueOf(row, "size_tier")).filter(Boolean)),
    ];

    const ordered = [
      ...(metadata?.filters?.size_tiers || []),
      ...found.filter((tier) => !(metadata?.filters?.size_tiers || []).includes(tier)),
    ];

    return ordered.filter((tier, index, list) => list.indexOf(tier) === index);
  }, [summary, metadata]);

  const filteredSummary = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return summary.filter((row) => {
      const groupMatches = selectedGroups.includes(row.group);
      const sizeTierMatches = selectedSizeTiers.includes(row.size_tier);
      const searchMatches =
        !normalizedSearch ||
        nameOf(row).toLowerCase().includes(normalizedSearch) ||
        String(row.streamer || "").toLowerCase().includes(normalizedSearch);

      return groupMatches && sizeTierMatches && searchMatches;
    });
  }, [summary, selectedGroups, selectedSizeTiers, search]);

  const filteredDaily = useMemo(() => {
    return daily.filter((row) => {
      const day = valueOf(row, "event_day", "stream_date");
      return selectedGroups.includes(row.group);
    });
  }, [daily, selectedGroups, selectedDays]);

  const totals = useMemo(() => {
    const result = filteredSummary.reduce(
      (accumulator, row) => {
        accumulator.streamers += 1;
        accumulator.hours += numberOf(
          row,
          "during_total_hours_streamed"
        );
        accumulator.followers += numberOf(
          row,
          "during_followers_gained"
        );
        accumulator.watchHours += numberOf(
          row,
          "during_total_hours_watched"
        );
        accumulator.weightedViewerNumerator +=
          numberOf(row, "during_weighted_average_viewers", "during_average_viewers") *
          Math.max(numberOf(row, "during_total_hours_streamed"), 0);
        accumulator.viewerWeight += Math.max(
          numberOf(row, "during_total_hours_streamed"),
          0
        );
        accumulator.peak = Math.max(
          accumulator.peak,
          numberOf(row, "during_peak_viewers")
        );
        return accumulator;
      },
      {
        streamers: 0,
        hours: 0,
        followers: 0,
        watchHours: 0,
        weightedViewerNumerator: 0,
        viewerWeight: 0,
        peak: 0,
      }
    );

    result.averageViewers =
      result.viewerWeight > 0
        ? result.weightedViewerNumerator / result.viewerWeight
        : 0;

    return result;
  }, [filteredSummary]);

  const groupNotes = useMemo(() => {
    return selectedGroups
      .map((group) => {
        const rows = filteredSummary.filter((row) => row.group === group);
        return {
          group,
          streamers: rows.length,
          hours: rows.reduce(
            (sum, row) =>
              sum + numberOf(row, "during_total_hours_streamed"),
            0
          ),
          followers: rows.reduce(
            (sum, row) =>
              sum + numberOf(row, "during_followers_gained"),
            0
          ),
        };
      })
      .filter((row) => row.streamers > 0);
  }, [filteredSummary, selectedGroups]);

  const dailyChartData = useMemo(() => {
    const dayMap = new Map();

    for (const row of filteredDaily) {
      const rawDay = String(valueOf(row, "event_day", "stream_date") || "").trim();
      const dayLabel = rawDay.startsWith("Day") ? rawDay : `Day ${rawDay}`;

      if (!dayMap.has(dayLabel)) {
        dayMap.set(dayLabel, { day: dayLabel });
      }

      const current = dayMap.get(dayLabel);
      current[row.group] =
        (current[row.group] || 0) + numberOf(row, "followers_gained");
    }

    return [...dayMap.values()].sort((a, b) =>
      a.day.localeCompare(b.day, undefined, { numeric: true })
    );
  }, [filteredDaily]);

  const scatterData = useMemo(() => {
    return filteredSummary
      .map((row) => ({
        streamer: nameOf(row),
        group: row.group,
        hours: numberOf(row, "during_total_hours_streamed"),
        followers: numberOf(row, "during_followers_gained"),
      }))
      .filter((row) => row.hours > 0 && row.followers > 0);
  }, [filteredSummary]);

  const topRows = useMemo(() => {
    return [...filteredSummary]
      .sort((a, b) => numberOf(b, metric) - numberOf(a, metric))
      .slice(0, 10);
  }, [filteredSummary, metric]);

  const peakStream = useMemo(() => {
    const candidates = eventStreams.filter((row) =>
      selectedGroups.includes(row.group)
    );

    if (!candidates.length) return null;

    return candidates.reduce((best, row) =>
      numberOf(row, "peak_viewers") > numberOf(best, "peak_viewers")
        ? row
        : best,
      candidates[0]
    );
  }, [eventStreams, selectedGroups]);

  const peakStreamNote = useMemo(() => {
    if (!peakStream) return "Highest individual peak";

    const eventDay = valueOf(peakStream, "event_day");
    const dateRaw = valueOf(peakStream, "stream_date", "date");
    const parsedDate = new Date(dateRaw);
    const dateLabel = !Number.isNaN(parsedDate.getTime())
      ? parsedDate.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })
      : String(dateRaw || "Unknown");

    return `Top: ${nameOf(peakStream)} · ${eventDay || dateLabel}`;
  }, [peakStream]);

  const leaderboard = useMemo(() => {
    return [...filteredSummary]
      .sort(
        (a, b) =>
          numberOf(b, "during_followers_gained") -
          numberOf(a, "during_followers_gained")
      )
      .slice(0, 12);
  }, [filteredSummary]);

  const comparisonRows = useMemo(() => {
    const source = selectedGroups
      .map((group) => {
        const direct = groupSummary.find((row) => row.group === group);
        if (direct) return direct;

        const rows = filteredSummary.filter((row) => row.group === group);
        if (!rows.length) return null;

        return {
          group,
          total_followers_gained: rows.reduce(
            (sum, row) => sum + numberOf(row, "during_followers_gained"),
            0
          ),
          total_event_hours: rows.reduce(
            (sum, row) =>
              sum + numberOf(row, "during_total_hours_streamed"),
            0
          ),
          median_during_average_viewers:
            rows.reduce(
              (sum, row) =>
                sum +
                numberOf(
                  row,
                  "during_weighted_average_viewers",
                  "during_average_viewers"
                ),
              0
            ) / rows.length,
          total_hours_watched: rows.reduce(
            (sum, row) =>
              sum + numberOf(row, "during_total_hours_watched"),
            0
          ),
        };
      })
      .filter(Boolean);

    return source.slice(0, 4);
  }, [groupSummary, filteredSummary, selectedGroups]);

  function resetFilters() {
    setSelectedGroups(availableGroups);
    setSelectedSizeTiers(availableSizeTiers);
    setMetric("during_followers_gained");
    setSearch("");
  }

  if (loading) {
    return <div className="screen-message">Loading dashboard…</div>;
  }

  if (error) {
    return (
      <div className="screen-message error-screen">
        <h1>Dashboard error</h1>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">
          <img src="/logo.png" alt="Streamer University logo" className="brand-logo" />
          <div>
            <strong>Streamer</strong>
            <span>University</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeView === "overview" ? "active" : ""}`}
            type="button"
            onClick={() => setActiveView("overview")}
          >
            <span>⌂</span> Overview
          </button>
          <button
            className={`nav-item ${activeView === "leaderboard" ? "active" : ""}`}
            type="button"
            onClick={() => setActiveView("leaderboard")}
          >
            <span>♛</span> Leaderboard
          </button>
          <button
            className={`nav-item ${activeView === "streamers" ? "active" : ""}`}
            type="button"
            onClick={() => setActiveView("streamers")}
          >
            <span>♙</span> Streamers
          </button>
          <button
            className={`nav-item ${activeView === "daily" ? "active" : ""}`}
            type="button"
            onClick={() => setActiveView("daily")}
          >
            <span>↗</span> Daily Performance
          </button>
        </nav>

        <div className="sidebar-groups">
          <h3>Groups</h3>
          {availableGroups.map((group) => (
            <div key={group}>
              <span
                style={{
                  background: GROUP_COLORS[group] || "#8b98a8",
                }}
              />
              {group}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          Streamer University
          <br />
          Analytics Project
          <br />
          v1.0
        </div>
      </aside>

      <main className="main-content">
        {activeView === "leaderboard" ? (
          <LeaderboardPage streamers={summary} groups={availableGroups} />
        ) : activeView === "streamers" ? (
          <StreamersPage
            streamers={summary}
            groups={availableGroups}
            streamerDaily={streamerDaily}
            eventStreams={eventStreams}
          />
        ) : activeView === "daily" ? (
          <DailyPerformancePage
            groups={availableGroups}
            streamerSummary={summary}
          />
        ) : (
          <>
            <header className="top-header">
          <div>
            <h1>Event Overview</h1>
          </div>

          <div className="header-right">
            <span>
              {updatedAt
                ? `Last updated ${updatedAt}`
                : "Last updated from generated JSON"}
            </span>
            <div className="status-pill">● Data loaded</div>
          </div>
        </header>

        <section className="filter-bar">
          <MultiSelectDropdown
            label="Group"
            options={availableGroups}
            selected={selectedGroups}
            onChange={setSelectedGroups}
          />

          <MultiSelectDropdown
            label="Streamer Size"
            options={availableSizeTiers}
            selected={selectedSizeTiers}
            onChange={setSelectedSizeTiers}
          />

          <button className="reset-button" type="button" onClick={resetFilters}>
            Reset Filters
          </button>
        </section>

        <section className="kpi-grid">
          <KpiCard
            icon="♟"
            label="Total streamers"
            value={formatNumber(totals.streamers)}
            accent="var(--accent-gold)"
            note={groupNotes
              .slice(0, 3)
              .map((row) => `${row.group.slice(0, 4)}: ${row.streamers}`)
              .join(" · ")}
          />
          <KpiCard
            icon="◷"
            label="Hours streamed"
            value={formatCompact(totals.hours)}
            accent="var(--accent-gold)"
            note={groupNotes
              .slice(0, 3)
              .map((row) => `${row.group.slice(0, 4)}: ${formatCompact(row.hours)}`)
              .join(" · ")}
          />
          <KpiCard
            icon="↗"
            label="Avg viewers"
            value={formatCompact(totals.averageViewers)}
            accent="var(--accent-burgundy)"
            note="Weighted by hours streamed"
          />
          <KpiCard
            icon="◷"
            label="Hours watched"
            value={formatCompact(totals.watchHours)}
            accent="var(--accent-gold)"
            note="Selected groups"
          />
          <KpiCard
            icon="♥"
            label="Followers gained"
            value={formatCompactWhole(totals.followers)}
            accent="var(--accent-burgundy)"
            note="Selected groups"
          />
          <KpiCard
            icon="↗"
            label="Peak viewers"
            value={formatCompact(totals.peak)}
            accent="var(--accent-gold)"
            note={peakStreamNote}
          />
        </section>

        <section className="dashboard-grid">
          <article className="panel line-panel">
            <div className="panel-heading">
              <h2>Followers gained over time</h2>
              <span>By event day and group</span>
            </div>
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyChartData} margin={{ top: 12, right: 10, left: 0, bottom: 48 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="day"
                    stroke="var(--text-secondary)"
                    tick={{ fontSize: 11 }}
                    label={{ value: "Event day", position: "insideBottom", offset: 0, fill: "var(--text-secondary)", fontSize: 11 }}
                  />
                  <YAxis
                    stroke="var(--text-secondary)"
                    tick={{ fontSize: 11 }}
                    tickFormatter={formatCompactWhole}
                    label={{ value: "Followers gained", angle: -90, position: "insideLeft", fill: "var(--text-secondary)", fontSize: 11 }}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  {selectedGroups.map((group) => (
                    <Line
                      key={group}
                      type="monotone"
                      dataKey={group}
                      name={group}
                      stroke={GROUP_COLORS[group] || "#8b98a8"}
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="panel scatter-panel">
            <div className="panel-heading">
              <h2>Hours streamed vs followers gained</h2>
              <span>Each dot is a streamer</span>
            </div>
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 12, right: 10, left: 0, bottom: 48 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="hours"
                    name="Hours streamed"
                    stroke="var(--text-secondary)"
                    tick={{ fontSize: 11 }}
                    tickFormatter={formatNumber}
                    label={{ value: "Hours streamed", position: "insideBottom", offset: 0, fill: "var(--text-secondary)", fontSize: 11 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="followers"
                    name="Followers gained"
                    stroke="var(--text-secondary)"
                    tick={{ fontSize: 11 }}
                    tickFormatter={formatCompactWhole}
                    label={{ value: "Followers gained", angle: -90, position: "insideLeft", fill: "var(--text-secondary)", fontSize: 11 }}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    content={<ScatterTooltip />}
                  />
                  {selectedGroups.map((group) => (
                    <Scatter
                      key={group}
                      name={group}
                      data={scatterData.filter((row) => row.group === group)}
                      fill={GROUP_COLORS[group] || "var(--text-secondary)"}
                    />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="panel top-panel">
            <div className="panel-heading top-panel-heading">
              <div>
                <h2>
                  Top 10 by{" "}
                  {METRIC_OPTIONS.find((item) => item.value === metric)?.label}
                </h2>
                <span>Current filters</span>
              </div>

              <label className="metric-select">
                <span>Ranking metric</span>
                <select
                  value={metric}
                  onChange={(event) => setMetric(event.target.value)}
                >
                  {METRIC_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="horizontal-ranking">
              {topRows.map((row, index) => {
                const value = numberOf(row, metric);
                const max = Math.max(...topRows.map((item) => numberOf(item, metric)), 1);

                return (
                  <div className="ranking-row" key={row.streamer}>
                    <span className="rank-number">{index + 1}.</span>
                    <span className="rank-name">{nameOf(row)}</span>
                    <div className="rank-track">
                      <div
                        className="rank-fill"
                        style={{
                          width: `${Math.max((value / max) * 100, 3)}%`,
                          background: GROUP_COLORS[row.group] || "#8b98a8",
                        }}
                      />
                    </div>
                    <strong>{formatCompact(value)}</strong>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="panel leaderboard-panel">
            <div className="panel-heading leaderboard-heading">
              <div>
                <h2>Streamer leaderboard</h2>
                <span>Sorted by followers gained</span>
              </div>
            </div>

            <div className="leaderboard-table-wrap">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Streamer</th>
                    <th>Group</th>
                    <th>Streams</th>
                    <th>Hours streamed</th>
                    <th>Avg viewers</th>
                    <th>Peak viewers</th>
                    <th>Hours watched</th>
                    <th>Followers gained</th>
                    <th>Viewer growth</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row, index) => (
                    <tr key={row.streamer}>
                      <td>{index + 1}</td>
                      <td className="streamer-name">{nameOf(row)}</td>
                      <td
                        className="group-cell"
                        style={{ color: GROUP_COLORS[row.group] || "#8b98a8" }}
                      >
                        {row.group}
                      </td>
                      <td>{formatNumber(numberOf(row, "during_broadcasts"))}</td>
                      <td>{formatNumber(numberOf(row, "during_total_hours_streamed"), 1)}</td>
                      <td>{formatNumber(numberOf(row, "during_weighted_average_viewers", "during_average_viewers"))}</td>
                      <td>{formatNumber(numberOf(row, "during_peak_viewers"))}</td>
                      <td>{formatCompact(numberOf(row, "during_total_hours_watched"))}</td>
                      <td>{formatNumber(numberOf(row, "during_followers_gained"))}</td>
                      <td>{formatPercent(valueOf(row, "viewer_growth_pct"))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="panel comparison-panel">
            <div className="panel-heading">
              <h2>Group comparison</h2>
              <span>Totals and averages</span>
            </div>
            <div className="comparison-table-wrap">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    {comparisonRows.map((row) => (
                      <th key={row.group}>{row.group}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Followers gained</td>
                    {comparisonRows.map((row) => (
                      <td key={row.group}>{formatCompactWhole(numberOf(row, "total_followers_gained"))}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>Hours streamed</td>
                    {comparisonRows.map((row) => (
                      <td key={row.group}>{formatNumber(numberOf(row, "total_event_hours"), 1)}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>Avg viewers</td>
                    {comparisonRows.map((row) => (
                      <td key={row.group}>{formatCompact(numberOf(row, "median_during_average_viewers"))}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>Hours watched</td>
                    {comparisonRows.map((row) => (
                      <td key={row.group}>{formatCompact(numberOf(row, "total_hours_watched"))}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </article>

        </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
