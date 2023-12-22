import express from 'express';
const app = express();
import diagnosisRouter from './routes/diagnoses';
app.use(express.json());

const PORT = 3001;

app.get('/api/ping', (_req, res) => {
  res.status(200).send('pong');
});

app.use('/api/diagnoses', diagnosisRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});