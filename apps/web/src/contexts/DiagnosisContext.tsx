import { createContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Diagnosis } from "../types.js";
import diagnosisService from "../services/diagnoses.js";

type DiagnosisContextType = Diagnosis[] | undefined;

interface DiagnosisProviderProps {
  children: ReactNode;
}

export const DiagnosisContext = createContext<DiagnosisContextType | null>(null);

export const DiagnosisProvider = ({ children }: DiagnosisProviderProps) => {
  const [diagnoses, setDiagnoses] = useState<DiagnosisContextType>();

  useEffect(() => {
    const fetchDiagnoses = async () => {
      try {
        const diagnoses = await diagnosisService.getDiagnoses();
        setDiagnoses(diagnoses);
      } catch {
        setDiagnoses(undefined);
      }
    };
    void fetchDiagnoses();
  }, []);

  return <DiagnosisContext.Provider value={diagnoses}>{children}</DiagnosisContext.Provider>;
};
