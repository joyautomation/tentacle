export async function adcReadMilliamps(channel: number): Promise<number> {
  const command = new Deno.Command("./hardware/onlogic/fr202/adcRead.py", {
    args: [channel.toString()],
    stdout: "piped",
    stderr: "null",
  });

  const { stdout } = await command.output();
  const text = new TextDecoder().decode(stdout);
  const result = JSON.parse(text);
  return result.val;
}

async function openSerial(portPath: string) {
  const file = await Deno.open(portPath, { read: true, write: true });
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  return {
    async write(command: string) {
      await file.write(encoder.encode(command));
    },
    async read(): Promise<string> {
      const buffer = new Uint8Array(1024);
      const n = await file.read(buffer);
      if (n === null) return "";
      return decoder.decode(buffer.subarray(0, n));
    },
    close() {
      file.close();
    },
  };
}

export async function dioGetPinStatus(
  port: {
    write(command: string): Promise<void>;
    read(): Promise<string>;
    close(): void;
  },
  dir: "I" | "O",
  group: number,
  pin: number,
): Promise<string> {
  const dircmd = dir === "I" ? "input" : "output";
  await port.write(`dio get D${dir}_G${group} ${dircmd} ${pin}\n`);
  await new Promise((res) => setTimeout(res, 5));
  const result = await port.read();
  const lines = result.split("\r\n");
  return lines[1] ?? "";
}

export async function dioGetOnePinStatus(
  pin: number = 0,
  group: number = 0,
  portPath = "/dev/ttyACM0",
  dir: "I" | "O" = "I",
): Promise<boolean> {
  const port = await openSerial(portPath);
  const result = await dioGetPinStatus(port, dir, group, pin);
  port.close();
  return result === "1";
}

export async function dioGetAllPinStatus(
  portPath = "/dev/ttyACM0",
  dir: "I" | "O" = "I",
): Promise<string> {
  const port = await openSerial(portPath);
  let result = "";
  for (let group = 0; group < 4; group++) {
    for (let pin = 0; pin < 4; pin++) {
      const status = await dioGetPinStatus(port, dir, group, pin);
      result += status;
    }
  }
  port.close();
  if (result.includes("Failed")) {
    return "Not found";
  }
  return result;
}

// Function to handle clean exit
function startMonitoring(duration = 10000) {
  
  const interval = setInterval(async () => {
    try {
      console.log('starting read')
      const status = await dioGetAllPinStatus();
      console.log(status);
      for (const ch of [0, 2, 4, 6]) {
        const val = await adcReadMilliamps(ch);
        console.log(`Channel ${ch}: ${val} mA`);
      }
    } catch (error) {
      console.error('Error reading pin status:', error);
    }
  }, 5000);
  
  // Set up cleanup for graceful exit
  const cleanup = () => {
    clearInterval(interval);
    console.log('Monitoring stopped');
    
    // Exit process
    Deno.exit(0);
  };
  
  // Handle termination signals
  Deno.addSignalListener('SIGINT', cleanup);
  Deno.addSignalListener('SIGTERM', cleanup);
  
  // Auto-stop after specified duration
  if (duration > 0) {
    // setTimeout(cleanup, duration);
  }
  
  return cleanup; // Return cleanup function for manual stopping
}

// Start monitoring for 10 seconds
// Use the returned function to stop monitoring if needed
// startMonitoring();

// To manually stop: stopMonitoring();
