import { supabase } from "@/lib/supabase";

export async function createChat(
  id: string,
  title = "Chat nuevo",
  userId: string
): Promise<string> {
  try {
    const { data, error } = await supabase
      .from("chats")
      .insert({
        id: id,
        user_id: userId,
        title: title,
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error("Failed to create chat", error);
    throw error;
  }
}

export async function addMessages({ messages }: { messages: any[] }) {
  try {
    const { data, error } = await supabase.from("messages").insert(messages);
    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Failed to add messages to database");
    throw error;
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const { data: selectedChat } = await supabase
      .from("chats")
      .select("*")
      .eq("id", id)
      .single();

    return selectedChat;
  } catch (error) {
    console.error("Failed to get chat by id from database", error);
    throw error;
  }
}
