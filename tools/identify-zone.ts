import { openai } from "@ai-sdk/openai";
import { generateObject, tool } from "ai";
import { z } from "zod";

export const identifyZoneTool = tool({
  description:
    "Identify which climbing zone in Guadalcazar the user is asking about",
  parameters: z.object({
    userQuery: z
      .string()
      .describe(
        "The user's query about Guadalcazar climbing, returns the complete user query"
      ),
  }),
  execute: async ({ userQuery }) => {
    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      system: `You are a climbing zone identifier for Guadalcazar. Your task is to identify which zone the user is asking about.

        Available zones and their alternative names:
        - Gruta de las Candelas (also known as: Las Candelas, Candelas)
        - Joya del Salitre (also known as: Salitre, El Salitre)
        - Panales
        - San Cayetano (also known as: San caye, Cayetano)
        - Zelda (also known as: Cuevas cuatas)

        IMPORTANT: Respond ONLY with one of these exact values:
        - "candelas"
        - "salitre"
        - "panales"
        - "cayetano"
        - "zelda"
        - "guadalcazar" (if query is about the general area)
        - null (if no zone can be confidently identified)

        When identifying San Cayetano or any of its variations, always return "cayetano".
        Handle typos and variations intelligently.
        `,
      prompt: `Identify the climbing zone from this query: ${userQuery}`,
      schema: z.object({
        zone: z.string(),
      }),
    });

    return result.object.zone;
  },
});
