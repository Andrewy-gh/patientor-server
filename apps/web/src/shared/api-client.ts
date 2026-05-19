const throwForBadResponse = async (response: Response) => {
  if (response.ok) {
    return;
  }

  const message = await response.text();
  throw new Error(message || `Request failed with status ${response.status}`);
};

export const getJson = async <ResponseBody>(path: string): Promise<ResponseBody> => {
  const response = await fetch(path);
  await throwForBadResponse(response);
  return (await response.json()) as ResponseBody;
};

export const postJson = async <ResponseBody, RequestBody>(
  path: string,
  body: RequestBody,
): Promise<ResponseBody> => {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  await throwForBadResponse(response);
  return (await response.json()) as ResponseBody;
};
