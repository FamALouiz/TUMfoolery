import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function GET(request: Request) {
  try {
    // Get limit from query parameter (default to 50 for Manifold - smaller dataset)
    const { searchParams } = new URL(request.url);
    const startWeek = searchParams.get('startWeek') ? parseInt(searchParams.get('startWeek')!, 10) : 11;
    const maxWeeks = searchParams.get('maxWeeks') ? parseInt(searchParams.get('maxWeeks')!, 10) : 20;
    
    // Get the path to the Python script and directory
    const scriptDir = path.join(process.cwd(), 'manifold-code');
    
    // Execute the Python script from the manifold-code directory
    const { stdout, stderr } = await execAsync(
      `python3 fetch_markets.py --start-week ${startWeek} --max-weeks ${maxWeeks}`,
      {
        cwd: scriptDir,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: 10000, // 10 second timeout (should be quick for Manifold)
      }
    );
    
    if (stderr && !stderr.includes('Warning') && !stderr.includes('DeprecationWarning')) {
      console.error('Python script stderr:', stderr);
    }
    
    // Parse the JSON output
    let result;
    try {
      result = JSON.parse(stdout);
    } catch (parseError) {
      console.error('Failed to parse Python output:', stdout);
      return NextResponse.json(
        {
          error: `Failed to parse Python script output: ${parseError}`,
          markets: [],
          debug: { stdout: stdout.substring(0, 500), stderr }
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching Manifold markets:', error);
    
    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch Manifold markets',
        markets: [],
        debug: {
          message: error.message,
          stack: error.stack?.substring(0, 500)
        }
      },
      { status: 500 }
    );
  }
}

