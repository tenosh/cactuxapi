import { NextResponse } from "next/server";
import { google, GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import {
  streamText,
  appendResponseMessages,
  UIMessage,
  createDataStreamResponse,
  smoothStream,
} from "ai";
import { addMessages, createChat, getChatById } from "@/lib/chat-store";
import { tools } from "@/tools";
import { getMostRecentUserMessage, getTrailingMessageId } from "@/utils";
import { systemPrompt } from "@/lib/prompts";
import { generateTitleFromUserMessage } from "@/utils";

// Increase Next.js API timeout for streaming responses
export const config = {
  api: {
    // Edge functions don't use bodyParser or responseLimit
    // but we keep this for local development compatibility
    responseLimit: false,
    bodyParser: {
      sizeLimit: "4mb",
    },
  },
  maxDuration: 300, // 5 minutes in seconds
};

// Enable Edge Runtime for this API route
export const runtime = "edge";

// Add CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const {
      id: chatId,
      userId,
      messages,
    }: {
      id: string;
      userId: string;
      messages: Array<UIMessage>;
    } = await request.json();

    const userMessage = getMostRecentUserMessage(messages);

    if (!userMessage) {
      return NextResponse.json(
        { error: "No se encontró mensajes del usuario" },
        { status: 400, headers: corsHeaders }
      );
    }

    const chat = await getChatById({ id: chatId });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message: userMessage,
      });

      await createChat(chatId, title, userId);
    }

    await addMessages({
      messages: [
        {
          chat_id: chatId,
          id: userMessage.id,
          role: "user",
          parts: userMessage.parts,
        },
      ],
    });

    return createDataStreamResponse({
      execute: (dataStream) => {
        const result = streamText({
          model: google("gemini-2.5-flash-preview-04-17"),
          providerOptions: {
            google: {
              thinkingConfig: {
                thinkingBudget: 0,
              },
              responseModalities: ["TEXT"],
            } satisfies GoogleGenerativeAIProviderOptions,
          },
          system: systemPrompt,
          messages,
          maxSteps: 20,
          experimental_transform: smoothStream({ chunking: "word" }),
          tools: tools,
          onFinish: async ({ response }) => {
            try {
              const assistantId = getTrailingMessageId({
                messages: response.messages.filter(
                  (message) => message.role === "assistant"
                ),
              });

              if (!assistantId) {
                throw new Error("No assistant message found!");
              }

              const [, assistantMessage] = appendResponseMessages({
                messages: [userMessage],
                responseMessages: response.messages,
              });

              await addMessages({
                messages: [
                  {
                    id: assistantId,
                    chat_id: chatId,
                    role: assistantMessage.role,
                    parts: assistantMessage.parts,
                  },
                ],
              });
            } catch (error) {
              console.error("Failed to save chat", error);
            }
          },
        });

        // Consume the stream with error handling
        try {
          result.consumeStream().catch((streamError: Error) => {
            console.error("Stream error occurred:", streamError);
          });
        } catch (streamError) {
          console.error("Stream consumption error:", streamError);
        }

        result.mergeIntoDataStream(dataStream, {
          sendReasoning: true,
        });
      },
      onError: (error) => {
        if (error == null) {
          return "unknown error";
        }

        if (typeof error === "string") {
          return error;
        }

        if (error instanceof Error) {
          return error.message;
        }

        console.log(JSON.stringify(error));

        return JSON.stringify(error);
      },
      headers: corsHeaders,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "An error occurred while processing your request!" },
      { status: 404, headers: corsHeaders }
    );
  }
}
