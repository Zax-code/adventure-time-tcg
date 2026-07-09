import { Link } from "react-router-dom";

import { BarChartIcon } from "../../components/icons";
import { AdminPageHeader, AdminSection } from "./admin-common";

export function AdminBalancePage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Unsupported legacy report"
        lede="This route is preserved as an explicit product decision, not a screen powered by invented data."
        title="Balance Lab is not connected."
      />
      <AdminSection title="No Phoenix contract exists">
        <div className="admin-unavailable">
          <span className="admin-unavailable-icon" aria-hidden="true">
            <BarChartIcon />
          </span>
          <div>
            <h2>An endpoint must come before a dashboard.</h2>
            <p>
              Phoenix does not expose a balance-report endpoint, simulation feed,
              or tuning mutation. This page deliberately makes no requests and
              shows no synthetic production metrics.
            </p>
            <ul>
              <li>Keep it only after the report contract and permissions are defined.</li>
              <li>Rebuild it from live catalog and battle aggregates if operators need it.</li>
              <li>Remove the route if the legacy report no longer serves a decision.</li>
            </ul>
          </div>
          <Link className="button button-secondary" to="/admin">
            Return to operations
          </Link>
        </div>
      </AdminSection>
    </>
  );
}
