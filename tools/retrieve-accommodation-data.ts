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
      .union([
        z.enum([
          "restaurant",
          "cafe",
          "hostel",
          "hotel",
          "private_rooms",
          "camping",
          "cerveza",
          "mezcal",
          "vino",
          "licor",
          "gasolina",
          "mecanico",
          "carniceria",
          "mercado",
          "abarrotes",
          "farmacias",
          "gym",
          "helados",
          "other",
        ]),
        z.array(
          z.enum([
            "restaurant",
            "cafe",
            "hostel",
            "hotel",
            "private_rooms",
            "camping",
            "cerveza",
            "mezcal",
            "vino",
            "licor",
            "gasolina",
            "mecanico",
            "carniceria",
            "mercado",
            "abarrotes",
            "farmacias",
            "gym",
            "helados",
            "other",
          ])
        ),
      ])
      .optional()
      .describe(
        "Type(s) of business to filter by (can be a single type or an array of types)"
      ),
  }),
  execute: async ({ userQuery, businessType }) => {
    // Convert businessType to array if it's a single string
    const businessTypeArray = businessType
      ? Array.isArray(businessType)
        ? businessType
        : [businessType]
      : [];
    // Handle case where userQuery might be undefined
    const query = userQuery || "accommodation in Guadalcazar";

    // Function to intelligently detect business types from the user query and/or explicitly provided businessType(s)
    const detectBusinessType = (
      query: string,
      providedBusinessTypes?: string | string[]
    ): string[] => {
      const lowerQuery = query.toLowerCase();
      const detectedTypes: string[] = [];

      // Check for restaurant keywords
      if (
        lowerQuery.includes("restaurante") ||
        lowerQuery.includes("comida") ||
        lowerQuery.includes("comer") ||
        lowerQuery.includes("cenar") ||
        lowerQuery.includes("desayunar") ||
        lowerQuery.includes("desayuno")
      ) {
        detectedTypes.push("restaurant");
      }

      // Check for cafe keywords
      if (
        lowerQuery.includes("cafe") ||
        lowerQuery.includes("café") ||
        lowerQuery.includes("cafeteria")
      ) {
        detectedTypes.push("cafe");
      }

      // Check for hostel keywords
      if (
        lowerQuery.includes("hostal") ||
        lowerQuery.includes("backpacker") ||
        lowerQuery.includes("dormitorio") ||
        lowerQuery.includes("cuartos compartidos")
      ) {
        detectedTypes.push("hostel");
      }

      // Check for hotel keywords
      if (
        lowerQuery.includes("hotel") ||
        lowerQuery.includes("motel") ||
        lowerQuery.includes("inn") ||
        lowerQuery.includes("lodge")
      ) {
        detectedTypes.push("hotel");
      }

      // Check for private rooms keywords
      if (
        lowerQuery.includes("cuartos privados") ||
        lowerQuery.includes("airbnb") ||
        lowerQuery.includes("habitación privada") ||
        lowerQuery.includes("cuarto privado")
      ) {
        detectedTypes.push("private_rooms");
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
        detectedTypes.push("camping");
      }

      // Check for cerveza keywords
      if (
        lowerQuery.includes("cerveza") ||
        lowerQuery.includes("cervecería") ||
        lowerQuery.includes("beer") ||
        lowerQuery.includes("birra") ||
        lowerQuery.includes("cervecería") ||
        lowerQuery.includes("chela") ||
        lowerQuery.includes("cheve")
      ) {
        detectedTypes.push("cerveza");
      }

      // Check for mezcal keywords
      if (
        lowerQuery.includes("mezcal") ||
        lowerQuery.includes("mezcalería") ||
        lowerQuery.includes("agave") ||
        lowerQuery.includes("destilado")
      ) {
        detectedTypes.push("mezcal");
      }

      // Check for vino keywords
      if (lowerQuery.includes("vino") || lowerQuery.includes("wine")) {
        detectedTypes.push("vino");
      }

      // Check for licor keywords
      if (
        lowerQuery.includes("licor") ||
        lowerQuery.includes("spirits") ||
        lowerQuery.includes("alcohol") ||
        lowerQuery.includes("bebidas")
      ) {
        detectedTypes.push("licor");
      }

      // Check for gasolina keywords
      if (
        lowerQuery.includes("gasolina") ||
        lowerQuery.includes("gas") ||
        lowerQuery.includes("combustible") ||
        lowerQuery.includes("petrol") ||
        lowerQuery.includes("gasolinera")
      ) {
        detectedTypes.push("gasolina");
      }

      // Check for mecanico keywords
      if (
        lowerQuery.includes("mecánico") ||
        lowerQuery.includes("mecanico") ||
        lowerQuery.includes("taller") ||
        lowerQuery.includes("reparación") ||
        lowerQuery.includes("auto") ||
        lowerQuery.includes("coche")
      ) {
        detectedTypes.push("mecanico");
      }

      // Check for carniceria keywords
      if (
        lowerQuery.includes("carnicería") ||
        lowerQuery.includes("carniceria") ||
        lowerQuery.includes("carne") ||
        lowerQuery.includes("butcher") ||
        lowerQuery.includes("meat")
      ) {
        detectedTypes.push("carniceria");
      }

      // Check for mercado keywords
      if (
        lowerQuery.includes("mercado") ||
        lowerQuery.includes("market") ||
        lowerQuery.includes("tianguis") ||
        lowerQuery.includes("plaza")
      ) {
        detectedTypes.push("mercado");
      }

      // Check for abarrotes keywords
      if (
        lowerQuery.includes("abarrotes") ||
        lowerQuery.includes("tienda") ||
        lowerQuery.includes("grocery") ||
        lowerQuery.includes("store") ||
        lowerQuery.includes("minisuper")
      ) {
        detectedTypes.push("abarrotes");
      }

      // Check for farmacias keywords
      if (
        lowerQuery.includes("farmacia") ||
        lowerQuery.includes("pharmacy") ||
        lowerQuery.includes("medicamento") ||
        lowerQuery.includes("medicine") ||
        lowerQuery.includes("droguería")
      ) {
        detectedTypes.push("farmacias");
      }

      // Check for gym keywords
      if (
        lowerQuery.includes("gym") ||
        lowerQuery.includes("gimnasio") ||
        lowerQuery.includes("fitness") ||
        lowerQuery.includes("ejercicio") ||
        lowerQuery.includes("workout")
      ) {
        detectedTypes.push("gym");
      }

      // Check for helados keywords
      if (
        lowerQuery.includes("helado") ||
        lowerQuery.includes("helados") ||
        lowerQuery.includes("ice cream") ||
        lowerQuery.includes("nieve") ||
        lowerQuery.includes("heladería")
      ) {
        detectedTypes.push("helados");
      }

      // Check for other keywords or if nothing specific is detected
      if (
        lowerQuery.includes("otro") ||
        lowerQuery.includes("other") ||
        lowerQuery.includes("servicio") ||
        lowerQuery.includes("service")
      ) {
        detectedTypes.push("other");
      }

      // Add the explicitly provided businessType(s) if they exist
      if (providedBusinessTypes) {
        const typesToAdd = Array.isArray(providedBusinessTypes)
          ? providedBusinessTypes
          : [providedBusinessTypes];

        // Add each type, avoiding duplicates
        typesToAdd.forEach((type) => {
          if (!detectedTypes.includes(type)) {
            detectedTypes.push(type);
          }
        });
      }

      // Return the detected types or an empty array if none detected
      return detectedTypes;
    };

    // Build filters object, prioritizing explicitly provided filters over detected ones
    const filters: Record<string, any> = {
      type: "business_info",
      source: "accommodation",
    };

    // Always detect business types from query and combine with explicitly provided businessType(s)
    const detectedTypes = detectBusinessType(query, businessTypeArray);
    if (detectedTypes.length > 0) {
      filters.business_type = detectedTypes;
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
      // Check if filters object is empty
      const isEmptyFilters = Object.keys(filters).length === 0;

      if (isEmptyFilters) {
        console.log("Skipping search due to empty filters");
        return {
          data: [],
          message: "Search skipped - no filters provided",
        };
      }

      const { data, error } = await supabase.rpc("match_advanced_data", {
        query_embedding: embedding,
        match_count: 10,
        filters: filters,
      });
      // console.log("Accommodation Data:", data);
      console.log("Accommodation Data returned");

      if (error) throw error;

      return data;
    } catch (error) {
      console.error("Error while retrieving accommodation data:", error);
      return "Error retrieving accommodation information";
    }
  },
});
