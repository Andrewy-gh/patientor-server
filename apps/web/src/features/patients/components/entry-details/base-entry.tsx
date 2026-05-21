import { useContext } from "react";
import type { ReactNode } from "react";
import { Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { EventRounded, MedicalInformationRounded, PersonSearchRounded } from "@mui/icons-material";
import { DiagnosisContext } from "../../../diagnoses/diagnosis-context.js";
import type { Diagnosis } from "../../../diagnoses/types.js";
import type { Entry } from "../../types.js";

type Props = {
  entry: Entry;
  action?: ReactNode;
  accent?: "primary" | "secondary" | "success" | "warning";
};

const BaseEntry = ({ entry, action, accent = "primary" }: Props) => {
  const diagnoses = useContext(DiagnosisContext);
  return (
    <Card className="entry-card" sx={{ borderLeftColor: `${accent}.main` }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack
            alignItems={{ xs: "flex-start", sm: "center" }}
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            spacing={1}
          >
            <Chip color={accent} label={entry.type} size="small" />
            <Stack className="entry-meta-chips" direction={{ xs: "column", sm: "row" }}>
              <Chip
                className="entry-meta-chip"
                icon={<EventRounded />}
                label={entry.date}
                variant="outlined"
              />
              <Chip
                className="entry-meta-chip"
                icon={<PersonSearchRounded />}
                label={entry.specialist}
                variant="outlined"
              />
            </Stack>
          </Stack>

          <Typography component="h3" variant="h6">
            {entry.description}
          </Typography>

          {entry.diagnosisCodes && entry.diagnosisCodes.length > 0 ? (
            <Stack className="chip-row">
              {entry.diagnosisCodes.map((code) => {
                const diagnosis = diagnoses?.find(
                  (diagnosis: Diagnosis) => diagnosis.code === code,
                );
                return (
                  <Chip
                    icon={<MedicalInformationRounded />}
                    key={code}
                    label={diagnosis ? `${code} ${diagnosis.name}` : code}
                    size="small"
                    variant="outlined"
                  />
                );
              })}
            </Stack>
          ) : null}

          {action}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default BaseEntry;
