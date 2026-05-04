import express from "express";
import diagnosisService from "../services/diagnosisService.js";
const router = express.Router();

router.get("/", (_req, res) => {
  void (async () => {
  try {
    const diagnoses = await diagnosisService.getDiagnoses();
    res.send(diagnoses);
  } catch (error: unknown) {
    console.error(error);
    res.sendStatus(500);
  }
  })();
});

export default router;
