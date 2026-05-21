import { Card, CardContent, Stack, Typography } from "@mui/material";
import type { Entry } from "../../types.js";
import EntryDetails from "../entry-details/index.js";

type Props = { entries: ReadonlyArray<Entry> };

const Entries = ({ entries }: Props) => {
  return (
    <Stack component="section" spacing={2}>
      {entries.length > 0 ? (
        <Typography variant="h5" component="h2">
          Care timeline
        </Typography>
      ) : (
        <Card className="soft-card">
          <CardContent>
            <Typography variant="h5" component="h2">
              Care timeline
            </Typography>
            <Typography color="text.secondary">No care entries have been recorded yet.</Typography>
          </CardContent>
        </Card>
      )}
      {entries.map((entry) => (
        <EntryDetails key={entry.id} entry={entry} />
      ))}
    </Stack>
  );
};

export default Entries;
