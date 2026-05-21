import { Paper } from "@mui/material";
import type { HealthCheckEntry as HealthCheckType } from "../../types.js";
import HealthRatingBar from "../health-rating-bar.js";
import BaseEntry from "./base-entry.js";

type Props = { entry: HealthCheckType };

const HealthCheckEntry = ({ entry }: Props) => {
  return (
    <BaseEntry
      accent="success"
      entry={entry}
      action={
        <Paper className="entry-detail-panel" elevation={0}>
          <HealthRatingBar showText={true} rating={entry.healthCheckRating} />
        </Paper>
      }
    />
  );
};

export default HealthCheckEntry;
