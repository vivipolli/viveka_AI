declare module "pdf-parse/lib/pdf-parse.js" {
  interface PDFParseResult {
    text: string;
    numpages: number;
    info: unknown;
    metadata: unknown;
    version: string;
  }
  function pdfParse(dataBuffer: Buffer): Promise<PDFParseResult>;
  export default pdfParse;
}
