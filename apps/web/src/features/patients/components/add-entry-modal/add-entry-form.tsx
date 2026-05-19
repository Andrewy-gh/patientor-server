import { useState } from "react";
import type { SyntheticEvent } from "react";

import { Box, Button, InputLabel, MenuItem, Select, TextField } from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";

import { HealthCheckRating } from "../../types.js";
import type { HealthCheckRating as HealthCheckRatingType, NewEntryInput } from "../../types.js";

type EntryType = NewEntryInput["type"];

interface Props {
  onCancel: () => void;
  onSubmit: (values: NewEntryInput) => void;
}

const entryTypes: EntryType[] = ["HealthCheck", "Hospital", "OccupationalHealthcare"];

const healthCheckRatings: HealthCheckRatingType[] = Object.values(HealthCheckRating);

const parseDiagnosisCodes = (value: string): string[] | undefined => {
  const codes = value
    .split(",")
    .map((code) => code.trim())
    .filter((code) => code.length > 0);

  return codes.length > 0 ? codes : undefined;
};

const AddEntryForm = ({ onCancel, onSubmit }: Props) => {
  const [type, setType] = useState<EntryType>("HealthCheck");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [specialist, setSpecialist] = useState("");
  const [diagnosisCodes, setDiagnosisCodes] = useState("");
  const [healthCheckRating, setHealthCheckRating] = useState<HealthCheckRatingType>(
    HealthCheckRating.Healthy,
  );
  const [dischargeDate, setDischargeDate] = useState("");
  const [dischargeCriteria, setDischargeCriteria] = useState("");
  const [employerName, setEmployerName] = useState("");
  const [sickLeaveStartDate, setSickLeaveStartDate] = useState("");
  const [sickLeaveEndDate, setSickLeaveEndDate] = useState("");

  const commonFields = () => ({
    description,
    date,
    specialist,
    diagnosisCodes: parseDiagnosisCodes(diagnosisCodes),
  });

  const addEntry = (event: SyntheticEvent) => {
    event.preventDefault();

    if (type === "HealthCheck") {
      onSubmit({
        ...commonFields(),
        type,
        healthCheckRating,
      });
      return;
    }

    if (type === "Hospital") {
      onSubmit({
        ...commonFields(),
        type,
        discharge: {
          date: dischargeDate,
          criteria: dischargeCriteria,
        },
      });
      return;
    }

    onSubmit({
      ...commonFields(),
      type,
      employerName,
      sickLeave:
        sickLeaveStartDate && sickLeaveEndDate
          ? {
              startDate: sickLeaveStartDate,
              endDate: sickLeaveEndDate,
            }
          : undefined,
    });
  };

  const onEntryTypeChange = (event: SelectChangeEvent<string>) => {
    const selectedType = entryTypes.find((entryType) => entryType === event.target.value);
    if (selectedType) {
      setType(selectedType);
    }
  };

  const onHealthCheckRatingChange = (event: SelectChangeEvent<string>) => {
    const selectedRating = Number(event.target.value);
    const rating = healthCheckRatings.find((rating) => rating === selectedRating);
    if (rating !== undefined) {
      setHealthCheckRating(rating);
    }
  };

  return (
    <form onSubmit={addEntry}>
      <InputLabel>Entry type</InputLabel>
      <Select label="Entry type" fullWidth value={type} onChange={onEntryTypeChange}>
        {entryTypes.map((entryType) => (
          <MenuItem key={entryType} value={entryType}>
            {entryType}
          </MenuItem>
        ))}
      </Select>

      <TextField
        label="Description"
        fullWidth
        value={description}
        onChange={({ target }) => setDescription(target.value)}
      />
      <TextField
        label="Date"
        placeholder="YYYY-MM-DD"
        fullWidth
        value={date}
        onChange={({ target }) => setDate(target.value)}
      />
      <TextField
        label="Specialist"
        fullWidth
        value={specialist}
        onChange={({ target }) => setSpecialist(target.value)}
      />
      <TextField
        label="Diagnosis codes"
        placeholder="M24.2, Z57.1"
        fullWidth
        value={diagnosisCodes}
        onChange={({ target }) => setDiagnosisCodes(target.value)}
      />

      {type === "HealthCheck" && (
        <>
          <InputLabel style={{ marginTop: 20 }}>Health check rating</InputLabel>
          <Select
            label="Health check rating"
            fullWidth
            value={String(healthCheckRating)}
            onChange={onHealthCheckRatingChange}
          >
            {healthCheckRatings.map((rating) => (
              <MenuItem key={rating} value={String(rating)}>
                {rating}
              </MenuItem>
            ))}
          </Select>
        </>
      )}

      {type === "Hospital" && (
        <>
          <TextField
            label="Discharge date"
            placeholder="YYYY-MM-DD"
            fullWidth
            value={dischargeDate}
            onChange={({ target }) => setDischargeDate(target.value)}
          />
          <TextField
            label="Discharge criteria"
            fullWidth
            value={dischargeCriteria}
            onChange={({ target }) => setDischargeCriteria(target.value)}
          />
        </>
      )}

      {type === "OccupationalHealthcare" && (
        <>
          <TextField
            label="Employer"
            fullWidth
            value={employerName}
            onChange={({ target }) => setEmployerName(target.value)}
          />
          <TextField
            label="Sick leave start date"
            placeholder="YYYY-MM-DD"
            fullWidth
            value={sickLeaveStartDate}
            onChange={({ target }) => setSickLeaveStartDate(target.value)}
          />
          <TextField
            label="Sick leave end date"
            placeholder="YYYY-MM-DD"
            fullWidth
            value={sickLeaveEndDate}
            onChange={({ target }) => setSickLeaveEndDate(target.value)}
          />
        </>
      )}

      <Box display="flex" justifyContent="space-between" marginTop={2}>
        <Button color="secondary" variant="contained" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="contained">
          Add
        </Button>
      </Box>
    </form>
  );
};

export default AddEntryForm;
