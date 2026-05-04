import { db } from "../db/database.js";

const getDiagnoses = async () => {
  const diagnoses = await db
    .selectFrom('diagnoses')
    .select(['code', 'name', 'latin'])
    .orderBy('code')
    .execute();

  return diagnoses.map((diagnosis) => ({
    code: diagnosis.code,
    name: diagnosis.name,
    ...(diagnosis.latin ? { latin: diagnosis.latin } : {}),
  }));
};

export default {
  getDiagnoses,
};
