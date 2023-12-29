import { patients } from '../../data/patients';
import { PrivatePatient } from '../types';
// import toNewPatient from '../utils';

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

// const addNewPatient = (patient: Patient): Patient => {
//   try {
//     const newDiaryEntry = toNewPatient(req.body);
//     const addedEntry = diaryService.addDiary(newDiaryEntry);
//     res.json(addedEntry);
//   } catch (error: unknown) {
//     let errorMessage = 'Something went wrong.';
//     if (error instanceof Error) {
//       errorMessage += ' Error: ' + error.message;
//     }
//     res.status(400).send(errorMessage);
//   }
// };

export default {
  getPrivatePatients,
  // addNewPatient,
};
