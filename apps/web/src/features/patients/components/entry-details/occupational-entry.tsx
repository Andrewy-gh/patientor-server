import type { OccupationalHealthcareEntry } from "../../types.js";
import BaseEntry from "./base-entry.js";

type Props = { entry: OccupationalHealthcareEntry };

const OccupationalEntry = ({ entry }: Props) => {
  return (
    <>
      <BaseEntry entry={entry} />
      <div>Employer: {entry.employerName}</div>
      {entry.sickLeave && (
        <div>
          <div>Sick leave start date: {entry.sickLeave.startDate}</div>
          <div>Sick leave end date {entry.sickLeave.endDate}</div>
        </div>
      )}
    </>
  );
};

export default OccupationalEntry;
