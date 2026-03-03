// app/api/fetch-results/route.ts
import { NextRequest, NextResponse } from 'next/server';

async function proxyRequest(req: NextRequest, method: string) {
  const targetUrl = req.nextUrl.searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    const upstream = await fetch(decodeURIComponent(targetUrl), {
      method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!upstream.ok) {
      const body = await upstream.text();
      return NextResponse.json(
        { error: `Upstream ${upstream.status}: ${body.slice(0, 200)}` },
        { status: upstream.status }
      );
    }

    // DELETE responses may be empty
    const text = await upstream.text();
    const data = text ? JSON.parse(text) : {};
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: `Proxy fetch failed: ${String(err)}` },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return proxyRequest(req, 'GET');
}

export async function DELETE(req: NextRequest) {
  return proxyRequest(req, 'DELETE');
}
