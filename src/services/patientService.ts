import { patients } from '../../data/patients';
import { NonSensitivePatient, NewPatient, Patient } from '../types';
import { v1 as uuid } from 'uuid';

const getNonSensitivePatients = (): NonSensitivePatient[] => {
  return patients.map(
    ({ id, name, dateOfBirth, gender, occupation }): NonSensitivePatient => ({
      id,
      name,
      dateOfBirth,
      gender,
      occupation,
    })
  );
};

const getNonSensitivePatient = (
  id: string
): NonSensitivePatient | undefined => {
  return patients.find((patient) => patient.id === id);
};

const addNewPatient = (patient: NewPatient): Patient => {
  const newPatient = {
    id: uuid(),
    ...patient,
  };
  patients.push(newPatient);
  return newPatient;
};

export default {
  getNonSensitivePatients,
  getNonSensitivePatient,
  addNewPatient,
};
