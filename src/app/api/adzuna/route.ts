import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const p        = new URL(req.url).searchParams;
  const keyword  = p.get('what')         ?? '';
  const location = p.get('where')        ?? '';
  const page     = p.get('page')         ?? '1';
  const sortBy   = p.get('sort_by')      ?? 'relevance';
  const maxDays  = p.get('max_days_old') ?? '';
  const jobType  = p.get('job_type')     ?? '';   // full_time | part_time | contract
  const salMin   = p.get('salary_min')   ?? '';
  const salMax   = p.get('salary_max')   ?? '';

  const appId  = process.env.NEXT_PUBLIC_ADZUNA_APP_ID;
  const appKey = process.env.NEXT_PUBLIC_ADZUNA_APP_KEY;

  if (!appId || !appKey) {
    return NextResponse.json({ error: 'Adzuna credentials not configured' }, { status: 500 });
  }

  const url = new URL(`https://api.adzuna.com/v1/api/jobs/au/search/${page}`);
  url.searchParams.set('app_id',           appId);
  url.searchParams.set('app_key',          appKey);
  url.searchParams.set('results_per_page', '20');
  url.searchParams.set('content-type',     'application/json');

  if (keyword)  url.searchParams.set('what',  keyword);
  if (location) url.searchParams.set('where', location);
  if (sortBy && sortBy !== 'relevance') url.searchParams.set('sort_by', sortBy);
  if (maxDays)  url.searchParams.set('max_days_old', maxDays);
  if (jobType === 'full_time')  url.searchParams.set('full_time',  '1');
  if (jobType === 'part_time')  url.searchParams.set('part_time',  '1');
  if (jobType === 'contract')   url.searchParams.set('contract',   '1');
  if (salMin)   url.searchParams.set('salary_min', salMin);
  if (salMax)   url.searchParams.set('salary_max', salMax);

  try {
    const res  = await fetch(url.toString(), { next: { revalidate: 120 } });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch from Adzuna' }, { status: 502 });
  }
}
