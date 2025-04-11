import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import {
  streamText,
  appendResponseMessages,
  UIMessage,
  generateText,
  Message,
  createDataStreamResponse,
  smoothStream,
} from "ai";
import { addMessages, createChat, getChatById } from "@/lib/chat-store";
import { tools } from "@/tools";
import { getMostRecentUserMessage, getTrailingMessageId } from "@/utils";
import { systemPrompt } from "@/lib/prompts";

export async function generateTitleFromUserMessage({
  message,
}: {
  message: Message;
}) {
  const { text: title } = await generateText({
    model: openai("gpt-4o-mini"),
    system: `\n
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons
    - the title should be in spanish
    `,
    prompt: JSON.stringify(message),
  });

  return title;
}

export function errorHandler(error: unknown) {
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
      return new Response("No se encontró mensajes del usuario", {
        status: 400,
      });
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
          model: openai("gpt-4o-mini"),
          system: systemPrompt,
          messages,
          maxSteps: 10,
          experimental_transform: smoothStream({ chunking: "word" }),
          tools: tools,
          // toolChoice: "auto",
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
              console.error("Failed to save chat");
            }
          },
        });

        result.consumeStream();

        result.mergeIntoDataStream(dataStream, {
          sendReasoning: true,
        });
      },
      onError: (error) => {
        return errorHandler(error);
      },
    });
  } catch (error) {
    return new Response("An error occurred while processing your request!", {
      status: 404,
    });
  }
}
