import express from "express";
const app = express();
import diagnosisRouter from "./routes/diagnoses.js";
import patientRouter from "./routes/patients.js";
import { config } from "./config.js";

app.use(express.json());

app.get("/api/ping", (_req, res) => {
  res.status(200).send("pong");
});

app.use("/api/diagnoses", diagnosisRouter);
app.use("/api/patients", patientRouter);

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});
