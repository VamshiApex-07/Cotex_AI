import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import dotenv from "dotenv";
dotenv.config();

export const embeddings = new HuggingFaceInferenceEmbeddings({
  model: "BAAI/bge-small-en-v1.5",
  apiKey: process.env.HUGGINGFACEHUB_API_KEY,
});