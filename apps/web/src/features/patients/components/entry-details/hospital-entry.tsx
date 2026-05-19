import type { HospitalEntry as HospitalType } from "../../types.js";
import BaseEntry from "./base-entry.js";

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
