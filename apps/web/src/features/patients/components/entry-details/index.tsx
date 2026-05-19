import type { Entry } from "../../types.js";
import HealthCheckEntry from "./health-check-entry.js";
import HospitalEntry from "./hospital-entry.js";
import OccupationalEntry from "./occupational-entry.js";

type Props = { entry: Entry };

const EntryDetails = ({ entry }: Props) => {
  switch (entry.type) {
    case "Hospital":
      return <HospitalEntry entry={entry} />;
    case "OccupationalHealthcare":
      return <OccupationalEntry entry={entry} />;
    case "HealthCheck":
      return <HealthCheckEntry entry={entry} />;
  }
};

export default EntryDetails;
