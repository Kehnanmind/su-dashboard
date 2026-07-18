import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./DailyPerformancePage.css";

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

const METRICS = [
  {
    value: "followers_gained",
    label: "Followers gained",
    format: "number",
  },
  {
    value: "hours_streamed",
    label: "Hours streamed",
    format: "hours",
  },
  {
    value: "hours_watched",
    label: "Hours watched",
    format: "compact",
  },
  {
    value: "average_viewers",
    label: "Average viewers",
    format: "number",
  },
  {
    value: "peak_viewers",
    label: "Peak viewers",
    format: "number",
  },
  {
    value: "active_streamers",
    label: "Active streamers",
    format: "number",
  },
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

function metricValue(row, metric) {
  const aliases = {
    followers_gained: [
      "followers_gained",
      "daily_followers_gained",
      "during_followers_gained",
    ],
    hours_streamed: [
      "hours_streamed",
      "daily_hours_streamed",
      "total_hours_streamed",
    ],
    hours_watched: [
      "hours_watched",
      "daily_hours_watched",
      "total_hours_watched",
    ],
    average_viewers: [
      "average_viewers",
      "weighted_average_viewers",
      "avg_viewers",
    ],
    peak_viewers: ["peak_viewers", "daily_peak_viewers"],
    active_streamers: [
      "active_streamers",
      "streamers_live",
      "unique_streamers",
    ],
    broadcasts: ["broadcasts", "streams", "total_streams"],
  };

  return numberOf(row, ...(aliases[metric] || [metric]));
}

function normalizeEventDay(eventDay) {
  if (eventDay === null || eventDay === undefined) return null;

  const raw = String(eventDay).trim();
  return raw.replace(/^Day\s*/i, "");
}

function dateLabel(row) {
  const raw = valueOf(row, "date", "stream_date", "event_date", "day");
  if (raw === null) return "Unknown";

  const eventDay = normalizeEventDay(valueOf(row, "event_day"));
  if (eventDay !== null && eventDay !== "") {
    return `Day ${eventDay}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

  return String(raw);
}

function fullDateLabel(row) {
  const raw = valueOf(row, "date", "stream_date", "event_date", "day");
  const eventDay = normalizeEventDay(valueOf(row, "event_day"));

  if (raw !== null) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      const date = parsed.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      return eventDay !== null && eventDay !== ""
        ? `Day ${eventDay} · ${date}`
        : date;
    }
  }

  return eventDay !== null && eventDay !== ""
    ? `Day ${eventDay}`
    : String(raw || "Unknown");
}

function formatMetric(value, type, metricKey) {
  if (metricKey === "followers_gained") return formatNumber(value);
  if (type === "hours") return formatNumber(value, 1);
  if (type === "compact") return formatCompact(value);
  return formatTooltipValue(value);
}

function formatTooltipValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  const decimals = Number.isInteger(number) ? 0 : 2;
  return formatNumber(number, decimals);
}

function CustomTooltip({ active, payload, label, metric }) {
  if (!active || !payload?.length) return null;

  const metricConfig = METRICS.find((item) => item.value === metric);

  return (
    <div className="daily-chart-tooltip">
      <strong>{label}</strong>
      {payload.map((entry) => (
        <div key={`${entry.name}-${entry.dataKey}`}>
          <i style={{ background: entry.color }} />
          <span>{entry.name}</span>
          <b>{formatMetric(entry.value, metricConfig?.format, metric)}</b>
        </div>
      ))}
    </div>
  );
}

function DailyPerformancePage({
  groups = [],
  streamerSummary = [],
}) {
  const [eventDaily, setEventDaily] = useState([]);
  const [streamerDaily, setStreamerDaily] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [metric, setMetric] = useState("followers_gained");
  const [group, setGroup] = useState("All");
  const [streamer, setStreamer] = useState("All");
  const [search, setSearch] = useState("");
  const [tableSortKey, setTableSortKey] = useState("followers_gained");
  const [tableSortDirection, setTableSortDirection] = useState("desc");

  useEffect(() => {
    async function loadDailyData() {
      try {
        const [eventResponse, streamerResponse] = await Promise.all([
          fetch("/data/json/event_daily_summary.json"),
          fetch("/data/json/streamer_daily_summary.json"),
        ]);

        if (!eventResponse.ok || !streamerResponse.ok) {
          throw new Error("Could not load the daily performance JSON files.");
        }

        const [eventData, streamerData] = await Promise.all([
          eventResponse.json(),
          streamerResponse.json(),
        ]);

        setEventDaily(Array.isArray(eventData) ? eventData : []);
        setStreamerDaily(Array.isArray(streamerData) ? streamerData : []);
      } catch (error) {
        console.error(error);
        setLoadError(error.message);
      } finally {
        setLoading(false);
      }
    }

    loadDailyData();
  }, []);

  const streamerNames = useMemo(() => {
    const found = new Map();

    for (const row of streamerSummary) {
      found.set(row.streamer, nameOf(row));
    }

    for (const row of streamerDaily) {
      const key = valueOf(row, "streamer", "channel");
      if (key && !found.has(key)) {
        found.set(key, nameOf(row));
      }
    }

    return [...found.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [streamerSummary, streamerDaily]);

  const filteredStreamerDaily = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return streamerDaily.filter((row) => {
      const groupMatches = group === "All" || row.group === group;
      const streamerKey = valueOf(row, "streamer", "channel");
      const streamerMatches =
        streamer === "All" || streamerKey === streamer;

      const searchMatches =
        !normalizedSearch ||
        nameOf(row).toLowerCase().includes(normalizedSearch) ||
        String(streamerKey || "").toLowerCase().includes(normalizedSearch);

      return groupMatches && streamerMatches && searchMatches;
    });
  }, [streamerDaily, group, streamer, search]);

  const eventChartData = useMemo(() => {
    if (group === "All" && streamer === "All" && !search.trim()) {
      const byDay = new Map();

      for (const row of eventDaily) {
        const key = String(
          valueOf(row, "event_day", "date", "stream_date", "event_date")
        );

        if (!byDay.has(key)) {
          byDay.set(key, {
            label: dateLabel(row),
            fullLabel: fullDateLabel(row),
            rawDay: valueOf(
              row,
              "event_day",
              "date",
              "stream_date",
              "event_date"
            ),
            followers_gained: 0,
            hours_streamed: 0,
            hours_watched: 0,
            peak_viewers: 0,
            viewerNumerator: 0,
            viewerWeight: 0,
            activeStreamers: 0,
          });
        }

        const current = byDay.get(key);
        const hours = metricValue(row, "hours_streamed");
        const average = metricValue(row, "average_viewers");

        current.followers_gained += metricValue(row, "followers_gained");
        current.hours_streamed += hours;
        current.hours_watched += metricValue(row, "hours_watched");
        current.peak_viewers = Math.max(
          current.peak_viewers,
          metricValue(row, "peak_viewers")
        );
        current.viewerNumerator += average * Math.max(hours, 1);
        current.viewerWeight += Math.max(hours, 1);
        current.activeStreamers += metricValue(row, "active_streamers");
      }

      return [...byDay.values()]
        .map((row) => ({
          label: row.label,
          fullLabel: row.fullLabel,
          rawDay: row.rawDay,
          followers_gained: row.followers_gained,
          hours_streamed: row.hours_streamed,
          hours_watched: row.hours_watched,
          average_viewers:
            row.viewerWeight > 0
              ? row.viewerNumerator / row.viewerWeight
              : 0,
          peak_viewers: row.peak_viewers,
          active_streamers: row.activeStreamers,
        }))
        .sort((a, b) =>
          String(a.rawDay).localeCompare(String(b.rawDay), undefined, {
            numeric: true,
          })
        );
    }

    const byDay = new Map();

    for (const row of filteredStreamerDaily) {
      const key = String(
        valueOf(row, "event_day", "date", "stream_date", "event_date")
      );

      if (!byDay.has(key)) {
        byDay.set(key, {
          label: dateLabel(row),
          fullLabel: fullDateLabel(row),
          rawDay: valueOf(
            row,
            "event_day",
            "date",
            "stream_date",
            "event_date"
          ),
          followers_gained: 0,
          hours_streamed: 0,
          hours_watched: 0,
          peak_viewers: 0,
          viewerNumerator: 0,
          viewerWeight: 0,
          activeSet: new Set(),
        });
      }

      const current = byDay.get(key);
      const hours = metricValue(row, "hours_streamed");
      const average = metricValue(row, "average_viewers");

      current.followers_gained += metricValue(row, "followers_gained");
      current.hours_streamed += hours;
      current.hours_watched += metricValue(row, "hours_watched");
      current.peak_viewers = Math.max(
        current.peak_viewers,
        metricValue(row, "peak_viewers")
      );
      current.viewerNumerator += average * Math.max(hours, 1);
      current.viewerWeight += Math.max(hours, 1);
      current.activeSet.add(valueOf(row, "streamer", "channel", "display_name"));
    }

    return [...byDay.values()]
      .map((row) => ({
        label: row.label,
        fullLabel: row.fullLabel,
        rawDay: row.rawDay,
        followers_gained: row.followers_gained,
        hours_streamed: row.hours_streamed,
        hours_watched: row.hours_watched,
        average_viewers:
          row.viewerWeight > 0
            ? row.viewerNumerator / row.viewerWeight
            : 0,
        peak_viewers: row.peak_viewers,
        active_streamers: row.activeSet.size,
      }))
      .sort((a, b) =>
        String(a.rawDay).localeCompare(String(b.rawDay), undefined, {
          numeric: true,
        })
      );
  }, [
    eventDaily,
    filteredStreamerDaily,
    group,
    streamer,
    search,
  ]);

  const topStreamers = useMemo(() => {
    const totals = new Map();

    for (const row of filteredStreamerDaily) {
      const key = valueOf(row, "streamer", "channel", "display_name");
      if (!key) continue;

      if (!totals.has(key)) {
        totals.set(key, {
          streamer: key,
          displayName: nameOf(row),
          group: row.group,
          total: 0,
        });
      }

      totals.get(key).total += metricValue(row, metric);
    }

    return [...totals.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [filteredStreamerDaily, metric]);

  const tableRows = useMemo(() => {
    return [...filteredStreamerDaily].sort((a, b) => {
      if (tableSortKey === "date") {
        const aDate = String(
          valueOf(a, "event_day", "date", "stream_date", "event_date")
        );
        const bDate = String(
          valueOf(b, "event_day", "date", "stream_date", "event_date")
        );

        return tableSortDirection === "asc"
          ? aDate.localeCompare(bDate, undefined, { numeric: true })
          : bDate.localeCompare(aDate, undefined, { numeric: true });
      }

      if (tableSortKey === "streamer") {
        const comparison = nameOf(a).localeCompare(nameOf(b));
        return tableSortDirection === "asc" ? comparison : -comparison;
      }

      const difference =
        metricValue(a, tableSortKey) - metricValue(b, tableSortKey);

      return tableSortDirection === "asc" ? difference : -difference;
    });
  }, [filteredStreamerDaily, tableSortKey, tableSortDirection]);

  const totals = useMemo(() => {
    return eventChartData.reduce(
      (result, row) => {
        result.followers += row.followers_gained;
        result.hours += row.hours_streamed;
        result.watchHours += row.hours_watched;
        result.peak = Math.max(result.peak, row.peak_viewers);
        result.activePeak = Math.max(
          result.activePeak,
          row.active_streamers
        );
        return result;
      },
      {
        followers: 0,
        hours: 0,
        watchHours: 0,
        peak: 0,
        activePeak: 0,
      }
    );
  }, [eventChartData]);

  const metricConfig =
    METRICS.find((item) => item.value === metric) || METRICS[0];

  const metricColor =
    metricConfig.format === "hours" ? "var(--accent-gold)" : "var(--accent-burgundy)";

  function changeTableSort(nextKey) {
    if (nextKey === tableSortKey) {
      setTableSortDirection((current) =>
        current === "asc" ? "desc" : "asc"
      );
      return;
    }

    setTableSortKey(nextKey);
    setTableSortDirection(
      nextKey === "date" || nextKey === "streamer" ? "asc" : "desc"
    );
  }

  function sortMark(key) {
    if (tableSortKey !== key) return "";
    return tableSortDirection === "asc" ? " ↑" : " ↓";
  }

  function resetFilters() {
    setMetric("followers_gained");
    setGroup("All");
    setStreamer("All");
    setSearch("");
    setTableSortKey("followers_gained");
    setTableSortDirection("desc");
  }

  if (loading) {
    return (
      <section className="daily-page">
        <div className="daily-state">Loading daily performance…</div>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="daily-page">
        <div className="daily-state daily-error">
          <h2>Daily performance could not load</h2>
          <p>{loadError}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="daily-page">
      <header className="daily-page-heading">
        <div>
          <h2>Daily Performance</h2>
          <p>
            Follow how Streamer University activity, audiences and follower
            growth changed from day to day.
          </p>
        </div>
      </header>

      <section className="daily-filter-bar">
        <label className="daily-control">
          <small>Metric</small>
          <select
            value={metric}
            onChange={(event) => setMetric(event.target.value)}
          >
            {METRICS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="daily-control">
          <small>Group</small>
          <select
            value={group}
            onChange={(event) => setGroup(event.target.value)}
          >
            <option value="All">All groups</option>
            {groups.map((groupName) => (
              <option value={groupName} key={groupName}>
                {groupName}
              </option>
            ))}
          </select>
        </label>

        <label className="daily-control daily-search">
          <small>Search streamer</small>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or handle..."
          />
        </label>

        <button
          type="button"
          className="daily-reset"
          onClick={resetFilters}
        >
          Reset filters
        </button>
      </section>

      <section className="daily-kpis">
        <article>
          <span>Followers gained</span>
          <strong>{formatCompactWhole(totals.followers)}</strong>
          <small>Current selection</small>
        </article>
        <article>
          <span>Hours streamed</span>
          <strong>{formatCompact(totals.hours)}</strong>
          <small>Current selection</small>
        </article>
        <article>
          <span>Hours watched</span>
          <strong>{formatCompact(totals.watchHours)}</strong>
          <small>Current selection</small>
        </article>
        <article>
          <span>Highest viewer peak</span>
          <strong>{formatCompact(totals.peak)}</strong>
          <small>Any selected day</small>
        </article>
        <article>
          <span>Most active in one day</span>
          <strong>{formatNumber(totals.activePeak)}</strong>
          <small>Streamers live</small>
        </article>
      </section>

      <section className="daily-dashboard-grid">
        <article className="daily-panel daily-trend-panel">
          <div className="daily-panel-heading">
            <div>
              <h3>{metricConfig.label} by day</h3>
              <span>
                {group === "All" ? "All groups" : group}
                {streamer !== "All"
                  ? ` · ${
                      streamerNames.find((item) => item.value === streamer)
                        ?.label || streamer
                    }`
                  : ""}
              </span>
            </div>
          </div>

          <div className="daily-chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={eventChartData}>
                <CartesianGrid
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="label"
                  stroke="var(--text-secondary)"
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  stroke="var(--text-secondary)"
                  tick={{ fontSize: 11 }}
                  tickFormatter={
                    metricConfig.format === "hours"
                      ? formatCompact
                      : formatCompact
                  }
                />
                <Tooltip
                  content={
                    <CustomTooltip metric={metric} />
                  }
                  formatter={(value) => formatTooltipValue(value)}
                />
                <Line
                  type="monotone"
                  dataKey={metric}
                  name={metricConfig.label}
                  stroke={metricColor}
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="daily-panel daily-top-panel">
          <div className="daily-panel-heading">
            <div>
              <h3>Top streamers</h3>
              <span>By total {metricConfig.label.toLowerCase()}</span>
            </div>
          </div>

          <div className="daily-chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topStreamers}
                layout="vertical"
                margin={{ left: 18, right: 18 }}
              >
                <CartesianGrid
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  stroke="var(--text-secondary)"
                  tick={{ fontSize: 10 }}
                  tickFormatter={formatCompact}
                />
                <YAxis
                  type="category"
                  dataKey="displayName"
                  width={115}
                  stroke="var(--text-secondary)"
                  tick={{ fontSize: 10 }}
                />
                <Tooltip
                  formatter={(value) =>
                    formatMetric(value, metricConfig.format, metric)
                  }
                />
                <Bar
                  dataKey="total"
                  name={metricConfig.label}
                  radius={[0, 4, 4, 0]}
                >
                  {topStreamers.map((row) => (
                    <Cell
                      key={row.streamer}
                      fill={GROUP_COLORS[row.group] || "var(--accent-gold)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="daily-panel daily-activity-panel">
          <div className="daily-panel-heading">
            <div>
              <h3>Daily event activity</h3>
              <span>Hours streamed and active streamers</span>
            </div>
          </div>

          <div className="daily-chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={eventChartData}>
                <CartesianGrid
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="label"
                  stroke="var(--text-secondary)"
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  yAxisId="hours"
                  stroke="var(--text-secondary)"
                  tickFormatter={formatCompact}
                />
                <YAxis
                  yAxisId="streamers"
                  orientation="right"
                  stroke="var(--text-secondary)"
                />
                <Tooltip
                  formatter={(value, name) => [formatTooltipValue(value), name]}
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
                <Legend />
                <Bar
                  yAxisId="hours"
                  dataKey="hours_streamed"
                  name="Hours streamed"
                  fill="var(--accent-gold)"
                  radius={[3, 3, 0, 0]}
                />
                <Line
                  yAxisId="streamers"
                  type="monotone"
                  dataKey="active_streamers"
                  name="Active streamers"
                  stroke="var(--accent-burgundy)"
                  strokeWidth={3}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="daily-panel daily-table-panel">
          <div className="daily-panel-heading">
            <div>
              <h3>Streamer-day detail</h3>
              <span>
                {formatNumber(tableRows.length)} daily records · Click a
                heading to sort
              </span>
            </div>
          </div>

          <div className="daily-table-wrap">
            <table className="daily-table">
              <thead>
                <tr>
                  <th onClick={() => changeTableSort("date")}>
                    Day{sortMark("date")}
                  </th>
                  <th onClick={() => changeTableSort("streamer")}>
                    Streamer{sortMark("streamer")}
                  </th>
                  <th>Group</th>
                  <th onClick={() => changeTableSort("broadcasts")}>
                    Streams{sortMark("broadcasts")}
                  </th>
                  <th onClick={() => changeTableSort("hours_streamed")}>
                    Hours streamed{sortMark("hours_streamed")}
                  </th>
                  <th onClick={() => changeTableSort("average_viewers")}>
                    Avg viewers{sortMark("average_viewers")}
                  </th>
                  <th onClick={() => changeTableSort("peak_viewers")}>
                    Peak viewers{sortMark("peak_viewers")}
                  </th>
                  <th onClick={() => changeTableSort("hours_watched")}>
                    Hours watched{sortMark("hours_watched")}
                  </th>
                  <th onClick={() => changeTableSort("followers_gained")}>
                    Followers gained{sortMark("followers_gained")}
                  </th>
                </tr>
              </thead>

              <tbody>
                {tableRows.map((row, index) => (
                  <tr
                    key={`${valueOf(
                      row,
                      "streamer",
                      "channel",
                      "display_name"
                    )}-${valueOf(
                      row,
                      "event_day",
                      "date",
                      "stream_date"
                    )}-${index}`}
                  >
                    <td>{fullDateLabel(row)}</td>
                    <td className="daily-streamer-name">
                      <strong>{nameOf(row)}</strong>
                      {valueOf(row, "streamer", "channel") && (
                        <small>
                          @{valueOf(row, "streamer", "channel")}
                        </small>
                      )}
                    </td>
                    <td>
                      <span
                        className="daily-group"
                        style={{
                          color:
                            GROUP_COLORS[row.group] || "#a9b7c4",
                        }}
                      >
                        <i
                          style={{
                            background:
                              GROUP_COLORS[row.group] || "#a9b7c4",
                          }}
                        />
                        {row.group || "—"}
                      </span>
                    </td>
                    <td>{formatNumber(metricValue(row, "broadcasts"))}</td>
                    <td>
                      {formatNumber(
                        metricValue(row, "hours_streamed"),
                        1
                      )}
                    </td>
                    <td>
                      {formatNumber(metricValue(row, "average_viewers"))}
                    </td>
                    <td>
                      {formatNumber(metricValue(row, "peak_viewers"))}
                    </td>
                    <td>
                      {formatCompact(metricValue(row, "hours_watched"))}
                    </td>
                    <td>
                      {formatNumber(metricValue(row, "followers_gained"))}
                    </td>
                  </tr>
                ))}

                {tableRows.length === 0 && (
                  <tr>
                    <td colSpan="9" className="daily-empty">
                      No daily records match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </section>
  );
}

export default DailyPerformancePage;
