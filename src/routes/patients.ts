import express from 'express';
import patientService from '../services/patientService';
import toNewPatient from '../utils';

const router = express.Router();

router.get('/', (_req, res) => {
  void (async () => {
  try {
    const patients = await patientService.getNonSensitivePatients();
    res.send(patients);
  } catch (error: unknown) {
    console.error(error);
    res.sendStatus(500);
  }
  })();
});

router.get('/:id', (req, res) => {
  void (async () => {
  try {
    const patient = await patientService.getNonSensitivePatient(req.params.id);
    if (patient) {
      res.send(patient);
    } else {
      res.sendStatus(404);
    }
  } catch (error: unknown) {
    console.error(error);
    res.sendStatus(500);
  }
  })();
});

router.post('/', (req, res) => {
  void (async () => {
  try {
    const newPatient = toNewPatient(req.body);
    const addedPatient = await patientService.addNewPatient(newPatient);
    res.json(addedPatient);
  } catch (error: unknown) {
    let errorMessage = 'Something went wrong.';
    if (error instanceof Error) {
      errorMessage += ' Error: ' + error.message;
    }
    res.status(400).send(errorMessage);
  }
  })();
});
export default router;
