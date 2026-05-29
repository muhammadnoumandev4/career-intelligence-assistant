import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/** Reject anything larger than this to keep parsing bounded and the demo safe. */
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function extension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

/**
 * Extracts plain text from an uploaded resume/JD. Supports PDF (via unpdf, a
 * serverless-friendly pdf.js wrapper) and DOCX (via mammoth). Plain-text files
 * are read directly. Everything runs locally — no API keys, no external calls —
 * so it works in the deterministic, offline demo path.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart form upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "The uploaded file is empty." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 5 MB)." }, { status: 413 });
  }

  const ext = extension(file.name);

  try {
    let text = "";

    if (ext === "pdf" || file.type === "application/pdf") {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const pdf = await getDocumentProxy(buffer);
      const { text: pdfText } = await extractText(pdf, { mergePages: true });
      text = pdfText;
    } else if (ext === "docx" || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const buffer = Buffer.from(await file.arrayBuffer());
      const { value } = await mammoth.extractRawText({ buffer });
      text = value;
    } else if (["txt", "md", "csv"].includes(ext) || file.type.startsWith("text/")) {
      text = await file.text();
    } else if (ext === "doc") {
      return NextResponse.json(
        { error: "Legacy .doc isn't supported — please save as .docx or paste the text." },
        { status: 415 },
      );
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Upload a PDF, DOCX, or text file." },
        { status: 415 },
      );
    }

    const normalized = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
    if (!normalized) {
      return NextResponse.json(
        { error: "Could not extract any text (the file may be scanned/image-only)." },
        { status: 422 },
      );
    }

    logger.info("extract", { name: file.name.slice(0, 80), ext, chars: normalized.length });
    return NextResponse.json({ text: normalized, title: file.name.replace(/\.[^.]+$/, "") });
  } catch (error) {
    logger.error("extract failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Could not read that file. Try a different export or paste the text." }, { status: 422 });
  }
}
