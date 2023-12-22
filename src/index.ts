import express from 'express';
const app = express();
import diagnosisRouter from './routes/diagnoses';
import patientRouter from './routes/patients';
app.use(express.json());

const PORT = 3001;

app.get('/api/ping', (_req, res) => {
  res.status(200).send('pong');
});

app.use('/api/diagnoses', diagnosisRouter);
app.use('/api/patients', patientRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
