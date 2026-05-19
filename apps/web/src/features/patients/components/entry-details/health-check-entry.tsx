import type { HealthCheckEntry as HealthCheckType } from "../../types.js";
import BaseEntry from "./base-entry.js";

type Props = { entry: HealthCheckType };

const HealthCheckEntry = ({ entry }: Props) => {
  return (
    <>
      <BaseEntry entry={entry} />
      <div>Health check Rating: {entry.healthCheckRating}</div>
    </>
  );
};

export default HealthCheckEntry;
