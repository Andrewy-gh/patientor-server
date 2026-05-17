import type { Entry } from "../../types.js";
import HealthCheckEntry from "./HealthCheckEntry.js";
import HospitalEntry from "./HospitalEntry.js";
import OccupationalEntry from "./OccupationalEntry.js";

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
