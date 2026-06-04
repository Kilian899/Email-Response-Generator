export type ToneType = "Friendly" | "Formal" | "Sales-focused";

export interface ExampleMessage {
  id: string;
  label: string;
  category: string;
  content: string;
  suggestedTone: ToneType;
}

export interface GenerationHistory {
  id: string;
  timestamp: string;
  message: string;
  tone: ToneType;
  reply: string;
}
