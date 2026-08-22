export interface AIService {
  generateDocument(data: unknown): Promise<string>;
  analyzeCase(data: unknown): Promise<unknown>;
  suggestQuestions(data: unknown): Promise<unknown>;
}

// Stub implementation — to be connected to a real service later
export const aiService: AIService = {
  async generateDocument(data: unknown) {
    // placeholder: return a simple string stating that the document was generated
    return Promise.resolve("[Documento generado — integración pendiente]");
  },
  async analyzeCase(data: unknown) {
    return Promise.resolve({});
  },
  async suggestQuestions(data: unknown) {
    return Promise.resolve([]);
  },
};
