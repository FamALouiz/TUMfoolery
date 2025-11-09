import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  // Create a ReadableStream for Server-Sent Events
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let isClosed = false;
      
      // Helper function to send SSE message
      const sendSSE = (data: any) => {
        // Don't try to send if controller is already closed
        if (isClosed) {
          return;
        }
        
        try {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (error: any) {
          // If controller is closed, just ignore
          if (error.code === 'ERR_INVALID_STATE' || error.message?.includes('closed')) {
            isClosed = true;
            return;
          }
          // Re-throw other errors
          throw error;
        }
      };
      
      // Helper to safely close the controller
      const closeController = () => {
        if (!isClosed) {
          try {
            controller.close();
            isClosed = true;
          } catch (error) {
            // Already closed, ignore
            isClosed = true;
          }
        }
      };

      // Send initial connection message
      sendSSE({
        type: 'status',
        message: 'Connecting to Kalshi WebSocket...',
        timestamp: Date.now()
      });

      // Get the path to the Python script
      const scriptPath = path.join(process.cwd(), 'kalshi-code', 'websocket_stream.py');
      const scriptDir = path.join(process.cwd(), 'kalshi-code');

      // Spawn Python process
      const pythonProcess = spawn('python3', [scriptPath], {
        cwd: scriptDir,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1' // Ensure unbuffered output
        }
      });

      let buffer = '';

      // Handle stdout data
      pythonProcess.stdout.on('data', (data: Buffer) => {
        buffer += data.toString();
        
        // Process complete JSON lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine) {
            try {
              const jsonData = JSON.parse(trimmedLine);
              sendSSE(jsonData);
            } catch (error) {
              // If it's not valid JSON, send as raw message
              sendSSE({
                type: 'raw',
                message: trimmedLine,
                timestamp: Date.now()
              });
            }
          }
        }
      });

      // Handle stderr
      pythonProcess.stderr.on('data', (data: Buffer) => {
        const errorText = data.toString();
        // Only send non-warning errors
        if (!errorText.includes('Warning') && !errorText.includes('DeprecationWarning')) {
          sendSSE({
            type: 'error',
            message: errorText,
            timestamp: Date.now()
          });
        }
      });

      // Handle process exit
      pythonProcess.on('exit', (code) => {
        if (code !== null && code !== 0) {
          sendSSE({
            type: 'error',
            message: `Python process exited with code ${code}`,
            timestamp: Date.now()
          });
        } else {
          sendSSE({
            type: 'status',
            message: 'WebSocket connection closed',
            timestamp: Date.now()
          });
        }
        closeController();
      });

      // Handle process error
      pythonProcess.on('error', (error) => {
        sendSSE({
          type: 'error',
          message: `Failed to start Python process: ${error.message}`,
          timestamp: Date.now()
        });
        closeController();
      });

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        try {
          pythonProcess.kill('SIGTERM');
        } catch (error) {
          // Process might already be dead, ignore
        }
        closeController();
      });
    }
  });

  // Return SSE response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering in nginx
    },
  });
}

