import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import patientService from '../../services/patients';
import { Patient } from '../../types';
import Entries from '../Entries';

const PatientPage = () => {
  const { id } = useParams();
  const [patient, setPatient] = useState<Patient | null>();

  useEffect(() => {
    const fetchOnePatient = async (id: string | undefined) => {
      const patient = await patientService.getOnePatient(id);
      setPatient(patient);
      console.log('====================================');
      console.log(patient);
      console.log('====================================');
    };
    void fetchOnePatient(id);
  }, [id]);

  if (!patient) return <p>Invalid Patient Id</p>;
  return (
    <section>
      <h1>{patient.name}</h1>
      <div>gender: {patient.gender}</div>
      <div>ssn: {patient.ssn}</div>
      <div>occupation {patient.occupation}</div>
      {patient.entries && <Entries entries={patient.entries} />}
    </section>
  );
};

export default PatientPage;
