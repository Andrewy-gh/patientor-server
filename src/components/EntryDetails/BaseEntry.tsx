import { useContext } from 'react';
import { Entry } from '../../types';
import { DiagnosisContext } from '../../contexts/DiagnosisContext';
import { Diagnosis } from '../../types';

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
          entry.diagnosisCodes.map((code, index) => (
            <div key={index}>
              {code}
              {
                diagnoses?.find(
                  (diagnosis: Diagnosis) => diagnosis.code === code
                )?.name
              }
            </div>
          ))}
      </div>
    </div>
  );
};

export default BaseEntry;
