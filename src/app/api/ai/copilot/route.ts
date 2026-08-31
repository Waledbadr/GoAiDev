import { NextRequest, NextResponse } from 'next/server';
import { askEstateCopilot, getOccupancyStats, getAttendanceReport, getLeavesReport, searchWorkers } from '@/ai/services/ai-copilot-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, history = [], action, query } = body;

    // Direct tool actions if requested
    if (action === 'occupancy') {
      const stats = getOccupancyStats();
      return NextResponse.json({ ok: true, data: stats });
    }

    if (action === 'attendance') {
      const stats = getAttendanceReport(query);
      return NextResponse.json({ ok: true, data: stats });
    }

    if (action === 'leaves') {
      const stats = getLeavesReport(query ? Number(query) : 30);
      return NextResponse.json({ ok: true, data: stats });
    }

    if (action === 'search_worker') {
      const results = searchWorkers(query || '');
      return NextResponse.json({ ok: true, data: results });
    }

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ ok: false, error: 'Message is required' }, { status: 400 });
    }

    const response = await askEstateCopilot(message, history);
    return NextResponse.json(response);
  } catch (err: any) {
    console.error('[API Copilot Route] Error:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
