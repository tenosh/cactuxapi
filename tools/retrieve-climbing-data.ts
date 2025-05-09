import { openai } from "@ai-sdk/openai";
import { embed, tool } from "ai";
import { z } from "zod";
import { supabase } from "@/lib/supabase";

export const retrieveRelevantClimbingDataTool = tool({
  description:
    "Search and retrieve relevant climbing information from the Guadalcazar database, including routes, grades, locations, and local amenities based on the user's query",
  parameters: z.object({
    userQuery: z
      .string()
      .describe(
        "The user's query about Guadalcazar climbing areas, routes, or local information"
      ),
    zone: z.string().describe("The zone to retrieve climbing data for"),
  }),
  execute: async ({ userQuery, zone }) => {
    const normalizeZone = (zone: string): string => {
      if (!zone) return "guadalcazar";

      const zoneMap: Record<string, string> = {
        "gruta de las candelas": "candelas",
        "las candelas": "candelas",
        candelas: "candelas",
        "joya del salitre": "salitre",
        "el salitre": "salitre",
        salitre: "salitre",
        panales: "panales",
        "san cayetano": "san cayetano",
        "san caye": "san cayetano",
        cayetano: "san cayetano",
        zelda: "zelda",
        "cuevas cuatas": "zelda",
        guadalcazar: "guadalcazar",
      };

      const normalizedInput = zone.toLowerCase().trim();
      return zoneMap[normalizedInput] || "guadalcazar";
    };
    const normalizedZone = normalizeZone(zone);

    const { embedding } = await embed({
      model: openai.embedding("text-embedding-3-small"),
      value: userQuery,
    });

    try {
      const { data, error } = await supabase.rpc("match_data", {
        query_embedding: embedding,
        match_count: 20,
        filter: normalizedZone,
      });

      if (error) throw error;

      // For the retrieveRelevantClimbingData tool, add interface for the matched data
      interface MatchedData {
        title: string;
        content: string;
      }

      // Update the data mapping
      const formatted_chunks = data.map(
        (doc: MatchedData) => `# ${doc.title}\n\n${doc.content}`
      ) as string[];

      // Return with explicit type
      return formatted_chunks.join("\n\n---\n\n") as string;
    } catch (error) {
      console.error("Error while retrieveRelevantClimbingData", error);
    }
  },
});
