import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import Pg from "pg";

const { Pool } = Pg;
const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/url_shortener";
const pool = new Pool({ connectionString, max: 10 });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });

const BASE_URL = `http://localhost:${process.env.PORT || "3002"}`;

export async function request(
  method: string,
  path: string,
  body?: object,
  headers: Record<string, string> = {}
) {
  let url: string;
  if (String(path).startsWith("http")) {
    url = String(path);
  } else if (String(path).startsWith("/")) {
    url = BASE_URL + String(path);
  } else {
    url = BASE_URL + "/" + String(path);
  }
  
  const fetchOptions: RequestInit = {};
  fetchOptions.method = method;
  fetchOptions.headers = { "Content-Type": "application/json", ...headers };
  if (body) fetchOptions.body = JSON.stringify(body);
  
  const res = await fetch(url, fetchOptions);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}