import { HealthCheckEntry as HealthCheckType } from '../../types';
import BaseEntry from './BaseEntry';

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
