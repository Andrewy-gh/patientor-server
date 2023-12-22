import { patients } from '../../data/patients';
import { PrivatePatient } from '../types';

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

export default {
  getPrivatePatients,
};
