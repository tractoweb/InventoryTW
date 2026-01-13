import { formatAmplifyError } from "@/lib/amplify-config";

type ListResult<T> = { data?: T[]; nextToken?: string | null } | T[] | null | undefined;

function coerceListData<T>(result: ListResult<T>): { data: T[]; nextToken?: string | null } {
  if (!result) return { data: [] };
  if (Array.isArray(result)) return { data: result };
  return { data: (result.data ?? []) as T[], nextToken: result.nextToken };
}

export async function listAllPages<T>(
  listFn: (args?: any) => Promise<ListResult<T>>,
  args?: any
): Promise<{ data: T[] } | { data: T[]; error: string }> {
  try {
    const data: T[] = [];
    let nextToken: string | null | undefined = undefined;

    do {
      const result = await listFn({ ...(args ?? {}), nextToken });
      const coerced = coerceListData<T>(result);
      data.push(...coerced.data);
      nextToken = coerced.nextToken;
    } while (nextToken);

    return { data };
  } catch (error) {
    return { data: [], error: formatAmplifyError(error) };
  }
}
