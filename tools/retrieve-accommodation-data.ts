import { google } from "@ai-sdk/google";
import { embed, tool } from "ai";
import { z } from "zod";
import { supabase } from "@/lib/supabase";

export const retrieveAccommodationDataTool = tool({
  description:
    "Retrieve accommodation, hostels, hotels, camping, restaurant, stores, gasoline, pharmacies, and general place information from the Guadalcazar database",
  parameters: z.object({
    userQuery: z
      .string()
      .describe(
        "The user's query about accommodations, restaurants, or general information about Guadalcazar"
      ),
    businessType: z
      .enum([
        "restaurant",
        "cafe",
        "hostal",
        "hotel",
        "private_rooms",
        "camping",
        "other",
      ])
      .optional()
      .describe(
        "Type of business to filter by (restaurant, cafe, hostel, hotel, private_rooms, camping, other)"
      ),
  }),
  execute: async ({ userQuery, businessType }) => {
    // Handle case where userQuery might be undefined
    const query = userQuery || "accommodation in Guadalcazar";

    // Function to intelligently detect business types from the user query if not explicitly provided
    const detectBusinessType = (query: string) => {
      const lowerQuery = query.toLowerCase();

      // Check for restaurant keywords
      if (
        lowerQuery.includes("restaurante") ||
        lowerQuery.includes("comida") ||
        lowerQuery.includes("comer") ||
        lowerQuery.includes("cenar") ||
        lowerQuery.includes("desayunar") ||
        lowerQuery.includes("desayuno")
      ) {
        return "restaurant";
      }

      // Check for cafe keywords
      if (
        lowerQuery.includes("cafe") ||
        lowerQuery.includes("café") ||
        lowerQuery.includes("cafeteria")
      ) {
        return "cafe";
      }

      // Check for hostel keywords
      if (
        lowerQuery.includes("hostal") ||
        lowerQuery.includes("backpacker") ||
        lowerQuery.includes("dormitorio") ||
        lowerQuery.includes("cuartos compartidos")
      ) {
        return "hostal";
      }

      // Check for hotel keywords
      if (
        lowerQuery.includes("hotel") ||
        lowerQuery.includes("motel") ||
        lowerQuery.includes("inn") ||
        lowerQuery.includes("lodge")
      ) {
        return "hotel";
      }

      // Check for private rooms keywords
      if (
        lowerQuery.includes("cuartos privados") ||
        lowerQuery.includes("airbnb") ||
        lowerQuery.includes("habitación privada") ||
        lowerQuery.includes("cuarto privado")
      ) {
        return "private_rooms";
      }

      // Check for camping keywords
      if (
        lowerQuery.includes("camp") ||
        lowerQuery.includes("camping") ||
        lowerQuery.includes("tent") ||
        lowerQuery.includes("campsite") ||
        lowerQuery.includes("acampar") ||
        lowerQuery.includes("campamento") ||
        lowerQuery.includes("carpa")
      ) {
        return "camping";
      }

      // Default to undefined if no specific type is detected
      return undefined;
    };

    // Build filters object, prioritizing explicitly provided filters over detected ones
    const filters: Record<string, any> = {
      type: "business_info",
      source: "accommodation",
    };

    // Add business type filter if provided or detected
    if (businessType) {
      filters.business_type = [businessType];
    } else {
      const detectedType = detectBusinessType(query);
      if (detectedType) {
        filters.business_type = [detectedType];
      }
    }

    console.log("Applying filters:", filters);

    const model = google.textEmbeddingModel("text-embedding-004", {
      outputDimensionality: 768, // match the dimensions expected by the database
      taskType: "SEMANTIC_SIMILARITY", // optional, specifies the task type for generating embeddings
    });

    const { embedding } = await embed({
      model: model,
      value: query,
    });

    try {
      const { data, error } = await supabase.rpc("match_advanced_data", {
        query_embedding: embedding,
        match_count: 10,
        filters: filters,
      });
      console.log("Data:", data);

      if (error) throw error;

      return data;
    } catch (error) {
      console.error("Error while retrieving accommodation data:", error);
      return "Error retrieving accommodation information";
    }
  },
});
