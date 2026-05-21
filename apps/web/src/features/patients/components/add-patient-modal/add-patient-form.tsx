import { useState } from "react";
import type { SyntheticEvent } from "react";

import { Box, Button, FormControl, InputLabel, MenuItem, Select, TextField } from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";

import { Gender } from "../../types.js";
import type { PatientFormValues } from "../../types.js";

interface Props {
  onCancel: () => void;
  onSubmit: (values: PatientFormValues) => void;
}

interface GenderOption {
  value: Gender;
  label: string;
}

const genderOptions: GenderOption[] = Object.values(Gender).map((value) => ({
  value,
  label: value,
}));

const AddPatientForm = ({ onCancel, onSubmit }: Props) => {
  const [name, setName] = useState("");
  const [occupation, setOccupation] = useState("");
  const [ssn, setSsn] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<Gender>(Gender.Other);

  const onGenderChange = (event: SelectChangeEvent<string>) => {
    event.preventDefault();
    if (typeof event.target.value === "string") {
      const value = event.target.value;
      const gender = Object.values(Gender).find((gender) => gender === value);
      if (gender) {
        setGender(gender);
      }
    }
  };

  const addPatient = (event: SyntheticEvent) => {
    event.preventDefault();
    onSubmit({
      name,
      occupation,
      ssn,
      dateOfBirth,
      gender,
    });
  };

  return (
    <Box>
      <form className="form-stack" onSubmit={addPatient}>
        <TextField
          label="Name"
          fullWidth
          value={name}
          onChange={({ target }) => setName(target.value)}
        />
        <TextField
          label="Social security number"
          fullWidth
          value={ssn}
          onChange={({ target }) => setSsn(target.value)}
        />
        <TextField
          label="Date of birth"
          placeholder="YYYY-MM-DD"
          fullWidth
          value={dateOfBirth}
          onChange={({ target }) => setDateOfBirth(target.value)}
        />
        <TextField
          label="Occupation"
          fullWidth
          value={occupation}
          onChange={({ target }) => setOccupation(target.value)}
        />

        <FormControl fullWidth>
          <InputLabel>Gender</InputLabel>
          <Select label="Gender" value={gender} onChange={onGenderChange}>
            {genderOptions.map((option) => (
              <MenuItem key={option.label} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box className="form-actions">
          <Button color="inherit" variant="outlined" type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="contained">
            Add patient
          </Button>
        </Box>
      </form>
    </Box>
  );
};

export default AddPatientForm;
