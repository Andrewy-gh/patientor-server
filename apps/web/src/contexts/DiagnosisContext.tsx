import { createContext } from "react";
import type { ReactNode } from "react";
import type { Diagnosis } from "../types.js";

type DiagnosisContextType = Diagnosis[] | undefined;

interface DiagnosisProviderProps {
  children: ReactNode;
  diagnoses: DiagnosisContextType;
}

export const DiagnosisContext = createContext<DiagnosisContextType | null>(null);

export const DiagnosisProvider = ({ children, diagnoses }: DiagnosisProviderProps) => {
  return <DiagnosisContext.Provider value={diagnoses}>{children}</DiagnosisContext.Provider>;
};
