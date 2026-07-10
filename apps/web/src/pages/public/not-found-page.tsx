import { Link } from "react-router-dom";

import { APP_ICON_SRC } from "../../lib/assets";

export function NotFoundPage() {
  return (
    <section className="lost-page">
      <div className="lost-number" aria-hidden="true">
        <span>4</span>
        <img src={APP_ICON_SRC} alt="" />
        <span>4</span>
      </div>
      <span className="eyebrow">Off the map</span>
      <h1>This path wandered out of Ooo.</h1>
      <p>The page may have moved, or the link may have lost a digit along the way.</p>
      <div className="button-row">
        <Link className="button button-primary" to="/">
          Return to overview
        </Link>
        <Link className="button button-secondary" to="/status">
          Check game status
        </Link>
      </div>
    </section>
  );
}
