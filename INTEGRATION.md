# Daily Performance tab integration

## Files

Copy these into your project:

```text
src/components/DailyPerformancePage.jsx
src/components/DailyPerformancePage.css
```

The component loads these existing public files directly:

```text
public/data/json/event_daily_summary.json
public/data/json/streamer_daily_summary.json
```

## Import

At the top of `App.jsx`:

```jsx
import DailyPerformancePage from "./components/DailyPerformancePage";
```

## Sidebar button

Replace the disabled Daily Performance button with:

```jsx
<button
  className={`nav-item ${
    activePage === "daily" ? "active" : ""
  }`}
  type="button"
  onClick={() => setActivePage("daily")}
>
  <span>↗</span> Daily Performance
</button>
```

## Render the page

Add this beside your other page conditions:

```jsx
{activePage === "daily" && (
  <DailyPerformancePage
    groups={availableGroups}
    streamerSummary={summary}
  />
)}
```

A full page switch can look like:

```jsx
{activePage === "overview" && (
  <OverviewPage
    summary={summary}
    daily={daily}
    selectedGroups={selectedGroups}
    setSelectedGroups={setSelectedGroups}
    availableGroups={availableGroups}
  />
)}

{activePage === "leaderboard" && (
  <LeaderboardPage
    streamers={summary}
    groups={availableGroups}
  />
)}

{activePage === "streamers" && (
  <StreamersPage
    streamers={summary}
    groups={availableGroups}
  />
)}

{activePage === "daily" && (
  <DailyPerformancePage
    groups={availableGroups}
    streamerSummary={summary}
  />
)}
```

## Included

- Metric selector
- Group filter
- Streamer selector
- Streamer search
- Event-wide daily trend chart
- Top 10 streamers for the chosen daily metric
- Daily activity chart
- Sortable streamer-day table
- Numeric KPI totals
- No subjective labels or performance conclusions

## Field-name compatibility

The component checks common alternatives such as:

```text
hours_streamed / daily_hours_streamed / total_hours_streamed
average_viewers / weighted_average_viewers / avg_viewers
date / stream_date / event_date / event_day
```

If your JSON uses different names, edit the aliases inside `metricValue()`.
