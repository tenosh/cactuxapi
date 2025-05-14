import { google } from "@ai-sdk/google";
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
    zone: z
      .string()
      .optional()
      .describe("The zone to retrieve climbing data for"),
    type: z
      .enum(["sector_info", "route_group", "boulder_group"])
      .optional()
      .describe(
        "Type of climbing data to filter by (sector_info, route_group, boulder_group)"
      ),
    gradeGroup: z
      .array(z.string())
      .optional()
      .describe("Array of grade groups to filter by (e.g., ['5.13', 'V8'])"),
  }),
  execute: async ({ userQuery, zone, type, gradeGroup }) => {
    // Function to intelligently detect filters from the user query if not explicitly provided
    const detectFilters = (query: string) => {
      const detectedFilters: {
        type?: string;
        gradeGroup?: string[];
      } = {};

      // Detect climbing type (boulders vs routes)
      if (
        query.toLowerCase().includes("boulder") ||
        query.toLowerCase().includes("bouldering")
      ) {
        detectedFilters.type = "boulder_group";
      } else if (
        query.toLowerCase().includes("route") ||
        query.toLowerCase().includes("sport")
      ) {
        detectedFilters.type = "route_group";
      }

      // Detect grades
      const boulderGradeRegex = /\bV\d+\b/gi;
      const routeGradeRegex = /\b5\.\d+[+-]?\b/gi;

      const boulderGrades = query.match(boulderGradeRegex) || [];
      const routeGrades = query.match(routeGradeRegex) || [];

      if (boulderGrades.length > 0 || routeGrades.length > 0) {
        detectedFilters.gradeGroup = [...boulderGrades, ...routeGrades];
      }

      return detectedFilters;
    };

    // Extract potential zone from user query if not explicitly provided
    const parseZone = (zone: string | undefined): string | undefined => {
      if (!zone) return undefined;

      const lowerZone = zone.toLowerCase();
      console.log("Detecting zone from query:", lowerZone);

      const zoneKeywords = [
        "gruta de las candelas",
        "las candelas",
        "candelas",
        "joya del salitre",
        "el salitre",
        "salitre",
        "panales",
        "san cayetano",
        "san caye",
        "cayetano",
        "zelda",
        "cuevas cuatas",
        "comadres",
        "realejo",
        "las comadres",
        "el realejo",
        "guadalcazar",
      ];

      // Check if any zone keywords appear in the query
      for (const keyword of zoneKeywords) {
        if (lowerZone.includes(keyword.toLowerCase())) {
          console.log("Zone detected in query:", keyword);
          return keyword;
        }
      }

      // If query mentions boulder/bouldering and doesn't specify a zone, default to comadres
      if (lowerZone.includes("boulder") || lowerZone.includes("bouldering")) {
        console.log("Bouldering query detected, defaulting to comadres");
        return "comadres";
      }

      console.log("No zone detected in query");
      return undefined;
    };

    // Detect filters from user query if not explicitly provided
    const detectedFilters = detectFilters(userQuery);

    // Build filters object, prioritizing explicitly provided filters over detected ones
    const filters: Record<string, any> = {};

    // For zone, first use provided zone, then try to detect from query
    const detectedZone = parseZone(zone);
    if (detectedZone) {
      filters.source = detectedZone;
    } else {
      filters.source = "guadalcazar";
    }

    if (type) {
      filters.type = type;
    } else if (detectedFilters.type) {
      filters.type = detectedFilters.type;
    }

    if (gradeGroup && gradeGroup.length > 0) {
      filters.grade_group = gradeGroup;
    } else if (
      detectedFilters.gradeGroup &&
      detectedFilters.gradeGroup.length > 0
    ) {
      filters.grade_group = detectedFilters.gradeGroup;
    }

    const model = google.textEmbeddingModel("text-embedding-004", {
      outputDimensionality: 768, // match the dimensions expected by the database
      taskType: "SEMANTIC_SIMILARITY", // optional, specifies the task type for generating embeddings
    });

    const { embedding } = await embed({
      model: model,
      value: userQuery,
    });

    console.log("Applying filters:", filters);

    try {
      const { data, error } = await supabase.rpc("match_advanced_data", {
        query_embedding: embedding,
        match_count: 10,
        filters: filters,
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
