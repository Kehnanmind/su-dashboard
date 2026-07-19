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
          <li>All data in this dashboard is sourced from <strong>SullyGnome</strong>.</li>
          <li>
            This includes <strong>Twitch</strong> streamers only. YouTube, Kick, and other
            platforms are not included.
          </li>
          <li>
            <strong>SullyGnome</strong> and <strong>TwitchTracker</strong> can differ slightly, so you may see
            discrepancies when comparing numbers.
          </li>
        </ul>
      </article>

      <article className="info-card">
        <h3>Long Stream Day Splitting</h3>
        <p>
          Some streams run across multiple days (for example, a 50-hour stream).
          The data files split those streams into day-by-day pieces, so daily
          stats in the app are calculated per day rather than reused from the
          full stream.
        </p>
        <p>
          <strong>Formula:</strong> Daily followers gained = Total followers
          gained x (Daily hours streamed / Total stream hours)
        </p>
        <p>
          Average viewers and peak viewers are represented per day.
        </p>
      </article>

      <article className="info-card">
        <h3>Definitions</h3>
        <ul>

          <li>
            A marathon streamer is someone who streamed at least 80% of all
            possible hours during Streamer University.
          </li>
          <li>
            Pre-SU metrics are based on the 30 days before Streamer University
            started.
          </li>
          <li>
            SU dates are <strong>July 15 to July 20</strong>. "During SU"
            means stats from streams that occurred on those dates only.
          </li>
        </ul>
      </article>

      <article className="info-card info-note">
        <h3>Project Note</h3>
        <p>
          This is a small personal project and may contain errors. Treat it as
          experimental and avoid sharing it publicly as a formal analysis :)
        </p>
      </article>
    </section>
  );
}

export default InformationPage;
