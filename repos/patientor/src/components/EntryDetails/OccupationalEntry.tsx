import { OccupationalHealthcareEntry } from '../../types';
import BaseEntry from './BaseEntry';

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
