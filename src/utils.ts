import { Gender, NewPatient } from './types';

const isString = (text: unknown): text is string => {
  return typeof text === 'string' || text instanceof String;
};

const parseString = (string: unknown): string => {
  if (!isString(string)) {
    throw new Error('Incorrect or missing field');
  }
  return string;
};

const isDate = (date: string): boolean => {
  return Boolean(Date.parse(date));
};

const parseDateOfBirth = (date: unknown): string => {
  if (!isString(date) || !isDate(date)) {
    throw new Error('Incorrect date: ' + date);
  }
  return date;
};

const isValidSSN = (ssn: string): boolean => {
  const pattern: RegExp = /^\d{6}-[a-zA-Z0-9]{3,4}$/;
  return pattern.test(ssn);
};

const parseSSN = (ssn: unknown): string => {
  if (!isString(ssn) || !isValidSSN(ssn)) {
    throw new Error('Invalid ssn: ' + ssn);
  }
  return ssn;
};

const isGender = (gender: string): boolean => {
  return Object.values(Gender)
    .map((g) => g.toString())
    .includes(gender);
};

const parseGender = (gender: unknown): string => {
  if (!isString(gender) || !isGender(gender)) {
    throw new Error('Incorrect gender: ' + gender);
  }
  return gender;
};

const toNewPatient = (object: unknown): NewPatient => {
  if (!object || typeof object !== 'object') {
    throw new Error('Incorrect or missing data');
  }

  if (
    'name' in object &&
    'dateOfBirth' in object &&
    'ssn' in object &&
    'gender' in object &&
    'occupation' in object
  ) {
    const newPatient: NewPatient = {
      name: parseString(object.name),
      dateOfBirth: parseDateOfBirth(object.dateOfBirth),
      ssn: parseSSN(object.ssn),
      gender: parseGender(object.gender),
      occupation: parseString(object.occupation),
    };
    return newPatient;
  }
  throw new Error('Incorrect data: a field missing');
};

export default toNewPatient;
