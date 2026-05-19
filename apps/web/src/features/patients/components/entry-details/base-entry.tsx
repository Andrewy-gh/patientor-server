import { useContext } from "react";
import { DiagnosisContext } from "../../../diagnoses/diagnosis-context.js";
import type { Diagnosis } from "../../../diagnoses/types.js";
import type { Entry } from "../../types.js";

type Props = { entry: Entry };

const BaseEntry = ({ entry }: Props) => {
  const diagnoses = useContext(DiagnosisContext);
  return (
    <div>
      <div>Description: {entry.description}</div>
      <div>Date: {entry.date}</div>
      <div>Specialist: {entry.specialist}</div>
      <div>
        {entry.diagnosisCodes &&
          entry.diagnosisCodes.map((code) => (
            <div key={code}>
              {code}
              {diagnoses?.find((diagnosis: Diagnosis) => diagnosis.code === code)?.name}
            </div>
          ))}
      </div>
    </div>
  );
};

export default BaseEntry;
