import { google } from "@ai-sdk/google";
import { embed, tool } from "ai";
import { z } from "zod";
import { supabase } from "@/lib/supabase";

export const retrieveAccommodationDataTool = tool({
  description:
    "Retrieve accommodation, restaurant, and general place information from the Guadalcazar database",
  parameters: z.object({
    userQuery: z
      .string()
      .describe(
        "The user's query about accommodations, restaurants, or general information about Guadalcazar"
      ),
  }),
  execute: async ({ userQuery }) => {
    // Handle case where userQuery might be undefined
    const query = userQuery || "accommodation in Guadalcazar";

    const model = google.textEmbeddingModel("text-embedding-004", {
      outputDimensionality: 768, // match the dimensions expected by the database
      taskType: "SEMANTIC_SIMILARITY", // optional, specifies the task type for generating embeddings
    });

    const { embedding } = await embed({
      model: model,
      value: query,
    });

    try {
      const { data, error } = await supabase.rpc("match_data", {
        query_embedding: embedding,
        match_count: 10,
        filter: "accommodation",
      });

      if (error) throw error;

      interface MatchedData {
        title: string;
        content: string;
      }

      const formatted_chunks = data.map(
        (doc: MatchedData) => `# ${doc.title}\n\n${doc.content}`
      );

      return formatted_chunks.join("\n\n---\n\n");
    } catch (error) {
      console.error("Error while retrieving place data:", error);
      return "Error retrieving place information";
    }
  },
});
