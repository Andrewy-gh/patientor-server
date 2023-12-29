/* eslint-disable @typescript-eslint/no-unsafe-call */
test('sample test', (): void => {
  function validateString(inputString: string): boolean {
    const pattern: RegExp = /^\d{6}-[a-zA-Z0-9]{3,4}$/;
    return pattern.test(inputString);
  }
  expect(validateString('090786-122X')).toBe(true);
  expect(validateString('300179-77A')).toBe(true);
  expect(validateString('090471-8890')).toBe(true);
  expect(validateString('123456-78901')).toBe(false);
  expect(validateString('abcdef-1234')).toBe(false);
  expect(validateString('1234567-ABC')).toBe(false);
});
