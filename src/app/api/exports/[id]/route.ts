import { auth } from "@/auth";
import { getExportFile } from "@/lib/r2-storage";

export const runtime = "nodejs";

type ExportRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: ExportRouteContext) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await context.params;
  const userId = session.user.email ?? session.user.name ?? "unknown-user";
  const exportFile = await getExportFile(userId, id);
  if (!exportFile) {
    return new Response("Export not found.", { status: 404 });
  }

  return new Response(new Uint8Array(exportFile.bytes), {
    headers: {
      "Content-Disposition": `attachment; filename="${exportFile.metadata.filename}"`,
      "Content-Type": exportFile.metadata.contentType,
    },
  });
}
