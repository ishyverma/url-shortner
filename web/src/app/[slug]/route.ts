import { NextResponse } from "next/server";

const EXCLUDED_PATHS = ["api", "settings", "analytics", "_next", "favicon.ico", "_document"];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!slug || EXCLUDED_PATHS.some(p => slug.startsWith(p))) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
    const response = await fetch(`${baseUrl}/${slug}`, {
      redirect: "manual",
    });

    if (response.status === 302 || response.status === 301) {
      const location = response.headers.get("Location");
      if (location) {
        return NextResponse.redirect(location, response.status);
      }
    }

    if (response.status === 410) {
      return NextResponse.json({ error: "Link has expired or been deactivated" }, { status: 410 });
    }

    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch link" }, { status: 500 });
  }
}