import { createContext, useEffect, useState, ReactNode } from 'react';
import { Diagnosis } from '../types';
import diagnosisService from '../services/diagnoses';

type DiagnosisContextType = Diagnosis[] | undefined;

interface DiagnosisProviderType {
  children: ReactNode;
}

export const DiagnosisContext = createContext<DiagnosisContextType | null>(
  null
);

export const DiagnosisProvider = ({ children }: DiagnosisProviderType) => {
  const [diagnoses, setDiagnoses] = useState<DiagnosisContextType>();

  useEffect(() => {
    const fetchDiagnoses = async () => {
      const diagnoses = await diagnosisService.getDiagnoses();
      setDiagnoses(diagnoses);
    };
    void fetchDiagnoses();
  }, []);

  return (
    <DiagnosisContext.Provider value={diagnoses}>
      {children}
    </DiagnosisContext.Provider>
  );
};
