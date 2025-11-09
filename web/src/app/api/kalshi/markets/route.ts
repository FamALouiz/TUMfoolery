import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function GET(request: Request) {
  try {
    // Get limit from query parameter (default to 10 for fast initial loading)
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 10;
    
    // Get the path to the Python script and directory
    // Use fast HTTP-based fetcher for quick initial loading
    const scriptDir = path.join(process.cwd(), 'kalshi-code');
    
    // Execute the Python script from the kalshi-code directory so it can find .env
    // Fast HTTP approach - gets first N markets quickly (seconds instead of 10+ seconds)
    const { stdout, stderr } = await execAsync(`python3 fetch_markets_fast.py --limit ${limit}`, {
      cwd: scriptDir,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large responses
      timeout: 15000, // 15 second timeout (increased to allow for related market searches)
    });
    
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
    console.error('Error fetching Kalshi markets:', error);
    
    // Return error response with more details
    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch Kalshi markets',
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

