import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./PostSUStreamerBreakdownPage.css";

function valueOf(row, ...keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return null;
}

function numberOf(row, ...keys) {
  const value = valueOf(row, ...keys);
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value, decimals = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return number.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatCompact(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(number);
}

const SU_START_TIME = new Date("2026-07-15T14:00:00").getTime();
const SU_END_TIME = new Date("2026-07-20T06:00:00").getTime();
const PRE_SU_COLOR = "#efb6bd";
const DURING_SU_COLOR = "#b8cee0";
const POST_SU_COLOR = "#d6a85f";

function viewerScale(value) {
  return Number(value);
}

function formatViewerScaleTick(value) {
  return formatCompact(value);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "-");
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatRangeDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" });
}

function formatTimelineDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "-");
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTimeLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "-");
  return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

function changeFor(value, baseline) {
  if (!Number.isFinite(value) || !Number.isFinite(baseline) || baseline === 0) {
    return { tone: "neutral", icon: "→", label: "No baseline" };
  }

  const percent = ((value - baseline) / Math.abs(baseline)) * 100;
  if (percent === 0) return { tone: "neutral", icon: "→", label: "No change" };

  return {
    tone: percent > 0 ? "positive" : "negative",
    icon: percent > 0 ? "↑" : "↓",
    label: `${Math.abs(percent).toFixed(1)}%`,
  };
}

function changeClass(value, baseline) {
  if (!Number.isFinite(value) || !Number.isFinite(baseline) || baseline === 0) return "neutral";
  if (value > baseline) return "positive";
  if (value < baseline) return "negative";
  return "neutral";
}

function changePercent(value, baseline) {
  if (!Number.isFinite(value) || !Number.isFinite(baseline) || baseline === 0) return "—";
  const percent = ((value - baseline) / Math.abs(baseline)) * 100;
  return `${percent >= 0 ? "+" : ""}${percent.toFixed(1)}%`;
}

function formatOutcome(result) {
  const [audience, activity] = String(result || "No post-SU data")
    .split("/")
    .map((part) => part.trim());

  return activity && activity !== "Active" ? `${audience} / ${activity}` : audience;
}

function tableSortValue(row, key) {
  const fields = {
    pre_average: ["pre_june_average_viewers", "pre_30d_average_viewers", "pre_average_viewers"],
    pre_followers: ["pre_june_followers_gained", "pre_30d_followers_gained", "pre_followers_gained"],
    pre_hours: ["pre_june_hours_streamed", "pre_30d_total_hours_streamed", "pre_total_hours_streamed"],
    during_average: ["during_average_viewers"],
    during_followers: ["during_followers_gained"],
    during_hours: ["during_total_hours_streamed"],
    post_average: ["post_su_average_viewers_weighted", "post_su_average_viewers_simple"],
    post_followers: ["post_su_followers_gained"],
    post_hours: ["post_su_total_hours_streamed"],
  };

  if (key.startsWith("change_")) {
    const metric = key.replace("change_", "post_");
    const value = tableSortValue(row, metric);
    const baseline = tableSortValue(row, `pre_${metric.replace("post_", "")}`);
    if (!Number.isFinite(value) || !Number.isFinite(baseline) || baseline === 0) return Number.NaN;
    return ((value - baseline) / Math.abs(baseline)) * 100;
  }

  return numberOf(row, ...(fields[key] || [key]));
}

function StreamTrendTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  const item = payload[0].payload;
  if (!item) return null;

  return (
    <div className="post-su-stream-tooltip">
      <strong>{item.label}</strong>
      <span>Hours: {formatNumber(item.hours, 1)}</span>
      <span>Avg viewers: {formatNumber(item.average_viewers)}</span>
      <span>Peak viewers: {formatNumber(item.peak_viewers)}</span>
      <span>Followers: {formatNumber(item.followers)}</span>
      {item.stream_url && <small>Click point to open stream</small>}
    </div>
  );
}

function StreamTrendDot({ cx, cy, payload }) {
  if (payload.average_viewers === null) return null;

  const color = payload.isPreSU ? PRE_SU_COLOR : payload.isDuringSU ? DURING_SU_COLOR : POST_SU_COLOR;

  function openStream(event) {
    event.stopPropagation();
    if (payload.stream_url) window.open(payload.stream_url, "_blank", "noopener,noreferrer");
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" || event.key === " ") openStream(event);
  }

  return <g className={payload.stream_url ? "post-su-clickable-dot" : ""} role={payload.stream_url ? "link" : undefined} tabIndex={payload.stream_url ? 0 : undefined} aria-label={payload.stream_url ? `Open stream from ${payload.label}` : undefined} onClick={payload.stream_url ? openStream : undefined} onKeyDown={payload.stream_url ? handleKeyDown : undefined} pointerEvents="all"><circle cx={cx} cy={cy} r={8} fill="transparent" onClick={payload.stream_url ? openStream : undefined} /><circle cx={cx} cy={cy} r={4.5} fill={color} onClick={payload.stream_url ? openStream : undefined} /></g>;
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function CustomRangePicker({ label, start, end, minDate, maxDate, onChange, onClear, showPeriodMarkers = false }) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => new Date(`${minDate}T00:00:00`));
  const [pendingStart, setPendingStart] = useState(start);
  const pickerRef = useRef(null);

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  function chooseDate(selectedDate) {
    if (!pendingStart || (pendingStart && end)) {
      setPendingStart(selectedDate);
      onChange(selectedDate, "");
      return;
    }

    if (selectedDate < pendingStart) onChange(selectedDate, pendingStart);
    else onChange(pendingStart, selectedDate);
    setPendingStart("");
    setOpen(false);
  }

  const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const firstCalendarDay = new Date(monthStart);
  firstCalendarDay.setDate(1 - monthStart.getDay());
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstCalendarDay);
    day.setDate(firstCalendarDay.getDate() + index);
    return day;
  });
  const monthLabel = viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const canGoPrevious = viewDate > new Date(2026, 5, 1);
  const canGoNext = viewDate < new Date(2026, 7, 1);

  return (
    <div className="post-su-custom-range" ref={pickerRef}>
      <button type="button" className={`post-su-range-trigger${start || end ? " active" : ""}`} onClick={() => setOpen((current) => !current)}>
        <span className="post-su-range-label">{label}</span>
        <strong>{formatRangeDate(start || minDate)} <em>to</em> {formatRangeDate(end || maxDate)}</strong>
        <span className="post-su-range-chevron">⌄</span>
      </button>
      {open && (
        <div className="post-su-calendar-popover">
          <div className="post-su-calendar-header">
            <button type="button" disabled={!canGoPrevious} onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}>‹</button>
            <strong>{monthLabel}</strong>
            <button type="button" disabled={!canGoNext} onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}>›</button>
          </div>
          <div className="post-su-calendar-weekdays">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="post-su-calendar-grid">
            {calendarDays.map((day) => {
              const key = dateKey(day);
              const disabled = key < minDate || key > maxDate;
              const preSU = showPeriodMarkers && key < "2026-07-15" && key >= minDate;
              const duringSU = showPeriodMarkers && key >= "2026-07-15" && key <= "2026-07-20";
              const selected = key === start || key === end;
              const inRange = start && end && key > start && key < end;
              return <button type="button" key={key} disabled={disabled} className={`${day.getMonth() !== viewDate.getMonth() ? "outside-month " : ""}${disabled ? "disabled-day " : ""}${preSU ? "pre-su-day " : ""}${duringSU ? "during-su-day " : ""}${selected ? "selected-day " : ""}${inRange ? "in-range " : ""}`} onClick={() => chooseDate(key)}>{day.getDate()}</button>;
            })}
          </div>
          <div className="post-su-calendar-footer"><span>{pendingStart ? "Choose an end date" : "Choose a start date"}</span>{(start || end) && <button type="button" onClick={() => { onClear(); setPendingStart(""); }}>Clear</button>}</div>
        </div>
      )}
    </div>
  );
}

function PostSUStreamerBreakdownPage({ summary = [], duringSummary = [], streams = [], groups = [] }) {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("All");
  const [sortKey, setSortKey] = useState("post_su_followers_gained");
  const [sortDescending, setSortDescending] = useState(true);
  const [selectedStreamer, setSelectedStreamer] = useState(null);
  const [metricRangeStart, setMetricRangeStart] = useState("2026-07-21");
  const [metricRangeEnd, setMetricRangeEnd] = useState("2026-08-19");
  const [timelineRangeStart, setTimelineRangeStart] = useState("");
  const [timelineRangeEnd, setTimelineRangeEnd] = useState("");
  const rangeStart = timelineRangeStart;
  const rangeEnd = timelineRangeEnd;
  const setRangeStart = setTimelineRangeStart;
  const setRangeEnd = setTimelineRangeEnd;
  const earliestTimelineDate = "2026-06-01";
  const earliestPostSUDate = "2026-07-21";
  const latestPostSUDate = "2026-08-19";
  const postSUMetricStart = metricRangeStart || earliestPostSUDate;
  const postSUMetricEnd = metricRangeEnd || latestPostSUDate;
  const postSUMetricRangeLabel = `${formatRangeDate(postSUMetricStart)} - ${formatRangeDate(postSUMetricEnd)}`;

  const metricStreams = useMemo(() => {
    const startTime = new Date(`${postSUMetricStart}T00:00:00`).getTime();
    const endTime = new Date(`${postSUMetricEnd}T23:59:59`).getTime();
    return streams.filter((row) => {
      const time = new Date(row.stream_start || row.post_su_start).getTime();
      return time >= startTime && time <= endTime;
    });
  }, [postSUMetricEnd, postSUMetricStart, streams]);

  const timelineStreams = useMemo(() => {
    const startTime = timelineRangeStart ? new Date(`${timelineRangeStart}T00:00:00`).getTime() : -Infinity;
    const endTime = timelineRangeEnd ? new Date(`${timelineRangeEnd}T23:59:59`).getTime() : Infinity;
    return streams.filter((row) => {
      const time = new Date(row.stream_start || row.post_su_start).getTime();
      return time >= startTime && time <= endTime;
    });
  }, [streams, timelineRangeEnd, timelineRangeStart]);

  const filteredSummary = useMemo(() => {
    const byStreamer = new Map();
    for (const stream of metricStreams) {
      const key = String(stream?.streamer || stream?.display_name || "");
      if (!key) continue;
      const current = byStreamer.get(key) || [];
      current.push(stream);
      byStreamer.set(key, current);
    }

    return summary.map((row) => {
      const streamRows = byStreamer.get(String(row?.streamer || row?.display_name || "")) || [];
      const hours = streamRows.reduce((total, stream) => total + numberOf(stream, "post_su_hours_streamed", "stream_hours"), 0);
      const followers = streamRows.reduce((total, stream) => total + numberOf(stream, "post_su_followers_gained", "followers_gained"), 0);
      const weightedViewers = streamRows.reduce((total, stream) => total + numberOf(stream, "post_su_average_viewers", "average_viewers") * numberOf(stream, "post_su_hours_streamed", "stream_hours"), 0);
      const average = hours > 0 ? weightedViewers / hours : 0;
      const peak = streamRows.reduce((highest, stream) => Math.max(highest, numberOf(stream, "post_su_peak_viewers", "peak_viewers")), 0);

      return { ...row, has_post_su_data: streamRows.length > 0, post_su_total_hours_streamed: hours, post_su_hours_streamed: hours, post_su_followers_gained: followers, post_su_average_viewers_weighted: average, post_su_average_viewers_simple: average, post_su_peak_viewers: peak };
    });
  }, [metricStreams, summary]);

  const combinedRows = useMemo(() => {
    const byStreamer = new Map();

    for (const row of duringSummary) {
      const key = String(row?.streamer || row?.display_name || "");
      if (!key) continue;
      byStreamer.set(key, { ...row });
    }

    for (const row of filteredSummary) {
      const key = String(row?.streamer || row?.display_name || "");
      if (!key) continue;
      const current = byStreamer.get(key) || {};
      byStreamer.set(key, { ...current, ...row });
    }

    return [...byStreamer.values()];
  }, [duringSummary, filteredSummary]);

  const rows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return combinedRows
      .filter((row) => {
        const name = String(row.display_name || row.streamer || "").toLowerCase();
        return (group === "All" || row.group === group) && (!normalizedSearch || name.includes(normalizedSearch));
      })
      .sort((left, right) => {
        const leftValue = sortKey === "display_name" ? String(left.display_name || left.streamer) : tableSortValue(left, sortKey);
        const rightValue = sortKey === "display_name" ? String(right.display_name || right.streamer) : tableSortValue(right, sortKey);
        if (typeof leftValue !== "string" && !Number.isFinite(leftValue)) return 1;
        if (typeof rightValue !== "string" && !Number.isFinite(rightValue)) return -1;
        const comparison = typeof leftValue === "string" ? leftValue.localeCompare(rightValue) : leftValue - rightValue;
        return sortDescending ? -comparison : comparison;
      });
  }, [combinedRows, search, group, sortKey, sortDescending]);

  useEffect(() => {
    if (!selectedStreamer && rows.length) setSelectedStreamer(rows[0]);
    if (selectedStreamer && !rows.some((row) => row.streamer === selectedStreamer.streamer)) {
      setSelectedStreamer(rows[0] || null);
    }
  }, [rows, selectedStreamer]);

  const selectedStreams = useMemo(() => {
    if (!selectedStreamer) return [];
    return timelineStreams
      .filter((row) => row.streamer === selectedStreamer.streamer)
      .sort((left, right) => String(right.stream_start).localeCompare(String(left.stream_start)));
  }, [selectedStreamer, timelineStreams]);

  const trendData = useMemo(() => {
    if (!selectedStreams.length) return [];

    const sorted = [...selectedStreams].sort((left, right) => {
      const leftTime = new Date(left.stream_start || left.post_su_start).getTime();
      const rightTime = new Date(right.stream_start || right.post_su_start).getTime();
      return leftTime - rightTime;
    });

    const first = new Date(sorted[0].stream_start || sorted[0].post_su_start);
    const last = new Date(sorted[sorted.length - 1].stream_start || sorted[sorted.length - 1].post_su_start);
    const timeline = [];
    const streamDays = new Set(sorted.map((row) => new Date(row.stream_start || row.post_su_start).toISOString().slice(0, 10)));
    const cursor = new Date(first);
    cursor.setHours(0, 0, 0, 0);

    for (let day = new Date(cursor); day <= last; day.setDate(day.getDate() + 1)) {
      const dayKey = day.toISOString().slice(0, 10);
      if (!streamDays.has(dayKey)) {
        timeline.push({
          dateKey: dayKey,
          time: new Date(day).getTime(),
          label: formatTimelineDate(day),
          hours: null,
          average_viewers: null,
          peak_viewers: null,
          followers: null,
        });
      }
    }

    sorted.forEach((row) => {
      const rawDate = new Date(row.stream_start || row.post_su_start);
      const averageViewers = numberOf(row, "post_su_average_viewers", "average_viewers");
      const chartAverageViewers = averageViewers > 0 ? viewerScale(averageViewers) : null;
      const isPreSU = rawDate.getTime() < SU_START_TIME;
      const isDuringSU = !isPreSU && rawDate.getTime() < SU_END_TIME;
      timeline.push({
        dateKey: rawDate.toISOString().slice(0, 10),
        time: rawDate.getTime(),
        label: formatTimeLabel(rawDate),
        hours: numberOf(row, "post_su_hours_streamed", "stream_hours"),
        average_viewers: averageViewers > 0 ? averageViewers : null,
        chart_average_viewers: chartAverageViewers,
        isPreSU,
        isDuringSU,
        peak_viewers: numberOf(row, "post_su_peak_viewers", "peak_viewers"),
        followers: numberOf(row, "post_su_followers_gained", "followers_gained"),
        stream_url: row.stream_url,
      });
    });

    const orderedTimeline = timeline.sort((left, right) => left.time - right.time);
    const firstDuringSUStream = orderedTimeline.find(
      (row) => row.average_viewers !== null && row.isDuringSU
    );
    const lastDuringSUStream = [...orderedTimeline]
      .reverse()
      .find((row) => row.average_viewers !== null && row.isDuringSU);

    return orderedTimeline.map((row) => ({
      ...row,
      pre_su_average_viewers:
        row.isPreSU || row === firstDuringSUStream
          ? row.chart_average_viewers
          : null,
      during_su_average_viewers: row.isDuringSU ? row.chart_average_viewers : null,
      post_su_average_viewers:
        (!row.isPreSU && !row.isDuringSU) || row === lastDuringSUStream
          ? row.chart_average_viewers
          : null,
    }));
  }, [selectedStreams]);

  const visibleTrendData = useMemo(() => {
    return trendData;
  }, [trendData]);

  function toggleSort(nextKey) {
    if (nextKey === sortKey) setSortDescending((current) => !current);
    else {
      setSortKey(nextKey);
      setSortDescending(nextKey !== "display_name");
    }
  }

  const sortMark = (key) => sortKey === key ? (sortDescending ? " ↓" : " ↑") : "";

  const preAvg = numberOf(selectedStreamer, "pre_june_average_viewers", "pre_30d_average_viewers", "pre_average_viewers");
  const duringAvg = numberOf(selectedStreamer, "during_average_viewers");
  const postAvg = numberOf(selectedStreamer, "post_su_average_viewers_weighted", "post_su_average_viewers_simple");
  const preFollowers = numberOf(selectedStreamer, "pre_june_followers_gained", "pre_30d_followers_gained", "pre_followers_gained");
  const duringFollowers = numberOf(selectedStreamer, "during_followers_gained");
  const postFollowers = numberOf(selectedStreamer, "post_su_followers_gained");
  const preHours = numberOf(selectedStreamer, "pre_june_hours_streamed", "pre_30d_total_hours_streamed", "pre_total_hours_streamed");
  const duringHours = numberOf(selectedStreamer, "during_total_hours_streamed");
  const postHours = numberOf(selectedStreamer, "post_su_total_hours_streamed");

  const comparisonCards = [
    { label: "Average viewers", values: [preAvg, duringAvg, postAvg], suffix: "" },
    { label: "Followers gained", values: [preFollowers, duringFollowers, postFollowers], suffix: "" },
    { label: "Peak viewers", values: [numberOf(selectedStreamer, "pre_june_peak_viewers", "pre_30d_peak_viewers", "pre_peak_viewers"), numberOf(selectedStreamer, "during_peak_viewers"), numberOf(selectedStreamer, "post_su_peak_viewers")], suffix: "" },
    { label: "Hours streamed", values: [preHours, duringHours, postHours], suffix: " hrs", compareToPre: false, showBaseline: false },
  ];

  return (
    <section className="post-su-breakdown-page">
      <header className="post-su-breakdown-heading">
        <div><span>Post-SU Analysis</span><h2>Streamer Breakdown</h2><p>Individual performance and post-SU broadcast activity.</p></div>
        <div className="post-su-breakdown-count">{formatNumber(rows.length)} streamers</div>
      </header>

      <main className="post-su-breakdown-main">
        <section className="post-su-breakdown-toolbar">
          <label><span>Search streamer</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search streamer..." /></label>
          <label><span>Group</span><select value={group} onChange={(event) => setGroup(event.target.value)}><option value="All">All groups</option>{groups.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        </section>
          {selectedStreamer ? (
            <>
              <header className="post-su-profile-header">
                <div className="post-su-profile-identity"><div><span>Selected streamer</span><h3>{selectedStreamer.display_name || selectedStreamer.streamer}</h3><small>{selectedStreamer.group || "Streamer"}</small></div></div>
              </header>

              <div className="post-su-breakdown-metrics">
                {comparisonCards.map((card) => {
                  const duringChange = changeFor(card.values[1], card.values[0]);
                  const postChange = changeFor(card.values[2], card.values[0]);
                  return <article key={card.label} className={`post-su-metric-card${card.featured ? " featured" : ""}`}><div className="post-su-metric-heading"><small>{card.label}</small></div><div className="post-su-metric-columns"><div><span>Pre-SU</span><strong>{formatCompact(card.values[0])}{card.suffix}</strong>{card.showBaseline !== false && <em className="post-su-baseline-label">June baseline</em>}</div><div><span>During-SU</span><strong>{formatCompact(card.values[1])}{card.suffix}</strong>{card.compareToPre !== false && <em className={`post-su-change-indicator ${duringChange.tone}`}><b>{duringChange.icon}</b>{duringChange.label}</em>}</div><div><span>Post-SU</span><strong>{formatCompact(card.values[2])}{card.suffix}</strong>{card.compareToPre !== false && <em className={`post-su-change-indicator ${postChange.tone}`}><b>{postChange.icon}</b>{postChange.label}</em>}</div></div></article>;
                })}
                <div className="post-su-timeline-picker"><CustomRangePicker label="Timeline view" start={timelineRangeStart} end={timelineRangeEnd} minDate={earliestTimelineDate} maxDate={latestPostSUDate} showPeriodMarkers onChange={(nextStart, nextEnd) => { setTimelineRangeStart(nextStart); setTimelineRangeEnd(nextEnd); }} onClear={() => { setTimelineRangeStart(""); setTimelineRangeEnd(""); }} /></div>
              </div>

              <article className="post-su-chart-panel post-su-viewer-chart"><div className="post-su-chart-title"><div><h4>Average viewers over time</h4><small>One point per broadcast · <span style={{ color: PRE_SU_COLOR }}>Pre-SU</span> · <span style={{ color: DURING_SU_COLOR }}>During SU</span> · <span style={{ color: POST_SU_COLOR }}>Post-SU</span></small></div><div className="post-su-chart-actions"><span>{formatNumber(selectedStreams.length)} broadcasts</span></div></div><div className="post-su-breakdown-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={visibleTrendData} margin={{ top: 12, right: 14, bottom: 10, left: 0 }} isAnimationActive={false}><CartesianGrid stroke="rgba(163, 173, 184, 0.13)" vertical={false} /><XAxis type="number" dataKey="time" domain={['dataMin', 'dataMax']} tick={{ fill: "#A3ADB8", fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={18} tickFormatter={formatTimelineDate} /><YAxis type="number" domain={[0, 'auto']} ticks={[0, viewerScale(1000), viewerScale(5000), viewerScale(10000), viewerScale(25000), viewerScale(50000), viewerScale(100000)]} tick={{ fill: "#A3ADB8", fontSize: 10 }} axisLine={false} tickLine={false} width={42} tickFormatter={formatViewerScaleTick} /><Tooltip isAnimationActive={false} animationDuration={0} content={<StreamTrendTooltip />} /><ReferenceLine x={SU_START_TIME} stroke="#A3ADB8" strokeDasharray="4 4" label={{ value: "SU starts", position: "insideTopLeft", fill: "#A3ADB8", fontSize: 10 }} /><ReferenceLine x={SU_END_TIME} stroke="#A3ADB8" strokeDasharray="4 4" label={{ value: "SU ends", position: "insideTopRight", fill: "#A3ADB8", fontSize: 10 }} /><Line type="monotone" dataKey="pre_su_average_viewers" stroke={PRE_SU_COLOR} strokeWidth={2.5} dot={false} activeDot={false} connectNulls isAnimationActive={false} /><Line type="monotone" dataKey="during_su_average_viewers" stroke={DURING_SU_COLOR} strokeWidth={2.5} dot={false} activeDot={false} connectNulls isAnimationActive={false} /><Line type="monotone" dataKey="post_su_average_viewers" stroke={POST_SU_COLOR} strokeWidth={2.5} dot={false} activeDot={false} connectNulls isAnimationActive={false} /><Line type="monotone" dataKey="chart_average_viewers" stroke="transparent" strokeWidth={0} dot={<StreamTrendDot />} activeDot={false} connectNulls isAnimationActive={false} /></LineChart></ResponsiveContainer></div></article>
            </>
          ) : <div className="post-su-breakdown-empty-state"><h3>Select a streamer</h3><p>Choose a name from the list to view their detailed breakdown.</p></div>}
      </main>

      <section className="post-su-breakdown-table-panel">
        <div className="post-su-table-heading"><div><span>Performance summary</span><h3>All streamers</h3></div><div className="post-su-table-actions"><CustomRangePicker label="Post-SU metrics" start={metricRangeStart} end={metricRangeEnd} minDate={earliestPostSUDate} maxDate={latestPostSUDate} onChange={(nextStart, nextEnd) => { setMetricRangeStart(nextStart); setMetricRangeEnd(nextEnd); }} onClear={() => { setMetricRangeStart(earliestPostSUDate); setMetricRangeEnd(latestPostSUDate); }} /><small>Click a row to inspect the streamer</small></div></div>
        <div className="post-su-breakdown-table-wrap">
          <table>
            <thead>
              <tr className="post-su-table-groups">
                <th rowSpan="2" onClick={() => toggleSort("display_name")}>Streamer{sortMark("display_name")}</th>
                <th rowSpan="2">Group</th>
                <th colSpan="3">Pre-SU <small>June baseline</small></th>
                <th colSpan="3">During-SU <small>Event period</small></th>
                <th colSpan="3">Post-SU <small>{postSUMetricRangeLabel}</small></th>
                <th colSpan="3">Change % <small>Post-SU vs Pre-SU</small></th>
                <th rowSpan="2">Outcome</th>
              </tr>
              <tr className="post-su-table-subgroups">
                <th onClick={() => toggleSort("pre_average")}>Avg viewers{sortMark("pre_average")}</th><th onClick={() => toggleSort("pre_followers")}>Followers{sortMark("pre_followers")}</th><th onClick={() => toggleSort("pre_hours")}>Hours{sortMark("pre_hours")}</th>
                <th onClick={() => toggleSort("during_average")}>Avg viewers{sortMark("during_average")}</th><th onClick={() => toggleSort("during_followers")}>Followers{sortMark("during_followers")}</th><th onClick={() => toggleSort("during_hours")}>Hours{sortMark("during_hours")}</th>
                <th onClick={() => toggleSort("post_average")}>Avg viewers{sortMark("post_average")}</th><th onClick={() => toggleSort("post_followers")}>Followers{sortMark("post_followers")}</th><th onClick={() => toggleSort("post_hours")}>Hours{sortMark("post_hours")}</th>
                <th onClick={() => toggleSort("change_average")}>Avg viewers{sortMark("change_average")}</th><th onClick={() => toggleSort("change_followers")}>Followers{sortMark("change_followers")}</th><th onClick={() => toggleSort("change_hours")}>Hours{sortMark("change_hours")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className={selectedStreamer?.streamer === row.streamer ? "selected" : ""} onClick={() => setSelectedStreamer(row)} key={row.streamer}>
                  <td><strong>{row.display_name || row.streamer}</strong></td>
                  <td>{row.group || "-"}</td>
                  <td>{formatCompact(valueOf(row, "pre_june_average_viewers", "pre_30d_average_viewers", "pre_average_viewers"))}</td>
                  <td>{formatCompact(valueOf(row, "pre_june_followers_gained", "pre_30d_followers_gained", "pre_followers_gained"))}</td>
                  <td>{formatCompact(valueOf(row, "pre_june_hours_streamed", "pre_30d_total_hours_streamed", "pre_total_hours_streamed"))}</td>
                  <td>{formatCompact(valueOf(row, "during_average_viewers"))}</td>
                  <td>{formatCompact(valueOf(row, "during_followers_gained"))}</td>
                  <td>{formatCompact(valueOf(row, "during_total_hours_streamed"))}</td>
                  <td>{formatCompact(valueOf(row, "post_su_average_viewers_weighted", "post_su_average_viewers_simple"))}</td>
                  <td>{formatCompact(valueOf(row, "post_su_followers_gained"))}</td>
                  <td>{formatCompact(valueOf(row, "post_su_total_hours_streamed"))}</td>
                  {[
                    ["post_average", "pre_average"],
                    ["post_followers", "pre_followers"],
                    ["post_hours", "pre_hours"],
                  ].map(([valueKey, baselineKey]) => {
                    const value = tableSortValue(row, valueKey);
                    const baseline = tableSortValue(row, baselineKey);
                    return <td className={`post-su-table-change ${changeClass(value, baseline)}`} key={valueKey}>{changePercent(value, baseline)}</td>;
                  })}
                  <td>{formatOutcome(row.post_su_result)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

export default PostSUStreamerBreakdownPage;