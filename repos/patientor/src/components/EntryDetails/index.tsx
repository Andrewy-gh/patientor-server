import {
  Entry,
  HospitalEntry as HospitalType,
  OccupationalHealthcareEntry as OccupationalType,
  HealthCheckEntry as HealthCheckType,
} from '../../types';
import BaseEntry from './BaseEntry';
import HospitalEntry from './HospitalEntry';
import OccupationalEntry from './OccupationalEntry';
import HealthCheckEntry from './HealthCheckEntry';

type Props = { entry: Entry };

const EntryDetails = ({ entry }: Props) => {
  switch (entry.type) {
    case 'Hospital':
      return <HospitalEntry entry={entry as HospitalType} />;
    case 'OccupationalHealthcare':
      return <OccupationalEntry entry={entry as OccupationalType} />;
    case 'HealthCheck':
      return <HealthCheckEntry entry={entry as HealthCheckType} />;
    default:
      return <BaseEntry entry={entry} />;
  }
};

export default EntryDetails;
