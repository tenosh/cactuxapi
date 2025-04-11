import { openai } from "@ai-sdk/openai";
import { generateObject, tool } from "ai";
import { z } from "zod";

export const enhanceUserQueryTool = tool({
  description:
    "Enhance and expand the user's query to improve search relevance",
  parameters: z.object({
    userQuery: z
      .string()
      .describe("The original user query that needs enhancement"),
  }),
  execute: async ({ userQuery }) => {
    if (!userQuery) {
      return userQuery || "";
    }

    try {
      const result = await generateObject({
        model: openai("gpt-4o-mini"),
        system: `You are a query enhancement specialist for a climbing information system about Guadalcazar, Mexico.

        Your task is to expand and enhance user queries to improve search relevance by:
        1. Adding relevant climbing terminology and synonyms
        2. Expanding abbreviated terms
        3. Including alternative names for climbing areas
        4. Adding context about Guadalcazar when appropriate
        5. Preserving the original language (Spanish or English)

        For example:
        - "donde dormir" → "opciones de alojamiento, hoteles, hostales, camping y hospedaje en Guadalcazar"
        - "routes in candelas" → "climbing routes, sport routes, trad routes, bouldering problems in Gruta de las Candelas, Las Candelas area"
        - "5.10 routes" → "climbing routes graded 5.10, 6a, 6a+, 6b in Guadalcazar including sport and trad"

        Keep the enhanced query concise (under 100 words) while maximizing search relevance.`,
        prompt: `Enhance this user query for better search results: "${userQuery}"`,
        schema: z.object({
          enhancedQuery: z.string().describe("The enhanced and expanded query"),
        }),
      });

      console.log("Query enhancement:", {
        original: userQuery,
        enhanced: result.object.enhancedQuery,
      });

      return result.object.enhancedQuery;
    } catch (error) {
      console.error("Error enhancing query:", error);
      // Fall back to original query if enhancement fails
      return userQuery;
    }
  },
});
