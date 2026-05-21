import { Paper, Stack, Typography } from "@mui/material";
import type { OccupationalHealthcareEntry } from "../../types.js";
import BaseEntry from "./base-entry.js";

type Props = { entry: OccupationalHealthcareEntry };

const OccupationalEntry = ({ entry }: Props) => {
  return (
    <BaseEntry
      accent="secondary"
      entry={entry}
      action={
        <Paper className="entry-detail-panel" elevation={0}>
          <Stack spacing={0.5}>
            <Typography color="text.secondary" variant="body2">
              Employer
            </Typography>
            <Typography fontWeight={700}>{entry.employerName}</Typography>
            {entry.sickLeave && (
              <Typography color="text.secondary">
                Sick leave: {entry.sickLeave.startDate} to {entry.sickLeave.endDate}
              </Typography>
            )}
          </Stack>
        </Paper>
      }
    />
  );
};

export default OccupationalEntry;
