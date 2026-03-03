// app/api/fetch-results/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const targetUrl = req.nextUrl.searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    const upstream = await fetch(decodeURIComponent(targetUrl), {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      // Next.js server-side fetch has no browser timeout limit
    });

    if (!upstream.ok) {
      const body = await upstream.text();
      return NextResponse.json(
        { error: `Upstream ${upstream.status}: ${body.slice(0, 200)}` },
        { status: upstream.status }
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: `Proxy fetch failed: ${String(err)}` },
      { status: 500 }
    );
  }
}
