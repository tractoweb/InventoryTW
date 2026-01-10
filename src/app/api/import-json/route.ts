import { NextRequest, NextResponse } from "next/server";
import { uploadAllJsonData } from "@/scripts/upload-json";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const file = searchParams.get("file");
    let result;
    if (file) {
      // Importar solo un archivo
      result = await uploadAllJsonData({ skipDuplicates: true, skipExistingFiles: true, file });
      // El log detallado está en result[file].log
      return NextResponse.json({ message: `Archivo ${file} importado.`, log: result[file]?.log || [], summary: result[file] });
    } else {
      // Importar todos
      result = await uploadAllJsonData({ skipDuplicates: true, skipExistingFiles: true });
      // El log detallado está en result[modelName].log para cada modelo
      return NextResponse.json({ message: "Carga masiva finalizada.", result });
    }
  } catch (err: any) {
    return NextResponse.json({ message: err.message || "Error al importar datos." }, { status: 500 });
  }
}
