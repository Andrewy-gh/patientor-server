import { assert, test } from "@effect/vitest";

test("validates patient SSN shape", (): void => {
  function validateString(inputString: string): boolean {
    const pattern: RegExp = /^\d{6}-[a-zA-Z0-9]{3,4}$/;
    return pattern.test(inputString);
  }

  assert.isTrue(validateString("090786-122X"));
  assert.isTrue(validateString("300179-77A"));
  assert.isTrue(validateString("090471-8890"));
  assert.isFalse(validateString("123456-78901"));
  assert.isFalse(validateString("abcdef-1234"));
  assert.isFalse(validateString("1234567-ABC"));
});
