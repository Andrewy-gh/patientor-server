import { patients } from '../../data/patients';
import { PrivatePatient, NewPatient, Patient } from '../types';
import { v1 as uuid } from 'uuid';

const getPrivatePatients = (): PrivatePatient[] => {
  return patients.map(
    ({ id, name, dateOfBirth, gender, occupation }): PrivatePatient => ({
      id,
      name,
      dateOfBirth,
      gender,
      occupation,
    })
  );
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
  getPrivatePatients,
  addNewPatient,
};
