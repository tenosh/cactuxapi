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
      const isBoulder =
        query.toLowerCase().includes("boulder") ||
        query.toLowerCase().includes("boulders") ||
        query.toLowerCase().includes("bouldering") ||
        query.toLowerCase().includes("bloque") ||
        query.toLowerCase().includes("bloques") ||
        query.toLowerCase().includes("bulder") ||
        query.toLowerCase().includes("bulders");
      const isRoute =
        query.toLowerCase().includes("ruta") ||
        query.toLowerCase().includes("sport") ||
        query.toLowerCase().includes("via") ||
        query.toLowerCase().includes("vía") ||
        query.toLowerCase().includes("deportiva") ||
        query.toLowerCase().includes("depo");

      // Handle cases where both types are mentioned
      if (isBoulder && isRoute) {
        // If both types are mentioned, don't set a specific type filter
        // This will allow the query to return both boulder and route results
        detectedFilters.type = undefined;
      } else if (isBoulder) {
        detectedFilters.type = "boulder_group";
      } else if (isRoute) {
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

      // Map zone keywords to standardized zone values
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
        comadres: "comadres",
        realejo: "comadres",
        "las comadres": "comadres",
        "el realejo": "comadres",
      };

      // Check if any zone keywords appear in the query
      for (const [keyword, standardZone] of Object.entries(zoneMap)) {
        if (lowerZone.includes(keyword.toLowerCase())) {
          console.log(
            "Zone detected in query:",
            keyword,
            "-> Mapped to:",
            standardZone
          );
          return standardZone;
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
    console.log("Detected zone:", detectedZone);
    if (detectedZone) {
      filters.source = detectedZone;
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
      // console.log("Data:", data);

      if (error) throw error;

      // For the retrieveRelevantClimbingData tool, add interface for the matched data
      interface MatchedData {
        id: string;
        title: string;
        content: string;
        summary: string;
        metadata: {
          type: string;
          source: string[];
          chunk_size: number;
          crawled_at: string;
          grade_group: string;
          route_count: number;
          sector_name: string;
          source_searchable: string;
        };
        similarity: number;
      }

      interface Route {
        id: string;
        sectorId: string;
        name: string;
        grade: string;
        type: string;
        quality: number;
        bolts?: number;
        description: string;
      }

      interface FormattedResponse {
        title: string;
        summary: string;
        routes: Route[];
      }

      // Log the raw data for debugging
      // console.log("Data:", data);

      // Parse the raw data to extract structured data
      const parsedData: FormattedResponse[] = data.map((doc: MatchedData) => {
        const routes: Route[] = [];
        const lines = doc.content.split("\n");
        let currentRoute: Partial<Route> = {};

        // We're still parsing the content field which contains the markdown text with route details
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();

          // Check if this is a route name (starts with ## )
          if (line.startsWith("## ")) {
            // If we have a route in progress, add it to the routes array
            if (currentRoute.name) {
              routes.push(currentRoute as Route);
            }

            // Start a new route
            currentRoute = {
              name: line.substring(3).trim(),
            };
          }
          // Parse route properties
          else if (line.startsWith("- **ID:**")) {
            currentRoute.id = line.substring(9).trim();
          } else if (line.startsWith("- **Sector ID:**")) {
            currentRoute.sectorId = line.substring(16).trim();
          } else if (line.startsWith("- **Grado:**")) {
            currentRoute.grade = line.substring(12).trim();
          } else if (line.startsWith("- **Tipo:**")) {
            currentRoute.type = line.substring(11).trim();
          } else if (line.startsWith("- **Calidad:**")) {
            currentRoute.quality = parseInt(line.substring(14).trim(), 10) || 0;
          } else if (line.startsWith("- **Bolts:**")) {
            currentRoute.bolts =
              parseInt(line.substring(12).trim(), 10) || undefined;
          }
          // If we're not on a property line and the next line is not a property or route name,
          // this is likely the description
          else if (
            line &&
            !line.startsWith("- **") &&
            (i === lines.length - 1 || !lines[i + 1].startsWith("- **"))
          ) {
            currentRoute.description = line;
          }
        }

        // Add the last route if there is one
        if (currentRoute.name) {
          routes.push(currentRoute as Route);
        }

        return {
          title: doc.title,
          summary: doc.summary,
          routes: routes,
        };
      });
      // console.log("Parsed data:", parsedData);

      // Return all parsed data items instead of just the first one
      return parsedData;
    } catch (error) {
      console.error("Error while retrieveRelevantClimbingData", error);
    }
  },
});
