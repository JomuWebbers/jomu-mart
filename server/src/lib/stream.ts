import { StreamChat } from "stream-chat";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.STREAM_API_KEY;
const apiSecret = process.env.STREAM_API_SECRET;

if (!apiKey || !apiSecret) {
  throw new Error(
    "Missing Stream Chat environment variables — check server/.env",
  );
}

export const streamApiKey = apiKey;

export function getStreamChatServer() {
  if (!apiKey || !apiSecret) {
    throw new Error("Missing Stream Chat environment variables — check server/.env");
  }
  return StreamChat.getInstance(apiKey, apiSecret);
}

export function streamUserId(userId: string) {
  return `jomumart_${userId}`;
}

export function streamDisplayName(role: string, name: string) {
  return role === "admin" ? `Support · ${name}` : name;
}
