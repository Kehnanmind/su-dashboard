import "./InformationPage.css";

function InformationPage() {
  return (
    <section className="info-page">
      <header className="info-page-heading">
        <h2>Information</h2>
        <p>
          Methodology notes, caveats, and scope for this dashboard.
        </p>
      </header>

      <article className="info-card">
        <h3>Data Source And Scope</h3>
        <ul>
          <li>All data in this dashboard is sourced from SullyGnome.</li>
          <li>
            This includes Twitch streamers only. YouTube, Kick, and other
            platforms are not included.
          </li>
          <li>
            SullyGnome and TwitchTracker can differ slightly, so you may see
            discrepancies when comparing numbers.
          </li>
        </ul>
      </article>

      <article className="info-card">
        <h3>Long Stream Day Splitting</h3>
        <p>
          Some streams run across multiple days (for example, a 50-hour stream).
          In these cases, per-day followers gained is not directly available.
          Only the total followers gained for the full stream is available.
        </p>
        <p>
          To estimate per-day followers gained, each day gets a proportional
          share of the stream's total followers gained based on how many hours
          were streamed on that day.
        </p>
        <p>
          <strong>Formula:</strong> Daily followers gained = Total followers
          gained x (Daily hours streamed / Total stream hours)
        </p>
        <p>
          Average viewers is duplicated across each split day for that same
          stream.
        </p>
      </article>

      <article className="info-card">
        <h3>Definitions</h3>
        <ul>
          <li>
            Marathon streamer: streamed at least 80% of all available hours
            during Streamer University.
          </li>
          <li>
            Pre-SU metrics are based on the 30 days before Streamer University
            started.
          </li>
        </ul>
      </article>

      <article className="info-card info-note">
        <h3>Project Note</h3>
        <p>
          This is a small project and may contain errors. Treat it as
          experimental and avoid sharing it publicly as a source of truth.
        </p>
      </article>
    </section>
  );
}

export default InformationPage;
