import { auth } from "@/auth";
import {
  aiDictionaryKey,
  bannedFunctionsKey,
  parseAIDictionary,
  parseBannedFunctions,
  stringifyAIDictionary,
  stringifyBannedFunctions,
} from "@/lib/policies/codec";
import type { AIDictionaryDocument, BannedFunctionsDocument } from "@/lib/policies/types";
import { getStoredTextByKey, putStoredTextByKey } from "@/lib/storage";

export const runtime = "nodejs";

async function globalsPayload() {
  const [bannedYaml, aiYaml] = await Promise.all([
    getStoredTextByKey(bannedFunctionsKey()),
    getStoredTextByKey(aiDictionaryKey()),
  ]);

  return {
    aiDictionary: parseAIDictionary(aiYaml),
    bannedFunctions: parseBannedFunctions(bannedYaml),
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  return Response.json(await globalsPayload());
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    aiDictionary?: AIDictionaryDocument;
    bannedFunctions?: BannedFunctionsDocument;
  } | null;

  await Promise.all([
    body?.bannedFunctions
      ? putStoredTextByKey(
          bannedFunctionsKey(),
          stringifyBannedFunctions(body.bannedFunctions),
          "application/x-yaml; charset=utf-8",
        )
      : Promise.resolve(),
    body?.aiDictionary
      ? putStoredTextByKey(
          aiDictionaryKey(),
          stringifyAIDictionary(body.aiDictionary),
          "application/x-yaml; charset=utf-8",
        )
      : Promise.resolve(),
  ]);

  return Response.json(await globalsPayload());
}
