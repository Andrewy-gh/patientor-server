import { Paper, Stack, Typography } from "@mui/material";
import type { HospitalEntry as HospitalType } from "../../types.js";
import BaseEntry from "./base-entry.js";

type Props = { entry: HospitalType };

const HospitalEntry = ({ entry }: Props) => {
  return (
    <BaseEntry
      accent="warning"
      entry={entry}
      action={
        <Paper className="entry-detail-panel" elevation={0}>
          <Stack spacing={0.5}>
            <Typography color="text.secondary" variant="body2">
              Discharge date
            </Typography>
            <Typography fontWeight={700}>{entry.discharge.date}</Typography>
            <Typography color="text.secondary">{entry.discharge.criteria}</Typography>
          </Stack>
        </Paper>
      }
    />
  );
};

export default HospitalEntry;
