import { HospitalEntry as HospitalType } from '../../types';
import BaseEntry from './BaseEntry';

type Props = { entry: HospitalType };

const HospitalEntry = ({ entry }: Props) => {
  return (
    <>
      <BaseEntry entry={entry} />
      <div>
        <div>Discharge date: {entry.discharge.date}</div>
        <div>Discharge criteria: {entry.discharge.criteria}</div>
      </div>
    </>
  );
};

export default HospitalEntry;
