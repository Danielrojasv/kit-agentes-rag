// pdf-parse no publica tipos; declaración mínima para el import tardío.
declare module "pdf-parse" {
  function pdfParse(buffer: Buffer): Promise<{ text: string }>;
  export default pdfParse;
}
